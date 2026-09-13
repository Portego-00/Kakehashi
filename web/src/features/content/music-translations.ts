import {
  lyricsTranslationFingerprint,
  sanitizeLyricLineTranslations,
  type LyricLineTranslations,
} from "./lyrics";
import { readLocal, removeLocal, writeLocal } from "./storage";

interface StoredLyricTranslations {
  sourceFingerprint: string;
  translations: LyricLineTranslations;
}

function cacheKey(songId: string) {
  return `song-lyric-translations:${encodeURIComponent(songId)}`;
}

export function loadSongLyricTranslations(songId: string, sourceText: string, lines: readonly string[]) {
  const stored = readLocal<unknown>(cacheKey(songId), null);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  const cache = stored as Partial<StoredLyricTranslations>;
  if (cache.sourceFingerprint !== lyricsTranslationFingerprint(sourceText)) return {};
  return sanitizeLyricLineTranslations(cache.translations, new Set(lines));
}

export function saveSongLyricTranslations(songId: string, sourceText: string, lines: readonly string[], translations: LyricLineTranslations) {
  const normalized = sanitizeLyricLineTranslations(translations, new Set(lines));
  if (!Object.keys(normalized).length) {
    removeSongLyricTranslations(songId);
    return true;
  }
  return writeLocal(cacheKey(songId), {
    sourceFingerprint: lyricsTranslationFingerprint(sourceText),
    translations: normalized,
  } satisfies StoredLyricTranslations);
}

export function removeSongLyricTranslations(songId: string) {
  removeLocal(cacheKey(songId));
}
