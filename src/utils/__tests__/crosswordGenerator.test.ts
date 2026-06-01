import { describe, expect, it } from "@jest/globals";
import { generateCrossword, type CrosswordWordInput } from "../crosswordGenerator";

describe("crosswordGenerator", () => {
  it("de-prioritizes recent subject ids when choosing an anchor word", () => {
    const candidates: CrosswordWordInput[] = [
      { subjectId: 1, hiragana: "あいうえお", meaning: "recent" },
      { subjectId: 2, hiragana: "かきくけこ", meaning: "fresh" },
    ];

    const puzzle = generateCrossword(candidates, {
      gridSize: 13,
      maxWords: 1,
      attempts: 10,
      seed: 123,
      recentSubjectIds: [1],
    });

    expect(puzzle.words.map((word) => word.subjectId)).toEqual([2]);
  });
});
