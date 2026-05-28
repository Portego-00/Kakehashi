import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { Platform } from 'react-native';
import WaniKaniBackgroundFetch from '../modules/WaniKaniBackgroundFetch';
import { apiDebugger } from "./apiDebugger";
import { isIOSOnMac } from "./platformSupport";
import {
    CACHE_TTL,
    getCachedSubject,
    getDataUpdatedAt,
    getETag,
    getFromCache,
    getLastModified,
    getSubjectById,
    saveDataUpdatedAt,
    saveETag,
    saveLastModified,
    saveToCache
} from "./cache";
import { startPerformanceTimer } from "./performanceLogger";
import {
  getAssignmentsFromPermanentStorage,
  saveAssignmentsToPermanentStorage,
} from "./permanentStorage";
import { startupDiagnostics } from "./startupDiagnostics";

export const API_BASE_URL = "https://api.wanikani.com/v2";

const TOKEN_STORAGE_KEY = "wanikani_api_token";
const API_REVISION = "20170710";
const MIN_CREATED_AT_AGE_MS = 15 * 60 * 1000; // 15 minutes
const API_RATE_LIMIT_PER_MINUTE = 60;
const API_RATE_LIMIT_SAFETY_BUFFER = 1;
const ENABLE_API_TRACKER_LOGS = __DEV__;

type ReservedApiSlot = {
  reservationId: number;
};

const apiRateLimitState = {
  estimatedClockSkewMs: 0,
  limit: API_RATE_LIMIT_PER_MINUTE,
  completedByMinute: new Map<number, number>(),
  reservedByMinute: new Map<number, number>(),
  reservationMinuteById: new Map<number, number>(),
  nextReservationId: 1,
  lock: Promise.resolve(),
};

function parseHttpDateHeader(headerValue: string | null): number | null {
  if (!headerValue) return null;
  const parsed = Date.parse(headerValue);
  return Number.isNaN(parsed) ? null : parsed;
}

function getResponseHeader(
  response: { headers?: { get?: (name: string) => string | null } } | null | undefined,
  headerName: string
): string | null {
  if (!response?.headers || typeof response.headers.get !== "function") {
    return null;
  }
  return response.headers.get(headerName);
}

function getCount(map: Map<number, number>, key: number): number {
  return map.get(key) ?? 0;
}

function getServerNowMs(): number {
  return Date.now() + apiRateLimitState.estimatedClockSkewMs;
}

function getServerMinuteKey(serverNowMs: number = getServerNowMs()): number {
  return Math.floor(serverNowMs / 60000);
}

function getSecondsUntilNextServerMinute(serverNowMs: number = getServerNowMs()): number {
  const nextMinuteMs = (Math.floor(serverNowMs / 60000) + 1) * 60000;
  return Math.max(0, Math.ceil((nextMinuteMs - serverNowMs) / 1000));
}

function cleanupRateLimitMaps(currentMinute: number) {
  const oldestMinuteToKeep = currentMinute - 2;
  for (const minute of apiRateLimitState.completedByMinute.keys()) {
    if (minute < oldestMinuteToKeep) {
      apiRateLimitState.completedByMinute.delete(minute);
    }
  }
  for (const minute of apiRateLimitState.reservedByMinute.keys()) {
    if (minute < oldestMinuteToKeep) {
      apiRateLimitState.reservedByMinute.delete(minute);
    }
  }
}

async function withApiRateLimitLock<T>(fn: () => T | Promise<T>): Promise<T> {
  const previousLock = apiRateLimitState.lock;
  let releaseLock!: () => void;
  apiRateLimitState.lock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  await previousLock;
  try {
    return await fn();
  } finally {
    releaseLock();
  }
}

function toPascalCase(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function inferApiOperationLabel(requestUrl: string | URL, method: string): string {
  try {
    const parsedUrl = new URL(requestUrl.toString());
    const segments = parsedUrl.pathname.split("/").filter(Boolean);
    if (segments[0] === "v2") {
      segments.shift();
    }

    const resource = segments[0] ?? "request";
    const action = segments[segments.length - 1];
    const hasIdSegment =
      segments.length > 1 && /^\d+$/.test(segments[segments.length - 1] ?? "");

    if (method === "GET") {
      if (resource === "user") return "getUser";
      if (resource === "summary") return "getSummary";
      if (resource === "subjects" && hasIdSegment) return "getSubject";
      return `get${toPascalCase(resource)}`;
    }

    if (method === "POST") {
      if (resource === "reviews") return "createReview";
      return `create${toPascalCase(resource.replace(/s$/, ""))}`;
    }

    if (method === "PUT") {
      if (action === "start" && resource === "assignments") return "startAssignment";
      return `update${toPascalCase(resource.replace(/s$/, ""))}`;
    }

    return `${method.toLowerCase()}${toPascalCase(resource)}`;
  } catch {
    return "apiRequest";
  }
}

function inferResourcePath(requestUrl: string): string | null {
  try {
    const parsedUrl = new URL(requestUrl);
    const segments = parsedUrl.pathname.split("/").filter(Boolean);
    if (segments[0] === "v2") {
      segments.shift();
    }
    const resource = segments[0];
    return resource ? `/${resource}` : null;
  } catch {
    return null;
  }
}

function buildPaginationEndpointLabel(requestUrl: string, fallbackPage: number): string {
  const resourcePath = inferResourcePath(requestUrl);

  try {
    const parsedUrl = new URL(requestUrl);
    const pageParam = parsedUrl.searchParams.get("page");
    const parsedPage = pageParam ? parseInt(pageParam, 10) : NaN;
    const pageNumber =
      Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : fallbackPage;

    if (resourcePath) {
      return `${resourcePath} page ${pageNumber}`;
    }
  } catch {
    // Fall back to generic pagination label below.
  }

  return `[pagination page ${fallbackPage}]`;
}

async function reserveApiRequestSlot(operation: string): Promise<ReservedApiSlot> {
  while (true) {
    const decision = await withApiRateLimitLock(() => {
      const serverNowMs = getServerNowMs();
      const minuteKey = getServerMinuteKey(serverNowMs);
      cleanupRateLimitMaps(minuteKey);

      const completed = getCount(apiRateLimitState.completedByMinute, minuteKey);
      const reserved = getCount(apiRateLimitState.reservedByMinute, minuteKey);
      const effectiveLimit = Math.max(1, apiRateLimitState.limit - API_RATE_LIMIT_SAFETY_BUFFER);
      const used = completed + reserved;

      if (used < effectiveLimit) {
        const reservationId = apiRateLimitState.nextReservationId++;
        apiRateLimitState.reservationMinuteById.set(reservationId, minuteKey);
        apiRateLimitState.reservedByMinute.set(minuteKey, reserved + 1);
        return {
          allowed: true as const,
          reservationId,
          usedAfterReserve: used + 1,
          secondsRemaining: getSecondsUntilNextServerMinute(serverNowMs),
          limit: apiRateLimitState.limit,
        };
      }

      return {
        allowed: false as const,
        waitSeconds: Math.max(1, getSecondsUntilNextServerMinute(serverNowMs)),
      };
    });

    if (decision.allowed) {
      if (ENABLE_API_TRACKER_LOGS && !startupDiagnostics.shouldSuppressApiCallLogs()) {
        console.log(
          `[API Tracker] ${decision.usedAfterReserve}/${decision.limit} ${operation} (${decision.secondsRemaining} seconds remaining)`
        );
      }
      return {
        reservationId: decision.reservationId,
      };
    }

    if (ENABLE_API_TRACKER_LOGS && !startupDiagnostics.shouldSuppressApiCallLogs()) {
      console.log(
        `[API Tracker] Waiting ${decision.waitSeconds}s for ${operation} to avoid 429`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, decision.waitSeconds * 1000));
  }
}

async function finalizeApiRequestSlot(
  reservedSlot: ReservedApiSlot,
  requestStartedAtMs: number,
  response?: Response
) {
  await withApiRateLimitLock(() => {
    const reservedMinute = apiRateLimitState.reservationMinuteById.get(
      reservedSlot.reservationId
    );
    if (reservedMinute !== undefined) {
      const currentReservedCount = getCount(apiRateLimitState.reservedByMinute, reservedMinute);
      if (currentReservedCount <= 1) {
        apiRateLimitState.reservedByMinute.delete(reservedMinute);
      } else {
        apiRateLimitState.reservedByMinute.set(reservedMinute, currentReservedCount - 1);
      }
      apiRateLimitState.reservationMinuteById.delete(reservedSlot.reservationId);
    }

    const completedAtMs = Date.now();
    const serverDateMs = parseHttpDateHeader(getResponseHeader(response, "Date"));
    const limitHeader = getResponseHeader(response, "RateLimit-Limit");
    const remainingHeader = getResponseHeader(response, "RateLimit-Remaining");

    if (limitHeader) {
      const parsedLimit = parseInt(limitHeader, 10);
      if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
        apiRateLimitState.limit = parsedLimit;
      }
    }

    if (serverDateMs !== null) {
      const roundTripMs = completedAtMs - requestStartedAtMs;
      apiRateLimitState.estimatedClockSkewMs =
        serverDateMs + roundTripMs / 2 - completedAtMs;
    }

    const completionMinute =
      serverDateMs !== null
        ? getServerMinuteKey(serverDateMs)
        : getServerMinuteKey();

    const completedForMinute = getCount(
      apiRateLimitState.completedByMinute,
      completionMinute
    );

    if (remainingHeader && limitHeader) {
      const parsedRemaining = parseInt(remainingHeader, 10);
      const parsedLimit = parseInt(limitHeader, 10);
      if (
        Number.isFinite(parsedRemaining) &&
        Number.isFinite(parsedLimit) &&
        parsedRemaining >= 0 &&
        parsedLimit >= 0
      ) {
        const inferredUsed = Math.max(0, parsedLimit - parsedRemaining);
        apiRateLimitState.completedByMinute.set(
          completionMinute,
          Math.max(completedForMinute, inferredUsed)
        );
      } else {
        apiRateLimitState.completedByMinute.set(completionMinute, completedForMinute + 1);
      }
    } else {
      apiRateLimitState.completedByMinute.set(completionMinute, completedForMinute + 1);
    }

    cleanupRateLimitMaps(getServerMinuteKey());
  });
}

async function fetchWaniKaniApi(
  input: string | URL,
  init: (RequestInit & { trackerLabel?: string }) = {}
): Promise<Response> {
  const { trackerLabel, ...fetchInit } = init;
  const method = (fetchInit.method ?? "GET").toUpperCase();
  const label = trackerLabel ?? inferApiOperationLabel(input, method);
  const slot = await reserveApiRequestSlot(label);
  const requestStartedAtMs = Date.now();

  let response: Response | undefined;
  let requestError: unknown;
  try {
    response = await fetch(input.toString(), fetchInit);
    return response;
  } catch (error) {
    requestError = error;
    throw error;
  } finally {
    await finalizeApiRequestSlot(slot, requestStartedAtMs, response);
    try {
      await apiDebugger.logNetworkCall({
        method,
        requestUrl: input.toString(),
        operation: label,
        durationMs: Date.now() - requestStartedAtMs,
        requestInit: fetchInit,
        response,
        error: requestError,
      });
    } catch (loggingError) {
      if (__DEV__) {
        console.warn("[API Timeline] Failed to capture request:", loggingError);
      }
    }
  }
}

/**
 * Custom API Error class that includes HTTP status code for better error handling
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isRateLimited: boolean;
  public readonly details?: unknown;

  constructor(statusCode: number, message?: string, details?: unknown) {
    super(message || `API error: ${statusCode}`);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.isRateLimited = statusCode === 429;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }
  }
}

function shouldSendCreatedAt(createdAt?: string): boolean {
  if (!createdAt) return false;
  const createdAtMs = Date.parse(createdAt);
  if (Number.isNaN(createdAtMs)) return false;
  return Date.now() - createdAtMs >= MIN_CREATED_AT_AGE_MS;
}

async function parseApiErrorBody(response: Response): Promise<{
  errorBody: unknown;
  detailedMessage: string;
}> {
  const errorText = await response
    .text()
    .catch(() => "Could not read error response");

  let errorBody: unknown = errorText;
  try {
    errorBody = JSON.parse(errorText);
  } catch {
    // Keep raw text when response is not valid JSON.
  }

  const errorDetails =
    typeof errorBody === "object" && errorBody !== null
      ? (errorBody as any).error
      : null;

  const detailedMessage =
    typeof errorDetails === "string"
      ? errorDetails
      : typeof errorDetails?.message === "string"
      ? errorDetails.message
      : typeof (errorBody as any)?.message === "string"
      ? (errorBody as any).message
      : typeof errorText === "string" && errorText.trim().length > 0
      ? errorText
      : `HTTP ${response.status}`;

  return { errorBody, detailedMessage };
}

/**
 * Helper function to check if an error is a rate limit error (429)
 */
export function isRateLimitError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.isRateLimited;
  }
  if (error instanceof Error) {
    return error.message.includes('429') || error.message.toLowerCase().includes('rate limit');
  }
  return false;
}

/**
 * Helper function to check if an error is an unauthorized/permission error (401)
 * This typically means the API token doesn't have the required permissions
 */
export function isUnauthorizedError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.statusCode === 401;
  }
  if (error instanceof Error) {
    return error.message.includes('401') || error.message.toLowerCase().includes('unauthorized');
  }
  return false;
}

// Cache TTLs based on WaniKani best practices
const CACHE_TTL_USER = 60 * 60 * 1000; // 1 hour (user data changes infrequently)
const CACHE_TTL_SUMMARY = 5 * 60 * 1000; // 5 minutes (summary changes every hour, but we check more frequently)
const CACHE_TTL_ASSIGNMENTS = 5 * 60 * 1000; // 5 minutes (moderate update frequency)

// In-memory cache for preventing duplicate concurrent requests
const pendingRequests = new Map<string, Promise<any>>();
const inMemoryCache = new Map<string, { data: any; timestamp: number; etag?: string; lastModified?: string }>();
const pendingOptimizedAssignmentsRequests = new Map<
  string,
  Promise<CollectionResponse<Assignment>>
>();
const pendingOptimizedReviewStatsRequests = new Map<
  string,
  Promise<CollectionResponse<ReviewStatistic>>
>();

function stableSerialize(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }

  const entries = Object.entries(value as Record<string, unknown>).sort(
    ([left], [right]) => left.localeCompare(right)
  );
  return `{${entries
    .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableSerialize(nestedValue)}`)
    .join(",")}}`;
}

/**
 * Clear in-memory cache (useful for debugging or force refresh)
 */
export function clearInMemoryCache() {
  inMemoryCache.clear();
  pendingRequests.clear();
}

export type User = {
  id: string;
  username: string;
  level: number;
  profile_url: string;
  started_at: string;
  current_vacation_started_at: string | null;
  subscription: {
    active: boolean;
    type: string;
    max_level_granted: number;
    period_ends_at: string | null;
  };
  preferences: {
    default_voice_actor_id: number;
    extra_study_autoplay_audio: boolean;
    lessons_autoplay_audio: boolean;
    lessons_batch_size: number;
    lessons_presentation_order: string;
    reviews_autoplay_audio: boolean;
    reviews_display_srs_indicator: boolean;
    reviews_presentation_order: string;
  };
};

export type Assignment = {
  id: number;
  object: string;
  url: string;
  data_updated_at: string;
  data: {
    created_at: string;
    subject_id: number;
    subject_type: "radical" | "kanji" | "vocabulary";
    srs_stage: number;
    unlocked_at: string | null;
    started_at: string | null;
    passed_at: string | null;
    burned_at: string | null;
    available_at: string | null;
    resurrected_at: string | null;
    hidden: boolean;
  };
};

export type Subject = {
  id: number;
  object: string;
  url: string;
  data_updated_at: string;
  data: {
    created_at: string;
    level: number;
    slug: string;
    hidden_at: string | null;
    document_url: string;
    characters: string | null;
    character_images:
      | {
          url: string;
          content_type: string;
          metadata: {
            inline_styles: boolean;
          };
        }[]
      | null;
    meanings: {
      meaning: string;
      primary: boolean;
      accepted_answer: boolean;
    }[];
    auxiliary_meanings: {
      meaning: string;
      type: "whitelist" | "blacklist";
    }[];
    readings:
      | {
          type: "kunyomi" | "onyomi" | "nanori";
          primary: boolean;
          accepted_answer: boolean;
          reading: string;
        }[]
      | null;
    pronunciation_audios?:
      | {
          url: string;
          content_type: string;
          metadata?: {
            voice_actor_name?: string;
          };
        }[]
      | null;
    parts_of_speech: string[] | null;
    component_subject_ids: number[] | null;
    amalgamation_subject_ids: number[] | null;
    visually_similar_subject_ids: number[] | null;
    meaning_mnemonic: string;
    meaning_hint: string | null;
    reading_mnemonic: string | null;
    reading_hint: string | null;
  };
};

export type Summary = {
  object: string;
  url: string;
  data_updated_at: string;
  data: {
    lessons: {
      available_at: string;
      subject_ids: number[];
    }[];
    next_reviews_at: string | null;
    reviews: {
      available_at: string;
      subject_ids: number[];
    }[];
  };
};

export type ReviewStatistic = {
  id: number;
  object: string;
  url: string;
  data_updated_at: string;
  data: {
    created_at: string;
    subject_id: number;
    subject_type: "radical" | "kanji" | "vocabulary";
    meaning_correct: number;
    meaning_incorrect: number;
    meaning_max_streak: number;
    meaning_current_streak: number;
    reading_correct: number;
    reading_incorrect: number;
    reading_max_streak: number;
    reading_current_streak: number;
    percentage_correct: number;
    hidden: boolean;
  };
};

export type LevelProgression = {
  id: number;
  object: string;
  url: string;
  data_updated_at: string;
  data: {
    created_at: string;
    level: number;
    unlocked_at: string | null;
    started_at: string | null;
    passed_at: string | null;
    completed_at: string | null;
    abandoned_at: string | null;
  };
};

export type Reset = {
  id: number;
  object: string;
  url: string;
  data_updated_at: string;
  data: {
    created_at: string;
    original_level: number;
    target_level: number;
    confirmed_at: string;
  };
};

export type CollectionResponse<T> = {
  object: string;
  url: string;
  pages: {
    per_page: number;
    next_url: string | null;
    previous_url: string | null;
  };
  total_count: number;
  data_updated_at: string;
  data: T[];
};

export type ApiResponse<T> = {
  object: string;
  url: string;
  data_updated_at: string;
  data: T;
};

function buildAssignmentsCollectionFromLocalData(
  assignments: Assignment[],
  dataUpdatedAt?: string
): CollectionResponse<Assignment> {
  const latestDataUpdatedAt =
    dataUpdatedAt ??
    assignments.reduce<string | null>((latest, assignment) => {
      const assignmentDataUpdatedAt = assignment.data_updated_at;
      if (!assignmentDataUpdatedAt) {
        return latest;
      }
      if (!latest || Date.parse(assignmentDataUpdatedAt) > Date.parse(latest)) {
        return assignmentDataUpdatedAt;
      }
      return latest;
    }, null) ??
    new Date().toISOString();

  return {
    object: "collection",
    url: `${API_BASE_URL}/assignments`,
    pages: {
      per_page: 500,
      next_url: null,
      previous_url: null,
    },
    total_count: assignments.length,
    data_updated_at: latestDataUpdatedAt,
    data: assignments,
  };
}

async function getPermanentAssignmentsCollection(): Promise<
  CollectionResponse<Assignment> | null
> {
  const permanentAssignments = await getAssignmentsFromPermanentStorage({
    ignoreTTL: true,
  });

  if (!permanentAssignments || permanentAssignments.length === 0) {
    return null;
  }

  return buildAssignmentsCollectionFromLocalData(
    permanentAssignments as Assignment[]
  );
}

async function saveAssignmentsCollectionForOfflineUse(
  assignments: CollectionResponse<Assignment>
): Promise<void> {
  try {
    await saveAssignmentsToPermanentStorage(
      assignments.data,
      assignments.data_updated_at
    );
  } catch (error) {
    console.warn("[API] Failed to persist assignments for offline use:", error);
  }
}

// Note: WaniKani doesn't provide a direct email/password API
// This function simulates what that would look like by opening the browser
// and letting the user log in through WaniKani's website
export async function loginWithEmailPassword(
  email: string,
  password: string
): Promise<string | null> {
  try {
    // Open WaniKani login page in browser
    const result = await WebBrowser.openAuthSessionAsync(
      "https://www.wanikani.com/login",
      "wk-app://callback"
    );

    // This is where we'd capture a token from the redirect
    // For now, this is just a simulation - in a real implementation,
    // you'd need WaniKani to support OAuth or a similar flow
    if (result.type === "success") {
      // In a real OAuth flow, you'd parse the token from the URL
      // For now, we'll handle this in a way to demonstrate the concept
      return await promptForApiToken();
    }
    return null;
  } catch (error) {
    console.error("Login error:", error);
    return null;
  }
}

// Simulated function that would prompt user for API token after browser login
// In a real OAuth implementation, this would be automatic
async function promptForApiToken(): Promise<string | null> {
  // In a real app using OAuth, you'd get this from the redirect
  // Since WaniKani doesn't support this flow directly, we'll use
  // what we have - direct API token access

  // Opening the API tokens page for the user to copy their token
  const result = await WebBrowser.openAuthSessionAsync(
    "https://www.wanikani.com/settings/personal_access_tokens",
    "wk-app://callback"
  );

  // The user would need to manually copy and enter their token
  // Return null here, the UI will handle collecting the token
  return null;
}

export async function getUserData(
  apiToken: string,
  options: { forceRefresh?: boolean } = {}
): Promise<ApiResponse<User>> {
  const timer = startPerformanceTimer('getUserData API call', 'api.ts');
  const startTime = Date.now();
  const cacheKey = 'user_data';
  const url = `${API_BASE_URL}/user`;
  
  try {
    // Check for pending request (request deduplication)
    if (!options.forceRefresh && pendingRequests.has(cacheKey)) {
      const result = await pendingRequests.get(cacheKey)!;
      apiDebugger.logCall({
        endpoint: '/user',
        cacheHit: true,
        duration: Date.now() - startTime,
      });
      timer.end({ result: 'deduplicated' });
      return result;
    }

    // Check in-memory cache first
    const memCache = inMemoryCache.get(cacheKey);
    if (!options.forceRefresh && memCache && Date.now() - memCache.timestamp < CACHE_TTL_USER) {
      apiDebugger.logCall({
        endpoint: '/user',
        cacheHit: true,
        duration: Date.now() - startTime,
      });
      timer.end({ result: 'memory_cache' });
      return memCache.data;
    }

    // Create the fetch promise
    const fetchPromise = (async () => {
      try {
        // Get stored ETag for conditional request
        const etag = await getETag(url);
        const lastModified = await getLastModified(url);

        const headers: Record<string, string> = {
          Authorization: `Bearer ${apiToken}`,
          "Wanikani-Revision": API_REVISION,
        };

        // Add conditional request headers (WaniKani Best Practice #2) unless
        // an explicit force refresh was requested.
        if (!options.forceRefresh) {
          if (etag) {
            headers['If-None-Match'] = etag;
          } else if (lastModified) {
            headers['If-Modified-Since'] = lastModified;
          }
        }

        const response = await fetchWaniKaniApi(url, {
          method: "GET",
          headers,
        });

        // Handle 304 Not Modified - data hasn't changed!
        if (response.status === 304) {
          const rateLimitRemaining = getResponseHeader(response, 'RateLimit-Remaining');
          const rateLimitLimit = getResponseHeader(response, 'RateLimit-Limit');
          const rateLimitReset = getResponseHeader(response, 'RateLimit-Reset');

          apiDebugger.logCall({
            endpoint: '/user',
            cacheHit: true,
            httpStatus: 304,
            duration: Date.now() - startTime,
            rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
            rateLimitLimit: rateLimitLimit ? parseInt(rateLimitLimit) : undefined,
            rateLimitReset: rateLimitReset ? parseInt(rateLimitReset) : undefined,
          });

          // Try memory cache first
          if (memCache) {
            timer.end({ status: 304, result: 'not_modified_memory' });
            return memCache.data;
          }
          
          // Fallback to AsyncStorage cache if memory cache is empty
          const asyncCache = await getFromCache<ApiResponse<User>>(cacheKey, undefined, { ignoreTTL: true });
          if (asyncCache?.data) {
            // Update memory cache for next time
            inMemoryCache.set(cacheKey, {
              data: asyncCache.data,
              timestamp: asyncCache.timestamp,
            });
            timer.end({ status: 304, result: 'not_modified_async' });
            return asyncCache.data;
          }
          
          // If we have no cache at all, we need to fetch fresh data
          // Fall through to make a regular request without If-None-Match header
          const freshResponse = await fetchWaniKaniApi(url, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiToken}`,
              "Wanikani-Revision": API_REVISION,
            },
          });
          
          if (!freshResponse.ok) {
            throw new Error(`API error: ${freshResponse.status}`);
          }
          
          const freshData = await freshResponse.json();
          inMemoryCache.set(cacheKey, {
            data: freshData,
            timestamp: Date.now(),
          });
          timer.end({ status: freshResponse.status, result: 'refetch_after_304' });
          return freshData;
        }

        if (!response.ok) {
          const error = new Error(`API error: ${response.status}`);
          apiDebugger.logCall({
            endpoint: '/user',
            cacheHit: false,
            httpStatus: response.status,
            duration: Date.now() - startTime,
            error: error.message,
          });
          throw error;
        }

        // Extract and save cache headers
        const newETag = getResponseHeader(response, 'ETag');
        const newLastModified = getResponseHeader(response, 'Last-Modified');
        
        if (newETag) {
          await saveETag(url, newETag);
        }
        if (newLastModified) {
          await saveLastModified(url, newLastModified);
        }

        // Extract rate limit headers
        const rateLimitRemaining = getResponseHeader(response, 'RateLimit-Remaining');
        const rateLimitLimit = getResponseHeader(response, 'RateLimit-Limit');
        const rateLimitReset = getResponseHeader(response, 'RateLimit-Reset');

        const result = await response.json();

        // Save to in-memory cache
        inMemoryCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          etag: newETag || undefined,
          lastModified: newLastModified || undefined,
        });
        
        // Also save to AsyncStorage for 304 fallback
        await saveToCache(cacheKey, result, result.data_updated_at || new Date().toISOString());

        apiDebugger.logCall({
          endpoint: '/user',
          cacheHit: false,
          httpStatus: response.status,
          duration: Date.now() - startTime,
          rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
          rateLimitLimit: rateLimitLimit ? parseInt(rateLimitLimit) : undefined,
          rateLimitReset: rateLimitReset ? parseInt(rateLimitReset) : undefined,
        });

        timer.end({ status: response.status });
        return result;
      } finally {
        // Clean up pending request
        pendingRequests.delete(cacheKey);
      }
    })();

    // Store pending request for deduplication
    pendingRequests.set(cacheKey, fetchPromise);
    return await fetchPromise;
    
  } catch (error) {
    pendingRequests.delete(cacheKey);
    timer.end({ error: error instanceof Error ? error.message : String(error) }, false);
    throw error;
  }
}

export async function getSummary(
  apiToken: string,
  options: { forceRefresh?: boolean } = {}
): Promise<ApiResponse<Summary["data"]>> {
  const timer = startPerformanceTimer('getSummary API call', 'api.ts');
  const startTime = Date.now();
  const cacheKey = 'summary_data';
  const url = `${API_BASE_URL}/summary`;
  
  try {
    // Check for pending request (request deduplication)
    if (!options.forceRefresh && pendingRequests.has(cacheKey)) {
      const result = await pendingRequests.get(cacheKey)!;
      apiDebugger.logCall({
        endpoint: '/summary',
        cacheHit: true,
        duration: Date.now() - startTime,
      });
      timer.end({ result: 'deduplicated' });
      return result;
    }

    // Check in-memory cache first (summary changes every hour, cache for 5 min)
    const memCache = inMemoryCache.get(cacheKey);
    if (!options.forceRefresh && memCache && Date.now() - memCache.timestamp < CACHE_TTL_SUMMARY) {
      apiDebugger.logCall({
        endpoint: '/summary',
        cacheHit: true,
        duration: Date.now() - startTime,
      });
      timer.end({ result: 'memory_cache' });
      return memCache.data;
    }

    // Create the fetch promise
    const fetchPromise = (async () => {
      try {
        // Get stored ETag for conditional request
        const etag = await getETag(url);
        const lastModified = await getLastModified(url);

        const headers: Record<string, string> = {
          Authorization: `Bearer ${apiToken}`,
          "Wanikani-Revision": API_REVISION,
        };

        // Add conditional request headers (WaniKani Best Practice #2) unless
        // an explicit force refresh was requested.
        if (!options.forceRefresh) {
          if (etag) {
            headers['If-None-Match'] = etag;
          } else if (lastModified) {
            headers['If-Modified-Since'] = lastModified;
          }
        }

        const response = await fetchWaniKaniApi(url, {
          method: "GET",
          headers,
        });

        // Handle 304 Not Modified - data hasn't changed!
        if (response.status === 304) {
          const rateLimitRemaining = getResponseHeader(response, 'RateLimit-Remaining');
          const rateLimitLimit = getResponseHeader(response, 'RateLimit-Limit');
          const rateLimitReset = getResponseHeader(response, 'RateLimit-Reset');

          apiDebugger.logCall({
            endpoint: '/summary',
            cacheHit: true,
            httpStatus: 304,
            duration: Date.now() - startTime,
            rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
            rateLimitLimit: rateLimitLimit ? parseInt(rateLimitLimit) : undefined,
            rateLimitReset: rateLimitReset ? parseInt(rateLimitReset) : undefined,
          });

          // Try memory cache first
          if (memCache) {
            timer.end({ status: 304, result: 'not_modified_memory' });
            return memCache.data;
          }
          
          // Fallback to AsyncStorage cache if memory cache is empty
          const asyncCache = await getFromCache<ApiResponse<Summary["data"]>>(cacheKey, undefined, { ignoreTTL: true });
          if (asyncCache?.data) {
            // Update memory cache for next time
            inMemoryCache.set(cacheKey, {
              data: asyncCache.data,
              timestamp: asyncCache.timestamp,
            });
            timer.end({ status: 304, result: 'not_modified_async' });
            return asyncCache.data;
          }
          
          // If we have no cache at all, we need to fetch fresh data
          // Fall through to make a regular request without If-None-Match header
          const freshResponse = await fetchWaniKaniApi(url, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiToken}`,
              "Wanikani-Revision": API_REVISION,
            },
          });

          if (!freshResponse.ok) {
            throw new Error(`API error: ${freshResponse.status}`);
          }

          const freshData = await freshResponse.json();
          inMemoryCache.set(cacheKey, {
            data: freshData,
            timestamp: Date.now(),
          });
          timer.end({ status: freshResponse.status, result: 'refetch_after_304' });
          return freshData;
        }

        if (!response.ok) {
          const error = new Error(`API error: ${response.status}`);
          apiDebugger.logCall({
            endpoint: '/summary',
            cacheHit: false,
            httpStatus: response.status,
            duration: Date.now() - startTime,
            error: error.message,
          });
          throw error;
        }

        // Extract and save cache headers
        const newETag = getResponseHeader(response, 'ETag');
        const newLastModified = getResponseHeader(response, 'Last-Modified');
        
        if (newETag) {
          await saveETag(url, newETag);
        }
        if (newLastModified) {
          await saveLastModified(url, newLastModified);
        }

        // Extract rate limit headers
        const rateLimitRemaining = getResponseHeader(response, 'RateLimit-Remaining');
        const rateLimitLimit = getResponseHeader(response, 'RateLimit-Limit');
        const rateLimitReset = getResponseHeader(response, 'RateLimit-Reset');

        const result = await response.json();

        // Save to in-memory cache
        inMemoryCache.set(cacheKey, {
          data: result,
          timestamp: Date.now(),
          etag: newETag || undefined,
          lastModified: newLastModified || undefined,
        });
        
        // Also save to AsyncStorage for 304 fallback
        await saveToCache(cacheKey, result, result.data_updated_at || new Date().toISOString());

        apiDebugger.logCall({
          endpoint: '/summary',
          cacheHit: false,
          httpStatus: response.status,
          duration: Date.now() - startTime,
          rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
          rateLimitLimit: rateLimitLimit ? parseInt(rateLimitLimit) : undefined,
          rateLimitReset: rateLimitReset ? parseInt(rateLimitReset) : undefined,
        });

        timer.end({ status: response.status });
        return result;
      } finally {
        // Clean up pending request
        pendingRequests.delete(cacheKey);
      }
    })();

    // Store pending request for deduplication
    pendingRequests.set(cacheKey, fetchPromise);
    return await fetchPromise;
    
  } catch (error) {
    pendingRequests.delete(cacheKey);
    timer.end({ error: error instanceof Error ? error.message : String(error) }, false);
    throw error;
  }
}

export async function getAssignments(
  apiToken: string,
  params: {
    available_after?: string;
    available_before?: string;
    burned?: boolean;
    hidden?: boolean;
    ids?: number[];
    immediately_available_for_lessons?: boolean;
    immediately_available_for_review?: boolean;
    in_review?: boolean;
    levels?: number[];
    srs_stages?: number[];
    started?: boolean;
    subject_ids?: number[];
    subject_types?: ("radical" | "kanji" | "vocabulary")[];
    unlocked?: boolean;
    updated_after?: string;
  } = {}
): Promise<CollectionResponse<Assignment>> {
  const timer = startPerformanceTimer('getAssignments API call', 'api.ts');
  const startTime = Date.now();
  
  try {
    const url = new URL(`${API_BASE_URL}/assignments`);

    // Format parameters according to WaniKani API requirements
    // Arrays must be comma-delimited strings, not multiple parameters with []
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          // Join array values with commas - this is what WaniKani API expects
          url.searchParams.append(key, value.join(","));
        } else {
          url.searchParams.append(key, String(value));
        }
      }
    });

    const response = await fetchWaniKaniApi(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Wanikani-Revision": API_REVISION,
      },
    });

    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => "Could not read error response");
      console.error(`API error ${response.status} for assignments: ${errorText}`);
      const error = new ApiError(response.status);

      apiDebugger.logCall({
        endpoint: '/assignments',
        params,
        cacheHit: false,
        httpStatus: response.status,
        duration: Date.now() - startTime,
        error: error.message,
      });

      throw error;
    }

    // Extract rate limit headers
    const rateLimitRemaining = getResponseHeader(response, 'RateLimit-Remaining');
    const rateLimitLimit = getResponseHeader(response, 'RateLimit-Limit');
    const rateLimitReset = getResponseHeader(response, 'RateLimit-Reset');

    const result = await response.json();
    
    apiDebugger.logCall({
      endpoint: '/assignments',
      params,
      cacheHit: false,
      httpStatus: response.status,
      duration: Date.now() - startTime,
      rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
      rateLimitLimit: rateLimitLimit ? parseInt(rateLimitLimit) : undefined,
      rateLimitReset: rateLimitReset ? parseInt(rateLimitReset) : undefined,
    });
    
    timer.end({ 
      status: response.status, 
      resultCount: result.data?.length,
      url: url.toString().replace(apiToken, '[REDACTED]')
    });
    return result;
  } catch (error) {
    timer.end({ error: error instanceof Error ? error.message : String(error) }, false);
    throw error;
  }
}

/**
 * Smart wrapper for getAssignments that uses updated_after filter to minimize data transfer.
 * Implements WaniKani Best Practice #3: "Leveraging the updated_after Filter"
 * 
 * On first call: fetches all assignments
 * On subsequent calls: only fetches assignments updated since last fetch, merges with cached data
 */
export async function getAssignmentsOptimized(
  apiToken: string,
  params: {
    available_after?: string;
    available_before?: string;
    burned?: boolean;
    hidden?: boolean;
    ids?: number[];
    immediately_available_for_lessons?: boolean;
    immediately_available_for_review?: boolean;
    in_review?: boolean;
    levels?: number[];
    srs_stages?: number[];
    started?: boolean;
    subject_ids?: number[];
    subject_types?: ("radical" | "kanji" | "vocabulary")[];
    unlocked?: boolean;
  } = {},
  options: { forceFullRefresh?: boolean } = {}
): Promise<CollectionResponse<Assignment>> {
  const timer = startPerformanceTimer('getAssignmentsOptimized', 'api.ts');
  const requestKey = `assignments_optimized:${apiToken}:${stableSerialize(params)}:${stableSerialize(options)}`;
  const pendingRequest = pendingOptimizedAssignmentsRequests.get(requestKey);
  if (pendingRequest) {
    timer.end({ result: 'deduped_inflight' });
    return pendingRequest;
  }

  const cacheKey = 'assignments_all';

  const requestPromise = (async (): Promise<CollectionResponse<Assignment>> => {
    try {
      // Get last data_updated_at timestamp
      const lastUpdatedAt = await getDataUpdatedAt('assignments');

      // If we have a timestamp and not forcing full refresh, use updated_after
      if (lastUpdatedAt && !options.forceFullRefresh) {
        // Fetch only updated assignments
        const updatedParams = { ...params, updated_after: lastUpdatedAt };
        const updatedResponse = await getAssignments(apiToken, updatedParams);
        const allUpdated = await fetchAllPages(updatedResponse, apiToken);

        if (allUpdated.data.length > 0) {
          // Merge with cached data
          const cached = await getFromCache<CollectionResponse<Assignment>>(
            cacheKey,
            undefined,
            { ignoreTTL: true }
          );
          if (cached?.data) {
            // Create a map of existing assignments for quick lookup
            const existingMap = new Map(cached.data.data.map((a) => [a.id, a]));

            // Update/add new assignments
            allUpdated.data.forEach((assignment) => {
              existingMap.set(assignment.id, assignment);
            });

            // Convert back to array and save
            const mergedData = {
              ...cached.data,
              data: Array.from(existingMap.values()),
              data_updated_at: allUpdated.data_updated_at,
            };

            await saveToCache(cacheKey, mergedData, allUpdated.data_updated_at);
            await saveAssignmentsCollectionForOfflineUse(mergedData);
            await saveDataUpdatedAt('assignments', allUpdated.data_updated_at);

            timer.end({
              result: 'incremental_update',
              updatedCount: allUpdated.data.length,
              totalCount: mergedData.data.length,
            });
            return mergedData;
          }
        } else {
          // Return cached data
          const cached = await getFromCache<CollectionResponse<Assignment>>(
            cacheKey,
            undefined,
            { ignoreTTL: true }
          );
          if (cached?.data) {
            timer.end({ result: 'no_updates' });
            return cached.data;
          }
        }
      }

      // First time or force refresh - fetch all
      const response = await getAssignments(apiToken, params);
      const allAssignments = await fetchAllPages(response, apiToken);

      // Save to cache
      await saveToCache(cacheKey, allAssignments, allAssignments.data_updated_at);
      await saveAssignmentsCollectionForOfflineUse(allAssignments);
      await saveDataUpdatedAt('assignments', allAssignments.data_updated_at);

      timer.end({ result: 'full_fetch', count: allAssignments.data.length });
      return allAssignments;
    } catch (error) {
      // Fallback to cache on error
      const cached = await getFromCache<CollectionResponse<Assignment>>(
        cacheKey,
        undefined,
        { ignoreTTL: true }
      );
      if (cached?.data) {
        timer.end({ result: 'cache_fallback' });
        return cached.data;
      }

      const permanentAssignments = await getPermanentAssignmentsCollection();
      if (permanentAssignments) {
        timer.end({ result: 'permanent_cache_fallback' });
        return permanentAssignments;
      }

      timer.end(
        { error: error instanceof Error ? error.message : String(error) },
        false
      );
      throw error;
    }
  })();

  pendingOptimizedAssignmentsRequests.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    const pending = pendingOptimizedAssignmentsRequests.get(requestKey);
    if (pending === requestPromise) {
      pendingOptimizedAssignmentsRequests.delete(requestKey);
    }
  }
}

/**
 * Fetches ALL assignments for the given query (handles pagination) with SWR caching.
 * Falls back to cached data when offline or API fails, enabling offline sessions.
 */
export async function getAllAssignmentsCached(
  apiToken: string,
  params: {
    available_after?: string;
    available_before?: string;
    burned?: boolean;
    hidden?: boolean;
    ids?: number[];
    immediately_available_for_lessons?: boolean;
    immediately_available_for_review?: boolean;
    in_review?: boolean;
    levels?: number[];
    srs_stages?: number[];
    started?: boolean;
    subject_ids?: number[];
    subject_types?: ("radical" | "kanji" | "vocabulary" | "kana_vocabulary")[];
    unlocked?: boolean;
    updated_after?: string;
  } = {}
): Promise<CollectionResponse<Assignment>> {
  const timer = startPerformanceTimer('getAllAssignmentsCached', 'api.ts');
  try {
    const url = new URL(`${API_BASE_URL}/assignments`);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) url.searchParams.append(key, value.join(","));
        else url.searchParams.append(key, String(value));
      }
    });

    const cacheKey = `assignments_full_${url.toString().replace(/[^a-zA-Z0-9]/g, "_")}`;
    const pendingKey = `pending_${cacheKey}`;
    const pendingRequest = pendingRequests.get(pendingKey) as
      | Promise<CollectionResponse<Assignment>>
      | undefined;
    if (pendingRequest) {
      timer.end({ source: 'deduped_inflight' });
      return await pendingRequest;
    }

    const cachedEntry = await getFromCache<CollectionResponse<Assignment>>(cacheKey, undefined, { ignoreTTL: true });
    const hasCached = Boolean(cachedEntry && cachedEntry.data);

    // Fast path: if we already have cached data, return it immediately for offline/instant UX
    if (hasCached) {
      timer.end({ source: 'cache_fast', count: cachedEntry!.data.data?.length });
      // Optionally refresh in background without blocking (best-effort)
      (async () => {
        try {
          const headersBg: Record<string, string> = {
            Authorization: `Bearer ${apiToken}`,
            "Wanikani-Revision": API_REVISION,
          };
          const etagBg = await getETag(url.toString());
          const lastModBg = await getLastModified(url.toString());
          if (etagBg) headersBg["If-None-Match"] = etagBg;
          else if (lastModBg) headersBg["If-Modified-Since"] = lastModBg;
          const resp = await fetchWaniKaniApi(url.toString(), { method: "GET", headers: headersBg });
          if (resp.ok && resp.status !== 304) {
            const first = await resp.json();
            const complete = await fetchAllPages(first, apiToken);
            await saveToCache(cacheKey, complete, complete.data_updated_at);
          }
        } catch { /* ignore background errors */ }
      })();
      return cachedEntry!.data;
    }

    const networkRequestPromise = (async (): Promise<CollectionResponse<Assignment>> => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${apiToken}`,
        "Wanikani-Revision": API_REVISION,
      };

      try {
        const response = await fetchWaniKaniApi(url.toString(), { method: "GET", headers });

        if (response.status === 304 && hasCached) {
          await saveToCache(cacheKey, cachedEntry!.data, cachedEntry!.dataUpdatedAt);
          timer.end({ source: 'cache_304', count: cachedEntry!.data.data?.length, httpStatus: 304 });
          return cachedEntry!.data;
        }

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Could not read error response');
          console.error(`API error ${response.status} for assignments (full): ${errorText}`);
          if (hasCached) {
            timer.end({ source: 'cache_fallback_http', httpStatus: response.status });
            return cachedEntry!.data;
          }
          throw new Error(`API error: ${response.status}`);
        }

        const newEtag = getResponseHeader(response, "ETag");
        const newLast = getResponseHeader(response, "Last-Modified");
        if (newEtag) await saveETag(url.toString(), newEtag);
        if (newLast) await saveLastModified(url.toString(), newLast);

        const firstPage: CollectionResponse<Assignment> = await response.json();
        const complete = await fetchAllPages(firstPage, apiToken);
        await saveToCache(cacheKey, complete, complete.data_updated_at);
        timer.end({ source: 'api', totalItems: complete.data.length });
        return complete;
      } catch (networkError) {
        if (hasCached) {
          timer.end({ source: 'cache_fallback_network' });
          return cachedEntry!.data;
        }
        throw networkError;
      }
    })();

    pendingRequests.set(pendingKey, networkRequestPromise);

    try {
      return await networkRequestPromise;
    } finally {
      const pending = pendingRequests.get(pendingKey);
      if (pending === networkRequestPromise) {
        pendingRequests.delete(pendingKey);
      }
    }
  } catch (error) {
    timer.end({ error: error instanceof Error ? error.message : String(error) }, false);
    throw error;
  }
}

/**
 * Fetches all pages of a paginated WaniKani API response
 * 
 * The WaniKani API returns paginated responses with a maximum of 500 items per page.
 * This helper function follows pagination links to retrieve all pages of data,
 * combining them into a single response object.
 * 
 * @param initialResponse - The initial API response containing pagination information
 * @param apiToken - WaniKani API v2 token for authentication (needed for subsequent page requests)
 * @returns A promise that resolves to a response object with all items from all pages
 *          in the `data` array
 * 
 * @example
 * // Get all assignments with pagination handling
 * const initialResponse = await getAssignments(apiToken, {});
 * const allAssignments = await fetchAllPages(initialResponse, apiToken);
 * console.log(`Total items: ${allAssignments.data.length}`);
 */
export async function fetchAllPages<T>(
  initialResponse: CollectionResponse<T>,
  apiToken: string,
  onProgress?: (progress: number) => void
): Promise<CollectionResponse<T>> {
  const timer = startPerformanceTimer('fetchAllPages pagination', 'api.ts');

  // Retry configuration
  const MAX_PAGE_RETRIES = 3;
  const INITIAL_RETRY_DELAY = 500; // ms

  try {
    let nextUrl = initialResponse.pages.next_url;
    const allItems = [...initialResponse.data];
    let pageCount = 1;
    const expectedTotal = initialResponse.total_count;
    const perPage = Math.max(1, initialResponse.pages.per_page || initialResponse.data.length || 1);
    const estimatedTotalPages = expectedTotal && expectedTotal > 0
      ? Math.max(1, Math.ceil(expectedTotal / perPage))
      : (nextUrl ? 10 : 1);
    const emitPaginationProgress = (loadedPages: number) => {
      if (!onProgress) return;
      const normalized = Math.min(1, loadedPages / estimatedTotalPages);
      onProgress(Math.round(normalized * 100));
    };

    // First page is already loaded in the initial response.
    emitPaginationProgress(pageCount);

    // Keep fetching pages until there are no more
    while (nextUrl) {
      const currentUrl = nextUrl; // Capture URL for this iteration (helps TypeScript narrowing)
      const pageStartTime = Date.now();
      let pageSuccess = false;
      let lastError: Error | null = null;

      // Retry loop for each page
      for (let attempt = 1; attempt <= MAX_PAGE_RETRIES && !pageSuccess; attempt++) {
        try {
          if (attempt > 1) {
            const retryDelay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 2);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
          }

          const response = await fetchWaniKaniApi(currentUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiToken}`,
              "Wanikani-Revision": API_REVISION,
            },
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => "Could not read error");

            // If rate limited, wait for reset time
            if (response.status === 429) {
              const resetTime = getResponseHeader(response, 'RateLimit-Reset');
              if (resetTime) {
                const waitTime = Math.max(0, parseInt(resetTime) * 1000 - Date.now()) + 1000;
                await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 60000)));
              }
            }

            lastError = new Error(`HTTP ${response.status}: ${errorText}`);
            continue; // Retry
          }

          // Extract rate limit headers
          const rateLimitRemaining = getResponseHeader(response, 'RateLimit-Remaining');
          const rateLimitLimit = getResponseHeader(response, 'RateLimit-Limit');
          const rateLimitReset = getResponseHeader(response, 'RateLimit-Reset');
          const paginationEndpoint = buildPaginationEndpointLabel(
            currentUrl,
            pageCount + 1
          );

          apiDebugger.logCall({
            endpoint: paginationEndpoint,
            cacheHit: false,
            httpStatus: response.status,
            duration: Date.now() - pageStartTime,
            rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
            rateLimitLimit: rateLimitLimit ? parseInt(rateLimitLimit) : undefined,
            rateLimitReset: rateLimitReset ? parseInt(rateLimitReset) : undefined,
          });

          const pageData: CollectionResponse<T> = await response.json();
          allItems.push(...pageData.data);
          nextUrl = pageData.pages.next_url;
          pageCount++;
          pageSuccess = true;
          emitPaginationProgress(pageCount);

          // Add a small delay to avoid hitting rate limits
          if (nextUrl) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          const paginationEndpoint = buildPaginationEndpointLabel(
            currentUrl,
            pageCount + 1
          );

          apiDebugger.logCall({
            endpoint: paginationEndpoint,
            cacheHit: false,
            duration: Date.now() - pageStartTime,
            error: lastError.message,
          });
        }
      }

      // If all retries failed for this page, throw an error instead of returning partial data
      if (!pageSuccess) {
        const errorMsg = `Pagination failed at page ${pageCount + 1} after ${MAX_PAGE_RETRIES} attempts: ${lastError?.message}`;
        timer.end({ error: errorMsg, totalPages: pageCount, totalItems: allItems.length }, false);
        throw new Error(errorMsg);
      }
    }

    const result = {
      ...initialResponse,
      data: allItems,
      total_count: expectedTotal || allItems.length, // Preserve original total_count
      pages: {
        ...initialResponse.pages,
        next_url: null, // We've fetched everything, so no more pages
      },
    };

    if (onProgress) {
      onProgress(100);
    }

    timer.end({ totalPages: pageCount, totalItems: allItems.length, expectedTotal });
    return result;
  } catch (error) {
    timer.end({ error: error instanceof Error ? error.message : String(error) }, false);
    throw error;
  }
}

export async function getRecentLessonAssignments(
  apiToken: string,
  params: {
    days?: number;
  } = { days: 7 }
): Promise<CollectionResponse<Assignment>> {
  // Get all assignments in apprentice stages that haven't been burned.
  const initialResponse = await getAssignments(apiToken, {
    srs_stages: [1, 2, 3, 4], // Apprentice stages
    burned: false,
  });

  // Handle pagination to get all pages
  const completeResponse = await fetchAllPages(initialResponse, apiToken);

  // Filter to only include assignments that haven't been passed yet.
  const filteredData = completeResponse.data.filter((assignment) => {
    // If the assignment has a passed_at date, it's been passed
    return !assignment.data.passed_at;
  });

  return {
    ...completeResponse,
    data: filteredData,
    total_count: filteredData.length,
  };
}

// Offline-capable variant using cached assignments; falls back to cache on network failure
export async function getRecentLessonAssignmentsCached(
  apiToken: string
): Promise<CollectionResponse<Assignment>> {
  // Apprentice stages, not burned; keep same semantics as getRecentLessonAssignments, then filter out passed
  const all = await getAllAssignmentsCached(apiToken, {
    srs_stages: [1, 2, 3, 4],
    burned: false,
  });

  const filtered = all.data.filter((assignment) => !assignment.data.passed_at);
  return {
    ...all,
    data: filtered,
    total_count: filtered.length,
  };
}

// Enhanced getSubjects with full caching and conditional request support
export async function getSubjects(
  apiToken: string,
  params: {
    ids?: number[];
    types?: ("radical" | "kanji" | "vocabulary" | "kana_vocabulary")[];
    slugs?: string[];
    levels?: number[];
    hidden?: boolean;
    updated_after?: string;
  } = {},
  options?: {
    skipCollectionCache?: boolean;
    onPaginationProgress?: (progress: number) => void;
  }
): Promise<CollectionResponse<Subject>> {
  const timer = startPerformanceTimer('getSubjects with caching', 'api.ts');
  const startTime = Date.now();
  
  // Canonicalise array params so the same query string is always built
  if (params.ids) params.ids = [...params.ids].sort((a, b) => a - b);
  if (params.levels) params.levels = [...params.levels].sort((a, b) => a - b);
  if (params.slugs) params.slugs = [...params.slugs].sort();
  if (params.types) params.types = [...params.types].sort();

  // Optimisation: Check the subject-by-id cache for specific IDs first. This is
  // also the offline path for lesson sessions, even when collection caching is skipped.
  if (params.ids && params.ids.length > 0 && Object.keys(params).length === 1) {
    const memoryResults = await Promise.all(params.ids.map(id => getSubjectById(id)));
    const allFound = memoryResults.every(s => !!s);

    if (allFound) {
      apiDebugger.logCall({
        endpoint: '/subjects',
        params: { ids: params.ids.length },
        cacheHit: true,
        duration: Date.now() - startTime,
      });
      
      timer.end({ source: 'memory_cache', count: params.ids.length, cacheHit: true });
      
      const mockUrl = `${API_BASE_URL}/subjects?ids=${params.ids.join(',')}`;

      return {
        object: "collection",
        url: mockUrl,
        data: memoryResults as Subject[],
        total_count: params.ids.length,
        data_updated_at: new Date().toISOString(),
        pages: { per_page: 500, next_url: null, previous_url: null }
      };
    }
  }

  const url = new URL(`${API_BASE_URL}/subjects`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      if (Array.isArray(value)) url.searchParams.append(key, value.join(","));
      else url.searchParams.append(key, String(value));
    }
  });

  const cacheKey = `subjects_${url.toString().replace(/[^a-zA-Z0-9]/g, "_")}`;
  const cachedEntry = await getFromCache<CollectionResponse<Subject>>(
    cacheKey,
    undefined,
    { ignoreTTL: true }
  );
  const hasCached = Boolean(cachedEntry && cachedEntry.data);
  const isExpired = hasCached
    ? Date.now() - cachedEntry!.timestamp > CACHE_TTL
    : false;
  
  // Check if cached data is complete (no next_url means all pages were fetched)
  const isCachedDataComplete = hasCached && 
    cachedEntry!.data.pages.next_url === null;
  
  const shouldFetch = !hasCached || isExpired || !isCachedDataComplete;

  if (!shouldFetch && isCachedDataComplete) {
    // Serve complete cached data; no network request needed.
    apiDebugger.logCall({
      endpoint: '/subjects',
      params,
      cacheHit: true,
      duration: Date.now() - startTime,
    });
    
    timer.end({ 
      source: 'cache', 
      count: cachedEntry!.data.data.length,
      cacheHit: true 
    });
    return cachedEntry!.data;
  }

  const pendingKey = `pending_subjects_network_${apiToken}_${cacheKey}_${options?.skipCollectionCache ? "skip" : "cache"}`;
  const allowInflightDedupe = !options?.onPaginationProgress;
  if (allowInflightDedupe) {
    const pendingRequest = pendingRequests.get(pendingKey) as
      | Promise<CollectionResponse<Subject>>
      | undefined;
    if (pendingRequest) {
      timer.end({ source: 'deduped_inflight' });
      return await pendingRequest;
    }
  }

  const networkRequestPromise = (async (): Promise<CollectionResponse<Subject>> => {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiToken}`,
      "Wanikani-Revision": API_REVISION,
    };
    if (hasCached) {
      const etag = await getETag(url.toString());
      const lastMod = await getLastModified(url.toString());
      if (etag) headers["If-None-Match"] = etag;
      else if (lastMod) headers["If-Modified-Since"] = lastMod;
    }

    let response = await fetchWaniKaniApi(url.toString(), { method: "GET", headers });

    // 304 — our cached copy is still valid; bump timestamp so TTL restarts
    if (response.status === 304 && hasCached) {
      // But only return it if it's complete - otherwise we need to fetch remaining pages
      if (isCachedDataComplete) {
        if (!options?.skipCollectionCache) {
          await saveToCache(
            cacheKey,
            cachedEntry!.data,
            cachedEntry!.data.data_updated_at
          );
        }

        // Extract rate limit headers
        const rateLimitRemaining = getResponseHeader(response, 'RateLimit-Remaining');
        const rateLimitLimit = getResponseHeader(response, 'RateLimit-Limit');
        const rateLimitReset = getResponseHeader(response, 'RateLimit-Reset');
        
        apiDebugger.logCall({
          endpoint: '/subjects',
          params,
          cacheHit: true,
          httpStatus: 304,
          duration: Date.now() - startTime,
          rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
          rateLimitLimit: rateLimitLimit ? parseInt(rateLimitLimit) : undefined,
          rateLimitReset: rateLimitReset ? parseInt(rateLimitReset) : undefined,
        });
        
        timer.end({ 
          source: 'cache_304', 
          count: cachedEntry!.data.data.length,
          httpStatus: 304 
        });
        return cachedEntry!.data;
      } else {
        // Make a fresh request without conditional headers to get complete data
        response = await fetchWaniKaniApi(url.toString(), {
          method: "GET", 
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Wanikani-Revision": API_REVISION,
          }
        });
        
        if (!response.ok) {
          const { errorBody, detailedMessage } = await parseApiErrorBody(response);
          console.error(
            `API error ${response.status} for subjects (fresh request):`,
            errorBody
          );
          throw new ApiError(
            response.status,
            `Failed to fetch subjects: ${response.status} - ${detailedMessage}`,
            errorBody
          );
        }

        // Update validators for future conditional requests
        const newEtag = getResponseHeader(response, "ETag");
        const newLast = getResponseHeader(response, "Last-Modified");
        if (newEtag) await saveETag(url.toString(), newEtag);
        if (newLast) await saveLastModified(url.toString(), newLast);

        // Fall through to the normal processing logic
      }
    }

    if (!response.ok) {
      const { errorBody, detailedMessage } = await parseApiErrorBody(response);
      console.error(`API error ${response.status} for subjects:`, errorBody);
      throw new ApiError(
        response.status,
        `Failed to fetch subjects: ${response.status} - ${detailedMessage}`,
        errorBody
      );
    }

    const data: CollectionResponse<Subject> = await response.json();

    // CRITICAL FIX: Fetch ALL pages before caching
    let completeData = data;
    if (data.pages.next_url) {
      completeData = await fetchAllPages(
        data,
        apiToken,
        options?.onPaginationProgress
      );
    } else if (options?.onPaginationProgress) {
      options.onPaginationProgress(100);
    }

    // Cache the COMPLETE collection response (unless explicitly skipped)
    if (!options?.skipCollectionCache) {
      await saveToCache(cacheKey, completeData, completeData.data_updated_at);
    }

    // Log the successful API call (after all pagination)
    const finalResponse = response || await fetchWaniKaniApi(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Wanikani-Revision": API_REVISION,
      },
    });
    
    const rateLimitRemaining = getResponseHeader(finalResponse, 'RateLimit-Remaining');
    const rateLimitLimit = getResponseHeader(finalResponse, 'RateLimit-Limit');
    const rateLimitReset = getResponseHeader(finalResponse, 'RateLimit-Reset');
    
    apiDebugger.logCall({
      endpoint: '/subjects',
      params,
      cacheHit: false,
      httpStatus: finalResponse.status,
      duration: Date.now() - startTime,
      rateLimitRemaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : undefined,
      rateLimitLimit: rateLimitLimit ? parseInt(rateLimitLimit) : undefined,
      rateLimitReset: rateLimitReset ? parseInt(rateLimitReset) : undefined,
    });

    timer.end({ 
      source: 'api', 
      count: completeData.data.length,
      totalPages: completeData.pages.next_url ? 'multiple' : 1,
      cacheHit: false 
    });
    return completeData;
  })();

  if (!allowInflightDedupe) {
    return await networkRequestPromise;
  }

  pendingRequests.set(pendingKey, networkRequestPromise);
  try {
    return await networkRequestPromise;
  } finally {
    const pending = pendingRequests.get(pendingKey);
    if (pending === networkRequestPromise) {
      pendingRequests.delete(pendingKey);
    }
  }
}


export async function getLevelProgressions(
  apiToken: string,
  params: {
    ids?: number[];
    updated_after?: string;
  } = {}
): Promise<CollectionResponse<LevelProgression>> {
  const url = new URL(`${API_BASE_URL}/level_progressions`);

  // Format parameters according to WaniKani API requirements
  // Arrays must be comma-delimited strings, not multiple parameters with []
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        // Join array values with commas - this is what WaniKani API expects
        url.searchParams.append(key, value.join(","));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  });

  const pendingKey = `pending_level_progressions_${apiToken}_${url.toString()}`;
  const pendingRequest = pendingRequests.get(pendingKey) as
    | Promise<CollectionResponse<LevelProgression>>
    | undefined;
  if (pendingRequest) {
    return await pendingRequest;
  }

  const networkRequestPromise = (async (): Promise<
    CollectionResponse<LevelProgression>
  > => {
    const response = await fetchWaniKaniApi(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Wanikani-Revision": API_REVISION,
      },
    });

    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => "Could not read error response");
      console.error(
        `API error ${response.status} for level_progressions: ${errorText}`
      );
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  })();

  pendingRequests.set(pendingKey, networkRequestPromise);
  try {
    return await networkRequestPromise;
  } finally {
    const pending = pendingRequests.get(pendingKey);
    if (pending === networkRequestPromise) {
      pendingRequests.delete(pendingKey);
    }
  }
}

export async function getResets(
  apiToken: string,
  params: {
    ids?: number[];
    updated_after?: string;
  } = {}
): Promise<CollectionResponse<Reset>> {
  const url = new URL(`${API_BASE_URL}/resets`);

  // Format parameters according to WaniKani API requirements
  // Arrays must be comma-delimited strings, not multiple parameters with []
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        url.searchParams.append(key, value.join(","));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  });

  const pendingKey = `pending_resets_${apiToken}_${url.toString()}`;
  const pendingRequest = pendingRequests.get(pendingKey) as
    | Promise<CollectionResponse<Reset>>
    | undefined;
  if (pendingRequest) {
    return await pendingRequest;
  }

  const networkRequestPromise = (async (): Promise<CollectionResponse<Reset>> => {
    const response = await fetchWaniKaniApi(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Wanikani-Revision": API_REVISION,
      },
    });

    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => "Could not read error response");
      console.error(`API error ${response.status} for resets: ${errorText}`);
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  })();

  pendingRequests.set(pendingKey, networkRequestPromise);
  try {
    return await networkRequestPromise;
  } finally {
    const pending = pendingRequests.get(pendingKey);
    if (pending === networkRequestPromise) {
      pendingRequests.delete(pendingKey);
    }
  }
}

export async function validateApiToken(apiToken: string): Promise<boolean> {
  try {
    await getUserData(apiToken);
    return true;
  } catch (error) {
    return false;
  }
}

export async function saveApiToken(apiToken: string): Promise<void> {
  // Store token securely
  await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, apiToken);
  global.apiToken = apiToken;
  
  // Store in native module for background fetch on iOS
  if (
    Platform.OS === 'ios' &&
    !isIOSOnMac() &&
    WaniKaniBackgroundFetch &&
    typeof WaniKaniBackgroundFetch.storeApiToken === 'function'
  ) {
    try {
      WaniKaniBackgroundFetch.storeApiToken(apiToken);
    } catch {
      // Best effort only; token is already stored in SecureStore.
    }
  }
}

export async function getStoredApiToken(): Promise<string | null> {
  // On iOS, SecureStore/Keychain can transiently fail with
  // "User interaction is not allowed" shortly after process start or device unlock.
  // Use an exponential backoff to give Keychain a chance to become available
  // before declaring the user unauthenticated.
  const maxRetries = 8; // ~6.3s total wait with exponential backoff below
  let retryDelayMs = 250; // initial delay

  const isTransientKeychainError = (message: string) =>
    message.includes('User interaction is not allowed') ||
    message.includes('errSecInteractionNotAllowed') ||
    message.includes('User canceled') ||
    message.includes('User cancelled');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
      if (token) {
        global.apiToken = token;
      }
      return token;
    } catch (error: any) {
      const errorMessage = error?.message || String(error);

      if (isTransientKeychainError(errorMessage)) {
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
          retryDelayMs = Math.min(retryDelayMs * 2, 2000); // cap backoff growth
          continue;
        } else {
          return null;
        }
      }

      // For other errors, don't retry and return null immediately
      return null;
    }
  }

  return null;
}

export async function clearApiToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
    global.apiToken = null;
    
    // Clear from native module on iOS
    if (
      Platform.OS === 'ios' &&
      !isIOSOnMac() &&
      WaniKaniBackgroundFetch &&
      typeof WaniKaniBackgroundFetch.storeApiToken === 'function'
    ) {
      try {
        WaniKaniBackgroundFetch.storeApiToken('');
      } catch {
        // Best effort only.
      }
    }
  } catch {
    // Silent failure for token clearing
  }
}

/**
 * Attempts to recover authentication when token retrieval fails
 * This function tries alternative approaches to restore authentication state
 */
export async function recoverAuthentication(): Promise<string | null> {
  // Check if we have a global token as fallback
  if (global.apiToken) {
    try {
      const isValid = await validateApiToken(global.apiToken);
      if (isValid) {
        await saveApiToken(global.apiToken);
        return global.apiToken;
      } else {
        global.apiToken = null;
      }
    } catch {
      global.apiToken = null;
    }
  }

  // If no recovery is possible, user will need to re-authenticate
  return null;
}

/**
 * Fetches review forecast data for the next 7 days from the WaniKani API
 * 
 * This function aggregates data from multiple API endpoints to create a comprehensive
 * review forecast that shows how many reviews will be available at each hour for the next
 * 7 days. It handles pagination to ensure all assignments are considered.
 * 
 * The function:
 * 1. Fetches all assignments (with pagination)
 * 2. Fetches all immediately available reviews (with pagination)
 * 3. Extracts subject IDs from both sets
 * 4. Organizes reviews by hour, grouping them appropriately
 * 
 * @param apiToken - WaniKani API v2 token for authentication
 * @returns A promise that resolves to an object containing:
 *   - reviews: Array of hourly review groups, each containing:
 *     - available_at: ISO timestamp representing the hour
 *     - subject_ids: Array of subject IDs available at that hour
 * 
 * @throws Will throw an error if API requests fail or if data processing encounters an error
 * 
 * @example
 * // Get review forecast for the next 7 days
 * const forecast = await getReviewForecast(apiToken);
 * console.log(`Total review groups: ${forecast.reviews.length}`);
 * // Use the forecast data to display reviews by hour/day
 */
export const getReviewForecast = async (apiToken: string): Promise<{ reviews: { available_at: string, subject_ids: number[] }[] }> => {
  // Calculate dates for the next 7 days
  const now = new Date();
  const sevenDaysLater = new Date();
  sevenDaysLater.setDate(now.getDate() + 7);

  try {
    // Get all assignments regardless of availability status
    const initialAssignmentsResponse = await getAssignments(apiToken, {
      // Don't filter by available_after/before - get everything and filter in JS
      // but exclude hidden assignments since they are not reviewable.
      hidden: false,
    });

    // Handle pagination to get all pages
    const assignments = await fetchAllPages(initialAssignmentsResponse, apiToken);

    // Find available reviews with a separate call to ensure we get current reviews
    const initialAvailableReviewsResponse = await getAssignments(apiToken, {
      immediately_available_for_review: true,
      hidden: false,
    });

    // Handle pagination for available reviews as well
    const availableReviews = await fetchAllPages(initialAvailableReviewsResponse, apiToken);

    // Get subjects
    let allSubjectIds = new Set<number>();

    // Add IDs from current reviews
    availableReviews.data.forEach((a: any) => {
      allSubjectIds.add(a.data.subject_id);
    });
    
    // Add IDs from upcoming reviews
    assignments.data.forEach((a: any) => {
      if (a.data.available_at) {
        const availableDate = new Date(a.data.available_at);
        // Only include reviews scheduled in the next 7 days
        if (availableDate >= now && availableDate <= sevenDaysLater) {
          allSubjectIds.add(a.data.subject_id);
        }
      }
    });
    
    const subjectIds = Array.from(allSubjectIds);

    // Get subjects in batches
    let allSubjects: any[] = [];
    const batchSize = 100;
    
    for (let i = 0; i < subjectIds.length; i += batchSize) {
      const batchIds = subjectIds.slice(i, i + batchSize);
      if (batchIds.length === 0) continue;
      
      const subjectsBatch = await getSubjects(apiToken, { ids: batchIds });
      allSubjects = allSubjects.concat(subjectsBatch.data);
      
      // Add a small delay to avoid rate limiting
      if (i + batchSize < subjectIds.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Combine current and upcoming reviews
    const reviews: any[] = [];
    
    // Add immediately available reviews first
    availableReviews.data.forEach((a: any) => {
      reviews.push({
        available_at: new Date().toISOString(), // Set to now
        subject_ids: [a.data.subject_id]
      });
    });
    
    // Add upcoming reviews
    assignments.data.forEach((a: any) => {
      if (a.data.available_at) {
        const availableDate = new Date(a.data.available_at);
        // Only include reviews scheduled in the future within the next 7 days
        if (availableDate > now && availableDate <= sevenDaysLater) {
          reviews.push({
            available_at: a.data.available_at,
            subject_ids: [a.data.subject_id]
          });
        }
      }
    });

    // Group reviews by the same hour
    const groupedReviews: any[] = [];
    const reviewsByTimeKey: Record<string, any> = {};
    
    reviews.forEach((review: any) => {
      const date = new Date(review.available_at);
      date.setMinutes(0, 0, 0); // Round to hour
      date.setSeconds(0, 0); // Also zero out seconds and milliseconds for consistent grouping
      const timeKey = date.toISOString();
      
      if (!reviewsByTimeKey[timeKey]) {
        reviewsByTimeKey[timeKey] = {
          available_at: timeKey,
          subject_ids: []
        };
        groupedReviews.push(reviewsByTimeKey[timeKey]);
      }
      
      // Add subject IDs, avoiding duplicates
      review.subject_ids.forEach((id: number) => {
        if (!reviewsByTimeKey[timeKey].subject_ids.includes(id)) {
          reviewsByTimeKey[timeKey].subject_ids.push(id);
        }
      });
    });

    return { reviews: groupedReviews };
  } catch (reviewError) {
    throw reviewError;
  }
};

// Get a specific subject
export async function getSubject(apiToken: string, id: number): Promise<any> {
  try {
    // Try to get from cache first
    return await getCachedSubject(
      apiToken,
      id,
      async (token: string, subjectId: number) => {
        // This is the fallback function if caching fails
        const response = await fetchWaniKaniApi(`${API_BASE_URL}/subjects/${subjectId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Wanikani-Revision": API_REVISION,
          },
        });

        if (!response.ok) {
          const errorText = await response
            .text()
            .catch(() => "Could not read error response");
          console.error(
            `API error ${response.status} for subject ${subjectId}:`,
            errorText
          );
          throw new Error(`API error: ${response.status}`);
        }

        return response.json();
      }
    );
  } catch (error) {
    console.error(`Failed to get subject ${id}:`, error);

    // Fallback to original implementation
    const response = await fetchWaniKaniApi(`${API_BASE_URL}/subjects/${id}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Wanikani-Revision": API_REVISION,
      },
    });

    if (!response.ok) {
      const errorText = await response
        .text()
        .catch(() => "Could not read error response");
      console.error(
        `API error ${response.status} for subject ${id}:`,
        errorText
      );
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }
}

// Get study materials with caching
export async function getStudyMaterials(
  apiToken: string,
  params: {
    ids?: number[];
    subject_ids?: number[];
    updated_after?: string;
  } = {},
  options?: { skipCache?: boolean }
): Promise<any> {
  const url = new URL(`${API_BASE_URL}/study_materials`);
  Object.entries(params).forEach(
    ([k, v]) =>
      v !== undefined &&
      url.searchParams.append(k, Array.isArray(v) ? v.join(",") : String(v))
  );

  const cacheKey = `study_materials_${url
    .toString()
    .replace(/[^a-zA-Z0-9]/g, "_")}`;

  const cachedEntry = options?.skipCache ? null : await getFromCache<any>(cacheKey, undefined, {
    ignoreTTL: true,
  });
  const hasCached = Boolean(cachedEntry && cachedEntry.data);
  const isExpired = hasCached
    ? Date.now() - cachedEntry!.timestamp > CACHE_TTL
    : false;
  if (hasCached && !isExpired) return cachedEntry!.data;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
    "Wanikani-Revision": API_REVISION,
  };
  if (hasCached) {
    const etag = await getETag(url.toString());
    const lastMod = await getLastModified(url.toString());
    if (etag) headers["If-None-Match"] = etag;
    else if (lastMod) headers["If-Modified-Since"] = lastMod;
  }

  const response = await fetchWaniKaniApi(url.toString(), { method: "GET", headers });

  if (response.status === 304 && hasCached) {
    await saveToCache(cacheKey, cachedEntry!.data, cachedEntry!.dataUpdatedAt);
    return cachedEntry!.data;
  }

  if (!response.ok) {
    const txt = await response
      .text()
      .catch(() => "Could not read error response");
    console.error(`API error ${response.status} for study materials:`, txt);
    throw new Error(`API error: ${response.status}`);
  }

  const newEtag = getResponseHeader(response, "ETag");
  const newLast = getResponseHeader(response, "Last-Modified");
  if (newEtag) await saveETag(url.toString(), newEtag);
  if (newLast) await saveLastModified(url.toString(), newLast);

  const data = await response.json();
  await saveToCache(cacheKey, data, data.data_updated_at);
  return data;
}

// Get SRS systems with caching
export async function getSpacedRepetitionSystems(
  apiToken: string,
  params: {
    ids?: number[];
    updated_after?: string;
  } = {}
): Promise<any> {
  const url = new URL(`${API_BASE_URL}/spaced_repetition_systems`);
  Object.entries(params).forEach(
    ([k, v]) =>
      v !== undefined &&
      url.searchParams.append(k, Array.isArray(v) ? v.join(",") : String(v))
  );

  const cacheKey = `srs_systems_${url
    .toString()
    .replace(/[^a-zA-Z0-9]/g, "_")}`;
  const cachedEntry = await getFromCache<any>(cacheKey, undefined, {
    ignoreTTL: true,
  });
  const hasCached = Boolean(cachedEntry && cachedEntry.data);
  const isExpired = hasCached
    ? Date.now() - cachedEntry!.timestamp > CACHE_TTL
    : false;
  if (hasCached && !isExpired) return cachedEntry!.data;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
    "Wanikani-Revision": API_REVISION,
  };
  if (hasCached) {
    const etag = await getETag(url.toString());
    const lastMod = await getLastModified(url.toString());
    if (etag) headers["If-None-Match"] = etag;
    else if (lastMod) headers["If-Modified-Since"] = lastMod;
  }

  const response = await fetchWaniKaniApi(url.toString(), { method: "GET", headers });

  if (response.status === 304 && hasCached) {
    await saveToCache(cacheKey, cachedEntry!.data, cachedEntry!.dataUpdatedAt);
    return cachedEntry!.data;
  }

  if (!response.ok) {
    const txt = await response
      .text()
      .catch(() => "Could not read error response");
    console.error(`API error ${response.status} for SRS systems:`, txt);
    throw new Error(`API error: ${response.status}`);
  }

  const newEtag = getResponseHeader(response, "ETag");
  const newLast = getResponseHeader(response, "Last-Modified");
  if (newEtag) await saveETag(url.toString(), newEtag);
  if (newLast) await saveLastModified(url.toString(), newLast);

  const data = await response.json();
  await saveToCache(cacheKey, data, data.data_updated_at);
  return data;
}

// Create a new study material
export async function createStudyMaterial(
  apiToken: string,
  params: {
    subject_id: number;
    meaning_note?: string;
    reading_note?: string;
    meaning_synonyms?: string[];
  }
): Promise<any> {
  const url = new URL(`${API_BASE_URL}/study_materials`);

  const response = await fetchWaniKaniApi(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Wanikani-Revision": API_REVISION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ study_material: params }),
  });

  if (!response.ok) {
    const errorText = await response
      .text()
      .catch(() => "Could not read error response");
    console.error(
      `API error ${response.status} for creating study material:`,
      errorText
    );
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Update an existing study material
export async function updateStudyMaterial(
  apiToken: string,
  id: number,
  params: {
    meaning_note?: string;
    reading_note?: string;
    meaning_synonyms?: string[];
  }
): Promise<any> {
  const url = new URL(`${API_BASE_URL}/study_materials/${id}`);

  const response = await fetchWaniKaniApi(url.toString(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Wanikani-Revision": API_REVISION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ study_material: params }),
  });

  if (!response.ok) {
    const errorText = await response
      .text()
      .catch(() => "Could not read error response");
    console.error(
      `API error ${response.status} for updating study material:`,
      errorText
    );
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Get reviews with pagination support
export async function getReviews(
  apiToken: string,
  params: {
    ids?: number[];
    subject_ids?: number[];
    updated_after?: string;
    assignment_ids?: number[];
  } = {}
): Promise<any> {
  const url = new URL(`${API_BASE_URL}/reviews`);

  // Format parameters according to WaniKani API requirements
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        url.searchParams.append(key, value.join(","));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  });

  const response = await fetchWaniKaniApi(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Wanikani-Revision": API_REVISION,
    },
  });

  if (!response.ok) {
    const errorText = await response
      .text()
      .catch(() => "Could not read error response");
    console.error(`API error ${response.status} for reviews: ${errorText}`);
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Get review statistics with caching
export async function getReviewStatistics(
  apiToken: string,
  params: {
    ids?: number[];
    subject_ids?: number[];
    subject_types?: ("radical" | "kanji" | "vocabulary")[];
    updated_after?: string;
    percentages_greater_than?: number;
    percentages_less_than?: number;
  } = {},
  options: {
    /**
     * Skip the "fresh cache" fast path and revalidate against the API.
     * Useful for incremental updated_after queries that can change frequently.
     */
    bypassFreshCache?: boolean;
  } = {}
): Promise<CollectionResponse<ReviewStatistic>> {
  const url = new URL(`${API_BASE_URL}/review_statistics`);

  // Format parameters according to WaniKani API requirements
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        url.searchParams.append(key, value.join(","));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  });

  const cacheKey = `review_statistics_${url.toString().replace(/[^a-zA-Z0-9]/g, "_")}`;
  const cachedEntry = await getFromCache<CollectionResponse<ReviewStatistic>>(cacheKey, undefined, {
    ignoreTTL: true,
  });
  const hasCached = Boolean(cachedEntry && cachedEntry.data);
  const isExpired = hasCached
    ? Date.now() - cachedEntry!.timestamp > CACHE_TTL
    : false;
  const shouldBypassFreshCache =
    options.bypassFreshCache || Boolean(params.updated_after);
  if (hasCached && !isExpired && !shouldBypassFreshCache) return cachedEntry!.data;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
    "Wanikani-Revision": API_REVISION,
  };
  if (hasCached) {
    const etag = await getETag(url.toString());
    const lastMod = await getLastModified(url.toString());
    if (etag) headers["If-None-Match"] = etag;
    else if (lastMod) headers["If-Modified-Since"] = lastMod;
  }

  const response = await fetchWaniKaniApi(url.toString(), { method: "GET", headers });

  if (response.status === 304 && hasCached) {
    await saveToCache(cacheKey, cachedEntry!.data, cachedEntry!.dataUpdatedAt);
    return cachedEntry!.data;
  }

  if (!response.ok) {
    const { errorBody, detailedMessage } = await parseApiErrorBody(response);
    console.error(
      `API error ${response.status} for review statistics:`,
      errorBody
    );
    throw new ApiError(
      response.status,
      `Failed to fetch review statistics: ${response.status} - ${detailedMessage}`,
      errorBody
    );
  }

  const newEtag = getResponseHeader(response, "ETag");
  const newLast = getResponseHeader(response, "Last-Modified");
  if (newEtag) await saveETag(url.toString(), newEtag);
  if (newLast) await saveLastModified(url.toString(), newLast);

  const data = await response.json();
  await saveToCache(cacheKey, data, data.data_updated_at);
  return data;
}

/**
 * Smart wrapper for review statistics that mirrors the incremental sync strategy:
 * fetch full stats once, then only fetch deltas via updated_after and merge.
 */
export async function getReviewStatisticsOptimized(
  apiToken: string,
  params: {
    ids?: number[];
    subject_ids?: number[];
    subject_types?: ("radical" | "kanji" | "vocabulary")[];
    updated_after?: string;
    percentages_greater_than?: number;
    percentages_less_than?: number;
  } = {},
  options: { forceFullRefresh?: boolean } = {}
): Promise<CollectionResponse<ReviewStatistic>> {
  const timer = startPerformanceTimer("getReviewStatisticsOptimized", "api.ts");
  const requestKey = `review_statistics_optimized:${apiToken}:${stableSerialize(params)}:${stableSerialize(options)}`;
  const pendingRequest = pendingOptimizedReviewStatsRequests.get(requestKey);
  if (pendingRequest) {
    timer.end({ result: "deduped_inflight" });
    return pendingRequest;
  }

  const requestPromise = (async (): Promise<
    CollectionResponse<ReviewStatistic>
  > => {
    // Incremental merge logic is only safe for full-collection reads.
    // For filtered reads, use the standard path.
    const hasFilterParams = Object.entries(params).some(
      ([key, value]) => key !== "updated_after" && value !== undefined
    );
    if (hasFilterParams) {
      try {
        const initial = await getReviewStatistics(apiToken, params);
        const complete = await fetchAllPages(initial, apiToken);
        timer.end({
          result: "filtered_full_fetch",
          count: complete.data.length,
        });
        return complete;
      } catch (error) {
        timer.end(
          { error: error instanceof Error ? error.message : String(error) },
          false
        );
        throw error;
      }
    }

    const cacheKey = "review_statistics_all";

    try {
      const lastUpdatedAt = await getDataUpdatedAt("review_statistics");

      if (lastUpdatedAt && !options.forceFullRefresh) {
        const updatedResponse = await getReviewStatistics(
          apiToken,
          {
            updated_after: lastUpdatedAt,
          },
          {
            // Always revalidate incremental checks to avoid stale empty deltas
            // being cached for up to CACHE_TTL.
            bypassFreshCache: true,
          }
        );
        const allUpdated = await fetchAllPages(updatedResponse, apiToken);

        if (allUpdated.data.length > 0) {
          const cached = await getFromCache<CollectionResponse<ReviewStatistic>>(
            cacheKey,
            undefined,
            { ignoreTTL: true }
          );

          if (cached?.data) {
            const existingMap = new Map(
              cached.data.data.map((stat) => [stat.id, stat])
            );

            allUpdated.data.forEach((stat) => {
              existingMap.set(stat.id, stat);
            });

            const merged: CollectionResponse<ReviewStatistic> = {
              ...cached.data,
              data: Array.from(existingMap.values()),
              total_count: existingMap.size,
              data_updated_at: allUpdated.data_updated_at,
              pages: {
                ...cached.data.pages,
                next_url: null,
              },
            };

            await saveToCache(cacheKey, merged, merged.data_updated_at);
            await saveDataUpdatedAt("review_statistics", merged.data_updated_at);

            timer.end({
              result: "incremental_update",
              updatedCount: allUpdated.data.length,
              totalCount: merged.data.length,
            });
            return merged;
          }
        } else {
          const cached = await getFromCache<CollectionResponse<ReviewStatistic>>(
            cacheKey,
            undefined,
            { ignoreTTL: true }
          );
          if (cached?.data) {
            timer.end({
              result: "no_updates",
              totalCount: cached.data.data.length,
            });
            return cached.data;
          }
        }
      }

      const initial = await getReviewStatistics(apiToken, params);
      const complete = await fetchAllPages(initial, apiToken);

      await saveToCache(cacheKey, complete, complete.data_updated_at);
      await saveDataUpdatedAt("review_statistics", complete.data_updated_at);

      timer.end({
        result: "full_fetch",
        count: complete.data.length,
      });
      return complete;
    } catch (error) {
      const cached = await getFromCache<CollectionResponse<ReviewStatistic>>(
        cacheKey,
        undefined,
        { ignoreTTL: true }
      );
      if (cached?.data) {
        timer.end({
          result: "cache_fallback",
          totalCount: cached.data.data.length,
        });
        return cached.data;
      }

      timer.end(
        { error: error instanceof Error ? error.message : String(error) },
        false
      );
      throw error;
    }
  })();

  pendingOptimizedReviewStatsRequests.set(requestKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    const pending = pendingOptimizedReviewStatsRequests.get(requestKey);
    if (pending === requestPromise) {
      pendingOptimizedReviewStatsRequests.delete(requestKey);
    }
  }
}

/**
 * Get review statistics that were updated in the last week
 * These represent subjects that were recently reviewed
 * We fetch a week's worth to allow client-side filtering by different time periods
 */
export async function getRecentReviewStatistics(
  apiToken: string
): Promise<CollectionResponse<ReviewStatistic>> {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const initialResponse = await getReviewStatistics(apiToken, {
    updated_after: oneWeekAgo.toISOString(),
  });

  // Handle pagination to get all pages
  return fetchAllPages(initialResponse, apiToken);
}

// Create a review for a subject
export async function createReview(
  apiToken: string,
  params: {
    assignment_id: number;
    incorrect_meaning_answers?: number;
    incorrect_reading_answers?: number;
    created_at?: string;
  }
): Promise<any> {
  const url = new URL(`${API_BASE_URL}/reviews`);

  // Validate parameters
  if (!params.assignment_id) {
    throw new Error("Assignment ID is required for review creation");
  }

  const reviewPayload = { ...params };
  if (reviewPayload.created_at && !shouldSendCreatedAt(reviewPayload.created_at)) {
    delete reviewPayload.created_at;
  }

  const response = await fetchWaniKaniApi(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Wanikani-Revision": API_REVISION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ review: reviewPayload }),
  });

  if (!response.ok) {
    const errorText = await response
      .text()
      .catch(() => "Could not read error response");
    console.error(
      `API error ${response.status} for creating review:`,
      errorText
    );
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

// Start an assignment to mark it as in-progress
export async function startAssignment(
  apiToken: string,
  id: number,
  params: {
    started_at?: string;
  } = {}
): Promise<any> {
  const url = new URL(`${API_BASE_URL}/assignments/${id}/start`);

  // Add default timestamp if not provided
  if (!params.started_at) {
    params.started_at = new Date().toISOString();
  }

  const response = await fetchWaniKaniApi(url.toString(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Wanikani-Revision": API_REVISION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ assignment: params }),
  });

  if (!response.ok) {
    const errorText = await response
      .text()
      .catch(() => "Could not read error response");
    console.error(
      `API error ${response.status} for starting assignment:`,
      errorText
    );
    throw new Error(`API error: ${response.status}`);
  }

  return response.json();
}

function buildAvailableReviewsFromAssignments(
  assignments: CollectionResponse<Assignment>
): CollectionResponse<Assignment> {
  const nowMs = Date.now();
  const reviewAssignments = assignments.data.filter((assignment) => {
    if (!isAssignmentInReviewQueueState(assignment.data)) {
      return false;
    }

    const availableAtMs = Date.parse(assignment.data.available_at);
    return Number.isFinite(availableAtMs) && availableAtMs <= nowMs;
  });

  return {
    ...assignments,
    data: reviewAssignments,
    total_count: reviewAssignments.length,
    pages: {
      ...assignments.pages,
      next_url: null,
    },
  };
}

function buildAvailableLessonsFromAssignments(
  assignments: CollectionResponse<Assignment>
): CollectionResponse<Assignment> {
  const nowMs = Date.now();
  const lessonAssignments = assignments.data.filter((assignment) => {
    const assignmentData = assignment?.data;
    if (!isAssignmentInLessonQueueState(assignmentData)) {
      return false;
    }

    const unlockedAtMs = Date.parse(assignmentData.unlocked_at);
    return Number.isFinite(unlockedAtMs) && unlockedAtMs <= nowMs;
  });

  return {
    ...assignments,
    data: lessonAssignments,
    total_count: lessonAssignments.length,
    pages: {
      ...assignments.pages,
      next_url: null,
    },
  };
}

async function getAvailableReviewsFromCachedAssignments(
  apiToken: string
): Promise<CollectionResponse<Assignment>> {
  const cachedAssignments = await getAssignmentsOptimized(
    apiToken,
    {},
    { forceFullRefresh: false }
  );
  return buildAvailableReviewsFromAssignments(cachedAssignments);
}

async function getAvailableLessonsFromCachedAssignments(
  apiToken: string
): Promise<CollectionResponse<Assignment>> {
  const cachedAssignments = await getAssignmentsOptimized(
    apiToken,
    {},
    { forceFullRefresh: false }
  );
  return buildAvailableLessonsFromAssignments(cachedAssignments);
}

/**
 * Get assignments that are available for formal reviews (will count towards SRS)
 */
export async function getAvailableReviews(
  apiToken: string
): Promise<CollectionResponse<Assignment>> {
  try {
    // Get assignments that are immediately available for review
    const initialResponse = await getAssignments(apiToken, {
      immediately_available_for_review: true,
      hidden: false,
    });

    // Handle pagination to get all pages
    return fetchAllPages(initialResponse, apiToken);
  } catch {
    // Offline/cache fallback: use locally cached assignments if possible.
    return getAvailableReviewsFromCachedAssignments(apiToken);
  }
}

/**
 * Get assignments that are available for lessons
 */
export async function getAvailableLessons(
  apiToken: string
): Promise<CollectionResponse<Assignment>> {
  try {
    // Get assignments that are immediately available for lessons
    const initialResponse = await getAssignments(apiToken, {
      immediately_available_for_lessons: true,
      burned: false,
    });

    // Handle pagination to get all pages
    const liveLessons = await fetchAllPages(initialResponse, apiToken);
    if (liveLessons.data.length > 0) {
      return liveLessons;
    }

    try {
      const cachedLessons = await getAvailableLessonsFromCachedAssignments(
        apiToken
      );
      if (cachedLessons.data.length > 0) {
        console.warn(
          "[Lessons] Live lesson endpoint returned zero lessons; using cached assignment-derived lessons."
        );
        return cachedLessons;
      }
    } catch (fallbackError) {
      console.warn(
        "[Lessons] Failed to reconcile empty live lesson response with cached assignments:",
        fallbackError
      );
    }

    return liveLessons;
  } catch {
    // Offline/cache fallback: use locally cached assignments if possible.
    return getAvailableLessonsFromCachedAssignments(apiToken);
  }
}

/**
 * Submit a review to WaniKani (will count towards SRS progression)
 * @param apiToken WaniKani API Token
 * @param assignmentId ID of the assignment being reviewed
 * @param meaningIncorrect Number of incorrect meaning answers
 * @param readingIncorrect Number of incorrect reading answers
 * @param createdAt Optional timestamp for when the review was created
 */
export async function submitReview(
  apiToken: string,
  assignmentId: number,
  meaningIncorrect: number,
  readingIncorrect: number,
  createdAt?: string
): Promise<any> {
  try {
    const reviewPayload: {
      assignment_id: number;
      incorrect_meaning_answers: number;
      incorrect_reading_answers: number;
      created_at?: string;
    } = {
      assignment_id: assignmentId,
      incorrect_meaning_answers: meaningIncorrect,
      incorrect_reading_answers: readingIncorrect,
    };

    if (createdAt && shouldSendCreatedAt(createdAt)) {
      reviewPayload.created_at = createdAt;
    }

    const data = {
      review: {
        ...reviewPayload,
      }
    };

    let response = await fetchWaniKaniApi(`${API_BASE_URL}/reviews`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/json",
        "Wanikani-Revision": API_REVISION
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const { errorBody, detailedMessage } = await parseApiErrorBody(response);
      const isCreatedAtRangeError =
        response.status === 422 &&
        typeof detailedMessage === "string" &&
        detailedMessage.toLowerCase().includes("created_at");

      if (reviewPayload.created_at && isCreatedAtRangeError) {
        console.warn(
          `[Reviews] Retrying assignment ${assignmentId} without created_at after 422`,
          errorBody
        );

        response = await fetchWaniKaniApi(`${API_BASE_URL}/reviews`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
            "Wanikani-Revision": API_REVISION
          },
          body: JSON.stringify({
            review: {
              assignment_id: assignmentId,
              incorrect_meaning_answers: meaningIncorrect,
              incorrect_reading_answers: readingIncorrect,
            },
          }),
        });

        if (response.ok) {
          return response.json();
        }

        const retryError = await parseApiErrorBody(response);
        console.error(
          `API error ${response.status} for submitting review retry:`,
          retryError.errorBody
        );
        throw new ApiError(
          response.status,
          `Failed to submit review: ${response.status} - ${retryError.detailedMessage}`,
          retryError.errorBody
        );
      }
      console.error(`API error ${response.status} for submitting review:`, errorBody);
      throw new ApiError(
        response.status,
        `Failed to submit review: ${response.status} - ${detailedMessage}`,
        errorBody
      );
    }

    const json = await response.json();
    return json;
  } catch (error) {
    console.error("Error submitting review:", error);
    throw error;
  }
}

/**
 * Start a lesson in WaniKani (marks an assignment as started)
 * @param apiToken WaniKani API Token
 * @param assignmentId ID of the assignment to start
 * @param startedAt Optional timestamp for when the lesson was started
 */
export async function startLesson(
  apiToken: string,
  assignmentId: number,
  startedAt?: string
): Promise<any> {
  const url = new URL(`${API_BASE_URL}/assignments/${assignmentId}/start`);

  const startData = startedAt ? { started_at: startedAt } : {};

  const response = await fetchWaniKaniApi(url.toString(), {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Wanikani-Revision": API_REVISION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(startData),
  });

  if (!response.ok) {
    const errorText = await response
      .text()
      .catch(() => "Could not read error response");
    console.error(
      `API error ${response.status} for starting lesson: ${errorText}`
    );
    throw new ApiError(response.status, `Failed to start lesson: ${response.status}`);
  }

  return response.json();
}

// Clear subjects cache (useful for debugging or forcing refresh)
export async function clearSubjectsCache(): Promise<void> {
  try {
    // Clear the main subjects cache (without parameters)
    const basicCacheKey = `subjects_${API_BASE_URL}/subjects`.replace(/[^a-zA-Z0-9]/g, "_");
    
    // Also clear the cache for getSubjects() with empty params
    const url = new URL(`${API_BASE_URL}/subjects`);
    const emptyCacheKey = `subjects_${url.toString().replace(/[^a-zA-Z0-9]/g, "_")}`;
    
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.removeItem(basicCacheKey);
    await AsyncStorage.removeItem(emptyCacheKey);
  } catch (error) {
    // Silent failure for cache clearing
  }
}

// Fetch all subjects (for consolidated cache system)
export async function getAllSubjectsFromAPI(
  apiToken: string,
  onProgress?: (progress: number) => void
): Promise<CollectionResponse<Subject>> {
  // Fetch all subjects but avoid saving the massive subjects_* collection cache
  const result = await getSubjects(apiToken, {}, {
    skipCollectionCache: true,
    onPaginationProgress: onProgress,
  });

  // Proactively remove any existing all-subjects collection cache to prevent duplication
  try {
    const url = new URL(`${API_BASE_URL}/subjects`);
    const allSubjectsCollectionKey = `subjects_${url.toString().replace(/[^a-zA-Z0-9]/g, "_")}`;
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    await AsyncStorage.removeItem(allSubjectsCollectionKey);
  } catch (cleanupError) {
    // Silent failure for cache cleanup
  }

  return result;
}

/**
 * Get the current count of reviews available for the user
 * This function fetches hidden-filtered assignments and returns the count of
 * immediately available visible reviews.
 */
export async function getReviewCount(apiToken: string): Promise<number> {
  try {
    // Use assignments so hidden reviews are excluded (summary has no hidden filter).
    const response = await getAssignments(apiToken, {
      immediately_available_for_review: true,
      hidden: false,
    });
    if (typeof response.total_count === "number") {
      return Math.max(0, response.total_count);
    }
    return buildVisibleReviewDataFromAssignments(response.data).currentReviews;
  } catch (error) {
    try {
      // Offline/cache fallback.
      const cachedAssignments = await getAssignmentsOptimized(
        apiToken,
        {},
        { forceFullRefresh: false }
      );
      return buildVisibleReviewDataFromAssignments(cachedAssignments.data)
        .currentReviews;
    } catch (fallbackError) {
      console.error("Error fetching review count:", error);
      console.error("Error fetching cached review count:", fallbackError);
      return 0; // Return 0 if there's an error to avoid breaking the app
    }
  }
}

export type VisibleReviewData = {
  currentReviews: number;
  upcomingReviews: number[];
  upcomingReviewTimes: { [key: string]: number };
};

function normalizeVisibleReviewWindow(hoursAhead: number | undefined): number {
  return Math.max(1, Math.min(24, hoursAhead ?? 24));
}

type AssignmentDataLike = Partial<Assignment["data"]> | null | undefined;
type AssignmentLike =
  | Assignment
  | {
      data?: Partial<Assignment["data"]> | null;
    };

/**
 * Returns true when an assignment is in a lesson-ready state.
 */
export function isAssignmentInLessonQueueState(
  assignmentData: AssignmentDataLike
): assignmentData is Partial<Assignment["data"]> & {
  unlocked_at: string;
  subject_id: number;
} {
  if (!assignmentData) {
    return false;
  }

  if (
    !assignmentData.unlocked_at ||
    assignmentData.started_at ||
    assignmentData.hidden ||
    typeof assignmentData.subject_id !== "number"
  ) {
    return false;
  }

  if (
    typeof assignmentData.srs_stage === "number" &&
    assignmentData.srs_stage !== 0
  ) {
    return false;
  }

  if (assignmentData.burned_at) {
    return false;
  }

  return true;
}

/**
 * Returns true when an assignment is in a reviewable state.
 *
 * Notes:
 * - `burned_at` records the *first* burn timestamp and can remain set after
 *   resurrection. Rely on current `srs_stage` instead of `burned_at`.
 * - Hidden assignments should never be surfaced for lessons/reviews.
 */
export function isAssignmentInReviewQueueState(
  assignmentData: AssignmentDataLike
): assignmentData is Partial<Assignment["data"]> & {
  started_at: string;
  available_at: string;
  subject_id: number;
} {
  if (!assignmentData) {
    return false;
  }

  if (
    !assignmentData.started_at ||
    !assignmentData.available_at ||
    assignmentData.hidden ||
    typeof assignmentData.subject_id !== "number"
  ) {
    return false;
  }

  if (
    typeof assignmentData.srs_stage === "number" &&
    assignmentData.srs_stage >= 9
  ) {
    return false;
  }

  return true;
}

/**
 * Builds hidden-filtered review counts from assignments already in memory.
 * This keeps review-card, badge and notification counts on the same source.
 */
export function buildVisibleReviewDataFromAssignments(
  assignments: AssignmentLike[],
  options: { hoursAhead?: number; now?: Date } = {}
): VisibleReviewData {
  const hoursAhead = normalizeVisibleReviewWindow(options.hoursAhead);
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const horizonMs = nowMs + hoursAhead * 60 * 60 * 1000;

  const upcomingReviews = new Array(24).fill(0);
  const upcomingReviewTimes: { [key: string]: number } = {};
  let currentReviews = 0;

  for (const assignment of assignments) {
    const assignmentData = assignment?.data;
    if (!isAssignmentInReviewQueueState(assignmentData)) {
      continue;
    }

    const availableAtMs = Date.parse(assignmentData.available_at);
    if (Number.isNaN(availableAtMs)) {
      continue;
    }

    if (availableAtMs <= nowMs) {
      currentReviews += 1;
      continue;
    }

    if (availableAtMs > horizonMs) {
      continue;
    }

    const availableAtDate = new Date(availableAtMs);
    const timeKey = availableAtDate.toISOString();
    upcomingReviewTimes[timeKey] = (upcomingReviewTimes[timeKey] || 0) + 1;

    const hourIndex = Math.floor((availableAtMs - nowMs) / (60 * 60 * 1000));
    if (hourIndex >= 0 && hourIndex < upcomingReviews.length) {
      upcomingReviews[hourIndex] += 1;
    }
  }

  return {
    currentReviews,
    upcomingReviews,
    upcomingReviewTimes,
  };
}

/**
 * Returns hidden-filtered current reviews plus upcoming reviews in the next
 * `hoursAhead` hours, grouped both by exact timestamps and hour offsets.
 */
export async function getVisibleReviewData(
  apiToken: string,
  options: {
    hoursAhead?: number;
    now?: Date;
    assignments?: AssignmentLike[];
  } = {}
): Promise<VisibleReviewData> {
  const hoursAhead = normalizeVisibleReviewWindow(options.hoursAhead);
  const now = options.now ?? new Date();

  if (options.assignments) {
    return buildVisibleReviewDataFromAssignments(options.assignments, {
      hoursAhead,
      now,
    });
  }

  const horizon = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

  const currentResponse = await getAssignments(apiToken, {
    immediately_available_for_review: true,
    hidden: false,
  });
  const currentReviews =
    typeof currentResponse.total_count === "number"
      ? currentResponse.total_count
      : currentResponse.data.length;

  const upcomingInitial = await getAssignments(apiToken, {
    available_after: now.toISOString(),
    available_before: horizon.toISOString(),
    started: true,
    hidden: false,
  });
  const upcomingAssignments = await fetchAllPages(upcomingInitial, apiToken);
  const upcomingData = buildVisibleReviewDataFromAssignments(
    upcomingAssignments.data,
    {
      hoursAhead,
      now,
    }
  );

  return {
    currentReviews,
    upcomingReviews: upcomingData.upcomingReviews,
    upcomingReviewTimes: upcomingData.upcomingReviewTimes,
  };
}
