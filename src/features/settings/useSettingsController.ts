import { Ionicons } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as Notifications from "expo-notifications";
import { router, useLocalSearchParams } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  InteractionManager,
  Linking,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Share,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputKeyPressEventData,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "../../contexts/AuthContext";
import { getCurrentPatchNotesVersion } from "../../data/patchNotes";
import { rateAppService } from "../../services/rateAppService";
import { bunproSurveyService } from "../../services/bunproSurveyService";
import { useDashboardData } from "../../hooks/useDashboardData";
import KeyboardManager, {
  JAPANESE_KEYBOARD_SETUP_INSTRUCTIONS,
} from "../../modules/KeyboardManager";
import ReviewNotificationManager, {
  type PendingNotificationsResult,
} from "../../modules/ReviewNotificationManager";
import { useAppleMusicAuthCompat } from "../../hooks/useAppleMusicAuthCompat";
import {
  clearOfflineVocabularyAudioCache,
  getOfflineVocabularyAudioCacheStats,
  getOfflineVocabularyAudioProgress,
  queueOfflineVocabularyAudioDownloads,
  subscribeOfflineVocabularyAudioProgress,
  type OfflineVocabularyAudioProgress,
} from "../../services/offlineVocabularyAudioService";
import {
  clearInMemoryCache,
  fetchAllPages,
  getSubjects,
} from "../../utils/api";
import { apiDebugger } from "../../utils/apiDebugger";
import { isPortegoUsername } from "../../utils/portegoAccess";
import { azureSpeechService, JAPANESE_VOICES } from "../../utils/azureSpeech";
import {
  clearBadgeCount,
  updateBadgeWithReviewCount,
} from "../../utils/badgeNotifications";
import {
  checkSubjectsCacheHealth,
  clearCache,
  repairSubjectsCache,
  type CacheHealthStatus,
} from "../../utils/cache";
import {
  analyzeCacheStorage,
  analyzeSubjectsCache,
  clearLargeCache,
  type CacheAnalysisResult,
} from "../../utils/cacheAnalyzer";
import { quickOptimize } from "../../utils/cacheOptimizer";
import { hasFeatureAccess } from "../../utils/featureFlags";
import {
  requestNotificationPermissions,
  updateBadgeAndScheduleNotifications,
} from "../../utils/reviewNotificationIntegration";
import {
  cancelReviewNotifications,
  initializeReviewNotifications,
  scheduleReviewChecks,
  syncDailyReminderNotifications,
} from "../../utils/reviewNotifications";
import {
  getReviewOrderLabel,
  DEFAULT_MAX_QUESTION_GAP,
} from "../../utils/reviewOrdering";
import { getLessonOrderLabel } from "../../utils/lessonOrdering";
import { isIOSOnMac } from "../../utils/platformSupport";
import {
  clearJpdbApiKey,
  getStoredJpdbApiKey,
  saveJpdbApiKey,
  validateJpdbApiKey,
} from "../../utils/jpdbApi";
import {
  buildLevelAnalyticsExportRows,
  buildLevelAnalyticsDetailedExportRows,
  getAvailableLevelAnalyticsLevels,
  type LevelAnalyticsExportRow,
  type LevelAnalyticsDetailedExportRow,
  serializeLevelAnalyticsExportRows,
  serializeLevelAnalyticsDetailedExportRows,
} from "../../utils/levelAnalyticsExport";
import {
  REVIEW_CHARACTER_FONT_SCALE_MAX,
  REVIEW_CHARACTER_FONT_SCALE_MIN,
  REVIEW_CHARACTER_FONT_SCALE_STEP,
  type SrsProgressionCardDisplayMode,
  type StudyModePreference,
  type VocabularyAudioVoicePreference,
  useAuthStore,
  useSettingsStore,
} from "../../utils/store";
import {
  formatReviewShortcutLabel,
  normalizeReviewShortcutKey,
  resolveReviewCorrectKeyboardShortcuts,
  resolveReviewIncorrectKeyboardShortcuts,
  sanitizeReviewShortcutInput,
  type ReviewCorrectKeyboardShortcutSettings,
  type ReviewIncorrectKeyboardShortcutSettings,
} from "../../utils/reviewKeyboardShortcuts";
import { useTheme } from "../../utils/theme";
// Dev only imports
let PerformanceDashboard: any = null;
if (__DEV__) {
  PerformanceDashboard =
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require("../../components/PerformanceDashboard").default;
}

const VOCABULARY_AUDIO_VOICE_OPTIONS: {
  value: VocabularyAudioVoicePreference;
  label: string;
  systemImage: string;
}[] = [
  { value: "female", label: "Kyoko (Female)", systemImage: "person.fill" },
  { value: "male", label: "Kenichi (Male)", systemImage: "person.fill" },
  { value: "random", label: "Random", systemImage: "shuffle" },
  { value: "both", label: "Both", systemImage: "person.2.fill" },
];

const VOCABULARY_AUDIO_VOICE_LABELS: Record<
  VocabularyAudioVoicePreference,
  string
> = {
  female: "Kyoko",
  male: "Kenichi",
  random: "Random",
  both: "Both",
};

const STUDY_MODE_DEFAULT_OPTIONS: {
  value: StudyModePreference;
  label: string;
}[] = [
  { value: "none", label: "Normal" },
  { value: "wk", label: "Vocab" },
  { value: "full", label: "Full" },
];

const SRS_PROGRESSION_CARD_MODE_OPTIONS: {
  value: SrsProgressionCardDisplayMode;
  label: string;
}[] = [
  { value: "normal", label: "Normal" },
  { value: "compact", label: "Compact" },
  { value: "hidden", label: "Hidden" },
];

const SRS_PROGRESSION_CARD_MODE_LABELS: Record<
  SrsProgressionCardDisplayMode,
  string
> = {
  normal: "Normal",
  compact: "Compact",
  hidden: "Hidden",
};

function formatByteSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) {
    return "...";
  }
  if (bytes === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function formatCount(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) {
    return "...";
  }
  return Math.floor(value).toLocaleString();
}

function formatReviewCharacterFontScale(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

const REVIEW_INCORRECT_SHORTCUT_FIELDS: {
  key: keyof ReviewIncorrectKeyboardShortcutSettings;
  label: string;
  hint: string;
}[] = [
  {
    key: "markIncorrect",
    label: "Mark Incorrect",
    hint: "Progress while keeping the answer incorrect.",
  },
  {
    key: "markCorrect",
    label: "Mark Correct",
    hint: "Override wrong answer as correct.",
  },
  {
    key: "askAgain",
    label: "Skip",
    hint: "Skip and requeue without marking incorrect.",
  },
  {
    key: "addSynonym",
    label: "Add as Synonym",
    hint: "Meaning questions only.",
  },
  {
    key: "openDetails",
    label: "Open Details",
    hint: "Open the current subject details page.",
  },
  {
    key: "replayAudio",
    label: "Replay Audio",
    hint: "Replay vocabulary pronunciation audio.",
  },
];

const REVIEW_CORRECT_SHORTCUT_FIELDS: {
  key: keyof ReviewCorrectKeyboardShortcutSettings;
  label: string;
  hint: string;
}[] = [
  {
    key: "advanceOnCorrect",
    label: "Advance",
    hint: "Continue after a correct answer pause.",
  },
  {
    key: "replayAudio",
    label: "Replay Audio",
    hint: "Replay vocabulary pronunciation audio.",
  },
];

const PATREON_URL = "https://www.patreon.com/15731284/join";
const JPDB_SETTINGS_URL = "https://jpdb.io/settings";
const STOP_DETAILS_PREVIEW_IMAGE = require("../../../assets/images/StopDetails.png");
export const STOP_DETAILS_PREVIEW_ASPECT_RATIO = 1320 / 2868;

type ReviewShortcutCaptureTarget =
  | {
      group: "incorrect";
      key: keyof ReviewIncorrectKeyboardShortcutSettings;
    }
  | {
      group: "correct";
      key: keyof ReviewCorrectKeyboardShortcutSettings;
    };

type LevelAnalyticsExportFormat = "summary" | "detailed";

type SettingsSectionKey =
  | "support"
  | "voice"
  | "vocabContext"
  | "readingDefaults"
  | "musicPlayback"
  | "lessons"
  | "subjectLists"
  | "reviews"
  | "haptic"
  | "kanji"
  | "profile"
  | "appearance"
  | "theme"
  | "widgets"
  | "notifications"
  | "dataStorage"
  | "levelRecap"
  | "patreon"
  | "account"
  | "apiDebug";

type SettingsSectionChip = {
  key: SettingsSectionKey;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

type SettingsSectionChipLayout = {
  x: number;
  width: number;
};

const SCROLL_TO_SECTION_KEY_MAP: Record<string, SettingsSectionKey> = {
  profile: "profile",
  reviews: "reviews",
  kanji: "kanji",
  lessons: "lessons",
  vocabContext: "vocabContext",
  subjectLists: "subjectLists",
  levelRecap: "levelRecap",
  jpdbApiKey: "profile",
  jpdb: "profile",
};

function resolveSectionKeyFromScrollParam(
  scrollToParam: string | undefined,
): SettingsSectionKey | null {
  if (!scrollToParam) {
    return null;
  }

  return SCROLL_TO_SECTION_KEY_MAP[scrollToParam] ?? null;
}

function normalizeToSteppedRange(
  rawValue: number,
  min: number,
  max: number,
  step: number,
): number {
  const boundedValue = Math.min(max, Math.max(min, Math.floor(rawValue)));
  const roundedToStep = Math.round(boundedValue / step) * step;
  return Math.min(max, Math.max(min, roundedToStep));
}

export function useSettingsController() {
  const { signOut } = useSession();
  const { logout } = useAuthStore();
  const { dashboardData } = useDashboardData();
  const { theme, isDark, themeMode, setThemeMode } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const isRunningOnMacFromIOS = isIOSOnMac();
  const insets = useSafeAreaInsets();
  const sheetHorizontalPadding = 12;
  const sheetBottomPadding = 12;
  const answerStopPreviewImageHeight = Math.min(
    540,
    Math.max(360, windowHeight * 0.55),
  );
  const reviewShortcutSheetTopPadding = Math.max(insets.top + 8, 12);
  const modalHeaderPaddingTop =
    24 + (Platform.OS === "android" ? insets.top : 0);
  const settingsBottomPadding =
    Platform.OS === "android" ? Math.max(insets.bottom, 16) : 16;
  const {
    lessonBatchSize,
    setLessonBatchSize,
    dailyLessonLimit,
    setDailyLessonLimit,
    lessonPickerViewMode,
    setLessonPickerViewMode,
    singlePageLessonView,
    setSinglePageLessonView,
    skipCustomLessonQuiz,
    setSkipCustomLessonQuiz,
    excludeKanaVocabularyFromLessons,
    setExcludeKanaVocabularyFromLessons,
    reviewBatchSizeEnabled,
    setReviewBatchSizeEnabled,
    reviewBatchSize,
    setReviewBatchSize,
    reviewWrapUpTargetSubjects,
    setReviewWrapUpTargetSubjects,
    reviewSearchButtonEnabled,
    setReviewSearchButtonEnabled,
    reviewCharacterFontScale,
    setReviewCharacterFontScale,
    allowSkippingReviews,
    setAllowSkippingReviews,
    showBadgeNotifications,
    setShowBadgeNotifications,
    enableReviewNotifications,
    setEnableReviewNotifications,
    dailyReviewReminderEnabled,
    setDailyReviewReminderEnabled,
    dailyReviewReminderHour,
    setDailyReviewReminderHour,
    dailyReviewReminderMinute,
    setDailyReviewReminderMinute,
    dailyLessonReminderEnabled,
    setDailyLessonReminderEnabled,
    dailyLessonReminderMinimum,
    setDailyLessonReminderMinimum,
    ankiCardMode,
    setAnkiCardMode,
    ankiGroupQuestions,
    ankiCardModeScope,
    ankiButtonlessMode,
    setAnkiButtonlessMode,
    ankiShowOtherAcceptedAnswersAndUserSynonyms,
    setAnkiShowOtherAcceptedAnswersAndUserSynonyms,
    reviewOrder,
    reviewTypeOrderEnabled,
    lessonOrder,
    lessonTypeOrderEnabled,
    interleaveLessonTypesEnabled,
    prioritizeCriticalItems,
    setPrioritizeCriticalItems,
    autoplayVocabularyAudio,
    setAutoplayVocabularyAudio,
    autoplayLessonReadingAudio,
    setAutoplayLessonReadingAudio,
    vocabularyAudioVoice,
    setVocabularyAudioVoice,
    offlineVocabularyAudioEnabled,
    setOfflineVocabularyAudioEnabled,
    showPitchAccent,
    setShowPitchAccent,
    showPatternsOfUse,
    setShowPatternsOfUse,
    showSimilarVocabulary,
    setShowSimilarVocabulary,
    showSingleKanjiVocabularySimilarKanji,
    setShowSingleKanjiVocabularySimilarKanji,
    showMediaContextSentences,
    setShowMediaContextSentences,
    hideContextSentenceTranslations,
    setHideContextSentenceTranslations,
    showContextSentenceSpeedControl,
    setShowContextSentenceSpeedControl,
    showMnemonicIllustrations,
    setShowMnemonicIllustrations,
    myAnimeListUsername,
    setMyAnimeListUsername,
    gravatarEmail,
    setGravatarEmail,
    jitaiEnabled,
    setJitaiEnabled,
    jitaiSelectedFontIds,
    showStrokeOrder,
    setShowStrokeOrder,
    disableAutoProgressOnWrong,
    setDisableAutoProgressOnWrong,
    disableAutoProgressOnCloseAnswer,
    setDisableAutoProgressOnCloseAnswer,
    disableAutoProgressOnCorrect,
    setDisableAutoProgressOnCorrect,
    acceptUserSynonymsAsAnswers,
    setAcceptUserSynonymsAsAnswers,
    showAddSynonymButton,
    setShowAddSynonymButton,
    acceptAnyKanjiOnyomiReading,
    setAcceptAnyKanjiOnyomiReading,
    showOnyomiInKatakana,
    setShowOnyomiInKatakana,
    backToBackQuestions,
    setBackToBackQuestions,
    backToBackImmediateRetryIncorrect,
    setBackToBackImmediateRetryIncorrect,
    autoSwitchKeyboard,
    setAutoSwitchKeyboard,
    voiceReviewAnswersEnabled,
    setVoiceReviewAnswersEnabled,
    hapticFeedbackEnabled,
    setHapticFeedbackEnabled,
    reviewIncorrectKeyboardShortcuts,
    setReviewIncorrectKeyboardShortcuts,
    reviewCorrectKeyboardShortcuts,
    setReviewCorrectKeyboardShortcuts,
    showAnswerStopSubjectDetails,
    setShowAnswerStopSubjectDetails,
    showReviewItemLevelAndSrsStage,
    setShowReviewItemLevelAndSrsStage,
    reviewAnimatePreviousQuestion,
    setReviewAnimatePreviousQuestion,
    srsProgressionCardDisplayMode,
    setSrsProgressionCardDisplayMode,
    strokeLeniency,
    setStrokeLeniency,
    visuallySimilarKanjiSource,
    setVisuallySimilarKanjiSource,
    newsDefaultStudyMode,
    setNewsDefaultStudyMode,
    songsPlaybackSource,
    setSongsPlaybackSource,
    songsLyricsDefaultStudyMode,
    setSongsLyricsDefaultStudyMode,
    appleMusicAuthStatus,
    setAppleMusicAuthStatus,
    lastSeenPatchNotesVersion,
    bunproSurveyCompleted,
    setBunproSurveyCompleted,
  } = useSettingsStore();
  const {
    available: isAppleMusicAuthAvailable,
    requestAuthorization: requestAppleMusicAuthorization,
    checkSubscription: checkAppleMusicSubscription,
    isAuthenticating: isAppleMusicAuthenticating,
    error: appleMusicAuthError,
  } = useAppleMusicAuthCompat();
  const [selectedVoice, setSelectedVoice] =
    useState<string>("ja-JP-NanamiNeural");
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showOpenSourceModal, setShowOpenSourceModal] = useState(false);
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);
  const [cacheAnalysis, setCacheAnalysis] =
    useState<CacheAnalysisResult | null>(null);
  const [showCacheModal, setShowCacheModal] = useState(false);
  const [isAnalyzingCache, setIsAnalyzingCache] = useState(false);
  const [showPerformanceDashboard, setShowPerformanceDashboard] =
    useState(false); // Dev only state
  const [pendingNotifications, setPendingNotifications] =
    useState<PendingNotificationsResult | null>(null);
  const [expoPendingNotifications, setExpoPendingNotifications] = useState<
    Notifications.NotificationRequest[]
  >([]);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showVocabularyVoiceMenu, setShowVocabularyVoiceMenu] = useState(false);
  const [showSrsProgressionCardModeMenu, setShowSrsProgressionCardModeMenu] =
    useState(false);
  const [showReminderTimeModal, setShowReminderTimeModal] = useState(false);
  const [showReviewShortcutModal, setShowReviewShortcutModal] = useState(false);
  const [showAnswerStopDetailsPreview, setShowAnswerStopDetailsPreview] =
    useState(false);
  const [showBunproSurveyModal, setShowBunproSurveyModal] = useState(false);
  const [offlineAudioProgress, setOfflineAudioProgress] =
    useState<OfflineVocabularyAudioProgress>(() =>
      getOfflineVocabularyAudioProgress(),
    );
  const [offlineAudioCacheSizeBytes, setOfflineAudioCacheSizeBytes] = useState<
    number | null
  >(null);
  const [offlineAudioCacheFileCount, setOfflineAudioCacheFileCount] = useState<
    number | null
  >(null);
  const [isClearingOfflineAudioCache, setIsClearingOfflineAudioCache] =
    useState(false);
  const [reviewIncorrectShortcutDraft, setReviewIncorrectShortcutDraft] =
    useState<ReviewIncorrectKeyboardShortcutSettings>(
      resolveReviewIncorrectKeyboardShortcuts(reviewIncorrectKeyboardShortcuts),
    );
  const [reviewCorrectShortcutDraft, setReviewCorrectShortcutDraft] =
    useState<ReviewCorrectKeyboardShortcutSettings>(
      resolveReviewCorrectKeyboardShortcuts(reviewCorrectKeyboardShortcuts),
    );
  const [capturingReviewShortcutKey, setCapturingReviewShortcutKey] =
    useState<ReviewShortcutCaptureTarget | null>(null);
  const reviewShortcutCaptureInputRef = useRef<TextInput>(null);
  const offlineCacheRefreshInFlightRef = useRef(false);
  const previousOfflineAudioInProgressRef = useRef(
    getOfflineVocabularyAudioProgress().inProgress,
  );
  const [reminderHourDraft, setReminderHourDraft] = useState(
    dailyReviewReminderHour,
  );
  const [reminderMinuteDraft, setReminderMinuteDraft] = useState(
    dailyReviewReminderMinute,
  );
  const [cacheHealthStatus, setCacheHealthStatus] =
    useState<CacheHealthStatus | null>(null);
  const [isCheckingCacheHealth, setIsCheckingCacheHealth] = useState(false);
  const [isRepairingCache, setIsRepairingCache] = useState(false);
  const [isExportingLevelAnalytics, setIsExportingLevelAnalytics] =
    useState(false);
  const [showLevelAnalyticsExportModal, setShowLevelAnalyticsExportModal] =
    useState(false);
  const [levelAnalyticsExportFormat, setLevelAnalyticsExportFormat] =
    useState<LevelAnalyticsExportFormat>("detailed");
  const [selectedLevelAnalyticsLevels, setSelectedLevelAnalyticsLevels] =
    useState<number[]>([]);
  const { apiToken, userData } = useAuthStore();

  const [gravatarEmailInput, setGravatarEmailInput] = useState<string>(
    gravatarEmail ?? "",
  );
  const [jpdbApiKeyInput, setJpdbApiKeyInput] = useState<string>("");
  const [hasStoredJpdbApiKey, setHasStoredJpdbApiKey] = useState(false);
  const [isLoadingJpdbApiKey, setIsLoadingJpdbApiKey] = useState(true);
  const [isSavingJpdbApiKey, setIsSavingJpdbApiKey] = useState(false);
  const [jpdbApiKeyStatus, setJpdbApiKeyStatus] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);
  const [bunproUsageAnswer, setBunproUsageAnswer] = useState<
    "yes" | "no" | null
  >(null);
  const [bunproIntegrationAnswer, setBunproIntegrationAnswer] = useState<
    "yes" | "no" | null
  >(null);
  const [bunproFeatureRequestInput, setBunproFeatureRequestInput] =
    useState("");
  const [isSubmittingBunproSurvey, setIsSubmittingBunproSurvey] =
    useState(false);
  const normalizedEmail = gravatarEmail?.trim().toLowerCase() ?? "";
  const isSongsHiddenForEmail = normalizedEmail === "kakehashi.app@gmail.com";
  const isPortegoUser = isPortegoUsername(userData?.username);
  const showBunproSurvey = !bunproSurveyCompleted;
  const canAccessApiDebugTools = __DEV__ || isPortegoUser;
  const scrollViewRef = useRef<ScrollView>(null);
  const sectionChipScrollViewRef = useRef<ScrollView>(null);
  const showMusicPlaybackSection =
    !isSongsHiddenForEmail && Platform.OS === "ios";
  const showWidgetsSection = Platform.OS === "ios";
  const showDataStorageSection = hasFeatureAccess(
    "cache_management",
    gravatarEmail,
  );
  const showLevelRecapSection = dashboardData.currentLevel > 0;
  const params = useLocalSearchParams();
  const scrollToParam = Array.isArray(params.scrollTo)
    ? params.scrollTo[0]
    : params.scrollTo;
  const [selectedSectionKey, setSelectedSectionKey] =
    useState<SettingsSectionKey>(
      () => resolveSectionKeyFromScrollParam(scrollToParam) ?? "support",
    );
  const [sectionChipBarWidth, setSectionChipBarWidth] = useState(0);
  const [sectionChipLayouts, setSectionChipLayouts] = useState<
    Partial<Record<SettingsSectionKey, SettingsSectionChipLayout>>
  >({});
  const [sectionOffsets, setSectionOffsets] = useState<
    Partial<Record<SettingsSectionKey, number>>
  >({});
  const [pendingSectionScrollRequest, setPendingSectionScrollRequest] =
    useState<{ key: SettingsSectionKey; animated: boolean } | null>(() => {
      const sectionKey = resolveSectionKeyFromScrollParam(scrollToParam);
      if (!sectionKey) {
        return null;
      }

      return { key: sectionKey, animated: false };
    });
  const sectionChips = useMemo<SettingsSectionChip[]>(() => {
    const chips: SettingsSectionChip[] = [
      { key: "support", label: "Support", icon: "heart-outline" },
      { key: "voice", label: "Voice", icon: "volume-high-outline" },
      { key: "vocabContext", label: "Vocab Context", icon: "book-outline" },
      { key: "readingDefaults", label: "Reading", icon: "newspaper-outline" },
    ];

    if (showMusicPlaybackSection) {
      chips.push({
        key: "musicPlayback",
        label: "Music",
        icon: "musical-notes-outline",
      });
    }

    chips.push(
      { key: "lessons", label: "Lessons", icon: "school-outline" },
      { key: "subjectLists", label: "Subject Lists", icon: "list-outline" },
      { key: "reviews", label: "Reviews", icon: "checkmark-done-outline" },
      { key: "haptic", label: "Haptic", icon: "phone-portrait-outline" },
      { key: "kanji", label: "Kanji", icon: "brush-outline" },
      { key: "profile", label: "Profile", icon: "person-circle-outline" },
      { key: "appearance", label: "Appearance", icon: "color-palette-outline" },
      { key: "theme", label: "Theme", icon: "contrast-outline" },
    );

    if (showWidgetsSection) {
      chips.push({ key: "widgets", label: "Widgets", icon: "grid-outline" });
    }

    chips.push({
      key: "notifications",
      label: "Notifications",
      icon: "notifications-outline",
    });

    if (showDataStorageSection) {
      chips.push({ key: "dataStorage", label: "Data", icon: "server-outline" });
    }
    if (showLevelRecapSection) {
      chips.push({
        key: "levelRecap",
        label: "Level Recap",
        icon: "bar-chart-outline",
      });
    }

    chips.push(
      { key: "patreon", label: "Patreon", icon: "people-outline" },
      { key: "account", label: "Account", icon: "log-out-outline" },
    );

    if (canAccessApiDebugTools) {
      chips.push({ key: "apiDebug", label: "API Debug", icon: "bug-outline" });
    }

    return chips;
  }, [
    canAccessApiDebugTools,
    showDataStorageSection,
    showLevelRecapSection,
    showMusicPlaybackSection,
    showWidgetsSection,
  ]);
  const updateSectionOffset = useCallback(
    (sectionKey: SettingsSectionKey, sectionY: number) => {
      const normalizedY = Math.max(0, sectionY);
      setSectionOffsets((current) => {
        const previousY = current[sectionKey];
        if (
          typeof previousY === "number" &&
          Math.abs(previousY - normalizedY) < 1
        ) {
          return current;
        }
        return {
          ...current,
          [sectionKey]: normalizedY,
        };
      });
    },
    [],
  );
  const updateSectionChipLayout = useCallback(
    (sectionKey: SettingsSectionKey, x: number, width: number) => {
      setSectionChipLayouts((current) => {
        const previousLayout = current[sectionKey];
        if (
          previousLayout &&
          Math.abs(previousLayout.x - x) < 1 &&
          Math.abs(previousLayout.width - width) < 1
        ) {
          return current;
        }

        return {
          ...current,
          [sectionKey]: { x, width },
        };
      });
    },
    [],
  );
  const scrollToSection = useCallback(
    (sectionKey: SettingsSectionKey, animated: boolean) => {
      setSelectedSectionKey(sectionKey);
      const targetY = sectionOffsets[sectionKey];
      if (typeof targetY !== "number") {
        setPendingSectionScrollRequest({ key: sectionKey, animated });
        return;
      }

      setPendingSectionScrollRequest(null);
      scrollViewRef.current?.scrollTo({
        y: Math.max(0, targetY - 8),
        animated,
      });
    },
    [sectionOffsets],
  );
  const handleSettingsScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const visibleSections = sectionChips
        .map((chip) => {
          const offset = sectionOffsets[chip.key];
          if (typeof offset !== "number") {
            return null;
          }
          return {
            key: chip.key,
            offset,
          };
        })
        .filter(
          (section): section is { key: SettingsSectionKey; offset: number } =>
            section !== null,
        )
        .sort((a, b) => a.offset - b.offset);

      if (visibleSections.length === 0) {
        return;
      }

      const scrollY = Math.max(0, event.nativeEvent.contentOffset.y) + 24;
      let activeSectionKey = visibleSections[0].key;

      for (const section of visibleSections) {
        if (scrollY >= section.offset) {
          activeSectionKey = section.key;
        } else {
          break;
        }
      }

      setSelectedSectionKey((current) =>
        current === activeSectionKey ? current : activeSectionKey,
      );
    },
    [sectionChips, sectionOffsets],
  );
  const availableLevelAnalyticsLevels = useMemo(
    () =>
      getAvailableLevelAnalyticsLevels({
        subjects: dashboardData.subjects,
        assignments: dashboardData.assignments,
        levelProgressions: dashboardData.levelProgressions,
        resets: dashboardData.resets,
        currentLevel: dashboardData.currentLevel,
        username: userData?.username ?? "",
      }),
    [
      dashboardData.assignments,
      dashboardData.currentLevel,
      dashboardData.levelProgressions,
      dashboardData.resets,
      dashboardData.subjects,
      userData?.username,
    ],
  );

  useEffect(() => {
    apiDebugger.setDebugAccessByUsername(userData?.username);
  }, [userData?.username]);

  useEffect(() => {
    const requestedSectionKey = resolveSectionKeyFromScrollParam(scrollToParam);
    if (!requestedSectionKey) {
      return;
    }
    setSelectedSectionKey(requestedSectionKey);
    setPendingSectionScrollRequest({
      key: requestedSectionKey,
      animated: false,
    });
  }, [scrollToParam]);

  useEffect(() => {
    if (sectionChips.some((chip) => chip.key === selectedSectionKey)) {
      return;
    }

    const fallbackSectionKey = sectionChips[0]?.key;
    if (fallbackSectionKey) {
      setSelectedSectionKey(fallbackSectionKey);
    }
  }, [sectionChips, selectedSectionKey]);

  useEffect(() => {
    if (!pendingSectionScrollRequest) {
      return;
    }

    const targetY = sectionOffsets[pendingSectionScrollRequest.key];
    if (typeof targetY !== "number") {
      return;
    }

    scrollViewRef.current?.scrollTo({
      y: Math.max(0, targetY - 8),
      animated: pendingSectionScrollRequest.animated,
    });
    setPendingSectionScrollRequest(null);
  }, [pendingSectionScrollRequest, sectionOffsets]);

  useEffect(() => {
    if (sectionChipBarWidth <= 0) {
      return;
    }

    const selectedChipLayout = sectionChipLayouts[selectedSectionKey];
    if (!selectedChipLayout) {
      return;
    }

    const chipLayouts = Object.values(sectionChipLayouts).filter(
      (layout): layout is SettingsSectionChipLayout => Boolean(layout),
    );
    if (chipLayouts.length === 0) {
      return;
    }

    const chipContentWidth = chipLayouts.reduce(
      (maxWidth, layout) => Math.max(maxWidth, layout.x + layout.width),
      0,
    );
    const centeredX =
      selectedChipLayout.x +
      selectedChipLayout.width / 2 -
      sectionChipBarWidth / 2;
    const maxScrollX = Math.max(0, chipContentWidth - sectionChipBarWidth);
    const targetX = Math.max(0, Math.min(centeredX, maxScrollX));

    sectionChipScrollViewRef.current?.scrollTo({ x: targetX, animated: true });
  }, [sectionChipBarWidth, sectionChipLayouts, selectedSectionKey]);

  useEffect(() => {
    if (availableLevelAnalyticsLevels.length === 0) {
      setSelectedLevelAnalyticsLevels([]);
      return;
    }

    setSelectedLevelAnalyticsLevels((current) => {
      if (current.length === 0) {
        return availableLevelAnalyticsLevels;
      }

      const allowed = new Set(availableLevelAnalyticsLevels);
      const filtered = current.filter((level) => allowed.has(level));
      if (filtered.length === 0) {
        return availableLevelAnalyticsLevels;
      }

      if (
        filtered.length === current.length &&
        filtered.every((value, index) => value === current[index])
      ) {
        return current;
      }

      return filtered;
    });
  }, [availableLevelAnalyticsLevels]);

  // Load current voice selection on component mount
  useEffect(() => {
    loadCurrentVoice();
  }, []);

  useEffect(() => {
    setGravatarEmailInput(gravatarEmail ?? "");
  }, [gravatarEmail]);

  useEffect(() => {
    let didCancel = false;

    const loadJpdbApiKey = async () => {
      setIsLoadingJpdbApiKey(true);
      try {
        const storedKey = await getStoredJpdbApiKey();
        if (didCancel) {
          return;
        }

        setJpdbApiKeyInput(storedKey ?? "");
        setHasStoredJpdbApiKey(Boolean(storedKey));
      } finally {
        if (!didCancel) {
          setIsLoadingJpdbApiKey(false);
        }
      }
    };

    void loadJpdbApiKey();

    return () => {
      didCancel = true;
    };
  }, []);

  useEffect(() => {
    if (isLoadingJpdbApiKey || hasStoredJpdbApiKey) {
      return;
    }

    if (newsDefaultStudyMode === "full") {
      setNewsDefaultStudyMode("none");
    }
    if (songsLyricsDefaultStudyMode === "full") {
      setSongsLyricsDefaultStudyMode("wk");
    }
  }, [
    hasStoredJpdbApiKey,
    isLoadingJpdbApiKey,
    newsDefaultStudyMode,
    songsLyricsDefaultStudyMode,
    setNewsDefaultStudyMode,
    setSongsLyricsDefaultStudyMode,
  ]);

  useEffect(() => {
    if (!showReminderTimeModal) {
      setReminderHourDraft(dailyReviewReminderHour);
      setReminderMinuteDraft(dailyReviewReminderMinute);
    }
  }, [
    dailyReviewReminderHour,
    dailyReviewReminderMinute,
    showReminderTimeModal,
  ]);

  useEffect(() => {
    if (!showReviewShortcutModal) {
      setReviewIncorrectShortcutDraft(
        resolveReviewIncorrectKeyboardShortcuts(
          reviewIncorrectKeyboardShortcuts,
        ),
      );
      setReviewCorrectShortcutDraft(
        resolveReviewCorrectKeyboardShortcuts(reviewCorrectKeyboardShortcuts),
      );
      setCapturingReviewShortcutKey(null);
    }
  }, [
    reviewIncorrectKeyboardShortcuts,
    reviewCorrectKeyboardShortcuts,
    showReviewShortcutModal,
  ]);

  useEffect(() => {
    if (!capturingReviewShortcutKey) {
      return;
    }

    const focusTimer = setTimeout(() => {
      reviewShortcutCaptureInputRef.current?.focus();
    }, 0);

    return () => clearTimeout(focusTimer);
  }, [capturingReviewShortcutKey]);

  const refreshOfflineAudioCacheSize = useCallback(async () => {
    if (offlineCacheRefreshInFlightRef.current) {
      return;
    }

    offlineCacheRefreshInFlightRef.current = true;
    try {
      const cacheStats = await getOfflineVocabularyAudioCacheStats();
      setOfflineAudioCacheSizeBytes(cacheStats.totalBytes);
      setOfflineAudioCacheFileCount(cacheStats.fileCount);
    } catch {
      setOfflineAudioCacheSizeBytes(null);
      setOfflineAudioCacheFileCount(null);
    } finally {
      offlineCacheRefreshInFlightRef.current = false;
    }
  }, []);

  const triggerOfflineAudioDownload = async (options?: {
    forceReindex?: boolean;
    enabled?: boolean;
  }) => {
    try {
      await queueOfflineVocabularyAudioDownloads({
        enabled: options?.enabled ?? offlineVocabularyAudioEnabled,
        currentLevel: userData?.level ?? 1,
        voicePreference: "both",
        forceReindex: options?.forceReindex,
      });
    } catch {
      Alert.alert(
        "Offline Audio",
        "Failed to queue offline vocabulary audio downloads. Please try again.",
      );
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeOfflineVocabularyAudioProgress((progress) => {
      setOfflineAudioProgress(progress);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const interaction = InteractionManager.runAfterInteractions(() => {
      void refreshOfflineAudioCacheSize();
    });

    return () => {
      interaction.cancel();
    };
  }, [refreshOfflineAudioCacheSize]);

  useEffect(() => {
    const wasInProgress = previousOfflineAudioInProgressRef.current;
    const isInProgress = offlineAudioProgress.inProgress;
    previousOfflineAudioInProgressRef.current = isInProgress;

    if (wasInProgress && !isInProgress) {
      void refreshOfflineAudioCacheSize();
    }
  }, [offlineAudioProgress.inProgress, refreshOfflineAudioCacheSize]);

  const loadCurrentVoice = () => {
    const config = azureSpeechService.getConfig();
    setSelectedVoice(config.selectedVoice);
  };

  const handleVoiceSelection = () => {
    setShowVoiceModal(true);
  };

  const saveSelectedVoice = async (voiceShortName: string) => {
    try {
      await azureSpeechService.saveSelectedVoice(voiceShortName);
      setSelectedVoice(voiceShortName);
      setShowVoiceModal(false);
    } catch {
      Alert.alert("Error", "Failed to save voice selection");
    }
  };

  const testVoice = async (voiceShortName: string) => {
    // Stop any currently playing voice test
    if (testingVoiceId !== null) {
      await azureSpeechService.stop();
    }

    setTestingVoiceId(voiceShortName);

    // Store the original voice only if we're not already testing
    const originalVoice = selectedVoice;
    await azureSpeechService.saveSelectedVoice(voiceShortName);

    // Test text saying in japanese "My name is (name)" removing ja-JP from the voiceShortName
    const testText = `私の名前は ${voiceShortName
      ?.replace("ja-JP-", "")
      ?.replace("Neural", "")} です`;

    try {
      await azureSpeechService.speak(
        testText,
        () => {},
        () => {
          // Only clear testing state if this voice is still the one being tested
          if (testingVoiceId === voiceShortName) {
            setTestingVoiceId(null);
            // Restore original voice if not selected
            if (originalVoice !== voiceShortName) {
              azureSpeechService.saveSelectedVoice(originalVoice);
            }
          }
        },
        (error) => {
          console.error("Voice test error:", error);
          // Only clear testing state if this voice is still the one being tested
          if (testingVoiceId === voiceShortName) {
            setTestingVoiceId(null);
            // Restore original voice on error
            azureSpeechService.saveSelectedVoice(originalVoice);
            Alert.alert(
              "Test Failed",
              "Unable to test voice. Please check your internet connection.",
            );
          }
        },
      );
    } catch {
      // Only clear testing state if this voice is still the one being tested
      if (testingVoiceId === voiceShortName) {
        setTestingVoiceId(null);
        // Restore original voice on error
        await azureSpeechService.saveSelectedVoice(originalVoice);
        Alert.alert(
          "Test Failed",
          "Unable to test voice. Please check your internet connection.",
        );
      }
    }
  };

  const handleSaveGravatarEmail = () => {
    const email = gravatarEmailInput.trim();
    if (email === "") {
      setGravatarEmail(null);
      Alert.alert("Success", "Gravatar email removed.");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address.");
      return;
    }

    setGravatarEmail(email);
    Alert.alert("Success", "Gravatar email updated.");
  };

  const handleSaveJpdbApiKey = async () => {
    const normalizedKey = jpdbApiKeyInput.trim();
    setJpdbApiKeyStatus(null);

    if (!normalizedKey) {
      await clearJpdbApiKey();
      setHasStoredJpdbApiKey(false);
      setJpdbApiKeyStatus({
        message: "JPDB API key removed.",
        isError: false,
      });
      return;
    }

    setIsSavingJpdbApiKey(true);
    setJpdbApiKeyStatus({
      message: "Validating JPDB API key...",
      isError: false,
    });

    try {
      const isValid = await validateJpdbApiKey(normalizedKey);
      if (!isValid) {
        setJpdbApiKeyStatus({
          message: "JPDB API key is invalid or JPDB is unavailable.",
          isError: true,
        });
        return;
      }

      await saveJpdbApiKey(normalizedKey);
      setJpdbApiKeyInput(normalizedKey);
      setHasStoredJpdbApiKey(true);
      setJpdbApiKeyStatus({
        message: "JPDB API key saved.",
        isError: false,
      });
    } catch (error) {
      console.error("Failed to save JPDB API key:", error);
      setJpdbApiKeyStatus({
        message: "Could not save JPDB API key right now.",
        isError: true,
      });
    } finally {
      setIsSavingJpdbApiKey(false);
    }
  };

  const handleRemoveJpdbApiKey = async () => {
    setIsSavingJpdbApiKey(true);
    try {
      await clearJpdbApiKey();
      setJpdbApiKeyInput("");
      setHasStoredJpdbApiKey(false);
      setJpdbApiKeyStatus({
        message: "JPDB API key removed.",
        isError: false,
      });
    } catch (error) {
      console.error("Failed to remove JPDB API key:", error);
      setJpdbApiKeyStatus({
        message: "Could not remove JPDB API key right now.",
        isError: true,
      });
    } finally {
      setIsSavingJpdbApiKey(false);
    }
  };

  const isDailyLessonLimitEnabled = dailyLessonLimit > 0;
  const dailyLessonLimitMin = 5;
  const dailyLessonLimitMax = 500;
  const dailyLessonLimitStep = Math.max(1, lessonBatchSize);
  const dailyLessonReminderMinimumMin = 5;
  const dailyLessonReminderMinimumMax = 100;
  const dailyLessonReminderMinimumStep = Math.max(1, lessonBatchSize);
  const getPreviousDailyLessonLimit = (currentLimit: number) => {
    const previousMultiple =
      Math.floor((currentLimit - 1) / dailyLessonLimitStep) *
      dailyLessonLimitStep;
    return Math.max(dailyLessonLimitMin, previousMultiple);
  };
  const getNextDailyLessonLimit = (currentLimit: number) => {
    const nextMultiple =
      (Math.floor(currentLimit / dailyLessonLimitStep) + 1) *
      dailyLessonLimitStep;
    return Math.min(dailyLessonLimitMax, nextMultiple);
  };
  const getPreviousDailyLessonReminderMinimum = (currentMinimum: number) => {
    const previousMultiple =
      Math.floor((currentMinimum - 1) / dailyLessonReminderMinimumStep) *
      dailyLessonReminderMinimumStep;
    return Math.max(dailyLessonReminderMinimumMin, previousMultiple);
  };
  const getNextDailyLessonReminderMinimum = (currentMinimum: number) => {
    const nextMultiple =
      (Math.floor(currentMinimum / dailyLessonReminderMinimumStep) + 1) *
      dailyLessonReminderMinimumStep;
    return Math.min(dailyLessonReminderMinimumMax, nextMultiple);
  };
  const isAnyDailyReminderEnabled =
    dailyReviewReminderEnabled || dailyLessonReminderEnabled;
  const reviewWrapUpTargetMin = 5;
  const reviewWrapUpTargetMax = 20;
  const reviewWrapUpTargetStep = 5;
  const effectiveReviewWrapUpQuestionGap = Math.min(
    reviewWrapUpTargetSubjects,
    DEFAULT_MAX_QUESTION_GAP,
  );
  const canDecreaseReviewCharacterFontScale =
    reviewCharacterFontScale > REVIEW_CHARACTER_FONT_SCALE_MIN;
  const canIncreaseReviewCharacterFontScale =
    reviewCharacterFontScale < REVIEW_CHARACTER_FONT_SCALE_MAX;

  const handleDailyLessonLimitToggle = (enabled: boolean) => {
    if (!enabled) {
      setDailyLessonLimit(0);
      return;
    }

    const baseLimit = dailyLessonLimit > 0 ? dailyLessonLimit : 30;
    const normalizedLimit = Math.min(
      dailyLessonLimitMax,
      Math.max(
        dailyLessonLimitMin,
        Math.round(baseLimit / dailyLessonLimitStep) * dailyLessonLimitStep,
      ),
    );
    setDailyLessonLimit(normalizedLimit);
  };

  const handleRateAppPress = async () => {
    // Log the rate app click
    if (apiToken) {
      rateAppService.logRateAppClick({
        userId: userData?.id ?? null,
        userEmail: gravatarEmail,
        userUsername: userData?.username,
        userLevel: userData?.level,
        source: "settings",
      });
    }

    const didOpenReviewFlow = await rateAppService.openRateAppFlow();
    if (!didOpenReviewFlow) {
      Alert.alert(
        "Unable to Open Store",
        "Could not open the app rating flow. Please try again later.",
      );
    }
  };

  const handlePatreonPress = async () => {
    try {
      const canOpenPatreon = await Linking.canOpenURL(PATREON_URL);
      if (!canOpenPatreon) {
        Alert.alert(
          "Unable to Open Patreon",
          "Could not open Patreon right now. Please try again later.",
        );
        return;
      }

      await Linking.openURL(PATREON_URL);
    } catch (error) {
      console.error("Failed to open Patreon URL:", error);
      Alert.alert(
        "Unable to Open Patreon",
        "Could not open Patreon right now. Please try again later.",
      );
    }
  };

  const submitBunproSurveyResponse = useCallback(
    async (usesBunpro: boolean) => {
      if (isSubmittingBunproSurvey) {
        return false;
      }

      setIsSubmittingBunproSurvey(true);

      try {
        const wasLogged = await bunproSurveyService.logResponse({
          userId: userData?.id ?? null,
          userUsername: userData?.username ?? null,
          userLevel: userData?.level ?? null,
          usesBunpro,
          wantsBunproInApp: usesBunpro
            ? bunproIntegrationAnswer === "yes"
            : null,
          requestedFeatures: usesBunpro ? bunproFeatureRequestInput : null,
        });

        if (!wasLogged) {
          Alert.alert(
            "Couldn't Save Response",
            "Please try again in a moment.",
          );
          return false;
        }

        setBunproSurveyCompleted(true);
        setShowBunproSurveyModal(false);
        setBunproUsageAnswer(null);
        setBunproIntegrationAnswer(null);
        setBunproFeatureRequestInput("");
        return true;
      } finally {
        setIsSubmittingBunproSurvey(false);
      }
    },
    [
      bunproFeatureRequestInput,
      bunproIntegrationAnswer,
      isSubmittingBunproSurvey,
      setBunproSurveyCompleted,
      userData?.id,
      userData?.level,
      userData?.username,
    ],
  );

  const handleBunproUsageSelection = useCallback((selection: "yes" | "no") => {
    setBunproUsageAnswer(selection);
    if (selection === "yes") {
      return;
    }

    setBunproIntegrationAnswer(null);
    setBunproFeatureRequestInput("");
  }, []);

  const handleSubmitBunproSurvey = useCallback(async () => {
    if (!bunproUsageAnswer) {
      Alert.alert("One More Thing", "Please answer whether you use Bunpro.");
      return;
    }

    if (bunproUsageAnswer === "yes" && !bunproIntegrationAnswer) {
      Alert.alert(
        "One More Thing",
        "Please answer whether you want Bunpro in this app.",
      );
      return;
    }

    await submitBunproSurveyResponse(bunproUsageAnswer === "yes");
  }, [bunproIntegrationAnswer, bunproUsageAnswer, submitBunproSurveyResponse]);

  const handleJpdbApiKeyInfoPress = () => {
    Alert.alert(
      "JPDB API Key",
      'This key enables parse-first vocabulary detection in News, the EPUB reader, and the URL Reader.\n\nYou can get it for free by creating a JPDB account, then opening jpdb.io/settings and copying your key from the "Account information" section.',
      [
        { text: "Close", style: "cancel" },
        {
          text: "Open JPDB Settings",
          onPress: async () => {
            try {
              const canOpen = await Linking.canOpenURL(JPDB_SETTINGS_URL);
              if (!canOpen) {
                Alert.alert(
                  "Unable to Open JPDB",
                  "Could not open JPDB settings right now.",
                );
                return;
              }
              await Linking.openURL(JPDB_SETTINGS_URL);
            } catch (error) {
              console.error("Failed to open JPDB settings URL:", error);
              Alert.alert(
                "Unable to Open JPDB",
                "Could not open JPDB settings right now.",
              );
            }
          },
        },
      ],
    );
  };

  const handleBlockedFullModeSelection = useCallback(
    (context: "news" | "lyrics") => {
      const contextLabel =
        context === "news"
          ? "the NHK News default view"
          : "the Song Lyrics default view";

      Alert.alert(
        "JPDB API Key Required",
        `Full mode for ${contextLabel} is blocked until you save a JPDB API key.`,
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Go to JPDB API Key",
            onPress: () => {
              scrollToSection("profile", true);
            },
          },
        ],
      );
    },
    [scrollToSection],
  );

  const getAppleMusicStatusLabel = () => {
    switch (appleMusicAuthStatus) {
      case "authorized":
        return "Authorized";
      case "denied":
        return "Denied";
      case "restricted":
        return "Restricted";
      case "notDetermined":
        return "Not connected";
      default:
        return "Unknown";
    }
  };

  const getAppleMusicSubscriptionAlertMessage = (error: unknown) => {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String((error as { code?: string }).code)
        : null;

    if (code === "privacyAcknowledgementRequired") {
      return "Open the Apple Music app once, accept the latest privacy notice, then try again.";
    }

    if (code === "permissionDenied") {
      return "Apple Music access is denied. Re-enable Media & Apple Music permissions in iOS Settings and try again.";
    }

    return "Could not verify your Apple Music subscription right now. Please try again.";
  };

  const ensureAppleMusicCatalogPlaybackAccess = async () => {
    try {
      const subscription = await checkAppleMusicSubscription();
      if (!subscription.canPlayCatalogContent) {
        setSongsPlaybackSource("youtube");
        Alert.alert(
          "Subscription Required",
          "Apple Music playback needs an active Apple Music subscription.",
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error("Apple Music subscription check failed:", error);
      setSongsPlaybackSource("youtube");
      Alert.alert(
        "Apple Music Unavailable",
        getAppleMusicSubscriptionAlertMessage(error),
      );
      return false;
    }
  };

  const handleAppleMusicLogin = async () => {
    if (Platform.OS !== "ios" || !isAppleMusicAuthAvailable) {
      Alert.alert(
        "Unsupported",
        "Apple Music login is only available on iOS development builds.",
      );
      return;
    }

    try {
      const status = await requestAppleMusicAuthorization();
      setAppleMusicAuthStatus(status);

      if (status === "authorized") {
        const hasPlaybackAccess = await ensureAppleMusicCatalogPlaybackAccess();
        if (!hasPlaybackAccess) {
          return;
        }

        Alert.alert("Connected", "Apple Music is now authorized.");
        setSongsPlaybackSource("appleMusic");
      } else {
        Alert.alert(
          "Not Authorized",
          "Apple Music authorization was not granted.",
        );
        setSongsPlaybackSource("youtube");
      }
    } catch (error) {
      console.error("Apple Music login failed:", error);
      Alert.alert(
        "Login Failed",
        "Could not complete Apple Music authorization. Check device Music settings and your Apple Music subscription.",
      );
    }
  };

  const handlePlaybackSourceChange = async (
    source: "youtube" | "appleMusic",
  ) => {
    if (source === "youtube") {
      setSongsPlaybackSource("youtube");
      return;
    }

    if (Platform.OS !== "ios") {
      Alert.alert(
        "Not Available",
        "Apple Music playback is only available on iOS.",
      );
      return;
    }

    if (!isAppleMusicAuthAvailable) {
      Alert.alert(
        "Setup Required",
        "Install an iOS development build to use Apple Music authentication.",
      );
      return;
    }

    if (appleMusicAuthStatus !== "authorized") {
      Alert.alert(
        "Login Required",
        "Authorize Apple Music first, then switch playback to Apple Music.",
      );
      return;
    }

    const hasPlaybackAccess = await ensureAppleMusicCatalogPlaybackAccess();
    if (!hasPlaybackAccess) {
      return;
    }

    setSongsPlaybackSource("appleMusic");
  };

  const handleLogout = async () => {
    await signOut();
  };

  const handleDevClearAndLogout = async () => {
    Alert.alert(
      "Clear All Data & Logout",
      "This will completely reset the app to its initial state, clearing all cache and logging you out. This is useful for debugging first-time user issues.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset App",
          style: "destructive",
          onPress: async () => {
            try {
              // Clear all cache
              await clearCache();
              // Also clear large cache if present
              await clearLargeCache();
              // Logout using signOut from context (handles navigation)
              await signOut();
            } catch (error) {
              console.error("Error clearing app data:", error);
              Alert.alert(
                "Error",
                "Failed to clear app data. Please try again.",
              );
            }
          },
        },
      ],
    );
  };

  const handleBack = () => {
    router.back();
  };

  const handleBadgeNotificationChange = async (value: boolean) => {
    setShowBadgeNotifications(value);

    if (value) {
      // If enabling, update badge with current count and schedule notifications
      await updateBadgeWithReviewCount();
      // Also update the native notification system
      await updateBadgeAndScheduleNotifications();
    } else {
      // If disabling, clear the badge immediately
      await clearBadgeCount();
      // Also clear native notifications if review notifications are also disabled
      if (
        Platform.OS === "ios" &&
        !enableReviewNotifications &&
        !isRunningOnMacFromIOS &&
        ReviewNotificationManager &&
        typeof ReviewNotificationManager.updateBadgeAndScheduleNotifications ===
          "function"
      ) {
        try {
          await ReviewNotificationManager.updateBadgeAndScheduleNotifications({
            currentReviews: 0,
            upcomingReviews: new Array(24).fill(0),
            settings: {
              badgeEnabled: false,
              alertsEnabled: false,
              soundsEnabled: false,
            },
          });
        } catch (error) {
          console.error("Failed to clear native notifications:", error);
        }
      }
    }

    // Keep daily reminder scheduling in sync.
    await syncDailyReminderNotifications();
  };

  const handleReviewNotificationChange = async (value: boolean) => {
    setEnableReviewNotifications(value);

    if (value) {
      // If enabling, use the new native notification system
      const permissionGranted = await requestNotificationPermissions();
      if (permissionGranted) {
        await updateBadgeAndScheduleNotifications();
      }

      // Keep the old system as fallback for background checks
      await initializeReviewNotifications();
      await scheduleReviewChecks();
      await syncDailyReminderNotifications();
    } else {
      // If disabling, cancel all notifications (both old and new systems)
      await cancelReviewNotifications();

      if (showBadgeNotifications) {
        // Keep badge scheduling active when review alerts are disabled.
        await updateBadgeWithReviewCount({ forceSummaryRefresh: true });
        return;
      }

      // Also clear any native notifications
      if (
        Platform.OS === "ios" &&
        !isRunningOnMacFromIOS &&
        ReviewNotificationManager &&
        typeof ReviewNotificationManager.updateBadgeAndScheduleNotifications ===
          "function"
      ) {
        try {
          await ReviewNotificationManager.updateBadgeAndScheduleNotifications({
            currentReviews: 0,
            upcomingReviews: new Array(24).fill(0),
            settings: {
              badgeEnabled: false,
              alertsEnabled: false,
              soundsEnabled: false,
            },
          });
        } catch (error) {
          console.error("Failed to clear native notifications:", error);
        }
      }

      await syncDailyReminderNotifications();
    }
  };

  const formatReminderTimeLabel = (hour: number, minute: number) => {
    const reminderDate = new Date();
    reminderDate.setHours(hour, minute, 0, 0);
    return reminderDate.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatExpoTriggerLabel = (trigger: unknown): string => {
    if (trigger == null) {
      return "Immediate";
    }

    if (typeof trigger !== "object") {
      return "Unknown trigger";
    }

    const triggerRecord = trigger as Record<string, unknown>;
    const triggerType =
      typeof triggerRecord.type === "string" ? triggerRecord.type : "unknown";

    if (
      triggerType === "daily" &&
      typeof triggerRecord.hour === "number" &&
      typeof triggerRecord.minute === "number"
    ) {
      return `Daily at ${formatReminderTimeLabel(
        triggerRecord.hour,
        triggerRecord.minute,
      )}`;
    }

    if (typeof triggerRecord.seconds === "number") {
      return `In ${Math.round(triggerRecord.seconds)}s`;
    }

    if (typeof triggerRecord.date === "number") {
      return new Date(triggerRecord.date).toLocaleString();
    }

    return triggerType;
  };

  const formatNativeTriggerLabel = (
    trigger: {
      type: string;
      fireDate?: string;
      repeats: boolean;
      timeInterval?: number;
    } | null,
  ): string => {
    if (!trigger) {
      return "Unknown trigger";
    }

    if (trigger.fireDate) {
      return new Date(trigger.fireDate).toLocaleString();
    }

    if (trigger.type === "calendar") {
      return trigger.repeats
        ? "Calendar trigger (repeats daily)"
        : "Calendar trigger";
    }

    if (
      trigger.type === "timeInterval" &&
      typeof trigger.timeInterval === "number"
    ) {
      return `In ${Math.round(trigger.timeInterval)}s`;
    }

    return trigger.type || "Unknown trigger";
  };

  const openReminderTimeModal = () => {
    setReminderHourDraft(dailyReviewReminderHour);
    setReminderMinuteDraft(dailyReviewReminderMinute);
    setShowReminderTimeModal(true);
  };

  const handleDailyReviewReminderChange = async (value: boolean) => {
    setDailyReviewReminderEnabled(value);

    if (value) {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        Alert.alert(
          "Notifications Disabled",
          "Enable notifications in your device settings to receive reminder alerts.",
        );
      }
    }

    await syncDailyReminderNotifications();
  };

  const handleDailyLessonReminderChange = async (value: boolean) => {
    setDailyLessonReminderEnabled(value);

    if (value) {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        Alert.alert(
          "Notifications Disabled",
          "Enable notifications in your device settings to receive reminder alerts.",
        );
      }
    }

    await syncDailyReminderNotifications();
  };

  const handleDailyLessonReminderMinimumChange = async (
    nextMinimum: number,
  ) => {
    const normalizedMinimum = normalizeToSteppedRange(
      nextMinimum,
      dailyLessonReminderMinimumMin,
      dailyLessonReminderMinimumMax,
      dailyLessonReminderMinimumStep,
    );
    setDailyLessonReminderMinimum(normalizedMinimum);
    await syncDailyReminderNotifications();
  };

  useEffect(() => {
    const normalizedMinimum = normalizeToSteppedRange(
      dailyLessonReminderMinimum,
      dailyLessonReminderMinimumMin,
      dailyLessonReminderMinimumMax,
      dailyLessonReminderMinimumStep,
    );
    if (normalizedMinimum !== dailyLessonReminderMinimum) {
      setDailyLessonReminderMinimum(normalizedMinimum);
    }
  }, [
    dailyLessonReminderMinimum,
    dailyLessonReminderMinimumStep,
    setDailyLessonReminderMinimum,
  ]);

  const handleSaveReminderTime = async () => {
    setDailyReviewReminderHour(reminderHourDraft);
    setDailyReviewReminderMinute(reminderMinuteDraft);
    setShowReminderTimeModal(false);

    await syncDailyReminderNotifications();
  };

  const getCurrentVoiceDisplayName = () => {
    const voice = JAPANESE_VOICES.find((v) => v.shortName === selectedVoice);
    return voice?.displayName || selectedVoice;
  };

  const getVocabularyAudioVoiceLabel = (
    voice: VocabularyAudioVoicePreference,
  ) => {
    return (
      VOCABULARY_AUDIO_VOICE_LABELS[voice] ??
      VOCABULARY_AUDIO_VOICE_LABELS.female
    );
  };

  const getSrsProgressionCardModeLabel = (
    mode: SrsProgressionCardDisplayMode,
  ) => {
    return (
      SRS_PROGRESSION_CARD_MODE_LABELS[mode] ??
      SRS_PROGRESSION_CARD_MODE_LABELS.normal
    );
  };

  const getVocabularyAudioVoiceIconName = (
    voice: VocabularyAudioVoicePreference,
  ): keyof typeof Ionicons.glyphMap => {
    switch (voice) {
      case "random":
        return "shuffle";
      case "both":
        return "people-outline";
      default:
        return "person-outline";
    }
  };

  const getSrsProgressionCardModeIconName = (
    mode: SrsProgressionCardDisplayMode,
  ): keyof typeof Ionicons.glyphMap => {
    switch (mode) {
      case "compact":
        return "contract-outline";
      case "hidden":
        return "eye-off-outline";
      default:
        return "expand-outline";
    }
  };

  const closeVocabularyAudioVoicePicker = () => {
    setShowVocabularyVoiceMenu(false);
  };

  const closeSrsProgressionCardModePicker = () => {
    setShowSrsProgressionCardModeMenu(false);
  };

  const selectVocabularyAudioVoice = (
    voice: VocabularyAudioVoicePreference,
  ) => {
    setVocabularyAudioVoice(voice);
    closeVocabularyAudioVoicePicker();
  };

  const selectSrsProgressionCardMode = (
    mode: SrsProgressionCardDisplayMode,
  ) => {
    setSrsProgressionCardDisplayMode(mode);
    closeSrsProgressionCardModePicker();
  };

  const handleOfflineVocabularyAudioToggle = (enabled: boolean) => {
    setOfflineVocabularyAudioEnabled(enabled);
    if (enabled) {
      void triggerOfflineAudioDownload({ forceReindex: true, enabled: true });
      return;
    }

    void queueOfflineVocabularyAudioDownloads({
      enabled: false,
      currentLevel: userData?.level ?? 1,
      voicePreference: "both",
    });

    Alert.alert(
      "Delete offline audio?",
      "You can keep the downloaded audio or delete it to free up space.",
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setIsClearingOfflineAudioCache(true);
            void clearOfflineVocabularyAudioCache()
              .then(() => refreshOfflineAudioCacheSize())
              .finally(() => setIsClearingOfflineAudioCache(false));
          },
        },
      ],
    );
  };

  const handleClearOfflineAudioCache = () => {
    Alert.alert(
      "Delete cached audio?",
      "This removes all downloaded vocabulary audio from your device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setIsClearingOfflineAudioCache(true);
            void clearOfflineVocabularyAudioCache()
              .then(() => refreshOfflineAudioCacheSize())
              .finally(() => setIsClearingOfflineAudioCache(false));
          },
        },
      ],
    );
  };

  const openVocabularyAudioVoicePicker = () => {
    if (Platform.OS === "android") {
      setShowVocabularyVoiceMenu(true);
      return;
    }

    Alert.alert(
      "Vocabulary Audio Voice",
      "Choose the voice mode used after correct reading answers.",
      [
        ...VOCABULARY_AUDIO_VOICE_OPTIONS.map((option) => ({
          text: option.label,
          onPress: () => selectVocabularyAudioVoice(option.value),
        })),
        { text: "Cancel", style: "destructive" as const },
      ],
    );
  };

  const openSrsProgressionCardModePicker = () => {
    if (Platform.OS === "android") {
      setShowSrsProgressionCardModeMenu(true);
      return;
    }

    Alert.alert(
      "SRS Progression",
      "Choose how SRS progression appears after answering review items.",
      [
        ...SRS_PROGRESSION_CARD_MODE_OPTIONS.map((option) => ({
          text: option.label,
          onPress: () => selectSrsProgressionCardMode(option.value),
        })),
        { text: "Cancel", style: "destructive" as const },
      ],
    );
  };

  const openReviewShortcutModal = () => {
    setReviewIncorrectShortcutDraft(
      resolveReviewIncorrectKeyboardShortcuts(reviewIncorrectKeyboardShortcuts),
    );
    setReviewCorrectShortcutDraft(
      resolveReviewCorrectKeyboardShortcuts(reviewCorrectKeyboardShortcuts),
    );
    setCapturingReviewShortcutKey(null);
    setShowReviewShortcutModal(true);
  };

  const closeReviewShortcutModal = () => {
    setCapturingReviewShortcutKey(null);
    setShowReviewShortcutModal(false);
  };

  const applyReviewShortcutValue = (
    target: ReviewShortcutCaptureTarget,
    nextValue: string,
  ) => {
    const sanitizedValue = sanitizeReviewShortcutInput(nextValue);

    if (target.group === "incorrect") {
      setReviewIncorrectShortcutDraft((current) => ({
        ...current,
        [target.key]: sanitizedValue,
      }));
      setReviewIncorrectKeyboardShortcuts({
        [target.key]: sanitizedValue,
      });
      return;
    }

    setReviewCorrectShortcutDraft((current) => ({
      ...current,
      [target.key]: sanitizedValue,
    }));
    setReviewCorrectKeyboardShortcuts({
      [target.key]: sanitizedValue,
    });
  };

  const beginReviewShortcutCapture = (target: ReviewShortcutCaptureTarget) => {
    if (
      (target.group === "incorrect" &&
        !disableAutoProgressOnWrong &&
        !disableAutoProgressOnCloseAnswer) ||
      (target.group === "correct" && !disableAutoProgressOnCorrect)
    ) {
      return;
    }

    setCapturingReviewShortcutKey(target);
  };

  const handleReviewShortcutCaptureKeyPress = (
    event: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (!capturingReviewShortcutKey) {
      return;
    }

    const pressedKey = event.nativeEvent.key;
    if (!pressedKey) {
      return;
    }

    const normalizedKey = normalizeReviewShortcutKey(pressedKey);
    const ignoredKeys = new Set([
      "shift",
      "control",
      "alt",
      "meta",
      "capslock",
    ]);

    if (ignoredKeys.has(normalizedKey)) {
      return;
    }

    if (normalizedKey === "backspace" || normalizedKey === "delete") {
      applyReviewShortcutValue(capturingReviewShortcutKey, "");
      setCapturingReviewShortcutKey(null);
      reviewShortcutCaptureInputRef.current?.blur();
      return;
    }

    applyReviewShortcutValue(capturingReviewShortcutKey, pressedKey);
    setCapturingReviewShortcutKey(null);
    reviewShortcutCaptureInputRef.current?.blur();
  };

  const handleReviewShortcutCaptureSubmit = () => {
    if (!capturingReviewShortcutKey) {
      return;
    }

    applyReviewShortcutValue(capturingReviewShortcutKey, "Enter");
    setCapturingReviewShortcutKey(null);
    reviewShortcutCaptureInputRef.current?.blur();
  };

  const handleCacheAnalysis = async () => {
    setIsAnalyzingCache(true);
    try {
      const analysis = await analyzeCacheStorage();
      setCacheAnalysis(analysis);
      setShowCacheModal(true);
    } catch {
      Alert.alert("Error", "Failed to analyze cache storage");
    } finally {
      setIsAnalyzingCache(false);
    }
  };

  const handleClearAllCache = async () => {
    Alert.alert(
      "Clear All Cache",
      "This will clear all cached data. You may need to re-download content when using the app.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await clearCache();
              Alert.alert("Success", "All cache has been cleared");
              // Refresh analysis if modal is open
              if (showCacheModal) {
                handleCacheAnalysis();
              }
            } catch {
              Alert.alert("Error", "Failed to clear cache");
            }
          },
        },
      ],
    );
  };

  const handleClearLargeItems = async () => {
    Alert.alert(
      "Clear Large Items",
      "This will clear cache items larger than 5MB. This can help reduce storage usage.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await clearLargeCache(undefined, 5);
              Alert.alert("Success", "Large cache items have been cleared");
              // Refresh analysis
              handleCacheAnalysis();
            } catch {
              Alert.alert("Error", "Failed to clear large cache items");
            }
          },
        },
      ],
    );
  };

  const handleClearCategory = async (categoryName: string) => {
    Alert.alert(
      `Clear ${categoryName}`,
      `This will clear all cached data in the ${categoryName} category.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await clearLargeCache(categoryName);
              Alert.alert("Success", `${categoryName} cache has been cleared`);
              // Refresh analysis
              handleCacheAnalysis();
            } catch {
              Alert.alert("Error", `Failed to clear ${categoryName} cache`);
            }
          },
        },
      ],
    );
  };

  const handleDetailedSubjectsAnalysis = async () => {
    try {
      await analyzeSubjectsCache();
      Alert.alert(
        "Analysis Complete",
        "Check the console for detailed subjects cache breakdown. This shows the difference between individual subject caches and collection caches.",
      );
    } catch {
      Alert.alert("Error", "Failed to analyze subjects cache");
    }
  };

  const handleOptimizeCache = async () => {
    Alert.alert(
      "Optimize Cache",
      "This will remove duplicate data, expired entries, and enforce size limits. This could save 20-50MB of storage.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Optimize",
          onPress: async () => {
            try {
              const result = await quickOptimize();

              Alert.alert(
                "Optimization Complete",
                `Saved ${result.savedSpaceFormatted} by removing ${
                  result.itemsRemoved
                } items.\n\n${result.optimizationsApplied.join("\n")}`,
              );

              // Refresh analysis if modal is open
              if (showCacheModal) {
                handleCacheAnalysis();
              }
            } catch (error) {
              Alert.alert("Error", `Failed to optimize cache ${error}`);
            }
          },
        },
      ],
    );
  };

  const handleShowPendingNotifications = async () => {
    try {
      if (
        ReviewNotificationManager &&
        typeof ReviewNotificationManager.getPendingNotifications === "function"
      ) {
        const nativePendingNotifications =
          await ReviewNotificationManager.getPendingNotifications();
        setPendingNotifications(nativePendingNotifications);
        setExpoPendingNotifications([]);
        setShowNotificationsModal(true);
        return;
      }

      const expoScheduledNotifications =
        await Notifications.getAllScheduledNotificationsAsync();
      setPendingNotifications({
        count: 0,
        notifications: [],
      });
      setExpoPendingNotifications(expoScheduledNotifications);
      setShowNotificationsModal(true);
    } catch (error) {
      Alert.alert("Error", "Failed to get pending notifications");
      console.error("Failed to get pending notifications:", error);
    }
  };

  const handleShowApiSummary = () => {
    console.log("\n📊 API Debug Summary (triggered from Settings)");
    apiDebugger.printSummary();
    Alert.alert(
      "API Summary",
      "API call summary has been printed to the console. Check the terminal/debugger for details.",
    );
  };

  const handleShowApiDetails = () => {
    console.log("\n📋 API Detailed Log (triggered from Settings)");
    apiDebugger.printDetailedLog();
    Alert.alert(
      "API Details",
      "Detailed API call log has been printed to the console. Check the terminal/debugger for timestamps and payloads.",
    );
  };

  const handleClearApiDebug = () => {
    apiDebugger.clear();
    clearInMemoryCache();
    Alert.alert(
      "Cleared",
      "API debug history and in-memory cache have been cleared.",
    );
  };

  const handleShowApiTimelineSummary = () => {
    console.log("\nAPI Timeline Summary (triggered from Settings)");
    apiDebugger.printTimelineSummary();
    Alert.alert(
      "Timeline Summary",
      "API timeline summary has been printed to the console.",
    );
  };

  const handleExportApiTimeline = async () => {
    try {
      const payload = apiDebugger.buildTimelineExportPayload();

      if (payload.entries.length === 0) {
        Alert.alert(
          "No timeline data",
          "No API requests were captured yet. Refresh dashboard data first, then try again.",
        );
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `wanikani-api-timeline-${timestamp}.json`;
      const exportFile = new File(Paths.document, filename);
      exportFile.write(JSON.stringify(payload, null, 2));

      await Share.share({
        title: "WaniKani API timeline JSON",
        message:
          Platform.OS === "android"
            ? `API timeline exported to:\n${exportFile.uri}`
            : undefined,
        url: exportFile.uri,
      });
    } catch (error) {
      console.error("Failed to export API timeline:", error);
      Alert.alert(
        "Export failed",
        "Could not export API timeline right now. Please try again.",
      );
    }
  };

  const handleClearApiTimeline = () => {
    apiDebugger.clearTimeline();
    Alert.alert("Cleared", "API timeline history has been cleared.");
  };

  // Cache health check handler
  const handleCheckCacheHealth = async () => {
    setIsCheckingCacheHealth(true);
    try {
      const status = await checkSubjectsCacheHealth();
      setCacheHealthStatus(status);

      if (status.isHealthy) {
        const expectedInfo = status.expectedSubjects
          ? ` (expected: ${status.expectedSubjects})`
          : "";
        Alert.alert(
          "Cache Healthy",
          `Your subjects cache is healthy.\n\n${status.validSubjects} subjects cached${expectedInfo}.`,
          [{ text: "OK" }],
        );
      } else {
        const issuesSummary = status.issues
          .map((i) => `• ${i.description}`)
          .join("\n");

        Alert.alert(
          "Cache Issues Detected",
          `The cache has ${status.issues.length} issue(s):\n\n${issuesSummary}\n\nWould you like to repair it?`,
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Repair Now",
              onPress: () => handleRepairCache(),
            },
          ],
        );
      }
    } catch (error) {
      console.error("Error checking cache health:", error);
      Alert.alert("Error", "Failed to check cache health.");
    } finally {
      setIsCheckingCacheHealth(false);
    }
  };

  // Function to fetch all subjects from API for repair
  const fetchAllSubjectsFromApi = async (token: string) => {
    const initialResponse = await getSubjects(
      token,
      {},
      { skipCollectionCache: true },
    );
    const completeResponse = await fetchAllPages(initialResponse, token);
    return {
      data: completeResponse.data,
      data_updated_at: completeResponse.data_updated_at,
      total_count: completeResponse.total_count,
    };
  };

  // Cache repair handler
  const handleRepairCache = async () => {
    if (!apiToken) {
      Alert.alert("Error", "No API token available. Please log in again.");
      return;
    }

    Alert.alert(
      "Repair Cache",
      "This will clear the cache and download fresh data from WaniKani. This may take a moment.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Repair",
          onPress: async () => {
            setIsRepairingCache(true);
            try {
              // Force repair even if cache appears healthy - user explicitly requested it
              const result = await repairSubjectsCache(
                apiToken,
                fetchAllSubjectsFromApi,
                { force: true },
              );

              if (result.success) {
                setCacheHealthStatus(result.newStatus || null);
                Alert.alert("Cache Repaired", result.message, [{ text: "OK" }]);
              } else {
                Alert.alert("Repair Failed", result.message, [{ text: "OK" }]);
              }
            } catch (error) {
              console.error("Error repairing cache:", error);
              Alert.alert(
                "Error",
                "Failed to repair cache. Please try again later or reinstall the app.",
              );
            } finally {
              setIsRepairingCache(false);
            }
          },
        },
      ],
    );
  };

  const toggleLevelAnalyticsLevelSelection = (level: number) => {
    setSelectedLevelAnalyticsLevels((current) => {
      if (current.includes(level)) {
        return current.filter((item) => item !== level);
      }

      return [...current, level].sort((left, right) => left - right);
    });
  };

  const selectAllLevelAnalyticsLevels = () => {
    setSelectedLevelAnalyticsLevels(availableLevelAnalyticsLevels);
  };

  const clearLevelAnalyticsLevels = () => {
    setSelectedLevelAnalyticsLevels([]);
  };

  const handleOpenLevelAnalyticsExportModal = () => {
    if (availableLevelAnalyticsLevels.length === 0) {
      Alert.alert(
        "No data to export",
        "Level analytics aren't available yet. Refresh your dashboard data and try again.",
      );
      return;
    }

    setShowLevelAnalyticsExportModal(true);
  };

  const exportLevelAnalytics = async (
    format: LevelAnalyticsExportFormat,
    selectedLevels: number[],
  ) => {
    if (isExportingLevelAnalytics) {
      return;
    }

    setIsExportingLevelAnalytics(true);

    try {
      const baseParams = {
        subjects: dashboardData.subjects,
        assignments: dashboardData.assignments,
        reviewStatistics: dashboardData.reviewStatistics,
        levelProgressions: dashboardData.levelProgressions,
        resets: dashboardData.resets,
        currentLevel: dashboardData.currentLevel,
        username: userData?.username ?? "",
        selectedLevels,
      };

      let rowCount = 0;
      let csv = "";
      let datasetLabel = "";
      let filenamePrefix = "";

      if (format === "detailed") {
        const rows: LevelAnalyticsDetailedExportRow[] =
          buildLevelAnalyticsDetailedExportRows(baseParams);
        rowCount = rows.length;
        csv = serializeLevelAnalyticsDetailedExportRows(rows);
        datasetLabel = "Detailed";
        filenamePrefix = "level-analytics-detailed";
      } else {
        const rows: LevelAnalyticsExportRow[] =
          buildLevelAnalyticsExportRows(baseParams);
        rowCount = rows.length;
        csv = serializeLevelAnalyticsExportRows(rows);
        datasetLabel = "Summary";
        filenamePrefix = "level-analytics-summary";
      }

      if (rowCount === 0) {
        Alert.alert(
          "No rows to export",
          "No analytics rows matched your selected levels.",
        );
        return;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${filenamePrefix}-${timestamp}.csv`;
      const exportFile = new File(Paths.document, filename);
      exportFile.write(csv);

      // Stop showing spinner before opening system share sheet.
      setIsExportingLevelAnalytics(false);

      await Share.share({
        title: `${datasetLabel} level analytics CSV`,
        message:
          Platform.OS === "android"
            ? `${datasetLabel} level analytics CSV exported to:\n${exportFile.uri}`
            : undefined,
        url: exportFile.uri,
      });
    } catch (error) {
      console.error("Failed to export level analytics:", error);
      Alert.alert(
        "Export failed",
        "Could not export level analytics right now. Please try again.",
      );
    } finally {
      setIsExportingLevelAnalytics(false);
    }
  };

  const handleConfirmLevelAnalyticsExport = async () => {
    if (selectedLevelAnalyticsLevels.length === 0) {
      Alert.alert(
        "Select levels",
        "Choose at least one level before exporting analytics.",
      );
      return;
    }

    const selectedSnapshot = [...selectedLevelAnalyticsLevels];
    const formatSnapshot = levelAnalyticsExportFormat;

    setShowLevelAnalyticsExportModal(false);
    // On iOS, presenting Share immediately while this modal is dismissing can fail silently.
    // Queue export until the dismissal animation has finished.
    setTimeout(() => {
      void exportLevelAnalytics(formatSnapshot, selectedSnapshot);
    }, 250);
  };

  return {
    acceptAnyKanjiOnyomiReading,
    acceptUserSynonymsAsAnswers,
    Alert,
    allowSkippingReviews,
    ankiButtonlessMode,
    ankiCardMode,
    ankiCardModeScope,
    ankiGroupQuestions,
    ankiShowOtherAcceptedAnswersAndUserSynonyms,
    answerStopPreviewImageHeight,
    apiToken,
    appleMusicAuthError,
    appleMusicAuthStatus,
    applyReviewShortcutValue,
    autoplayLessonReadingAudio,
    autoplayVocabularyAudio,
    autoSwitchKeyboard,
    availableLevelAnalyticsLevels,
    backToBackImmediateRetryIncorrect,
    backToBackQuestions,
    beginReviewShortcutCapture,
    bunproFeatureRequestInput,
    bunproIntegrationAnswer,
    bunproSurveyCompleted,
    bunproUsageAnswer,
    cacheAnalysis,
    cacheHealthStatus,
    canAccessApiDebugTools,
    canDecreaseReviewCharacterFontScale,
    canIncreaseReviewCharacterFontScale,
    capturingReviewShortcutKey,
    checkAppleMusicSubscription,
    clearLevelAnalyticsLevels,
    closeReviewShortcutModal,
    closeSrsProgressionCardModePicker,
    closeVocabularyAudioVoicePicker,
    dailyLessonLimit,
    dailyLessonLimitMax,
    dailyLessonLimitMin,
    dailyLessonLimitStep,
    dailyLessonReminderEnabled,
    dailyLessonReminderMinimum,
    dailyLessonReminderMinimumMax,
    dailyLessonReminderMinimumMin,
    dailyLessonReminderMinimumStep,
    dailyReviewReminderEnabled,
    dailyReviewReminderHour,
    dailyReviewReminderMinute,
    dashboardData,
    disableAutoProgressOnCloseAnswer,
    disableAutoProgressOnCorrect,
    disableAutoProgressOnWrong,
    effectiveReviewWrapUpQuestionGap,
    enableReviewNotifications,
    ensureAppleMusicCatalogPlaybackAccess,
    excludeKanaVocabularyFromLessons,
    expoPendingNotifications,
    exportLevelAnalytics,
    fetchAllSubjectsFromApi,
    formatByteSize,
    formatCount,
    formatExpoTriggerLabel,
    formatNativeTriggerLabel,
    formatReminderTimeLabel,
    formatReviewCharacterFontScale,
    formatReviewShortcutLabel,
    getAppleMusicStatusLabel,
    getAppleMusicSubscriptionAlertMessage,
    getCurrentPatchNotesVersion,
    getCurrentVoiceDisplayName,
    getLessonOrderLabel,
    getNextDailyLessonLimit,
    getNextDailyLessonReminderMinimum,
    getPreviousDailyLessonLimit,
    getPreviousDailyLessonReminderMinimum,
    getReviewOrderLabel,
    getSrsProgressionCardModeIconName,
    getSrsProgressionCardModeLabel,
    getVocabularyAudioVoiceIconName,
    getVocabularyAudioVoiceLabel,
    gravatarEmail,
    gravatarEmailInput,
    handleAppleMusicLogin,
    handleBack,
    handleBadgeNotificationChange,
    handleBlockedFullModeSelection,
    handleBunproUsageSelection,
    handleCacheAnalysis,
    handleCheckCacheHealth,
    handleClearAllCache,
    handleClearApiDebug,
    handleClearApiTimeline,
    handleClearCategory,
    handleClearLargeItems,
    handleClearOfflineAudioCache,
    handleConfirmLevelAnalyticsExport,
    handleDailyLessonLimitToggle,
    handleDailyLessonReminderChange,
    handleDailyLessonReminderMinimumChange,
    handleDailyReviewReminderChange,
    handleDetailedSubjectsAnalysis,
    handleDevClearAndLogout,
    handleExportApiTimeline,
    handleJpdbApiKeyInfoPress,
    handleLogout,
    handleOfflineVocabularyAudioToggle,
    handleOpenLevelAnalyticsExportModal,
    handleOptimizeCache,
    handlePatreonPress,
    handlePlaybackSourceChange,
    handleRateAppPress,
    handleRemoveJpdbApiKey,
    handleRepairCache,
    handleReviewNotificationChange,
    handleReviewShortcutCaptureKeyPress,
    handleReviewShortcutCaptureSubmit,
    handleSaveGravatarEmail,
    handleSaveJpdbApiKey,
    handleSaveReminderTime,
    handleSettingsScroll,
    handleShowApiDetails,
    handleShowApiSummary,
    handleShowApiTimelineSummary,
    handleShowPendingNotifications,
    handleSubmitBunproSurvey,
    handleVoiceSelection,
    hapticFeedbackEnabled,
    hasStoredJpdbApiKey,
    hideContextSentenceTranslations,
    insets,
    interleaveLessonTypesEnabled,
    isAnalyzingCache,
    isAnyDailyReminderEnabled,
    isAppleMusicAuthAvailable,
    isAppleMusicAuthenticating,
    isCheckingCacheHealth,
    isClearingOfflineAudioCache,
    isDailyLessonLimitEnabled,
    isDark,
    isExportingLevelAnalytics,
    isLoadingJpdbApiKey,
    isPortegoUser,
    isRepairingCache,
    isRunningOnMacFromIOS,
    isSavingJpdbApiKey,
    isSongsHiddenForEmail,
    isSubmittingBunproSurvey,
    JAPANESE_KEYBOARD_SETUP_INSTRUCTIONS,
    JAPANESE_VOICES,
    jitaiEnabled,
    jitaiSelectedFontIds,
    jpdbApiKeyInput,
    jpdbApiKeyStatus,
    KeyboardManager,
    lastSeenPatchNotesVersion,
    lessonBatchSize,
    lessonOrder,
    lessonPickerViewMode,
    lessonTypeOrderEnabled,
    levelAnalyticsExportFormat,
    loadCurrentVoice,
    logout,
    modalHeaderPaddingTop,
    myAnimeListUsername,
    newsDefaultStudyMode,
    normalizedEmail,
    offlineAudioCacheFileCount,
    offlineAudioCacheSizeBytes,
    offlineAudioProgress,
    offlineCacheRefreshInFlightRef,
    offlineVocabularyAudioEnabled,
    openReminderTimeModal,
    openReviewShortcutModal,
    openSrsProgressionCardModePicker,
    openVocabularyAudioVoicePicker,
    params,
    pendingNotifications,
    pendingSectionScrollRequest,
    PerformanceDashboard,
    Platform,
    previousOfflineAudioInProgressRef,
    prioritizeCriticalItems,
    refreshOfflineAudioCacheSize,
    reminderHourDraft,
    reminderMinuteDraft,
    requestAppleMusicAuthorization,
    REVIEW_CHARACTER_FONT_SCALE_STEP,
    REVIEW_CORRECT_SHORTCUT_FIELDS,
    REVIEW_INCORRECT_SHORTCUT_FIELDS,
    reviewAnimatePreviousQuestion,
    reviewBatchSize,
    reviewBatchSizeEnabled,
    reviewCharacterFontScale,
    reviewCorrectKeyboardShortcuts,
    reviewCorrectShortcutDraft,
    reviewIncorrectKeyboardShortcuts,
    reviewIncorrectShortcutDraft,
    reviewOrder,
    reviewSearchButtonEnabled,
    reviewShortcutCaptureInputRef,
    reviewShortcutSheetTopPadding,
    reviewTypeOrderEnabled,
    reviewWrapUpTargetMax,
    reviewWrapUpTargetMin,
    reviewWrapUpTargetStep,
    reviewWrapUpTargetSubjects,
    router,
    saveSelectedVoice,
    scrollToParam,
    scrollToSection,
    scrollViewRef,
    sectionChipBarWidth,
    sectionChipLayouts,
    sectionChips,
    sectionChipScrollViewRef,
    sectionOffsets,
    selectAllLevelAnalyticsLevels,
    selectedLevelAnalyticsLevels,
    selectedSectionKey,
    selectedVoice,
    selectSrsProgressionCardMode,
    selectVocabularyAudioVoice,
    setAcceptAnyKanjiOnyomiReading,
    setAcceptUserSynonymsAsAnswers,
    setAllowSkippingReviews,
    setAnkiButtonlessMode,
    setAnkiCardMode,
    setAnkiShowOtherAcceptedAnswersAndUserSynonyms,
    setAppleMusicAuthStatus,
    setAutoplayLessonReadingAudio,
    setAutoplayVocabularyAudio,
    setAutoSwitchKeyboard,
    setBackToBackImmediateRetryIncorrect,
    setBackToBackQuestions,
    setBunproFeatureRequestInput,
    setBunproIntegrationAnswer,
    setBunproSurveyCompleted,
    setBunproUsageAnswer,
    setCacheAnalysis,
    setCacheHealthStatus,
    setCapturingReviewShortcutKey,
    setDailyLessonLimit,
    setDailyLessonReminderEnabled,
    setDailyLessonReminderMinimum,
    setDailyReviewReminderEnabled,
    setDailyReviewReminderHour,
    setDailyReviewReminderMinute,
    setDisableAutoProgressOnCloseAnswer,
    setDisableAutoProgressOnCorrect,
    setDisableAutoProgressOnWrong,
    setEnableReviewNotifications,
    setExcludeKanaVocabularyFromLessons,
    setExpoPendingNotifications,
    setGravatarEmail,
    setGravatarEmailInput,
    setHapticFeedbackEnabled,
    setHasStoredJpdbApiKey,
    setHideContextSentenceTranslations,
    setIsAnalyzingCache,
    setIsCheckingCacheHealth,
    setIsClearingOfflineAudioCache,
    setIsExportingLevelAnalytics,
    setIsLoadingJpdbApiKey,
    setIsRepairingCache,
    setIsSavingJpdbApiKey,
    setIsSubmittingBunproSurvey,
    setJitaiEnabled,
    setJpdbApiKeyInput,
    setJpdbApiKeyStatus,
    setLessonBatchSize,
    setLessonPickerViewMode,
    setLevelAnalyticsExportFormat,
    setMyAnimeListUsername,
    setNewsDefaultStudyMode,
    setOfflineAudioCacheFileCount,
    setOfflineAudioCacheSizeBytes,
    setOfflineAudioProgress,
    setOfflineVocabularyAudioEnabled,
    setPendingNotifications,
    setPendingSectionScrollRequest,
    setPrioritizeCriticalItems,
    setReminderHourDraft,
    setReminderMinuteDraft,
    setReviewAnimatePreviousQuestion,
    setReviewBatchSize,
    setReviewBatchSizeEnabled,
    setReviewCharacterFontScale,
    setReviewCorrectKeyboardShortcuts,
    setReviewCorrectShortcutDraft,
    setReviewIncorrectKeyboardShortcuts,
    setReviewIncorrectShortcutDraft,
    setReviewSearchButtonEnabled,
    setReviewWrapUpTargetSubjects,
    setSectionChipBarWidth,
    setSectionChipLayouts,
    setSectionOffsets,
    setSelectedLevelAnalyticsLevels,
    setSelectedSectionKey,
    setSelectedVoice,
    setShowAddSynonymButton,
    setShowAnswerStopDetailsPreview,
    setShowAnswerStopSubjectDetails,
    setShowBadgeNotifications,
    setShowBunproSurveyModal,
    setShowCacheModal,
    setShowContextSentenceSpeedControl,
    setShowLevelAnalyticsExportModal,
    setShowMediaContextSentences,
    setShowMnemonicIllustrations,
    setShowNotificationsModal,
    setShowOnyomiInKatakana,
    setShowOpenSourceModal,
    setShowPatternsOfUse,
    setShowPerformanceDashboard,
    setShowPitchAccent,
    setShowReminderTimeModal,
    setShowReviewItemLevelAndSrsStage,
    setShowReviewShortcutModal,
    setShowSimilarVocabulary,
    setShowSingleKanjiVocabularySimilarKanji,
    setShowSrsProgressionCardModeMenu,
    setShowStrokeOrder,
    setShowVocabularyVoiceMenu,
    setShowVoiceModal,
    setSinglePageLessonView,
    setSkipCustomLessonQuiz,
    setSongsLyricsDefaultStudyMode,
    setSongsPlaybackSource,
    setSrsProgressionCardDisplayMode,
    setStrokeLeniency,
    setTestingVoiceId,
    setThemeMode,
    settingsBottomPadding,
    setVisuallySimilarKanjiSource,
    setVocabularyAudioVoice,
    setVoiceReviewAnswersEnabled,
    sheetBottomPadding,
    sheetHorizontalPadding,
    showAddSynonymButton,
    showAnswerStopDetailsPreview,
    showAnswerStopSubjectDetails,
    showBadgeNotifications,
    showBunproSurvey,
    showBunproSurveyModal,
    showCacheModal,
    showContextSentenceSpeedControl,
    showDataStorageSection,
    showLevelAnalyticsExportModal,
    showLevelRecapSection,
    showMediaContextSentences,
    showMnemonicIllustrations,
    showMusicPlaybackSection,
    showNotificationsModal,
    showOnyomiInKatakana,
    showOpenSourceModal,
    showPatternsOfUse,
    showPerformanceDashboard,
    showPitchAccent,
    showReminderTimeModal,
    showReviewItemLevelAndSrsStage,
    showReviewShortcutModal,
    showSimilarVocabulary,
    showSingleKanjiVocabularySimilarKanji,
    showSrsProgressionCardModeMenu,
    showStrokeOrder,
    showVocabularyVoiceMenu,
    showVoiceModal,
    showWidgetsSection,
    signOut,
    singlePageLessonView,
    skipCustomLessonQuiz,
    songsLyricsDefaultStudyMode,
    songsPlaybackSource,
    SRS_PROGRESSION_CARD_MODE_OPTIONS,
    srsProgressionCardDisplayMode,
    STOP_DETAILS_PREVIEW_IMAGE,
    strokeLeniency,
    STUDY_MODE_DEFAULT_OPTIONS,
    StyleSheet,
    submitBunproSurveyResponse,
    testingVoiceId,
    testVoice,
    theme,
    themeMode,
    toggleLevelAnalyticsLevelSelection,
    triggerOfflineAudioDownload,
    updateSectionChipLayout,
    updateSectionOffset,
    userData,
    visuallySimilarKanjiSource,
    VOCABULARY_AUDIO_VOICE_OPTIONS,
    vocabularyAudioVoice,
    voiceReviewAnswersEnabled,
    windowHeight,
  };
}

export type SettingsController = ReturnType<typeof useSettingsController>;
