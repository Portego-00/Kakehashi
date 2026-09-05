import {
  ACTIVITY_CATEGORIES,
  type ActivityCategory,
  type RangeSummary,
} from "./timeTrackingCore";

export const STUDY_TIME_HISTORY_CACHE_VERSION = 1;
// The response combines multiple OTHER devices, so a legitimate calendar-day
// total may exceed 24 hours. A 100-device ceiling is intentionally far above
// legitimate simultaneous-device sums while rejecting hostile values.
export const MAX_AGGREGATE_MS_PER_DAY = 100 * 24 * 60 * 60 * 1000;
// The server accepts the union of every timezone's 430-local-day window:
// UTC today-430 through tomorrow can contain at most 432 distinct date keys.
const MAX_HISTORY_DAY_COUNT = 432;

export type OtherDeviceStudyTimeDay = {
  day: string;
  appTotalMs: number;
  byCategoryMs: Record<ActivityCategory, number>;
};

export type StudyTimeHistoryCache = {
  version: typeof STUDY_TIME_HISTORY_CACHE_VERSION;
  userId: string;
  deviceId: string;
  updatedAt: number;
  days: OtherDeviceStudyTimeDay[];
};

type StudyTimeHistoryResponse = {
  days: OtherDeviceStudyTimeDay[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidDateKey(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function readMilliseconds(value: unknown, field: string): number {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_AGGREGATE_MS_PER_DAY
  ) {
    throw new Error(`Invalid study time history field: ${field}`);
  }
  return value;
}

function parseDay(value: unknown): OtherDeviceStudyTimeDay {
  if (
    !isObject(value) ||
    !isValidDateKey(value.day) ||
    !isObject(value.byCategoryMs)
  ) {
    throw new Error("Invalid study time history day");
  }

  const byCategoryMs = {} as Record<ActivityCategory, number>;
  for (const category of ACTIVITY_CATEGORIES) {
    byCategoryMs[category] = readMilliseconds(
      value.byCategoryMs[category],
      `byCategoryMs.${category}`,
    );
  }

  const appTotalMs = readMilliseconds(value.appTotalMs, "appTotalMs");
  const studyTotalMs = ACTIVITY_CATEGORIES.reduce(
    (total, category) => total + byCategoryMs[category],
    0,
  );
  if (studyTotalMs > appTotalMs) {
    throw new Error("Study time history exceeds app total");
  }

  return {
    day: value.day,
    appTotalMs,
    byCategoryMs,
  };
}

/** Validate and normalize the history edge-function response. */
export function parseStudyTimeHistoryResponse(
  value: unknown,
): StudyTimeHistoryResponse {
  if (
    !isObject(value) ||
    !Array.isArray(value.days) ||
    value.days.length > MAX_HISTORY_DAY_COUNT
  ) {
    throw new Error("Invalid study time history response");
  }

  const seenDays = new Set<string>();
  const days = value.days.map((candidate) => {
    const day = parseDay(candidate);
    if (seenDays.has(day.day)) {
      throw new Error(`Duplicate study time history day: ${day.day}`);
    }
    seenDays.add(day.day);
    return day;
  });

  days.sort((left, right) => left.day.localeCompare(right.day));
  return { days };
}

export function createStudyTimeHistoryCache(
  userId: string,
  deviceId: string,
  days: OtherDeviceStudyTimeDay[],
  updatedAt: number = Date.now(),
): StudyTimeHistoryCache {
  if (!userId.trim() || !deviceId.trim()) {
    throw new Error("Study time history cache scope is missing");
  }
  if (!Number.isSafeInteger(updatedAt) || updatedAt < 0) {
    throw new Error("Invalid study time history cache timestamp");
  }

  const normalizedDays = parseStudyTimeHistoryResponse({ days }).days;
  return {
    version: STUDY_TIME_HISTORY_CACHE_VERSION,
    userId,
    deviceId,
    updatedAt,
    days: normalizedDays,
  };
}

/**
 * Parse a cache only when it belongs to this verified user and current device.
 * The device scope matters because the server aggregate excludes that device.
 */
export function parseStudyTimeHistoryCache(
  value: unknown,
  expectedUserId: string,
  expectedDeviceId: string,
): StudyTimeHistoryCache | null {
  if (
    !isObject(value) ||
    value.version !== STUDY_TIME_HISTORY_CACHE_VERSION ||
    value.userId !== expectedUserId ||
    value.deviceId !== expectedDeviceId ||
    !Number.isSafeInteger(value.updatedAt) ||
    (value.updatedAt as number) < 0
  ) {
    return null;
  }

  try {
    return createStudyTimeHistoryCache(
      expectedUserId,
      expectedDeviceId,
      parseStudyTimeHistoryResponse({ days: value.days }).days,
      value.updatedAt as number,
    );
  } catch {
    return null;
  }
}

export function studyMsOfOtherDeviceDay(day: OtherDeviceStudyTimeDay): number {
  return ACTIVITY_CATEGORIES.reduce(
    (total, category) => total + day.byCategoryMs[category],
    0,
  );
}

/**
 * Add the server's OTHER-device aggregate to a local summary. The callback is
 * used only for active-day unioning; same-day activity across devices counts
 * as one active calendar day, while its durations remain additive.
 */
export function mergeOtherDeviceDaysIntoSummary(
  localSummary: RangeSummary,
  otherDeviceDays: OtherDeviceStudyTimeDay[],
  startKey: string,
  endKey: string,
  hasLocalStudyOnDay: (day: string) => boolean,
): RangeSummary {
  const merged: RangeSummary = {
    ...localSummary,
    byCategory: { ...localSummary.byCategory },
    byActivity: { ...localSummary.byActivity },
  };

  for (const day of otherDeviceDays) {
    if (day.day < startKey || day.day > endKey) {
      continue;
    }

    const otherStudyMs = studyMsOfOtherDeviceDay(day);
    merged.studyMs += otherStudyMs;
    merged.appTotalMs += day.appTotalMs;
    for (const category of ACTIVITY_CATEGORIES) {
      merged.byCategory[category] += day.byCategoryMs[category];
    }

    if (otherStudyMs > 0 && !hasLocalStudyOnDay(day.day)) {
      merged.activeDayCount += 1;
    }
  }

  return merged;
}
