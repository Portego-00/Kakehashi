import { queryOptions } from "@tanstack/react-query";
import { wkCollection, wkRequest } from "./client";
import type { Assignment, ReviewStatistic, Subject, WKSummary, WKUser } from "@/types/wanikani";

export const wkKeys = {
  root: ["wanikani"] as const,
  user: () => [...wkKeys.root, "user"] as const,
  summary: () => [...wkKeys.root, "summary"] as const,
  assignments: (filters = "all") => [...wkKeys.root, "assignments", filters] as const,
  subjects: (filters = "all") => [...wkKeys.root, "subjects", filters] as const,
  statistics: () => [...wkKeys.root, "review-statistics"] as const,
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
export const subjectsQuery = (filters = "") => queryOptions({ queryKey: wkKeys.subjects(filters), queryFn: () => wkCollection<Subject>(`subjects${filters ? `?${filters}` : ""}`), staleTime: 24 * 60 * 60_000 });
export const reviewStatisticsQuery = () => queryOptions({ queryKey: wkKeys.statistics(), queryFn: () => wkCollection<ReviewStatistic>("review_statistics"), staleTime: 15 * 60_000 });
