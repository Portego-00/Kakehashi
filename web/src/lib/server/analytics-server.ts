import "server-only";

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import packageJson from "../../../package.json";
import { readBoundedJson } from "@/features/content/server-security";
import { unsealToken } from "@/lib/server/session-crypto";
import { getWaniKaniSessionUser } from "@/lib/server/wanikani-session";
import { waniKaniUserId } from "@/lib/wanikani/user-identity";

type JsonRecord = Record<string, unknown>;
export type AnalyticsIdentity = { id: string; username: string; level: number };
export type WebStudyTimeCategory = "reviews" | "lessons" | "extra-study" | "news" | "songs" | "reading" | "video";
export type WebStudyTimeUploadDay = {
  day: string;
  appTotalSeconds: number;
  byCategory: Partial<Record<WebStudyTimeCategory, number>>;
};
export type WebStudyTimeRemoteDay = WebStudyTimeUploadDay;

const CATEGORY_TO_ACTIVITY: Record<WebStudyTimeCategory, string> = {
  reviews: "reviews",
  lessons: "lessons",
  "extra-study": "extra_study",
  news: "news",
  songs: "songs",
  reading: "epub",
  video: "video",
};

const ACTIVITY_TO_CATEGORY: Record<string, WebStudyTimeCategory> = {
  reviews: "reviews",
  bunpro_reviews: "reviews",
  lessons: "lessons",
  bunpro_lessons: "lessons",
  recent_lessons_review: "extra-study",
  custom_review: "extra-study",
  custom_lesson: "extra-study",
  test_session: "extra-study",
  meaning_reading: "extra-study",
  similar_kanji: "extra-study",
  kana_kanji: "extra-study",
  writing_practice: "extra-study",
  writing_freehand: "extra-study",
  context_sentence: "extra-study",
  listening_practice: "extra-study",
  crossword: "extra-study",
  wordle: "extra-study",
  extra_study: "extra-study",
  "extra-study": "extra-study",
  news: "news",
  songs: "songs",
  epub: "reading",
  reading: "reading",
  video: "video",
};

const STUDY_TIME_PAGE_SIZE = 1_000;
const MAX_STUDY_TIME_ROWS = 30_000;
const MILLISECONDS_PER_DAY = 86_400_000;
const JWT_SHAPE = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

function supabaseRequestHeaders(key: string, additional: Record<string, string> = {}) {
  return {
    apikey: key,
    ...(JWT_SHAPE.test(key) ? { Authorization: `Bearer ${key}` } : {}),
    ...additional,
  };
}

function developmentEnv() {
  if (process.env.NODE_ENV === "production") return {} as Record<string, string>;
  try {
    return Object.fromEntries(
      readFileSync(resolve(process.cwd(), "../.env"), "utf8")
        .split(/\r?\n/)
        .filter((line) => line && !line.trimStart().startsWith("#") && line.includes("="))
        .map((line) => {
          const index = line.indexOf("=");
          return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "")];
        }),
    );
  } catch {
    return {} as Record<string, string>;
  }
}

const localEnv = developmentEnv();
const supabaseUrl = (
  process.env.SUPABASE_URL
  || process.env.NEXT_PUBLIC_SUPABASE_URL
  || process.env.EXPO_PUBLIC_SUPABASE_URL
  || localEnv.SUPABASE_URL
  || localEnv.NEXT_PUBLIC_SUPABASE_URL
  || localEnv.EXPO_PUBLIC_SUPABASE_URL
  || ""
).replace(/\/$/, "");
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  || localEnv.SUPABASE_ANON_KEY
  || localEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  || localEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY
  || "";
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SECRET_KEY
  || localEnv.SUPABASE_SERVICE_ROLE_KEY
  || localEnv.SUPABASE_SECRET_KEY
  || "";
const supabaseKey =
  supabaseServiceKey
  || supabaseAnonKey
  || "";

export function analyticsBackendConfigured() {
  return Boolean(supabaseUrl && supabaseKey);
}

export function analyticsPrivateBackendConfigured() {
  return Boolean(supabaseUrl && supabaseServiceKey);
}

export function publicAnalyticsBackend() {
  return supabaseUrl && supabaseAnonKey ? { url: supabaseUrl, anonKey: supabaseAnonKey } : null;
}

type IdentityCacheEntry = { expiresAt: number; identity: AnalyticsIdentity };
const shared = globalThis as typeof globalThis & { __kakehashiAnalyticsIdentities?: Map<string, IdentityCacheEntry> };
const identityCache = shared.__kakehashiAnalyticsIdentities ??= new Map();

function identityCacheKey(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

function parseIdentity(payload: unknown): AnalyticsIdentity | null {
  if (!payload || typeof payload !== "object") return null;
  const user = payload as { id?: unknown; data?: { id?: unknown; username?: unknown; level?: unknown } };
  const id = waniKaniUserId(user);
  const username = typeof user.data?.username === "string" ? user.data.username.trim() : "";
  const level = Number(user.data?.level);
  if (!id || !username || !Number.isFinite(level)) return null;
  return { id, username, level: Math.max(0, Math.floor(level)) };
}

export async function analyticsIdentityFromSealedSession(sealed: string) {
  const token = unsealToken(sealed);
  const key = identityCacheKey(token);
  const cached = identityCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.identity;

  const identity = parseIdentity(await getWaniKaniSessionUser(token));
  if (!identity) throw new Error("The current WaniKani session has no usable identity.");
  identityCache.set(key, { identity, expiresAt: Date.now() + 15 * 60_000 });
  while (identityCache.size > 500) identityCache.delete(identityCache.keys().next().value as string);
  return identity;
}

async function postAnalyticsRequest(path: string, body: JsonRecord, key: string) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: "POST",
    headers: supabaseRequestHeaders(key, {
      Accept: "application/json",
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    }),
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (response.ok) return true;

  const payload = await readBoundedJson(response, 64_000).catch(() => null);
  const message = payload && typeof payload === "object" && typeof (payload as JsonRecord).message === "string"
    ? String((payload as JsonRecord).message)
    : `HTTP ${response.status}`;
  throw new Error(`Analytics service rejected the write: ${message}`);
}

async function analyticsRequest(path: string, body: JsonRecord) {
  if (!analyticsBackendConfigured()) return false;
  return postAnalyticsRequest(path, body, supabaseKey);
}

async function privateAnalyticsRequest(path: string, body: JsonRecord) {
  if (!analyticsPrivateBackendConfigured()) return false;
  return postAnalyticsRequest(path, body, supabaseServiceKey);
}

export async function readAppSessionStartedAt(userId: string, limit = 30_000) {
  if (!analyticsBackendConfigured()) return [];
  const maximum = Math.max(1, Math.min(30_000, Math.floor(limit)));
  const pageSize = 1_000;
  const sessions: string[] = [];
  let offset = 0;
  while (offset < maximum) {
    const requested = Math.min(pageSize, maximum - offset);
    const url = new URL(`${supabaseUrl}/rest/v1/app_sessions`);
    url.searchParams.set("select", "session_started_at");
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("order", "session_started_at.desc");
    url.searchParams.set("limit", String(requested));
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, {
      headers: supabaseRequestHeaders(supabaseKey, {
        Accept: "application/json",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await readBoundedJson(response, 2_000_000).catch(() => null);
    if (!response.ok) {
      const message = payload && typeof payload === "object" && !Array.isArray(payload) && typeof (payload as JsonRecord).message === "string"
        ? String((payload as JsonRecord).message)
        : `HTTP ${response.status}`;
      throw new Error(`Analytics service rejected the read: ${message}`);
    }
    if (!Array.isArray(payload)) break;
    offset += payload.length;
    sessions.push(...payload.flatMap((row) => {
      if (!row || typeof row !== "object" || typeof (row as JsonRecord).session_started_at !== "string") return [];
      return [String((row as JsonRecord).session_started_at)];
    }));
    if (payload.length < requested) break;
  }
  return sessions.slice(0, maximum);
}

export function recordWebAppSession(identity: AnalyticsIdentity) {
  return analyticsRequest("app_sessions", {
    user_id: identity.id,
    user_name: identity.username,
    user_level: identity.level,
    app_version: packageJson.version,
    platform: "web",
  });
}

export function syncWebStudyTime(identity: AnalyticsIdentity, deviceId: string, days: WebStudyTimeUploadDay[]) {
  const updatedAt = new Date().toISOString();
  const rows = days.map((day) => {
    const activityMs: Record<string, number> = {};
    let studyTotalMs = 0;
    for (const [category, value] of Object.entries(day.byCategory)) {
      if (!(category in CATEGORY_TO_ACTIVITY) || !Number.isFinite(value) || value <= 0) continue;
      const milliseconds = Math.round(value * 1_000);
      activityMs[CATEGORY_TO_ACTIVITY[category as WebStudyTimeCategory]] = milliseconds;
      studyTotalMs += milliseconds;
    }
    return {
      user_id: identity.id,
      device_id: deviceId,
      day: day.day,
      activity_ms: activityMs,
      study_total_ms: studyTotalMs,
      app_total_ms: Math.round(day.appTotalSeconds * 1_000),
      user_name: identity.username,
      user_level: identity.level,
      app_version: packageJson.version,
      platform: "web",
      updated_at: updatedAt,
    };
  });
  return privateAnalyticsRequest("rpc/upsert_verified_study_time_days", { rows });
}

function validMilliseconds(value: unknown) {
  const milliseconds = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(milliseconds) && milliseconds >= 0 && milliseconds <= MILLISECONDS_PER_DAY
    ? Math.round(milliseconds)
    : 0;
}

function studyTimeBounds(now: Date, maximumDays: number) {
  const latest = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  latest.setUTCDate(latest.getUTCDate() + 1);
  const earliest = new Date(latest);
  earliest.setUTCDate(earliest.getUTCDate() - (maximumDays - 1));
  return {
    earliest: earliest.toISOString().slice(0, 10),
    latest: latest.toISOString().slice(0, 10),
  };
}

export async function readVerifiedStudyTimeDays(
  userId: string,
  excludedDeviceId: string,
  maximumDays = 430,
  now = new Date(),
): Promise<WebStudyTimeRemoteDay[]> {
  if (!analyticsPrivateBackendConfigured()) return [];
  const boundedDays = Math.max(1, Math.min(430, Math.floor(maximumDays)));
  const bounds = studyTimeBounds(now, boundedDays);
  const totals = new Map<string, { appTotalMs: number; byCategoryMs: Partial<Record<WebStudyTimeCategory, number>> }>();
  let offset = 0;

  while (true) {
    const requested = STUDY_TIME_PAGE_SIZE;
    const url = new URL(`${supabaseUrl}/rest/v1/study_time_days`);
    url.searchParams.set("select", "day,activity_ms,app_total_ms");
    url.searchParams.set("user_id", `eq.${userId}`);
    url.searchParams.set("device_id", `neq.${excludedDeviceId}`);
    url.searchParams.set("verified", "eq.true");
    url.searchParams.set("verified_at", "not.is.null");
    url.searchParams.append("day", `gte.${bounds.earliest}`);
    url.searchParams.append("day", `lte.${bounds.latest}`);
    url.searchParams.set("order", "day.desc,device_id.asc");
    url.searchParams.set("limit", String(requested));
    url.searchParams.set("offset", String(offset));
    const response = await fetch(url, {
      headers: supabaseRequestHeaders(supabaseServiceKey, {
        Accept: "application/json",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const payload = await readBoundedJson(response, 2_000_000).catch(() => null);
    if (!response.ok) {
      const message = payload && typeof payload === "object" && !Array.isArray(payload) && typeof (payload as JsonRecord).message === "string"
        ? String((payload as JsonRecord).message)
        : `HTTP ${response.status}`;
      throw new Error(`Analytics service rejected the read: ${message}`);
    }
    if (!Array.isArray(payload)) throw new Error("Analytics service returned invalid study-time data.");
    if (offset + payload.length > MAX_STUDY_TIME_ROWS) {
      throw new Error("Analytics service returned too many study-time rows.");
    }

    for (const value of payload) {
      if (!value || typeof value !== "object") continue;
      const row = value as JsonRecord;
      const day = typeof row.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.day) ? row.day : "";
      if (!day || day < bounds.earliest || day > bounds.latest) continue;
      const aggregate = totals.get(day) ?? { appTotalMs: 0, byCategoryMs: {} };
      aggregate.appTotalMs += validMilliseconds(row.app_total_ms);
      if (row.activity_ms && typeof row.activity_ms === "object" && !Array.isArray(row.activity_ms)) {
        for (const [activity, rawMilliseconds] of Object.entries(row.activity_ms as JsonRecord)) {
          const category = ACTIVITY_TO_CATEGORY[activity];
          if (!category) continue;
          aggregate.byCategoryMs[category] = (aggregate.byCategoryMs[category] ?? 0) + validMilliseconds(rawMilliseconds);
        }
      }
      totals.set(day, aggregate);
    }

    offset += payload.length;
    if (payload.length < requested) break;
  }

  return [...totals.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .slice(0, boundedDays)
    .map(([day, aggregate]) => {
      const appTotalSeconds = Math.floor(aggregate.appTotalMs / 1_000);
      const byCategory = Object.fromEntries(Object.entries(aggregate.byCategoryMs)
        .map(([category, milliseconds]) => [category, Math.floor((milliseconds ?? 0) / 1_000)])
        .filter(([, seconds]) => Number(seconds) > 0)) as Partial<Record<WebStudyTimeCategory, number>>;
      const studyTotalSeconds = Object.values(byCategory)
        .reduce((sum, seconds) => sum + (seconds ?? 0), 0);
      if (studyTotalSeconds > appTotalSeconds) {
        throw new Error("Analytics service returned inconsistent study-time totals.");
      }
      return { day, appTotalSeconds, byCategory };
    });
}

export function clearAnalyticsIdentityCacheForTests() {
  identityCache.clear();
}
