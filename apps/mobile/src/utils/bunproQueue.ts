import type {
  BunproDeckAttributes,
  BunproDeckSettingAttributes,
  BunproJsonApiResource,
  BunproQueueResponse,
} from "../types/bunpro";

export type BunproQueueDeckSummary = {
  key: string;
  deckId: number | null;
  deckTitle: string;
  dailyGoal: number;
  learnedTodayGrammar: number;
  learnedTodayVocab: number;
  learnedTodayCount: number;
  done: number;
  overflowed: number;
  remaining: number;
  batchSize: number;
  remainingItemsInDeck: number;
  isFinished: boolean;
  deckSetting: BunproJsonApiResource<BunproDeckSettingAttributes>;
  deck: BunproJsonApiResource<BunproDeckAttributes> | null;
};

export type BunproQueueSummary = {
  queue: BunproQueueDeckSummary[];
  next: BunproQueueDeckSummary | null;
  overall: {
    dailyGoal: number;
    done: number;
    learnedTodayCount: number;
    learnedTodayGrammar: number;
    learnedTodayVocab: number;
    remaining: number;
    overflowed: number;
    nextBatch: number;
  };
  allGoalsFinished: boolean;
  allDecksFinished: boolean;
  noDecksInQueue: boolean;
  noGoalsAtAll: boolean;
};

function readNonNegativeNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return 0;
  }

  return value;
}

function findDeckForSetting(
  included: BunproQueueResponse["included"],
  deckId: number
): BunproJsonApiResource<BunproDeckAttributes> | null {
  if (!included || deckId <= 0) {
    return null;
  }

  return (
    included.find((resource) => {
      const resourceId = Number(resource.id);
      const attributeId = readNonNegativeNumber(resource.attributes?.id);
      return resourceId === deckId || attributeId === deckId;
    }) ?? null
  );
}

export function summarizeBunproQueue(
  response: BunproQueueResponse | null | undefined
): BunproQueueSummary {
  const settings = response?.data ?? [];

  const queue = settings.map((setting, index) => {
    const attributes = setting.attributes;
    const deckId = readNonNegativeNumber(attributes.deck_id) || null;
    const deck = deckId ? findDeckForSetting(response?.included, deckId) : null;
    const deckAttributes = deck?.attributes;

    const totalDeckItems =
      readNonNegativeNumber(deckAttributes?.grammar_count) +
      readNonNegativeNumber(deckAttributes?.vocab_count);
    const completedDeckItems =
      readNonNegativeNumber(attributes.complete_grammar_count) +
      readNonNegativeNumber(attributes.complete_vocab_count);
    const remainingItemsInDeck =
      totalDeckItems > 0 ? Math.max(0, totalDeckItems - completedDeckItems) : 0;
    const isFinished = totalDeckItems > 0 && remainingItemsInDeck === 0;

    const rawDailyGoal = readNonNegativeNumber(attributes.daily_goal);
    const learnedTodayGrammar = readNonNegativeNumber(
      attributes.daily_goal_count_grammar
    );
    const learnedTodayVocab = readNonNegativeNumber(attributes.daily_goal_count_vocab);
    const learnedTodayCount = learnedTodayGrammar + learnedTodayVocab;
    const dailyGoal = isFinished ? learnedTodayCount : rawDailyGoal;
    const overflowed = Math.max(0, learnedTodayCount - dailyGoal);
    const done = Math.max(0, learnedTodayCount - overflowed);
    const remaining = Math.max(0, dailyGoal - done);
    const batchSize = readNonNegativeNumber(attributes.batch_size);

    return {
      key: String(setting.id || deckId || `deck-setting-${index}`),
      deckId,
      deckTitle: deckAttributes?.title ?? "Bunpro Lessons",
      dailyGoal,
      learnedTodayGrammar,
      learnedTodayVocab,
      learnedTodayCount,
      done,
      overflowed,
      remaining,
      batchSize,
      remainingItemsInDeck,
      isFinished,
      deckSetting: setting,
      deck,
    };
  });

  const next = queue.find((entry) => entry.remaining > 0 && !entry.isFinished) ?? null;
  const nextBatch =
    next && next.remaining > 0
      ? Math.min(next.remaining, next.batchSize > 0 ? next.batchSize : next.remaining)
      : 0;

  const overall = queue.reduce(
    (accumulator, entry) => ({
      dailyGoal: accumulator.dailyGoal + entry.dailyGoal,
      done: accumulator.done + entry.done,
      learnedTodayCount: accumulator.learnedTodayCount + entry.learnedTodayCount,
      learnedTodayGrammar:
        accumulator.learnedTodayGrammar + entry.learnedTodayGrammar,
      learnedTodayVocab: accumulator.learnedTodayVocab + entry.learnedTodayVocab,
      remaining: accumulator.remaining + entry.remaining,
      overflowed: accumulator.overflowed + entry.overflowed,
      nextBatch,
    }),
    {
      dailyGoal: 0,
      done: 0,
      learnedTodayCount: 0,
      learnedTodayGrammar: 0,
      learnedTodayVocab: 0,
      remaining: 0,
      overflowed: 0,
      nextBatch,
    }
  );

  return {
    queue,
    next,
    overall,
    allGoalsFinished: overall.remaining === 0,
    allDecksFinished: queue.length > 0 && queue.every((entry) => entry.isFinished),
    noDecksInQueue: queue.length === 0,
    noGoalsAtAll: queue.every((entry) => entry.dailyGoal === 0),
  };
}
