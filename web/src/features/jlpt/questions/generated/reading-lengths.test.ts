import { describe, expect, it } from "vitest";
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

const MINIMUM_BODY_LENGTHS: Partial<
  Record<JlptLevel, Partial<Record<JlptTestItemType, number>>>
> = {
  N5: { "reading-short": 60, "reading-mid": 120, "information-retrieval": 180 },
  N4: {
    "reading-short": 100,
    "reading-mid": 180,
    "information-retrieval": 300,
  },
  N3: {
    "reading-short": 130,
    "reading-mid": 240,
    "reading-long": 450,
    "information-retrieval": 450,
  },
  N2: {
    "reading-short": 160,
    "reading-mid": 320,
    "reading-integrated": 500,
    "reading-thematic": 700,
    "information-retrieval": 550,
  },
  N1: {
    "reading-short": 180,
    "reading-mid": 350,
    "reading-long": 800,
    "reading-integrated": 500,
    "reading-thematic": 800,
    "information-retrieval": 600,
  },
};

describe("generated reading passage bands", () => {
  it.each(
    Object.entries(MINIMUM_BODY_LENGTHS) as [
      JlptLevel,
      Partial<Record<JlptTestItemType, number>>,
    ][],
  )(
    "keeps %s passages near the lower edge of their official size class",
    (level, minimums) => {
      for (const [type, minimum] of Object.entries(minimums) as [
        JlptTestItemType,
        number,
      ][]) {
        const lengths = BANKS[level]
          .filter((question) => question.officialType === type)
          .map(
            (question) => question.passage?.body.replace(/\s/g, "").length ?? 0,
          );
        expect
          .soft(Math.min(...lengths), `${level} ${type}`)
          .toBeGreaterThanOrEqual(minimum);
      }
    },
  );
});
