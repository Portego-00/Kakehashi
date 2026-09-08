import { DEMO_USERNAME } from "@/features/demo/runtime";
import { browserTimezone, dayKeyInTimezone, parseActiveDayKeys, validTimezone } from "./usage-streak-calendar";
import { readAppSessionActiveDays } from "./usage-streak-reader";
export { activeDayKeysForSessions, browserTimezone, dayKeyInTimezone } from "./usage-streak-calendar";

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
export type FetchUsageStreakOptions = {
  userId?: string;
  username?: string;
  timezone?: string;
  now?: Date;
  storage?: UsageStreakStorage | null;
  publicBackend?: PublicAnalyticsBackend;
  signal?: AbortSignal;
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

type CachedUsageDays = { activeDays: string[]; confirmedDays: string[]; fetchedAt: number };
const CACHE_FRESH_MS = 5 * 60_000;

function defaultStorage() {
  try { return typeof window === "undefined" ? null : window.localStorage; } catch { return null; }
}

function usageDaysCacheKey(userId: string, timezone: string) {
  return `kakehashi-web:usage-streak:v2:${encodeURIComponent(userId)}:${encodeURIComponent(timezone)}`;
}

const pendingHistoryReads = new WeakMap<UsageStreakStorage, Map<string, Set<Set<string>>>>();

function cacheScopesKey(userId: string) { return `kakehashi-web:usage-streak-scopes:v2:${encodeURIComponent(userId)}`; }

function readCacheScopes(storage: UsageStreakStorage, userId: string): string[] {
  try {
    const value = JSON.parse(storage.getItem(cacheScopesKey(userId)) ?? "[]");
    return Array.isArray(value) ? value.filter((zone): zone is string => typeof zone === "string" && zone.length <= 80) : [];
  } catch { return []; }
}

function trackHistoryRead(storage: UsageStreakStorage | null, userId: string) {
  const confirmedSessions = new Set<string>();
  let readers: Set<Set<string>> | undefined;
  if (storage) {
    let users = pendingHistoryReads.get(storage);
    if (!users) { users = new Map(); pendingHistoryReads.set(storage, users); }
    readers = users.get(userId);
    if (!readers) { readers = new Set(); users.set(userId, readers); }
    readers.add(confirmedSessions);
  }
  return { confirmedSessions, finish: () => readers?.delete(confirmedSessions) };
}

// Called only with the timestamp returned by a successful database insert.
export function recordConfirmedUsageSession(storage: UsageStreakStorage, userId: string, timestamp: string) {
  if (!userId || !Number.isFinite(Date.parse(timestamp))) return;
  pendingHistoryReads.get(storage)?.get(userId)?.forEach((confirmed) => confirmed.add(timestamp));
  for (const timezone of readCacheScopes(storage, userId)) {
    const cached = readCachedUsageDays({ storage, userId, timezone });
    if (!cached) continue; // A session alone cannot establish a complete historical streak.
    const confirmedDays = [...new Set([...cached.confirmedDays, dayKeyInTimezone(new Date(timestamp), timezone)])].sort();
    const activeDays = [...new Set([...cached.activeDays, ...confirmedDays])].sort();
    saveUsageDays({ storage, userId, timezone }, activeDays, cached.fetchedAt, confirmedDays);
  }
}

function readCachedUsageDays(options: FetchUsageStreakOptions): CachedUsageDays | null {
  if (!options.userId) return null;
  try {
    const storage = options.storage === undefined ? defaultStorage() : options.storage;
    const timezone = validTimezone(options.timezone ?? browserTimezone());
    const value = JSON.parse(storage?.getItem(usageDaysCacheKey(options.userId, timezone)) ?? "null");
    const activeDays = parseActiveDayKeys(value?.activeDays);
    if (value?.version !== 2 || value.userId !== options.userId || value.timezone !== timezone || !activeDays || !Number.isFinite(value.fetchedAt)) return null;
    const confirmedDays = parseActiveDayKeys(value.confirmedDays ?? []);
    if (!confirmedDays) return null;
    return { activeDays, confirmedDays, fetchedAt: value.fetchedAt };
  } catch { return null; }
}

export function cachedUsageStreak(options: FetchUsageStreakOptions): UsageStreakSnapshot | undefined {
  const cached = readCachedUsageDays(options);
  return cached ? usageStreakSnapshot(cached.activeDays, dayKeyInTimezone(options.now ?? new Date(), options.timezone ?? browserTimezone())) : undefined;
}

function saveUsageDays(options: FetchUsageStreakOptions, activeDays: string[], fetchedAt: number, confirmedDays: string[] = []) {
  if (!options.userId || options.signal?.aborted) return;
  try {
    const storage = options.storage === undefined ? defaultStorage() : options.storage;
    const timezone = validTimezone(options.timezone ?? browserTimezone());
    // Only dates returned by the database are durable. Optimistic today stays in the view.
    storage?.setItem(usageDaysCacheKey(options.userId, timezone), JSON.stringify({ version: 2, userId: options.userId, timezone, activeDays, confirmedDays, fetchedAt }));
    if (storage) storage.setItem(cacheScopesKey(options.userId), JSON.stringify([...new Set([...readCacheScopes(storage, options.userId), timezone])]));
  } catch { /* Storage may be full or disabled; the successful response remains usable. */ }
}

export async function fetchUsageStreak(options: FetchUsageStreakOptions = {}): Promise<UsageStreakSnapshot> {
  const timezone = validTimezone(options.timezone ?? browserTimezone());
  const now = options.now ?? new Date();
  const today = dayKeyInTimezone(now, timezone);
  const cached = readCachedUsageDays({ ...options, timezone });
  if (options.username === DEMO_USERNAME) {
    return usageStreakSnapshot(Array.from({ length: 14 }, (_, index) => addDays(today, index - 13)), today);
  }
  if (!options.userId) throw new Error("The app streak needs an account.");
  options.signal?.throwIfAborted();
  if (cached && now.getTime() >= cached.fetchedAt && now.getTime() - cached.fetchedAt < CACHE_FRESH_MS && dayKeyInTimezone(new Date(cached.fetchedAt), timezone) === today) {
    return usageStreakSnapshot(cached.activeDays, today);
  }

  const storage = options.storage === undefined ? defaultStorage() : options.storage;
  const pending = trackHistoryRead(storage, options.userId);
  try {
    const response = await fetch(`/api/analytics/streak?timezone=${encodeURIComponent(timezone)}`, { cache: "no-store", signal: options.signal });
    const payload = await response.json().catch(() => null) as { activeDays?: unknown; available?: boolean; userId?: string; publicBackend?: PublicAnalyticsBackend | null } | null;
    options.signal?.throwIfAborted();
    let activeDays: string[] | null = null;
    if (response.ok && payload?.available === true && payload.userId === options.userId) {
      activeDays = parseActiveDayKeys(payload.activeDays);
    } else if (response.status === 404 || (response.ok && payload?.available === false)) {
      // Compatibility for a host without the analytics route/backend, not a second request on transient failures.
      const backend = options.publicBackend ?? payload?.publicBackend ?? PUBLIC_ANALYTICS_BACKEND;
      if (backend.url && backend.anonKey) {
        activeDays = await readAppSessionActiveDays({ url: backend.url, key: backend.anonKey }, options.userId, timezone, options.signal);
      }
    }
    if (!activeDays) throw new Error("The app streak could not be loaded.");
    options.signal?.throwIfAborted();
    // Confirmed local writes also survive a simultaneous refresh in another tab.
    const latestCached = readCachedUsageDays({ ...options, timezone });
    const confirmedDays = [...new Set([...(latestCached?.confirmedDays ?? []), ...[...pending.confirmedSessions].map((timestamp) => dayKeyInTimezone(new Date(timestamp), timezone))])].sort();
    activeDays = [...new Set([...activeDays, ...confirmedDays])].sort();
    saveUsageDays({ ...options, timezone }, activeDays, now.getTime(), confirmedDays);
    return usageStreakSnapshot(activeDays, today);
  } catch (error) {
    options.signal?.throwIfAborted();
    const latestCached = readCachedUsageDays({ ...options, timezone });
    if (latestCached) return usageStreakSnapshot(latestCached.activeDays, today);
    throw error;
  } finally {
    pending.finish();
  }
}
