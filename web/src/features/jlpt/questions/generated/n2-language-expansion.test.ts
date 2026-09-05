import { describe, expect, it } from "vitest";
import { createJlptSession } from "../../engine";
import { jlptQuestionSemanticKey } from "../../editorial";
import type { JlptQuestion, JlptTestItemType } from "../../types";
import {
  N2_COMPOSITION_EXPANSION,
  N2_CONTEXT_EXPANSION,
  N2_GRAMMAR_EXPANSION,
  N2_LANGUAGE_EXPANSION_SOURCE_COUNT,
  N2_LEXEME_EXPANSION,
  N2_USAGE_EXPANSION,
  N2_WORD_FORMATION_EXPANSION,
} from "./n2-language-expansion";
import { N2_GENERATED_QUESTIONS } from "./n2.generated";

const EXPANSION_IDS = [
  ...N2_LEXEME_EXPANSION,
  ...N2_CONTEXT_EXPANSION,
  ...N2_USAGE_EXPANSION,
  ...N2_GRAMMAR_EXPANSION,
  ...N2_COMPOSITION_EXPANSION,
  ...N2_WORD_FORMATION_EXPANSION,
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
  return N2_GENERATED_QUESTIONS.filter(
    (question) =>
      question.officialType === type &&
      jlptQuestionSemanticKey(question) === `n2:${type}:${semanticIdentity}`,
  );
}

describe("N2 language-knowledge expansion tranche", () => {
  it("contains thirty-one independently identified source concepts across every thin N2 language pool", () => {
    expect(N2_LANGUAGE_EXPANSION_SOURCE_COUNT).toBe(31);
    expect(N2_LEXEME_EXPANSION).toHaveLength(7);
    expect(N2_CONTEXT_EXPANSION).toHaveLength(5);
    expect(N2_USAGE_EXPANSION).toHaveLength(4);
    expect(N2_GRAMMAR_EXPANSION).toHaveLength(6);
    expect(N2_COMPOSITION_EXPANSION).toHaveLength(5);
    expect(N2_WORD_FORMATION_EXPANSION).toHaveLength(4);
    expect(new Set(EXPANSION_IDS).size).toBe(EXPANSION_IDS.length);
    expect(
      EXPANSION_IDS.every((semanticId) => semanticId.startsWith("N2-")),
    ).toBe(true);
  });

  it("keeps all authored response sets distinct and structurally single-keyed", () => {
    for (const seed of N2_LEXEME_EXPANSION) {
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

    for (const seed of [
      ...N2_CONTEXT_EXPANSION,
      ...N2_GRAMMAR_EXPANSION,
      ...N2_WORD_FORMATION_EXPANSION,
    ]) {
      expect(seed.stem, seed.semanticId).toContain("＿＿");
      expect(
        new Set([seed.correct, ...seed.distractors]).size,
        seed.semanticId,
      ).toBe(4);
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThanOrEqual(
        50,
      );
    }

    for (const seed of N2_USAGE_EXPANSION) {
      const inflectionBase = seed.focus.replace(/する$/u, "").slice(0, -1);
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

    for (const seed of N2_COMPOSITION_EXPANSION) {
      expect(new Set(seed.parts).size, seed.semanticId).toBe(4);
      expect(seed.parts.every((part) => part.trim().length > 0)).toBe(true);
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThanOrEqual(
        90,
      );
    }
  });

  it("renders every new source with its reviewed key across controlled variants", () => {
    for (const seed of N2_LEXEME_EXPANSION) {
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

    for (const seed of N2_CONTEXT_EXPANSION) {
      const rendered = questionsForSemantic(
        "context-expression",
        seed.semanticId,
      );
      expect(rendered.length, seed.semanticId).toBeGreaterThan(0);
      expect(new Set(rendered.map(correctLabel)), seed.semanticId).toEqual(
        new Set([seed.correct]),
      );
    }

    for (const seed of N2_USAGE_EXPANSION) {
      const rendered = questionsForSemantic("usage", seed.focus);
      expect(rendered.length, seed.semanticId).toBeGreaterThan(0);
      expect(
        rendered.every((question) =>
          correctLabel(question)?.includes(seed.correct),
        ),
        seed.semanticId,
      ).toBe(true);
    }

    for (const seed of N2_GRAMMAR_EXPANSION) {
      const rendered = questionsForSemantic("grammar-form", seed.semanticId);
      expect(rendered.length, seed.semanticId).toBeGreaterThan(0);
      expect(new Set(rendered.map(correctLabel)), seed.semanticId).toEqual(
        new Set([seed.correct]),
      );
    }

    for (const seed of N2_WORD_FORMATION_EXPANSION) {
      const rendered = questionsForSemantic("word-formation", seed.semanticId);
      expect(rendered.length, seed.semanticId).toBeGreaterThan(0);
      expect(new Set(rendered.map(correctLabel)), seed.semanticId).toEqual(
        new Set([seed.correct]),
      );
    }

    for (const seed of N2_COMPOSITION_EXPANSION) {
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

  it("raises the seven target inventories while preserving 200 records per family", () => {
    const expectedSemantics: Partial<Record<JlptTestItemType, number>> = {
      "kanji-reading": 17,
      orthography: 17,
      "word-formation": 14,
      "context-expression": 15,
      paraphrase: 17,
      usage: 14,
      "grammar-form": 16,
      "sentence-composition": 15,
    };

    for (const [type, expectedCount] of Object.entries(expectedSemantics) as [
      JlptTestItemType,
      number,
    ][]) {
      const rendered = N2_GENERATED_QUESTIONS.filter(
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

  it("assembles the complete two-section N2 mock with the expanded bank", () => {
    const session = createJlptSession({
      level: "N2",
      mode: "mock",
      questions: N2_GENERATED_QUESTIONS,
      random: () => 0.41,
      now: new Date("2026-08-30T10:00:00.000Z"),
    });
    const ids = session.sectionQuestionIds.flat();
    const bankIds = new Set(
      N2_GENERATED_QUESTIONS.map((question) => question.id),
    );

    expect(session.sectionQuestionIds.map((section) => section.length)).toEqual(
      [75, 32],
    );
    expect(ids).toHaveLength(107);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => bankIds.has(id))).toBe(true);
  });
});
