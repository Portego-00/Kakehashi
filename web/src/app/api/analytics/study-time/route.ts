import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBoundedRequestJson } from "@/features/content/server-security";
import { analyticsBackendConfigured, analyticsIdentityFromSealedSession, syncWebStudyTime } from "@/lib/server/analytics-server";
import { isTrustedMutationOrigin } from "@/lib/server/request-security";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";

const categorySecondsSchema = z.number().finite().int().min(0).max(86_400);
const uploadSchema = z.object({
  deviceId: z.string().trim().min(8).max(128).regex(/^[a-zA-Z0-9_-]+$/),
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
  })).min(1).max(14),
}).strict();

export const runtime = "nodejs";

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
  if (!analyticsBackendConfigured()) return NextResponse.json({ synced: false });

  try {
    const identity = await analyticsIdentityFromSealedSession(sealed);
    const synced = await syncWebStudyTime(identity, parsed.data.deviceId, parsed.data.days);
    return NextResponse.json({ synced });
  } catch {
    return NextResponse.json({ error: "Study time could not be synced." }, { status: 503 });
  }
}
