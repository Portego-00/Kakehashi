import { describe, expect, it } from "vitest";
import { calculateAnalyticsAchievements } from "./analytics-achievements";
import { analyticsTestNow as now, testAssignment, testStatistic } from "./analytics-test-fixtures";

describe("evidence-based analytics achievements", () => {
  it("defines at least 71 meaningful milestones without inventing device activity", () => {
    const achievements = calculateAnalyticsAchievements({ assignments: [], statistics: [], timings: [], currentLevel: 1, now });
    expect(achievements.length).toBeGreaterThanOrEqual(71);
    expect(new Set(achievements.map((item) => item.id)).size).toBe(achievements.length);
    expect(achievements.every((item) => !item.achieved && item.earnedAt === null)).toBe(true);
    expect(achievements.some((item) => item.category === "consistency")).toBe(false);
  });

  it("uses the threshold's actual lesson date and hides unsupported unlock dates", () => {
    const assignments = Array.from({ length: 10 }, (_, index) => testAssignment(index + 1, { started_at: new Date(Date.parse("2026-09-01T00:00:00Z") + index * 3_600_000).toISOString() }));
    const achievements = calculateAnalyticsAchievements({ assignments, statistics: [testStatistic(1)], timings: [], currentLevel: 10, now });
    expect(achievements.find((item) => item.id === "subjects-10")).toMatchObject({ achieved: true, earnedAt: "2026-09-01T09:00:00.000Z" });
    expect(achievements.find((item) => item.id === "flawless-1")).toMatchObject({ achieved: true, earnedAt: null });
    expect(achievements.find((item) => item.id === "level-10")).toMatchObject({ achieved: true, earnedAt: null });
  });

  it("does not award fast-level medals based on accelerated introductory levels", () => {
    const timings = [{ level: 1, startedAt: "2026-09-01T00:00:00Z", passedAt: "2026-09-03T00:00:00Z", completedAt: null, daysToPass: 2, daysToComplete: null, activeDays: 2 }];
    const achievements = calculateAnalyticsAchievements({ assignments: [], statistics: [], timings, currentLevel: 2, now });
    expect(achievements.filter((item) => item.category === "pace").every((item) => !item.achieved)).toBe(true);
  });
});
