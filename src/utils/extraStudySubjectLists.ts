import { getSubjectIdSetForListIds } from "./subjectLists";

type SubjectAssignment = {
  data: {
    subject_id: number;
  };
};

export function parseSelectedListIds(rawValue: unknown): string[] {
  const rawIds = Array.isArray(rawValue)
    ? rawValue
    : typeof rawValue === "string"
      ? rawValue.split(",")
      : [];

  const ids = rawIds
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);

  return Array.from(new Set(ids));
}

export async function getSelectedListSubjectIdSet(
  selectedListIds: string[]
): Promise<Set<number>> {
  if (!selectedListIds.length) {
    return new Set();
  }
  return getSubjectIdSetForListIds(selectedListIds);
}

export function subjectMatchesSelectedLists(
  subjectId: number,
  selectedListIds: string[],
  selectedListSubjectIds: Set<number>
): boolean {
  if (!selectedListIds.length) {
    return true;
  }
  return selectedListSubjectIds.has(subjectId);
}

/**
 * A selected subject list is an explicit study source, not just an additional
 * filter over the user's unlocked assignments. This lets Extra Study include
 * list items from levels the user has not reached yet.
 */
export function getExtraStudyCandidateSubjectIds(
  assignments: SubjectAssignment[],
  selectedListIds: string[],
  selectedListSubjectIds: Set<number>,
): number[] {
  if (selectedListIds.length > 0) {
    return Array.from(selectedListSubjectIds);
  }

  return Array.from(
    new Set(
      assignments
        .map((assignment) => assignment.data.subject_id)
        .filter((subjectId) => Number.isInteger(subjectId) && subjectId > 0),
    ),
  );
}

export function subjectMatchesExtraStudyLevel(
  level: number | null | undefined,
  options: {
    useCustomLevelRange: boolean;
    minLevel: number;
    maxLevel: number;
    selectedListIds: string[];
    defaultMaxLevel?: number;
  },
): boolean {
  if (typeof level !== "number" || !Number.isFinite(level)) {
    return false;
  }

  if (options.useCustomLevelRange) {
    return level >= options.minLevel && level <= options.maxLevel;
  }

  if (options.selectedListIds.length > 0) {
    return true;
  }

  return options.defaultMaxLevel === undefined || level <= options.defaultMaxLevel;
}

/**
 * List items that have not been unlocked do not have an assignment/SRS stage.
 * Include those explicit selections while continuing to apply SRS filters to
 * list items that do have an assignment.
 */
export function subjectMatchesExtraStudySrsStage(
  subjectId: number,
  subjectIdToStage: ReadonlyMap<number, number>,
  selectedListIds: string[],
  selectedListSubjectIds: ReadonlySet<number>,
  isStageAllowed: (stage: number) => boolean,
): boolean {
  const stage = subjectIdToStage.get(subjectId);
  if (stage === undefined || stage <= 0) {
    return (
      selectedListIds.length > 0 && selectedListSubjectIds.has(subjectId)
    );
  }

  return isStageAllowed(stage);
}
