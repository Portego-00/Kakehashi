import { expect, it, vi } from "vitest";
import {
  voiceReadingLookup,
  possibleVoiceReadings,
  resolveVoiceTranscript,
} from "./review-voice-reading";
vi.mock("./japanese-asr-assets", () => ({ hasJapaneseAsr: async () => false }));
vi.mock("@/lib/wanikani/client", () => ({
  wkCollection: async () => [
    {
      data: {
        characters: "今日",
        readings: [{ reading: "きょう" }, { reading: "こんにち" }],
      },
    },
  ],
}));
const entry = (characters: string, readings: string[]) => ({
  data: { characters, readings: readings.map((reading) => ({ reading })) },
});
it("uses whole vocabulary readings before attempting individual kanji combinations", () => {
  const words = voiceReadingLookup([
    entry("学校", ["がっこう"]),
    entry("学", ["がく"]),
    entry("校", ["こう"]),
  ]);
  expect(possibleVoiceReadings("学校。", words)).toEqual(["がっこう"]);
});
it("retains pronunciation ambiguity instead of selecting the card's expected answer", async () => {
  const words = voiceReadingLookup([entry("川", ["かわ", "せん"])]);
  expect(possibleVoiceReadings("川", words).sort()).toEqual(["かわ", "せん"]);
  expect(
    await resolveVoiceTranscript(
      "今日",
      "ja",
      new Float32Array(16_000),
      true,
      new AbortController().signal,
    ),
  ).toBeNull();
});
it("keeps kana/romaji readings phonetic and strips model control tokens", async () => {
  const signal = new AbortController().signal;
  expect(
    await resolveVoiceTranscript(
      "<|ja|>ガッコウ。",
      "ja",
      new Float32Array(0),
      true,
      signal,
    ),
  ).toBe("がっこう");
  expect(
    await resolveVoiceTranscript("ha", "ja", new Float32Array(0), true, signal),
  ).toBe("は");
  expect(
    await resolveVoiceTranscript(
      "<|en|>to eat",
      "en",
      new Float32Array(0),
      true,
      signal,
    ),
  ).toBe("to eat");
});

it("uses independent vocabulary pronunciations rather than component kanji readings", () => {
  const words = voiceReadingLookup([
    { ...entry("川", ["せん", "かわ"]), object: "kanji" },
    { ...entry("川", ["かわ"]), object: "vocabulary" },
  ]);
  expect(possibleVoiceReadings("川", words)).toEqual(["かわ"]);
});
