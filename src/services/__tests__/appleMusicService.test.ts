import fetchMock from "jest-fetch-mock";

import { appleMusicService } from "../appleMusicService";
import { MusicKit } from "@lomray/react-native-apple-music";

jest.mock("@lomray/react-native-apple-music", () => ({
  CatalogSearchType: { SONGS: "songs" },
  MusicKit: { catalogSearch: jest.fn() },
}));

const song = {
  trackId: 1, trackName: "Song", artistName: "Artist", artistId: 2,
  artworkUrl100: "https://example.com/cover.jpg", trackViewUrl: "https://music.apple.com/song/1",
};

describe("Apple Music discovery failures", () => {
  beforeEach(() => {
    fetchMock.resetMocks();
    jest.mocked(MusicKit.catalogSearch).mockReset();
    jest.mocked(MusicKit.catalogSearch).mockResolvedValue({ songs: [], albums: [] });
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it.each(["getNewJapaneseReleases", "getPopularJapaneseSongs", "getAnimeSongs"] as const)(
    "preserves %s failures when no discovery source can load songs", async (method) => {
      const failure = new TypeError("Network request failed");
      fetchMock.mockReject(failure);
      jest.mocked(MusicKit.catalogSearch).mockRejectedValue(failure);
      await expect(appleMusicService[method](20)).rejects.toBe(failure);
    }
  );

  it("preserves HTTP failures for a failed category", async () => {
    fetchMock.mockResponse(JSON.stringify({ error: "Unavailable" }), { status: 503 });
    await expect(appleMusicService.getAnimeSongs()).rejects.toThrow("Apple Music data request failed (503)");
  });

  it("returns songs from successful sources when other sources fail", async () => {
    fetchMock.mockResponse(async (request) => {
      if (new URL(request.url).searchParams.get("id") === "1490256993") {
        return JSON.stringify({ results: [song] });
      }
      throw new TypeError("Network request failed");
    });
    expect(await appleMusicService.getNewJapaneseReleases(20)).toEqual([
      expect.objectContaining({ title: "Song", source: "apple" }),
    ]);
  });

  it("uses the native catalog when the popular-song feed fails", async () => {
    fetchMock.mockReject(new TypeError("Network request failed"));
    jest.mocked(MusicKit.catalogSearch).mockResolvedValue({ albums: [], songs: [{
      id: "1", title: "Catalog song", artistName: "Artist",
      duration: 120, artworkUrl: "https://example.com/cover.jpg",
    }] });
    expect(await appleMusicService.getPopularJapaneseSongs(1)).toEqual([
      expect.objectContaining({ source: "apple" }),
    ]);
  });

  it("uses the release search fallback when artist lookups fail", async () => {
    fetchMock.mockResponse(async (request) => {
      if (new URL(request.url).pathname === "/search") return JSON.stringify({ results: [song] });
      throw new TypeError("Network request failed");
    });
    expect(await appleMusicService.getNewJapaneseReleases()).toEqual([
      expect.objectContaining({ title: "Song" }),
    ]);
  });

  it("uses the anime artist fallback when searches fail", async () => {
    fetchMock.mockResponse(async (request) => {
      if (new URL(request.url).pathname === "/lookup") return JSON.stringify({ results: [song] });
      throw new TypeError("Network request failed");
    });
    expect(await appleMusicService.getAnimeSongs()).toEqual([
      expect.objectContaining({ title: "Song" }),
    ]);
  });

  it("keeps successful empty responses distinct from request failures", async () => {
    fetchMock.mockResponse(JSON.stringify({ results: [], feed: { results: [] } }));
    expect(await appleMusicService.getNewJapaneseReleases()).toEqual([]);
    expect(await appleMusicService.getPopularJapaneseSongs()).toEqual([]);
    expect(await appleMusicService.getAnimeSongs()).toEqual([]);
  });
});
