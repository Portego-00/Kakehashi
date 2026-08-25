import "server-only";
import { extractReadableTextFromHtml } from "./parsers";
import { normalizeNewsImageUrl } from "./news-images";
import { readBoundedText } from "./server-security";
import type { NewsArticle } from "./types";

const FEED_URL = "https://nhkeasier.com/feed/";
let lastSuccessfulFeed: { articles: NewsArticle[]; updatedAt: string } | null = null;

function decodeXml(value: string) {
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'").replace(/&amp;/gi, "&");
}

function tag(item: string, name: string) {
  return decodeXml(item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"))?.[1]?.trim() ?? "");
}

function attribute(item: string, tagName: string, name: string) {
  return decodeXml(item.match(new RegExp(`<${tagName}\\b[^>]*\\b${name}=["']([^"']+)["'][^>]*>`, "i"))?.[1] ?? "");
}

function htmlAttribute(tagMarkup: string, name: string) {
  return decodeXml(tagMarkup.match(new RegExp(`\\b${name}\\s*=\\s*(?:["']([^"']*)["']|([^\\s>]+))`, "i"))?.slice(1).find(Boolean) ?? "");
}

function readableParagraph(markup: string) {
  return extractReadableTextFromHtml(
    markup
      .replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi, "")
      .replace(/<rp\b[^>]*>[\s\S]*?<\/rp>/gi, "")
      .replace(/<\/?(?:ruby|span|a|strong|em|b|i)\b[^>]*>/gi, ""),
  );
}

export function parseNewsContent(description: string, articleUrl: string): NonNullable<NewsArticle["content"]> {
  const blocks: NonNullable<NewsArticle["content"]> = [];
  const withoutMedia = description.replace(/<audio\b[^>]*>[\s\S]*?<\/audio>/gi, "").replace(/<ul\b[^>]*>[\s\S]*?<\/ul>/gi, "");
  for (const match of withoutMedia.matchAll(/<img\b[^>]*>|<p\b[^>]*>[\s\S]*?<\/p>/gi)) {
    const markup = match[0];
    if (/^<img\b/i.test(markup)) {
      const url = normalizeNewsImageUrl(htmlAttribute(markup, "src"), articleUrl);
      if (url) blocks.push({ type: "image", url, alt: htmlAttribute(markup, "alt") || "Story illustration" });
      continue;
    }
    const text = readableParagraph(markup);
    if (text) blocks.push({ type: "text", text });
  }
  return blocks;
}

function publishedAt(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
}

export function parseNewsRss(xml: string): NewsArticle[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].flatMap((match, index) => {
    const item = match[1];
    const title = tag(item, "title");
    const url = tag(item, "link");
    const description = tag(item, "description");
    if (!title || !url) return [];
    const id = tag(item, "guid").match(/(?:story\/|ne)(\d+)/)?.[1] ?? `${Date.parse(tag(item, "pubDate")) || 0}-${index}`;
    const content = parseNewsContent(description, url);
    const body = content.flatMap((block) => block.type === "text" ? [block.text] : []).join("\n\n");
    const firstImage = content.find((block) => block.type === "image");
    const imageUrl = firstImage?.type === "image" ? firstImage.url : normalizeNewsImageUrl(attribute(item, "itunes:image", "href"), url);
    return [{
      id,
      title: extractReadableTextFromHtml(title),
      publishedAt: publishedAt(tag(item, "pubDate")),
      url,
      imageUrl,
      summary: body.slice(0, 150),
      body,
      content,
    } satisfies NewsArticle];
  });
}

export async function getNewsFeed() {
  try {
    const response = await fetch(FEED_URL, { headers: { Accept: "application/rss+xml, application/xml", "User-Agent": "KakehashiWeb/1.0" }, next: { revalidate: 900 }, signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error(`Feed returned ${response.status}`);
    const articles = parseNewsRss(await readBoundedText(response, 3_000_000));
    if (articles.length === 0) throw new Error("Feed contained no articles");
    lastSuccessfulFeed = { articles, updatedAt: new Date().toISOString() };
    return { ...lastSuccessfulFeed, source: "live" as const };
  } catch {
    if (lastSuccessfulFeed) return { ...lastSuccessfulFeed, source: "server-cache" as const };
    throw new Error("The easy-news feed is temporarily unavailable.");
  }
}
