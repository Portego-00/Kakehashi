export type WidgetStreakRecentDay = {
  dayKey?: string;
  label: string;
  active: boolean;
  isToday: boolean;
};

export type WidgetReviewUpcomingBucket = {
  date: string;
  count: number;
};

export type BackgroundReviewSyncData = {
  currentReviews: number;
  upcomingReviews?: number[];
  upcomingReviewTimes?: { [key: string]: number };
};

type WidgetSnapshotStorage = {
  setItem: (key: string, value: string) => Promise<void>;
};

type BackgroundReviewSchedule = {
  nextReviewDate: string | null;
  reviewUpcomingBuckets: WidgetReviewUpcomingBucket[];
};

type StreakSnapshotInput = {
  contentMode: string;
  streakTimezone?: string;
  currentStreak: number;
  streakRecentDays: WidgetStreakRecentDay[];
};

type StreakSnapshotUpdateOptions = {
  now?: Date;
  recordAppActivity?: boolean;
};

const STREAK_DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const STREAK_DAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "narrow",
  timeZone: "UTC",
});
const DAY_KEY_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDayKeyFormatter(timezone: string): Intl.DateTimeFormat {
  const normalizedTimezone = timezone.trim();
  const cachedFormatter = DAY_KEY_FORMATTER_CACHE.get(normalizedTimezone);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizedTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  DAY_KEY_FORMATTER_CACHE.set(normalizedTimezone, formatter);
  return formatter;
}

function toDayKeyInTimezone(date: Date, timezone: string): string {
  try {
    const parts = getDayKeyFormatter(timezone).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fall back to the device timezone when a stored timezone is invalid.
  }

  return toLocalDayKey(date);
}

function dayKeyToUtcDate(dayKey: string): Date {
  const [year, month, day] = dayKey.split("-").map(Number);
  if (!year || !month || !day) {
    return new Date(0);
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dayKey: string, amount: number): string {
  const date = dayKeyToUtcDate(dayKey);
  date.setUTCDate(date.getUTCDate() + amount);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toNonNegativeInteger(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.round(value));
}

export async function persistWidgetSnapshot(
  storage: WidgetSnapshotStorage,
  storageKey: string,
  snapshot: unknown,
): Promise<boolean> {
  try {
    await storage.setItem(storageKey, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function selectWidgetTimelineTimestamps(
  timestamps: Iterable<number>,
  anchorTimestamps: Iterable<number>,
  currentTimestamp: number,
  maxEntries: number,
): number[] {
  if (maxEntries <= 0) {
    return [];
  }

  const prioritized = Array.from(
    new Set([currentTimestamp, ...anchorTimestamps]),
  )
    .sort((left, right) => left - right)
    .slice(0, maxEntries);
  const selected = new Set(prioritized);
  const sortedCandidates = Array.from(new Set(timestamps)).sort(
    (left, right) => left - right,
  );

  for (const timestamp of sortedCandidates) {
    if (selected.size >= maxEntries) {
      break;
    }
    selected.add(timestamp);
  }

  return Array.from(selected).sort((left, right) => left - right);
}

export function resolveBackgroundReviewSchedule(
  existingSchedule: BackgroundReviewSchedule | null,
  reviewData: BackgroundReviewSyncData,
  now: Date = new Date(),
): BackgroundReviewSchedule {
  if (reviewData.upcomingReviewTimes === undefined) {
    return (
      existingSchedule ?? {
        nextReviewDate: null,
        reviewUpcomingBuckets: [],
      }
    );
  }

  const nowMs = now.getTime();
  const reviewUpcomingBuckets = Object.entries(reviewData.upcomingReviewTimes)
    .flatMap(([date, rawCount]) => {
      const timestamp = Date.parse(date);
      const count = toNonNegativeInteger(rawCount);
      if (Number.isNaN(timestamp) || timestamp <= nowMs || count === 0) {
        return [];
      }
      return [{ date, count }];
    })
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date));

  return {
    nextReviewDate: reviewUpcomingBuckets[0]?.date ?? null,
    reviewUpcomingBuckets,
  };
}

function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function resolveProjectedReviewTotalForLocalDay({
  baselineDate,
  referenceDate,
  currentReviews,
  baselineTodayTotal,
  upcomingBuckets,
}: {
  baselineDate: Date;
  referenceDate: Date;
  currentReviews: number;
  baselineTodayTotal: number;
  upcomingBuckets: WidgetReviewUpcomingBucket[];
}): number {
  const scheduledForReferenceDay = upcomingBuckets.reduce((total, bucket) => {
    const bucketDate = new Date(bucket.date);
    if (
      Number.isNaN(bucketDate.getTime()) ||
      !isSameLocalDay(bucketDate, referenceDate)
    ) {
      return total;
    }

    return total + toNonNegativeInteger(bucket.count);
  }, 0);
  const projectedDayTotal = Math.max(
    toNonNegativeInteger(currentReviews),
    scheduledForReferenceDay,
  );

  if (!isSameLocalDay(baselineDate, referenceDate)) {
    return projectedDayTotal;
  }

  return Math.max(
    projectedDayTotal,
    toNonNegativeInteger(baselineTodayTotal),
  );
}

export function normalizeStreakSnapshotForUpdate<T extends StreakSnapshotInput>(
  input: T,
  options: StreakSnapshotUpdateOptions = {},
): T {
  if (input.contentMode !== "streak") {
    return input;
  }

  const sourceRecentDays = Array.isArray(input.streakRecentDays)
    ? input.streakRecentDays
    : [];
  if (sourceRecentDays.length === 0) {
    return input;
  }

  const now = options.now ?? new Date();
  const timezone = input.streakTimezone;
  const currentDayKey =
    typeof timezone === "string" && timezone.trim().length > 0
      ? toDayKeyInTimezone(now, timezone)
      : toLocalDayKey(now);
  const hasSortableDayKeys = sourceRecentDays.every(
    (day) =>
      typeof day.dayKey === "string" && STREAK_DAY_KEY_PATTERN.test(day.dayKey),
  );
  const shouldRecordTodayActivity =
    (options.recordAppActivity ?? true) &&
    (toNonNegativeInteger(input.currentStreak) > 0 ||
      sourceRecentDays.some((day) => Boolean(day.active)));

  let normalizedRecentDays: WidgetStreakRecentDay[];

  if (hasSortableDayKeys) {
    const dayByKey = new Map<string, WidgetStreakRecentDay>();
    for (const day of sourceRecentDays) {
      if (day.dayKey) {
        dayByKey.set(day.dayKey, day);
      }
    }

    normalizedRecentDays = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const dayKey = addDays(currentDayKey, -offset);
      const sourceDay = dayByKey.get(dayKey);
      normalizedRecentDays.push({
        dayKey,
        label:
          sourceDay?.label && sourceDay.label.trim().length > 0
            ? sourceDay.label
            : STREAK_DAY_LABEL_FORMATTER.format(dayKeyToUtcDate(dayKey)),
        active:
          offset === 0
            ? shouldRecordTodayActivity || Boolean(sourceDay?.active)
            : Boolean(sourceDay?.active),
        isToday: offset === 0,
      });
    }
  } else {
    const fallbackRecentDays = sourceRecentDays.slice(-7);
    normalizedRecentDays = fallbackRecentDays.map((day, index) => {
      const isToday = index === fallbackRecentDays.length - 1;
      return {
        ...day,
        active: isToday
          ? shouldRecordTodayActivity || Boolean(day.active)
          : Boolean(day.active),
        isToday,
      };
    });
  }

  const didChange =
    normalizedRecentDays.length !== sourceRecentDays.length ||
    normalizedRecentDays.some((day, index) => {
      const sourceDay = sourceRecentDays[index];
      if (!sourceDay) {
        return true;
      }

      return (
        (day.dayKey ?? null) !== (sourceDay.dayKey ?? null) ||
        day.label !== sourceDay.label ||
        day.active !== Boolean(sourceDay.active) ||
        day.isToday !== Boolean(sourceDay.isToday)
      );
    });

  if (!didChange) {
    return input;
  }

  return {
    ...input,
    streakRecentDays: normalizedRecentDays,
  };
}
