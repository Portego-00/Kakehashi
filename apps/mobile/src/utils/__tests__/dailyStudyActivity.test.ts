import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import {
  calculateDailyStudyActivityToday,
  type DailyStudyAssignment,
  type DailyStudyReviewStatistic,
} from "../dailyStudyActivity";

const NOW = new Date("2026-05-15T10:00:00.000Z");

function makeAssignment({
  startedAt,
  updatedAt,
  srsStage = 1,
  hidden = false,
  passedAt = null,
  burnedAt = null,
}: {
  startedAt: string | null;
  updatedAt: string | null;
  srsStage?: number;
  hidden?: boolean;
  passedAt?: string | null;
  burnedAt?: string | null;
}): DailyStudyAssignment {
  return {
    data_updated_at: updatedAt,
    data: {
      started_at: startedAt,
      hidden,
      srs_stage: srsStage,
      passed_at: passedAt,
      burned_at: burnedAt,
    },
  };
}

function makeReviewStatistic({
  updatedAt,
  hidden = false,
  meaningCorrect = 0,
  meaningIncorrect = 0,
  readingCorrect = 0,
  readingIncorrect = 0,
}: {
  updatedAt: string | null;
  hidden?: boolean;
  meaningCorrect?: number;
  meaningIncorrect?: number;
  readingCorrect?: number;
  readingIncorrect?: number;
}): DailyStudyReviewStatistic {
  return {
    data_updated_at: updatedAt,
    data: {
      hidden,
      meaning_correct: meaningCorrect,
      meaning_incorrect: meaningIncorrect,
      reading_correct: readingCorrect,
      reading_incorrect: readingIncorrect,
    },
  };
}

describe("calculateDailyStudyActivityToday", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not count newly completed lessons as reviews", () => {
    const lessonAssignments = Array.from({ length: 5 }, (_, index) =>
      makeAssignment({
        startedAt: `2026-05-15T09:0${index}:00.000Z`,
        updatedAt: `2026-05-15T09:0${index}:00.000Z`,
        srsStage: 2,
      }),
    );
    const lessonCreatedReviewStats = Array.from({ length: 5 }, (_, index) =>
      makeReviewStatistic({
        updatedAt: `2026-05-15T09:0${index}:00.000Z`,
      }),
    );

    const activity = calculateDailyStudyActivityToday(
      lessonAssignments,
      lessonCreatedReviewStats,
      "UTC",
    );

    expect(activity.lessonsCompletedToday).toBe(5);
    expect(activity.reviewsCompletedToday).toBe(0);
  });

  it("counts review statistic updates with recorded answers", () => {
    const reviewStats = [
      makeReviewStatistic({
        updatedAt: "2026-05-15T08:00:00.000Z",
        meaningCorrect: 1,
      }),
      makeReviewStatistic({
        updatedAt: "2026-05-15T08:05:00.000Z",
      }),
      makeReviewStatistic({
        updatedAt: "2026-05-15T08:10:00.000Z",
        meaningCorrect: 1,
        hidden: true,
      }),
      makeReviewStatistic({
        updatedAt: "2026-05-14T23:00:00.000Z",
        readingIncorrect: 1,
      }),
    ];

    const activity = calculateDailyStudyActivityToday([], reviewStats, "UTC");

    expect(activity.lessonsCompletedToday).toBe(0);
    expect(activity.reviewsCompletedToday).toBe(1);
    expect(activity.reviewEstimateSource).toBe("review_statistics");
  });

  it("uses assignment updates as a fallback when they happen after the lesson start", () => {
    const assignments = [
      makeAssignment({
        startedAt: "2026-05-14T08:00:00.000Z",
        updatedAt: "2026-05-15T08:00:00.000Z",
        srsStage: 2,
      }),
    ];

    const activity = calculateDailyStudyActivityToday(assignments, [], "UTC");

    expect(activity.lessonsCompletedToday).toBe(0);
    expect(activity.reviewsCompletedToday).toBe(1);
    expect(activity.reviewEstimateSource).toBe("assignment_updates");
  });
});
