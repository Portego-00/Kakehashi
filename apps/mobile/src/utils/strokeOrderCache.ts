import AsyncStorage from "@react-native-async-storage/async-storage";

const STROKE_ORDER_CACHE_PREFIX = "stroke_order_";

/**
 * Get the cache key for a kanji character
 */
function getCacheKey(character: string): string {
  const unicode = character.codePointAt(0)?.toString(16).padStart(5, "0");
  return `${STROKE_ORDER_CACHE_PREFIX}${unicode}`;
}

/**
 * Get KanjiVG URL for a character
 */
function getKanjiVGUrl(character: string): string {
  const unicode = character.codePointAt(0)?.toString(16).padStart(5, "0");
  return `https://kanjivg.tagaini.net/kanjivg/kanji/${unicode}.svg`;
}

/**
 * Fetch and cache stroke order SVG data for a kanji character
 */
export async function getStrokeOrderSvg(
  character: string
): Promise<string | null> {
  const cacheKey = getCacheKey(character);

  // Check cache first
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      return cached;
    }
  } catch (error) {
    console.warn("Error reading stroke order cache:", error);
  }

  // Fetch from KanjiVG
  try {
    const url = getKanjiVGUrl(character);
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(
        `Failed to fetch stroke order for ${character}: ${response.status}`
      );
      return null;
    }

    const svg = await response.text();

    // Cache the result
    try {
      await AsyncStorage.setItem(cacheKey, svg);
    } catch (cacheError) {
      console.warn("Error caching stroke order:", cacheError);
    }

    return svg;
  } catch (error) {
    console.error("Error fetching stroke order SVG:", error);
    return null;
  }
}

/**
 * Parse stroke paths from KanjiVG SVG data
 * KanjiVG strokes have IDs like "kvg:xxxxx-sN" where N is the stroke number
 */
export function parseStrokePaths(svgData: string): string[] {
  const paths: string[] = [];

  // Match path elements with stroke IDs (kvg:xxxxx-sN pattern)
  const pathRegex = /<path[^>]*id="kvg:[^"]*-s(\d+)"[^>]*d="([^"]+)"[^>]*\/>/g;
  let match;

  const pathMap: Map<number, string> = new Map();

  while ((match = pathRegex.exec(svgData)) !== null) {
    const strokeNumber = parseInt(match[1], 10);
    const pathData = match[2];
    pathMap.set(strokeNumber, pathData);
  }

  // Sort by stroke number and return in order
  const sortedNumbers = Array.from(pathMap.keys()).sort((a, b) => a - b);
  for (const num of sortedNumbers) {
    const path = pathMap.get(num);
    if (path) {
      paths.push(path);
    }
  }

  return paths;
}

/**
 * Extract viewBox from SVG data
 */
export function extractViewBox(svgData: string): string {
  const viewBoxMatch = svgData.match(/viewBox="([^"]+)"/);
  return viewBoxMatch ? viewBoxMatch[1] : "0 0 109 109";
}

/**
 * Clear all cached stroke order data
 */
export async function clearStrokeOrderCache(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const strokeOrderKeys = allKeys.filter((key) =>
      key.startsWith(STROKE_ORDER_CACHE_PREFIX)
    );
    await AsyncStorage.multiRemove(strokeOrderKeys);
  } catch (error) {
    console.error("Error clearing stroke order cache:", error);
  }
}
