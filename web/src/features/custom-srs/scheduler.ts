import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type CardInput, type Grade } from "ts-fsrs";
import type { CustomSrsPolicyMetadata, CustomSrsStage, SerializedFsrsCard } from "./types";

const parameters = generatorParameters({
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ["4h", "8h"],
  relearning_steps: ["4h"],
  maximum_interval: 36_500,
  request_retention: 0.9,
});
const scheduler = fsrs(parameters);

export const CUSTOM_SRS_POLICY: CustomSrsPolicyMetadata = {
  id: "fsrs-wk-shaped",
  version: 1,
  library: "ts-fsrs",
  libraryVersion: "5.4.1",
  bootstrapStrategy: "explicit-learning-card",
  parameters: {
    requestRetention: parameters.request_retention,
    maximumInterval: parameters.maximum_interval,
    enableFuzz: parameters.enable_fuzz,
    learningSteps: [...parameters.learning_steps],
    relearningSteps: [...parameters.relearning_steps],
    weights: [...parameters.w],
  },
};

function stage(value: number): CustomSrsStage {
  return Math.max(0, Math.min(9, Math.trunc(value))) as CustomSrsStage;
}

function topOfHour(date: Date) {
  const rounded = new Date(date);
  rounded.setMinutes(0, 0, 0);
  return rounded;
}

function serializeCard(card: Card): SerializedFsrsCard {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    elapsed_days: card.elapsed_days,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: State[card.state] as SerializedFsrsCard["state"],
    ...(card.last_review ? { last_review: card.last_review.toISOString() } : {}),
  };
}

function hydrateCard(card: SerializedFsrsCard): CardInput {
  return {
    ...card,
    due: card.due,
    last_review: card.last_review ?? null,
  };
}

function schedule(card: CardInput | Card, now: Date, rating: Grade) {
  const result = scheduler.next(card, now, rating);
  const due = topOfHour(result.card.due);
  return {
    card: serializeCard({ ...result.card, due }),
    due,
    rating: Rating[rating] as "Again" | "Hard" | "Good" | "Easy",
  };
}

export function introduceCustomCard(now: Date) {
  const due = topOfHour(new Date(now.getTime() + 4 * 60 * 60_000));
  const card = createEmptyCard(now);
  return {
    card: serializeCard({ ...card, due, state: State.Learning }),
    due,
    rating: "Manual" as const,
  };
}

export function reviewCustomCard(card: SerializedFsrsCard, now: Date, correct: boolean) {
  return schedule(hydrateCard(card), now, correct ? Rating.Good : Rating.Again);
}

export function nextCustomSrsStage(current: CustomSrsStage, incorrectAnswers: number) {
  if (incorrectAnswers <= 0) return stage(current + 1);
  const penalty = Math.ceil(incorrectAnswers / 2) * (current >= 5 ? 2 : 1);
  return stage(Math.max(1, current - penalty));
}
