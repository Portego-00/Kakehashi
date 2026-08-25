import {
  createClient,
  type SupabaseClient,
} from "npm:@supabase/supabase-js@2.86.2";
import { createNhkArticleSession, fetchBoundedText } from "./nhk_client.ts";
import {
  NHK_FEED_URL,
  type NhkArticleRow,
  type NhkFeedItem,
  normalizeFullArticle,
  parseNhkRss,
  summaryRow,
} from "./parser.ts";

const ARTICLE_CONCURRENCY = 2;
const RETENTION_DAYS = 45;

interface SyncDependencies {
  env: (name: string) => string | undefined;
  createSupabaseClient: (url: string, serviceRoleKey: string) => SupabaseClient;
  fetchFeed: typeof fetchBoundedText;
  createSession: typeof createNhkArticleSession;
  now: () => Date;
}

const defaultDependencies: SyncDependencies = {
  env: (name) => Deno.env.get(name),
  createSupabaseClient: (url, serviceRoleKey) =>
    createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  fetchFeed: fetchBoundedText,
  createSession: createNhkArticleSession,
  now: () => new Date(),
};

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

function constantTimeEqual(left: string, right: string): boolean {
  const maximumLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < maximumLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), items.length) },
      worker,
    ),
  );
  return results;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function withContentHash(row: NhkArticleRow): Promise<NhkArticleRow> {
  return {
    ...row,
    content_hash: await sha256(
      [row.title, row.source_updated_at ?? "", row.content_html].join("\n"),
    ),
  };
}

async function fetchRows(
  feedItems: readonly NhkFeedItem[],
  now: string,
  dependencies: SyncDependencies,
): Promise<
  { rows: NhkArticleRow[]; fullCount: number; fallbackCount: number }
> {
  let session: Awaited<ReturnType<typeof createNhkArticleSession>>;
  try {
    session = await dependencies.createSession(feedItems[0].id);
  } catch {
    // NHK may temporarily change or reject its anonymous-reader handshake. Keep
    // the feed current without replacing any complete articles already stored.
    const rows = await Promise.all(
      feedItems.map((feedItem) => withContentHash(summaryRow(feedItem, now))),
    );
    return { rows, fullCount: 0, fallbackCount: rows.length };
  }
  let fullCount = 0;
  let fallbackCount = 0;

  const rows = await mapWithConcurrency(
    feedItems,
    ARTICLE_CONCURRENCY,
    async (feedItem) => {
      try {
        const detail = await session.fetchArticle(feedItem.id);
        const row = await withContentHash(
          normalizeFullArticle(detail, feedItem, now),
        );
        fullCount += 1;
        return row;
      } catch {
        // A single developing/restricted story must not block the rest of the feed.
        // Summary rows are inserted only when the ID is new, so this never
        // downgrades a previously cached complete article.
        fallbackCount += 1;
        return await withContentHash(summaryRow(feedItem, now));
      }
    },
  );

  return { rows, fullCount, fallbackCount };
}

async function persistRows(
  supabase: SupabaseClient,
  rows: readonly NhkArticleRow[],
  now: Date,
): Promise<void> {
  const fullRows = rows.filter((row) => row.is_full_article);
  const summaryRows = rows.filter((row) => !row.is_full_article);

  if (summaryRows.length > 0) {
    const { error } = await supabase
      .from("nhk_regular_articles")
      .upsert(summaryRows, { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      throw new Error(`Could not insert NHK summaries: ${error.message}`);
    }
  }

  if (fullRows.length > 0) {
    const { error } = await supabase
      .from("nhk_regular_articles")
      .upsert(fullRows, { onConflict: "id" });
    if (error) {
      throw new Error(`Could not upsert NHK articles: ${error.message}`);
    }
  }

  const ids = rows.map((row) => row.id);
  if (ids.length > 0) {
    const { error } = await supabase
      .from("nhk_regular_articles")
      .update({ last_seen_at: now.toISOString() })
      .in("id", ids);
    if (error) {
      throw new Error(`Could not mark NHK articles seen: ${error.message}`);
    }
  }

  const cutoff = new Date(
    now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1_000,
  ).toISOString();
  const { error: pruneError } = await supabase
    .from("nhk_regular_articles")
    .delete()
    .lt("last_seen_at", cutoff);
  if (pruneError) {
    throw new Error(`Could not prune old NHK articles: ${pruneError.message}`);
  }
}

export async function handleSyncRequest(
  request: Request,
  overrides: Partial<SyncDependencies> = {},
): Promise<Response> {
  const dependencies = { ...defaultDependencies, ...overrides };
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const configuredSecret = dependencies
    .env("NHK_REGULAR_NEWS_SYNC_SECRET")
    ?.trim();
  const suppliedSecret = request.headers.get("x-nhk-sync-secret") ?? "";
  if (
    !configuredSecret || !constantTimeEqual(suppliedSecret, configuredSecret)
  ) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = dependencies.env("SUPABASE_URL")?.trim();
  const serviceRoleKey = dependencies.env("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Backend storage is not configured" }, 500);
  }

  const now = dependencies.now();
  const supabase = dependencies.createSupabaseClient(
    supabaseUrl,
    serviceRoleKey,
  );
  try {
    if (request.headers.get("x-nhk-bootstrap") === "true") {
      const { error } = await supabase.rpc(
        "configure_nhk_regular_news_sync",
        {
          p_project_url: supabaseUrl,
          p_sync_secret: configuredSecret,
        },
      );
      if (error) {
        throw new Error("Could not configure the NHK sync schedule");
      }
      return jsonResponse({ ok: true, configured: true });
    }

    const feedXml = await dependencies.fetchFeed(NHK_FEED_URL);
    const feedItems = parseNhkRss(feedXml);
    if (feedItems.length === 0) {
      throw new Error("NHK RSS contained no valid articles");
    }

    const result = await fetchRows(
      feedItems,
      now.toISOString(),
      dependencies,
    );
    await persistRows(supabase, result.rows, now);

    return jsonResponse({
      ok: true,
      seen: feedItems.length,
      full: result.fullCount,
      summaries: result.fallbackCount,
      syncedAt: now.toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Unknown sync failure";
    console.error("NHK regular news sync failed:", message);
    return jsonResponse({ error: "NHK regular news sync failed" }, 502);
  }
}

if (import.meta.main) {
  Deno.serve((request) => handleSyncRequest(request));
}
