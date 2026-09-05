import {
  findWordSearchEntry,
  generateWordSearch,
  getWordSearchCellAtPoint,
  getWordSearchDragEndCell,
  getWordSearchPathText,
  wordSearchSelectionPath,
  type WordSearchCandidate,
} from "../wordSearchGenerator";

const candidates: WordSearchCandidate[] = [
  {
    subjectId: 1,
    written: "日本",
    reading: "にほん",
    meaning: "Japan",
  },
  {
    subjectId: 2,
    written: "学校",
    reading: "がっこう",
    meaning: "School",
  },
  {
    subjectId: 3,
    written: "先生",
    reading: "せんせい",
    meaning: "Teacher",
  },
  {
    subjectId: 4,
    written: "電車",
    reading: "でんしゃ",
    meaning: "Train",
  },
];

describe("wordSearchGenerator", () => {
  it.each([
    ["kanji-to-kana" as const, "にほん"],
    ["kana-to-kanji" as const, "日本"],
  ])("generates a deterministic %s puzzle", (direction, expectedAnswer) => {
    const puzzle = generateWordSearch(candidates, {
      direction,
      size: 8,
      wordCount: 4,
      seed: 42,
    });

    expect(puzzle.entries).toHaveLength(4);
    expect(puzzle.entries.find((entry) => entry.subjectId === 1)?.answer).toBe(
      expectedAnswer,
    );
    puzzle.entries.forEach((entry) => {
      expect(getWordSearchPathText(puzzle, entry.path)).toBe(entry.answer);
    });
  });

  it("only allows horizontal, vertical, or diagonal selections", () => {
    expect(
      wordSearchSelectionPath({ row: 0, col: 0 }, { row: 3, col: 3 }, 8),
    ).toEqual([
      { row: 0, col: 0 },
      { row: 1, col: 1 },
      { row: 2, col: 2 },
      { row: 3, col: 3 },
    ]);
    expect(
      wordSearchSelectionPath({ row: 0, col: 0 }, { row: 2, col: 3 }, 8),
    ).toBeNull();
  });

  it("recognizes a word selected in reverse and ignores completed entries", () => {
    const puzzle = generateWordSearch(candidates, {
      direction: "kanji-to-kana",
      size: 8,
      wordCount: 4,
      seed: 9,
    });
    const entry = puzzle.entries[0];
    const reversePath = [...entry.path].reverse();

    expect(findWordSearchEntry(puzzle, reversePath)?.id).toBe(entry.id);
    expect(
      findWordSearchEntry(puzzle, reversePath, new Set([entry.id])),
    ).toBeNull();
  });

  it("maps touch coordinates to the expected board cell", () => {
    expect(getWordSearchCellAtPoint({ x: 99, y: 151 }, 320, 8)).toEqual({
      row: 3,
      col: 2,
    });
    expect(getWordSearchCellAtPoint({ x: 320, y: 10 }, 320, 8)).toBeNull();
  });

  it("snaps an imprecise diagonal drag to a valid diagonal path", () => {
    expect(
      getWordSearchDragEndCell({ row: 1, col: 1 }, { dx: 74, dy: 58 }, 36, 10),
    ).toEqual({ row: 3, col: 3 });
  });

  it("filters words without a kanji form", () => {
    const puzzle = generateWordSearch(
      [
        ...candidates,
        {
          subjectId: 5,
          written: "ありがとう",
          reading: "ありがとう",
          meaning: "Thanks",
        },
      ],
      {
        direction: "kanji-to-kana",
        size: 8,
        wordCount: 8,
        seed: 3,
      },
    );

    expect(puzzle.entries.some((entry) => entry.subjectId === 5)).toBe(false);
  });
});
