import { getJapaneseTextStats, normalizeJapaneseSearchQuery } from "../japanese";

export type SearchMode = "subjects" | "text";

export type SearchQueryState = {
  rawQuery: string;
  normalizedQuery: string;
  mode: SearchMode;
  hasJapanese: boolean;
};

export function createSearchQueryState(rawQuery: string): SearchQueryState {
  const normalizedQuery = normalizeJapaneseSearchQuery(rawQuery);
  const stats = getJapaneseTextStats(normalizedQuery);

  return {
    rawQuery,
    normalizedQuery,
    mode: stats.hasJapanese ? "text" : "subjects",
    hasJapanese: stats.hasJapanese,
  };
}
