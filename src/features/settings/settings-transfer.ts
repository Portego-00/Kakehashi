import { DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS } from "../../utils/analyticsWidgetStyles";
import {
  APP_TEXT_SIZE_SCALE_MAX,
  APP_TEXT_SIZE_SCALE_MIN,
  normalizeAppTextSizeScale,
} from "../../utils/appTextSize";
import { normalizeStudyShortcuts } from "../../utils/bunpro-study-shortcuts";
import { normalizeHomeExtraStudyHiddenModeIds } from "../../utils/extraStudyModes";
import { normalizeHomeWidgetOrder } from "../../utils/homeWidgets";
import { normalizeLearningPages } from "../../utils/learningPages";
import {
  LESSON_ORDER_OPTIONS,
  LESSON_TYPE_ORDER_VALUES,
} from "../../utils/lessonOrdering";
import { LESSON_SRS_THRESHOLD_MAX } from "../../utils/lessonSrsThreshold";
import { isRecentLessonsWindow } from "../../utils/recentLessonsWindow";
import { normalizeReviewPresets } from "../../utils/review-presets";
import {
  DEFAULT_REVIEW_CORRECT_KEYBOARD_SHORTCUTS,
  DEFAULT_REVIEW_INCORRECT_KEYBOARD_SHORTCUTS,
  sanitizeReviewShortcutInput,
} from "../../utils/reviewKeyboardShortcuts";
import {
  REVIEW_ORDER_OPTIONS,
  REVIEW_TYPE_ORDER_VALUES,
} from "../../utils/reviewOrdering";
import {
  REVIEW_CHARACTER_FONT_SCALE_MAX,
  REVIEW_CHARACTER_FONT_SCALE_MIN,
  REVIEW_INPUT_FONT_SCALE_MAX,
  REVIEW_INPUT_FONT_SCALE_MIN,
  REVIEW_PAUSED_UI_SCALE_MAX,
  REVIEW_PAUSED_UI_SCALE_MIN,
  normalizeCustomTabOrder,
  normalizeReviewPausedUiScale,
  useSettingsStore,
} from "../../utils/store";
import type { ThemeMode } from "../../utils/theme";
import { DEFAULT_WIDGET_CARD_STYLE_COLORS } from "../../utils/widgetCardStyles";

const FORMAT = "kakehashi-settings";
const VERSION = 1;
export const MAX_SETTINGS_FILE_BYTES = 1024 * 1024;

type Settings = ReturnType<typeof useSettingsStore.getState>;
type BooleanSetting = {
  [Key in keyof Settings]: Settings[Key] extends boolean ? Key : never;
}[keyof Settings];
type Decoder<T> = (value: unknown) => T | undefined;

// Account details and switches that request OS permissions or start downloads
// stay on the device. Only the preferences declared here can be transferred.
const booleanSettings = [
  "singlePageLessonView",
  "lessonSearchButtonEnabled",
  "showLessonVocabularyUnlockCounts",
  "skipCustomLessonQuiz",
  "excludeKanaVocabularyFromLessons",
  "reviewBatchSizeEnabled",
  "reviewPresetsEnabled",
  "reviewSearchButtonEnabled",
  "hideReviewWrapUpButton",
  "allowMarkingCorrectAnswersWrong",
  "reviewLeftHandedMode",
  "bunproHideFurigana",
  "showDetailsOnWrongAnswer",
  "answerFeedbackSoundEnabled",
  "reviewKeyboardShortcutsEnabled",
  "backToBackImmediateRetryIncorrect",
  "allowSkippingReviews",
  "meaningFirst",
  "reviewQuestionOrderEnabled",
  "skipKanjiReadings",
  "minimizeReviewPenalty",
  "reviewMultipleChoiceEnabled",
  "ankiDroidExportEnabled",
  "ankiCardMode",
  "ankiGroupQuestions",
  "ankiAskIncorrectPart",
  "ankiHideAnswerCompletely",
  "ankiShowOtherAcceptedAnswersAndUserSynonyms",
  "ankiShowKanjiComposition",
  "ankiShowWaniKaniGrammarTags",
  "ankiShowPitchAccentNumbers",
  "ankiShowPitchAccentGraph",
  "ankiButtonlessMode",
  "ankiShowReplayAudioButton",
  "reviewTypeOrderEnabled",
  "lessonTypeOrderEnabled",
  "interleaveLessonTypesEnabled",
  "minimumRadicalKanjiPerBatchEnabled",
  "prioritizeCriticalItems",
  "autoplayVocabularyAudio",
  "autoplayLessonReadingAudio",
  "autoSwitchKeyboard",
  "showAnswerStopSubjectDetails",
  "showReviewItemLevelAndSrsStage",
  "showVocabContextSentencesInReviews",
  "reviewAnimatePreviousQuestion",
  "hapticFeedbackEnabled",
  "advancedNoteEditorEnabled",
  "noteLinkIncludeCharacters",
  "forecastShowSubjectColors",
  "showPitchAccent",
  "showVocabularyFrequency",
  "showJLPTLevel",
  "showPatternsOfUse",
  "showSimilarVocabulary",
  "showSingleKanjiVocabularySimilarKanji",
  "showMediaContextSentences",
  "showYouGlishContext",
  "hideContextSentenceTranslations",
  "hideContextSentenceTranslationsCompletely",
  "showContextSentenceSpeedControl",
  "showMnemonicIllustrations",
  "showInlineRadicalReminders",
  "showKanjiEtymology",
  "showSubjectHistory",
  "kanjiReadingTextToSpeechEnabled",
  "dailyLessonReminderIncludeWeekends",
  "vocabTooltipEnabled",
  "jitaiEnabled",
  "jitaiCycleAllFonts",
  "showStrokeOrder",
  "disableAutoProgressOnWrong",
  "disableAutoProgressOnCloseAnswer",
  "disableAutoProgressOnCorrect",
  "acceptUserSynonymsAsAnswers",
  "showAddSynonymButton",
  "acceptAnyKanjiOnyomiReading",
  "showOnyomiInKatakana",
  "groupKanjiVocabularyExamplesByReading",
  "backToBackQuestions",
  "listeningAutoPlayAudio",
  "hideNewsFuriganaByDefault",
  "hideVocabularyTooltipMeanings",
  "hideVocabularyTooltipReadings",
  "songsLyricsLineTranslationsEnabled",
  "homeStudyPacePlannerEnabled",
  "widgetCardsFollowTheme",
  "widgetLessonCardFollowTheme",
  "widgetReviewCardFollowTheme",
  "widgetStreakCardFollowTheme",
  "widgetSrsBreakdownGroupStages",
  "widgetSrsBreakdownGraphGroupStages",
  "widgetSrsBreakdownDetailsGroupStages",
] as const satisfies readonly BooleanSetting[];

const colorSettings = [
  "radicalColor",
  "kanjiColor",
  "vocabularyColor",
  ...(Object.keys(DEFAULT_WIDGET_CARD_STYLE_COLORS) as (keyof typeof DEFAULT_WIDGET_CARD_STYLE_COLORS)[]),
  ...(Object.keys(DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS) as (keyof typeof DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS)[]),
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const boolean: Decoder<boolean> = (value) =>
  typeof value === "boolean" ? value : undefined;
const hexColor: Decoder<string> = (value) =>
  typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
const optionalColor: Decoder<string> = (value) => value === "" ? value : hexColor(value);

function oneOf<const T extends string>(...options: readonly T[]): Decoder<T> {
  return (value) => options.find((option) => option === value);
}

function range(min: number, max: number, step?: number): Decoder<number> {
  return (value) =>
    typeof value === "number" && value >= min && value <= max &&
    (step === undefined || (value - min) % step === 0)
      ? value
      : undefined;
}

function numberWith(
  min: number,
  max: number,
  normalize: (value: number) => number,
): Decoder<number> {
  const decode = range(min, max);
  return (value) => {
    const number = decode(value);
    return number === undefined ? undefined : normalize(number);
  };
}

function normalizedList<T>(normalize: (value: unknown[]) => T[]): Decoder<T[]> {
  return (value) => {
    if (!Array.isArray(value)) return undefined;
    const normalized = normalize(value);
    return normalized.length === value.length ? normalized : undefined;
  };
}

function exactOrder<T extends string>(allowed: readonly T[]): Decoder<T[]> {
  return (value) => {
    if (!Array.isArray(value) || value.length !== allowed.length) return undefined;
    const order = new Set(value);
    return allowed.every((item) => order.has(item)) ? [...value] : undefined;
  };
}

function validLayout<T extends string>(normalize: (value: unknown) => T[]): Decoder<T[]> {
  return (value) => {
    if (!Array.isArray(value)) return undefined;
    const normalized = normalize(value);
    return normalized.length === value.length &&
      normalized.every((item, index) => item === value[index])
      ? normalized
      : undefined;
  };
}

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.length > 0 && item.length <= 256)
    ? [...value]
    : undefined;
}

function shortcuts<T extends { [Key in keyof T]: string }>(
  defaults: T,
  normalize: (value: string) => string,
): Decoder<T> {
  return (value) => {
    if (!isRecord(value)) return undefined;
    const result = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof T & string)[]) {
      const shortcut = value[key];
      if (typeof shortcut !== "string") return undefined;
      result[key] = normalize(shortcut) as T[typeof key];
    }
    return result;
  };
}

const reviewOrder = oneOf(...REVIEW_ORDER_OPTIONS.map(({ value }) => value));
const pausedUiScale = numberWith(
  REVIEW_PAUSED_UI_SCALE_MIN, REVIEW_PAUSED_UI_SCALE_MAX, normalizeReviewPausedUiScale,
);

const customDecoders = {
  lessonBatchSize: range(2, 10, 1),
  dailyLessonLimit: range(0, 500, 1),
  apprenticeLessonThreshold: range(0, LESSON_SRS_THRESHOLD_MAX, 1),
  guruLessonThreshold: range(0, LESSON_SRS_THRESHOLD_MAX, 1),
  lessonPickerViewMode: oneOf("cards", "list"),
  reviewBatchSize: range(5, 100, 5),
  reviewPresets: normalizedList(normalizeReviewPresets),
  learningPages: normalizedList(normalizeLearningPages),
  activeLearningPageId: (value: unknown) =>
    value === null || (typeof value === "string" && value.length <= 80) ? value : undefined,
  reviewWrapUpTargetSubjects: range(5, 20, 5),
  reviewAnswerRevealScale: pausedUiScale,
  reviewCorrectionButtonScale: pausedUiScale,
  reviewCharacterFontScale: range(REVIEW_CHARACTER_FONT_SCALE_MIN, REVIEW_CHARACTER_FONT_SCALE_MAX),
  reviewInputFontScale: range(REVIEW_INPUT_FONT_SCALE_MIN, REVIEW_INPUT_FONT_SCALE_MAX),
  reviewPromptTextColor: optionalColor,
  bunproReviewPromptTextColor: optionalColor,
  bunproStudyShortcuts: (value: unknown) => isRecord(value) ? normalizeStudyShortcuts(value) : undefined,
  reviewIncorrectKeyboardShortcuts: shortcuts(
    DEFAULT_REVIEW_INCORRECT_KEYBOARD_SHORTCUTS, sanitizeReviewShortcutInput,
  ),
  reviewCorrectKeyboardShortcuts: shortcuts(
    DEFAULT_REVIEW_CORRECT_KEYBOARD_SHORTCUTS, sanitizeReviewShortcutInput,
  ),
  ankiCardModeScope: oneOf("both", "meaning", "reading"),
  reviewOrder,
  customReviewOrder: reviewOrder,
  reviewTypeOrder: exactOrder(REVIEW_TYPE_ORDER_VALUES),
  lessonOrder: oneOf(...LESSON_ORDER_OPTIONS.map(({ value }) => value)),
  lessonTypeOrder: exactOrder(LESSON_TYPE_ORDER_VALUES),
  vocabularyAudioVoice: oneOf("female", "male", "random", "both"),
  appTextSizeScale: numberWith(APP_TEXT_SIZE_SCALE_MIN, APP_TEXT_SIZE_SCALE_MAX, normalizeAppTextSizeScale),
  srsProgressionCardDisplayMode: oneOf("normal", "compact", "hidden"),
  immersionKitAnimes: (value: unknown) => value === null ? null : stringList(value),
  dailyReviewReminderHour: range(0, 23, 1),
  dailyReviewReminderMinute: range(0, 59, 1),
  dailyLessonReminderMinimum: range(5, 100, 1),
  jitaiSelectedFontIds: stringList,
  strokeLeniency: range(0.8, 2.5),
  visuallySimilarKanjiSource: oneOf("wanikani", "niai"),
  newsSourcePreference: oneOf("easy", "regular", "both"),
  newsDefaultStudyMode: oneOf("none", "wk", "full"),
  songsMusicSource: oneOf("spotify", "apple"),
  songsPlaybackSource: oneOf("youtube", "appleMusic", "spotify"),
  songsLyricsDefaultStudyMode: oneOf("none", "wk", "full", "quiz"),
  customTabOrder: validLayout(normalizeCustomTabOrder),
  homeWidgetOrder: validLayout(normalizeHomeWidgetOrder),
  homeExtraStudyModeOrder: validLayout(normalizeHomeExtraStudyHiddenModeIds),
  homeExtraStudyHiddenModeIds: validLayout(normalizeHomeExtraStudyHiddenModeIds),
  homeRecentLessonsWindow: (value: unknown) => isRecentLessonsWindow(value) ? value : undefined,
  homeSrsBreakdownDisplayMode: oneOf("combined", "split", "graph", "details"),
  widgetContentMode: oneOf("reviews", "critical", "streak"),
  widgetStreakGradient: oneOf(
    "sunset", "ocean", "emerald", "violet", "rose", "amber", "aurora", "slate",
    "skyline", "obsidian", "graphite", "midnightBloom", "automatic", "defaults",
  ),
} satisfies { [Key in keyof Settings]?: Decoder<Settings[Key]> };

type PortableKey = (typeof booleanSettings)[number] | (typeof colorSettings)[number] | keyof typeof customDecoders;
type PortableSettings = Partial<Pick<Settings, PortableKey>>;
type SettingsBackup = {
  preferences: PortableSettings;
  themeMode?: ThemeMode;
};

const decoders = {
  ...Object.fromEntries(booleanSettings.map((key) => [key, boolean])),
  ...Object.fromEntries(colorSettings.map((key) => [key, hexColor])),
  ...customDecoders,
} as Record<PortableKey, Decoder<unknown>>;
const portableKeys = Object.keys(decoders) as PortableKey[];
const decodeTheme = oneOf("light", "dark", "system", "midnight", "sepia");

function readPreferences(record: Record<string, unknown>, importing: boolean): PortableSettings {
  const entries: [PortableKey, unknown][] = [];
  for (const key of portableKeys) {
    if (!Object.hasOwn(record, key)) continue;
    const value = decoders[key](record[key]);
    if (value !== undefined) {
      entries.push([key, value]);
    } else if (importing) {
      throw new Error("The file contains an invalid Kakehashi setting.");
    }
  }
  return Object.fromEntries(entries) as PortableSettings;
}

export function serializeSettingsBackup(state: Settings, themeMode: ThemeMode): string {
  const contents = JSON.stringify({
    format: FORMAT,
    version: VERSION,
    themeMode,
    preferences: readPreferences(state, false),
  });
  if (contents.length > MAX_SETTINGS_FILE_BYTES) {
    throw new Error("Settings files must be 1 MB or smaller.");
  }
  return contents;
}

export function parseSettingsBackup(contents: string): SettingsBackup {
  if (contents.length > MAX_SETTINGS_FILE_BYTES) {
    throw new Error("Settings files must be 1 MB or smaller.");
  }
  let backup: unknown;
  try {
    backup = JSON.parse(contents.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("Choose a valid Kakehashi settings file.");
  }
  if (!isRecord(backup) || backup.format !== FORMAT || !isRecord(backup.preferences)) {
    throw new Error("Choose a valid Kakehashi settings file.");
  }
  if (backup.version !== VERSION) {
    throw new Error("This version of the settings file is unsupported.");
  }

  const themeMode = decodeTheme(backup.themeMode);
  const preferences = readPreferences(backup.preferences, true);
  if ((Object.hasOwn(backup, "themeMode") && !themeMode) ||
      (!themeMode && Object.keys(preferences).length === 0)) {
    throw new Error("The file has no valid Kakehashi settings to import.");
  }
  return { preferences, themeMode };
}

export function applySettingsBackup({ preferences }: SettingsBackup) {
  if (Object.keys(preferences).length === 0) return;

  useSettingsStore.setState((state) => {
    const next = { ...preferences };
    if ("learningPages" in next || "activeLearningPageId" in next) {
      const pages = next.learningPages ?? state.learningPages;
      const activeId = "activeLearningPageId" in next
        ? next.activeLearningPageId
        : state.activeLearningPageId;
      next.activeLearningPageId = pages.find(({ id }) => id === activeId)?.id ?? null;
    }
    if (next.homeExtraStudyModeOrder || next.homeExtraStudyHiddenModeIds) {
      const order = next.homeExtraStudyModeOrder ?? state.homeExtraStudyModeOrder;
      const hidden = next.homeExtraStudyHiddenModeIds ?? state.homeExtraStudyHiddenModeIds;
      next.homeExtraStudyHiddenModeIds = hidden.filter((id) => !order.includes(id));
    }
    return next;
  });
}
