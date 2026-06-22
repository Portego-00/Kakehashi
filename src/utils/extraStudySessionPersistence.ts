import AsyncStorage from "@react-native-async-storage/async-storage";

export const EXTRA_STUDY_SESSION_STORAGE_KEYS = {
  CUSTOM_REVIEW: "extra_study_session:custom_review",
  MEANING_READING: "extra_study_session:meaning_reading",
  HIRAGANA_VOCAB_MEANING: "extra_study_session:hiragana_vocab_meaning",
  SIMILAR_KANJI: "extra_study_session:similar_kanji",
  RANDOM_TEST: "extra_study_session:random_test",
  LISTENING_PRACTICE: "extra_study_session:listening_practice",
  CONTEXT_SENTENCE_PRACTICE: "extra_study_session:context_sentence_practice",
  KANA_KANJI: "extra_study_session:kana_kanji",
  WRITING_PRACTICE: "extra_study_session:writing_practice",
  CROSSWORD: "extra_study_session:crossword",
  WORDLE: "extra_study_session:wordle",
} as const;

export async function loadExtraStudySessionState<T extends object>(
  key: string,
): Promise<T | null> {
  try {
    const rawValue = await AsyncStorage.getItem(key);
    if (!rawValue) {
      return null;
    }

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== "object" || Array.isArray(parsedValue)) {
      return null;
    }

    return parsedValue as T;
  } catch (error) {
    console.error(`Failed to load extra study session state (${key})`, error);
    return null;
  }
}

export async function saveExtraStudySessionState<T extends object>(
  key: string,
  payload: T,
): Promise<boolean> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(payload));
    return true;
  } catch (error) {
    console.error(`Failed to save extra study session state (${key})`, error);
    return false;
  }
}

export async function clearExtraStudySessionState(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch (error) {
    console.error(`Failed to clear extra study session state (${key})`, error);
  }
}

export async function hasExtraStudySessionState(key: string): Promise<boolean> {
  try {
    const rawValue = await AsyncStorage.getItem(key);
    return typeof rawValue === "string" && rawValue.length > 0;
  } catch (error) {
    console.error(`Failed to inspect extra study session state (${key})`, error);
    return false;
  }
}
