import { describe, expect, it } from "vitest";
import { createJlptSession } from "../../engine";
import { jlptQuestionSemanticKey } from "../../editorial";
import type { JlptQuestion, JlptTestItemType } from "../../types";
import {
  N4_COMPOSITION_EXPANSION,
  N4_CONTEXT_EXPANSION,
  N4_GRAMMAR_EXPANSION,
  N4_LANGUAGE_EXPANSION_SOURCE_COUNT,
  N4_LEXEME_EXPANSION,
  N4_USAGE_EXPANSION,
} from "./n4-language-expansion";
import { N4_GENERATED_QUESTIONS } from "./n4.generated";

const EXPANSION_IDS = [
  ...N4_LEXEME_EXPANSION,
  ...N4_CONTEXT_EXPANSION,
  ...N4_USAGE_EXPANSION,
  ...N4_GRAMMAR_EXPANSION,
  ...N4_COMPOSITION_EXPANSION,
].map((seed) => seed.semanticId);

function correctLabel(question: JlptQuestion) {
  return question.options.find(
    (option) => option.id === question.correctOptionId,
  )?.label;
}

function questionsForSemantic(
  type: JlptTestItemType,
  semanticIdentity: string,
) {
  return N4_GENERATED_QUESTIONS.filter(
    (question) =>
      question.officialType === type &&
      jlptQuestionSemanticKey(question) === `n4:${type}:${semanticIdentity}`,
  );
}

describe("N4 language-knowledge expansion tranche", () => {
  it("contains thirty-two independently identified source concepts across all requested pools", () => {
    expect(N4_LANGUAGE_EXPANSION_SOURCE_COUNT).toBe(32);
    expect(N4_LEXEME_EXPANSION).toHaveLength(8);
    expect(N4_CONTEXT_EXPANSION).toHaveLength(5);
    expect(N4_USAGE_EXPANSION).toHaveLength(6);
    expect(N4_GRAMMAR_EXPANSION).toHaveLength(7);
    expect(N4_COMPOSITION_EXPANSION).toHaveLength(6);
    expect(new Set(EXPANSION_IDS).size).toBe(EXPANSION_IDS.length);
    expect(
      EXPANSION_IDS.every((semanticId) => semanticId.startsWith("N4-")),
    ).toBe(true);
  });

  it("keeps every authored response set nonempty and structurally single-keyed", () => {
    for (const seed of N4_LEXEME_EXPANSION) {
      expect(seed.sentence, seed.semanticId).toContain(seed.surface);
      expect(
        new Set([seed.reading, ...seed.readingDistractors]).size,
        `${seed.semanticId}: reading`,
      ).toBe(4);
      expect(
        new Set([seed.surface, ...seed.spellingDistractors]).size,
        `${seed.semanticId}: orthography`,
      ).toBe(4);
      expect(
        new Set([seed.paraphrase, ...seed.paraphraseDistractors]).size,
        `${seed.semanticId}: paraphrase`,
      ).toBe(4);
    }

    for (const seed of [...N4_CONTEXT_EXPANSION, ...N4_GRAMMAR_EXPANSION]) {
      expect(seed.stem, seed.semanticId).toContain("＿＿");
      expect(
        new Set([seed.correct, ...seed.distractors]).size,
        seed.semanticId,
      ).toBe(4);
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThanOrEqual(
        70,
      );
    }

    for (const seed of N4_USAGE_EXPANSION) {
      const inflectionBase = seed.focus.slice(0, -1);
      expect(
        [seed.correct, ...seed.distractors].every((sentence) =>
          sentence.includes(inflectionBase),
        ),
        seed.semanticId,
      ).toBe(true);
      expect(
        new Set([seed.correct, ...seed.distractors]).size,
        seed.semanticId,
      ).toBe(4);
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThanOrEqual(
        80,
      );
    }

    for (const seed of N4_COMPOSITION_EXPANSION) {
      expect(new Set(seed.parts).size, seed.semanticId).toBe(4);
      expect(seed.parts.every((part) => part.trim().length > 0)).toBe(true);
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThanOrEqual(
        80,
      );
    }
  });

  it("renders every new seed with the reviewed answer across controlled variants", () => {
    for (const seed of N4_LEXEME_EXPANSION) {
      const expectedByType = {
        "kanji-reading": seed.reading,
        orthography: seed.surface,
        paraphrase: seed.paraphrase,
      } as const;

      for (const [type, expected] of Object.entries(expectedByType) as [
        keyof typeof expectedByType,
        string,
      ][]) {
        const rendered = questionsForSemantic(type, seed.surface);
        expect(rendered.length, `${seed.semanticId}: ${type}`).toBeGreaterThan(
          0,
        );
        expect(
          new Set(rendered.map(correctLabel)),
          `${seed.semanticId}: ${type}`,
        ).toEqual(new Set([expected]));
      }
    }

    for (const seed of N4_CONTEXT_EXPANSION) {
      const rendered = questionsForSemantic(
        "context-expression",
        seed.semanticId,
      );
      expect(rendered.length, seed.semanticId).toBeGreaterThan(0);
      expect(new Set(rendered.map(correctLabel)), seed.semanticId).toEqual(
        new Set([seed.correct]),
      );
    }

    for (const seed of N4_USAGE_EXPANSION) {
      const rendered = questionsForSemantic("usage", seed.focus);
      expect(rendered.length, seed.semanticId).toBeGreaterThan(0);
      expect(
        rendered.every((question) =>
          correctLabel(question)?.includes(seed.correct),
        ),
        seed.semanticId,
      ).toBe(true);
    }

    for (const seed of N4_GRAMMAR_EXPANSION) {
      const rendered = questionsForSemantic("grammar-form", seed.semanticId);
      expect(rendered.length, seed.semanticId).toBeGreaterThan(0);
      expect(new Set(rendered.map(correctLabel)), seed.semanticId).toEqual(
        new Set([seed.correct]),
      );
    }

    for (const seed of N4_COMPOSITION_EXPANSION) {
      const rendered = questionsForSemantic(
        "sentence-composition",
        seed.semanticId,
      );
      expect(rendered.length, seed.semanticId).toBeGreaterThan(0);
      expect(new Set(rendered.map(correctLabel)), seed.semanticId).toEqual(
        new Set([seed.parts[2]]),
      );
      expect(
        rendered.every(
          (question) =>
            question.sentenceComposition?.canonicalOrderOptionIds.length ===
              4 &&
            new Set(question.sentenceComposition.canonicalOrderOptionIds)
              .size === 4,
        ),
        seed.semanticId,
      ).toBe(true);
    }
  });

  it("raises the targeted semantic inventories without changing the 200-record contract", () => {
    const expectedSemantics: Partial<Record<JlptTestItemType, number>> = {
      "kanji-reading": 18,
      orthography: 18,
      "context-expression": 15,
      paraphrase: 18,
      usage: 16,
      "grammar-form": 18,
      "sentence-composition": 16,
    };

    for (const [type, expectedCount] of Object.entries(expectedSemantics) as [
      JlptTestItemType,
      number,
    ][]) {
      const rendered = N4_GENERATED_QUESTIONS.filter(
        (question) => question.officialType === type,
      );
      expect(rendered, type).toHaveLength(200);
      expect(new Set(rendered.map(jlptQuestionSemanticKey)).size, type).toBe(
        expectedCount,
      );
      expect(
        rendered.every(
          (question) =>
            question.options.length === 4 &&
            new Set(question.options.map((option) => option.label)).size ===
              4 &&
            question.options.some(
              (option) => option.id === question.correctOptionId,
            ),
        ),
        type,
      ).toBe(true);
    }
  });

  it("assembles a complete N4 mock with the expanded bank", () => {
    const session = createJlptSession({
      level: "N4",
      mode: "mock",
      questions: N4_GENERATED_QUESTIONS,
      random: () => 0.37,
      now: new Date("2026-08-30T08:00:00.000Z"),
    });
    const ids = session.sectionQuestionIds.flat();
    const bankIds = new Set(
      N4_GENERATED_QUESTIONS.map((question) => question.id),
    );

    expect(session.sectionQuestionIds.map((section) => section.length)).toEqual(
      [28, 29, 28],
    );
    expect(ids).toHaveLength(85);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => bankIds.has(id))).toBe(true);
  });
});
