import { getFromPermanentStorage, saveToPermanentStorage } from "../utils/permanentStorage";

const ANILIST_API_URL = "https://graphql.anilist.co";
const ANILIST_CACHE_KEY_PREFIX = "wanikani_anilist_anime";

const WATCHED_STATUSES = new Set(["CURRENT", "COMPLETED", "REPEATING"]);

interface AniListCachePayload {
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
  return `${ANILIST_CACHE_KEY_PREFIX}_${username.toLowerCase()}`;
}

export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function collectTitles(media: any): string[] {
  if (!media) {
    return [];
  }

  const titles = new Set<string>();
  const titleObj = media.title ?? {};

  if (typeof titleObj.romaji === "string" && titleObj.romaji) {
    titles.add(titleObj.romaji);
  }
  if (typeof titleObj.english === "string" && titleObj.english) {
    titles.add(titleObj.english);
  }
  if (typeof titleObj.native === "string" && titleObj.native) {
    titles.add(titleObj.native);
  }

  // AniList also has synonyms
  if (Array.isArray(media.synonyms)) {
    for (const synonym of media.synonyms) {
      if (typeof synonym === "string" && synonym) {
        titles.add(synonym);
      }
    }
  }

  return Array.from(titles).filter(Boolean);
}

const ANILIST_QUERY = `
query ($userName: String) {
  MediaListCollection(userName: $userName, type: ANIME) {
    lists {
      status
      entries {
        mediaId
        status
        media {
          id
          title {
            romaji
            english
            native
          }
          synonyms
        }
      }
    }
  }
}
`;

async function fetchWatchedAnime(username: string): Promise<SyncResult> {
  const response = await fetch(ANILIST_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      query: ANILIST_QUERY,
      variables: { userName: username },
    }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`AniList request failed (${response.status}): ${message}`);
  }

  const payload = await response.json();

  if (payload.errors && payload.errors.length > 0) {
    const errorMessage = payload.errors[0]?.message ?? "Unknown AniList error";
    throw new Error(`AniList API error: ${errorMessage}`);
  }

  const lists = payload?.data?.MediaListCollection?.lists ?? [];

  const titles = new Set<string>();
  const normalized = new Set<string>();
  const uniqueAnimeIds = new Set<number>();

  for (const list of lists) {
    const entries = Array.isArray(list?.entries) ? list.entries : [];

    for (const entry of entries) {
      const status = entry?.status;
      if (status && !WATCHED_STATUSES.has(status)) {
        continue;
      }

      const media = entry?.media;
      if (media?.id != null) {
        uniqueAnimeIds.add(media.id);
      }

      const currentTitles = collectTitles(media);
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
  }

  return {
    titles: Array.from(titles),
    normalizedTitles: Array.from(normalized),
    animeIds: Array.from(uniqueAnimeIds),
    entryCount: uniqueAnimeIds.size,
  };
}

async function lookupCache(username: string): Promise<CacheLookup | null> {
  const cacheEntry = await getFromPermanentStorage<AniListCachePayload>(
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

export async function syncAniList(username: string): Promise<{ count: number; updatedAt: string }> {
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

export async function getWatchedAniListNormalizedTitles(username: string | null | undefined): Promise<Set<string>> {
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

export async function getAniListCacheSummary(
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

export async function getWatchedAniListIds(username: string | null | undefined): Promise<Set<number>> {
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
