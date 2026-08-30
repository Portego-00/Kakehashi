import type { Subject } from "@/types/wanikani";
import { analyzeJapaneseText, chooseWordleCandidate, evaluateWordleGuess, findWordSearchEntry, generateCrossword, generateWordSearch, isValidWordleGuess, splitKana, tokenizeJapaneseText, wordleCandidates, wordSearchSelectionPath } from "./games";

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

  it("builds word searches in both study directions", () => {
    const pool = [
      ...subjects,
      vocabulary(30, "学校", "がっこう", "School"),
      vocabulary(31, "日本語", "にほんご", "Japanese language"),
      vocabulary(32, "電車", "でんしゃ", "Train"),
    ];
    let seed = 17;
    const random = () => {
      seed = (seed * 48271) % 2147483647;
      return seed / 2147483647;
    };
    const kanaPuzzle = generateWordSearch(pool, "kanji-to-kana", 9, 5, random);
    expect(kanaPuzzle).not.toBeNull();
    expect(kanaPuzzle!.entries).toHaveLength(5);
    kanaPuzzle!.entries.forEach((entry) => {
      expect(entry.prompt).toBe(entry.characters);
      expect(entry.path.map(({ row, col }) => kanaPuzzle!.grid[row][col]).join("")).toBe(entry.answer);
    });

    const kanjiPuzzle = generateWordSearch(pool, "kana-to-kanji", 9, 5, random);
    expect(kanjiPuzzle).not.toBeNull();
    expect(kanjiPuzzle!.entries.every((entry) => entry.prompt === entry.reading && entry.answer === entry.characters)).toBe(true);
  });

  it("recognizes straight word-search selections in either direction", () => {
    const path = wordSearchSelectionPath({ row: 1, col: 1 }, { row: 3, col: 3 });
    expect(path).toEqual([{ row: 1, col: 1 }, { row: 2, col: 2 }, { row: 3, col: 3 }]);
    expect(wordSearchSelectionPath({ row: 0, col: 0 }, { row: 1, col: 2 })).toEqual([]);

    const puzzle = {
      size: 3,
      direction: "kanji-to-kana" as const,
      grid: [["ね", "こ", "あ"], ["い", "う", "え"], ["お", "か", "き"]],
      entries: [{ id: "cat", subjectId: 1, prompt: "猫", answer: "ねこ", characters: "猫", reading: "ねこ", meaning: "Cat", path: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }],
    };
    expect(findWordSearchEntry(puzzle, [{ row: 0, col: 1 }, { row: 0, col: 0 }])?.id).toBe("cat");
    expect(findWordSearchEntry(puzzle, puzzle.entries[0].path, ["cat"])).toBeNull();
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
