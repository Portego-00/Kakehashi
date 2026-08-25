import { describe, expect, it } from "vitest";
import { chartBarHeight } from "./Dashboard";

describe("dashboard chart scaling", () => {
  it("uses the largest count as the full chart height", () => {
    expect(chartBarHeight(80, 80)).toBe("100%");
  });

  it("preserves proportional differences between counts", () => {
    expect(chartBarHeight(20, 80)).toBe("25%");
  });

  it("keeps empty buckets at a true zero height", () => {
    expect(chartBarHeight(0, 80)).toBe("0%");
  });

  it("caps stale values that exceed the computed maximum", () => {
    expect(chartBarHeight(90, 80)).toBe("100%");
  });
});
