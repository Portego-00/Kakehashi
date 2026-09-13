import { getCachedOrDownloadVocabularyAudioUri } from "../../services/offlineVocabularyAudioService";
import type { PronunciationAudio } from "../../utils/pronunciationAudio";
import { getNativeCustomVocabularyAudio } from "./audio";
import { customSubjectIdToWord, customVocabularySubjectId } from "./subject";

export const CUSTOM_AUDIO_PREFETCH_LIMIT = 20;

/** Reuse the managed disk cache without inserting custom words into the WK index. */
export async function resolveCustomVocabularyAudioForPlayback(
  subjectId: number,
  audio: Pick<PronunciationAudio, "url">,
) {
  const word = customSubjectIdToWord(subjectId);
  if (!word || !getNativeCustomVocabularyAudio(word.id).some((clip) => clip.url === audio.url)) {
    return null;
  }
  try {
    return await getCachedOrDownloadVocabularyAudioUri(subjectId, audio);
  } catch {
    return null;
  }
}

/** Call only for an active enrolled batch/window, never for the whole catalog. */
export async function prefetchCustomVocabularyAudio(
  wordIds: readonly string[],
  options: { enabled: boolean; signal?: AbortSignal },
) {
  if (!options.enabled || options.signal?.aborted) return;
  const ids = [...new Set(wordIds)].slice(0, CUSTOM_AUDIO_PREFETCH_LIMIT);
  // Sequential bounded downloads avoid competing with study sync or media audio.
  for (const wordId of ids) {
    if (options.signal?.aborted) return;
    const subjectId = customVocabularySubjectId(wordId);
    for (const audio of getNativeCustomVocabularyAudio(wordId)) {
      if (options.signal?.aborted) return;
      await resolveCustomVocabularyAudioForPlayback(subjectId, audio);
    }
  }
}
