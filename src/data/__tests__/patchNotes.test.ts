import { PATCH_NOTES, getCurrentPatchNotesVersion } from "../patchNotes";

describe("patch notes", () => {
  it("announces the public Word Search mode in the current release", () => {
    expect(getCurrentPatchNotesVersion()).toBe("1.4.7");
    expect(PATCH_NOTES[0]).toMatchObject({
      version: "1.4.7",
      date: "2026-08-30",
    });
    expect(
      PATCH_NOTES[0]?.changes.find((change) => change.title === "Word Search"),
    ).toMatchObject({
      type: "feature",
      link: {
        route: "/word-search-config",
        label: "Play Word Search",
      },
    });
  });
});
