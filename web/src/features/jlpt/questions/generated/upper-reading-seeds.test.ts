import { describe, expect, it } from "vitest";
import {
  N1_UPPER_READING_SEEDS,
  N2_UPPER_READING_SEEDS,
  UPPER_READING_SEEDS,
  upperReadingBody,
  upperReadingCharacterCount,
  type UpperReadingFamily,
  type UpperReadingSeed,
} from "./upper-reading-seeds";
import { N1_GENERATED_QUESTIONS } from "./n1.generated";
import { N2_GENERATED_QUESTIONS } from "./n2.generated";

const EXPECTED_FAMILIES = {
  N2: [
    "reading-short",
    "reading-mid",
    "reading-integrated",
    "reading-thematic",
    "information-retrieval",
  ],
  N1: [
    "reading-short",
    "reading-mid",
    "reading-long",
    "reading-integrated",
    "reading-thematic",
    "information-retrieval",
  ],
} as const satisfies Record<"N2" | "N1", readonly UpperReadingFamily[]>;

const LENGTH_BANDS: Record<
  "N2" | "N1",
  Record<UpperReadingFamily, readonly [number, number]>
> = {
  N2: {
    "reading-short": [160, 300],
    "reading-mid": [380, 700],
    "reading-long": [0, 0],
    "reading-integrated": [500, 850],
    "reading-thematic": [700, 1_150],
    "information-retrieval": [550, 850],
  },
  N1: {
    "reading-short": [180, 300],
    "reading-mid": [380, 700],
    "reading-long": [650, 1_300],
    "reading-integrated": [450, 850],
    "reading-thematic": [750, 1_250],
    "information-retrieval": [600, 850],
  },
};

function normalized(body: string) {
  return body
    .normalize("NFKC")
    .replace(/[\s「」『』【】、。！？：；・―—（）()]/gu, "");
}

function seedsFor(level: "N2" | "N1") {
  return level === "N2" ? N2_UPPER_READING_SEEDS : N1_UPPER_READING_SEEDS;
}

describe("N2/N1 upper reading semantic seeds", () => {
  it.each(["N2", "N1"] as const)(
    "provides eight independent passages for every assigned %s family",
    (level) => {
      const seeds = seedsFor(level);
      for (const family of EXPECTED_FAMILIES[level]) {
        const familySeeds = seeds.filter((seed) => seed.family === family);
        expect(familySeeds, `${level} ${family}`).toHaveLength(8);
        expect(
          new Set(familySeeds.map((seed) => seed.semanticFocus)).size,
          `${level} ${family} semantic foci`,
        ).toBe(8);
        expect(
          new Set(
            familySeeds.map((seed) =>
              normalized(seed.sources.map((source) => source.body).join("")),
            ),
          ).size,
        ).toBe(8);
      }
    },
  );

  it("uses stable, globally unique editorial identities", () => {
    expect(UPPER_READING_SEEDS).toHaveLength(88);
    expect(
      new Set(UPPER_READING_SEEDS.map((seed) => seed.semanticId)).size,
    ).toBe(88);
    expect(
      new Set(UPPER_READING_SEEDS.map((seed) => seed.semanticFocus)).size,
    ).toBe(88);

    for (const seed of UPPER_READING_SEEDS) {
      const familyToken = seed.family
        .replace("reading-", "")
        .replace("information-retrieval", "info");
      expect(seed.semanticId).toMatch(
        new RegExp(`^${seed.level}-${familyToken}-[a-z0-9-]+$`),
      );
    }
  });

  it("keeps four plausible choices, one explicit key, and source-backed explanations", () => {
    for (const seed of UPPER_READING_SEEDS) {
      expect(seed.options).toHaveLength(4);
      expect(new Set(seed.options).size, seed.semanticId).toBe(4);
      expect(seed.correctIndex, seed.semanticId).toBeGreaterThanOrEqual(0);
      expect(seed.correctIndex, seed.semanticId).toBeLessThan(4);
      expect(
        seed.options[seed.correctIndex].trim().length,
        seed.semanticId,
      ).toBeGreaterThan(5);
      expect(seed.explanation.trim().length, seed.semanticId).toBeGreaterThan(
        80,
      );
      expect(seed.evidence.length, seed.semanticId).toBeGreaterThan(0);

      const sourceBody = seed.sources.map((source) => source.body).join("\n");
      for (const evidence of seed.evidence) {
        expect(
          sourceBody.includes(evidence),
          `${seed.semanticId} is missing evidence: ${evidence}`,
        ).toBe(true);
      }
    }
  });

  it("preserves multi-text boundaries only for integrated comprehension", () => {
    for (const seed of UPPER_READING_SEEDS) {
      if (seed.family === "reading-integrated") {
        expect(seed.sources, seed.semanticId).toHaveLength(2);
        expect(
          seed.sources.every((source) => Boolean(source.label?.trim())),
          seed.semanticId,
        ).toBe(true);
      } else {
        expect(seed.sources, seed.semanticId).toHaveLength(1);
      }
    }
  });

  it("stays within purpose-aligned editorial length bands", () => {
    for (const seed of UPPER_READING_SEEDS) {
      const [minimum, maximum] = LENGTH_BANDS[seed.level][seed.family];
      const actual = upperReadingCharacterCount(seed);
      expect(
        actual,
        `${seed.semanticId} has ${actual} characters`,
      ).toBeGreaterThanOrEqual(minimum);
      expect(
        actual,
        `${seed.semanticId} has ${actual} characters`,
      ).toBeLessThanOrEqual(maximum);
    }
  });

  it("gives information-retrieval items enough structured constraints to require lookup", () => {
    const informationSeeds = UPPER_READING_SEEDS.filter(
      (seed) => seed.family === "information-retrieval",
    );
    for (const seed of informationSeeds) {
      const body = seed.sources[0].body;
      expect(body.split("\n").length, seed.semanticId).toBeGreaterThanOrEqual(
        4,
      );
      expect(body, seed.semanticId).toMatch(/[0-9０-９①②③④]|\d+月|円|営業日/u);
      expect(seed.question.length, seed.semanticId).toBeGreaterThan(25);
    }
  });

  it("authors N2 and N1 independently rather than reusing normalized passages", () => {
    const n2Bodies = new Set(
      N2_UPPER_READING_SEEDS.map((seed) =>
        normalized(seed.sources.map((source) => source.body).join("")),
      ),
    );
    for (const seed of N1_UPPER_READING_SEEDS) {
      expect(
        n2Bodies.has(
          normalized(seed.sources.map((source) => source.body).join("")),
        ),
        seed.semanticId,
      ).toBe(false);
    }
  });

  it("contains no blank-template or official-copy placeholders", () => {
    for (const seed of UPPER_READING_SEEDS) {
      const serialized = JSON.stringify(seed);
      expect(serialized, seed.semanticId).not.toContain("＿＿");
      expect(serialized, seed.semanticId).not.toContain("${");
      expect(serialized, seed.semanticId).not.toMatch(
        /公式問題|出典：.*JLPT|sample question/u,
      );
    }
  });

  it("has a non-degenerate spread of answer positions in every family", () => {
    for (const level of ["N2", "N1"] as const) {
      for (const family of EXPECTED_FAMILIES[level]) {
        const positions = seedsFor(level)
          .filter((seed): seed is UpperReadingSeed => seed.family === family)
          .map((seed) => seed.correctIndex);
        expect(new Set(positions), `${level} ${family}`).toEqual(
          new Set([0, 1, 2, 3]),
        );
        expect(
          [0, 1, 2, 3].map(
            (position) =>
              positions.filter((value) => value === position).length,
          ),
        ).toEqual([2, 2, 2, 2]);
      }
    }
  });

  it.each([
    ["N2", N2_GENERATED_QUESTIONS, N2_UPPER_READING_SEEDS],
    ["N1", N1_GENERATED_QUESTIONS, N1_UPPER_READING_SEEDS],
  ] as const)(
    "wires every %s upper-reading family into the generated bank",
    (level, questions, seeds) => {
      for (const family of EXPECTED_FAMILIES[level]) {
        const generated = questions.filter(
          (question) => question.officialType === family,
        );
        const familySeeds = seeds.filter((seed) => seed.family === family);
        expect(generated, `${level} ${family}`).toHaveLength(200);
        expect(
          new Set(generated.map((question) => question.provenance?.semanticKey))
            .size,
        ).toBe(8);
        expect(
          new Set(generated.map((question) => question.passage?.body)).size,
        ).toBe(8);

        for (const seed of familySeeds) {
          const item = generated.find((question) =>
            question.provenance?.semanticKey.endsWith(seed.semanticId),
          );
          expect(item?.passage?.body, seed.semanticId).toBe(
            upperReadingBody(seed),
          );
          expect(item?.stem, seed.semanticId).toBe(seed.question);
          expect(
            item?.options.map((option) => option.label),
            seed.semanticId,
          ).toContain(seed.options[seed.correctIndex]);
        }
      }
    },
  );
});
