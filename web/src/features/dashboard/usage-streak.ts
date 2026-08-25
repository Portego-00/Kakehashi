const FREEZE_RECHARGE_DAYS = 7;
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "narrow", timeZone: "UTC" });

export type UsageStreakDay = {
  dayKey: string;
  date: Date;
  label: string;
  active: boolean;
  isToday: boolean;
};

export type UsageStreakSnapshot = {
  current: number;
  longest: number;
  activeToday: boolean;
  freezeAvailable: boolean;
  freezeDaysUntilReload: number;
  days: UsageStreakDay[];
};

type UsageStreakStorage = Pick<Storage, "getItem" | "setItem">;
type PublicAnalyticsBackend = { url?: string; anonKey?: string };
type FetchUsageStreakOptions = {
  userId?: string;
  username?: string;
  timezone?: string;
  now?: Date;
  storage?: UsageStreakStorage | null;
  publicBackend?: PublicAnalyticsBackend;
};

const PUBLIC_ANALYTICS_BACKEND: PublicAnalyticsBackend = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

function dayKeyToDate(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year || 1970, (month || 1) - 1, day || 1));
}

function dateToDayKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addDays(dayKey: string, amount: number) {
  const date = dayKeyToDate(dayKey);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateToDayKey(date);
}

function validTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
    return timezone;
  } catch {
    return "UTC";
  }
}

export function browserTimezone() {
  try {
    return validTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  } catch {
    return "UTC";
  }
}

export function dayKeyInTimezone(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: validTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : dateToDayKey(date);
}

export function activeDayKeysForSessions(sessionStartedAt: string[], timezone: string) {
  const keys = new Set<string>();
  for (const value of sessionStartedAt) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) keys.add(dayKeyInTimezone(date, timezone));
  }
  return [...keys].sort();
}

function localUsageDaysKey(username: string) {
  return `kakehashi-web:analytics-active-days:${encodeURIComponent(username.trim().toLocaleLowerCase())}:v1`;
}

export function readLocalUsageDayKeys(storage: Pick<Storage, "getItem"> | null, username: string) {
  if (!storage || !username) return [];
  try {
    const value = JSON.parse(storage.getItem(localUsageDaysKey(username)) ?? "[]") as unknown;
    return Array.isArray(value) ? value.filter((day): day is string => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)).sort() : [];
  } catch {
    return [];
  }
}

export function recordLocalUsageDay(storage: UsageStreakStorage, username: string, date = new Date(), timezone = browserTimezone()) {
  const days = new Set(readLocalUsageDayKeys(storage, username));
  days.add(dayKeyInTimezone(date, timezone));
  storage.setItem(localUsageDaysKey(username), JSON.stringify([...days].sort()));
}

export function usageStreakSnapshot(activeDayKeys: string[], todayKey: string): UsageStreakSnapshot {
  const activeDays = new Set(activeDayKeys.filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key) && key <= todayKey));
  activeDays.add(todayKey);
  const sorted = [...activeDays].sort();
  let cursor = sorted[0] ?? todayKey;
  let current = 0;
  let longest = 0;
  let freezeAvailable = false;
  let freezeChargeProgress = 0;

  while (cursor <= todayKey) {
    if (activeDays.has(cursor)) {
      current = current > 0 ? current + 1 : 1;
      if (!freezeAvailable) {
        freezeChargeProgress += 1;
        if (freezeChargeProgress >= FREEZE_RECHARGE_DAYS) {
          freezeAvailable = true;
          freezeChargeProgress = 0;
        }
      }
    } else if (current > 0) {
      if (freezeAvailable) {
        freezeAvailable = false;
        freezeChargeProgress = 0;
      } else {
        current = 0;
        freezeChargeProgress = 0;
      }
    }
    longest = Math.max(longest, current);
    cursor = addDays(cursor, 1);
  }

  const days = Array.from({ length: 7 }, (_, index) => {
    const dayKey = addDays(todayKey, index - 6);
    const date = dayKeyToDate(dayKey);
    return { dayKey, date, label: WEEKDAY.format(date), active: activeDays.has(dayKey), isToday: index === 6 };
  });

  return {
    current,
    longest,
    activeToday: activeDays.has(todayKey),
    freezeAvailable,
    freezeDaysUntilReload: freezeAvailable ? 0 : Math.max(1, FREEZE_RECHARGE_DAYS - freezeChargeProgress),
    days,
  };
}

async function fetchPublicAppSessionDays(userId: string, timezone: string, backend: PublicAnalyticsBackend) {
  const url = backend.url?.replace(/\/$/, "");
  const anonKey = backend.anonKey;
  if (!url || !anonKey || !userId) return null;
  const sessions: string[] = [];
  const pageSize = 1_000;
  for (let page = 0; page < 30; page += 1) {
    const query = new URLSearchParams({
      select: "session_started_at",
      user_id: `eq.${userId}`,
      order: "session_started_at.asc",
      limit: String(pageSize),
      offset: String(page * pageSize),
    });
    const response = await fetch(`${url}/rest/v1/app_sessions?${query}`, {
      cache: "no-store",
      headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    });
    if (!response.ok) throw new Error("Public app-session history is unavailable.");
    const rows = await response.json() as Array<{ session_started_at?: string }>;
    sessions.push(...rows.flatMap((row) => typeof row.session_started_at === "string" ? [row.session_started_at] : []));
    if (rows.length < pageSize) break;
  }
  return activeDayKeysForSessions(sessions, timezone);
}

export async function fetchUsageStreak(options: FetchUsageStreakOptions = {}): Promise<UsageStreakSnapshot> {
  const timezone = options.timezone ?? browserTimezone();
  const now = options.now ?? new Date();
  const storage = options.storage === undefined ? (typeof window === "undefined" ? null : window.localStorage) : options.storage;
  const localDays = readLocalUsageDayKeys(storage, options.username ?? "");
  let routeBackend: PublicAnalyticsBackend | undefined;
  try {
    const response = await fetch(`/api/analytics/streak?timezone=${encodeURIComponent(timezone)}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { activeDays?: string[]; available?: boolean; publicBackend?: PublicAnalyticsBackend | null } | null;
    routeBackend = payload?.publicBackend ?? undefined;
    if (response.ok && payload?.available !== false) {
      return usageStreakSnapshot([...(payload?.activeDays ?? []), ...localDays], dayKeyInTimezone(now, timezone));
    }
  } catch {
    // The direct public query below mirrors the mobile app's analytics client.
  }
  try {
    const publicDays = await fetchPublicAppSessionDays(options.userId ?? "", timezone, options.publicBackend ?? routeBackend ?? PUBLIC_ANALYTICS_BACKEND);
    if (publicDays) return usageStreakSnapshot([...publicDays, ...localDays], dayKeyInTimezone(now, timezone));
  } catch {
    // A local activity record still provides a truthful offline fallback.
  }
  return usageStreakSnapshot(localDays, dayKeyInTimezone(now, timezone));
}
