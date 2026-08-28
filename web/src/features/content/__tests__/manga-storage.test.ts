import { beforeEach, describe, expect, it } from "vitest";
import { deleteRecord, loadLibrary, loadMangaOcrPage, reorderLibrary, saveLibrary, saveMangaOcrPage, updateRecordInPlace } from "../storage";
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

  it("updates manga progress without changing a custom library order", () => {
    const second = { ...record, id: "manga-2", title: "Second manga" };
    saveLibrary("manga", [second, record]);

    updateRecordInPlace({ ...record, progress: 0.5, currentPage: 6 });

    expect(loadLibrary("manga").map((item) => item.id)).toEqual([second.id, record.id]);
    expect(loadLibrary("manga")[1]).toMatchObject({ progress: 0.5, currentPage: 6 });
  });

  it("reorders the latest stored manga records by id", () => {
    const second = { ...record, id: "manga-2", title: "Second manga", progress: 0.75 };
    saveLibrary("manga", [record, second]);

    const reordered = reorderLibrary("manga", [second.id, record.id]);

    expect(reordered.map((item) => item.id)).toEqual([second.id, record.id]);
    expect(reordered[0].progress).toBe(0.75);
    expect(loadLibrary("manga").map((item) => item.id)).toEqual([second.id, record.id]);
  });
});
