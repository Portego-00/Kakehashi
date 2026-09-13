import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";
import { getTimezone, toDayKeyInTimezone } from "../utils/usageStreak";

const CACHE_VERSION = 1;
const FRESH_MS = 5 * 60_000;
const FAILURE_RETRY_MS = 60_000;
const LEGACY_PAGE_SIZE = 1000;
const LEGACY_MAX_PAGES = 30;

export type UsageStreakHistory = {
  activeDays: string[];
  fetchedAt: number;
  source: "rpc" | "legacy";
};

const histories = new Map<string, UsageStreakHistory>();
const hydration = new Map<string, Promise<UsageStreakHistory | null>>();
const requests = new Map<string, Promise<UsageStreakHistory>>();
const failures = new Map<string, { retryAt: number; error: Error }>();
const scopes = new Map<string, { userId: string; timezone: string }>();
const confirmations = new Map<string, Set<string>>();
const writes = new Map<string, Promise<void>>();
const listeners = new Set<(userId: string) => void>();

function cacheKey(userId: string, timezone: string): string {
  return `usage-streak:${JSON.stringify([CACHE_VERSION, process.env.EXPO_PUBLIC_SUPABASE_URL, userId, timezone])}`;
}

function withConfirmations(history: UsageStreakHistory, userId: string, timezone: string): UsageStreakHistory {
  const activeDays = new Set(history.activeDays);
  for (const timestamp of confirmations.get(userId) ?? []) {
    activeDays.add(toDayKeyInTimezone(new Date(timestamp), timezone));
  }
  return activeDays.size === history.activeDays.length ? history : { ...history, activeDays: [...activeDays].sort() };
}

function persistHistory(key: string, userId: string, timezone: string, history: UsageStreakHistory) {
  // Serialize writes so a delayed older snapshot cannot overwrite a confirmation.
  const task = (writes.get(key) ?? Promise.resolve()).then(() => AsyncStorage.setItem(
    key, JSON.stringify({ version: CACHE_VERSION, userId, timezone, ...history }),
  )).catch(() => {});
  writes.set(key, task);
  void task.finally(() => { if (writes.get(key) === task) writes.delete(key); });
  return task;
}

export function subscribeUsageStreakHistory(listener: (userId: string) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

// Called only after the server acknowledges a session and returns its timestamp.
// A confirmation can augment a complete history, never create a partial baseline.
export async function confirmUsageStreakSession(userId: string, timestamp: string): Promise<void> {
  if (!Number.isFinite(Date.parse(timestamp))) return;
  const confirmed = confirmations.get(userId) ?? new Set<string>();
  confirmed.add(timestamp);
  confirmations.set(userId, confirmed);
  await getCachedUsageStreakHistory(userId, getTimezone());
  for (const [key, scope] of scopes) {
    if (scope.userId !== userId) continue;
    const previous = await getCachedUsageStreakHistory(userId, scope.timezone);
    if (!previous) continue;
    const history = withConfirmations(previous, userId, scope.timezone);
    histories.set(key, history);
    await persistHistory(key, userId, scope.timezone, history);
  }
  for (const listener of listeners) listener(userId);
}

function parseDays(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((day) => {
    if (typeof day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
    const date = new Date(`${day}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day;
  })) throw new Error("Could not read complete streak history.");
  return [...new Set<string>(value)].sort();
}

export function peekUsageStreakHistory(userId: string, timezone: string) {
  return histories.get(cacheKey(userId, timezone)) ?? null;
}

export async function getCachedUsageStreakHistory(
  userId: string,
  timezone: string,
): Promise<UsageStreakHistory | null> {
  const key = cacheKey(userId, timezone);
  scopes.set(key, { userId, timezone });
  const existing = histories.get(key);
  if (existing) return existing;
  const pending = hydration.get(key);
  if (pending) return pending;
  const task = (async () => {
    try {
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return null;
      const saved = JSON.parse(raw);
      if (saved.version !== CACHE_VERSION || saved.userId !== userId || saved.timezone !== timezone
        || !Number.isFinite(saved.fetchedAt) || saved.fetchedAt < 0
        || (saved.source !== "rpc" && saved.source !== "legacy")) return null;
      const history = withConfirmations({
        activeDays: parseDays(saved.activeDays), fetchedAt: saved.fetchedAt, source: saved.source,
      }, userId, timezone);
      if (!histories.has(key)) histories.set(key, history);
      return histories.get(key)!;
    } catch {
      return null;
    }
  })().finally(() => hydration.delete(key));
  hydration.set(key, task);
  return task;
}

function isFresh(history: UsageStreakHistory, timezone: string): boolean {
  const now = Date.now();
  return now >= history.fetchedAt && now - history.fetchedAt < FRESH_MS
    && toDayKeyInTimezone(new Date(history.fetchedAt), timezone) === toDayKeyInTimezone(new Date(now), timezone);
}

// Compatibility for releases installed before the additive database migration.
// A failed/limited read must never be persisted as a complete history.
async function readLegacyDays(userId: string, timezone: string, signal: AbortSignal) {
  const activeDays = new Set<string>();
  let cursor: { timestamp: string; id: string } | undefined;
  for (let page = 0; page <= LEGACY_MAX_PAGES; page += 1) {
    let query = supabase.from("app_sessions")
      .select("id,session_started_at")
      .eq("user_id", userId)
      .order("session_started_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(page === LEGACY_MAX_PAGES ? 1 : LEGACY_PAGE_SIZE);
    if (cursor) query = query.or(`session_started_at.lt.${cursor.timestamp},and(session_started_at.eq.${cursor.timestamp},id.lt.${cursor.id})`);
    const { data, error } = await query.abortSignal(signal);
    if (error) throw new Error(error.message);
    if (!Array.isArray(data)) throw new Error("Could not read complete streak history.");
    if (page === LEGACY_MAX_PAGES && data.length > 0) {
      throw new Error("Complete streak history needs the updated database reader.");
    }
    for (const row of data) {
      if (typeof row.session_started_at !== "string"
        || !/^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})$/.test(row.session_started_at)
        || !Number.isFinite(Date.parse(row.session_started_at))
        || typeof row.id !== "string" || !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(row.id)) {
        throw new Error("Could not read complete streak history.");
      }
      activeDays.add(toDayKeyInTimezone(new Date(row.session_started_at), timezone));
    }
    if (data.length < LEGACY_PAGE_SIZE) return [...activeDays].sort();
    const last = data[data.length - 1];
    if (cursor?.timestamp === last.session_started_at && cursor?.id === last.id) {
      throw new Error("Could not read complete streak history.");
    }
    cursor = { timestamp: last.session_started_at, id: last.id };
  }
  throw new Error("Could not read complete streak history.");
}

export async function readUsageStreakHistory(
  userId: string,
  timezone: string,
  { force = false }: { force?: boolean } = {},
): Promise<UsageStreakHistory> {
  const key = cacheKey(userId, timezone);
  const cached = await getCachedUsageStreakHistory(userId, timezone);
  // Even manual refreshes reuse a fresh legacy download during migration rollout.
  if (cached && isFresh(cached, timezone) && (!force || cached.source === "legacy")) return cached;
  const pending = requests.get(key);
  if (pending) return pending;
  const failure = failures.get(key);
  if (failure && Date.now() < failure.retryAt && !force) throw failure.error;

  const task = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      const { data, error } = await supabase.rpc("get_app_session_active_days", {
        p_user_id: userId, p_timezone: timezone,
      }).abortSignal(controller.signal);
      let activeDays: string[];
      let source: UsageStreakHistory["source"] = "rpc";
      if (error) {
        if (error.code !== "PGRST202" && error.code !== "42883") throw new Error(error.message);
        source = "legacy";
        activeDays = await readLegacyDays(userId, timezone, controller.signal);
      } else {
        activeDays = parseDays(data?.activeDays);
      }
      const history = withConfirmations({ activeDays, fetchedAt: Date.now(), source }, userId, timezone);
      histories.set(key, history);
      failures.delete(key);
      // Cache failure must not hide a successful result or delay the display.
      persistHistory(key, userId, timezone, history);
      return history;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error("Could not load streak data.");
      failures.set(key, { retryAt: Date.now() + FAILURE_RETRY_MS, error });
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  })().finally(() => requests.delete(key));
  requests.set(key, task);
  return task;
}
