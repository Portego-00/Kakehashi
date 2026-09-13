import "server-only";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { extractReadableTextFromHtml } from "./parsers";
import { normalizeNewsAudioUrl } from "./news-audio";
import { normalizeNewsImageUrl } from "./news-images";
import { readBoundedJson, readBoundedText } from "./server-security";
import type { FuriganaRange, NewsArticle, NewsSource, NewsSourcePreference } from "./types";

const EASY_FEED_URL = "https://nhkeasier.com/feed/";
const REGULAR_FEED_URL = "https://news.web.nhk/n-data/conf/na/rss/cat0.xml";
const REGULAR_OEMBED_URL = "https://www.web.nhk/oembed";
const REGULAR_ARTICLE_BASE_URL = "https://news.web.nhk/newsweb/na";
const REGULAR_ARTICLES_COLUMNS = "id,title,canonical_url,guid,published_at,image_url,content_html,is_full_article";
const REGULAR_ARTICLES_LIMIT = 20;
const REQUEST_TIMEOUT_MS = 12_000;
const OEMBED_CONCURRENCY = 4;
const MAX_REGULAR_CONTENT_HTML_LENGTH = 500_000;

const SAFE_REGULAR_CONTENT_TAGS = new Set([
  "p", "br", "h1", "h2", "h3", "h4", "strong", "em", "b", "i", "ruby", "rb", "rt", "rp", "span",
  "img", "figure", "figcaption", "ul", "ol", "li", "blockquote",
]);

interface SourceSnapshot {
  articles: NewsArticle[];
  updatedAt: string;
}

interface SourceResult extends SourceSnapshot {
  cached: boolean;
  unavailable: boolean;
}

const lastSuccessfulBySource = new Map<NewsSource, SourceSnapshot>();
const requestGeneration: Record<NewsSource, number> = { easy: 0, regular: 0 };

function developmentEnv() {
  if (process.env.NODE_ENV === "production") return {} as Record<string, string>;
  try {
    return Object.fromEntries(
      readFileSync(resolve(process.cwd(), "../.env"), "utf8")
        .split(/\r?\n/)
        .filter((line) => line && !line.trimStart().startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
        }),
    );
  } catch { return {} as Record<string, string>; }
}

const localEnv = developmentEnv();

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|#39);/gi, (entity, body: string) => {
      const normalized = body.toLocaleLowerCase();
      if (normalized === "amp") return "&";
      if (normalized === "lt") return "<";
      if (normalized === "gt") return ">";
      if (normalized === "quot") return "\"";
      if (normalized === "apos" || normalized === "#39") return "'";
      const codePoint = normalized.startsWith("#x")
        ? Number.parseInt(normalized.slice(2), 16)
        : Number.parseInt(normalized.slice(1), 10);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity;
      try { return String.fromCodePoint(codePoint); }
      catch { return entity; }
    });
}

function tag(item: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return decodeXml(item.match(new RegExp(`<(?:[A-Za-z0-9_-]+:)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${escaped}>`, "i"))?.[1]?.trim() ?? "");
}

function attribute(item: string, tagName: string, name: string) {
  return decodeXml(item.match(new RegExp(`<${tagName}\\b[^>]*\\b${name}=["']([^"']+)["'][^>]*>`, "i"))?.[1] ?? "");
}

function htmlAttribute(tagMarkup: string, name: string) {
  return decodeXml(tagMarkup.match(new RegExp(`\\b${name}\\s*=\\s*(?:["']([^"']*)["']|([^\\s>]+))`, "i"))?.slice(1).find(Boolean) ?? "");
}

function inlineText(markup: string) {
  return extractReadableTextFromHtml(
    markup.replace(/<\/?(?:ruby|rb|rt|rp|span|a|strong|em|b|i)\b[^>]*>/gi, ""),
  );
}

function readableParagraph(markup: string): { text: string; furigana: FuriganaRange[] } {
  const readings: string[] = [];
  const markedUp = markup.replace(/<ruby\b[^>]*>([\s\S]*?)<\/ruby>/gi, (_ruby, contents: string) => {
    const reading = [...contents.matchAll(/<rt\b[^>]*>([\s\S]*?)<\/rt>/gi)]
      .map((match) => inlineText(match[1]))
      .join("");
    const base = inlineText(
      contents
        .replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, "")
        .replace(/<rp\b[^>]*>[\s\S]*?<\/rp>/gi, ""),
    );
    if (!base || !reading) return base;
    const index = readings.push(reading) - 1;
    return `\uE000${index.toString(36)}\uE001${base}\uE002`;
  });
  const markedText = extractReadableTextFromHtml(
    markedUp
      .replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, "")
      .replace(/<rp\b[^>]*>[\s\S]*?<\/rp>/gi, "")
      .replace(/<\/?(?:ruby|rb|span|a|strong|em|b|i)\b[^>]*>/gi, ""),
  );
  const furigana: FuriganaRange[] = [];
  let text = "";
  let cursor = 0;
  for (const match of markedText.matchAll(/\uE000([0-9a-z]+)\uE001([\s\S]*?)\uE002/g)) {
    const markerStart = match.index ?? 0;
    text += markedText.slice(cursor, markerStart);
    const base = match[2];
    const start = text.length;
    text += base;
    const reading = readings[Number.parseInt(match[1], 36)];
    if (base && reading) furigana.push({ start, end: start + base.length, reading });
    cursor = markerStart + match[0].length;
  }
  text += markedText.slice(cursor);
  return { text, furigana };
}

export function parseNewsContent(description: string, articleUrl: string): NonNullable<NewsArticle["content"]> {
  const blocks: NonNullable<NewsArticle["content"]> = [];
  const withoutMedia = description.replace(/<audio\b[^>]*>[\s\S]*?<\/audio>/gi, "");
  for (const match of withoutMedia.matchAll(/<img\b[^>]*>|<(?:p|h[1-4]|li|blockquote|figcaption)\b[^>]*>[\s\S]*?<\/(?:p|h[1-4]|li|blockquote|figcaption)\s*>/gi)) {
    const markup = match[0];
    if (/^<img\b/i.test(markup)) {
      const url = normalizeNewsImageUrl(htmlAttribute(markup, "src"), articleUrl);
      if (url) blocks.push({ type: "image", url, alt: htmlAttribute(markup, "alt") || "Story illustration" });
      continue;
    }
    const { text, furigana } = readableParagraph(markup);
    if (text) blocks.push({ type: "text", text, ...(furigana.length ? { furigana } : {}) });
  }
  return blocks;
}

function publishedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

function articleBody(content: NonNullable<NewsArticle["content"]>, fallback = "") {
  return content.flatMap((block) => block.type === "text" ? [block.text] : []).join("\n\n") || fallback;
}

function easyStableId(guid: string, url: string, fallback: string) {
  const identity = guid || url || fallback;
  const storyId = identity.match(/(?:story\/|ne)([^/?#]+)/i)?.[1] ?? encodeURIComponent(identity);
  return `easy:${storyId}`;
}

/** Existing NHK Easier RSS parser, normalized to the shared news contract. */
export function parseNewsRss(xml: string): NewsArticle[] {
  return [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].flatMap((match, index) => {
    const item = match[1];
    const title = tag(item, "title");
    const url = tag(item, "link");
    const description = tag(item, "description");
    if (!title || !url) return [];
    const guid = tag(item, "guid") || url;
    const content = parseNewsContent(description, url);
    const body = articleBody(content);
    const firstImage = content.find((block) => block.type === "image");
    const imageUrl = firstImage?.type === "image" ? firstImage.url : normalizeNewsImageUrl(attribute(item, "itunes:image", "href"), url);
    const audioMarkup = description.match(/<audio\b[^>]*>/i)?.[0] ?? "";
    const audioUrl = normalizeNewsAudioUrl(htmlAttribute(audioMarkup, "src"), url)
      ?? normalizeNewsAudioUrl(attribute(item, "enclosure", "url"), url);
    return [{
      id: easyStableId(guid, url, `${title}|${tag(item, "pubDate")}|${index}`),
      source: "easy",
      title: extractReadableTextFromHtml(title),
      publishedAt: publishedAt(tag(item, "pubDate")),
      url,
      isFullArticle: true,
      imageUrl,
      ...(audioUrl ? { audioUrl } : {}),
      summary: body.slice(0, 150),
      body,
      content,
    } satisfies NewsArticle];
  });
}

function validRegularArticleId(value: string) {
  return value.length >= 3 && value.length <= 128 && /^[A-Za-z0-9][A-Za-z0-9{}_-]+$/.test(value);
}

function regularArticleId(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "news.web.nhk" || url.username || url.password || url.port) return null;
    const match = /^\/newsweb\/na\/([^/?#]+)\/?$/.exec(url.pathname);
    if (!match) return null;
    const id = decodeURIComponent(match[1]);
    return validRegularArticleId(id) ? id : null;
  } catch { return null; }
}

function regularCanonicalUrl(articleId: string) {
  return `${REGULAR_ARTICLE_BASE_URL}/${encodeURIComponent(articleId)}`;
}

function regularSummary(description: string) {
  return extractReadableTextFromHtml(description).replace(/\s+/g, " ").trim();
}

export function parseRegularNewsRss(xml: string): NewsArticle[] {
  const byId = new Map<string, NewsArticle>();
  for (const [index, match] of [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)].slice(0, 30).entries()) {
    const item = match[1];
    const title = extractReadableTextFromHtml(tag(item, "title"));
    const rawUrl = tag(item, "link");
    const guid = tag(item, "guid") || rawUrl;
    const articleId = regularArticleId(rawUrl) ?? regularArticleId(guid);
    if (!articleId || !title) continue;
    const url = regularCanonicalUrl(articleId);
    const body = regularSummary(tag(item, "description"));
    const content: NonNullable<NewsArticle["content"]> = body ? [{ type: "text", text: body }] : [];
    byId.set(articleId, {
      id: `regular:${articleId}`,
      source: "regular",
      title,
      publishedAt: publishedAt(tag(item, "pubDate") || String(index)),
      url,
      isFullArticle: false,
      summary: body.slice(0, 150),
      body,
      content,
    });
  }
  return [...byId.values()];
}

function isSafeRegularImageUrl(value: string) {
  const normalized = normalizeNewsImageUrl(value);
  if (!normalized) return false;
  const hostname = new URL(normalized).hostname.toLocaleLowerCase();
  return hostname === "img.web.nhk"
    || hostname === "imgu.web.nhk"
    || hostname === "img.embed.nhk"
    || hostname.endsWith(".img.web.nhk")
    || hostname.endsWith(".imgu.web.nhk")
    || hostname === "nhk.or.jp"
    || hostname.endsWith(".nhk.or.jp");
}

/** Defense in depth for fragments sanitized by the scheduled NHK importer. */
export function isSafeRegularArticleHtml(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim() || value.length > MAX_REGULAR_CONTENT_HTML_LENGTH) return false;
  const tagPattern = /<\s*(\/?)\s*([a-z][a-z0-9]*)\b([^>]*)>/gi;
  let tagMatch: RegExpExecArray | null;
  let foundTag = false;
  while ((tagMatch = tagPattern.exec(value)) !== null) {
    foundTag = true;
    const isClosingTag = Boolean(tagMatch[1]);
    const tagName = tagMatch[2].toLocaleLowerCase();
    const attributes = tagMatch[3] ?? "";
    if (!SAFE_REGULAR_CONTENT_TAGS.has(tagName)) return false;
    if (isClosingTag) {
      if (attributes.trim()) return false;
      continue;
    }
    if (/\b(?:on[a-z]+|style|srcdoc|srcset|href|poster|action|formaction|background)\s*=/i.test(attributes)) return false;
    const sources = [...attributes.matchAll(/\bsrc\s*=\s*(["'])(.*?)\1/gi)];
    if (tagName === "img") {
      if (sources.length !== 1 || !isSafeRegularImageUrl(sources[0][2])) return false;
    } else if (sources.length > 0 || /\bsrc\s*=/i.test(attributes)) return false;
  }
  const unmatchedMarkup = value.replace(tagPattern, "");
  if (unmatchedMarkup.includes("<")) return false;
  return foundTag && Boolean(extractReadableTextFromHtml(value).replace(/&nbsp;|&#160;/gi, " ").trim());
}

function normalizeRegularCanonicalUrl(value: unknown, articleId: string) {
  if (typeof value !== "string") return null;
  return regularArticleId(value.trim()) === articleId ? regularCanonicalUrl(articleId) : null;
}

function normalizeStoredRegularArticle(value: unknown): NewsArticle | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.is_full_article !== true || typeof row.id !== "string" || row.id !== row.id.trim() || !validRegularArticleId(row.id)) return null;
  const articleId = row.id;
  const url = normalizeRegularCanonicalUrl(row.canonical_url, articleId);
  if (!url) return null;
  if (row.guid !== null && row.guid !== undefined && row.guid !== "" && !normalizeRegularCanonicalUrl(row.guid, articleId)) return null;
  if (typeof row.title !== "string") return null;
  const title = row.title.trim();
  if (!title || title.length > 1_000 || /[<>\u0000-\u001f\u007f]/.test(title)) return null;
  if (typeof row.published_at !== "string" || !Number.isFinite(Date.parse(row.published_at))) return null;
  if (!isSafeRegularArticleHtml(row.content_html)) return null;
  const rawImageUrl = row.image_url;
  if (rawImageUrl !== null && rawImageUrl !== undefined && (typeof rawImageUrl !== "string" || !isSafeRegularImageUrl(rawImageUrl))) return null;
  const content = parseNewsContent(row.content_html, url);
  const fallbackBody = extractReadableTextFromHtml(row.content_html);
  const body = articleBody(content, fallbackBody);
  const imageUrl = typeof rawImageUrl === "string" ? normalizeNewsImageUrl(rawImageUrl) : undefined;
  return {
    id: `regular:${articleId}`,
    source: "regular",
    title,
    publishedAt: new Date(row.published_at).toISOString(),
    url,
    isFullArticle: true,
    imageUrl,
    summary: body.slice(0, 150),
    body,
    content,
  };
}

/** Maps the public Supabase contract without trusting its runtime shape. */
export function normalizeStoredRegularArticles(value: unknown): NewsArticle[] {
  if (!Array.isArray(value) || value.length === 0) return [];
  const articles: NewsArticle[] = [];
  for (const row of value) {
    const article = normalizeStoredRegularArticle(row);
    if (!article) return [];
    articles.push(article);
  }
  return articles;
}

export function normalizeOEmbedThumbnail(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const thumbnail = (value as Record<string, unknown>).thumbnail_url;
  return typeof thumbnail === "string" && isSafeRegularImageUrl(thumbnail) ? normalizeNewsImageUrl(thumbnail) : undefined;
}

async function fetchEasyNews() {
  const response = await fetch(EASY_FEED_URL, {
    headers: { Accept: "application/rss+xml, application/xml", "User-Agent": "KakehashiWeb/1.0" },
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Easy feed returned ${response.status}`);
  const articles = parseNewsRss(await readBoundedText(response, 3_000_000));
  if (!articles.length) throw new Error("Easy feed contained no articles");
  return articles;
}

function supabaseCredentials() {
  return {
    url: (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || localEnv.SUPABASE_URL || localEnv.NEXT_PUBLIC_SUPABASE_URL || localEnv.EXPO_PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, ""),
    key: (process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || localEnv.SUPABASE_ANON_KEY || localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || localEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY || "").trim(),
  };
}

async function fetchStoredRegularNews() {
  const { url, key } = supabaseCredentials();
  if (!url || !key) throw new Error("The Standard NHK article cache is not configured");
  const endpoint = new URL(`${url}/rest/v1/nhk_regular_articles`);
  endpoint.searchParams.set("select", REGULAR_ARTICLES_COLUMNS);
  endpoint.searchParams.set("is_full_article", "eq.true");
  endpoint.searchParams.set("order", "published_at.desc");
  endpoint.searchParams.set("limit", String(REGULAR_ARTICLES_LIMIT));
  const response = await fetch(endpoint, {
    headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Standard article cache returned ${response.status}`);
  const articles = normalizeStoredRegularArticles(await readBoundedJson(response, 12_000_000));
  if (!articles.length) throw new Error("Standard article cache returned no safe full articles");
  return articles;
}

async function mapWithConcurrency<T, R>(values: readonly T[], concurrency: number, mapper: (value: T) => Promise<R>) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), values.length) }, () => worker()));
  return results;
}

async function fetchOEmbedThumbnail(article: NewsArticle) {
  const endpoint = new URL(REGULAR_OEMBED_URL);
  endpoint.searchParams.set("url", article.url);
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json", "User-Agent": "KakehashiWeb/1.0" },
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`NHK oEmbed returned ${response.status}`);
  return normalizeOEmbedThumbnail(await readBoundedJson(response, 256_000));
}

async function fetchRegularSummaryNews() {
  const response = await fetch(REGULAR_FEED_URL, {
    headers: { Accept: "application/rss+xml, application/xml", "User-Agent": "KakehashiWeb/1.0" },
    next: { revalidate: 900 },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Standard feed returned ${response.status}`);
  const articles = parseRegularNewsRss(await readBoundedText(response, 1_000_000));
  if (!articles.length) throw new Error("Standard feed contained no articles");
  return mapWithConcurrency(articles, OEMBED_CONCURRENCY, async (article) => {
    try { return { ...article, imageUrl: await fetchOEmbedThumbnail(article) }; }
    catch { return article; }
  });
}

async function fetchRegularNews() {
  try { return await fetchStoredRegularNews(); }
  catch { return fetchRegularSummaryNews(); }
}

function sortAndDedupe(articles: readonly NewsArticle[]) {
  const byId = new Map<string, NewsArticle>();
  for (const article of articles) {
    const current = byId.get(article.id);
    if (!current || (!current.isFullArticle && article.isFullArticle)) byId.set(article.id, article);
  }
  return [...byId.values()].sort((left, right) => {
    const dateDifference = (Date.parse(right.publishedAt) || 0) - (Date.parse(left.publishedAt) || 0);
    return dateDifference || left.id.localeCompare(right.id);
  });
}

function preserveCachedFullArticles(freshArticles: readonly NewsArticle[], cachedArticles: readonly NewsArticle[]) {
  const cachedFullById = new Map(cachedArticles.filter((article) => article.isFullArticle).map((article) => [article.id, article]));
  return freshArticles.map((fresh) => {
    if (fresh.isFullArticle) return fresh;
    const cached = cachedFullById.get(fresh.id);
    if (!cached) return fresh;
    return {
      ...cached,
      ...fresh,
      imageUrl: fresh.imageUrl ?? cached.imageUrl,
      summary: cached.summary,
      body: cached.body,
      content: cached.content,
      isFullArticle: true,
    } satisfies NewsArticle;
  });
}

async function loadSource(source: NewsSource): Promise<SourceResult> {
  const generation = ++requestGeneration[source];
  try {
    const fetched = await (source === "easy" ? fetchEasyNews() : fetchRegularNews());
    const previous = lastSuccessfulBySource.get(source)?.articles ?? [];
    const articles = sortAndDedupe(source === "regular" ? preserveCachedFullArticles(fetched, previous) : fetched);
    if (!articles.length) throw new Error("News source returned no articles");
    const snapshot = { articles, updatedAt: new Date().toISOString() };
    if (generation === requestGeneration[source]) lastSuccessfulBySource.set(source, snapshot);
    return { ...snapshot, cached: false, unavailable: false };
  } catch (error) {
    const cached = lastSuccessfulBySource.get(source);
    if (cached) return { ...cached, cached: true, unavailable: true };
    throw error;
  }
}

function sourcesForPreference(preference: NewsSourcePreference): NewsSource[] {
  return preference === "both" ? ["easy", "regular"] : [preference];
}

export async function getNewsFeed(preference: NewsSourcePreference = "easy") {
  if (preference !== "easy" && preference !== "regular" && preference !== "both") throw new Error("Unsupported news source.");
  const sources = sourcesForPreference(preference);
  const settled = await Promise.allSettled(sources.map(loadSource));
  const results = settled.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
  const articles = sortAndDedupe(results.flatMap((result) => result.articles));
  if (!articles.length) {
    throw new Error(preference === "easy" ? "The easy-news feed is temporarily unavailable." : "NHK News is temporarily unavailable.");
  }
  const unavailableSources = sources.filter((source, index) => settled[index].status === "rejected" || results.some((result) => result.unavailable && result.articles.some((article) => article.source === source)));
  const updatedAt = results.map((result) => result.updatedAt).sort().at(-1) ?? new Date().toISOString();
  return {
    articles,
    updatedAt,
    source: results.some((result) => result.cached) ? "server-cache" as const : "live" as const,
    ...(unavailableSources.length ? { unavailableSources } : {}),
  };
}

export function clearNewsFeedCacheForTests() {
  lastSuccessfulBySource.clear();
  requestGeneration.easy = 0;
  requestGeneration.regular = 0;
}
