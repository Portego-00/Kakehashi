import type { CustomSrsPolicyMetadata, CustomSrsSettings } from "./types";

// Standard WaniKani intervals in minutes (the day-or-longer waits are one hour shorter).
export const WANIKANI_INTERVALS = [240, 480, 1380, 2820, 10020, 20100, 43140, 172740];
export const DEFAULT_CUSTOM_SRS_SETTINGS: CustomSrsSettings = {
  mode: "wanikani",
  stageIntervals: WANIKANI_INTERVALS,
  learningSteps: ["4h", "8h"],
  relearningSteps: ["4h"],
  requestRetention: 0.9,
  maximumInterval: 36500,
  roundToHour: true,
};
export const LEGACY_CUSTOM_SRS_SETTINGS: CustomSrsSettings = { ...DEFAULT_CUSTOM_SRS_SETTINGS, mode: "fsrs" };

export function stepMinutes(value: string): number {
  const match = /^(\d+(?:\.\d+)?)(m|h|d)$/.exec(value);
  return match ? Number(match[1]) * ({ m: 1, h: 60, d: 1440 }[match[2]] ?? 0) : NaN;
}

export function customSrsSettingsError(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Choose valid scheduling settings.";
  const settings = value as CustomSrsSettings;
  const keys = Object.keys(DEFAULT_CUSTOM_SRS_SETTINGS);
  if (Object.keys(value).some((key) => !keys.includes(key)) || keys.some((key) => !(key in value))) return "The scheduling settings are incomplete or unsupported.";
  if (settings.mode !== "wanikani" && settings.mode !== "fsrs") return "Choose a scheduling mode.";
  if (!Array.isArray(settings.stageIntervals) || settings.stageIntervals.length !== 8
    || settings.stageIntervals.some((minutes) => !Number.isSafeInteger(minutes) || minutes < 1 || minutes > 36500 * 1440)) return "Each stage interval must be between 1 minute and 100 years, in whole minutes.";
  if (settings.stageIntervals.some((minutes, index) => index > 0 && minutes < settings.stageIntervals[index - 1])) return "Stage intervals must stay the same or increase as a word progresses.";
  for (const [label, steps] of [["Learning", settings.learningSteps], ["Relearning", settings.relearningSteps]] as const) {
    if (!Array.isArray(steps) || steps.length < 1 || steps.length > 8
      || steps.some((step) => typeof step !== "string" || step.length > 12 || !Number.isFinite(stepMinutes(step)) || stepMinutes(step) < 1 || stepMinutes(step) > 1440)) return `${label} steps need 1–8 durations between 1 minute and 1 day (for example: 10m, 4h).`;
    if (steps.some((step, index) => index > 0 && stepMinutes(step) < stepMinutes(steps[index - 1]))) return `${label} steps must stay the same or increase.`;
  }
  if (!Number.isFinite(settings.requestRetention) || settings.requestRetention < 0.7 || settings.requestRetention > 0.99) return "Target retention must be between 70% and 99%.";
  if (!Number.isSafeInteger(settings.maximumInterval) || settings.maximumInterval < 1 || settings.maximumInterval > 36500) return "Maximum interval must be a whole number from 1 to 36,500 days.";
  if (typeof settings.roundToHour !== "boolean") return "Choose whether to group reviews by hour.";
  return null;
}

export function settingsForPolicy(policy: CustomSrsPolicyMetadata): CustomSrsSettings {
  return policy.version === 2 ? policy.settings : LEGACY_CUSTOM_SRS_SETTINGS;
}

export function settingsRevision(policy: CustomSrsPolicyMetadata): number {
  return policy.version === 2 ? policy.settingsRevision : 0;
}
