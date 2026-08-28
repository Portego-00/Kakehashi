import { ALL_ANIME_SOURCE } from "@/features/anime/types";
import type { ListStorage } from "@/features/subjects/lists";
import { normalizeGravatarEmail } from "@/lib/gravatar";

export type TextScale = 0.9 | 1 | 1.1 | 1.2;
export type QuestionOrder = "meaning-first" | "reading-first" | "mixed";
export type AnkiMode = "off" | "both" | "meaning" | "reading";
export type AnswerStopBehavior = "always" | "incorrect" | "never";
export type VocabularyAudioVoice = "female" | "male" | "random" | "both";
export type SrsProgressionCardDisplayMode = "normal" | "compact" | "hidden";
export type ReviewOrderSetting =
  | "random"
  | "ascendingSrsStage"
  | "descendingSrsStage"
  | "currentLevelFirst"
  | "lowestLevelFirst"
  | "newestAvailableFirst"
  | "oldestAvailableFirst"
  | "longestRelativeWait";
export type ReviewTypeOrderSetting = "radical" | "kanji" | "vocabulary";
export type ReaderDetailsInteraction = "click" | "hover";
export type ReaderRecognitionMode = "wk" | "wk-jpdb";
export const REVIEW_ORDER_VALUES = [
  "random",
  "ascendingSrsStage",
  "descendingSrsStage",
  "currentLevelFirst",
  "lowestLevelFirst",
  "newestAvailableFirst",
  "oldestAvailableFirst",
  "longestRelativeWait",
] as const satisfies readonly ReviewOrderSetting[];
export const REVIEW_TYPE_ORDER_VALUES = ["radical", "kanji", "vocabulary"] as const satisfies readonly ReviewTypeOrderSetting[];
export const REVIEW_BATCH_SIZE_VALUES = Array.from({ length: 20 }, (_, index) => (index + 1) * 5);
export interface WebJitaiFont {
  id: string;
  name: string;
  dataUrl?: string;
}
export interface WebStudyPreferences {
  autoplayAudio: boolean;
  answerFeedbackSoundEnabled: boolean;
  showSrsIndicator: boolean;
  showReviewItemLevelAndSrsStage: boolean;
  showVocabularyFrequency: boolean;
  showVocabContextSentencesInReviews: boolean;
  allowSkippingReviews: boolean;
  reviewSearchButtonEnabled: boolean;
  reviewCharacterFontScale: number;
  reviewInputFontScale: number;
  pauseOnWrong: boolean;
  pauseOnClose: boolean;
  pauseOnCorrect: boolean;
  srsProgressionCardDisplayMode: SrsProgressionCardDisplayMode;
  acceptUserSynonymsAsAnswers: boolean;
  showAddSynonymButton: boolean;
  keyboardShortcuts: boolean;
  shuffleSubjects: boolean;
  lessonsBatchSize: number;
  answerOrder: QuestionOrder;
  dailyLessonLimit: number;
  lessonOrder: "available" | "subject-type" | "level";
  reviewOrder: ReviewOrderSetting;
  customReviewOrder: ReviewOrderSetting;
  reviewTypeOrderEnabled: boolean;
  reviewTypeOrder: ReviewTypeOrderSetting[];
  prioritizeCriticalItems: boolean;
  reviewBatchSizeEnabled: boolean;
  reviewBatchSize: number;
  reviewWrapUpSize: number;
  lessonQuestionOrder: QuestionOrder;
  reviewQuestionOrderEnabled: boolean;
  reviewQuestionOrder: QuestionOrder;
  backToBackQuestions: boolean;
  backToBackImmediateRetryIncorrect: boolean;
  reviewAnimatePreviousQuestion: boolean;
  answerStopBehavior: AnswerStopBehavior;
  showAnswerStopSubjectDetails: boolean;
  showListeningTranslation: boolean;
  vocabularyAudioVoice: VocabularyAudioVoice;
  ankiMode: AnkiMode;
  ankiGroupQuestions: boolean;
  ankiHideAnswerCompletely: boolean;
  ankiShowOtherAcceptedAnswersAndUserSynonyms: boolean;
  ankiShowWaniKaniGrammarTags: boolean;
  ankiShowPitchAccentNumbers: boolean;
  ankiShowPitchAccentGraph: boolean;
  ankiButtonlessMode: boolean;
  ankiShowReplayAudioButton: boolean;
  acceptAnyKanjiOnyomiReading: boolean;
  voiceAnswers: boolean;
  jitaiEnabled: boolean;
  jitaiSelectedFontIds: string[];
  jitaiCustomFonts: WebJitaiFont[];
  immersionKitAnimeSources: string[];
  epubDailyGoalMinutes: number;
  songsLyricsLineTranslationsEnabled: boolean;
}
export interface WebSettings {
  textScale: TextScale;
  profile: { gravatarEmail: string };
  colors: { radical: string; kanji: string; vocabulary: string };
  reader: {
    detailsInteraction: ReaderDetailsInteraction;
    recognitionMode: ReaderRecognitionMode;
  };
  subjectDetails: {
    showContextSentences: boolean;
    showImmersionExamples: boolean;
    showPitchAccent: boolean;
    showKanjiReadingExamples: boolean;
    showStrokeOrder: boolean;
    showPatternsOfUse: boolean;
  };
  integrations: { jpdbApiKey: string; myAnimeListUsername: string; aniListUsername: string };
  study: WebStudyPreferences;
  workspace: {
    navbarTabs: NavbarTabId[];
    visibleNav: string[];
    dashboardOrder: string[];
    hiddenDashboard: string[];
    dashboardWidths: Record<DashboardSectionId, DashboardSectionWidth>;
    dashboardRowStarts: DashboardSectionId[];
  };
}

export const NAVBAR_TAB_IDS = ["home", "level", "items", "analytics", "news", "epubs", "video", "manga", "music"] as const;
export type NavbarTabId = (typeof NAVBAR_TAB_IDS)[number];
export const REQUIRED_NAVBAR_TAB_IDS = ["home", "level"] as const satisfies readonly NavbarTabId[];
export const DEFAULT_NAVBAR_TABS = ["home", "level", "news", "video", "manga", "music"] as const satisfies readonly NavbarTabId[];
export const OPTIONAL_NAV_ITEMS = ["analytics", "items", "search", "lists", "news", "reader", "epubs", "music", "video", "manga", "translator", "community"] as const;
export const DASHBOARD_SECTIONS = [
  "daily-study",
  "srs",
  "level",
  "extra-study",
  "forecast",
  "study-pulse",
  "recent-mistakes",
  "study-streak",
  "subject-lists",
  "incomplete-levels",
  "recent-unlocks",
  "critical-items",
  "burned-items",
  "review-heatmap",
  "level-timing",
  "today-study",
  "study-time",
] as const;
export type DashboardSectionId = (typeof DASHBOARD_SECTIONS)[number];
export const DASHBOARD_SECTION_WIDTHS = [4, 6, 8, 12] as const;
export type DashboardSectionWidth = (typeof DASHBOARD_SECTION_WIDTHS)[number];
export type DashboardSectionDefinition = {
  id: DashboardSectionId;
  label: string;
  description: string;
  source: "Home" | "Level" | "Items" | "Analytics";
  defaultWidth: DashboardSectionWidth;
  allowedWidths: readonly DashboardSectionWidth[];
};
export const DASHBOARD_SECTION_DEFINITIONS: DashboardSectionDefinition[] = [
  { id: "daily-study", label: "Lessons & Reviews", description: "Your live study queues and vacation status.", source: "Home", defaultWidth: 12, allowedWidths: [8, 12] },
  { id: "srs", label: "Active Item Spread", description: "Stacked subject distribution across all nine SRS stages.", source: "Analytics", defaultWidth: 8, allowedWidths: [6, 8, 12] },
  { id: "level", label: "Level Progress", description: "Current-level Guru target, timing, radicals, and kanji.", source: "Level", defaultWidth: 12, allowedWidths: [6, 8, 12] },
  { id: "extra-study", label: "Extra Study", description: "Practice modes that do not affect SRS.", source: "Home", defaultWidth: 12, allowedWidths: [8, 12] },
  { id: "forecast", label: "Review Forecast", description: "Upcoming review load by hour.", source: "Home", defaultWidth: 12, allowedWidths: [6, 8, 12] },
  { id: "study-pulse", label: "Review Stats", description: "Accuracy and reviewed-subject totals.", source: "Analytics", defaultWidth: 6, allowedWidths: [4, 6] },
  { id: "recent-mistakes", label: "Recent Mistakes", description: "Recently updated subjects with broken answer streaks.", source: "Home", defaultWidth: 6, allowedWidths: [6, 8, 12] },
  { id: "study-streak", label: "App Streak", description: "Current streak, recent rhythm, and best run in 14 weeks.", source: "Home", defaultWidth: 4, allowedWidths: [4, 6] },
  { id: "subject-lists", label: "Subject Lists", description: "Saved collections and their subject counts.", source: "Home", defaultWidth: 4, allowedWidths: [4, 6] },
  { id: "incomplete-levels", label: "Incomplete Levels", description: "Previous levels that still have items below Guru.", source: "Level", defaultWidth: 8, allowedWidths: [4, 6, 8] },
  { id: "recent-unlocks", label: "Recent Unlocks", description: "The latest subjects added to your study path.", source: "Items", defaultWidth: 6, allowedWidths: [6, 8, 12] },
  { id: "critical-items", label: "Critical Items", description: "Subjects with the lowest answer accuracy.", source: "Items", defaultWidth: 6, allowedWidths: [6, 8, 12] },
  { id: "burned-items", label: "Burned Items", description: "Subjects burned during the last 30 days.", source: "Items", defaultWidth: 6, allowedWidths: [6, 8, 12] },
  { id: "review-heatmap", label: "Review Heatmap", description: "Recent assignment activity by day.", source: "Analytics", defaultWidth: 12, allowedWidths: [8, 12] },
  { id: "level-timing", label: "Level Timing", description: "Completion time across all levels.", source: "Analytics", defaultWidth: 8, allowedWidths: [8, 12] },
  { id: "today-study", label: "Today’s Study", description: "Lessons and reviewed subjects recorded today.", source: "Analytics", defaultWidth: 4, allowedWidths: [4, 6] },
  { id: "study-time", label: "Study Time", description: "Foreground study time combined across your synced devices.", source: "Analytics", defaultWidth: 6, allowedWidths: [4, 6] },
];
export const DASHBOARD_SECTION_DEFINITION_BY_ID = Object.fromEntries(DASHBOARD_SECTION_DEFINITIONS.map((definition) => [definition.id, definition])) as Record<DashboardSectionId, DashboardSectionDefinition>;
export const DEFAULT_DASHBOARD_SECTION_WIDTHS = Object.fromEntries(DASHBOARD_SECTION_DEFINITIONS.map((definition) => [definition.id, definition.defaultWidth])) as Record<DashboardSectionId, DashboardSectionWidth>;
export const DEFAULT_DASHBOARD_SECTION_ORDER: DashboardSectionId[] = [
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
  "recent-unlocks",
  "critical-items",
  "burned-items",
  "study-time",
];
export const DEFAULT_VISIBLE_DASHBOARD_SECTIONS: DashboardSectionId[] = [...DEFAULT_DASHBOARD_SECTION_ORDER];
export const DEFAULT_HIDDEN_DASHBOARD_SECTIONS: DashboardSectionId[] = DASHBOARD_SECTIONS.filter((id) => !DEFAULT_VISIBLE_DASHBOARD_SECTIONS.includes(id));
const PREVIOUS_DEFAULT_DASHBOARD_SECTION_ORDER: DashboardSectionId[] = [
  "daily-study", "srs", "level", "extra-study", "forecast", "study-pulse", "recent-mistakes", "study-streak", "subject-lists", "incomplete-levels", "recent-unlocks", "critical-items", "burned-items", "review-heatmap", "level-timing", "today-study", "study-time",
];
const PREVIOUS_DEFAULT_HIDDEN_DASHBOARD_SECTIONS: DashboardSectionId[] = [
  "recent-mistakes", "study-streak", "subject-lists", "incomplete-levels", "recent-unlocks", "critical-items", "burned-items", "review-heatmap", "level-timing", "today-study", "study-time",
];
const PREVIOUS_DEFAULT_DASHBOARD_SECTION_WIDTHS: Record<DashboardSectionId, DashboardSectionWidth> = {
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
};
export const WEB_SETTINGS_EVENT = "kakehashi-web-settings-change";

export const DEFAULT_WEB_SETTINGS: WebSettings = {
  textScale: 1,
  profile: { gravatarEmail: "" },
  colors: { radical: "#3c9bff", kanji: "#fa1f62", vocabulary: "#9c38d9" },
  reader: { detailsInteraction: "click", recognitionMode: "wk-jpdb" },
  subjectDetails: {
    showContextSentences: true,
    showImmersionExamples: true,
    showPitchAccent: false,
    showKanjiReadingExamples: true,
    showStrokeOrder: true,
    showPatternsOfUse: false,
  },
  integrations: { jpdbApiKey: "", myAnimeListUsername: "", aniListUsername: "" },
  study: {
    autoplayAudio: false,
    answerFeedbackSoundEnabled: true,
    showSrsIndicator: true,
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
    showAddSynonymButton: true,
    keyboardShortcuts: true,
    shuffleSubjects: false,
    lessonsBatchSize: 5,
    answerOrder: "mixed",
    dailyLessonLimit: 0,
    lessonOrder: "available",
    reviewOrder: "random",
    customReviewOrder: "random",
    reviewTypeOrderEnabled: false,
    reviewTypeOrder: [...REVIEW_TYPE_ORDER_VALUES],
    prioritizeCriticalItems: false,
    reviewBatchSizeEnabled: false,
    reviewBatchSize: 50,
    reviewWrapUpSize: 10,
    lessonQuestionOrder: "mixed",
    reviewQuestionOrderEnabled: false,
    reviewQuestionOrder: "mixed",
    backToBackQuestions: false,
    backToBackImmediateRetryIncorrect: false,
    reviewAnimatePreviousQuestion: true,
    answerStopBehavior: "always",
    showAnswerStopSubjectDetails: false,
    showListeningTranslation: true,
    vocabularyAudioVoice: "female",
    ankiMode: "off",
    ankiGroupQuestions: false,
    ankiHideAnswerCompletely: false,
    ankiShowOtherAcceptedAnswersAndUserSynonyms: false,
    ankiShowWaniKaniGrammarTags: false,
    ankiShowPitchAccentNumbers: false,
    ankiShowPitchAccentGraph: false,
    ankiButtonlessMode: false,
    ankiShowReplayAudioButton: false,
    acceptAnyKanjiOnyomiReading: false,
    voiceAnswers: false,
    jitaiEnabled: false,
    jitaiSelectedFontIds: ["gothic", "mincho", "rounded"],
    jitaiCustomFonts: [],
    immersionKitAnimeSources: [ALL_ANIME_SOURCE],
    epubDailyGoalMinutes: 5,
    songsLyricsLineTranslationsEnabled: false,
  },
  workspace: { navbarTabs: [...DEFAULT_NAVBAR_TABS], visibleNav: [...OPTIONAL_NAV_ITEMS], dashboardOrder: [...DEFAULT_DASHBOARD_SECTION_ORDER], hiddenDashboard: [...DEFAULT_HIDDEN_DASHBOARD_SECTIONS], dashboardWidths: { ...DEFAULT_DASHBOARD_SECTION_WIDTHS }, dashboardRowStarts: [] },
};

export const SUBJECT_COLOR_PRESETS = {
  light: { radical: "#3c9bff", kanji: "#fa1f62", vocabulary: "#9c38d9" },
  dark: { radical: "#357ac4", kanji: "#c93465", vocabulary: "#8047ad" },
  sepia: { radical: "#4f90cc", kanji: "#dc5f72", vocabulary: "#8f4fc5" },
  midnight: { radical: "#2b66a3", kanji: "#ad2856", vocabulary: "#673a91" },
} as const;

export function settingsStorageKey(username: string) {
  return `kakehashi-web:settings:${encodeURIComponent(username.trim().toLocaleLowerCase())}:v1`;
}

function validColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLocaleLowerCase() : fallback;
}

function validStringArray(value: unknown, maximum: number) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, maximum);
}

function validApiKey(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 512) : "";
}

function validAnimeUsername(value: unknown) {
  return typeof value === "string" && /^[\p{L}\p{N}_.-]{1,64}$/u.test(value.trim()) ? value.trim() : "";
}

function normalizeReviewOrder(value: unknown, fallback: ReviewOrderSetting): ReviewOrderSetting {
  if (value === "available") return "oldestAvailableFirst";
  if (value === "srs") return "ascendingSrsStage";
  if (value === "subject-type") return "random";
  return REVIEW_ORDER_VALUES.includes(value as ReviewOrderSetting) ? value as ReviewOrderSetting : fallback;
}

function normalizeReviewTypeOrder(value: unknown): ReviewTypeOrderSetting[] {
  const persisted = Array.isArray(value)
    ? value.filter((item): item is ReviewTypeOrderSetting => REVIEW_TYPE_ORDER_VALUES.includes(item as ReviewTypeOrderSetting))
    : [];
  const unique = [...new Set(persisted)];
  return [...unique, ...REVIEW_TYPE_ORDER_VALUES.filter((item) => !unique.includes(item))];
}

function isPreviousDefaultDashboard(workspace: Partial<WebSettings["workspace"]> | undefined) {
  if (!workspace) return false;
  const widths = workspace.dashboardWidths;
  const sameOrder = Array.isArray(workspace.dashboardOrder)
    && workspace.dashboardOrder.length === PREVIOUS_DEFAULT_DASHBOARD_SECTION_ORDER.length
    && workspace.dashboardOrder.every((id, index) => id === PREVIOUS_DEFAULT_DASHBOARD_SECTION_ORDER[index]);
  const sameHidden = Array.isArray(workspace.hiddenDashboard)
    && workspace.hiddenDashboard.length === PREVIOUS_DEFAULT_HIDDEN_DASHBOARD_SECTIONS.length
    && workspace.hiddenDashboard.every((id, index) => id === PREVIOUS_DEFAULT_HIDDEN_DASHBOARD_SECTIONS[index]);
  const sameWidths = !widths || (typeof widths === "object"
    && DASHBOARD_SECTIONS.every((id) => widths[id] === undefined || widths[id] === PREVIOUS_DEFAULT_DASHBOARD_SECTION_WIDTHS[id]));
  const sameRowStarts = !workspace.dashboardRowStarts || (Array.isArray(workspace.dashboardRowStarts) && workspace.dashboardRowStarts.length === 0);
  return sameOrder && sameHidden && sameWidths && sameRowStarts;
}

export function dashboardSectionWidth(id: DashboardSectionId, value: unknown): DashboardSectionWidth {
  const definition = DASHBOARD_SECTION_DEFINITION_BY_ID[id];
  return definition.allowedWidths.includes(value as DashboardSectionWidth) ? value as DashboardSectionWidth : definition.defaultWidth;
}

function navbarTabsFromSettings(workspace: Partial<WebSettings["workspace"]> | undefined): NavbarTabId[] {
  if (Array.isArray(workspace?.navbarTabs)) {
    const selected = new Set(workspace.navbarTabs.filter((item): item is NavbarTabId => NAVBAR_TAB_IDS.includes(item as NavbarTabId)));
    REQUIRED_NAVBAR_TAB_IDS.forEach((id) => selected.add(id));
    return NAVBAR_TAB_IDS.filter((id) => selected.has(id));
  }

  if (Array.isArray(workspace?.visibleNav)) {
    const legacyTabs = new Set<NavbarTabId>(REQUIRED_NAVBAR_TAB_IDS);
    DEFAULT_NAVBAR_TABS.forEach((id) => {
      if (workspace.visibleNav?.includes(id)) legacyTabs.add(id);
    });
    return NAVBAR_TAB_IDS.filter((id) => legacyTabs.has(id));
  }

  return [...DEFAULT_NAVBAR_TABS];
}

function validCustomFonts(value: unknown): WebJitaiFont[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const font = item as Partial<WebJitaiFont>;
    if (typeof font.id !== "string" || !/^custom-[a-z0-9-]{1,64}$/i.test(font.id)) return [];
    if (typeof font.name !== "string" || !font.name.trim() || font.name.length > 100) return [];
    if (font.dataUrl !== undefined && (typeof font.dataUrl !== "string" || !/^data:font\/(?:ttf|otf|woff2?);base64,/i.test(font.dataUrl) || font.dataUrl.length > 3_000_000)) return [];
    return [{ id: font.id, name: font.name.trim(), ...(font.dataUrl ? { dataUrl: font.dataUrl } : {}) }];
  }).slice(0, 3);
}

export function loadWebSettings(storage: Pick<ListStorage, "getItem">, username: string): WebSettings {
  try {
    const raw = storage.getItem(settingsStorageKey(username));
    if (!raw) return DEFAULT_WEB_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<WebSettings>;
    const persistedStudy = parsed.study && typeof parsed.study === "object" ? parsed.study as unknown as Record<string, unknown> : undefined;
    const legacyReviewTypeGrouping = persistedStudy?.reviewOrder === "subject-type";
    const hasSavedReviewBatchSize = Boolean(persistedStudy && Object.prototype.hasOwnProperty.call(persistedStudy, "reviewBatchSize"));
    const scale = [0.9, 1, 1.1, 1.2].includes(parsed.textScale ?? 0) ? parsed.textScale as TextScale : DEFAULT_WEB_SETTINGS.textScale;
    const legacyQuestionOrder = ["meaning-first", "reading-first", "mixed"].includes(parsed.study?.answerOrder ?? "") ? parsed.study!.answerOrder as QuestionOrder : DEFAULT_WEB_SETTINGS.study.answerOrder;
    const persistedReviewQuestionOrder = ["meaning-first", "reading-first", "mixed"].includes(parsed.study?.reviewQuestionOrder ?? "") ? parsed.study!.reviewQuestionOrder as QuestionOrder : legacyQuestionOrder;
    const legacyForcedReviewQuestionOrder = Boolean(persistedStudy
      && (Object.prototype.hasOwnProperty.call(persistedStudy, "reviewQuestionOrder") || Object.prototype.hasOwnProperty.call(persistedStudy, "answerOrder"))
      && persistedReviewQuestionOrder !== "mixed");
    const legacyAnswerStopBehavior = ["always", "incorrect", "never"].includes(parsed.study?.answerStopBehavior ?? "") ? parsed.study!.answerStopBehavior as AnswerStopBehavior : null;
    const migratePreviousDefaultDashboard = isPreviousDefaultDashboard(parsed.workspace);
    const persistedDashboardOrder = Array.isArray(parsed.workspace?.dashboardOrder)
      ? parsed.workspace.dashboardOrder.filter((item): item is DashboardSectionId => DASHBOARD_SECTIONS.includes(item as DashboardSectionId))
      : [];
    const uniqueDashboardOrder = [...new Set(persistedDashboardOrder)];
    const newlyAvailableSections = DASHBOARD_SECTIONS.filter((item) => !uniqueDashboardOrder.includes(item));
    const persistedHiddenDashboard = Array.isArray(parsed.workspace?.hiddenDashboard)
      ? parsed.workspace.hiddenDashboard.filter((item): item is DashboardSectionId => DASHBOARD_SECTIONS.includes(item as DashboardSectionId))
      : [];
    const hiddenDashboard = [...new Set([
      ...persistedHiddenDashboard,
      ...newlyAvailableSections.filter((item) => DEFAULT_HIDDEN_DASHBOARD_SECTIONS.includes(item)),
    ])];
    const dashboardRowStarts = Array.isArray(parsed.workspace?.dashboardRowStarts)
      ? [...new Set(parsed.workspace.dashboardRowStarts.filter((item): item is DashboardSectionId => DASHBOARD_SECTIONS.includes(item as DashboardSectionId) && !hiddenDashboard.includes(item as DashboardSectionId)))]
      : [];
    return {
      textScale: scale,
      profile: {
        gravatarEmail: normalizeGravatarEmail(parsed.profile?.gravatarEmail),
      },
      colors: {
        radical: validColor(parsed.colors?.radical, DEFAULT_WEB_SETTINGS.colors.radical),
        kanji: validColor(parsed.colors?.kanji, DEFAULT_WEB_SETTINGS.colors.kanji),
        vocabulary: validColor(parsed.colors?.vocabulary, DEFAULT_WEB_SETTINGS.colors.vocabulary),
      },
      reader: {
        detailsInteraction: ["click", "hover"].includes(parsed.reader?.detailsInteraction ?? "") ? parsed.reader!.detailsInteraction : DEFAULT_WEB_SETTINGS.reader.detailsInteraction,
        recognitionMode: ["wk", "wk-jpdb"].includes(parsed.reader?.recognitionMode ?? "") ? parsed.reader!.recognitionMode : DEFAULT_WEB_SETTINGS.reader.recognitionMode,
      },
      subjectDetails: {
        showContextSentences: typeof parsed.subjectDetails?.showContextSentences === "boolean" ? parsed.subjectDetails.showContextSentences : DEFAULT_WEB_SETTINGS.subjectDetails.showContextSentences,
        showImmersionExamples: typeof parsed.subjectDetails?.showImmersionExamples === "boolean" ? parsed.subjectDetails.showImmersionExamples : DEFAULT_WEB_SETTINGS.subjectDetails.showImmersionExamples,
        showPitchAccent: typeof parsed.subjectDetails?.showPitchAccent === "boolean" ? parsed.subjectDetails.showPitchAccent : DEFAULT_WEB_SETTINGS.subjectDetails.showPitchAccent,
        showKanjiReadingExamples: typeof parsed.subjectDetails?.showKanjiReadingExamples === "boolean" ? parsed.subjectDetails.showKanjiReadingExamples : DEFAULT_WEB_SETTINGS.subjectDetails.showKanjiReadingExamples,
        showStrokeOrder: typeof parsed.subjectDetails?.showStrokeOrder === "boolean" ? parsed.subjectDetails.showStrokeOrder : DEFAULT_WEB_SETTINGS.subjectDetails.showStrokeOrder,
        showPatternsOfUse: typeof parsed.subjectDetails?.showPatternsOfUse === "boolean" ? parsed.subjectDetails.showPatternsOfUse : DEFAULT_WEB_SETTINGS.subjectDetails.showPatternsOfUse,
      },
      integrations: {
        jpdbApiKey: validApiKey(parsed.integrations?.jpdbApiKey),
        myAnimeListUsername: validAnimeUsername(parsed.integrations?.myAnimeListUsername),
        aniListUsername: validAnimeUsername(parsed.integrations?.aniListUsername),
      },
      study: {
        autoplayAudio: typeof parsed.study?.autoplayAudio === "boolean" ? parsed.study.autoplayAudio : DEFAULT_WEB_SETTINGS.study.autoplayAudio,
        answerFeedbackSoundEnabled: typeof parsed.study?.answerFeedbackSoundEnabled === "boolean" ? parsed.study.answerFeedbackSoundEnabled : DEFAULT_WEB_SETTINGS.study.answerFeedbackSoundEnabled,
        showSrsIndicator: typeof parsed.study?.showSrsIndicator === "boolean" ? parsed.study.showSrsIndicator : DEFAULT_WEB_SETTINGS.study.showSrsIndicator,
        showReviewItemLevelAndSrsStage: typeof parsed.study?.showReviewItemLevelAndSrsStage === "boolean" ? parsed.study.showReviewItemLevelAndSrsStage : typeof parsed.study?.showSrsIndicator === "boolean" ? parsed.study.showSrsIndicator : DEFAULT_WEB_SETTINGS.study.showReviewItemLevelAndSrsStage,
        showVocabularyFrequency: typeof parsed.study?.showVocabularyFrequency === "boolean" ? parsed.study.showVocabularyFrequency : DEFAULT_WEB_SETTINGS.study.showVocabularyFrequency,
        showVocabContextSentencesInReviews: typeof parsed.study?.showVocabContextSentencesInReviews === "boolean" ? parsed.study.showVocabContextSentencesInReviews : DEFAULT_WEB_SETTINGS.study.showVocabContextSentencesInReviews,
        allowSkippingReviews: typeof parsed.study?.allowSkippingReviews === "boolean" ? parsed.study.allowSkippingReviews : DEFAULT_WEB_SETTINGS.study.allowSkippingReviews,
        reviewSearchButtonEnabled: typeof parsed.study?.reviewSearchButtonEnabled === "boolean" ? parsed.study.reviewSearchButtonEnabled : DEFAULT_WEB_SETTINGS.study.reviewSearchButtonEnabled,
        reviewCharacterFontScale: [0.7, 0.8, 0.9, 1, 1.1, 1.2].includes(parsed.study?.reviewCharacterFontScale ?? 0) ? parsed.study!.reviewCharacterFontScale : DEFAULT_WEB_SETTINGS.study.reviewCharacterFontScale,
        reviewInputFontScale: [0.7, 0.8, 0.9, 1, 1.1, 1.2].includes(parsed.study?.reviewInputFontScale ?? 0) ? parsed.study!.reviewInputFontScale : DEFAULT_WEB_SETTINGS.study.reviewInputFontScale,
        pauseOnWrong: typeof parsed.study?.pauseOnWrong === "boolean" ? parsed.study.pauseOnWrong : legacyAnswerStopBehavior ? legacyAnswerStopBehavior !== "never" : DEFAULT_WEB_SETTINGS.study.pauseOnWrong,
        pauseOnClose: typeof parsed.study?.pauseOnClose === "boolean" ? parsed.study.pauseOnClose : DEFAULT_WEB_SETTINGS.study.pauseOnClose,
        pauseOnCorrect: typeof parsed.study?.pauseOnCorrect === "boolean" ? parsed.study.pauseOnCorrect : legacyAnswerStopBehavior ? legacyAnswerStopBehavior === "always" : DEFAULT_WEB_SETTINGS.study.pauseOnCorrect,
        srsProgressionCardDisplayMode: ["normal", "compact", "hidden"].includes(parsed.study?.srsProgressionCardDisplayMode ?? "") ? parsed.study!.srsProgressionCardDisplayMode : DEFAULT_WEB_SETTINGS.study.srsProgressionCardDisplayMode,
        acceptUserSynonymsAsAnswers: typeof parsed.study?.acceptUserSynonymsAsAnswers === "boolean" ? parsed.study.acceptUserSynonymsAsAnswers : DEFAULT_WEB_SETTINGS.study.acceptUserSynonymsAsAnswers,
        showAddSynonymButton: typeof parsed.study?.showAddSynonymButton === "boolean" ? parsed.study.showAddSynonymButton : DEFAULT_WEB_SETTINGS.study.showAddSynonymButton,
        keyboardShortcuts: typeof parsed.study?.keyboardShortcuts === "boolean" ? parsed.study.keyboardShortcuts : DEFAULT_WEB_SETTINGS.study.keyboardShortcuts,
        shuffleSubjects: typeof parsed.study?.shuffleSubjects === "boolean" ? parsed.study.shuffleSubjects : DEFAULT_WEB_SETTINGS.study.shuffleSubjects,
        lessonsBatchSize: [3, 5, 10, 15, 20].includes(parsed.study?.lessonsBatchSize ?? 0) ? parsed.study!.lessonsBatchSize : DEFAULT_WEB_SETTINGS.study.lessonsBatchSize,
        answerOrder: ["meaning-first", "reading-first", "mixed"].includes(parsed.study?.answerOrder ?? "") ? parsed.study!.answerOrder : DEFAULT_WEB_SETTINGS.study.answerOrder,
        dailyLessonLimit: [0, 5, 10, 15, 20, 30].includes(parsed.study?.dailyLessonLimit ?? -1) ? parsed.study!.dailyLessonLimit : DEFAULT_WEB_SETTINGS.study.dailyLessonLimit,
        lessonOrder: ["available", "subject-type", "level"].includes(parsed.study?.lessonOrder ?? "") ? parsed.study!.lessonOrder : DEFAULT_WEB_SETTINGS.study.lessonOrder,
        reviewOrder: normalizeReviewOrder(persistedStudy?.reviewOrder, DEFAULT_WEB_SETTINGS.study.reviewOrder),
        customReviewOrder: normalizeReviewOrder(persistedStudy?.customReviewOrder, DEFAULT_WEB_SETTINGS.study.customReviewOrder),
        reviewTypeOrderEnabled: legacyReviewTypeGrouping || (typeof parsed.study?.reviewTypeOrderEnabled === "boolean" ? parsed.study.reviewTypeOrderEnabled : DEFAULT_WEB_SETTINGS.study.reviewTypeOrderEnabled),
        reviewTypeOrder: normalizeReviewTypeOrder(persistedStudy?.reviewTypeOrder),
        prioritizeCriticalItems: typeof parsed.study?.prioritizeCriticalItems === "boolean" ? parsed.study.prioritizeCriticalItems : DEFAULT_WEB_SETTINGS.study.prioritizeCriticalItems,
        reviewBatchSizeEnabled: typeof parsed.study?.reviewBatchSizeEnabled === "boolean" ? parsed.study.reviewBatchSizeEnabled : hasSavedReviewBatchSize,
        reviewBatchSize: REVIEW_BATCH_SIZE_VALUES.includes(parsed.study?.reviewBatchSize ?? 0) ? parsed.study!.reviewBatchSize : DEFAULT_WEB_SETTINGS.study.reviewBatchSize,
        reviewWrapUpSize: [5, 10, 15, 20].includes(parsed.study?.reviewWrapUpSize ?? 0) ? parsed.study!.reviewWrapUpSize : DEFAULT_WEB_SETTINGS.study.reviewWrapUpSize,
        lessonQuestionOrder: ["meaning-first", "reading-first", "mixed"].includes(parsed.study?.lessonQuestionOrder ?? "") ? parsed.study!.lessonQuestionOrder : legacyQuestionOrder,
        reviewQuestionOrderEnabled: typeof parsed.study?.reviewQuestionOrderEnabled === "boolean" ? parsed.study.reviewQuestionOrderEnabled : legacyForcedReviewQuestionOrder,
        reviewQuestionOrder: persistedReviewQuestionOrder,
        backToBackQuestions: typeof parsed.study?.backToBackQuestions === "boolean" ? parsed.study.backToBackQuestions : DEFAULT_WEB_SETTINGS.study.backToBackQuestions,
        backToBackImmediateRetryIncorrect: typeof parsed.study?.backToBackImmediateRetryIncorrect === "boolean" ? parsed.study.backToBackImmediateRetryIncorrect : DEFAULT_WEB_SETTINGS.study.backToBackImmediateRetryIncorrect,
        reviewAnimatePreviousQuestion: typeof parsed.study?.reviewAnimatePreviousQuestion === "boolean" ? parsed.study.reviewAnimatePreviousQuestion : DEFAULT_WEB_SETTINGS.study.reviewAnimatePreviousQuestion,
        answerStopBehavior: legacyAnswerStopBehavior ?? DEFAULT_WEB_SETTINGS.study.answerStopBehavior,
        showAnswerStopSubjectDetails: typeof parsed.study?.showAnswerStopSubjectDetails === "boolean" ? parsed.study.showAnswerStopSubjectDetails : DEFAULT_WEB_SETTINGS.study.showAnswerStopSubjectDetails,
        showListeningTranslation: typeof parsed.study?.showListeningTranslation === "boolean" ? parsed.study.showListeningTranslation : DEFAULT_WEB_SETTINGS.study.showListeningTranslation,
        vocabularyAudioVoice: ["female", "male", "random", "both"].includes(parsed.study?.vocabularyAudioVoice ?? "") ? parsed.study!.vocabularyAudioVoice : DEFAULT_WEB_SETTINGS.study.vocabularyAudioVoice,
        ankiMode: ["off", "both", "meaning", "reading"].includes(parsed.study?.ankiMode ?? "") ? parsed.study!.ankiMode : DEFAULT_WEB_SETTINGS.study.ankiMode,
        ankiGroupQuestions: typeof parsed.study?.ankiGroupQuestions === "boolean" ? parsed.study.ankiGroupQuestions : DEFAULT_WEB_SETTINGS.study.ankiGroupQuestions,
        ankiHideAnswerCompletely: typeof parsed.study?.ankiHideAnswerCompletely === "boolean" ? parsed.study.ankiHideAnswerCompletely : DEFAULT_WEB_SETTINGS.study.ankiHideAnswerCompletely,
        ankiShowOtherAcceptedAnswersAndUserSynonyms: typeof parsed.study?.ankiShowOtherAcceptedAnswersAndUserSynonyms === "boolean" ? parsed.study.ankiShowOtherAcceptedAnswersAndUserSynonyms : DEFAULT_WEB_SETTINGS.study.ankiShowOtherAcceptedAnswersAndUserSynonyms,
        ankiShowWaniKaniGrammarTags: typeof parsed.study?.ankiShowWaniKaniGrammarTags === "boolean" ? parsed.study.ankiShowWaniKaniGrammarTags : DEFAULT_WEB_SETTINGS.study.ankiShowWaniKaniGrammarTags,
        ankiShowPitchAccentNumbers: typeof parsed.study?.ankiShowPitchAccentNumbers === "boolean" ? parsed.study.ankiShowPitchAccentNumbers : DEFAULT_WEB_SETTINGS.study.ankiShowPitchAccentNumbers,
        ankiShowPitchAccentGraph: typeof parsed.study?.ankiShowPitchAccentGraph === "boolean" ? parsed.study.ankiShowPitchAccentGraph : DEFAULT_WEB_SETTINGS.study.ankiShowPitchAccentGraph,
        ankiButtonlessMode: typeof parsed.study?.ankiButtonlessMode === "boolean" ? parsed.study.ankiButtonlessMode : DEFAULT_WEB_SETTINGS.study.ankiButtonlessMode,
        ankiShowReplayAudioButton: typeof parsed.study?.ankiShowReplayAudioButton === "boolean" ? parsed.study.ankiShowReplayAudioButton : DEFAULT_WEB_SETTINGS.study.ankiShowReplayAudioButton,
        acceptAnyKanjiOnyomiReading: typeof parsed.study?.acceptAnyKanjiOnyomiReading === "boolean" ? parsed.study.acceptAnyKanjiOnyomiReading : DEFAULT_WEB_SETTINGS.study.acceptAnyKanjiOnyomiReading,
        voiceAnswers: typeof parsed.study?.voiceAnswers === "boolean" ? parsed.study.voiceAnswers : DEFAULT_WEB_SETTINGS.study.voiceAnswers,
        jitaiEnabled: typeof parsed.study?.jitaiEnabled === "boolean" ? parsed.study.jitaiEnabled : DEFAULT_WEB_SETTINGS.study.jitaiEnabled,
        jitaiSelectedFontIds: validStringArray(parsed.study?.jitaiSelectedFontIds, 16).length ? validStringArray(parsed.study?.jitaiSelectedFontIds, 16) : [...DEFAULT_WEB_SETTINGS.study.jitaiSelectedFontIds],
        jitaiCustomFonts: validCustomFonts(parsed.study?.jitaiCustomFonts),
        immersionKitAnimeSources: validStringArray(parsed.study?.immersionKitAnimeSources, 100).length ? validStringArray(parsed.study?.immersionKitAnimeSources, 100) : [ALL_ANIME_SOURCE],
        epubDailyGoalMinutes: [5, 10, 15, 20, 30, 45, 60].includes(parsed.study?.epubDailyGoalMinutes ?? 0) ? parsed.study!.epubDailyGoalMinutes : DEFAULT_WEB_SETTINGS.study.epubDailyGoalMinutes,
        songsLyricsLineTranslationsEnabled: typeof parsed.study?.songsLyricsLineTranslationsEnabled === "boolean" ? parsed.study.songsLyricsLineTranslationsEnabled : DEFAULT_WEB_SETTINGS.study.songsLyricsLineTranslationsEnabled,
      },
      workspace: {
        navbarTabs: navbarTabsFromSettings(parsed.workspace),
        visibleNav: Array.isArray(parsed.workspace?.visibleNav) ? OPTIONAL_NAV_ITEMS.filter((item) => parsed.workspace!.visibleNav.includes(item)) : [...DEFAULT_WEB_SETTINGS.workspace.visibleNav],
        dashboardOrder: migratePreviousDefaultDashboard ? [...DEFAULT_DASHBOARD_SECTION_ORDER] : uniqueDashboardOrder.length ? [...uniqueDashboardOrder, ...newlyAvailableSections] : [...DEFAULT_WEB_SETTINGS.workspace.dashboardOrder],
        hiddenDashboard: migratePreviousDefaultDashboard ? [...DEFAULT_HIDDEN_DASHBOARD_SECTIONS] : uniqueDashboardOrder.length ? hiddenDashboard : [...DEFAULT_WEB_SETTINGS.workspace.hiddenDashboard],
        dashboardWidths: migratePreviousDefaultDashboard
          ? { ...DEFAULT_DASHBOARD_SECTION_WIDTHS }
          : Object.fromEntries(DASHBOARD_SECTIONS.map((id) => [id, dashboardSectionWidth(id, parsed.workspace?.dashboardWidths?.[id])])) as Record<DashboardSectionId, DashboardSectionWidth>,
        dashboardRowStarts: migratePreviousDefaultDashboard ? [] : dashboardRowStarts,
      },
    };
  } catch {
    return DEFAULT_WEB_SETTINGS;
  }
}

export function reorderDashboardSections(order: string[], source: string, target: string) {
  if (source === target) return order;
  const sourceIndex = order.indexOf(source);
  if (sourceIndex < 0 || !order.includes(target)) return order;
  const next = [...order];
  const [moved] = next.splice(sourceIndex, 1);
  const targetIndex = next.indexOf(target);
  next.splice(targetIndex, 0, moved);
  return next;
}

export function saveWebSettings(storage: Pick<ListStorage, "setItem">, username: string, settings: WebSettings) {
  const serializable = {
    ...settings,
    study: {
      ...settings.study,
      jitaiCustomFonts: settings.study.jitaiCustomFonts.map(({ id, name }) => ({ id, name })),
    },
  };
  storage.setItem(settingsStorageKey(username), JSON.stringify(serializable));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(WEB_SETTINGS_EVENT, { detail: { username } }));
}

export function applyWebSettings(settings: WebSettings, root: HTMLElement = document.documentElement) {
  root.style.fontSize = `${settings.textScale * 100}%`;
  root.style.setProperty("--color-radical", settings.colors.radical);
  root.style.setProperty("--color-kanji", settings.colors.kanji);
  root.style.setProperty("--color-vocabulary", settings.colors.vocabulary);
}
