import { REVIEW_ORDER_OPTIONS, type ReviewOrderSetting } from "./reviewOrdering";

export const MAX_REVIEW_PRESETS = 3;
export const REVIEW_PRESET_NAME_MAX_LENGTH = 18;

export type ReviewPreset = {
  id: string;
  name: string;
  batchSize: number;
  reviewOrder: ReviewOrderSetting;
};

export function normalizeReviewPresets(value: unknown): ReviewPreset[] {
  if (!Array.isArray(value)) return [];
  const presets: ReviewPreset[] = [];
  const ids = new Set<string>();
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const id = typeof entry.id === "string" ? entry.id.trim() : "";
    const name = typeof entry.name === "string"
      ? entry.name.trim().replace(/\s+/g, " ").slice(0, REVIEW_PRESET_NAME_MAX_LENGTH)
      : "";
    const order = REVIEW_ORDER_OPTIONS.find((option) => option.value === entry.reviewOrder);
    if (!id || id.length > 80 || ids.has(id) || !name || !order ||
        !Number.isInteger(entry.batchSize) || entry.batchSize < 5 ||
        entry.batchSize > 100 || entry.batchSize % 5 !== 0) continue;
    ids.add(id);
    presets.push({ id, name, batchSize: entry.batchSize, reviewOrder: order.value });
    if (presets.length === MAX_REVIEW_PRESETS) break;
  }
  return presets;
}

export function getEnabledReviewPreset(
  preferences: {
    reviewBatchSizeEnabled?: boolean;
    reviewPresetsEnabled?: boolean;
    reviewPresets?: unknown;
  },
  id: unknown,
): ReviewPreset | null {
  if (!preferences.reviewBatchSizeEnabled || !preferences.reviewPresetsEnabled || typeof id !== "string") return null;
  return normalizeReviewPresets(preferences.reviewPresets).find((preset) => preset.id === id) ?? null;
}

export function applyReviewPreset<T extends {
  reviewBatchSizeEnabled: boolean;
  reviewBatchSize: number;
  reviewOrder: ReviewOrderSetting;
}>(preferences: T, preset: ReviewPreset | null): T {
  return preset ? {
    ...preferences,
    reviewBatchSizeEnabled: true,
    reviewBatchSize: preset.batchSize,
    reviewOrder: preset.reviewOrder,
  } : preferences;
}
