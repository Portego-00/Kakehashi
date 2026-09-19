import { describe, expect, it } from "vitest";
import { analyticsGridColumns, analyticsGridOrphanIndices } from "./analytics-grid";

describe("analytics grid measurements", () => {
  it("only makes two columns when both have enough content width", () => {
    expect(analyticsGridColumns(703, 16)).toBe(1);
    expect(analyticsGridColumns(704, 16)).toBe(2);
    expect(analyticsGridColumns(1600, 16)).toBe(2);
    expect(analyticsGridColumns(320, 16)).toBe(1);
  });

  it("keeps narrow or unavailable container measurements in a single column", () => {
    expect(analyticsGridColumns(0, 16)).toBe(1);
    expect(analyticsGridColumns(NaN, 16)).toBe(1);
    expect(analyticsGridColumns(360, 16)).toBe(1);
  });
});

describe("analytics grid orphan rows", () => {
  it("stretches only unpaired compact cards before wide barriers or at the end", () => {
    expect(analyticsGridOrphanIndices(["compact", "wide", "compact"], 2)).toEqual([0, 2]);
    expect(analyticsGridOrphanIndices(["compact", "compact", "compact", "wide", "compact", "compact"], 2)).toEqual([2]);
    expect(analyticsGridOrphanIndices(["wide", "compact", "compact", "wide"], 2)).toEqual([]);
  });

  it("does not mark single-column layouts, wide-only layouts or an empty dashboard", () => {
    expect(analyticsGridOrphanIndices(["compact", "wide", "compact"], 1)).toEqual([]);
    expect(analyticsGridOrphanIndices(["wide", "wide"], 2)).toEqual([]);
    expect(analyticsGridOrphanIndices([], 2)).toEqual([]);
  });

  it("recomputes pairings without mutating the saved size choices", () => {
    const sizes = ["compact", "compact", "wide", "compact"] as const;
    expect(analyticsGridOrphanIndices(sizes, 2)).toEqual([3]);
    expect(analyticsGridOrphanIndices(sizes.filter((_, index) => index !== 1), 2)).toEqual([0, 2]);
    expect(sizes).toEqual(["compact", "compact", "wide", "compact"]);
  });
});
