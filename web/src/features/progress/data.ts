"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { assignmentsQuery, reviewStatisticsQuery, subjectsQuery } from "@/lib/wanikani/queries";
import { wkCollection } from "@/lib/wanikani/client";
import type { Assignment, ReviewStatistic, Subject, WKResource } from "@/types/wanikani";
import type { LevelProgressionLike } from "./calculations";

type LevelProgression = WKResource<LevelProgressionLike["data"], "level_progression">;
export type ResetRecord = WKResource<{ original_level: number; target_level: number; confirmed_at: string; created_at: string }, "reset">;

export function useProgressData() {
  const assignments = useQuery(assignmentsQuery());
  const subjects = useQuery(subjectsQuery());
  const statistics = useQuery(reviewStatisticsQuery());
  const progressions = useQuery({
    queryKey: ["wanikani", "level-progressions"],
    queryFn: () => wkCollection<LevelProgression>("level_progressions"),
    staleTime: 30 * 60_000,
  });
  const resets = useQuery({
    queryKey: ["wanikani", "resets"],
    queryFn: () => wkCollection<ResetRecord>("resets"),
    staleTime: 60 * 60_000,
  });

  const data = useMemo(() => ({
    assignments: (assignments.data ?? []) as Assignment[],
    subjects: (subjects.data ?? []) as Subject[],
    statistics: (statistics.data ?? []) as ReviewStatistic[],
    progressions: (progressions.data ?? []) as LevelProgressionLike[],
    resets: (resets.data ?? []) as ResetRecord[],
  }), [assignments.data, progressions.data, resets.data, statistics.data, subjects.data]);

  return {
    ...data,
    isLoading: assignments.isLoading || subjects.isLoading || statistics.isLoading || progressions.isLoading || resets.isLoading,
    isError: assignments.isError || subjects.isError || statistics.isError || progressions.isError || resets.isError,
    error: assignments.error || subjects.error || statistics.error || progressions.error || resets.error,
    retry: async () => {
      await Promise.all([
        assignments.refetch(),
        subjects.refetch(),
        statistics.refetch(),
        progressions.refetch(),
        resets.refetch(),
      ]);
    },
  };
}
