import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sealToken, unsealToken } from "@/lib/server/session-crypto";
import { clientAddress, isTrustedMutationOrigin } from "@/lib/server/request-security";
import { opaqueRateLimitKey, takeRateLimit, type RateLimitResult } from "@/lib/server/rate-limit";
import { clearWkCache } from "@/lib/server/wk-cache";
import { getWaniKaniSessionUser, SessionUpstreamError, WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";

const loginSchema = z.object({ token: z.string().trim().min(20).max(256) });
export const runtime = "nodejs";

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

export async function GET(request: NextRequest) {
  const sealed = request.cookies.get(WANIKANI_SESSION_COOKIE)?.value;
  if (!sealed) return NextResponse.json({ error: "No active session." }, { status: 401 });
  const limit = takeRateLimit(opaqueRateLimitKey("session-read", sealed), 180, 60_000);
  if (!limit.allowed) return rateLimited(limit);
  let token: string;
  try {
    token = unsealToken(sealed);
  } catch {
    const response = NextResponse.json({ error: "The current session is invalid. Sign in again." }, { status: 401 });
    response.cookies.delete(WANIKANI_SESSION_COOKIE);
    return response;
  }
  try {
    const user = await getWaniKaniSessionUser(token);
    return NextResponse.json({ user }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const failure = cause instanceof SessionUpstreamError ? cause : new SessionUpstreamError("WaniKani could not verify this session right now.", 502);
    if (failure.status !== 401 && failure.status !== 403) {
      const headers = new Headers({ "Cache-Control": "private, no-store" });
      if (failure.retryAfter) headers.set("Retry-After", failure.retryAfter);
      if (failure.resetAt) headers.set("RateLimit-Reset", failure.resetAt);
      return NextResponse.json({ error: failure.message, code: failure.status }, { status: failure.status === 429 ? 429 : 503, headers });
    }
    const response = NextResponse.json({ error: "The current token is no longer authorized. Sign in again." }, { status: 401 });
    response.cookies.delete(WANIKANI_SESSION_COOKIE);
    return response;
  }
}

export async function POST(request: NextRequest) {
  if (!isTrustedMutationOrigin(request)) return NextResponse.json({ error: "This sign-in did not originate from Kakehashi." }, { status: 403 });
  const limit = takeRateLimit(opaqueRateLimitKey("session-login", clientAddress(request)), 10, 60_000);
  if (!limit.allowed) return rateLimited(limit);
  const parsed = loginSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a complete WaniKani API token." }, { status: 400 });
  try {
    const user = await getWaniKaniSessionUser(parsed.data.token);
    const response = NextResponse.json({ user });
    response.cookies.set(WANIKANI_SESSION_COOKIE, sealToken(parsed.data.token), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (cause) {
    const failure = cause instanceof SessionUpstreamError ? cause : null;
    const status = failure?.status === 429 ? 429 : failure && failure.status >= 500 ? 503 : 401;
    const headers = new Headers();
    if (failure?.retryAfter) headers.set("Retry-After", failure.retryAfter);
    if (failure?.resetAt) headers.set("RateLimit-Reset", failure.resetAt);
    return NextResponse.json({ error: cause instanceof Error ? cause.message : "WaniKani could not verify this token." }, { status, headers });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isTrustedMutationOrigin(request)) return NextResponse.json({ error: "This sign-out did not originate from Kakehashi." }, { status: 403 });
  const sealed = request.cookies.get(WANIKANI_SESSION_COOKIE)?.value;
  if (sealed) {
    try { clearWkCache(unsealToken(sealed)); } catch { /* An invalid cookie is removed below. */ }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(WANIKANI_SESSION_COOKIE);
  return response;
}
