import type { Subject } from "../utils/api";
import type { KanjiChoice } from "../types/listening";
import type { CustomContextSentence } from "../types/customContextSentence";
import type {
  ContextSentencePracticeConfig,
  ContextSentenceQuestion,
} from "../types/contextSentencePractice";
import { getAllCustomContextSentences } from "./customContextSentenceService";
import { getAllAssignmentsCached } from "../utils/api";
import { getSubjectById } from "../utils/cache";
import {
  getExtraStudyCandidateSubjectIds,
  getSelectedListSubjectIdSet,
  subjectMatchesExtraStudySrsStage,
  subjectMatchesSelectedLists,
} from "../utils/extraStudySubjectLists";
import {
  blankContextSentence,
  tryBlankContextSentence,
} from "../utils/contextSentenceCloze";

type ContextSentenceRaw = {
  ja?: string;
  en?: string;
  japanese?: string;
  english?: string;
};

function uniqueById(subjects: Subject[]): Subject[] {
  return Array.from(new Map(subjects.map((subject) => [subject.id, subject])).values());
}

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

function getStageIds(config: ContextSentencePracticeConfig): number[] {
  const stageMap = {
    apprentice: [1, 2, 3, 4],
    guru: [5, 6],
    master: [7],
    enlightened: [8],
    burned: [9],
  };

  const selected: number[] = [];
  for (const [group, enabled] of Object.entries(config.srsGroups)) {
    if (!enabled) continue;
    selected.push(...stageMap[group as keyof typeof stageMap]);
  }

  return selected;
}

function normalizeContextSentence(raw: ContextSentenceRaw): {
  sentence: string;
  translation: string;
} | null {
  const sentence = (raw.ja || raw.japanese || "").trim();
  const translation = (raw.en || raw.english || "").trim();
  if (!sentence || !translation) return null;
  return { sentence, translation };
}

function getContextSentences(subject: Subject): {
  sentence: string;
  translation: string;
}[] {
  const contextSentences = ((subject as any).data?.context_sentences ||
    []) as ContextSentenceRaw[];
  if (!Array.isArray(contextSentences) || contextSentences.length === 0) {
    return [];
  }

  return contextSentences
    .map(normalizeContextSentence)
    .filter((value): value is { sentence: string; translation: string } =>
      Boolean(value)
    );
}

function getRandomContextSentence(subject: Subject): {
  sentence: string;
  translation: string;
} | null {
  const valid = getContextSentences(subject);
  if (valid.length === 0) return null;
  return valid[Math.floor(Math.random() * valid.length)];
}

function getVocabularyForms(subject: Subject): string[] {
  return [subject.data.characters || "", ...getVocabularyReadings(subject)].filter(
    Boolean,
  );
}

function getVocabularyReadings(subject: Subject): string[] {
  return Array.isArray(subject.data.readings)
    ? subject.data.readings.map((reading) => reading.reading).filter(Boolean)
    : [];
}

function getCustomSentenceText(sentence: CustomContextSentence): string {
  return sentence.displayMode === "kana" ? sentence.kana : sentence.japanese;
}

function createKanjiChoices(correct: Subject, distractors: Subject[]): KanjiChoice[] {
  const getReading = (subject: Subject) =>
    subject.data.readings?.[0]?.reading || subject.data.characters || "";

  const choices: KanjiChoice[] = [
    {
      kanji: correct.data.characters || "",
      vocabId: correct.id,
      reading: getReading(correct),
      isCorrect: true,
    },
    ...distractors.map((subject) => ({
      kanji: subject.data.characters || "",
      vocabId: subject.id,
      reading: getReading(subject),
      isCorrect: false,
    })),
  ];

  return choices.sort(() => Math.random() - 0.5);
}

function normalizePartOfSpeech(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");
}

function getNormalizedPartsOfSpeech(subject: Subject): string[] {
  const partsOfSpeech = subject.data.parts_of_speech ?? [];
  return Array.from(
    new Set(
      partsOfSpeech
        .map(normalizePartOfSpeech)
        .filter((partOfSpeech) => partOfSpeech.length > 0)
    )
  ).sort();
}

function getPartOfSpeechSignature(subject: Subject): string | null {
  const normalizedParts = getNormalizedPartsOfSpeech(subject);
  if (normalizedParts.length === 0) {
    return null;
  }

  return normalizedParts.join("|");
}

function getGrammarPartOfSpeechTags(partOfSpeech: string): string[] {
  const tags: string[] = [];

  if (
    partOfSpeech.includes("い adjective") ||
    partOfSpeech.includes("i adjective") ||
    partOfSpeech.includes("adj i")
  ) {
    tags.push("i-adjective");
  } else if (
    partOfSpeech.includes("な adjective") ||
    partOfSpeech.includes("na adjective") ||
    partOfSpeech.includes("adj na")
  ) {
    tags.push("na-adjective");
  } else if (
    partOfSpeech.includes("の adjective") ||
    partOfSpeech.includes("no adjective") ||
    partOfSpeech.includes("adj no")
  ) {
    tags.push("no-adjective");
  } else if (partOfSpeech.includes("adjective")) {
    tags.push("adjective");
  }

  if (partOfSpeech.includes("adverb")) {
    tags.push("adverb");
  }

  if (/(^|\s)verb(\s|$)/.test(partOfSpeech)) {
    tags.push("verb");
  }

  if (partOfSpeech.includes("noun")) {
    tags.push("noun");
  }

  for (const tag of [
    "counter",
    "expression",
    "interjection",
    "conjunction",
    "prefix",
    "suffix",
    "numeral",
  ]) {
    if (partOfSpeech.includes(tag)) {
      tags.push(tag);
    }
  }

  return tags.length > 0 ? tags : [partOfSpeech];
}

function getSubjectGrammarTags(subject: Subject): string[] {
  return Array.from(
    new Set(getNormalizedPartsOfSpeech(subject).flatMap(getGrammarPartOfSpeechTags))
  ).sort();
}

function hasCompatiblePartOfSpeech(correct: Subject, candidate: Subject): boolean {
  const correctTags = getSubjectGrammarTags(correct);
  if (correctTags.length === 0) {
    return false;
  }

  const candidateTags = new Set(getSubjectGrammarTags(candidate));
  return correctTags.some((tag) => candidateTags.has(tag));
}

function rankDistractorCandidates(correct: Subject, candidates: Subject[]): Subject[] {
  const getReading = (subject: Subject) =>
    subject.data.readings?.[0]?.reading || subject.data.characters || "";

  const correctReading = getReading(correct);
  const correctLevel = correct.data.level;

  const similarReading = candidates.filter((subject) => {
    const reading = getReading(subject);
    const lengthDiff = Math.abs(correctReading.length - reading.length);
    return lengthDiff <= 1;
  });

  const sameLevel = candidates.filter(
    (subject) => subject.data.level === correctLevel
  );

  const sameFirstChar = candidates.filter((subject) => {
    const correctFirst = correct.data.characters?.[0];
    const subjectFirst = subject.data.characters?.[0];
    return Boolean(correctFirst && subjectFirst && correctFirst === subjectFirst);
  });

  return uniqueById([
    ...shuffle(similarReading).slice(0, 2),
    ...shuffle(sameFirstChar).slice(0, 1),
    ...shuffle(sameLevel).slice(0, 2),
    ...shuffle(candidates),
  ]);
}

function generateDistractors(correct: Subject, allVocabs: Subject[], count: number): Subject[] {
  const candidates = allVocabs.filter((subject) => subject.id !== correct.id);
  const correctPartOfSpeechSignature = getPartOfSpeechSignature(correct);

  const exactPartOfSpeechCandidates = correctPartOfSpeechSignature
    ? candidates.filter(
        (subject) => getPartOfSpeechSignature(subject) === correctPartOfSpeechSignature
      )
    : [];
  const compatiblePartOfSpeechCandidates = correctPartOfSpeechSignature
    ? candidates.filter(
        (subject) =>
          getPartOfSpeechSignature(subject) !== correctPartOfSpeechSignature &&
          hasCompatiblePartOfSpeech(correct, subject)
      )
    : [];

  const rankedPool = uniqueById([
    ...rankDistractorCandidates(correct, exactPartOfSpeechCandidates),
    ...rankDistractorCandidates(correct, compatiblePartOfSpeechCandidates),
    ...rankDistractorCandidates(correct, candidates),
  ]);

  return rankedPool.slice(0, count);
}

function passesLevelRange(subject: Subject, config: ContextSentencePracticeConfig): boolean {
  if (!config.useCustomLevelRange) return true;
  const level = subject.data.level;
  return level >= config.minLevel && level <= config.maxLevel;
}

function passesTypeFilter(subject: Subject, config: ContextSentencePracticeConfig): boolean {
  const isVocabulary = subject.object === "vocabulary";
  const isKanaVocabulary = subject.object === "kana_vocabulary";

  return (
    (config.includeVocabulary && isVocabulary) ||
    (config.includeKanaVocabulary && isKanaVocabulary)
  );
}

function parseDevSelectedSubjectIds(rawValue: unknown): number[] {
  const values = Array.isArray(rawValue)
    ? rawValue
    : typeof rawValue === "string"
      ? rawValue.split(/[,\s]+/)
      : [];

  const parsed = values
    .map((value) => {
      const numericValue =
        typeof value === "number"
          ? value
          : Number.parseInt(String(value), 10);
      if (!Number.isInteger(numericValue) || numericValue <= 0) {
        return null;
      }

      return numericValue;
    })
    .filter((value): value is number => value !== null);

  return Array.from(new Set(parsed));
}

async function loadEligibleVocabulary(
  apiToken: string,
  config: ContextSentencePracticeConfig
): Promise<Subject[]> {
  const selectedStages = getStageIds(config);
  if (selectedStages.length === 0) return [];
  const selectedListIds = config.selectedListIds ?? [];
  const selectedListSubjectIds = await getSelectedListSubjectIdSet(
    selectedListIds
  );

  const assignmentsResponse = await getAllAssignmentsCached(apiToken, {
    subject_types: ["vocabulary", "kana_vocabulary"],
    srs_stages:
      selectedListIds.length > 0
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9]
        : selectedStages,
  });
  const subjectIdToStage = new Map<number, number>();
  assignmentsResponse.data.forEach((assignment) => {
    subjectIdToStage.set(
      assignment.data.subject_id,
      assignment.data.srs_stage,
    );
  });
  const candidateSubjectIds = getExtraStudyCandidateSubjectIds(
    assignmentsResponse.data,
    selectedListIds,
    selectedListSubjectIds,
  );

  const subjects: Subject[] = [];
  for (const subjectId of candidateSubjectIds) {
    if (
      !subjectMatchesExtraStudySrsStage(
        subjectId,
        subjectIdToStage,
        selectedListIds,
        selectedListSubjectIds,
        (stage) => selectedStages.includes(stage),
      )
    ) {
      continue;
    }
    const subject = (await getSubjectById(subjectId)) as Subject | null;
    if (!subject) continue;
    if (!subject.data?.characters) continue;
    if (!passesTypeFilter(subject, config)) continue;
    if (!passesLevelRange(subject, config)) continue;
    if (
      !subjectMatchesSelectedLists(
        subject.id,
        selectedListIds,
        selectedListSubjectIds
      )
    ) {
      continue;
    }
    subjects.push(subject);
  }

  return subjects;
}

export async function generateContextSentenceQuestions(
  config: ContextSentencePracticeConfig,
  apiToken: string,
  userId?: string | null,
): Promise<ContextSentenceQuestion[]> {
  const eligibleVocabs = await loadEligibleVocabulary(apiToken, config);
  if (eligibleVocabs.length === 0) return [];

  const devSelectedSubjectIds = __DEV__
    ? parseDevSelectedSubjectIds(config.devSelectedSubjectIds)
    : [];
  const eligibleById = new Map(
    eligibleVocabs.map((subject) => [subject.id, subject] as const)
  );

  type QuestionCandidate = {
    vocab: Subject;
    sentence: string;
    translation: string;
    sentenceWithBlank: string;
  };

  let questionCandidates: QuestionCandidate[];
  if (config.customSentencesOnly) {
    if (!userId) {
      return [];
    }

    const customSentences = await getAllCustomContextSentences(userId);
    questionCandidates = customSentences.flatMap((customSentence) => {
      const vocab = eligibleById.get(customSentence.subjectId);
      if (!vocab) {
        return [];
      }

      const japaneseSentenceWithBlank = tryBlankContextSentence(
        customSentence.japanese,
        [vocab.data.characters || ""],
      );
      if (!japaneseSentenceWithBlank) {
        return [];
      }

      const sentence = getCustomSentenceText(customSentence);
      const sentenceWithBlank =
        customSentence.displayMode === "kana"
          ? tryBlankContextSentence(sentence, getVocabularyReadings(vocab), {
              allowShortKanaConjugation: true,
            })
          : japaneseSentenceWithBlank;
      if (!sentenceWithBlank) {
        return [];
      }

      return [
        {
          vocab,
          sentence,
          translation: customSentence.english,
          sentenceWithBlank,
        },
      ];
    });
  } else {
    questionCandidates = eligibleVocabs.flatMap((vocab) => {
      const context = getRandomContextSentence(vocab);
      if (!context) {
        return [];
      }

      return [
        {
          vocab,
          sentence: context.sentence,
          translation: context.translation,
          sentenceWithBlank: blankContextSentence(
            context.sentence,
            getVocabularyForms(vocab),
          ),
        },
      ];
    });
  }

  const selectedCandidates =
    devSelectedSubjectIds.length > 0
      ? devSelectedSubjectIds.flatMap((subjectId) =>
          questionCandidates.filter(
            (candidate) => candidate.vocab.id === subjectId,
          ),
        )
      : shuffle(questionCandidates).slice(0, config.numberOfQuestions);

  if (selectedCandidates.length === 0) {
    return [];
  }

  const questions: ContextSentenceQuestion[] = [];
  for (const candidate of selectedCandidates) {
    const distractors = generateDistractors(
      candidate.vocab,
      eligibleVocabs,
      3,
    );

    questions.push({
      id: questions.length,
      vocab: candidate.vocab,
      sentence: candidate.sentence,
      translation: candidate.translation,
      sentenceWithBlank: candidate.sentenceWithBlank,
      kanjiChoices: createKanjiChoices(candidate.vocab, distractors),
    });
  }

  return questions;
}
