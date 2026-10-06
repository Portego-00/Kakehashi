import { normalizeNewsAudioUrl } from "./news-audio";
import type { FuriganaRange, NewsArticle, NewsSource } from "./types";
type NewsContentBlock = NonNullable<NewsArticle["content"]>[number];
function isNewsSource(value: unknown): value is NewsSource { return value === "easy" || value === "regular"; }

export function sourceFromArticleId(articleId: string): NewsSource {
  let decoded = articleId;
  try {
    decoded = decodeURIComponent(articleId);
  } catch {
    // A malformed route segment can only fall back to the beginner feed.
  }
  return decoded.startsWith("regular:") ? "regular" : "easy";
}

export function normalizedArticleId(id: string, source: NewsSource) {
  let decoded = id;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    // Preserve opaque IDs when percent-decoding fails.
  }
  return decoded.startsWith(`${source}:`) ? decoded : `${source}:${decoded}`;
}

function normalizeFurigana(value: unknown, text: string): FuriganaRange[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const ranges = value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const candidate = item as Partial<FuriganaRange>;
    const start = candidate.start;
    const end = candidate.end;
    const reading = typeof candidate.reading === "string" ? candidate.reading.trim() : "";
    if (
      typeof start !== "number" ||
      typeof end !== "number" ||
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      end <= start ||
      end > text.length ||
      !reading ||
      reading.length > 128 ||
      /[\u0000-\u001f\u007f]/u.test(reading)
    ) return [];
    return [{ start, end, reading }];
  }).sort((left, right) => left.start - right.start || left.end - right.end);
  const nonOverlapping: FuriganaRange[] = [];
  for (const range of ranges) {
    if (range.start < (nonOverlapping.at(-1)?.end ?? 0)) continue;
    if (text.slice(range.start, range.end) === range.reading) continue;
    nonOverlapping.push(range);
  }
  return nonOverlapping.length ? nonOverlapping : undefined;
}

export function normalizeCachedArticle(
  value: unknown,
  fallbackSource: NewsSource,
): NewsArticle | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Partial<NewsArticle>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.title !== "string" ||
    typeof candidate.publishedAt !== "string" ||
    typeof candidate.url !== "string"
  ) {
    return null;
  }

  const source = isNewsSource(candidate.source)
    ? candidate.source
    : sourceFromArticleId(candidate.id) === "regular"
      ? "regular"
      : fallbackSource;
  const audioUrl = source === "easy"
    ? normalizeNewsAudioUrl(candidate.audioUrl, candidate.url)
    : undefined;
  let content: NewsContentBlock[] | undefined;
  if (Array.isArray(candidate.content)) {
    content = [];
    for (const block of candidate.content) {
      if (!block || typeof block !== "object") continue;
      if (block.type === "text" && typeof block.text === "string") {
        const furigana = normalizeFurigana(block.furigana, block.text);
        content.push({ type: "text", text: block.text, ...(furigana ? { furigana } : {}) });
      } else if (block.type === "image" && typeof block.url === "string") {
        content.push({
          type: "image",
          url: block.url,
          ...(typeof block.alt === "string" ? { alt: block.alt } : {}),
        });
      }
    }
  }

  return {
    id: normalizedArticleId(candidate.id, source),
    source,
    title: candidate.title,
    publishedAt: candidate.publishedAt,
    url: candidate.url,
    isFullArticle:
      typeof candidate.isFullArticle === "boolean"
        ? candidate.isFullArticle
        : source === "easy",
    ...(typeof candidate.imageUrl === "string"
      ? { imageUrl: candidate.imageUrl }
      : {}),
    ...(audioUrl ? { audioUrl } : {}),
    ...(typeof candidate.summary === "string"
      ? { summary: candidate.summary }
      : {}),
    ...(typeof candidate.body === "string" ? { body: candidate.body } : {}),
    ...(content ? { content } : {}),
  };
}

