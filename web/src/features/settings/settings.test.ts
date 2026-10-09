import { describe, expect, it } from "vitest";
import { dashboardSectionWidth, DASHBOARD_SECTION_DEFINITION_BY_ID, DASHBOARD_SECTIONS, DEFAULT_DASHBOARD_SECTION_ORDER, DEFAULT_DASHBOARD_SECTION_WIDTHS, DEFAULT_HIDDEN_DASHBOARD_SECTIONS, DEFAULT_WEB_SETTINGS, loadWebSettings, NAVBAR_TAB_IDS, reorderDashboardSections, saveWebSettings, settingsStorageKey, type ReviewOrderSetting, type ReviewTypeOrderSetting } from "./settings";
import { ALL_ANIME_SOURCE } from "@/features/anime/types";

function storage(value: unknown) {
  return { getItem: () => JSON.stringify(value) };
}

describe("web settings persistence", () => {
  it("persists optional review presets, caps saved lists to three, and keeps old installs opt-out", () => {
    let saved = "";
    const target = { getItem: () => saved || null, setItem: (_key: string, value: string) => { saved = value; } };
    expect(loadWebSettings(target, "tester").study).toMatchObject({ reviewPresetsEnabled: false, reviewPresets: [] });
    const presets = Array.from({ length: 4 }, (_, index) => ({ id: `preset-${index}`, name: `Preset ${index}`, batchSize: 5, reviewOrder: "ascendingSrsStage" as const }));
    saveWebSettings(target, "tester", { ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, reviewBatchSize: 50, reviewPresetsEnabled: true, reviewPresets: presets } });
    expect(loadWebSettings(target, "tester").study).toMatchObject({ reviewBatchSize: 50, reviewPresetsEnabled: true, reviewPresets: presets.slice(0, 3) });
  });
  it("keeps existing review layouts and panel behavior unless explicitly changed", () => {
    for (const study of [{}, { compactReviews: "true", reviewDefaultDetailsTab: "context" }]) {
      expect(loadWebSettings(storage({ study }), "tester").study).toMatchObject({ compactReviews: false, reviewDefaultDetailsTab: "question" });
    }
    let saved = "";
    const target = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
    saveWebSettings(target, "tester", { ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, compactReviews: true, reviewDefaultDetailsTab: "stroke" } });
    expect(loadWebSettings(target, "tester").study).toMatchObject({ compactReviews: true, reviewDefaultDetailsTab: "stroke" });
  });

  it("keeps multiple choice opt-in and saves it without changing Anki mode", () => {
    for (const value of [undefined, "true", 1, null]) expect(loadWebSettings(storage({ study: { reviewMultipleChoiceEnabled: value } }), "tester").study.reviewMultipleChoiceEnabled).toBe(false);
    let saved = "";
    const target = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
    for (const enabled of [true, false]) {
      saveWebSettings(target, "tester", { ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, reviewMultipleChoiceEnabled: enabled, ankiMode: "reading" } });
      expect(loadWebSettings(target, "tester").study).toMatchObject({ reviewMultipleChoiceEnabled: enabled, ankiMode: "reading" });
    }
  });
  it.each([undefined, null, "context", "Reading", true])("defaults invalid combined Anki tab %s to Meaning", (value) => {
    expect(loadWebSettings(storage({ study: { ankiCombinedDetailsTab: value } }), "tester").study.ankiCombinedDetailsTab).toBe("meaning");
  });

  it.each(["meaning", "reading", "stroke"] as const)("persists the combined Anki details tab %s", (tab) => {
    let saved = "";
    const target = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
    saveWebSettings(target, "tester", { ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, ankiCombinedDetailsTab: tab } });
    expect(loadWebSettings(target, "tester").study.ankiCombinedDetailsTab).toBe(tab);
  });
  it("keeps Bunpro furigana hiding opt-in and restores valid saved preferences", () => {
    expect(loadWebSettings(storage({ study: {} }), "tester").study.bunproHideFurigana).toBe(false);
    expect(loadWebSettings(storage({ study: { bunproHideFurigana: "true" } }), "tester").study.bunproHideFurigana).toBe(false);
    expect(loadWebSettings(storage({ study: { bunproHideFurigana: true } }), "tester").study.bunproHideFurigana).toBe(true);
  });
  it("keeps the pace planner off for new and legacy settings and restores explicit opt-in", () => {
    expect(DEFAULT_WEB_SETTINGS.workspace.studyPacePlannerEnabled).toBe(false);
    expect(loadWebSettings(storage({ workspace: {} }), "Portego").workspace.studyPacePlannerEnabled).toBe(false);
    expect(loadWebSettings(storage({ workspace: { studyPacePlannerEnabled: "true" } }), "Portego").workspace.studyPacePlannerEnabled).toBe(false);
    expect(loadWebSettings(storage({ workspace: { studyPacePlannerEnabled: true } }), "Portego").workspace.studyPacePlannerEnabled).toBe(true);
  });
  it("accepts user synonyms by default for new users", () => {
    expect(loadWebSettings({ getItem: () => null }, "new-user").study.acceptUserSynonymsAsAnswers).toBe(true);
  });

  it.each([undefined, false, true])("enables synonyms for legacy settings with preference %s", (enabled) => {
    const loaded = loadWebSettings(storage({ study: { acceptUserSynonymsAsAnswers: enabled, lessonsBatchSize: 10 } }), "tester");
    expect(loaded.study.acceptUserSynonymsAsAnswers).toBe(true);
    expect(loaded.study.lessonsBatchSize).toBe(10);

    let saved = "";
    const target = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
    saveWebSettings(target, "tester", loaded);
    expect(loadWebSettings(target, "tester").study.acceptUserSynonymsAsAnswers).toBe(true);
    saveWebSettings(target, "tester", { ...loaded, study: { ...loaded.study, acceptUserSynonymsAsAnswers: false } });
    expect(loadWebSettings(target, "tester").study.acceptUserSynonymsAsAnswers).toBe(false);
  });

  it.each([true, false])("restores synonym preference %s saved by the updated web app", (enabled) => {
    let saved = "";
    const target = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
    saveWebSettings(target, "tester", { ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, acceptUserSynonymsAsAnswers: enabled } });
    expect(loadWebSettings(target, "tester").study.acceptUserSynonymsAsAnswers).toBe(enabled);
  });

  it("supports mobile lesson batch sizes and migrates larger web batches", () => {
    for (let size = 2; size <= 10; size += 1) expect(loadWebSettings(storage({ study: { lessonsBatchSize: size } }), "tester").study.lessonsBatchSize).toBe(size);
    for (const size of [15, 20]) expect(loadWebSettings(storage({ study: { lessonsBatchSize: size } }), "tester").study.lessonsBatchSize).toBe(10);
    for (const size of [1, 2.5, "4", 999]) expect(loadWebSettings(storage({ study: { lessonsBatchSize: size } }), "tester").study.lessonsBatchSize).toBe(5);
  });

  it("defaults lesson order to random and migrates existing choices", () => {
    expect(loadWebSettings(storage({}), "tester").study.lessonOrder).toBe("random");
    for (const [saved, expected] of [["available", "oldestUnlockedFirst"], ["level", "lowestLevelFirst"], ["subject-type", "subject-type"], ["random", "random"], ["currentLevelFirst", "currentLevelFirst"], ["newestUnlockedFirst", "newestUnlockedFirst"], ["ascendingSubjectId", "ascendingSubjectId"], ["descendingSubjectId", "descendingSubjectId"]]) {
      expect(loadWebSettings(storage({ study: { lessonOrder: saved } }), "tester").study.lessonOrder).toBe(expected);
    }
  });

  it("persists kana exclusion and normalizes workload thresholds like mobile", () => {
    const settings = loadWebSettings(storage({ study: { excludeKanaVocabularyFromLessons: true, apprenticeLessonThreshold: 100.9, guruLessonThreshold: 12000 } }), "tester");
    expect(settings.study).toMatchObject({ excludeKanaVocabularyFromLessons: true, apprenticeLessonThreshold: 100, guruLessonThreshold: 9999 });
    let saved = "";
    saveWebSettings({ setItem: (_key, value) => { saved = value; } }, "tester", settings);
    expect(loadWebSettings({ getItem: () => saved }, "tester").study).toEqual(settings.study);
    expect(loadWebSettings(storage({ study: { apprenticeLessonThreshold: "100", guruLessonThreshold: -1 } }), "tester").study).toMatchObject({ excludeKanaVocabularyFromLessons: false, apprenticeLessonThreshold: 0, guruLessonThreshold: 0 });
  });

  it("persists lesson batch minimums and defaults old settings to disabled", () => {
    for (const value of [true, false]) {
      const loaded = loadWebSettings(storage({ study: { minimumRadicalKanjiPerBatchEnabled: value } }), "tester");
      expect(loaded.study.minimumRadicalKanjiPerBatchEnabled).toBe(value);
      let saved = "";
      saveWebSettings({ setItem: (_key, data) => { saved = data; } }, "tester", loaded);
      expect(loadWebSettings({ getItem: () => saved }, "tester").study.minimumRadicalKanjiPerBatchEnabled).toBe(value);
    }
    for (const value of [undefined, "true", 1, null]) expect(loadWebSettings(storage({ study: { minimumRadicalKanjiPerBatchEnabled: value } }), "tester").study.minimumRadicalKanjiPerBatchEnabled).toBe(false);
  });

  it("persists study keys and restores the hidden-answer preference", () => {
    const studyShortcuts = { ...DEFAULT_WEB_SETTINGS.study.studyShortcuts, progress: " ", replayAudio: "p" };
    const loaded = loadWebSettings(storage({ study: { studyShortcuts, ankiHideAnswerCompletely: true } }), "tester");
    expect(loaded.study.studyShortcuts).toEqual(studyShortcuts);
    expect(loaded.study.ankiHideAnswerCompletely).toBe(true);
    let saved = "";
    saveWebSettings({ setItem: (_key, value) => { saved = value; } }, "tester", loaded);
    expect(loadWebSettings({ getItem: () => saved }, "tester").study.studyShortcuts).toEqual(studyShortcuts);
  });

  it("keeps custom daily limits through storage and rejects invalid values", () => {
    for (const value of [0, 7, 10, 50, 500]) expect(loadWebSettings(storage({ study: { dailyLessonLimit: value } }), "tester").study.dailyLessonLimit).toBe(value);
    for (const value of [-1, 2.5, 501, "10"]) expect(loadWebSettings(storage({ study: { dailyLessonLimit: value } }), "tester").study.dailyLessonLimit).toBe(0);
  });

  it("enables pronunciation autoplay by default while preserving saved choices", () => {
    expect(loadWebSettings({ getItem: () => null }, "new-user").study.autoplayAudio).toBe(true);
    expect(loadWebSettings(storage({ study: {} }), "legacy-user").study.autoplayAudio).toBe(true);
    expect(loadWebSettings(storage({ study: { autoplayAudio: false } }), "quiet-user").study.autoplayAudio).toBe(false);
    expect(loadWebSettings(storage({ study: { autoplayAudio: true } }), "audio-user").study.autoplayAudio).toBe(true);
  });


  it("persists shared forecast views and repairs old or unsupported preferences", () => {
    const configured = loadWebSettings(storage({
      ...DEFAULT_WEB_SETTINGS,
      workspace: { ...DEFAULT_WEB_SETTINGS.workspace, forecastViewMode: "list", forecastChartMode: "daily", forecastBreakdown: "subject" },
    }), "tester");
    expect(configured.workspace).toMatchObject({ forecastViewMode: "list", forecastChartMode: "daily", forecastBreakdown: "subject" });
    const saved = new Map<string, string>();
    saveWebSettings({ setItem: (key, value) => saved.set(key, value) }, "tester", configured);
    expect(loadWebSettings({ getItem: (key) => saved.get(key) ?? null }, "tester").workspace).toEqual(configured.workspace);
    expect(loadWebSettings(storage({ workspace: { forecastViewMode: "pie", forecastChartMode: "monthly", forecastBreakdown: "unknown" } }), "tester").workspace)
      .toMatchObject({ forecastViewMode: "chart", forecastChartMode: "hourly", forecastBreakdown: "off" });
    expect(loadWebSettings(storage({ workspace: { forecastBreakdown: "srs" } }), "tester").workspace.forecastBreakdown).toBe("srs");
  });

  it("defines every supported navbar tab and the default selection", () => {
    expect(NAVBAR_TAB_IDS).toEqual(["home", "level", "items", "analytics", "news", "epubs", "video", "manga", "music", "notebooks"]);
    expect(DEFAULT_WEB_SETTINGS.workspace.navbarTabs).toEqual(["home", "level", "news", "video", "manga", "music"]);
  });

  it("repairs navbar tabs to required, supported, unique, and canonical values", () => {
    const loaded = loadWebSettings(storage({
      ...DEFAULT_WEB_SETTINGS,
      workspace: {
        ...DEFAULT_WEB_SETTINGS.workspace,
        navbarTabs: ["music", "video", "unknown", "notebooks", "analytics", "music", "items"],
      },
    }), "tester");

    expect(loaded.workspace.navbarTabs).toEqual(["home", "level", "items", "analytics", "video", "music", "notebooks"]);

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
      pauseOnWrong: false,
      pauseOnClose: true,
      pauseOnCorrect: true,
      answerFeedbackSoundEnabled: false,
      srsProgressionCardDisplayMode: "compact" as const,
      acceptUserSynonymsAsAnswers: true,
      vocabularyAudioVoice: "both" as const,
      ankiMode: "reading",
      ankiGroupQuestions: true,
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

  it("uses the configured review question defaults", () => {
    expect(DEFAULT_WEB_SETTINGS.study).toMatchObject({
      autoplayAudio: true,
      answerFeedbackSoundEnabled: true,
      showReviewItemLevelAndSrsStage: false,
      showVocabularyFrequency: false,
      showVocabContextSentencesInReviews: false,
      allowSkippingReviews: false,
      reviewSearchButtonEnabled: false,
      reviewCharacterFontScale: 1,
      pauseOnWrong: true,
      pauseOnClose: false,
      pauseOnCorrect: true,
      srsProgressionCardDisplayMode: "normal",
      acceptUserSynonymsAsAnswers: true,
      vocabularyAudioVoice: "female",
      ankiGroupQuestions: false,
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

  it("pauses correct answers by default when no valid legacy answer-stop value exists", () => {
    for (const answerStopBehavior of [undefined, "sometimes"]) {
      const legacyStudy = { ...DEFAULT_WEB_SETTINGS.study, answerStopBehavior } as Record<string, unknown>;
      delete legacyStudy.pauseOnWrong;
      delete legacyStudy.pauseOnClose;
      delete legacyStudy.pauseOnCorrect;
      expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study: legacyStudy }), "tester").study).toMatchObject({ pauseOnWrong: true, pauseOnClose: false, pauseOnCorrect: true });
    }
  });

  it("drops legacy answer-size preferences while preserving question size", () => {
    const loaded = loadWebSettings(storage({ study: { reviewInputFontScale: 1.2, reviewCharacterFontScale: 1.4 } }), "tester");
    expect(loaded.study).not.toHaveProperty("reviewInputFontScale");
    expect(loaded.study.reviewCharacterFontScale).toBe(1.4);
    let saved = "";
    saveWebSettings({ setItem: (_key, value) => { saved = value; } }, "tester", loaded);
    expect(JSON.parse(saved).study).not.toHaveProperty("reviewInputFontScale");
    expect(loadWebSettings({ getItem: () => saved }, "tester").study.reviewCharacterFontScale).toBe(1.4);
  });

  it("accepts only supported review scales and vocabulary voice values", () => {
    for (const reviewFontScale of [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.2, 1.4]) {
      const loaded = loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, reviewCharacterFontScale: reviewFontScale } }), "tester").study;
      expect(loaded.reviewCharacterFontScale).toBe(reviewFontScale);
    }
    for (const vocabularyAudioVoice of ["female", "male", "random", "both"] as const) {
      expect(loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, vocabularyAudioVoice } }), "tester").study.vocabularyAudioVoice).toBe(vocabularyAudioVoice);
    }

    const repaired = loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, reviewCharacterFontScale: 0.75, vocabularyAudioVoice: "robot", srsProgressionCardDisplayMode: "floating" } }), "tester").study;
    expect(repaired.reviewCharacterFontScale).toBe(1);
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
      reviewCharacterFontScale: 0.3,
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
      "incomplete-levels",
      "custom-vocabulary",
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

  it("migrates untouched earlier dashboard defaults", () => {
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

    const splitCustomVocabularyDefaultWorkspace = {
      ...DEFAULT_WEB_SETTINGS.workspace,
      dashboardOrder: ["daily-study", "level", "extra-study", "forecast", "recent-mistakes", "study-pulse", "review-heatmap", "srs", "study-streak", "level-timing", "today-study", "subject-lists", "custom-vocabulary", "incomplete-levels", "recent-unlocks", "critical-items", "burned-items", "study-time"],
    };

    for (const workspace of [historicalDefaultWorkspace, currentSeventeenWidgetDefaultWorkspace, splitCustomVocabularyDefaultWorkspace]) {
      const migrated = loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, workspace }), "tester");
      expect(migrated.workspace).toMatchObject({
        dashboardOrder: DEFAULT_DASHBOARD_SECTION_ORDER,
        hiddenDashboard: [],
        dashboardWidths: DEFAULT_DASHBOARD_SECTION_WIDTHS,
        dashboardRowStarts: [],
      });
    }
  });

  it("preserves deliberate changes to the previous custom-vocabulary layout", () => {
    const previousOrder = ["daily-study", "level", "extra-study", "forecast", "recent-mistakes", "study-pulse", "review-heatmap", "srs", "study-streak", "level-timing", "today-study", "subject-lists", "custom-vocabulary", "incomplete-levels", "recent-unlocks", "critical-items", "burned-items", "study-time"];
    const workspace = {
      ...DEFAULT_WEB_SETTINGS.workspace,
      dashboardOrder: previousOrder,
      dashboardWidths: { ...DEFAULT_DASHBOARD_SECTION_WIDTHS, "custom-vocabulary": 6 as const },
      dashboardRowStarts: ["custom-vocabulary" as const],
    };
    const loaded = loadWebSettings(storage({ ...DEFAULT_WEB_SETTINGS, workspace }), "tester");
    expect(loaded.workspace).toEqual(workspace);
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

it("keeps automatic wrong-answer details opt-in and persists the preference", () => {
  expect(DEFAULT_WEB_SETTINGS.study.showDetailsOnWrongAnswer).toBe(false);
  for (const value of [undefined, "true", 1, null, false]) {
    expect(loadWebSettings(storage({ study: { showDetailsOnWrongAnswer: value } }), "tester").study.showDetailsOnWrongAnswer).toBe(false);
  }
  const saved = new Map<string, string>();
  const memory = { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value); } };
  saveWebSettings(memory, "tester", { ...DEFAULT_WEB_SETTINGS, study: { ...DEFAULT_WEB_SETTINGS.study, showDetailsOnWrongAnswer: true } });
  expect(loadWebSettings(memory, "tester").study.showDetailsOnWrongAnswer).toBe(true);
});
