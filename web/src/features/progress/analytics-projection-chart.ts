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

export function createLevelHistory(timings: LevelTiming[], currentLevel: number, now: Date) {
  const points = timings.filter((timing) => timing.startedAt && timing.level <= currentLevel)
    .map((timing) => ({ timestamp: Date.parse(timing.startedAt!), level: timing.level }))
    .filter((point) => Number.isFinite(point.timestamp) && point.timestamp <= now.getTime())
    .sort((a, b) => a.timestamp - b.timestamp);
  if (points.length) points.push({ timestamp: now.getTime(), level: currentLevel });
  return points;
}

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
export function projectionTimeline(curves: ProjectionCurve[], history: ProjectionCurve["points"] = []) {
  const timestamps = [...new Set([...history.map((point) => point.timestamp), ...curves.flatMap((curve) => curve.points.map((point) => point.timestamp))])].sort((a, b) => a - b);
  const rows = timestamps.map((timestamp) => {
    const row: Record<string, number | null> & { timestamp: number } = { timestamp };
    row.history = timestamp <= (history.at(-1)?.timestamp ?? -Infinity) ? history.findLast((point) => point.timestamp <= timestamp)?.level ?? null : null;
    for (const curve of curves) {
      const end = curve.points.at(-1)!;
      if (timestamp < curve.points[0].timestamp || timestamp > end.timestamp) { row[curve.key] = null; continue; }
      // An overdue current level can produce two arrivals at "now". Keep the later arrival.
      const before = curve.points.findLast((point) => point.timestamp <= timestamp)!;
      const after = curve.points.find((point) => point.timestamp > timestamp);
      row[curve.key] = after ? before.level + (after.level - before.level) * (timestamp - before.timestamp) / (after.timestamp - before.timestamp) : before.level;
    }
    return row;
  });
  const anchor = curves[0]?.points[0].timestamp;
  if (anchor !== undefined && curves.some((curve) => curve.points[1]?.timestamp === anchor)) {
    const index = rows.findIndex((row) => row.timestamp === anchor);
    rows.splice(index, 0, { timestamp: anchor, history: rows[index].history, ...Object.fromEntries(curves.map((curve) => [curve.key, curve.points[0].level])) });
  }
  return rows;
}
