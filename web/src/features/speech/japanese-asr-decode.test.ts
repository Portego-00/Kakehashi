import { describe, expect, it } from "vitest";
import vocabulary from "./fixtures/japanese-asr-vocab.json";
import { asrVocabulary, decodeAsrLogits, normalizeAsrAudio } from "./japanese-asr-decode";
import { canUseReviewAsr } from "./review-asr-access";

const tokens = asrVocabulary(vocabulary);
function logits(ids: number[]) {
  const values = new Float32Array(ids.length * 86).fill(-10);
  ids.forEach((id, index) => { values[index * 86 + id] = 10; });
  return values;
}
describe("Japanese reading recognition", () => {
  it("decodes kana from acoustic CTC frames without an expected answer", () => {
    expect(decodeAsrLogits(logits([85, 33, 33, 27, 50, 13, 85]), tokens)).toBe("がっこう");
    expect(decodeAsrLogits(logits([85, 46, 46, 85, 46, 85]), tokens)).toBe("いい");
    expect(decodeAsrLogits(logits([19, 17, 13]), tokens)).toBe("きょう");
    expect(decodeAsrLogits(logits([37, 73]), tokens)).toBe("もり");
  });
  it("never substitutes an unknown or empty result", () => {
    expect(() => decodeAsrLogits(logits([85, 85]), tokens)).toThrow("No Japanese reading");
    expect(() => decodeAsrLogits(logits([76, 84]), tokens)).toThrow("unclear");
    expect(() => decodeAsrLogits(new Float32Array(86).fill(NaN), tokens)).toThrow("invalid scores");
  });
  it("rejects a mixed kanji vocabulary or mismatched blank", () => {
    const rest: Record<string, number> = { ...vocabulary };
    delete rest["か"];
    expect(() => asrVocabulary({ ...rest, 川: 76 })).toThrow("kana-only");
    expect(() => asrVocabulary({ ...vocabulary, "[PAD]": 0, お: 85 })).toThrow("blank");
  });
  it("normalizes raw audio and rejects silence, malformed or overly long recordings", () => {
    const samples = Float32Array.from({ length: 16_000 }, (_, index) => Math.sin(index / 20) * 0.1 + 0.2);
    const normalized = normalizeAsrAudio(samples);
    expect(normalized.reduce((sum, value) => sum + value, 0) / normalized.length).toBeCloseTo(0, 5);
    expect(Math.sqrt(normalized.reduce((sum, value) => sum + value ** 2, 0) / normalized.length)).toBeCloseTo(1, 3);
    expect(() => normalizeAsrAudio(new Float32Array(16_000))).toThrow("No speech");
    expect(() => normalizeAsrAudio(new Float32Array(96_001))).toThrow("six seconds");
    samples[0] = NaN;
    expect(() => normalizeAsrAudio(samples)).toThrow("invalid audio");
  });
  it("is limited to real Portego accounts", () => {
    expect(canUseReviewAsr("  pOrTeGo ")).toBe(true);
    for (const username of ["OtherUser", "Portego2", null, undefined, ""]) expect(canUseReviewAsr(username)).toBe(false);
    expect(canUseReviewAsr("Portego", true)).toBe(false);
  });
});
