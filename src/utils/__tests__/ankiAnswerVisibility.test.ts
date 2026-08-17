import { shouldShowAnkiPitchAccent } from "../ankiAnswerVisibility";

describe("shouldShowAnkiPitchAccent", () => {
  it("hides pitch accent on a separate meaning card", () => {
    expect(shouldShowAnkiPitchAccent("meaning", false)).toBe(false);
  });

  it("shows pitch accent on a separate reading card", () => {
    expect(shouldShowAnkiPitchAccent("reading", false)).toBe(true);
  });

  it("shows pitch accent on a grouped card", () => {
    expect(shouldShowAnkiPitchAccent("meaning", true)).toBe(true);
  });
});
