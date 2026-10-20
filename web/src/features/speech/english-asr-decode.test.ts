import { describe, expect, it } from "vitest";
import vocab from "./fixtures/english-vocab.json";
import { englishAsrVocabulary, decodeEnglishAsrLogits, trimEnglishAsrAudio } from "./english-asr-decode";
const tokens = englishAsrVocabulary(vocab);
function scores(ids: number[]) {
  const output = new Float32Array(ids.length * 32).fill(-10);
  ids.forEach((id, frame) => { output[frame * 32 + id] = 10; });
  return output;
}
describe("English speech decoding", () => {
  it("preserves word boundaries, apostrophes and repetitions separated by blanks", () => {
    expect(decodeEnglishAsrLogits(scores([6, 6, 8, 0, 4, 5, 5, 7, 6, 0]), tokens)).toBe("to eat");
    expect(decodeEnglishAsrLogits(scores([13, 13, 0, 13, 27, 12]), tokens)).toBe("rr's");
  });
  it("does not treat empty, unknown or invalid model output as an answer", () => {
    expect(() => decodeEnglishAsrLogits(scores([0, 0, 1, 2]), tokens)).toThrow("No English");
    expect(() => decodeEnglishAsrLogits(scores([3]), tokens)).toThrow("unclear");
    const invalid = scores([7]); invalid[0] = NaN;
    expect(() => decodeEnglishAsrLogits(invalid, tokens)).toThrow("invalid scores");
    expect(() => englishAsrVocabulary({ ...vocab, "<pad>": 31 })).toThrow();
  });
});

it("retains the spoken waveform and quiet consonants while removing long recording boundaries", () => {
  const audio = new Float32Array(32_000);
  audio.fill(0.3, 8_000, 16_000);
  audio.fill(0.002, 7_000, 8_000);
  const trimmed = trimEnglishAsrAudio(audio);
  expect(trimmed).toEqual(audio.slice(6_400, 17_600));
  expect(trimEnglishAsrAudio(new Float32Array(16_000))).toHaveLength(16_000);
});
