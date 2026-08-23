export const NHK_FEED_URL = "https://news.web.nhk/n-data/conf/na/rss/cat0.xml";
export const NHK_ARTICLE_BASE_URL = "https://news.web.nhk/newsweb/na";
export const NHK_API_BASE_URL = "https://api.web.nhk/r8/t/newsarticle/na";

const MAX_FEED_BYTES = 1_000_000;
const MAX_ARTICLE_MARKUP_BYTES = 1_000_000;
const MAX_ARTICLE_ID_LENGTH = 128;
const MIN_FULL_ARTICLE_TEXT_LENGTH = 120;
const MIN_LEAD_ONLY_ARTICLE_TEXT_LENGTH = 20;

export interface NhkFeedItem {
  id: string;
  title: string;
  canonicalUrl: string;
  guid: string;
  publishedAt: string;
  description: string;
}

export interface NhkArticleRow {
  id: string;
  title: string;
  canonical_url: string;
  guid: string;
  published_at: string;
  source_updated_at: string | null;
  image_url: string | null;
  audio_url: string | null;
  content_html: string;
  is_full_article: boolean;
  content_hash?: string | null;
  scraped_at: string;
  last_seen_at: string;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeXml(value: string): string {
  const withoutCdata = value
    .replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/i, "$1")
    .trim();

  return withoutCdata.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (entity, body: string) => {
      const normalized = body.toLowerCase();
      if (normalized === "amp") return "&";
      if (normalized === "lt") return "<";
      if (normalized === "gt") return ">";
      if (normalized === "quot") return '"';
      if (normalized === "apos") return "'";

      const numeric = normalized.startsWith("#x")
        ? Number.parseInt(normalized.slice(2), 16)
        : Number.parseInt(normalized.slice(1), 10);
      if (!Number.isFinite(numeric) || numeric < 0 || numeric > 0x10ffff) {
        return entity;
      }
      try {
        return String.fromCodePoint(numeric);
      } catch {
        return entity;
      }
    },
  );
}

function xmlTag(block: string, tagName: string): string {
  const escapedName = tagName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(
    `<(?:[A-Za-z0-9_-]+:)?${escapedName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_-]+:)?${escapedName}>`,
    "i",
  ).exec(block);
  return match ? decodeXml(match[1]) : "";
}

export function isValidArticleId(value: string): boolean {
  return (
    value.length >= 3 &&
    value.length <= MAX_ARTICLE_ID_LENGTH &&
    /^[A-Za-z0-9][A-Za-z0-9{}_-]+$/.test(value)
  );
}

export function articleIdFromCanonicalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "news.web.nhk") {
      return null;
    }
    const match = /^\/newsweb\/na\/([^/?#]+)\/?$/.exec(url.pathname);
    if (!match) return null;
    const id = decodeURIComponent(match[1]);
    return isValidArticleId(id) ? id : null;
  } catch {
    return null;
  }
}

export function canonicalArticleUrl(id: string): string {
  if (!isValidArticleId(id)) {
    throw new Error("Invalid NHK article ID");
  }
  return `${NHK_ARTICLE_BASE_URL}/${encodeURIComponent(id)}`;
}

export function parseNhkRss(xml: string): NhkFeedItem[] {
  if (new TextEncoder().encode(xml).byteLength > MAX_FEED_BYTES) {
    throw new Error("NHK RSS response exceeded the size limit");
  }

  const itemBlocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  const byId = new Map<string, NhkFeedItem>();

  for (const itemBlock of itemBlocks.slice(0, 30)) {
    const title = xmlTag(itemBlock, "title");
    const link = xmlTag(itemBlock, "link");
    const guid = xmlTag(itemBlock, "guid") || link;
    const publishedAt = xmlTag(itemBlock, "pubDate");
    const description = xmlTag(itemBlock, "description");
    const id = articleIdFromCanonicalUrl(link) ??
      articleIdFromCanonicalUrl(guid);
    if (!id || !title || !publishedAt) continue;

    const canonicalUrl = canonicalArticleUrl(id);
    byId.set(id, {
      id,
      title,
      canonicalUrl,
      guid: guid || canonicalUrl,
      publishedAt,
      description,
    });
  }

  return [...byId.values()];
}

export function isSafeNhkImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) {
      return false;
    }
    const hostname = url.hostname.toLowerCase();
    return (
      hostname === "img.web.nhk" ||
      hostname === "imgu.web.nhk" ||
      hostname === "img.embed.nhk" ||
      hostname.endsWith(".img.web.nhk") ||
      hostname.endsWith(".imgu.web.nhk") ||
      hostname === "nhk.or.jp" ||
      hostname.endsWith(".nhk.or.jp")
    );
  } catch {
    return false;
  }
}

function stripMarkdownAttributes(value: string): string {
  return value.replace(/\s*\{[^{}\r\n]*\}\s*$/g, "").trim();
}

function plainInlineMarkdown(value: string): string {
  return stripMarkdownAttributes(value)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([\s\S]*?)\*\*/g, "$1")
    .replace(/__([\s\S]*?)__/g, "$1")
    .replace(/==([\s\S]*?)==/g, "$1")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\\([\\`*_{}\[\]()#+.!-])/g, "$1")
    .trim();
}

interface MarkdownHtmlResult {
  html: string;
  imageUrls: string[];
  textLength: number;
}

function isDiscardedDirective(name: string): boolean {
  const normalized = name.toLowerCase();
  return (
    normalized.startsWith("nw--link-") ||
    normalized.startsWith("nw--video") ||
    normalized.startsWith("nw--audio") ||
    normalized.startsWith("nw--embed")
  );
}

export function nhkMarkdownToSafeHtml(markdown: string): MarkdownHtmlResult {
  if (
    new TextEncoder().encode(markdown).byteLength > MAX_ARTICLE_MARKUP_BYTES
  ) {
    throw new Error("NHK article markup exceeded the size limit");
  }

  const output: string[] = [];
  const imageUrls: string[] = [];
  const seenImages = new Set<string>();
  const paragraphLines: string[] = [];
  const directiveStack: boolean[] = [];
  let inFence = false;
  let textLength = 0;

  const isDiscarding = () => directiveStack.some(Boolean);
  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const text = plainInlineMarkdown(paragraphLines.join("\n"))
      .replace(/\\\s*\n/g, "\n")
      .replace(/[\t ]*\n[\t ]*/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    paragraphLines.length = 0;
    if (!text || /^NEW$/i.test(text)) return;
    textLength += text.replace(/\s/g, "").length;
    output.push(`<p>${escapeHtml(text).replace(/\n/g, "<br />")}</p>`);
  };

  for (const rawLine of markdown.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.replace(/\0/g, "");
    const trimmed = line.trim();

    if (/^```/.test(trimmed)) {
      flushParagraph();
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (trimmed === ":::") {
      flushParagraph();
      directiveStack.pop();
      continue;
    }
    const directiveMatch = /^:::([^\s{]+)/.exec(trimmed);
    if (directiveMatch) {
      flushParagraph();
      directiveStack.push(
        isDiscarding() || isDiscardedDirective(directiveMatch[1]),
      );
      continue;
    }
    if (isDiscarding()) continue;

    if (!trimmed || /^==NEW==(?:\{[^}]*\})?$/i.test(trimmed)) {
      flushParagraph();
      continue;
    }

    const imageMatch =
      /^!\[([^\]]*)\]\((https:\/\/[^\s)]+)(?:\s+["']([^"']*)["'])?\)\s*(?:\{[^}]*\})?$/
        .exec(
          trimmed,
        );
    if (imageMatch) {
      flushParagraph();
      const imageUrl = imageMatch[2];
      if (isSafeNhkImageUrl(imageUrl) && !seenImages.has(imageUrl)) {
        seenImages.add(imageUrl);
        imageUrls.push(imageUrl);
        const alt = plainInlineMarkdown(imageMatch[3] || imageMatch[1]);
        output.push(
          `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(alt)}" />`,
        );
      }
      continue;
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      flushParagraph();
      const heading = plainInlineMarkdown(headingMatch[2]);
      if (heading) {
        const tag = headingMatch[1].length <= 2 ? "h2" : "h3";
        textLength += heading.replace(/\s/g, "").length;
        output.push(`<${tag}>${escapeHtml(heading)}</${tag}>`);
      }
      continue;
    }

    const listMatch = /^[-*+]\s+(.+)$/.exec(trimmed);
    paragraphLines.push(listMatch ? `・${listMatch[1]}` : line);
  }

  flushParagraph();
  return { html: output.join("\n"), imageUrls, textLength };
}

function imageUrlFromDetail(detail: UnknownRecord): string | null {
  const image = isRecord(detail.image) ? detail.image : null;
  for (const size of ["medium", "icon"]) {
    const candidate = image && isRecord(image[size])
      ? asString(image[size].url)
      : "";
    if (candidate && isSafeNhkImageUrl(candidate)) return candidate;
  }
  return null;
}

function normalizeDate(value: unknown, fallback: string): string {
  const raw = asString(value) || fallback;
  const milliseconds = Date.parse(raw);
  if (!Number.isFinite(milliseconds)) {
    throw new Error("NHK article contained an invalid date");
  }
  return new Date(milliseconds).toISOString();
}

export function summaryRow(
  feedItem: NhkFeedItem,
  now = new Date().toISOString(),
): NhkArticleRow {
  const summary = feedItem.description
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    id: feedItem.id,
    title: feedItem.title,
    canonical_url: feedItem.canonicalUrl,
    guid: feedItem.guid || feedItem.canonicalUrl,
    published_at: normalizeDate(feedItem.publishedAt, now),
    source_updated_at: null,
    image_url: null,
    audio_url: null,
    content_html: summary ? `<p>${escapeHtml(summary)}</p>` : "",
    is_full_article: false,
    scraped_at: now,
    last_seen_at: now,
  };
}

export function normalizeFullArticle(
  detailValue: unknown,
  feedItem: NhkFeedItem,
  now = new Date().toISOString(),
): NhkArticleRow {
  if (!isRecord(detailValue)) {
    throw new Error("NHK article response was not an object");
  }
  const detail = detailValue;
  const returnedId = asString(detail.id);
  const canonical = asString(detail.canonical);
  if (
    returnedId !== feedItem.id ||
    articleIdFromCanonicalUrl(canonical) !== feedItem.id
  ) {
    throw new Error("NHK article identity did not match the feed");
  }

  const detailedBody = isRecord(detail.detailedArticleBody)
    ? detail.detailedArticleBody
    : null;
  if (!detailedBody) {
    throw new Error("NHK article did not include a full body");
  }

  const markedLead = asString(detailedBody.noHtmlMarkedLead) ||
    asString(detailedBody.markedLead);
  const markedBody = asString(detailedBody.noHtmlMarkedBody) ||
    asString(detailedBody.markedBody);
  const plainArticleBody = asString(detail.articleBody);
  let articleMarkup: string;
  let minimumTextLength = MIN_FULL_ARTICLE_TEXT_LENGTH;

  if (markedBody) {
    articleMarkup = `${markedLead}\n\n${markedBody}`;
  } else if (plainArticleBody) {
    const comparableLead = plainInlineMarkdown(markedLead)
      .replace(/\s+/g, " ")
      .trim();
    const comparableArticleBody = plainInlineMarkdown(plainArticleBody)
      .replace(/\s+/g, " ")
      .trim();
    if (!comparableArticleBody) {
      throw new Error("NHK article body was empty");
    }

    if (!comparableLead || comparableLead !== comparableArticleBody) {
      // `articleBody` alone is not enough evidence that a restricted or
      // developing response contains the complete story. Current legitimate
      // short-form stories duplicate the same complete text in both fields.
      throw new Error("NHK lead-only article body did not match its lead");
    }

    articleMarkup = markedLead;
    minimumTextLength = MIN_LEAD_ONLY_ARTICLE_TEXT_LENGTH;
  } else {
    throw new Error("NHK article body was empty");
  }

  const converted = nhkMarkdownToSafeHtml(articleMarkup);
  if (converted.textLength < minimumTextLength) {
    throw new Error("NHK article body was implausibly short");
  }

  const leadImage = imageUrlFromDetail(detail);
  const bodyAlreadyContainsLead = leadImage !== null &&
    converted.imageUrls.includes(leadImage);
  const contentHtml = [
    leadImage && !bodyAlreadyContainsLead
      ? `<img src="${escapeHtml(leadImage)}" alt="" />`
      : "",
    converted.html,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    id: feedItem.id,
    title: asString(detail.headline) || asString(detail.name) || feedItem.title,
    canonical_url: canonicalArticleUrl(feedItem.id),
    guid: feedItem.guid || canonicalArticleUrl(feedItem.id),
    published_at: normalizeDate(detail.datePublished, feedItem.publishedAt),
    source_updated_at: asString(detail.dateModified)
      ? normalizeDate(detail.dateModified, feedItem.publishedAt)
      : null,
    image_url: leadImage,
    audio_url: null,
    content_html: contentHtml,
    is_full_article: true,
    scraped_at: now,
    last_seen_at: now,
  };
}
