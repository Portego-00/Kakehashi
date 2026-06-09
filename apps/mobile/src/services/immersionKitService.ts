/**
 * ImmersionKit API Service
 * Fetches example sentences from anime, dramas, games, literature, and news
 */

import {
  getWatchedAnimeNormalizedTitles,
  normalizeTitle as normalizeAnimeTitle,
} from "./myAnimeListService";
import { getSubjectTypeColor } from "../utils/subjectColors";

export interface ImmersionKitSentence {
  id: string;
  sentence: string;
  translation: string;
  title: string; // Source title (e.g., "death_note", "your_name")
  sound?: string; // Audio filename (not full URL)
  image?: string; // Screenshot filename
  sentence_with_furigana?: string;
  word_list?: string[];
  matched_indexes?: number[];
  // Category is derived from the ID prefix
  category?: "anime" | "drama" | "games" | "literature" | "news";
  // Full media URLs (added by our service)
  audio?: string;
  imageUrl?: string;
}

export interface ImmersionKitResponse {
  examples: ImmersionKitSentence[];
  category_count?: Record<string, number>;
  deck_count?: Record<string, Record<string, number>>;
  locale?: string;
  dictionary_entries?: any[];
  exactMatch?: boolean;
}

const API_BASE_URL = "https://apiv2.immersionkit.com";
const MEDIA_BASE_URL =
  "https://us-southeast-1.linodeobjects.com/immersionkit/media";

// Cache for index metadata (maps title slugs to folder names)
let indexMetaCache: Map<string, { title: string; category: string }> | null =
  null;

/**
 * Fetch and cache the index metadata from ImmersionKit
 */
async function getIndexMeta(): Promise<
  Map<string, { title: string; category: string }>
> {
  if (indexMetaCache) {
    return indexMetaCache;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/index_meta`);
    if (!response.ok) {
      console.warn("[ImmersionKit] Failed to fetch index_meta");
      return new Map();
    }

    const result = await response.json();
    const index = result.data || {};

    // Build a map from title slug to folder info
    const map = new Map<string, { title: string; category: string }>();
    for (const key of Object.keys(index)) {
      const { title, category } = index[key];
      // The API response uses snake_case as keys, but title is the actual folder name
      map.set(key, { title, category });
    }

    indexMetaCache = map;
    console.log(
      `[ImmersionKit] Loaded ${map.size} deck mappings from index_meta`
    );
    return map;
  } catch (error) {
    console.error("[ImmersionKit] Error fetching index_meta:", error);
    return new Map();
  }
}

/**
 * Get all available anime from ImmersionKit
 */
export async function getAvailableAnimes(): Promise<
  { id: string; title: string }[]
> {
  const indexMeta = await getIndexMeta();
  const animes: { id: string; title: string }[] = [];

  // List of anime to exclude
  const excludedAnimes = ["hunter_x_hunter"];

  indexMeta.forEach((value, key) => {
    if (value.category === "anime" && !excludedAnimes.includes(key)) {
      animes.push({
        id: key,
        title: value.title || key,
      });
    }
  });

  return animes.sort((a, b) => a.title.localeCompare(b.title));
}

/**
 * Search for example sentences for a given word/phrase with intelligent pagination
 */
export async function searchImmersionKit(
  query: string,
  options: {
    exactMatch?: boolean;
    category?: "anime" | "drama" | "games" | "literature" | "news";
    limit?: number;
    myAnimeListUsername?: string | null;
    selectedAnimes?: string[] | null;
    userLevel?: number;
    skip?: number;
  } = {}
): Promise<{ results: ImmersionKitSentence[]; nextOffset: number }> {
  try {
    const {
      exactMatch = true,
      category,
      limit: maxResults = 10,
      myAnimeListUsername,
      selectedAnimes,
      userLevel,
      skip = 0,
    } = options;

    if (maxResults <= 0) {
      return { results: [], nextOffset: skip };
    }

    // Fetch index_meta to get proper folder names
    const indexMeta = await getIndexMeta();

    const shouldFilterByWatchedCategory = !category || category === "anime";
    // Filter if manual selection exists OR if MAL username exists
    const hasManualSelection = selectedAnimes && selectedAnimes.length > 0;
    const hasMalSelection = !!myAnimeListUsername;
    const shouldFilterByWatched =
      shouldFilterByWatchedCategory && (hasManualSelection || hasMalSelection);

    // When filtering by watched anime, we need to fetch more results iteratively
    // to ensure we get enough matches after filtering
    const MAX_TOTAL_FETCH = 200; // Maximum total results to fetch (prevents infinite loops)
    const BATCH_SIZE = 50; // Fetch 50 results at a time

    let allFilteredResults: ImmersionKitSentence[] = [];
    let offset = skip;
    let totalFetched = 0;

    // Load watched anime set once if needed (only if no manual selection and we have MAL username)
    const watchedAnimeSet =
      shouldFilterByWatched && !hasManualSelection && hasMalSelection
        ? await getWatchedAnimeNormalizedTitles(myAnimeListUsername)
        : null;

    // Set of manually selected anime IDs
    const manualAnimeSet = hasManualSelection ? new Set(selectedAnimes) : null;

    // If filtering by watched anime but no watch list (and no manual selection), fall back to simple fetch
    const effectiveShouldFilter =
      shouldFilterByWatched &&
      ((manualAnimeSet && manualAnimeSet.size > 0) ||
        (watchedAnimeSet && watchedAnimeSet.size > 0));

    // Process query to remove leading "〜" (which indicates a suffix/particle)
    // This allows exact matching to work correctly
    const searchQuery = query.startsWith("〜") ? query.slice(1) : query;

    // Keep fetching batches until we have enough results or hit the limit
    while (
      allFilteredResults.length < maxResults &&
      totalFetched < MAX_TOTAL_FETCH
    ) {
      // Build URL with proper encoding and offset for pagination
      const url = `${API_BASE_URL}/search?q=${encodeURIComponent(
        searchQuery
      )}&exactMatch=${exactMatch}&limit=${BATCH_SIZE}&offset=${offset}`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          throw new Error(
            "RATE_LIMIT:You've made too many requests to ImmersionKit. Please wait a few minutes before trying again."
          );
        }
        console.warn(
          `[ImmersionKit] API error: ${response.status} ${response.statusText}`
        );
        break;
      }

      const result: ImmersionKitResponse = await response.json();

      if (
        !result.examples ||
        !Array.isArray(result.examples) ||
        result.examples.length === 0
      ) {
        // No more results available
        break;
      }

      // Process sentences: add category based on ID prefix and build proper media URLs
      const sentences = result.examples.map((sentence) => {
        // Extract category from ID prefix (e.g., "anime_death_note_..." -> "anime")
        const categoryMatch = sentence.id.match(
          /^(anime|drama|games|literature|news)_/
        );
        const sentenceCategory = categoryMatch
          ? (categoryMatch[1] as ImmersionKitSentence["category"])
          : undefined;

        // Build proper Linode Object Storage URLs using index_meta
        // Format: https://us-southeast-1.linodeobjects.com/immersionkit/media/{category}/{FolderName}/media/{filename}
        let audio: string | undefined;
        let imageUrl: string | undefined;

        if (sentenceCategory && sentence.title) {
          // Look up the actual folder name from index_meta
          const meta = indexMeta.get(sentence.title);
          const folderName = meta?.title || sentence.title;

          // URL encode the folder name (spaces become %20, etc.)
          const encodedFolderName = encodeURIComponent(folderName);
          const mediaBase = `${MEDIA_BASE_URL}/${sentenceCategory}/${encodedFolderName}/media`;

          if (sentence.sound) {
            const encodedSound = encodeURIComponent(sentence.sound);
            audio = `${mediaBase}/${encodedSound}`;
          }

          if (sentence.image) {
            const encodedImage = encodeURIComponent(sentence.image);
            imageUrl = `${mediaBase}/${encodedImage}`;
          }
        }

        return {
          ...sentence,
          category: sentenceCategory,
          audio,
          imageUrl,
        };
      });

      // Apply category filter
      const categoryFiltered = category
        ? sentences.filter((sentence) => sentence.category === category)
        : sentences;

      // Apply watched anime filter if needed
      const filteredBatch = effectiveShouldFilter
        ? categoryFiltered.filter((sentence) => {
            if (sentence.category !== "anime") {
              return true;
            }

            // If manual selection is active, check against it
            if (manualAnimeSet) {
              return manualAnimeSet.has(sentence.title);
            }

            // Fallback to MAL matching
            const meta = indexMeta.get(sentence.title);
            const candidates = new Set<string>();

            if (sentence.title) {
              candidates.add(sentence.title);
            }

            if (meta?.title) {
              candidates.add(meta.title);
            }

            for (const candidate of candidates) {
              const normalized = normalizeAnimeTitle(candidate);
              if (normalized && watchedAnimeSet!.has(normalized)) {
                return true;
              }
            }

            return false;
          })
        : categoryFiltered;

      // Add filtered results to our collection
      allFilteredResults.push(...filteredBatch);

      totalFetched += result.examples.length;
      offset += BATCH_SIZE;

      // If we got fewer results than BATCH_SIZE, we've reached the end
      if (result.examples.length < BATCH_SIZE) {
        break;
      }

      // If not filtering, we can stop after first batch since all results are valid
      if (!effectiveShouldFilter) {
        break;
      }
    }

    // If filtering by watched anime and got no results, try again without the filter
    // Only do this if we are using auto-detection (MAL), not if manual selection is explicit
    if (
      effectiveShouldFilter &&
      !hasManualSelection &&
      allFilteredResults.length === 0
    ) {
      console.log(
        "[ImmersionKit] No anime matches user watch list, falling back to full results."
      );
      // Make one more simple fetch without filtering
      const url = `${API_BASE_URL}/search?q=${encodeURIComponent(
        searchQuery
      )}&exactMatch=${exactMatch}&limit=${maxResults * 2}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok && response.status === 429) {
        throw new Error(
          "RATE_LIMIT:You've made too many requests to ImmersionKit. Please wait a few minutes before trying again."
        );
      }

      if (response.ok) {
        const result: ImmersionKitResponse = await response.json();
        if (result.examples && Array.isArray(result.examples)) {
          allFilteredResults = result.examples.map((sentence) => {
            const categoryMatch = sentence.id.match(
              /^(anime|drama|games|literature|news)_/
            );
            const sentenceCategory = categoryMatch
              ? (categoryMatch[1] as ImmersionKitSentence["category"])
              : undefined;

            let audio: string | undefined;
            let imageUrl: string | undefined;

            if (sentenceCategory && sentence.title) {
              const meta = indexMeta.get(sentence.title);
              const folderName = meta?.title || sentence.title;
              const encodedFolderName = encodeURIComponent(folderName);
              const mediaBase = `${MEDIA_BASE_URL}/${sentenceCategory}/${encodedFolderName}/media`;

              if (sentence.sound) {
                const encodedSound = encodeURIComponent(sentence.sound);
                audio = `${mediaBase}/${encodedSound}`;
              }

              if (sentence.image) {
                const encodedImage = encodeURIComponent(sentence.image);
                imageUrl = `${mediaBase}/${encodedImage}`;
              }
            }

            return {
              ...sentence,
              category: sentenceCategory,
              audio,
              imageUrl,
            };
          });

          if (category) {
            allFilteredResults = allFilteredResults.filter(
              (sentence) => sentence.category === category
            );
          }
        }
      }
    }

    // Apply level-based filtering if userLevel is provided
    // This helps match sentence complexity to user's WaniKani level
    let levelFilteredResults = allFilteredResults;
    if (userLevel !== undefined && userLevel > 0) {
      // Define max sentence length based on user level
      // Lower levels get simpler (shorter) sentences
      // Higher levels can handle more complex (longer) sentences
      let maxSentenceLength: number;
      if (userLevel <= 10) {
        maxSentenceLength = 40; // Beginner: very short sentences
      } else if (userLevel <= 20) {
        maxSentenceLength = 50; // Early intermediate: short sentences
      } else if (userLevel <= 30) {
        maxSentenceLength = 60; // Intermediate: medium sentences
      } else if (userLevel <= 40) {
        maxSentenceLength = 70; // Upper intermediate: longer sentences
      } else {
        maxSentenceLength = 80; // Advanced: even longer sentences
      }

      // Filter sentences by length and prioritize those within the level-appropriate range
      const withinLevelRange = allFilteredResults.filter(
        (sentence) =>
          sentence.sentence && sentence.sentence.length <= maxSentenceLength
      );

      // If we have enough sentences within the level range, use those
      // Otherwise, keep all results (better to show something than nothing)
      if (withinLevelRange.length >= maxResults) {
        levelFilteredResults = withinLevelRange;
        console.log(
          `[ImmersionKit] Filtered to ${levelFilteredResults.length} sentences appropriate for level ${userLevel} (max length: ${maxSentenceLength})`
        );
      } else if (withinLevelRange.length > 0) {
        // We have some appropriate sentences, but not enough
        // Combine them with others, prioritizing the appropriate ones
        const remaining = allFilteredResults.filter(
          (sentence) =>
            !sentence.sentence || sentence.sentence.length > maxSentenceLength
        );
        levelFilteredResults = [...withinLevelRange, ...remaining];
        console.log(
          `[ImmersionKit] Mixed results: ${withinLevelRange.length} within level range, ${remaining.length} above (level ${userLevel})`
        );
      } else {
        console.log(
          `[ImmersionKit] No sentences within level ${userLevel} range (max length: ${maxSentenceLength}), showing all results`
        );
      }
    }

    // Sort by sentence length (shorter sentences first)
    const sortedSentences = levelFilteredResults.sort((a, b) => {
      const aLength = a.sentence ? a.sentence.length : Number.MAX_SAFE_INTEGER;
      const bLength = b.sentence ? b.sentence.length : Number.MAX_SAFE_INTEGER;
      return aLength - bLength;
    });

    // Limit to requested number of results
    const limitedSentences = sortedSentences.slice(0, maxResults);

    console.log(
      `[ImmersionKit] Found ${
        limitedSentences.length
      } examples for "${query}" (fetched ${totalFetched} total, filtered to ${
        allFilteredResults.length
      }${
        userLevel ? `, level-filtered to ${levelFilteredResults.length}` : ""
      })`
    );

    // Debug: Log first example's media URLs
    if (limitedSentences.length > 0 && limitedSentences[0]) {
      const first = limitedSentences[0];
      const meta = indexMeta.get(first.title);
      console.log("[ImmersionKit] Sample mapping:");
      console.log("  Title slug:", first.title);
      console.log("  Folder name:", meta?.title || "not found");
      console.log("  Image URL:", first.imageUrl || "none");
      console.log("  Audio URL:", first.audio || "none");
      if (userLevel) {
        console.log("  User level:", userLevel);
        console.log("  Sentence length:", first.sentence?.length || 0);
      }
    }

    return { results: limitedSentences, nextOffset: offset };
  } catch (error) {
    console.error("[ImmersionKit] Error fetching:", error);
    if (error instanceof Error) {
      console.error("[ImmersionKit] Error message:", error.message);
      console.error("[ImmersionKit] Error stack:", error.stack);
    }
    return { results: [], nextOffset: 0 };
  }
}

/**
 * Get category display name
 */
export function getCategoryDisplayName(category: string): string {
  const categoryMap: Record<string, string> = {
    anime: "Anime",
    drama: "Drama",
    games: "Games",
    literature: "Literature",
    news: "News",
  };
  return categoryMap[category] || category;
}

/**
 * Get category color for UI
 */
export function getCategoryColor(category: string): string {
  const colorMap: Record<string, string> = {
    anime: "#FF6B9D",
    drama: "#C44569",
    games: "#4834DF",
    literature: "#6C5CE7",
    news: "#00B894",
  };
  return colorMap[category] || getSubjectTypeColor("vocabulary");
}
