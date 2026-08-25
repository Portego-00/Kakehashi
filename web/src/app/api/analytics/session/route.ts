import { NextRequest, NextResponse } from "next/server";
import { analyticsBackendConfigured, analyticsIdentityFromSealedSession, recordWebAppSession } from "@/lib/server/analytics-server";
import { isTrustedMutationOrigin } from "@/lib/server/request-security";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!isTrustedMutationOrigin(request)) {
    return NextResponse.json({ error: "This analytics request did not originate from Kakehashi." }, { status: 403 });
  }
  const sealed = request.cookies.get(WANIKANI_SESSION_COOKIE)?.value;
  if (!sealed) return NextResponse.json({ error: "No active session." }, { status: 401 });

  const limit = takeRateLimit(opaqueRateLimitKey("analytics-session", sealed), 12, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many analytics requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }
  if (!analyticsBackendConfigured()) return NextResponse.json({ recorded: false });

  try {
    const identity = await analyticsIdentityFromSealedSession(sealed);
    const recorded = await recordWebAppSession(identity);
    return NextResponse.json({ recorded });
  } catch {
    return NextResponse.json({ error: "The usage session could not be recorded." }, { status: 503 });
  }
}
