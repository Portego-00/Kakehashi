import { describe, expect, it } from "vitest";
import { DEFAULT_ANALYTICS_LAYOUT, moveAnalyticsCard, normalizeAnalyticsLayout, toggleAnalyticsCardSize } from "./analytics-layout";

describe("custom analytics layout", () => {
  it("keeps saved order and restores new or missing cards", () => {
    const layout = normalizeAnalyticsLayout([{ id: "timing", size: "compact" }, { id: "accuracy", size: "wide" }, { id: "unknown" }]);
    expect(layout.map((card) => card.id)).toEqual(["timing", "accuracy", "srs", "forecast", "activity"]);
    expect(layout[0].size).toBe("compact");
  });

  it("moves and resizes cards without mutating the input", () => {
    const moved = moveAnalyticsCard(DEFAULT_ANALYTICS_LAYOUT, "timing", "srs");
    expect(moved.map((card) => card.id)).toEqual(["accuracy", "timing", "srs", "forecast", "activity"]);
    expect(DEFAULT_ANALYTICS_LAYOUT.at(-1)?.id).toBe("timing");
    expect(toggleAnalyticsCardSize(moved, "timing").find((card) => card.id === "timing")?.size).toBe("compact");
  });
});
