export type AnalyticsPaceSettings = {
  version: 1;
  goalLevel: number;
  paceOverride: number | null;
  origin: "unlocked" | "started";
  excludedLevels: number[];
  targetDate: string;
  clipOutliers: boolean;
  scenario?: "median" | "faster" | "relaxed" | "custom";
};

export function createDefaultPaceSettings(): AnalyticsPaceSettings {
  return { version: 1, goalLevel: 60, paceOverride: null, origin: "unlocked", excludedLevels: [1, 2], targetDate: "", clipOutliers: false };
}

export function paceSettingsStorageKey(accountKey: string): string {
  return `kakehashi:analytics-pace:v1:${encodeURIComponent(accountKey)}`;
}

function isLevel(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 60;
}

function isTargetDate(value: unknown): value is string {
  if (value === "") return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && timestamp >= Date.UTC(2000, 0, 1) && timestamp < Date.UTC(2101, 0, 1) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

export function normalizePaceSettings(value: unknown): AnalyticsPaceSettings {
  const defaults = createDefaultPaceSettings();
  if (value === null || typeof value !== "object" || Array.isArray(value) || !("version" in value) || value.version !== 1) return defaults;
  const input = value as Record<string, unknown>;
  const pace = input.paceOverride;
  return {
    version: 1,
    goalLevel: isLevel(input.goalLevel) ? input.goalLevel : defaults.goalLevel,
    paceOverride: typeof pace === "number" && Number.isFinite(pace) && pace >= 6 && pace <= 60 && Number.isInteger(pace * 2) ? pace : null,
    origin: input.origin === "started" ? "started" : "unlocked",
    excludedLevels: Array.isArray(input.excludedLevels) && input.excludedLevels.length <= 120 ? [...new Set(input.excludedLevels.filter(isLevel))].sort((a, b) => a - b) : defaults.excludedLevels,
    targetDate: isTargetDate(input.targetDate) ? input.targetDate : defaults.targetDate,
    clipOutliers: input.clipOutliers === true,
    ...(["median", "faster", "relaxed", "custom"].includes(String(input.scenario)) ? { scenario: input.scenario as AnalyticsPaceSettings["scenario"] } : {}),
  };
}

export function parsePaceSettings(serialized: string | null): AnalyticsPaceSettings {
  if (!serialized || serialized.length > 10_000) return createDefaultPaceSettings();
  try { return normalizePaceSettings(JSON.parse(serialized)); }
  catch { return createDefaultPaceSettings(); }
}
