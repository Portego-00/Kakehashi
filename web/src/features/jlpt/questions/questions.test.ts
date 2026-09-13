import { describe, expect, it } from "vitest";
import { OFFICIAL_TYPES_BY_LEVEL, supportsOfficialType } from "../structure";
import type { JlptLevel, JlptQuestion, JlptTestItemType } from "../types";
import { N1_QUESTIONS } from "./n1";
import { N2_QUESTIONS } from "./n2";
import { N3_QUESTIONS } from "./n3";
import { N4_QUESTIONS } from "./n4";
import { N5_QUESTIONS } from "./n5";

const BANKS: Record<JlptLevel, readonly JlptQuestion[]> = {
  N5: N5_QUESTIONS,
  N4: N4_QUESTIONS,
  N3: N3_QUESTIONS,
  N2: N2_QUESTIONS,
  N1: N1_QUESTIONS,
};
const LISTENING_TYPES = new Set<JlptTestItemType>([
  "listening-task",
  "listening-key-points",
  "listening-outline",
  "listening-verbal",
  "listening-quick-response",
  "listening-integrated",
]);

describe("JLPT authored question banks", () => {
  it.each(Object.entries(BANKS) as [JlptLevel, readonly JlptQuestion[]][])(
    "keeps %s representative, valid, and quick-quiz ready",
    (level, questions) => {
      expect(questions.length).toBeGreaterThanOrEqual(20);
      expect(questions.filter((question) => question.shortQuiz)).toHaveLength(
        10,
      );
      expect(
        new Set(
          questions
            .filter((question) => question.shortQuiz)
            .map((question) => question.skill),
        ),
      ).toEqual(
        new Set(["kanji", "vocabulary", "grammar", "reading", "listening"]),
      );
      expect(new Set(questions.map((question) => question.id)).size).toBe(
        questions.length,
      );

      for (const question of questions) {
        expect(question.level).toBe(level);
        expect(supportsOfficialType(level, question.officialType)).toBe(true);
        expect(question.instruction.trim()).not.toBe("");
        expect(question.stem.trim()).not.toBe("");
        expect(question.explanation.trim().length).toBeGreaterThan(20);
        expect(question.options.length).toBeGreaterThanOrEqual(3);
        expect(question.options.length).toBeLessThanOrEqual(4);
        expect(new Set(question.options.map((option) => option.id)).size).toBe(
          question.options.length,
        );
        expect(
          new Set(question.options.map((option) => option.label)).size,
        ).toBe(question.options.length);
        expect(
          question.options.filter(
            (option) => option.id === question.correctOptionId,
          ),
        ).toHaveLength(1);
        expect(Boolean(question.listening)).toBe(
          LISTENING_TYPES.has(question.officialType),
        );
        if (question.officialType === "text-grammar") {
          const numberedBlanks =
            question.passage?.body.match(/［\d+］＿＿/gu) ?? [];
          if (numberedBlanks.length) {
            expect(numberedBlanks.length).toBeGreaterThanOrEqual(2);
            expect(question.stem).toMatch(/空所\d+/u);
          } else {
            expect(question.passage?.body.match(/＿＿/gu)).toHaveLength(1);
            expect(question.stem).toBe(
              "（　）に入るものとして、最もよいものを一つ選んでください。",
            );
          }
          expect(
            question.passage?.body.match(/。/gu)?.length ?? 0,
          ).toBeGreaterThanOrEqual(4);
          expect(
            question.options.every(
              (option) =>
                !/(?:そして|しかし|だから|したがって)(?:を|に|も|のみ|だけ)$/u.test(
                  option.label,
                ),
            ),
          ).toBe(true);
        }
        if (
          question.officialType === "listening-verbal" ||
          question.officialType === "listening-quick-response"
        )
          expect(question.options).toHaveLength(3);
        if (question.officialType === "listening-verbal") {
          expect(question.listening?.verbalScene).toBeDefined();
          expect(question.listening?.audioOnlyOptions).toBe(true);
          expect(
            question.listening?.script.match(/何と言いますか。/gu),
          ).toHaveLength(1);
        } else {
          expect(question.listening?.verbalScene).toBeUndefined();
        }
        if (question.listening?.audioOnlyOptions)
          expect(question.listening.script).toMatch(
            /一、[\s\S]*二、[\s\S]*三、/,
          );
      }
    },
  );

  it.each(Object.entries(BANKS) as [JlptLevel, readonly JlptQuestion[]][])(
    "covers every official %s item type at least once",
    (level, questions) => {
      expect(
        new Set(questions.map((question) => question.officialType)),
      ).toEqual(new Set(OFFICIAL_TYPES_BY_LEVEL[level]));
    },
  );

  it("does not reuse question ids between levels", () => {
    const ids = Object.values(BANKS).flatMap((questions) =>
      questions.map((question) => question.id),
    );
    expect(new Set(ids).size).toBe(ids.length);
  });
});
