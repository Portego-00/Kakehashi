import { STUDY_MODES, isStudyModeId } from "./catalog";
import { CROSSWORD_SIZE_PRESETS, getModeDefaultFilters, hydrateModeFilters, parseSubjectIds } from "./mode-config";

describe("extra-study catalog", () => {
  it("contains every web-supported mobile mode exactly once", () => {
    expect(STUDY_MODES.map((mode) => mode.id)).toEqual([
      "recent-lessons", "random-test", "vocab-reading", "hiragana-meaning", "similar-kanji", "kana-to-kanji",
      "listening", "context-sentences", "text-analysis", "kanji-writing", "crossword", "kana-wordle",
      "custom-review", "custom-lessons", "subject-lists",
    ]);
    expect(new Set(STUDY_MODES.map((mode) => mode.id)).size).toBe(STUDY_MODES.length);
  });

  it("does not expose camera OCR or streaming-music modes", () => {
    const ids = STUDY_MODES.map((mode) => mode.id as string);
    expect(ids).not.toContain("camera-ocr");
    expect(ids).not.toContain("spotify");
    expect(ids).not.toContain("apple-music");
    expect(isStudyModeId("random-test")).toBe(true);
    expect(isStudyModeId("camera-ocr")).toBe(false);
  });

  it("sanitizes list-to-review subject IDs", () => {
    expect(parseSubjectIds("12, 4,nope,-3,12,8.5")).toEqual([12, 4]);
    expect(parseSubjectIds(["7,9", "x", "10"])).toEqual([7, 9, 10]);
  });

  it("matches the native defaults for mode-specific study pools", () => {
    expect(getModeDefaultFilters("recent-lessons", 42)).toMatchObject({ recentWindow: "apprentice", maxLevel: 42 });
    expect(getModeDefaultFilters("vocab-reading", 42).subjectTypes).toEqual(["vocabulary", "kana_vocabulary"]);
    expect(getModeDefaultFilters("listening", 42)).toMatchObject({
      count: 10,
      subjectTypes: ["vocabulary"],
      srsGroups: ["apprentice", "guru", "master", "enlightened"],
      listeningSource: "anime",
    });
    expect(getModeDefaultFilters("context-sentences", 42)).toMatchObject({ count: 15, subjectTypes: ["vocabulary"] });
  });

  it("resets disabled custom ranges to the current user level", () => {
    expect(hydrateModeFilters("random-test", { useCustomLevelRange: false, minLevel: 12, maxLevel: 20 }, 47)).toMatchObject({ minLevel: 1, maxLevel: 47 });
    expect(hydrateModeFilters("random-test", { useCustomLevelRange: true, minLevel: 12, maxLevel: 20 }, 47)).toMatchObject({ minLevel: 12, maxLevel: 20 });
  });

  it("uses native crossword presets instead of a misleading 100-word control", () => {
    expect(CROSSWORD_SIZE_PRESETS).toMatchObject({
      small: { gridSize: 9, minWords: 4, maxWords: 10 },
      medium: { gridSize: 13, minWords: 6, maxWords: 16 },
      large: { gridSize: 17, minWords: 10, maxWords: 24 },
    });
    expect(hydrateModeFilters("crossword", { crosswordSize: "medium", crosswordMaxWords: 30, count: 100 }, 60)).toMatchObject({ crosswordSize: "medium", crosswordMaxWords: 16 });
    expect(hydrateModeFilters("crossword", { crosswordSize: "large", crosswordMaxWords: 100, count: 100 }, 60)).toMatchObject({ crosswordSize: "large", crosswordMaxWords: 24 });
    expect(hydrateModeFilters("crossword", { crosswordSize: "small", crosswordMaxWords: 2 }, 60)).toMatchObject({ crosswordSize: "small", crosswordMaxWords: 4 });
  });

  it("clamps the native Wordle and context options", () => {
    expect(hydrateModeFilters("kana-wordle", { wordleMaxAttempts: 99 }, 60).wordleMaxAttempts).toBe(8);
    expect(hydrateModeFilters("kana-wordle", { wordleMaxAttempts: 1 }, 60).wordleMaxAttempts).toBe(4);
    expect(hydrateModeFilters("context-sentences", { contextSentenceAudio: true, contextAutoPlaySentenceAudio: true, contextHideTranslation: true, contextSentenceBreakdown: true, contextStopAfterAnswer: false }, 60)).toMatchObject({
      contextSentenceAudio: true,
      contextAutoPlaySentenceAudio: true,
      contextHideTranslation: true,
      contextSentenceBreakdown: true,
      contextStopAfterAnswer: false,
    });
  });
});
