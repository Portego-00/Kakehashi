import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import {
  User,
  clearApiToken,
  clearInMemoryCache,
  getStoredApiToken,
  recoverAuthentication,
  saveApiToken,
} from "./api";
import { clearBadgeCount } from "./badgeNotifications";
import { clearCache } from "./cache";
import {
  PERMANENT_KEYS,
  permanentStorage,
  removeFromPermanentStorage,
} from "./permanentStorage";
import {
  DEFAULT_REVIEW_ORDER,
  type ReviewOrderSetting,
  DEFAULT_REVIEW_TYPE_ORDER,
  type ReviewTypeOrderSetting,
} from "./reviewOrdering";
import {
  DEFAULT_LESSON_ORDER,
  type LessonOrderSetting,
  DEFAULT_LESSON_TYPE_ORDER,
  type LessonTypeOrderSetting,
} from "./lessonOrdering";
import {
  DEFAULT_REVIEW_CORRECT_KEYBOARD_SHORTCUTS,
  DEFAULT_REVIEW_INCORRECT_KEYBOARD_SHORTCUTS,
  type ReviewCorrectKeyboardShortcutSettings,
  type ReviewIncorrectKeyboardShortcutSettings,
} from "./reviewKeyboardShortcuts";
import { cancelReviewNotifications } from "./reviewNotifications";
import {
  DEFAULT_WIDGET_CARD_STYLE_COLORS,
  type WidgetCardStyleColorKey,
} from "./widgetCardStyles";
import {
  DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS,
  type AnalyticsWidgetStyleColorKey,
} from "./analyticsWidgetStyles";
import {
  DEFAULT_HOME_WIDGET_ORDER,
  type HomeWidgetId,
  normalizeHomeWidgetOrder,
} from "./homeWidgets";
import {
  DEFAULT_HOME_EXTRA_STUDY_MODE_ORDER,
  type ExtraStudyModeId,
  normalizeHomeExtraStudyHiddenModeIds,
} from "./extraStudyModes";
import { type RecentLessonsWindow } from "./recentLessonsWindow";
import { clearOfflineVocabularyAudioCache } from "../services/offlineVocabularyAudioService";

export type VocabularyAudioVoicePreference =
  | "female"
  | "male"
  | "random"
  | "both";
export type StudyModePreference = "none" | "wk" | "full";
export type SrsProgressionCardDisplayMode = "normal" | "compact" | "hidden";
export type LessonPickerViewMode = "cards" | "list";

export type WidgetContentMode = "reviews" | "critical" | "streak";
export type WidgetStreakGradientPreset =
  | "sunset"
  | "ocean"
  | "emerald"
  | "violet"
  | "rose"
  | "amber"
  | "aurora"
  | "slate"
  | "skyline"
  | "obsidian"
  | "graphite"
  | "midnightBloom"
  | "automatic"
  | "defaults";
export type HomeSrsBreakdownDisplayMode =
  | "combined"
  | "split"
  | "graph"
  | "details";
export type CustomTabId =
  | "home"
  | "progress"
  | "news"
  | "songs"
  | "items"
  | "analytics"
  | "epubs"
  | "videos"
  | "mangas"
  | "bunpro";

const ALL_CUSTOM_TAB_IDS: CustomTabId[] = [
  "home",
  "progress",
  "news",
  "songs",
  "items",
  "analytics",
  "epubs",
  "videos",
  "mangas",
  "bunpro",
];
const DEFAULT_CUSTOM_TAB_ORDER: CustomTabId[] = [
  "home",
  "progress",
  "bunpro",
  "news",
  "songs",
];

const REVIEW_WRAP_UP_TARGET_SUBJECTS_MIN = 5;
const REVIEW_WRAP_UP_TARGET_SUBJECTS_MAX = 20;
const REVIEW_WRAP_UP_TARGET_SUBJECTS_STEP = 5;
export const DEFAULT_REVIEW_CHARACTER_FONT_SCALE = 1;
export const REVIEW_CHARACTER_FONT_SCALE_MIN = 0.7;
export const REVIEW_CHARACTER_FONT_SCALE_MAX = 1.2;
export const REVIEW_CHARACTER_FONT_SCALE_STEP = 0.1;
const AUTH_STORE_SCHEMA_VERSION = 1;
const SETTINGS_STORE_SCHEMA_VERSION = 11;
const LEGACY_DEFAULT_HOME_EXTRA_STUDY_MODE_ORDER_V5: ExtraStudyModeId[] = [
  "recent-lessons",
  "random-test",
  "reading-test",
  "kana-kanji-test",
  "listening-practice",
  "context-sentence-practice",
  "writing-practice",
  "custom-review",
  "custom-lessons",
];

function createDurableSettingsStorage(): StateStorage<void | Promise<void>> {
  return {
    getItem: (name) => {
      try {
        const durableValue = permanentStorage.getString(name);
        if (durableValue !== undefined) {
          return durableValue;
        }
      } catch (error) {
        console.warn("Failed to read settings from durable storage:", error);
      }

      return AsyncStorage.getItem(name).then((legacyValue) => {
        try {
          const durableValue = permanentStorage.getString(name);
          if (durableValue !== undefined) {
            return durableValue;
          }
        } catch (error) {
          console.warn("Failed to re-check durable settings storage:", error);
        }

        if (legacyValue !== null) {
          try {
            permanentStorage.set(name, legacyValue);
          } catch (error) {
            console.warn("Failed to migrate settings to durable storage:", error);
          }
        }

        return legacyValue;
      });
    },
    setItem: (name, value) => {
      try {
        permanentStorage.set(name, value);
      } catch (error) {
        console.warn("Failed to write settings to durable storage:", error);
        return AsyncStorage.setItem(name, value);
      }

      AsyncStorage.setItem(name, value).catch((error) => {
        console.warn("Failed to mirror settings to AsyncStorage:", error);
      });
    },
    removeItem: (name) => {
      try {
        permanentStorage.delete(name);
      } catch (error) {
        console.warn("Failed to remove settings from durable storage:", error);
      }

      return AsyncStorage.removeItem(name);
    },
  };
}

function migratePersistedObject<TState extends object>(
  persistedState: unknown
): TState {
  if (
    persistedState &&
    typeof persistedState === "object" &&
    !Array.isArray(persistedState)
  ) {
    return persistedState as TState;
  }

  // Fall back to defaults from the store initializer when persisted payload is invalid.
  return {} as TState;
}

function normalizeReviewWrapUpTargetSubjects(value: number): number {
  const finiteValue = Number.isFinite(value)
    ? value
    : REVIEW_WRAP_UP_TARGET_SUBJECTS_MIN;
  const normalizedToStep =
    Math.round(finiteValue / REVIEW_WRAP_UP_TARGET_SUBJECTS_STEP) *
    REVIEW_WRAP_UP_TARGET_SUBJECTS_STEP;

  return Math.min(
    REVIEW_WRAP_UP_TARGET_SUBJECTS_MAX,
    Math.max(REVIEW_WRAP_UP_TARGET_SUBJECTS_MIN, normalizedToStep)
  );
}

function normalizeReviewCharacterFontScale(value: unknown): number {
  const numericValue =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : DEFAULT_REVIEW_CHARACTER_FONT_SCALE;
  const normalizedToStep =
    Math.round(numericValue / REVIEW_CHARACTER_FONT_SCALE_STEP) *
    REVIEW_CHARACTER_FONT_SCALE_STEP;

  return Number(
    Math.min(
      REVIEW_CHARACTER_FONT_SCALE_MAX,
      Math.max(REVIEW_CHARACTER_FONT_SCALE_MIN, normalizedToStep)
    ).toFixed(2)
  );
}

function normalizeHomeSrsBreakdownDisplayMode(
  value: unknown
): HomeSrsBreakdownDisplayMode {
  switch (value) {
    case "combined":
    case "split":
    case "graph":
    case "details":
      return value;
    default:
      return "combined";
  }
}

function normalizeSrsProgressionCardDisplayMode(
  value: unknown
): SrsProgressionCardDisplayMode {
  switch (value) {
    case "normal":
    case "compact":
    case "hidden":
      return value;
    default:
      return "normal";
  }
}

function normalizeLessonPickerViewMode(value: unknown): LessonPickerViewMode {
  switch (value) {
    case "cards":
    case "list":
      return value;
    default:
      return "cards";
  }
}

function normalizeCustomTabOrder(value: unknown): CustomTabId[] {
  if (!Array.isArray(value)) {
    return [...DEFAULT_CUSTOM_TAB_ORDER];
  }

  const seen = new Set<CustomTabId>();
  const normalizedTabs: CustomTabId[] = [];

  value.forEach((tabIdCandidate) => {
    if (typeof tabIdCandidate !== "string") {
      return;
    }

    if (!ALL_CUSTOM_TAB_IDS.includes(tabIdCandidate as CustomTabId)) {
      return;
    }

    const tabId = tabIdCandidate as CustomTabId;
    if (seen.has(tabId)) {
      return;
    }

    seen.add(tabId);
    normalizedTabs.push(tabId);
  });

  if (normalizedTabs.length === 0) {
    return [...DEFAULT_CUSTOM_TAB_ORDER];
  }

  return normalizedTabs;
}

type AuthState = {
  apiToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  userData: User | null;
  needsPostLoginCaching: boolean;
  learnedKanjiCount: number | null;
  lastWrappedLevel: number | null;
  setApiToken: (token: string | null) => Promise<void>;
  loadStoredToken: () => Promise<string | null>;
  setUserData: (userData: User | null) => void;
  setNeedsPostLoginCaching: (needs: boolean) => void;
  setLearnedKanjiCount: (count: number) => void;
  setLastWrappedLevel: (level: number) => void;
  logout: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      apiToken: null,
      isAuthenticated: false,
      isLoading: true,
      userData: null,
      needsPostLoginCaching: false,
      learnedKanjiCount: null,
      lastWrappedLevel: null,

      setApiToken: async (token) => {
        if (token) {
          await saveApiToken(token);
          set({ apiToken: token, isAuthenticated: true });
        } else {
          await clearApiToken();
          set({ apiToken: null, isAuthenticated: false });
        }
      },

      loadStoredToken: async () => {
        try {
          set({ isLoading: true });
          const token = await getStoredApiToken();
          if (token) {
            set({ apiToken: token, isAuthenticated: true });
            set({ isLoading: false });
            return token;
          } else {
            // Try to recover authentication using fallback mechanisms
            const recoveredToken = await recoverAuthentication();
            if (recoveredToken) {
              set({ apiToken: recoveredToken, isAuthenticated: true });
              set({ isLoading: false });
              return recoveredToken;
            } else {
              set({ apiToken: null, isAuthenticated: false });
              set({ isLoading: false });
              return null;
            }
          }
        } catch {

          // If token loading fails, ensure we're in a clean unauthenticated state
          set({
            apiToken: null,
            isAuthenticated: false,
            isLoading: false,
          });

          // Don't throw - let the app continue in unauthenticated state
          return null;
        }
      },

      setUserData: (userData) => set({ userData }),

      setNeedsPostLoginCaching: (needs) =>
        set({ needsPostLoginCaching: needs }),

      setLearnedKanjiCount: (count) => set({ learnedKanjiCount: count }),

      setLastWrappedLevel: (level) => set({ lastWrappedLevel: level }),

      logout: async () => {
        await clearApiToken();
        await clearBadgeCount(); // Clear the app badge when logging out
        await cancelReviewNotifications(); // Cancel review notifications when logging out

        // Clear user-scoped caches so a subsequent login never hydrates data
        // from a previous account.
        clearInMemoryCache();
        await clearCache();
        await Promise.all(
          [
            PERMANENT_KEYS.DASHBOARD_DATA,
            PERMANENT_KEYS.ALL_ASSIGNMENTS,
            PERMANENT_KEYS.ALL_SUBJECTS,
            PERMANENT_KEYS.SUBJECTS_METADATA,
            PERMANENT_KEYS.STUDY_MATERIALS,
            PERMANENT_KEYS.REVIEW_STATISTICS,
            PERMANENT_KEYS.LEVEL_PROGRESSIONS,
            PERMANENT_KEYS.SRS_SYSTEMS,
          ].map((key) =>
            removeFromPermanentStorage(key).catch(() => {})
          )
        );
        await clearOfflineVocabularyAudioCache().catch(() => {});

        set({
          apiToken: null,
          isAuthenticated: false,
          userData: null,
          needsPostLoginCaching: false,
          learnedKanjiCount: null,
          lastWrappedLevel: null,
        });
      },
    }),
    {
      name: "wanikani-auth",
      storage: createJSONStorage(() => AsyncStorage),
      version: AUTH_STORE_SCHEMA_VERSION,
      migrate: (persistedState) =>
        migratePersistedObject<AuthState>(persistedState),
      partialize: (state) => ({
        // Note: We don't persist apiToken here because it's stored securely in SecureStore
        // The token will be reloaded from SecureStore via loadStoredToken()
        // We only persist user data and settings that don't contain sensitive info
        userData: state.userData,
        learnedKanjiCount: state.learnedKanjiCount,
        lastWrappedLevel: state.lastWrappedLevel,
      }),
    }
  )
);

// Type for settings state
type SettingsState = {
  // Lesson settings
  lessonBatchSize: number;
  dailyLessonLimit: number; // Maximum lessons per day in the user's timezone (0 = unlimited)
  lessonPickerViewMode: LessonPickerViewMode; // Default visual style for lesson picker subject selection
  singlePageLessonView: boolean; // Show all lesson content in a single scrollable page instead of tabs
  skipCustomLessonQuiz: boolean; // Skip custom lesson quiz and jump straight to batch completion
  excludeKanaVocabularyFromLessons: boolean; // Hide kana vocabulary from lesson queue and lesson counts

  // Review settings
  reviewBatchSizeEnabled: boolean; // Toggle to cap the review queue size
  reviewBatchSize: number; // Number of items per review session when enabled (5-100, step 5)
  reviewWrapUpTargetSubjects: number; // Subjects left after tapping Wrap Up (5-20, step 5)
  reviewSearchButtonEnabled: boolean; // Show quick search button below Wrap Up during reviews
  reviewCharacterFontScale: number; // Scale for the large Japanese prompt during reviews
  backToBackImmediateRetryIncorrect: boolean; // In back-to-back mode, immediately re-ask incorrect questions (legacy behavior)
  allowSkippingReviews: boolean; // Allow skipping a review item by submitting an empty answer
  meaningFirst: boolean;
  reviewQuestionOrderEnabled: boolean; // Force meaning/reading order when available
  skipKanjiReadings: boolean;
  minimizeReviewPenalty: boolean;
  ankiCardMode: boolean;
  ankiGroupQuestions: boolean;
  ankiCardModeScope: "both" | "meaning" | "reading";
  ankiHideAnswerCompletely: boolean;
  ankiShowOtherAcceptedAnswersAndUserSynonyms: boolean;
  ankiShowWaniKaniGrammarTags: boolean;
  ankiButtonlessMode: boolean;
  ankiShowReplayAudioButton: boolean;
  reviewOrder: ReviewOrderSetting;
  reviewTypeOrderEnabled: boolean;
  reviewTypeOrder: ReviewTypeOrderSetting[];
  lessonOrder: LessonOrderSetting;
  lessonTypeOrderEnabled: boolean;
  lessonTypeOrder: LessonTypeOrderSetting[];
  interleaveLessonTypesEnabled: boolean;
  prioritizeCriticalItems: boolean;
  autoplayVocabularyAudio: boolean;
  autoplayLessonReadingAudio: boolean; // Auto-play vocabulary audio when opening the Reading tab in lessons
  vocabularyAudioVoice: VocabularyAudioVoicePreference;
  offlineVocabularyAudioEnabled: boolean; // Pre-download vocabulary pronunciation audio for offline playback
  autoSwitchKeyboard: boolean; // Auto-switch to Japanese keyboard for reading questions
  voiceReviewAnswersEnabled: boolean; // Enable speech recognition for review answers
  reviewIncorrectKeyboardShortcuts: ReviewIncorrectKeyboardShortcutSettings; // Shortcuts used while paused on incorrect answers
  reviewCorrectKeyboardShortcuts: ReviewCorrectKeyboardShortcutSettings; // Shortcuts used while paused on correct answers
  showAnswerStopSubjectDetails: boolean; // Show subject details inline while paused after an answer
  showReviewItemLevelAndSrsStage: boolean; // Show subject level and current SRS stage during reviews
  reviewAnimatePreviousQuestion: boolean; // Animate the previous answered card from center to top-left during reviews
  hapticFeedbackEnabled: boolean; // Enable haptic feedback throughout the app

  // UI settings
  srsProgressionCardDisplayMode: SrsProgressionCardDisplayMode;
  radicalColor: string;
  kanjiColor: string;
  vocabularyColor: string;
  forecastShowSubjectColors: boolean;
  showPitchAccent: boolean;
  showPatternsOfUse: boolean;
  showSimilarVocabulary: boolean;
  showSingleKanjiVocabularySimilarKanji: boolean;
  showMediaContextSentences: boolean;
  hideContextSentenceTranslations: boolean;
  showContextSentenceSpeedControl: boolean;
  showMnemonicIllustrations: boolean; // Show radical mnemonic illustrations in subject details and lessons
  myAnimeListUsername: string | null;
  aniListUsername: string | null;
  immersionKitAnimes: string[] | null;

  // Notification settings
  showBadgeNotifications: boolean;
  enableReviewNotifications: boolean;
  dailyReviewReminderEnabled: boolean;
  dailyReviewReminderHour: number;
  dailyReviewReminderMinute: number;
  dailyLessonReminderEnabled: boolean;
  dailyLessonReminderMinimum: number;

  // User Profile settings
  gravatarEmail: string | null;

  // New features
  vocabTooltipEnabled: boolean;
  jitaiEnabled: boolean;
  jitaiSelectedFontIds: string[]; // Font IDs to include in Jitai randomization
  showStrokeOrder: boolean;
  disableAutoProgressOnWrong: boolean;
  disableAutoProgressOnCloseAnswer: boolean;
  disableAutoProgressOnCorrect: boolean;
  acceptUserSynonymsAsAnswers: boolean;
  showAddSynonymButton: boolean;
  acceptAnyKanjiOnyomiReading: boolean;
  showOnyomiInKatakana: boolean;
  backToBackQuestions: boolean;
  strokeLeniency: number; // 0.8 = very strict, 1.2 = strict, 1.8 = lenient, 2.5 = very lenient
  visuallySimilarKanjiSource: "wanikani" | "niai"; // Source for visually similar kanji data

  // Listening practice settings
  listeningAutoPlayAudio: boolean; // Auto-play audio when moving between questions

  // Songs settings
  newsDefaultStudyMode: StudyModePreference;
  hideVocabularyTooltipMeanings: boolean;
  hideVocabularyTooltipReadings: boolean;
  songsMusicSource: "spotify" | "apple";
  songsPlaybackSource: "youtube" | "appleMusic";
  songsLyricsDefaultStudyMode: StudyModePreference;
  songsLyricsLineTranslationsEnabled: boolean;
  appleMusicAuthStatus:
    | "authorized"
    | "denied"
    | "notDetermined"
    | "restricted"
    | "unknown";

  // Patch notes tracking
  lastSeenPatchNotesVersion: string | null;
  bunproSurveyCompleted: boolean;

  // Tab customization
  // Default: ['home', 'progress', 'bunpro', 'news', 'songs'] - items and analytics are accessed from progress tab
  // Tab limits are enforced by device/OS in tab settings and layout.
  customTabOrder: CustomTabId[];

  // Home screen customization
  homeWidgetOrder: HomeWidgetId[];
  homeExtraStudyModeOrder: ExtraStudyModeId[];
  homeExtraStudyHiddenModeIds: ExtraStudyModeId[];
  homeRecentLessonsWindow: RecentLessonsWindow;
  homeSrsBreakdownDisplayMode: HomeSrsBreakdownDisplayMode;

  // Widget customization
  widgetContentMode: WidgetContentMode;
  widgetStreakGradient: WidgetStreakGradientPreset;
  widgetCardsFollowTheme: boolean;
  widgetLessonCardFollowTheme: boolean;
  widgetReviewCardFollowTheme: boolean;
  widgetStreakCardFollowTheme: boolean;
  widgetSrsBreakdownGroupStages: boolean;
  widgetSrsBreakdownGraphGroupStages: boolean;
  widgetSrsBreakdownDetailsGroupStages: boolean;
  widgetLessonCardGradientStart: string;
  widgetLessonCardGradientEnd: string;
  widgetReviewCardGradientStart: string;
  widgetReviewCardGradientEnd: string;
  widgetStreakCardGradientStart: string;
  widgetStreakCardGradientMiddle: string;
  widgetStreakCardGradientEnd: string;
  widgetReviewHeatmapLevel1Color: string;
  widgetReviewHeatmapLevel2Color: string;
  widgetReviewHeatmapLevel3Color: string;
  widgetReviewHeatmapLevel4Color: string;
  widgetLevelTimingFastColor: string;
  widgetLevelTimingAverageColor: string;
  widgetLevelTimingSlowColor: string;
  widgetLevelTimingCurrentColor: string;
  widgetLevelTimingResetColor: string;
  widgetReviewStatsExcellentColor: string;
  widgetReviewStatsGoodColor: string;
  widgetReviewStatsWarningColor: string;
  widgetReviewStatsPoorColor: string;
  widgetReviewStatsBadColor: string;
  widgetReviewStatsMeaningAccentColor: string;
  widgetReviewStatsReadingAccentColor: string;
  widgetReviewStatsTotalAccentColor: string;

  // Update functions
  setLessonBatchSize: (size: number) => void;
  setDailyLessonLimit: (limit: number) => void;
  setLessonPickerViewMode: (mode: LessonPickerViewMode) => void;
  setSinglePageLessonView: (enabled: boolean) => void;
  setSkipCustomLessonQuiz: (enabled: boolean) => void;
  setExcludeKanaVocabularyFromLessons: (enabled: boolean) => void;
  setReviewBatchSizeEnabled: (enabled: boolean) => void;
  setReviewBatchSize: (size: number) => void;
  setReviewWrapUpTargetSubjects: (target: number) => void;
  setReviewSearchButtonEnabled: (enabled: boolean) => void;
  setReviewCharacterFontScale: (scale: number) => void;
  setBackToBackImmediateRetryIncorrect: (enabled: boolean) => void;
  setAllowSkippingReviews: (enabled: boolean) => void;
  setMeaningFirst: (meaningFirst: boolean) => void;
  setReviewQuestionOrderEnabled: (enabled: boolean) => void;
  setSkipKanjiReadings: (skip: boolean) => void;
  setMinimizeReviewPenalty: (minimize: boolean) => void;
  setAnkiCardMode: (ankiMode: boolean) => void;
  setAnkiGroupQuestions: (group: boolean) => void;
  setAnkiCardModeScope: (scope: "both" | "meaning" | "reading") => void;
  setAnkiHideAnswerCompletely: (hide: boolean) => void;
  setAnkiShowOtherAcceptedAnswersAndUserSynonyms: (show: boolean) => void;
  setAnkiShowWaniKaniGrammarTags: (show: boolean) => void;
  setAnkiButtonlessMode: (enabled: boolean) => void;
  setAnkiShowReplayAudioButton: (show: boolean) => void;
  setReviewOrder: (order: ReviewOrderSetting) => void;
  setReviewTypeOrderEnabled: (enabled: boolean) => void;
  setReviewTypeOrder: (order: ReviewTypeOrderSetting[]) => void;
  setLessonOrder: (order: LessonOrderSetting) => void;
  setLessonTypeOrderEnabled: (enabled: boolean) => void;
  setLessonTypeOrder: (order: LessonTypeOrderSetting[]) => void;
  setInterleaveLessonTypesEnabled: (enabled: boolean) => void;
  setPrioritizeCriticalItems: (prioritize: boolean) => void;
  setAutoplayVocabularyAudio: (autoplay: boolean) => void;
  setAutoplayLessonReadingAudio: (autoplay: boolean) => void;
  setVocabularyAudioVoice: (voice: VocabularyAudioVoicePreference) => void;
  setOfflineVocabularyAudioEnabled: (enabled: boolean) => void;
  setAutoSwitchKeyboard: (enabled: boolean) => void;
  setVoiceReviewAnswersEnabled: (enabled: boolean) => void;
  setHapticFeedbackEnabled: (enabled: boolean) => void;
  setReviewIncorrectKeyboardShortcuts: (
    shortcuts: Partial<ReviewIncorrectKeyboardShortcutSettings>,
  ) => void;
  setReviewCorrectKeyboardShortcuts: (
    shortcuts: Partial<ReviewCorrectKeyboardShortcutSettings>,
  ) => void;
  setShowAnswerStopSubjectDetails: (show: boolean) => void;
  setShowReviewItemLevelAndSrsStage: (show: boolean) => void;
  setReviewAnimatePreviousQuestion: (enabled: boolean) => void;
  setSrsProgressionCardDisplayMode: (
    mode: SrsProgressionCardDisplayMode
  ) => void;
  setRadicalColor: (color: string) => void;
  setKanjiColor: (color: string) => void;
  setVocabularyColor: (color: string) => void;
  setForecastShowSubjectColors: (show: boolean) => void;
  setShowPitchAccent: (show: boolean) => void;
  setShowPatternsOfUse: (show: boolean) => void;
  setShowSimilarVocabulary: (show: boolean) => void;
  setShowSingleKanjiVocabularySimilarKanji: (show: boolean) => void;
  setShowMediaContextSentences: (show: boolean) => void;
  setHideContextSentenceTranslations: (hide: boolean) => void;
  setShowContextSentenceSpeedControl: (show: boolean) => void;
  setShowMnemonicIllustrations: (show: boolean) => void;
  setMyAnimeListUsername: (username: string | null) => void;
  setAniListUsername: (username: string | null) => void;
  setImmersionKitAnimes: (animes: string[] | null) => void;
  setShowBadgeNotifications: (show: boolean) => void;
  setEnableReviewNotifications: (enable: boolean) => void;
  setDailyReviewReminderEnabled: (enable: boolean) => void;
  setDailyReviewReminderHour: (hour: number) => void;
  setDailyReviewReminderMinute: (minute: number) => void;
  setDailyLessonReminderEnabled: (enable: boolean) => void;
  setDailyLessonReminderMinimum: (minimum: number) => void;
  setGravatarEmail: (email: string | null) => void;
  setVocabTooltipEnabled: (enabled: boolean) => void;
  setJitaiEnabled: (enabled: boolean) => void;
  setJitaiSelectedFontIds: (fontIds: string[]) => void;
  setShowStrokeOrder: (show: boolean) => void;
  setDisableAutoProgressOnWrong: (disable: boolean) => void;
  setDisableAutoProgressOnCloseAnswer: (disable: boolean) => void;
  setDisableAutoProgressOnCorrect: (disable: boolean) => void;
  setAcceptUserSynonymsAsAnswers: (accept: boolean) => void;
  setShowAddSynonymButton: (show: boolean) => void;
  setAcceptAnyKanjiOnyomiReading: (accept: boolean) => void;
  setShowOnyomiInKatakana: (show: boolean) => void;
  setBackToBackQuestions: (enabled: boolean) => void;
  setStrokeLeniency: (leniency: number) => void;
  setVisuallySimilarKanjiSource: (source: "wanikani" | "niai") => void;
  setListeningAutoPlayAudio: (autoplay: boolean) => void;
  setNewsDefaultStudyMode: (mode: StudyModePreference) => void;
  setHideVocabularyTooltipMeanings: (hide: boolean) => void;
  setHideVocabularyTooltipReadings: (hide: boolean) => void;
  setSongsMusicSource: (source: "spotify" | "apple") => void;
  setSongsPlaybackSource: (source: "youtube" | "appleMusic") => void;
  setSongsLyricsDefaultStudyMode: (mode: StudyModePreference) => void;
  setSongsLyricsLineTranslationsEnabled: (enabled: boolean) => void;
  setAppleMusicAuthStatus: (
    status:
      | "authorized"
      | "denied"
      | "notDetermined"
      | "restricted"
      | "unknown"
  ) => void;
  setLastSeenPatchNotesVersion: (version: string | null) => void;
  setBunproSurveyCompleted: (completed: boolean) => void;
  setCustomTabOrder: (tabs: CustomTabId[]) => void;
  setHomeWidgetOrder: (widgets: HomeWidgetId[]) => void;
  addHomeWidget: (widget: HomeWidgetId) => void;
  removeHomeWidget: (widget: HomeWidgetId) => void;
  resetHomeWidgetOrder: () => void;
  setHomeExtraStudyModeOrder: (modes: ExtraStudyModeId[]) => void;
  addHomeExtraStudyMode: (mode: ExtraStudyModeId) => void;
  removeHomeExtraStudyMode: (mode: ExtraStudyModeId) => void;
  resetHomeExtraStudyModeOrder: () => void;
  setHomeRecentLessonsWindow: (window: RecentLessonsWindow) => void;
  setHomeSrsBreakdownDisplayMode: (
    mode: HomeSrsBreakdownDisplayMode
  ) => void;
  setWidgetContentMode: (mode: WidgetContentMode) => void;
  setWidgetStreakGradient: (preset: WidgetStreakGradientPreset) => void;
  setWidgetCardsFollowTheme: (follow: boolean) => void;
  setWidgetLessonCardFollowTheme: (follow: boolean) => void;
  setWidgetReviewCardFollowTheme: (follow: boolean) => void;
  setWidgetStreakCardFollowTheme: (follow: boolean) => void;
  setWidgetSrsBreakdownGroupStages: (grouped: boolean) => void;
  setWidgetSrsBreakdownGraphGroupStages: (grouped: boolean) => void;
  setWidgetSrsBreakdownDetailsGroupStages: (grouped: boolean) => void;
  setWidgetCardStyleColor: (
    key: WidgetCardStyleColorKey,
    color: string
  ) => void;
  setAnalyticsWidgetStyleColor: (
    key: AnalyticsWidgetStyleColorKey,
    color: string
  ) => void;
};

// Create settings store with persistence
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      // Default settings
      lessonBatchSize: 5,
      dailyLessonLimit: 0, // 0 means no daily limit
      lessonPickerViewMode: "cards", // Default to card grid selection in lesson picker
      singlePageLessonView: false, // Default to tab-based view
      skipCustomLessonQuiz: false, // Default to false - keep custom lesson review quiz enabled
      excludeKanaVocabularyFromLessons: false, // Default to disabled so kana vocabulary stays in lessons
      reviewBatchSizeEnabled: false, // Disabled by default - all reviews loaded
      reviewBatchSize: 50, // Default batch size when enabled
      reviewWrapUpTargetSubjects: 10, // Default to wrap up after 10 subjects
      reviewSearchButtonEnabled: false, // Default to disabled - keep review header focused unless enabled
      reviewCharacterFontScale: DEFAULT_REVIEW_CHARACTER_FONT_SCALE, // Default to the current prompt size
      backToBackImmediateRetryIncorrect: false, // Default to disabled - keep delayed boundary-safe requeue
      allowSkippingReviews: false, // Default to disabled to match standard WaniKani review flow
      meaningFirst: true,
      reviewQuestionOrderEnabled: false, // Default to disabled - keep legacy random/back-to-back behavior
      skipKanjiReadings: false,
      minimizeReviewPenalty: true,
      ankiCardMode: false, // Default to disabled (traditional WaniKani mode)
      ankiGroupQuestions: false, // Default to disabled (show questions separately)
      ankiCardModeScope: "both", // Default to Anki behavior for both meaning and reading
      ankiHideAnswerCompletely: false, // Default to false - keep blurred reveal style
      ankiShowOtherAcceptedAnswersAndUserSynonyms: false, // Default to false - only show primary answer on Anki cards
      ankiShowWaniKaniGrammarTags: false, // Default to false - keep Anki cards free of grammar metadata
      ankiButtonlessMode: false, // Default to false - show standard Anki self-grade buttons
      ankiShowReplayAudioButton: false, // Default to false - keep reveal actions focused on grading
      reviewOrder: DEFAULT_REVIEW_ORDER,
      reviewTypeOrderEnabled: false, // Default to disabled - no forced type grouping
      reviewTypeOrder: [...DEFAULT_REVIEW_TYPE_ORDER], // Radical -> Kanji -> Vocabulary
      lessonOrder: DEFAULT_LESSON_ORDER,
      lessonTypeOrderEnabled: false, // Default to disabled - no forced type grouping
      lessonTypeOrder: [...DEFAULT_LESSON_TYPE_ORDER], // Radical -> Kanji -> Vocabulary
      interleaveLessonTypesEnabled: false, // Default to disabled - preserve legacy ordering unless user opts in
      prioritizeCriticalItems: false, // Default to disabled (traditional SRS ordering)
      autoplayVocabularyAudio: false, // Default to disabled (no automatic audio playback)
      autoplayLessonReadingAudio: false, // Default to disabled for lesson reading tab navigation
      vocabularyAudioVoice: "female", // Default to female voice (Kyoko)
      offlineVocabularyAudioEnabled: false, // Default to disabled to avoid unexpected background downloads
      autoSwitchKeyboard: false, // Default to disabled (use wanakana romaji-to-kana conversion)
      voiceReviewAnswersEnabled: false, // Default to disabled (manual typing)
      hapticFeedbackEnabled: true, // Default to enabled for tactile feedback
      reviewIncorrectKeyboardShortcuts: {
        ...DEFAULT_REVIEW_INCORRECT_KEYBOARD_SHORTCUTS,
      },
      reviewCorrectKeyboardShortcuts: {
        ...DEFAULT_REVIEW_CORRECT_KEYBOARD_SHORTCUTS,
      },
      showAnswerStopSubjectDetails: false, // Default to existing compact pause card behavior
      showReviewItemLevelAndSrsStage: false, // Default to false - keep review prompt minimal
      reviewAnimatePreviousQuestion: true, // Default to true - keep center-to-corner animation for the previous answered card
      srsProgressionCardDisplayMode: "normal",
      radicalColor: "#3c9bff",
      kanjiColor: "#fa1f62",
      vocabularyColor: "#9c38d9",
      forecastShowSubjectColors: false, // Default to disabled (traditional single color)
      showPitchAccent: false, // Default to disabled (optional pronunciation visualization)
      showPatternsOfUse: false, // Default to disabled (optional collocation/pattern examples)
      showSimilarVocabulary: false, // Default to disabled (optional similar reading/meaning lookup)
      showSingleKanjiVocabularySimilarKanji: false, // Default to disabled (optional similar kanji for one-kanji vocabulary)
      showMediaContextSentences: true, // Default to enabled (show media context sentences)
      hideContextSentenceTranslations: false, // Default to disabled (show translations immediately)
      showContextSentenceSpeedControl: false, // Default to disabled (hide per-sentence speed controls)
      showMnemonicIllustrations: true, // Default to enabled (show radical mnemonic illustrations)
      myAnimeListUsername: null, // No MyAnimeList user configured by default
      aniListUsername: null, // No AniList user configured by default
      showBadgeNotifications: true, // Default to enabled
      enableReviewNotifications: false, // Default to disabled (requires user consent)
      dailyReviewReminderEnabled: false, // Default to disabled
      dailyReviewReminderHour: 20, // Default reminder time: 20:00 local time
      dailyReviewReminderMinute: 0,
      dailyLessonReminderEnabled: false, // Default to disabled
      dailyLessonReminderMinimum: 5, // Default lesson goal for reminders
      gravatarEmail: null,

      vocabTooltipEnabled: true, // Default to true
      jitaiEnabled: false, // Default to false
      jitaiSelectedFontIds: [
        "source-han-sans",
        "zen-kurenaido",
        "reggae-one",
        "yuji-syuku",
        "hachi-maru-pop",
      ], // Default to bundled fonts only
      showStrokeOrder: true, // Default to true - show stroke order animation for kanji
      disableAutoProgressOnWrong: true, // Default to true - pause on wrong answer
      disableAutoProgressOnCloseAnswer: false, // Default to false - auto-accept close meaning answers
      disableAutoProgressOnCorrect: false, // Default to false - auto-progress on correct answer
      acceptUserSynonymsAsAnswers: false, // Default to false - accept user synonyms as correct answers
      showAddSynonymButton: true, // Default to true - preserve the existing paused-wrong synonym action
      acceptAnyKanjiOnyomiReading: false, // Default to false - require primary reading for kanji unless enabled
      showOnyomiInKatakana: false, // Default to false - show on'yomi readings in katakana (Katakana Madness)
      backToBackQuestions: false, // Default to false - show meaning and reading questions back-to-back
      strokeLeniency: 1.5, // Default to 1.5 (lenient) - higher values are more forgiving
      visuallySimilarKanjiSource: "wanikani", // Default to WaniKani's built-in similar kanji

      listeningAutoPlayAudio: true, // Default to true - auto-play audio when moving between questions
      newsDefaultStudyMode: "none", // Default to regular NHK article view
      hideVocabularyTooltipMeanings: false, // Default to showing tooltip meanings immediately
      hideVocabularyTooltipReadings: false, // Default to showing tooltip readings immediately
      songsMusicSource: "spotify", // Default to Spotify for backwards compatibility
      songsPlaybackSource: "youtube", // Default to existing YouTube player behavior
      songsLyricsDefaultStudyMode: "wk", // Default to WK chips for inline lyrics analysis
      songsLyricsLineTranslationsEnabled: false, // Default to hidden machine translations
      appleMusicAuthStatus: "notDetermined",

      immersionKitAnimes: null, // Custom list of selected animes for Immersion Kit

      lastSeenPatchNotesVersion: null, // Track which patch notes version user has seen
      bunproSurveyCompleted: false, // Keep Bunpro survey visible until the user submits it

      customTabOrder: [...DEFAULT_CUSTOM_TAB_ORDER], // Default tab order
      homeWidgetOrder: [...DEFAULT_HOME_WIDGET_ORDER],
      homeExtraStudyModeOrder: [...DEFAULT_HOME_EXTRA_STUDY_MODE_ORDER],
      homeExtraStudyHiddenModeIds: [],
      homeRecentLessonsWindow: "apprentice",
      homeSrsBreakdownDisplayMode: "combined",
      widgetContentMode: "reviews",
      widgetStreakGradient: "sunset",
      widgetCardsFollowTheme: true,
      widgetLessonCardFollowTheme: true,
      widgetReviewCardFollowTheme: true,
      widgetStreakCardFollowTheme: true,
      widgetSrsBreakdownGroupStages: false,
      widgetSrsBreakdownGraphGroupStages: false,
      widgetSrsBreakdownDetailsGroupStages: false,
      widgetLessonCardGradientStart:
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetLessonCardGradientStart,
      widgetLessonCardGradientEnd:
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetLessonCardGradientEnd,
      widgetReviewCardGradientStart:
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetReviewCardGradientStart,
      widgetReviewCardGradientEnd:
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetReviewCardGradientEnd,
      widgetStreakCardGradientStart:
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetStreakCardGradientStart,
      widgetStreakCardGradientMiddle:
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetStreakCardGradientMiddle,
      widgetStreakCardGradientEnd:
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetStreakCardGradientEnd,
      widgetReviewHeatmapLevel1Color:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewHeatmapLevel1Color,
      widgetReviewHeatmapLevel2Color:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewHeatmapLevel2Color,
      widgetReviewHeatmapLevel3Color:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewHeatmapLevel3Color,
      widgetReviewHeatmapLevel4Color:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewHeatmapLevel4Color,
      widgetLevelTimingFastColor:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetLevelTimingFastColor,
      widgetLevelTimingAverageColor:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetLevelTimingAverageColor,
      widgetLevelTimingSlowColor:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetLevelTimingSlowColor,
      widgetLevelTimingCurrentColor:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetLevelTimingCurrentColor,
      widgetLevelTimingResetColor:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetLevelTimingResetColor,
      widgetReviewStatsExcellentColor:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsExcellentColor,
      widgetReviewStatsGoodColor:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsGoodColor,
      widgetReviewStatsWarningColor:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsWarningColor,
      widgetReviewStatsPoorColor:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsPoorColor,
      widgetReviewStatsBadColor:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsBadColor,
      widgetReviewStatsMeaningAccentColor:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsMeaningAccentColor,
      widgetReviewStatsReadingAccentColor:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsReadingAccentColor,
      widgetReviewStatsTotalAccentColor:
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsTotalAccentColor,

      // Update functions
      setLessonBatchSize: (size) => set({ lessonBatchSize: size }),
      setDailyLessonLimit: (limit) => set({ dailyLessonLimit: limit }),
      setLessonPickerViewMode: (mode) =>
        set({ lessonPickerViewMode: normalizeLessonPickerViewMode(mode) }),
      setSinglePageLessonView: (enabled) => set({ singlePageLessonView: enabled }),
      setSkipCustomLessonQuiz: (enabled) => set({ skipCustomLessonQuiz: enabled }),
      setExcludeKanaVocabularyFromLessons: (enabled) =>
        set({ excludeKanaVocabularyFromLessons: enabled }),
      setReviewBatchSizeEnabled: (enabled) => set({ reviewBatchSizeEnabled: enabled }),
      setReviewBatchSize: (size) => set({ reviewBatchSize: size }),
      setReviewWrapUpTargetSubjects: (target) =>
        set({
          reviewWrapUpTargetSubjects:
            normalizeReviewWrapUpTargetSubjects(target),
        }),
      setReviewSearchButtonEnabled: (enabled) =>
        set({ reviewSearchButtonEnabled: enabled }),
      setReviewCharacterFontScale: (scale) =>
        set({
          reviewCharacterFontScale: normalizeReviewCharacterFontScale(scale),
        }),
      setBackToBackImmediateRetryIncorrect: (enabled) =>
        set({ backToBackImmediateRetryIncorrect: enabled }),
      setAllowSkippingReviews: (enabled) => set({ allowSkippingReviews: enabled }),
      setMeaningFirst: (meaningFirst) => set({ meaningFirst }),
      setReviewQuestionOrderEnabled: (enabled) =>
        set({ reviewQuestionOrderEnabled: enabled }),
      setSkipKanjiReadings: (skip) => set({ skipKanjiReadings: skip }),
      setMinimizeReviewPenalty: (minimize) =>
        set({ minimizeReviewPenalty: minimize }),
      setAnkiCardMode: (ankiMode) => set({ ankiCardMode: ankiMode }),
      setAnkiGroupQuestions: (group) => set({ ankiGroupQuestions: group }),
      setAnkiCardModeScope: (scope) => set({ ankiCardModeScope: scope }),
      setAnkiHideAnswerCompletely: (hide) =>
        set({ ankiHideAnswerCompletely: hide }),
      setAnkiShowOtherAcceptedAnswersAndUserSynonyms: (show) =>
        set({ ankiShowOtherAcceptedAnswersAndUserSynonyms: show }),
      setAnkiShowWaniKaniGrammarTags: (show) =>
        set({ ankiShowWaniKaniGrammarTags: show }),
      setAnkiButtonlessMode: (enabled) => set({ ankiButtonlessMode: enabled }),
      setAnkiShowReplayAudioButton: (show) =>
        set({ ankiShowReplayAudioButton: show }),
      setReviewOrder: (reviewOrder) => set({ reviewOrder }),
      setReviewTypeOrderEnabled: (reviewTypeOrderEnabled) =>
        set({ reviewTypeOrderEnabled }),
      setReviewTypeOrder: (reviewTypeOrder) => set({ reviewTypeOrder }),
      setLessonOrder: (lessonOrder) => set({ lessonOrder }),
      setLessonTypeOrderEnabled: (lessonTypeOrderEnabled) =>
        set({ lessonTypeOrderEnabled }),
      setLessonTypeOrder: (lessonTypeOrder) => set({ lessonTypeOrder }),
      setInterleaveLessonTypesEnabled: (interleaveLessonTypesEnabled) =>
        set({ interleaveLessonTypesEnabled }),
      setPrioritizeCriticalItems: (prioritize) =>
        set({ prioritizeCriticalItems: prioritize }),
      setAutoplayVocabularyAudio: (autoplay) =>
        set({ autoplayVocabularyAudio: autoplay }),
      setAutoplayLessonReadingAudio: (autoplay) =>
        set({ autoplayLessonReadingAudio: autoplay }),
      setVocabularyAudioVoice: (voice) => set({ vocabularyAudioVoice: voice }),
      setOfflineVocabularyAudioEnabled: (enabled) =>
        set({ offlineVocabularyAudioEnabled: enabled }),
      setAutoSwitchKeyboard: (enabled) => set({ autoSwitchKeyboard: enabled }),
      setVoiceReviewAnswersEnabled: (enabled) =>
        set({ voiceReviewAnswersEnabled: enabled }),
      setHapticFeedbackEnabled: (enabled) =>
        set({ hapticFeedbackEnabled: enabled }),
      setReviewIncorrectKeyboardShortcuts: (shortcuts) =>
        set((state) => ({
          reviewIncorrectKeyboardShortcuts: {
            ...state.reviewIncorrectKeyboardShortcuts,
            ...shortcuts,
          },
        })),
      setReviewCorrectKeyboardShortcuts: (shortcuts) =>
        set((state) => ({
          reviewCorrectKeyboardShortcuts: {
            ...state.reviewCorrectKeyboardShortcuts,
            ...shortcuts,
          },
        })),
      setShowAnswerStopSubjectDetails: (show) =>
        set({ showAnswerStopSubjectDetails: show }),
      setShowReviewItemLevelAndSrsStage: (show) =>
        set({ showReviewItemLevelAndSrsStage: show }),
      setReviewAnimatePreviousQuestion: (enabled) =>
        set({ reviewAnimatePreviousQuestion: enabled }),
      setSrsProgressionCardDisplayMode: (mode) =>
        set({
          srsProgressionCardDisplayMode:
            normalizeSrsProgressionCardDisplayMode(mode),
        }),
      setRadicalColor: (color) => set({ radicalColor: color }),
      setKanjiColor: (color) => set({ kanjiColor: color }),
      setVocabularyColor: (color) => set({ vocabularyColor: color }),
      setForecastShowSubjectColors: (show) =>
        set({ forecastShowSubjectColors: show }),
      setShowPitchAccent: (show) => set({ showPitchAccent: show }),
      setShowPatternsOfUse: (show) => set({ showPatternsOfUse: show }),
      setShowSimilarVocabulary: (show) => set({ showSimilarVocabulary: show }),
      setShowSingleKanjiVocabularySimilarKanji: (show) =>
        set({ showSingleKanjiVocabularySimilarKanji: show }),
      setShowMediaContextSentences: (show) =>
        set({ showMediaContextSentences: show }),
      setHideContextSentenceTranslations: (hide) =>
        set({ hideContextSentenceTranslations: hide }),
      setShowContextSentenceSpeedControl: (show) =>
        set({ showContextSentenceSpeedControl: show }),
      setShowMnemonicIllustrations: (show) =>
        set({ showMnemonicIllustrations: show }),
      setMyAnimeListUsername: (username) =>
        set({ myAnimeListUsername: username }),
      setAniListUsername: (username) =>
        set({ aniListUsername: username }),
      setImmersionKitAnimes: (animes) => set({ immersionKitAnimes: animes }),
      setShowBadgeNotifications: (show) =>
        set({ showBadgeNotifications: show }),
      setEnableReviewNotifications: (enable) =>
        set({ enableReviewNotifications: enable }),
      setDailyReviewReminderEnabled: (enable) =>
        set({ dailyReviewReminderEnabled: enable }),
      setDailyReviewReminderHour: (hour) =>
        set({ dailyReviewReminderHour: Math.min(23, Math.max(0, Math.floor(hour))) }),
      setDailyReviewReminderMinute: (minute) =>
        set({ dailyReviewReminderMinute: Math.min(59, Math.max(0, Math.floor(minute))) }),
      setDailyLessonReminderEnabled: (enable) =>
        set({ dailyLessonReminderEnabled: enable }),
      setDailyLessonReminderMinimum: (minimum) =>
        set({
          dailyLessonReminderMinimum: Math.min(
            100,
            Math.max(5, Math.floor(minimum))
          ),
        }),
      setGravatarEmail: (email) => set({ gravatarEmail: email }),
      setVocabTooltipEnabled: (enabled) =>
        set({ vocabTooltipEnabled: enabled }),
      setJitaiEnabled: (enabled) => set({ jitaiEnabled: enabled }),
      setJitaiSelectedFontIds: (fontIds) => set({ jitaiSelectedFontIds: fontIds }),
      setShowStrokeOrder: (show) => set({ showStrokeOrder: show }),
      setDisableAutoProgressOnWrong: (disable) =>
        set({ disableAutoProgressOnWrong: disable }),
      setDisableAutoProgressOnCloseAnswer: (disable) =>
        set({ disableAutoProgressOnCloseAnswer: disable }),
      setDisableAutoProgressOnCorrect: (disable) =>
        set({ disableAutoProgressOnCorrect: disable }),
      setAcceptUserSynonymsAsAnswers: (accept) =>
        set({ acceptUserSynonymsAsAnswers: accept }),
      setShowAddSynonymButton: (show) =>
        set({ showAddSynonymButton: show }),
      setAcceptAnyKanjiOnyomiReading: (accept) =>
        set({ acceptAnyKanjiOnyomiReading: accept }),
      setShowOnyomiInKatakana: (show) => set({ showOnyomiInKatakana: show }),
      setBackToBackQuestions: (enabled) => set({ backToBackQuestions: enabled }),
      setStrokeLeniency: (leniency) => set({ strokeLeniency: leniency }),
      setVisuallySimilarKanjiSource: (source) => set({ visuallySimilarKanjiSource: source }),
      setListeningAutoPlayAudio: (autoplay) => set({ listeningAutoPlayAudio: autoplay }),
      setNewsDefaultStudyMode: (mode) => set({ newsDefaultStudyMode: mode }),
      setHideVocabularyTooltipMeanings: (hide) =>
        set({ hideVocabularyTooltipMeanings: hide }),
      setHideVocabularyTooltipReadings: (hide) =>
        set({ hideVocabularyTooltipReadings: hide }),
      setSongsMusicSource: (source) => set({ songsMusicSource: source }),
      setSongsPlaybackSource: (source) => set({ songsPlaybackSource: source }),
      setSongsLyricsDefaultStudyMode: (mode) =>
        set({ songsLyricsDefaultStudyMode: mode }),
      setSongsLyricsLineTranslationsEnabled: (enabled) =>
        set({ songsLyricsLineTranslationsEnabled: enabled }),
      setAppleMusicAuthStatus: (status) => set({ appleMusicAuthStatus: status }),
      setLastSeenPatchNotesVersion: (version) => set({ lastSeenPatchNotesVersion: version }),
      setBunproSurveyCompleted: (completed) => set({ bunproSurveyCompleted: completed }),
      setCustomTabOrder: (tabs) =>
        set({ customTabOrder: normalizeCustomTabOrder(tabs) }),
      setHomeWidgetOrder: (widgets) =>
        set({ homeWidgetOrder: normalizeHomeWidgetOrder(widgets) }),
      addHomeWidget: (widget) =>
        set((state) => {
          if (state.homeWidgetOrder.includes(widget)) {
            return {};
          }

          return {
            homeWidgetOrder: [...state.homeWidgetOrder, widget],
          };
        }),
      removeHomeWidget: (widget) =>
        set((state) => {
          if (widget === "lessonsReviews") {
            return {};
          }

          const filtered = state.homeWidgetOrder.filter((id) => id !== widget);
          return {
            homeWidgetOrder:
              filtered.length > 0
                ? filtered
                : [...DEFAULT_HOME_WIDGET_ORDER],
          };
        }),
      resetHomeWidgetOrder: () =>
        set({ homeWidgetOrder: [...DEFAULT_HOME_WIDGET_ORDER] }),
      setHomeExtraStudyModeOrder: (modes) =>
        set((state) => {
          const normalizedModes = [...modes];
          return {
            homeExtraStudyModeOrder: normalizedModes,
            homeExtraStudyHiddenModeIds:
              state.homeExtraStudyHiddenModeIds.filter(
                (id) => !normalizedModes.includes(id),
              ),
          };
        }),
      addHomeExtraStudyMode: (mode) =>
        set((state) => {
          const hiddenWithoutMode = state.homeExtraStudyHiddenModeIds.filter(
            (id) => id !== mode,
          );

          if (state.homeExtraStudyModeOrder.includes(mode)) {
            return hiddenWithoutMode.length ===
              state.homeExtraStudyHiddenModeIds.length
              ? {}
              : { homeExtraStudyHiddenModeIds: hiddenWithoutMode };
          }

          return {
            homeExtraStudyModeOrder: [...state.homeExtraStudyModeOrder, mode],
            homeExtraStudyHiddenModeIds: hiddenWithoutMode,
          };
        }),
      removeHomeExtraStudyMode: (mode) =>
        set((state) => {
          const filtered = state.homeExtraStudyModeOrder.filter((id) => id !== mode);
          const hiddenWithMode = state.homeExtraStudyHiddenModeIds.includes(mode)
            ? state.homeExtraStudyHiddenModeIds
            : [...state.homeExtraStudyHiddenModeIds, mode];

          if (filtered.length <= 0) {
            return {
              homeExtraStudyModeOrder: [...DEFAULT_HOME_EXTRA_STUDY_MODE_ORDER],
              homeExtraStudyHiddenModeIds: [],
            };
          }

          return {
            homeExtraStudyModeOrder: filtered,
            homeExtraStudyHiddenModeIds: hiddenWithMode,
          };
        }),
      resetHomeExtraStudyModeOrder: () =>
        set({
          homeExtraStudyModeOrder: [...DEFAULT_HOME_EXTRA_STUDY_MODE_ORDER],
          homeExtraStudyHiddenModeIds: [],
        }),
      setHomeRecentLessonsWindow: (window) =>
        set({ homeRecentLessonsWindow: window }),
      setHomeSrsBreakdownDisplayMode: (mode) =>
        set({
          homeSrsBreakdownDisplayMode:
            normalizeHomeSrsBreakdownDisplayMode(mode),
        }),
      setWidgetContentMode: (mode) => set({ widgetContentMode: mode }),
      setWidgetStreakGradient: (preset) =>
        set({ widgetStreakGradient: preset }),
      setWidgetCardsFollowTheme: (follow) =>
        set({ widgetCardsFollowTheme: follow }),
      setWidgetLessonCardFollowTheme: (follow) =>
        set({ widgetLessonCardFollowTheme: follow }),
      setWidgetReviewCardFollowTheme: (follow) =>
        set({ widgetReviewCardFollowTheme: follow }),
      setWidgetStreakCardFollowTheme: (follow) =>
        set({ widgetStreakCardFollowTheme: follow }),
      setWidgetSrsBreakdownGroupStages: (grouped) =>
        set({ widgetSrsBreakdownGroupStages: grouped }),
      setWidgetSrsBreakdownGraphGroupStages: (grouped) =>
        set({ widgetSrsBreakdownGraphGroupStages: grouped }),
      setWidgetSrsBreakdownDetailsGroupStages: (grouped) =>
        set({ widgetSrsBreakdownDetailsGroupStages: grouped }),
      setWidgetCardStyleColor: (key, color) =>
        set({ [key]: color } as Partial<SettingsState>),
      setAnalyticsWidgetStyleColor: (key, color) =>
        set({ [key]: color } as Partial<SettingsState>),
    }),
    {
      name: "wanikani-settings",
      storage: createJSONStorage(() => createDurableSettingsStorage()),
      version: SETTINGS_STORE_SCHEMA_VERSION,
      migrate: (persistedState, version) => {
        const migrated = migratePersistedObject<SettingsState>(persistedState);
        const migratedRecord = migrated as SettingsState & {
          homeSrsBreakdownSplitWidgets?: boolean;
          showSrsIndicator?: boolean;
          widgetSrsBreakdownGraphGroupStages?: boolean;
          widgetSrsBreakdownDetailsGroupStages?: boolean;
          backToBackImmediateRetryIncorrect?: boolean;
          reviewAnimatePreviousQuestion?: boolean;
          customTabOrder?: unknown;
          lessonPickerViewMode?: unknown;
          reviewCharacterFontScale?: unknown;
          hideVocabularyTooltipMeanings?: unknown;
          hideVocabularyTooltipReadings?: unknown;
        };

        if (version < 2 && typeof migratedRecord.homeSrsBreakdownDisplayMode !== "string") {
          migratedRecord.homeSrsBreakdownDisplayMode =
            migratedRecord.homeSrsBreakdownSplitWidgets === true
              ? "split"
              : "combined";
        } else {
          migratedRecord.homeSrsBreakdownDisplayMode =
            normalizeHomeSrsBreakdownDisplayMode(
              migratedRecord.homeSrsBreakdownDisplayMode
            );
        }

        if (version < 3) {
          migratedRecord.srsProgressionCardDisplayMode =
            migratedRecord.showSrsIndicator === false ? "hidden" : "normal";
        } else {
          migratedRecord.srsProgressionCardDisplayMode =
            normalizeSrsProgressionCardDisplayMode(
              migratedRecord.srsProgressionCardDisplayMode
            );
        }

        if (version < 4) {
          const fallbackGrouped =
            migratedRecord.widgetSrsBreakdownGroupStages === true;

          if (
            typeof migratedRecord.widgetSrsBreakdownGraphGroupStages !==
            "boolean"
          ) {
            migratedRecord.widgetSrsBreakdownGraphGroupStages = fallbackGrouped;
          }
          if (
            typeof migratedRecord.widgetSrsBreakdownDetailsGroupStages !==
            "boolean"
          ) {
            migratedRecord.widgetSrsBreakdownDetailsGroupStages =
              fallbackGrouped;
          }
        }

        if (version < 5) {
          migratedRecord.backToBackImmediateRetryIncorrect = false;
        } else if (
          typeof migratedRecord.backToBackImmediateRetryIncorrect !== "boolean"
        ) {
          migratedRecord.backToBackImmediateRetryIncorrect = false;
        }

        const normalizedExtraStudyOrder =
          Array.isArray(migratedRecord.homeExtraStudyModeOrder)
            ? migratedRecord.homeExtraStudyModeOrder.filter(
                (value): value is ExtraStudyModeId => typeof value === "string",
              )
            : [];

        if (version < 6) {
          const hiddenFromLegacyOptOut =
            LEGACY_DEFAULT_HOME_EXTRA_STUDY_MODE_ORDER_V5.filter(
              (modeId) => !normalizedExtraStudyOrder.includes(modeId),
            );
          migratedRecord.homeExtraStudyHiddenModeIds =
            normalizeHomeExtraStudyHiddenModeIds(hiddenFromLegacyOptOut);
        } else {
          migratedRecord.homeExtraStudyHiddenModeIds =
            normalizeHomeExtraStudyHiddenModeIds(
              migratedRecord.homeExtraStudyHiddenModeIds,
            );
        }

        if (version < 7) {
          migratedRecord.reviewAnimatePreviousQuestion = true;
        } else if (
          typeof migratedRecord.reviewAnimatePreviousQuestion !== "boolean"
        ) {
          migratedRecord.reviewAnimatePreviousQuestion = true;
        }

        migratedRecord.lessonPickerViewMode = normalizeLessonPickerViewMode(
          migratedRecord.lessonPickerViewMode
        );

        const normalizedCustomTabs = normalizeCustomTabOrder(
          migratedRecord.customTabOrder
        );

        // Add Bunpro to existing installs while preserving custom ordering.
        if (version < 8 && !normalizedCustomTabs.includes("bunpro")) {
          normalizedCustomTabs.push("bunpro");
        }
        migratedRecord.customTabOrder = normalizedCustomTabs;
        migratedRecord.reviewCharacterFontScale =
          normalizeReviewCharacterFontScale(
            migratedRecord.reviewCharacterFontScale
          );
        if (
          version < 11 ||
          typeof migratedRecord.hideVocabularyTooltipMeanings !== "boolean"
        ) {
          migratedRecord.hideVocabularyTooltipMeanings = false;
        }
        if (
          version < 11 ||
          typeof migratedRecord.hideVocabularyTooltipReadings !== "boolean"
        ) {
          migratedRecord.hideVocabularyTooltipReadings = false;
        }

        return migrated;
      },
    }
  )
);
