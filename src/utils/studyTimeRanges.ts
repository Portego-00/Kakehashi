import { startOfMonth, startOfWeek } from "date-fns";
import {
  emptyRangeSummary,
  getLocalDateKey,
  type ActivityCategory,
  type RangeSummary,
} from "../services/timeTrackingCore";
import {
  mergeOtherDeviceDaysIntoSummary,
  type OtherDeviceStudyTimeDay,
} from "../services/studyTimeHistoryCore";
import {
  getCachedOtherDeviceStudyTimeDays,
} from "../services/studyTimeHistoryService";
import { timeTrackingService } from "../services/timeTrackingService";
import { normalizeStudyTimeUserId } from "../services/studyTimeStorageScope";
import { getDeviceId } from "../services/timeTrackingSyncService";
import { useAuthStore } from "./store";

export type StudyTimeRangeId = "today" | "week" | "month" | "all";
export type StudyTimeChartUnit = "day" | "week" | "month";

export type StudyTimeChartBucket = {
  id: string;
  startKey: string;
  endKey: string;
  label: string;
  accessibilityLabel: string;
  studyMs: number;
  byCategory: Record<ActivityCategory, number>;
  isCurrent: boolean;
};

export type StudyTimeRangeData = {
  summary: RangeSummary;
  startKey: string;
  endKey: string;
  elapsedDays: number;
  series: StudyTimeChartBucket[];
  chartTitle: string;
  chartUnit: StudyTimeChartUnit;
};

export const STUDY_TIME_RANGE_LABELS = ["Today", "Week", "Month", "All"];
export const STUDY_TIME_RANGE_IDS: StudyTimeRangeId[] = [
  "today",
  "week",
  "month",
  "all",
];

const DEFAULT_BUCKET_COUNT = 14;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function parseStudyTimeDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function daysBetweenInclusive(startKey: string, endKey: string): number {
  const diff = Math.round(
    (parseStudyTimeDateKey(endKey).getTime() -
      parseStudyTimeDateKey(startKey).getTime()) /
      ONE_DAY_MS,
  );
  return Math.max(1, diff + 1);
}

function getRangeStartKey(
  range: StudyTimeRangeId,
  now: Date,
  otherDeviceDays: OtherDeviceStudyTimeDay[],
  includeLocal: boolean,
): string {
  if (range === "week") {
    return getLocalDateKey(startOfWeek(now, { weekStartsOn: 1 }).getTime());
  }

  if (range === "month") {
    return getLocalDateKey(startOfMonth(now).getTime());
  }

  if (range === "all") {
    const firstDayKey = includeLocal
      ? timeTrackingService.getAllTimeSummary().firstDayKey
      : null;
    const firstOtherDeviceDay = otherDeviceDays[0]?.day ?? null;
    if (firstDayKey && firstOtherDeviceDay) {
      return firstDayKey < firstOtherDeviceDay ? firstDayKey : firstOtherDeviceDay;
    }
    return firstDayKey ?? firstOtherDeviceDay ?? getLocalDateKey(now.getTime());
  }

  return getLocalDateKey(now.getTime());
}

function readCombinedSummary(
  startKey: string,
  endKey: string,
  otherDeviceDays: OtherDeviceStudyTimeDay[],
  includeLocal: boolean,
): RangeSummary {
  const localSummary = includeLocal
    ? timeTrackingService.getSummaryBetween(startKey, endKey)
    : emptyRangeSummary();

  return mergeOtherDeviceDaysIntoSummary(
    localSummary,
    otherDeviceDays,
    startKey,
    endKey,
    (day) => includeLocal && timeTrackingService.hasStudyOnDay(day),
  );
}

function formatDayLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "short" })
    .format(date)
    .slice(0, 1)
    .toUpperCase();
}

function formatMonthDay(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
}

function formatFullDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function buildDayBuckets(
  now: Date,
  bucketCount: number,
  otherDeviceDays: OtherDeviceStudyTimeDay[],
  includeLocal: boolean,
): StudyTimeChartBucket[] {
  const todayKey = getLocalDateKey(now.getTime());

  return Array.from({ length: bucketCount }, (_, index) => {
    const offset = bucketCount - 1 - index;
    const date = addDays(now, -offset);
    const dateKey = getLocalDateKey(date.getTime());
    const summary = readCombinedSummary(
      dateKey,
      dateKey,
      otherDeviceDays,
      includeLocal,
    );

    return {
      id: dateKey,
      startKey: dateKey,
      endKey: dateKey,
      label: formatDayLabel(date),
      accessibilityLabel: formatFullDate(date),
      studyMs: summary.studyMs,
      byCategory: summary.byCategory,
      isCurrent: dateKey === todayKey,
    };
  });
}

function buildWeekBuckets(
  now: Date,
  bucketCount: number,
  otherDeviceDays: OtherDeviceStudyTimeDay[],
  includeLocal: boolean,
): StudyTimeChartBucket[] {
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const todayKey = getLocalDateKey(now.getTime());

  return Array.from({ length: bucketCount }, (_, index) => {
    const offset = bucketCount - 1 - index;
    const start = addDays(currentWeekStart, -offset * 7);
    const end = offset === 0 ? now : addDays(start, 6);
    const startKey = getLocalDateKey(start.getTime());
    const endKey = getLocalDateKey(end.getTime());
    const summary = readCombinedSummary(
      startKey,
      endKey,
      otherDeviceDays,
      includeLocal,
    );

    return {
      id: `${startKey}:${endKey}`,
      startKey,
      endKey,
      label: formatMonthDay(start),
      accessibilityLabel: `Week of ${formatMonthDay(start)}`,
      studyMs: summary.studyMs,
      byCategory: summary.byCategory,
      isCurrent: startKey <= todayKey && todayKey <= endKey,
    };
  });
}

function buildMonthBuckets(
  now: Date,
  bucketCount: number,
  otherDeviceDays: OtherDeviceStudyTimeDay[],
  includeLocal: boolean,
): StudyTimeChartBucket[] {
  const currentMonthStart = startOfMonth(now);
  const todayKey = getLocalDateKey(now.getTime());

  return Array.from({ length: bucketCount }, (_, index) => {
    const offset = bucketCount - 1 - index;
    const start = addMonths(currentMonthStart, -offset);
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    const end = offset === 0 ? now : monthEnd;
    const startKey = getLocalDateKey(start.getTime());
    const endKey = getLocalDateKey(end.getTime());
    const summary = readCombinedSummary(
      startKey,
      endKey,
      otherDeviceDays,
      includeLocal,
    );

    return {
      id: `${startKey}:${endKey}`,
      startKey,
      endKey,
      label: formatMonthLabel(start),
      accessibilityLabel: start.toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
      studyMs: summary.studyMs,
      byCategory: summary.byCategory,
      isCurrent: startKey <= todayKey && todayKey <= endKey,
    };
  });
}

export function getStudyTimeChartConfig(range: StudyTimeRangeId): {
  chartTitle: string;
  chartUnit: StudyTimeChartUnit;
} {
  if (range === "week") {
    return { chartTitle: "Last 14 weeks", chartUnit: "week" };
  }

  if (range === "month" || range === "all") {
    return { chartTitle: "Last 14 months", chartUnit: "month" };
  }

  return { chartTitle: "Last 14 days", chartUnit: "day" };
}

export function readStudyTimeRangeData(
  range: StudyTimeRangeId,
  bucketCount = DEFAULT_BUCKET_COUNT,
): StudyTimeRangeData {
  const now = new Date();
  const todayKey = getLocalDateKey(now.getTime());
  const userId = normalizeStudyTimeUserId(
    useAuthStore.getState().userData?.id,
  );
  const deviceId = userId ? getDeviceId() : null;
  const includeLocal = timeTrackingService.isScopedToUserDevice(
    userId,
    deviceId,
  );
  const otherDeviceDays = getCachedOtherDeviceStudyTimeDays();
  const startKey = getRangeStartKey(
    range,
    now,
    otherDeviceDays,
    includeLocal,
  );
  const { chartTitle, chartUnit } = getStudyTimeChartConfig(range);
  const series =
    chartUnit === "week"
      ? buildWeekBuckets(now, bucketCount, otherDeviceDays, includeLocal)
      : chartUnit === "month"
        ? buildMonthBuckets(now, bucketCount, otherDeviceDays, includeLocal)
        : buildDayBuckets(now, bucketCount, otherDeviceDays, includeLocal);

  return {
    summary: readCombinedSummary(
      startKey,
      todayKey,
      otherDeviceDays,
      includeLocal,
    ),
    startKey,
    endKey: todayKey,
    elapsedDays: daysBetweenInclusive(startKey, todayKey),
    series,
    chartTitle,
    chartUnit,
  };
}
