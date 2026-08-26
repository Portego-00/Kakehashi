"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  buildStudyTimeUpload,
  cacheRemoteStudyTimeDays,
  getStudyTimeDeviceId,
  markStudyTimeUploaded,
  recordForegroundTime,
  studyTimeCategoryForPathname,
  type RemoteStudyTimeDay,
} from "@/features/dashboard/study-time";
import { browserTimezone, recordLocalUsageDay } from "@/features/dashboard/usage-streak";
import { useSession } from "@/lib/session";
import { waniKaniUserId } from "@/lib/wanikani/user-identity";

const SESSION_COOLDOWN_MS = 30 * 60_000;
const SESSION_RETRY_COOLDOWN_MS = 5 * 60_000;
const STUDY_TIME_HEARTBEAT_MS = 5_000;
const STUDY_TIME_SYNC_INTERVAL_MS = 5 * 60_000;
const STUDY_TIME_INITIAL_SYNC_DELAY_MS = 10_000;
const STUDY_TIME_REMOTE_REFRESH_INTERVAL_MS = 5 * 60_000;

let sessionRequest: Promise<void> | null = null;
const studyTimeRequests = new Map<string, Promise<void>>();

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

async function maybeSyncStudyTime(
  storage: Storage,
  userId: string,
  deviceId: string,
  keepalive = false,
) {
  const scopeKey = `${userId}:${deviceId}`;
  const activeRequest = studyTimeRequests.get(scopeKey);
  if (activeRequest) return activeRequest;
  const upload = buildStudyTimeUpload(storage, userId, deviceId);
  if (!upload.days.length) return;
  const body = JSON.stringify({ deviceId, days: upload.days });
  const request = fetch("/api/analytics/study-time", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
    keepalive,
  }).then(async (response) => {
    const payload = await response.json().catch(() => null) as { synced?: boolean } | null;
    if (response.ok && payload?.synced) markStudyTimeUploaded(storage, userId, deviceId, upload.versions);
  }).catch(() => undefined).finally(() => {
    studyTimeRequests.delete(scopeKey);
  });
  studyTimeRequests.set(scopeKey, request);
  return request;
}

export async function refreshRemoteStudyTime(
  storage: Pick<Storage, "getItem" | "setItem">,
  userId: string,
  deviceId: string,
  signal?: AbortSignal,
) {
  try {
    const response = await fetch(`/api/analytics/study-time?deviceId=${encodeURIComponent(deviceId)}`, {
      cache: "no-store",
      signal,
    });
    const payload = await response.json().catch(() => null) as {
      available?: boolean;
      days?: RemoteStudyTimeDay[];
    } | null;
    if (!response.ok || payload?.available !== true || !Array.isArray(payload.days)) return false;
    return cacheRemoteStudyTimeDays(storage, userId, deviceId, payload.days);
  } catch {
    return false;
  }
}

export function WebAnalyticsTracker() {
  const pathname = usePathname();
  const { user } = useSession();
  const username = user?.data.username;
  const userId = waniKaniUserId(user);

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
    if (!userId) return;
    const deviceId = getStudyTimeDeviceId(window.localStorage);
    let controller: AbortController | null = null;
    const refresh = () => {
      controller?.abort();
      const nextController = new AbortController();
      controller = nextController;
      void refreshRemoteStudyTime(window.localStorage, userId, deviceId, nextController.signal).finally(() => {
        if (controller === nextController) controller = null;
      });
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    refresh();
    const interval = window.setInterval(refreshWhenVisible, STUDY_TIME_REMOTE_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshWhenVisible);
    window.addEventListener("online", refreshWhenVisible);
    return () => {
      controller?.abort();
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshWhenVisible);
      window.removeEventListener("online", refreshWhenVisible);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const deviceId = getStudyTimeDeviceId(window.localStorage);
    const category = studyTimeCategoryForPathname(pathname);
    let active = document.visibilityState === "visible";
    let lastTick = Date.now();
    const flush = () => {
      const now = Date.now();
      if (active) recordForegroundTime(window.localStorage, userId, deviceId, category, Math.floor((now - lastTick) / 1_000));
      lastTick = now;
    };
    const sync = (keepalive = false) => {
      flush();
      void maybeSyncStudyTime(window.localStorage, userId, deviceId, keepalive);
    };
    const onVisibilityChange = () => {
      flush();
      active = document.visibilityState === "visible";
      if (!active) void maybeSyncStudyTime(window.localStorage, userId, deviceId, true);
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
  }, [pathname, userId]);

  return null;
}
