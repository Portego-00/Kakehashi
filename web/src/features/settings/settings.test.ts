import { describe, expect, it } from "vitest";
import { dashboardSectionWidth, DEFAULT_DASHBOARD_SECTION_WIDTHS, DEFAULT_HIDDEN_DASHBOARD_SECTIONS, DEFAULT_WEB_SETTINGS, loadWebSettings, reorderDashboardSections, saveWebSettings, settingsStorageKey } from "./settings";
import { ALL_ANIME_SOURCE } from "@/features/anime/types";

function storage(value: unknown) {
  return { getItem: () => JSON.stringify(value) };
}

describe("web settings persistence", () => {
  it("keeps native detail enrichments optional with native-compatible defaults", () => {
    expect(DEFAULT_WEB_SETTINGS.subjectDetails).toMatchObject({
      showPitchAccent: false,
      showKanjiReadingExamples: true,
      showStrokeOrder: true,
      showPatternsOfUse: false,
    });
  });

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

  it("defaults legacy empty anime selections to every source and preserves sync usernames", () => {
    const loaded = loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, integrations: { jpdbApiKey: "", myAnimeListUsername: " mal_reader ", aniListUsername: "ani.reader" }, study: { ...DEFAULT_WEB_SETTINGS.study, immersionKitAnimeSources: [] } }), "tester");
    expect(loaded.study.immersionKitAnimeSources).toEqual([ALL_ANIME_SOURCE]);
    expect(loaded.integrations).toMatchObject({ myAnimeListUsername: "mal_reader", aniListUsername: "ani.reader" });
  });

  it("persists subject detail context visibility and defaults missing legacy values on", () => {
    const configured = loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, subjectDetails: { showContextSentences: false, showImmersionExamples: false } }), "tester");
    expect(configured.subjectDetails).toEqual({
      ...DEFAULT_WEB_SETTINGS.subjectDetails,
      showContextSentences: false,
      showImmersionExamples: false,
    });

    const legacy = { ...DEFAULT_WEB_SETTINGS } as Partial<typeof DEFAULT_WEB_SETTINGS>;
    delete legacy.subjectDetails;
    expect(loadWebSettings(storage(legacy), "tester").subjectDetails).toEqual(DEFAULT_WEB_SETTINGS.subjectDetails);
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

  it("normalizes a valid Gravatar email and drops invalid saved values", () => {
    expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, profile: { gravatarEmail: " MyEmailAddress@example.com " } }), "tester").profile.gravatarEmail).toBe("myemailaddress@example.com");
    expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, profile: { gravatarEmail: "not-an-email" } }), "tester").profile.gravatarEmail).toBe("");
  });

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

  it("keeps mobile-parity dashboard sections opt-in by default", () => {
    expect(DEFAULT_HIDDEN_DASHBOARD_SECTIONS).toContain("recent-mistakes");
    expect(DEFAULT_HIDDEN_DASHBOARD_SECTIONS).toContain("level-timing");
    expect(DEFAULT_WEB_SETTINGS.workspace.hiddenDashboard).not.toContain("daily-study");
  });

  it("migrates newly available sections as hidden and drops retired sections", () => {
    const legacyOrder = ["daily-study", "srs", "level", "extra-study", "forecast", "study-pulse", "keep-moving"];
    const loaded = loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, workspace: { ...DEFAULT_WEB_SETTINGS.workspace, dashboardOrder: legacyOrder, hiddenDashboard: [] } }), "tester");
    expect(loaded.workspace.dashboardOrder.slice(0, legacyOrder.length - 1)).toEqual(legacyOrder.slice(0, -1));
    expect(loaded.workspace.dashboardOrder).not.toContain("keep-moving");
    expect(loaded.workspace.hiddenDashboard).not.toContain("keep-moving");
    expect(loaded.workspace.hiddenDashboard).toContain("recent-mistakes");
    expect(loaded.workspace.hiddenDashboard).not.toContain("srs");
  });

  it("persists supported widget widths and repairs incompatible ones", () => {
    const loaded = loadWebSettings(storage({
      ...DEFAULT_WEB_SETTINGS,
      workspace: {
        ...DEFAULT_WEB_SETTINGS.workspace,
        dashboardWidths: { ...DEFAULT_DASHBOARD_SECTION_WIDTHS, srs: 4, level: 6 },
      },
    }), "tester");
    expect(loaded.workspace.dashboardWidths.srs).toBe(DEFAULT_DASHBOARD_SECTION_WIDTHS.srs);
    expect(loaded.workspace.dashboardWidths.level).toBe(6);
  });

  it("keeps valid visible row starts and removes hidden or retired widgets", () => {
    const loaded = loadWebSettings(storage({
      ...DEFAULT_WEB_SETTINGS,
      workspace: {
        ...DEFAULT_WEB_SETTINGS.workspace,
        dashboardRowStarts: ["level", "recent-mistakes", "keep-moving"],
      },
    }), "tester");
    expect(loaded.workspace.dashboardRowStarts).toEqual(["level"]);
  });

  it("falls back to the intended widget width for legacy settings", () => {
    expect(dashboardSectionWidth("daily-study", undefined)).toBe(12);
    expect(dashboardSectionWidth("study-pulse", "wide")).toBe(4);
  });

  it("reorders dashboard sections around a drop target", () => {
    expect(reorderDashboardSections(["daily-study", "srs", "level"], "level", "srs")).toEqual(["daily-study", "level", "srs"]);
    expect(reorderDashboardSections(["daily-study", "srs", "level"], "daily-study", "level")).toEqual(["srs", "daily-study", "level"]);
  });
});
