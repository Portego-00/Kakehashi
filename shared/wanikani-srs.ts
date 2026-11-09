type AssignmentStage = { data: { subject_id: number; srs_stage: number } };

// A resurrected assignment can still have its original burned_at timestamp.
export function isBurnedSrsStage(stage?: number) {
  return stage === 9;
}

export function burnedSubjectIds(assignments: readonly AssignmentStage[]) {
  const ids = new Set<number>();
  for (const { data } of assignments) {
    if (isBurnedSrsStage(data.srs_stage)) ids.add(data.subject_id);
  }
  return ids;
}
