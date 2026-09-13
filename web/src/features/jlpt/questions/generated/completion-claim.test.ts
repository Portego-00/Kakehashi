import { describe, expect, it } from "vitest";
import {
  jlptQuestionSemanticKey,
  summarizeJlptEditorialCoverage,
} from "../../editorial";
import { OFFICIAL_TYPES_BY_LEVEL } from "../../structure";
import type { JlptLevel, JlptQuestion, JlptTestItemType } from "../../types";
import { N1_QUESTIONS } from "../n1";
import { N2_QUESTIONS } from "../n2";
import { N3_QUESTIONS } from "../n3";
import { N4_QUESTIONS } from "../n4";
import { N5_QUESTIONS } from "../n5";
import { GENERATED_QUESTIONS_PER_TYPE } from "./bank-builder";
import { N1_GENERATED_QUESTIONS } from "./n1.generated";
import { N2_GENERATED_QUESTIONS } from "./n2.generated";
import { N3_GENERATED_QUESTIONS } from "./n3.generated";
import { N4_GENERATED_QUESTIONS } from "./n4.generated";
import { N5_GENERATED_QUESTIONS } from "./n5.generated";

const LEVELS: readonly JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

const GENERATED_BANKS: Record<JlptLevel, readonly JlptQuestion[]> = {
  N5: N5_GENERATED_QUESTIONS,
  N4: N4_GENERATED_QUESTIONS,
  N3: N3_GENERATED_QUESTIONS,
  N2: N2_GENERATED_QUESTIONS,
  N1: N1_GENERATED_QUESTIONS,
};

const SELECTABLE_BANKS: Record<JlptLevel, readonly JlptQuestion[]> = {
  N5: N5_QUESTIONS,
  N4: N4_QUESTIONS,
  N3: N3_QUESTIONS,
  N2: N2_QUESTIONS,
  N1: N1_QUESTIONS,
};

const EXPECTED_GENERATED_SEMANTIC_COUNTS: Record<
  JlptLevel,
  Partial<Record<JlptTestItemType, number>>
> = {
  N5: {
    "kanji-reading": 22,
    orthography: 22,
    "context-expression": 15,
    paraphrase: 22,
    "grammar-form": 14,
    "sentence-composition": 14,
    "text-grammar": 22,
    "reading-short": 8,
    "reading-mid": 9,
    "information-retrieval": 8,
    "listening-task": 20,
    "listening-key-points": 20,
    "listening-verbal": 10,
    "listening-quick-response": 22,
  },
  N4: {
    "kanji-reading": 18,
    orthography: 18,
    "context-expression": 15,
    paraphrase: 18,
    usage: 16,
    "grammar-form": 18,
    "sentence-composition": 16,
    "text-grammar": 22,
    "reading-short": 8,
    "reading-mid": 9,
    "information-retrieval": 9,
    "listening-task": 20,
    "listening-key-points": 20,
    "listening-verbal": 10,
    "listening-quick-response": 22,
  },
  N3: {
    "kanji-reading": 18,
    orthography: 18,
    "context-expression": 15,
    paraphrase: 18,
    usage: 15,
    "grammar-form": 17,
    "sentence-composition": 16,
    "text-grammar": 22,
    "reading-short": 8,
    "reading-mid": 9,
    "reading-long": 9,
    "information-retrieval": 9,
    "listening-task": 16,
    "listening-key-points": 16,
    "listening-outline": 16,
    "listening-verbal": 10,
    "listening-quick-response": 16,
  },
  N2: {
    "kanji-reading": 17,
    orthography: 17,
    "word-formation": 14,
    "context-expression": 15,
    paraphrase: 17,
    usage: 14,
    "grammar-form": 16,
    "sentence-composition": 15,
    "text-grammar": 22,
    "reading-short": 8,
    "reading-mid": 8,
    "reading-integrated": 8,
    "reading-thematic": 8,
    "information-retrieval": 8,
    "listening-task": 16,
    "listening-key-points": 16,
    "listening-outline": 16,
    "listening-quick-response": 16,
    "listening-integrated": 16,
  },
  N1: {
    "kanji-reading": 20,
    "context-expression": 15,
    paraphrase: 20,
    usage: 15,
    "grammar-form": 15,
    "sentence-composition": 15,
    "text-grammar": 22,
    "reading-short": 8,
    "reading-mid": 8,
    "reading-long": 8,
    "reading-integrated": 8,
    "reading-thematic": 8,
    "information-retrieval": 8,
    "listening-task": 16,
    "listening-key-points": 16,
    "listening-outline": 16,
    "listening-quick-response": 16,
    "listening-integrated": 16,
  },
};

const EXPECTED_LEVEL_TOTALS = {
  N5: {
    generatedRecords: 2_800,
    selectableRecords: 2_819,
    generatedSemantics: 228,
    selectableSemantics: 247,
  },
  N4: {
    generatedRecords: 3_000,
    selectableRecords: 3_020,
    generatedSemantics: 239,
    selectableSemantics: 259,
  },
  N3: {
    generatedRecords: 3_400,
    selectableRecords: 3_421,
    generatedSemantics: 248,
    selectableSemantics: 269,
  },
  N2: {
    generatedRecords: 3_800,
    selectableRecords: 3_822,
    generatedSemantics: 267,
    selectableSemantics: 289,
  },
  N1: {
    generatedRecords: 3_600,
    selectableRecords: 3_621,
    generatedSemantics: 250,
    selectableSemantics: 271,
  },
} as const satisfies Record<
  JlptLevel,
  {
    generatedRecords: number;
    selectableRecords: number;
    generatedSemantics: number;
    selectableSemantics: number;
  }
>;

const FULL_SURFACE_VARIANT_TYPES = new Set<JlptTestItemType>([
  "kanji-reading",
  "orthography",
  "word-formation",
  "context-expression",
  "paraphrase",
  "usage",
  "grammar-form",
  "sentence-composition",
]);

const EXPECTED_TEXT_GRAMMAR_PAYLOADS: Record<JlptLevel, number> = {
  N5: 192,
  N4: 144,
  N3: 69,
  N2: 30,
  N1: 22,
};

function typeQuestions(bank: readonly JlptQuestion[], type: JlptTestItemType) {
  return bank.filter((question) => question.officialType === type);
}

function positionCounts(questions: readonly JlptQuestion[]) {
  const optionIds = [
    ...new Set(
      questions.flatMap((question) =>
        question.options.map((option) => option.id),
      ),
    ),
  ].toSorted();
  return Object.fromEntries(
    optionIds.map((id) => [
      id,
      questions.filter((question) => question.correctOptionId === id).length,
    ]),
  );
}

function learnerPayloadSignature(question: JlptQuestion) {
  const correctLabel = question.options.find(
    (option) => option.id === question.correctOptionId,
  )?.label;
  const listeningStimulus = question.listening?.audioOnlyOptions
    ? question.listening.script.split(/\n一、/u)[0]
    : question.listening?.script;
  return JSON.stringify({
    stem: question.stem,
    focus: question.focus,
    passage: question.passage?.body,
    listening: listeningStimulus,
    optionLabels: question.options.map((option) => option.label).toSorted(),
    correctLabel,
  }).replace(/\s+/gu, "");
}

describe("JLPT bank completion-claim evidence", () => {
  it("pins exact rendered-record and semantic-item counts for all 83 level/type cells", () => {
    let cells = 0;
    for (const level of LEVELS) {
      const generatedCoverage = summarizeJlptEditorialCoverage(
        GENERATED_BANKS[level],
      );
      const selectableCoverage = summarizeJlptEditorialCoverage(
        SELECTABLE_BANKS[level],
      );
      expect(GENERATED_BANKS[level], level).toHaveLength(
        EXPECTED_LEVEL_TOTALS[level].generatedRecords,
      );
      expect(SELECTABLE_BANKS[level], level).toHaveLength(
        EXPECTED_LEVEL_TOTALS[level].selectableRecords,
      );
      expect(generatedCoverage.semanticItems, level).toBe(
        EXPECTED_LEVEL_TOTALS[level].generatedSemantics,
      );
      expect(selectableCoverage.semanticItems, level).toBe(
        EXPECTED_LEVEL_TOTALS[level].selectableSemantics,
      );

      for (const officialType of OFFICIAL_TYPES_BY_LEVEL[level]) {
        cells += 1;
        const generated = typeQuestions(GENERATED_BANKS[level], officialType);
        const selectable = typeQuestions(SELECTABLE_BANKS[level], officialType);
        expect(generated, `${level} ${officialType}`).toHaveLength(
          GENERATED_QUESTIONS_PER_TYPE,
        );
        expect(
          selectable.length,
          `${level} ${officialType}`,
        ).toBeGreaterThanOrEqual(GENERATED_QUESTIONS_PER_TYPE);
        expect(
          new Set(generated.map(jlptQuestionSemanticKey)).size,
          `${level} ${officialType}`,
        ).toBe(EXPECTED_GENERATED_SEMANTIC_COUNTS[level][officialType]);
      }
    }
    expect(cells).toBe(83);
  });

  it("pins learner-visible payload concentration independently of answer order", () => {
    let cells = 0;
    for (const level of LEVELS) {
      for (const officialType of OFFICIAL_TYPES_BY_LEVEL[level]) {
        cells += 1;
        const questions = typeQuestions(GENERATED_BANKS[level], officialType);
        const expected = FULL_SURFACE_VARIANT_TYPES.has(officialType)
          ? GENERATED_QUESTIONS_PER_TYPE
          : officialType === "text-grammar"
            ? EXPECTED_TEXT_GRAMMAR_PAYLOADS[level]
            : EXPECTED_GENERATED_SEMANTIC_COUNTS[level][officialType];
        expect(
          new Set(questions.map(learnerPayloadSignature)).size,
          `${level} ${officialType}`,
        ).toBe(expected);
      }
    }
    expect(cells).toBe(83);
  });

  it("keeps generated and selectable identities globally unique and type-stable", () => {
    const generated = LEVELS.flatMap((level) => GENERATED_BANKS[level]);
    const selectable = LEVELS.flatMap((level) => SELECTABLE_BANKS[level]);
    expect(new Set(generated.map((question) => question.id)).size).toBe(
      generated.length,
    );
    expect(new Set(selectable.map((question) => question.id)).size).toBe(
      selectable.length,
    );

    const semanticIdentity = new Map<string, string>();
    for (const question of generated) {
      const key = jlptQuestionSemanticKey(question);
      const identity = `${question.level}:${question.officialType}`;
      expect(semanticIdentity.get(key) ?? identity, key).toBe(identity);
      semanticIdentity.set(key, identity);
    }
  });

  it("uses unique contiguous variant indices within every generated semantic item", () => {
    for (const level of LEVELS) {
      for (const type of OFFICIAL_TYPES_BY_LEVEL[level]) {
        const groups = Map.groupBy(
          typeQuestions(GENERATED_BANKS[level], type),
          jlptQuestionSemanticKey,
        );
        for (const [semanticKey, variants] of groups) {
          const indices = variants.map(
            (question) => question.provenance?.variantIndex,
          );
          expect(
            new Set(
              variants.map((question) => question.provenance?.contentVersion),
            ),
            semanticKey,
          ).toEqual(new Set([1]));
          expect(
            new Set(
              variants.map((question) => question.provenance?.editorialStatus),
            ),
            semanticKey,
          ).toEqual(new Set(["machine-validated"]));
          expect(new Set(indices).size, semanticKey).toBe(variants.length);
          expect(
            indices.toSorted((left, right) => (left ?? -1) - (right ?? -1)),
            semanticKey,
          ).toEqual(
            Array.from({ length: variants.length }, (_, index) => index),
          );
        }
      }
    }
  });

  it("does not assign one exact representative payload to two semantic keys", () => {
    const signatures = new Map<string, string>();
    for (const question of LEVELS.flatMap((level) => GENERATED_BANKS[level])) {
      if (question.provenance?.variantIndex !== 0) continue;
      const correctLabel = question.options.find(
        (option) => option.id === question.correctOptionId,
      )?.label;
      const signature = JSON.stringify({
        level: question.level,
        officialType: question.officialType,
        stem: question.stem,
        focus: question.focus,
        passage: question.passage?.body,
        listening: question.listening?.script,
        options: question.options.map((option) => option.label),
        correctLabel,
      }).replace(/\s+/gu, "");
      const semanticKey = jlptQuestionSemanticKey(question);
      expect(signatures.get(signature) ?? semanticKey, semanticKey).toBe(
        semanticKey,
      );
      signatures.set(signature, semanticKey);
    }
  });

  it("populates every required field in the selectable bank", () => {
    for (const level of LEVELS) {
      for (const question of SELECTABLE_BANKS[level]) {
        expect(question.id.trim(), `${level} id`).not.toBe("");
        expect(question.level, question.id).toBe(level);
        expect(question.instruction.trim(), question.id).not.toBe("");
        expect(question.stem.trim(), question.id).not.toBe("");
        expect(question.explanation.trim(), question.id).not.toBe("");
        expect(question.options.length, question.id).toBeGreaterThanOrEqual(3);
        expect(
          new Set(question.options.map((option) => option.id)).size,
          question.id,
        ).toBe(question.options.length);
        expect(
          new Set(question.options.map((option) => option.label)).size,
          question.id,
        ).toBe(question.options.length);
        expect(
          question.options.every((option) => option.label.trim().length > 0),
          question.id,
        ).toBe(true);
        expect(
          question.options.some(
            (option) => option.id === question.correctOptionId,
          ),
          question.id,
        ).toBe(true);

        if (question.skill === "listening") {
          expect(question.listening?.script.trim(), question.id).not.toBe("");
          expect(question.listening?.maxPlays, question.id).toBe(2);
          expect(question.listening?.rate, question.id).toBeGreaterThan(0);
        }
        if (
          question.skill === "reading" ||
          question.officialType === "text-grammar"
        ) {
          expect(question.passage?.body.trim(), question.id).not.toBe("");
        }
        if (question.officialType === "sentence-composition") {
          expect(
            question.sentenceComposition?.canonicalOrderOptionIds,
            question.id,
          ).toHaveLength(4);
        }
      }
    }
  });

  it("fills every answer position and keeps generated keys balanced", () => {
    for (const level of LEVELS) {
      for (const type of OFFICIAL_TYPES_BY_LEVEL[level]) {
        const questions = typeQuestions(GENERATED_BANKS[level], type);
        expect(questions, `${level} ${type}`).toHaveLength(
          GENERATED_QUESTIONS_PER_TYPE,
        );
        const counts = positionCounts(questions);
        const optionCount = questions[0].options.length;
        expect(Object.keys(counts), `${level} ${type}`).toEqual(
          Array.from({ length: optionCount }, (_, index) => String(index + 1)),
        );
        expect(
          Math.max(...Object.values(counts)) -
            Math.min(...Object.values(counts)),
          `${level} ${type}`,
        ).toBeLessThanOrEqual(1);
      }
    }
  });

  it("does not mistake machine-validated renderings for human-approved semantics", () => {
    const generated = LEVELS.flatMap((level) => GENERATED_BANKS[level]);
    const selectable = LEVELS.flatMap((level) => SELECTABLE_BANKS[level]);
    const generatedCoverage = summarizeJlptEditorialCoverage(generated);
    const selectableCoverage = summarizeJlptEditorialCoverage(selectable);
    expect(generatedCoverage).toMatchObject({
      records: 16_600,
      semanticItems: 1_232,
      humanApprovedSemanticItems: 0,
      releaseReady: false,
      byStatus: {
        "machine-validated": { records: 16_600, semanticItems: 1_232 },
        "sampled-ai-review": { records: 0, semanticItems: 0 },
        "human-approved": { records: 0, semanticItems: 0 },
      },
    });
    expect(selectableCoverage).toMatchObject({
      records: 16_703,
      semanticItems: 1_335,
      humanApprovedSemanticItems: 0,
      releaseReady: false,
      byStatus: {
        untracked: { records: 103, semanticItems: 103 },
        "machine-validated": { records: 16_600, semanticItems: 1_232 },
        "sampled-ai-review": { records: 0, semanticItems: 0 },
        "human-approved": { records: 0, semanticItems: 0 },
      },
    });
  });
});
