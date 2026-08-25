import type { SupabaseClient } from "npm:@supabase/supabase-js@2.86.2";
import { handleSyncRequest } from "./index.ts";

function assertEquals(actual: unknown, expected: unknown): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Assertion failed\nActual: ${JSON.stringify(actual)}\nExpected: ${
        JSON.stringify(expected)
      }`,
    );
  }
}

Deno.test("sync endpoint rejects unauthorized calls before doing work", async () => {
  let fetched = false;
  const response = await handleSyncRequest(
    new Request("https://example.test/functions/v1/sync", {
      method: "POST",
      headers: { "x-nhk-sync-secret": "wrong" },
    }),
    {
      env: (name) =>
        name === "NHK_REGULAR_NEWS_SYNC_SECRET" ? "correct-secret" : undefined,
      fetchFeed: async () => {
        fetched = true;
        return "";
      },
    },
  );

  assertEquals(response.status, 401);
  assertEquals(fetched, false);
});

Deno.test("authorized bootstrap stores cron configuration without fetching NHK", async () => {
  let fetched = false;
  let rpcCall: { name: string; args: unknown } | null = null;
  const fakeSupabase = {
    rpc(name: string, args: unknown) {
      rpcCall = { name, args };
      return Promise.resolve({ data: null, error: null });
    },
  } as unknown as SupabaseClient;

  const response = await handleSyncRequest(
    new Request("https://example.test/functions/v1/sync", {
      method: "POST",
      headers: {
        "x-nhk-bootstrap": "true",
        "x-nhk-sync-secret": "correct-secret-correct-secret-1234",
      },
    }),
    {
      env: (name) => {
        if (name === "NHK_REGULAR_NEWS_SYNC_SECRET") {
          return "correct-secret-correct-secret-1234";
        }
        if (name === "SUPABASE_URL") return "https://project.supabase.co";
        if (name === "SUPABASE_SERVICE_ROLE_KEY") return "service-role";
        return undefined;
      },
      fetchFeed: async () => {
        fetched = true;
        return "";
      },
      createSupabaseClient: () => fakeSupabase,
    },
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { ok: true, configured: true });
  assertEquals(fetched, false);
  assertEquals(rpcCall, {
    name: "configure_nhk_regular_news_sync",
    args: {
      p_project_url: "https://project.supabase.co",
      p_sync_secret: "correct-secret-correct-secret-1234",
    },
  });
});

Deno.test("sync endpoint persists a normalized full article", async () => {
  const operations: Array<{ kind: string; value: unknown }> = [];
  const query = {
    upsert(value: unknown, options: unknown) {
      operations.push({ kind: "upsert", value: { value, options } });
      return Promise.resolve({ error: null });
    },
    update(value: unknown) {
      operations.push({ kind: "update", value });
      return {
        in(_column: string, ids: unknown) {
          operations.push({ kind: "in", value: ids });
          return Promise.resolve({ error: null });
        },
      };
    },
    delete() {
      operations.push({ kind: "delete", value: null });
      return {
        lt(_column: string, cutoff: unknown) {
          operations.push({ kind: "lt", value: cutoff });
          return Promise.resolve({ error: null });
        },
      };
    },
  };
  const fakeSupabase = {
    from(table: string) {
      assertEquals(table, "nhk_regular_articles");
      return query;
    },
  } as unknown as SupabaseClient;

  const articleId = "nd-20260822de45682";
  const canonical = `https://news.web.nhk/newsweb/na/${articleId}`;
  const longBody = "完全な記事本文のテストです。".repeat(20);
  const rss = `<?xml version="1.0"?><rss><channel><item>
    <title>台風 接近のおそれ</title>
    <link>${canonical}</link>
    <guid>${canonical}</guid>
    <pubDate>Sat, 22 Aug 2026 08:00:00 +0900</pubDate>
    <description>台風に注意してください。</description>
  </item></channel></rss>`;

  const response = await handleSyncRequest(
    new Request("https://example.test/functions/v1/sync", {
      method: "POST",
      headers: { "x-nhk-sync-secret": "correct-secret" },
    }),
    {
      env: (name) => {
        if (name === "NHK_REGULAR_NEWS_SYNC_SECRET") return "correct-secret";
        if (name === "SUPABASE_URL") return "https://project.supabase.co";
        if (name === "SUPABASE_SERVICE_ROLE_KEY") return "service-role";
        return undefined;
      },
      fetchFeed: async () => rss,
      createSession: (async () => ({
        fetchArticle: async () => ({
          id: articleId,
          headline: "台風 接近のおそれ",
          canonical,
          datePublished: "2026-08-22T08:00:00+09:00",
          dateModified: "2026-08-22T09:00:00+09:00",
          image: {
            medium: {
              url: "https://imgu.web.nhk/news/u/news/nd/example/lead_l.jpg",
            },
          },
          detailedArticleBody: {
            noHtmlMarkedLead: "概要です。",
            noHtmlMarkedBody: `## 詳細\n\n${longBody}`,
          },
        }),
      })) as never,
      createSupabaseClient: () => fakeSupabase,
      now: () => new Date("2026-08-22T01:00:00.000Z"),
    },
  );

  assertEquals(response.status, 200);
  const body = await response.json();
  assertEquals(body, {
    ok: true,
    seen: 1,
    full: 1,
    summaries: 0,
    syncedAt: "2026-08-22T01:00:00.000Z",
  });

  const upsert = operations.find((operation) => operation.kind === "upsert");
  if (!upsert) throw new Error("Expected an article upsert");
  const rows =
    (upsert.value as { value: Array<Record<string, unknown>> }).value;
  assertEquals(rows[0].id, articleId);
  assertEquals(rows[0].is_full_article, true);
  if (typeof rows[0].content_hash !== "string") {
    throw new Error("Expected a content hash");
  }
});

Deno.test("sync endpoint preserves the feed when NHK session setup fails", async () => {
  let insertedRows: Array<Record<string, unknown>> = [];
  const query = {
    upsert(value: Array<Record<string, unknown>>) {
      insertedRows = value;
      return Promise.resolve({ error: null });
    },
    update() {
      return { in: () => Promise.resolve({ error: null }) };
    },
    delete() {
      return { lt: () => Promise.resolve({ error: null }) };
    },
  };
  const fakeSupabase = {
    from: () => query,
  } as unknown as SupabaseClient;
  const articleId = "nc-{article-uuid}";
  const canonical = `https://news.web.nhk/newsweb/na/${articleId}`;
  const rss = `<rss><channel><item>
    <title>速報の見出し</title>
    <link>${canonical}</link>
    <guid>${canonical}</guid>
    <pubDate>Sat, 22 Aug 2026 08:00:00 +0900</pubDate>
    <description>速報の概要です。</description>
  </item></channel></rss>`;

  const response = await handleSyncRequest(
    new Request("https://example.test/functions/v1/sync", {
      method: "POST",
      headers: { "x-nhk-sync-secret": "correct-secret" },
    }),
    {
      env: (name) => {
        if (name === "NHK_REGULAR_NEWS_SYNC_SECRET") return "correct-secret";
        if (name === "SUPABASE_URL") return "https://project.supabase.co";
        if (name === "SUPABASE_SERVICE_ROLE_KEY") return "service-role";
        return undefined;
      },
      fetchFeed: async () => rss,
      createSession: (async () => {
        throw new Error("Reader handshake unavailable");
      }) as never,
      createSupabaseClient: () => fakeSupabase,
      now: () => new Date("2026-08-22T01:00:00.000Z"),
    },
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    ok: true,
    seen: 1,
    full: 0,
    summaries: 1,
    syncedAt: "2026-08-22T01:00:00.000Z",
  });
  assertEquals(insertedRows[0].id, articleId);
  assertEquals(insertedRows[0].is_full_article, false);
  if (typeof insertedRows[0].content_hash !== "string") {
    throw new Error("Expected a summary content hash");
  }
});
