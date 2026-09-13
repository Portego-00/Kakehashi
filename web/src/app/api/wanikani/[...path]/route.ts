import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { unsealToken } from "@/lib/server/session-crypto";
import { clientAddress, isTrustedMutationOrigin } from "@/lib/server/request-security";
import { opaqueRateLimitKey, takeRateLimit, type RateLimitResult } from "@/lib/server/rate-limit";
import { clearWkCache, coalesceWkRequest, isWkCacheBypass, readWkCache, versionedWkCacheKey, wkCacheGeneration, wkCacheKey, writeWkCacheIfCurrent } from "@/lib/server/wk-cache";

const API_BASE = "https://api.wanikani.com/v2";
const ALLOWED_ROOTS = new Set([
  "assignments", "level_progressions", "resets", "reviews", "review_statistics",
  "spaced_repetition_systems", "study_materials", "subjects", "summary", "user", "voice_actors",
]);
const ALLOWED_METHODS = new Set(["GET", "POST", "PUT"]);
const COOKIE_NAME = "kakehashi_wk_session";
export const runtime = "nodejs";

const reviewBody = z.object({ review: z.object({ assignment_id: z.number().int().positive(), incorrect_meaning_answers: z.number().int().min(0), incorrect_reading_answers: z.number().int().min(0), created_at: z.string().datetime().optional() }).strict() }).strict();
const lessonBody = z.object({ assignment: z.object({ started_at: z.string().datetime().optional() }).strict() }).strict();
const studyMaterialBody = z.object({ study_material: z.object({ subject_id: z.number().int().positive().optional(), meaning_note: z.string().nullable().optional(), reading_note: z.string().nullable().optional(), meaning_synonyms: z.array(z.string().trim().min(1).max(120)).max(20).optional() }).strict() }).strict();

function mutationSchema(method: string, path: string[]) {
  if (method === "POST" && path.length === 1 && path[0] === "reviews") return reviewBody;
  if (method === "PUT" && path.length === 3 && path[0] === "assignments" && /^\d+$/.test(path[1]) && path[2] === "start") return lessonBody;
  if (method === "POST" && path.length === 1 && path[0] === "study_materials") return studyMaterialBody;
  if (method === "PUT" && path.length === 2 && path[0] === "study_materials" && /^\d+$/.test(path[1])) return studyMaterialBody;
  return null;
}

function error(message: string, status: number) { return NextResponse.json({ error: message, code: status }, { status }); }

function rateLimited(result: RateLimitResult) {
  return NextResponse.json({ error: `Too many requests. Try again in ${result.retryAfterSeconds} seconds.`, code: 429 }, {
    status: 429,
    headers: {
      "Retry-After": String(result.retryAfterSeconds),
      "RateLimit-Limit": String(result.limit),
      "RateLimit-Remaining": String(result.remaining),
      "RateLimit-Reset": String(Math.ceil(result.resetAt / 1_000)),
    },
  });
}

function cacheTtl(root: string) {
  if (["subjects", "spaced_repetition_systems", "voice_actors"].includes(root)) return 24 * 60 * 60_000;
  if (root === "review_statistics") return 15 * 60_000;
  if (["level_progressions", "resets", "study_materials", "user"].includes(root)) return 5 * 60_000;
  return 60_000;
}

async function handler(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const root = path[0];
  if (!root || !ALLOWED_ROOTS.has(root) || path.some((part) => part === ".." || part.includes(":"))) return error("That WaniKani endpoint is not available through this proxy.", 404);
  if (!ALLOWED_METHODS.has(request.method)) return error("That request method is not supported.", 405);

  if (request.method !== "GET" && !isTrustedMutationOrigin(request)) return error("This mutation did not originate from Kakehashi.", 403);

  let token: string | undefined;
  const sealed = request.cookies.get(COOKIE_NAME)?.value;
  if (sealed) {
    try { token = unsealToken(sealed); } catch { return error("The current session has expired.", 401); }
  }
  token ||= process.env.NODE_ENV !== "production" ? process.env.WANIKANI_API_TOKEN?.trim() : undefined;
  if (!token) return error("Add a WaniKani API token to continue.", 401);

  const identity = sealed || `${clientAddress(request)}:development`;
  const localLimit = takeRateLimit(opaqueRateLimitKey(`wanikani-${request.method.toLocaleLowerCase()}`, identity), request.method === "GET" ? 90 : 60, 60_000);
  if (!localLimit.allowed) return rateLimited(localLimit);

  const target = new URL(`${API_BASE}/${path.map(encodeURIComponent).join("/")}`);
  request.nextUrl.searchParams.forEach((value, key) => target.searchParams.append(key, value));
  const cacheKey = wkCacheKey(token, target.toString());
  const bypassCache = request.method === "GET" && isWkCacheBypass(request.headers);
  const cacheGeneration = wkCacheGeneration(token);
  if (request.method === "GET" && !bypassCache) {
    const cached = readWkCache<unknown>(cacheKey);
    if (cached !== undefined) {
      const response = NextResponse.json(cached);
      response.headers.set("Cache-Control", "private, no-store");
      response.headers.set("X-Kakehashi-Cache", "HIT");
      return response;
    }
  }
  let body: string | undefined;
  if (request.method !== "GET") {
    const raw = await request.json().catch(() => null);
    const schema = mutationSchema(request.method, path);
    if (!schema) return error("That mutation is not supported.", 405);
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return NextResponse.json({ error: "The mutation body is invalid.", code: 422, details: parsed.error.flatten() }, { status: 422 });
    body = JSON.stringify(parsed.data);
  }

  try {
    const load = async () => {
      const upstream = await fetch(target, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Wanikani-Revision": "20170710",
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body,
      cache: "no-store",
      });
      const responseBody = upstream.status === 204 ? null : await upstream.json().catch(() => ({ error: "WaniKani returned an unreadable response.", code: upstream.status }));
      const forwardedHeaders: Record<string, string> = {};
      ["ratelimit-limit", "ratelimit-remaining", "ratelimit-reset", "retry-after"].forEach((name) => {
        const value = upstream.headers.get(name);
        if (value) forwardedHeaders[name] = value;
      });
      return { body: responseBody, status: upstream.status, ok: upstream.ok, headers: forwardedHeaders };
    };
    const upstream = request.method === "GET" && !bypassCache ? await coalesceWkRequest(versionedWkCacheKey(cacheKey, cacheGeneration), load) : await load();
    if (upstream.ok && request.method === "GET" && !bypassCache) writeWkCacheIfCurrent(token, cacheGeneration, cacheKey, upstream.body, cacheTtl(root));
    if (upstream.ok && request.method !== "GET") clearWkCache(token);
    const response = NextResponse.json(upstream.body, { status: upstream.status });
    response.headers.set("Cache-Control", "private, no-store");
    Object.entries(upstream.headers).forEach(([name, value]) => response.headers.set(name, value));
    return response;
  } catch {
    return error("WaniKani could not be reached. Check your connection and try again.", 502);
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
