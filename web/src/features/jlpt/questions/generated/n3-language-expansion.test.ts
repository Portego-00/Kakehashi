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
import type { JlptQuestion, JlptTestItemType } from "../../types";
import {
  N3_COMPOSITION_EXPANSION,
  N3_CONTEXT_EXPANSION,
  N3_GRAMMAR_EXPANSION,
  N3_LANGUAGE_EXPANSION_EDITORIAL_STATUS,
  N3_LANGUAGE_EXPANSION_SOURCE_COUNT,
  N3_LEXEME_EXPANSION,
  N3_USAGE_EXPANSION,
} from "./n3-language-expansion";
import { N3_GENERATED_QUESTIONS } from "./n3.generated";

const expectedLexemes = [
  ["欠席", "けっせき", "授業に出なかった"],
  ["期限", "きげん", "決められた最後の日"],
  ["混雑", "こんざつ", "人が多くてこんでいる"],
  ["延期", "えんき", "予定より後の日に変えられた"],
  ["手続き", "てつづき", "必要な書類を出して決められた処理をすること"],
  ["費用", "ひよう", "何かをするために必要なお金"],
  ["原因", "げんいん", "問題が起きた理由"],
  ["解決", "かいけつ", "問題をなくしてうまく終わらせた"],
] as const;

const expectedContextAnswers = [
  "遅らせた",
  "修正した",
  "相談",
  "完了",
  "不便",
] as const;

const expectedUsageAnswers = [
  "機械を使って、室内の温度を一定に保っている。",
  "昼休みの間に、銀行の用事を済ませた。",
  "事故を防ぐため、作業の前に機械を点検する。",
  "参加費には、資料代と飲み物代も含まれている。",
  "朝の混雑を避けるため、いつもより早く家を出た。",
] as const;

const expectedGrammarAnswers = [
  "のに",
  "によって",
  "からは",
  "一方で",
  "終えて",
  "だけでなく",
] as const;

const expectedCompositions = [
  "この店は駅から近いだけでなく料理もおいしいです。",
  "わたしは日本に来てからずっとこの町に住んでいます。",
  "会議に間に合うようにいつもより早く家を出ました。",
  "家族とよく相談した結果来年から留学することにしました。",
  "教えてもらった店へ行ってみたところもう閉まっていました。",
  "この仕事は特別な経験がなくてもすぐに始められます。",
] as const;

function correctLabel(question: JlptQuestion) {
  return question.options.find(
    (option) => option.id === question.correctOptionId,
  )?.label;
}

function questionsForSemantic(
  type: JlptTestItemType,
  semanticIdentity: string,
) {
  return N3_GENERATED_QUESTIONS.filter(
    (question) =>
      question.officialType === type &&
      jlptQuestionSemanticKey(question) === `n3:${type}:${semanticIdentity}`,
  );
}

function expansionSemanticKeys() {
  return new Set([
    ...N3_LEXEME_EXPANSION.flatMap((seed) => [
      `n3:kanji-reading:${seed.surface}`,
      `n3:orthography:${seed.surface}`,
      `n3:paraphrase:${seed.surface}`,
    ]),
    ...N3_CONTEXT_EXPANSION.map(
      (seed) => `n3:context-expression:${seed.semanticId}`,
    ),
    ...N3_USAGE_EXPANSION.map((seed) => `n3:usage:${seed.focus}`),
    ...N3_GRAMMAR_EXPANSION.map((seed) => `n3:grammar-form:${seed.semanticId}`),
    ...N3_COMPOSITION_EXPANSION.map(
      (seed) => `n3:sentence-composition:${seed.semanticId}`,
    ),
  ]);
}

describe("N3 language-knowledge expansion tranche", () => {
  it("contains exactly thirty independently identified source concepts", () => {
    expect(N3_LANGUAGE_EXPANSION_EDITORIAL_STATUS).toBe("machine-validated");
    expect(N3_LANGUAGE_EXPANSION_SOURCE_COUNT).toBe(30);
    expect(N3_LEXEME_EXPANSION).toHaveLength(8);
    expect(N3_CONTEXT_EXPANSION).toHaveLength(5);
    expect(N3_USAGE_EXPANSION).toHaveLength(5);
    expect(N3_GRAMMAR_EXPANSION).toHaveLength(6);
    expect(N3_COMPOSITION_EXPANSION).toHaveLength(6);

    const ids = [
      ...N3_LEXEME_EXPANSION,
      ...N3_CONTEXT_EXPANSION,
      ...N3_USAGE_EXPANSION,
      ...N3_GRAMMAR_EXPANSION,
      ...N3_COMPOSITION_EXPANSION,
    ].map((seed) => seed.semanticId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith("N3-"))).toBe(true);
  });

  it("pins all thirty reviewed keys and keeps four distinct source choices", () => {
    expect(
      N3_LEXEME_EXPANSION.map((seed) => [
        seed.surface,
        seed.reading,
        seed.paraphrase,
      ]),
    ).toEqual(expectedLexemes);
    expect(N3_CONTEXT_EXPANSION.map((seed) => seed.correct)).toEqual(
      expectedContextAnswers,
    );
    expect(N3_USAGE_EXPANSION.map((seed) => seed.correct)).toEqual(
      expectedUsageAnswers,
    );
    expect(N3_GRAMMAR_EXPANSION.map((seed) => seed.correct)).toEqual(
      expectedGrammarAnswers,
    );
    expect(
      N3_COMPOSITION_EXPANSION.map(
        (seed) => `${seed.prefix}${seed.parts.join("")}${seed.suffix}`,
      ),
    ).toEqual(expectedCompositions);

    for (const seed of N3_LEXEME_EXPANSION) {
      expect(seed.sentence.match(new RegExp(seed.surface, "gu"))).toHaveLength(
        1,
      );
      expect(new Set([seed.reading, ...seed.readingDistractors]).size).toBe(4);
      expect(new Set([seed.surface, ...seed.spellingDistractors]).size).toBe(4);
      expect(
        new Set([seed.paraphrase, ...seed.paraphraseDistractors]).size,
      ).toBe(4);
    }
    for (const seed of [...N3_CONTEXT_EXPANSION, ...N3_GRAMMAR_EXPANSION]) {
      expect(seed.stem.match(/＿＿/gu), seed.semanticId).toHaveLength(1);
      expect(new Set([seed.correct, ...seed.distractors]).size).toBe(4);
      expect(seed.explanation.length, seed.semanticId).toBeGreaterThan(65);
    }
    for (const seed of N3_USAGE_EXPANSION) {
      expect(new Set([seed.correct, ...seed.distractors]).size).toBe(4);
      const base = seed.focus.slice(0, -1);
      expect(
        [seed.correct, ...seed.distractors].every((sentence) =>
          sentence.includes(base),
        ),
        seed.semanticId,
      ).toBe(true);
    }
    for (const seed of N3_COMPOSITION_EXPANSION) {
      expect(new Set(seed.parts).size, seed.semanticId).toBe(4);
      expect(seed.parts.every((part) => !/[。！？]$/u.test(part))).toBe(true);
    }
  });

  it("keeps original Japanese payloads distinct and free of attribution markers", () => {
    const texts = [
      ...N3_LEXEME_EXPANSION.flatMap((seed) => [
        seed.sentence,
        seed.paraphrase,
        ...seed.paraphraseDistractors,
      ]),
      ...N3_CONTEXT_EXPANSION.flatMap((seed) => [
        seed.stem,
        seed.correct,
        ...seed.distractors,
      ]),
      ...N3_USAGE_EXPANSION.flatMap((seed) => [
        seed.correct,
        ...seed.distractors,
      ]),
      ...N3_GRAMMAR_EXPANSION.flatMap((seed) => [
        seed.stem,
        seed.correct,
        ...seed.distractors,
      ]),
      ...N3_COMPOSITION_EXPANSION.flatMap((seed) => [
        seed.prefix,
        ...seed.parts,
      ]),
    ];
    for (const text of texts) {
      expect(text, text).toMatch(/[ぁ-んァ-ヶ一-龯]/u);
      expect(text, text).not.toMatch(
        /公式問題|公式問題集|出典|sample2018|JLPT/iu,
      );
      expect(text, text).not.toMatch(/\$\{|\{[^}]+\}/u);
    }
    expect(new Set(N3_LEXEME_EXPANSION.map((seed) => seed.sentence)).size).toBe(
      N3_LEXEME_EXPANSION.length,
    );
    expect(new Set(N3_CONTEXT_EXPANSION.map((seed) => seed.stem)).size).toBe(
      N3_CONTEXT_EXPANSION.length,
    );
    expect(new Set(N3_USAGE_EXPANSION.map((seed) => seed.correct)).size).toBe(
      N3_USAGE_EXPANSION.length,
    );
    expect(new Set(expectedCompositions).size).toBe(
      expectedCompositions.length,
    );
  });

  it("owns 46 stable generated semantics and renders the reviewed answers", () => {
    const keys = expansionSemanticKeys();
    expect(keys.size).toBe(46);
    const generatedKeys = new Set(
      N3_GENERATED_QUESTIONS.map(jlptQuestionSemanticKey),
    );
    for (const key of keys) expect(generatedKeys.has(key), key).toBe(true);

    for (const seed of N3_LEXEME_EXPANSION) {
      const expected: Partial<Record<JlptTestItemType, string>> = {
        "kanji-reading": seed.reading,
        orthography: seed.surface,
        paraphrase: seed.paraphrase,
      };
      for (const [type, answer] of Object.entries(expected) as [
        JlptTestItemType,
        string,
      ][]) {
        const rendered = questionsForSemantic(type, seed.surface);
        expect(rendered.length, `${seed.semanticId}:${type}`).toBeGreaterThan(
          0,
        );
        expect(new Set(rendered.map(correctLabel))).toEqual(new Set([answer]));
      }
    }
    for (const seed of N3_CONTEXT_EXPANSION) {
      expect(
        new Set(
          questionsForSemantic("context-expression", seed.semanticId).map(
            correctLabel,
          ),
        ),
      ).toEqual(new Set([seed.correct]));
    }
    for (const seed of N3_USAGE_EXPANSION) {
      const labels = questionsForSemantic("usage", seed.focus).map(
        correctLabel,
      );
      expect(labels.length, seed.semanticId).toBeGreaterThan(0);
      expect(
        labels.every((label) => label?.includes(seed.correct)),
        seed.semanticId,
      ).toBe(true);
    }
    for (const seed of N3_GRAMMAR_EXPANSION) {
      expect(
        new Set(
          questionsForSemantic("grammar-form", seed.semanticId).map(
            correctLabel,
          ),
        ),
      ).toEqual(new Set([seed.correct]));
    }
    for (const [index, seed] of N3_COMPOSITION_EXPANSION.entries()) {
      const rendered = questionsForSemantic(
        "sentence-composition",
        seed.semanticId,
      );
      expect(new Set(rendered.map(correctLabel))).toEqual(
        new Set([seed.parts[2]]),
      );
      const representative = rendered.find(
        (question) => question.provenance?.variantIndex === 0,
      )!;
      const labels = new Map(
        representative.options.map((option) => [option.id, option.label]),
      );
      const canonical = representative
        .sentenceComposition!.canonicalOrderOptionIds.map((id) =>
          labels.get(id),
        )
        .join("");
      expect(`${seed.prefix}${canonical}${seed.suffix}`).toBe(
        expectedCompositions[index],
      );
    }
  });

  it("raises the seven targeted cells while preserving 200 records per cell", () => {
    const expectedSemantics: Partial<Record<JlptTestItemType, number>> = {
      "kanji-reading": 18,
      orthography: 18,
      "context-expression": 15,
      paraphrase: 18,
      usage: 15,
      "grammar-form": 17,
      "sentence-composition": 16,
    };
    for (const [type, count] of Object.entries(expectedSemantics) as [
      JlptTestItemType,
      number,
    ][]) {
      const questions = N3_GENERATED_QUESTIONS.filter(
        (question) => question.officialType === type,
      );
      expect(questions, type).toHaveLength(200);
      expect(new Set(questions.map(jlptQuestionSemanticKey)).size, type).toBe(
        count,
      );
      expect(
        questions.every(
          (question) =>
            question.options.length === 4 &&
            new Set(question.options.map((option) => option.label)).size ===
              4 &&
            correctLabel(question),
        ),
        type,
      ).toBe(true);
    }
  });

  it("keeps every new item eligible for a complete N3 mock", () => {
    const keys = expansionSemanticKeys();
    const expanded = N3_GENERATED_QUESTIONS.filter((question) =>
      keys.has(jlptQuestionSemanticKey(question)),
    );
    for (const question of expanded) {
      expect(
        supportsOfficialType("N3", question.officialType),
        question.id,
      ).toBe(true);
      expect(testSectionIdForQuestion("N3", question), question.id).toMatch(
        /^(vocabulary|grammar-reading)$/u,
      );
    }

    const session = createJlptSession({
      level: "N3",
      mode: "mock",
      questions: N3_GENERATED_QUESTIONS,
      random: () => 0.41,
      now: new Date("2026-08-30T12:00:00.000Z"),
    });
    const byId = new Map(
      N3_GENERATED_QUESTIONS.map((question) => [question.id, question]),
    );
    const selected = session.sectionQuestionIds.flatMap((ids) =>
      ids.map((id) => byId.get(id)!),
    );
    expect(session.sectionQuestionIds).toHaveLength(
      JLPT_MOCK_STRUCTURES.N3.sections.length,
    );
    expect(selected).toHaveLength(
      Object.values(JLPT_APPROXIMATE_ITEM_COUNTS.N3).reduce(
        (total, count) => total + count,
        0,
      ),
    );
    expect(new Set(selected.map(jlptQuestionSemanticKey)).size).toBe(
      selected.length,
    );
    for (const officialType of OFFICIAL_TYPES_BY_LEVEL.N3) {
      expect(
        selected.filter((question) => question.officialType === officialType),
        officialType,
      ).toHaveLength(JLPT_APPROXIMATE_ITEM_COUNTS.N3[officialType] ?? 0);
    }
  });
});
