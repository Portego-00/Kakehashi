import { describe, expect, it } from "vitest";
import type { JlptLevel, JlptQuestion } from "../../types";
import type { TextGrammarSeed } from "./bank-builder";
import { N1_GENERATED_QUESTIONS } from "./n1.generated";
import { N2_GENERATED_QUESTIONS } from "./n2.generated";
import { N3_GENERATED_QUESTIONS } from "./n3.generated";
import { N4_GENERATED_QUESTIONS } from "./n4.generated";
import { N5_GENERATED_QUESTIONS } from "./n5.generated";
import {
  N1_TEXT_GRAMMAR_SEEDS,
  N2_TEXT_GRAMMAR_SEEDS,
  N3_TEXT_GRAMMAR_SEEDS,
  N4_TEXT_GRAMMAR_SEEDS,
  N5_TEXT_GRAMMAR_SEEDS,
} from "./text-grammar-seeds";

const SEEDS: Record<JlptLevel, readonly TextGrammarSeed[]> = {
  N5: N5_TEXT_GRAMMAR_SEEDS,
  N4: N4_TEXT_GRAMMAR_SEEDS,
  N3: N3_TEXT_GRAMMAR_SEEDS,
  N2: N2_TEXT_GRAMMAR_SEEDS,
  N1: N1_TEXT_GRAMMAR_SEEDS,
};

const BANKS: Record<JlptLevel, readonly JlptQuestion[]> = {
  N5: N5_GENERATED_QUESTIONS,
  N4: N4_GENERATED_QUESTIONS,
  N3: N3_GENERATED_QUESTIONS,
  N2: N2_GENERATED_QUESTIONS,
  N1: N1_GENERATED_QUESTIONS,
};

const MINIMUM_PASSAGE_LENGTH: Record<JlptLevel, number> = {
  N5: 60,
  N4: 80,
  N3: 90,
  N2: 105,
  N1: 125,
};

const GIVEAWAY_SUFFIX =
  /(?:そして|しかし|だから|したがって|たとえば|つまり|一方で|その結果|それなのに)(?:を|に|も|のみ|だけ)$/u;

function completedPassage(seed: TextGrammarSeed) {
  return seed.passage.replace("＿＿", seed.correct);
}

function normalizedPassage(seed: TextGrammarSeed) {
  return completedPassage(seed)
    .replace(
      /\{(?:person|other|place|day|nextDay|time|nextTime|count)\}/gu,
      "{value}",
    )
    .replace(/[\s「」『』、。]/gu, "");
}

describe("generated JLPT text grammar", () => {
  it.each(Object.entries(SEEDS) as [JlptLevel, readonly TextGrammarSeed[]][])(
    "keeps at least twenty substantive, explicitly keyed %s passage-flow seeds",
    (level, seeds) => {
      expect(seeds.length).toBeGreaterThanOrEqual(20);
      expect(new Set(seeds.map((seed) => seed.id)).size).toBe(seeds.length);
      expect(new Set(seeds.map((seed) => seed.blankId)).size).toBe(
        seeds.length,
      );
      expect(new Set(seeds.map(completedPassage)).size).toBeGreaterThanOrEqual(
        20,
      );

      for (const seed of seeds) {
        expect(seed.id).toMatch(new RegExp(`^${level.toLowerCase()}-tg-`));
        expect(seed.groupId.trim()).not.toBe("");
        expect(seed.blankId.trim()).not.toBe("");
        expect(seed.blankOrder).toBeGreaterThan(0);
        expect(seed.passage.match(/＿＿/gu)).toHaveLength(1);
        expect(seed.passage.replace(/\s/gu, "").length).toBeGreaterThanOrEqual(
          MINIMUM_PASSAGE_LENGTH[level],
        );
        expect(seed.passage.match(/。/gu)?.length ?? 0).toBeGreaterThanOrEqual(
          4,
        );
        expect(new Set([seed.correct, ...seed.distractors]).size).toBe(4);
        expect(seed.explanation.trim().length).toBeGreaterThan(40);
        expect(
          [seed.correct, ...seed.distractors].every(
            (choice) => !choice.includes("＿＿"),
          ),
        ).toBe(true);
        expect(
          seed.distractors.every((choice) => !GIVEAWAY_SUFFIX.test(choice)),
        ).toBe(true);

        if (seed.passage.includes("＿＿。")) {
          expect(
            [seed.correct, ...seed.distractors].every(
              (choice) => !/[をがにではへとのも]$/u.test(choice),
            ),
          ).toBe(true);
        }
      }
    },
  );

  it.each(Object.entries(SEEDS) as [JlptLevel, readonly TextGrammarSeed[]][])(
    "preserves a validated multi-blank passage group for %s",
    (_level, seeds) => {
      const grouped = seeds.reduce<Map<string, TextGrammarSeed[]>>(
        (groups, seed) => {
          groups.set(seed.groupId, [...(groups.get(seed.groupId) ?? []), seed]);
          return groups;
        },
        new Map(),
      );
      const multiBlankGroups = [...grouped.values()].filter(
        (group) => group.length > 1,
      );
      expect(multiBlankGroups.length).toBeGreaterThanOrEqual(1);

      for (const group of multiBlankGroups) {
        expect(
          group
            .map((seed) => seed.blankOrder)
            .sort((left, right) => left - right),
        ).toEqual(
          Array.from({ length: group.length }, (_, index) => index + 1),
        );
        expect(new Set(group.map(completedPassage)).size).toBe(1);
        expect(group.every((seed) => Boolean(seed.canonicalPassage))).toBe(
          true,
        );
        expect(new Set(group.map((seed) => seed.canonicalPassage)).size).toBe(
          1,
        );
        expect(group[0].canonicalPassage?.match(/［\d+］＿＿/gu)).toHaveLength(
          group.length,
        );
      }
    },
  );

  it.each(Object.entries(BANKS) as [JlptLevel, readonly JlptQuestion[]][])(
    "renders 200 %s questions as passages rather than connector-only stems",
    (level, questions) => {
      const textGrammar = questions.filter(
        (question) => question.officialType === "text-grammar",
      );
      expect(textGrammar).toHaveLength(200);

      for (const [index, question] of textGrammar.entries()) {
        const seed = SEEDS[level][index % SEEDS[level].length];
        const blankCount = seed.canonicalPassage
          ? SEEDS[level].filter(
              (candidate) => candidate.groupId === seed.groupId,
            ).length
          : 1;
        expect(question.passage?.body.match(/＿＿/gu)).toHaveLength(blankCount);
        expect(
          question.passage?.body.match(/。/gu)?.length ?? 0,
        ).toBeGreaterThanOrEqual(4);
        expect(question.stem).toBe(
          seed.canonicalPassage
            ? `文章を読み、空所${seed.blankOrder}に入るものとして、最もよいものを一つ選んでください。`
            : "（　）に入るものとして、最もよいものを一つ選んでください。",
        );
        expect(question.provenance?.semanticKey).toBe(
          `${level.toLowerCase()}:text-grammar:${seed.id}`,
        );
        expect(question.passage?.blankOrder).toBe(seed.blankOrder);
      }

      const grouped = textGrammar.reduce<Map<string, JlptQuestion[]>>(
        (groups, question) => {
          const groupId = question.passage?.groupId;
          if (!groupId) return groups;
          groups.set(groupId, [...(groups.get(groupId) ?? []), question]);
          return groups;
        },
        new Map(),
      );
      const multiBlankGroups = [...grouped.values()].filter(
        (group) => group.length > 1,
      );
      expect(multiBlankGroups.length).toBeGreaterThanOrEqual(1);
      for (const group of multiBlankGroups) {
        expect(
          group.map((question) => question.passage?.blankOrder).sort(),
        ).toEqual([1, 2]);
        expect(
          new Set(group.map((question) => question.passage?.blankId)).size,
        ).toBe(2);
        expect(
          new Set(group.map((question) => question.passage?.body)).size,
        ).toBe(1);
        expect(group[0].passage?.body.match(/［\d+］＿＿/gu)).toHaveLength(2);
        const keyedAnswers = group.map(
          (question) =>
            question.options.find(
              (option) => option.id === question.correctOptionId,
            )?.label ?? "",
        );
        expect(
          keyedAnswers.every(
            (answer) => !group[0].passage?.body.includes(answer),
          ),
        ).toBe(true);
      }
    },
  );

  it.each(Object.entries(SEEDS) as [JlptLevel, readonly TextGrammarSeed[]][])(
    "mixes connector and whole-sentence passage decisions at %s",
    (_level, seeds) => {
      expect(
        seeds.filter((seed) => seed.passage.includes("＿＿、")).length,
      ).toBeGreaterThanOrEqual(10);
      expect(
        seeds.filter((seed) => seed.passage.includes("＿＿。")).length,
      ).toBeGreaterThanOrEqual(4);
    },
  );

  it("keeps normalized semantic passages independent across levels", () => {
    const owners = new Map<string, JlptLevel>();
    for (const [level, seeds] of Object.entries(SEEDS) as [
      JlptLevel,
      readonly TextGrammarSeed[],
    ][]) {
      for (const seed of seeds) {
        const normalized = normalizedPassage(seed);
        const existingLevel = owners.get(normalized);
        expect(
          existingLevel === undefined || existingLevel === level,
          `${seed.id} duplicates a ${existingLevel ?? "different"} level passage`,
        ).toBe(true);
        if (existingLevel === undefined) owners.set(normalized, level);
      }
    }
  });

  it("preserves the audited contrast evidence in the N4 and N3 grouped passages", () => {
    const clinic = N4_TEXT_GRAMMAR_SEEDS.find(
      (seed) => seed.id === "n4-tg-clinic-notice-blank-1",
    )!;
    expect(clinic.canonicalPassage).toContain(
      "以前は利用者が少なく、長く待つことはなかった",
    );
    expect(clinic.correct).toBe("ところが");

    const training = N3_TEXT_GRAMMAR_SEEDS.find(
      (seed) => seed.id === "n3-tg-training-review-blank-1",
    )!;
    expect(training.canonicalPassage).toContain(
      "担当者は十分理解できたと考えていた",
    );
    expect(training.correct).toBe("ところが");
    expect(training.distractors).not.toContain("そのため");
  });
});
