import type { Assignment } from "./api";

export type RecentLessonsWindow = "apprentice" | "24h" | "7d" | "30d";

const RECENT_LESSONS_WINDOW_VALUES: RecentLessonsWindow[] = [
  "apprentice",
  "24h",
  "7d",
  "30d",
];

const WINDOW_LOOKBACK_MS: Record<Exclude<RecentLessonsWindow, "apprentice">, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const LEGACY_DAYS_TO_WINDOW: Record<number, RecentLessonsWindow> = {
  1: "24h",
  7: "7d",
  30: "30d",
};

const asFirstString = (value: unknown): string | undefined => {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0] : undefined;
  }

  return typeof value === "string" ? value : undefined;
};

const getStartedAtMs = (assignment: Assignment): number | null => {
  if (!assignment?.data?.started_at) {
    return null;
  }

  const startedAtMs = Date.parse(assignment.data.started_at);
  return Number.isNaN(startedAtMs) ? null : startedAtMs;
};

const isCurrentApprenticeLesson = (assignment: Assignment): boolean => {
  const { srs_stage, burned_at, passed_at } = assignment.data;
  return srs_stage >= 1 && srs_stage <= 4 && !burned_at && !passed_at;
};

export const isRecentLessonsWindow = (
  value: unknown,
): value is RecentLessonsWindow =>
  RECENT_LESSONS_WINDOW_VALUES.includes(value as RecentLessonsWindow);

export const resolveRecentLessonsWindow = (params: {
  window?: unknown;
  days?: unknown;
}): RecentLessonsWindow => {
  const windowParam = asFirstString(params.window);
  if (windowParam && isRecentLessonsWindow(windowParam)) {
    return windowParam;
  }

  const legacyDaysParam = Number.parseInt(asFirstString(params.days) ?? "", 10);
  if (Number.isInteger(legacyDaysParam) && LEGACY_DAYS_TO_WINDOW[legacyDaysParam]) {
    return LEGACY_DAYS_TO_WINDOW[legacyDaysParam];
  }

  return "apprentice";
};

export const getRecentLessonsWindowSubtitle = (
  window: RecentLessonsWindow,
): string => {
  switch (window) {
    case "24h":
      return "Practice lessons started in the last 24 hours";
    case "7d":
      return "Practice lessons started in the last 7 days";
    case "30d":
      return "Practice lessons started in the last month";
    case "apprentice":
    default:
      return "Review Apprentice items you recently learned";
  }
};

export const getRecentLessonsWindowLabel = (
  window: RecentLessonsWindow,
): string => {
  switch (window) {
    case "24h":
      return "Last 24 Hours";
    case "7d":
      return "Last 7 Days";
    case "30d":
      return "Last Month";
    case "apprentice":
    default:
      return "Apprentice";
  }
};

export const filterRecentLessonAssignments = (
  assignments: Assignment[],
  window: RecentLessonsWindow,
  nowMs = Date.now(),
): Assignment[] => {
  if (window === "apprentice") {
    return assignments.filter(isCurrentApprenticeLesson);
  }

  const lookbackWindowMs = WINDOW_LOOKBACK_MS[window];
  const cutoffMs = nowMs - lookbackWindowMs;

  return assignments.filter((assignment) => {
    if (assignment.data.burned_at) {
      return false;
    }

    const startedAtMs = getStartedAtMs(assignment);
    if (startedAtMs === null) {
      return false;
    }

    return startedAtMs >= cutoffMs && startedAtMs <= nowMs;
  });
};
