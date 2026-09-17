import { describe, expect, it } from "vitest";
import { settingsSearchScore } from "./settings-search";

describe("settings search", () => {
  it("tolerates missing letters and adjacent transpositions", () => {
    expect(settingsSearchScore("feeback soud", "Answer feedback sounds", "Mute the feedback sound")).toBeGreaterThan(0);
    expect(settingsSearchScore("syonnym", "Accept user synonyms")).toBeGreaterThan(0);
  });
  it("matches reordered words and prefixes across labels and descriptions", () => {
    expect(settingsSearchScore("sound answ", "Answer feedback sounds")).toBeGreaterThan(0);
    expect(settingsSearchScore("review mute", "Answer feedback sounds", "Mute feedback", "Reviews")).toBeGreaterThan(0);
  });
  it("ranks exact labels above fuzzy or description-only matches", () => {
    expect(settingsSearchScore("sounds", "Sounds")).toBeGreaterThan(settingsSearchScore("sounds", "Sound"));
    expect(settingsSearchScore("sound", "Sound")).toBeGreaterThan(settingsSearchScore("sound", "Feedback", "Play a sound"));
  });
  it("rejects unrelated and empty queries without overmatching short words", () => {
    expect(settingsSearchScore("banana", "Answer feedback sounds")).toBe(0);
    expect(settingsSearchScore("go", "No limit")).toBe(0);
    expect(settingsSearchScore("  ", "Answer feedback sounds")).toBe(0);
    expect(settingsSearchScore("sound banana", "Answer feedback sounds")).toBe(0);
  });
});
