export type NhkEasyItem = {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  guid: string;
  imageUrl: string | null;
  audioUrl: string | null;
  contentHtml: string;
  excerpt: string;
};

export type NhkEasyContentBlock =
  | {
      type: "text";
      content: string;
    }
  | {
      type: "image";
      content: string;
    };

const FEED_URL = "https://nhkeasier.com/feed/";
const BASE_URL = "https://nhkeasier.com";

export async function getNhkEasyNews(): Promise<NhkEasyItem[]> {
  const response = await fetch(FEED_URL);

  if (!response.ok) {
    throw new Error(`NHK Easy feed failed: ${response.status}`);
  }

  return parseNhkEasyFeed(await response.text());
}

export function parseNhkEasyFeed(xmlText: string): NhkEasyItem[] {
  return matchAll(xmlText, /<item>([\s\S]*?)<\/item>/g).map((itemXml) => {
    const description = readXmlValue(itemXml, "description");
    const imageUrl = absolutizeUrl(readAttribute(description, "img", "src"));
    const audioUrl = absolutizeUrl(readAttribute(description, "audio", "src"));
    const link = readXmlValue(itemXml, "link");
    const guid = readXmlValue(itemXml, "guid") || link;

    return {
      id: createNewsItemId(guid || link),
      title: readXmlValue(itemXml, "title") || "No title",
      link,
      pubDate: readXmlValue(itemXml, "pubDate"),
      guid,
      imageUrl,
      audioUrl,
      contentHtml: description,
      excerpt: htmlToText(description).slice(0, 460),
    };
  });
}

export async function getNhkEasyItemById(id: string): Promise<NhkEasyItem | null> {
  const items = await getNhkEasyNews();
  return items.find((item) => item.id === id) ?? null;
}

export function getNhkEasyContentBlocks(item: NhkEasyItem): NhkEasyContentBlock[] {
  const blocks: NhkEasyContentBlock[] = [{ type: "text", content: item.title }];
  const pattern = /<p[^>]*>([\s\S]*?)<\/p>|<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(item.contentHtml))) {
    if (match[1]) {
      const content = htmlParagraphToText(match[1]);
      if (content) {
        blocks.push({ type: "text", content });
      }
      continue;
    }

    if (match[2]) {
      const imageUrl = absolutizeUrl(match[2]);
      if (imageUrl) {
        blocks.push({ type: "image", content: imageUrl });
      }
    }
  }

  return blocks;
}

export function getNhkEasyMatchingText(blocks: NhkEasyContentBlock[]): string {
  return blocks
    .filter((block): block is NhkEasyContentBlock & { type: "text" } => block.type === "text")
    .map((block) => block.content)
    .join("\n");
}

function readXmlValue(xmlText: string, tagName: string): string {
  const match = xmlText.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`));
  if (!match) return "";
  return decodeHtmlEntities(stripCdata(match[1]).trim());
}

function readAttribute(htmlText: string, tagName: string, attributeName: string): string | null {
  const match = htmlText.match(
    new RegExp(`<${tagName}[^>]*\\s${attributeName}=["']([^"']+)["']`, "i")
  );
  return match?.[1] ?? null;
}

function stripCdata(value: string): string {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function htmlToText(htmlText: string): string {
  return decodeHtmlEntities(
    stripCdata(htmlText)
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function htmlParagraphToText(htmlText: string): string {
  return decodeHtmlEntities(
    stripCdata(htmlText)
      .replace(/<rt[^>]*>[\s\S]*?<\/rt>/gi, "")
      .replace(/<rp[^>]*>[\s\S]*?<\/rp>/gi, "")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim()
  );
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function absolutizeUrl(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function createNewsItemId(value: string): string {
  const storyId = value.match(/(?:story|news)\/(\d+)/)?.[1] ?? value.match(/(\d{4,})/)?.[1];
  if (storyId) {
    return storyId;
  }

  return encodeURIComponent(value).replace(/%/g, "").slice(0, 80);
}

function matchAll(value: string, pattern: RegExp): string[] {
  const out: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value))) {
    out.push(match[1]);
  }

  return out;
}
