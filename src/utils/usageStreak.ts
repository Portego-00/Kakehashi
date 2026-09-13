const FREEZE_RECHARGE_DAYS = 7;
const WEEKDAY_LABEL_FORMATTER = new Intl.DateTimeFormat("en-US", {
  weekday: "narrow",
  timeZone: "UTC",
});

export type UsageStreakDay = {
  dayKey: string;
  label: string;
  active: boolean;
  isToday: boolean;
};

type StreakSimulation = {
  currentStreak: number;
  longestStreak: number;
  freezeAvailable: boolean;
  freezeChargeProgress: number;
};

function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

const dayKeyFormatters = new Map<string, Intl.DateTimeFormat>();

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
    // Fall through to local date formatting fallback.
  }

  return toLocalDayKey(date);
}

function utcDateToDayKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
  return utcDateToDayKey(date);
}

export function buildRecentDays(activeDays: Set<string>, todayKey: string): UsageStreakDay[] {
  const recent: UsageStreakDay[] = [];

  for (let offset = 6; offset >= 0; offset -= 1) {
    const dayKey = addDays(todayKey, -offset);
    const label = WEEKDAY_LABEL_FORMATTER.format(dayKeyToUtcDate(dayKey));
    recent.push({
      dayKey,
      label,
      active: activeDays.has(dayKey),
      isToday: offset === 0,
    });
  }

  return recent;
}

export function simulateStreakWithFreeze(
  activeDays: Set<string>,
  todayKey: string,
): StreakSimulation {
  if (activeDays.size === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      freezeAvailable: false,
      freezeChargeProgress: 0,
    };
  }

  const sortedDays = Array.from(activeDays).sort();
  const firstDay = sortedDays[0];

  let cursor = firstDay;
  let currentStreak = 0;
  let longestStreak = 0;
  let freezeAvailable = false;
  let freezeChargeProgress = 0;

  while (cursor <= todayKey) {
    const isActiveDay = activeDays.has(cursor);

    if (isActiveDay) {
      currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;

      if (!freezeAvailable) {
        freezeChargeProgress += 1;
        if (freezeChargeProgress >= FREEZE_RECHARGE_DAYS) {
          freezeAvailable = true;
          freezeChargeProgress = 0;
        }
      }
    } else if (currentStreak > 0) {
      if (freezeAvailable) {
        // Consume exactly one freeze day.
        freezeAvailable = false;
        freezeChargeProgress = 0;
      } else {
        // No freeze available: streak breaks immediately.
        currentStreak = 0;
        freezeChargeProgress = 0;
      }
    }

    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    cursor = addDays(cursor, 1);
  }

  return {
    currentStreak,
    longestStreak,
    freezeAvailable,
    freezeChargeProgress,
  };
}

// Today's activity is a display overlay while the startup session write finishes.
// Never add it to the persisted, server-confirmed history.
export function usageStreakSnapshot(
  confirmedDays: Iterable<string>,
  timezone: string,
  now: Date = new Date(),
) {
  const todayKey = toDayKeyInTimezone(now, timezone);
  const activeDays = new Set(confirmedDays);
  activeDays.add(todayKey);
  const simulated = simulateStreakWithFreeze(activeDays, todayKey);
  return {
    currentStreak: simulated.currentStreak,
    longestStreak: simulated.longestStreak,
    activeToday: true,
    freezeAvailable: simulated.freezeAvailable,
    freezeDaysUntilReload: simulated.freezeAvailable
      ? 0
      : Math.max(1, FREEZE_RECHARGE_DAYS - simulated.freezeChargeProgress),
    recentDays: buildRecentDays(activeDays, todayKey),
    timezone,
  };
}
