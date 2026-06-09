export const DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS = {
  widgetReviewHeatmapLevel1Color: "#9be9a8",
  widgetReviewHeatmapLevel2Color: "#40c463",
  widgetReviewHeatmapLevel3Color: "#30a14e",
  widgetReviewHeatmapLevel4Color: "#216e39",
  widgetLevelTimingFastColor: "#43aa8b",
  widgetLevelTimingAverageColor: "#007aff",
  widgetLevelTimingSlowColor: "#f77f00",
  widgetLevelTimingCurrentColor: "#8a8a8a",
  widgetLevelTimingResetColor: "#505050",
  widgetReviewStatsExcellentColor: "#43aa8b",
  widgetReviewStatsGoodColor: "#90be6d",
  widgetReviewStatsWarningColor: "#f9c74f",
  widgetReviewStatsPoorColor: "#f8961e",
  widgetReviewStatsBadColor: "#f94144",
  widgetReviewStatsMeaningAccentColor: "#a100f1",
  widgetReviewStatsReadingAccentColor: "#f100a1",
  widgetReviewStatsTotalAccentColor: "#3b82f6",
} as const;

export type AnalyticsWidgetStyleColorKey =
  keyof typeof DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS;

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function normalizeAnalyticsWidgetColor(
  value: string,
  fallback: string,
): string {
  const trimmed = (value || "").trim();

  if (!trimmed) {
    return fallback;
  }

  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;

  if (/^#[0-9a-f]{8}$/i.test(withHash)) {
    return withHash.slice(0, 7).toLowerCase();
  }

  if (isValidHexColor(withHash)) {
    return withHash.toLowerCase();
  }

  return fallback;
}
