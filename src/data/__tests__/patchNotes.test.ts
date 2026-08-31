import { PATCH_NOTES, getCurrentPatchNotesVersion } from "../patchNotes";

describe("patch notes", () => {
  it("announces JLPT quizzes in the current release", () => {
    expect(getCurrentPatchNotesVersion()).toBe("1.4.8");
    expect(PATCH_NOTES[0]).toMatchObject({
      version: "1.4.8",
      date: "2026-08-31",
    });
    expect(
      PATCH_NOTES[0]?.changes.find((change) => change.title === "JLPT Quizzes"),
    ).toMatchObject({
      type: "feature",
      link: {
        route: "/jlpt",
        label: "Open JLPT Quizzes",
      },
    });
  });

  it("preserves the Word Search announcement in the previous release", () => {
    expect(PATCH_NOTES[1]).toMatchObject({
      version: "1.4.7",
      date: "2026-08-30",
    });
    expect(
      PATCH_NOTES[1]?.changes.find((change) => change.title === "Word Search"),
    ).toMatchObject({
      type: "feature",
      link: {
        route: "/word-search-config",
        label: "Play Word Search",
      },
    });
  });
});
