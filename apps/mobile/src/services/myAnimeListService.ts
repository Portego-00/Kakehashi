import { getFromPermanentStorage, saveToPermanentStorage } from "../utils/permanentStorage";

const MAL_API_BASE_URL =
  process.env.EXPO_PUBLIC_MAL_API_BASE_URL?.trim() ||
  "https://api.myanimelist.net/v2";
const MAL_CACHE_KEY_PREFIX = "wanikani_mal_anime";
const MAL_CLIENT_ID = process.env.EXPO_PUBLIC_MAL_CLIENT_ID?.trim() ?? "";

const WATCHED_STATUSES = new Set(["watching", "completed", "rewatching"]);

interface MyAnimeListCachePayload {
  titles: string[];
  normalizedTitles: string[];
  animeIds: number[];
  entryCount?: number;
}

interface SyncResult {
  titles: string[];
  normalizedTitles: string[];
  animeIds: number[];
  entryCount: number;
}

interface CacheLookup {
  titles: string[];
  normalizedTitles: string[];
  animeIds: number[];
  dataUpdatedAt: string;
  entryCount: number;
}

let inMemoryCache: { username: string; normalizedTitles: Set<string>; animeIds: Set<number> } | null = null;

function buildCacheKey(username: string): string {
  return `${MAL_CACHE_KEY_PREFIX}_${username.toLowerCase()}`;
}

export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function collectTitles(node: any): string[] {
  if (!node) {
    return [];
  }

  const titles = new Set<string>();

  if (typeof node.title === "string") {
    titles.add(node.title);
  }

  const alternatives = node.alternative_titles ?? {};

  if (typeof alternatives.en === "string") {
    titles.add(alternatives.en);
  }

  if (typeof alternatives.ja === "string") {
    titles.add(alternatives.ja);
  }

  if (Array.isArray(alternatives.synonyms)) {
    for (const synonym of alternatives.synonyms) {
      if (typeof synonym === "string") {
        titles.add(synonym);
      }
    }
  }

  if (typeof node.title_english === "string") {
    titles.add(node.title_english);
  }

  if (typeof node.title_japanese === "string") {
    titles.add(node.title_japanese);
  }

  return Array.from(titles).filter(Boolean);
}

async function fetchWatchedAnime(username: string): Promise<SyncResult> {
  if (!MAL_CLIENT_ID) {
    throw new Error(
      "Missing MyAnimeList client id. Set EXPO_PUBLIC_MAL_CLIENT_ID."
    );
  }

  let url = `${MAL_API_BASE_URL}/users/${encodeURIComponent(
    username
  )}/animelist?limit=100&fields=list_status,alternative_titles,title,title_english,title_japanese`;

  const titles = new Set<string>();
  const normalized = new Set<string>();
  const uniqueAnimeIds = new Set<number>();

  while (url) {
    const response = await fetch(url, {
      headers: {
        "X-MAL-CLIENT-ID": MAL_CLIENT_ID,
      },
    });

    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(`MyAnimeList request failed (${response.status}): ${message}`);
    }

    const payload = await response.json();
    const entries = Array.isArray(payload?.data) ? payload.data : [];

    for (const entry of entries) {
      const status = entry?.list_status?.status;
      if (status && !WATCHED_STATUSES.has(status)) {
        continue;
      }

      const node = entry?.node;
      if (node?.id != null) {
        uniqueAnimeIds.add(node.id);
      }

      const currentTitles = collectTitles(node);
      for (const title of currentTitles) {
        const trimmed = title.trim();
        if (!trimmed) {
          continue;
        }
        titles.add(trimmed);
        const normalizedTitle = normalizeTitle(trimmed);
        if (normalizedTitle) {
          normalized.add(normalizedTitle);
        }
      }
    }

    url = typeof payload?.paging?.next === "string" ? payload.paging.next : null;
  }

  return {
    titles: Array.from(titles),
    normalizedTitles: Array.from(normalized),
    animeIds: Array.from(uniqueAnimeIds),
    entryCount: uniqueAnimeIds.size,
  };
}

async function lookupCache(username: string): Promise<CacheLookup | null> {
  // Use ignoreTTL: true so the cache doesn't expire until explicitly re-synced
  const cacheEntry = await getFromPermanentStorage<MyAnimeListCachePayload>(
    buildCacheKey(username), 
    { ignoreTTL: true }
  );
  
  if (!cacheEntry || !cacheEntry.data) {
    return null;
  }

  return {
    titles: cacheEntry.data.titles ?? [],
    normalizedTitles: cacheEntry.data.normalizedTitles ?? [],
    animeIds: cacheEntry.data.animeIds ?? [],
    dataUpdatedAt: cacheEntry.dataUpdatedAt,
    entryCount: cacheEntry.data.entryCount ?? cacheEntry.data.titles?.length ?? 0,
  };
}

export async function syncMyAnimeList(username: string): Promise<{ count: number; updatedAt: string }> {
  const trimmed = username.trim();
  if (!trimmed) {
    throw new Error("Username cannot be empty.");
  }

  const result = await fetchWatchedAnime(trimmed);
  const updatedAt = new Date().toISOString();

  await saveToPermanentStorage(buildCacheKey(trimmed), result, updatedAt);
  inMemoryCache = {
    username: trimmed.toLowerCase(),
    normalizedTitles: new Set(result.normalizedTitles),
    animeIds: new Set(result.animeIds),
  };

  return {
    count: result.entryCount,
    updatedAt,
  };
}

export async function getWatchedAnimeNormalizedTitles(username: string | null | undefined): Promise<Set<string>> {
  const trimmed = username?.trim();
  if (!trimmed) {
    return new Set();
  }

  const normalizedUsername = trimmed.toLowerCase();

  if (inMemoryCache && inMemoryCache.username === normalizedUsername) {
    return new Set(inMemoryCache.normalizedTitles);
  }

  const cached = await lookupCache(trimmed);
  if (!cached) {
    return new Set();
  }

  const normalized = new Set(cached.normalizedTitles);
  inMemoryCache = {
    username: normalizedUsername,
    normalizedTitles: normalized,
    animeIds: new Set(cached.animeIds),
  };

  return new Set(normalized);
}

export async function getMyAnimeListCacheSummary(
  username: string | null | undefined
): Promise<{ count: number; updatedAt: string } | null> {
  const trimmed = username?.trim();
  if (!trimmed) {
    return null;
  }

  const cached = await lookupCache(trimmed);
  if (!cached) {
    return null;
  }

  return {
    count: cached.entryCount,
    updatedAt: cached.dataUpdatedAt,
  };
}

export async function getWatchedAnimeIds(username: string | null | undefined): Promise<Set<number>> {
  const trimmed = username?.trim();
  if (!trimmed) {
    return new Set();
  }

  const normalizedUsername = trimmed.toLowerCase();

  if (inMemoryCache && inMemoryCache.username === normalizedUsername) {
    return new Set(inMemoryCache.animeIds);
  }

  const cached = await lookupCache(trimmed);
  if (!cached) {
    return new Set();
  }

  const animeIds = new Set(cached.animeIds);
  inMemoryCache = {
    username: normalizedUsername,
    normalizedTitles: new Set(cached.normalizedTitles),
    animeIds,
  };

  return new Set(animeIds);
}
