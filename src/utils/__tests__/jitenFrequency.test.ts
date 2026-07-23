import {
  extractJitenRubyReading,
  selectBestJitenFrequencyMatch,
} from "../jitenFrequency";

describe("Jiten frequency matching", () => {
  it("extracts a complete reading from ruby text", () => {
    expect(extractJitenRubyReading("食[た]べる")).toBe("たべる");
    expect(extractJitenRubyReading("お 土産[みやげ]")).toBe("おみやげ");
  });

  it("selects the homograph matching the WaniKani reading", () => {
    const match = selectBestJitenFrequencyMatch("開く", ["ひらく"], [
      {
        wordId: 1,
        readingIndex: 0,
        text: "開く",
        rubyText: "開[あ]く",
        frequencyRank: 500,
      },
      {
        wordId: 2,
        readingIndex: 0,
        text: "開く",
        rubyText: "開[ひら]く",
        frequencyRank: 1200,
      },
    ]);

    expect(match).toMatchObject({
      wordId: 2,
      reading: "ひらく",
      frequencyRank: 1200,
    });
  });

  it("rejects unrelated spellings and entries without a rank", () => {
    expect(
      selectBestJitenFrequencyMatch("猫", ["ねこ"], [
        {
          wordId: 1,
          readingIndex: 0,
          text: "犬",
          rubyText: "犬[いぬ]",
          frequencyRank: 100,
        },
        {
          wordId: 2,
          readingIndex: 0,
          text: "猫",
          rubyText: "猫[ねこ]",
          frequencyRank: null,
        },
      ]),
    ).toBeNull();
  });
});
