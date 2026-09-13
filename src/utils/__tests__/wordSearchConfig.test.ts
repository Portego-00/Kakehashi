import {
  createDefaultWordSearchConfig,
  getWordSearchAllowedSrsStages,
  getWordSearchGridSize,
  sanitizeWordSearchConfig,
} from "../wordSearchConfig";

describe("wordSearchConfig", () => {
  it("creates mobile-friendly defaults", () => {
    const config = createDefaultWordSearchConfig(12);
    expect(config.direction).toBe("kanji-to-kana");
    expect(config.wordCount).toBe(8);
    expect(config.maxLevel).toBe(12);
    expect(getWordSearchGridSize(config.wordCount)).toBe(10);
  });

  it("sanitizes direction, word count, levels, lists, and stages", () => {
    const config = sanitizeWordSearchConfig(
      {
        direction: "kana-to-kanji",
        wordCount: 7,
        minLevel: 20,
        maxLevel: 3,
        selectedListIds: ["one", "one", " two "],
        srsGroups: {
          apprentice: false,
          guru: true,
          master: false,
          enlightened: false,
          burned: false,
        },
      },
      15,
    );

    expect(config.direction).toBe("kana-to-kanji");
    expect(config.wordCount).toBe(6);
    expect(config.minLevel).toBe(3);
    expect(config.maxLevel).toBe(15);
    expect(config.selectedListIds).toEqual(["one", "two"]);
    expect(Array.from(getWordSearchAllowedSrsStages(config))).toEqual([5, 6]);
  });
});
