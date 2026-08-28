import { NextResponse } from "next/server";
import { isSameOriginRequest, readBoundedJson, readBoundedRequestJson } from "@/features/content/server-security";
import {
  JITEN_SEARCH_PAGE_URL,
  createJitenVocabularySearchUrl,
  normalizeVocabularyExpression,
  parseJitenSearchEntries,
  selectBestJitenFrequencyMatch,
} from "@/features/core-study/jiten-frequency";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { clientAddress } from "@/lib/server/request-security";

export const runtime = "nodejs";

const REQUEST_MAX_BYTES = 4_096;
const EXPRESSION_MAX_CHARACTERS = 64;
const READING_MAX_CHARACTERS = 64;
const READINGS_MAX_COUNT = 32;
const JITEN_RESPONSE_MAX_BYTES = 512_000;
const REQUEST_TIMEOUT_MS = 8_000;
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;

const SAFE_RESPONSE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  Vary: "Origin",
};

interface FrequencyRequestBody {
  expression: string;
  readings: string[];
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return NextResponse.json(body, {
    status,
    headers: { ...SAFE_RESPONSE_HEADERS, ...headers },
  });
}

function limitHeaders(limit: ReturnType<typeof takeRateLimit>) {
  return {
    "Retry-After": String(limit.retryAfterSeconds),
    "RateLimit-Limit": String(limit.limit),
    "RateLimit-Remaining": String(limit.remaining),
    "RateLimit-Reset": String(Math.ceil(limit.resetAt / 1_000)),
  };
}

function parseFrequencyRequest(value: unknown): FrequencyRequestBody | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 2 || !keys.includes("expression") || !keys.includes("readings")) return null;
  if (
    typeof record.expression !== "string"
    || !record.expression.trim()
    || record.expression.length > EXPRESSION_MAX_CHARACTERS
    || normalizeVocabularyExpression(record.expression).length > EXPRESSION_MAX_CHARACTERS
    || !Array.isArray(record.readings)
    || record.readings.length > READINGS_MAX_COUNT
  ) {
    return null;
  }

  if (record.readings.some((reading) => (
    typeof reading !== "string"
    || !reading.trim()
    || reading.length > READING_MAX_CHARACTERS
  ))) {
    return null;
  }

  return {
    expression: record.expression.trim(),
    readings: [...new Set(record.readings)],
  };
}

function safeRetryAfter(value: string | null) {
  if (!value || value.length > 128) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return String(Math.ceil(seconds));
  return Number.isFinite(Date.parse(value)) ? value : null;
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return json({ error: "Cross-origin vocabulary frequency requests are blocked." }, 403);
  }

  const limit = takeRateLimit(
    opaqueRateLimitKey("jiten-vocabulary-frequency", clientAddress(request)),
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (!limit.allowed) {
    return json(
      { error: "Too many vocabulary frequency requests. Try again shortly." },
      429,
      limitHeaders(limit),
    );
  }

  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    return json({ error: "Vocabulary frequency requests must use JSON." }, 415);
  }

  let payload: unknown;
  try {
    payload = await readBoundedRequestJson(request, REQUEST_MAX_BYTES);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message.includes("too large");
    return json(
      { error: tooLarge ? "The vocabulary frequency request is too large." : "Vocabulary frequency request must be valid JSON." },
      tooLarge ? 413 : 400,
    );
  }

  const body = parseFrequencyRequest(payload);
  if (!body) {
    return json({ error: "Vocabulary frequency request has invalid expression or readings." }, 400);
  }

  try {
    const response = await fetch(createJitenVocabularySearchUrl(body.expression), {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });

    if (!response.ok) {
      const retryAfter = response.status === 429 ? safeRetryAfter(response.headers.get("Retry-After")) : null;
      return json(
        { error: response.status === 429 ? "Jiten is rate limiting vocabulary lookups." : `Jiten vocabulary lookup failed with HTTP ${response.status}.` },
        response.status === 429 ? 429 : 502,
        retryAfter ? { "Retry-After": retryAfter } : {},
      );
    }

    const remotePayload = await readBoundedJson(response, JITEN_RESPONSE_MAX_BYTES);
    const entries = parseJitenSearchEntries(remotePayload);
    if (!entries) return json({ error: "Jiten vocabulary lookup returned an unexpected response." }, 502);

    const match = selectBestJitenFrequencyMatch(body.expression, body.readings, entries);
    if (!match) return json({ result: null });

    const sourceUrl = new URL(JITEN_SEARCH_PAGE_URL);
    sourceUrl.searchParams.set("query", body.expression);
    return json({
      result: {
        provider: "jiten",
        frequencyRank: match.frequencyRank,
        wordId: match.wordId,
        readingIndex: match.readingIndex,
        matchedText: match.text,
        matchedReading: match.reading,
        sourceUrl: sourceUrl.toString(),
      },
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    return json(
      { error: timedOut ? "Jiten vocabulary lookup timed out." : "Jiten vocabulary lookup is temporarily unavailable." },
      timedOut ? 504 : 502,
    );
  }
}
