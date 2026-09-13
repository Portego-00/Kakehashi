import type { CustomVocabularyWord } from "./types";

export type CustomQuestionType = "meaning" | "reading";

export interface CustomSessionQuestion {
  wordId: string;
  type: CustomQuestionType;
}

export interface CustomSessionItem {
  word: CustomVocabularyWord;
  meaningDone: boolean;
  readingDone: boolean;
  meaningIncorrect: number;
  readingIncorrect: number;
  saved: boolean;
}

export interface CustomSessionQuiz {
  items: CustomSessionItem[];
  questions: CustomSessionQuestion[];
  answeredCount: number;
  correctAnswersCount: number;
  occurrence: number;
}

export function customWordHasReadingQuestion(word: CustomVocabularyWord) {
  return /\p{Script=Han}/u.test(word.characters);
}

export function customLessonBatchSize(value: number) {
  return Number.isFinite(value) ? Math.max(1, Math.min(100, Math.trunc(value))) : 5;
}

export function customLessonBatch(words: readonly CustomVocabularyWord[], size: number) {
  return words.slice(0, customLessonBatchSize(size));
}

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export function createCustomSessionQuiz(
  words: readonly CustomVocabularyWord[],
  options: { ordered?: boolean; meaningFirst?: boolean; backToBack?: boolean; random?: () => number } = {},
): CustomSessionQuiz {
  const random = options.random ?? Math.random;
  const items = words.map((word) => ({
    word,
    meaningDone: false,
    readingDone: !customWordHasReadingQuestion(word),
    meaningIncorrect: 0,
    readingIncorrect: 0,
    saved: false,
  }));
  const questionGroups = shuffle(words, random).map((word) => {
    const meaning: CustomSessionQuestion = { wordId: word.id, type: "meaning" };
    if (!customWordHasReadingQuestion(word)) return [meaning];
    const reading: CustomSessionQuestion = { wordId: word.id, type: "reading" };
    return options.meaningFirst === false ? [reading, meaning] : [meaning, reading];
  });
  const questions = options.ordered || options.backToBack
    ? questionGroups.flat()
    : shuffle(questionGroups.flat(), random);
  return { items, questions, answeredCount: 0, correctAnswersCount: 0, occurrence: 0 };
}

/** A stale callback from the previous native question must not answer the next one. */
export function answerCustomSessionQuestion(
  quiz: CustomSessionQuiz,
  question: CustomSessionQuestion,
  occurrence: number,
  isCorrect: boolean,
): { quiz: CustomSessionQuiz; completedWordId: string | null } {
  const current = quiz.questions[0];
  if (!current || quiz.occurrence !== occurrence || current.wordId !== question.wordId || current.type !== question.type) {
    return { quiz, completedWordId: null };
  }
  const itemIndex = quiz.items.findIndex((item) => item.word.id === question.wordId);
  if (itemIndex < 0 || quiz.items[itemIndex].saved) return { quiz, completedWordId: null };
  const item = { ...quiz.items[itemIndex] };
  if (question.type === "meaning") {
    item.meaningDone = isCorrect;
    if (!isCorrect) item.meaningIncorrect += 1;
  } else {
    item.readingDone = isCorrect;
    if (!isCorrect) item.readingIncorrect += 1;
  }
  const items = [...quiz.items];
  items[itemIndex] = item;
  return {
    quiz: {
      ...quiz,
      items,
      questions: isCorrect ? quiz.questions.slice(1) : [...quiz.questions.slice(1), current],
      answeredCount: quiz.answeredCount + 1,
      correctAnswersCount: quiz.correctAnswersCount + (isCorrect ? 1 : 0),
      occurrence: quiz.occurrence + 1,
    },
    completedWordId: isCorrect && item.meaningDone && item.readingDone ? item.word.id : null,
  };
}

export function confirmCustomSessionWord(quiz: CustomSessionQuiz, wordId: string): CustomSessionQuiz {
  return { ...quiz, items: quiz.items.map((item) => item.word.id === wordId ? { ...item, saved: true } : item) };
}

export function customSessionStats(quiz: CustomSessionQuiz) {
  return {
    completed: quiz.items.filter((item) => item.saved).length,
    accuracy: quiz.answeredCount ? Math.round(100 * quiz.correctAnswersCount / quiz.answeredCount) : 100,
    incorrect: quiz.items.reduce((count, item) => count + item.meaningIncorrect + item.readingIncorrect, 0),
  };
}

const STAGE_NAMES = ["Lesson", "Apprentice I", "Apprentice II", "Apprentice III", "Apprentice IV", "Guru I", "Guru II", "Master", "Enlightened", "Burned"];

export function customSrsStageName(stage: number) {
  return STAGE_NAMES[stage] ?? "Review";
}

export function customNextReviewLabel(availableAt: string | null, stage: number, now = Date.now()) {
  if (stage === 9) return "No more reviews";
  if (!availableAt) return "Review scheduled";
  const minutes = Math.max(0, Math.round((Date.parse(availableAt) - now) / 60_000));
  if (!Number.isFinite(minutes)) return "Review scheduled";
  if (minutes < 1) return "Next review now";
  if (minutes < 60) return `Next review in ${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Next review in ${hours} ${hours === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  return `Next review in ${days} ${days === 1 ? "day" : "days"}`;
}
