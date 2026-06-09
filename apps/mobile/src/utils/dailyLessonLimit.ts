type AssignmentWithStartedAt = {
  data?: {
    started_at?: string | null;
  };
};

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();

function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCurrentTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function getDayKeyFormatter(timezone: string): Intl.DateTimeFormat {
  let formatter = dayKeyFormatters.get(timezone);

  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dayKeyFormatters.set(timezone, formatter);
  }

  return formatter;
}

export function toDayKeyInTimezone(date: Date, timezone: string): string {
  try {
    const parts = getDayKeyFormatter(timezone).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall through to local timezone fallback.
  }

  return toLocalDayKey(date);
}

export function getLessonsStartedToday(
  assignments: AssignmentWithStartedAt[],
  timezone: string = getCurrentTimezone()
): number {
  if (!Array.isArray(assignments) || assignments.length === 0) {
    return 0;
  }

  const todayKey = toDayKeyInTimezone(new Date(), timezone);
  let startedToday = 0;

  for (const assignment of assignments) {
    const startedAt = assignment?.data?.started_at;
    if (!startedAt) {
      continue;
    }

    const startedDate = new Date(startedAt);
    if (Number.isNaN(startedDate.getTime())) {
      continue;
    }

    if (toDayKeyInTimezone(startedDate, timezone) === todayKey) {
      startedToday += 1;
    }
  }

  return startedToday;
}

export function getRemainingDailyLessonSlots(
  dailyLessonLimit: number,
  assignments: AssignmentWithStartedAt[],
  timezone: string = getCurrentTimezone()
): number {
  if (!Number.isFinite(dailyLessonLimit) || dailyLessonLimit <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const safeLimit = Math.floor(dailyLessonLimit);
  const lessonsStartedToday = getLessonsStartedToday(assignments, timezone);
  return Math.max(0, safeLimit - lessonsStartedToday);
}

export function getEffectiveLessonCount(
  availableLessonCount: number,
  dailyLessonLimit: number,
  assignments: AssignmentWithStartedAt[],
  timezone: string = getCurrentTimezone()
): number {
  if (!Number.isFinite(availableLessonCount) || availableLessonCount <= 0) {
    return 0;
  }

  const safeAvailableCount = Math.floor(availableLessonCount);
  const remainingSlots = getRemainingDailyLessonSlots(
    dailyLessonLimit,
    assignments,
    timezone
  );

  if (!Number.isFinite(remainingSlots)) {
    return safeAvailableCount;
  }

  return Math.max(0, Math.min(safeAvailableCount, remainingSlots));
}
