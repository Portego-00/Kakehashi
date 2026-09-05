import { describe, expect, it } from "vitest";
import { createJlptSession } from "../../engine";
import {
  jlptQuestionSemanticKey,
  summarizeJlptEditorialCoverage,
} from "../../editorial";
import {
  JLPT_APPROXIMATE_ITEM_COUNTS,
  JLPT_MOCK_STRUCTURES,
  OFFICIAL_TYPES_BY_LEVEL,
  supportsOfficialType,
  testSectionIdForQuestion,
} from "../../structure";
import type { JlptQuestion, JlptTestItemType } from "../../types";
import { N1_QUESTIONS } from "../n1";
import {
  N1_COMPOSITION_EXPANSION,
  N1_CONTEXT_EXPANSION,
  N1_GRAMMAR_EXPANSION,
  N1_LANGUAGE_EXPANSION_EDITORIAL_STATUS,
  N1_LANGUAGE_EXPANSION_SOURCE_IDS,
  N1_LEXEME_EXPANSION,
  N1_USAGE_EXPANSION,
} from "./n1-language-expansion";
import { N1_GENERATED_QUESTIONS } from "./n1.generated";

const expectedLexemes = [
  ["逼迫", "ひっぱく", "余裕がほとんどない状態になっている"],
  ["払拭", "ふっしょく", "すっかり取り除く"],
  ["醸成", "じょうせい", "時間をかけて作り上げる"],
  ["頓挫", "とんざ", "途中で行き詰まって止まる"],
  ["逸脱", "いつだつ", "決められた範囲から外れる"],
  ["勘案", "かんあん", "複数の事情を考え合わせる"],
  ["収斂", "しゅうれん", "次第に一つの方向へまとまる"],
  ["黙認", "もくにん", "問題だと知りながら止めずに認める"],
  ["毀損", "きそん", "価値や信用を傷つける"],
  ["淘汰", "とうた", "選別されて残らなくなる"],
] as const;

const expectedContextAnswers = [
  "不明瞭",
  "膠着",
  "ゆがんで",
  "裏付ける",
  "捉える",
] as const;
const expectedUsageFocuses = [
  "講じる",
  "まかなう",
  "見据える",
  "如実",
  "つぶさに",
] as const;
const expectedGrammarAnswers = [
  "ほかにいない",
  "すべく",
  "ともなく",
  "させずにはおかない",
  "と相まって",
] as const;
const expectedCompositions = [
  "この調査は方針を見直すに足る十分な根拠を示しています。",
  "事情のいかんにかかわらず、期限後の申請は受理できません。",
  "{person}氏は周囲の反対をものともせず改革を進めました。",
  "一度引き受けた以上途中で投げ出すわけにはいきません。",
  "説明が不十分であったことは否めないものの、結論自体は妥当です。",
] as const;

const EXPANDED_TYPES = [
  "kanji-reading",
  "context-expression",
  "paraphrase",
  "usage",
  "grammar-form",
  "sentence-composition",
] as const satisfies readonly JlptTestItemType[];

function correctLabel(question: JlptQuestion) {
  return question.options.find(
    (option) => option.id === question.correctOptionId,
  )?.label;
}

function variantZero(semanticKey: string) {
  const question = N1_GENERATED_QUESTIONS.find(
    (candidate) =>
      jlptQuestionSemanticKey(candidate) === semanticKey &&
      candidate.provenance?.variantIndex === 0,
  );
  expect(question, semanticKey).toBeDefined();
  return question!;
}

function newSemanticKeys() {
  return new Set([
    ...N1_LEXEME_EXPANSION.flatMap((seed) => [
      `n1:kanji-reading:${seed.surface}`,
      `n1:paraphrase:${seed.surface}`,
    ]),
    ...N1_CONTEXT_EXPANSION.map(
      (seed) => `n1:context-expression:${seed.semanticId}`,
    ),
    ...N1_USAGE_EXPANSION.map((seed) => `n1:usage:${seed.focus}`),
    ...N1_GRAMMAR_EXPANSION.map((seed) => `n1:grammar-form:${seed.semanticId}`),
    ...N1_COMPOSITION_EXPANSION.map(
      (seed) => `n1:sentence-composition:${seed.semanticId}`,
    ),
  ]);
}

describe("N1 language-knowledge semantic expansion", () => {
  it("contains exactly 30 distinct machine-validated source concepts", () => {
    expect(N1_LANGUAGE_EXPANSION_EDITORIAL_STATUS).toBe("machine-validated");
    expect(N1_LEXEME_EXPANSION).toHaveLength(10);
    expect(N1_CONTEXT_EXPANSION).toHaveLength(5);
    expect(N1_USAGE_EXPANSION).toHaveLength(5);
    expect(N1_GRAMMAR_EXPANSION).toHaveLength(5);
    expect(N1_COMPOSITION_EXPANSION).toHaveLength(5);
    expect(N1_LANGUAGE_EXPANSION_SOURCE_IDS).toHaveLength(30);
    expect(new Set(N1_LANGUAGE_EXPANSION_SOURCE_IDS).size).toBe(30);
    expect(N1_LANGUAGE_EXPANSION_SOURCE_IDS.every((id) => id.length >= 8)).toBe(
      true,
    );
  });

  it("pins every reviewed answer and stable source identity", () => {
    expect(
      N1_LEXEME_EXPANSION.map((seed) => [
        seed.surface,
        seed.reading,
        seed.paraphrase,
      ]),
    ).toEqual(expectedLexemes);
    expect(N1_CONTEXT_EXPANSION.map((seed) => seed.correct)).toEqual(
      expectedContextAnswers,
    );
    expect(N1_USAGE_EXPANSION.map((seed) => seed.focus)).toEqual(
      expectedUsageFocuses,
    );
    expect(N1_GRAMMAR_EXPANSION.map((seed) => seed.correct)).toEqual(
      expectedGrammarAnswers,
    );
    expect(
      N1_COMPOSITION_EXPANSION.map(
        (seed) => `${seed.prefix}${seed.parts.join("")}${seed.suffix}`,
      ),
    ).toEqual(expectedCompositions);

    for (const seed of N1_LEXEME_EXPANSION) {
      expect(
        seed.sentence.match(new RegExp(seed.surface, "gu")),
        seed.surface,
      ).toHaveLength(1);
      expect(
        new Set([seed.reading, ...seed.readingDistractors]).size,
        `${seed.surface} readings`,
      ).toBe(4);
      expect(
        new Set([seed.surface, ...seed.spellingDistractors]).size,
        `${seed.surface} spellings`,
      ).toBe(4);
      expect(
        new Set([seed.paraphrase, ...seed.paraphraseDistractors]).size,
        `${seed.surface} paraphrases`,
      ).toBe(4);
    }
    for (const seed of [...N1_CONTEXT_EXPANSION, ...N1_GRAMMAR_EXPANSION]) {
      expect(
        new Set([seed.correct, ...seed.distractors]).size,
        seed.semanticId,
      ).toBe(4);
      expect(seed.stem.match(/＿＿/gu), seed.semanticId).toHaveLength(1);
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThan(40);
    }
    for (const seed of N1_USAGE_EXPANSION) {
      const inflectionStem = seed.focus.replace(/[うる]$/u, "");
      expect(
        new Set([seed.correct, ...seed.distractors]).size,
        seed.focus,
      ).toBe(4);
      expect(seed.correct, seed.focus).toContain(inflectionStem);
      expect(
        seed.distractors.every((sentence) => sentence.includes(inflectionStem)),
        seed.focus,
      ).toBe(true);
      expect(seed.explanation.length, seed.focus).toBeGreaterThan(40);
    }
    for (const seed of N1_COMPOSITION_EXPANSION) {
      expect(new Set(seed.parts).size, seed.semanticId).toBe(4);
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThan(40);
    }
  });

  it("uses original Japanese-shaped payloads and only supported placeholders", () => {
    const authoredText = [
      ...N1_LEXEME_EXPANSION.flatMap((seed) => [
        seed.sentence,
        seed.paraphrase,
        ...seed.paraphraseDistractors,
      ]),
      ...N1_CONTEXT_EXPANSION.flatMap((seed) => [
        seed.stem,
        seed.correct,
        ...seed.distractors,
      ]),
      ...N1_USAGE_EXPANSION.flatMap((seed) => [
        seed.correct,
        ...seed.distractors,
      ]),
      ...N1_GRAMMAR_EXPANSION.flatMap((seed) => [
        seed.stem,
        seed.correct,
        ...seed.distractors,
      ]),
      ...N1_COMPOSITION_EXPANSION.flatMap((seed) => [
        seed.prefix,
        ...seed.parts,
      ]),
    ];
    for (const text of authoredText) {
      expect(text, text).toMatch(/[ぁ-んァ-ヶ一-龯]/u);
      expect(text, text).not.toMatch(/\$\{|\{(?!person\})/u);
      expect(text, text).not.toMatch(/公式問題|出典|JLPT|sample question/iu);
    }

    const keys = newSemanticKeys();
    const rendered = N1_GENERATED_QUESTIONS.filter((question) =>
      keys.has(jlptQuestionSemanticKey(question)),
    );
    expect(rendered.length).toBeGreaterThan(0);
    for (const question of rendered) {
      expect(
        `${question.stem}${question.focus ?? ""}`,
        question.id,
      ).not.toMatch(/\{[^}]+\}/u);
      expect(question.explanation.trim().length, question.id).toBeGreaterThan(
        30,
      );
      expect(
        new Set(question.options.map((option) => option.label)).size,
        question.id,
      ).toBe(question.options.length);
      expect(correctLabel(question), question.id).toBeTruthy();
    }
  });

  it("owns exactly 40 stable cell-scoped runtime semantics with the expected per-cell expansion", () => {
    const keys = newSemanticKeys();
    expect(keys.size).toBe(40);
    const generatedKeys = new Set(
      N1_GENERATED_QUESTIONS.map(jlptQuestionSemanticKey),
    );
    for (const key of keys) expect(generatedKeys.has(key), key).toBe(true);

    const expanded = N1_GENERATED_QUESTIONS.filter((question) =>
      keys.has(jlptQuestionSemanticKey(question)),
    );
    expect(new Set(expanded.map(jlptQuestionSemanticKey))).toEqual(keys);
    expect(new Set(expanded.map((question) => question.id)).size).toBe(
      expanded.length,
    );
    expect(
      expanded.every(
        (question) =>
          question.provenance?.editorialStatus === "machine-validated",
      ),
    ).toBe(true);
    const expectedSemanticCounts: Record<
      (typeof EXPANDED_TYPES)[number],
      number
    > = {
      "kanji-reading": 20,
      "context-expression": 15,
      paraphrase: 20,
      usage: 15,
      "grammar-form": 15,
      "sentence-composition": 15,
    };
    for (const officialType of EXPANDED_TYPES) {
      const semantics = new Set(
        N1_GENERATED_QUESTIONS.filter(
          (question) => question.officialType === officialType,
        ).map(jlptQuestionSemanticKey),
      );
      expect(semantics.size, officialType).toBe(
        expectedSemanticCounts[officialType],
      );
    }

    expect(N1_GENERATED_QUESTIONS).toHaveLength(3_600);
    expect(N1_QUESTIONS).toHaveLength(3_621);
    expect(
      summarizeJlptEditorialCoverage(N1_GENERATED_QUESTIONS).semanticItems,
    ).toBe(250);
    expect(summarizeJlptEditorialCoverage(N1_QUESTIONS).semanticItems).toBe(
      271,
    );
  });

  it("renders the reviewed correct answer for every new semantic family", () => {
    for (const seed of N1_LEXEME_EXPANSION) {
      expect(
        correctLabel(variantZero(`n1:kanji-reading:${seed.surface}`)),
      ).toBe(seed.reading);
      expect(correctLabel(variantZero(`n1:paraphrase:${seed.surface}`))).toBe(
        seed.paraphrase,
      );
    }
    for (const seed of N1_CONTEXT_EXPANSION) {
      expect(
        correctLabel(variantZero(`n1:context-expression:${seed.semanticId}`)),
      ).toBe(seed.correct);
    }
    for (const seed of N1_USAGE_EXPANSION) {
      expect(correctLabel(variantZero(`n1:usage:${seed.focus}`))).toContain(
        seed.correct,
      );
    }
    for (const seed of N1_GRAMMAR_EXPANSION) {
      expect(
        correctLabel(variantZero(`n1:grammar-form:${seed.semanticId}`)),
      ).toBe(seed.correct);
    }
    for (const [index, seed] of N1_COMPOSITION_EXPANSION.entries()) {
      const question = variantZero(
        `n1:sentence-composition:${seed.semanticId}`,
      );
      const byId = new Map(
        question.options.map((option) => [option.id, option.label]),
      );
      const ordered = question
        .sentenceComposition!.canonicalOrderOptionIds.map((id) => byId.get(id))
        .join("");
      expect(ordered).toBe(seed.parts.join(""));
      expect(`${seed.prefix}${ordered}${seed.suffix}`).toBe(
        expectedCompositions[index],
      );
      expect(question.correctOptionId).toBe(
        question.sentenceComposition!.canonicalOrderOptionIds[
          question.sentenceComposition!.starredPosition
        ],
      );
    }
  });

  it("keeps every new rendering compatible with a complete official-shaped N1 mock", () => {
    const keys = newSemanticKeys();
    const expanded = N1_GENERATED_QUESTIONS.filter((question) =>
      keys.has(jlptQuestionSemanticKey(question)),
    );
    for (const question of expanded) {
      expect(
        supportsOfficialType("N1", question.officialType),
        question.id,
      ).toBe(true);
      expect(testSectionIdForQuestion("N1", question), question.id).toBe(
        "language-reading",
      );
    }

    const session = createJlptSession({
      level: "N1",
      mode: "mock",
      questions: N1_GENERATED_QUESTIONS,
      random: () => 0,
      now: new Date("2026-08-30T10:00:00.000Z"),
    });
    const byId = new Map(
      N1_GENERATED_QUESTIONS.map((question) => [question.id, question]),
    );
    const selected = session.sectionQuestionIds.flatMap((ids) =>
      ids.map((id) => byId.get(id)!),
    );
    expect(session.sectionQuestionIds).toHaveLength(
      JLPT_MOCK_STRUCTURES.N1.sections.length,
    );
    expect(selected).toHaveLength(
      Object.values(JLPT_APPROXIMATE_ITEM_COUNTS.N1).reduce(
        (total, count) => total + count,
        0,
      ),
    );
    for (const officialType of OFFICIAL_TYPES_BY_LEVEL.N1) {
      expect(
        selected.filter((question) => question.officialType === officialType),
        officialType,
      ).toHaveLength(JLPT_APPROXIMATE_ITEM_COUNTS.N1[officialType] ?? 0);
    }
  });
});
