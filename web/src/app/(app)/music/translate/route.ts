import { NextResponse } from "next/server";
import {
  isSameOriginRequest,
  readBoundedJson,
  readBoundedRequestJson,
} from "@/features/content/server-security";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { clientAddress } from "@/lib/server/request-security";

export const runtime = "nodejs";

const JPDB_JA2EN_ENDPOINT = "https://jpdb.io/api/v1/ja2en";
const REQUEST_MAX_BYTES = 750_000;
const RESPONSE_MAX_BYTES = 100_000;
const LINE_MAX_CHARACTERS = 2_000;
const TOTAL_SOURCE_MAX_CHARACTERS = 50_000;
const UNIQUE_LINE_LIMIT = 120;
const INPUT_ENTRY_LIMIT = 1_000;
const API_KEY_MAX_CHARACTERS = 512;
const CACHED_TRANSLATION_MAX_CHARACTERS = 8_000;
const CACHED_TRANSLATION_TOTAL_MAX_CHARACTERS = 100_000;
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;
const OPERATION_TIMEOUT_MS = 30_000;
const JAPANESE_TEXT_PATTERN =
  /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\u3005\u3006\u303b\uff66-\uff9f]/u;

type TranslationErrorCode =
  | "api_unavailable"
  | "bad_key"
  | "invalid_request"
  | "missing_key"
  | "provider_error"
  | "text_too_long"
  | "timeout"
  | "too_many_requests";

type JpdbTranslationPayload = {
  text?: unknown;
  is_truncated?: unknown;
  error?: unknown;
};

type SafeFailure = {
  code: TranslationErrorCode;
  message: string;
  status: number;
  headers?: HeadersInit;
};

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

function errorResponse(failure: SafeFailure) {
  return privateJson(
    { error: failure.message, code: failure.code },
    { status: failure.status, headers: failure.headers },
  );
}

function knownProviderCode(payload: JpdbTranslationPayload | null) {
  if (!payload || typeof payload.error !== "string") return null;
  const code = payload.error.trim();
  if (
    code === "bad_key"
    || code === "too_many_requests"
    || code === "text_too_long"
    || code === "api_unavailable"
  ) return code;
  return null;
}

function providerFailure(
  response: Response,
  payload: JpdbTranslationPayload | null,
): SafeFailure {
  const code = knownProviderCode(payload);
  if (code === "bad_key" || response.status === 401 || response.status === 403) {
    return {
      code: "bad_key",
      message: "JPDB rejected this API key. Update it in Settings.",
      status: 401,
    };
  }
  if (code === "too_many_requests" || response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    return {
      code: "too_many_requests",
      message: "JPDB's translation rate limit was reached. Try again shortly.",
      status: 429,
      headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
    };
  }
  if (code === "text_too_long" || response.status === 413) {
    return {
      code: "text_too_long",
      message: "This lyric line is too long for JPDB translation.",
      status: 400,
    };
  }
  if (code === "api_unavailable" || response.status >= 500) {
    return {
      code: "api_unavailable",
      message: "JPDB translation is temporarily unavailable.",
      status: 502,
    };
  }
  return {
    code: "provider_error",
    message: "JPDB could not translate the lyrics.",
    status: 502,
  };
}

function invalidRequest(message: string, code: TranslationErrorCode = "invalid_request") {
  return errorResponse({ code, message, status: 400 });
}

function operationFailure(signal: AbortSignal, error: unknown): SafeFailure {
  const timedOut = signal.aborted
    || (error instanceof Error && error.name === "TimeoutError");
  return timedOut
    ? {
      code: "timeout",
      message: "JPDB lyric translation timed out.",
      status: 502,
    }
    : {
      code: "api_unavailable",
      message: "JPDB translation is temporarily unavailable.",
      status: 502,
    };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return errorResponse({
      code: "provider_error",
      message: "Cross-origin translation requests are blocked.",
      status: 403,
    });
  }

  const limit = takeRateLimit(
    opaqueRateLimitKey("jpdb-music-translation", clientAddress(request)),
    RATE_LIMIT,
    RATE_WINDOW_MS,
  );
  if (!limit.allowed) {
    return errorResponse({
      code: "too_many_requests",
      message: "Too many lyric translation requests. Try again shortly.",
      status: 429,
      headers: limitHeaders(limit),
    });
  }

  let rawBody: unknown;
  try {
    rawBody = await readBoundedRequestJson(request, REQUEST_MAX_BYTES);
  } catch (error) {
    const tooLarge = error instanceof Error && error.message.includes("too large");
    return errorResponse({
      code: tooLarge ? "text_too_long" : "invalid_request",
      message: tooLarge
        ? "The lyric translation request is too large."
        : "Lyric translation request must be valid JSON.",
      status: tooLarge ? 413 : 400,
    });
  }
  if (!rawBody || typeof rawBody !== "object" || Array.isArray(rawBody)) {
    return invalidRequest("Lyric translation request must be a JSON object.");
  }
  const body = rawBody as {
    lines?: unknown;
    cachedTranslations?: unknown;
    apiKey?: unknown;
  };

  const normalizedApiKey = typeof body.apiKey === "string"
    ? body.apiKey.trim()
    : "";
  if (!normalizedApiKey) {
    return errorResponse({
      code: "missing_key",
      message: "Add your JPDB API key in Settings to translate lyric lines.",
      status: 409,
    });
  }
  if (normalizedApiKey.length > API_KEY_MAX_CHARACTERS) {
    return invalidRequest("The JPDB API key is too long.", "bad_key");
  }

  if (!Array.isArray(body.lines) || body.lines.length > INPUT_ENTRY_LIMIT) {
    return invalidRequest(`Choose between 1 and ${UNIQUE_LINE_LIMIT} Japanese lyric lines.`);
  }

  const uniqueLines: string[] = [];
  const requestedLines = new Set<string>();
  let totalSourceCharacters = 0;
  for (const rawLine of body.lines) {
    if (typeof rawLine !== "string") {
      return invalidRequest("Every lyric line must be text.");
    }
    const source = rawLine.trim();
    if (!source) continue;
    if (source.length > LINE_MAX_CHARACTERS) {
      return invalidRequest(
        `Each lyric line must contain at most ${LINE_MAX_CHARACTERS.toLocaleString()} characters.`,
        "text_too_long",
      );
    }
    if (!JAPANESE_TEXT_PATTERN.test(source) || requestedLines.has(source)) continue;
    requestedLines.add(source);
    uniqueLines.push(source);
    totalSourceCharacters += source.length;
    if (uniqueLines.length > UNIQUE_LINE_LIMIT) {
      return invalidRequest(`Choose no more than ${UNIQUE_LINE_LIMIT} unique Japanese lyric lines.`);
    }
    if (totalSourceCharacters > TOTAL_SOURCE_MAX_CHARACTERS) {
      return invalidRequest(
        `Lyric lines must contain at most ${TOTAL_SOURCE_MAX_CHARACTERS.toLocaleString()} characters in total.`,
        "text_too_long",
      );
    }
  }
  if (uniqueLines.length === 0) {
    return invalidRequest("Include at least one Japanese lyric line.");
  }

  const cachedTranslations = new Map<string, string>();
  const rawCachedTranslations = body.cachedTranslations ?? [];
  if (
    !Array.isArray(rawCachedTranslations)
    || rawCachedTranslations.length > INPUT_ENTRY_LIMIT
  ) {
    return invalidRequest("Cached lyric translations are invalid.");
  }
  let cachedTranslationCharacters = 0;
  for (const rawEntry of rawCachedTranslations) {
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
      return invalidRequest("Cached lyric translations are invalid.");
    }
    const entry = rawEntry as { source?: unknown; translation?: unknown };
    if (typeof entry.source !== "string" || typeof entry.translation !== "string") {
      return invalidRequest("Cached lyric translations are invalid.");
    }
    const source = entry.source.trim();
    const translation = entry.translation.trim();
    if (!requestedLines.has(source)) {
      return invalidRequest("Cached translations must belong to a requested lyric line.");
    }
    if (!translation || translation.length > CACHED_TRANSLATION_MAX_CHARACTERS) {
      return invalidRequest("Cached lyric translations must contain usable bounded text.");
    }
    cachedTranslationCharacters += translation.length;
    if (cachedTranslationCharacters > CACHED_TRANSLATION_TOTAL_MAX_CHARACTERS) {
      return invalidRequest("Cached lyric translations are too large.", "text_too_long");
    }
    cachedTranslations.set(source, translation);
  }

  const encoder = new TextEncoder();
  const streamAbortController = new AbortController();
  const operationSignal = AbortSignal.any([
    request.signal,
    streamAbortController.signal,
    AbortSignal.timeout(OPERATION_TIMEOUT_MS),
  ]);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let sentTranslations = 0;
      let previousSource: string | null = null;
      let previousTranslation: string | null = null;
      let skippedLongLines = false;
      let truncatedTranslation = false;

      const close = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch { /* The browser may already have canceled the reader. */ }
      };
      const send = (event: Record<string, unknown>) => {
        if (closed || request.signal.aborted || streamAbortController.signal.aborted) return false;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
          return true;
        } catch {
          closed = true;
          streamAbortController.abort();
          return false;
        }
      };
      const finishFailure = (failure: SafeFailure) => {
        if (sentTranslations > 0) {
          const skippedWarning = skippedLongLines
            ? "Some lyric lines were too long for JPDB translation. "
            : "";
          send({
            type: "complete",
            warning: `${skippedWarning}${failure.message}`,
            code: failure.code,
          });
        } else {
          send({ type: "error", error: failure.message, code: failure.code });
        }
        close();
      };

      void (async () => {
        for (const source of uniqueLines) {
          if (operationSignal.aborted) {
            if (!request.signal.aborted && !streamAbortController.signal.aborted) {
              finishFailure(operationFailure(operationSignal, new DOMException("Timed out", "TimeoutError")));
            } else {
              close();
            }
            return;
          }

          const cachedTranslation = cachedTranslations.get(source);
          if (cachedTranslation) {
            if (!send({ type: "translation", source, translation: cachedTranslation })) return;
            sentTranslations += 1;
            previousSource = source;
            previousTranslation = cachedTranslation;
            continue;
          }

          try {
            const response = await fetch(JPDB_JA2EN_ENDPOINT, {
              method: "POST",
              headers: {
                Accept: "application/json",
                "Content-Type": "application/json",
                Authorization: `Bearer ${normalizedApiKey}`,
              },
              body: JSON.stringify({
                text: source,
                ...(previousSource && previousTranslation
                  ? { context: [previousSource, previousTranslation] }
                  : {}),
              }),
              signal: operationSignal,
              cache: "no-store",
            });

            let payload: JpdbTranslationPayload | null = null;
            try {
              payload = await readBoundedJson(response, RESPONSE_MAX_BYTES) as JpdbTranslationPayload | null;
            } catch (error) {
              if (operationSignal.aborted || (error instanceof Error && error.name === "TimeoutError")) {
                throw error;
              }
            }

            if (!response.ok) {
              const failure = providerFailure(response, payload);
              if (failure.code === "text_too_long") {
                skippedLongLines = true;
                continue;
              }
              finishFailure(failure);
              return;
            }

            if (!payload || typeof payload.text !== "string") {
              finishFailure({
                code: "provider_error",
                message: "JPDB returned no usable translation.",
                status: 502,
              });
              return;
            }

            const translatedText = payload.text.trim();
            if (!translatedText) continue;
            if (translatedText.length > CACHED_TRANSLATION_MAX_CHARACTERS) {
              finishFailure({
                code: "provider_error",
                message: "JPDB returned no usable translation.",
                status: 502,
              });
              return;
            }

            if (!send({ type: "translation", source, translation: translatedText })) return;
            sentTranslations += 1;
            previousSource = source;
            previousTranslation = translatedText;
            if (payload?.is_truncated === true) truncatedTranslation = true;
          } catch (error) {
            if (request.signal.aborted || streamAbortController.signal.aborted) {
              close();
              return;
            }
            finishFailure(operationFailure(operationSignal, error));
            return;
          }
        }

        const warning = skippedLongLines
          ? "Some lyric lines were too long for JPDB translation."
          : truncatedTranslation
            ? "JPDB shortened some lyric translations."
            : null;
        send({
          type: "complete",
          ...(warning ? { warning, code: "text_too_long" } : {}),
        });
        close();
      })().catch((error: unknown) => {
        if (request.signal.aborted || streamAbortController.signal.aborted) {
          close();
          return;
        }
        finishFailure(operationFailure(operationSignal, error));
      });
    },
    cancel() {
      streamAbortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "private, no-store, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
