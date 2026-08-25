"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export type StudyTimeCategory = "reviews" | "lessons" | "extra-study" | "news" | "songs" | "reading" | "video";
export type StudyTimeDay = { totalSeconds: number; appTotalSeconds: number; byCategory: Record<StudyTimeCategory, number> };
export type StudyTimeRangeId = "today" | "week" | "month" | "all";
export type StudyTimeChartBucket = StudyTimeDay & { id: string; label: string; accessibilityLabel: string; isCurrent: boolean };
export type StudyTimeRange = { summary: StudyTimeDay; series: StudyTimeChartBucket[]; chartTitle: string };
type StudyTimeEnvelope = { version: 1; days: Record<string, StudyTimeDay> };
type StudyTimeStorage = Pick<Storage, "getItem" | "setItem">;
export type StudyTimeUploadDay = { day: string; appTotalSeconds: number; byCategory: Record<StudyTimeCategory, number> };

export const STUDY_TIME_EVENT = "kakehashi-study-time-change";
export const STUDY_TIME_CATEGORIES: Array<{ id: StudyTimeCategory; label: string }> = [
  { id: "reviews", label: "Reviews" },
  { id: "lessons", label: "Lessons" },
  { id: "extra-study", label: "Extra study" },
  { id: "news", label: "News" },
  { id: "songs", label: "Songs" },
  { id: "reading", label: "Reading" },
  { id: "video", label: "Video" },
];
export const STUDY_TIME_RANGES: Array<{ id: StudyTimeRangeId; label: string }> = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "all", label: "All" },
];
const EMPTY_CATEGORIES = Object.fromEntries(STUDY_TIME_CATEGORIES.map(({ id }) => [id, 0])) as Record<StudyTimeCategory, number>;
const EMPTY_STORAGE: Pick<StudyTimeStorage, "getItem"> = { getItem: () => null };

export function studyTimeStorageKey(username: string) {
  return `kakehashi-web:study-time:${encodeURIComponent(username.trim().toLocaleLowerCase())}:v1`;
}

export function studyTimeDeviceKey() {
  return "kakehashi-web:study-time-device:v1";
}

function studyTimeSyncKey(username: string) {
  return `kakehashi-web:study-time-sync:${encodeURIComponent(username.trim().toLocaleLowerCase())}:v1`;
}

export function localDayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validSeconds(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : 0;
}

function readEnvelope(storage: Pick<StudyTimeStorage, "getItem">, username: string): StudyTimeEnvelope {
  try {
    const parsed = JSON.parse(storage.getItem(studyTimeStorageKey(username)) || "null") as Partial<StudyTimeEnvelope> | null;
    if (parsed?.version !== 1 || !parsed.days || typeof parsed.days !== "object") return { version: 1, days: {} };
    return { version: 1, days: parsed.days as Record<string, StudyTimeDay> };
  } catch {
    return { version: 1, days: {} };
  }
}

export function readStudyTimeDay(storage: Pick<StudyTimeStorage, "getItem">, username: string, date = new Date()): StudyTimeDay {
  const stored = readEnvelope(storage, username).days[localDayKey(date)];
  const byCategory = { ...EMPTY_CATEGORIES };
  for (const { id } of STUDY_TIME_CATEGORIES) byCategory[id] = validSeconds(stored?.byCategory?.[id]);
  return {
    totalSeconds: Object.values(byCategory).reduce((sum, seconds) => sum + seconds, 0),
    appTotalSeconds: validSeconds(stored?.appTotalSeconds),
    byCategory,
  };
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function normalizedDay(stored?: StudyTimeDay): StudyTimeDay {
  const byCategory = { ...EMPTY_CATEGORIES };
  for (const { id } of STUDY_TIME_CATEGORIES) byCategory[id] = validSeconds(stored?.byCategory?.[id]);
  return {
    totalSeconds: Object.values(byCategory).reduce((sum, seconds) => sum + seconds, 0),
    appTotalSeconds: validSeconds(stored?.appTotalSeconds),
    byCategory,
  };
}

function sumDays(days: StudyTimeDay[]) {
  const byCategory = { ...EMPTY_CATEGORIES };
  let appTotalSeconds = 0;
  for (const day of days) {
    appTotalSeconds += day.appTotalSeconds;
    for (const { id } of STUDY_TIME_CATEGORIES) byCategory[id] += day.byCategory[id];
  }
  return { totalSeconds: Object.values(byCategory).reduce((sum, seconds) => sum + seconds, 0), appTotalSeconds, byCategory };
}

function dayRange(envelope: StudyTimeEnvelope, startKey: string, endKey: string) {
  return Object.entries(envelope.days)
    .filter(([key]) => key >= startKey && key <= endKey)
    .map(([, day]) => normalizedDay(day));
}

export function readStudyTimeRange(
  storage: Pick<StudyTimeStorage, "getItem">,
  username: string,
  range: StudyTimeRangeId,
  now = new Date(),
  bucketCount = 14,
): StudyTimeRange {
  const envelope = readEnvelope(storage, username);
  const todayKey = localDayKey(now);
  const firstStoredKey = Object.keys(envelope.days).sort()[0] ?? todayKey;
  const rangeStart = range === "week"
    ? localDayKey(startOfWeek(now))
    : range === "month"
      ? localDayKey(new Date(now.getFullYear(), now.getMonth(), 1))
      : range === "all"
        ? firstStoredKey
        : todayKey;
  const summary = sumDays(dayRange(envelope, rangeStart, todayKey));
  const unit = range === "week" ? "week" : range === "month" || range === "all" ? "month" : "day";
  const chartTitle = unit === "week" ? "Last 14 weeks" : unit === "month" ? "Last 14 months" : "Last 14 days";
  const currentWeek = startOfWeek(now);
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const series = Array.from({ length: bucketCount }, (_, index): StudyTimeChartBucket => {
    const offset = index - (bucketCount - 1);
    const start = unit === "week" ? addDays(currentWeek, offset * 7) : unit === "month" ? addMonths(currentMonth, offset) : addDays(now, offset);
    const end = unit === "week" ? addDays(start, 6) : unit === "month" ? new Date(start.getFullYear(), start.getMonth() + 1, 0) : start;
    const startKey = localDayKey(start);
    const endKey = localDayKey(end > now ? now : end);
    const totals = sumDays(dayRange(envelope, startKey, endKey));
    const label = unit === "day"
      ? start.toLocaleDateString(undefined, { weekday: "narrow" })
      : unit === "week"
        ? start.toLocaleDateString(undefined, { month: "short", day: "numeric" })
        : start.toLocaleDateString(undefined, { month: "short" });
    const accessibilityLabel = unit === "day"
      ? start.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
      : unit === "week"
        ? `Week of ${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
        : start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    return { ...totals, id: `${startKey}:${endKey}`, label, accessibilityLabel, isCurrent: offset === 0 };
  });
  return { summary, series, chartTitle };
}

export function recordForegroundTime(storage: StudyTimeStorage, username: string, category: StudyTimeCategory | null, seconds: number, date = new Date()) {
  const increment = Math.max(0, Math.min(300, validSeconds(seconds)));
  if (!increment) return readStudyTimeDay(storage, username, date);
  const envelope = readEnvelope(storage, username);
  const dayKey = localDayKey(date);
  const current = readStudyTimeDay(storage, username, date);
  const byCategory = { ...current.byCategory };
  if (category) byCategory[category] += increment;
  envelope.days[dayKey] = {
    totalSeconds: Object.values(byCategory).reduce((sum, value) => sum + value, 0),
    appTotalSeconds: current.appTotalSeconds + increment,
    byCategory,
  };
  const recentDays = Object.entries(envelope.days).sort(([a], [b]) => b.localeCompare(a)).slice(0, 430);
  storage.setItem(studyTimeStorageKey(username), JSON.stringify({ version: 1, days: Object.fromEntries(recentDays) } satisfies StudyTimeEnvelope));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(STUDY_TIME_EVENT, { detail: { username, dayKey } }));
  return envelope.days[dayKey];
}

export function recordStudyTime(storage: StudyTimeStorage, username: string, category: StudyTimeCategory, seconds: number, date = new Date()) {
  return recordForegroundTime(storage, username, category, seconds, date);
}

export function getStudyTimeDeviceId(storage: StudyTimeStorage, createId = () => crypto.randomUUID()) {
  const existing = storage.getItem(studyTimeDeviceKey());
  if (existing && /^[a-zA-Z0-9_-]{8,128}$/.test(existing)) return existing;
  const generated = createId().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 128);
  storage.setItem(studyTimeDeviceKey(), generated);
  return generated;
}

function readSyncSums(storage: Pick<StudyTimeStorage, "getItem">, username: string) {
  try {
    const parsed = JSON.parse(storage.getItem(studyTimeSyncKey(username)) || "null") as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") return {} as Record<string, number>;
    return Object.fromEntries(Object.entries(parsed).filter(([, value]) => typeof value === "number" && Number.isFinite(value) && value >= 0)) as Record<string, number>;
  } catch {
    return {} as Record<string, number>;
  }
}

function dayVersion(day: StudyTimeDay) {
  return day.appTotalSeconds + day.totalSeconds;
}

export function buildStudyTimeUpload(storage: Pick<StudyTimeStorage, "getItem">, username: string, maxDays = 14) {
  const envelope = readEnvelope(storage, username);
  const pushed = readSyncSums(storage, username);
  const days = Object.entries(envelope.days)
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, maxDays)
    .map(([day, stored]) => {
      const byCategory = { ...EMPTY_CATEGORIES };
      for (const { id } of STUDY_TIME_CATEGORIES) byCategory[id] = validSeconds(stored?.byCategory?.[id]);
      const normalized: StudyTimeDay = {
        totalSeconds: Object.values(byCategory).reduce((sum, seconds) => sum + seconds, 0),
        appTotalSeconds: validSeconds(stored?.appTotalSeconds),
        byCategory,
      };
      return { day, normalized, version: dayVersion(normalized) };
    })
    .filter(({ day, version }) => version > (pushed[day] ?? 0));
  return {
    days: days.map(({ day, normalized }) => ({ day, appTotalSeconds: normalized.appTotalSeconds, byCategory: normalized.byCategory } satisfies StudyTimeUploadDay)),
    versions: Object.fromEntries(days.map(({ day, version }) => [day, version])),
  };
}

export function markStudyTimeUploaded(storage: StudyTimeStorage, username: string, versions: Record<string, number>) {
  const current = readSyncSums(storage, username);
  const merged = { ...current, ...versions };
  const recent = Object.entries(merged).sort(([left], [right]) => right.localeCompare(left)).slice(0, 90);
  storage.setItem(studyTimeSyncKey(username), JSON.stringify(Object.fromEntries(recent)));
}

export function studyTimeCategoryForPathname(pathname: string): StudyTimeCategory | null {
  if (pathname === "/reviews") return "reviews";
  if (pathname === "/lessons") return "lessons";
  if (pathname.startsWith("/study/")) return "extra-study";
  if (pathname.startsWith("/news/")) return "news";
  if (pathname.startsWith("/music")) return "songs";
  if (pathname.startsWith("/epubs/") || pathname === "/reader") return "reading";
  if (pathname.startsWith("/video")) return "video";
  return null;
}

export function formatStudyTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  if (safeSeconds < 60) return `${safeSeconds}s`;
  const totalMinutes = Math.floor(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours) return `${hours}h ${minutes}m`;
  if (minutes) return `${minutes}m`;
  return "0s";
}

export function useStudyTimeToday(username: string) {
  const subscribe = useCallback((onChange: () => void) => {
    const onStorage = (event: StorageEvent) => { if (event.key === studyTimeStorageKey(username)) onChange(); };
    const onTrackedTime = (event: Event) => { if ((event as CustomEvent<{ username?: string }>).detail?.username === username) onChange(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(STUDY_TIME_EVENT, onTrackedTime);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(STUDY_TIME_EVENT, onTrackedTime); };
  }, [username]);
  const getSnapshot = useCallback(() => JSON.stringify(readStudyTimeDay(window.localStorage, username)), [username]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => JSON.stringify({ totalSeconds: 0, appTotalSeconds: 0, byCategory: EMPTY_CATEGORIES } satisfies StudyTimeDay));
  return useMemo(() => JSON.parse(snapshot) as StudyTimeDay, [snapshot]);
}

export function useStudyTimeRange(username: string, range: StudyTimeRangeId) {
  const subscribe = useCallback((onChange: () => void) => {
    const onStorage = (event: StorageEvent) => { if (event.key === studyTimeStorageKey(username)) onChange(); };
    const onTrackedTime = (event: Event) => { if ((event as CustomEvent<{ username?: string }>).detail?.username === username) onChange(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(STUDY_TIME_EVENT, onTrackedTime);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(STUDY_TIME_EVENT, onTrackedTime); };
  }, [username]);
  const getSnapshot = useCallback(() => window.localStorage.getItem(studyTimeStorageKey(username)) ?? "", [username]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  return useMemo(() => {
    void snapshot;
    return readStudyTimeRange(typeof window === "undefined" ? EMPTY_STORAGE : window.localStorage, username, range);
  }, [range, snapshot, username]);
}
