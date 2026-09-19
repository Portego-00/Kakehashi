export const ANALYTICS_CARD_IDS = [
  "accuracy", "srs", "forecast", "activity", "timing", "summary", "workload", "history",
  "levels", "items", "leeches", "pace", "retention", "studyTime", "coverage", "reading",
  "burns",
] as const;

export type AnalyticsCardId = (typeof ANALYTICS_CARD_IDS)[number];
export type AnalyticsCardSize = "compact" | "wide";
export type AnalyticsCardLayout = { id: AnalyticsCardId; size: AnalyticsCardSize };
export type AnalyticsDashboardConfig = { version: 2; cards: AnalyticsCardLayout[]; layoutRevision?: 1 };
export type AnalyticsPresetId = "overview" | "study-habits" | "deep-dive";
export type AnalyticsWidgetCategory = "Progress" | "Reviews" | "Study habits" | "Knowledge";
export type AnalyticsWidgetDefinition = {
  id: AnalyticsCardId;
  title: string;
  detail: string;
  category: AnalyticsWidgetCategory;
  defaultSize: AnalyticsCardSize;
};

export const ANALYTICS_WIDGET_CATALOG: readonly AnalyticsWidgetDefinition[] = [
  { id: "summary", title: "Study summary", detail: "Lessons, reviews and streaks", category: "Study habits", defaultSize: "wide" },
  { id: "pace", title: "Level projections", detail: "Recorded history and future milestones", category: "Progress", defaultSize: "wide" },
  { id: "levels", title: "Current level", detail: "Radical and kanji progress", category: "Progress", defaultSize: "compact" },
  { id: "accuracy", title: "Accuracy", detail: "Meaning and reading accuracy", category: "Reviews", defaultSize: "compact" },
  { id: "srs", title: "SRS distribution", detail: "Apprentice through Burned", category: "Knowledge", defaultSize: "compact" },
  { id: "coverage", title: "Kanji coverage", detail: "JLPT, Joyo and frequency", category: "Knowledge", defaultSize: "wide" },
  { id: "workload", title: "Review workload", detail: "Upcoming work and backlog", category: "Reviews", defaultSize: "compact" },
  { id: "forecast", title: "Review forecast", detail: "Lesson pace and modeled review load", category: "Reviews", defaultSize: "wide" },
  { id: "burns", title: "Burn progress", detail: "Burned items and future burns", category: "Knowledge", defaultSize: "compact" },
  { id: "activity", title: "Study activity", detail: "Daily activity and consistency", category: "Study habits", defaultSize: "wide" },
  { id: "timing", title: "Level timing", detail: "Time per level, average and median", category: "Progress", defaultSize: "wide" },
  { id: "history", title: "Review history", detail: "Review volume over time", category: "Reviews", defaultSize: "wide" },
  { id: "items", title: "Item explorer", detail: "Subject accuracy and SRS stages", category: "Knowledge", defaultSize: "wide" },
  { id: "leeches", title: "Difficult items", detail: "Repeated mistakes and weak subjects", category: "Reviews", defaultSize: "wide" },
  { id: "retention", title: "Retention", detail: "Recall by subject type and stage", category: "Reviews", defaultSize: "compact" },
  { id: "studyTime", title: "Study time", detail: "Time recorded across study activities", category: "Study habits", defaultSize: "compact" },
  { id: "reading", title: "Reading readiness", detail: "Kanji frequency and reading coverage", category: "Knowledge", defaultSize: "wide" },
];

export const ANALYTICS_PRESETS: readonly { id: AnalyticsPresetId; title: string }[] = [
  { id: "overview", title: "Overview" },
  { id: "study-habits", title: "Study habits" },
  { id: "deep-dive", title: "Deep dive" },
];

const PRESET_WIDGET_IDS: Record<AnalyticsPresetId, readonly AnalyticsCardId[]> = {
  overview: ["pace", "levels", "accuracy", "srs", "coverage", "workload", "burns", "activity", "timing"],
  "study-habits": ["summary", "activity", "history", "retention", "studyTime", "workload", "forecast", "leeches"],
  "deep-dive": ANALYTICS_WIDGET_CATALOG.map((widget) => widget.id),
};

export function createAnalyticsPreset(preset: AnalyticsPresetId): AnalyticsDashboardConfig {
  return {
    version: 2,
    layoutRevision: 1,
    cards: PRESET_WIDGET_IDS[preset].map((id) => ({ id, size: ANALYTICS_WIDGET_CATALOG.find((widget) => widget.id === id)!.defaultSize })),
  };
}

export const DEFAULT_ANALYTICS_DASHBOARD_CONFIG = createAnalyticsPreset("overview");

export const DEFAULT_ANALYTICS_LAYOUT: AnalyticsCardLayout[] = [
  { id: "accuracy", size: "wide" },
  { id: "srs", size: "compact" },
  { id: "forecast", size: "compact" },
  { id: "activity", size: "wide" },
  { id: "timing", size: "wide" },
];

const CARD_IDS = new Set<string>(ANALYTICS_CARD_IDS);

function parseAnalyticsCards(value: unknown[]): AnalyticsCardLayout[] {
  const seen = new Set<AnalyticsCardId>();
  const result: AnalyticsCardLayout[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || !("id" in entry) || typeof entry.id !== "string" || !CARD_IDS.has(entry.id)) continue;
    const id = entry.id as AnalyticsCardId;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({ id, size: "size" in entry && entry.size === "compact" ? "compact" : "wide" });
  }
  return result;
}

export function normalizeAnalyticsLayout(value: unknown): AnalyticsCardLayout[] {
  if (!Array.isArray(value)) return DEFAULT_ANALYTICS_LAYOUT.map((card) => ({ ...card }));
  const result = parseAnalyticsCards(value);
  const seen = new Set(result.map((card) => card.id));
  for (const fallback of DEFAULT_ANALYTICS_LAYOUT) {
    if (!seen.has(fallback.id)) result.push({ ...fallback });
  }
  return result;
}

export function normalizeAnalyticsDashboardConfig(value: unknown): AnalyticsDashboardConfig {
  if (value && typeof value === "object" && "version" in value && value.version === 2) {
    if (!("cards" in value) || !Array.isArray(value.cards)) return createAnalyticsPreset("overview");
    const cards = parseAnalyticsCards(value.cards);
    for (const presetId of ["overview", "deep-dive"] as const) {
      const preset = createAnalyticsPreset(presetId);
      const wasDefault = cards.length === preset.cards.length && cards.every((card, index) => card.id === preset.cards[index].id && (card.id === "pace" || card.size === preset.cards[index].size));
      if (!("layoutRevision" in value) && wasDefault) return preset;
    }
    return cards.length || value.cards.length === 0 ? { version: 2, cards, ...("layoutRevision" in value && value.layoutRevision === 1 ? { layoutRevision: 1 as const } : {}) } : createAnalyticsPreset("overview");
  }

  let legacy: unknown = value;
  if (value && typeof value === "object" && "version" in value) {
    if (value.version !== 1) return createAnalyticsPreset("overview");
    legacy = "cards" in value ? value.cards : "layout" in value ? value.layout : undefined;
  }
  if (!Array.isArray(legacy)) return createAnalyticsPreset("overview");

  // Version 1 always showed its five widgets; keep their order and introduce the overview additions.
  const cards = normalizeAnalyticsLayout(legacy);
  const seen = new Set(cards.map((card) => card.id));
  for (const card of DEFAULT_ANALYTICS_DASHBOARD_CONFIG.cards) {
    if (!seen.has(card.id)) cards.push({ ...card });
  }
  return { version: 2, cards };
}

export function matchingAnalyticsPreset(config: AnalyticsDashboardConfig): AnalyticsPresetId | null {
  return ANALYTICS_PRESETS.find(({ id }) => {
    const preset = createAnalyticsPreset(id);
    return preset.cards.length === config.cards.length && preset.cards.every((card, index) => card.id === config.cards[index].id && card.size === config.cards[index].size);
  })?.id ?? null;
}

export function moveAnalyticsCard(layout: AnalyticsCardLayout[], source: AnalyticsCardId, target: AnalyticsCardId) {
  if (source === target) return layout;
  const sourceIndex = layout.findIndex((card) => card.id === source);
  const targetIndex = layout.findIndex((card) => card.id === target);
  if (sourceIndex < 0 || targetIndex < 0) return layout;
  const next = [...layout];
  const [moved] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, moved);
  return next;
}

export function moveAnalyticsCardBy(layout: AnalyticsCardLayout[], id: AnalyticsCardId, offset: -1 | 1) {
  const index = layout.findIndex((card) => card.id === id);
  const target = layout[index + offset];
  return target ? moveAnalyticsCard(layout, id, target.id) : layout;
}

export function toggleAnalyticsCardSize(layout: AnalyticsCardLayout[], id: AnalyticsCardId) {
  return layout.map((card): AnalyticsCardLayout => card.id === id ? { ...card, size: card.size === "wide" ? "compact" : "wide" } : card);
}
