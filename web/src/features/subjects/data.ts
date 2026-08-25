"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { assignmentsQuery, reviewStatisticsQuery, subjectsQuery } from "@/lib/wanikani/queries";
import type { Assignment, ReviewStatistic, Subject } from "@/types/wanikani";

export function useSubjectCatalog() {
  const subjects = useQuery(subjectsQuery());
  const assignments = useQuery(assignmentsQuery());
  const statistics = useQuery(reviewStatisticsQuery());
  const data = useMemo(() => ({
    subjects: (subjects.data ?? []) as Subject[],
    assignments: (assignments.data ?? []) as Assignment[],
    statistics: (statistics.data ?? []) as ReviewStatistic[],
  }), [assignments.data, statistics.data, subjects.data]);
  return {
    ...data,
    isLoading: subjects.isLoading || assignments.isLoading || statistics.isLoading,
    isError: subjects.isError || assignments.isError || statistics.isError,
  };
}
