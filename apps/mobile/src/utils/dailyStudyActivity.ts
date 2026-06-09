import {
  getCurrentTimezone,
  getLessonsStartedToday,
  toDayKeyInTimezone,
} from "./dailyLessonLimit";

export type DailyStudyAssignment = {
  data?: {
    started_at?: string | null;
    hidden?: boolean;
    srs_stage?: number | null;
    passed_at?: string | null;
    burned_at?: string | null;
  };
  data_updated_at?: string | null;
};

export type DailyStudyReviewStatistic = {
  data_updated_at?: string | null;
  data?: {
    hidden?: boolean;
    meaning_correct?: number | null;
    meaning_incorrect?: number | null;
    reading_correct?: number | null;
    reading_incorrect?: number | null;
  };
};

export type ReviewEstimateSource =
  | "review_statistics"
  | "assignment_updates"
  | "none";

export type DailyStudyActivity = {
  lessonsCompletedToday: number;
  reviewsCompletedToday: number;
  reviewEstimateSource: ReviewEstimateSource;
};

function isSameDayInTimezone(
  value: string | null | undefined,
  todayKey: string,
  timezone: string,
): boolean {
  if (!value) {
    return false;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }

  return toDayKeyInTimezone(parsed, timezone) === todayKey;
}

function getValidTimestamp(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getNonNegativeCount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

function hasRecordedReviewAnswers(stat: DailyStudyReviewStatistic): boolean {
  const data = stat?.data;
  if (!data) {
    return false;
  }

  const totalAnswers =
    getNonNegativeCount(data.meaning_correct) +
    getNonNegativeCount(data.meaning_incorrect) +
    getNonNegativeCount(data.reading_correct) +
    getNonNegativeCount(data.reading_incorrect);

  return totalAnswers > 0;
}

function countReviewsFromReviewStatisticsToday(
  reviewStatistics: DailyStudyReviewStatistic[],
  todayKey: string,
  timezone: string,
): number {
  let reviewedSubjectsToday = 0;

  for (const stat of reviewStatistics) {
    if (stat?.data?.hidden) {
      continue;
    }

    if (!hasRecordedReviewAnswers(stat)) {
      continue;
    }

    if (isSameDayInTimezone(stat?.data_updated_at, todayKey, timezone)) {
      reviewedSubjectsToday += 1;
    }
  }

  return reviewedSubjectsToday;
}

function countReviewsFromAssignmentsToday(
  assignments: DailyStudyAssignment[],
  todayKey: string,
  timezone: string,
): number {
  let estimatedReviews = 0;

  for (const assignment of assignments) {
    const assignmentData = assignment?.data;
    if (!assignmentData?.started_at || assignmentData.hidden) {
      continue;
    }

    if (!isSameDayInTimezone(assignment?.data_updated_at, todayKey, timezone)) {
      continue;
    }

    const stage = assignmentData.srs_stage;
    const updatedAtTimestamp = getValidTimestamp(assignment?.data_updated_at);
    const startedAtTimestamp = getValidTimestamp(assignmentData.started_at);
    const updatedAfterLessonStart =
      updatedAtTimestamp !== null &&
      startedAtTimestamp !== null &&
      updatedAtTimestamp - startedAtTimestamp > 60 * 1000;
    const likelyReviewEvent =
      (typeof stage === "number" && stage > 1 && updatedAfterLessonStart) ||
      isSameDayInTimezone(assignmentData.passed_at, todayKey, timezone) ||
      isSameDayInTimezone(assignmentData.burned_at, todayKey, timezone);

    if (likelyReviewEvent) {
      estimatedReviews += 1;
    }
  }

  return estimatedReviews;
}

export function calculateDailyStudyActivityToday(
  assignments: DailyStudyAssignment[],
  reviewStatistics: DailyStudyReviewStatistic[],
  timezone: string = getCurrentTimezone(),
): DailyStudyActivity {
  const safeAssignments = Array.isArray(assignments) ? assignments : [];
  const safeReviewStatistics = Array.isArray(reviewStatistics)
    ? reviewStatistics
    : [];
  const todayKey = toDayKeyInTimezone(new Date(), timezone);
  const lessonsCompletedToday = getLessonsStartedToday(safeAssignments, timezone);
  const reviewsFromReviewStatistics = countReviewsFromReviewStatisticsToday(
    safeReviewStatistics,
    todayKey,
    timezone,
  );
  const reviewsFromAssignments = countReviewsFromAssignmentsToday(
    safeAssignments,
    todayKey,
    timezone,
  );
  const reviewsCompletedToday = Math.max(
    reviewsFromReviewStatistics,
    reviewsFromAssignments,
  );

  let reviewEstimateSource: ReviewEstimateSource = "none";
  if (reviewsCompletedToday > 0) {
    reviewEstimateSource =
      reviewsFromReviewStatistics >= reviewsFromAssignments
        ? "review_statistics"
        : "assignment_updates";
  } else if (safeReviewStatistics.length > 0) {
    reviewEstimateSource = "review_statistics";
  }

  return {
    lessonsCompletedToday,
    reviewsCompletedToday,
    reviewEstimateSource,
  };
}

export function getReviewEstimateSourceLabel(
  source: ReviewEstimateSource,
): string {
  if (source === "review_statistics") {
    return "review statistics updates";
  }

  if (source === "assignment_updates") {
    return "assignment activity updates";
  }

  return "the latest synced activity";
}
