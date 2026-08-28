import { describe, expect, it } from "vitest";
import { composeKanaInput, questionUsesKanaComposition } from "./kana-composition";
import type { StudyQuestion } from "./types";

function question(kind: StudyQuestion["kind"], subjectType: StudyQuestion["subjectType"] = "vocabulary"): StudyQuestion {
  return { id: kind, subjectId: 1, subjectType, kind, prompt: "防ぐ", promptLabel: "Reading", acceptedAnswers: ["ふせぐ"], displayAnswer: "ふせぐ" };
}

describe("live kana composition", () => {
  it("converts completed romaji while preserving an unfinished syllable", () => {
    expect(composeKanaInput("bougu")).toBe("ぼうぐ");
    expect(composeKanaInput("sh")).toBe("sh");
    expect(composeKanaInput("shi")).toBe("し");
  });

  it("activates only for answers that accept a kana reading", () => {
    expect(questionUsesKanaComposition(question("reading"))).toBe(true);
    expect(questionUsesKanaComposition(question("meaning-to-reading"))).toBe(true);
    expect(questionUsesKanaComposition(question("context"))).toBe(true);
    expect(questionUsesKanaComposition(question("listening-characters", "kana_vocabulary"))).toBe(true);
    expect(questionUsesKanaComposition(question("listening-characters", "vocabulary"))).toBe(true);
    expect(questionUsesKanaComposition(question("meaning"))).toBe(false);
    expect(questionUsesKanaComposition(question("kana-to-kanji"))).toBe(false);
    expect(questionUsesKanaComposition(question("listening-meaning", "vocabulary"))).toBe(false);
  });
});
