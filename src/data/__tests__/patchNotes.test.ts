import { PATCH_NOTES, getCurrentPatchNotesVersion } from "../patchNotes";

describe("patch notes", () => {
  it("keeps the latest release current and preserves the JLPT announcement", () => {
    expect(getCurrentPatchNotesVersion()).toBe("1.4.9");
    expect(PATCH_NOTES[0]).toMatchObject({
      version: "1.4.9",
      date: "2026-09-03",
    });
    const jlptRelease = PATCH_NOTES.find((note) => note.version === "1.4.8");
    expect(
      jlptRelease?.changes.find((change) => change.title === "JLPT Quizzes"),
    ).toMatchObject({
      type: "feature",
      link: {
        route: "/jlpt",
        label: "Open JLPT Quizzes",
      },
    });
  });

  it("preserves the Word Search announcement in its original release", () => {
    const wordSearchRelease = PATCH_NOTES.find((note) => note.version === "1.4.7");
    expect(wordSearchRelease).toMatchObject({
      version: "1.4.7",
      date: "2026-08-30",
    });
    expect(
      wordSearchRelease?.changes.find((change) => change.title === "Word Search"),
    ).toMatchObject({
      type: "feature",
      link: {
        route: "/word-search-config",
        label: "Play Word Search",
      },
    });
  });
});
