import { NextRequest, NextResponse } from "next/server";
import { AnimeSyncError, syncWatchedAnime } from "@/features/anime/server";
import type { AnimeListProvider } from "@/features/anime/types";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { clientAddress, isTrustedMutationOrigin } from "@/lib/server/request-security";

const USERNAME_PATTERN = /^[\p{L}\p{N}_.-]+$/u;

export async function POST(request: NextRequest) {
  if (!isTrustedMutationOrigin(request)) return NextResponse.json({ error: "Untrusted request origin." }, { status: 403 });
  const limit = takeRateLimit(opaqueRateLimitKey("anime-list-sync", clientAddress(request)), 8, 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Anime list sync is being requested too often. Try again shortly." }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  try {
    const body = await request.json() as { provider?: unknown; username?: unknown };
    const provider = body.provider === "myanimelist" || body.provider === "anilist" ? body.provider as AnimeListProvider : null;
    const username = typeof body.username === "string" ? body.username.trim() : "";
    if (!provider || !username || username.length > 64 || !USERNAME_PATTERN.test(username)) return NextResponse.json({ error: "Enter a valid MyAnimeList or AniList username." }, { status: 400 });
    return NextResponse.json(await syncWatchedAnime(provider, username), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const failure = error instanceof AnimeSyncError ? error : new AnimeSyncError("The anime list could not be synced.");
    return NextResponse.json({ error: failure.message }, { status: failure.status, headers: { "Cache-Control": "private, no-store" } });
  }
}
