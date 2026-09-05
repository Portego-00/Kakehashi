import type { WaniKaniItemType } from "../types/wanikani";
import { JLPT_LEVELS, type JLPTLevel } from "./jlptClassification";

const CUSTOM_REVIEW_FILTER_CONFIG_VERSION = 1 as const;
const CUSTOM_REVIEW_ITEM_TYPES: readonly WaniKaniItemType[] = [
  "radical",
  "kanji",
  "vocabulary",
  "kana_vocabulary",
];
const CUSTOM_REVIEW_SRS_STAGES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export interface CustomReviewFilterState {
  minLevel: number;
  maxLevel: number;
  types: Set<WaniKaniItemType>;
  srsStages: Set<number>;
  jlptLevels: Set<JLPTLevel>;
  maxFrequencyRank: number | null;
}

export interface PersistedCustomReviewFilters {
  version: typeof CUSTOM_REVIEW_FILTER_CONFIG_VERSION;
  minLevel: number;
  maxLevel: number;
  types: WaniKaniItemType[];
  srsStages: number[];
  jlptLevels: JLPTLevel[];
  maxFrequencyRank: number | null;
}

function sanitizeLevel(value: unknown, fallback: number): number {
  const numericValue =
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(60, Math.max(1, Math.round(numericValue)));
}

function sanitizeSet<T>(
  value: unknown,
  allowedValues: readonly T[],
  fallback: ReadonlySet<T>,
): Set<T> {
  if (!Array.isArray(value)) {
    return new Set(fallback);
  }

  const requestedValues = new Set(value);
  const validValues = allowedValues.filter((candidate) =>
    requestedValues.has(candidate),
  );

  // An empty array is a valid choice. A non-empty array containing no known
  // values is corrupt, so retain the safe fallback instead of matching nothing.
  if (value.length > 0 && validValues.length === 0) {
    return new Set(fallback);
  }

  return new Set(validValues);
}

export function serializeCustomReviewFilters(
  filters: Omit<
    CustomReviewFilterState,
    "types" | "srsStages" | "jlptLevels"
  > & {
    types: ReadonlySet<WaniKaniItemType>;
    srsStages: ReadonlySet<number>;
    jlptLevels: ReadonlySet<JLPTLevel>;
  },
): PersistedCustomReviewFilters {
  return {
    version: CUSTOM_REVIEW_FILTER_CONFIG_VERSION,
    minLevel: filters.minLevel,
    maxLevel: filters.maxLevel,
    types: CUSTOM_REVIEW_ITEM_TYPES.filter((type) => filters.types.has(type)),
    srsStages: CUSTOM_REVIEW_SRS_STAGES.filter((stage) =>
      filters.srsStages.has(stage),
    ),
    jlptLevels: JLPT_LEVELS.filter((level) => filters.jlptLevels.has(level)),
    maxFrequencyRank: filters.maxFrequencyRank,
  };
}

export function restoreCustomReviewFilters(
  stored: Partial<PersistedCustomReviewFilters>,
  fallback: CustomReviewFilterState,
): CustomReviewFilterState | null {
  if (stored.version !== CUSTOM_REVIEW_FILTER_CONFIG_VERSION) {
    return null;
  }

  const firstLevel = sanitizeLevel(stored.minLevel, fallback.minLevel);
  const secondLevel = sanitizeLevel(stored.maxLevel, fallback.maxLevel);
  const storedFrequencyRank = stored.maxFrequencyRank;
  const maxFrequencyRank =
    storedFrequencyRank === null
      ? null
      : typeof storedFrequencyRank === "number" &&
          Number.isSafeInteger(storedFrequencyRank) &&
          storedFrequencyRank > 0
        ? storedFrequencyRank
        : fallback.maxFrequencyRank;

  return {
    minLevel: Math.min(firstLevel, secondLevel),
    maxLevel: Math.max(firstLevel, secondLevel),
    types: sanitizeSet(stored.types, CUSTOM_REVIEW_ITEM_TYPES, fallback.types),
    srsStages: sanitizeSet(
      stored.srsStages,
      CUSTOM_REVIEW_SRS_STAGES,
      fallback.srsStages,
    ),
    jlptLevels: sanitizeSet(
      stored.jlptLevels,
      JLPT_LEVELS,
      fallback.jlptLevels,
    ),
    maxFrequencyRank,
  };
}
