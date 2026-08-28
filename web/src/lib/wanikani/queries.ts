import { queryOptions } from "@tanstack/react-query";
import { wkCollection, wkRequest } from "./client";
import type { Assignment, LevelProgression, ReviewStatistic, Subject, WKCollection, WKSummary, WKUser } from "@/types/wanikani";

export const AVAILABLE_REVIEW_ASSIGNMENT_FILTERS = "immediately_available_for_review=true&hidden=false";

export const wkKeys = {
  root: ["wanikani"] as const,
  user: () => [...wkKeys.root, "user"] as const,
  summary: () => [...wkKeys.root, "summary"] as const,
  assignments: (filters?: string) => filters === undefined
    ? [...wkKeys.root, "assignments"] as const
    : [...wkKeys.root, "assignments", filters] as const,
  availableReviewCount: () => [...wkKeys.root, "assignments", "available-review-count"] as const,
  subjects: (filters = "all") => [...wkKeys.root, "subjects", filters] as const,
  statistics: () => [...wkKeys.root, "review-statistics"] as const,
  levelProgressions: () => [...wkKeys.root, "level-progressions"] as const,
};

export const userQuery = () => queryOptions({
  queryKey: wkKeys.user(),
  queryFn: () => wkRequest<WKUser>("user", { cache: "no-store", fresh: true }),
  staleTime: 0,
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: true,
  refetchInterval: 60_000,
});
export const summaryQuery = () => queryOptions({ queryKey: wkKeys.summary(), queryFn: () => wkRequest<WKSummary>("summary"), staleTime: 5 * 60_000 });
export const assignmentsQuery = (filters = "") => queryOptions({ queryKey: wkKeys.assignments(filters), queryFn: () => wkCollection<Assignment>(`assignments${filters ? `?${filters}` : ""}`), staleTime: 5 * 60_000 });
export async function fetchAvailableReviewCount() {
  const response = await wkRequest<WKCollection<Assignment>>(`assignments?${AVAILABLE_REVIEW_ASSIGNMENT_FILTERS}`, { cache: "no-store", fresh: true });
  return response.total_count;
}
export const availableReviewCountQuery = () => queryOptions({
  queryKey: wkKeys.availableReviewCount(),
  queryFn: fetchAvailableReviewCount,
  staleTime: 30_000,
  refetchOnMount: "always" as const,
  refetchOnWindowFocus: "always" as const,
  refetchInterval: 60_000,
});
export const subjectsQuery = (filters = "") => queryOptions({ queryKey: wkKeys.subjects(filters), queryFn: () => wkCollection<Subject>(`subjects${filters ? `?${filters}` : ""}`), staleTime: 24 * 60 * 60_000 });
export const reviewStatisticsQuery = () => queryOptions({ queryKey: wkKeys.statistics(), queryFn: () => wkCollection<ReviewStatistic>("review_statistics"), staleTime: 15 * 60_000 });
export const levelProgressionsQuery = () => queryOptions({ queryKey: wkKeys.levelProgressions(), queryFn: () => wkCollection<LevelProgression>("level_progressions"), staleTime: 60 * 60_000 });
