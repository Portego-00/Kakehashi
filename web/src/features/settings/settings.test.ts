import { describe, expect, it } from "vitest";
import { dashboardSectionWidth, DASHBOARD_SECTION_DEFINITION_BY_ID, DASHBOARD_SECTIONS, DEFAULT_DASHBOARD_SECTION_ORDER, DEFAULT_DASHBOARD_SECTION_WIDTHS, DEFAULT_HIDDEN_DASHBOARD_SECTIONS, DEFAULT_WEB_SETTINGS, loadWebSettings, NAVBAR_TAB_IDS, reorderDashboardSections, saveWebSettings, settingsStorageKey, type ReviewOrderSetting, type ReviewTypeOrderSetting } from "./settings";
import { ALL_ANIME_SOURCE } from "@/features/anime/types";

function storage(value: unknown) {
  return { getItem: () => JSON.stringify(value) };
}

describe("web settings persistence", () => {
  it("defines every supported navbar tab and the default selection", () => {
    expect(NAVBAR_TAB_IDS).toEqual(["home", "level", "items", "analytics", "news", "epubs", "video", "manga", "music"]);
    expect(DEFAULT_WEB_SETTINGS.workspace.navbarTabs).toEqual(["home", "level", "news", "video", "manga", "music"]);
  });

  it("repairs navbar tabs to required, supported, unique, and canonical values", () => {
    const loaded = loadWebSettings(storage({
      ...DEFAULT_WEB_SETTINGS,
      workspace: {
        ...DEFAULT_WEB_SETTINGS.workspace,
        navbarTabs: ["music", "video", "unknown", "analytics", "music", "items"],
      },
    }), "tester");

    expect(loaded.workspace.navbarTabs).toEqual(["home", "level", "items", "analytics", "video", "music"]);

    const empty = loadWebSettings(storage({
      ...DEFAULT_WEB_SETTINGS,
      workspace: { ...DEFAULT_WEB_SETTINGS.workspace, navbarTabs: [] },
    }), "tester");
    expect(empty.workspace.navbarTabs).toEqual(["home", "level"]);
  });

  it("migrates legacy navbar visibility without restoring hidden content tabs", () => {
    const legacyWorkspace: Partial<typeof DEFAULT_WEB_SETTINGS.workspace> = {
      ...DEFAULT_WEB_SETTINGS.workspace,
      visibleNav: DEFAULT_WEB_SETTINGS.workspace.visibleNav.filter((id) => id !== "news" && id !== "music"),
    };
    delete legacyWorkspace.navbarTabs;

    const loaded = loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, workspace: legacyWorkspace }), "tester");

    expect(loaded.workspace.navbarTabs).toEqual(["home", "level", "video", "manga"]);
  });

  it("keeps native detail enrichments optional with native-compatible defaults", () => {
    expect(DEFAULT_WEB_SETTINGS.subjectDetails).toMatchObject({
      showPitchAccent: false,
      showKanjiReadingExamples: true,
      showStrokeOrder: true,
      showPatternsOfUse: false,
    });
  });

  it("defaults readers to click details and WK plus JPDB recognition", () => {
    expect(DEFAULT_WEB_SETTINGS.reader).toEqual({ detailsInteraction: "click", recognitionMode: "wk-jpdb" });
    expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, reader: { detailsInteraction: "hover", recognitionMode: "wk" } }), "tester").reader).toEqual({ detailsInteraction: "hover", recognitionMode: "wk" });
  });

  it("repairs missing or unsupported reader preferences", () => {
    expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, reader: { detailsInteraction: "focus", recognitionMode: "jpdb" } }), "tester").reader).toEqual(DEFAULT_WEB_SETTINGS.reader);
    const legacy = { ...DEFAULT_WEB_SETTINGS } as Partial<typeof DEFAULT_WEB_SETTINGS>;
    delete legacy.reader;
    expect(loadWebSettings(storage(legacy), "tester").reader).toEqual(DEFAULT_WEB_SETTINGS.reader);
  });

  it("hydrates the complete study inventory", () => {
    const study = {
      ...DEFAULT_WEB_SETTINGS.study,
      showReviewItemLevelAndSrsStage: true,
      showVocabularyFrequency: true,
      showVocabContextSentencesInReviews: true,
      allowSkippingReviews: true,
      reviewSearchButtonEnabled: true,
      reviewCharacterFontScale: 0.7,
      reviewInputFontScale: 1.2,
      pauseOnWrong: false,
      pauseOnClose: true,
      pauseOnCorrect: true,
      answerFeedbackSoundEnabled: false,
      srsProgressionCardDisplayMode: "compact" as const,
      acceptUserSynonymsAsAnswers: true,
      vocabularyAudioVoice: "both" as const,
      ankiMode: "reading",
      ankiGroupQuestions: true,
      ankiHideAnswerCompletely: true,
      ankiShowOtherAcceptedAnswersAndUserSynonyms: true,
      ankiShowWaniKaniGrammarTags: true,
      ankiShowPitchAccentNumbers: true,
      ankiShowPitchAccentGraph: true,
      ankiShowReplayAudioButton: true,
      acceptAnyKanjiOnyomiReading: true,
      lessonQuestionOrder: "meaning-first",
      reviewQuestionOrder: "reading-first",
      answerStopBehavior: "incorrect",
      voiceAnswers: true,
      jitaiEnabled: true,
      jitaiSelectedFontIds: ["mincho"],
      immersionKitAnimeSources: ["death_note"],
      epubDailyGoalMinutes: 20,
      showListeningTranslation: false,
    };
    expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study }), "tester").study).toMatchObject(study);
  });

  it("defines the complete mobile review-order inventory", () => {
    const reviewOrders: ReviewOrderSetting[] = [
      "random",
      "ascendingSrsStage",
      "descendingSrsStage",
      "currentLevelFirst",
      "lowestLevelFirst",
      "newestAvailableFirst",
      "oldestAvailableFirst",
      "longestRelativeWait",
    ];
    const typeOrder: ReviewTypeOrderSetting[] = ["radical", "kanji", "vocabulary"];

    for (const reviewOrder of reviewOrders) {
      const loaded = loadWebSettings(storage({
        ...DEFAULT_WEB_SETTINGS,
        study: { ...DEFAULT_WEB_SETTINGS.study, reviewOrder, customReviewOrder: reviewOrder },
      }), "tester");
      expect(loaded.study.reviewOrder).toBe(reviewOrder);
      expect(loaded.study.customReviewOrder).toBe(reviewOrder);
    }
    expect(DEFAULT_WEB_SETTINGS.study.reviewTypeOrder).toEqual(typeOrder);
  });

  it("migrates legacy review-order aliases without losing type grouping", () => {
    const loadLegacyOrder = (reviewOrder: string) => loadWebSettings(storage({
      ...DEFAULT_WEB_SETTINGS,
      study: { ...DEFAULT_WEB_SETTINGS.study, reviewOrder },
    }), "tester").study;

    expect(loadLegacyOrder("available")).toMatchObject({ reviewOrder: "oldestAvailableFirst", reviewTypeOrderEnabled: false });
    expect(loadLegacyOrder("srs")).toMatchObject({ reviewOrder: "ascendingSrsStage", reviewTypeOrderEnabled: false });
    expect(loadLegacyOrder("subject-type")).toMatchObject({
      reviewOrder: "random",
      reviewTypeOrderEnabled: true,
      reviewTypeOrder: ["radical", "kanji", "vocabulary"],
    });
  });

  it("normalizes review type order to a unique and complete permutation", () => {
    const loaded = loadWebSettings(storage({
      ...DEFAULT_WEB_SETTINGS,
      study: {
        ...DEFAULT_WEB_SETTINGS.study,
        reviewTypeOrder: ["vocabulary", "vocabulary", "retired", "radical"],
      },
    }), "tester");

    expect(loaded.study.reviewTypeOrder).toEqual(["vocabulary", "radical", "kanji"]);
  });

  it("supports every mobile review batch cap and infers the legacy enabled state", () => {
    for (let reviewBatchSize = 5; reviewBatchSize <= 100; reviewBatchSize += 5) {
      const loaded = loadWebSettings(storage({
        ...DEFAULT_WEB_SETTINGS,
        study: { ...DEFAULT_WEB_SETTINGS.study, reviewBatchSizeEnabled: true, reviewBatchSize },
      }), "tester");
      expect(loaded.study.reviewBatchSize).toBe(reviewBatchSize);
      expect(loaded.study.reviewBatchSizeEnabled).toBe(true);
    }

    const legacyStudy = { ...DEFAULT_WEB_SETTINGS.study } as Record<string, unknown>;
    delete legacyStudy.reviewBatchSizeEnabled;
    legacyStudy.reviewBatchSize = 25;
    expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study: legacyStudy }), "tester").study.reviewBatchSizeEnabled).toBe(true);

    delete legacyStudy.reviewBatchSize;
    expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study: legacyStudy }), "tester").study.reviewBatchSizeEnabled).toBe(false);

    expect(loadWebSettings(storage({
      ...DEFAULT_WEB_SETTINGS,
      study: { ...DEFAULT_WEB_SETTINGS.study, reviewBatchSizeEnabled: false, reviewBatchSize: 25 },
    }), "tester").study.reviewBatchSizeEnabled).toBe(false);
  });

  it("hydrates the remaining mobile review controls and accepts a 20-subject wrap-up", () => {
    const study = {
      ...DEFAULT_WEB_SETTINGS.study,
      reviewQuestionOrderEnabled: true,
      prioritizeCriticalItems: true,
      reviewWrapUpSize: 20,
      showAddSynonymButton: false,
      backToBackQuestions: true,
      backToBackImmediateRetryIncorrect: true,
      reviewAnimatePreviousQuestion: false,
      ankiButtonlessMode: true,
    };

    expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study }), "tester").study).toMatchObject(study);
    expect(DEFAULT_WEB_SETTINGS.study).toMatchObject({
      reviewQuestionOrderEnabled: false,
      prioritizeCriticalItems: false,
      reviewBatchSizeEnabled: false,
      showAddSynonymButton: true,
      backToBackQuestions: false,
      backToBackImmediateRetryIncorrect: false,
      reviewAnimatePreviousQuestion: true,
      ankiButtonlessMode: false,
    });
  });

  it("keeps review question enhancements opt-in with mobile-compatible defaults", () => {
    expect(DEFAULT_WEB_SETTINGS.study).toMatchObject({
      autoplayAudio: false,
      answerFeedbackSoundEnabled: true,
      showReviewItemLevelAndSrsStage: false,
      showVocabularyFrequency: false,
      showVocabContextSentencesInReviews: false,
      allowSkippingReviews: false,
      reviewSearchButtonEnabled: false,
      reviewCharacterFontScale: 1,
      reviewInputFontScale: 1,
      pauseOnWrong: true,
      pauseOnClose: false,
      pauseOnCorrect: false,
      srsProgressionCardDisplayMode: "normal",
      acceptUserSynonymsAsAnswers: false,
      vocabularyAudioVoice: "female",
      ankiGroupQuestions: false,
      ankiHideAnswerCompletely: false,
      ankiShowOtherAcceptedAnswersAndUserSynonyms: false,
      ankiShowWaniKaniGrammarTags: false,
      ankiShowPitchAccentNumbers: false,
      ankiShowPitchAccentGraph: false,
      ankiShowReplayAudioButton: false,
      acceptAnyKanjiOnyomiReading: false,
    });
  });

  it("migrates legacy SRS visibility and answer-stop behavior", () => {
    const legacyStudy = { ...DEFAULT_WEB_SETTINGS.study, showSrsIndicator: false, answerStopBehavior: "always" } as Record<string, unknown>;
    delete legacyStudy.showReviewItemLevelAndSrsStage;
    delete legacyStudy.pauseOnWrong;
    delete legacyStudy.pauseOnClose;
    delete legacyStudy.pauseOnCorrect;

    expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study: legacyStudy }), "tester").study).toMatchObject({
      showReviewItemLevelAndSrsStage: false,
      pauseOnWrong: true,
      pauseOnClose: false,
      pauseOnCorrect: true,
    });

    legacyStudy.answerStopBehavior = "incorrect";
    expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study: legacyStudy }), "tester").study).toMatchObject({ pauseOnWrong: true, pauseOnClose: false, pauseOnCorrect: false });

    legacyStudy.answerStopBehavior = "never";
    expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study: legacyStudy }), "tester").study).toMatchObject({ pauseOnWrong: false, pauseOnClose: false, pauseOnCorrect: false });

    expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study: { ...legacyStudy, showReviewItemLevelAndSrsStage: true } }), "tester").study.showReviewItemLevelAndSrsStage).toBe(true);
  });

  it("uses mobile pause defaults when no valid legacy answer-stop value exists", () => {
    for (const answerStopBehavior of [undefined, "sometimes"]) {
      const legacyStudy = { ...DEFAULT_WEB_SETTINGS.study, answerStopBehavior } as Record<string, unknown>;
      delete legacyStudy.pauseOnWrong;
      delete legacyStudy.pauseOnClose;
      delete legacyStudy.pauseOnCorrect;
      expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study: legacyStudy }), "tester").study).toMatchObject({ pauseOnWrong: true, pauseOnClose: false, pauseOnCorrect: false });
    }
  });

  it("accepts only supported review scales and vocabulary voice values", () => {
    for (const reviewFontScale of [0.7, 0.8, 0.9, 1, 1.1, 1.2]) {
      const loaded = loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, reviewCharacterFontScale: reviewFontScale, reviewInputFontScale: reviewFontScale } }), "tester").study;
      expect(loaded.reviewCharacterFontScale).toBe(reviewFontScale);
      expect(loaded.reviewInputFontScale).toBe(reviewFontScale);
    }
    for (const vocabularyAudioVoice of ["female", "male", "random", "both"] as const) {
      expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, vocabularyAudioVoice } }), "tester").study.vocabularyAudioVoice).toBe(vocabularyAudioVoice);
    }

    const repaired = loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, reviewCharacterFontScale: 0.75, reviewInputFontScale: 1.3, vocabularyAudioVoice: "robot", srsProgressionCardDisplayMode: "floating" } }), "tester").study;
    expect(repaired.reviewCharacterFontScale).toBe(1);
    expect(repaired.reviewInputFontScale).toBe(1);
    expect(repaired.vocabularyAudioVoice).toBe("female");
    expect(repaired.srsProgressionCardDisplayMode).toBe("normal");
  });

  it("round-trips review question preferences through per-user storage", () => {
    const values = new Map<string, string>();
    const target = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const study = {
      ...DEFAULT_WEB_SETTINGS.study,
      showReviewItemLevelAndSrsStage: true,
      showVocabularyFrequency: true,
      pauseOnWrong: false,
      pauseOnClose: true,
      answerFeedbackSoundEnabled: false,
      reviewCharacterFontScale: 0.8,
      reviewInputFontScale: 1.1,
      vocabularyAudioVoice: "random" as const,
      ankiShowOtherAcceptedAnswersAndUserSynonyms: true,
      srsProgressionCardDisplayMode: "hidden" as const,
      acceptUserSynonymsAsAnswers: true,
      acceptAnyKanjiOnyomiReading: true,
      customReviewOrder: "longestRelativeWait" as const,
      reviewTypeOrderEnabled: true,
      reviewTypeOrder: ["vocabulary", "kanji", "radical"] as ReviewTypeOrderSetting[],
      prioritizeCriticalItems: true,
      reviewBatchSizeEnabled: true,
      reviewBatchSize: 95,
      reviewWrapUpSize: 20,
      reviewQuestionOrderEnabled: true,
      backToBackQuestions: true,
      backToBackImmediateRetryIncorrect: true,
      reviewAnimatePreviousQuestion: false,
      showAddSynonymButton: false,
      ankiButtonlessMode: true,
    };

    saveWebSettings(target, "tester", { ...DEFAULT_WEB_SETTINGS, study });

    expect(loadWebSettings(target, "tester").study).toMatchObject(study);
  });

  it("shows listening translations by default and preserves the saved preference", () => {
    expect(DEFAULT_WEB_SETTINGS.study.showListeningTranslation).toBe(true);
    expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, showListeningTranslation: false } }), "tester").study.showListeningTranslation).toBe(false);
  });

  it("keeps English lyric translations opt-in and serializes the saved preference", () => {
    expect(DEFAULT_WEB_SETTINGS.study.songsLyricsLineTranslationsEnabled).toBe(false);

    const values = new Map<string, string>();
    const target = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    saveWebSettings(target, "tester", {
      ...DEFAULT_WEB_SETTINGS,
      study: { ...DEFAULT_WEB_SETTINGS.study, songsLyricsLineTranslationsEnabled: true },
    });

    const serialized = JSON.parse(values.get(settingsStorageKey("tester")) ?? "{}");
    expect(serialized.study.songsLyricsLineTranslationsEnabled).toBe(true);
    expect(loadWebSettings(target, "tester").study.songsLyricsLineTranslationsEnabled).toBe(true);
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
    delete nested.reviewQuestionOrderEnabled;
    const loaded = loadWebSettings(storage(value), "tester");
    expect(loaded.study.lessonQuestionOrder).toBe("reading-first");
    expect(loaded.study.reviewQuestionOrder).toBe("reading-first");
    expect(loaded.study.reviewQuestionOrderEnabled).toBe(true);
  });

  it("preserves an explicit disabled review question order during migration", () => {
    const loaded = loadWebSettings(storage({
      ...DEFAULT_WEB_SETTINGS,
      study: { ...DEFAULT_WEB_SETTINGS.study, answerOrder: "reading-first", reviewQuestionOrder: "reading-first", reviewQuestionOrderEnabled: false },
    }), "tester");

    expect(loaded.study.reviewQuestionOrder).toBe("reading-first");
    expect(loaded.study.reviewQuestionOrderEnabled).toBe(false);
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

  it("uses the full dashboard layout as the default", () => {
    expect(DEFAULT_DASHBOARD_SECTION_ORDER).toEqual([
      "daily-study",
      "level",
      "extra-study",
      "forecast",
      "recent-mistakes",
      "study-pulse",
      "review-heatmap",
      "srs",
      "study-streak",
      "level-timing",
      "today-study",
      "subject-lists",
      "custom-vocabulary",
      "incomplete-levels",
      "recent-unlocks",
      "critical-items",
      "burned-items",
      "study-time",
    ]);
    expect(DEFAULT_DASHBOARD_SECTION_ORDER).toHaveLength(DASHBOARD_SECTIONS.length);
    expect(new Set(DEFAULT_DASHBOARD_SECTION_ORDER)).toEqual(new Set(DASHBOARD_SECTIONS));
    expect(DEFAULT_HIDDEN_DASHBOARD_SECTIONS).toEqual([]);
    expect(DASHBOARD_SECTION_DEFINITION_BY_ID["custom-vocabulary"]).toMatchObject({
      source: "Home",
      defaultWidth: 12,
      allowedWidths: [6, 8, 12],
    });
    expect(DEFAULT_WEB_SETTINGS.workspace).toMatchObject({
      dashboardOrder: DEFAULT_DASHBOARD_SECTION_ORDER,
      hiddenDashboard: [],
      dashboardWidths: {
        "daily-study": 12,
        "custom-vocabulary": 12,
        level: 12,
        "extra-study": 12,
        forecast: 12,
        "recent-mistakes": 6,
        "study-pulse": 6,
        "review-heatmap": 12,
        srs: 8,
        "study-streak": 4,
        "level-timing": 8,
        "today-study": 4,
        "subject-lists": 4,
        "incomplete-levels": 8,
        "recent-unlocks": 6,
        "critical-items": 6,
        "burned-items": 6,
        "study-time": 6,
      },
      dashboardRowStarts: [],
    });
    expect(loadWebSettings({ getItem: () => null }, "new-user").workspace).toEqual(DEFAULT_WEB_SETTINGS.workspace);
  });

  it("migrates both untouched earlier dashboard defaults", () => {
    const historicalOrder = ["daily-study", "srs", "level", "extra-study", "forecast", "study-pulse", "recent-mistakes", "study-streak", "subject-lists", "incomplete-levels", "recent-unlocks", "critical-items", "burned-items", "review-heatmap", "level-timing", "today-study", "study-time"];
    const historicalDefaultWorkspace = {
      ...DEFAULT_WEB_SETTINGS.workspace,
      dashboardOrder: historicalOrder,
      hiddenDashboard: ["recent-mistakes", "study-streak", "subject-lists", "incomplete-levels", "recent-unlocks", "critical-items", "burned-items", "review-heatmap", "level-timing", "today-study", "study-time"],
      dashboardWidths: {
        "daily-study": 12,
        srs: 8,
        level: 8,
        "extra-study": 12,
        forecast: 8,
        "study-pulse": 4,
        "recent-mistakes": 6,
        "study-streak": 4,
        "subject-lists": 4,
        "incomplete-levels": 6,
        "recent-unlocks": 6,
        "critical-items": 6,
        "burned-items": 6,
        "review-heatmap": 12,
        "level-timing": 8,
        "today-study": 4,
        "study-time": 4,
      },
      dashboardRowStarts: [],
    };

    const currentSeventeenWidgetDefaultWorkspace = {
      ...DEFAULT_WEB_SETTINGS.workspace,
      dashboardOrder: ["daily-study", "level", "extra-study", "forecast", "recent-mistakes", "study-pulse", "review-heatmap", "srs", "study-streak", "level-timing", "today-study", "subject-lists", "incomplete-levels", "recent-unlocks", "critical-items", "burned-items", "study-time"],
      hiddenDashboard: [],
      dashboardWidths: {
        "daily-study": 12,
        level: 12,
        "extra-study": 12,
        forecast: 12,
        "recent-mistakes": 6,
        "study-pulse": 6,
        "review-heatmap": 12,
        srs: 8,
        "study-streak": 4,
        "level-timing": 8,
        "today-study": 4,
        "subject-lists": 4,
        "incomplete-levels": 8,
        "recent-unlocks": 6,
        "critical-items": 6,
        "burned-items": 6,
        "study-time": 6,
      },
      dashboardRowStarts: [],
    };

    for (const workspace of [historicalDefaultWorkspace, currentSeventeenWidgetDefaultWorkspace]) {
      const migrated = loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, workspace }), "tester");
      expect(migrated.workspace).toMatchObject({
        dashboardOrder: DEFAULT_DASHBOARD_SECTION_ORDER,
        hiddenDashboard: [],
        dashboardWidths: DEFAULT_DASHBOARD_SECTION_WIDTHS,
        dashboardRowStarts: [],
      });
    }
  });

  it("preserves a customized dashboard while merging in custom vocabulary as visible", () => {
    const historicalOrder = ["daily-study", "srs", "level", "extra-study", "forecast", "study-pulse", "recent-mistakes", "study-streak", "subject-lists", "incomplete-levels", "recent-unlocks", "critical-items", "burned-items", "review-heatmap", "level-timing", "today-study", "study-time"];
    const hiddenDashboard = ["recent-mistakes", "study-streak", "subject-lists", "incomplete-levels", "recent-unlocks", "critical-items", "burned-items", "review-heatmap", "level-timing", "today-study", "study-time"];
    const customized = loadWebSettings(storage({
      ...DEFAULT_WEB_SETTINGS,
      workspace: {
        ...DEFAULT_WEB_SETTINGS.workspace,
        dashboardOrder: historicalOrder,
        hiddenDashboard,
        dashboardWidths: { level: 6 },
      },
    }), "tester");

    expect(customized.workspace).toMatchObject({
      dashboardOrder: [...historicalOrder, "custom-vocabulary"],
      hiddenDashboard,
      dashboardWidths: { level: 6, "custom-vocabulary": 12 },
    });
    expect(customized.workspace.hiddenDashboard).not.toContain("custom-vocabulary");
  });

  it("does not treat a customized historical width as an untouched default", () => {
    const historicalOrder = ["daily-study", "srs", "level", "extra-study", "forecast", "study-pulse", "recent-mistakes", "study-streak", "subject-lists", "incomplete-levels", "recent-unlocks", "critical-items", "burned-items", "review-heatmap", "level-timing", "today-study", "study-time"];
    const hiddenDashboard = ["recent-mistakes", "study-streak", "subject-lists", "incomplete-levels", "recent-unlocks", "critical-items", "burned-items", "review-heatmap", "level-timing", "today-study", "study-time"];
    const customized = loadWebSettings(storage({
      ...DEFAULT_WEB_SETTINGS,
      workspace: {
        ...DEFAULT_WEB_SETTINGS.workspace,
        dashboardOrder: historicalOrder,
        hiddenDashboard,
        dashboardWidths: { level: 6 },
      },
    }), "tester");

    expect(customized.workspace).not.toMatchObject({
      dashboardOrder: DEFAULT_DASHBOARD_SECTION_ORDER,
      hiddenDashboard: [],
    });
    expect(customized.workspace.dashboardWidths.level).toBe(6);
  });

  it("migrates newly available sections using the current default visibility and drops retired sections", () => {
    const legacyOrder = ["daily-study", "srs", "level", "extra-study", "forecast", "study-pulse", "keep-moving"];
    const loaded = loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, workspace: { ...DEFAULT_WEB_SETTINGS.workspace, dashboardOrder: legacyOrder, hiddenDashboard: [] } }), "tester");
    expect(loaded.workspace.dashboardOrder.slice(0, legacyOrder.length - 1)).toEqual(legacyOrder.slice(0, -1));
    expect(loaded.workspace.dashboardOrder).not.toContain("keep-moving");
    expect(loaded.workspace.hiddenDashboard).not.toContain("keep-moving");
    expect(loaded.workspace.hiddenDashboard).toEqual([]);
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
        hiddenDashboard: ["recent-mistakes"],
        dashboardRowStarts: ["level", "recent-mistakes", "keep-moving"],
      },
    }), "tester");
    expect(loaded.workspace.dashboardRowStarts).toEqual(["level"]);
  });

  it("falls back to the intended widget width for legacy settings", () => {
    expect(dashboardSectionWidth("daily-study", undefined)).toBe(12);
    expect(dashboardSectionWidth("custom-vocabulary", 6)).toBe(6);
    expect(dashboardSectionWidth("custom-vocabulary", 4)).toBe(12);
    expect(dashboardSectionWidth("study-pulse", "wide")).toBe(6);
  });

  it("reorders dashboard sections around a drop target", () => {
    expect(reorderDashboardSections(["daily-study", "srs", "level"], "level", "srs")).toEqual(["daily-study", "level", "srs"]);
    expect(reorderDashboardSections(["daily-study", "srs", "level"], "daily-study", "level")).toEqual(["srs", "daily-study", "level"]);
  });
});
