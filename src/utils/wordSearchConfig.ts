import {
  clampNumber,
  normalizeLevelRange,
  pickBoolean,
} from "./extraStudyConfigPersistence";
import { parseSelectedListIds } from "./extraStudySubjectLists";
import type { WordSearchDirection } from "./wordSearchGenerator";

export type WordSearchConfig = {
  direction: WordSearchDirection;
  wordCount: number;
  srsGroups: {
    apprentice: boolean;
    guru: boolean;
    master: boolean;
    enlightened: boolean;
    burned: boolean;
  };
  useCustomLevelRange: boolean;
  minLevel: number;
  maxLevel: number;
  selectedListIds: string[];
};

export const WORD_SEARCH_WORD_COUNTS = [6, 8, 10] as const;

export function createDefaultWordSearchConfig(
  userLevel: number,
): WordSearchConfig {
  return {
    direction: "kanji-to-kana",
    wordCount: 8,
    srsGroups: {
      apprentice: true,
      guru: true,
      master: true,
      enlightened: true,
      burned: true,
    },
    useCustomLevelRange: false,
    minLevel: 1,
    maxLevel: Math.max(1, Math.round(userLevel)),
    selectedListIds: [],
  };
}

export function sanitizeWordSearchConfig(
  rawConfig: Partial<WordSearchConfig>,
  userLevel: number,
): WordSearchConfig {
  const defaults = createDefaultWordSearchConfig(userLevel);
  const srsGroups = rawConfig.srsGroups ?? defaults.srsGroups;
  const { minLevel, maxLevel } = normalizeLevelRange(
    rawConfig.minLevel,
    rawConfig.maxLevel,
    userLevel,
  );
  const rawWordCount = clampNumber(
    rawConfig.wordCount,
    WORD_SEARCH_WORD_COUNTS[0],
    WORD_SEARCH_WORD_COUNTS[WORD_SEARCH_WORD_COUNTS.length - 1],
    defaults.wordCount,
  );
  const wordCount = WORD_SEARCH_WORD_COUNTS.reduce((nearest, option) =>
    Math.abs(option - rawWordCount) < Math.abs(nearest - rawWordCount)
      ? option
      : nearest,
  );

  return {
    direction:
      rawConfig.direction === "kana-to-kanji"
        ? "kana-to-kanji"
        : "kanji-to-kana",
    wordCount,
    srsGroups: {
      apprentice: pickBoolean(
        srsGroups.apprentice,
        defaults.srsGroups.apprentice,
      ),
      guru: pickBoolean(srsGroups.guru, defaults.srsGroups.guru),
      master: pickBoolean(srsGroups.master, defaults.srsGroups.master),
      enlightened: pickBoolean(
        srsGroups.enlightened,
        defaults.srsGroups.enlightened,
      ),
      burned: pickBoolean(srsGroups.burned, defaults.srsGroups.burned),
    },
    useCustomLevelRange: pickBoolean(
      rawConfig.useCustomLevelRange,
      defaults.useCustomLevelRange,
    ),
    minLevel,
    maxLevel,
    selectedListIds: parseSelectedListIds(rawConfig.selectedListIds),
  };
}

export function getWordSearchAllowedSrsStages(
  config: WordSearchConfig,
): Set<number> {
  const stages = new Set<number>();
  if (config.srsGroups.apprentice) {
    [1, 2, 3, 4].forEach((stage) => stages.add(stage));
  }
  if (config.srsGroups.guru) {
    [5, 6].forEach((stage) => stages.add(stage));
  }
  if (config.srsGroups.master) {
    stages.add(7);
  }
  if (config.srsGroups.enlightened) {
    stages.add(8);
  }
  if (config.srsGroups.burned) {
    stages.add(9);
  }
  return stages;
}

export function getWordSearchGridSize(wordCount: number): number {
  return wordCount <= 6 ? 8 : 10;
}
