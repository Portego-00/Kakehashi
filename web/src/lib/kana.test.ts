import { expect, it } from "vitest";
import { composeKanaInput, finalizeKanaInput } from "./kana";

it("keeps a trailing n editable until submission", () => {
  expect(composeKanaInput("chian")).toBe("ちあn");
  expect(finalizeKanaInput(composeKanaInput("chian"))).toBe("ちあん");
  expect(composeKanaInput("ちあna")).toBe("ちあな");
});

it("finishes full-width romaji without removing punctuation or spacing", () => {
  expect(finalizeKanaInput(" ちあｎ！ ")).toBe(" ちあん！ ");
});

it("does not invent a kana for an unfinished consonant other than n", () => {
  expect(finalizeKanaInput("ちあk")).toBe("ちあk");
});
