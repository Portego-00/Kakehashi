import { beforeEach, describe, expect, it } from "vitest";
import {
  loadSongLyricTranslations,
  removeSongLyricTranslations,
  saveSongLyricTranslations,
} from "./music-translations";

describe("song lyric translation cache", () => {
  beforeEach(() => window.localStorage.clear());

  it("keeps translations for the matching lyric source and drops stale or invalid entries", () => {
    const source = "猫と犬が空を見る\n山と川を歩く";
    const lines = ["猫と犬が空を見る", "山と川を歩く"];
    expect(saveSongLyricTranslations("song-1", source, lines, {
      "猫と犬が空を見る": "Cats and dogs look at the sky.",
      "山と川を歩く": "Walking by mountains and rivers.",
      "月と星が光る": "This line is not in the song.",
    })).toBe(true);

    expect(loadSongLyricTranslations("song-1", source, lines)).toEqual({
      "猫と犬が空を見る": "Cats and dogs look at the sky.",
      "山と川を歩く": "Walking by mountains and rivers.",
    });
    expect(loadSongLyricTranslations("song-1", `${source}\n花と鳥が歌う`, lines)).toEqual({});

    removeSongLyricTranslations("song-1");
    expect(loadSongLyricTranslations("song-1", source, lines)).toEqual({});
  });
});
