import type { Assignment, Subject } from "@/types/wanikani";
import type { CustomSrsAssignment, CustomVocabularyWord } from "./types";

const CUSTOM_SUBJECT_BASE = 1_500_000_000;
const HAN_CHARACTER = /\p{Script=Han}/u;

export function customWordUsesKanji(word: Pick<CustomVocabularyWord, "characters">) {
  return HAN_CHARACTER.test(word.characters);
}

export function customSubjectId(wordId: string) {
  let hash = 2_166_136_261;
  for (const character of wordId) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }
  return CUSTOM_SUBJECT_BASE + (hash >>> 0) % 500_000_000;
}

export function customWordToSubject(word: CustomVocabularyWord): Subject {
  const id = customSubjectId(word.id);
  const usesKanji = customWordUsesKanji(word);
  const object = usesKanji ? "vocabulary" : "kana_vocabulary";
  return {
    id,
    object,
    url: "",
    data_updated_at: "2026-08-31T00:00:00.000Z",
    data: {
      level: word.requiredLevel ?? 1,
      created_at: "2026-08-31T00:00:00.000Z",
      slug: word.characters,
      document_url: "",
      hidden_at: null,
      characters: word.characters,
      meanings: word.meanings.map((meaning, index) => ({ meaning, primary: index === 0, accepted_answer: true })),
      auxiliary_meanings: [],
      meaning_mnemonic: word.meaningMnemonic,
      ...(usesKanji ? {
        readings: [{ reading: word.reading, primary: true, accepted_answer: true }],
        reading_mnemonic: word.readingMnemonic,
      } : {}),
      component_subject_ids: [],
      amalgamation_subject_ids: [],
      visually_similar_subject_ids: [],
      context_sentences: word.contextSentences,
      pronunciation_audios: [],
      parts_of_speech: word.partsOfSpeech,
    },
  };
}

export function customAssignmentToWaniKani(assignment: CustomSrsAssignment, word?: Pick<CustomVocabularyWord, "characters">): Assignment {
  const subjectId = customSubjectId(assignment.wordId);
  return {
    id: subjectId,
    object: "assignment",
    url: "",
    data_updated_at: assignment.updatedAt,
    data: {
      subject_id: subjectId,
      subject_type: word && customWordUsesKanji(word) ? "vocabulary" : "kana_vocabulary",
      srs_stage: assignment.stage,
      available_at: assignment.availableAt,
      started_at: assignment.startedAt,
      unlocked_at: assignment.startedAt ?? assignment.updatedAt,
      passed_at: assignment.stage >= 5 ? assignment.updatedAt : null,
      burned_at: assignment.burnedAt,
      resurrected_at: null,
      hidden: false,
      created_at: assignment.updatedAt,
    },
  };
}
