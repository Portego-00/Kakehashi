import { describe, expect, it } from "vitest";
import {
  ANALYTICS_CARD_IDS,
  ANALYTICS_WIDGET_CATALOG,
  DEFAULT_ANALYTICS_LAYOUT,
  createAnalyticsPreset,
  matchingAnalyticsPreset,
  moveAnalyticsCard,
  moveAnalyticsCardBy,
  normalizeAnalyticsDashboardConfig,
  normalizeAnalyticsLayout,
  toggleAnalyticsCardSize,
} from "./analytics-layout";

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

  it("keeps both edge positions stable when moving past the available widgets", () => {
    expect(moveAnalyticsCardBy(DEFAULT_ANALYTICS_LAYOUT, "accuracy", -1)).toBe(DEFAULT_ANALYTICS_LAYOUT);
    expect(moveAnalyticsCardBy(DEFAULT_ANALYTICS_LAYOUT, "timing", 1)).toBe(DEFAULT_ANALYTICS_LAYOUT);
    expect(moveAnalyticsCardBy(DEFAULT_ANALYTICS_LAYOUT, "reading", 1)).toBe(DEFAULT_ANALYTICS_LAYOUT);
  });
});

describe("analytics dashboard configuration", () => {
  it("defaults projections to full width and removes retired achievements from saved layouts", () => {
    expect(createAnalyticsPreset("overview").cards.find((card) => card.id === "pace")?.size).toBe("wide");
    expect(normalizeAnalyticsDashboardConfig({ version: 2, cards: [{ id: "levels", size: "compact" }, { id: "achievements", size: "wide" }] }).cards).toEqual([{ id: "levels", size: "compact" }]);
    const oldDefault = createAnalyticsPreset("overview");
    delete oldDefault.layoutRevision;
    oldDefault.cards[0].size = "compact";
    expect(normalizeAnalyticsDashboardConfig(oldDefault).cards[0].size).toBe("wide");
    expect(normalizeAnalyticsDashboardConfig({ ...oldDefault, layoutRevision: 1 }).cards[0].size).toBe("compact");
  });
  it.each([
    [{ id: "timing", size: "compact" }, { id: "accuracy", size: "wide" }],
    { version: 1, cards: [{ id: "timing", size: "compact" }, { id: "accuracy", size: "wide" }] },
    { version: 1, layout: [{ id: "timing", size: "compact" }, { id: "accuracy", size: "wide" }] },
  ])("migrates a legacy configuration without losing the chosen order or width", (saved) => {
    const config = normalizeAnalyticsDashboardConfig(saved);
    expect(config.version).toBe(2);
    expect(config.cards.slice(0, 5)).toEqual([
      { id: "timing", size: "compact" }, { id: "accuracy", size: "wide" },
      { id: "srs", size: "compact" }, { id: "forecast", size: "compact" }, { id: "activity", size: "wide" },
    ]);
    expect(config.cards.map((card) => card.id)).toEqual(expect.arrayContaining(createAnalyticsPreset("overview").cards.map((card) => card.id)));
    expect(new Set(config.cards.map((card) => card.id)).size).toBe(config.cards.length);
  });

  it("preserves hidden widgets in version 2 while repairing corrupt entries", () => {
    const config = normalizeAnalyticsDashboardConfig({ version: 2, cards: [
      { id: "coverage", size: "compact" }, { id: "unknown", size: "wide" },
      null, { id: "coverage", size: "wide" }, { id: "reading", size: "broken" },
    ] });
    expect(config.cards).toEqual([{ id: "coverage", size: "compact" }, { id: "reading", size: "wide" }]);
  });

  it("distinguishes an intentionally empty selection from unusable stored data", () => {
    expect(normalizeAnalyticsDashboardConfig({ version: 2, cards: [] }).cards).toEqual([]);
    for (const saved of [null, {}, { version: 3, cards: [] }, { version: 2, cards: "invalid" }, { version: 2, cards: [{ id: "removed" }] }]) {
      expect(normalizeAnalyticsDashboardConfig(saved)).toEqual(createAnalyticsPreset("overview"));
    }
  });

  it("offers every widget in deep dive and returns independent preset copies", () => {
    const first = createAnalyticsPreset("deep-dive");
    const second = createAnalyticsPreset("deep-dive");
    expect(new Set(first.cards.map((card) => card.id))).toEqual(new Set(ANALYTICS_CARD_IDS));
    expect(ANALYTICS_WIDGET_CATALOG).toHaveLength(ANALYTICS_CARD_IDS.length);
    first.cards[0].size = "compact";
    first.cards.pop();
    expect(second.cards).toHaveLength(ANALYTICS_CARD_IDS.length);
    expect(second.cards[0].size).toBe("wide");
  });

  it("recognizes a preset only when both its order and widths match", () => {
    const config = createAnalyticsPreset("study-habits");
    expect(matchingAnalyticsPreset(config)).toBe("study-habits");
    expect(matchingAnalyticsPreset({ ...config, cards: toggleAnalyticsCardSize(config.cards, "summary") })).toBeNull();
    expect(matchingAnalyticsPreset({ ...config, cards: moveAnalyticsCardBy(config.cards, "summary", 1) })).toBeNull();
  });
});
