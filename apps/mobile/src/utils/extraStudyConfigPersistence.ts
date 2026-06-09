import AsyncStorage from "@react-native-async-storage/async-storage";

export const EXTRA_STUDY_CONFIG_STORAGE_KEYS = {
  TEST: "extra_study_config:test",
  KANA_KANJI: "extra_study_config:kana_kanji",
  MEANING_READING: "extra_study_config:meaning_reading",
  HIRAGANA_VOCAB_MEANING: "extra_study_config:hiragana_vocab_meaning",
  LISTENING_PRACTICE: "extra_study_config:listening_practice",
  CONTEXT_SENTENCE_PRACTICE: "extra_study_config:context_sentence_practice",
  WRITING_PRACTICE: "extra_study_config:writing_practice",
  CROSSWORD: "extra_study_config:crossword",
  WORDLE: "extra_study_config:wordle",
} as const;

export async function loadExtraStudyConfig<T extends object>(
  key: string,
): Promise<Partial<T> | null> {
  try {
    const rawValue = await AsyncStorage.getItem(key);
    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
      return null;
    }

    return parsedValue as Partial<T>;
  } catch (error) {
    console.error(`Failed to load extra study config (${key})`, error);
    return null;
  }
}

export async function saveExtraStudyConfig<T>(
  key: string,
  config: T,
): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(config));
  } catch (error) {
    console.error(`Failed to persist extra study config (${key})`, error);
  }
}

export function pickBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
  step = 1,
): number {
  const numericValue =
    typeof value === "number" && !Number.isNaN(value) ? value : fallback;

  let clamped = Math.min(max, Math.max(min, Math.round(numericValue)));

  if (step > 1) {
    const snapped = min + Math.round((clamped - min) / step) * step;
    clamped = Math.min(max, Math.max(min, snapped));
  }

  return clamped;
}

export function normalizeLevelRange(
  minLevelInput: unknown,
  maxLevelInput: unknown,
  userLevelInput: number,
): { minLevel: number; maxLevel: number } {
  const maxAllowedLevel = Math.max(1, Math.round(userLevelInput));
  const minLevel = clampNumber(minLevelInput, 1, maxAllowedLevel, 1);
  const maxLevel = clampNumber(
    maxLevelInput,
    1,
    maxAllowedLevel,
    maxAllowedLevel,
  );

  return {
    minLevel: Math.min(minLevel, maxLevel),
    maxLevel: Math.max(maxLevel, minLevel),
  };
}
