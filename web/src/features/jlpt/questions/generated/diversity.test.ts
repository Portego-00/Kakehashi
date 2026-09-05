import { describe, expect, it } from "vitest";
import { OFFICIAL_TYPES_BY_LEVEL } from "../../structure";
import type { JlptLevel, JlptQuestion, JlptTestItemType } from "../../types";
import { N1_GENERATED_QUESTIONS } from "./n1.generated";
import { N2_GENERATED_QUESTIONS } from "./n2.generated";
import { N3_GENERATED_QUESTIONS } from "./n3.generated";
import { N4_GENERATED_QUESTIONS } from "./n4.generated";
import { N5_GENERATED_QUESTIONS } from "./n5.generated";

const BANKS: Record<JlptLevel, readonly JlptQuestion[]> = {
  N5: N5_GENERATED_QUESTIONS,
  N4: N4_GENERATED_QUESTIONS,
  N3: N3_GENERATED_QUESTIONS,
  N2: N2_GENERATED_QUESTIONS,
  N1: N1_GENERATED_QUESTIONS,
};

const MINIMUM_SEMANTIC_ITEMS: Partial<Record<JlptTestItemType, number>> = {
  "kanji-reading": 10,
  orthography: 10,
  "context-expression": 10,
  paraphrase: 10,
  usage: 10,
  "grammar-form": 10,
  "sentence-composition": 10,
  "text-grammar": 20,
  "word-formation": 10,
  "listening-verbal": 10,
  "listening-task": 8,
  "listening-key-points": 8,
  "listening-outline": 8,
  "listening-quick-response": 8,
  "listening-integrated": 8,
  "reading-short": 8,
  "reading-mid": 8,
  "reading-long": 8,
  "reading-integrated": 8,
  "reading-thematic": 8,
  "information-retrieval": 8,
};

describe("generated JLPT bank provenance", () => {
  it.each(Object.entries(BANKS) as [JlptLevel, readonly JlptQuestion[]][])(
    "labels every %s rendering with an honest semantic identity",
    (level, questions) => {
      for (const officialType of OFFICIAL_TYPES_BY_LEVEL[level]) {
        const family = questions.filter(
          (question) => question.officialType === officialType,
        );
        expect(family).toHaveLength(200);
        expect(new Set(family.map((question) => question.id)).size).toBe(200);

        for (const question of family) {
          expect(question.provenance).toMatchObject({
            authorship: "controlled-variant",
            editorialStatus: "machine-validated",
            contentVersion: 1,
          });
          expect(question.provenance?.semanticKey).toMatch(
            new RegExp(`^${level.toLowerCase()}:${officialType}:`),
          );
          expect(question.provenance?.variantIndex).toBeGreaterThanOrEqual(0);
        }

        const semanticCount = new Set(
          family.map((question) => question.provenance?.semanticKey),
        ).size;
        const minimum = MINIMUM_SEMANTIC_ITEMS[officialType] ?? 1;
        expect(
          semanticCount,
          `${level} ${officialType}`,
        ).toBeGreaterThanOrEqual(minimum);
      }
    },
  );

  it.each(Object.entries(BANKS) as [JlptLevel, readonly JlptQuestion[]][])(
    "does not mislabel controlled %s variants as independently hand-authored",
    (_level, questions) => {
      expect(
        questions.every(
          (question) =>
            question.provenance?.authorship === "controlled-variant",
        ),
      ).toBe(true);
      expect(
        questions.some(
          (question) => (question.provenance?.variantIndex ?? 0) > 0,
        ),
      ).toBe(true);
    },
  );
});
