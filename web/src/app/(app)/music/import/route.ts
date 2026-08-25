import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findLrclibLyrics, findYouTubeVideos, MusicProviderError } from "@/features/content/music-server";
import { readBoundedRequestJson } from "@/features/content/server-security";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { clientAddress, isTrustedMutationOrigin } from "@/lib/server/request-security";

const optionalUrl = z.union([z.literal(""), z.string().url().max(2_048)]);
const trackSchema = z.object({
  id: z.string().trim().max(160).default(""),
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().max(200).default(""),
  artistId: z.string().trim().max(160).default(""),
  albumArt: optionalUrl.default(""),
  spotifyUrl: optionalUrl.default(""),
  previewUrl: z.union([z.null(), optionalUrl]).default(null),
  durationMs: z.number().finite().min(0).max(86_400_000).default(0),
  albumName: z.string().trim().max(240).default(""),
  releaseDate: z.string().trim().max(40).default(""),
});
const importSchema = z.object({ track: trackSchema });

function providerFailure(error: unknown) {
  const failure = error instanceof MusicProviderError ? error : new MusicProviderError("This song could not be imported.", 502);
  return NextResponse.json({ error: failure.message }, {
    status: failure.status,
    headers: { "Cache-Control": "private, no-store", ...(failure.retryAfter ? { "Retry-After": failure.retryAfter } : {}) },
  });
}

export async function POST(request: NextRequest) {
  if (!isTrustedMutationOrigin(request)) return NextResponse.json({ error: "This import did not originate from Kakehashi." }, { status: 403 });
  const limit = takeRateLimit(opaqueRateLimitKey("music-import", clientAddress(request)), 24, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many song imports. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  let raw: unknown;
  try { raw = await readBoundedRequestJson(request, 12_000); }
  catch { return NextResponse.json({ error: "The song import request is invalid." }, { status: 400 }); }
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid song to import." }, { status: 422 });
  const track = parsed.data.track;
  const targetDuration = track.durationMs / 1_000;
  const [lyricsResult, videosResult] = await Promise.allSettled([
    findLrclibLyrics(track.title, track.artist, track.albumName, targetDuration),
    findYouTubeVideos(track.title, track.artist, targetDuration),
  ]);
  if (lyricsResult.status === "rejected") return providerFailure(lyricsResult.reason);
  const videos = videosResult.status === "fulfilled" ? videosResult.value : [];
  const videoWarning = videosResult.status === "rejected"
    ? videosResult.reason instanceof Error ? videosResult.reason.message : "YouTube matching is unavailable."
    : videos.length ? null : "No embeddable YouTube match was found.";
  return NextResponse.json({ track, lyrics: lyricsResult.value, video: videos[0] ?? null, videos, videoWarning }, { headers: { "Cache-Control": "private, no-store" } });
}
