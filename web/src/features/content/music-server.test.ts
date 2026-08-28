import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { findLrclibLyrics, findYouTubeVideos, MusicProviderError, resetMusicProviderCacheForTests, searchSpotifyTracks } from "./music-server";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("music provider server", () => {
  beforeEach(() => {
    resetMusicProviderCacheForTests();
    vi.stubEnv("SPOTIFY_CLIENT_ID", "client-id");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "client-secret");
    vi.stubEnv("EXPO_PUBLIC_SPOTIFY_CLIENT_ID", "");
    vi.stubEnv("EXPO_PUBLIC_SPOTIFY_CLIENT_KEY", "");
    vi.stubEnv("YOUTUBE_API_KEY", "youtube-key");
    vi.stubEnv("EXPO_PUBLIC_YOUTUBE_API_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_YOUTUBE_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetMusicProviderCacheForTests();
  });

  it("normalizes Spotify tracks and reuses its client-credentials token", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ access_token: "server-token", expires_in: 3_600 }))
      .mockResolvedValueOnce(json({ tracks: { items: [{
        id: "spotify-track",
        name: "夜に駆ける",
        artists: [{ id: "artist", name: "YOASOBI" }],
        album: { name: "THE BOOK", release_date: "2021-01-06", images: [{ url: "https://i.scdn.co/image/small", height: 64 }, { url: "https://i.scdn.co/image/large", height: 640 }] },
        external_urls: { spotify: "https://open.spotify.com/track/spotify-track" },
        preview_url: null,
        duration_ms: 261_000,
      }] } }))
      .mockResolvedValueOnce(json({ tracks: { items: [] } }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(searchSpotifyTracks("YOASOBI")).resolves.toEqual([expect.objectContaining({
      id: "spotify-track",
      title: "夜に駆ける",
      artist: "YOASOBI",
      albumArt: "https://i.scdn.co/image/large",
      durationMs: 261_000,
    })]);
    await searchSpotifyTracks("Ado");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("accounts.spotify.com"))).toHaveLength(1);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("market=JP");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("limit=10");
  });

  it("fails explicitly without exposing or attempting missing Spotify credentials", async () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(searchSpotifyTracks("YOASOBI")).rejects.toEqual(expect.objectContaining<Partial<MusicProviderError>>({ status: 503 }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("selects an embeddable clean YouTube video closest to the Spotify duration", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ items: [{ id: { videoId: "age-restricted" } }, { id: { videoId: "cover-video" } }, { id: { videoId: "official-video" } }] }))
      .mockResolvedValueOnce(json({ items: [
        { id: "age-restricted", snippet: { title: "Song Official MV", channelTitle: "Artist", thumbnails: { high: { url: "https://example.com/restricted.jpg" } } }, contentDetails: { duration: "PT4M13S", contentRating: { ytRating: "ytAgeRestricted" } }, status: { embeddable: true, privacyStatus: "public" } },
        { id: "cover-video", snippet: { title: "Song cover", channelTitle: "Fan", thumbnails: { high: { url: "https://example.com/cover.jpg" } } }, contentDetails: { duration: "PT4M10S" }, status: { embeddable: true, privacyStatus: "public" } },
        { id: "official-video", snippet: { title: "Song Official MV", channelTitle: "Artist", thumbnails: { high: { url: "https://example.com/official.jpg" } } }, contentDetails: { duration: "PT4M13S" }, status: { embeddable: true, privacyStatus: "public" } },
      ] })));
    await expect(findYouTubeVideos("Song", "Artist", 253)).resolves.toEqual([
      expect.objectContaining({ videoId: "official-video", duration: 253 }),
    ]);
  });

  it("uses LRCLIB exact matching before fuzzy results for the Eve regression", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(json({
      id: 12,
      trackName: "Kaikai Kitan",
      artistName: "Eve",
      albumName: "Kaikai Kitan",
      duration: 221,
      plainLyrics: "lyrics",
      syncedLyrics: "[00:01.00]lyrics",
    }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(findLrclibLyrics("Kaikai Kitan", "Eve", "Kaikai Kitan", 221)).resolves.toEqual(expect.objectContaining({ artistName: "Eve", id: 12 }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/get?");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("duration=221");
  });

  it("falls back to the best-scoring LRCLIB search result", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ error: "not found" }, 404))
      .mockResolvedValueOnce(json([
        { id: 1, trackName: "Kaikai Kitan", artistName: "eve eve", albumName: "", duration: 220, plainLyrics: "wrong", syncedLyrics: "[00:01.00]wrong" },
        { id: 2, trackName: "Kaikai Kitan", artistName: "Eve", albumName: "", duration: 221, plainLyrics: "right", syncedLyrics: "[00:01.00]right" },
      ])));
    await expect(findLrclibLyrics("Kaikai Kitan", "Eve", "", 221)).resolves.toEqual(expect.objectContaining({ id: 2, artistName: "Eve" }));
  });
});
