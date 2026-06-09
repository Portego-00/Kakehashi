import Constants from "expo-constants";
import { Platform } from "react-native";
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { useAuthStore } from "../utils/store";
import {
  APP_TOTAL_KEY,
  CATEGORY_BY_ACTIVITY,
  studyMsOfRecord,
  type ActivityKey,
  type DayRecord,
} from "./timeTrackingCore";
import { timeTrackingService, timeTrackingStorage } from "./timeTrackingService";

/**
 * Pushes time tracking totals to Supabase for developer analytics.
 *
 * Reliability properties:
 * - Rows carry ABSOLUTE day totals keyed by (user_id, device_id, day) and are
 *   upserted. Retries, duplicate requests and out-of-order delivery all
 *   converge on the same value — nothing is ever added twice.
 * - Local MMKV stays the source of truth; this sync is fire-and-forget and
 *   the app never depends on it succeeding.
 */

const DEVICE_ID_KEY = "ttv1.device_id";
const PUSHED_SUMS_KEY = "ttv1.sync.pushed_sums";
const TABLE_NAME = "study_time_days";

const MIN_SYNC_INTERVAL_MS = 90 * 1000;
const MAX_DAYS_PER_SYNC = 14;

let lastAttemptAtMs = 0;
let isSyncing = false;
let didWarnAboutMissingTable = false;

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = String((error as { code?: unknown }).code ?? "");
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    (message.includes("does not exist") && message.includes(TABLE_NAME))
  );
}

function getDeviceId(): string {
  try {
    const existing = timeTrackingStorage.getString(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }

    const generated = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}-${Math.random().toString(36).slice(2, 10)}`;
    timeTrackingStorage.set(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return "unknown-device";
  }
}

function readPushedSums(): Record<string, number> {
  try {
    const raw = timeTrackingStorage.getString(PUSHED_SUMS_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writePushedSums(sums: Record<string, number>): void {
  try {
    timeTrackingStorage.set(PUSHED_SUMS_KEY, JSON.stringify(sums));
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
  if (!isSupabaseConfigured || didWarnAboutMissingTable) {
    return;
  }

  const userData = useAuthStore.getState().userData;
  if (!userData?.id) {
    return;
  }

  // Persist the running clocks so the rows below reflect everything.
  timeTrackingService.foldNow();

  const recentDays = timeTrackingService.getRecentDayRecords(MAX_DAYS_PER_SYNC);
  const pushedSums = readPushedSums();

  const dirtyDays = recentDays.filter(({ dateKey, record }) => {
    const sum = recordSum(record);
    return sum > 0 && sum > (pushedSums[dateKey] ?? 0);
  });

  if (dirtyDays.length === 0) {
    return;
  }

  const deviceId = getDeviceId();
  const appVersion = Constants.expoConfig?.version ?? null;
  const nowIso = new Date().toISOString();

  const rows = dirtyDays.map(({ dateKey, record }) => ({
    user_id: userData.id,
    device_id: deviceId,
    day: dateKey,
    activity_ms: buildActivityMs(record),
    study_total_ms: Math.round(studyMsOfRecord(record)),
    app_total_ms: Math.round(record[APP_TOTAL_KEY] ?? 0),
    user_name: userData.username ?? null,
    user_level: userData.level ?? null,
    app_version: appVersion,
    platform: Platform.OS,
    updated_at: nowIso,
  }));

  const { error } = await supabase
    .from(TABLE_NAME)
    .upsert(rows, { onConflict: "user_id,device_id,day" });

  if (error) {
    if (isMissingTableError(error)) {
      if (!didWarnAboutMissingTable) {
        didWarnAboutMissingTable = true;
        console.warn(
          `Time tracking sync table is missing. Run the ${TABLE_NAME} migration to enable it.`
        );
      }
      return;
    }
    // Leave pushed sums untouched; the next opportunity re-sends the same
    // absolute values, which is safe.
    console.log("📊 Could not sync study time:", error.message);
    return;
  }

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
  writePushedSums(nextPushedSums);
}

export function maybeSyncStudyTime(): void {
  const now = Date.now();
  if (isSyncing || now - lastAttemptAtMs < MIN_SYNC_INTERVAL_MS) {
    return;
  }

  lastAttemptAtMs = now;
  isSyncing = true;
  syncNow()
    .catch((error) => {
      console.log("📊 Study time sync failed:", error?.message ?? error);
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
