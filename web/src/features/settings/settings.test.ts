import { describe, expect, it } from "vitest";
import { DEFAULT_WEB_SETTINGS, loadWebSettings, saveWebSettings, settingsStorageKey } from "./settings";

function storage(value: unknown) {
  return { getItem: () => JSON.stringify(value) };
}

describe("web settings persistence", () => {
  it("hydrates the complete study inventory", () => {
    const study = {
      ...DEFAULT_WEB_SETTINGS.study,
      ankiMode: "reading",
      lessonQuestionOrder: "meaning-first",
      reviewQuestionOrder: "reading-first",
      answerStopBehavior: "incorrect",
      voiceAnswers: true,
      jitaiEnabled: true,
      jitaiSelectedFontIds: ["mincho"],
      immersionKitAnimeSources: ["death_note"],
      epubDailyGoalMinutes: 20,
    };
    expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study }), "tester").study).toMatchObject(study);
  });

  it("sanitizes unsupported settings and source lists", () => {
    const loaded = loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, ankiMode: "magic", answerStopBehavior: "sometimes", epubDailyGoalMinutes: 999, immersionKitAnimeSources: [" a ", "a", 9, "b"] } }), "tester");
    expect(loaded.study.ankiMode).toBe("off");
    expect(loaded.study.answerStopBehavior).toBe("always");
    expect(loaded.study.epubDailyGoalMinutes).toBe(5);
    expect(loaded.study.immersionKitAnimeSources).toEqual(["a", "b"]);
  });

  it("migrates the legacy shared answer order into both core modes", () => {
    const value = { ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, answerOrder: "reading-first" } } as Record<string, unknown>;
    const nested = value.study as Record<string, unknown>;
    delete nested.lessonQuestionOrder;
    delete nested.reviewQuestionOrder;
    const loaded = loadWebSettings(storage(value), "tester");
    expect(loaded.study.lessonQuestionOrder).toBe("reading-first");
    expect(loaded.study.reviewQuestionOrder).toBe("reading-first");
  });

  it("uses a normalized per-user storage key", () => expect(settingsStorageKey(" Web Tester ")).toBe("kakehashi-web:settings:web%20tester:v1"));

  it("keeps a trimmed JPDB key scoped to the current browser profile", () => {
    const loaded = loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, integrations: { jpdbApiKey: "  jpdb-key  " } }), "tester");
    expect(loaded.integrations.jpdbApiKey).toBe("jpdb-key");
  });

  it("keeps custom font binaries out of localStorage while preserving metadata", () => {
    const values = new Map<string, string>();
    const target = { setItem: (key: string, value: string) => values.set(key, value) };
    const configured = {
      ...DEFAULT_WEB_SETTINGS,
      study: {
        ...DEFAULT_WEB_SETTINGS.study,
        jitaiCustomFonts: [{ id: "custom-font1", name: "Handwriting", dataUrl: "data:font/woff2;base64,Zm9udA==" }],
      },
    };
    saveWebSettings(target, "tester", configured);
    const raw = values.get(settingsStorageKey("tester")) || "";
    expect(raw).not.toContain("data:font");
    expect(JSON.parse(raw).study.jitaiCustomFonts).toEqual([{ id: "custom-font1", name: "Handwriting" }]);
  });
});
