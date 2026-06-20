import type { Subject } from "../utils/api";
import type { KanjiChoice } from "../types/listening";
import type {
  ContextSentencePracticeConfig,
  ContextSentenceQuestion,
} from "../types/contextSentencePractice";
import { getAllAssignmentsCached } from "../utils/api";
import { getSubjectById } from "../utils/cache";
import {
  getSelectedListSubjectIdSet,
  subjectMatchesSelectedLists,
} from "../utils/extraStudySubjectLists";

type ContextSentenceRaw = {
  ja?: string;
  en?: string;
  japanese?: string;
  english?: string;
};

const JAPANESE_TEXT_PATTERN = /[\u3040-\u309F\u30A0-\u30FF\u3400-\u9FFF]+/;
const LEADING_OR_TRAILING_TILDE_PATTERN = /^[〜～~]+|[〜～~]+$/g;
const ALL_TILDE_PATTERN = /[〜～~]/g;
const KANA_ENDING_PATTERN = /[\u3040-\u30FF]$/;
const VERB_CONJUGATION_SUFFIX_PATTERN =
  "(?:ませんでした|ません|ました|ます|られない|られた|られる|れない|れた|れる|させない|させた|させる|せない|せた|せる|たくない|たかった|たい|らなかった|らない|なかった|ない|っていた|っている|ってる|ていた|ている|てる|でいた|でいる|でる|りました|ります|んで|んだ|った|って|いた|いて|いだ|した|して|たら|れば|よう|ろう|ろ|よ|ば|だ|で|た|て|る|う|く|ぐ|す|つ|ぬ|ぶ|む)";
const I_ADJECTIVE_SUFFIX_PATTERN =
  "(?:くなかった|くない|かった|くて|ければ|い)";

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

function getVocabMatchCandidates(vocab: string): string[] {
  const trimmed = vocab.trim();
  if (!trimmed) {
    return [];
  }

  const candidates = new Set<string>([trimmed]);
  const withoutEdgeTildes = trimmed.replace(LEADING_OR_TRAILING_TILDE_PATTERN, "");
  if (withoutEdgeTildes) {
    candidates.add(withoutEdgeTildes);
  }

  const withoutAnyTildes = trimmed.replace(ALL_TILDE_PATTERN, "");
  if (withoutAnyTildes) {
    candidates.add(withoutAnyTildes);
  }

  return Array.from(candidates).sort((a, b) => b.length - a.length);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tryBlankUsingConjugationMatch(
  sentence: string,
  candidates: string[],
): string | null {
  for (const candidate of candidates) {
    if (candidate.length < 2 || !KANA_ENDING_PATTERN.test(candidate)) {
      continue;
    }

    const stem = candidate.slice(0, -1);
    if (!stem) {
      continue;
    }

    const escapedStem = escapeRegExp(stem);
    const conjugationRegex = new RegExp(
      `${escapedStem}${VERB_CONJUGATION_SUFFIX_PATTERN}`,
      "g",
    );
    const conjugationBlanked = sentence.replace(conjugationRegex, "＿＿＿");
    if (conjugationBlanked !== sentence) {
      return conjugationBlanked;
    }

    if (candidate.endsWith("い")) {
      const adjectiveRegex = new RegExp(
        `${escapedStem}${I_ADJECTIVE_SUFFIX_PATTERN}`,
        "g",
      );
      const adjectiveBlanked = sentence.replace(adjectiveRegex, "＿＿＿");
      if (adjectiveBlanked !== sentence) {
        return adjectiveBlanked;
      }
    }
  }

  return null;
}

function blankOutVocab(sentence: string, vocab: string): string {
  const candidates = getVocabMatchCandidates(vocab);
  for (const candidate of candidates) {
    const escapedVocab = escapeRegExp(candidate);
    const exactRegex = new RegExp(escapedVocab, "g");
    const exactBlanked = sentence.replace(exactRegex, "＿＿＿");
    if (exactBlanked !== sentence) {
      return exactBlanked;
    }
  }

  const conjugationBlanked = tryBlankUsingConjugationMatch(sentence, candidates);
  if (conjugationBlanked) {
    return conjugationBlanked;
  }

  return sentence.replace(JAPANESE_TEXT_PATTERN, "＿＿＿");
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
    srs_stages: selectedStages,
  });

  const subjects: Subject[] = [];
  for (const assignment of assignmentsResponse.data) {
    const subject = (await getSubjectById(assignment.data.subject_id)) as Subject | null;
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
    if (getContextSentences(subject).length === 0) continue;
    subjects.push(subject);
  }

  return subjects;
}

export async function generateContextSentenceQuestions(
  config: ContextSentencePracticeConfig,
  apiToken: string
): Promise<ContextSentenceQuestion[]> {
  const eligibleVocabs = await loadEligibleVocabulary(apiToken, config);
  if (eligibleVocabs.length === 0) return [];

  const devSelectedSubjectIds = __DEV__
    ? parseDevSelectedSubjectIds(config.devSelectedSubjectIds)
    : [];
  const eligibleById = new Map(
    eligibleVocabs.map((subject) => [subject.id, subject] as const)
  );

  const selectedVocabs =
    devSelectedSubjectIds.length > 0
      ? devSelectedSubjectIds
          .map((subjectId) => eligibleById.get(subjectId))
          .filter((subject): subject is Subject => Boolean(subject))
      : [...eligibleVocabs]
          .sort(() => Math.random() - 0.5)
          .slice(0, config.numberOfQuestions);

  if (selectedVocabs.length === 0) {
    return [];
  }

  const questions: ContextSentenceQuestion[] = [];
  for (const vocab of selectedVocabs) {
    const context = getRandomContextSentence(vocab);
    if (!context) continue;

    const distractors = generateDistractors(vocab, eligibleVocabs, 3);
    const sentenceWithBlank = blankOutVocab(context.sentence, vocab.data.characters || "");

    questions.push({
      id: questions.length,
      vocab,
      sentence: context.sentence,
      translation: context.translation,
      sentenceWithBlank,
      kanjiChoices: createKanjiChoices(vocab, distractors),
    });
  }

  return questions;
}
