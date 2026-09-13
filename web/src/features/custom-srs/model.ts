import { CUSTOM_SRS_POLICY, introduceCustomCard, nextCustomSrsStage, reviewCustomCard } from "./scheduler";
import type {
  CustomPackProgress,
  CustomSrsAssignment,
  CustomSrsState,
  CustomVocabularyPack,
  CustomVocabularyWord,
} from "./types";

const MAX_REVIEW_LOGS = 2_000;
const HOUR_IN_MS = 3_600_000;

export type CustomReviewForecastRow = {
  start: Date;
  count: number;
};

export type CustomReviewForecast = {
  rows: CustomReviewForecastRow[];
  laterCount: number;
  nextLaterReviewAt: Date | null;
};

export function createCustomSrsState(now = new Date()): CustomSrsState {
  return { version: 1, policy: CUSTOM_SRS_POLICY, enrolledPackIds: [], assignments: {}, reviewLog: [], updatedAt: now.toISOString() };
}

export function enrollCustomVocabularyPack(state: CustomSrsState, pack: CustomVocabularyPack, now = new Date()) {
  const alreadyEnrolled = state.enrolledPackIds.includes(pack.id);
  const hasEveryAssignment = pack.words.every((word) => Boolean(state.assignments[word.id]));
  if (alreadyEnrolled && hasEveryAssignment) return state;

  const timestamp = now.toISOString();
  const assignments = { ...state.assignments };
  for (const word of pack.words) {
    assignments[word.id] ??= {
      wordId: word.id,
      packId: pack.id,
      stage: 0,
      availableAt: null,
      startedAt: null,
      burnedAt: null,
      updatedAt: timestamp,
      correctReviews: 0,
      incorrectReviews: 0,
      card: null,
    };
  }
  return {
    ...state,
    enrolledPackIds: alreadyEnrolled ? state.enrolledPackIds : [...state.enrolledPackIds, pack.id],
    assignments,
    updatedAt: timestamp,
  } satisfies CustomSrsState;
}

export function completeCustomLesson(state: CustomSrsState, wordId: string, now = new Date()) {
  const assignment = state.assignments[wordId];
  if (!assignment) throw new Error(`Custom vocabulary assignment not found: ${wordId}`);
  if (assignment.stage !== 0) return state;
  const scheduled = introduceCustomCard(now);
  const nextAssignment: CustomSrsAssignment = {
    ...assignment,
    stage: 1,
    availableAt: scheduled.due.toISOString(),
    startedAt: now.toISOString(),
    updatedAt: now.toISOString(),
    card: scheduled.card,
  };
  return {
    ...state,
    assignments: { ...state.assignments, [wordId]: nextAssignment },
    updatedAt: now.toISOString(),
  } satisfies CustomSrsState;
}

export function recordCustomReview(state: CustomSrsState, wordId: string, incorrectAnswers: number, now = new Date(), eventId = `${wordId}:${now.toISOString()}`) {
  if (state.reviewLog.some((entry) => entry.eventId === eventId)) return state;
  const assignment = state.assignments[wordId];
  if (!assignment?.card || assignment.stage < 1 || assignment.stage >= 9) throw new Error(`Custom vocabulary review is not active: ${wordId}`);
  if (assignment.availableAt && new Date(assignment.availableAt) > now) throw new Error(`Custom vocabulary review is not due yet: ${wordId}`);
  const safeIncorrectAnswers = Math.max(0, Math.trunc(incorrectAnswers));
  const correct = safeIncorrectAnswers === 0;
  const scheduled = reviewCustomCard(assignment.card, now, correct);
  const endingStage = nextCustomSrsStage(assignment.stage, safeIncorrectAnswers);
  const burned = endingStage === 9;
  const nextReviewAt = burned ? null : scheduled.due.toISOString();
  const nextAssignment: CustomSrsAssignment = {
    ...assignment,
    stage: endingStage,
    availableAt: nextReviewAt,
    burnedAt: burned ? now.toISOString() : null,
    updatedAt: now.toISOString(),
    correctReviews: assignment.correctReviews + (correct ? 1 : 0),
    incorrectReviews: assignment.incorrectReviews + (correct ? 0 : 1),
    card: scheduled.card,
  };
  const log = {
    eventId,
    wordId,
    packId: assignment.packId,
    reviewedAt: now.toISOString(),
    startingStage: assignment.stage,
    endingStage,
    incorrectAnswers: safeIncorrectAnswers,
    rating: scheduled.rating,
    nextReviewAt,
  } as const;
  return {
    ...state,
    assignments: { ...state.assignments, [wordId]: nextAssignment },
    reviewLog: [...state.reviewLog, log].slice(-MAX_REVIEW_LOGS),
    updatedAt: now.toISOString(),
  } satisfies CustomSrsState;
}

export function reconcileCustomSrsState(state: CustomSrsState, packs: readonly CustomVocabularyPack[], now = new Date()) {
  return state.enrolledPackIds.reduce((current, packId) => {
    const pack = packs.find((candidate) => candidate.id === packId);
    return pack ? enrollCustomVocabularyPack(current, pack, now) : current;
  }, state);
}

export function customLessonWords(state: CustomSrsState, packs: readonly CustomVocabularyPack[]) {
  return wordsWithAssignments(state, packs)
    .filter(({ assignment }) => assignment.stage === 0)
    .map(({ word }) => word);
}

export function customReviewWords(state: CustomSrsState, packs: readonly CustomVocabularyPack[], now = new Date()) {
  return wordsWithAssignments(state, packs)
    .filter(({ assignment }) => assignment.stage > 0 && assignment.stage < 9 && Boolean(assignment.availableAt) && new Date(assignment.availableAt!) <= now)
    .sort((left, right) => new Date(left.assignment.availableAt!).getTime() - new Date(right.assignment.availableAt!).getTime())
    .map(({ word }) => word);
}

export function customReviewForecast(
  state: CustomSrsState,
  packs: readonly CustomVocabularyPack[],
  now = new Date(),
  hourCount = 12,
): CustomReviewForecast {
  const safeHourCount = Number.isFinite(hourCount) ? Math.max(1, Math.trunc(hourCount)) : 12;
  const firstHour = new Date(now);
  firstHour.setMinutes(0, 0, 0);
  const rows = Array.from({ length: safeHourCount }, (_, index) => ({
    start: new Date(firstHour.getTime() + index * HOUR_IN_MS),
    count: 0,
  }));
  const enrolledPackIds = new Set(state.enrolledPackIds);
  const activeWordIds = new Set(packs.flatMap((pack) => enrolledPackIds.has(pack.id) ? pack.words.map((word) => word.id) : []));
  let laterCount = 0;
  let nextLaterTimestamp = Number.POSITIVE_INFINITY;

  for (const assignment of Object.values(state.assignments)) {
    if (!activeWordIds.has(assignment.wordId) || assignment.stage < 1 || assignment.stage >= 9 || !assignment.availableAt) continue;
    const timestamp = Date.parse(assignment.availableAt);
    if (!Number.isFinite(timestamp)) continue;
    const index = timestamp <= now.getTime()
      ? 0
      : Math.floor((timestamp - firstHour.getTime()) / HOUR_IN_MS);
    if (index >= 0 && index < rows.length) {
      rows[index].count += 1;
    } else if (index >= rows.length) {
      laterCount += 1;
      nextLaterTimestamp = Math.min(nextLaterTimestamp, timestamp);
    }
  }

  return {
    rows,
    laterCount,
    nextLaterReviewAt: Number.isFinite(nextLaterTimestamp) ? new Date(nextLaterTimestamp) : null,
  };
}

export function nextCustomReviewAt(state: CustomSrsState, packs: readonly CustomVocabularyPack[]) {
  const activeWordIds = new Set(packs.flatMap((pack) => pack.words.map((word) => word.id)));
  const timestamps = Object.values(state.assignments)
    .filter((assignment) => activeWordIds.has(assignment.wordId) && assignment.stage > 0 && assignment.stage < 9 && assignment.availableAt)
    .map((assignment) => new Date(assignment.availableAt!).getTime())
    .filter(Number.isFinite);
  return timestamps.length ? new Date(Math.min(...timestamps)) : null;
}

export function customPackProgress(state: CustomSrsState, pack: CustomVocabularyPack, now = new Date()): CustomPackProgress {
  const result: CustomPackProgress = { total: pack.words.length, lessons: 0, apprentice: 0, guru: 0, master: 0, enlightened: 0, burned: 0, due: 0 };
  for (const word of pack.words) {
    const assignment = state.assignments[word.id];
    const stage = assignment?.stage ?? 0;
    if (stage === 0) result.lessons += 1;
    else if (stage <= 4) result.apprentice += 1;
    else if (stage <= 6) result.guru += 1;
    else if (stage === 7) result.master += 1;
    else if (stage === 8) result.enlightened += 1;
    else result.burned += 1;
    if (assignment?.availableAt && stage > 0 && stage < 9 && new Date(assignment.availableAt) <= now) result.due += 1;
  }
  return result;
}

function wordsWithAssignments(state: CustomSrsState, packs: readonly CustomVocabularyPack[]) {
  const words = new Map<string, CustomVocabularyWord>();
  for (const pack of packs) for (const word of pack.words) words.set(word.id, word);
  return Object.values(state.assignments).flatMap((assignment) => {
    const word = words.get(assignment.wordId);
    return word ? [{ word, assignment }] : [];
  });
}
