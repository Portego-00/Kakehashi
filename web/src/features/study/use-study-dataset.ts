"use client";

import { useQuery } from "@tanstack/react-query";
import { assignmentsQuery, subjectsQuery } from "@/lib/wanikani/queries";
import { useSession } from "@/lib/session";

export function useStudyDataset() {
  const { status, user } = useSession();
  const enabled = status === "authenticated";
  const subjects = useQuery({ ...subjectsQuery(), enabled });
  const assignments = useQuery({ ...assignmentsQuery(), enabled });
  return {
    status,
    user,
    dataset: subjects.data && assignments.data ? { subjects: subjects.data, assignments: assignments.data } : null,
    loading: status === "loading" || (enabled && (subjects.isLoading || assignments.isLoading)),
    fetching: subjects.isFetching || assignments.isFetching,
    error: subjects.error ?? assignments.error,
    retry: () => Promise.all([subjects.refetch(), assignments.refetch()]),
  };
}
