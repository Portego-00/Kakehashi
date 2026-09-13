import { describe, expect, it } from "vitest";
import { PUBLIC_TRANSLATION_MAX_CHARACTERS, readMyMemoryTranslation, splitTranslationText, translationAvailability, utf8Length } from "../translation";

describe("translation helpers", () => {
  it("keeps every public-service chunk within the UTF-8 byte cap without losing text", () => {
    const text = `${"日本語を勉強しています。".repeat(28)}\n短い行です。`;
    const chunks = splitTranslationText(text, 120);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.join("")).toBe(text);
    expect(chunks.every((chunk) => utf8Length(chunk) <= 120)).toBe(true);
  });

  it("reads successful MyMemory responses and rejects service errors", () => {
    expect(readMyMemoryTranslation({ responseStatus: 200, responseData: { translatedText: "I like cats. " } })).toBe("I like cats.");
    expect(() => readMyMemoryTranslation({ responseStatus: 403, responseDetails: "Quota reached" })).toThrow("Quota reached");
    expect(() => readMyMemoryTranslation({ responseStatus: 200, responseData: {} })).toThrow("returned no translation");
  });

  it("describes configured and public translation modes before submission", () => {
    expect(translationAvailability(true)).toMatchObject({ available: true, configured: true, mode: "configured", maxCharacters: 10_000 });
    expect(translationAvailability(false)).toMatchObject({ available: true, configured: false, mode: "public", provider: "MyMemory", maxCharacters: PUBLIC_TRANSLATION_MAX_CHARACTERS });
  });
});
