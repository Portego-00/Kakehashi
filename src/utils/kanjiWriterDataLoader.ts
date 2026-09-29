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

function isCharacterData(value: unknown): value is CharacterData {
  if (!value || typeof value !== "object") return false;
  const { strokes, medians, radStrokes } = value as Partial<CharacterData>;
  return Array.isArray(strokes) && strokes.length > 0
    && strokes.every((path) => typeof path === "string" && path.trim().startsWith("M"))
    && Array.isArray(medians) && medians.length === strokes.length
    && medians.every((points) => Array.isArray(points) && points.length >= 2
      && points.every((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))
      && points.some((point) => point[0] !== points[0][0] || point[1] !== points[0][1]))
    && (radStrokes === undefined || (Array.isArray(radStrokes) && radStrokes.every(Number.isInteger)));
}

async function readCachedData(character: string): Promise<CharacterData | null> {
  try {
    const cached = await AsyncStorage.getItem(getCacheKey(character));
    const data: unknown = cached ? JSON.parse(cached) : null;
    if (isCharacterData(data)) return data;
  } catch {
    // A damaged cache or unavailable storage must not prevent a network retry.
  }
  return null;
}

async function fetchKanjiData(url: string): Promise<CharacterData> {
  const controller = typeof AbortController === "undefined" ? undefined : new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    // Cover the body as well as headers, including fetch implementations that
    // don't reject promptly when aborted.
    return await Promise.race([
      (async () => {
        const response = await fetch(url, { signal: controller?.signal });
        if (!response.ok) throw new Error(`Stroke data HTTP ${response.status}`);
        const data: unknown = await response.json();
        if (!isCharacterData(data)) throw new Error("Invalid stroke data");
        return data;
      })(),
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error("Stroke data request timed out"));
          controller?.abort();
        }, KANJI_FETCH_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

/** Load validated Japanese-first stroke data, sharing requests and caching successes. */
export async function loadKanjiWriterData(character: string): Promise<CharacterData> {
  const existingRequest = inFlightLoads.get(character);
  if (existingRequest) return existingRequest;

  const loadPromise = (async () => {
    const cached = await readCachedData(character);
    if (cached) return cached;

    for (const url of getKanjiDataUrls(character)) {
      try {
        const data = await fetchKanjiData(url);
        try {
          await AsyncStorage.setItem(getCacheKey(character), JSON.stringify(data));
        } catch {
          // Playback can still work when storage is full.
        }
        return data;
      } catch {
        // Try the fallback. Never persist a network failure as unavailable.
      }
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
  return (await readCachedData(character)) !== null;
}

/** A previous offline failure must never permanently hide the stroke player. */
export async function isKanjiStrokeDataAvailable(character: string): Promise<boolean> {
  try {
    await loadKanjiWriterData(character);
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear all cached kanji writer data
 */
export async function clearKanjiWriterCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const kanjiWriterKeys = allKeys.filter((key) =>
      key.startsWith(KANJI_DATA_CACHE_PREFIX) || key.startsWith(KANJI_UNAVAILABLE_PREFIX)
    );
    await AsyncStorage.multiRemove(kanjiWriterKeys);
  } catch (error) {
    console.error("Error clearing kanji writer cache:", error);
  }
}
