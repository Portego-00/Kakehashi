import { ALL_ANIME_SOURCE } from "@/features/anime/types";
import type { ListStorage } from "@/features/subjects/lists";
import { normalizeGravatarEmail } from "@/lib/gravatar";

export type TextScale = 0.9 | 1 | 1.1 | 1.2;
export type QuestionOrder = "meaning-first" | "reading-first" | "mixed";
export type AnkiMode = "off" | "both" | "meaning" | "reading";
export type AnswerStopBehavior = "always" | "incorrect" | "never";
export interface WebJitaiFont {
  id: string;
  name: string;
  dataUrl?: string;
}
export interface WebStudyPreferences {
  autoplayAudio: boolean;
  showSrsIndicator: boolean;
  keyboardShortcuts: boolean;
  shuffleSubjects: boolean;
  lessonsBatchSize: number;
  answerOrder: QuestionOrder;
  dailyLessonLimit: number;
  lessonOrder: "available" | "subject-type" | "level";
  reviewOrder: "random" | "available" | "srs" | "subject-type";
  reviewBatchSize: number;
  reviewWrapUpSize: number;
  lessonQuestionOrder: QuestionOrder;
  reviewQuestionOrder: QuestionOrder;
  answerStopBehavior: AnswerStopBehavior;
  showAnswerStopSubjectDetails: boolean;
  ankiMode: AnkiMode;
  voiceAnswers: boolean;
  jitaiEnabled: boolean;
  jitaiSelectedFontIds: string[];
  jitaiCustomFonts: WebJitaiFont[];
  immersionKitAnimeSources: string[];
  epubDailyGoalMinutes: number;
}
export interface WebSettings {
  textScale: TextScale;
  profile: { gravatarEmail: string };
  colors: { radical: string; kanji: string; vocabulary: string };
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
    visibleNav: string[];
    dashboardOrder: string[];
    hiddenDashboard: string[];
    dashboardWidths: Record<DashboardSectionId, DashboardSectionWidth>;
    dashboardRowStarts: DashboardSectionId[];
  };
}

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
  { id: "level", label: "Level Progress", description: "Current-level Guru target, timing, radicals, and kanji.", source: "Level", defaultWidth: 8, allowedWidths: [6, 8, 12] },
  { id: "extra-study", label: "Extra Study", description: "Practice modes that do not affect SRS.", source: "Home", defaultWidth: 12, allowedWidths: [8, 12] },
  { id: "forecast", label: "Review Forecast", description: "Upcoming review load by hour.", source: "Home", defaultWidth: 8, allowedWidths: [6, 8, 12] },
  { id: "study-pulse", label: "Review Stats", description: "Accuracy and reviewed-subject totals.", source: "Analytics", defaultWidth: 4, allowedWidths: [4, 6] },
  { id: "recent-mistakes", label: "Recent Mistakes", description: "Recently updated subjects with broken answer streaks.", source: "Home", defaultWidth: 6, allowedWidths: [6, 8, 12] },
  { id: "study-streak", label: "App Streak", description: "Current streak, recent rhythm, and best run in 14 weeks.", source: "Home", defaultWidth: 4, allowedWidths: [4, 6] },
  { id: "subject-lists", label: "Subject Lists", description: "Saved collections and their subject counts.", source: "Home", defaultWidth: 4, allowedWidths: [4, 6] },
  { id: "incomplete-levels", label: "Incomplete Levels", description: "Previous levels that still have items below Guru.", source: "Level", defaultWidth: 6, allowedWidths: [4, 6, 8] },
  { id: "recent-unlocks", label: "Recent Unlocks", description: "The latest subjects added to your study path.", source: "Items", defaultWidth: 6, allowedWidths: [6, 8, 12] },
  { id: "critical-items", label: "Critical Items", description: "Subjects with the lowest answer accuracy.", source: "Items", defaultWidth: 6, allowedWidths: [6, 8, 12] },
  { id: "burned-items", label: "Burned Items", description: "Subjects burned during the last 30 days.", source: "Items", defaultWidth: 6, allowedWidths: [6, 8, 12] },
  { id: "review-heatmap", label: "Review Heatmap", description: "Recent assignment activity by day.", source: "Analytics", defaultWidth: 12, allowedWidths: [8, 12] },
  { id: "level-timing", label: "Level Timing", description: "Completion time across recent levels.", source: "Analytics", defaultWidth: 8, allowedWidths: [8, 12] },
  { id: "today-study", label: "Today’s Study", description: "Lessons and reviewed subjects recorded today.", source: "Analytics", defaultWidth: 4, allowedWidths: [4, 6] },
  { id: "study-time", label: "Study Time", description: "Foreground study time tracked in this browser.", source: "Analytics", defaultWidth: 4, allowedWidths: [4, 6] },
];
export const DASHBOARD_SECTION_DEFINITION_BY_ID = Object.fromEntries(DASHBOARD_SECTION_DEFINITIONS.map((definition) => [definition.id, definition])) as Record<DashboardSectionId, DashboardSectionDefinition>;
export const DEFAULT_DASHBOARD_SECTION_WIDTHS = Object.fromEntries(DASHBOARD_SECTION_DEFINITIONS.map((definition) => [definition.id, definition.defaultWidth])) as Record<DashboardSectionId, DashboardSectionWidth>;
export const DEFAULT_VISIBLE_DASHBOARD_SECTIONS: DashboardSectionId[] = ["daily-study", "srs", "level", "extra-study", "forecast", "study-pulse"];
export const DEFAULT_HIDDEN_DASHBOARD_SECTIONS: DashboardSectionId[] = DASHBOARD_SECTIONS.filter((id) => !DEFAULT_VISIBLE_DASHBOARD_SECTIONS.includes(id));
export const WEB_SETTINGS_EVENT = "kakehashi-web-settings-change";

export const DEFAULT_WEB_SETTINGS: WebSettings = {
  textScale: 1,
  profile: { gravatarEmail: "" },
  colors: { radical: "#3c9bff", kanji: "#fa1f62", vocabulary: "#9c38d9" },
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
    autoplayAudio: true,
    showSrsIndicator: true,
    keyboardShortcuts: true,
    shuffleSubjects: false,
    lessonsBatchSize: 5,
    answerOrder: "mixed",
    dailyLessonLimit: 0,
    lessonOrder: "available",
    reviewOrder: "random",
    reviewBatchSize: 50,
    reviewWrapUpSize: 10,
    lessonQuestionOrder: "mixed",
    reviewQuestionOrder: "mixed",
    answerStopBehavior: "always",
    showAnswerStopSubjectDetails: false,
    ankiMode: "off",
    voiceAnswers: false,
    jitaiEnabled: false,
    jitaiSelectedFontIds: ["gothic", "mincho", "rounded"],
    jitaiCustomFonts: [],
    immersionKitAnimeSources: [ALL_ANIME_SOURCE],
    epubDailyGoalMinutes: 5,
  },
  workspace: { visibleNav: [...OPTIONAL_NAV_ITEMS], dashboardOrder: [...DASHBOARD_SECTIONS], hiddenDashboard: [...DEFAULT_HIDDEN_DASHBOARD_SECTIONS], dashboardWidths: { ...DEFAULT_DASHBOARD_SECTION_WIDTHS }, dashboardRowStarts: [] },
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

export function dashboardSectionWidth(id: DashboardSectionId, value: unknown): DashboardSectionWidth {
  const definition = DASHBOARD_SECTION_DEFINITION_BY_ID[id];
  return definition.allowedWidths.includes(value as DashboardSectionWidth) ? value as DashboardSectionWidth : definition.defaultWidth;
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
    const scale = [0.9, 1, 1.1, 1.2].includes(parsed.textScale ?? 0) ? parsed.textScale as TextScale : DEFAULT_WEB_SETTINGS.textScale;
    const legacyQuestionOrder = ["meaning-first", "reading-first", "mixed"].includes(parsed.study?.answerOrder ?? "") ? parsed.study!.answerOrder as QuestionOrder : DEFAULT_WEB_SETTINGS.study.answerOrder;
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
        showSrsIndicator: typeof parsed.study?.showSrsIndicator === "boolean" ? parsed.study.showSrsIndicator : DEFAULT_WEB_SETTINGS.study.showSrsIndicator,
        keyboardShortcuts: typeof parsed.study?.keyboardShortcuts === "boolean" ? parsed.study.keyboardShortcuts : DEFAULT_WEB_SETTINGS.study.keyboardShortcuts,
        shuffleSubjects: typeof parsed.study?.shuffleSubjects === "boolean" ? parsed.study.shuffleSubjects : DEFAULT_WEB_SETTINGS.study.shuffleSubjects,
        lessonsBatchSize: [3, 5, 10, 15, 20].includes(parsed.study?.lessonsBatchSize ?? 0) ? parsed.study!.lessonsBatchSize : DEFAULT_WEB_SETTINGS.study.lessonsBatchSize,
        answerOrder: ["meaning-first", "reading-first", "mixed"].includes(parsed.study?.answerOrder ?? "") ? parsed.study!.answerOrder : DEFAULT_WEB_SETTINGS.study.answerOrder,
        dailyLessonLimit: [0, 5, 10, 15, 20, 30].includes(parsed.study?.dailyLessonLimit ?? -1) ? parsed.study!.dailyLessonLimit : DEFAULT_WEB_SETTINGS.study.dailyLessonLimit,
        lessonOrder: ["available", "subject-type", "level"].includes(parsed.study?.lessonOrder ?? "") ? parsed.study!.lessonOrder : DEFAULT_WEB_SETTINGS.study.lessonOrder,
        reviewOrder: ["random", "available", "srs", "subject-type"].includes(parsed.study?.reviewOrder ?? "") ? parsed.study!.reviewOrder : DEFAULT_WEB_SETTINGS.study.reviewOrder,
        reviewBatchSize: [10, 25, 50].includes(parsed.study?.reviewBatchSize ?? 0) ? parsed.study!.reviewBatchSize : DEFAULT_WEB_SETTINGS.study.reviewBatchSize,
        reviewWrapUpSize: [5, 10, 15].includes(parsed.study?.reviewWrapUpSize ?? 0) ? parsed.study!.reviewWrapUpSize : DEFAULT_WEB_SETTINGS.study.reviewWrapUpSize,
        lessonQuestionOrder: ["meaning-first", "reading-first", "mixed"].includes(parsed.study?.lessonQuestionOrder ?? "") ? parsed.study!.lessonQuestionOrder : legacyQuestionOrder,
        reviewQuestionOrder: ["meaning-first", "reading-first", "mixed"].includes(parsed.study?.reviewQuestionOrder ?? "") ? parsed.study!.reviewQuestionOrder : legacyQuestionOrder,
        answerStopBehavior: ["always", "incorrect", "never"].includes(parsed.study?.answerStopBehavior ?? "") ? parsed.study!.answerStopBehavior : DEFAULT_WEB_SETTINGS.study.answerStopBehavior,
        showAnswerStopSubjectDetails: typeof parsed.study?.showAnswerStopSubjectDetails === "boolean" ? parsed.study.showAnswerStopSubjectDetails : DEFAULT_WEB_SETTINGS.study.showAnswerStopSubjectDetails,
        ankiMode: ["off", "both", "meaning", "reading"].includes(parsed.study?.ankiMode ?? "") ? parsed.study!.ankiMode : DEFAULT_WEB_SETTINGS.study.ankiMode,
        voiceAnswers: typeof parsed.study?.voiceAnswers === "boolean" ? parsed.study.voiceAnswers : DEFAULT_WEB_SETTINGS.study.voiceAnswers,
        jitaiEnabled: typeof parsed.study?.jitaiEnabled === "boolean" ? parsed.study.jitaiEnabled : DEFAULT_WEB_SETTINGS.study.jitaiEnabled,
        jitaiSelectedFontIds: validStringArray(parsed.study?.jitaiSelectedFontIds, 16).length ? validStringArray(parsed.study?.jitaiSelectedFontIds, 16) : [...DEFAULT_WEB_SETTINGS.study.jitaiSelectedFontIds],
        jitaiCustomFonts: validCustomFonts(parsed.study?.jitaiCustomFonts),
        immersionKitAnimeSources: validStringArray(parsed.study?.immersionKitAnimeSources, 100).length ? validStringArray(parsed.study?.immersionKitAnimeSources, 100) : [ALL_ANIME_SOURCE],
        epubDailyGoalMinutes: [5, 10, 15, 20, 30, 45, 60].includes(parsed.study?.epubDailyGoalMinutes ?? 0) ? parsed.study!.epubDailyGoalMinutes : DEFAULT_WEB_SETTINGS.study.epubDailyGoalMinutes,
      },
      workspace: {
        visibleNav: Array.isArray(parsed.workspace?.visibleNav) ? OPTIONAL_NAV_ITEMS.filter((item) => parsed.workspace!.visibleNav.includes(item)) : [...DEFAULT_WEB_SETTINGS.workspace.visibleNav],
        dashboardOrder: uniqueDashboardOrder.length ? [...uniqueDashboardOrder, ...newlyAvailableSections] : [...DEFAULT_WEB_SETTINGS.workspace.dashboardOrder],
        hiddenDashboard: uniqueDashboardOrder.length ? hiddenDashboard : [...DEFAULT_WEB_SETTINGS.workspace.hiddenDashboard],
        dashboardWidths: Object.fromEntries(DASHBOARD_SECTIONS.map((id) => [id, dashboardSectionWidth(id, parsed.workspace?.dashboardWidths?.[id])])) as Record<DashboardSectionId, DashboardSectionWidth>,
        dashboardRowStarts,
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
