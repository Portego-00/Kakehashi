import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

import { clearRateLimitsForTests } from "@/lib/server/rate-limit";
import { GET } from "./route";

function request(query: string) {
  return new NextRequest(`http://localhost:3100/music/lrclib?${query}`, { headers: { host: "localhost:3100", "x-forwarded-for": "203.0.113.32" } });
}

describe("LRCLIB music route", () => {
  beforeEach(() => clearRateLimitsForTests());
  afterEach(() => vi.unstubAllGlobals());

  it("uses exact metadata, including duration, before fuzzy search", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(JSON.stringify({
      id: 22,
      trackName: "Kaikai Kitan",
      artistName: "Eve",
      albumName: "Kaikai Kitan",
      duration: 221,
      plainLyrics: "lyrics",
      syncedLyrics: "[00:01.00]lyrics",
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await GET(request(new URLSearchParams({ track: "Kaikai Kitan", artist: "Eve", album: "Kaikai Kitan", duration: "221" }).toString()));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ id: 22, artistName: "Eve" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/get?");
  });

  it("accepts only public LRCLIB record URLs", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    expect((await GET(request(`url=${encodeURIComponent("https://example.com/api/get/12")}`))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
