import { buildReviewQuestionQueue, sortReviewItemsForQueue, type OrderableReviewItem, type ReviewQueueQuestion } from "./reviewOrdering";

/** Rebuild only pending sides; preserve the active occurrence and all graded work. */
export function reorderPendingReviewSession<T extends OrderableReviewItem & { submitted?: boolean; meaningDone?: boolean; readingDone?: boolean }>(
  queue: ReviewQueueQuestion[], items: T[], current: ReviewQueueQuestion | null,
  ordering: Parameters<typeof sortReviewItemsForQueue>[1], questions: Parameters<typeof buildReviewQuestionQueue>[1],
): ReviewQueueQuestion[] {
  const pendingIds = new Set(queue.map(question => question.itemId));
  const pendingItems = sortReviewItemsForQueue(items.filter(item => pendingIds.has(item.id) && !item.submitted), ordering);
  const byId = new Map(pendingItems.map(item => [item.id, item]));
  const remaining = buildReviewQuestionQueue(pendingItems, questions).filter(question => {
    const item = byId.get(question.itemId);
    if (!item || item.submitted) return false;
    if (current && question.itemId === current.itemId && (questions?.groupQuestions || question.type === current.type)) return false;
    return questions?.groupQuestions ? !item.meaningDone || !item.readingDone : question.type === "meaning" ? !item.meaningDone : !item.readingDone;
  });
  return current ? [current, ...remaining] : remaining;
}
