import fetchMock from "jest-fetch-mock";

const VIDEO_ID = "bNf5fBMsEjM";
const video = {
  id: VIDEO_ID,
  snippet: {
    title: "lulu. Frieren music video",
    channelTitle: "Video channel",
    categoryId: "1",
    thumbnails: { high: { url: "https://i.ytimg.com/video.jpg" } },
  },
  contentDetails: { duration: "PT5M3S" },
};

describe("YouTube video selection", () => {
  const originalApiKey = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY;
  let service: typeof import("../youtubeService")["youtubeService"];

  beforeEach(() => {
    fetchMock.resetMocks();
    process.env.EXPO_PUBLIC_YOUTUBE_API_KEY = "test-api-key";
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      service = require("../youtubeService").youtubeService;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalApiKey === undefined) delete process.env.EXPO_PUBLIC_YOUTUBE_API_KEY;
    else process.env.EXPO_PUBLIC_YOUTUBE_API_KEY = originalApiKey;
  });

  it.each([
    VIDEO_ID,
    `  ${VIDEO_ID}  `,
    `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtube.com/watch?list=playlist&v=${VIDEO_ID}&t=100s`,
    `https://m.youtube.com/watch?v=${VIDEO_ID}`,
    `https://music.youtube.com/watch?v=${VIDEO_ID}`,
    `https://youtu.be/${VIDEO_ID}?si=share-token`,
    `youtube.com/watch?v=${VIDEO_ID}`,
  ])("resolves an exact video outside the music category from %s", async (query) => {
    fetchMock.mockResponseOnce(JSON.stringify({ items: [video] }));

    await expect(service.searchVideos(query)).resolves.toEqual([
      {
        videoId: VIDEO_ID,
        title: video.snippet.title,
        channelTitle: video.snippet.channelTitle,
        thumbnail: video.snippet.thumbnails.high.url,
        thumbnailUrl: video.snippet.thumbnails.high.url,
        duration: 303,
      },
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = new URL(String(fetchMock.mock.calls[0][0]));
    expect(request.pathname).toBe("/youtube/v3/videos");
    expect(request.searchParams.get("id")).toBe(VIDEO_ID);
    expect(request.searchParams.get("part")).toBe("contentDetails,snippet");
    expect(request.searchParams.has("videoCategoryId")).toBe(false);
  });

  it.each([
    "lulu GAccel Kun",
    `https://youtube.com.example.com/watch?v=${VIDEO_ID}`,
    `https://example.com/watch?v=${VIDEO_ID}`,
    "https://youtube.com/watch?v=too-short",
    `https://youtu.be/${VIDEO_ID}/extra`,
  ])("keeps normal music search for text or an unsupported link: %s", async (query) => {
    fetchMock.mockResponseOnce(JSON.stringify({ items: [] }));

    await expect(service.searchVideos(query)).resolves.toEqual([]);
    const request = new URL(String(fetchMock.mock.calls[0][0]));
    expect(request.pathname).toBe("/youtube/v3/search");
    expect(request.searchParams.get("q")).toBe(query);
    expect(request.searchParams.get("videoCategoryId")).toBe("10");
  });

  it("reports an unavailable exact video without silently choosing a different video", async () => {
    fetchMock.mockResponseOnce(JSON.stringify({ items: [] }));
    await expect(service.searchVideos(`https://youtu.be/${VIDEO_ID}`)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["Radioactive", "Abracadabra"])("searches an 11-character song title after an empty ID lookup: %s", async (query) => {
    fetchMock.mockResponses(
      JSON.stringify({ items: [] }),
      JSON.stringify({ items: [{ id: { videoId: VIDEO_ID } }] }),
      JSON.stringify({ items: [video] }),
    );

    await expect(service.searchVideos(query, 7)).resolves.toEqual([
      expect.objectContaining({ videoId: VIDEO_ID, duration: 303 }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const lookup = new URL(String(fetchMock.mock.calls[0][0]));
    const search = new URL(String(fetchMock.mock.calls[1][0]));
    const details = new URL(String(fetchMock.mock.calls[2][0]));
    expect(lookup.pathname).toBe("/youtube/v3/videos");
    expect(lookup.searchParams.get("id")).toBe(query);
    expect(search.pathname).toBe("/youtube/v3/search");
    expect(search.searchParams.get("q")).toBe(query);
    expect(search.searchParams.get("videoCategoryId")).toBe("10");
    expect(search.searchParams.get("maxResults")).toBe("7");
    expect(details.searchParams.get("id")).toBe(VIDEO_ID);
  });

  it("keeps the existing search-then-details flow for a normal song query", async () => {
    fetchMock.mockResponses(
      JSON.stringify({ items: [{ id: { videoId: VIDEO_ID } }] }),
      JSON.stringify({ items: [video] }),
    );

    await expect(service.searchVideos("lulu Frieren", 7)).resolves.toEqual([
      expect.objectContaining({ videoId: VIDEO_ID, duration: 303 }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const search = new URL(String(fetchMock.mock.calls[0][0]));
    const details = new URL(String(fetchMock.mock.calls[1][0]));
    expect(search.pathname).toBe("/youtube/v3/search");
    expect(search.searchParams.get("q")).toBe("lulu Frieren");
    expect(search.searchParams.get("videoCategoryId")).toBe("10");
    expect(search.searchParams.get("maxResults")).toBe("7");
    expect(details.pathname).toBe("/youtube/v3/videos");
    expect(details.searchParams.get("id")).toBe(VIDEO_ID);
  });

  it("preserves direct-lookup HTTP failures", async () => {
    fetchMock.mockResponseOnce("{}", { status: 403 });
    await expect(service.searchVideos(VIDEO_ID)).rejects.toThrow("YouTube API error: 403");
  });

  it("preserves direct-lookup network failures", async () => {
    const error = new TypeError("Network request failed");
    fetchMock.mockRejectOnce(error);
    await expect(service.searchVideos(VIDEO_ID)).rejects.toBe(error);
  });
});
