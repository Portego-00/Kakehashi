import { lyricsService } from "../lyricsService";
import { Platform } from "react-native";

const originalFetch = global.fetch;
const mockFetch = jest.fn();
const lyricRecord = {
  id: 42,
  trackName: "Test Song",
  artistName: "Test Artist",
  albumName: "Test Album",
  duration: 3,
  plainLyrics: "猫がここにいる。",
  syncedLyrics: "[00:01.00]猫がここにいる。",
};

beforeEach(() => {
  global.fetch = mockFetch;
  mockFetch.mockReset();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

it.each(["getLyrics", "searchLyrics", "getLyricsById"] as const)(
  "%s can retrieve lyrics from a provider that requires an identified client",
  async (method) => {
    // LRCLIB requires an application name/version/contact header. Generic
    // native HTTP clients do not provide that application identity themselves.
    mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      const identity = headers.get("User-Agent") || headers.get("X-User-Agent") || headers.get("Lrclib-Client") || "";
      if (!identity.includes("Kakehashi") || !identity.includes("https://kakehashiapp.com")) {
        return { ok: false, status: 520, json: async () => ({ error: "Client identification required" }) };
      }
      return { ok: true, status: 200, json: async () => url.includes("/search?") ? [lyricRecord] : lyricRecord };
    });

    if (method === "searchLyrics") {
      await expect(lyricsService.searchLyrics("Test Song", "Test Artist")).resolves.toEqual([
        expect.objectContaining({ id: 42, trackName: "Test Song", hasSyncedLyrics: true }),
      ]);
    } else {
      const request = method === "getLyricsById"
        ? lyricsService.getLyricsById(42)
        : lyricsService.getLyrics("Test Song", "Test Artist");
      await expect(request).resolves.toEqual({
        plainLyrics: lyricRecord.plainLyrics,
        timedLyrics: [{ startTimeMs: 1000, words: lyricRecord.plainLyrics }],
        duration: 3,
      });
    }
  },
);

it("falls back to an identified search request when exact metadata has no match", async () => {
  mockFetch.mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.includes("/get?")) return { ok: false, status: 404 };
    const headers = new Headers(init?.headers);
    const identity = headers.get("User-Agent") || headers.get("X-User-Agent") || headers.get("Lrclib-Client") || "";
    return identity.includes("Kakehashi")
      ? { ok: true, status: 200, json: async () => [lyricRecord] }
      : { ok: false, status: 520 };
  });
  await expect(lyricsService.getLyrics("Test Song", "Test Artist")).resolves.toMatchObject({ plainLyrics: lyricRecord.plainLyrics });
  expect(mockFetch).toHaveBeenCalledTimes(2);
});

it.each(["getLyrics", "searchLyrics", "getLyricsById"] as const)(
  "%s reports an unavailable provider instead of a missing song for HTTP 520",
  async (method) => {
    mockFetch.mockResolvedValue({ ok: false, status: 520 });
    const request = method === "getLyricsById"
      ? lyricsService.getLyricsById(42)
      : lyricsService[method]("Test Song", "Test Artist");
    await expect(request).rejects.toMatchObject({ message: "LYRICS_UNAVAILABLE", status: 520 });
  },
);

it("does not label an offline request as a missing song", async () => {
  mockFetch.mockRejectedValue(new TypeError("Network request failed"));
  await expect(lyricsService.getLyrics("Test Song", "Test Artist")).rejects.toThrow("LYRICS_UNAVAILABLE");
});

it("reports a missing song only after a successful empty search", async () => {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
  mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });
  await expect(lyricsService.getLyrics("Missing Song", "Test Artist")).rejects.toThrow("LYRICS_NOT_FOUND");
});

it("preserves an exact-lookup failure when the fallback search is empty", async () => {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 520 });
  mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [] });
  await expect(lyricsService.getLyrics("Test Song", "Test Artist")).rejects.toThrow("LYRICS_UNAVAILABLE");
});

it("preserves an exact-lookup failure when fallback search returns 404", async () => {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 520 });
  mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
  await expect(lyricsService.getLyrics("Test Song", "Test Artist")).rejects.toMatchObject({
    message: "LYRICS_UNAVAILABLE", status: 520,
  });
});

it("can recover from a failed exact lookup when search finds the song", async () => {
  mockFetch.mockResolvedValueOnce({ ok: false, status: 520 });
  mockFetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => [lyricRecord] });
  await expect(lyricsService.getLyrics("Test Song", "Test Artist")).resolves.toMatchObject({ plainLyrics: lyricRecord.plainLyrics });
});

it("uses the provider's allowed client header on web without requiring a User-Agent override", async () => {
  jest.replaceProperty(Platform, "OS", "web");
  mockFetch.mockImplementation(async (_url: string, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    // Live LRCLIB preflight allows lrclib-client, but not user-agent.
    if (headers.has("User-Agent") || !headers.get("Lrclib-Client")?.includes("Kakehashi")) {
      throw new TypeError("CORS client-header restriction");
    }
    return { ok: true, status: 200, json: async () => lyricRecord };
  });
  await expect(lyricsService.getLyrics("Test Song", "Test Artist")).resolves.toMatchObject({ plainLyrics: lyricRecord.plainLyrics });
});
