import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

import { resetMusicProviderCacheForTests } from "@/features/content/music-server";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";
import { GET } from "./route";

function request() {
  return new NextRequest("http://localhost:3100/music/discover", {
    headers: { host: "localhost:3100", "x-forwarded-for": "203.0.113.35" },
  });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("Spotify music discovery route", () => {
  beforeEach(() => {
    clearRateLimitsForTests();
    resetMusicProviderCacheForTests();
    vi.stubEnv("SPOTIFY_CLIENT_ID", "client-id");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "client-secret");
    vi.stubEnv("EXPO_PUBLIC_SPOTIFY_CLIENT_ID", "");
    vi.stubEnv("EXPO_PUBLIC_SPOTIFY_CLIENT_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    resetMusicProviderCacheForTests();
  });

  it("returns three normalized recommendation shelves without exposing its token", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.includes("accounts.spotify.com")) return json({ access_token: "private-access-token", expires_in: 3_600 });
      if (url.includes("api.spotify.com/v1/search")) {
        const query = new URL(url).searchParams.get("q") || "";
        return json({ tracks: { items: [{
          id: `track-${query}`,
          name: query.includes("anime") ? "残響散歌" : "アイドル",
          artists: [{ id: "artist-id", name: query.includes("anime") ? "Aimer" : "YOASOBI" }],
          album: { name: "Japanese music", images: [], release_date: "2026-08-01" },
          external_urls: { spotify: "https://open.spotify.com/track/example" },
          duration_ms: 213_000,
          preview_url: null,
        }] } });
      }
      throw new Error(`Unexpected provider URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request());
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.sections).toEqual([
      expect.objectContaining({ id: "new-japanese", title: "New Japanese releases", tracks: [expect.objectContaining({ title: "アイドル" })] }),
      expect.objectContaining({ id: "popular-jpop", title: "Popular J-pop", tracks: [expect.objectContaining({ artist: "YOASOBI" })] }),
      expect.objectContaining({ id: "anime-songs", title: "Anime songs", tracks: [expect.objectContaining({ title: "残響散歌", artist: "Aimer" })] }),
    ]);
    expect(JSON.stringify(payload)).not.toContain("private-access-token");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const discoveryRequests = fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes("api.spotify.com/v1/search"));
    expect(discoveryRequests).toHaveLength(3);
    expect(discoveryRequests.every((url) => new URL(url).searchParams.get("limit") === "18")).toBe(true);
  });

  it("reports missing server configuration explicitly", async () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "");
    const response = await GET(request());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Spotify song search is not configured on this server." });
  });
});
