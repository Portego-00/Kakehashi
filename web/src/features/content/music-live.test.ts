import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { findLrclibLyrics, findYouTubeVideos } from "./music-server";

const liveDescribe = process.env.KAKEHASHI_LIVE_MUSIC_TEST === "1" ? describe : describe.skip;

liveDescribe("live music providers", () => {
  it("resolves synced LRCLIB lyrics and an embeddable YouTube match", async () => {
    const [lyrics, videos] = await Promise.all([
      findLrclibLyrics("夜に駆ける", "YOASOBI", "", 267),
      findYouTubeVideos("夜に駆ける", "YOASOBI", 267),
    ]);
    expect(lyrics.artistName).toMatch(/YOASOBI/i);
    expect(lyrics.syncedLyrics || lyrics.plainLyrics).toBeTruthy();
    expect(videos[0]).toEqual(expect.objectContaining({ videoId: expect.stringMatching(/^[\w-]{11}$/) }));
  }, 20_000);
});
