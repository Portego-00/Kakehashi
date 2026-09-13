"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

export type StudyTimeCategory = "reviews" | "lessons" | "extra-study" | "news" | "songs" | "reading" | "video";
export type StudyTimeDay = { totalSeconds: number; appTotalSeconds: number; byCategory: Record<StudyTimeCategory, number> };
export type StudyTimeRangeId = "today" | "week" | "month" | "all";
export type StudyTimeChartBucket = StudyTimeDay & { id: string; label: string; accessibilityLabel: string; isCurrent: boolean };
export type StudyTimeRange = { summary: StudyTimeDay; series: StudyTimeChartBucket[]; chartTitle: string };
type StudyTimeEnvelope = {
  version: 2;
  userId: string;
  deviceId: string;
  days: Record<string, StudyTimeDay>;
};
type StudyTimeSyncEnvelope = {
  version: 3;
  userId: string;
  deviceId: string;
  sums: Record<string, number>;
};
type StudyTimeStorage = Pick<Storage, "getItem" | "setItem">;
export type StudyTimeUploadDay = { day: string; appTotalSeconds: number; byCategory: Record<StudyTimeCategory, number> };
export type RemoteStudyTimeDay = { day: string; appTotalSeconds: number; byCategory: Partial<Record<StudyTimeCategory, number>> };

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
const DEVICE_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_STUDY_TIME_DAYS = 430;
const MAX_REMOTE_SECONDS_PER_DAY = 100 * 24 * 60 * 60;

function normalizedScopePart(value: string) {
  return encodeURIComponent(value.trim());
}

function isValidUserId(userId: string) {
  const normalized = userId.trim();
  return normalized.length > 0 && normalized.length <= 256;
}

function hasValidScope(userId: string, deviceId: string) {
  return isValidUserId(userId) && DEVICE_ID_PATTERN.test(deviceId);
}

export function studyTimeStorageKey(userId: string, deviceId: string) {
  return `kakehashi-web:study-time:user:${normalizedScopePart(userId)}:device:${normalizedScopePart(deviceId)}:v2`;
}

export function studyTimeDeviceKey() {
  return "kakehashi-web:study-time-device:v1";
}

function studyTimeSyncKey(userId: string, deviceId: string) {
  return `kakehashi-web:study-time-sync:user:${normalizedScopePart(userId)}:device:${normalizedScopePart(deviceId)}:v3`;
}

export function remoteStudyTimeStorageKey(userId: string, deviceId: string) {
  return `kakehashi-web:study-time-remote:user:${normalizedScopePart(userId)}:device:${normalizedScopePart(deviceId)}:v2`;
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

function emptyEnvelope(userId: string, deviceId: string): StudyTimeEnvelope {
  return { version: 2, userId, deviceId, days: {} };
}

function readEnvelope(
  storage: Pick<StudyTimeStorage, "getItem">,
  userId: string,
  deviceId: string,
): StudyTimeEnvelope {
  if (!hasValidScope(userId, deviceId)) return emptyEnvelope(userId, deviceId);
  try {
    const parsed = JSON.parse(storage.getItem(studyTimeStorageKey(userId, deviceId)) || "null") as Partial<StudyTimeEnvelope> | null;
    if (parsed?.version !== 2
      || parsed.userId !== userId
      || parsed.deviceId !== deviceId
      || !parsed.days
      || typeof parsed.days !== "object"
      || Array.isArray(parsed.days)
      || Object.keys(parsed.days).length > MAX_STUDY_TIME_DAYS) return emptyEnvelope(userId, deviceId);
    return { version: 2, userId, deviceId, days: parsed.days as Record<string, StudyTimeDay> };
  } catch {
    return emptyEnvelope(userId, deviceId);
  }
}

function storedDeviceId(storage: Pick<StudyTimeStorage, "getItem">) {
  const deviceId = storage.getItem(studyTimeDeviceKey());
  return deviceId && DEVICE_ID_PATTERN.test(deviceId) ? deviceId : "";
}

function readRemoteEnvelope(
  storage: Pick<StudyTimeStorage, "getItem">,
  userId: string,
  deviceId: string,
): StudyTimeEnvelope {
  if (!hasValidScope(userId, deviceId)) return emptyEnvelope(userId, deviceId);
  try {
    const parsed = JSON.parse(storage.getItem(remoteStudyTimeStorageKey(userId, deviceId)) || "null") as Partial<StudyTimeEnvelope> | null;
    if (parsed?.version !== 2
      || parsed.userId !== userId
      || parsed.deviceId !== deviceId
      || !parsed.days
      || typeof parsed.days !== "object"
      || Array.isArray(parsed.days)) return emptyEnvelope(userId, deviceId);
    const remoteDays = Object.entries(parsed.days).map(([day, value]) => ({
      day,
      appTotalSeconds: value?.appTotalSeconds,
      byCategory: value?.byCategory,
    }));
    const days = validatedRemoteDays(remoteDays);
    return days ? { version: 2, userId, deviceId, days } : emptyEnvelope(userId, deviceId);
  } catch {
    return emptyEnvelope(userId, deviceId);
  }
}

export function readStudyTimeDay(
  storage: Pick<StudyTimeStorage, "getItem">,
  userId: string,
  deviceId: string,
  date = new Date(),
): StudyTimeDay {
  const stored = readEnvelope(storage, userId, deviceId).days[localDayKey(date)];
  const byCategory = { ...EMPTY_CATEGORIES };
  for (const { id } of STUDY_TIME_CATEGORIES) byCategory[id] = validSeconds(stored?.byCategory?.[id]);
  return {
    totalSeconds: Object.values(byCategory).reduce((sum, seconds) => sum + seconds, 0),
    appTotalSeconds: validSeconds(stored?.appTotalSeconds),
    byCategory,
  };
}

export function readCombinedStudyTimeDay(
  storage: Pick<StudyTimeStorage, "getItem">,
  userId: string,
  deviceId: string,
  date = new Date(),
): StudyTimeDay {
  return normalizedDay(combinedEnvelope(storage, userId, deviceId).days[localDayKey(date)]);
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

function addStudyTimeDays(left?: StudyTimeDay, right?: StudyTimeDay): StudyTimeDay {
  const first = normalizedDay(left);
  const second = normalizedDay(right);
  const byCategory = { ...EMPTY_CATEGORIES };
  for (const { id } of STUDY_TIME_CATEGORIES) byCategory[id] = first.byCategory[id] + second.byCategory[id];
  return {
    totalSeconds: Object.values(byCategory).reduce((sum, seconds) => sum + seconds, 0),
    appTotalSeconds: first.appTotalSeconds + second.appTotalSeconds,
    byCategory,
  };
}

function combinedEnvelope(
  storage: Pick<StudyTimeStorage, "getItem">,
  userId: string,
  deviceId: string,
): StudyTimeEnvelope {
  const local = readEnvelope(storage, userId, deviceId);
  const remote = readRemoteEnvelope(storage, userId, deviceId);
  const days = { ...remote.days };
  for (const [day, value] of Object.entries(local.days)) days[day] = addStudyTimeDays(value, days[day]);
  return { version: 2, userId, deviceId, days };
}

function isRealDayKey(value: string) {
  if (!DAY_KEY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validRemoteSeconds(value: unknown): number | null {
  return typeof value === "number"
    && Number.isSafeInteger(value)
    && value >= 0
    && value <= MAX_REMOTE_SECONDS_PER_DAY
    ? value
    : null;
}

function validatedRemoteDays(remoteDays: RemoteStudyTimeDay[]): Record<string, StudyTimeDay> | null {
  if (remoteDays.length > MAX_STUDY_TIME_DAYS) return null;
  const days: Record<string, StudyTimeDay> = {};

  for (const candidate of remoteDays) {
    if (!candidate
      || typeof candidate !== "object"
      || !isRealDayKey(candidate.day)
      || candidate.day in days
      || !candidate.byCategory
      || typeof candidate.byCategory !== "object"
      || Array.isArray(candidate.byCategory)) return null;
    const categoryEntries = Object.entries(candidate.byCategory);
    if (categoryEntries.some(([category]) => !STUDY_TIME_CATEGORIES.some(({ id }) => id === category))) return null;

    const byCategory = { ...EMPTY_CATEGORIES };
    for (const { id } of STUDY_TIME_CATEGORIES) {
      const seconds = candidate.byCategory[id] === undefined ? 0 : validRemoteSeconds(candidate.byCategory[id]);
      if (seconds === null) return null;
      byCategory[id] = seconds;
    }
    const appTotalSeconds = validRemoteSeconds(candidate.appTotalSeconds);
    const totalSeconds = Object.values(byCategory).reduce((sum, seconds) => sum + seconds, 0);
    if (appTotalSeconds === null
      || !Number.isSafeInteger(totalSeconds)
      || totalSeconds > MAX_REMOTE_SECONDS_PER_DAY
      || totalSeconds > appTotalSeconds) return null;
    days[candidate.day] = { totalSeconds, appTotalSeconds, byCategory };
  }

  return Object.fromEntries(Object.entries(days).sort(([left], [right]) => right.localeCompare(left)));
}

export function cacheRemoteStudyTimeDays(
  storage: StudyTimeStorage,
  userId: string,
  deviceId: string,
  remoteDays: RemoteStudyTimeDay[],
) {
  if (!hasValidScope(userId, deviceId)) return false;
  const days = validatedRemoteDays(remoteDays);
  if (!days) return false;
  storage.setItem(remoteStudyTimeStorageKey(userId, deviceId), JSON.stringify({
    version: 2,
    userId,
    deviceId,
    days,
  } satisfies StudyTimeEnvelope));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(STUDY_TIME_EVENT, { detail: { userId } }));
  return true;
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
  userId: string,
  deviceId: string,
  range: StudyTimeRangeId,
  now = new Date(),
  bucketCount = 14,
): StudyTimeRange {
  return studyTimeRangeForEnvelope(readEnvelope(storage, userId, deviceId), range, now, bucketCount);
}

export function readCombinedStudyTimeRange(
  storage: Pick<StudyTimeStorage, "getItem">,
  userId: string,
  deviceId: string,
  range: StudyTimeRangeId,
  now = new Date(),
  bucketCount = 14,
): StudyTimeRange {
  return studyTimeRangeForEnvelope(combinedEnvelope(storage, userId, deviceId), range, now, bucketCount);
}

function studyTimeRangeForEnvelope(
  envelope: StudyTimeEnvelope,
  range: StudyTimeRangeId,
  now: Date,
  bucketCount: number,
): StudyTimeRange {
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

export function recordForegroundTime(
  storage: StudyTimeStorage,
  userId: string,
  deviceId: string,
  category: StudyTimeCategory | null,
  seconds: number,
  date = new Date(),
) {
  const increment = Math.max(0, Math.min(300, validSeconds(seconds)));
  if (!increment || !hasValidScope(userId, deviceId)) return readStudyTimeDay(storage, userId, deviceId, date);
  const envelope = readEnvelope(storage, userId, deviceId);
  const dayKey = localDayKey(date);
  const current = readStudyTimeDay(storage, userId, deviceId, date);
  const byCategory = { ...current.byCategory };
  if (category) byCategory[category] += increment;
  envelope.days[dayKey] = {
    totalSeconds: Object.values(byCategory).reduce((sum, value) => sum + value, 0),
    appTotalSeconds: current.appTotalSeconds + increment,
    byCategory,
  };
  const recentDays = Object.entries(envelope.days).sort(([a], [b]) => b.localeCompare(a)).slice(0, MAX_STUDY_TIME_DAYS);
  storage.setItem(studyTimeStorageKey(userId, deviceId), JSON.stringify({
    version: 2,
    userId,
    deviceId,
    days: Object.fromEntries(recentDays),
  } satisfies StudyTimeEnvelope));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(STUDY_TIME_EVENT, { detail: { userId, dayKey } }));
  return envelope.days[dayKey];
}

export function recordStudyTime(
  storage: StudyTimeStorage,
  userId: string,
  deviceId: string,
  category: StudyTimeCategory,
  seconds: number,
  date = new Date(),
) {
  return recordForegroundTime(storage, userId, deviceId, category, seconds, date);
}

export function getStudyTimeDeviceId(storage: StudyTimeStorage, createId = () => crypto.randomUUID()) {
  const existing = storage.getItem(studyTimeDeviceKey());
  if (existing && DEVICE_ID_PATTERN.test(existing)) return existing;
  const generated = createId().replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 128);
  storage.setItem(studyTimeDeviceKey(), generated);
  return generated;
}

function readSyncSums(
  storage: Pick<StudyTimeStorage, "getItem">,
  userId: string,
  deviceId: string,
) {
  if (!hasValidScope(userId, deviceId)) return {} as Record<string, number>;
  try {
    const parsed = JSON.parse(storage.getItem(studyTimeSyncKey(userId, deviceId)) || "null") as Partial<StudyTimeSyncEnvelope> | null;
    if (parsed?.version !== 3
      || parsed.userId !== userId
      || parsed.deviceId !== deviceId
      || !parsed.sums
      || typeof parsed.sums !== "object"
      || Array.isArray(parsed.sums)) return {} as Record<string, number>;
    return Object.fromEntries(Object.entries(parsed.sums).filter(([, value]) => typeof value === "number" && Number.isFinite(value) && value >= 0)) as Record<string, number>;
  } catch {
    return {} as Record<string, number>;
  }
}

function dayVersion(day: StudyTimeDay) {
  return day.appTotalSeconds + day.totalSeconds;
}

export function buildStudyTimeUpload(
  storage: Pick<StudyTimeStorage, "getItem">,
  userId: string,
  deviceId: string,
  maxDays = 14,
) {
  const envelope = readEnvelope(storage, userId, deviceId);
  const pushed = readSyncSums(storage, userId, deviceId);
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

export function markStudyTimeUploaded(
  storage: StudyTimeStorage,
  userId: string,
  deviceId: string,
  versions: Record<string, number>,
) {
  if (!hasValidScope(userId, deviceId)) return;
  const current = readSyncSums(storage, userId, deviceId);
  const merged = { ...current, ...versions };
  const recent = Object.entries(merged).sort(([left], [right]) => right.localeCompare(left)).slice(0, 90);
  storage.setItem(studyTimeSyncKey(userId, deviceId), JSON.stringify({
    version: 3,
    userId,
    deviceId,
    sums: Object.fromEntries(recent),
  } satisfies StudyTimeSyncEnvelope));
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

export function useStudyTimeToday(userId: string) {
  const subscribe = useCallback((onChange: () => void) => {
    const onStorage = (event: StorageEvent) => {
      const deviceId = storedDeviceId(window.localStorage);
      if (event.key === studyTimeDeviceKey()
        || (deviceId && event.key === studyTimeStorageKey(userId, deviceId))
        || (deviceId && event.key === remoteStudyTimeStorageKey(userId, deviceId))) onChange();
    };
    const onTrackedTime = (event: Event) => { if ((event as CustomEvent<{ userId?: string }>).detail?.userId === userId) onChange(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(STUDY_TIME_EVENT, onTrackedTime);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(STUDY_TIME_EVENT, onTrackedTime); };
  }, [userId]);
  const getSnapshot = useCallback(() => JSON.stringify(readCombinedStudyTimeDay(
    window.localStorage,
    userId,
    storedDeviceId(window.localStorage),
  )), [userId]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => JSON.stringify({ totalSeconds: 0, appTotalSeconds: 0, byCategory: EMPTY_CATEGORIES } satisfies StudyTimeDay));
  return useMemo(() => JSON.parse(snapshot) as StudyTimeDay, [snapshot]);
}

export function useStudyTimeRange(userId: string, range: StudyTimeRangeId) {
  const subscribe = useCallback((onChange: () => void) => {
    const onStorage = (event: StorageEvent) => {
      const deviceId = storedDeviceId(window.localStorage);
      if (event.key === studyTimeDeviceKey()
        || (deviceId && event.key === studyTimeStorageKey(userId, deviceId))
        || (deviceId && event.key === remoteStudyTimeStorageKey(userId, deviceId))) onChange();
    };
    const onTrackedTime = (event: Event) => { if ((event as CustomEvent<{ userId?: string }>).detail?.userId === userId) onChange(); };
    window.addEventListener("storage", onStorage);
    window.addEventListener(STUDY_TIME_EVENT, onTrackedTime);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener(STUDY_TIME_EVENT, onTrackedTime); };
  }, [userId]);
  const getSnapshot = useCallback(() => {
    const deviceId = storedDeviceId(window.localStorage);
    return JSON.stringify([
      deviceId,
      deviceId ? window.localStorage.getItem(studyTimeStorageKey(userId, deviceId)) ?? "" : "",
      deviceId ? window.localStorage.getItem(remoteStudyTimeStorageKey(userId, deviceId)) ?? "" : "",
    ]);
  }, [userId]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, () => "");
  return useMemo(() => {
    void snapshot;
    const storage = typeof window === "undefined" ? EMPTY_STORAGE : window.localStorage;
    return readCombinedStudyTimeRange(storage, userId, storedDeviceId(storage), range);
  }, [range, snapshot, userId]);
}
