export type UrlContentBlock = {
  type: "heading" | "paragraph";
  content: string;
};

export type UrlReaderTweetMedia = {
  type: "image" | "video" | "gif";
  url: string;
  thumbnailUrl?: string;
  altText?: string;
};

export type UrlReaderTweetData = {
  tweetId: string;
  authorName: string;
  authorHandle: string;
  authorProfileImageUrl: string | null;
  text: string;
  createdAt: string | null;
  media: UrlReaderTweetMedia[];
};

export type UrlReaderContent = {
  requestedUrl: string;
  resolvedUrl: string;
  title: string;
  blocks: UrlContentBlock[];
  source: "direct" | "reader-fallback";
  kind: "tweet" | "article";
  tweet: UrlReaderTweetData | null;
};

const JAPANESE_CHARACTER_PATTERN = /[\u3040-\u30FF\u3400-\u9FFF々]/;
const JAPANESE_CHARACTER_GLOBAL_PATTERN = /[\u3040-\u30FF\u3400-\u9FFF々]/g;

const DIRECT_ACCEPT_HEADER =
  "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.7,*/*;q=0.5";

const READER_FALLBACK_URL_PREFIX = "https://r.jina.ai/http://";
const RAW_LOG_PREVIEW_LENGTH = 4000;
const DEFAULT_FETCH_TIMEOUT_MS = 12000;
const VXTWITTER_FETCH_TIMEOUT_MS = 6500;
const READER_FALLBACK_FETCH_TIMEOUT_MS = 12000;

function isTruthyEnvFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

function shouldLogUrlReaderDebug(): boolean {
  const envFlag = process.env.EXPO_PUBLIC_LOG_URL_READER;
  if (isTruthyEnvFlag(envFlag)) {
    return true;
  }

  return (
    typeof globalThis !== "undefined" &&
    Boolean((globalThis as any).__DEV__)
  );
}

function getNowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function roundDuration(durationMs: number): number {
  return Math.round(durationMs * 10) / 10;
}

function logUrlReaderTiming(
  stage: string,
  startMs: number,
  extra?: Record<string, unknown>
): void {
  if (!shouldLogUrlReaderDebug()) {
    return;
  }

  console.log(`[URL Reader] ${stage}`, {
    durationMs: roundDuration(getNowMs() - startMs),
    ...(extra ?? {}),
  });
}

function getRawPreview(text: string): string {
  if (text.length <= RAW_LOG_PREVIEW_LENGTH) {
    return text;
  }
  return `${text.slice(0, RAW_LOG_PREVIEW_LENGTH)}\n...[truncated preview]`;
}

function logRawResponse(
  stage: "direct" | "reader-fallback",
  payload: {
    requestedUrl: string;
    resolvedUrl: string;
    contentType: string;
    text: string;
  }
): void {
  if (!shouldLogUrlReaderDebug()) {
    return;
  }

  console.log(`[URL Reader] ${stage} response summary`, {
    requestedUrl: payload.requestedUrl,
    resolvedUrl: payload.resolvedUrl,
    contentType: payload.contentType,
    characterCount: payload.text.length,
  });
  console.log(`[URL Reader] ${stage} raw preview`, getRawPreview(payload.text));
  console.log(`[URL Reader] ${stage} raw full`, payload.text);
}

function logExtractionSummary(
  stage: "direct" | "reader-fallback",
  payload: {
    title: string;
    blockCount: number;
    blocks: UrlContentBlock[];
    isMeaningful: boolean;
  }
): void {
  if (!shouldLogUrlReaderDebug()) {
    return;
  }

  console.log(`[URL Reader] ${stage} extraction summary`, {
    title: payload.title,
    blockCount: payload.blockCount,
    isMeaningful: payload.isMeaningful,
    sampleBlocks: payload.blocks.slice(0, 10).map((block) => ({
      type: block.type,
      content: block.content,
    })),
  });
}

function normalizeInputUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return null;
  }

  const withScheme = /^[a-z]+:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const parsed = new URL(withScheme);
    if (!(parsed.protocol === "http:" || parsed.protocol === "https:")) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeBlockText(value: string): string {
  return value
    .replace(/\n{2,}/g, "\n")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForDedup(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function shouldKeepBlockText(text: string): boolean {
  if (text.length < 2) {
    return false;
  }

  if (
    /^(share|menu|more|next|previous|sign in|sign up|close|search)$/i.test(
      text
    )
  ) {
    return false;
  }

  const hasJapanese = JAPANESE_CHARACTER_PATTERN.test(text);
  if (hasJapanese) {
    return true;
  }

  return text.length >= 60;
}

function splitPlainTextIntoBlocks(text: string): UrlContentBlock[] {
  const blocks: UrlContentBlock[] = [];
  const seen = new Set<string>();

  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => normalizeBlockText(paragraph))
    .filter(Boolean);
  const hasAnyJapaneseParagraph = paragraphs.some((paragraph) =>
    JAPANESE_CHARACTER_PATTERN.test(paragraph)
  );
  const preferredParagraphs = hasAnyJapaneseParagraph
    ? paragraphs.filter((paragraph) => JAPANESE_CHARACTER_PATTERN.test(paragraph))
    : paragraphs;

  preferredParagraphs.forEach((paragraph, index) => {
    if (!shouldKeepBlockText(paragraph)) {
      return;
    }

    const dedupeKey = normalizeForDedup(paragraph);
    if (!dedupeKey || seen.has(dedupeKey)) {
      return;
    }
    seen.add(dedupeKey);

    blocks.push({
      type: index === 0 && paragraph.length <= 120 ? "heading" : "paragraph",
      content: paragraph,
    });
  });

  return blocks;
}

function extractTitleFromMarkdownLikeText(text: string): string {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const metadataTitle = lines.find((line) => line.toLowerCase().startsWith("title:"));
  if (metadataTitle) {
    const parsedTitle = metadataTitle.replace(/^title:\s*/i, "").trim();
    if (parsedTitle) {
      return parsedTitle;
    }
  }

  const heading = lines.find((line) => /^#{1,6}\s+/.test(line));
  if (heading) {
    return heading.replace(/^#{1,6}\s+/, "").trim();
  }

  return "";
}

function cleanMarkdownLikeText(text: string): string {
  return text
    .replace(/^URL Source:.*$/gim, "")
    .replace(/^Markdown Content:.*$/gim, "")
    .replace(/^Title:\s*.*$/gim, "")
    .replace(/^Published Time:.*$/gim, "")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/`{1,3}/g, "")
    .replace(/\r/g, "")
    .trim();
}

function extractBlocksFromMarkdownLikeText(text: string): UrlContentBlock[] {
  const cleaned = cleanMarkdownLikeText(text);
  return splitPlainTextIntoBlocks(cleaned);
}

function isXStatusUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const isXHost =
      host === "x.com" ||
      host.endsWith(".x.com") ||
      host === "twitter.com" ||
      host.endsWith(".twitter.com");
    return isXHost && /\/status\/\d+/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function extractXStatusId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/status\/(\d+)/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function simplifyMarkdownLine(rawLine: string): string {
  return normalizeBlockText(
    rawLine
      .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
      .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
      .replace(/^#{1,6}\s+/, "")
      .replace(/\|/g, " ")
  );
}

function parseXHandleFromFallbackText(rawText: string): string {
  const handleMatch = rawText.match(/\[@([A-Za-z0-9_]+)]\([^)]+\)/);
  if (handleMatch?.[1]) {
    return handleMatch[1];
  }

  const profileUrlMatch = rawText.match(/https?:\/\/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})(?:\b|\/)/i);
  if (profileUrlMatch?.[1]) {
    return profileUrlMatch[1];
  }

  return "";
}

function parseXMediaUrlsFromFallbackText(rawText: string): string[] {
  const matches = Array.from(
    rawText.matchAll(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/g)
  );
  const urls = matches
    .map((match) => match[1] ?? "")
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => /^https?:\/\/pbs\.twimg\.com\//i.test(value))
    .filter((value) => !/\/emoji\//i.test(value));
  const dedupedByCanonicalKey = new Map<string, string>();
  urls.forEach((url) => {
    const key = getCanonicalTweetMediaKey(url);
    if (!key || dedupedByCanonicalKey.has(key)) {
      return;
    }
    dedupedByCanonicalKey.set(key, url);
  });
  return Array.from(dedupedByCanonicalKey.values());
}

function normalizeTweetTextFromBlocks(blocks: UrlContentBlock[]): string {
  return blocks
    .map((block) => block.content.trim())
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function createTweetParagraphBlocks(text: string): UrlContentBlock[] {
  const normalized = text.trim();
  if (!normalized) {
    return [];
  }

  const parsedBlocks = splitPlainTextIntoBlocks(normalized).map((block) => ({
    ...block,
    type: "paragraph" as const,
  }));
  if (parsedBlocks.length > 0) {
    return parsedBlocks;
  }

  return normalized
    .split(/\r?\n+/)
    .map((line) => normalizeBlockText(line))
    .filter(Boolean)
    .map((line) => ({
      type: "paragraph" as const,
      content: line,
    }));
}

type VxTwitterMedia = {
  type?: string;
  url?: string;
  thumbnail_url?: string;
  altText?: string | null;
};

type VxTwitterResponse = {
  user_name?: string;
  user_screen_name?: string;
  user_profile_image_url?: string;
  text?: string;
  date?: string;
  mediaURLs?: string[];
  media_extended?: VxTwitterMedia[];
};

async function fetchTweetMetadataFromVxTwitter(
  tweetId: string
): Promise<UrlReaderTweetData | null> {
  try {
    const endpoint = `https://api.vxtwitter.com/Twitter/status/${tweetId}`;
    const response = await fetchWithTimeout(
      endpoint,
      {
        method: "GET",
        headers: {
          Accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
        },
      },
      VXTWITTER_FETCH_TIMEOUT_MS
    );
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as VxTwitterResponse;
    const authorName =
      typeof payload.user_name === "string" ? payload.user_name.trim() : "";
    const authorHandle =
      typeof payload.user_screen_name === "string"
        ? payload.user_screen_name.replace(/^@/, "").trim()
        : "";
    const text = typeof payload.text === "string" ? payload.text.trim() : "";
    const profileImageUrl =
      typeof payload.user_profile_image_url === "string"
        ? payload.user_profile_image_url.trim()
        : "";

    const media: UrlReaderTweetMedia[] = [];
    const mediaExtended = Array.isArray(payload.media_extended)
      ? payload.media_extended
      : [];
    const mediaUrls = Array.isArray(payload.mediaURLs)
      ? payload.mediaURLs.filter((value): value is string => typeof value === "string")
      : [];

    for (const item of mediaExtended) {
      if (!item || typeof item.url !== "string" || !item.url.trim()) {
        continue;
      }
      const rawType = typeof item.type === "string" ? item.type.toLowerCase() : "image";
      const type: UrlReaderTweetMedia["type"] =
        rawType === "video" ? "video" : rawType === "gif" ? "gif" : "image";
      media.push({
        type,
        url: item.url.trim(),
        thumbnailUrl:
          typeof item.thumbnail_url === "string" ? item.thumbnail_url.trim() : undefined,
        altText: typeof item.altText === "string" ? item.altText : undefined,
      });
    }

    if (media.length === 0) {
      mediaUrls.forEach((url) => {
        if (!url.trim()) {
          return;
        }
        media.push({
          type: "image",
          url: url.trim(),
        });
      });
    }

    if (!authorName && !authorHandle && !text && media.length === 0) {
      return null;
    }

    return {
      tweetId,
      authorName,
      authorHandle,
      authorProfileImageUrl: profileImageUrl || null,
      text,
      createdAt: typeof payload.date === "string" ? payload.date.trim() : null,
      media,
    };
  } catch {
    return null;
  }
}

function mergeTweetMetadata(
  tweetId: string,
  fallbackText: string,
  fallbackBlocks: UrlContentBlock[],
  vxTweet: UrlReaderTweetData | null
): UrlReaderTweetData {
  const fallbackAuthorName = extractXAuthorFromTitleLine(fallbackText);
  const fallbackHandle = parseXHandleFromFallbackText(fallbackText);
  const fallbackTweetText = normalizeTweetTextFromBlocks(fallbackBlocks);
  const fallbackMedia = parseXMediaUrlsFromFallbackText(fallbackText).map((url) => ({
    type: "image" as const,
    url,
  }));

  const mergedMedia: UrlReaderTweetMedia[] = [];
  const mediaIndexByKey = new Map<string, number>();
  const registerMediaKeys = (index: number, mediaItem: UrlReaderTweetMedia) => {
    getTweetMediaMergeKeys(mediaItem).forEach((key) => {
      if (!key) {
        return;
      }
      mediaIndexByKey.set(key, index);
    });
  };

  [...(vxTweet?.media ?? []), ...fallbackMedia].forEach((mediaItem) => {
    if (!mediaItem.url?.trim()) {
      return;
    }

    const mediaKeys = getTweetMediaMergeKeys(mediaItem);
    const existingIndexes = Array.from(
      new Set(
        mediaKeys
          .map((key) => mediaIndexByKey.get(key))
          .filter((value): value is number => typeof value === "number")
      )
    );

    if (existingIndexes.length === 0) {
      const newIndex = mergedMedia.push({
        ...mediaItem,
        url: mediaItem.url.trim(),
      }) - 1;
      registerMediaKeys(newIndex, mergedMedia[newIndex]);
      return;
    }

    const targetIndex = existingIndexes[0];
    const mergedItem = mergeTweetMediaItems(mergedMedia[targetIndex], mediaItem);
    mergedMedia[targetIndex] = mergedItem;
    registerMediaKeys(targetIndex, mergedItem);
  });

  const finalizedMedia = finalizeTweetMedia(mergedMedia);

  return {
    tweetId,
    authorName: vxTweet?.authorName || fallbackAuthorName || "Unknown",
    authorHandle: vxTweet?.authorHandle || fallbackHandle,
    authorProfileImageUrl: vxTweet?.authorProfileImageUrl ?? null,
    text: vxTweet?.text || fallbackTweetText,
    createdAt: vxTweet?.createdAt ?? null,
    media: finalizedMedia.slice(0, 4),
  };
}

function finalizeTweetMedia(media: UrlReaderTweetMedia[]): UrlReaderTweetMedia[] {
  const mergedByKey: UrlReaderTweetMedia[] = [];
  const keyToIndex = new Map<string, number>();
  const registerKeys = (index: number, mediaItem: UrlReaderTweetMedia) => {
    getTweetMediaMergeKeys(mediaItem).forEach((key) => {
      if (!key) {
        return;
      }
      keyToIndex.set(key, index);
    });
  };

  media.forEach((mediaItem) => {
    if (!mediaItem.url?.trim()) {
      return;
    }
    const keys = getTweetMediaMergeKeys(mediaItem);
    const existingIndex = keys
      .map((key) => keyToIndex.get(key))
      .find((value): value is number => typeof value === "number");

    if (typeof existingIndex !== "number") {
      const newIndex =
        mergedByKey.push({
          ...mediaItem,
          url: mediaItem.url.trim(),
        }) - 1;
      registerKeys(newIndex, mergedByKey[newIndex]);
      return;
    }

    const mergedItem = mergeTweetMediaItems(mergedByKey[existingIndex], mediaItem);
    mergedByKey[existingIndex] = mergedItem;
    registerKeys(existingIndex, mergedItem);
  });

  const motionThumbnailKeys = new Set<string>();
  mergedByKey.forEach((mediaItem) => {
    if (mediaItem.type !== "video" && mediaItem.type !== "gif") {
      return;
    }
    if (!mediaItem.thumbnailUrl) {
      return;
    }
    const thumbnailKey = getCanonicalTweetMediaKey(mediaItem.thumbnailUrl);
    if (thumbnailKey) {
      motionThumbnailKeys.add(thumbnailKey);
    }
  });

  return mergedByKey.filter((mediaItem) => {
    if (mediaItem.type !== "image") {
      return true;
    }
    const imageKey = getCanonicalTweetMediaKey(mediaItem.url);
    if (!imageKey) {
      return true;
    }
    return !motionThumbnailKeys.has(imageKey);
  });
}

function getTweetMediaMergeKeys(mediaItem: UrlReaderTweetMedia): string[] {
  const keys: string[] = [];
  const canonicalUrlKey = getCanonicalTweetMediaKey(mediaItem.url);
  if (canonicalUrlKey) {
    keys.push(canonicalUrlKey);
  }

  if (mediaItem.thumbnailUrl) {
    const canonicalThumbnailKey = getCanonicalTweetMediaKey(mediaItem.thumbnailUrl);
    if (canonicalThumbnailKey) {
      keys.push(canonicalThumbnailKey);
    }
  }

  return Array.from(new Set(keys));
}

function mergeTweetMediaItems(
  existing: UrlReaderTweetMedia,
  incoming: UrlReaderTweetMedia
): UrlReaderTweetMedia {
  const incomingIsMotion = incoming.type === "video" || incoming.type === "gif";
  const existingIsMotion = existing.type === "video" || existing.type === "gif";
  const promoteIncoming = incomingIsMotion && !existingIsMotion;
  const primary = promoteIncoming ? incoming : existing;
  const secondary = promoteIncoming ? existing : incoming;
  const inferredSecondaryThumbnail =
    secondary.type === "image" ? secondary.url : secondary.thumbnailUrl;

  return {
    type: primary.type,
    url: primary.url || secondary.url,
    thumbnailUrl: primary.thumbnailUrl || inferredSecondaryThumbnail,
    altText: primary.altText || secondary.altText,
  };
}

function getCanonicalTweetMediaKey(url: string): string {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return "";
  }

  try {
    const parsed = new URL(trimmedUrl);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // Normalize pbs.twimg.com media URLs across variants:
    // - /media/ABC.png
    // - /media/ABC?format=png&name=small
    // - /ext_tw_video_thumb/ABC/pu/img/XYZ.jpg
    // -> stable canonical keys.
    if (host.endsWith("twimg.com")) {
      const mediaMatch = pathname.match(/\/media\/([^./?]+)/i);
      if (mediaMatch?.[1]) {
        return `pbs-media:${mediaMatch[1].toLowerCase()}`;
      }

      const extensionThumbMatch = pathname.match(
        /\/(?:ext_tw_video_thumb|amplify_video_thumb|tweet_video_thumb)\/([^/?]+)/i
      );
      if (extensionThumbMatch?.[1]) {
        return `pbs-thumb:${extensionThumbMatch[1].toLowerCase()}`;
      }
    }

    return `${host}${pathname.toLowerCase()}`;
  } catch {
    return trimmedUrl.toLowerCase();
  }
}

function isLikelyXNoiseLine(line: string): boolean {
  if (!line) {
    return true;
  }

  if (/^(@[\w_]+)$/i.test(line)) {
    return true;
  }

  return (
    /^url source:/i.test(line) ||
    /^published time:/i.test(line) ||
    /^markdown content:/i.test(line) ||
    /^don.?t miss what.?s happening$/i.test(line) ||
    /^people on x are the first to know\.?$/i.test(line) ||
    /^log in$/i.test(line) ||
    /^sign up$/i.test(line) ||
    /^post$/i.test(line) ||
    /^conversation$/i.test(line) ||
    /^new to x\?$/i.test(line) ||
    /^create account$/i.test(line) ||
    /^trending now$/i.test(line) ||
    /^what.?s happening$/i.test(line) ||
    /^show more$/i.test(line) ||
    /^terms of service$/i.test(line) ||
    /^privacy policy$/i.test(line) ||
    /^cookie policy$/i.test(line) ||
    /^accessibility$/i.test(line) ||
    /^ads info$/i.test(line) ||
    /^©\s*\d{4}\s*x corp\.?$/i.test(line) ||
    /\bviews\b/i.test(line) ||
    /trending in /i.test(line) ||
    /^sports\s*[·•]\s*trending$/i.test(line) ||
    /^\d{1,2}:\d{2}\s*(am|pm)\s*·/i.test(line)
  );
}

function cleanTweetCandidateText(value: string): string {
  return normalizeBlockText(
    value
      .replace(/^title:\s*/i, "")
      .replace(/\s+on\s+x:\s*["“]?[\s\S]*$/i, "")
      .replace(/\s*\/\s*x$/i, "")
      .replace(/https?:\/\/t\.co\/\S+/gi, "")
      .replace(/^[“"]|[”"]$/g, "")
      .replace(/^[^\p{L}\p{N}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}@#]+/u, "")
      .replace(/[^\p{L}\p{N}\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}。！？!?、，．・ー〜～@#\s]+$/u, "")
  );
}

function extractTweetTextFromTitleLine(rawText: string): string {
  const titleLineMatch = rawText.match(/^Title:\s*(.+)$/im);
  const titleLine = titleLineMatch?.[1]?.trim() ?? "";
  if (!titleLine) {
    return "";
  }

  const quotedMatch = titleLine.match(/on X:\s*["“]([\s\S]*?)["”]\s*\/\s*X/i);
  if (quotedMatch?.[1]) {
    return cleanTweetCandidateText(quotedMatch[1]);
  }

  return "";
}

function extractXAuthorFromTitleLine(rawText: string): string {
  const titleLineMatch = rawText.match(/^Title:\s*(.+)$/im);
  const titleLine = titleLineMatch?.[1]?.trim() ?? "";
  if (!titleLine) {
    return "";
  }

  const authorMatch = titleLine.match(/^(.+?)\s+on\s+X:/i);
  if (!authorMatch?.[1]) {
    return "";
  }

  return cleanTweetCandidateText(authorMatch[1]);
}

function extractXStatusBlocksFromFallbackText(rawText: string): UrlContentBlock[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => simplifyMarkdownLine(line))
    .filter(Boolean);
  const collected: string[] = [];
  const authorFromTitle = extractXAuthorFromTitleLine(rawText);
  const normalizedAuthor = normalizeForDedup(authorFromTitle);
  const titleTweet = extractTweetTextFromTitleLine(rawText);
  const normalizedTitleTweet = normalizeForDedup(titleTweet);

  const hasNearDuplicate = (value: string): boolean => {
    const normalizedValue = normalizeForDedup(value);
    if (!normalizedValue) {
      return true;
    }

    return collected.some((existingValue) => {
      const normalizedExisting = normalizeForDedup(existingValue);
      if (!normalizedExisting) {
        return false;
      }
      return (
        normalizedExisting === normalizedValue ||
        normalizedExisting.includes(normalizedValue) ||
        normalizedValue.includes(normalizedExisting)
      );
    });
  };

  const addCandidate = (candidate: string) => {
    const cleaned = cleanTweetCandidateText(candidate);
    if (!cleaned || !JAPANESE_CHARACTER_PATTERN.test(cleaned)) {
      return;
    }
    const dedupeKey = normalizeForDedup(cleaned);
    if (!dedupeKey) {
      return;
    }
    if (normalizedAuthor && dedupeKey === normalizedAuthor) {
      return;
    }
    if (hasNearDuplicate(cleaned)) {
      return;
    }
    collected.push(cleaned);
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!/^@[\w_]+$/i.test(line)) {
      continue;
    }

    for (let lookahead = index + 1; lookahead < Math.min(lines.length, index + 8); lookahead += 1) {
      const candidateLine = lines[lookahead];
      if (!candidateLine || isLikelyXNoiseLine(candidateLine)) {
        if (candidateLine && /views|am|pm/i.test(candidateLine)) {
          break;
        }
        continue;
      }

      if (!JAPANESE_CHARACTER_PATTERN.test(candidateLine)) {
        continue;
      }

      addCandidate(candidateLine);
    }
  }

  lines.forEach((line) => {
    if (isLikelyXNoiseLine(line)) {
      return;
    }

    if (!JAPANESE_CHARACTER_PATTERN.test(line)) {
      return;
    }

    if (/ on x:\s*["“]/i.test(line)) {
      return;
    }

    addCandidate(line);
  });

  if (collected.length === 0 && titleTweet) {
    addCandidate(titleTweet);
  }

  const candidates = collected
    .filter((value) => value.length >= 4)
    .filter((value) => {
      const normalizedValue = normalizeForDedup(value);
      if (!normalizedValue || !normalizedTitleTweet) {
        return true;
      }
      if (normalizedValue === normalizedTitleTweet) {
        return true;
      }
      if (normalizedTitleTweet.includes(normalizedValue)) {
        return false;
      }
      return true;
    });
  return candidates.slice(0, 4).map((content) => ({
    type: "paragraph",
    content,
  }));
}

function isMeaningfulExtraction(blocks: UrlContentBlock[]): boolean {
  if (blocks.length === 0) {
    return false;
  }

  const combined = blocks.map((block) => block.content).join("\n");
  const totalLength = combined.length;
  const japaneseCharacterCount =
    combined.match(JAPANESE_CHARACTER_GLOBAL_PATTERN)?.length ?? 0;

  if (japaneseCharacterCount >= 8) {
    return true;
  }

  return totalLength >= 80;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => {
    timeoutController.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: timeoutController.signal,
    });
  } catch (error) {
    const isAbortError =
      error instanceof Error && error.name === "AbortError";
    if (isAbortError) {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchTextFromUrl(
  url: string,
  options?: {
    timeoutMs?: number;
  }
): Promise<{
  text: string;
  resolvedUrl: string;
  contentType: string;
}> {
  const response = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        Accept: DIRECT_ACCEPT_HEADER,
      },
    },
    options?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS
  );

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const text = await response.text();
  return {
    text,
    resolvedUrl: response.url || url,
    contentType: response.headers.get("content-type") ?? "",
  };
}

function toReaderFallbackUrl(url: string): string {
  const withoutProtocol = url.replace(/^https?:\/\//i, "");
  return `${READER_FALLBACK_URL_PREFIX}${withoutProtocol}`;
}

export async function fetchUrlReaderContent(
  rawUrl: string
): Promise<UrlReaderContent> {
  const requestStartMs = getNowMs();
  const normalizedUrl = normalizeInputUrl(rawUrl);
  if (!normalizedUrl) {
    throw new Error("Please enter a valid http(s) URL.");
  }
  const isXStatus = isXStatusUrl(normalizedUrl);
  if (!isXStatus) {
    throw new Error("Only X/Twitter post URLs are supported right now.");
  }
  const tweetId = extractXStatusId(normalizedUrl);
  if (!tweetId) {
    throw new Error("Could not parse tweet ID from this URL.");
  }

  if (shouldLogUrlReaderDebug()) {
    console.log("[URL Reader] fetch started", {
      requestedUrl: normalizedUrl,
      tweetId,
    });
  }

  const vxFetchStartMs = getNowMs();
  const vxTweet = await fetchTweetMetadataFromVxTwitter(tweetId);
  logUrlReaderTiming("vxtwitter metadata fetched", vxFetchStartMs, {
    hasMetadata: Boolean(vxTweet),
    textLength: vxTweet?.text.trim().length ?? 0,
    mediaCount: vxTweet?.media.length ?? 0,
  });

  const vxTweetText = vxTweet?.text?.trim() ?? "";
  if (vxTweet && vxTweetText) {
    const vxTweetBlocks = createTweetParagraphBlocks(vxTweetText);
    if (vxTweetBlocks.length > 0) {
      const normalizedVxTweet: UrlReaderTweetData = {
        ...vxTweet,
        media: finalizeTweetMedia(vxTweet.media).slice(0, 4),
      };
      logUrlReaderTiming("vxtwitter fast path selected", requestStartMs, {
        blockCount: vxTweetBlocks.length,
        mediaCount: normalizedVxTweet.media.length,
      });
      return {
        requestedUrl: normalizedUrl,
        resolvedUrl: normalizedUrl,
        title:
          normalizedVxTweet.authorName ||
          (normalizedVxTweet.authorHandle ? `@${normalizedVxTweet.authorHandle}` : normalizedUrl),
        blocks: vxTweetBlocks,
        source: "direct",
        kind: "tweet",
        tweet: normalizedVxTweet,
      };
    }
  }

  const fallbackUrl = toReaderFallbackUrl(normalizedUrl);
  const fallbackFetchStartMs = getNowMs();
  const fallback = await fetchTextFromUrl(fallbackUrl, {
    timeoutMs: READER_FALLBACK_FETCH_TIMEOUT_MS,
  });
  logUrlReaderTiming("reader fallback fetched", fallbackFetchStartMs, {
    fallbackUrl: fallback.resolvedUrl,
    contentType: fallback.contentType,
    characterCount: fallback.text.length,
  });
  logRawResponse("reader-fallback", {
    requestedUrl: normalizedUrl,
    resolvedUrl: fallback.resolvedUrl,
    contentType: fallback.contentType,
    text: fallback.text,
  });
  const fallbackParseStartMs = getNowMs();
  const extractedTitleTweet = isXStatus
    ? extractTweetTextFromTitleLine(fallback.text)
    : "";
  const extractedTitleAuthor = isXStatus
    ? extractXAuthorFromTitleLine(fallback.text)
    : "";
  const fallbackTitle =
    extractedTitleAuthor ||
    extractedTitleTweet ||
    extractTitleFromMarkdownLikeText(fallback.text) ||
    normalizedUrl;
  const fallbackBlocks = isXStatus
    ? extractXStatusBlocksFromFallbackText(fallback.text)
    : extractBlocksFromMarkdownLikeText(fallback.text);
  const fallbackIsMeaningful = isMeaningfulExtraction(fallbackBlocks);
  logExtractionSummary("reader-fallback", {
    title: fallbackTitle,
    blockCount: fallbackBlocks.length,
    blocks: fallbackBlocks,
    isMeaningful: fallbackIsMeaningful,
  });
  logUrlReaderTiming("reader fallback parsed", fallbackParseStartMs, {
    title: fallbackTitle,
    blockCount: fallbackBlocks.length,
    isMeaningful: fallbackIsMeaningful,
  });

  if (!fallbackIsMeaningful) {
    if (shouldLogUrlReaderDebug()) {
      console.log("[URL Reader] fallback extraction not meaningful", {
        requestedUrl: normalizedUrl,
        fallbackUrl,
        hasVxMetadata: Boolean(vxTweet),
        vxTextLength: vxTweetText.length,
      });
    }
    throw new Error("Could not extract readable article text from this URL.");
  }

  const mergedTweet = mergeTweetMetadata(tweetId, fallback.text, fallbackBlocks, vxTweet);
  const tweetText = mergedTweet.text.trim();
  const tweetBlocks = tweetText
    ? createTweetParagraphBlocks(tweetText)
    : fallbackBlocks;

  logUrlReaderTiming("fetchUrlReaderContent completed", requestStartMs, {
    path: "reader-fallback",
    blockCount: tweetBlocks.length,
    mediaCount: mergedTweet.media.length,
    hasTweetText: Boolean(tweetText),
  });

  return {
    requestedUrl: normalizedUrl,
    resolvedUrl: normalizedUrl,
    title: mergedTweet.authorName || fallbackTitle,
    blocks: tweetBlocks,
    source: "reader-fallback",
    kind: "tweet",
    tweet: mergedTweet,
  };
}
