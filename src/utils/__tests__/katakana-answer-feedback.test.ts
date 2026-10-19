import { formatKanjiReadingAnswer } from "../katakanaMadness";

const readings = [
  { reading: "ほう", type: "onyomi" },
  { reading: "かた", type: "kunyomi" },
  { reading: "まさ", type: "nanori" },
];

describe("Katakana Madness answer feedback", () => {
  it.each([
    ["ほう", "kanji", true, "ホウ"],
    ["ほう", "kanji", false, "ほう"],
    ["かた", "kanji", true, "かた"],
    ["まさ", "kanji", true, "まさ"],
    ["ほう", "vocabulary", true, "ほう"],
    ["ほう", "kana_vocabulary", true, "ほう"],
    ["unknown", "kanji", true, "unknown"],
  ])("formats %s for %s (enabled: %s)", (reading, type, enabled, expected) => {
    const before = JSON.stringify(readings);
    expect(formatKanjiReadingAnswer(reading, type, readings, enabled)).toBe(expected);
    expect(JSON.stringify(readings)).toBe(before);
  });
});
