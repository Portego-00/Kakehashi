"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  buildStudyTimeUpload,
  getStudyTimeDeviceId,
  markStudyTimeUploaded,
  recordForegroundTime,
  studyTimeCategoryForPathname,
} from "@/features/dashboard/study-time";
import { browserTimezone, recordLocalUsageDay } from "@/features/dashboard/usage-streak";
import { useSession } from "@/lib/session";

const SESSION_COOLDOWN_MS = 30 * 60_000;
const SESSION_RETRY_COOLDOWN_MS = 5 * 60_000;
const STUDY_TIME_HEARTBEAT_MS = 5_000;
const STUDY_TIME_SYNC_INTERVAL_MS = 5 * 60_000;
const STUDY_TIME_INITIAL_SYNC_DELAY_MS = 10_000;

let sessionRequest: Promise<void> | null = null;
let studyTimeRequest: Promise<void> | null = null;

function normalizedUsername(username: string) {
  return encodeURIComponent(username.trim().toLocaleLowerCase());
}

function sessionLoggedKey(username: string) {
  return `kakehashi-web:analytics-session:${normalizedUsername(username)}:v1`;
}

function sessionAttemptedKey(username: string) {
  return `kakehashi-web:analytics-session-attempt:${normalizedUsername(username)}:v1`;
}

function readTimestamp(storage: Pick<Storage, "getItem">, key: string) {
  const value = Number(storage.getItem(key));
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function shouldRecordWebSession(storage: Pick<Storage, "getItem">, username: string, now = Date.now()) {
  const lastLogged = readTimestamp(storage, sessionLoggedKey(username));
  const lastAttempted = readTimestamp(storage, sessionAttemptedKey(username));
  const loggedDate = new Date(lastLogged);
  const nowDate = new Date(now);
  const sameLocalDay = lastLogged > 0
    && loggedDate.getFullYear() === nowDate.getFullYear()
    && loggedDate.getMonth() === nowDate.getMonth()
    && loggedDate.getDate() === nowDate.getDate();
  return (!sameLocalDay || now - lastLogged >= SESSION_COOLDOWN_MS)
    && now - lastAttempted >= SESSION_RETRY_COOLDOWN_MS;
}

export async function maybeRecordWebSession(storage: Pick<Storage, "getItem" | "setItem">, username: string, now = Date.now()) {
  recordLocalUsageDay(storage, username, new Date(now), browserTimezone());
  if (!shouldRecordWebSession(storage, username, now) || sessionRequest) return;
  storage.setItem(sessionAttemptedKey(username), String(now));
  sessionRequest = fetch("/api/analytics/session", {
    method: "POST",
    cache: "no-store",
    keepalive: true,
  }).then(async (response) => {
    const payload = await response.json().catch(() => null) as { recorded?: boolean } | null;
    if (response.ok && payload?.recorded) {
      storage.setItem(sessionLoggedKey(username), String(now));
      storage.setItem(sessionAttemptedKey(username), "0");
    }
  }).catch(() => undefined).finally(() => {
    sessionRequest = null;
  });
  await sessionRequest;
}

async function maybeSyncStudyTime(storage: Storage, username: string, keepalive = false) {
  if (studyTimeRequest) return studyTimeRequest;
  const upload = buildStudyTimeUpload(storage, username);
  if (!upload.days.length) return;
  const body = JSON.stringify({ deviceId: getStudyTimeDeviceId(storage), days: upload.days });
  studyTimeRequest = fetch("/api/analytics/study-time", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
    keepalive,
  }).then(async (response) => {
    const payload = await response.json().catch(() => null) as { synced?: boolean } | null;
    if (response.ok && payload?.synced) markStudyTimeUploaded(storage, username, upload.versions);
  }).catch(() => undefined).finally(() => {
    studyTimeRequest = null;
  });
  return studyTimeRequest;
}

export function WebAnalyticsTracker() {
  const pathname = usePathname();
  const { user } = useSession();
  const username = user?.data.username;

  useEffect(() => {
    if (!username) return;
    const recordSession = () => {
      if (document.visibilityState === "visible") void maybeRecordWebSession(window.localStorage, username);
    };
    const onVisibilityChange = () => recordSession();
    const timer = window.setTimeout(recordSession, 0);
    window.addEventListener("focus", recordSession);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", recordSession);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [username]);

  useEffect(() => {
    if (!username) return;
    const category = studyTimeCategoryForPathname(pathname);
    let active = document.visibilityState === "visible";
    let lastTick = Date.now();
    const flush = () => {
      const now = Date.now();
      if (active) recordForegroundTime(window.localStorage, username, category, Math.floor((now - lastTick) / 1_000));
      lastTick = now;
    };
    const sync = (keepalive = false) => {
      flush();
      void maybeSyncStudyTime(window.localStorage, username, keepalive);
    };
    const onVisibilityChange = () => {
      flush();
      active = document.visibilityState === "visible";
      if (!active) void maybeSyncStudyTime(window.localStorage, username, true);
    };
    const onPageHide = () => sync(true);
    const onOnline = () => sync();
    const heartbeat = window.setInterval(flush, STUDY_TIME_HEARTBEAT_MS);
    const initialSync = window.setTimeout(() => sync(), STUDY_TIME_INITIAL_SYNC_DELAY_MS);
    const periodicSync = window.setInterval(() => sync(), STUDY_TIME_SYNC_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("online", onOnline);
    return () => {
      flush();
      window.clearInterval(heartbeat);
      window.clearTimeout(initialSync);
      window.clearInterval(periodicSync);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("online", onOnline);
    };
  }, [pathname, username]);

  return null;
}
