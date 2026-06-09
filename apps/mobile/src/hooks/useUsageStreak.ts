import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const FREEZE_RECHARGE_DAYS = 7;
const SESSION_FETCH_MAX_PAGES = 30;
const SESSION_FETCH_PAGE_SIZE = 1000;
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

type UsageStreakState = {
  currentStreak: number;
  longestStreak: number;
  activeToday: boolean;
  freezeAvailable: boolean;
  freezeDaysUntilReload: number;
  recentDays: UsageStreakDay[];
  isLoading: boolean;
  error: string | null;
  timezone: string;
};

type AppSessionRow = {
  session_started_at: string;
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

function getTimezone(): string {
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

function buildRecentDays(activeDays: Set<string>, todayKey: string): UsageStreakDay[] {
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

function simulateStreakWithFreeze(
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

const initialState: UsageStreakState = {
  currentStreak: 0,
  longestStreak: 0,
  activeToday: false,
  freezeAvailable: false,
  freezeDaysUntilReload: FREEZE_RECHARGE_DAYS,
  recentDays: [],
  isLoading: false,
  error: null,
  timezone: getTimezone(),
};

export function useUsageStreak(userId?: string) {
  const [state, setState] = useState<UsageStreakState>(initialState);

  const refresh = useCallback(async () => {
    const timezone = getTimezone();
    const todayKey = toDayKeyInTimezone(new Date(), timezone);

    if (!userId) {
      setState((prev) => ({
        ...prev,
        currentStreak: 0,
        longestStreak: 0,
        activeToday: false,
        freezeAvailable: false,
        freezeDaysUntilReload: FREEZE_RECHARGE_DAYS,
        recentDays: buildRecentDays(new Set<string>(), todayKey),
        isLoading: false,
        error: null,
        timezone,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      isLoading: true,
      error: null,
      timezone,
    }));

    try {
      const rows: AppSessionRow[] = [];
      for (let page = 0; page < SESSION_FETCH_MAX_PAGES; page += 1) {
        const from = page * SESSION_FETCH_PAGE_SIZE;
        const to = from + SESSION_FETCH_PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from("app_sessions")
          .select("session_started_at")
          .eq("user_id", userId)
          .order("session_started_at", { ascending: false })
          .range(from, to);

        if (error) {
          throw error;
        }

        const pageRows = (data ?? []) as AppSessionRow[];
        rows.push(...pageRows);
        if (pageRows.length < SESSION_FETCH_PAGE_SIZE) {
          break;
        }
      }

      const activeDays = new Set<string>();
      for (const row of rows) {
        if (!row.session_started_at) continue;
        activeDays.add(toDayKeyInTimezone(new Date(row.session_started_at), timezone));
      }

      // Include today to avoid a race where the insert is still in flight on app launch.
      activeDays.add(todayKey);

      const simulated = simulateStreakWithFreeze(activeDays, todayKey);
      const freezeDaysUntilReload = simulated.freezeAvailable
        ? 0
        : Math.max(1, FREEZE_RECHARGE_DAYS - simulated.freezeChargeProgress);

      setState({
        currentStreak: simulated.currentStreak,
        longestStreak: simulated.longestStreak,
        activeToday: activeDays.has(todayKey),
        freezeAvailable: simulated.freezeAvailable,
        freezeDaysUntilReload,
        recentDays: buildRecentDays(activeDays, todayKey),
        isLoading: false,
        error: null,
        timezone,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not load streak data.";

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: message,
        timezone,
      }));
    }
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...state,
    refresh,
  };
}
