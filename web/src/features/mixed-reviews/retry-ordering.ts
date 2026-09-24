import { eligibleReviewEntries, type ReviewRetry } from "@/features/study/review-queue";
import type { MixedHead } from "./ordering";

export type MixedPendingQuestion = { id: string; subjectId: string; open: boolean };
export type MixedRetry = ReviewRetry;
export const mixedRetryKey = (lane: string, id: string) => `${lane}:${id}`;

/** Select eligible queue entries using the shared mixed-session question clock. */
export function mixedRetryCandidates<T extends string>(available: { lane: T; head: MixedHead }[], retries: Map<string, MixedRetry>, turn: number) {
  const entries = available.flatMap(({ lane, head }) => (head.pending ?? [{ id: head.id, subjectId: `${lane}:${head.id}`, open: false }]).map(question => ({ lane, head, question, open: question.open, subjectId: `${lane}:${question.subjectId}`, retry: retries.get(mixedRetryKey(lane, question.id)) })));
  const candidates = eligibleReviewEntries(entries, turn);
  // One candidate per service preserves its order and the weighted source draw.
  return available.flatMap(({ lane }) => {
    const entry = candidates.find(candidate => candidate.lane === lane);
    return entry ? [entry] : [];
  });
}
