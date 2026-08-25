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
      video: expect.objectContaining({ videoId: "official-video", duration: 261 }),
      videoWarning: null,
    }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rejects cross-origin imports before contacting providers", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await POST(request({ track }, "https://attacker.example"))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
