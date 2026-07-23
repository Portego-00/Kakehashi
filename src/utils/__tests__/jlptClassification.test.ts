import {
  getJLPTLevelForSubject,
  getJLPTLevelForVocabulary,
  normalizeJLPTVocabularyReading,
} from "../jlptClassification";

describe("JLPT classification", () => {
  it("classifies vocabulary using spelling and reading", () => {
    expect(getJLPTLevelForVocabulary("会う", ["あう"])).toBe("N5");
    expect(getJLPTLevelForVocabulary("現像", ["げんぞう"])).toBe("N1");
  });

  it("uses the reading to distinguish identical spellings", () => {
    expect(getJLPTLevelForVocabulary("開く", ["あく"])).toBe("N5");
    expect(getJLPTLevelForVocabulary("開く", ["ひらく"])).toBe("N4");
    expect(getJLPTLevelForVocabulary("開く", [])).toBeNull();
  });

  it("normalizes katakana readings", () => {
    expect(normalizeJLPTVocabularyReading("テレビ")).toBe("てれび");
    expect(getJLPTLevelForVocabulary("テレビ", ["テレビ"])).toBe("N5");
  });

  it("classifies kanji and vocabulary subjects but not radicals", () => {
    expect(
      getJLPTLevelForSubject({
        object: "kanji",
        data: { characters: "語" },
      }),
    ).toBe("N5");
    expect(
      getJLPTLevelForSubject({
        object: "vocabulary",
        data: { characters: "会う", readings: [{ reading: "あう" }] },
      }),
    ).toBe("N5");
    expect(
      getJLPTLevelForSubject({
        object: "radical",
        data: { characters: "亅" },
      }),
    ).toBeNull();
  });

  it("ignores readings that WaniKani does not accept as answers", () => {
    expect(
      getJLPTLevelForSubject({
        object: "vocabulary",
        data: {
          characters: "開く",
          readings: [
            { reading: "あく", accepted_answer: true },
            { reading: "ひらく", accepted_answer: false },
          ],
        },
      }),
    ).toBe("N5");
  });
});
