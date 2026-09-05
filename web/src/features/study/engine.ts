import { toHiragana } from "wanakana";
import { createAudioVocabCard } from "../../../../src/utils/audioVocabStudy";
import type { PronunciationAudioVoicePreference } from "../../../../src/utils/pronunciationAudio";
import { ALL_ANIME_SOURCE } from "@/features/anime/types";
import type { QuestionOrder, ReviewOrderSetting, ReviewTypeOrderSetting } from "@/features/settings/settings";
import niaiData from "./data/niai-similar-kanji.json";
import type { Assignment, Subject, SubjectType } from "@/types/wanikani";
import type {
  QuizModeId,
  SrsGroup,
  StudyAnswer,
  StudyAnswerStatus,
  StudyDataset,
  StudyFilters,
  StudyQuestion,
  StudySession,
} from "./types";

const MEANING_PUNCTUATION = /[\s\p{P}\p{S}]+/gu;
const READING_PUNCTUATION = /[\s\p{P}\p{S}]+/gu;
const NIAI_SIMILAR = niaiData as Record<string, string>;
const REVIEW_TYPE_ORDER: readonly ReviewTypeOrderSetting[] = ["radical", "kanji", "vocabulary"];
const REVIEW_TYPE_FALLBACK: Record<SubjectType, number> = { radical: 0, kanji: 1, vocabulary: 2, kana_vocabulary: 3 };
const SRS_INTERVAL_HOURS: Record<number, number> = { 1: 4, 2: 8, 3: 23, 4: 47, 5: 167, 6: 335, 7: 719, 8: 2879 };
const HOUR_MS = 60 * 60 * 1000;

export interface StudyQuestionGenerationOptions {
  audioVocabVoice?: PronunciationAudioVoicePreference;
  random?: () => number;
  now?: Date;
  customReviewOrder?: ReviewOrderSetting;
  reviewTypeOrderEnabled?: boolean;
  reviewTypeOrder?: ReviewTypeOrderSetting[];
  prioritizeCriticalItems?: boolean;
  userLevel?: number;
  reviewQuestionOrderEnabled?: boolean;
  reviewQuestionOrder?: QuestionOrder;
  backToBackQuestions?: boolean;
  maxQuestionGap?: number;
}

export const DEFAULT_STUDY_FILTERS: StudyFilters = {
  count: 20,
  useCustomLevelRange: false,
  subjectTypes: ["radical", "kanji", "vocabulary", "kana_vocabulary"],
  srsGroups: ["apprentice", "guru", "master", "enlightened", "burned"],
  selectedSrsStages: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  minLevel: 1,
  maxLevel: 60,
  selectedSubjectIds: [],
  selectedListIds: [],
  questionKinds: ["meaning", "reading"],
  recentWindow: "apprentice",
  answerMode: "multiple-choice",
  listeningSource: "anime",
  animeSources: [ALL_ANIME_SOURCE],
  listeningAutoPlayAudio: true,
  audioVocabSource: "word",
  writingMode: "guided",
  strokeLeniency: 1.5,
  wordLength: 5,
  wordleMaxAttempts: 6,
  similarKanjiSource: "niai",
  similarKanjiMode: "matching",
  similarKanjiOnlyLearned: true,
  similarKanjiGroupSize: 4,
  contextSentenceAudio: false,
  contextAutoPlaySentenceAudio: false,
  contextHideTranslation: false,
  contextSentenceBreakdown: false,
  contextStopAfterAnswer: true,
  crosswordSize: "medium",
  crosswordMaxWords: 10,
  crosswordJlptLevels: [],
  crosswordHiraganaOnly: false,
  crosswordClueMode: "english",
  crosswordShowKanjiSolutions: false,
  crosswordPlayAudioOnCorrect: true,
  wordSearchDirection: "kanji-to-kana",
};

export function normalizeMeaning(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en")
    .replace(/^to\s+/, "")
    .replace(MEANING_PUNCTUATION, "");
}

export function normalizeReading(value: string): string {
  return toHiragana(value.normalize("NFKC"))
    .trim()
    .replace(READING_PUNCTUATION, "");
}

export function checkAnswer(question: StudyQuestion, value: string): boolean {
  const normalize = question.kind === "audio-vocab" || question.kind === "meaning" || question.kind === "kana-to-meaning" || question.kind === "listening" || question.kind === "listening-meaning"
    ? normalizeMeaning
    : question.kind === "similar-kanji" || question.kind === "kana-to-kanji" || question.kind === "context"
      ? (answer: string) => answer.normalize("NFKC").trim()
      : normalizeReading;
  const candidate = normalize(value);
  return candidate.length > 0 && question.acceptedAnswers.some((answer) => normalize(answer) === candidate);
}

export function srsGroupForStage(stage: number): SrsGroup | null {
  if (stage >= 1 && stage <= 4) return "apprentice";
  if (stage === 5 || stage === 6) return "guru";
  if (stage === 7) return "master";
  if (stage === 8) return "enlightened";
  if (stage >= 9) return "burned";
  return null;
}

export function shuffle<T>(input: readonly T[], random: () => number = Math.random): T[] {
  const values = [...input];
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values;
}

function primaryMeaning(subject: Subject) {
  return subject.data.meanings.find((meaning) => meaning.primary)?.meaning ?? subject.data.meanings[0]?.meaning ?? "Unknown";
}

function acceptedMeanings(subject: Subject) {
  const accepted = subject.data.meanings.filter((meaning) => meaning.accepted_answer).map((meaning) => meaning.meaning);
  const whitelisted = subject.data.auxiliary_meanings.filter((meaning) => meaning.type === "whitelist").map((meaning) => meaning.meaning);
  return [...new Set([...accepted, ...whitelisted])];
}

function acceptedReadings(subject: Subject) {
  return [...new Set((subject.data.readings ?? []).filter((reading) => reading.accepted_answer).map((reading) => reading.reading))];
}

function primaryReading(subject: Subject) {
  return subject.data.readings?.find((reading) => reading.primary)?.reading ?? subject.data.readings?.[0]?.reading ?? "";
}

function assignmentMap(assignments: Assignment[]) {
  return new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment]));
}

const RECENT_WINDOW_MS = { "24h": 24 * 60 * 60 * 1000, "7d": 7 * 24 * 60 * 60 * 1000, "30d": 30 * 24 * 60 * 60 * 1000 } as const;

export function recentLessonSubjectIds(assignments: Assignment[], window: StudyFilters["recentWindow"], now = new Date()): Set<number> {
  if (window === "apprentice") {
    return new Set(assignments.filter((assignment) => assignment.data.started_at && assignment.data.srs_stage >= 1 && assignment.data.srs_stage <= 4 && !assignment.data.passed_at && !assignment.data.burned_at).map((assignment) => assignment.data.subject_id));
  }
  const cutoff = now.getTime() - RECENT_WINDOW_MS[window];
  return new Set(assignments.filter((assignment) => {
    if (assignment.data.burned_at) return false;
    const timestamp = assignment.data.started_at ? Date.parse(assignment.data.started_at) : Number.NaN;
    return Number.isFinite(timestamp) && timestamp >= cutoff && timestamp <= now.getTime();
  }).map((assignment) => assignment.data.subject_id));
}

export function filterStudySubjects(dataset: StudyDataset, filters: StudyFilters, options: { allowUnstarted?: boolean } = {}): Subject[] {
  const assignmentsBySubject = assignmentMap(dataset.assignments);
  const selected = new Set(filters.selectedSubjectIds);
  const allowedTypes = new Set(filters.subjectTypes);
  const allowedGroups = new Set(filters.srsGroups);

  return dataset.subjects.filter((subject) => {
    if (!allowedTypes.has(subject.object) || subject.data.level < filters.minLevel || subject.data.level > filters.maxLevel || subject.data.hidden_at) return false;
    if (selected.size > 0 && !selected.has(subject.id)) return false;
    const assignment = assignmentsBySubject.get(subject.id);
    if (options.allowUnstarted) return Boolean(assignment && assignment.data.unlocked_at !== null);
    if (!assignment || assignment.data.hidden) return false;
    const group = srsGroupForStage(assignment.data.srs_stage);
    return group ? allowedGroups.has(group) : false;
  });
}

export function unlockedLessonSubjects(dataset: StudyDataset): Subject[] {
  const unlocked = new Set(dataset.assignments.filter((assignment) => assignment.data.unlocked_at && !assignment.data.hidden).map((assignment) => assignment.data.subject_id));
  return dataset.subjects.filter((subject) => unlocked.has(subject.id) && !subject.data.hidden_at);
}

function distractors(subjects: Subject[], subject: Subject, kind: "meaning" | "characters", count: number, random: () => number) {
  const values = subjects
    .filter((candidate) => candidate.id !== subject.id)
    .map((candidate) => kind === "meaning" ? primaryMeaning(candidate) : candidate.data.characters ?? "")
    .filter(Boolean);
  return shuffle([...new Set(values)], random).slice(0, count);
}

function sentenceTokens(sentence: string, subjects: Subject[]) {
  const matches = subjects
    .filter((candidate) => candidate.data.characters && sentence.includes(candidate.data.characters))
    .toSorted((a, b) => (b.data.characters?.length ?? 0) - (a.data.characters?.length ?? 0));
  const tokens: NonNullable<NonNullable<StudyQuestion["sentence"]>["tokens"]> = [];
  let cursor = 0;
  while (cursor < sentence.length) {
    const match = matches.find((candidate) => candidate.data.characters && sentence.startsWith(candidate.data.characters, cursor));
    if (match?.data.characters) {
      tokens.push({ text: match.data.characters, type: "vocabulary", meaning: primaryMeaning(match), reading: primaryReading(match), partsOfSpeech: match.data.parts_of_speech });
      cursor += match.data.characters.length;
      continue;
    }
    const character = sentence[cursor];
    const grammar = /[はがをにでとものへやかねよ]/u.test(character);
    tokens.push({ text: character, type: grammar ? "grammar" : /[\p{Script=Han}]/u.test(character) ? "kanji" : "plain", meaning: grammar ? "Japanese grammar particle" : undefined });
    cursor += 1;
  }
  return tokens;
}

function toQuestion(subject: Subject, kind: StudyQuestion["kind"], subjects: Subject[], filters: StudyFilters, random: () => number): StudyQuestion | null {
  const meaning = primaryMeaning(subject);
  const characters = subject.data.characters ?? (subject.object === "radical" ? subject.data.slug.replaceAll("-", " ") : null);
  const reading = primaryReading(subject);
  const meanings = acceptedMeanings(subject);
  const readings = acceptedReadings(subject);
  const base = { id: `${subject.id}:${kind}`, subjectId: subject.id, subjectType: subject.object, kind, characters, meaning };

  if (kind === "meaning" && characters && meanings.length) {
    return { ...base, prompt: characters, promptLabel: `${subject.object.replace("_", " ")} meaning`, acceptedAnswers: meanings, displayAnswer: meaning };
  }
  if (kind === "reading" && characters && readings.length) {
    return { ...base, prompt: characters, promptLabel: `${subject.object.replace("_", " ")} reading`, acceptedAnswers: readings, displayAnswer: reading };
  }
  if (kind === "meaning-to-reading" && readings.length) {
    return { ...base, prompt: meaning, promptLabel: "Type the reading in kana", acceptedAnswers: readings, displayAnswer: reading };
  }
  if (kind === "kana-to-meaning" && reading && meanings.length) {
    return { ...base, prompt: reading, promptLabel: "Type the English meaning", acceptedAnswers: meanings, displayAnswer: meaning };
  }
  if (kind === "kana-to-kanji" && reading && characters) {
    return { ...base, prompt: reading, promptLabel: "Type the vocabulary in kanji", acceptedAnswers: [characters], displayAnswer: characters };
  }
  if (kind === "similar-kanji" && subject.object === "kanji" && characters) {
    const relatedIds = new Set(subject.data.visually_similar_subject_ids ?? []);
    const niaiCharacters = new Set([...(NIAI_SIMILAR[characters] ?? "")]);
    const related = subjects.filter((candidate) => candidate.data.characters && (filters.similarKanjiSource === "niai" ? niaiCharacters.has(candidate.data.characters) : relatedIds.has(candidate.id)));
    const fallback = distractors(subjects.filter((candidate) => candidate.object === "kanji"), subject, "characters", 3, random);
    const distractorPool = [...related.map((candidate) => candidate.data.characters!), ...fallback].filter((value, index, all) => value !== characters && all.indexOf(value) === index);
    const options = shuffle([characters, ...shuffle(distractorPool, random).slice(0, Math.max(1, filters.similarKanjiGroupSize - 1))], random);
    if (options.length < 2) return null;
    return { ...base, prompt: meaning, promptLabel: "Choose the matching kanji", acceptedAnswers: [characters], displayAnswer: characters, choices: options };
  }
  if ((kind === "listening" || kind === "listening-characters" || kind === "listening-meaning") && meanings.length && characters) {
    const audio = subject.data.pronunciation_audios?.find((item) => item.content_type.includes("mpeg")) ?? subject.data.pronunciation_audios?.[0];
    const characterPhase = kind === "listening-characters";
    const choices = filters.answerMode === "multiple-choice"
      ? characterPhase
        ? shuffle([characters, ...distractors(subjects, subject, "characters", 3, random)], random)
        : shuffle([meaning, ...distractors(subjects, subject, "meaning", 3, random)], random)
      : undefined;
    return {
      ...base,
      prompt: "Listen",
      promptLabel: characterPhase
        ? (filters.answerMode === "typed" ? "Type the vocabulary you hear" : "Choose the vocabulary you hear")
        : (filters.answerMode === "typed" ? "Type its English meaning" : "Choose its English meaning"),
      acceptedAnswers: characterPhase
        ? filters.answerMode === "typed" ? [characters, ...readings] : [characters]
        : meanings,
      displayAnswer: characterPhase ? characters : meaning,
      choices,
      audioUrl: audio?.url,
      autoPlayAudio: characterPhase && filters.listeningAutoPlayAudio,
    };
  }
  if (kind === "context" && characters && subject.data.context_sentences?.length) {
    const sentence = subject.data.context_sentences[Math.floor(random() * subject.data.context_sentences.length)];
    if (!sentence.ja.includes(characters)) return null;
    const masked = sentence.ja.replaceAll(characters, "＿＿");
    const choices = filters.answerMode === "multiple-choice" ? shuffle([characters, ...distractors(subjects.filter((candidate) => candidate.object === "vocabulary" || candidate.object === "kana_vocabulary"), subject, "characters", 3, random)], random) : undefined;
    return {
      ...base,
      prompt: masked,
      promptLabel: filters.answerMode === "typed" ? "Type the missing vocabulary" : "Restore the missing vocabulary",
      acceptedAnswers: [characters, ...readings],
      displayAnswer: `${characters} (${reading})`,
      choices,
      sentence: { ...sentence, masked, tokens: filters.contextSentenceBreakdown ? sentenceTokens(sentence.ja, subjects) : undefined },
      sentenceAudioEnabled: filters.contextSentenceAudio,
      autoPlaySentenceAudio: filters.contextSentenceAudio && filters.contextAutoPlaySentenceAudio,
      hideTranslationUntilTap: filters.contextHideTranslation,
      enableSentenceBreakdown: filters.contextSentenceBreakdown,
      stopAfterAnswer: filters.contextStopAfterAnswer,
    };
  }
  return null;
}

function kindsForMode(mode: QuizModeId, subject: Subject, filters: StudyFilters): StudyQuestion["kind"][] {
  if (mode === "vocab-reading") return ["meaning-to-reading"];
  if (mode === "hiragana-meaning") return ["kana-to-meaning"];
  if (mode === "similar-kanji") return ["similar-kanji"];
  if (mode === "kana-to-kanji") return ["kana-to-kanji"];
  if (mode === "listening") return ["listening-characters", "listening-meaning"];
  if (mode === "context-sentences") return ["context"];
  const kinds: StudyQuestion["kind"][] = [];
  if (filters.questionKinds.includes("meaning")) kinds.push("meaning");
  if (filters.questionKinds.includes("reading") && subject.object !== "radical" && subject.data.readings?.length) kinds.push("reading");
  return kinds;
}

function subjectsForMode(mode: QuizModeId, dataset: StudyDataset, filters: StudyFilters, random: () => number, now: Date) {
  let subjects = mode === "custom-review"
    ? dataset.subjects.filter((subject) => filters.selectedSubjectIds.includes(subject.id) && !subject.data.hidden_at)
    : filterStudySubjects(dataset, filters);
  if (mode === "recent-lessons") {
    const assignments = assignmentMap(dataset.assignments);
    const recentIds = recentLessonSubjectIds(dataset.assignments, filters.recentWindow, now);
    subjects = subjects.filter((subject) => recentIds.has(subject.id));
    subjects = subjects.toSorted((a, b) => {
      const aDate = assignments.get(a.id)?.data.started_at ?? assignments.get(a.id)?.data.unlocked_at ?? "";
      const bDate = assignments.get(b.id)?.data.started_at ?? assignments.get(b.id)?.data.unlocked_at ?? "";
      return bDate.localeCompare(aDate);
    });
  } else {
    subjects = shuffle(subjects, random);
  }
  return subjects;
}

export function generateQuestions(mode: QuizModeId, dataset: StudyDataset, filters: StudyFilters, randomOrOptions: (() => number) | StudyQuestionGenerationOptions = Math.random, legacyNow = new Date()): StudyQuestion[] {
  const options = typeof randomOrOptions === "function" ? { random: randomOrOptions, now: legacyNow } : randomOrOptions;
  const random = options.random ?? Math.random;
  const now = options.now ?? legacyNow;
  if (mode === "custom-review") return generateCustomReviewQuestions(dataset, filters, options, random, now);
  if (mode === "audio-vocab") {
    const assignments = assignmentMap(dataset.assignments);
    const selected = new Set(filters.selectedSubjectIds);
    const candidates = filters.selectedListIds.length
      ? shuffle(dataset.subjects.filter((subject) => {
        if (!selected.has(subject.id) || subject.data.hidden_at) return false;
        if (filters.useCustomLevelRange && (subject.data.level < filters.minLevel || subject.data.level > filters.maxLevel)) return false;
        const assignment = assignments.get(subject.id);
        if (assignment?.data.hidden) return false;
        const group = srsGroupForStage(assignment?.data.srs_stage ?? 0);
        return !group || filters.srsGroups.includes(group);
      }), random)
      : subjectsForMode(mode, dataset, filters, random, now);
    return candidates.flatMap<StudyQuestion>((subject) => {
      const card = createAudioVocabCard(subject, options.audioVocabVoice, filters.audioVocabSource);
      return card ? [{
        id: card.id, subjectId: card.subjectId, subjectType: subject.object, kind: "audio-vocab",
        prompt: "Listen", promptLabel: "What does this word mean?", characters: card.characters,
        reading: card.reading, acceptedAnswers: card.meanings, displayAnswer: card.meanings.join(", "),
        audioUrl: card.audio?.url, audioVocabSentence: card.sentence?.ja, autoPlayAudio: filters.listeningAutoPlayAudio,
      }] : [];
    }).slice(0, filters.count);
  }

  const questions: StudyQuestion[] = [];
  const subjects = subjectsForMode(mode, dataset, filters, random, now);
  const questionLimit = mode === "listening" ? filters.count * 2 : filters.count;
  const countsStudyItems = mode === "random-test";
  const studyItemLimit = filters.count;
  let generatedStudyItems = 0;
  for (const subject of subjects) {
    const questionCountBeforeSubject = questions.length;
    const kinds = mode === "listening" ? kindsForMode(mode, subject, filters) : shuffle(kindsForMode(mode, subject, filters), random);
    for (const kind of kinds) {
      const question = toQuestion(subject, kind, dataset.subjects, filters, random);
      if (question) questions.push(question);
      if (!countsStudyItems && mode !== "recent-lessons" && questions.length >= questionLimit) return questions;
    }
    if (questions.length > questionCountBeforeSubject) generatedStudyItems += 1;
    if (countsStudyItems && generatedStudyItems >= studyItemLimit) return questions;
  }
  return questions;
}

function generateCustomReviewQuestions(dataset: StudyDataset, filters: StudyFilters, options: StudyQuestionGenerationOptions, random: () => number, now: Date) {
  const selected = dataset.subjects.filter((subject) => filters.selectedSubjectIds.includes(subject.id) && !subject.data.hidden_at);
  const subjects = orderCustomReviewSubjects(selected, dataset.assignments, options, random, now);
  const pairs = subjects.flatMap<{ first: StudyQuestion; second: StudyQuestion | null }>((subject) => {
    const questions = kindsForMode("custom-review", subject, filters)
      .map((kind) => toQuestion(subject, kind, dataset.subjects, filters, random))
      .filter((question): question is StudyQuestion => Boolean(question));
    if (!questions.length) return [];
    if (questions.length === 1) return [{ first: questions[0], second: null }];
    const meaning = questions.find((question) => question.kind === "meaning") ?? questions[0];
    const reading = questions.find((question) => question.kind === "reading") ?? questions.find((question) => question !== meaning)!;
    const readingFirst = options.reviewQuestionOrderEnabled
      ? options.reviewQuestionOrder === "reading-first"
      : !options.backToBackQuestions && random() >= 0.5;
    return [{ first: readingFirst ? reading : meaning, second: readingFirst ? meaning : reading }];
  });

  if (options.backToBackQuestions) return pairs.flatMap(({ first, second }) => second ? [first, second] : [first]);

  const maximumGap = Math.max(2, Math.trunc(options.maxQuestionGap ?? 10) || 10);
  const questions: StudyQuestion[] = [];
  for (let index = 0; index < pairs.length;) {
    const remaining = pairs.length - index;
    let batchSize = Math.min(maximumGap, remaining);
    if (remaining - batchSize === 1 && batchSize > 2) batchSize -= 1;
    const batch = pairs.slice(index, index + batchSize);
    questions.push(...batch.map(({ first }) => first));
    questions.push(...batch.flatMap(({ second }) => second ? [second] : []));
    index += batchSize;
  }
  return questions;
}

function orderCustomReviewSubjects(subjects: Subject[], assignments: Assignment[], options: StudyQuestionGenerationOptions, random: () => number, now: Date) {
  const assignmentBySubject = assignmentMap(assignments);
  const order = options.customReviewOrder ?? "random";
  const randomized = shuffle(subjects, random);
  const randomRank = new Map(randomized.map((subject, index) => [subject.id, index]));
  const ordered = order === "random" ? randomized : [...subjects];
  const configuredTypes = normalizeReviewTypeOrder(options.reviewTypeOrder);
  const typeRank = new Map(configuredTypes.map((type, index) => [type, index]));

  return ordered.sort((left, right) => {
    if (options.prioritizeCriticalItems) {
      const criticalComparison = Number(isCriticalCustomReview(right, assignmentBySubject, options.userLevel ?? 1)) - Number(isCriticalCustomReview(left, assignmentBySubject, options.userLevel ?? 1));
      if (criticalComparison !== 0) return criticalComparison;
    }
    if (options.reviewTypeOrderEnabled) {
      const typeComparison = (typeRank.get(reviewTypeBucket(left.object)) ?? REVIEW_TYPE_ORDER.length) - (typeRank.get(reviewTypeBucket(right.object)) ?? REVIEW_TYPE_ORDER.length);
      if (typeComparison !== 0) return typeComparison;
    }
    if (order === "random") return (randomRank.get(left.id) ?? 0) - (randomRank.get(right.id) ?? 0);
    const orderComparison = compareCustomReviewSubjects(left, right, assignmentBySubject, order, now);
    if (orderComparison !== 0) return orderComparison;
    if (!options.reviewTypeOrderEnabled) {
      const typeComparison = REVIEW_TYPE_FALLBACK[left.object] - REVIEW_TYPE_FALLBACK[right.object];
      if (typeComparison !== 0) return typeComparison;
    }
    return (randomRank.get(left.id) ?? 0) - (randomRank.get(right.id) ?? 0);
  });
}

function compareCustomReviewSubjects(left: Subject, right: Subject, assignmentBySubject: Map<number, Assignment>, order: Exclude<ReviewOrderSetting, "random">, now: Date) {
  const leftAssignment = assignmentBySubject.get(left.id);
  const rightAssignment = assignmentBySubject.get(right.id);
  switch (order) {
    case "ascendingSrsStage": return (leftAssignment?.data.srs_stage ?? 0) - (rightAssignment?.data.srs_stage ?? 0);
    case "descendingSrsStage": return (rightAssignment?.data.srs_stage ?? 0) - (leftAssignment?.data.srs_stage ?? 0);
    case "currentLevelFirst": return right.data.level - left.data.level;
    case "lowestLevelFirst": return left.data.level - right.data.level;
    case "newestAvailableFirst": return compareReviewDates(leftAssignment?.data.available_at, rightAssignment?.data.available_at, "descending");
    case "oldestAvailableFirst": return compareReviewDates(leftAssignment?.data.available_at, rightAssignment?.data.available_at, "ascending");
    case "longestRelativeWait": return relativeReviewWait(rightAssignment, now) - relativeReviewWait(leftAssignment, now);
  }
}

function isCriticalCustomReview(subject: Subject, assignments: Map<number, Assignment>, userLevel: number) {
  const stage = assignments.get(subject.id)?.data.srs_stage ?? 0;
  return subject.data.level === userLevel && (subject.object === "radical" || subject.object === "kanji") && stage >= 1 && stage <= 4;
}

function normalizeReviewTypeOrder(values: ReviewTypeOrderSetting[] | undefined) {
  const unique = [...new Set((values ?? []).filter((value) => REVIEW_TYPE_ORDER.includes(value)))];
  return [...unique, ...REVIEW_TYPE_ORDER.filter((value) => !unique.includes(value))];
}

function reviewTypeBucket(type: SubjectType): ReviewTypeOrderSetting {
  return type === "kana_vocabulary" ? "vocabulary" : type;
}

function compareReviewDates(left: string | null | undefined, right: string | null | undefined, direction: "ascending" | "descending") {
  const leftTime = reviewDateMs(left);
  const rightTime = reviewDateMs(right);
  if (leftTime === null) return rightTime === null ? 0 : 1;
  if (rightTime === null) return -1;
  return direction === "ascending" ? leftTime - rightTime : rightTime - leftTime;
}

function relativeReviewWait(assignment: Assignment | undefined, now: Date) {
  const availableAt = reviewDateMs(assignment?.data.available_at);
  if (availableAt === null) return Number.NEGATIVE_INFINITY;
  const roundedNow = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
  const elapsed = Math.max(0, roundedNow - availableAt);
  const stage = assignment?.data.srs_stage ?? 1;
  return elapsed / ((SRS_INTERVAL_HOURS[stage] ?? SRS_INTERVAL_HOURS[1]) * HOUR_MS);
}

function reviewDateMs(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createStudySession(mode: QuizModeId, questions: StudyQuestion[], now = new Date()): StudySession {
  const timestamp = now.toISOString();
  return { version: 1, id: `${mode}:${now.getTime()}`, mode, createdAt: timestamp, updatedAt: timestamp, currentIndex: 0, questions, answers: [], complete: questions.length === 0 };
}

export function getStudyItemProgress(questions: StudyQuestion[], currentIndex: number) {
  const total = new Set(questions.map((question) => question.subjectId)).size;
  const current = new Set(questions.slice(0, Math.max(0, currentIndex + 1)).map((question) => question.subjectId)).size;
  return { current, total };
}

export function answerStudyQuestion(session: StudySession, value: string, now = new Date(), status?: StudyAnswerStatus): StudySession {
  if (session.complete) return session;
  const question = session.questions[session.currentIndex];
  if (!question || session.answers.some((answer) => answer.questionId === question.id)) return session;
  const resolvedStatus: StudyAnswerStatus = status ?? (checkAnswer(question, value) ? "correct" : "incorrect");
  const answer: StudyAnswer = {
    questionId: question.id,
    value,
    correct: resolvedStatus !== "incorrect",
    status: resolvedStatus,
    answeredAt: now.toISOString(),
  };
  return { ...session, answers: [...session.answers, answer], updatedAt: now.toISOString() };
}

export function resolveStudyAnswerStatus(session: StudySession, questionId: string, status: Exclude<StudyAnswerStatus, "close">, now = new Date()): StudySession {
  const answerIndex = session.answers.findIndex((answer) => answer.questionId === questionId && (answer.status ?? (answer.correct ? "correct" : "incorrect")) === "close");
  if (answerIndex < 0) return session;
  const answers = [...session.answers];
  answers[answerIndex] = { ...answers[answerIndex], correct: status === "correct", status };
  return { ...session, answers, updatedAt: now.toISOString() };
}

export function advanceStudySession(session: StudySession, now = new Date()): StudySession {
  const current = session.questions[session.currentIndex];
  const answer = current ? session.answers.find((item) => item.questionId === current.id) : undefined;
  let questions = session.questions;
  if (session.mode === "recent-lessons" && current && answer && !answer.correct) {
    const originalQuestionId = current.originalQuestionId ?? current.id;
    const retryNumber = (current.retryNumber ?? 0) + 1;
    questions = [...questions, { ...current, id: `${originalQuestionId}:retry:${retryNumber}`, originalQuestionId, retryNumber }];
  }
  const nextIndex = Math.min(session.currentIndex + 1, questions.length);
  return { ...session, questions, currentIndex: nextIndex, complete: nextIndex >= questions.length, updatedAt: now.toISOString() };
}

export function getSessionSummary(session: StudySession) {
  const correct = session.answers.reduce((count, answer) => count + Number(answer.correct), 0);
  const total = session.answers.length;
  const questionById = new Map(session.questions.map((question) => [question.id, question]));
  const resolved = new Set(session.answers.filter((answer) => answer.correct).map((answer) => {
    const question = questionById.get(answer.questionId);
    return question?.originalQuestionId ?? question?.id;
  }).filter((id): id is string => Boolean(id)));
  const incorrectSubjectIds = new Set(session.answers.filter((answer) => {
    if (answer.correct) return false;
    const question = questionById.get(answer.questionId);
    return !resolved.has(question?.originalQuestionId ?? question?.id ?? "");
  }).map((answer) => questionById.get(answer.questionId)?.subjectId).filter((id): id is number => typeof id === "number"));
  return { correct, total, accuracy: total ? Math.round((correct / total) * 100) : 0, incorrectSubjectIds: [...incorrectSubjectIds] };
}

export function sanitizeStudyFilters(value: Partial<StudyFilters> | null | undefined, maxLevel = 60): StudyFilters {
  const source = value ?? {};
  const validTypes = new Set<SubjectType>(["radical", "kanji", "vocabulary", "kana_vocabulary"]);
  const validGroups = new Set<SrsGroup>(["apprentice", "guru", "master", "enlightened", "burned"]);
  const validJlptLevels = new Set(["N5", "N4", "N3", "N2", "N1"] as const);
  const min = Number.isFinite(source.minLevel) ? Math.min(maxLevel, Math.max(1, Math.round(source.minLevel!))) : 1;
  const max = Number.isFinite(source.maxLevel) ? Math.min(maxLevel, Math.max(min, Math.round(source.maxLevel!))) : maxLevel;
  const animeSources = Array.isArray(source.animeSources) ? source.animeSources.filter((item): item is string => typeof item === "string" && item.trim().length > 0).slice(0, 100) : [];
  return {
    count: Number.isFinite(source.count) ? Math.min(100, Math.max(5, Math.round(source.count! / 5) * 5)) : 20,
    useCustomLevelRange: source.useCustomLevelRange === true,
    subjectTypes: Array.isArray(source.subjectTypes) ? source.subjectTypes.filter((type): type is SubjectType => validTypes.has(type)) : [...DEFAULT_STUDY_FILTERS.subjectTypes],
    srsGroups: Array.isArray(source.srsGroups) ? source.srsGroups.filter((group): group is SrsGroup => validGroups.has(group)) : [...DEFAULT_STUDY_FILTERS.srsGroups],
    selectedSrsStages: Array.isArray(source.selectedSrsStages) ? [...new Set(source.selectedSrsStages.filter((stage) => Number.isInteger(stage) && stage >= 0 && stage <= 9))] : [...DEFAULT_STUDY_FILTERS.selectedSrsStages],
    minLevel: min,
    maxLevel: max,
    selectedSubjectIds: Array.isArray(source.selectedSubjectIds) ? [...new Set(source.selectedSubjectIds.filter((id) => Number.isInteger(id) && id > 0))] : [],
    selectedListIds: Array.isArray(source.selectedListIds) ? [...new Set(source.selectedListIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0))] : [],
    questionKinds: Array.isArray(source.questionKinds) ? source.questionKinds.filter((kind): kind is "meaning" | "reading" => kind === "meaning" || kind === "reading") : ["meaning", "reading"],
    recentWindow: source.recentWindow === "apprentice" || source.recentWindow === "24h" || source.recentWindow === "30d" ? source.recentWindow : "7d",
    answerMode: source.answerMode === "typed" ? "typed" : "multiple-choice",
    listeningSource: source.listeningSource === "anime" ? "anime" : "wanikani",
    animeSources: animeSources.length ? animeSources : [ALL_ANIME_SOURCE],
    listeningAutoPlayAudio: source.listeningAutoPlayAudio !== false,
    audioVocabSource: source.audioVocabSource === "sentence" ? "sentence" : "word",
    writingMode: source.writingMode === "freehand" ? "freehand" : "guided",
    strokeLeniency: Number.isFinite(source.strokeLeniency)
      ? Math.min(2.5, Math.max(0.8, source.strokeLeniency!))
      : DEFAULT_STUDY_FILTERS.strokeLeniency,
    wordLength: Number.isFinite(source.wordLength) ? Math.min(7, Math.max(3, Math.round(source.wordLength!))) : 5,
    wordleMaxAttempts: Number.isFinite(source.wordleMaxAttempts) ? Math.min(8, Math.max(4, Math.round(source.wordleMaxAttempts!))) : 6,
    similarKanjiSource: source.similarKanjiSource === "wanikani" ? "wanikani" : "niai",
    similarKanjiMode: "matching",
    similarKanjiOnlyLearned: source.similarKanjiOnlyLearned !== false,
    similarKanjiGroupSize: Number.isFinite(source.similarKanjiGroupSize) ? Math.min(6, Math.max(2, Math.round(source.similarKanjiGroupSize!))) : 4,
    contextSentenceAudio: source.contextSentenceAudio === true,
    contextAutoPlaySentenceAudio: source.contextAutoPlaySentenceAudio === true,
    contextHideTranslation: source.contextHideTranslation === true,
    contextSentenceBreakdown: source.contextSentenceBreakdown === true,
    contextStopAfterAnswer: source.contextStopAfterAnswer !== false,
    crosswordSize: source.crosswordSize === "small" || source.crosswordSize === "large" ? source.crosswordSize : "medium",
    crosswordMaxWords: Number.isFinite(source.crosswordMaxWords) ? Math.min(24, Math.max(4, Math.round(source.crosswordMaxWords!))) : 10,
    crosswordJlptLevels: Array.isArray(source.crosswordJlptLevels) ? source.crosswordJlptLevels.filter((level): level is StudyFilters["crosswordJlptLevels"][number] => validJlptLevels.has(level as "N5" | "N4" | "N3" | "N2" | "N1")) : [],
    crosswordHiraganaOnly: source.crosswordHiraganaOnly === true,
    crosswordClueMode: source.crosswordClueMode === "kanji" || source.crosswordClueMode === "english_kanji" ? source.crosswordClueMode : "english",
    crosswordShowKanjiSolutions: source.crosswordShowKanjiSolutions === true,
    crosswordPlayAudioOnCorrect: source.crosswordPlayAudioOnCorrect !== false,
    wordSearchDirection: source.wordSearchDirection === "kana-to-kanji" ? "kana-to-kanji" : "kanji-to-kana",
  };
}
