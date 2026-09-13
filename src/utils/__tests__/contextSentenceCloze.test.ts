import {
  blankContextSentence,
  tryBlankContextSentence,
} from "../contextSentenceCloze";

describe("context sentence cloze helpers", () => {
  it("blanks an exact vocabulary form", () => {
    expect(tryBlankContextSentence("世界は広いです。", ["世界", "せかい"])).toBe(
      "＿＿＿は広いです。",
    );
  });

  it("blanks a conjugated reading in a kana sentence", () => {
    expect(
      tryBlankContextSentence("きのうたべました。", ["食べる", "たべる"]),
    ).toBe("きのう＿＿＿。 ".trim());
  });

  it("blanks common godan conjugations", () => {
    expect(tryBlankContextSentence("まいにちあるきます。", ["歩く", "あるく"])).toBe(
      "まいにち＿＿＿。",
    );
    expect(
      tryBlankContextSentence("みずをのみました。", ["のむ"], {
        allowShortKanaConjugation: true,
      }),
    ).toBe("みずを＿＿＿。");
  });

  it("prefers the full inflected form over a shorter generic suffix", () => {
    expect(tryBlankContextSentence("この本は安くないです。", ["安い"])).toBe(
      "この本は＿＿＿です。",
    );
    expect(tryBlankContextSentence("友達と話したいです。", ["話す"])).toBe(
      "友達と＿＿＿です。",
    );
  });

  it("does not mistake a short reading inside another conjugated word", () => {
    expect(
      tryBlankContextSentence("本を読みました。", ["見る", "みる"]),
    ).toBeNull();
  });

  it("does not treat a different verb with the same kanji stem as the target", () => {
    expect(
      tryBlankContextSentence("写真を見せる。", ["見る", "みる"]),
    ).toBeNull();
  });

  it("blanks only the first occurrence for a single-answer question", () => {
    expect(
      tryBlankContextSentence("世界から世界へ。", ["世界", "せかい"]),
    ).toBe("＿＿＿から世界へ。");
  });

  it("returns null instead of blanking an unrelated word", () => {
    expect(tryBlankContextSentence("今日は晴れです。", ["世界", "せかい"])).toBeNull();
  });

  it("retains the legacy Japanese-token fallback for built-in sentences", () => {
    expect(blankContextSentence("今日は晴れです。", ["世界"])).toBe("＿＿＿。");
  });
});
