import { NextResponse } from "next/server";
import { JPDB_PARSE_ENDPOINT, jpdbParseRequest, parseJpdbResponse } from "@/features/content/jpdb";
import { isSameOriginRequest, readBoundedJson, readBoundedRequestJson } from "@/features/content/server-security";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { clientAddress } from "@/lib/server/request-security";
import { demoJpdbErrorResponse, demoJpdbProviderFailure, resolveJpdbCredential, takeDemoJpdbBudget } from "@/lib/server/demo-jpdb";

export const runtime = "nodejs";

const REQUEST_MAX_BYTES = 100_000;
const TEXT_MAX_CHARACTERS = 40_000;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

function limitHeaders(limit: ReturnType<typeof takeRateLimit>) {
  return {
    "Retry-After": String(limit.retryAfterSeconds),
    "RateLimit-Limit": String(limit.limit),
    "RateLimit-Remaining": String(limit.remaining),
    "RateLimit-Reset": String(Math.ceil(limit.resetAt / 1_000)),
  };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin analysis requests are blocked." }, { status: 403 });
  const limit = takeRateLimit(opaqueRateLimitKey("jpdb-news", clientAddress(request)), RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) return NextResponse.json({ error: "Too many analysis requests. Try again shortly." }, { status: 429, headers: limitHeaders(limit) });

  let body: { text?: unknown; apiKey?: unknown };
  try {
    body = await readBoundedRequestJson(request, REQUEST_MAX_BYTES) as typeof body;
  } catch (error) {
    const tooLarge = error instanceof Error && error.message.includes("too large");
    return NextResponse.json({ error: tooLarge ? "The article is too large to analyze." : "Analysis request must be valid JSON." }, { status: tooLarge ? 413 : 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Analysis request must be a JSON object." }, { status: 400 });
  if (typeof body.text !== "string" || !body.text.trim() || body.text.length > TEXT_MAX_CHARACTERS) return NextResponse.json({ error: `Enter between 1 and ${TEXT_MAX_CHARACTERS.toLocaleString()} characters.` }, { status: 400 });
  if (typeof body.apiKey === "string" && body.apiKey.length > 512) return NextResponse.json({ error: "The JPDB API key is too long." }, { status: 400 });
  const credential = resolveJpdbCredential(request, typeof body.apiKey === "string" ? body.apiKey.trim() : "", true);
  if (credential.failure) return demoJpdbErrorResponse(credential.failure);
  const { apiKey, isDemo } = credential;
  if (!apiKey) return NextResponse.json({ error: "Add your JPDB API key in Settings to enable JPDB-first annotation." }, { status: 409 });
  if (isDemo && body.text.length > 12_000) return NextResponse.json({ error: "Demo analysis accepts up to 12,000 characters at a time." }, { status: 400 });
  const budgetFailure = takeDemoJpdbBudget(request, isDemo);
  if (budgetFailure) return demoJpdbErrorResponse(budgetFailure);

  try {
    const response = await fetch(JPDB_PARSE_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(jpdbParseRequest(body.text)),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const payload = await readBoundedJson(response, 4_000_000).catch(() => null) as { error?: unknown } | null;
    if (!response.ok) {
      const demoFailure = demoJpdbProviderFailure(isDemo, response.status, payload?.error);
      if (demoFailure) return demoJpdbErrorResponse(demoFailure);
      const invalidKey = response.status === 401 || response.status === 403;
      return NextResponse.json({ error: invalidKey ? "JPDB rejected this API key. Update it in Settings." : `JPDB analysis failed with HTTP ${response.status}.` }, { status: invalidKey ? 401 : 502 });
    }
    return NextResponse.json({ provider: "jpdb", tokens: parseJpdbResponse(body.text, payload) }, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.name === "TimeoutError" ? "JPDB analysis timed out." : "JPDB analysis is temporarily unavailable." }, { status: 502 });
  }
}
