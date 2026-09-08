import { getCustomVocabularyAudio } from "../../../web/src/features/custom-srs/audio-manifest";

/** Explicit opt-in: never silently publish local evaluation recordings. */
export function getNativeCustomVocabularyAudio(wordId: string) {
  return getCustomVocabularyAudio(
    wordId,
    process.env.EXPO_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL,
  );
}
