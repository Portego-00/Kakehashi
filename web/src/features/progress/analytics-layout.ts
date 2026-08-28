export const ANALYTICS_CARD_IDS = ["accuracy", "srs", "forecast", "activity", "timing"] as const;

export type AnalyticsCardId = (typeof ANALYTICS_CARD_IDS)[number];
export type AnalyticsCardSize = "compact" | "wide";
export type AnalyticsCardLayout = { id: AnalyticsCardId; size: AnalyticsCardSize };

export const DEFAULT_ANALYTICS_LAYOUT: AnalyticsCardLayout[] = [
  { id: "accuracy", size: "wide" },
  { id: "srs", size: "compact" },
  { id: "forecast", size: "compact" },
  { id: "activity", size: "wide" },
  { id: "timing", size: "wide" },
];

const CARD_IDS = new Set<string>(ANALYTICS_CARD_IDS);

export function normalizeAnalyticsLayout(value: unknown): AnalyticsCardLayout[] {
  if (!Array.isArray(value)) return DEFAULT_ANALYTICS_LAYOUT.map((card) => ({ ...card }));
  const parsed = value.filter((entry): entry is { id: AnalyticsCardId; size?: string } => Boolean(entry && typeof entry === "object" && "id" in entry && CARD_IDS.has(String(entry.id))));
  const seen = new Set<AnalyticsCardId>();
  const result: AnalyticsCardLayout[] = [];
  for (const entry of parsed) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    result.push({ id: entry.id, size: entry.size === "compact" ? "compact" : "wide" });
  }
  for (const fallback of DEFAULT_ANALYTICS_LAYOUT) {
    if (!seen.has(fallback.id)) result.push({ ...fallback });
  }
  return result;
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
