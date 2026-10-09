import { fireEvent, render, screen } from "@testing-library/react";
import BunproDetailsDOM from "../../../../src/components/bunpro/bunpro-details-dom";

vi.mock("expo-asset", () => ({ Asset: { fromModule: (uri: string) => ({ uri }) } }));

const theme = { background: "white", text: "black", muted: "gray", border: "#ccc", surface: "white" };
const base = { kind: "grammar" as const, resourceId: "1", tab: "Examples" as const, theme, playingId: null, onPlay: vi.fn(async () => undefined), onOpenLink: vi.fn(async () => undefined), attributes: { title: "行く" } };
const example = (type = "study_question") => ({ id: "example-1", type, attributes: { content: "昨日、____。[[hidden annotation]]", answer: "行かなかった", translation: "I did not go yesterday.", female_audio_url: "https://example.com/audio.mp3", extra_info: "Past tense" } });

it.each(["study_question", "vocab_study_question"])("renders %s formatting and strips hidden answer annotations", type => {
  render(<BunproDetailsDOM {...base} included={[example(type)]} />);
  expect(screen.getByText("行かなかった")).toBeVisible();
  expect(screen.getByText("I did not go yesterday.")).toBeVisible();
  expect(screen.queryByText(/hidden annotation/)).not.toBeInTheDocument();
});

it("toggles sentences and translations globally and for individual examples, and bridges audio", () => {
  render(<BunproDetailsDOM {...base} included={[example()]} />);
  fireEvent.click(screen.getByRole("button", { name: "Sentence" }));
  expect(screen.getByText("行かなかった")).not.toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Translation" }));
  expect(screen.getByText("I did not go yesterday.")).not.toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Translation" }));
  fireEvent.click(screen.getByRole("button", { name: "Example options" }));
  fireEvent.click(screen.getByRole("button", { name: "Hide translation" }));
  expect(screen.getByText("I did not go yesterday.")).not.toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Play example audio" }));
  expect(base.onPlay).toHaveBeenCalledWith("example-1", ["https://example.com/audio.mp3"]);
});

it("switches structures and renders embedded writeup examples with safe links", () => {
  const onOpenLink = vi.fn(async () => undefined);
  render(<BunproDetailsDOM {...base} onOpenLink={onOpenLink} tab="Details" attributes={{ title: "行く", casual_structure: "Standard form", polite_structure: "Polite form" }} included={[{ ...example(), id: "1" }, { id: "w", type: "writeup", attributes: { body: '<p><a href="/grammar_points/test">Reference</a><script>unsafe()</script></p><ul class="writeup-examples--holder"><li data-study-question="1"></li></ul>' } }]} />);
  fireEvent.click(screen.getByRole("button", { name: "Polite" }));
  expect(screen.getByText("Polite form")).toBeVisible();
  expect(screen.getByText("行かなかった")).toBeVisible();
  expect(screen.queryByText("unsafe()")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("link", { name: "Reference" }));
  expect(onOpenLink).toHaveBeenCalledWith("https://bunpro.jp/grammar_points/test");
});

it("renders dictionary senses, pitch, and selectable frequency sources", () => {
  render(<BunproDetailsDOM {...base} kind="vocab" tab="Details" attributes={{ title: "猫", kana: "ねこ", pitch_accent_stress: "HL", frequency_dictionary: 10, frequency_anime: 20, jmdict_data: { sense: [{ gloss: [{ lang: "eng", text: "cat" }], info: ["Animal"], antonym: ["犬"] }], kanji: [{ text: "猫", common: true }], kana: [{ text: "ねこ" }] } }} included={[]} />);
  expect(screen.getByText("Common")).toBeVisible();
  expect(screen.getByText("cat")).toBeVisible();
  expect(screen.getByText("Top 10")).toBeVisible();
  fireEvent.change(screen.getByLabelText("Frequency source"), { target: { value: "anime" } });
  expect(screen.getByText("Top 20")).toBeVisible();
});
