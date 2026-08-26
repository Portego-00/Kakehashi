import { describe, expect, it } from "vitest";
import { appendMangaOcrText, normalizeMangaOcrSelection, normalizeMangaOcrText } from "../manga-ocr";

describe("manga OCR helpers", () => {
  it("preserves recognized spacing and characters while normalizing line endings", () => {
    expect(normalizeMangaOcrText(" 私 が\r\n学校へ 行く！ ")).toBe("私 が\n学校へ 行く！");
  });

  it("appends unique speech bubbles in reading order", () => {
    expect(appendMangaOcrText("私が行く", " 学校へ！ ")).toBe("私が行く\n学校へ！");
    expect(appendMangaOcrText("私が行く\n学校へ!", "学校 へ！")).toBe("私が行く\n学校へ!");
  });

  it("clamps crop rectangles to the page", () => {
    expect(normalizeMangaOcrSelection({ x: -0.1, y: 0.8, width: 1.4, height: 0.5 })).toEqual({
      x: 0,
      y: 0.8,
      width: 1,
      height: 0.19999999999999996,
    });
  });
});
