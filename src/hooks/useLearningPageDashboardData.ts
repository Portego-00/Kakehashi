import { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { getPendingProgressAssignmentIds } from "../services/offlineStudyProgressService";
import { getLiveAvailableReviews } from "../utils/api";
import { getFromPermanentStorage, saveToPermanentStorage } from "../utils/permanentStorage";
import {
  applyLearningPageToDashboardData,
  type LearningPage,
  type LearningPageDashboardSource,
  type LearningPageQueueState,
  type LearningPageReviewQueue,
} from "../utils/learningPages";

type QueueState = LearningPageQueueState & { scope: string };

function isReviewQueue(value: LearningPageReviewQueue | undefined): value is LearningPageReviewQueue {
  return Boolean(value && Number.isFinite(Date.parse(value.capturedAt)) &&
    Array.isArray(value.assignments) && value.assignments.every((assignment) =>
      typeof assignment?.id === "number" && typeof assignment.data?.subject_id === "number"));
}

export function useLearningPageDashboardData<T extends LearningPageDashboardSource>(
  dashboardData: T,
  page: LearningPage | null,
  apiToken: string | null,
  accountId?: string | number | null,
): T {
  const [state, setState] = useState<QueueState>();
  const enabled = page !== null;
  const scope = JSON.stringify([accountId, apiToken]);

  useFocusEffect(useCallback(() => {
    if (!enabled || !apiToken || accountId == null) return;
    if (dashboardData.assignments.length === 0 && dashboardData.lessonCount === 0 &&
        dashboardData.reviewCount === 0 && !dashboardData.pendingLessonSyncCount &&
        !dashboardData.pendingReviewSyncCount) return;
    let active = true;
    const cacheKey = `learning_page_review_queue:${accountId}`;

    const load = async () => {
      try {
        const [pending, cached] = await Promise.all([
          getPendingProgressAssignmentIds(apiToken),
          getFromPermanentStorage<LearningPageReviewQueue>(cacheKey, { ignoreTTL: true }).catch(() => null),
        ]);
        if (!active) return;
        const cachedQueue = cached?.data;
        setState((previous) => ({
          scope,
          reviewQueue: previous?.scope === scope && previous.reviewQueue
            ? previous.reviewQueue
            : isReviewQueue(cachedQueue) ? cachedQueue : undefined,
          pendingLessonAssignmentIds: pending.lesson,
          pendingReviewAssignmentIds: pending.review,
        }));

        const capturedAt = new Date().toISOString();
        const localBaseline = new Map<number, LearningPageReviewQueue["assignments"][number]>(dashboardData.assignments.map(({ id, data }) => [id, { id, data: {
          subject_id: data.subject_id,
          srs_stage: data.srs_stage,
          available_at: data.available_at,
          started_at: data.started_at,
          hidden: data.hidden,
        } }]));
        const response = await getLiveAvailableReviews(apiToken);
        const latestPending = await getPendingProgressAssignmentIds(apiToken);
        if (!active) return;
        const reviewQueue: LearningPageReviewQueue = {
          capturedAt,
          localAssignmentBaseline: response.data.flatMap(({ id }) => {
            const baseline = localBaseline.get(id);
            return baseline ? [baseline] : [];
          }),
          assignments: response.data.map(({ id, data, data_updated_at }) => ({ id, data_updated_at, data: {
            subject_id: data.subject_id,
            srs_stage: data.srs_stage,
            available_at: data.available_at,
            started_at: data.started_at,
            hidden: data.hidden,
          } })),
        };
        setState({
          scope,
          reviewQueue,
          pendingLessonAssignmentIds: latestPending.lesson,
          pendingReviewAssignmentIds: latestPending.review,
        });
        await saveToPermanentStorage(cacheKey, reviewQueue, capturedAt);
      } catch {
        // The last visible queue and local completions remain usable offline.
        // A failed live request must never become an authoritative empty queue.
      }
    };
    void load();
    return () => { active = false; };
  }, [accountId, apiToken, dashboardData.assignments, dashboardData.lessonCount,
    dashboardData.reviewCount, dashboardData.pendingLessonSyncCount,
    dashboardData.pendingReviewSyncCount, enabled, scope]));

  return useMemo(() => applyLearningPageToDashboardData(
    dashboardData, page, new Date(), state?.scope === scope ? state : undefined,
  ), [dashboardData, page, scope, state]);
}
