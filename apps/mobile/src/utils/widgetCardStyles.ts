export const DEFAULT_WIDGET_CARD_STYLE_COLORS = {
  widgetLessonCardGradientStart: "#fe5bb6",
  widgetLessonCardGradientEnd: "#fa1f62",
  widgetReviewCardGradientStart: "#47acdd",
  widgetReviewCardGradientEnd: "#0093dd",
  widgetStreakCardGradientStart: "#FF7A18",
  widgetStreakCardGradientMiddle: "#FF5A3D",
  widgetStreakCardGradientEnd: "#FF3F6C",
} as const;

export type WidgetCardStyleColorKey = keyof typeof DEFAULT_WIDGET_CARD_STYLE_COLORS;

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

export function normalizeWidgetCardColor(value: string, fallback: string): string {
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
