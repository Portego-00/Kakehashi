import { describe, expect, it } from "vitest";
import {
  upperListeningSeeds,
  type UpperListeningFamily,
  type UpperListeningLevel,
  type UpperListeningSeed,
} from "./upper-listening-seeds";
import type { JlptLevel, JlptQuestion } from "../../types";
import { N1_GENERATED_QUESTIONS } from "./n1.generated";
import { N2_GENERATED_QUESTIONS } from "./n2.generated";
import { N3_GENERATED_QUESTIONS } from "./n3.generated";

const GENERATED_BANKS: Partial<Record<JlptLevel, readonly JlptQuestion[]>> = {
  N3: N3_GENERATED_QUESTIONS,
  N2: N2_GENERATED_QUESTIONS,
  N1: N1_GENERATED_QUESTIONS,
};

const REQUIRED_FAMILIES: Record<
  UpperListeningLevel,
  readonly UpperListeningFamily[]
> = {
  N3: [
    "listening-task",
    "listening-key-points",
    "listening-outline",
    "listening-quick-response",
  ],
  N2: [
    "listening-task",
    "listening-key-points",
    "listening-outline",
    "listening-quick-response",
    "listening-integrated",
  ],
  N1: [
    "listening-task",
    "listening-key-points",
    "listening-outline",
    "listening-quick-response",
    "listening-integrated",
  ],
};

const PRESENTATION: Record<
  UpperListeningFamily,
  Pick<UpperListeningSeed, "questionTiming" | "audioOnlyOptions"> & {
    optionCount: number;
  }
> = {
  "listening-task": {
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
    optionCount: 4,
  },
  "listening-key-points": {
    questionTiming: "before-stimulus",
    audioOnlyOptions: false,
    optionCount: 4,
  },
  "listening-outline": {
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    optionCount: 4,
  },
  "listening-quick-response": {
    questionTiming: "prompt-only",
    audioOnlyOptions: true,
    optionCount: 3,
  },
  "listening-integrated": {
    questionTiming: "after-stimulus",
    audioOnlyOptions: true,
    optionCount: 4,
  },
};

function withoutSpacing(value: string) {
  return value.replace(/\s/gu, "");
}

describe("upper-level listening seed pack", () => {
  it("contains sixteen independently authored scenarios for every required level and family", () => {
    expect(upperListeningSeeds).toHaveLength(224);

    for (const [level, families] of Object.entries(REQUIRED_FAMILIES) as [
      UpperListeningLevel,
      readonly UpperListeningFamily[],
    ][]) {
      const levelSeeds = upperListeningSeeds.filter(
        (seed) => seed.level === level,
      );
      expect(new Set(levelSeeds.map((seed) => seed.family))).toEqual(
        new Set(families),
      );

      for (const family of families) {
        expect(
          levelSeeds.filter((seed) => seed.family === family),
          `${level} ${family}`,
        ).toHaveLength(16);
      }
    }
  });

  it("uses global, level-owned semantic identities rather than positional identities", () => {
    const ids = upperListeningSeeds.map((seed) => seed.semanticId);
    const focuses = upperListeningSeeds.map((seed) => seed.semanticFocus);
    const scripts = upperListeningSeeds.map((seed) =>
      withoutSpacing(seed.script),
    );

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(focuses).size).toBe(focuses.length);
    expect(new Set(scripts).size).toBe(scripts.length);

    for (const seed of upperListeningSeeds) {
      const familyFragment = {
        "listening-task": "task",
        "listening-key-points": "key",
        "listening-outline": "outline",
        "listening-quick-response": "quick",
        "listening-integrated": "integrated",
      }[seed.family];
      expect(seed.semanticId).toMatch(
        new RegExp(`^${seed.level}-${familyFragment}-[a-z0-9-]+$`),
      );
      expect(
        seed.semanticFocus.trim().split(/\s+/u).length,
      ).toBeGreaterThanOrEqual(4);
    }
  });

  it("encodes the official public-sample presentation mechanics for each family", () => {
    for (const seed of upperListeningSeeds) {
      const expected = PRESENTATION[seed.family];
      expect(seed.questionTiming, seed.semanticId).toBe(
        expected.questionTiming,
      );
      expect(seed.audioOnlyOptions, seed.semanticId).toBe(
        expected.audioOnlyOptions,
      );
      expect(seed.options, seed.semanticId).toHaveLength(expected.optionCount);
      expect(new Set(seed.options).size, seed.semanticId).toBe(
        seed.options.length,
      );
      expect(seed.correctIndex, seed.semanticId).toBeGreaterThanOrEqual(0);
      expect(seed.correctIndex, seed.semanticId).toBeLessThan(
        seed.options.length,
      );

      if (seed.family === "listening-quick-response") {
        expect(seed.question).toBe("最も適切な応答を選んでください。");
      }
    }
  });

  it("contains complete Japanese stimuli, keyed options, and editorial explanations", () => {
    for (const seed of upperListeningSeeds) {
      expect(seed.script.trim().length, seed.semanticId).toBeGreaterThan(10);
      expect(seed.question.trim().length, seed.semanticId).toBeGreaterThan(5);
      expect(seed.explanation.trim().length, seed.semanticId).toBeGreaterThan(
        45,
      );
      expect(seed.script, seed.semanticId).toMatch(/[ぁ-んァ-ヶ一-龠]/u);
      expect(seed.question, seed.semanticId).toMatch(/[ぁ-んァ-ヶ一-龠]/u);
      expect(
        seed.options.every((option) => /[ぁ-んァ-ヶ一-龠]/u.test(option)),
        seed.semanticId,
      ).toBe(true);
      expect(
        [seed.script, seed.question, ...seed.options].join("\n"),
        seed.semanticId,
      ).not.toMatch(/\$\{|\{(?:person|place|day|time|count)\}|TODO|TBD/iu);
    }
  });

  it("keeps integrated N2 and N1 records long, multi-source, and discussion based", () => {
    const integrated = upperListeningSeeds.filter(
      (seed) => seed.family === "listening-integrated",
    );
    expect(integrated).toHaveLength(32);

    for (const seed of integrated) {
      const minimumLength = seed.level === "N1" ? 700 : 430;
      const sourceLabels = [...seed.script.matchAll(/([ァ-ヶ一-龠]+)：/gu)]
        .map((match) => match[1])
        .filter((label) => label !== "ナレーション");

      expect(seed.level, seed.semanticId).not.toBe("N3");
      expect(
        withoutSpacing(seed.script).length,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(minimumLength);
      expect(seed.sourceCount, seed.semanticId).toBeGreaterThanOrEqual(4);
      expect(
        new Set(sourceLabels).size,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(3);
      expect(
        seed.script.match(/ナレーション：/gu)?.length ?? 0,
        seed.semanticId,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it("does not attach integrated-only provenance to the other families", () => {
    for (const seed of upperListeningSeeds) {
      if (seed.family === "listening-integrated") {
        expect(seed.sourceCount, seed.semanticId).toBeDefined();
      } else {
        expect(seed.sourceCount, seed.semanticId).toBeUndefined();
      }
    }
  });

  it("is wired into the generated N3, N2, and N1 listening banks", () => {
    for (const seed of upperListeningSeeds) {
      const bank = GENERATED_BANKS[seed.level] ?? [];
      const question = bank.find(
        (candidate) =>
          candidate.provenance?.semanticKey ===
          `${seed.level.toLowerCase()}:${seed.family}:${seed.semanticId}`,
      );
      expect(question, seed.semanticId).toBeDefined();
      expect(question?.listening?.script, seed.semanticId).toContain(
        seed.script,
      );
      expect(
        question?.options.some(
          (option) => option.label === seed.options[seed.correctIndex],
        ),
        seed.semanticId,
      ).toBe(true);
      expect(question?.options, seed.semanticId).toHaveLength(
        seed.options.length,
      );
    }
  });
});
