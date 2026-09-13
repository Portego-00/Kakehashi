import { CUSTOM_VOCABULARY_AUDIO_PUBLIC_ORIGIN, getCustomVocabularyAudio } from "./audio-manifest";

/** Public CDN origin only. No Supabase client or credentials are needed to play a recording. */
export function customVocabularyAudio(wordId: string) {
  return getCustomVocabularyAudio(
    wordId,
    process.env.NEXT_PUBLIC_CUSTOM_VOCABULARY_AUDIO_SUPABASE_URL || CUSTOM_VOCABULARY_AUDIO_PUBLIC_ORIGIN,
  );
}
