import { Subject } from "../types/wanikani";
import {
  searchImmersionKit,
  ImmersionKitSentence,
} from "./immersionKitService";
import { getAllAssignmentsCached } from "../utils/api";
import { getSubjectById } from "../utils/cache";
import {
  getSelectedListSubjectIdSet,
  subjectMatchesSelectedLists,
} from "../utils/extraStudySubjectLists";
import {
  ListeningPracticeConfig,
  ListeningQuestion,
  KanjiChoice,
} from "../types/listening";

/**
 * Generate listening practice questions based on user configuration
 */
export async function generateListeningQuestions(
  config: ListeningPracticeConfig,
  apiToken: string,
  userLevel: number
): Promise<ListeningQuestion[]> {
  console.log("[ListeningPractice] Starting question generation", config);

  // 1. Fetch vocabulary assignments
  const subjectTypes: ("vocabulary" | "kana_vocabulary")[] = [];
  if (config.includeVocabulary) {
    subjectTypes.push("vocabulary");
  }
  if (config.includeKanaVocabulary) {
    subjectTypes.push("kana_vocabulary");
  }

  const assignmentsResponse = await getAllAssignmentsCached(apiToken, {
    subject_types: subjectTypes,
  });

  // 2. Load subjects and filter
  const vocabs = await loadAndFilterVocabs(assignmentsResponse.data, config);
  console.log(`[ListeningPractice] Found ${vocabs.length} eligible vocabulary`);

  if (vocabs.length === 0) {
    return [];
  }

  // 3. Generate questions with ImmersionKit examples
  const questions: ListeningQuestion[] = [];
  const usedVocabIds = new Set<number>();
  const maxAttempts = config.numberOfQuestions * 5; // Try 5x the needed amount
  let attempts = 0;

  while (
    questions.length < config.numberOfQuestions &&
    attempts < maxAttempts
  ) {
    attempts++;

    // Get random unused vocab
    const vocab = getRandomVocab(vocabs, usedVocabIds);
    if (!vocab) {
      console.log("[ListeningPractice] No more vocabulary available");
      break;
    }

    // Try to fetch example
    const example = await fetchExampleForVocab(vocab, config, userLevel);
    if (!example) {
      console.log(
        `[ListeningPractice] No example found for ${vocab.data.characters}`
      );
      continue;
    }

    // Generate distractors
    const distractors = generateDistractors(vocab, vocabs, 3);
    const kanjiChoices = createKanjiChoices(vocab, distractors);

    // Create question
    const question: ListeningQuestion = {
      id: questions.length,
      vocab,
      example,
      sentenceWithBlank: blankOutVocab(
        example.sentence,
        vocab.data.characters || ""
      ),
      kanjiChoices,
    };

    questions.push(question);
    usedVocabIds.add(vocab.id);

    console.log(
      `[ListeningPractice] Generated question ${questions.length}/${config.numberOfQuestions}`
    );
  }

  console.log(
    `[ListeningPractice] Generated ${questions.length} questions after ${attempts} attempts`
  );
  return questions;
}

/**
 * Generator function that yields questions one at a time for progressive loading
 */
export async function* generateListeningQuestionsProgressively(
  config: ListeningPracticeConfig,
  apiToken: string,
  userLevel: number
): AsyncGenerator<{ question: ListeningQuestion; progress: number; total: number }> {
  console.log("[ListeningPractice] Starting progressive question generation", config);

  // 1. Fetch vocabulary assignments
  const subjectTypes: ("vocabulary" | "kana_vocabulary")[] = [];
  if (config.includeVocabulary) {
    subjectTypes.push("vocabulary");
  }
  if (config.includeKanaVocabulary) {
    subjectTypes.push("kana_vocabulary");
  }

  const assignmentsResponse = await getAllAssignmentsCached(apiToken, {
    subject_types: subjectTypes,
  });

  // 2. Load subjects and filter
  const vocabs = await loadAndFilterVocabs(assignmentsResponse.data, config);
  console.log(`[ListeningPractice] Found ${vocabs.length} eligible vocabulary`);

  if (vocabs.length === 0) {
    return;
  }

  // 3. Generate questions one by one
  const usedVocabIds = new Set<number>();
  const maxAttempts = config.numberOfQuestions * 5;
  let attempts = 0;
  let questionCount = 0;

  while (
    questionCount < config.numberOfQuestions &&
    attempts < maxAttempts
  ) {
    attempts++;

    // Get random unused vocab
    const vocab = getRandomVocab(vocabs, usedVocabIds);
    if (!vocab) {
      console.log("[ListeningPractice] No more vocabulary available");
      break;
    }

    // Try to fetch example
    const example = await fetchExampleForVocab(vocab, config, userLevel);
    if (!example) {
      console.log(
        `[ListeningPractice] No example found for ${vocab.data.characters}`
      );
      continue;
    }

    // Generate distractors
    const distractors = generateDistractors(vocab, vocabs, 3);
    const kanjiChoices = createKanjiChoices(vocab, distractors);

    // Create question
    const question: ListeningQuestion = {
      id: questionCount,
      vocab,
      example,
      sentenceWithBlank: blankOutVocab(
        example.sentence,
        vocab.data.characters || ""
      ),
      kanjiChoices,
    };

    usedVocabIds.add(vocab.id);
    questionCount++;

    console.log(
      `[ListeningPractice] Generated question ${questionCount}/${config.numberOfQuestions}`
    );

    // Yield the question
    yield {
      question,
      progress: questionCount,
      total: config.numberOfQuestions,
    };
  }

  console.log(
    `[ListeningPractice] Completed progressive generation: ${questionCount} questions after ${attempts} attempts`
  );
}

/**
 * Load and filter vocabulary based on configuration
 */
async function loadAndFilterVocabs(
  assignments: any[],
  config: ListeningPracticeConfig
): Promise<Subject[]> {
  const vocabs: Subject[] = [];
  const selectedListIds = config.selectedListIds ?? [];
  const selectedListSubjectIds = await getSelectedListSubjectIdSet(
    selectedListIds
  );

  // SRS stage mapping
  const srsStageMap = {
    apprentice: [1, 2, 3, 4],
    guru: [5, 6],
    master: [7],
    enlightened: [8],
    burned: [9],
  };

  // Get selected SRS stages
  const selectedStages: number[] = [];
  for (const [stage, enabled] of Object.entries(config.srsGroups)) {
    if (enabled) {
      selectedStages.push(
        ...srsStageMap[stage as keyof typeof srsStageMap]
      );
    }
  }

  for (const assignment of assignments) {
    // Filter by SRS stage
    if (!selectedStages.includes(assignment.data.srs_stage)) {
      continue;
    }

    // Load subject
    const subject = await getSubjectById(assignment.data.subject_id);
    if (!subject) continue;

    // Filter by subject type (include if either type matches)
    const isVocab = subject.object === "vocabulary";
    const isKanaVocab = subject.object === "kana_vocabulary";

    const shouldInclude =
      (config.includeVocabulary && isVocab) ||
      (config.includeKanaVocabulary && isKanaVocab);

    if (!shouldInclude) {
      continue;
    }

    if (
      !subjectMatchesSelectedLists(
        subject.id,
        selectedListIds,
        selectedListSubjectIds
      )
    ) {
      continue;
    }

    // Filter by level
    if (config.useCustomLevelRange) {
      if (
        subject.data.level < config.minLevel ||
        subject.data.level > config.maxLevel
      ) {
        continue;
      }
    }

    // Only include vocab with characters
    // For kana_vocabulary, readings may be null since the characters ARE the reading
    if (!subject.data.characters) {
      continue;
    }

    // Regular vocabulary requires readings (has kanji), but kana_vocabulary doesn't
    if (
      isVocab &&
      (!subject.data.readings || subject.data.readings.length === 0)
    ) {
      continue;
    }

    vocabs.push(subject);
  }

  return vocabs;
}

/**
 * Get a random vocabulary that hasn't been used yet
 */
function getRandomVocab(
  vocabs: Subject[],
  usedIds: Set<number>
): Subject | null {
  const availableVocabs = vocabs.filter((v) => !usedIds.has(v.id));
  if (availableVocabs.length === 0) {
    return null;
  }
  return availableVocabs[
    Math.floor(Math.random() * availableVocabs.length)
  ];
}

/**
 * Fetch an ImmersionKit example for a vocabulary item
 */
async function fetchExampleForVocab(
  vocab: Subject,
  config: ListeningPracticeConfig,
  userLevel: number
): Promise<ImmersionKitSentence | null> {
  const characters = vocab.data.characters;

  if (!characters) {
    return null;
  }

  try {
    // Search by characters (not reading) to get better matches
    const { results: examples } = await searchImmersionKit(characters, {
      exactMatch: true,
      category: "anime",
      selectedAnimes: config.sessionAnimes,
      limit: 10,
      userLevel: userLevel,
    });

    // Filter for complete examples with audio and image
    const validExamples = examples.filter(
      (ex) =>
        ex.audio &&
        ex.imageUrl &&
        ex.sentence &&
        ex.sentence.includes(characters)
    );

    if (validExamples.length === 0) {
      return null;
    }

    // Return random example
    return validExamples[Math.floor(Math.random() * validExamples.length)];
  } catch (error) {
    console.error(
      `[ListeningPractice] Failed to fetch example for ${characters}:`,
      error
    );
    return null;
  }
}

/**
 * Blank out the vocabulary word in the sentence
 */
const LEADING_OR_TRAILING_TILDE_PATTERN = /^[〜～~]+|[〜～~]+$/g;
const ALL_TILDE_PATTERN = /[〜～~]/g;
const KANA_ENDING_PATTERN = /[\u3040-\u30FF]$/;
const VERB_CONJUGATION_SUFFIX_PATTERN =
  "(?:ませんでした|ません|ました|ます|られない|られた|られる|れない|れた|れる|させない|させた|させる|せない|せた|せる|たくない|たかった|たい|らなかった|らない|なかった|ない|っていた|っている|ってる|ていた|ている|てる|でいた|でいる|でる|りました|ります|んで|んだ|った|って|いた|いて|いだ|した|して|たら|れば|よう|ろう|ろ|よ|ば|だ|で|た|て|る|う|く|ぐ|す|つ|ぬ|ぶ|む)";
const I_ADJECTIVE_SUFFIX_PATTERN =
  "(?:くなかった|くない|かった|くて|ければ|い)";

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
    // Escape special regex characters
    const escapedVocab = escapeRegExp(candidate);
    const regex = new RegExp(escapedVocab, "g");
    const blanked = sentence.replace(regex, "＿＿＿");
    if (blanked !== sentence) {
      return blanked;
    }
  }

  const conjugationBlanked = tryBlankUsingConjugationMatch(sentence, candidates);
  if (conjugationBlanked) {
    return conjugationBlanked;
  }

  // Vocab not found in sentence exactly, try finding any Japanese word
  // This is a fallback and shouldn't happen often with proper filtering
  console.warn(
    `[ListeningPractice] Vocab "${vocab}" not found in sentence "${sentence}"`
  );
  // Blank out the first continuous Japanese character sequence as fallback
  const japanesePattern = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]+/;
  return sentence.replace(japanesePattern, "＿＿＿");
}

/**
 * Create multiple choice options with the correct answer and distractors
 */
function createKanjiChoices(
  correct: Subject,
  distractors: Subject[]
): KanjiChoice[] {
  // For kana_vocabulary, characters ARE the reading
  const getReading = (subject: Subject) =>
    subject.data.readings?.[0]?.reading || subject.data.characters || "";

  const choices: KanjiChoice[] = [
    {
      kanji: correct.data.characters!,
      vocabId: correct.id,
      reading: getReading(correct),
      isCorrect: true,
    },
    ...distractors.map((d) => ({
      kanji: d.data.characters!,
      vocabId: d.id,
      reading: getReading(d),
      isCorrect: false,
    })),
  ];

  // Shuffle choices
  return choices.sort(() => Math.random() - 0.5);
}

/**
 * Generate distractor vocabulary items for multiple choice
 */
function generateDistractors(
  correct: Subject,
  allVocabs: Subject[],
  count: number
): Subject[] {
  // For kana_vocabulary, characters ARE the reading
  const getReading = (subject: Subject) =>
    subject.data.readings?.[0]?.reading || subject.data.characters || "";

  const correctReading = getReading(correct);
  const correctLevel = correct.data.level;

  // Strategy 1: Find vocab with similar readings (same mora count ±1)
  const similarReading = allVocabs.filter((v) => {
    if (v.id === correct.id) return false;
    const vReading = getReading(v);
    const lengthDiff = Math.abs(correctReading.length - vReading.length);
    return lengthDiff <= 1 && lengthDiff >= 0;
  });

  // Strategy 2: Find vocab from same level (similar difficulty)
  const sameLevel = allVocabs.filter(
    (v) => v.id !== correct.id && v.data.level === correctLevel
  );

  // Strategy 3: Find vocab with same first character
  const sameFirstChar = allVocabs.filter((v) => {
    if (v.id === correct.id) return false;
    const correctFirstChar = correct.data.characters?.[0];
    const vFirstChar = v.data.characters?.[0];
    return correctFirstChar && vFirstChar && correctFirstChar === vFirstChar;
  });

  // Strategy 4: Random vocab as last resort
  const random = allVocabs.filter((v) => v.id !== correct.id);

  // Combine strategies with priority
  const pool = [
    ...similarReading.slice(0, 2),
    ...sameFirstChar.slice(0, 1),
    ...sameLevel.slice(0, 2),
    ...random,
  ];

  // Remove duplicates based on vocab ID
  const uniquePool = Array.from(
    new Map(pool.map((v) => [v.id, v])).values()
  );

  // Shuffle and take first 'count' items
  const shuffled = uniquePool.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
