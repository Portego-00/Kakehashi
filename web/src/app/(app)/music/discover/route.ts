import { NextRequest, NextResponse } from "next/server";
import { discoverSpotifyTracks, MusicProviderError } from "@/features/content/music-server";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { clientAddress } from "@/lib/server/request-security";

const sections = [
  { id: "new-japanese", title: "New Japanese releases", query: "tag:new genre:j-pop" },
  { id: "popular-jpop", title: "Popular J-pop", query: "genre:j-pop" },
  { id: "anime-songs", title: "Anime songs", query: "anime opening Japanese" },
];

export async function GET(request: NextRequest) {
  const limit = takeRateLimit(opaqueRateLimitKey("music-discover", clientAddress(request)), 12, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Music recommendations are refreshing too often. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  try {
    const results = await discoverSpotifyTracks(sections);
    return NextResponse.json({ sections: results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = error instanceof MusicProviderError ? error : new MusicProviderError("Music recommendations are unavailable.", 502);
    return NextResponse.json({ error: failure.message }, {
      status: failure.status,
      headers: { "Cache-Control": "private, no-store", ...(failure.retryAfter ? { "Retry-After": failure.retryAfter } : {}) },
    });
  }
}
