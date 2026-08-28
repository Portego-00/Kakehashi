import { describe, expect, it } from "vitest";
import {
  buildMangaSpreads,
  mangaPageSide,
  mangaSpreadIndexForPage,
  type MangaPagePlacement,
} from "../manga-pagination";

describe("manga spread planning", () => {
  it("keeps the cover separate and pairs following pages", () => {
    const spreads = buildMangaSpreads(6, { twoPage: true });

    expect(spreads.map((spread) => spread.pages)).toEqual([[1], [2, 3], [4, 5], [6]]);
    expect(spreads.map((spread) => spread.resumePage)).toEqual([1, 3, 5, 6]);
    expect(spreads.map((spread) => spread.key)).toEqual(["1", "2-3", "4-5", "6"]);
  });

  it("uses single pages when two-page reading is disabled", () => {
    const spreads = buildMangaSpreads(4, { twoPage: false });

    expect(spreads.map((spread) => spread.pages)).toEqual([[1], [2], [3], [4]]);
    expect(spreads.every((spread) => !spread.twoPage)).toBe(true);
  });

  it("honors center pages and authored left/right placement", () => {
    const placements: MangaPagePlacement[] = ["right", "right", "left", "center", "right", "right"];
    const spreads = buildMangaSpreads(6, { twoPage: true, placements, direction: "rtl" });

    expect(spreads.map((spread) => spread.pages)).toEqual([[1], [2, 3], [4], [5], [6]]);
    expect(mangaPageSide(spreads[3], 5, "rtl", placements[4])).toBe("right");
    expect(mangaPageSide(spreads[4], 6, "rtl", placements[5])).toBe("right");
  });

  it("maps logical pages to visual slots for both reading directions", () => {
    const spread = buildMangaSpreads(3, { twoPage: true })[1];

    expect(mangaPageSide(spread, 2, "rtl", null)).toBe("right");
    expect(mangaPageSide(spread, 3, "rtl", null)).toBe("left");
    expect(mangaPageSide(spread, 2, "ltr", null)).toBe("left");
    expect(mangaPageSide(spread, 3, "ltr", null)).toBe("right");
    expect(mangaPageSide(spread, 2, "rtl", "left")).toBe("left");
    expect(mangaPageSide(buildMangaSpreads(1, { twoPage: false })[0], 1, "rtl", "right")).toBe("center");
  });

  it("finds the containing spread for saved and out-of-range page positions", () => {
    const spreads = buildMangaSpreads(6, { twoPage: true });

    expect(mangaSpreadIndexForPage(spreads, 3)).toBe(1);
    expect(mangaSpreadIndexForPage(spreads, 99)).toBe(3);
    expect(mangaSpreadIndexForPage(spreads, 0)).toBe(0);
    expect(mangaSpreadIndexForPage([], 1)).toBe(-1);
  });

  it("returns no spreads for an invalid or empty page count", () => {
    expect(buildMangaSpreads(0, { twoPage: true })).toEqual([]);
    expect(buildMangaSpreads(Number.NaN, { twoPage: true })).toEqual([]);
  });
});
