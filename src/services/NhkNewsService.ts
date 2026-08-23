import { XMLParser } from "fast-xml-parser";
import { supabase } from "../lib/supabase";

export type NewsSource = "easy" | "regular";
export type NewsSourcePreference = NewsSource | "both";

export interface NewsItem {
  /** Source-qualified and stable across refreshes (for example, easy:9892). */
  id: string;
  source: NewsSource;
  title: string;
  link: string;
  pubDate: string;
  guid: string;
  imageUrl: string | null;
  audioUrl: string | null;
  contentHtml: string;
  /** False for RSS-only fallbacks; true when the complete article is available. */
  isFullArticle?: boolean;
}

interface OEmbedResponse {
  thumbnail_url?: unknown;
}

const EASY_FEED_URL = "https://nhkeasier.com/feed/";
const EASY_BASE_URL = "https://nhkeasier.com";
const REGULAR_FEED_URL =
  "https://news.web.nhk/n-data/conf/na/rss/cat0.xml";
const OEMBED_URL = "https://www.web.nhk/oembed";
const REGULAR_ARTICLE_BASE_URL = "https://news.web.nhk/newsweb/na";
const REGULAR_ARTICLES_TABLE = "nhk_regular_articles";
const REGULAR_ARTICLES_LIMIT = 20;
const REGULAR_ARTICLES_COLUMNS =
  "id,title,canonical_url,guid,published_at,image_url,audio_url,content_html,is_full_article";
const REQUEST_TIMEOUT_MS = 12_000;
const OEMBED_CONCURRENCY = 4;
const MAX_REGULAR_CONTENT_HTML_LENGTH = 500_000;

const SAFE_REGULAR_CONTENT_TAGS = new Set([
  "p",
  "br",
  "h1",
  "h2",
  "h3",
  "h4",
  "strong",
  "em",
  "b",
  "i",
  "ruby",
  "rt",
  "rp",
  "span",
  "img",
  "figure",
  "figcaption",
  "ul",
  "ol",
  "li",
  "blockquote",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
});

let cachedItems: NewsItem[] = [];
let cacheGeneration = 0;

function valueAsString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value && typeof value === "object") {
    const text = (value as Record<string, unknown>)["#text"];
    return valueAsString(text);
  }
  return "";
}

function rssItems(xmlText: string): unknown[] {
  const feed = parser.parse(xmlText) as {
    rss?: { channel?: { item?: unknown | unknown[] } };
  };
  const items = feed.rss?.channel?.item;
  if (items === undefined || items === null) return [];
  return Array.isArray(items) ? items : [items];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plainTextFromPossiblyHtml(value: string): string {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function regularSummaryToHtml(description: string): string {
  const summary = plainTextFromPossiblyHtml(description);
  return summary
    ? `<p>${escapeHtml(summary).replace(/\n/g, "<br />")}</p>`
    : "";
}

function extractAttributeSource(html: string, tagName: "img" | "audio"): string {
  const expression = new RegExp(
    `<${tagName}\\b[^>]*\\bsrc\\s*=\\s*(["'])(.*?)\\1`,
    "i",
  );
  return expression.exec(html)?.[2]?.trim() ?? "";
}

function resolveEasyUrl(value: string): string | null {
  if (!value) return null;
  try {
    return new URL(value, `${EASY_BASE_URL}/`).toString();
  } catch {
    return null;
  }
}

function easyStableId(guid: string, link: string, fallback: string): string {
  const identity = guid || link || fallback;
  const storyNumber = /\/story\/([^/?#]+)/i.exec(identity)?.[1];
  return `easy:${storyNumber || encodeURIComponent(identity)}`;
}

function regularArticleId(...candidates: string[]): string {
  for (const candidate of candidates) {
    const pathMatch = /\/newsweb\/na\/([^/?#]+)/i.exec(candidate)?.[1];
    if (!pathMatch) continue;
    try {
      return decodeURIComponent(pathMatch);
    } catch {
      return pathMatch;
    }
  }
  return "";
}

function canonicalRegularLink(
  link: string,
  guid: string,
  articleId: string,
): string {
  for (const candidate of [link, guid]) {
    try {
      const url = new URL(candidate);
      if (
        url.protocol === "https:" &&
        url.hostname === "news.web.nhk" &&
        url.pathname.startsWith("/newsweb/na/")
      ) {
        url.search = "";
        url.hash = "";
        return url.toString().replace(/\/$/, "");
      }
    } catch {
      // Fall through to the canonical URL constructed from the article ID.
    }
  }
  return articleId
    ? `${REGULAR_ARTICLE_BASE_URL}/${encodeURIComponent(articleId)}`
    : "";
}

function regularStableId(
  articleId: string,
  guid: string,
  link: string,
  fallback: string,
): string {
  const identity = articleId || guid || link || fallback;
  return `regular:${articleId || encodeURIComponent(identity)}`;
}

export function normalizeCachedNewsItems(
  value: unknown,
  fallbackSource: NewsSource,
): NewsItem[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return [];

    const item = candidate as Partial<NewsItem>;
    if (
      typeof item.title !== "string" ||
      typeof item.link !== "string" ||
      typeof item.contentHtml !== "string"
    ) {
      return [];
    }

    const source: NewsSource =
      item.source === "regular" || item.source === "easy"
        ? item.source
        : fallbackSource;
    const pubDate = typeof item.pubDate === "string" ? item.pubDate : "";
    const guid = typeof item.guid === "string" ? item.guid : item.link;
    const cachedId =
      typeof item.id === "string" && item.id.startsWith(`${source}:`)
        ? item.id
        : null;
    const id =
      cachedId ??
      (source === "easy"
        ? easyStableId(guid, item.link, `${item.title}|${pubDate}|${index}`)
        : regularStableId(
            regularArticleId(item.link, guid),
            guid,
            item.link,
            `${item.title}|${pubDate}|${index}`,
          ));

    return [
      {
        id,
        source,
        title: item.title,
        link: item.link,
        pubDate,
        guid,
        imageUrl: typeof item.imageUrl === "string" ? item.imageUrl : null,
        audioUrl: typeof item.audioUrl === "string" ? item.audioUrl : null,
        contentHtml: item.contentHtml,
        isFullArticle:
          typeof item.isFullArticle === "boolean"
            ? item.isFullArticle
            : source === "easy",
      },
    ];
  });
}

export function parseEasyRss(xmlText: string): NewsItem[] {
  return rssItems(xmlText).map((rawItem, index) => {
    const item = (rawItem ?? {}) as Record<string, unknown>;
    const title = valueAsString(item.title) || "No Title";
    const link = valueAsString(item.link);
    const pubDate = valueAsString(item.pubDate);
    const guid = valueAsString(item.guid) || link;
    const description = valueAsString(item.description);
    const iTunesImage = item["itunes:image"] as
      | Record<string, unknown>
      | undefined;
    const enclosure = item.enclosure as Record<string, unknown> | undefined;
    const imageUrl = resolveEasyUrl(
      extractAttributeSource(description, "img") ||
        valueAsString(iTunesImage?.["@_href"]),
    );
    const audioUrl = resolveEasyUrl(
      extractAttributeSource(description, "audio") ||
        valueAsString(enclosure?.["@_url"]),
    );
    const contentHtml = description
      .replace(/src=(['"])\/media/g, `src=$1${EASY_BASE_URL}/media`)
      .replace(/href=(['"])\/story/g, `href=$1${EASY_BASE_URL}/story`);

    return {
      id: easyStableId(guid, link, `${title}|${pubDate}|${index}`),
      source: "easy",
      title,
      link,
      pubDate,
      guid,
      imageUrl,
      audioUrl,
      contentHtml,
      isFullArticle: true,
    };
  });
}

export function parseRegularRss(xmlText: string): NewsItem[] {
  return rssItems(xmlText).map((rawItem, index) => {
    const item = (rawItem ?? {}) as Record<string, unknown>;
    const title = valueAsString(item.title) || "No Title";
    const rssLink = valueAsString(item.link);
    const pubDate = valueAsString(item.pubDate);
    const rssGuid = valueAsString(item.guid) || rssLink;
    const description = valueAsString(item.description);
    const articleId = regularArticleId(rssLink, rssGuid);
    const link = canonicalRegularLink(rssLink, rssGuid, articleId);
    const guid = rssGuid || link;

    return {
      id: regularStableId(
        articleId,
        guid,
        link,
        `${title}|${pubDate}|${index}`,
      ),
      source: "regular",
      title,
      link,
      pubDate,
      guid,
      imageUrl: null,
      audioUrl: null,
      contentHtml: regularSummaryToHtml(description),
      isFullArticle: false,
    };
  });
}

export function isSafeNhkImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      (hostname.endsWith(".nhk") ||
        hostname === "nhk.or.jp" ||
        hostname.endsWith(".nhk.or.jp") ||
        hostname === "nhk.jp" ||
        hostname.endsWith(".nhk.jp"))
    );
  } catch {
    return false;
  }
}

function normalizeRegularCanonicalUrl(
  value: unknown,
  articleId: string,
): string | null {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      url.hostname !== "news.web.nhk" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    ) {
      return null;
    }

    const pathMatch = /^\/newsweb\/na\/([^/]+)\/?$/.exec(url.pathname);
    if (!pathMatch) return null;

    let pathArticleId: string;
    try {
      pathArticleId = decodeURIComponent(pathMatch[1]);
    } catch {
      return null;
    }
    if (pathArticleId !== articleId) return null;

    return `${REGULAR_ARTICLE_BASE_URL}/${encodeURIComponent(articleId)}`;
  } catch {
    return null;
  }
}

/**
 * Defense-in-depth validation for the server-normalized article fragment.
 * The backend remains responsible for sanitizing raw NHK markup before it is
 * written to the public table.
 */
export function isSafeRegularArticleHtml(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.length > MAX_REGULAR_CONTENT_HTML_LENGTH
  ) {
    return false;
  }

  const tagPattern = /<\s*(\/?)\s*([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let tagMatch: RegExpExecArray | null;
  let foundTag = false;

  while ((tagMatch = tagPattern.exec(value)) !== null) {
    foundTag = true;
    const isClosingTag = Boolean(tagMatch[1]);
    const tagName = tagMatch[2].toLowerCase();
    const attributes = tagMatch[3] ?? "";
    if (!SAFE_REGULAR_CONTENT_TAGS.has(tagName)) return false;

    if (isClosingTag) {
      if (attributes.trim()) return false;
      continue;
    }

    if (
      /\b(?:on[a-z]+|style|srcdoc|srcset|href|poster|action|formaction|background)\s*=/i.test(
        attributes,
      )
    ) {
      return false;
    }

    const sourceAttributes = [
      ...attributes.matchAll(/\bsrc\s*=\s*(["'])(.*?)\1/gi),
    ];
    if (tagName === "img") {
      if (
        sourceAttributes.length !== 1 ||
        !isSafeNhkImageUrl(sourceAttributes[0][2])
      ) {
        return false;
      }
    } else if (sourceAttributes.length > 0 || /\bsrc\s*=/i.test(attributes)) {
      return false;
    }
  }

  // Reject malformed or declaration-style markup that the tag scanner did not
  // recognize, as well as fragments containing no readable article text.
  const unmatchedMarkup = value.replace(tagPattern, "");
  if (unmatchedMarkup.includes("<")) return false;
  const readableText = plainTextFromPossiblyHtml(value)
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim();
  return foundTag && readableText.length > 0;
}

function normalizeNullableSafeMediaUrl(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (!normalized) return null;
  return isSafeNhkImageUrl(normalized) ? normalized : undefined;
}

function normalizeSupabaseRegularArticle(value: unknown): NewsItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;

  if (row.is_full_article !== true) return null;
  if (typeof row.id !== "string" || row.id !== row.id.trim()) return null;
  const articleId = row.id;
  if (
    !articleId ||
    articleId.length > 256 ||
    /[\s/?#\u0000-\u001f\u007f]/.test(articleId)
  ) {
    return null;
  }

  const canonicalUrl = normalizeRegularCanonicalUrl(
    row.canonical_url,
    articleId,
  );
  if (!canonicalUrl) return null;

  if (typeof row.title !== "string") return null;
  const title = row.title.trim();
  if (
    !title ||
    title.length > 1_000 ||
    /[<>\u0000-\u001f\u007f]/.test(title)
  ) {
    return null;
  }

  if (
    typeof row.published_at !== "string" ||
    !Number.isFinite(Date.parse(row.published_at))
  ) {
    return null;
  }
  const pubDate = new Date(row.published_at).toISOString();

  let guid = canonicalUrl;
  if (row.guid !== null && row.guid !== undefined && row.guid !== "") {
    const normalizedGuid = normalizeRegularCanonicalUrl(row.guid, articleId);
    if (!normalizedGuid) return null;
    guid = normalizedGuid;
  }

  const imageUrl = normalizeNullableSafeMediaUrl(row.image_url);
  const audioUrl = normalizeNullableSafeMediaUrl(row.audio_url);
  if (imageUrl === undefined || audioUrl === undefined) return null;
  if (!isSafeRegularArticleHtml(row.content_html)) return null;

  return {
    id: `regular:${articleId}`,
    source: "regular",
    title,
    link: canonicalUrl,
    pubDate,
    guid,
    imageUrl,
    audioUrl,
    contentHtml: row.content_html,
    isFullArticle: true,
  };
}

/** Maps the public Supabase contract without trusting its runtime shape. */
export function normalizeSupabaseRegularArticles(value: unknown): NewsItem[] {
  if (!Array.isArray(value) || value.length === 0) return [];

  const normalized: NewsItem[] = [];
  for (const row of value) {
    const item = normalizeSupabaseRegularArticle(row);
    // Treat one malformed public row as a provider failure so raw or partially
    // sanitized content never reaches the article WebView.
    if (!item) return [];
    normalized.push(item);
  }
  return normalized;
}

export function normalizeOEmbedThumbnail(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const thumbnail = (payload as OEmbedResponse).thumbnail_url;
  return typeof thumbnail === "string" && isSafeNhkImageUrl(thumbnail)
    ? thumbnail
    : null;
}

async function fetchResponse(
  url: string,
  init: RequestInit = {},
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) {
      throw new Error(`NHK request failed with HTTP ${response.status}`);
    }
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (values.length === 0) return [];
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  };

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), values.length) },
      () => worker(),
    ),
  );
  return results;
}

async function fetchOEmbedThumbnail(item: NewsItem): Promise<string | null> {
  if (!item.link) return null;
  const response = await fetchResponse(
    `${OEMBED_URL}?url=${encodeURIComponent(item.link)}`,
    { headers: { Accept: "application/json" } },
  );
  return normalizeOEmbedThumbnail(await response.json());
}

export async function getEasyNews(): Promise<NewsItem[]> {
  const response = await fetchResponse(EASY_FEED_URL);
  return parseEasyRss(await response.text());
}

export async function getRegularSummaryNews(): Promise<NewsItem[]> {
  const response = await fetchResponse(REGULAR_FEED_URL);
  const items = dedupeNewsItems(parseRegularRss(await response.text()));

  return mapWithConcurrency(items, OEMBED_CONCURRENCY, async (item) => {
    try {
      return { ...item, imageUrl: await fetchOEmbedThumbnail(item) };
    } catch {
      // The official RSS summary remains useful if oEmbed is unavailable.
      return item;
    }
  });
}

async function getSupabaseRegularNews(): Promise<NewsItem[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const { data, error } = await supabase
      .from(REGULAR_ARTICLES_TABLE)
      .select(REGULAR_ARTICLES_COLUMNS)
      .eq("is_full_article", true)
      .order("published_at", { ascending: false })
      .limit(REGULAR_ARTICLES_LIMIT)
      .abortSignal(controller.signal);
    if (error) {
      throw new Error("Standard NHK backend query failed");
    }

    const items = normalizeSupabaseRegularArticles(data);
    if (items.length === 0) {
      throw new Error("Standard NHK backend returned no safe full articles");
    }
    return sortNewsItems(dedupeNewsItems(items));
  } finally {
    clearTimeout(timeout);
  }
}

export async function getRegularNews(): Promise<NewsItem[]> {
  try {
    return await getSupabaseRegularNews();
  } catch {
    return getRegularSummaryNews();
  }
}

export function sourcesForPreference(
  preference: NewsSourcePreference,
): NewsSource[] {
  return preference === "both" ? ["easy", "regular"] : [preference];
}

function newsDateValue(item: NewsItem): number {
  const parsed = Date.parse(item.pubDate);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function sortNewsItems(items: readonly NewsItem[]): NewsItem[] {
  return [...items].sort((left, right) => {
    const dateDifference = newsDateValue(right) - newsDateValue(left);
    return dateDifference || left.id.localeCompare(right.id);
  });
}

export function dedupeNewsItems(items: readonly NewsItem[]): NewsItem[] {
  const byId = new Map<string, NewsItem>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing || (!existing.isFullArticle && item.isFullArticle)) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()];
}

function normalizeLookupId(id: string, source?: NewsSource): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(id);
    } catch {
      return id;
    }
  })();
  return source && !decoded.startsWith(`${source}:`)
    ? `${source}:${decoded}`
    : decoded;
}

export const NhkNewsService = {
  async getNews(preference: NewsSourcePreference = "easy"): Promise<NewsItem[]> {
    const requestGeneration = ++cacheGeneration;
    const sources = sourcesForPreference(preference);
    const settled = await Promise.allSettled(
      sources.map((source) =>
        source === "easy" ? getEasyNews() : getRegularNews(),
      ),
    );
    const items = settled.flatMap((result) =>
      result.status === "fulfilled" ? result.value : [],
    );
    const normalized = sortNewsItems(dedupeNewsItems(items));
    if (requestGeneration === cacheGeneration) {
      cachedItems = normalized;
    }
    return normalized;
  },

  setCachedItems(items: readonly NewsItem[]): void {
    cacheGeneration += 1;
    cachedItems = sortNewsItems(dedupeNewsItems(items));
  },

  getItemById(id: string, source?: NewsSource): NewsItem | undefined {
    const normalizedId = normalizeLookupId(id, source);
    const exact = cachedItems.find((item) => item.id === normalizedId);
    if (exact) return exact;

    if (!source && !normalizedId.includes(":")) {
      return cachedItems.find((item) => item.id.endsWith(`:${normalizedId}`));
    }
    return undefined;
  },
};
