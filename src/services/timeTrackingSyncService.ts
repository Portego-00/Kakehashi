import Constants from "expo-constants";
import { Platform } from "react-native";
import { useAuthStore } from "../utils/store";
import {
  APP_TOTAL_KEY,
  CATEGORY_BY_ACTIVITY,
  studyMsOfRecord,
  type ActivityKey,
  type DayRecord,
} from "./timeTrackingCore";
import {
  isStudyTimeEdgeConfigured,
  postStudyTimeEdge,
} from "./studyTimeEdgeClient";
import {
  getUserPushedSumsKey,
  isValidStudyTimeDeviceId,
  normalizeStudyTimeUserId,
} from "./studyTimeStorageScope";
import { timeTrackingService, timeTrackingStorage } from "./timeTrackingService";

/**
 * Pushes this device's time tracking totals through the verified account sync.
 *
 * Reliability properties:
 * - Rows carry ABSOLUTE day totals keyed by (user_id, device_id, day) and are
 *   upserted. Retries, duplicate requests and out-of-order delivery all
 *   converge on the same value — nothing is ever added twice.
 * - Local MMKV stays the source of truth; this sync is fire-and-forget and
 *   the app never depends on it succeeding.
 */

const DEVICE_ID_KEY = "ttv1.device_id";

const MIN_SYNC_INTERVAL_MS = 90 * 1000;
const MAX_DAYS_PER_SYNC = 14;

let lastAttemptAtMs = 0;
let isSyncing = false;
let resolvedDeviceId: string | null = null;

export type StudyTimeSyncStatus = {
  state: "never" | "syncing" | "success" | "skipped" | "error";
  /** Human-readable outcome of the last attempt, shown in the app. */
  detail: string;
  at: number | null;
  lastSuccessAt: number | null;
};

let syncStatus: StudyTimeSyncStatus = {
  state: "never",
  detail: "No sync attempted yet",
  at: null,
  lastSuccessAt: null,
};

function setSyncStatus(state: StudyTimeSyncStatus["state"], detail: string): void {
  syncStatus = {
    state,
    detail,
    at: Date.now(),
    lastSuccessAt: state === "success" ? Date.now() : syncStatus.lastSuccessAt,
  };
}

/** Read by the Study Time screen so device testers can see sync results. */
export function getStudyTimeSyncStatus(): StudyTimeSyncStatus {
  return syncStatus;
}

function generateDeviceId(): string {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getDeviceId(): string {
  if (resolvedDeviceId) {
    return resolvedDeviceId;
  }

  try {
    const existing = timeTrackingStorage.getString(DEVICE_ID_KEY);
    if (isValidStudyTimeDeviceId(existing)) {
      resolvedDeviceId = existing;
      return resolvedDeviceId;
    }

    // Regeneration changes the local ledger scope as well as the upload key.
    // The old verified rows then safely appear as OTHER-device history.
    const generated = generateDeviceId();
    timeTrackingStorage.set(DEVICE_ID_KEY, generated);
    resolvedDeviceId = generated;
    return resolvedDeviceId;
  } catch {
    // Stable for this process even if persistent storage is temporarily
    // unavailable; unlike a shared sentinel, it cannot collapse devices.
    resolvedDeviceId = generateDeviceId();
    return resolvedDeviceId;
  }
}

function readPushedSums(userId: string, deviceId: string): Record<string, number> {
  try {
    const raw = timeTrackingStorage.getString(
      getUserPushedSumsKey(userId, deviceId),
    );
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePushedSums(
  userId: string,
  deviceId: string,
  sums: Record<string, number>,
): void {
  try {
    timeTrackingStorage.set(
      getUserPushedSumsKey(userId, deviceId),
      JSON.stringify(sums),
    );
  } catch {
    // Best effort; worst case we re-push identical absolute values.
  }
}

/** Total of every bucket in the record. Only ever grows, so it doubles as a
 * cheap dirty-detection version number. */
function recordSum(record: DayRecord): number {
  let total = 0;
  for (const value of Object.values(record)) {
    if (Number.isFinite(value) && value > 0) {
      total += value;
    }
  }
  return total;
}

function buildActivityMs(record: DayRecord): Partial<Record<ActivityKey, number>> {
  const activityMs: Partial<Record<ActivityKey, number>> = {};
  for (const [key, ms] of Object.entries(record)) {
    if (key in CATEGORY_BY_ACTIVITY && Number.isFinite(ms) && ms > 0) {
      activityMs[key as ActivityKey] = Math.round(ms);
    }
  }
  return activityMs;
}

async function syncNow(): Promise<void> {
  if (!isStudyTimeEdgeConfigured()) {
    setSyncStatus("skipped", "Supabase is not configured in this build");
    return;
  }

  const { apiToken, userData } = useAuthStore.getState();
  const userId = normalizeStudyTimeUserId(userData?.id);
  if (!apiToken || !userId) {
    setSyncStatus("skipped", "Waiting for login");
    return;
  }
  const deviceId = getDeviceId();
  if (!timeTrackingService.isScopedToUserDevice(userId, deviceId)) {
    setSyncStatus("skipped", "Waiting for the account-scoped local ledger");
    return;
  }

  setSyncStatus("syncing", "Pushing day totals…");

  // Persist the running clocks so the rows below reflect everything.
  timeTrackingService.foldNow();

  const recentDays = timeTrackingService.getRecentDayRecords(MAX_DAYS_PER_SYNC);
  const pushedSums = readPushedSums(userId, deviceId);

  const dirtyDays = recentDays.filter(({ dateKey, record }) => {
    const sum = recordSum(record);
    return sum > 0 && sum > (pushedSums[dateKey] ?? 0);
  });

  if (dirtyDays.length === 0) {
    setSyncStatus("success", "Up to date — nothing new to push");
    return;
  }

  const appVersion = Constants.expoConfig?.version ?? null;

  const days = dirtyDays.map(({ dateKey, record }) => ({
    day: dateKey,
    activityMs: buildActivityMs(record),
    studyTotalMs: Math.round(studyMsOfRecord(record)),
    appTotalMs: Math.round(record[APP_TOTAL_KEY] ?? 0),
    appVersion,
    platform: Platform.OS,
  }));

  // The Edge Function verifies the WaniKani token and derives the user. Client
  // payloads never get to choose which account owns a row.
  await postStudyTimeEdge("study-time-sync", apiToken, { deviceId, days });

  setSyncStatus(
    "success",
    `Pushed ${dirtyDays.length} day${dirtyDays.length === 1 ? "" : "s"}`
  );

  const nextPushedSums = { ...pushedSums };
  for (const { dateKey, record } of dirtyDays) {
    nextPushedSums[dateKey] = recordSum(record);
  }
  // Drop markers for days outside the sync window to keep the blob tiny.
  const windowKeys = new Set(recentDays.map(({ dateKey }) => dateKey));
  for (const key of Object.keys(nextPushedSums)) {
    if (!windowKeys.has(key)) {
      delete nextPushedSums[key];
    }
  }
  writePushedSums(userId, deviceId, nextPushedSums);
}

export function maybeSyncStudyTime(options: { force?: boolean } = {}): void {
  const now = Date.now();
  if (isSyncing || (!options.force && now - lastAttemptAtMs < MIN_SYNC_INTERVAL_MS)) {
    return;
  }

  lastAttemptAtMs = now;
  isSyncing = true;
  syncNow()
    .catch((error) => {
      console.log("📊 Study time sync failed:", error?.message ?? error);
      setSyncStatus("error", String(error?.message ?? error));
    })
    .finally(() => {
      isSyncing = false;
    });
}

/** Wires the sync into the tracker's opportunity callback. Idempotent. */
export function initializeTimeTrackingSync(): void {
  timeTrackingService.setOnSyncOpportunity(maybeSyncStudyTime);

  // First push shortly after startup, off the critical path.
  setTimeout(() => {
    maybeSyncStudyTime();
  }, 10_000);
}
