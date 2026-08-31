const WANIKANI_USER_URL = "https://api.wanikani.com/v2/user";
const WANIKANI_REVISION = "20170710";
const HISTORY_DAYS = 430;
const DAY_MS = 86_400_000;
const DEFAULT_PAGE_SIZE = 1_000;
const MAX_HISTORY_ROWS = 30_000;
const MAX_REQUEST_BYTES = 4_096;
const DEVICE_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
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

export const STUDY_TIME_CATEGORIES = [
  "reviews",
  "lessons",
  "extra_study",
  "news",
  "songs",
  "epub",
  "video",
] as const;

export type StudyTimeCategory = (typeof STUDY_TIME_CATEGORIES)[number];

export type StudyTimeHistoryDay = {
  day: string;
  appTotalMs: number;
  byCategoryMs: Record<StudyTimeCategory, number>;
};

type JsonObject = Record<string, unknown>;

type StudyTimeRow = {
  day?: unknown;
  activity_ms?: unknown;
  app_total_ms?: unknown;
};

export interface StudyTimeHistoryDependencies {
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  now: () => Date;
  pageSize: number;
}

const defaultDependencies: StudyTimeHistoryDependencies = {
  env: (name) => Deno.env.get(name),
  fetch: (input, init) => fetch(input, init),
  now: () => new Date(),
  pageSize: DEFAULT_PAGE_SIZE,
};

class WaniKaniAuthorizationError extends Error {}
class WaniKaniUpstreamError extends Error {}
class WaniKaniRateLimitError extends Error {}
class StudyTimeStorageError extends Error {}

type IdentityCacheEntry = { expiresAt: number; userId: string };
type NegativeIdentityCacheEntry = {
  expiresAt: number;
  kind: "authorization" | "upstream";
};
type TokenRequestLimit = { count: number; resetAt: number };
const identityCache = new Map<string, IdentityCacheEntry>();
const negativeIdentityCache = new Map<string, NegativeIdentityCacheEntry>();
const identityRequests = new Map<string, Promise<string>>();
const tokenRequestLimits = new Map<string, TokenRequestLimit>();
const activeTokenRequests = new Map<string, number>();
let activeWaniKaniRequests = 0;

const ACTIVITY_CATEGORY: Readonly<Record<string, StudyTimeCategory>> = {
  reviews: "reviews",
  bunpro_reviews: "reviews",
  lessons: "lessons",
  bunpro_lessons: "lessons",
  recent_lessons_review: "extra_study",
  custom_review: "extra_study",
  custom_lesson: "extra_study",
  test_session: "extra_study",
  meaning_reading: "extra_study",
  similar_kanji: "extra_study",
  kana_kanji: "extra_study",
  writing_practice: "extra_study",
  writing_freehand: "extra_study",
  context_sentence: "extra_study",
  listening_practice: "extra_study",
  jlpt: "extra_study",
  crossword: "extra_study",
  word_search: "extra_study",
  wordle: "extra_study",
  extra_study: "extra_study",
  "extra-study": "extra_study",
  news: "news",
  songs: "songs",
  epub: "epub",
  reading: "epub",
  video: "video",
};

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

function parseDeviceId(payload: unknown): string | null {
  if (!isJsonObject(payload) || Object.keys(payload).length !== 1) return null;
  const deviceId = payload.deviceId;
  return typeof deviceId === "string" && DEVICE_ID_PATTERN.test(deviceId)
    ? deviceId
    : null;
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

export function waniKaniUserId(payload: unknown): string {
  if (!isJsonObject(payload)) return "";
  const nested = isJsonObject(payload.data)
    ? identityValue(payload.data.id)
    : "";
  return nested || identityValue(payload.id);
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
): Promise<string> {
  const nowMs = now().getTime();
  const cached = identityCache.get(cacheKey);
  if (cached && cached.expiresAt > nowMs) {
    return cached.userId;
  }
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
      const userId = waniKaniUserId(payload);
      if (!userId) {
        cacheNegativeIdentity(cacheKey, "upstream", now().getTime());
        throw new WaniKaniUpstreamError();
      }

      negativeIdentityCache.delete(cacheKey);
      setBounded(
        identityCache,
        cacheKey,
        {
          expiresAt: now().getTime() + POSITIVE_AUTH_TTL_MS,
          userId,
        },
        MAX_AUTH_CACHE_ENTRIES,
      );
      return userId;
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

export function clearStudyTimeHistoryIdentityCacheForTests(): void {
  identityCache.clear();
  negativeIdentityCache.clear();
  identityRequests.clear();
  tokenRequestLimits.clear();
  activeTokenRequests.clear();
  activeWaniKaniRequests = 0;
}

export function studyTimeHistoryAuthStateForTests(): {
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

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function historyBounds(now: Date): { earliest: string; latest: string } {
  // Query the full UTC union of a 430-local-day ledger. UTC-12 can retain a
  // date at UTC-today-430, while UTC+14 can already be on UTC-tomorrow.
  return {
    latest: dateKey(new Date(now.getTime() + DAY_MS)),
    earliest: dateKey(
      new Date(now.getTime() - HISTORY_DAYS * DAY_MS),
    ),
  };
}

function boundedPageSize(value: number): number {
  return Number.isFinite(value)
    ? Math.max(1, Math.min(DEFAULT_PAGE_SIZE, Math.floor(value)))
    : DEFAULT_PAGE_SIZE;
}

async function readStudyTimeRows(
  userId: string,
  deviceId: string,
  supabaseUrl: string,
  serviceRoleKey: string,
  dependencies: StudyTimeHistoryDependencies,
): Promise<StudyTimeRow[]> {
  const pageSize = boundedPageSize(dependencies.pageSize);
  const rows: StudyTimeRow[] = [];
  const bounds = historyBounds(dependencies.now());

  for (let offset = 0;; offset += pageSize) {
    const url = new URL(
      `${supabaseUrl.replace(/\/$/, "")}/rest/v1/study_time_days`,
    );
    url.searchParams.set("select", "day,activity_ms,app_total_ms");
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("device_id", `neq.${deviceId}`);
    url.searchParams.set("verified", "eq.true");
    url.searchParams.set("verified_at", "not.is.null");
    url.searchParams.append("day", `gte.${bounds.earliest}`);
    url.searchParams.append("day", `lte.${bounds.latest}`);
    url.searchParams.set("order", "day.asc,device_id.asc");
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));

    let response: Response;
    try {
      response = await dependencies.fetch(url, {
        method: "GET",
        headers: serviceRoleHeaders(serviceRoleKey, {
          Accept: "application/json",
        }),
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      throw new StudyTimeStorageError();
    }

    if (!response.ok) throw new StudyTimeStorageError();

    let page: unknown;
    try {
      page = await response.json();
    } catch {
      throw new StudyTimeStorageError();
    }
    if (!Array.isArray(page)) throw new StudyTimeStorageError();

    if (rows.length + page.length > MAX_HISTORY_ROWS) {
      throw new StudyTimeStorageError();
    }
    rows.push(...(page as StudyTimeRow[]));
    if (page.length < pageSize) break;
  }

  return rows;
}

function emptyCategories(): Record<StudyTimeCategory, number> {
  return {
    reviews: 0,
    lessons: 0,
    extra_study: 0,
    news: 0,
    songs: 0,
    epub: 0,
    video: 0,
  };
}

function nonNegativeMilliseconds(value: unknown): number {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && /^\d+$/.test(value)
    ? Number(value)
    : 0;
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

function addSafe(left: number, right: number): number {
  const total = left + right;
  return Number.isSafeInteger(total) ? total : Number.MAX_SAFE_INTEGER;
}

export function aggregateStudyTimeRows(
  rows: readonly StudyTimeRow[],
): StudyTimeHistoryDay[] {
  const days = new Map<string, StudyTimeHistoryDay>();

  for (const row of rows) {
    if (typeof row?.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.day)) {
      continue;
    }
    let day = days.get(row.day);
    if (!day) {
      day = {
        day: row.day,
        appTotalMs: 0,
        byCategoryMs: emptyCategories(),
      };
      days.set(row.day, day);
    }

    day.appTotalMs = addSafe(
      day.appTotalMs,
      nonNegativeMilliseconds(row.app_total_ms),
    );

    if (!isJsonObject(row.activity_ms)) continue;
    for (const [activity, rawMilliseconds] of Object.entries(row.activity_ms)) {
      const category = ACTIVITY_CATEGORY[activity];
      if (!category) continue;
      day.byCategoryMs[category] = addSafe(
        day.byCategoryMs[category],
        nonNegativeMilliseconds(rawMilliseconds),
      );
    }
  }

  return [...days.values()].sort((left, right) =>
    left.day.localeCompare(right.day)
  );
}

export async function handleStudyTimeHistoryRequest(
  request: Request,
  overrides: Partial<StudyTimeHistoryDependencies> = {},
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
    return jsonResponse({ error: "Study time history is unavailable" }, 503);
  }
  if (!constantTimeEqual(suppliedProjectKey, configuredProjectKey)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const token = request.headers.get("x-wanikani-token")?.trim() ?? "";
  if (!token || token.length > 4_096) {
    return jsonResponse({ error: "WaniKani authorization is required" }, 401);
  }

  let deviceId: string | null;
  try {
    deviceId = parseDeviceId(await readRequestJson(request));
  } catch {
    deviceId = null;
  }
  if (!deviceId) {
    return jsonResponse({ error: "Invalid request" }, 400);
  }

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
    let userId: string;
    try {
      userId = await verifyWaniKaniToken(
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
      return jsonResponse({ error: "Study time history is unavailable" }, 503);
    }

    try {
      const rows = await readStudyTimeRows(
        userId,
        deviceId,
        supabaseUrl,
        serviceRoleKey,
        dependencies,
      );
      return jsonResponse({ days: aggregateStudyTimeRows(rows) });
    } catch {
      return jsonResponse(
        { error: "Study time history is unavailable" },
        503,
      );
    }
  } finally {
    releaseTokenRequest(cacheKey);
  }
}

if (import.meta.main) {
  Deno.serve((request) => handleStudyTimeHistoryRequest(request));
}
