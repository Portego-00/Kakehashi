import { NextRequest, NextResponse } from "next/server";
import { getLrclibLyricsById, findLrclibLyrics, MusicProviderError } from "@/features/content/music-server";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { clientAddress } from "@/lib/server/request-security";

function validLrclibId(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname !== "lrclib.net" && url.hostname !== "www.lrclib.net") return null;
    return url.pathname.match(/^\/api\/get\/(\d+)$/)?.[1] ?? null;
  } catch { return null; }
}

export async function GET(request: NextRequest) {
  const limit = takeRateLimit(opaqueRateLimitKey("music-lrclib", clientAddress(request)), 60, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many lyrics searches. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  try {
    const { searchParams } = request.nextUrl;
    const track = searchParams.get("track")?.trim().slice(0, 160) ?? "";
    const artist = searchParams.get("artist")?.trim().slice(0, 160) ?? "";
    const album = searchParams.get("album")?.trim().slice(0, 200) ?? "";
    const durationValue = Number(searchParams.get("duration") || 0);
    const duration = Number.isFinite(durationValue) ? Math.max(0, Math.min(86_400, durationValue)) : 0;
    const sourceUrl = searchParams.get("url")?.trim().slice(0, 2_048) ?? "";
    let lyrics;
    if (sourceUrl) {
      const id = validLrclibId(sourceUrl);
      if (!id) return NextResponse.json({ error: "Use a public LRCLIB /api/get/{id} URL." }, { status: 400 });
      lyrics = await getLrclibLyricsById(id);
    } else {
      if (!track) return NextResponse.json({ error: "Enter a track title or LRCLIB URL." }, { status: 400 });
      lyrics = await findLrclibLyrics(track, artist, album, duration);
    }
    return NextResponse.json(lyrics, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = error instanceof MusicProviderError ? error : new MusicProviderError("LRCLIB is unavailable.", 502);
    return NextResponse.json({ error: failure.message }, { status: failure.status, headers: failure.retryAfter ? { "Retry-After": failure.retryAfter } : undefined });
  }
}
