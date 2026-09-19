import { expect, it } from "vitest";
import { bunproDisplayAnswers, bunproPitchAccents, normalizeMeaning } from "./study-preferences";
it("keeps alternative answer text readable for Anki, without kana-converting English", () => {
  expect(bunproDisplayAnswers({ answer: "outside", alternate_grammar: ["exterior", "outside"] })).toEqual(["outside", "exterior"]);
  expect(normalizeMeaning("  Outside!  ")).toBe("outside");
});
it("uses only unambiguous Bunpro pitch drops", () => {
  expect(bunproPitchAccents({ kana: "そとがわ", pitch_accent_stress: "LHLL" })).toEqual([{ r: "そとがわ", p: [2] }]);
  expect(bunproPitchAccents({ kana: "そとがわ", pitch_accent_stress: "LHHH" })).toEqual([]);
});
