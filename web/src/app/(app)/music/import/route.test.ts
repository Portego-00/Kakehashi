import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

import { clearRateLimitsForTests } from "@/lib/server/rate-limit";
import { POST } from "./route";

const track = {
  id: "spotify-track",
  title: "夜に駆ける",
  artist: "YOASOBI",
  artistId: "artist-id",
  albumArt: "https://i.scdn.co/image/art",
  spotifyUrl: "https://open.spotify.com/track/spotify-track",
  previewUrl: null,
  durationMs: 261_000,
  albumName: "THE BOOK",
  releaseDate: "2021-01-06",
};

function request(body: unknown, origin = "http://localhost:3100") {
  return new NextRequest("http://localhost:3100/music/import", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      host: "localhost:3100",
      origin,
      "x-forwarded-for": "203.0.113.33",
    },
    body: JSON.stringify(body),
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("music import route", () => {
  beforeEach(() => {
    clearRateLimitsForTests();
    vi.stubEnv("YOUTUBE_API_KEY", "youtube-key");
    vi.stubEnv("EXPO_PUBLIC_YOUTUBE_API_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_YOUTUBE_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("combines exact LRCLIB lyrics with the closest playable YouTube result", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("lrclib.net/api/get?")) {
        return json({
          id: 44,
          trackName: "夜に駆ける",
          artistName: "YOASOBI",
          albumName: "THE BOOK",
          duration: 261,
          plainLyrics: "沈むように",
          syncedLyrics: "[00:01.00]沈むように",
        });
      }
      if (url.includes("lrclib.net/api/search?")) {
        return json([{
          id: 44,
          trackName: "夜に駆ける",
          artistName: "YOASOBI",
          albumName: "THE BOOK",
          duration: 261,
          plainLyrics: "沈むように",
          syncedLyrics: "[00:01.00]沈むように",
        }, {
          id: 45,
          trackName: "夜に駆ける",
          artistName: "YOASOBI",
          albumName: "THE BOOK",
          duration: 260,
          plainLyrics: "沈むように溶けてゆくように",
          syncedLyrics: null,
        }]);
      }
      if (url.includes("youtube/v3/search?")) {
        return json({ items: [{ id: { videoId: "official-video" } }] });
      }
      if (url.includes("youtube/v3/videos?")) {
        return json({ items: [{
          id: "official-video",
          snippet: {
            title: "YOASOBI『夜に駆ける』 Official Music Video",
            channelTitle: "Ayase / YOASOBI",
            thumbnails: { high: { url: "https://i.ytimg.com/vi/official-video/hqdefault.jpg" } },
          },
          contentDetails: { duration: "PT4M21S" },
          status: { embeddable: true, privacyStatus: "public" },
        }] });
      }
      throw new Error(`Unexpected provider URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ track }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      track,
      lyrics: expect.objectContaining({ id: 44, syncedLyrics: "[00:01.00]沈むように" }),
      lyricsResults: [
        expect.objectContaining({ id: 44, syncedLyrics: "[00:01.00]沈むように" }),
        expect.objectContaining({ id: 45, syncedLyrics: null }),
      ],
      lyricsWarning: null,
      video: expect.objectContaining({ videoId: "official-video", duration: 261 }),
      videoWarning: null,
    }));
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("returns a usable song payload when neither lyrics nor a video can be matched", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("lrclib.net/api/get?")) return json({ error: "not found" }, 404);
      if (url.includes("lrclib.net/api/search?")) return json([]);
      if (url.includes("youtube/v3/search?")) return json({ items: [] });
      throw new Error(`Unexpected provider URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ track }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      track,
      lyrics: null,
      lyricsResults: [],
      lyricsWarning: "No usable lyrics were found.",
      video: null,
      videos: [],
      videoWarning: "No embeddable YouTube match was found.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("searches only LRCLIB with user-edited song and artist fields", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("lrclib.net/api/get?")) return json({ error: "not found" }, 404);
      if (url.includes("lrclib.net/api/search?")) return json([{
        id: 72,
        trackName: "群青 - Live",
        artistName: "YOASOBI",
        albumName: "Live Session",
        duration: 265,
        plainLyrics: "嗚呼いつもの様に\n過ぎる日々にあくびが出る",
        syncedLyrics: "[00:01.00]嗚呼いつもの様に\n[00:04.00]過ぎる日々にあくびが出る",
      }]);
      throw new Error(`Unexpected provider URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({
      track,
      source: "lyrics",
      lyricsTrack: "群青 - Live",
      lyricsArtist: "YOASOBI",
    }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      lyricsResults: [expect.objectContaining({ id: 72 })],
      videos: [],
      videoWarning: null,
    }));
    const searchUrl = new URL(fetchMock.mock.calls.map(([input]) => String(input)).find((url) => url.includes("/search?"))!);
    expect(searchUrl.searchParams.get("track_name")).toBe("群青 - Live");
    expect(searchUrl.searchParams.get("artist_name")).toBe("YOASOBI");
    expect(fetchMock.mock.calls.every(([input]) => !String(input).includes("youtube"))).toBe(true);
  });

  it("searches only YouTube with a user-edited video query", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("youtube/v3/search?")) return json({ items: [{ id: { videoId: "live-video" } }] });
      if (url.includes("youtube/v3/videos?")) return json({ items: [{
        id: "live-video",
        snippet: {
          title: "YOASOBI 群青 Live",
          channelTitle: "YOASOBI",
          thumbnails: { high: { url: "https://i.ytimg.com/vi/live-video/hqdefault.jpg" } },
        },
        contentDetails: { duration: "PT4M25S" },
        status: { embeddable: true, privacyStatus: "public" },
      }] });
      throw new Error(`Unexpected provider URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ track, source: "video", videoQuery: "YOASOBI 群青 live" }));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({
      lyricsResults: [],
      lyricsWarning: null,
      videos: [expect.objectContaining({ videoId: "live-video" })],
    }));
    const searchUrl = new URL(fetchMock.mock.calls.map(([input]) => String(input)).find((url) => url.includes("youtube/v3/search?"))!);
    expect(searchUrl.searchParams.get("q")).toBe("YOASOBI 群青 live");
    expect(fetchMock.mock.calls.every(([input]) => !String(input).includes("lrclib"))).toBe(true);
  });

  it("rejects cross-origin imports before contacting providers", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await POST(request({ track }, "https://attacker.example"))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
