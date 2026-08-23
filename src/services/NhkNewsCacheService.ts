import { Directory, File, Paths } from "expo-file-system";
import {
  type NewsItem,
  type NewsSource,
  type NewsSourcePreference,
  normalizeCachedNewsItems,
  sourcesForPreference,
} from "./NhkNewsService";

const LEGACY_NEWS_CACHE_FILE = "news-cache.json";
const MAX_CACHED_NEWS = 20;

function getSourceCacheFileName(source: NewsSource): string {
  return `news-cache-${source}.json`;
}

export async function readCachedNewsForSource(
  source: NewsSource,
): Promise<NewsItem[]> {
  const cacheDir = new Directory(Paths.cache, "news");
  cacheDir.create({ idempotent: true });

  const sourceCacheFile = new File(cacheDir, getSourceCacheFileName(source));
  let cacheFile = sourceCacheFile;

  if (!sourceCacheFile.exists && source === "easy") {
    const legacyCacheFile = new File(cacheDir, LEGACY_NEWS_CACHE_FILE);
    if (legacyCacheFile.exists) {
      cacheFile = legacyCacheFile;
    }
  }

  if (!cacheFile.exists) return [];

  const content = await cacheFile.text();
  return normalizeCachedNewsItems(JSON.parse(content), source);
}

export async function readCachedNews(
  preference: NewsSourcePreference,
): Promise<NewsItem[]> {
  const cachedBySource = await Promise.allSettled(
    sourcesForPreference(preference).map(readCachedNewsForSource),
  );

  return cachedBySource
    .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
    .sort(
      (a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0),
    );
}

export async function saveNewsToCache(
  items: readonly NewsItem[],
): Promise<void> {
  const cacheDir = new Directory(Paths.cache, "news");
  cacheDir.create({ idempotent: true });

  for (const source of ["easy", "regular"] as const) {
    const sourceItems = items
      .filter((item) => item.source === source)
      .slice(0, MAX_CACHED_NEWS);

    // Preserve a previous offline cache when one provider temporarily fails.
    if (sourceItems.length === 0) continue;

    const cacheFile = new File(cacheDir, getSourceCacheFileName(source));
    cacheFile.write(JSON.stringify(sourceItems, null, 2));
  }
}

export function preserveCachedFullArticles(
  freshItems: readonly NewsItem[],
  cachedItems: readonly NewsItem[],
): NewsItem[] {
  const cachedFullItemsById = new Map(
    cachedItems
      .filter((item) => item.isFullArticle === true)
      .map((item) => [item.id, item]),
  );

  return freshItems.map((freshItem) => {
    if (freshItem.isFullArticle !== false) return freshItem;

    const cachedFullItem = cachedFullItemsById.get(freshItem.id);
    if (!cachedFullItem) return freshItem;

    return {
      ...cachedFullItem,
      ...freshItem,
      imageUrl: freshItem.imageUrl ?? cachedFullItem.imageUrl,
      audioUrl: freshItem.audioUrl ?? cachedFullItem.audioUrl,
      contentHtml: cachedFullItem.contentHtml,
      isFullArticle: true,
    };
  });
}
