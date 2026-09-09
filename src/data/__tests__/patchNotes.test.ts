import { PATCH_NOTES, getCurrentPatchNotesVersion } from "../patchNotes";

describe("patch notes", () => {
  it("keeps the newest release first and reports its version", () => {
    const versions = PATCH_NOTES.map((note) => note.version);
    const newestFirst = [...versions].sort((a, b) =>
      b.localeCompare(a, "en", { numeric: true }),
    );

    expect(versions.length).toBeGreaterThan(0);
    expect(versions).toEqual(newestFirst);
    expect(getCurrentPatchNotesVersion()).toBe(newestFirst[0]);
  });

  it("preserves the JLPT announcement in its original release", () => {
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
