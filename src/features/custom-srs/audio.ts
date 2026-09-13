import { CUSTOM_VOCABULARY_AUDIO_PUBLIC_ORIGIN, getCustomVocabularyAudio } from "../../../web/src/features/custom-srs/audio-manifest";

/** Only verified published entries can play; the optional origin override needs no credentials. */
export function getNativeCustomVocabularyAudio(wordId: string) {
  return getCustomVocabularyAudio(
    wordId,
    process.env.EXPO_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL || CUSTOM_VOCABULARY_AUDIO_PUBLIC_ORIGIN,
  );
}
