import AsyncStorage from "@react-native-async-storage/async-storage";

const KANJI_DATA_CACHE_PREFIX = "kanji_writer_";
const KANJI_UNAVAILABLE_PREFIX = "kanji_unavailable_";
const KANJI_FETCH_TIMEOUT_MS = 8000;
const inFlightLoads = new Map<string, Promise<CharacterData>>();

// Japanese kanji data CDN from mnako/hanzi-writer-data-ja
// This contains Japanese-specific kanji like 様, 駅, etc.
const JAPANESE_KANJI_CDN =
  "https://cdn.jsdelivr.net/gh/mnako/hanzi-writer-data-ja@master/data";

// Fallback to Chinese hanzi-writer-data for characters not in Japanese dataset
const CHINESE_HANZI_CDN = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0";

// CharacterData type from hanzi-writer
export interface CharacterData {
  strokes: string[];
  medians: number[][][];
  radStrokes?: number[];
}

/**
 * Get the cache key for a kanji character
 */
function getCacheKey(character: string): string {
  const unicode = character.codePointAt(0)?.toString(16).padStart(5, "0");
  return `${KANJI_DATA_CACHE_PREFIX}${unicode}`;
}

/**
 * Get CDN URLs for kanji stroke data (Japanese first, then Chinese fallback)
 * Uses URL-encoded character name (e.g., 月 -> %E6%9C%88)
 */
function getKanjiDataUrls(character: string): string[] {
  const encodedChar = encodeURIComponent(character);
  return [
    `${JAPANESE_KANJI_CDN}/${encodedChar}.json`,
    `${CHINESE_HANZI_CDN}/${encodedChar}.json`,
  ];
}

async function fetchKanjiJsonWithTimeout(
  url: string,
  timeoutMs: number
): Promise<Response> {
  if (typeof AbortController === "undefined") {
    return fetch(url);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Load kanji stroke data for HanziWriter
 * Caches data locally for faster subsequent loads
 */
export async function loadKanjiWriterData(
  character: string
): Promise<CharacterData> {
  const existingRequest = inFlightLoads.get(character);
  if (existingRequest) {
    return existingRequest;
  }

  const loadPromise = (async () => {
  const cacheKey = getCacheKey(character);

  // Check cache first
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (error) {
    console.warn("Error reading kanji writer cache:", error);
  }

  // Fetch from CDN - try Japanese first, then Chinese fallback
  const urls = getKanjiDataUrls(character);

  for (const url of urls) {
    try {
      const response = await fetchKanjiJsonWithTimeout(
        url,
        KANJI_FETCH_TIMEOUT_MS
      );

      if (response.ok) {
        const data = await response.json();

        // Cache the result
        try {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
        } catch (cacheError) {
          console.warn("Error caching kanji writer data:", cacheError);
        }

        return data;
      }
    } catch {
      // Try next URL
      continue;
    }
  }

  // Mark as unavailable in cache to avoid repeated failed requests
  try {
    await AsyncStorage.setItem(
      `${KANJI_UNAVAILABLE_PREFIX}${character}`,
      "true"
    );
  } catch {
    // Ignore cache errors
  }

  throw new Error(`Kanji stroke data not available for: ${character}`);
  })();

  inFlightLoads.set(character, loadPromise);
  try {
    return await loadPromise;
  } finally {
    inFlightLoads.delete(character);
  }
}

/**
 * Preload kanji stroke data for multiple characters
 * Useful for preloading a batch before a practice session
 */
export async function preloadKanjiWriterData(
  characters: string[]
): Promise<{ loaded: string[]; failed: string[] }> {
  const loaded: string[] = [];
  const failed: string[] = [];

  await Promise.all(
    characters.map(async (char) => {
      try {
        await loadKanjiWriterData(char);
        loaded.push(char);
      } catch {
        failed.push(char);
      }
    })
  );

  return { loaded, failed };
}

/**
 * Check if kanji stroke data is available in cache
 */
export async function isKanjiDataCached(character: string): Promise<boolean> {
  const cacheKey = getCacheKey(character);
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    return cached !== null;
  } catch {
    return false;
  }
}

/**
 * Check if kanji stroke data is available (tries to load if not cached)
 * Returns true if data is available, false if not
 */
export async function isKanjiStrokeDataAvailable(
  character: string
): Promise<boolean> {
  // Check if already marked as unavailable
  try {
    const unavailable = await AsyncStorage.getItem(
      `${KANJI_UNAVAILABLE_PREFIX}${character}`
    );
    if (unavailable) {
      return false;
    }
  } catch {
    // Ignore
  }

  // Check if already cached successfully
  const cacheKey = getCacheKey(character);
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      return true;
    }
  } catch {
    // Ignore
  }

  // Try to fetch from CDN
  const urls = getKanjiDataUrls(character);
  for (const url of urls) {
    try {
      const response = await fetch(url, { method: "HEAD" });
      if (response.ok) {
        return true;
      }
    } catch {
      continue;
    }
  }

  // Mark as unavailable
  try {
    await AsyncStorage.setItem(
      `${KANJI_UNAVAILABLE_PREFIX}${character}`,
      "true"
    );
  } catch {
    // Ignore
  }

  return false;
}

/**
 * Clear all cached kanji writer data
 */
export async function clearKanjiWriterCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const kanjiWriterKeys = allKeys.filter((key) =>
      key.startsWith(KANJI_DATA_CACHE_PREFIX)
    );
    await AsyncStorage.multiRemove(kanjiWriterKeys);
  } catch (error) {
    console.error("Error clearing kanji writer cache:", error);
  }
}
