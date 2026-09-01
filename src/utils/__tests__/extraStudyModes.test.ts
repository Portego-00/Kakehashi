import {
  EXTRA_STUDY_MODE_DEFINITIONS,
  getAvailableExtraStudyModes,
  RESUMABLE_EXTRA_STUDY_MODE_SESSION_KEYS,
} from "../extraStudyModes";
import { EXTRA_STUDY_SESSION_STORAGE_KEYS } from "../extraStudySessionPersistence";

describe("extraStudyModes", () => {
  it("publishes the JLPT quiz in Extra Study", () => {
    expect(
      EXTRA_STUDY_MODE_DEFINITIONS.find((mode) => mode.id === "jlpt-quiz"),
    ).toMatchObject({
      title: "JLPT Quiz",
      route: "/jlpt",
    });
    expect(
      EXTRA_STUDY_MODE_DEFINITIONS.find((mode) => mode.id === "jlpt-quiz"),
    ).not.toHaveProperty("requiresUsername");
  });

  it("publishes Word Search as a resumable Extra Study mode", () => {
    const wordSearchMode = EXTRA_STUDY_MODE_DEFINITIONS.find(
      (mode) => mode.id === "word-search",
    );

    expect(wordSearchMode).toMatchObject({
      title: "Word Search",
      route: "/word-search-config",
    });
    expect(wordSearchMode).not.toHaveProperty("requiresUsername");
    expect(RESUMABLE_EXTRA_STUDY_MODE_SESSION_KEYS["word-search"]).toBe(
      EXTRA_STUDY_SESSION_STORAGE_KEYS.WORD_SEARCH,
    );
  });

  it("exposes Word Search and JLPT Quiz to every account", () => {
    const publicModeIds = getAvailableExtraStudyModes("another-user").map(
      (mode) => mode.id,
    );
    const portegoModeIds = getAvailableExtraStudyModes(" portEGO ").map(
      (mode) => mode.id,
    );

    expect(publicModeIds).toContain("word-search");
    expect(publicModeIds).toContain("jlpt-quiz");
    expect(portegoModeIds).toContain("word-search");
    expect(portegoModeIds).toContain("jlpt-quiz");
  });
});
