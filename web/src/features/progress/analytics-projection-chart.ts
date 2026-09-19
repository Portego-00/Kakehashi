import { calculateLevelProjection } from "./analytics-insights";
import type { LevelTiming } from "./calculations";

export type ProjectionScenario = {
  key: "median" | "faster" | "relaxed" | "custom";
  label: string;
  pace: number | null;
  color: string;
};
export type ProjectionCurve = ProjectionScenario & {
  points: { timestamp: number; level: number }[];
};

export function createProjectionCurves(scenarios: ProjectionScenario[], timings: LevelTiming[], currentLevel: number, goalLevel: number, now: Date): ProjectionCurve[] {
  if (goalLevel <= currentLevel) return [];
  return scenarios.filter((scenario) => scenario.pace != null && Number.isFinite(scenario.pace) && scenario.pace > 0).map((scenario) => ({
    ...scenario,
    points: [
      { timestamp: now.getTime(), level: currentLevel },
      ...calculateLevelProjection({ timings, currentLevel, paceDays: scenario.pace, now, maxLevel: goalLevel })
        .filter((point) => point.status === "projected")
        .map((point) => ({ timestamp: Date.parse(point.date), level: point.level })),
    ],
  }));
}

/** A shared time axis keeps comparisons at the same date, not at the same array index. */
export function projectionTimeline(curves: ProjectionCurve[]) {
  const timestamps = [...new Set(curves.flatMap((curve) => curve.points.map((point) => point.timestamp)))].sort((a, b) => a - b);
  const rows = timestamps.map((timestamp) => {
    const row: Record<string, number | null> & { timestamp: number } = { timestamp };
    for (const curve of curves) {
      const end = curve.points.at(-1)!;
      if (timestamp > end.timestamp) { row[curve.key] = null; continue; }
      // An overdue current level can produce two arrivals at "now". Keep the later arrival.
      const before = curve.points.findLast((point) => point.timestamp <= timestamp)!;
      const after = curve.points.find((point) => point.timestamp > timestamp);
      row[curve.key] = after ? before.level + (after.level - before.level) * (timestamp - before.timestamp) / (after.timestamp - before.timestamp) : before.level;
    }
    return row;
  });
  if (curves.some((curve) => curve.points[1]?.timestamp === timestamps[0])) {
    rows.unshift({ timestamp: timestamps[0], ...Object.fromEntries(curves.map((curve) => [curve.key, curve.points[0].level])) });
  }
  return rows;
}
