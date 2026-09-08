"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { subjectsWithNotebookSentences } from "@/features/notebooks/study-integration";
import { useNotebooks } from "@/features/notebooks/use-notebooks";
import { assignmentsQuery, subjectsQuery } from "@/lib/wanikani/queries";
import { useSession } from "@/lib/session";

export function useStudyDataset() {
  const { status, user } = useSession();
  const enabled = status === "authenticated";
  const subjects = useQuery({ ...subjectsQuery(), enabled });
  const assignments = useQuery({ ...assignmentsQuery(), enabled });
  const notebook = useNotebooks();
  const studySubjects = useMemo(() => subjects.data ? subjectsWithNotebookSentences(subjects.data, notebook.state.sentences) : null, [subjects.data, notebook.state.sentences]);
  return {
    status,
    user,
    dataset: studySubjects && assignments.data ? { subjects: studySubjects, assignments: assignments.data } : null,
    loading: status === "loading" || (enabled && (subjects.isLoading || assignments.isLoading || notebook.isLoading)),
    fetching: subjects.isFetching || assignments.isFetching,
    error: subjects.error ?? assignments.error,
    retry: () => Promise.all([subjects.refetch(), assignments.refetch()]),
  };
}
