import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

import { resetMusicProviderCacheForTests } from "@/features/content/music-server";
import { clearRateLimitsForTests } from "@/lib/server/rate-limit";
import { POST } from "./route";

function request(body: unknown, origin: string | null = "http://localhost:3100") {
  const headers = new Headers({ "content-type": "application/json", host: "localhost:3100", "x-forwarded-for": "203.0.113.31" });
  if (origin) headers.set("origin", origin);
  return new NextRequest("http://localhost:3100/music/search", { method: "POST", headers, body: JSON.stringify(body) });
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("Spotify music search route", () => {
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

  it("returns normalized Spotify catalog tracks without exposing its token", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>()
      .mockResolvedValueOnce(json({ access_token: "private-access-token", expires_in: 3_600 }))
      .mockResolvedValueOnce(json({ tracks: { items: [{
        id: "track-id",
        name: "アイドル",
        artists: [{ id: "artist-id", name: "YOASOBI" }],
        album: { name: "アイドル", images: [], release_date: "2023-04-12" },
        external_urls: { spotify: "https://open.spotify.com/track/track-id" },
        duration_ms: 213_000,
        preview_url: null,
      }] } })));
    const response = await POST(request({ query: "YOASOBI" }));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload).toEqual({ provider: "spotify", tracks: [expect.objectContaining({ id: "track-id", title: "アイドル", artist: "YOASOBI" })] });
    expect(JSON.stringify(payload)).not.toContain("private-access-token");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("rejects cross-origin and invalid searches before calling Spotify", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await POST(request({ query: "YOASOBI" }, "https://attacker.example"))).status).toBe(403);
    expect((await POST(request({ query: "" }))).status).toBe(422);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports missing server configuration explicitly", async () => {
    vi.stubEnv("SPOTIFY_CLIENT_ID", "");
    vi.stubEnv("SPOTIFY_CLIENT_SECRET", "");
    const response = await POST(request({ query: "YOASOBI" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "Spotify song search is not configured on this server." });
  });
});
