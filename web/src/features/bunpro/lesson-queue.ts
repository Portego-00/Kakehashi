import type { BunproQueueDeckSummary, BunproQueueSummary } from "../../../../src/utils/bunproQueue";

export function selectBunproLessonDeck(summary: BunproQueueSummary, preferredDeckId?: number) {
  const available = summary.queue.filter((deck) => deck.deckId !== null && !deck.isFinished);
  return available.find((deck) => deck.deckId === preferredDeckId)
    ?? available.find((deck) => deck.remaining > 0)
    ?? available[0]
    ?? null;
}

export function getBunproLessonBatchSize(deck: BunproQueueDeckSummary | null) {
  if (!deck || deck.isFinished) return 0;
  // The daily goal limits its final batch, but reaching it does not finish the deck.
  const remaining = deck.remaining || deck.remainingItemsInDeck || deck.batchSize;
  return Math.min(remaining, deck.batchSize || remaining, deck.remainingItemsInDeck || remaining);
}
