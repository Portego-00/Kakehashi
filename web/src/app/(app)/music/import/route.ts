import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findLrclibLyricsCandidates, findYouTubeVideos, findYouTubeVideosByQuery } from "@/features/content/music-server";
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
const importSchema = z.object({
  track: trackSchema,
  source: z.enum(["all", "lyrics", "video"]).default("all"),
  lyricsTrack: z.string().trim().max(200).optional(),
  lyricsArtist: z.string().trim().max(200).optional(),
  videoQuery: z.string().trim().max(300).optional(),
});

export async function POST(request: NextRequest) {
  if (!isTrustedMutationOrigin(request)) return NextResponse.json({ error: "This import did not originate from Kakehashi." }, { status: 403 });
  const limit = takeRateLimit(opaqueRateLimitKey("music-import", clientAddress(request)), 24, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Too many song imports. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  let raw: unknown;
  try { raw = await readBoundedRequestJson(request, 12_000); }
  catch { return NextResponse.json({ error: "The song import request is invalid." }, { status: 400 }); }
  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid song to import." }, { status: 422 });
  const { track, source } = parsed.data;
  const targetDuration = track.durationMs / 1_000;
  const shouldMatchLyrics = source !== "video";
  const shouldMatchVideo = source !== "lyrics";
  const lyricsTrack = parsed.data.lyricsTrack ?? track.title;
  const lyricsArtist = parsed.data.lyricsArtist ?? track.artist;
  const videoQuery = parsed.data.videoQuery || `${track.title} ${track.artist}`.trim();
  const [lyricsResult, videosResult] = await Promise.allSettled([
    shouldMatchLyrics
      ? findLrclibLyricsCandidates(lyricsTrack, lyricsArtist, track.albumName, targetDuration)
      : Promise.resolve([]),
    shouldMatchVideo
      ? parsed.data.videoQuery === undefined
        ? findYouTubeVideos(track.title, track.artist, targetDuration)
        : findYouTubeVideosByQuery(videoQuery, targetDuration)
      : Promise.resolve([]),
  ]);
  const lyricsResults = lyricsResult.status === "fulfilled" ? lyricsResult.value : [];
  const lyricsWarning = !shouldMatchLyrics ? null : lyricsResult.status === "rejected"
    ? lyricsResult.reason instanceof Error ? lyricsResult.reason.message : "Lyrics matching is unavailable."
    : lyricsResults.length ? null : "No usable lyrics were found.";
  const videos = videosResult.status === "fulfilled" ? videosResult.value : [];
  const videoWarning = !shouldMatchVideo ? null : videosResult.status === "rejected"
    ? videosResult.reason instanceof Error ? videosResult.reason.message : "YouTube matching is unavailable."
    : videos.length ? null : "No embeddable YouTube match was found.";
  return NextResponse.json({
    track,
    lyrics: lyricsResults[0] ?? null,
    lyricsResults,
    lyricsWarning,
    video: videos[0] ?? null,
    videos,
    videoWarning,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
