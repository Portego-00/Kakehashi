import { NextResponse } from "next/server";
import { isSameOriginRequest, readBoundedRequestJson, readBoundedText } from "@/features/content/server-security";
import { parseYouTubeTranscriptMarkdown } from "@/features/content/youtube-transcript";
import { clientAddress } from "@/lib/server/request-security";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";

export const runtime = "nodejs";

const TRANSCRIPT_API_ROOT = "https://youtube-transcript.ai/transcript";
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const LANGUAGE_RE = /^[A-Za-z0-9-]{2,20}$/;
const REQUEST_MAX_BYTES = 2_000;
const RESPONSE_MAX_BYTES = 2_000_000;
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60 * 60_000;

function rateLimitHeaders(limit: ReturnType<typeof takeRateLimit>) {
  return {
    "Retry-After": String(limit.retryAfterSeconds),
    "RateLimit-Limit": String(limit.limit),
    "RateLimit-Remaining": String(limit.remaining),
    "RateLimit-Reset": String(Math.ceil(limit.resetAt / 1_000)),
  };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin transcript requests are blocked." }, { status: 403 });
  }

  const limit = takeRateLimit(opaqueRateLimitKey("youtube-transcript", clientAddress(request)), RATE_LIMIT, RATE_WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many transcript requests. Try again later." },
      { status: 429, headers: rateLimitHeaders(limit) },
    );
  }

  let body: { videoId?: unknown; language?: unknown };
  try {
    body = await readBoundedRequestJson(request, REQUEST_MAX_BYTES) as typeof body;
  } catch {
    return NextResponse.json({ error: "Transcript request must be valid JSON." }, { status: 400 });
  }

  if (typeof body.videoId !== "string" || !VIDEO_ID_RE.test(body.videoId)) {
    return NextResponse.json({ error: "Enter a valid YouTube video URL." }, { status: 400 });
  }
  const language = typeof body.language === "string" && LANGUAGE_RE.test(body.language) ? body.language : "ja";
  const url = `${TRANSCRIPT_API_ROOT}/${body.videoId}.txt?lang=${encodeURIComponent(language)}`;

  try {
    const response = await fetch(url, {
      headers: { Accept: "text/markdown,text/plain;q=0.9" },
      signal: AbortSignal.timeout(15_000),
      next: { revalidate: 86_400 },
    });
    if (!response.ok) {
      if (response.status === 404) {
        return NextResponse.json({ error: "No captions are available for this YouTube video." }, { status: 422 });
      }
      if (response.status === 429) {
        return NextResponse.json(
          { error: "The free transcript service is busy. Try again in a minute." },
          { status: 429, headers: response.headers.get("retry-after") ? { "Retry-After": response.headers.get("retry-after")! } : undefined },
        );
      }
      return NextResponse.json({ error: "YouTube captions are temporarily unavailable." }, { status: 502 });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/markdown") && !contentType.includes("text/plain")) {
      return NextResponse.json({ error: "The transcript service returned an unexpected response." }, { status: 502 });
    }
    const transcript = parseYouTubeTranscriptMarkdown(await readBoundedText(response, RESPONSE_MAX_BYTES));
    return NextResponse.json(transcript, {
      headers: { "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("No timed captions")) {
      return NextResponse.json({ error: "No usable timed captions were found for this YouTube video." }, { status: 422 });
    }
    if (message.includes("too large")) {
      return NextResponse.json({ error: "This YouTube transcript is too large to import." }, { status: 413 });
    }
    return NextResponse.json(
      { error: error instanceof Error && error.name === "TimeoutError" ? "The transcript request timed out." : "YouTube captions are temporarily unavailable." },
      { status: 502 },
    );
  }
}
