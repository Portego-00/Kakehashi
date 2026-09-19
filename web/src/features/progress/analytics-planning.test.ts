import { describe, expect, it } from "vitest";
import { levelPaceQuartiles, requiredLevelPace } from "./analytics-planning";

describe("required level pace", () => {
  it.each([[100, 10, 0, 10], [100, 10, 5, 10.5], [10, 3, 20, 5], [10, 1, 20, 30]])("inverts the remaining-level projection for %s days", (days, levels, elapsed, expected) => {
    const pace = requiredLevelPace(days, levels, elapsed)!;
    expect(pace).toBe(expected);
    expect(Math.max(0, pace - elapsed) + (levels - 1) * pace).toBeCloseTo(days);
  });
  it("rejects reached goals and invalid targets", () => {
    expect(requiredLevelPace(0, 1, 1)).toBeNull();
    expect(requiredLevelPace(10, 0, 1)).toBeNull();
    expect(requiredLevelPace(NaN, 1, 1)).toBeNull();
  });
});

describe("level pace range", () => {
  it("uses interpolated quartiles without mutating input", () => {
    const values = [20, 8, 12, 10];
    expect(levelPaceQuartiles(values)).toEqual([9.5, 14]);
    expect(values).toEqual([20, 8, 12, 10]);
  });
  it("handles absent and single-level histories", () => {
    expect(levelPaceQuartiles([])).toBeNull();
    expect(levelPaceQuartiles([NaN, -1, 10])).toEqual([10, 10]);
  });
});
