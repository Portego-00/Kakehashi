import { describe, expect, it } from "vitest";
import { calculateWorkloadForecast, solveReviewBudget } from "./analytics-forecast";
import { analyticsTestNow, analyticsTestSystems as systems, testAssignment, testSubject } from "./analytics-test-fixtures";

const now = new Date(analyticsTestNow); now.setUTCHours(0);
const subject = (id: number) => testSubject(id, "radical");
const assignment = (id: number, stage = 4) => testAssignment(id, { subject_type: "radical", srs_stage: stage, available_at: now.toISOString(), started_at: stage ? now.toISOString() : null, unlocked_at: now.toISOString() });

describe("SRS workload expectations", () => {
  it("keeps known work separate from subsequent promotions and burns", () => {
    const result = calculateWorkloadForecast({ subjects: [subject(1)], assignments: [assignment(1, 7)], systems, now, horizonDays: 180, lessonsPerDay: 0, accuracyPercent: 100 });
    expect(result.knownReviews).toBe(1);
    expect(result.modeledReviews).toBe(1);
    expect(result.totalReviews).toBe(2);
    expect(result.daily.reduce((sum, day) => sum + day.expectedBurns, 0)).toBe(1);
    expect(result.daily[0].knownReviews).toBe(1);
  });

  it("models repeated reviews after misses and remains deterministic", () => {
    const input = { subjects: [subject(1)], assignments: [assignment(1)], systems, now, horizonDays: 30, lessonsPerDay: 0 };
    const perfect = calculateWorkloadForecast({ ...input, accuracyPercent: 100 });
    const misses = calculateWorkloadForecast({ ...input, accuracyPercent: 80 });
    expect(misses.totalReviews).toBeGreaterThan(perfect.totalReviews);
    expect(calculateWorkloadForecast({ ...input, accuracyPercent: 80 })).toEqual(misses);
    expect(misses.knownReviews).toBe(1);
  });

  it("schedules lessons from actual intervals and respects unlocked lesson inventory", () => {
    const result = calculateWorkloadForecast({ subjects: [subject(1), subject(2)], assignments: [assignment(1, 0)], systems, now, horizonDays: 1, lessonsPerDay: 10, accuracyPercent: 100 });
    expect(result.totalLessons).toBe(1);
    expect(result.knownReviews).toBe(0);
    expect(result.modeledReviews).toBe(2);
    expect(result.daily[0].lessons).toBe(1);
  });

  it("preserves known schedules without SRS metadata", () => {
    const result = calculateWorkloadForecast({ subjects: [subject(1)], assignments: [assignment(1)], systems: [], now, horizonDays: 7, lessonsPerDay: 0 });
    expect(result).toMatchObject({ knownReviews: 1, modeledReviews: 0, incompleteSystems: true, assumedAccuracy: true });
  });

  it("groups the same totals into weekly buckets", () => {
    const result = calculateWorkloadForecast({ subjects: [subject(1)], assignments: [assignment(1)], systems, now, horizonDays: 30, accuracyPercent: 95 });
    expect(result.weekly).toHaveLength(5);
    expect(result.weekly.reduce((sum, week) => sum + week.reviews, 0)).toBeCloseTo(result.daily.reduce((sum, day) => sum + day.reviews, 0), 6);
  });

  it("reports when existing obligations exceed the review budget", () => {
    const result = solveReviewBudget({ subjects: [subject(1)], assignments: [assignment(1)], systems, now, horizonDays: 1, accuracyPercent: 100 }, 0);
    expect(result).toMatchObject({ lessonsPerDay: 0, achievable: false, averageDailyReviews: 1 });
  });
});
