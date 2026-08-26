import type { Subject } from "@/types/wanikani";
import { analyzeJapaneseText, chooseWordleCandidate, evaluateWordleGuess, generateCrossword, isValidWordleGuess, splitKana, tokenizeJapaneseText, wordleCandidates } from "./games";

function vocabulary(id: number, characters: string, reading: string, meaning: string, object: "vocabulary" | "kana_vocabulary" = "vocabulary"): Subject {
  return { id, object, url: "", data_updated_at: "", data: { level: 1, created_at: "", slug: characters, document_url: "", hidden_at: null, characters, meanings: [{ meaning, primary: true, accepted_answer: true }], auxiliary_meanings: [], readings: [{ reading, primary: true, accepted_answer: true }] } };
}

const subjects = [
  vocabulary(1, "猫", "ねこ", "Cat"), vocabulary(2, "声", "こえ", "Voice"), vocabulary(3, "駅", "えき", "Station"),
  vocabulary(4, "聞く", "きく", "Listen"), vocabulary(5, "口", "くち", "Mouth"), vocabulary(6, "地図", "ちず", "Map"),
];

describe("study games", () => {
  it("scores duplicate kana using Wordle frequency rules", () => {
    expect(evaluateWordleGuess("こころ", "ことこ")).toEqual([
      { character: "こ", state: "correct" },
      { character: "と", state: "absent" },
      { character: "こ", state: "present" },
    ]);
    expect(splitKana("neko")).toEqual(["ね", "こ"]);
  });

  it("selects word candidates by kana length", () => {
    expect(wordleCandidates(subjects, 2).map((item) => item.reading)).toContain("ねこ");
    expect(wordleCandidates(subjects, 5)).toHaveLength(0);
    expect(isValidWordleGuess("neko", wordleCandidates(subjects, 2))).toBe(true);
    expect(isValidWordleGuess("いぬ", wordleCandidates(subjects, 2))).toBe(false);
    expect(chooseWordleCandidate(["first", "last"], () => 0.999)).toBe("last");
  });

  it("generates a connected crossword with numbered clues", () => {
    const puzzle = generateCrossword(subjects, 11, 6, () => 0.99);
    expect(puzzle).not.toBeNull();
    expect(puzzle!.entries.length).toBeGreaterThanOrEqual(2);
    expect(puzzle!.cells.flat().filter(Boolean).length).toBeGreaterThan(2);
    expect(new Set(puzzle!.entries.map((entry) => entry.number)).size).toBeGreaterThan(0);
  });

  it("keeps same-direction words on distinct runs", () => {
    const puzzle = generateCrossword(subjects, 11, 6, () => 0.99);
    expect(puzzle).not.toBeNull();

    const occupiedRuns = new Set<string>();
    for (const entry of puzzle!.entries) {
      const characters = splitKana(entry.answer);
      characters.forEach((_, index) => {
        const row = entry.row + (entry.direction === "down" ? index : 0);
        const col = entry.col + (entry.direction === "across" ? index : 0);
        const key = `${entry.direction}:${row}:${col}`;
        if (occupiedRuns.has(key)) throw new Error(`${entry.number} ${entry.direction} overlaps another word at ${row}:${col}`);
        occupiedRuns.add(key);
      });

      const beforeRow = entry.row - (entry.direction === "down" ? 1 : 0);
      const beforeCol = entry.col - (entry.direction === "across" ? 1 : 0);
      const afterRow = entry.row + (entry.direction === "down" ? characters.length : 0);
      const afterCol = entry.col + (entry.direction === "across" ? characters.length : 0);
      if (puzzle!.cells[beforeRow]?.[beforeCol]) throw new Error(`${entry.number} ${entry.direction} touches a letter before its start`);
      if (puzzle!.cells[afterRow]?.[afterCol]) throw new Error(`${entry.number} ${entry.direction} touches a letter after its end`);
    }
  });

  it("applies native crossword vocabulary and clue options", () => {
    const pool = [...subjects, vocabulary(20, "ねこ", "ねこ", "Cat kana", "kana_vocabulary"), vocabulary(21, "こえ", "こえ", "Voice kana", "kana_vocabulary")];
    const kanaOnly = generateCrossword(pool, 13, 10, () => 0.99, { hiraganaOnly: true, clueMode: "english" });
    expect(kanaOnly).not.toBeNull();
    expect(kanaOnly!.entries.every((entry) => !/[\p{Script=Han}\p{Script=Katakana}]/u.test(entry.characters))).toBe(true);
    const kanjiClues = generateCrossword(subjects, 11, 6, () => 0.99, { clueMode: "kanji" });
    expect(kanjiClues!.entries.every((entry) => entry.clue === entry.characters || entry.clue === entry.answer)).toBe(true);
  });

  it("finds exact vocabulary and unique kanji in pasted Japanese", () => {
    const result = analyzeJapaneseText("猫の声を聞く。猫です。", subjects);
    expect(result.matches.map((item) => item.id)).toEqual(expect.arrayContaining([1, 2, 4]));
    expect(result.kanji).toEqual(["猫", "声", "聞"]);
    expect(tokenizeJapaneseText("猫が好きです", subjects)).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: "猫", type: "vocabulary" }),
      expect.objectContaining({ text: "が", type: "grammar" }),
      expect.objectContaining({ text: "です", type: "grammar" }),
    ]));
  });
});
