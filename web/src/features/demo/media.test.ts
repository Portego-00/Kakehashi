import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deleteRecord, loadLibrary, loadMangaOcrPage, saveLibrary, updateRecordInPlace } from "@/features/content/storage";
import type { ContentRecord } from "@/features/content/types";
import { parseLyricsText } from "@/features/content/parsers";
import { DEMO_VIDEOS, seedDemoLibrary } from "./media";
import { DEMO_MANGA_ID } from "./media-assets";
import { setDemoMode } from "./runtime";

const personal: ContentRecord = { id: "personal-manga", kind: "manga", title: "My manga", assetIds: [], createdAt: "2026-01-01", updatedAt: "2026-01-01", progress: 0.5 };

describe("demo library", () => {
  beforeEach(() => { localStorage.clear(); setDemoMode(false); });
  afterEach(() => { setDemoMode(false); vi.unstubAllGlobals(); });

  it("keeps a personal library unchanged and seeds usable samples without downloads", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    saveLibrary("manga", [personal]);
    await seedDemoLibrary();
    expect(loadLibrary("video")).toEqual([]);

    setDemoMode(true);
    await seedDemoLibrary();
    expect(loadLibrary("manga")).toHaveLength(1);
    expect(loadLibrary("manga")[0]).toMatchObject({ id: DEMO_MANGA_ID, totalPages: 14, currentPage: 13 });
    expect(loadMangaOcrPage(DEMO_MANGA_ID, 13)?.text).toContain("でも楽しかったよ。");
    expect(loadLibrary("epub")).toHaveLength(1);
    expect(loadLibrary("video")).toHaveLength(2);
    for (const video of loadLibrary("video")) {
      const parsed = parseLyricsText(video.text ?? "");
      expect(parsed.timed).toBe(true);
      expect(parsed.lines.length).toBeGreaterThan(1);
      expect(video.metadata?.videoUrl).toMatch(/^https:\/\/www.youtube.com\/watch\?v=/);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    setDemoMode(false);
    expect(loadLibrary("manga")).toEqual([personal]);
    expect(loadLibrary("video")).toEqual([]);
    expect(loadMangaOcrPage(DEMO_MANGA_ID, 13)).toBeNull();
  });

  it("preserves demo progress, caption edits, imports, and deliberate removals on resume", async () => {
    setDemoMode(true);
    await seedDemoLibrary();
    const video = loadLibrary("video")[0];
    updateRecordInPlace({ ...video, progress: 0.75, text: "My edited transcript" });
    const manga = loadLibrary("manga")[0];
    await deleteRecord(manga);
    setDemoMode(false);
    setDemoMode(true);
    await seedDemoLibrary();
    expect(loadLibrary("video")[0]).toMatchObject({ progress: 0.75, text: "My edited transcript" });
    expect(loadLibrary("video")).toHaveLength(DEMO_VIDEOS.length);
    expect(loadLibrary("manga")).toEqual([]);
    expect(loadMangaOcrPage(DEMO_MANGA_ID, 13)).toBeNull();
  });
});
