import { describe, expect, it } from "vitest";
import { createJlptSession } from "../../engine";
import { jlptQuestionSemanticKey } from "../../editorial";
import {
  JLPT_APPROXIMATE_ITEM_COUNTS,
  JLPT_MOCK_STRUCTURES,
  OFFICIAL_TYPES_BY_LEVEL,
  supportsOfficialType,
  testSectionIdForQuestion,
} from "../../structure";
import type { JlptQuestion } from "../../types";
import {
  N5_COMPOSITION_EXPANSION,
  N5_CONTEXT_EXPANSION,
  N5_GRAMMAR_EXPANSION,
  N5_LANGUAGE_EXPANSION_EDITORIAL_STATUS,
  N5_LEXEME_EXPANSION,
} from "./n5-language-expansion";
import { N5_GENERATED_QUESTIONS } from "./n5.generated";

const expectedLexemes = [
  ["入口", "いりぐち", "中へ入るところ"],
  ["出口", "でぐち", "外へ出るところ"],
  ["午前", "ごぜん", "昼の十二時より前"],
  ["午後", "ごご", "昼の十二時よりあと"],
  ["天気", "てんき", "晴れや雨などのようす"],
  ["名前", "なまえ", "人をよぶときのことば"],
  ["電話", "でんわ", "遠くの人と話すもの"],
  ["時間", "じかん", "何かをする時"],
  ["外国", "がいこく", "日本ではない国"],
  ["白い", "しろい", "雪のような色の"],
  ["上手", "じょうず", "ピアノをひくのがうまい"],
  ["去年", "きょねん", "今年の前の年"],
] as const;

const expectedContextAnswers = [
  "洗って",
  "重い",
  "見ます",
  "あげます",
  "みがきます",
] as const;
const expectedGrammarAnswers = ["と", "まで", "ください", "ません"] as const;
const expectedCompositions = [
  "このかばんは高くありません。",
  "きのうはどこへも行きませんでした。",
  "これは母が作ったいちごのケーキです。",
  "わたしのへやには小さいつくえが一つあります。",
] as const;

function correctLabel(question: JlptQuestion) {
  return question.options.find(
    (option) => option.id === question.correctOptionId,
  )?.label;
}

function variantZero(semanticKey: string) {
  const question = N5_GENERATED_QUESTIONS.find(
    (candidate) =>
      jlptQuestionSemanticKey(candidate) === semanticKey &&
      candidate.provenance?.variantIndex === 0,
  );
  expect(question, semanticKey).toBeDefined();
  return question!;
}

function newSemanticKeys() {
  return new Set([
    ...N5_LEXEME_EXPANSION.flatMap((seed) => [
      `n5:kanji-reading:${seed.surface}`,
      `n5:orthography:${seed.surface}`,
      `n5:paraphrase:${seed.surface}`,
    ]),
    ...N5_CONTEXT_EXPANSION.map(
      (seed) => `n5:context-expression:${seed.semanticId}`,
    ),
    ...N5_GRAMMAR_EXPANSION.map((seed) => `n5:grammar-form:${seed.semanticId}`),
    ...N5_COMPOSITION_EXPANSION.map(
      (seed) => `n5:sentence-composition:${seed.semanticId}`,
    ),
  ]);
}

describe("N5 language-knowledge semantic expansion", () => {
  it("contains exactly 25 distinct machine-validated source items", () => {
    expect(N5_LANGUAGE_EXPANSION_EDITORIAL_STATUS).toBe("machine-validated");
    expect(N5_LEXEME_EXPANSION).toHaveLength(12);
    expect(N5_CONTEXT_EXPANSION).toHaveLength(5);
    expect(N5_GRAMMAR_EXPANSION).toHaveLength(4);
    expect(N5_COMPOSITION_EXPANSION).toHaveLength(4);
    expect(
      N5_LEXEME_EXPANSION.length +
        N5_CONTEXT_EXPANSION.length +
        N5_GRAMMAR_EXPANSION.length +
        N5_COMPOSITION_EXPANSION.length,
    ).toBe(25);

    expect(new Set(N5_LEXEME_EXPANSION.map((seed) => seed.surface)).size).toBe(
      12,
    );
    const authoredIds = [
      ...N5_CONTEXT_EXPANSION.map((seed) => seed.semanticId),
      ...N5_GRAMMAR_EXPANSION.map((seed) => seed.semanticId),
      ...N5_COMPOSITION_EXPANSION.map((seed) => seed.semanticId),
    ];
    expect(new Set(authoredIds).size).toBe(authoredIds.length);
    expect(authoredIds.every((id) => id.length >= 12)).toBe(true);
  });

  it("keeps every source answer unique, explicit, and pinned to the reviewed key", () => {
    expect(
      N5_LEXEME_EXPANSION.map((seed) => [
        seed.surface,
        seed.reading,
        seed.paraphrase,
      ]),
    ).toEqual(expectedLexemes);
    expect(N5_CONTEXT_EXPANSION.map((seed) => seed.correct)).toEqual(
      expectedContextAnswers,
    );
    expect(N5_GRAMMAR_EXPANSION.map((seed) => seed.correct)).toEqual(
      expectedGrammarAnswers,
    );
    expect(
      N5_COMPOSITION_EXPANSION.map(
        (seed) => `${seed.prefix}${seed.parts.join("")}${seed.suffix}`,
      ),
    ).toEqual(expectedCompositions);

    for (const seed of N5_LEXEME_EXPANSION) {
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
    for (const seed of [...N5_CONTEXT_EXPANSION, ...N5_GRAMMAR_EXPANSION]) {
      expect(
        new Set([seed.correct, ...seed.distractors]).size,
        seed.semanticId,
      ).toBe(4);
      expect(seed.stem.match(/＿＿/gu), seed.semanticId).toHaveLength(1);
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThan(45);
    }
    for (const seed of N5_COMPOSITION_EXPANSION) {
      expect(new Set(seed.parts).size, seed.semanticId).toBe(4);
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThan(45);
    }
  });

  it("uses natural Japanese-shaped payloads and only supported placeholders", () => {
    const authoredText = [
      ...N5_LEXEME_EXPANSION.flatMap((seed) => [
        seed.sentence,
        seed.paraphrase,
        ...seed.paraphraseDistractors,
      ]),
      ...N5_CONTEXT_EXPANSION.map((seed) => seed.stem),
      ...N5_GRAMMAR_EXPANSION.map((seed) => seed.stem),
      ...N5_COMPOSITION_EXPANSION.flatMap((seed) => [
        seed.prefix,
        ...seed.parts,
      ]),
    ];
    for (const text of authoredText) {
      expect(text, text).toMatch(/[ぁ-んァ-ヶ一-龯]/u);
      expect(text, text).not.toMatch(/\$\{|\{(?!person\}|other\}|day\})/u);
      expect(text, text).not.toMatch(/公式問題|出典|JLPT|sample question/iu);
    }

    const keys = newSemanticKeys();
    const rendered = N5_GENERATED_QUESTIONS.filter((question) =>
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

  it("owns exactly 49 stable cell-scoped semantics without collisions", () => {
    const keys = newSemanticKeys();
    expect(keys.size).toBe(49);
    const generatedKeys = new Set(
      N5_GENERATED_QUESTIONS.map(jlptQuestionSemanticKey),
    );
    for (const key of keys) expect(generatedKeys.has(key), key).toBe(true);

    const expanded = N5_GENERATED_QUESTIONS.filter((question) =>
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
  });

  it("renders the reviewed correct answers for every new semantic family", () => {
    for (const seed of N5_LEXEME_EXPANSION) {
      expect(
        correctLabel(variantZero(`n5:kanji-reading:${seed.surface}`)),
      ).toBe(seed.reading);
      expect(correctLabel(variantZero(`n5:orthography:${seed.surface}`))).toBe(
        seed.surface,
      );
      expect(correctLabel(variantZero(`n5:paraphrase:${seed.surface}`))).toBe(
        seed.paraphrase,
      );
    }
    for (const seed of N5_CONTEXT_EXPANSION) {
      expect(
        correctLabel(variantZero(`n5:context-expression:${seed.semanticId}`)),
      ).toBe(seed.correct);
    }
    for (const seed of N5_GRAMMAR_EXPANSION) {
      expect(
        correctLabel(variantZero(`n5:grammar-form:${seed.semanticId}`)),
      ).toBe(seed.correct);
    }
    for (const [index, seed] of N5_COMPOSITION_EXPANSION.entries()) {
      const question = variantZero(
        `n5:sentence-composition:${seed.semanticId}`,
      );
      const byId = new Map(
        question.options.map((option) => [option.id, option.label]),
      );
      const ordered = question
        .sentenceComposition!.canonicalOrderOptionIds.map((id) => byId.get(id))
        .join("");
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

  it("keeps every new rendering eligible for the official N5 mock structure", () => {
    const keys = newSemanticKeys();
    const expanded = N5_GENERATED_QUESTIONS.filter((question) =>
      keys.has(jlptQuestionSemanticKey(question)),
    );
    for (const question of expanded) {
      expect(
        supportsOfficialType("N5", question.officialType),
        question.id,
      ).toBe(true);
      expect(testSectionIdForQuestion("N5", question), question.id).toMatch(
        /^(vocabulary|grammar-reading)$/u,
      );
    }

    const session = createJlptSession({
      level: "N5",
      mode: "mock",
      questions: N5_GENERATED_QUESTIONS,
      random: () => 0,
      now: new Date("2026-08-30T10:00:00.000Z"),
    });
    const byId = new Map(
      N5_GENERATED_QUESTIONS.map((question) => [question.id, question]),
    );
    const selected = session.sectionQuestionIds.flatMap((ids) =>
      ids.map((id) => byId.get(id)!),
    );
    expect(session.sectionQuestionIds).toHaveLength(
      JLPT_MOCK_STRUCTURES.N5.sections.length,
    );
    expect(selected).toHaveLength(
      Object.values(JLPT_APPROXIMATE_ITEM_COUNTS.N5).reduce(
        (total, count) => total + count,
        0,
      ),
    );
    for (const officialType of OFFICIAL_TYPES_BY_LEVEL.N5) {
      expect(
        selected.filter((question) => question.officialType === officialType),
        officialType,
      ).toHaveLength(JLPT_APPROXIMATE_ITEM_COUNTS.N5[officialType] ?? 0);
    }
  });
});
