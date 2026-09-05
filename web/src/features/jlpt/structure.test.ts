import { describe, expect, it } from "vitest";
import {
  JLPT_APPROXIMATE_ITEM_COUNTS,
  JLPT_MOCK_STRUCTURES,
  OFFICIAL_TYPES_BY_LEVEL,
} from "./structure";
import type { JlptLevel, JlptTestItemType } from "./types";

const EXPECTED_TYPES: Record<JlptLevel, readonly JlptTestItemType[]> = {
  N1: [
    "kanji-reading",
    "context-expression",
    "paraphrase",
    "usage",
    "grammar-form",
    "sentence-composition",
    "text-grammar",
    "reading-short",
    "reading-mid",
    "reading-long",
    "reading-integrated",
    "reading-thematic",
    "information-retrieval",
    "listening-task",
    "listening-key-points",
    "listening-outline",
    "listening-quick-response",
    "listening-integrated",
  ],
  N2: [
    "kanji-reading",
    "orthography",
    "word-formation",
    "context-expression",
    "paraphrase",
    "usage",
    "grammar-form",
    "sentence-composition",
    "text-grammar",
    "reading-short",
    "reading-mid",
    "reading-integrated",
    "reading-thematic",
    "information-retrieval",
    "listening-task",
    "listening-key-points",
    "listening-outline",
    "listening-quick-response",
    "listening-integrated",
  ],
  N3: [
    "kanji-reading",
    "orthography",
    "context-expression",
    "paraphrase",
    "usage",
    "grammar-form",
    "sentence-composition",
    "text-grammar",
    "reading-short",
    "reading-mid",
    "reading-long",
    "information-retrieval",
    "listening-task",
    "listening-key-points",
    "listening-outline",
    "listening-verbal",
    "listening-quick-response",
  ],
  N4: [
    "kanji-reading",
    "orthography",
    "context-expression",
    "paraphrase",
    "usage",
    "grammar-form",
    "sentence-composition",
    "text-grammar",
    "reading-short",
    "reading-mid",
    "information-retrieval",
    "listening-task",
    "listening-key-points",
    "listening-verbal",
    "listening-quick-response",
  ],
  N5: [
    "kanji-reading",
    "orthography",
    "context-expression",
    "paraphrase",
    "grammar-form",
    "sentence-composition",
    "text-grammar",
    "reading-short",
    "reading-mid",
    "information-retrieval",
    "listening-task",
    "listening-key-points",
    "listening-verbal",
    "listening-quick-response",
  ],
};

const EXPECTED_COUNTS: Record<JlptLevel, readonly number[]> = {
  N1: [6, 7, 6, 6, 10, 5, 5, 4, 9, 4, 3, 4, 2, 5, 6, 5, 11, 3],
  N2: [5, 5, 5, 7, 5, 5, 12, 5, 5, 5, 9, 2, 3, 2, 5, 6, 5, 12, 4],
  N3: [8, 6, 11, 5, 5, 13, 5, 5, 4, 6, 4, 2, 6, 6, 3, 4, 9],
  N4: [7, 5, 8, 4, 4, 13, 4, 4, 3, 3, 2, 8, 7, 5, 8],
  N5: [7, 5, 6, 3, 9, 4, 4, 2, 2, 1, 7, 6, 5, 6],
};

describe("official JLPT structure", () => {
  it("keeps the current official timed sections separate for every level", () => {
    expect(
      JLPT_MOCK_STRUCTURES.N1.sections.map((section) => [
        section.id,
        section.durationMinutes,
      ]),
    ).toEqual([
      ["language-reading", 110],
      ["listening", 55],
    ]);
    expect(
      JLPT_MOCK_STRUCTURES.N2.sections.map((section) => [
        section.id,
        section.durationMinutes,
      ]),
    ).toEqual([
      ["language-reading", 105],
      ["listening", 50],
    ]);
    expect(
      JLPT_MOCK_STRUCTURES.N3.sections.map((section) => [
        section.id,
        section.durationMinutes,
      ]),
    ).toEqual([
      ["vocabulary", 30],
      ["grammar-reading", 70],
      ["listening", 40],
    ]);
    expect(
      JLPT_MOCK_STRUCTURES.N4.sections.map((section) => [
        section.id,
        section.durationMinutes,
      ]),
    ).toEqual([
      ["vocabulary", 25],
      ["grammar-reading", 55],
      ["listening", 35],
    ]);
    expect(
      JLPT_MOCK_STRUCTURES.N5.sections.map((section) => [
        section.id,
        section.durationMinutes,
      ]),
    ).toEqual([
      ["vocabulary", 20],
      ["grammar-reading", 40],
      ["listening", 30],
    ]);
  });

  it("records every official scoring section, range, and pass threshold without treating them as raw quiz cutoffs", () => {
    expect(
      Object.fromEntries(
        Object.entries(JLPT_MOCK_STRUCTURES).map(([level, structure]) => [
          level,
          structure.officialOverallPassMark,
        ]),
      ),
    ).toEqual({ N1: 100, N2: 90, N3: 95, N4: 90, N5: 80 });
    for (const level of ["N1", "N2", "N3"] as const) {
      expect(
        JLPT_MOCK_STRUCTURES[level].scoringSections.map((section) => [
          section.id,
          section.scoreRange,
          section.officialSectionalPassMark,
        ]),
      ).toEqual([
        ["language", 60, 19],
        ["reading", 60, 19],
        ["listening", 60, 19],
      ]);
    }
    for (const level of ["N4", "N5"] as const) {
      expect(
        JLPT_MOCK_STRUCTURES[level].scoringSections.map((section) => [
          section.id,
          section.scoreRange,
          section.officialSectionalPassMark,
        ]),
      ).toEqual([
        ["language-reading", 120, 38],
        ["listening", 60, 19],
      ]);
    }
  });

  it("locks every level's official item families and large-question order", () => {
    expect(OFFICIAL_TYPES_BY_LEVEL).toEqual(EXPECTED_TYPES);
  });

  it("locks the current published approximate count for every level and family", () => {
    for (const level of ["N1", "N2", "N3", "N4", "N5"] as const) {
      expect(
        EXPECTED_TYPES[level].map(
          (type) => JLPT_APPROXIMATE_ITEM_COUNTS[level][type],
        ),
      ).toEqual(EXPECTED_COUNTS[level]);
    }
  });
});
