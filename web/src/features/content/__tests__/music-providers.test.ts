import { describe, expect, it } from "vitest";
import { formatTrackDuration, parseIsoDuration, rankYouTubeVideos, type YouTubeVideo } from "../music-providers";

const video = (videoId: string, title: string, duration: number): YouTubeVideo => ({
  videoId,
  title,
  duration,
  channelTitle: "Channel",
  thumbnailUrl: "https://example.com/thumb.jpg",
});

describe("music provider helpers", () => {
  it("parses provider durations and formats Spotify milliseconds", () => {
    expect(parseIsoDuration("PT4M13S")).toBe(253);
    expect(parseIsoDuration("PT1H2M10S")).toBe(3_730);
    expect(parseIsoDuration("not-a-duration")).toBe(0);
    expect(formatTrackDuration(253_000)).toBe("4:13");
  });

  it("filters alternate versions and ranks the closest clean YouTube match", () => {
    const ranked = rankYouTubeVideos([
      video("cover", "Song cover", 250),
      video("far", "Song official video", 290),
      video("close", "Song official music video", 254),
    ], 253);
    expect(ranked.map((item) => item.videoId)).toEqual(["close", "far"]);
  });

  it("falls back to alternate versions if YouTube returns nothing else", () => {
    expect(rankYouTubeVideos([video("live", "Song live", 240)], 241)[0]?.videoId).toBe("live");
  });
});
