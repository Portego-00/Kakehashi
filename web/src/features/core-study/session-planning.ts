import type { Assignment, Subject } from "@/types/wanikani";
import type { ReviewOrderSetting, ReviewTypeOrderSetting, WebStudyPreferences } from "@/features/settings/settings";

const TYPE_ORDER: Record<Assignment["data"]["subject_type"], number> = { radical: 0, kanji: 1, vocabulary: 2, kana_vocabulary: 3 };
const REVIEW_TYPE_ORDER: readonly ReviewTypeOrderSetting[] = ["radical", "kanji", "vocabulary"];
const SRS_INTERVAL_HOURS: Record<number, number> = { 1: 4, 2: 8, 3: 23, 4: 47, 5: 167, 6: 335, 7: 719, 8: 2879 };
const HOUR_MS = 60 * 60 * 1000;

export interface CoreAssignmentOrderOptions {
  userLevel?: number;
  now?: Date;
  randomFn?: () => number;
}

export function orderCoreAssignments(assignments: Assignment[], subjects: Subject[], mode: "lessons" | "reviews", settings: WebStudyPreferences, options: CoreAssignmentOrderOptions = {}) {
  const subjectById = new Map(subjects.map((subject) => [subject.id, subject]));
  const ordered = [...assignments];
  if (mode === "lessons") {
    if (settings.lessonOrder === "subject-type") ordered.sort((a, b) => TYPE_ORDER[a.data.subject_type] - TYPE_ORDER[b.data.subject_type] || a.id - b.id);
    if (settings.lessonOrder === "level") ordered.sort((a, b) => (subjectById.get(a.data.subject_id)?.data.level || 0) - (subjectById.get(b.data.subject_id)?.data.level || 0) || a.id - b.id);
    if (settings.lessonOrder === "available") ordered.sort((a, b) => String(a.data.unlocked_at).localeCompare(String(b.data.unlocked_at)) || a.id - b.id);
    if (settings.shuffleSubjects) shuffle(ordered, options.randomFn);
    return ordered;
  }

  return orderReviewAssignments(ordered, subjectById, settings, options);
}

export function selectCoreAssignments(assignments: Assignment[], subjects: Subject[], mode: "lessons" | "reviews", settings: WebStudyPreferences, limit: number, options: CoreAssignmentOrderOptions = {}) {
  const ordered = orderCoreAssignments(assignments, subjects, mode, settings, options);
  if (mode === "reviews" && !settings.reviewBatchSizeEnabled) return ordered;
  return ordered.slice(0, Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : undefined);
}

function orderReviewAssignments(assignments: Assignment[], subjectById: Map<number, Subject>, settings: WebStudyPreferences, options: CoreAssignmentOrderOptions) {
  const randomFn = options.randomFn ?? Math.random;
  const now = options.now ?? new Date();
  const userLevel = options.userLevel ?? 1;
  const randomized = shuffle([...assignments], randomFn);
  const randomRank = new Map(randomized.map((assignment, index) => [assignment.id, index]));
  const ordered = settings.reviewOrder === "random" ? randomized : [...assignments];
  const reviewTypeOrder = normalizeReviewTypeOrder(settings.reviewTypeOrder);
  const typeRank = new Map(reviewTypeOrder.map((type, index) => [type, index]));

  return ordered.sort((left, right) => {
    if (settings.prioritizeCriticalItems) {
      const criticalComparison = Number(isCriticalReview(right, subjectById, userLevel)) - Number(isCriticalReview(left, subjectById, userLevel));
      if (criticalComparison !== 0) return criticalComparison;
    }

    if (settings.reviewTypeOrderEnabled) {
      const typeComparison = (typeRank.get(reviewTypeBucket(left.data.subject_type)) ?? REVIEW_TYPE_ORDER.length) - (typeRank.get(reviewTypeBucket(right.data.subject_type)) ?? REVIEW_TYPE_ORDER.length);
      if (typeComparison !== 0) return typeComparison;
    }

    if (settings.reviewOrder === "random") return (randomRank.get(left.id) ?? 0) - (randomRank.get(right.id) ?? 0);

    const reviewComparison = compareByReviewOrder(left, right, subjectById, settings.reviewOrder, now);
    if (reviewComparison !== 0) return reviewComparison;

    if (!settings.reviewTypeOrderEnabled) {
      const typeComparison = TYPE_ORDER[left.data.subject_type] - TYPE_ORDER[right.data.subject_type];
      if (typeComparison !== 0) return typeComparison;
    }

    return (randomRank.get(left.id) ?? 0) - (randomRank.get(right.id) ?? 0);
  });
}

function compareByReviewOrder(left: Assignment, right: Assignment, subjectById: Map<number, Subject>, reviewOrder: Exclude<ReviewOrderSetting, "random">, now: Date) {
  switch (reviewOrder) {
    case "ascendingSrsStage": return left.data.srs_stage - right.data.srs_stage;
    case "descendingSrsStage": return right.data.srs_stage - left.data.srs_stage;
    case "currentLevelFirst": return subjectLevel(right, subjectById) - subjectLevel(left, subjectById);
    case "lowestLevelFirst": return subjectLevel(left, subjectById) - subjectLevel(right, subjectById);
    case "newestAvailableFirst": return compareAvailableAt(left.data.available_at, right.data.available_at, "descending");
    case "oldestAvailableFirst": return compareAvailableAt(left.data.available_at, right.data.available_at, "ascending");
    case "longestRelativeWait": return relativeWaitRatio(right, now) - relativeWaitRatio(left, now);
  }
}

function subjectLevel(assignment: Assignment, subjectById: Map<number, Subject>) {
  return subjectById.get(assignment.data.subject_id)?.data.level ?? 0;
}

function isCriticalReview(assignment: Assignment, subjectById: Map<number, Subject>, userLevel: number) {
  const subject = subjectById.get(assignment.data.subject_id);
  const subjectType = subject?.object ?? assignment.data.subject_type;
  return subject?.data.level === userLevel
    && (subjectType === "radical" || subjectType === "kanji")
    && assignment.data.srs_stage >= 1
    && assignment.data.srs_stage <= 4;
}

function normalizeReviewTypeOrder(values: readonly ReviewTypeOrderSetting[] | undefined) {
  const savedValues = values ?? [];
  const selected = new Set(savedValues.filter((value) => REVIEW_TYPE_ORDER.includes(value)));
  return [...savedValues.filter((value, index) => selected.has(value) && savedValues.indexOf(value) === index), ...REVIEW_TYPE_ORDER.filter((value) => !selected.has(value))];
}

function reviewTypeBucket(type: Assignment["data"]["subject_type"]): ReviewTypeOrderSetting {
  return type === "kana_vocabulary" ? "vocabulary" : type;
}

function compareAvailableAt(left: string | null, right: string | null, direction: "ascending" | "descending") {
  const leftTime = dateMs(left);
  const rightTime = dateMs(right);
  if (leftTime === null) return rightTime === null ? 0 : 1;
  if (rightTime === null) return -1;
  return direction === "ascending" ? leftTime - rightTime : rightTime - leftTime;
}

function relativeWaitRatio(assignment: Assignment, now: Date) {
  const availableAt = dateMs(assignment.data.available_at);
  if (availableAt === null) return Number.NEGATIVE_INFINITY;
  const roundedNow = Math.floor(now.getTime() / HOUR_MS) * HOUR_MS;
  const elapsed = Math.max(0, roundedNow - availableAt);
  return elapsed / ((SRS_INTERVAL_HOURS[assignment.data.srs_stage] ?? SRS_INTERVAL_HOURS[1]) * HOUR_MS);
}

function dateMs(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function shuffle<T>(items: T[], randomFn: () => number = Math.random) {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const next = Math.floor(randomFn() * (index + 1));
    [items[index], items[next]] = [items[next], items[index]];
  }
  return items;
}

const LESSON_HISTORY_PREFIX = "kakehashi-core-lessons-started";
export function lessonHistoryKey(username: string) { return `${LESSON_HISTORY_PREFIX}:${encodeURIComponent(username.toLocaleLowerCase())}`; }
export function coreSessionKey(username: string, mode: "lessons" | "reviews") { return `kakehashi-core-session:${encodeURIComponent(username.trim().toLocaleLowerCase())}:${mode}`; }
export function localDay(value = new Date()) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`; }

export function lessonsStartedToday(storage: Pick<Storage, "getItem">, username: string, now = new Date()) {
  try {
    const rows = JSON.parse(storage.getItem(lessonHistoryKey(username)) || "[]") as Array<{ assignmentId: number; day: string }>;
    return new Set(rows.filter((row) => row.day === localDay(now)).map((row) => row.assignmentId)).size;
  } catch { return 0; }
}

export function recordLessonStarted(storage: Pick<Storage, "getItem" | "setItem">, username: string, assignmentId: number, now = new Date()) {
  let rows: Array<{ assignmentId: number; day: string }> = [];
  try { rows = JSON.parse(storage.getItem(lessonHistoryKey(username)) || "[]"); } catch { /* Start a clean local history. */ }
  const day = localDay(now);
  const next = [...rows.filter((row) => row.day === day && row.assignmentId !== assignmentId), { assignmentId, day }];
  storage.setItem(lessonHistoryKey(username), JSON.stringify(next));
}
