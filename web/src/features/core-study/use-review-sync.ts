"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Assignment, ReviewCreateResponse } from "@/types/wanikani";
import { wkRequest } from "@/lib/wanikani/client";
import { deliverReview, type ReviewOutboxEntry } from "./review-outbox";
import { createReviewSync, REVIEW_PERMISSION_MESSAGE } from "./review-sync";

export type ReviewConfirmation = { stage?: number; availableAt?: string | null };

export function useReviewSync(username: string, enabled: boolean, onConfirmed: (entry: ReviewOutboxEntry, confirmation: ReviewConfirmation) => void) {
  const [pendingCount, setPendingCount] = useState(0);
  const [permissionError, setPermissionError] = useState("");
  const callback = useRef(onConfirmed);
  useEffect(() => { callback.current = onConfirmed; }, [onConfirmed]);
  const worker = useRef<ReturnType<typeof createReviewSync<ReviewConfirmation>> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const sync = createReviewSync<ReviewConfirmation>({
      storage: window.localStorage,
      username,
      onChange: setPendingCount,
      onPermissionError: () => setPermissionError(REVIEW_PERMISSION_MESSAGE),
      onConfirmed: (entry, confirmation) => callback.current(entry, confirmation),
      deliver: async (entry, signal) => {
        let response: ReviewCreateResponse | undefined;
        let assignment: Assignment | undefined;
        const requestSignal = () => AbortSignal.any([signal, AbortSignal.timeout(15_000)]);
        await deliverReview(entry, {
          readAssignment: async (id) => {
            signal.throwIfAborted();
            assignment = await wkRequest<Assignment>(`assignments/${id}`, { cache: "no-store", fresh: true, signal: requestSignal() });
            return assignment;
          },
          submitReview: async (row) => {
            signal.throwIfAborted();
            response = await wkRequest<ReviewCreateResponse>("reviews", { signal: requestSignal(), method: "POST", body: { review: { assignment_id: row.assignmentId, incorrect_meaning_answers: row.incorrectMeaningAnswers, incorrect_reading_answers: row.incorrectReadingAnswers, created_at: row.createdAt } } });
          },
        });
        return { stage: response?.data.ending_srs_stage ?? assignment?.data.srs_stage, availableAt: response?.resources_updated?.assignment?.data.available_at ?? assignment?.data.available_at };
      },
    });
    worker.current = sync;
    sync.retryPending();
    const online = () => sync.retryPending();
    window.addEventListener("online", online);
    return () => { worker.current = null; sync.dispose(); window.removeEventListener("online", online); };
  }, [enabled, username]);

  const enqueue = useCallback((entry: Omit<ReviewOutboxEntry, "attempts" | "lastError">) => {
    if (!worker.current) throw new Error("Review saving is not ready. Please try again.");
    worker.current.enqueue(entry);
  }, []);
  const finish = useCallback(() => worker.current?.finish(), []);
  return { pendingCount, permissionError, enqueue, finish };
}
