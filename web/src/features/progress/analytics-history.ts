"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { isDemoMode } from "@/features/demo/runtime";
import { WaniKaniApiError, wkCollection } from "@/lib/wanikani/client";
import type { Review, SpacedRepetitionSystem } from "@/types/wanikani";
import { useReviewLedger } from "./analytics-review-ledger";

export type ReviewHistoryAvailability = "available" | "unavailable" | "loading" | "error";
const EMPTY_REVIEWS: Review[] = [];
const EMPTY_SYSTEMS: SpacedRepetitionSystem[] = [];

export function reviewHistoryAvailability(reviews: Review[], hasLifetimeReviews: boolean, isDemo = false): "available" | "unavailable" {
  // WaniKani deprecated GET /reviews and returns an empty collection even when
  // lifetime statistics prove reviews were completed. Zero is not history.
  return reviews.length || !hasLifetimeReviews || isDemo ? "available" : "unavailable";
}

function retryHistory(failureCount: number, error: Error) {
  if (error instanceof WaniKaniApiError && [401, 403, 404, 410, 422].includes(error.status)) return false;
  return failureCount < 2;
}

export const analyticsHistoryQuery = (accountKey: string) => queryOptions({
  queryKey: ["wanikani", "analytics-history", accountKey] as const,
  queryFn: ({ signal }) => wkCollection<Review>("reviews", Infinity, { signal }),
  enabled: Boolean(accountKey),
  staleTime: 15 * 60_000,
  gcTime: 60 * 60_000,
  retry: retryHistory,
  retryDelay: (attemptIndex, error) => error instanceof WaniKaniApiError && error.retryAfterMs !== undefined
    ? Math.max(1000, error.retryAfterMs) : Math.min(1000 * 2 ** attemptIndex, 30_000),
});

export const analyticsSystemsQuery = (accountKey: string) => queryOptions({
  queryKey: ["wanikani", "analytics-srs-systems", accountKey] as const,
  queryFn: ({ signal }) => wkCollection<SpacedRepetitionSystem>("spaced_repetition_systems", Infinity, { signal }),
  enabled: Boolean(accountKey),
  staleTime: 24 * 60 * 60_000,
  retry: retryHistory,
});

export function useAnalyticsHistory(accountKey = "", hasLifetimeReviews = false) {
  const history = useQuery(analyticsHistoryQuery(accountKey));
  const systems = useQuery(analyticsSystemsQuery(accountKey));
  const ledger = useReviewLedger(accountKey);
  const demo = isDemoMode();
  const source: "api" | "device" | "demo" | "unavailable" = demo ? "demo" : history.data?.length ? "api" : ledger.recordingStartedAt ? "device" : "unavailable";
  const reviews = useMemo(() => {
    if (demo) return history.data ?? EMPTY_REVIEWS;
    if (!history.data?.length) return ledger.reviews;
    const combined = new Map(history.data.map((review) => [review.id, review]));
    for (const review of ledger.reviews) combined.set(review.id, review);
    return [...combined.values()].sort((a, b) => Date.parse(a.data.created_at) - Date.parse(b.data.created_at));
  }, [demo, history.data, ledger.reviews]);
  const unavailableStatus = history.error instanceof WaniKaniApiError && [403, 404, 410].includes(history.error.status);
  const availability: ReviewHistoryAvailability = source === "device" ? "available" : history.isPending ? "loading"
    : unavailableStatus ? "unavailable"
      : history.isError ? "error"
        : reviewHistoryAvailability(history.data ?? EMPTY_REVIEWS, hasLifetimeReviews, demo);
  return {
    reviews,
    source,
    recordingStartedAt: source === "device" ? ledger.recordingStartedAt : null,
    truncatedBefore: source === "device" ? ledger.truncatedBefore : null,
    persistence: ledger.persistence,
    systems: systems.data ?? EMPTY_SYSTEMS,
    availability,
    isLoading: history.isLoading || systems.isLoading,
    isError: (history.isError && !unavailableStatus) || systems.isError,
    error: (!unavailableStatus && history.error) || systems.error || null,
    systemsError: systems.error,
    retry: async () => { await Promise.all([history.refetch({ throwOnError: true }), systems.refetch({ throwOnError: true })]); },
  };
}
