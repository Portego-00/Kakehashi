import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DictionaryDefinition, ReviewProgress, VocabPronunciation } from "./BunproDetailPanels";
afterEach(cleanup);
it("shows English dictionary senses, all forms, common status, and antonyms", () => {
  render(<DictionaryDefinition attributes={{ jmdict_pos: ["Noun"], jmdict_data: { kanji: [{ text: "外側", common: true }], kana: [{ text: "そとがわ" }], sense: [{ gloss: [{ lang: "eng", text: "outside" }, { lang: "ger", text: "außen" }], antonym: [["内側"]] }] } }} />);
  expect(screen.getByText("outside")).toBeVisible();
  expect(screen.queryByText("außen")).not.toBeInTheDocument();
  expect(screen.getByText("Common")).toBeVisible();
  expect(screen.getByText("外側、そとがわ")).toBeVisible();
  expect(screen.getByText("内側")).toBeVisible();
});
it("renders actual study progress without treating unknown accuracy as zero", () => {
  render(<ReviewProgress kind="grammar" review={{ streak: 7, next_review: "2020-01-01", started_studying_at: "2020-01-01", times_studied: 8, accuracy: null, ghost_count: 0, default_input_type: "Cloze" }} />);
  expect(screen.getByText("Seasoned 1")).toBeVisible();
  expect(screen.getByText("Now")).toBeVisible();
  expect(screen.getByText("Cloze (Manual)")).toBeVisible();
  expect(screen.queryByText("0%")).not.toBeInTheDocument();
});
it("shows pitch and chooses the available frequency source", () => {
  render(<dl><VocabPronunciation attributes={{ kana: "そとがわ", pitch_accent_stress: "LHHH", frequency_dictionary: 2300, frequency_anime: 2500 }} /></dl>);
  expect(screen.getByText("Top 2,300")).toBeVisible();
  expect(screen.getByLabelText("そとがわ, pitch LHHH")).toBeVisible();
  expect(screen.getByRole("button", { name: "Play pronunciation" })).toBeDisabled();
});
