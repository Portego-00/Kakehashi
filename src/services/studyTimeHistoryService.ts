import { useAuthStore } from "../utils/store";
import { getDeviceId } from "./timeTrackingSyncService";
import { timeTrackingStorage } from "./timeTrackingService";
import { postStudyTimeEdge } from "./studyTimeEdgeClient";
import { normalizeStudyTimeUserId } from "./studyTimeStorageScope";
import {
  createStudyTimeHistoryCache,
  parseStudyTimeHistoryCache,
  parseStudyTimeHistoryResponse,
  type OtherDeviceStudyTimeDay,
  type StudyTimeHistoryCache,
} from "./studyTimeHistoryCore";

const CACHE_KEY_PREFIX = "ttv2.history.other_devices.";
const MIN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

type HistoryScope = {
  userId: string;
  deviceId: string;
};

export type StudyTimeHistoryRefreshResult = {
  days: OtherDeviceStudyTimeDay[];
  source: "network" | "cache" | "unavailable";
};

let memoryCache: StudyTimeHistoryCache | null = null;
let inFlight: Promise<StudyTimeHistoryRefreshResult> | null = null;
let inFlightScopeKey: string | null = null;
const lastAttemptByScope = new Map<string, number>();

export function getStudyTimeHistoryCacheKey(
  userId: string,
  deviceId: string,
): string {
  return (
    `${CACHE_KEY_PREFIX}${encodeURIComponent(userId)}.` +
    encodeURIComponent(deviceId)
  );
}

function getCurrentScope(): HistoryScope | null {
  const userId = normalizeStudyTimeUserId(
    useAuthStore.getState().userData?.id,
  );
  if (!userId) {
    return null;
  }
  return { userId, deviceId: getDeviceId() };
}

function readCache(scope: HistoryScope): StudyTimeHistoryCache | null {
  if (
    memoryCache?.userId === scope.userId &&
    memoryCache.deviceId === scope.deviceId
  ) {
    return memoryCache;
  }

  try {
    const raw = timeTrackingStorage.getString(
      getStudyTimeHistoryCacheKey(scope.userId, scope.deviceId),
    );
    if (!raw) {
      return null;
    }
    const parsed = parseStudyTimeHistoryCache(
      JSON.parse(raw),
      scope.userId,
      scope.deviceId,
    );
    if (parsed) {
      memoryCache = parsed;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(cache: StudyTimeHistoryCache): void {
  memoryCache = cache;
  try {
    timeTrackingStorage.set(
      getStudyTimeHistoryCacheKey(cache.userId, cache.deviceId),
      JSON.stringify(cache),
    );
  } catch {
    // The fresh in-memory value is still usable for this session.
  }
}

/** Synchronous, cache-only read used by the one-second live UI refresh. */
export function getCachedOtherDeviceStudyTimeDays(): OtherDeviceStudyTimeDay[] {
  const scope = getCurrentScope();
  return scope ? readCache(scope)?.days ?? [] : [];
}

async function refreshScope(
  scope: HistoryScope,
  apiToken: string,
): Promise<StudyTimeHistoryRefreshResult> {
  const cached = readCache(scope);

  try {
    const response = await postStudyTimeEdge(
      "study-time-history",
      apiToken,
      { deviceId: scope.deviceId },
    );
    const payload = parseStudyTimeHistoryResponse(await response.json());
    const nextCache = createStudyTimeHistoryCache(
      scope.userId,
      scope.deviceId,
      payload.days,
    );
    writeCache(nextCache);
    return { days: nextCache.days, source: "network" };
  } catch (error) {
    // Network, timeout, HTTP, and payload errors all fall back to the last
    // validated cache. Never include authentication headers in logs.
    console.log(
      "📊 Could not refresh combined study time:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return cached
      ? { days: cached.days, source: "cache" }
      : { days: [], source: "unavailable" };
  }
}

/** Refresh at most every five minutes unless explicitly forced. */
export function maybeRefreshStudyTimeHistory(
  options: { force?: boolean } = {},
): Promise<StudyTimeHistoryRefreshResult> {
  const { apiToken } = useAuthStore.getState();
  const scope = getCurrentScope();
  if (!apiToken || !scope) {
    return Promise.resolve({
      days: scope ? readCache(scope)?.days ?? [] : [],
      source: scope && readCache(scope) ? "cache" : "unavailable",
    });
  }

  const scopeKey = getStudyTimeHistoryCacheKey(scope.userId, scope.deviceId);
  if (inFlight && inFlightScopeKey === scopeKey) {
    return inFlight;
  }

  const now = Date.now();
  const cached = readCache(scope);
  const lastFreshAt = Math.max(
    cached?.updatedAt ?? 0,
    lastAttemptByScope.get(scopeKey) ?? 0,
  );
  if (!options.force && now - lastFreshAt < MIN_REFRESH_INTERVAL_MS) {
    return Promise.resolve({
      days: cached?.days ?? [],
      source: cached ? "cache" : "unavailable",
    });
  }

  lastAttemptByScope.set(scopeKey, now);
  inFlightScopeKey = scopeKey;
  inFlight = refreshScope(scope, apiToken).finally(() => {
    if (inFlightScopeKey === scopeKey) {
      inFlight = null;
      inFlightScopeKey = null;
    }
  });
  return inFlight;
}
