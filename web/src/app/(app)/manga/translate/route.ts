import { NextResponse } from "next/server";
import { isSameOriginRequest, readBoundedJson, readBoundedRequestJson } from "@/features/content/server-security";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { clientAddress } from "@/lib/server/request-security";

export const runtime = "nodejs";

const JPDB_JA2EN_ENDPOINT = "https://jpdb.io/api/v1/ja2en";
const REQUEST_MAX_BYTES = 50_000;
const RESPONSE_MAX_BYTES = 500_000;
const TEXT_MAX_CHARACTERS = 10_000;
const API_KEY_MAX_CHARACTERS = 512;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

type JpdbTranslationPayload = {
  text?: unknown;
  is_truncated?: unknown;
  error?: unknown;
};

type TranslationErrorCode =
  | "api_unavailable"
  | "bad_key"
  | "missing_key"
  | "provider_error"
  | "text_too_long"
  | "timeout"
  | "too_many_requests";

function privateJson(
  body: Record<string, unknown>,
  init: { status?: number; headers?: HeadersInit } = {},
) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  return NextResponse.json(body, { status: init.status, headers });
}

function limitHeaders(limit: ReturnType<typeof takeRateLimit>) {
  return {
    "Retry-After": String(limit.retryAfterSeconds),
    "RateLimit-Limit": String(limit.limit),
    "RateLimit-Remaining": String(limit.remaining),
    "RateLimit-Reset": String(Math.ceil(limit.resetAt / 1_000)),
  };
}

function errorResponse(error: string, code: TranslationErrorCode, status: number, headers?: HeadersInit) {
  return privateJson({ error, code }, { status, headers });
}

function knownProviderCode(payload: JpdbTranslationPayload | null) {
  if (!payload || typeof payload.error !== "string") return null;
  const code = payload.error.trim();
  if (code === "bad_key" || code === "too_many_requests" || code === "text_too_long" || code === "api_unavailable") return code;
  return null;
}

function providerError(response: Response, payload: JpdbTranslationPayload | null) {
  const code = knownProviderCode(payload);
  if (code === "bad_key" || response.status === 401 || response.status === 403) {
    return errorResponse("JPDB rejected this API key. Update it in Settings.", "bad_key", 401);
  }
  if (code === "too_many_requests" || response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    return errorResponse(
      "JPDB's translation rate limit was reached. Try again shortly.",
      "too_many_requests",
      429,
      retryAfter ? { "Retry-After": retryAfter } : undefined,
    );
  }
  if (code === "text_too_long" || response.status === 413) {
    return errorResponse("The selected text is too long for JPDB translation.", "text_too_long", 400);
  }
  if (code === "api_unavailable" || response.status >= 500) {
    return errorResponse("JPDB translation is temporarily unavailable.", "api_unavailable", 502);
  }
  return errorResponse("JPDB could not translate the selected text.", "provider_error", 502);
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return errorResponse("Cross-origin translation requests are blocked.", "provider_error", 403);
  }

  const limit = takeRateLimit(opaqueRateLimitKey("jpdb-manga-translation", clientAddress(request)), RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return errorResponse("Too many translation requests. Try again shortly.", "too_many_requests", 429, limitHeaders(limit));
  }

  let body: { text?: unknown; apiKey?: unknown };
  try {
    body = await readBoundedRequestJson(request, REQUEST_MAX_BYTES) as typeof body;
  } catch (error) {
    const tooLarge = error instanceof Error && error.message.includes("too large");
    return errorResponse(
      tooLarge ? "The translation request is too large." : "Translation request must be valid JSON.",
      tooLarge ? "text_too_long" : "provider_error",
      tooLarge ? 413 : 400,
    );
  }

  if (typeof body.text !== "string" || !body.text.trim() || body.text.length > TEXT_MAX_CHARACTERS) {
    return errorResponse(`Enter between 1 and ${TEXT_MAX_CHARACTERS.toLocaleString()} characters.`, "text_too_long", 400);
  }

  const submittedKey = typeof body.apiKey === "string" && body.apiKey.length <= API_KEY_MAX_CHARACTERS ? body.apiKey.trim() : "";
  const apiKey = submittedKey || process.env.JPDB_API_KEY?.trim() || "";
  if (!apiKey) {
    return errorResponse("Add your JPDB API key in Settings to translate manga text.", "missing_key", 409);
  }

  try {
    const response = await fetch(JPDB_JA2EN_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ text: body.text.trim() }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    const payload = await readBoundedJson(response, RESPONSE_MAX_BYTES).catch(() => null) as JpdbTranslationPayload | null;

    if (!response.ok) return providerError(response, payload);
    if (!payload || typeof payload.text !== "string" || !payload.text.trim()) {
      return errorResponse("JPDB returned no usable translation.", "provider_error", 502);
    }

    return privateJson({
      provider: "jpdb",
      translation: payload.text.trim(),
      isTruncated: payload.is_truncated === true,
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    return errorResponse(
      timedOut ? "JPDB translation timed out." : "JPDB translation is temporarily unavailable.",
      timedOut ? "timeout" : "api_unavailable",
      502,
    );
  }
}
