export const LESSON_SRS_THRESHOLD_MAX = 9999;

type AssignmentWithSrsStage = {
  data?: {
    hidden?: boolean;
    srs_stage?: number;
  };
};

export type LessonSrsThresholdStatus = {
  apprenticeCount: number;
  guruCount: number;
  apprenticeThreshold: number;
  guruThreshold: number;
  apprenticeExceeded: boolean;
  guruExceeded: boolean;
  isBlocked: boolean;
};

export function normalizeLessonSrsThreshold(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(LESSON_SRS_THRESHOLD_MAX, Math.floor(value));
}

export function getLessonSrsThresholdStatus(
  assignments: readonly AssignmentWithSrsStage[] | null | undefined,
  apprenticeThreshold: number,
  guruThreshold: number,
): LessonSrsThresholdStatus {
  let apprenticeCount = 0;
  let guruCount = 0;

  for (const assignment of assignments ?? []) {
    if (assignment?.data?.hidden) {
      continue;
    }

    const srsStage = assignment?.data?.srs_stage;
    if (typeof srsStage !== "number") {
      continue;
    }

    if (srsStage >= 1 && srsStage <= 4) {
      apprenticeCount += 1;
    } else if (srsStage >= 5 && srsStage <= 6) {
      guruCount += 1;
    }
  }

  const normalizedApprenticeThreshold = normalizeLessonSrsThreshold(
    apprenticeThreshold,
  );
  const normalizedGuruThreshold = normalizeLessonSrsThreshold(guruThreshold);
  const apprenticeExceeded =
    normalizedApprenticeThreshold > 0 &&
    apprenticeCount > normalizedApprenticeThreshold;
  const guruExceeded =
    normalizedGuruThreshold > 0 && guruCount > normalizedGuruThreshold;

  return {
    apprenticeCount,
    guruCount,
    apprenticeThreshold: normalizedApprenticeThreshold,
    guruThreshold: normalizedGuruThreshold,
    apprenticeExceeded,
    guruExceeded,
    isBlocked: apprenticeExceeded || guruExceeded,
  };
}
