import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { assignmentsQuery, subjectsQuery } from "@/lib/wanikani/queries";
import type { Subject } from "@/types/wanikani";
import type { QuestionKind } from "./answer-checker";
import { createReviewAnswerChoices, type ReviewAnswerChoice } from "../../../../src/utils/review-multiple-choice";

/** Keep the displayed options in place through catalog refreshes and synonym edits. */
export function useStableReviewChoices(generated: ReviewAnswerChoice[], questionKey: string, enabled: boolean) {
  const [shown, setShown] = useState<{ questionKey: string; choices: ReviewAnswerChoice[] } | null>(null);
  if (enabled && shown?.questionKey !== questionKey && generated.length === 4) {
    setShown({ questionKey, choices: generated });
  }
  return enabled && shown?.questionKey === questionKey ? shown.choices : generated;
}

export function useReviewChoices({ enabled, subject, kind, questionKey, meaningSynonyms }: {
  enabled: boolean;
  subject?: Subject | null;
  kind?: QuestionKind;
  questionKey: string;
  meaningSynonyms?: readonly string[];
}) {
  const [seed] = useState(() => String(Math.random()));
  const active = enabled && Boolean(subject && kind);
  const catalog = useQuery({ ...subjectsQuery(), enabled: active, retry: 1 });
  const assignments = useQuery({ ...assignmentsQuery("started=true"), enabled: active, retry: 1 });
  const loading = active && ((catalog.data === undefined && !catalog.isError) || (assignments.data === undefined && !assignments.isError));
  const learnedSubjectIds = useMemo(() => new Set(
    (assignments.data ?? []).filter((assignment) => assignment.data.srs_stage > 0).map((assignment) => assignment.data.subject_id),
  ), [assignments.data]);
  const generated = useMemo(() => active && !loading && subject && kind ? createReviewAnswerChoices({
    subject, questionType: kind, subjects: catalog.data ?? [], learnedSubjectIds, meaningSynonyms, seed: `${seed}:${questionKey}`,
  }) : [], [active, loading, subject, kind, catalog.data, learnedSubjectIds, meaningSynonyms, seed, questionKey]);
  const choices = useStableReviewChoices(generated, questionKey, active);
  return { choices, loading, available: active && choices.length === 4 };
}
