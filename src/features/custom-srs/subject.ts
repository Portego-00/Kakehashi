import type { Subject } from "../../utils/api";
import { CUSTOM_VOCABULARY_WORDS } from "./catalog";
import { getNativeCustomVocabularyAudio } from "./audio";
import type { CustomSrsAssignment, CustomVocabularyWord } from "./types";

const CATALOG_DATE = "2026-08-31T00:00:00.000Z";
const HAN_CHARACTER = /\p{Script=Han}/u;

export function customWordUsesKanji(word: Pick<CustomVocabularyWord, "characters">) {
  return HAN_CHARACTER.test(word.characters);
}

/** Negative IDs keep custom subjects outside every real WaniKani ID namespace. */
export function customVocabularySubjectId(wordId: string): number {
  let hash = 2_166_136_261;
  for (const character of wordId) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return -1 - (hash >>> 0);
}

const wordsBySubjectId = new Map(
  CUSTOM_VOCABULARY_WORDS.map((word) => [customVocabularySubjectId(word.id), word]),
);

export function customSubjectIdToWord(subjectId: number) {
  return wordsBySubjectId.get(subjectId);
}

/** Display adapter only: never place this subject into the WaniKani review queue. */
export function customWordToSubject(word: CustomVocabularyWord): Subject {
  const usesKanji = customWordUsesKanji(word);
  return {
    id: customVocabularySubjectId(word.id),
    object: usesKanji ? "vocabulary" : "kana_vocabulary",
    url: "",
    data_updated_at: CATALOG_DATE,
    data: {
      created_at: CATALOG_DATE,
      level: word.requiredLevel ?? 0,
      slug: word.characters,
      hidden_at: null,
      document_url: "",
      characters: word.characters,
      character_images: null,
      meanings: word.meanings.map((meaning, index) => ({
        meaning,
        primary: index === 0,
        accepted_answer: true,
      })),
      auxiliary_meanings: [],
      // Kana subjects deliberately have no reading question or Reading tab.
      readings: usesKanji
        ? [{ reading: word.reading, primary: true, accepted_answer: true, type: "kunyomi" }]
        : [],
      pronunciation_audios: getNativeCustomVocabularyAudio(word.id),
      parts_of_speech: word.partsOfSpeech,
      context_sentences: word.contextSentences,
      component_subject_ids: [],
      amalgamation_subject_ids: [],
      visually_similar_subject_ids: [],
      meaning_mnemonic: word.meaningMnemonic,
      meaning_hint: null,
      reading_mnemonic: usesKanji ? word.readingMnemonic ?? null : null,
      reading_hint: null,
    },
  };
}

export function customVocabularyWordToDetails(
  word: CustomVocabularyWord,
  assignment?: CustomSrsAssignment,
) {
  const subject = customWordToSubject(word);
  return {
    id: subject.id,
    object: subject.object,
    level: subject.data.level,
    characters: word.characters,
    meanings: subject.data.meanings,
    readings: subject.data.readings ?? [],
    partsOfSpeech: word.partsOfSpeech,
    meaningMnemonic: word.meaningMnemonic,
    readingMnemonic: customWordUsesKanji(word) ? word.readingMnemonic ?? "" : "",
    contextSentences: word.contextSentences,
    audioFiles: getNativeCustomVocabularyAudio(word.id),
    srsStage: assignment?.stage,
    nextReviewAt: assignment?.availableAt ?? undefined,
  };
}
