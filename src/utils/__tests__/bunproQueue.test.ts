import type { BunproQueueResponse } from "../../types/bunpro";
import { getBunproLessonBatchSize, getBunproLessonProgress, getBunproQueueProgress, selectBunproLessonDeck, summarizeBunproQueue } from "../bunproQueue";

function queue(learned = 4, completed = learned): BunproQueueResponse {
  return {
    data: [{ id: "1", type: "deck_setting", attributes: { id: 1, user_id: 1, deck_id: 5, batch_size: 2, default_srs_level: 0, sorting_order: "default", daily_goal: 4, daily_goal_count_grammar: learned, daily_goal_count_vocab: 0, complete_grammar_count: completed } }],
    included: [{ id: "5", type: "deck", attributes: { id: 5, slug: "n5", title: "N5 Grammar", grammar_count: 100, vocab_count: 0 } }],
  };
}

it.each([4, 6])("offers a configured extra batch after %i lessons against a goal of four", learned => {
  const summary = summarizeBunproQueue(queue(learned));
  expect(getBunproLessonBatchSize(selectBunproLessonDeck(summary))).toBe(2);
  expect(getBunproQueueProgress(summary)).toEqual({ done: learned, goal: learned, extra: learned - 4 });
});

it("limits batches to actual availability and excludes finished or exhausted decks", () => {
  expect(getBunproLessonBatchSize(selectBunproLessonDeck(summarizeBunproQueue(queue(6, 99))))).toBe(1);
  expect(selectBunproLessonDeck(summarizeBunproQueue(queue(6, 100)))).toBeNull();
  expect(selectBunproLessonDeck(summarizeBunproQueue(queue()), 5, [5])).toBeNull();
  expect(getBunproLessonProgress(summarizeBunproQueue(queue(6, 100)).queue[0])).toEqual({ done: 6, goal: 6, extra: 2 });
});

it("prioritizes unmet goals, respects an explicit deck choice, and sums progress across decks", () => {
  const response = queue(6);
  response.data.push({ ...response.data[0], id: "2", attributes: { ...response.data[0].attributes, deck_id: 6, daily_goal_count_grammar: 0 } });
  response.included!.push({ ...response.included![0], id: "6", attributes: { ...response.included![0].attributes, id: 6, title: "N4 Grammar" } });
  const summary = summarizeBunproQueue(response);
  expect(selectBunproLessonDeck(summary)?.deckId).toBe(6);
  expect(selectBunproLessonDeck(summary, 5)?.deckId).toBe(5);
  expect(getBunproQueueProgress(summary)).toEqual({ done: 6, goal: 10, extra: 2 });
});
