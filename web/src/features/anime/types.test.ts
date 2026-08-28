import { describe, expect, it } from "vitest";
import { ALL_ANIME_SOURCE, NO_ANIME_SOURCE, hasSelectedAnime, normalizeAnimeSelection, selectedAnimeIds, toggleAnimeSelection, type AnimeCatalogItem } from "./types";

const catalog = ["death_note", "your_name"].map((id) => ({ id, title: id, malTitle: null, imageUrl: null, synopsis: null, score: null, episodes: null, mediaType: null, malId: null, aniListId: null })) satisfies AnimeCatalogItem[];

describe("anime selection", () => {
  it("represents all and none without persisting the complete catalog", () => {
    expect(selectedAnimeIds([ALL_ANIME_SOURCE], catalog)).toEqual(["death_note", "your_name"]);
    expect(selectedAnimeIds([NO_ANIME_SOURCE], catalog)).toEqual([]);
    expect(hasSelectedAnime([ALL_ANIME_SOURCE])).toBe(true);
    expect(hasSelectedAnime([NO_ANIME_SOURCE])).toBe(false);
  });

  it("expands all when one title is deselected and compacts a full selection", () => {
    expect(toggleAnimeSelection([ALL_ANIME_SOURCE], "death_note", catalog)).toEqual(["your_name"]);
    expect(normalizeAnimeSelection(["your_name", "death_note"], catalog)).toEqual([ALL_ANIME_SOURCE]);
    expect(normalizeAnimeSelection([], catalog)).toEqual([NO_ANIME_SOURCE]);
  });
});
