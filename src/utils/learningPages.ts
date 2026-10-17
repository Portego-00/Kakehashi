import {
  isAssignmentInLessonQueueState,
  isAssignmentInReviewQueueState,
} from "./api";
import {
  getJLPTLevelForSubject,
  sanitizeJLPTLevels,
  type JLPTLevel,
} from "./jlptClassification";
import { buildReviewForecastFromAssignments } from "./reviewForecast";
import type { DayForecast } from "../types/wanikani";
import { buildBurnedItems, buildCriticalItems, buildRecentUnlocks } from "./dashboardItemLists";

export const MAX_LEARNING_PAGES = 8;
export const LEARNING_PAGE_NAME_MAX_LENGTH = 20;
export const MIN_SUBJECT_LEVEL = 1;
export const MAX_SUBJECT_LEVEL = 60;
// Same default threshold as the Critical Items screen.
export const LEARNING_PAGE_CRITICAL_THRESHOLD = 75;

export const LEARNING_PAGE_SUBJECT_TYPES = [
  "radical",
  "kanji",
  "vocabulary",
  "kana_vocabulary",
] as const;
export type LearningPageSubjectType = (typeof LEARNING_PAGE_SUBJECT_TYPES)[number];
export const LEARNING_PAGE_SUBJECT_TYPE_LABELS: Record<LearningPageSubjectType, string> = {
  radical: "Radicals",
  kanji: "Kanji",
  vocabulary: "Vocabulary",
  kana_vocabulary: "Kana Vocabulary",
};

// Burned items are never reviewed, so they are not an option and always pass.
export const LEARNING_PAGE_SRS_GROUPS = ["apprentice", "guru", "master", "enlightened"] as const;
export type LearningPageSrsGroup = (typeof LEARNING_PAGE_SRS_GROUPS)[number];
export const LEARNING_PAGE_SRS_GROUP_LABELS: Record<LearningPageSrsGroup, string> = {
  apprentice: "Apprentice",
  guru: "Guru",
  master: "Master",
  enlightened: "Enlightened",
};

function getSrsGroup(srsStage: unknown): LearningPageSrsGroup | null {
  if (typeof srsStage !== "number" || srsStage < 1 || srsStage > 8) return null;
  if (srsStage <= 4) return "apprentice";
  if (srsStage <= 6) return "guru";
  return srsStage === 7 ? "master" : "enlightened";
}

// Empty lists mean "no restriction".
export type LearningPageFilter = {
  subjectTypes: LearningPageSubjectType[];
  minLevel: number | null;
  maxLevel: number | null;
  jlptLevels: JLPTLevel[];
  srsGroups: LearningPageSrsGroup[];
  criticalOnly: boolean;
};

export type LearningPage = {
  id: string;
  name: string;
  filter: LearningPageFilter;
};

export function createLearningPageId(): string {
  return `page-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function pickAllowed<T extends string>(allowed: readonly T[], value: unknown): T[] {
  const requested = new Set(Array.isArray(value) ? value : []);
  const picked = allowed.filter((entry) => requested.has(entry));
  // Selecting every option is the same as no restriction.
  return picked.length === allowed.length ? [] : picked;
}

function normalizeLevel(value: unknown): number | null {
  return Number.isInteger(value) &&
    (value as number) >= MIN_SUBJECT_LEVEL &&
    (value as number) <= MAX_SUBJECT_LEVEL
    ? (value as number)
    : null;
}

export function normalizeLearningPageFilter(value: unknown): LearningPageFilter {
  const record = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const minLevel = normalizeLevel(record.minLevel);
  const maxLevel = normalizeLevel(record.maxLevel);
  const isReversed = minLevel !== null && maxLevel !== null && minLevel > maxLevel;
  return {
    subjectTypes: pickAllowed(LEARNING_PAGE_SUBJECT_TYPES, record.subjectTypes),
    minLevel: isReversed ? maxLevel : minLevel,
    maxLevel: isReversed ? minLevel : maxLevel,
    jlptLevels: sanitizeJLPTLevels(record.jlptLevels),
    srsGroups: pickAllowed(LEARNING_PAGE_SRS_GROUPS, record.srsGroups),
    criticalOnly: record.criticalOnly === true,
  };
}

export function normalizeLearningPages(value: unknown): LearningPage[] {
  if (!Array.isArray(value)) return [];
  const pages: LearningPage[] = [];
  for (const entry of value) {
    const id = typeof entry?.id === "string" ? entry.id.trim() : "";
    const name = typeof entry?.name === "string"
      ? entry.name.trim().replace(/\s+/g, " ").slice(0, LEARNING_PAGE_NAME_MAX_LENGTH)
      : "";
    if (!id || id.length > 80 || !name || pages.some((page) => page.id === id)) continue;
    pages.push({ id, name, filter: normalizeLearningPageFilter(entry.filter) });
    if (pages.length === MAX_LEARNING_PAGES) break;
  }
  return pages;
}

export function getLearningPage(
  pages: readonly LearningPage[] | undefined,
  id: unknown,
): LearningPage | null {
  return (typeof id === "string" && pages?.find((page) => page.id === id)) || null;
}

export function isLearningPageFilterEmpty(filter: LearningPageFilter): boolean {
  return (
    filter.subjectTypes.length === 0 &&
    filter.minLevel === null &&
    filter.maxLevel === null &&
    filter.jlptLevels.length === 0 &&
    filter.srsGroups.length === 0 &&
    !filter.criticalOnly
  );
}

export function describeLearningPageFilter(filter: LearningPageFilter): string {
  const parts = [
    filter.subjectTypes.map((type) => LEARNING_PAGE_SUBJECT_TYPE_LABELS[type]).join(", "),
    filter.minLevel !== null || filter.maxLevel !== null
      ? `Levels ${filter.minLevel ?? MIN_SUBJECT_LEVEL}–${filter.maxLevel ?? MAX_SUBJECT_LEVEL}`
      : "",
    filter.jlptLevels.length > 0 ? `JLPT ${filter.jlptLevels.join(", ")}` : "",
    filter.srsGroups.map((group) => LEARNING_PAGE_SRS_GROUP_LABELS[group]).join(", "),
    filter.criticalOnly ? "Critical items" : "",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "All items";
}

type FilterableSubject = {
  id: number;
  object: string;
  data: {
    level?: number;
    characters?: string | null;
    readings?: { reading?: string | null; accepted_answer?: boolean }[] | null;
  };
};

type ReviewStatisticLike = {
  data?: { subject_id?: number; percentage_correct?: number; hidden?: boolean };
};

/**
 * Builds a predicate for a page. Unknown subjects never match; items that are
 * unstarted or burned (no SRS group) always pass the SRS stage filter.
 */
export function createLearningPageSubjectMatcher(
  filter: LearningPageFilter,
  reviewStatistics: readonly ReviewStatisticLike[] = [],
) {
  const criticalSubjectIds = filter.criticalOnly
    ? new Set(
        reviewStatistics
          .filter(({ data }) =>
            !data?.hidden &&
            typeof data?.percentage_correct === "number" &&
            data.percentage_correct < LEARNING_PAGE_CRITICAL_THRESHOLD)
          .map(({ data }) => data?.subject_id),
      )
    : null;

  return (subject: FilterableSubject | null | undefined, srsStage?: number | null) => {
    if (!subject) return false;
    const { level } = subject.data;
    const srsGroup = getSrsGroup(srsStage);
    const jlptLevel = filter.jlptLevels.length > 0 ? getJLPTLevelForSubject(subject) : null;
    return (
      (filter.subjectTypes.length === 0 ||
        filter.subjectTypes.includes(subject.object as LearningPageSubjectType)) &&
      (filter.minLevel === null || (level ?? 0) >= filter.minLevel) &&
      (filter.maxLevel === null || (level ?? Infinity) <= filter.maxLevel) &&
      (filter.jlptLevels.length === 0 || (jlptLevel !== null && filter.jlptLevels.includes(jlptLevel))) &&
      (filter.srsGroups.length === 0 || srsGroup === null || filter.srsGroups.includes(srsGroup)) &&
      (!criticalSubjectIds || criticalSubjectIds.has(subject.id))
    );
  };
}

export type LearningPageSubjectMatcher = ReturnType<typeof createLearningPageSubjectMatcher>;

export function filterAssignmentsForLearningPage<
  T extends { data?: { subject_id?: number; srs_stage?: number | null } },
>(
  assignments: readonly T[],
  subjectsById: ReadonlyMap<number, FilterableSubject>,
  matches: LearningPageSubjectMatcher,
): T[] {
  return assignments.filter(({ data }) =>
    typeof data?.subject_id === "number" &&
    matches(subjectsById.get(data.subject_id), data.srs_stage));
}

export type LearningPageDashboardSource = {
  lessonCount: number;
  reviewCount: number;
  forecast: DayForecast[];
  recentMistakes: { id: number }[];
  criticalItems: { id: number }[];
  recentUnlocks: { id: number }[];
  burnedItems: { id: number }[];
  reviewStatistics: any[];
  nextReviewDate: string | null;
  recentLessonCount: number;
  subjects: any[];
  assignments: any[];
  pendingLessonSyncCount?: number;
  pendingReviewSyncCount?: number;
  dataLoadingState: { assignments: boolean; subjects: boolean };
};

export type LearningPageReviewQueue = {
  assignments: { id: number; data_updated_at?: string; data: Record<string, any> }[];
  localAssignmentBaseline?: { id: number; data: Record<string, any> }[];
  capturedAt: string;
};

export type LearningPageQueueState = {
  reviewQueue?: LearningPageReviewQueue;
  pendingLessonAssignmentIds?: ReadonlySet<number>;
  pendingReviewAssignmentIds?: ReadonlySet<number>;
};

/** The dashboard as seen through a page: only matching items are counted or listed. */
export function applyLearningPageToDashboardData<T extends LearningPageDashboardSource>(
  dashboardData: T,
  page: LearningPage | null,
  now: Date = new Date(),
  queueState: LearningPageQueueState = {},
): T {
  if (!page) return dashboardData;

  const subjectsById = new Map<number, FilterableSubject>(
    dashboardData.subjects.map((subject) => [subject.id, subject]),
  );
  const subjectsRecord = Object.fromEntries(subjectsById);
  const srsStageBySubjectId = new Map<number, number>(
    dashboardData.assignments.map(({ data }) => [data?.subject_id, data?.srs_stage]),
  );
  const matches = createLearningPageSubjectMatcher(page.filter, dashboardData.reviewStatistics);
  const matchesId = ({ id }: { id: number }) =>
    matches(subjectsById.get(id), srsStageBySubjectId.get(id));
  const assignments = filterAssignmentsForLearningPage(dashboardData.assignments, subjectsById, matches);

  let lessonCount = 0;
  let nextReviewDate: string | null = null;
  for (const assignment of assignments) {
    const { data } = assignment;
    if (isAssignmentInLessonQueueState(data) && !queueState.pendingLessonAssignmentIds?.has(assignment.id)) {
      lessonCount += 1;
    } else if (isAssignmentInReviewQueueState(data)) {
      if (Date.parse(data.available_at) > now.getTime() &&
          !queueState.pendingReviewAssignmentIds?.has(assignment.id) &&
          (!nextReviewDate || Date.parse(data.available_at) < Date.parse(nextReviewDate))) {
        nextReviewDate = data.available_at;
      }
    }
  }

  // A corrected account total cannot identify the visible items on each page.
  // Use the same live queue as reviews, retaining it for offline page counts.
  const reviewAssignments = new Map<number, LearningPageReviewQueue["assignments"][number]>(
    (queueState.reviewQueue?.assignments ?? dashboardData.assignments).map((assignment) => [assignment.id, assignment]),
  );
  if (queueState.reviewQueue) {
    const capturedAt = Date.parse(queueState.reviewQueue.capturedAt);
    const baselineById = new Map<number, LearningPageReviewQueue["assignments"][number]>(
      queueState.reviewQueue.localAssignmentBaseline?.map((assignment) => [assignment.id, assignment]),
    );
    for (const assignment of dashboardData.assignments) {
      const data = assignment.data;
      if (reviewAssignments.has(assignment.id)) {
        const baseline = baselineById.get(assignment.id)?.data;
        const localScheduleChanged = baseline && (
          data.srs_stage !== baseline.srs_stage || data.available_at !== baseline.available_at ||
          data.started_at !== baseline.started_at || data.hidden !== baseline.hidden
        );
        const serverUpdatedAt = Date.parse(reviewAssignments.get(assignment.id)?.data_updated_at ?? "");
        const localIsNewer = Date.parse(assignment.data_updated_at ?? "") >
          Math.max(capturedAt, Number.isFinite(serverUpdatedAt) ? serverUpdatedAt : capturedAt);
        // Preserve fresh server stages/visibility unless the local schedule
        // actually changed after capture (optimistic edits lack updated_at).
        if (!localScheduleChanged && !localIsNewer) continue;
        if (!isAssignmentInReviewQueueState(data) || Date.parse(data.available_at) > now.getTime()) {
          reviewAssignments.delete(assignment.id);
        } else {
          reviewAssignments.set(assignment.id, assignment);
        }
      } else if (isAssignmentInReviewQueueState(data) && Date.parse(data.available_at) > capturedAt) {
        reviewAssignments.set(assignment.id, assignment);
      }
    }
  }
  const matchingReviewCount = [...reviewAssignments.values()].filter((assignment) =>
    isAssignmentInReviewQueueState(assignment.data) &&
    Date.parse(assignment.data.available_at) <= now.getTime() &&
    !queueState.pendingReviewAssignmentIds?.has(assignment.id) &&
    matches(subjectsById.get(assignment.data.subject_id), assignment.data.srs_stage),
  ).length;
  // Before a queue is available, never revive an account-wide correction.
  const reviewCount = queueState.reviewQueue
    ? matchingReviewCount
    : Math.min(matchingReviewCount, dashboardData.reviewCount);
  // Until assignments and subjects load there is nothing to filter.
  const isLoaded = dashboardData.dataLoadingState.assignments && dashboardData.dataLoadingState.subjects;

  return {
    ...dashboardData,
    lessonCount: isLoaded ? Math.min(lessonCount, dashboardData.lessonCount) : 0,
    reviewCount: isLoaded ? reviewCount : 0,
    nextReviewDate: reviewCount === 0 ? nextReviewDate : null,
    forecast: buildReviewForecastFromAssignments(assignments, dashboardData.subjects),
    recentMistakes: dashboardData.recentMistakes.filter(matchesId),
    criticalItems: buildCriticalItems(dashboardData.reviewStatistics.filter((statistic) => matchesId({ id: statistic?.data?.subject_id })), subjectsRecord),
    recentUnlocks: buildRecentUnlocks(assignments, subjectsRecord),
    burnedItems: buildBurnedItems(assignments, subjectsRecord),
    reviewStatistics: dashboardData.reviewStatistics.filter((statistic) =>
      matchesId({ id: statistic?.data?.subject_id })),
    recentLessonCount: assignments.filter(({ data }) =>
      data.srs_stage >= 1 && data.srs_stage <= 4 && !data.passed_at && !data.burned_at).length,
    assignments,
  };
}
