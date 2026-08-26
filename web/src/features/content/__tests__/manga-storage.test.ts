import { beforeEach, describe, expect, it } from "vitest";
import { deleteRecord, loadMangaOcrPage, saveLibrary, saveMangaOcrPage } from "../storage";
import type { ContentRecord } from "../types";

const record: ContentRecord = {
  id: "manga-1",
  kind: "manga",
  title: "Test manga",
  assetIds: [],
  createdAt: "2026-08-26T00:00:00.000Z",
  updatedAt: "2026-08-26T00:00:00.000Z",
  progress: 0,
};

describe("manga OCR storage", () => {
  beforeEach(() => window.localStorage.clear());

  it("stores OCR independently for each page and removes blank text", () => {
    saveMangaOcrPage(record.id, 1, " 学校へ行く ");
    saveMangaOcrPage(record.id, 2, "猫です");
    expect(loadMangaOcrPage(record.id, 1)?.text).toBe("学校へ行く");
    expect(loadMangaOcrPage(record.id, 2)?.text).toBe("猫です");

    saveMangaOcrPage(record.id, 1, "  ");
    expect(loadMangaOcrPage(record.id, 1)).toBeNull();
    expect(loadMangaOcrPage(record.id, 2)?.text).toBe("猫です");
  });

  it("removes cached OCR when its manga is permanently deleted", async () => {
    saveLibrary("manga", [record]);
    saveMangaOcrPage(record.id, 1, "学校へ行く");
    await deleteRecord(record);
    expect(loadMangaOcrPage(record.id, 1)).toBeNull();
  });
});
