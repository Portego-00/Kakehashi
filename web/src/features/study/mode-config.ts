import type { SubjectType } from "@/types/wanikani";
import { DEFAULT_STUDY_FILTERS, sanitizeStudyFilters } from "./engine";
import type { QuizModeId, StudyFilters, StudyModeId } from "./types";

export const CROSSWORD_SIZE_PRESETS = {
  small: { label: "Small", description: "Fits on screen, quick to solve", gridSize: 9, defaultMaxWords: 6, minWords: 4, maxWords: 10 },
  medium: { label: "Medium", description: "A balanced challenge", gridSize: 13, defaultMaxWords: 10, minWords: 6, maxWords: 16 },
  large: { label: "Large", description: "More words, more crossings", gridSize: 17, defaultMaxWords: 16, minWords: 10, maxWords: 24 },
} as const;

export const STROKE_LENIENCY_PRESETS = [
  { value: 0.8, label: "Very Strict" },
  { value: 1.2, label: "Strict" },
  { value: 1.8, label: "Lenient" },
  { value: 2.5, label: "Very Lenient" },
] as const;

export function activeStrokeLeniencyPreset(value: number) {
  return STROKE_LENIENCY_PRESETS.find((preset) => value <= preset.value)
    ?? STROKE_LENIENCY_PRESETS.at(-1)!;
}

export const QUIZ_MODES = new Set<StudyModeId>([
  "recent-lessons", "random-test", "vocab-reading", "hiragana-meaning", "similar-kanji", "kana-to-kanji", "listening", "context-sentences", "custom-review",
]);

export function isQuizMode(mode: StudyModeId): mode is QuizModeId {
  return QUIZ_MODES.has(mode);
}

export function fixedSubjectTypes(mode: StudyModeId): SubjectType[] | null {
  if (mode === "kana-to-kanji") return ["vocabulary"];
  if (mode === "crossword") return ["vocabulary", "kana_vocabulary"];
  if (mode === "similar-kanji" || mode === "kanji-writing") return ["kanji"];
  return null;
}

export function getModeDefaultFilters(mode: StudyModeId, maxLevel: number): StudyFilters {
  const types = fixedSubjectTypes(mode)
    ?? (mode === "vocab-reading" ? ["vocabulary", "kana_vocabulary"]
      : mode === "hiragana-meaning" || mode === "kana-wordle" ? ["vocabulary", "kana_vocabulary"]
        : mode === "listening" || mode === "context-sentences" ? ["vocabulary"]
          : [...DEFAULT_STUDY_FILTERS.subjectTypes]);
  return {
    ...DEFAULT_STUDY_FILTERS,
    count: mode === "listening" || mode === "kanji-writing" ? 10 : mode === "context-sentences" ? 15 : 20,
    subjectTypes: types,
    srsGroups: mode === "listening" || mode === "context-sentences"
      ? ["apprentice", "guru", "master", "enlightened"]
      : [...DEFAULT_STUDY_FILTERS.srsGroups],
    maxLevel,
    recentWindow: "apprentice",
    listeningSource: "anime",
    questionKinds: mode === "random-test" || mode === "custom-review" || mode === "recent-lessons" ? ["meaning", "reading"] : ["meaning"],
  };
}

export function hydrateModeFilters(mode: StudyModeId, stored: Partial<StudyFilters> | null, maxLevel: number) {
  const defaults = getModeDefaultFilters(mode, maxLevel);
  const hydrated = sanitizeStudyFilters({ ...defaults, ...stored }, maxLevel);
  const preset = CROSSWORD_SIZE_PRESETS[hydrated.crosswordSize];
  const crosswordMaxWords = Math.min(preset.maxWords, Math.max(preset.minWords, hydrated.crosswordMaxWords));
  return {
    ...hydrated,
    minLevel: hydrated.useCustomLevelRange ? hydrated.minLevel : 1,
    maxLevel: hydrated.useCustomLevelRange ? hydrated.maxLevel : maxLevel,
    crosswordMaxWords,
    similarKanjiMode: "matching" as const,
    subjectTypes: fixedSubjectTypes(mode) ?? hydrated.subjectTypes,
  };
}

export function parseSubjectIds(value: string | string[] | undefined): number[] {
  const values = Array.isArray(value) ? value : value ? value.split(",") : [];
  return [...new Set(values.flatMap((entry) => entry.split(",")).map((entry) => Number(entry.trim())).filter((id) => Number.isInteger(id) && id > 0))];
}
