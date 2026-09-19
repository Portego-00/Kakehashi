import { describe, expect, it } from "vitest";
import { calculateAnalyticsForecast, calculateAnalyticsInsights, calculateDifficultItems, calculateLevelBlockers, calculateLevelProjection, calculateSrsByType, earliestSrsDate } from "./analytics-insights";
import { analyticsTestNow as now, analyticsTestSystems as systems, testAssignment as assignment, testReview as review, testStatistic as statistic, testSubject as subject } from "./analytics-test-fixtures";

describe("analytics insights", () => {
  it("counts only dated lessons and reviews, never assignment update timestamps", () => {
    const data = calculateAnalyticsInsights({ assignments: [assignment(1)], subjects: [subject(1)], statistics: [statistic(1)], progressions: [], now, days: 2 });
    expect(data.activity.map((day) => day.count)).toEqual([0, 0]);
    expect(data.reviewSummary.total).toBeNull();
    expect(data.activity.every((day) => day.reviews === null && day.errors === null)).toBe(true);
    expect(data.reviewSummary.lessons).toBe(0);
    expect(data.lifetimeAccuracy.percentage).toBe(100);
  });

  it("uses required answer types, actual review dates, and counts errors separately", () => {
    const data = calculateAnalyticsInsights({ assignments: [], subjects: [subject(1), subject(2, "radical"), subject(3, "kana_vocabulary")], statistics: [], progressions: [], now, days: 2, reviewHistoryAvailable: true, reviews: [
      review(1, 1, { incorrect_reading_answers: 2 }), review(2, 2), review(3, 3), review(4, 1, { created_at: "2026-09-11T12:00:00Z" }),
    ] });
    expect(data.reviewSummary).toMatchObject({ total: 3, errors: 2, perfectReviews: 2, accuracy: 66.7 });
    expect(data.activity.at(-1)?.subjectIds).toEqual([1, 2, 3]);
  });

  it("preserves unknown days before device recording and marks the first partial day", () => {
    const boundary = new Date(now); boundary.setHours(8, 0, 0, 0);
    const previous = new Date(now); previous.setDate(previous.getDate() - 1);
    const input = { assignments: [assignment(1, { started_at: previous.toISOString(), burned_at: previous.toISOString(), srs_stage: 9 })], subjects: [subject(1)], statistics: [], progressions: [], now, days: 3, reviewHistoryAvailable: true, reviewHistoryStartedAt: boundary.toISOString(), reviews: [review(1, 1), review(2, 1, { created_at: previous.toISOString() })] };
    const result = calculateAnalyticsInsights(input);
    expect(result.activity[1]).toMatchObject({ reviews: null, errors: null, accuracy: null, reviewCoverage: "unavailable", count: 2 });
    expect(result.activity[2]).toMatchObject({ reviews: 1, reviewCoverage: "partial" });
    expect(result.reviewSummary).toMatchObject({ total: 1, trackedDays: 1, dailyAverage: 1, longestStreak: 1, trackingStartedAt: boundary.toISOString() });
  });

  it("keeps a streak alive before today's first activity", () => {
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    const before = new Date(now); before.setDate(before.getDate() - 2);
    const data = calculateAnalyticsInsights({ assignments: [], subjects: [subject(1)], statistics: [], progressions: [], now, days: 5, reviewHistoryAvailable: true, reviews: [review(1, 1, { created_at: yesterday.toISOString() }), review(2, 1, { created_at: before.toISOString() })] });
    expect(data.reviewSummary).toMatchObject({ currentStreak: 2, longestStreak: 2, activeDays: 2 });
  });

  it("includes burn-only milestones and their items without double-counting a real burn review", () => {
    const input = { assignments: [assignment(1, { srs_stage: 9, burned_at: now.toISOString() })], subjects: [subject(1)], statistics: [], progressions: [], now, days: 2 };
    const unavailable = calculateAnalyticsInsights(input);
    expect(unavailable.activity.at(-1)).toMatchObject({ count: 1, burns: 1, subjectIds: [1], reviews: null });
    expect(unavailable.activity.at(-1)).toMatchObject({ lessonSubjectIds: [], burnSubjectIds: [1], reviewSubjectIds: [] });
    const available = calculateAnalyticsInsights({ ...input, reviews: [review(1, 1, { ending_srs_stage: 9 })], reviewHistoryAvailable: true });
    expect(available.activity.at(-1)).toMatchObject({ count: 1, burns: 1, subjectIds: [1], reviews: 1 });
    expect(available.activity.at(-1)).toMatchObject({ lessonSubjectIds: [], burnSubjectIds: [1], reviewSubjectIds: [1] });
  });

  it("includes overdue work today and excludes lessons, burns, and hidden assignments", () => {
    const forecast = calculateAnalyticsForecast([
      assignment(1, { available_at: "2026-09-01T12:00:00Z" }), assignment(2, { available_at: "2026-09-10T13:00:00Z" }),
      assignment(3, { srs_stage: 0 }), assignment(4, { srs_stage: 9 }), assignment(5, { hidden: true }),
    ], now);
    expect(forecast).toMatchObject({ dueNow: 1, dueToday: 2, next24Hours: 2, next7Days: 2, nextAt: "2026-09-10T13:00:00.000Z" });
    expect(forecast.daily[0].subjectIds).toEqual([1, 2]);
    expect(forecast.hourly[0].count).toBe(1);
  });

  it("includes unassigned visible curriculum items as locked", () => {
    const [radical, kanji] = calculateSrsByType([subject(1, "radical"), subject(2), subject(3), subject(4, "kanji", { hidden_at: now.toISOString() })], [assignment(2, { srs_stage: 9 })]);
    expect(radical).toMatchObject({ total: 1, learned: 0, stages: { Locked: 1 } });
    expect(kanji).toMatchObject({ total: 2, learned: 1, burned: 1, stages: { Locked: 1, Burned: 1 } });
  });

  it("weights accuracy within each type and marks missing reading attempts as unavailable", () => {
    const data = calculateAnalyticsInsights({ assignments: [], subjects: [], progressions: [], statistics: [statistic(1, { subject_type: "radical", meaning_correct: 90, meaning_incorrect: 10, reading_correct: 0 }), statistic(2, { subject_type: "radical", meaning_correct: 1, meaning_incorrect: 1, reading_correct: 0 })], now });
    expect(data.accuracyByType[0]).toMatchObject({ percentage: 89.2, readingPercentage: null, meaningPercentage: 89.2 });
  });

  it("prioritizes repeated weak answers and retains burned items for optional filtering", () => {
    const items = calculateDifficultItems([subject(1), subject(2), subject(3)], [assignment(1), assignment(2), assignment(3, { srs_stage: 9 })], [statistic(1, { meaning_incorrect: 10, meaning_current_streak: 10 }), statistic(2, { reading_incorrect: 5, reading_current_streak: 0 }), statistic(3, { meaning_incorrect: 50 })]);
    expect(items.map((item) => item.subject.id)).toEqual([2, 3, 1]);
    expect(items[0]).toMatchObject({ weakest: "reading", score: 5 });
  });

  it("projects level arrivals without an extra level, subtracting current elapsed time", () => {
    const timings = [{ level: 59, startedAt: "2026-09-06T12:00:00Z", passedAt: null, completedAt: null, daysToPass: null, daysToComplete: null, activeDays: 4 }];
    expect(calculateLevelProjection({ timings, currentLevel: 59, paceDays: 10, now }).at(-1)).toMatchObject({ level: 60, daysFromNow: 6, date: "2026-09-16T12:00:00.000Z" });
    expect(calculateLevelProjection({ timings, currentLevel: 59, paceDays: null, now }).every((row) => row.status === "reached")).toBe(true);
    expect(calculateLevelProjection({ timings, currentLevel: 59, paceDays: 2, now }).at(-1)?.daysFromNow).toBe(0);
  });

  it("uses actual system intervals and the subject's next review", () => {
    expect(earliestSrsDate(assignment(1), subject(1), systems, "passed", now)).toBe(now.toISOString());
    expect(earliestSrsDate(assignment(1, { srs_stage: 3 }), subject(1), systems, "passed", now)).toBe("2026-09-12T11:00:00.000Z");
    expect(earliestSrsDate(assignment(1, { srs_stage: 8 }), subject(1), systems, "burned", now)).toBe(now.toISOString());
    expect(earliestSrsDate(assignment(1), subject(1), [], "passed", now)).toBeNull();
  });

  it("finds the 90-percent Guru threshold including a locked kanji's radical dependency", () => {
    const kanji = Array.from({ length: 10 }, (_, index) => subject(index + 1, "kanji", { component_subject_ids: [20] }));
    const passed = Array.from({ length: 8 }, (_, index) => assignment(index + 1, { srs_stage: 5, passed_at: "2026-09-01T12:00:00Z" }));
    const result = calculateLevelBlockers([...passed, assignment(20, { subject_type: "radical", srs_stage: 4 })], [...kanji, subject(20, "radical")], systems, 3, now);
    expect(result).toMatchObject({ requiredKanji: 9, passedKanji: 8, earliestLevelUpAt: "2026-09-13T22:00:00.000Z" });
    expect(result.blockers.find((item) => item.subject.id === 9)).toMatchObject({ status: "locked", blockedBy: [20] });
  });

  it("keeps previously passed items passed after an SRS demotion", () => {
    const items = [assignment(1, { srs_stage: 2, passed_at: "2026-09-02T12:00:00Z" }), assignment(20, { subject_type: "radical", srs_stage: 1, passed_at: "2026-09-01T12:00:00Z" })];
    const subjects = [subject(1, "kanji", { component_subject_ids: [20] }), subject(20, "radical")];
    expect(calculateLevelBlockers(items, subjects, systems, 3, now)).toMatchObject({ passedKanji: 1, blockers: [{ status: "passed", blockedBy: [], earliestGuruAt: "2026-09-02T12:00:00Z" }] });
    expect(earliestSrsDate(items[0], subjects[0], [], "passed", now)).toBe("2026-09-02T12:00:00Z");
  });

  it("excludes accelerated levels from the default pace and calculates quartiles", () => {
    const durations = [1, 2, 8, 10, 12, 14];
    const progressions = durations.map((days, index) => ({ data: { level: index + 1, started_at: "2026-01-01T00:00:00Z", unlocked_at: "2026-01-01T00:00:00Z", passed_at: new Date(Date.parse("2026-01-01T00:00:00Z") + days * 86_400_000).toISOString(), completed_at: null, abandoned_at: null } }));
    const data = calculateAnalyticsInsights({ subjects: [], assignments: [], statistics: [], progressions, currentLevel: 7, now });
    expect(data.levelPace).toMatchObject({ median: 11, average: 11, completedLevels: 4, paceLowerQuartile: 9.5, paceUpperQuartile: 12.5 });
    expect(Date.parse(data.levelPace.finishEarliestAt!)).toBeLessThan(Date.parse(data.levelPace.finishLatestAt!));
  });
});
