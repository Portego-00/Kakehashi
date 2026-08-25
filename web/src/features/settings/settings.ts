import type { ListStorage } from "@/features/subjects/lists";

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
  colors: { radical: string; kanji: string; vocabulary: string };
  integrations: { jpdbApiKey: string };
  study: WebStudyPreferences;
  workspace: {
    visibleNav: string[];
    dashboardOrder: string[];
    hiddenDashboard: string[];
  };
}

export const OPTIONAL_NAV_ITEMS = ["analytics", "items", "search", "lists", "news", "reader", "epubs", "music", "video", "manga", "translator", "community"] as const;
export const DASHBOARD_SECTIONS = ["daily-study", "srs", "level", "extra-study", "forecast", "study-pulse", "keep-moving"] as const;
export const WEB_SETTINGS_EVENT = "kakehashi-web-settings-change";

export const DEFAULT_WEB_SETTINGS: WebSettings = {
  textScale: 1,
  colors: { radical: "#3c9bff", kanji: "#fa1f62", vocabulary: "#9c38d9" },
  integrations: { jpdbApiKey: "" },
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
    immersionKitAnimeSources: [],
    epubDailyGoalMinutes: 5,
  },
  workspace: { visibleNav: [...OPTIONAL_NAV_ITEMS], dashboardOrder: [...DASHBOARD_SECTIONS], hiddenDashboard: [] },
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
    return {
      textScale: scale,
      colors: {
        radical: validColor(parsed.colors?.radical, DEFAULT_WEB_SETTINGS.colors.radical),
        kanji: validColor(parsed.colors?.kanji, DEFAULT_WEB_SETTINGS.colors.kanji),
        vocabulary: validColor(parsed.colors?.vocabulary, DEFAULT_WEB_SETTINGS.colors.vocabulary),
      },
      integrations: { jpdbApiKey: validApiKey(parsed.integrations?.jpdbApiKey) },
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
        immersionKitAnimeSources: validStringArray(parsed.study?.immersionKitAnimeSources, 20),
        epubDailyGoalMinutes: [5, 10, 15, 20, 30, 45, 60].includes(parsed.study?.epubDailyGoalMinutes ?? 0) ? parsed.study!.epubDailyGoalMinutes : DEFAULT_WEB_SETTINGS.study.epubDailyGoalMinutes,
      },
      workspace: {
        visibleNav: Array.isArray(parsed.workspace?.visibleNav) ? OPTIONAL_NAV_ITEMS.filter((item) => parsed.workspace!.visibleNav.includes(item)) : [...DEFAULT_WEB_SETTINGS.workspace.visibleNav],
        dashboardOrder: Array.isArray(parsed.workspace?.dashboardOrder) ? [...parsed.workspace!.dashboardOrder.filter((item) => DASHBOARD_SECTIONS.includes(item as typeof DASHBOARD_SECTIONS[number])), ...DASHBOARD_SECTIONS.filter((item) => !parsed.workspace!.dashboardOrder.includes(item))] : [...DEFAULT_WEB_SETTINGS.workspace.dashboardOrder],
        hiddenDashboard: Array.isArray(parsed.workspace?.hiddenDashboard) ? parsed.workspace!.hiddenDashboard.filter((item) => DASHBOARD_SECTIONS.includes(item as typeof DASHBOARD_SECTIONS[number])) : [],
      },
    };
  } catch {
    return DEFAULT_WEB_SETTINGS;
  }
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
