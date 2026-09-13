import { NextRequest, NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE } from "@/features/demo/constants";
import { DEMO_USER } from "@/features/demo/runtime";
import { isTrustedMutationOrigin, clientAddress } from "@/lib/server/request-security";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";

export async function POST(request: NextRequest) {
  if (!isTrustedMutationOrigin(request)) return NextResponse.json({ error: "Open the demo from Kakehashi." }, { status: 403 });
  const limit = takeRateLimit(opaqueRateLimitKey("demo-start", clientAddress(request)), 30, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Please wait a moment before opening the demo again." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  const response = NextResponse.json({ user: DEMO_USER, demo: true }, { headers: { "Cache-Control": "private, no-store" } });
  // A demo has no WaniKani credential, including when entered from a real session.
  response.cookies.delete(WANIKANI_SESSION_COOKIE);
  const localPreview = ["localhost", "127.0.0.1", "[::1]"].includes(request.nextUrl.hostname);
  response.cookies.set(DEMO_SESSION_COOKIE, "1", {
    httpOnly: true,
    // WebKit rejects Secure cookies on plain HTTP loopback previews. This public
    // mode marker has no credential; deployed production hosts still require TLS.
    secure: request.nextUrl.protocol === "https:" || (process.env.NODE_ENV === "production" && !localPreview),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}
