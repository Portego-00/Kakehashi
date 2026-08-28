const WANIKANI_USER_URL = "https://api.wanikani.com/v2/user";
const WANIKANI_REVISION = "20170710";
const VERIFIED_UPSERT_RPC = "upsert_verified_study_time_days";
const HISTORY_DAYS = 430;
const MAX_DAYS_PER_SYNC = 14;
const MAX_DAY_MS = 86_400_000;
const MAX_REQUEST_BYTES = 64_000;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const POSITIVE_AUTH_TTL_MS = 5 * 60_000;
const INVALID_AUTH_TTL_MS = 60_000;
const UPSTREAM_FAILURE_TTL_MS = 5_000;
const AUTH_RATE_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_TOKEN = 30;
const MAX_AUTH_CACHE_ENTRIES = 500;
const MAX_RATE_LIMIT_ENTRIES = 500;
const MAX_CONCURRENT_WANIKANI_REQUESTS = 8;
const MAX_CONCURRENT_REQUESTS_PER_TOKEN = 2;

const CORS_HEADERS = {
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wanikani-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Max-Age": "86400",
};

const ACTIVITY_KEYS = new Set([
  "reviews",
  "bunpro_reviews",
  "lessons",
  "bunpro_lessons",
  "recent_lessons_review",
  "custom_review",
  "custom_lesson",
  "test_session",
  "meaning_reading",
  "similar_kanji",
  "kana_kanji",
  "writing_practice",
  "writing_freehand",
  "context_sentence",
  "listening_practice",
  "crossword",
  "wordle",
  "news",
  "songs",
  "epub",
  "video",
]);

const PLATFORMS = new Set(["ios", "android", "web", "macos", "windows"]);

type JsonObject = Record<string, unknown>;

export type VerifiedWaniKaniIdentity = {
  userId: string;
  userName: string;
  userLevel: number;
};

export type ValidatedSyncDay = {
  day: string;
  activityMs: Record<string, number>;
  studyTotalMs: number;
  appTotalMs: number;
  appVersion: string | null;
  platform: string;
};

export type ValidatedSyncPayload = {
  deviceId: string;
  days: ValidatedSyncDay[];
};

export interface StudyTimeSyncDependencies {
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  now: () => Date;
}

const defaultDependencies: StudyTimeSyncDependencies = {
  env: (name) => Deno.env.get(name),
  fetch: (input, init) => fetch(input, init),
  now: () => new Date(),
};

class WaniKaniAuthorizationError extends Error {}
class WaniKaniUpstreamError extends Error {}
class WaniKaniRateLimitError extends Error {}
class StudyTimeStorageError extends Error {}

type IdentityCacheEntry = {
  expiresAt: number;
  identity: VerifiedWaniKaniIdentity;
};
type NegativeIdentityCacheEntry = {
  expiresAt: number;
  kind: "authorization" | "upstream";
};
type TokenRequestLimit = { count: number; resetAt: number };
const identityCache = new Map<string, IdentityCacheEntry>();
const negativeIdentityCache = new Map<string, NegativeIdentityCacheEntry>();
const identityRequests = new Map<
  string,
  Promise<VerifiedWaniKaniIdentity>
>();
const tokenRequestLimits = new Map<string, TokenRequestLimit>();
const activeTokenRequests = new Map<string, number>();
let activeWaniKaniRequests = 0;

function responseHeaders(extra: HeadersInit = {}): Headers {
  const headers = new Headers(CORS_HEADERS);
  headers.set("Cache-Control", "no-store");
  headers.set("Vary", "Origin");
  for (const [name, value] of new Headers(extra)) {
    headers.set(name, value);
  }
  return headers;
}

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: responseHeaders({
      "Content-Type": "application/json; charset=utf-8",
    }),
  });
}

function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: responseHeaders() });
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  object: JsonObject,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(object).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

async function readRequestJson(request: Request): Promise<unknown> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new Error("Request body is too large");
  }
  const text = await request.text();
  if (text.length === 0 || text.length > MAX_REQUEST_BYTES) {
    throw new Error("Request body is invalid");
  }
  return JSON.parse(text);
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isRealDateKey(value: string): boolean {
  if (!DATE_KEY_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && dateKey(parsed) === value;
}

function isBoundedInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number.isSafeInteger(value) &&
    (value as number) >= 0 && (value as number) <= MAX_DAY_MS;
}

function normalizeVersion(value: unknown): string | null | undefined {
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > 64) {
    return undefined;
  }
  for (const character of normalized) {
    const codePoint = character.codePointAt(0) ?? 0;
    if (codePoint <= 31 || codePoint === 127) return undefined;
  }
  return normalized;
}

export function validateStudyTimeSyncPayload(
  payload: unknown,
  now: Date,
): ValidatedSyncPayload | null {
  if (
    !isJsonObject(payload) ||
    !hasExactKeys(payload, ["deviceId", "days"]) ||
    typeof payload.deviceId !== "string" ||
    !DEVICE_ID_PATTERN.test(payload.deviceId) ||
    !Array.isArray(payload.days) ||
    payload.days.length < 1 ||
    payload.days.length > MAX_DAYS_PER_SYNC
  ) {
    return null;
  }

  // A local calendar can be one day ahead of UTC. Allow that without allowing
  // arbitrary future rows, while keeping the inclusive window at 430 days.
  const latestDate = new Date(now.getTime() + 86_400_000);
  const latestDay = dateKey(latestDate);
  const earliestDay = dateKey(
    new Date(latestDate.getTime() - (HISTORY_DAYS - 1) * 86_400_000),
  );
  const seenDays = new Set<string>();
  const days: ValidatedSyncDay[] = [];

  for (const rawDay of payload.days) {
    if (
      !isJsonObject(rawDay) ||
      !hasExactKeys(rawDay, [
        "day",
        "activityMs",
        "studyTotalMs",
        "appTotalMs",
        "appVersion",
        "platform",
      ]) ||
      typeof rawDay.day !== "string" ||
      !isRealDateKey(rawDay.day) ||
      rawDay.day < earliestDay ||
      rawDay.day > latestDay ||
      seenDays.has(rawDay.day) ||
      !isJsonObject(rawDay.activityMs) ||
      Object.keys(rawDay.activityMs).length > ACTIVITY_KEYS.size ||
      !isBoundedInteger(rawDay.studyTotalMs) ||
      !isBoundedInteger(rawDay.appTotalMs) ||
      typeof rawDay.platform !== "string" ||
      !PLATFORMS.has(rawDay.platform)
    ) {
      return null;
    }

    const appVersion = normalizeVersion(rawDay.appVersion);
    if (appVersion === undefined) return null;

    const activityMs: Record<string, number> = {};
    let computedStudyTotalMs = 0;
    for (const [activity, milliseconds] of Object.entries(rawDay.activityMs)) {
      if (!ACTIVITY_KEYS.has(activity) || !isBoundedInteger(milliseconds)) {
        return null;
      }
      computedStudyTotalMs += milliseconds;
      if (
        !Number.isSafeInteger(computedStudyTotalMs) ||
        computedStudyTotalMs > MAX_DAY_MS
      ) {
        return null;
      }
      activityMs[activity] = milliseconds;
    }

    if (
      rawDay.studyTotalMs !== computedStudyTotalMs ||
      rawDay.appTotalMs < computedStudyTotalMs
    ) {
      return null;
    }

    seenDays.add(rawDay.day);
    days.push({
      day: rawDay.day,
      activityMs,
      studyTotalMs: computedStudyTotalMs,
      appTotalMs: rawDay.appTotalMs,
      appVersion,
      platform: rawDay.platform,
    });
  }

  return { deviceId: payload.deviceId, days };
}

function identityValue(value: unknown): string {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 && normalized.length <= 256 ? normalized : "";
  }
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? String(value)
    : "";
}

function identityString(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= 128 ? normalized : "";
}

export function waniKaniIdentity(
  payload: unknown,
): VerifiedWaniKaniIdentity | null {
  if (!isJsonObject(payload)) return null;
  const data = isJsonObject(payload.data) ? payload.data : {};
  const userId = identityValue(data.id) || identityValue(payload.id);
  const userName = identityString(data.username) ||
    identityString(payload.username);
  const rawLevel = data.level ?? payload.level;
  const userLevel = typeof rawLevel === "number" ? rawLevel : Number.NaN;
  if (
    !userId || !userName || !Number.isSafeInteger(userLevel) ||
    userLevel < 1 || userLevel > 60
  ) {
    return null;
  }
  return { userId, userName, userLevel };
}

function constantTimeEqual(left: string, right: string): boolean {
  const maximumLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;
  for (let index = 0; index < maximumLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function isJwtShaped(value: string): boolean {
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function serviceRoleHeaders(
  serviceRoleKey: string,
  initial: HeadersInit = {},
): Headers {
  const headers = new Headers(initial);
  headers.set("apikey", serviceRoleKey);
  if (isJwtShaped(serviceRoleKey)) {
    headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  }
  return headers;
}

function setBounded<K, V>(
  map: Map<K, V>,
  key: K,
  value: V,
  maximumSize: number,
): void {
  map.delete(key);
  map.set(key, value);
  while (map.size > maximumSize) {
    map.delete(map.keys().next().value as K);
  }
}

function takeTokenRequest(cacheKey: string, nowMs: number): boolean {
  const existing = tokenRequestLimits.get(cacheKey);
  if (!existing || existing.resetAt <= nowMs) {
    setBounded(
      tokenRequestLimits,
      cacheKey,
      { count: 1, resetAt: nowMs + AUTH_RATE_WINDOW_MS },
      MAX_RATE_LIMIT_ENTRIES,
    );
    return true;
  }
  if (existing.count >= MAX_REQUESTS_PER_TOKEN) return false;
  setBounded(
    tokenRequestLimits,
    cacheKey,
    { ...existing, count: existing.count + 1 },
    MAX_RATE_LIMIT_ENTRIES,
  );
  return true;
}

function acquireTokenRequest(cacheKey: string): boolean {
  const active = activeTokenRequests.get(cacheKey) ?? 0;
  if (active >= MAX_CONCURRENT_REQUESTS_PER_TOKEN) return false;
  activeTokenRequests.set(cacheKey, active + 1);
  return true;
}

function releaseTokenRequest(cacheKey: string): void {
  const active = activeTokenRequests.get(cacheKey) ?? 0;
  if (active <= 1) {
    activeTokenRequests.delete(cacheKey);
  } else {
    activeTokenRequests.set(cacheKey, active - 1);
  }
}

function cacheNegativeIdentity(
  cacheKey: string,
  kind: NegativeIdentityCacheEntry["kind"],
  nowMs: number,
): void {
  setBounded(
    negativeIdentityCache,
    cacheKey,
    {
      kind,
      expiresAt: nowMs +
        (kind === "authorization"
          ? INVALID_AUTH_TTL_MS
          : UPSTREAM_FAILURE_TTL_MS),
    },
    MAX_AUTH_CACHE_ENTRIES,
  );
}

function throwCachedIdentityFailure(cacheKey: string, nowMs: number): void {
  const cached = negativeIdentityCache.get(cacheKey);
  if (!cached) return;
  if (cached.expiresAt <= nowMs) {
    negativeIdentityCache.delete(cacheKey);
    return;
  }
  if (cached.kind === "authorization") {
    throw new WaniKaniAuthorizationError();
  }
  throw new WaniKaniUpstreamError();
}

async function tokenCacheKey(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyWaniKaniToken(
  token: string,
  cacheKey: string,
  fetcher: typeof fetch,
  now: () => Date,
): Promise<VerifiedWaniKaniIdentity> {
  const nowMs = now().getTime();
  const cached = identityCache.get(cacheKey);
  if (cached && cached.expiresAt > nowMs) return cached.identity;
  identityCache.delete(cacheKey);
  throwCachedIdentityFailure(cacheKey, nowMs);

  const activeRequest = identityRequests.get(cacheKey);
  if (activeRequest) return await activeRequest;
  if (activeWaniKaniRequests >= MAX_CONCURRENT_WANIKANI_REQUESTS) {
    throw new WaniKaniRateLimitError();
  }

  activeWaniKaniRequests += 1;
  const request = (async () => {
    try {
      let response: Response;
      try {
        response = await fetcher(WANIKANI_USER_URL, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
            "Wanikani-Revision": WANIKANI_REVISION,
          },
          signal: AbortSignal.timeout(10_000),
        });
      } catch {
        cacheNegativeIdentity(cacheKey, "upstream", now().getTime());
        throw new WaniKaniUpstreamError();
      }

      if (response.status === 401 || response.status === 403) {
        cacheNegativeIdentity(cacheKey, "authorization", now().getTime());
        throw new WaniKaniAuthorizationError();
      }
      if (!response.ok) {
        cacheNegativeIdentity(cacheKey, "upstream", now().getTime());
        throw new WaniKaniUpstreamError();
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        cacheNegativeIdentity(cacheKey, "upstream", now().getTime());
        throw new WaniKaniUpstreamError();
      }
      const identity = waniKaniIdentity(payload);
      if (!identity) {
        cacheNegativeIdentity(cacheKey, "upstream", now().getTime());
        throw new WaniKaniUpstreamError();
      }

      negativeIdentityCache.delete(cacheKey);
      setBounded(
        identityCache,
        cacheKey,
        {
          expiresAt: now().getTime() + POSITIVE_AUTH_TTL_MS,
          identity,
        },
        MAX_AUTH_CACHE_ENTRIES,
      );
      return identity;
    } finally {
      activeWaniKaniRequests -= 1;
    }
  })();

  identityRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    identityRequests.delete(cacheKey);
  }
}

export function clearStudyTimeSyncIdentityCacheForTests(): void {
  identityCache.clear();
  negativeIdentityCache.clear();
  identityRequests.clear();
  tokenRequestLimits.clear();
  activeTokenRequests.clear();
  activeWaniKaniRequests = 0;
}

export function studyTimeSyncAuthStateForTests(): {
  negativeCacheSize: number;
  rateLimitSize: number;
  activeRequests: number;
  activeTokenRequests: number;
} {
  return {
    negativeCacheSize: negativeIdentityCache.size,
    rateLimitSize: tokenRequestLimits.size,
    activeRequests: activeWaniKaniRequests,
    activeTokenRequests: [...activeTokenRequests.values()].reduce(
      (total, active) => total + active,
      0,
    ),
  };
}

async function persistVerifiedDays(
  payload: ValidatedSyncPayload,
  identity: VerifiedWaniKaniIdentity,
  supabaseUrl: string,
  serviceRoleKey: string,
  dependencies: StudyTimeSyncDependencies,
): Promise<void> {
  const updatedAt = dependencies.now().toISOString();
  const rows = payload.days.map((day) => ({
    user_id: identity.userId,
    device_id: payload.deviceId,
    day: day.day,
    activity_ms: day.activityMs,
    study_total_ms: day.studyTotalMs,
    app_total_ms: day.appTotalMs,
    user_name: identity.userName,
    user_level: identity.userLevel,
    app_version: day.appVersion,
    platform: day.platform,
    updated_at: updatedAt,
  }));

  let response: Response;
  try {
    response = await dependencies.fetch(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/${VERIFIED_UPSERT_RPC}`,
      {
        method: "POST",
        headers: serviceRoleHeaders(serviceRoleKey, {
          Accept: "application/json",
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        }),
        body: JSON.stringify({ rows }),
        signal: AbortSignal.timeout(12_000),
      },
    );
  } catch {
    throw new StudyTimeStorageError();
  }
  if (!response.ok) throw new StudyTimeStorageError();
}

export async function handleStudyTimeSyncRequest(
  request: Request,
  overrides: Partial<StudyTimeSyncDependencies> = {},
): Promise<Response> {
  const dependencies = { ...defaultDependencies, ...overrides };

  if (request.method === "OPTIONS") return optionsResponse();
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const configuredProjectKey = dependencies.env("SUPABASE_ANON_KEY")?.trim() ??
    "";
  const suppliedProjectKey = request.headers.get("apikey")?.trim() ?? "";
  if (!configuredProjectKey) {
    return jsonResponse({ error: "Study time sync is unavailable" }, 503);
  }
  if (!constantTimeEqual(suppliedProjectKey, configuredProjectKey)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const token = request.headers.get("x-wanikani-token")?.trim() ?? "";
  if (!token || token.length > 4_096) {
    return jsonResponse({ error: "WaniKani authorization is required" }, 401);
  }

  let payload: ValidatedSyncPayload | null;
  try {
    payload = validateStudyTimeSyncPayload(
      await readRequestJson(request),
      dependencies.now(),
    );
  } catch {
    payload = null;
  }
  if (!payload) return jsonResponse({ error: "Invalid request" }, 400);

  let cacheKey: string;
  try {
    cacheKey = await tokenCacheKey(token);
  } catch {
    return jsonResponse({ error: "WaniKani could not be reached" }, 502);
  }
  if (!takeTokenRequest(cacheKey, dependencies.now().getTime())) {
    return jsonResponse({ error: "Too many requests" }, 429);
  }
  if (!acquireTokenRequest(cacheKey)) {
    return jsonResponse({ error: "Too many requests" }, 429);
  }

  try {
    let identity: VerifiedWaniKaniIdentity;
    try {
      identity = await verifyWaniKaniToken(
        token,
        cacheKey,
        dependencies.fetch,
        dependencies.now,
      );
    } catch (error) {
      if (error instanceof WaniKaniRateLimitError) {
        return jsonResponse({ error: "Too many requests" }, 429);
      }
      if (error instanceof WaniKaniAuthorizationError) {
        return jsonResponse(
          { error: "WaniKani authorization is invalid" },
          401,
        );
      }
      return jsonResponse({ error: "WaniKani could not be reached" }, 502);
    }

    const supabaseUrl = dependencies.env("SUPABASE_URL")?.trim() ?? "";
    const serviceRoleKey =
      dependencies.env("SUPABASE_SERVICE_ROLE_KEY")?.trim() ?? "";
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Study time sync is unavailable" }, 503);
    }

    try {
      await persistVerifiedDays(
        payload,
        identity,
        supabaseUrl,
        serviceRoleKey,
        dependencies,
      );
      return jsonResponse({ synced: true });
    } catch {
      return jsonResponse({ error: "Study time sync is unavailable" }, 503);
    }
  } finally {
    releaseTokenRequest(cacheKey);
  }
}

if (import.meta.main) {
  Deno.serve((request) => handleStudyTimeSyncRequest(request));
}
