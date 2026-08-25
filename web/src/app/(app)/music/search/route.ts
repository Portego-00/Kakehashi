import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { searchSpotifyTracks, MusicProviderError } from "@/features/content/music-server";
import { readBoundedRequestJson } from "@/features/content/server-security";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { clientAddress, isTrustedMutationOrigin } from "@/lib/server/request-security";

const searchSchema = z.object({ query: z.string().trim().min(1).max(160) });

function providerFailure(error: unknown) {
  const failure = error instanceof MusicProviderError ? error : new MusicProviderError("Spotify song search is unavailable.", 502);
  return NextResponse.json({ error: failure.message }, {
    status: failure.status,
    headers: { "Cache-Control": "private, no-store", ...(failure.retryAfter ? { "Retry-After": failure.retryAfter } : {}) },
  });
}

export async function POST(request: NextRequest) {
  if (!isTrustedMutationOrigin(request)) return NextResponse.json({ error: "This search did not originate from Kakehashi." }, { status: 403 });
  const limit = takeRateLimit(opaqueRateLimitKey("music-search", clientAddress(request)), 30, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many song searches. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  let raw: unknown;
  try { raw = await readBoundedRequestJson(request, 4_000); }
  catch { return NextResponse.json({ error: "The song search request is invalid." }, { status: 400 }); }
  const parsed = searchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Enter a song, artist, or album to search." }, { status: 422 });
  try {
    const tracks = await searchSpotifyTracks(parsed.data.query);
    return NextResponse.json({ provider: "spotify", tracks }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return providerFailure(error); }
}
