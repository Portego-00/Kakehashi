import {
  lyricsTranslationFingerprint,
  sanitizeLyricLineTranslations,
  type LyricLineTranslations,
} from "./lyrics";
import { readLocal, removeLocal, writeLocal } from "./storage";

interface StoredTranscriptTranslations {
  sourceFingerprint: string;
  translations: LyricLineTranslations;
}

function cacheKey(videoId: string) {
  return `video-transcript-translations:${encodeURIComponent(videoId)}`;
}

export function loadVideoTranscriptTranslations(videoId: string, sourceText: string, lines: readonly string[]) {
  const stored = readLocal<unknown>(cacheKey(videoId), null);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  const cache = stored as Partial<StoredTranscriptTranslations>;
  if (cache.sourceFingerprint !== lyricsTranslationFingerprint(sourceText)) return {};
  return sanitizeLyricLineTranslations(cache.translations, new Set(lines));
}

export function saveVideoTranscriptTranslations(videoId: string, sourceText: string, lines: readonly string[], translations: LyricLineTranslations) {
  const normalized = sanitizeLyricLineTranslations(translations, new Set(lines));
  if (!Object.keys(normalized).length) {
    removeVideoTranscriptTranslations(videoId);
    return true;
  }
  return writeLocal(cacheKey(videoId), {
    sourceFingerprint: lyricsTranslationFingerprint(sourceText),
    translations: normalized,
  } satisfies StoredTranscriptTranslations);
}

export function removeVideoTranscriptTranslations(videoId: string) {
  removeLocal(cacheKey(videoId));
}
