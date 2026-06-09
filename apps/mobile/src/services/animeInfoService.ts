/**
 * Anime Info Service
 *
 * Fetches and caches anime metadata (poster image, synopsis, score, etc.)
 * from the MyAnimeList API.  Results are persisted via MMKV permanent storage
 * so subsequent loads are instant.
 *
 * Data resolution order (fastest first):
 *   1. In-memory cache
 *   2. Preloaded data baked into the app bundle (src/data/preloadedAnimeInfo.ts)
 *   3. MMKV persistent cache (for anime fetched at runtime)
 *   4. MAL API search / fetch (only for anime not found above)
 */

import {
  getFromPermanentStorage,
  saveToPermanentStorage,
} from "../utils/permanentStorage";
import { ANIME_MAL_OVERRIDES } from "../data/animeMALMapping";
import { PRELOADED_ANIME_INFO } from "../data/preloadedAnimeInfo";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAL_API_BASE =
  process.env.EXPO_PUBLIC_MAL_API_BASE_URL?.trim() ||
  "https://api.myanimelist.net/v2";
const MAL_CLIENT_ID = process.env.EXPO_PUBLIC_MAL_CLIENT_ID?.trim() ?? "";
const CACHE_KEY = "wanikani_mal_anime_info";

/** Delay (ms) between sequential MAL API calls to respect rate limits. */
const FETCH_DELAY_MS = 400;

/** How many successful fetches before we flush the in-memory cache to disk. */
const FLUSH_INTERVAL = 10;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnimeMALInfo {
  malId: number;
  title: string;
  imageUrl: string | null;
  synopsis: string | null;
  score: number | null;
  episodes: number | null;
  mediaType: string | null;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

let memoryCache: Record<string, AnimeMALInfo> | null = null;

// ─── Cache helpers ────────────────────────────────────────────────────────────

/**
 * Load all known anime info.
 *
 * Merges three layers (later layers override earlier ones):
 *   1. Preloaded data (baked into the bundle — instant, covers most anime)
 *   2. MMKV persistent cache (runtime-fetched anime that aren't in the bundle)
 *   3. In-memory cache (already populated from a previous call this session)
 */
export async function loadAllCachedAnimeInfo(): Promise<
  Record<string, AnimeMALInfo>
> {
  if (memoryCache) return { ...memoryCache };

  // Start with the preloaded bundle data, but skip entries that have an
  // override in animeMALMapping — those need to be re-fetched with the
  // correct MAL ID so the wrong preloaded data gets replaced.
  const merged: Record<string, AnimeMALInfo> = {};
  for (const [key, value] of Object.entries(PRELOADED_ANIME_INFO)) {
    if (!ANIME_MAL_OVERRIDES[key]) {
      merged[key] = value;
    }
  }

  // Overlay with any persistent cache entries (runtime-fetched anime).
  // These take priority over preloaded data since they may contain
  // corrected entries that were re-fetched via overrides.
  try {
    const cached = await getFromPermanentStorage<
      Record<string, AnimeMALInfo>
    >(CACHE_KEY, { ignoreTTL: true });

    if (cached?.data) {
      Object.assign(merged, cached.data);
    }
  } catch (error) {
    console.warn("[AnimeInfo] Failed to load persistent cache:", error);
  }

  memoryCache = merged;

  const preloadedCount = Object.keys(PRELOADED_ANIME_INFO).length;
  const totalCount = Object.keys(merged).length;
  console.log(
    `[AnimeInfo] Loaded ${totalCount} entries (${preloadedCount} preloaded, ${
      totalCount - preloadedCount
    } from runtime cache)`
  );

  return { ...merged };
}

/** Flush the in-memory cache to persistent storage (only runtime entries). */
async function flushCache(): Promise<void> {
  if (!memoryCache) return;

  // Only persist entries that are NOT already in the preloaded bundle,
  // to keep the persistent cache small.
  const runtimeOnly: Record<string, AnimeMALInfo> = {};
  for (const [key, value] of Object.entries(memoryCache)) {
    if (!PRELOADED_ANIME_INFO[key]) {
      runtimeOnly[key] = value;
    }
  }

  if (Object.keys(runtimeOnly).length === 0) return;

  try {
    await saveToPermanentStorage(
      CACHE_KEY,
      runtimeOnly,
      new Date().toISOString()
    );
  } catch (error) {
    console.warn("[AnimeInfo] Failed to flush cache:", error);
  }
}

/**
 * Log the full merged cache as JSON so it can be copy-pasted into
 * src/data/preloadedAnimeInfo.ts to bake it into the next build.
 *
 * Call this after the batch fetch completes (or from a debug button).
 */
export function dumpCacheForPreloading(): void {
  if (!memoryCache || Object.keys(memoryCache).length === 0) {
    console.log("[AnimeInfo] Nothing to dump — cache is empty.");
    return;
  }

  console.log(
    "[AnimeInfo] Full cache dump for preloading (" +
      Object.keys(memoryCache).length +
      " entries):\n" +
      JSON.stringify(memoryCache, null, 2)
  );
}

// ─── MAL API helpers ──────────────────────────────────────────────────────────

function parseAnimeNode(node: any): AnimeMALInfo | null {
  if (!node?.id) return null;

  return {
    malId: node.id,
    title: node.title ?? "",
    imageUrl:
      node.main_picture?.medium ?? node.main_picture?.large ?? null,
    synopsis: node.synopsis ?? null,
    score: typeof node.mean === "number" ? node.mean : null,
    episodes: typeof node.num_episodes === "number" ? node.num_episodes : null,
    mediaType: node.media_type ?? null,
  };
}

/** Search MAL for an anime by title and return the first result. */
async function searchMALByTitle(
  title: string
): Promise<AnimeMALInfo | null> {
  if (!MAL_CLIENT_ID) {
    console.warn("[AnimeInfo] Missing EXPO_PUBLIC_MAL_CLIENT_ID.");
    return null;
  }

  try {
    const fields = "id,title,main_picture,synopsis,mean,num_episodes,media_type";
    const url = `${MAL_API_BASE}/anime?q=${encodeURIComponent(
      title
    )}&limit=1&fields=${fields}`;

    const response = await fetch(url, {
      headers: { "X-MAL-CLIENT-ID": MAL_CLIENT_ID },
    });

    if (!response.ok) {
      console.warn(
        `[AnimeInfo] MAL search failed (${response.status}) for: "${title}"`
      );
      return null;
    }

    const data = await response.json();
    return parseAnimeNode(data?.data?.[0]?.node);
  } catch (error) {
    console.warn("[AnimeInfo] MAL search error:", error);
    return null;
  }
}

/** Fetch anime details from MAL by its numeric ID. */
async function fetchMALById(malId: number): Promise<AnimeMALInfo | null> {
  if (!MAL_CLIENT_ID) {
    console.warn("[AnimeInfo] Missing EXPO_PUBLIC_MAL_CLIENT_ID.");
    return null;
  }

  try {
    const fields = "id,title,main_picture,synopsis,mean,num_episodes,media_type";
    const url = `${MAL_API_BASE}/anime/${malId}?fields=${fields}`;

    const response = await fetch(url, {
      headers: { "X-MAL-CLIENT-ID": MAL_CLIENT_ID },
    });

    if (!response.ok) {
      console.warn(
        `[AnimeInfo] MAL fetch failed (${response.status}) for ID: ${malId}`
      );
      return null;
    }

    const node = await response.json();
    return parseAnimeNode(node);
  } catch (error) {
    console.warn("[AnimeInfo] MAL fetch error:", error);
    return null;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetch MAL info for a single anime.
 *
 * Resolution order:
 *  1. If the IK slug has a `malId` override → fetch by ID.
 *  2. If the IK slug has a `searchTitle` override → search by that title.
 *  3. Otherwise → search by the IK display title.
 */
export async function fetchAnimeInfo(
  ikId: string,
  ikTitle: string
): Promise<AnimeMALInfo | null> {
  const override = ANIME_MAL_OVERRIDES[ikId];

  if (override?.malId) {
    return fetchMALById(override.malId);
  }

  const searchTitle = override?.searchTitle ?? ikTitle;
  return searchMALByTitle(searchTitle);
}

/**
 * Fetch MAL info for a batch of anime with progressive updates.
 *
 * - Skips anime that already exist in preloaded data or persistent cache.
 * - Calls `onUpdate` for each successful lookup so the UI can render
 *   results as they arrive.
 * - Flushes the persistent cache every {@link FLUSH_INTERVAL} items.
 * - Respects rate limits with a delay between requests.
 * - Check `signal.aborted` to cancel early (e.g. on unmount).
 * - Dumps the full cache to console when done (for preloading extraction).
 */
export async function fetchAnimeInfoBatch(
  animes: { id: string; title: string }[],
  onUpdate?: (id: string, info: AnimeMALInfo) => void,
  signal?: AbortSignal
): Promise<Record<string, AnimeMALInfo>> {
  const results: Record<string, AnimeMALInfo> = {};
  let pendingSaves = 0;

  for (const anime of animes) {
    if (signal?.aborted) break;

    try {
      const info = await fetchAnimeInfo(anime.id, anime.title);

      if (signal?.aborted) break;

      if (info) {
        results[anime.id] = info;

        // Update in-memory cache
        if (!memoryCache) memoryCache = {};
        memoryCache[anime.id] = info;

        onUpdate?.(anime.id, info);
        pendingSaves++;
      }
    } catch (error) {
      console.warn(
        `[AnimeInfo] Failed to fetch info for "${anime.id}":`,
        error
      );
    }

    // Periodically persist to disk
    if (pendingSaves >= FLUSH_INTERVAL) {
      await flushCache();
      pendingSaves = 0;
    }

    // Rate-limit delay
    if (!signal?.aborted) {
      await new Promise((resolve) => setTimeout(resolve, FETCH_DELAY_MS));
    }
  }

  // Final flush
  if (pendingSaves > 0) {
    await flushCache();
  }

  // Dump the full cache so it can be extracted for preloading
  if (Object.keys(results).length > 0) {
    dumpCacheForPreloading();
  }

  return results;
}

// ─── Display helpers ──────────────────────────────────────────────────────────

/** Human-readable media type label. */
export function formatMediaType(mediaType: string | null): string {
  if (!mediaType) return "";

  const labels: Record<string, string> = {
    tv: "TV",
    movie: "Movie",
    ova: "OVA",
    ona: "ONA",
    special: "Special",
    music: "Music",
    tv_special: "TV Special",
  };

  return labels[mediaType] ?? mediaType.toUpperCase();
}

/** Clear the persistent + in-memory anime info cache. */
export function clearAnimeInfoCache(): void {
  memoryCache = null;
}
