import { NextRequest, NextResponse } from "next/server";
import { analyticsBackendConfigured, analyticsIdentityFromSealedSession, publicAnalyticsBackend, readAppSessionActiveDays } from "@/lib/server/analytics-server";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";

export const runtime = "nodejs";

function safeTimezone(value: string | null) {
  if (!value || value.length > 80) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return value;
  } catch {
    return "UTC";
  }
}

export async function GET(request: NextRequest) {
  const sealed = request.cookies.get(WANIKANI_SESSION_COOKIE)?.value;
  if (!sealed) return NextResponse.json({ error: "No active session." }, { status: 401 });
  const limit = takeRateLimit(opaqueRateLimitKey("analytics-streak", sealed), 60, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many streak requests." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }
  if (!analyticsBackendConfigured()) return NextResponse.json({ activeDays: [], available: false, publicBackend: publicAnalyticsBackend() });

  try {
    const identity = await analyticsIdentityFromSealedSession(sealed);
    const activeDays = await readAppSessionActiveDays(identity.id, safeTimezone(request.nextUrl.searchParams.get("timezone")), request.signal);
    return NextResponse.json({ activeDays, available: true, userId: identity.id }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "The app streak could not be loaded." }, { status: 503 });
  }
}
