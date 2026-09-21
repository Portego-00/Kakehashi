import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type CardInput, type Grade } from "ts-fsrs";
import type { CustomSrsPolicyMetadata, LegacyCustomSrsPolicyMetadata, CustomSrsStage, SerializedFsrsCard } from "./types";

import { settingsForPolicy, stepMinutes } from "./srs-settings";

const parameters = generatorParameters({
  enable_fuzz: false,
  enable_short_term: true,
  learning_steps: ["4h", "8h"],
  relearning_steps: ["4h"],
  maximum_interval: 36_500,
  request_retention: 0.9,
});
const scheduler = fsrs(parameters);

export const CUSTOM_SRS_POLICY: LegacyCustomSrsPolicyMetadata = {
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

function schedule(card: CardInput | Card, now: Date, rating: Grade, policy: CustomSrsPolicyMetadata) {
  const settings = settingsForPolicy(policy);
  const engine = policy.version === 1 ? scheduler : fsrs(generatorParameters({
    enable_fuzz: false, enable_short_term: true,
    learning_steps: settings.learningSteps as typeof parameters.learning_steps,
    relearning_steps: settings.relearningSteps as typeof parameters.relearning_steps,
    maximum_interval: settings.maximumInterval, request_retention: settings.requestRetention,
  }));
  // A shorter step list can be selected while a card is still learning.
  const limit = card.state === "Relearning" || card.state === State.Relearning ? settings.relearningSteps.length : settings.learningSteps.length;
  const input = policy.version === 1 ? card : { ...card, learning_steps: Math.min(card.learning_steps ?? 0, limit - 1) };
  const result = engine.next(input, now, rating);
  // FSRS can separate Good/Easy by a day even at the configured cap.
  // Enforce the user's ceiling on the actual Review card, not just engine parameters.
  const capped = policy.version === 2 && result.card.state === State.Review;
  const latest = now.getTime() + settings.maximumInterval * 86400_000;
  const due = roundedDue(capped ? new Date(Math.min(result.card.due.getTime(), latest)) : result.card.due, now, settings.roundToHour);
  return {
    card: serializeCard({ ...result.card, due, ...(capped ? { scheduled_days: Math.min(result.card.scheduled_days, settings.maximumInterval) } : {}) }),
    due,
    rating: Rating[rating] as "Again" | "Hard" | "Good" | "Easy",
  };
}

function roundedDue(due: Date, now: Date, round: boolean) {
  const rounded = round ? topOfHour(due) : due;
  // Short learning steps must never be rounded into the past or made immediately due.
  return rounded > now ? rounded : due;
}

export function introduceCustomCard(now: Date, policy: CustomSrsPolicyMetadata = CUSTOM_SRS_POLICY) {
  const settings = settingsForPolicy(policy);
  const minutes = settings.mode === "wanikani" ? settings.stageIntervals[0] : stepMinutes(settings.learningSteps[0]);
  const due = roundedDue(new Date(now.getTime() + minutes * 60_000), now, settings.roundToHour);
  const card = createEmptyCard(now);
  return {
    card: serializeCard({ ...card, due, state: State.Learning }),
    due,
    rating: "Manual" as const,
  };
}

export function reviewCustomCard(card: SerializedFsrsCard, now: Date, correct: boolean, policy: CustomSrsPolicyMetadata = CUSTOM_SRS_POLICY, endingStage: CustomSrsStage = 1) {
  const result = schedule(hydrateCard(card), now, correct ? Rating.Good : Rating.Again, policy);
  const settings = settingsForPolicy(policy);
  if (settings.mode === "fsrs") return result;
  const due = roundedDue(new Date(now.getTime() + settings.stageIntervals[Math.min(8, endingStage) - 1] * 60_000), now, settings.roundToHour);
  return { ...result, due, card: { ...result.card, due: due.toISOString() } };
}

export function nextCustomSrsStage(current: CustomSrsStage, incorrectAnswers: number) {
  if (incorrectAnswers <= 0) return stage(current + 1);
  const penalty = Math.ceil(incorrectAnswers / 2) * (current >= 5 ? 2 : 1);
  return stage(Math.max(1, current - penalty));
}
