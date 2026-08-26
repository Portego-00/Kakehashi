import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBoundedRequestJson } from "@/features/content/server-security";
import {
  analyticsIdentityFromSealedSession,
  analyticsPrivateBackendConfigured,
  readVerifiedStudyTimeDays,
  syncWebStudyTime,
} from "@/lib/server/analytics-server";
import { isTrustedMutationOrigin } from "@/lib/server/request-security";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";

const categorySecondsSchema = z.number().finite().int().min(0).max(86_400);
const deviceIdSchema = z.string().trim().min(8).max(128).regex(/^[a-zA-Z0-9_-]+$/);
const uploadSchema = z.object({
  deviceId: deviceIdSchema,
  days: z.array(z.object({
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    appTotalSeconds: categorySecondsSchema,
    byCategory: z.object({
      reviews: categorySecondsSchema.optional(),
      lessons: categorySecondsSchema.optional(),
      "extra-study": categorySecondsSchema.optional(),
      news: categorySecondsSchema.optional(),
      songs: categorySecondsSchema.optional(),
      reading: categorySecondsSchema.optional(),
      video: categorySecondsSchema.optional(),
    }).strict(),
  }).refine((day) => Object.values(day.byCategory).reduce((sum, seconds) => sum + (seconds ?? 0), 0) <= 86_400, {
    message: "Daily study time cannot exceed one day.",
  }).refine((day) => Object.values(day.byCategory).reduce((sum, seconds) => sum + (seconds ?? 0), 0) <= day.appTotalSeconds, {
    message: "Daily study time cannot exceed total app time.",
  })).min(1).max(14),
}).strict();

export const runtime = "nodejs";

function privateStudyTimeResponse(body: unknown, status = 200, additionalHeaders?: HeadersInit) {
  const headers = new Headers(additionalHeaders);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Vary", "Cookie");
  return NextResponse.json(body, { status, headers });
}

export async function GET(request: NextRequest) {
  const sealed = request.cookies.get(WANIKANI_SESSION_COOKIE)?.value;
  if (!sealed) return privateStudyTimeResponse({ error: "No active session." }, 401);
  const deviceId = deviceIdSchema.safeParse(request.nextUrl.searchParams.get("deviceId"));
  if (!deviceId.success) return privateStudyTimeResponse({ error: "The browser device identifier is invalid." }, 400);

  const limit = takeRateLimit(opaqueRateLimitKey("analytics-study-time-read", sealed), 60, 60 * 60_000);
  if (!limit.allowed) {
    return privateStudyTimeResponse(
      { error: "Too many study-time requests." },
      429,
      { "Retry-After": String(limit.retryAfterSeconds) },
    );
  }
  if (!analyticsPrivateBackendConfigured()) return privateStudyTimeResponse({ available: false, days: [] });

  try {
    const identity = await analyticsIdentityFromSealedSession(sealed);
    const days = await readVerifiedStudyTimeDays(identity.id, deviceId.data);
    return privateStudyTimeResponse({ available: true, days });
  } catch {
    return privateStudyTimeResponse({ error: "Study time could not be loaded." }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!isTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "This analytics request did not originate from Kakehashi." }, { status: 403 });
  }
  const sealed = request.cookies.get(WANIKANI_SESSION_COOKIE)?.value;
  if (!sealed) return NextResponse.json({ error: "No active session." }, { status: 401 });

  const limit = takeRateLimit(opaqueRateLimitKey("analytics-study-time", sealed), 30, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many analytics requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = uploadSchema.safeParse(await readBoundedRequestJson(request, 64_000).catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "The study-time payload is invalid." }, { status: 400 });
  if (!analyticsPrivateBackendConfigured()) return NextResponse.json({ synced: false });

  try {
    const identity = await analyticsIdentityFromSealedSession(sealed);
    const synced = await syncWebStudyTime(identity, parsed.data.deviceId, parsed.data.days);
    return NextResponse.json({ synced });
  } catch {
    return NextResponse.json({ error: "Study time could not be synced." }, { status: 503 });
  }
}
