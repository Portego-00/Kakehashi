import { describe, expect, it } from "vitest";
import { getSubjectEnrichments } from "./server-enrichments";

describe("subject detail enrichments", () => {
  it("returns every pitch pattern matching the subject readings", () => {
    const result = getSubjectEnrichments({ id: 440, level: 1, characters: "一", readings: ["いち", "ひと"] });

    expect(result.pitchAccents.map((entry) => entry.r)).toEqual(expect.arrayContaining(["いち", "ひと"]));
  });

  it("finds vocabulary usage patterns by level and characters", () => {
    const result = getSubjectEnrichments({ id: 2467, level: 1, characters: "一つ", readings: ["ひとつ"] });

    expect(result.patterns.length).toBeGreaterThan(0);
    expect(result.patterns[0]).toMatchObject({ name: expect.any(String), examples: expect.any(Array) });
  });
});
