import { createVoiceActivityDetector } from "../voiceActivity";

describe("short voice activity detection", () => {
  it("waits through silence and ignores a single loud click", () => {
    const detector = createVoiceActivityDetector();
    for (let index = 0; index < 200; index++) expect(detector.record(-2)).toBe(false);
    expect(detector.record(5)).toBe(false);
    expect(detector.record(-2)).toBe(false);
    expect(detector.record(5)).toBe(false);
  });
  it("detects a brief syllable and stops extending the deadline in silence", () => {
    const detector = createVoiceActivityDetector();
    expect(detector.record(3)).toBe(false);
    expect(detector.record(4)).toBe(true);
    expect(detector.record(2)).toBe(true);
    expect(detector.record(-2)).toBe(false);
    expect(detector.record(-2)).toBe(false);
  });
  it("ignores invalid microphone samples", () => {
    const detector = createVoiceActivityDetector();
    expect(detector.record(NaN)).toBe(false);
    expect(detector.record(Infinity)).toBe(false);
  });
});
