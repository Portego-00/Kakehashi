import {
  Assignment,
  CollectionResponse,
} from "../utils/api";
import { getFromCache, saveToCache } from "../utils/cache";
import {
  getFromPermanentStorage,
  PERMANENT_KEYS,
  saveAssignmentsToPermanentStorage,
} from "../utils/permanentStorage";

const ASSIGNMENTS_CACHE_KEY = "assignments_all";
const LESSON_FIRST_REVIEW_INTERVAL_HOURS = 4;

const SRS_INTERVALS_HOURS: Record<number, number | null> = {
  1: 4,
  2: 8,
  3: 23,
  4: 47,
  5: 167,
  6: 335,
  7: 719,
  8: 2879,
  9: null,
};

type AssignmentCacheMutation = {
  assignmentId: number;
  mutate: (assignment: Assignment, nowIso: string) => Assignment;
};

function addHours(dateIso: string, hours: number): string {
  const baseMs = Date.parse(dateIso);
  const normalizedBaseMs = Number.isFinite(baseMs) ? baseMs : Date.now();
  return new Date(normalizedBaseMs + hours * 60 * 60 * 1000).toISOString();
}

function calculateOptimisticReviewEndingStage(
  currentStage: number,
  meaningIncorrect: number,
  readingIncorrect: number
): number {
  const normalizedStage = Math.max(1, Math.min(9, Math.trunc(currentStage || 1)));
  const incorrectAdjustmentCount =
    (meaningIncorrect > 0 ? 1 : 0) + (readingIncorrect > 0 ? 1 : 0);

  if (incorrectAdjustmentCount === 0) {
    return Math.min(normalizedStage + 1, 9);
  }

  const penalty =
    Math.floor(incorrectAdjustmentCount / 2) + Math.ceil(normalizedStage / 2);
  return Math.max(normalizedStage - penalty, 1);
}

function getNextReviewAvailableAt(
  srsStage: number,
  completedAt: string
): string | null {
  const intervalHours = SRS_INTERVALS_HOURS[srsStage] ?? null;
  if (intervalHours === null) {
    return null;
  }
  return addHours(completedAt, intervalHours);
}

function updateAssignmentsArray(
  assignments: Assignment[],
  mutation: AssignmentCacheMutation,
  nowIso: string
): { assignments: Assignment[]; changed: boolean } {
  let changed = false;
  const updatedAssignments = assignments.map((assignment) => {
    if (assignment.id !== mutation.assignmentId) {
      return assignment;
    }

    changed = true;
    return mutation.mutate(assignment, nowIso);
  });

  return { assignments: updatedAssignments, changed };
}

async function updateAssignmentCaches(
  mutation: AssignmentCacheMutation
): Promise<void> {
  const nowIso = new Date().toISOString();
  let latestAssignments: Assignment[] | null = null;

  const cachedCollection = await getFromCache<CollectionResponse<Assignment>>(
    ASSIGNMENTS_CACHE_KEY,
    undefined,
    { ignoreTTL: true }
  );

  if (cachedCollection?.data?.data) {
    const updated = updateAssignmentsArray(
      cachedCollection.data.data,
      mutation,
      nowIso
    );

    if (updated.changed) {
      latestAssignments = updated.assignments;
      await saveToCache(
        ASSIGNMENTS_CACHE_KEY,
        {
          ...cachedCollection.data,
          data: updated.assignments,
        },
        cachedCollection.data.data_updated_at
      );
    }
  }

  const permanentEntry = await getFromPermanentStorage<Assignment[]>(
    PERMANENT_KEYS.ALL_ASSIGNMENTS,
    { ignoreTTL: true }
  );

  if (permanentEntry?.data) {
    const updated = updateAssignmentsArray(
      permanentEntry.data,
      mutation,
      nowIso
    );

    if (updated.changed) {
      latestAssignments = updated.assignments;
      await saveAssignmentsToPermanentStorage(
        updated.assignments,
        permanentEntry.dataUpdatedAt
      );
    }
  } else if (latestAssignments) {
    await saveAssignmentsToPermanentStorage(latestAssignments, nowIso);
  }
}

export async function markLessonStartedInAssignmentCaches({
  assignmentId,
  startedAt,
}: {
  assignmentId: number;
  startedAt: string;
}): Promise<void> {
  await updateAssignmentCaches({
    assignmentId,
    mutate: (assignment, nowIso) => {
      const effectiveStartedAt = assignment.data.started_at ?? startedAt;
      return {
        ...assignment,
        data_updated_at: nowIso,
        data: {
          ...assignment.data,
          started_at: effectiveStartedAt,
          srs_stage: Math.max(assignment.data.srs_stage ?? 0, 1),
          available_at: addHours(
            effectiveStartedAt,
            LESSON_FIRST_REVIEW_INTERVAL_HOURS
          ),
        },
      };
    },
  });
}

export async function markReviewSubmittedInAssignmentCaches({
  assignmentId,
  meaningIncorrectCount,
  readingIncorrectCount,
  completedAt,
  currentSrsStage,
  endingSrsStage,
  nextReviewAt,
}: {
  assignmentId: number;
  meaningIncorrectCount: number;
  readingIncorrectCount: number;
  completedAt: string;
  currentSrsStage?: number;
  endingSrsStage?: number;
  nextReviewAt?: string | null;
}): Promise<void> {
  await updateAssignmentCaches({
    assignmentId,
    mutate: (assignment, nowIso) => {
      const endingStage =
        endingSrsStage ??
        calculateOptimisticReviewEndingStage(
          currentSrsStage ?? assignment.data.srs_stage ?? 1,
          meaningIncorrectCount,
          readingIncorrectCount
        );
      const resolvedNextReviewAt =
        nextReviewAt ?? getNextReviewAvailableAt(endingStage, completedAt);

      return {
        ...assignment,
        data_updated_at: nowIso,
        data: {
          ...assignment.data,
          srs_stage: endingStage,
          available_at: resolvedNextReviewAt,
          passed_at:
            !assignment.data.passed_at && endingStage >= 5
              ? completedAt
              : assignment.data.passed_at,
          burned_at:
            !assignment.data.burned_at && endingStage >= 9
              ? completedAt
              : assignment.data.burned_at,
        },
      };
    },
  });
}
