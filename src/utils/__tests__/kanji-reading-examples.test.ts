import {
  groupKanjiReadingExamples,
  matchVocabularyToKanjiReading,
} from "../kanji-reading-examples";

const vocabulary = (
  id: number,
  characters: string,
  reading: string,
  meaning: string,
  level = 1
) => ({
  id,
  characters,
  readings: [{ reading, primary: true }],
  meanings: [meaning],
  level,
});

describe("kanji reading examples", () => {
  it("groups vocabulary under On'yomi and Kun'yomi readings", () => {
    const groups = groupKanjiReadingExamples({
      kanjiCharacters: "行",
      kanjiReadings: [
        { reading: "こう", type: "onyomi", primary: true },
        { reading: "い.く", type: "kunyomi" },
      ],
      vocabulary: [
        vocabulary(1, "銀行", "ぎんこう", "Bank", 10),
        vocabulary(2, "行く", "いく", "To Go", 5),
      ],
    });

    expect(groups).toEqual([
      expect.objectContaining({
        reading: "こう",
        type: "onyomi",
        examples: [expect.objectContaining({ id: 1 })],
      }),
      expect.objectContaining({
        reading: "い.く",
        type: "kunyomi",
        examples: [expect.objectContaining({ id: 2 })],
      }),
    ]);
  });

  it("recognizes rendaku at the kanji's position instead of a wrong-edge match", () => {
    const match = matchVocabularyToKanjiReading({
      kanjiCharacters: "日",
      kanjiReadings: [
        { reading: "にち", type: "onyomi", primary: true },
        { reading: "じつ", type: "onyomi" },
        { reading: "ひ", type: "kunyomi" },
        { reading: "か", type: "kunyomi" },
      ],
      vocabularyCharacters: "火曜日",
      vocabularyReadings: [{ reading: "かようび", primary: true }],
    });

    expect(match).toEqual(
      expect.objectContaining({ reading: "ひ", type: "kunyomi" })
    );
  });

  it("recognizes sokuon changes in compound words", () => {
    const match = matchVocabularyToKanjiReading({
      kanjiCharacters: "学",
      kanjiReadings: [{ reading: "がく", type: "onyomi", primary: true }],
      vocabularyCharacters: "学校",
      vocabularyReadings: [{ reading: "がっこう", primary: true }],
    });

    expect(match).toEqual(
      expect.objectContaining({ reading: "がく", type: "onyomi" })
    );
  });

  it("does not force irregular vocabulary into an unrelated reading", () => {
    const match = matchVocabularyToKanjiReading({
      kanjiCharacters: "人",
      kanjiReadings: [
        { reading: "じん", type: "onyomi", primary: true },
        { reading: "にん", type: "onyomi" },
        { reading: "ひと", type: "kunyomi" },
      ],
      vocabularyCharacters: "大人",
      vocabularyReadings: [{ reading: "おとな", primary: true }],
    });

    expect(match).toBeNull();
  });
});
