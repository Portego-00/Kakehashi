import { describe, expect, it } from "vitest";
import { DEFAULT_STUDY_SHORTCUTS, normalizeStudyShortcuts, studyShortcutAction } from "./study-shortcuts";

describe("study shortcuts", () => {
  it("migrates missing settings and validates imported keys", () => {
    expect(normalizeStudyShortcuts(undefined)).toEqual(DEFAULT_STUDY_SHORTCUTS);
    expect(normalizeStudyShortcuts({ progress: "Tab", replayAudio: 4 })).toEqual(DEFAULT_STUDY_SHORTCUTS);
    expect(normalizeStudyShortcuts({ progress: "r" })).toEqual(DEFAULT_STUDY_SHORTCUTS);
    expect(normalizeStudyShortcuts({ progress: " ", replayAudio: "P" })).toMatchObject({ progress: " ", replayAudio: "p" });
  });
  it("prioritizes explicit bindings and disables replaced keys and aliases", () => {
    const keys = { ...DEFAULT_STUDY_SHORTCUTS, progress: " ", replayAudio: "c", markCorrect: "j", markIncorrect: "f" };
    expect(studyShortcutAction(" ", keys)).toBe("progress");
    expect(studyShortcutAction("C", keys)).toBe("replayAudio");
    expect(studyShortcutAction("J", keys)).toBe("markCorrect");
    for (const key of ["Enter", "r", "2", "1", "x"]) expect(studyShortcutAction(key, keys)).toBeUndefined();
  });
});
