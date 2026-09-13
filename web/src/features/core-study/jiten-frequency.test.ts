import { describe, expect, it } from "vitest";
import {
  extractJitenRubyReading,
  normalizeVocabularyExpression,
  selectBestJitenFrequencyMatch,
} from "./jiten-frequency";

describe("Jiten frequency matching", () => {
  it("normalizes WaniKani markers and extracts a complete reading from ruby text", () => {
    expect(normalizeVocabularyExpression(" ～ お 土産 〜 ")).toBe("お土産");
    expect(extractJitenRubyReading("食[た]べる")).toBe("たべる");
    expect(extractJitenRubyReading("お 土産[ミヤゲ]")).toBe("おみやげ");
  });

  it("selects the homograph matching the WaniKani reading before considering rank", () => {
    const match = selectBestJitenFrequencyMatch("開く", ["ひらく"], [
      { wordId: 1, readingIndex: 0, text: "開く", rubyText: "開[あ]く", frequencyRank: 500 },
      { wordId: 2, readingIndex: 0, text: "開く", rubyText: "開[ひら]く", frequencyRank: 1_200 },
    ]);

    expect(match).toMatchObject({
      wordId: 2,
      reading: "ひらく",
      frequencyRank: 1_200,
    });
  });

  it("falls back to the expression as the reading for kana vocabulary", () => {
    expect(selectBestJitenFrequencyMatch("カタカナ", [], [
      { wordId: 3, readingIndex: 0, text: "カタカナ", rubyText: "カタカナ", frequencyRank: 2_345 },
    ])).toMatchObject({ wordId: 3, reading: "かたかな", frequencyRank: 2_345 });
  });

  it("rejects unrelated spellings and entries without a valid rank", () => {
    expect(selectBestJitenFrequencyMatch("猫", ["ねこ"], [
      { wordId: 1, readingIndex: 0, text: "犬", rubyText: "犬[いぬ]", frequencyRank: 100 },
      { wordId: 2, readingIndex: 0, text: "猫", rubyText: "猫[ねこ]", frequencyRank: null },
    ])).toBeNull();
  });
});
