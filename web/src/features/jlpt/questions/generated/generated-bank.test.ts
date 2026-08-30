import { describe, expect, it } from "vitest";
import { OFFICIAL_TYPES_BY_LEVEL } from "../../structure";
import type {
  JlptLevel,
  JlptQuestion,
  JlptSkill,
  JlptTestItemType,
} from "../../types";
import { GENERATED_QUESTIONS_PER_TYPE } from "./bank-builder";
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

const SKILL_FOR_TYPE: Record<JlptTestItemType, JlptSkill> = {
  "kanji-reading": "kanji",
  orthography: "kanji",
  "word-formation": "vocabulary",
  "context-expression": "vocabulary",
  paraphrase: "vocabulary",
  usage: "vocabulary",
  "grammar-form": "grammar",
  "sentence-composition": "grammar",
  "text-grammar": "grammar",
  "reading-short": "reading",
  "reading-mid": "reading",
  "reading-long": "reading",
  "reading-integrated": "reading",
  "reading-thematic": "reading",
  "information-retrieval": "reading",
  "listening-task": "listening",
  "listening-key-points": "listening",
  "listening-outline": "listening",
  "listening-verbal": "listening",
  "listening-quick-response": "listening",
  "listening-integrated": "listening",
};

describe("generated JLPT question banks", () => {
  it.each(Object.entries(BANKS) as [JlptLevel, readonly JlptQuestion[]][])(
    "constructs 200 stable renderings for every official %s item type",
    (level, questions) => {
      expect(questions).toHaveLength(
        OFFICIAL_TYPES_BY_LEVEL[level].length * GENERATED_QUESTIONS_PER_TYPE,
      );
      expect(new Set(questions.map((question) => question.id)).size).toBe(
        questions.length,
      );

      for (const type of OFFICIAL_TYPES_BY_LEVEL[level]) {
        const typeQuestions = questions.filter(
          (question) => question.officialType === type,
        );
        expect(typeQuestions).toHaveLength(GENERATED_QUESTIONS_PER_TYPE);
        expect(typeQuestions.map((question) => question.id)).toEqual(
          Array.from(
            { length: GENERATED_QUESTIONS_PER_TYPE },
            (_, index) =>
              `${level.toLowerCase()}-generated-${type}-${String(index + 1).padStart(3, "0")}`,
          ),
        );
      }
    },
  );

  it.each(Object.entries(BANKS) as [JlptLevel, readonly JlptQuestion[]][])(
    "keeps every generated %s record internally valid",
    (level, questions) => {
      for (const question of questions) {
        expect(question.level).toBe(level);
        expect(OFFICIAL_TYPES_BY_LEVEL[level]).toContain(question.officialType);
        expect(question.skill).toBe(SKILL_FOR_TYPE[question.officialType]);
        expect(question.instruction.trim().length).toBeGreaterThan(15);
        expect(question.stem.trim().length).toBeGreaterThan(0);
        expect(question.explanation.trim().length).toBeGreaterThan(20);
        expect(question.shortQuiz).toBeUndefined();
        expect(question.options).toHaveLength(
          question.officialType === "listening-verbal" ||
            question.officialType === "listening-quick-response"
            ? 3
            : 4,
        );
        expect(new Set(question.options.map((option) => option.id)).size).toBe(
          question.options.length,
        );
        expect(
          new Set(question.options.map((option) => option.label)).size,
        ).toBe(question.options.length);
        expect(
          question.options.every((option) => option.label.trim().length > 0),
        ).toBe(true);
        expect(
          question.options.filter(
            (option) => option.id === question.correctOptionId,
          ),
        ).toHaveLength(1);
      }
    },
  );

  it("uses a balanced correct-answer position distribution", () => {
    for (const questions of Object.values(BANKS)) {
      for (const type of new Set(
        questions.map((question) => question.officialType),
      )) {
        const typeQuestions = questions.filter(
          (question) => question.officialType === type,
        );
        const counts = typeQuestions.reduce<Record<string, number>>(
          (totals, question) => {
            totals[question.correctOptionId] =
              (totals[question.correctOptionId] ?? 0) + 1;
            return totals;
          },
          {},
        );
        const expectedOptionIds = typeQuestions[0].options.map(
          (option) => option.id,
        );
        expect(
          Object.keys(counts).toSorted(),
          `${type} answer positions`,
        ).toEqual(expectedOptionIds.toSorted());
        const positionCounts = expectedOptionIds.map(
          (optionId) => counts[optionId] ?? 0,
        );
        const spread =
          Math.max(...positionCounts) - Math.min(...positionCounts);
        expect(spread).toBeLessThanOrEqual(1);
      }
    }
  });

  it("stores a complete and uniquely keyed canonical order for every composition item", () => {
    for (const question of Object.values(BANKS)
      .flat()
      .filter((item) => item.officialType === "sentence-composition")) {
      expect(question.stem.match(/＿＿/g)).toHaveLength(3);
      expect(question.stem.match(/★/g)).toHaveLength(1);
      expect(question.sentenceComposition).toBeDefined();
      const composition = question.sentenceComposition!;
      expect(composition.starredPosition).toBe(2);
      expect(composition.canonicalOrderOptionIds).toHaveLength(4);
      expect(new Set(composition.canonicalOrderOptionIds)).toEqual(
        new Set(question.options.map((option) => option.id)),
      );
      expect(question.correctOptionId).toBe(
        composition.canonicalOrderOptionIds[composition.starredPosition],
      );
      expect(
        question.options.every((option) => !/[。！？]$/u.test(option.label)),
      ).toBe(true);
    }
  });

  it("models listening format invariants without embedding a second stimulus play", () => {
    const audioOnlyTypes = new Set([
      "listening-outline",
      "listening-verbal",
      "listening-quick-response",
      "listening-integrated",
    ]);
    for (const question of Object.values(BANKS)
      .flat()
      .filter((item) => item.skill === "listening")) {
      expect(question.listening).toBeDefined();
      expect(question.listening!.script.trim().length).toBeGreaterThan(20);
      expect(question.listening!.rate).toBeGreaterThanOrEqual(0.8);
      expect(question.listening!.rate).toBeLessThanOrEqual(1.15);
      expect(question.listening!.maxPlays).toBe(2);
      expect(question.listening!.audioOnlyOptions, question.id).toBe(
        audioOnlyTypes.has(question.officialType),
      );

      if (
        question.officialType === "listening-task" ||
        question.officialType === "listening-key-points"
      ) {
        expect(question.listening!.script).not.toContain(question.stem);
      }
      if (question.officialType === "listening-quick-response") {
        expect(question.listening!.script).not.toContain(question.stem);
      }
      if (question.listening!.audioOnlyOptions) {
        expect(question.listening!.script).toMatch(
          /一、[\s\S]*二、[\s\S]*三、/,
        );
      }
      if (question.officialType === "listening-verbal") {
        expect(question.listening!.verbalScene).toBeDefined();
        expect(
          question.listening!.script.match(/何と言いますか。/gu),
        ).toHaveLength(1);
        expect(
          question.listening!.script.indexOf("何と言いますか。"),
        ).toBeLessThan(question.listening!.script.indexOf("一、"));
        expect(
          question.listening!.verbalScene!.description.trim().length,
        ).toBeGreaterThan(30);
      } else {
        expect(question.listening!.verbalScene).toBeUndefined();
      }
    }
  });

  it("keeps N1/N2 integrated listening long enough to require multi-source integration", () => {
    for (const questions of [N1_GENERATED_QUESTIONS, N2_GENERATED_QUESTIONS]) {
      for (const question of questions.filter(
        (item) => item.officialType === "listening-integrated",
      )) {
        expect(
          question.listening!.script.replace(/\s/g, "").length,
        ).toBeGreaterThanOrEqual(question.level === "N1" ? 700 : 430);
        const sourceLabels = [
          ...question.listening!.script.matchAll(/([ァ-ヶ一-龠]+)：/gu),
        ]
          .map((match) => match[1])
          .filter((label) => label !== "ナレーション");
        expect(
          question.listening!.script.match(/ナレーション：/gu)?.length ?? 0,
        ).toBeGreaterThanOrEqual(2);
        expect(new Set(sourceLabels).size).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("includes katakana transcription among N5 orthography families", () => {
    const orthography = N5_GENERATED_QUESTIONS.filter(
      (question) => question.officialType === "orthography",
    );
    expect(
      orthography.some((question) =>
        question.options.some((option) =>
          /\p{Script=Katakana}/u.test(option.label),
        ),
      ),
    ).toBe(true);
  });

  it("keeps generated interpolation and schedule regressions out of rendered questions", () => {
    const rendered = Object.values(BANKS)
      .flat()
      .map((question) =>
        [
          question.stem,
          question.passage?.body,
          question.listening?.script,
          ...question.options.map((option) => option.label),
        ]
          .filter(Boolean)
          .join("\n"),
      );
    expect(rendered.every((text) => !text.includes("${"))).toBe(true);
    expect(
      rendered.every((text) => !/さんの文です|の文（|記した文です/u.test(text)),
    ).toBe(true);
    expect(
      rendered.every(
        (text) =>
          !/予定い|都合う|最近ん|確認ん|期待い|促進ん|わずかなに|に対してを|ばかりを|午後十二時/u.test(
            text,
          ),
      ),
    ).toBe(true);

    const n3Short = N3_GENERATED_QUESTIONS.find(
      (question) => question.id === "n3-generated-reading-short-001",
    )!;
    expect(n3Short.passage?.body).toContain("今日の三時までは外部へ送らず");
    expect(n3Short.passage?.body).toContain("今日の五時までに共有フォルダーへ");

    const n3Grammar = N3_GENERATED_QUESTIONS.find(
      (question) =>
        question.provenance?.semanticKey === "n3:grammar-form:family-10" &&
        question.provenance.variantIndex === 0,
    )!;
    expect(n3Grammar.stem).toContain("会議を始めずに待ちましょう");
    expect(
      n3Grammar.options.find(
        (option) => option.id === n3Grammar.correctOptionId,
      )?.label,
    ).toBe("まで");

    const n3RequiredExperience = N3_GENERATED_QUESTIONS.find(
      (question) => question.id === "n3-generated-grammar-form-001",
    )!;
    expect(n3RequiredExperience.stem).toContain(
      "経験者だけに操作が認められている",
    );
    expect(
      n3RequiredExperience.options.find(
        (option) => option.id === n3RequiredExperience.correctOptionId,
      )?.label,
    ).toBe("でないと");

    const n4PastExperience = N4_GENERATED_QUESTIONS.find(
      (question) =>
        question.provenance?.semanticKey === "n4:grammar-form:family-11" &&
        question.provenance.variantIndex === 0,
    )!;
    expect(n4PastExperience.stem).toContain("去年、初めて富士山に登りました");
    expect(
      n4PastExperience.options.find(
        (option) => option.id === n4PastExperience.correctOptionId,
      )?.label,
    ).toBe("ことがあります");

    const n3FacilityRule = N3_GENERATED_QUESTIONS.find(
      (question) =>
        question.provenance?.semanticKey === "n3:grammar-form:family-11" &&
        question.provenance.variantIndex === 0,
    )!;
    expect(n3FacilityRule.stem).toContain("この施設では、安全のため");
    expect(
      n3FacilityRule.options.find(
        (option) => option.id === n3FacilityRule.correctOptionId,
      )?.label,
    ).toBe("ことになっています");

    const n3Oujiro = N3_GENERATED_QUESTIONS.find(
      (question) =>
        question.provenance?.semanticKey === "n3:usage:応じる" &&
        question.provenance.variantIndex === 0,
    )!;
    expect(
      n3Oujiro.options.find((option) => option.id === n3Oujiro.correctOptionId)
        ?.label,
    ).toContain("希望に応じて");
    expect(
      n3Oujiro.options
        .filter((option) => option.id !== n3Oujiro.correctOptionId)
        .map((option) => option.label),
    ).not.toContain(expect.stringContaining("受話器を取った"));

    const n1Grammar = N1_GENERATED_QUESTIONS.find(
      (question) =>
        question.provenance?.semanticKey === "n1:grammar-form:family-10" &&
        question.provenance.variantIndex === 0,
    )!;
    expect(n1Grammar.stem).toContain("説明を避けてよいわけではない");
    expect(
      n1Grammar.options.find(
        (option) => option.id === n1Grammar.correctOptionId,
      )?.label,
    ).toBe("あって");

    const n1RequiredRevision = N1_GENERATED_QUESTIONS.find(
      (question) => question.id === "n1-generated-grammar-form-001",
    )!;
    expect(
      n1RequiredRevision.options.find(
        (option) => option.id === n1RequiredRevision.correctOptionId,
      )?.label,
    ).toBe("見直さざるを得ない");
    expect(
      n1RequiredRevision.options.map((option) => option.label),
    ).not.toContain("見直さずにはおかない");

    const n1Hirugaesu = N1_GENERATED_QUESTIONS.find(
      (question) => question.id === "n1-generated-usage-075",
    )!;
    expect(
      n1Hirugaesu.options.map((option) => option.label).join("\n"),
    ).not.toContain("本のページを翻した");

    for (const questions of [
      N4_GENERATED_QUESTIONS,
      N3_GENERATED_QUESTIONS,
      N2_GENERATED_QUESTIONS,
      N1_GENERATED_QUESTIONS,
    ]) {
      const information = questions.find((question) =>
        question.id.endsWith("information-retrieval-001"),
      )!;
      expect(information.passage?.body).not.toContain("9:00〜九時");
    }
  });
});
