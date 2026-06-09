import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { calculateWkstatsLevelTimingSummary } from "../levelProgress";

describe("calculateWkstatsLevelTimingSummary", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("matches wkstats style median/current level-up calculation", () => {
    jest.setSystemTime(new Date("2026-02-10T00:00:00.000Z"));

    const progressions = [
      { data: { level: 1, unlocked_at: "2026-01-01T00:00:00.000Z", started_at: null, passed_at: "2026-01-11T00:00:00.000Z" } },
      { data: { level: 2, unlocked_at: "2026-01-11T00:00:00.000Z", started_at: null, passed_at: "2026-01-23T00:00:00.000Z" } },
      { data: { level: 3, unlocked_at: "2026-01-23T00:00:00.000Z", started_at: null, passed_at: "2026-02-06T00:00:00.000Z" } },
      { data: { level: 4, unlocked_at: "2026-02-06T00:00:00.000Z", started_at: null, passed_at: null } },
    ];

    const summary = calculateWkstatsLevelTimingSummary(progressions, [], 4);

    expect(summary.averageLevelDurationDays).toBeCloseTo(12, 6);
    expect(summary.medianLevelDurationDays).toBeCloseTo(12, 6);
    expect(summary.currentLevelDurationDays).toBeCloseTo(4, 6);
    expect(summary.levelUpInDays).toBeCloseTo(8, 6);
  });

  it("keeps lower levels when reset target is above level 1", () => {
    jest.setSystemTime(new Date("2026-03-07T00:00:00.000Z"));

    const progressions = [
      { data: { level: 1, unlocked_at: "2026-01-01T00:00:00.000Z", started_at: null, passed_at: "2026-01-03T00:00:00.000Z" } },
      { data: { level: 2, unlocked_at: "2026-01-03T00:00:00.000Z", started_at: null, passed_at: "2026-01-11T00:00:00.000Z" } },
      { data: { level: 3, unlocked_at: "2026-01-11T00:00:00.000Z", started_at: null, passed_at: "2026-02-22T00:00:00.000Z" } }, // invalid after reset
      { data: { level: 3, unlocked_at: "2026-03-01T00:00:00.000Z", started_at: null, passed_at: "2026-03-05T00:00:00.000Z" } },
      { data: { level: 4, unlocked_at: "2026-03-05T00:00:00.000Z", started_at: null, passed_at: null } },
    ];
    const resets = [
      { data: { target_level: 3, confirmed_at: "2026-03-01T00:00:00.000Z" } },
    ];

    const summary = calculateWkstatsLevelTimingSummary(progressions, resets, 4);

    // Completed durations should be level1=2d, level2=8d, level3=4d.
    expect(summary.averageLevelDurationDays).toBeCloseTo((2 + 8 + 4) / 3, 6);
    expect(summary.medianLevelDurationDays).toBeCloseTo(4, 6);
    expect(summary.currentLevelDurationDays).toBeCloseTo(2, 6);
    expect(summary.levelUpInDays).toBeCloseTo(2, 6);
  });
});

