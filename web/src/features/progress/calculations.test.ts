import { describe, expect, it } from "vitest";
import type { Assignment, ReviewStatistic } from "@/types/wanikani";
import {
  calculateAccuracy,
  calculateApproximateActivity,
  calculateForecast,
  calculateLevelTimings,
  calculateSrsBreakdown,
} from "./calculations";

const resource = <T,>(id: number, object: string, data: T, updated = "2026-08-06T12:00:00Z") => ({
  id,
  object,
  url: "",
  data_updated_at: updated,
  data,
});

describe("progress calculations", () => {
  it("weights accuracy by attempts instead of averaging percentages", () => {
    const stats = [
      resource(1, "review_statistic", { meaning_correct: 90, meaning_incorrect: 10, reading_correct: 0, reading_incorrect: 0, hidden: false }),
      resource(2, "review_statistic", { meaning_correct: 1, meaning_incorrect: 1, reading_correct: 0, reading_incorrect: 0, hidden: false }),
    ] as ReviewStatistic[];
    expect(calculateAccuracy(stats).percentage).toBe(89.2);
  });

  it("groups all SRS stages", () => {
    const assignments = [0, 1, 4, 5, 6, 7, 8, 9].map((stage, id) => resource(id, "assignment", { srs_stage: stage, hidden: false })) as Assignment[];
    expect(calculateSrsBreakdown(assignments)).toEqual({ Locked: 1, Apprentice: 2, Guru: 2, Master: 1, Enlightened: 1, Burned: 1 });
  });

  it("places reviewable assignments into local forecast days", () => {
    const assignments = [
      resource(1, "assignment", { available_at: "2026-08-06T15:00:00Z", hidden: false, srs_stage: 3, subject_id: 10 }),
      resource(2, "assignment", { available_at: "2026-08-07T15:00:00Z", hidden: false, srs_stage: 9, subject_id: 11 }),
    ] as Assignment[];
    const forecast = calculateForecast(assignments, new Date("2026-08-06T08:00:00"), 2);
    expect(forecast.map((day) => day.count)).toEqual([1, 0]);
  });

  it("uses statistic update dates as a transparent activity approximation", () => {
    const stats = [resource(1, "review_statistic", { hidden: false }, "2026-08-06T12:00:00Z")] as ReviewStatistic[];
    expect(calculateApproximateActivity(stats, new Date("2026-08-06T18:00:00"), 2).map((day) => day.count)).toEqual([0, 1]);
  });

  it("calculates level pass duration and ignores abandoned attempts", () => {
    const timings = calculateLevelTimings([
      { data: { level: 2, unlocked_at: "2026-08-01T00:00:00Z", started_at: null, passed_at: "2026-08-08T00:00:00Z", completed_at: null, abandoned_at: null } },
      { data: { level: 1, unlocked_at: "2026-07-01T00:00:00Z", started_at: null, passed_at: null, completed_at: null, abandoned_at: "2026-07-02T00:00:00Z" } },
    ]);
    expect(timings).toHaveLength(1);
    expect(timings[0].daysToPass).toBe(7);
  });

  it("keeps an active level duration separate from time to pass", () => {
    const [timing] = calculateLevelTimings([
      { data: { level: 3, unlocked_at: "2026-08-01T00:00:00Z", started_at: null, passed_at: null, completed_at: null, abandoned_at: null } },
    ], new Date("2026-08-06T00:00:00Z"));
    expect(timing.daysToPass).toBeNull();
    expect(timing.activeDays).toBe(5);
  });
});
