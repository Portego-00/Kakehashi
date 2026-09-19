import { describe, expect, it } from "vitest";
import { createProjectionCurves, projectionTimeline, type ProjectionScenario } from "./analytics-projection-chart";
import type { LevelTiming } from "./calculations";

const now = new Date("2026-09-19T12:00:00Z");
const scenarios: ProjectionScenario[] = [
  { key: "faster", label: "Faster", pace: 7, color: "green" },
  { key: "median", label: "Typical", pace: 14, color: "blue" },
  { key: "relaxed", label: "Relaxed", pace: 21, color: "orange" },
];
const current: LevelTiming = { level: 21, startedAt: "2026-09-16T12:00:00Z", passedAt: null, completedAt: null, daysToPass: null, daysToComplete: null, activeDays: 3 };

describe("projection chart data", () => {
  it("anchors each scenario to today and stops at the chosen goal", () => {
    const curves = createProjectionCurves(scenarios, [current], 21, 30, now);
    for (const curve of curves) {
      expect(curve.points[0]).toEqual({ timestamp: now.getTime(), level: 21 });
      expect(curve.points.at(-1)?.level).toBe(30);
      expect(curve.points).toHaveLength(10);
    }
    expect(curves.map((curve) => (curve.points.at(-1)!.timestamp - now.getTime()) / 86400000)).toEqual([60, 123, 186]);
  });

  it("compares levels at the same time instead of comparing different arrival dates", () => {
    const curves = createProjectionCurves(scenarios, [], 21, 23, now);
    const rows = projectionTimeline(curves);
    const day14 = rows.find((row) => row.timestamp === now.getTime() + 14 * 86400000)!;
    expect(day14.faster).toBe(23);
    expect(day14.median).toBe(22);
    expect(day14.relaxed).toBeCloseTo(21 + 2 / 3);
    expect(rows.at(-1)).toMatchObject({ faster: null, median: null, relaxed: 23 });
  });

  it("keeps overdue levels finite and never predicts a past arrival", () => {
    const curves = createProjectionCurves(scenarios, [{ ...current, activeDays: 100 }], 21, 22, now);
    expect(curves.every((curve) => curve.points.at(-1)!.timestamp === now.getTime())).toBe(true);
    expect(projectionTimeline(curves)[0]).toMatchObject({ faster: 21, median: 21, relaxed: 21 });
    expect(projectionTimeline(curves)[1]).toMatchObject({ faster: 22, median: 22, relaxed: 22 });
  });

  it("handles reached goals, level 60, missing history and invalid paces", () => {
    expect(createProjectionCurves(scenarios, [], 60, 60, now)).toEqual([]);
    expect(createProjectionCurves(scenarios, [], 21, 10, now)).toEqual([]);
    expect(createProjectionCurves(scenarios.map((item) => ({ ...item, pace: null })), [], 21, 60, now)).toEqual([]);
    expect(createProjectionCurves([{ ...scenarios[0], pace: NaN }], [], 21, 60, now)).toEqual([]);
  });
});
