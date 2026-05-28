import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as StoreReview from "expo-store-review";
import * as Updates from "expo-updates";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GlassButton } from "../../../src/components/GlassButton";
import HomeDashboardWidget from "../../../src/components/HomeDashboardWidget";
import LoadingProgressBar from "../../../src/components/LoadingProgressBar";
import OpenSourceModal from "../../../src/components/OpenSourceModal";
import { BunproSwitchIcon } from "../../../src/components/SwitchModeIcons";
import { UserAvatar } from "../../../src/components/UserAvatar";
import { useBackgroundTasks } from "../../../src/contexts/BackgroundTasksContext";
import { useDashboardData } from "../../../src/hooks/useDashboardData";
import { useUsageStreak } from "../../../src/hooks/useUsageStreak";
import { rateAppService } from "../../../src/services/rateAppService";
import {
  clearInMemoryCache,
  isAssignmentInReviewQueueState,
  type Assignment,
} from "../../../src/utils/api";
import { apiDebugger } from "../../../src/utils/apiDebugger";
import { updateBadgeWithReviewCount } from "../../../src/utils/badgeNotifications";
import { normalizeHomeWidgetOrder } from "../../../src/utils/homeWidgets";
import {
  RESUMABLE_EXTRA_STUDY_MODE_SESSION_ENTRIES,
  type ExtraStudyModeId,
} from "../../../src/utils/extraStudyModes";
import {
  filterRecentLessonAssignments,
} from "../../../src/utils/recentLessonsWindow";
import { hasExtraStudySessionState } from "../../../src/utils/extraStudySessionPersistence";
import { supportsNativeTabs } from "../../../src/utils/nativeTabs";
import {
  useSubjectColors,
  withAlpha,
} from "../../../src/utils/subjectColors";
import {
  endSession,
  startPerformanceTimer,
  startSession,
} from "../../../src/utils/performanceLogger";
import {
  getEffectiveLessonCount,
  getRemainingDailyLessonSlots,
} from "../../../src/utils/dailyLessonLimit";
import { shouldUseNativeReviewNotificationSystem } from "../../../src/utils/reviewNotificationIntegration";
import { updateLastReviewCount } from "../../../src/utils/reviewNotifications";
import { isPortegoUsername } from "../../../src/utils/portegoAccess";
import {
  hasSeenOpenSourceAnnouncement,
  markOpenSourceAnnouncementSeen,
} from "../../../src/utils/openSourceAnnouncement";
import { useAuthStore, useSettingsStore } from "../../../src/utils/store";
import { useTheme } from "../../../src/utils/theme";
import {
  reloadHomeWidget,
  updateHomeWidgetSnapshot,
} from "../../../src/widgets/homeWidget";

const STREAK_REVIEW_PROMPT_THRESHOLD = 5;
const STREAK_REVIEW_PROMPTED_CACHE_KEY_PREFIX = "rate_app_streak_prompted";
const STREAK_DAY_KEY_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getStreakReviewPromptCacheKey(userId: string) {
  return `${STREAK_REVIEW_PROMPTED_CACHE_KEY_PREFIX}_${userId}`;
}

function toLocalDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getStreakDayKeyFormatter(timezone: string): Intl.DateTimeFormat {
  const normalizedTimezone = timezone.trim();
  const cachedFormatter = STREAK_DAY_KEY_FORMATTER_CACHE.get(normalizedTimezone);
  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizedTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  STREAK_DAY_KEY_FORMATTER_CACHE.set(normalizedTimezone, formatter);
  return formatter;
}

function toDayKeyInTimezone(date: Date, timezone?: string): string {
  if (typeof timezone !== "string" || timezone.trim().length === 0) {
    return toLocalDayKey(date);
  }

  try {
    const parts = getStreakDayKeyFormatter(timezone).formatToParts(date);
    const year = parts.find((part) => part.type === "year")?.value;
    const month = parts.find((part) => part.type === "month")?.value;
    const day = parts.find((part) => part.type === "day")?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fallback to local day key if timezone formatting fails.
  }

  return toLocalDayKey(date);
}

export default function StudyTab() {
  const {
    apiToken,
    userData,
    learnedKanjiCount,
    lastWrappedLevel,
    setLastWrappedLevel,
  } = useAuthStore();
  const gravatarEmail = useSettingsStore((state) => state.gravatarEmail);
  const dailyLessonLimit = useSettingsStore((state) => state.dailyLessonLimit);
  const excludeKanaVocabularyFromLessons = useSettingsStore(
    (state) => state.excludeKanaVocabularyFromLessons,
  );
  const homeWidgetOrder = useSettingsStore((state) => state.homeWidgetOrder);
  const homeRecentLessonsWindow = useSettingsStore(
    (state) => state.homeRecentLessonsWindow,
  );
  const homeSrsBreakdownDisplayMode = useSettingsStore(
    (state) => state.homeSrsBreakdownDisplayMode,
  );
  const otaUpdateExperience = useSettingsStore(
    (state) => state.otaUpdateExperience,
  );
  const widgetContentMode = useSettingsStore((state) => state.widgetContentMode);
  const widgetStreakGradient = useSettingsStore(
    (state) => state.widgetStreakGradient,
  );
  const {
    currentStreak,
    longestStreak,
    freezeAvailable,
    freezeDaysUntilReload,
    timezone: streakTimezone,
    recentDays: streakRecentDays,
    isLoading: isStreakLoading,
    error: streakError,
    refresh: refreshStreak,
  } = useUsageStreak(userData?.id);
  const { theme, isDark } = useTheme();
  const subjectColors = useSubjectColors();
  const { isRunning: backgroundTasksRunning } = useBackgroundTasks();
  const {
    dashboardData,
    isLoading,
    loadingProgress,
    refreshData,
    refreshLessonsAndReviews,
    errorStatus,
    isFreshData,
  } = useDashboardData();
  const params = useLocalSearchParams();
  const refreshTriggeredRef = useRef(false);
  const hasSeenInitialFocusRef = useRef(false);
  const lessonsReviewsRefreshInFlightRef = useRef(false);
  const lastLessonsReviewsRefreshAtRef = useRef(0);
  const streakReviewPromptInFlightRef = useRef(false);
  const openSourceAnnouncementCheckInFlightRef = useRef(false);
  const lastOpenSourceAnnouncementUserIdRef = useRef<string | null>(null);
  const lastStreakWidgetSignatureRef = useRef<string | null>(null);
  const lastManualWidgetRefreshTokenRef = useRef(0);
  const lastStreakRefreshDayKeyRef = useRef<string | null>(null);
  const [screenData, setScreenData] = useState(Dimensions.get("window"));
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showOpenSourceModal, setShowOpenSourceModal] = useState(false);
  const [activeExtraStudySessionModeIds, setActiveExtraStudySessionModeIds] =
    useState<ExtraStudyModeId[]>([]);
  const [manualWidgetRefreshToken, setManualWidgetRefreshToken] = useState(0);
  const remainingDailyLessonSlots = useMemo(
    () =>
      getRemainingDailyLessonSlots(
        dailyLessonLimit,
        dashboardData.assignments,
      ),
    [dailyLessonLimit, dashboardData.assignments],
  );
  const availableLessonCount = useMemo(() => {
    if (!excludeKanaVocabularyFromLessons) {
      return dashboardData.lessonCount;
    }

    if (!Array.isArray(dashboardData.assignments)) {
      return 0;
    }

    const subjectTypeById = new Map<number, string>();
    if (Array.isArray(dashboardData.subjects)) {
      dashboardData.subjects.forEach((subject) => {
        if (typeof subject?.id === "number" && typeof subject?.object === "string") {
          subjectTypeById.set(subject.id, subject.object);
        }
      });
    }

    return dashboardData.assignments.filter((assignment: any) => {
      if (
        !assignment?.data?.unlocked_at ||
        assignment.data.started_at ||
        assignment.data.hidden
      ) {
        return false;
      }

      const subjectType = subjectTypeById.get(assignment.data.subject_id);
      return subjectType !== "kana_vocabulary";
    }).length;
  }, [
    dashboardData.assignments,
    dashboardData.lessonCount,
    dashboardData.subjects,
    excludeKanaVocabularyFromLessons,
  ]);
  const effectiveLessonCount = useMemo(
    () =>
      getEffectiveLessonCount(
        availableLessonCount,
        dailyLessonLimit,
        dashboardData.assignments,
      ),
    [availableLessonCount, dailyLessonLimit, dashboardData.assignments],
  );
  const isDailyLessonLimitReached =
    dailyLessonLimit > 0 &&
    availableLessonCount > 0 &&
    Number.isFinite(remainingDailyLessonSlots) &&
    remainingDailyLessonSlots <= 0;
  const todayReviewTotal = useMemo(
    () => dashboardData.forecast[0]?.totalCount ?? dashboardData.reviewCount,
    [dashboardData.forecast, dashboardData.reviewCount],
  );
  const topCriticalItem = dashboardData.criticalItems[0] ?? null;
  const activeHomeWidgetOrder = useMemo(
    () => normalizeHomeWidgetOrder(homeWidgetOrder),
    [homeWidgetOrder],
  );
  const recentLessonCountForWindow = useMemo(() => {
    if (homeRecentLessonsWindow === "apprentice") {
      return dashboardData.recentLessonCount;
    }

    return filterRecentLessonAssignments(
      dashboardData.assignments as Assignment[],
      homeRecentLessonsWindow,
    ).length;
  }, [
    dashboardData.assignments,
    dashboardData.recentLessonCount,
    homeRecentLessonsWindow,
  ]);
  const widgetReviewUpcomingBuckets = useMemo(() => {
    const now = new Date();
    const twentyFourHoursLater = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const bucketCounts = new Map<number, number>();

    for (const assignment of dashboardData.assignments ?? []) {
      const assignmentData = assignment?.data;
      if (!isAssignmentInReviewQueueState(assignmentData)) {
        continue;
      }

      const availableAt = new Date(assignmentData.available_at);
      if (Number.isNaN(availableAt.getTime())) {
        continue;
      }

      if (availableAt <= now || availableAt > twentyFourHoursLater) {
        continue;
      }

      availableAt.setMinutes(0, 0, 0);
      const bucketTimestamp = availableAt.getTime();
      bucketCounts.set(
        bucketTimestamp,
        (bucketCounts.get(bucketTimestamp) ?? 0) + 1,
      );
    }

    return Array.from(bucketCounts.entries())
      .sort(([leftTimestamp], [rightTimestamp]) => leftTimestamp - rightTimestamp)
      .map(([timestamp, count]) => ({
        date: new Date(timestamp).toISOString(),
        count,
      }));
  }, [dashboardData.assignments]);

  const refreshLessonsReviewsCounts = useCallback(
    async (force = false) => {
      const MIN_REFRESH_INTERVAL_MS = 8000;
      const now = Date.now();

      if (lessonsReviewsRefreshInFlightRef.current) {
        return;
      }

      if (
        !force &&
        now - lastLessonsReviewsRefreshAtRef.current < MIN_REFRESH_INTERVAL_MS
      ) {
        return;
      }

      lessonsReviewsRefreshInFlightRef.current = true;

      try {
        await refreshLessonsAndReviews();
      } catch (error) {
        console.error("Failed to refresh lessons/reviews counts:", error);
      } finally {
        lastLessonsReviewsRefreshAtRef.current = Date.now();
        lessonsReviewsRefreshInFlightRef.current = false;
      }
    },
    [refreshLessonsAndReviews],
  );

  const refreshStreakIfCalendarDayChanged = useCallback(
    async () => {
      if (!userData?.id) {
        return;
      }

      const currentDayKey = toDayKeyInTimezone(new Date(), streakTimezone);
      const lastRefreshedDayKey = lastStreakRefreshDayKeyRef.current;

      if (lastRefreshedDayKey === null) {
        lastStreakRefreshDayKeyRef.current = currentDayKey;
        return;
      }

      if (lastRefreshedDayKey === currentDayKey) {
        return;
      }

      lastStreakRefreshDayKeyRef.current = currentDayKey;

      try {
        await refreshStreak();
      } catch {
        // Ignore streak refresh errors on focus. The next refresh path will retry.
      }
    },
    [refreshStreak, streakTimezone, userData?.id],
  );

  useEffect(() => {
    if (!userData?.id) {
      lastStreakRefreshDayKeyRef.current = null;
      return;
    }

    const currentDayKey = toDayKeyInTimezone(new Date(), streakTimezone);
    const todayInStreakSnapshot = streakRecentDays.find((day) => day.isToday)?.dayKey;
    lastStreakRefreshDayKeyRef.current = todayInStreakSnapshot ?? currentDayKey;
  }, [streakRecentDays, streakTimezone, userData?.id]);

  // Keep API debug access in sync with the authenticated username.
  useEffect(() => {
    apiDebugger.setDebugAccessByUsername(userData?.username);
  }, [userData?.username]);

  // Expose API debugger globally for console access
  useEffect(() => {
    if (__DEV__ || isPortegoUsername(userData?.username)) {
      (global as any).showApiSummary = () => apiDebugger.printSummary();
      (global as any).showApiDetails = () => apiDebugger.printDetailedLog();
      (global as any).showApiTimelineSummary = () =>
        apiDebugger.printTimelineSummary();
      (global as any).exportApiTimelinePayload = () =>
        apiDebugger.buildTimelineExportPayload();
      (global as any).clearApiDebug = () => apiDebugger.clear();
      (global as any).clearApiTimeline = () => apiDebugger.clearTimeline();
      (global as any).clearApiCache = () => clearInMemoryCache();
      return;
    }
    delete (global as any).showApiSummary;
    delete (global as any).showApiDetails;
    delete (global as any).showApiTimelineSummary;
    delete (global as any).exportApiTimelinePayload;
    delete (global as any).clearApiDebug;
    delete (global as any).clearApiTimeline;
    delete (global as any).clearApiCache;
  }, [userData?.username]);

  // Listen for orientation changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setScreenData(window);
    });

    return () => subscription?.remove();
  }, []);

  // Check for OTA updates in the background when the selected experience asks
  // Home to show the update banner.
  useEffect(() => {
    let isCancelled = false;

    if (otaUpdateExperience !== "background-banner") {
      setIsUpdateAvailable(false);
    }

    async function checkForUpdates() {
      if (
        __DEV__ ||
        !Updates.isEnabled ||
        otaUpdateExperience !== "background-banner"
      ) {
        setIsUpdateAvailable(false);
        return;
      }

      try {
        const update = await Updates.checkForUpdateAsync();
        if (!update.isAvailable && !update.isRollBackToEmbedded) {
          return;
        }

        const fetchResult = await Updates.fetchUpdateAsync();
        const isPendingForReload =
          fetchResult.isNew || fetchResult.isRollBackToEmbedded;

        if (
          !isCancelled &&
          isPendingForReload &&
          otaUpdateExperience === "background-banner"
        ) {
          setIsUpdateAvailable(true);
        }
      } catch (error) {
        console.error("Error checking for updates:", error);
      }
    }

    void checkForUpdates();
    return () => {
      isCancelled = true;
    };
  }, [otaUpdateExperience]);

  useEffect(() => {
    if (!userData?.id) {
      lastOpenSourceAnnouncementUserIdRef.current = null;
      return;
    }

    if (lastOpenSourceAnnouncementUserIdRef.current === userData.id) {
      return;
    }

    if (openSourceAnnouncementCheckInFlightRef.current) {
      return;
    }

    let isMounted = true;
    openSourceAnnouncementCheckInFlightRef.current = true;
    lastOpenSourceAnnouncementUserIdRef.current = userData.id;

    const checkOpenSourceAnnouncement = async () => {
      try {
        const hasSeenAnnouncement = await hasSeenOpenSourceAnnouncement(
          userData.id,
        );

        if (isMounted && !hasSeenAnnouncement) {
          setShowOpenSourceModal(true);
        }
      } catch (error) {
        console.error("Failed to check open-source announcement state:", error);
      } finally {
        openSourceAnnouncementCheckInFlightRef.current = false;
      }
    };

    void checkOpenSourceAnnouncement();

    return () => {
      isMounted = false;
    };
  }, [userData?.id]);

  const handleOpenSourceModalClose = useCallback(async () => {
    setShowOpenSourceModal(false);

    if (!userData?.id) {
      return;
    }

    try {
      await markOpenSourceAnnouncementSeen(userData.id);
    } catch (error) {
      console.error("Failed to save open-source announcement state:", error);
    }
  }, [userData?.id]);

  useEffect(() => {
    if (!userData?.id) {
      return;
    }

    if (isStreakLoading || streakError) {
      return;
    }

    if (currentStreak < STREAK_REVIEW_PROMPT_THRESHOLD) {
      return;
    }

    const maybePromptForStreakReview = async () => {
      if (streakReviewPromptInFlightRef.current) {
        return;
      }

      streakReviewPromptInFlightRef.current = true;
      const cacheKey = getStreakReviewPromptCacheKey(userData.id);

      try {
        const hasBeenPrompted = await AsyncStorage.getItem(cacheKey);
        if (hasBeenPrompted === "true") {
          return;
        }

        const canRequestReview = await StoreReview.isAvailableAsync();
        if (!canRequestReview) {
          return;
        }

        await AsyncStorage.setItem(cacheKey, "true");

        try {
          await StoreReview.requestReview();
        } catch (error) {
          await AsyncStorage.removeItem(cacheKey).catch(() => {});
          throw error;
        }

        if (apiToken) {
          void rateAppService.logRateAppClick({
            userId: userData.id ?? null,
            userEmail: gravatarEmail,
            userUsername: userData.username,
            userLevel: userData.level,
            source: "Streak",
          });
        }
      } catch (error) {
        console.error("Failed to trigger streak review prompt:", error);
      } finally {
        streakReviewPromptInFlightRef.current = false;
      }
    };

    void maybePromptForStreakReview();
  }, [
    apiToken,
    currentStreak,
    gravatarEmail,
    isStreakLoading,
    streakError,
    userData?.id,
    userData?.level,
    userData?.username,
  ]);

  useEffect(() => {
    const currentDayKey = toDayKeyInTimezone(new Date(), streakTimezone);
    const shouldWaitForStreakSnapshot =
      widgetContentMode === "streak" &&
      Boolean(userData?.id) &&
      (isStreakLoading || streakRecentDays.length === 0);

    if (shouldWaitForStreakSnapshot) {
      return;
    }

    const widgetStreakRecentDays = streakRecentDays.map((day) => ({
      dayKey: day.dayKey,
      label: day.label,
      active: day.active,
      isToday: day.isToday,
    }));

    updateHomeWidgetSnapshot({
      contentMode: widgetContentMode,
      streakGradientPreset: widgetStreakGradient,
      isDarkTheme: isDark,
      reviewCount: dashboardData.reviewCount,
      nextReviewDate: dashboardData.nextReviewDate,
      todayReviewTotal,
      criticalCount: dashboardData.criticalItems.length,
      topCriticalItem: topCriticalItem
        ? {
            characters: topCriticalItem.characters,
            meaning: topCriticalItem.meaning,
            percentage: topCriticalItem.percentage,
          }
        : null,
      recentMistakesCount: dashboardData.recentMistakes.length,
      currentStreak,
      longestStreak,
      freezeAvailable,
      freezeDaysUntilReload,
      streakTimezone,
      reviewUpcomingBuckets: widgetReviewUpcomingBuckets,
      streakRecentDays: widgetStreakRecentDays,
    });

    const shouldForceWidgetReload =
      manualWidgetRefreshToken !== lastManualWidgetRefreshTokenRef.current;
    if (shouldForceWidgetReload) {
      lastManualWidgetRefreshTokenRef.current = manualWidgetRefreshToken;
    }

    if (widgetContentMode !== "streak") {
      if (shouldForceWidgetReload) {
        reloadHomeWidget();
      }
      return;
    }

    const todayStreakDay =
      streakRecentDays.find((day) => day.dayKey === currentDayKey) ??
      streakRecentDays.find((day) => day.isToday) ??
      streakRecentDays[streakRecentDays.length - 1] ??
      null;
    if (!todayStreakDay) {
      if (shouldForceWidgetReload) {
        reloadHomeWidget();
      }
      return;
    }

    const streakWidgetSignature = [
      currentDayKey,
      todayStreakDay.dayKey,
      todayStreakDay.active ? "1" : "0",
      String(currentStreak),
      String(longestStreak),
      freezeAvailable ? "1" : "0",
      String(freezeDaysUntilReload),
    ].join(":");

    const didStreakSignatureChange =
      streakWidgetSignature !== lastStreakWidgetSignatureRef.current;
    if (didStreakSignatureChange) {
      lastStreakWidgetSignatureRef.current = streakWidgetSignature;
    }

    if (didStreakSignatureChange || shouldForceWidgetReload) {
      reloadHomeWidget();
    }
  }, [
    currentStreak,
    dashboardData.criticalItems.length,
    dashboardData.nextReviewDate,
    dashboardData.recentMistakes.length,
    dashboardData.reviewCount,
    dashboardData.assignments,
    isStreakLoading,
    streakError,
    freezeAvailable,
    freezeDaysUntilReload,
    streakTimezone,
    longestStreak,
    widgetReviewUpcomingBuckets,
    streakRecentDays,
    topCriticalItem,
    todayReviewTotal,
    isDark,
    manualWidgetRefreshToken,
    widgetContentMode,
    widgetStreakGradient,
    userData?.id,
  ]);

  // Keep the landscape check for the lessons/reviews card which might need different behavior
  const isIPadLandscape =
    screenData.width > 768 && screenData.width > screenData.height;

  // Refresh when returning to Home from other screens (lessons/reviews, gestures, etc.).
  useFocusEffect(
    useCallback(() => {
      let isFocused = true;
      const isInitialFocus = !hasSeenInitialFocusRef.current;
      if (isInitialFocus) {
        hasSeenInitialFocusRef.current = true;
      }

      const refreshExtraStudySessionIndicators = async () => {
        const sessionStates = await Promise.all(
          RESUMABLE_EXTRA_STUDY_MODE_SESSION_ENTRIES.map(
            async ([modeId, storageKey]) =>
              [modeId, await hasExtraStudySessionState(storageKey)] as const,
          ),
        );

        if (isFocused) {
          setActiveExtraStudySessionModeIds(
            sessionStates
              .filter(([, hasSavedSession]) => hasSavedSession)
              .map(([modeId]) => modeId),
          );
        }
      };

      void refreshExtraStudySessionIndicators();
      void refreshStreakIfCalendarDayChanged();

      if (isInitialFocus) {
        return () => {
          isFocused = false;
        };
      }

      void refreshLessonsReviewsCounts();

      return () => {
        isFocused = false;
      };
    }, [refreshLessonsReviewsCounts, refreshStreakIfCalendarDayChanged]),
  );

  // Check for the refresh parameter (used when returning from reviews)
  useEffect(() => {
    if (
      params.refreshLessonsReviews === "true" &&
      !refreshTriggeredRef.current
    ) {
      refreshTriggeredRef.current = true;
      void refreshLessonsReviewsCounts(true);

      // Clear the parameter from the URL to prevent refresh on subsequent renders
      router.setParams({});
    } else if (!params.refreshLessonsReviews) {
      // Reset the flag when the parameter is cleared
      refreshTriggeredRef.current = false;
    }
  }, [params, refreshLessonsReviewsCounts]);

  const onRefresh = useCallback(async () => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    const sessionId = startSession("Homepage Refresh");
    const timer = startPerformanceTimer("Homepage onRefresh", "index.tsx");

    try {
      // Clear in-memory cache to force fresh data
      clearInMemoryCache();
      await refreshData();
      await refreshStreak();
      // Update badge count after refreshing data
      await updateBadgeWithReviewCount({
        forceSummaryRefresh: true,
      });
      // Legacy review baseline tracking is only used on non-iOS paths.
      if (!shouldUseNativeReviewNotificationSystem()) {
        await updateLastReviewCount();
      }

      timer.end({ sessionId });
    } catch (error: unknown) {
      timer.end(
        {
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        },
        false,
      );
      throw error;
    } finally {
      endSession();
      setManualWidgetRefreshToken((prevToken) => prevToken + 1);
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshData, refreshStreak]);

  const handleLessonsPress = () => {
    if (effectiveLessonCount <= 0) {
      return;
    }

    // Navigate to lessons screen
    router.push("/lessons");
  };

  const handleLessonPicker = () => {
    // Navigate to lesson picker screen
    router.push("/lesson-picker");
  };

  const handleReviewsPress = () => {
    // Navigate to reviews screen
    router.push("/reviews");
  };

  const handleUpdateApp = async () => {
    const reloadScreenOptions = {
      backgroundColor: theme.backgroundColor,
      image: require("../../../assets/images/splash-icon.png"),
      imageResizeMode: "contain" as const,
      fade: true,
      spinner: { enabled: false },
    };

    try {
      setIsDownloadingUpdate(true);
      await Updates.reloadAsync({ reloadScreenOptions });
    } catch (error) {
      console.error("Error applying update:", error);
      try {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync({ reloadScreenOptions });
      } catch (fallbackError) {
        console.error("Error fetching update before reload:", fallbackError);
        setIsDownloadingUpdate(false);
      }
    }
  };

  // Show initial loading only if we have no cached data and are in the initial loading stages
  if (
    isLoading &&
    !isFreshData &&
    !dashboardData.dataLoadingState.summary &&
    dashboardData.currentLevel === 1
  ) {
    return (
      <View
        style={[
          styles.loadingContainer,
          { backgroundColor: theme.backgroundColor },
        ]}
      >
        <ActivityIndicator size="large" color={theme.secondary} />
        <Text style={[styles.loadingText, { color: theme.textColor }]}>
          Loading study data...
        </Text>
      </View>
    );
  }

  const shouldUseNativeTabsPadding = supportsNativeTabs();
  const isOnVacation = Boolean(userData?.current_vacation_started_at);
  const hasRecentMistakes = dashboardData.recentMistakes.length > 0;
  const shouldShowRecentMistakes = !isOnVacation && hasRecentMistakes;

  const canAccessBunpro = isPortegoUsername(userData?.username);
  const headerIconColor = theme.isDark ? theme.headerText : "#000000";
  const renderHomeWidgets = () => {
    const widgetElements: React.ReactNode[] = [];

    for (let index = 0; index < activeHomeWidgetOrder.length; index += 1) {
      const widgetId = activeHomeWidgetOrder[index];
      const nextWidgetId = activeHomeWidgetOrder[index + 1];

      const shouldRenderSideBySideSecondaryWidgets =
        shouldShowRecentMistakes &&
        isIPadLandscape &&
        widgetId === "recentMistakes" &&
        nextWidgetId === "streak";

      if (shouldRenderSideBySideSecondaryWidgets) {
        widgetElements.push(
          <View
            key={`secondary-row-${index}`}
            style={styles.secondaryCardsRow}
          >
            <View style={styles.secondaryCardColumn}>
              <HomeDashboardWidget
                widgetId="recentMistakes"
                dashboardData={dashboardData}
                userData={userData}
                effectiveLessonCount={effectiveLessonCount}
                isDailyLessonLimitReached={isDailyLessonLimitReached}
                isIPadLandscape={isIPadLandscape}
                shouldShowRecentMistakes={shouldShowRecentMistakes}
                currentStreak={currentStreak}
                longestStreak={longestStreak}
                freezeAvailable={freezeAvailable}
                freezeDaysUntilReload={freezeDaysUntilReload}
                streakRecentDays={streakRecentDays}
                isStreakLoading={isStreakLoading}
                streakError={streakError}
                recentLessonsWindow={homeRecentLessonsWindow}
                recentLessonCountForWindow={recentLessonCountForWindow}
                onLessonsPress={handleLessonsPress}
                onLessonPicker={handleLessonPicker}
                onReviewsPress={handleReviewsPress}
                style={styles.secondaryCardEqualHeight}
              />
            </View>
            <View style={styles.secondaryCardColumn}>
              <HomeDashboardWidget
                widgetId="streak"
                dashboardData={dashboardData}
                userData={userData}
                effectiveLessonCount={effectiveLessonCount}
                isDailyLessonLimitReached={isDailyLessonLimitReached}
                isIPadLandscape={isIPadLandscape}
                shouldShowRecentMistakes={shouldShowRecentMistakes}
                currentStreak={currentStreak}
                longestStreak={longestStreak}
                freezeAvailable={freezeAvailable}
                freezeDaysUntilReload={freezeDaysUntilReload}
                streakRecentDays={streakRecentDays}
                isStreakLoading={isStreakLoading}
                streakError={streakError}
                recentLessonsWindow={homeRecentLessonsWindow}
                recentLessonCountForWindow={recentLessonCountForWindow}
                onLessonsPress={handleLessonsPress}
                onLessonPicker={handleLessonPicker}
                onReviewsPress={handleReviewsPress}
                style={styles.secondaryCardEqualHeight}
              />
            </View>
          </View>,
        );
        index += 1;
        continue;
      }

      const shouldRenderSplitSrsBreakdown =
        homeSrsBreakdownDisplayMode === "split" && widgetId === "srsBreakdown";

      if (shouldRenderSplitSrsBreakdown) {
        if (isIPadLandscape) {
          widgetElements.push(
            <View key={`srs-split-row-${index}`} style={styles.srsSplitRow}>
              <View style={styles.srsSplitColumn}>
                <HomeDashboardWidget
                  widgetId="srsBreakdown"
                  dashboardData={dashboardData}
                  userData={userData}
                  effectiveLessonCount={effectiveLessonCount}
                  isDailyLessonLimitReached={isDailyLessonLimitReached}
                  isIPadLandscape={isIPadLandscape}
                  shouldShowRecentMistakes={shouldShowRecentMistakes}
                  currentStreak={currentStreak}
                  longestStreak={longestStreak}
                  freezeAvailable={freezeAvailable}
                  freezeDaysUntilReload={freezeDaysUntilReload}
                  streakRecentDays={streakRecentDays}
                  isStreakLoading={isStreakLoading}
                  streakError={streakError}
                  recentLessonsWindow={homeRecentLessonsWindow}
                  recentLessonCountForWindow={recentLessonCountForWindow}
                  onLessonsPress={handleLessonsPress}
                  onLessonPicker={handleLessonPicker}
                  onReviewsPress={handleReviewsPress}
                  srsBreakdownView="graph"
                  srsBreakdownGroupStagesScope="graph"
                  style={styles.srsSplitWidget}
                />
              </View>
              <View style={styles.srsSplitColumn}>
                <HomeDashboardWidget
                  widgetId="srsBreakdown"
                  dashboardData={dashboardData}
                  userData={userData}
                  effectiveLessonCount={effectiveLessonCount}
                  isDailyLessonLimitReached={isDailyLessonLimitReached}
                  isIPadLandscape={isIPadLandscape}
                  shouldShowRecentMistakes={shouldShowRecentMistakes}
                  currentStreak={currentStreak}
                  longestStreak={longestStreak}
                  freezeAvailable={freezeAvailable}
                  freezeDaysUntilReload={freezeDaysUntilReload}
                  streakRecentDays={streakRecentDays}
                  isStreakLoading={isStreakLoading}
                  streakError={streakError}
                  recentLessonsWindow={homeRecentLessonsWindow}
                  recentLessonCountForWindow={recentLessonCountForWindow}
                  onLessonsPress={handleLessonsPress}
                  onLessonPicker={handleLessonPicker}
                  onReviewsPress={handleReviewsPress}
                  srsBreakdownView="details"
                  srsBreakdownGroupStagesScope="details"
                  style={styles.srsSplitWidget}
                />
              </View>
            </View>,
          );
          continue;
        }

        widgetElements.push(
          <HomeDashboardWidget
            key={`${widgetId}-${index}-graph`}
            widgetId={widgetId}
            dashboardData={dashboardData}
            userData={userData}
            effectiveLessonCount={effectiveLessonCount}
            isDailyLessonLimitReached={isDailyLessonLimitReached}
            isIPadLandscape={isIPadLandscape}
            shouldShowRecentMistakes={shouldShowRecentMistakes}
            currentStreak={currentStreak}
            longestStreak={longestStreak}
            freezeAvailable={freezeAvailable}
            freezeDaysUntilReload={freezeDaysUntilReload}
            streakRecentDays={streakRecentDays}
            isStreakLoading={isStreakLoading}
            streakError={streakError}
            recentLessonsWindow={homeRecentLessonsWindow}
            recentLessonCountForWindow={recentLessonCountForWindow}
            onLessonsPress={handleLessonsPress}
            onLessonPicker={handleLessonPicker}
            onReviewsPress={handleReviewsPress}
            srsBreakdownView="graph"
            srsBreakdownGroupStagesScope="graph"
          />,
        );
        widgetElements.push(
          <HomeDashboardWidget
            key={`${widgetId}-${index}-details`}
            widgetId={widgetId}
            dashboardData={dashboardData}
            userData={userData}
            effectiveLessonCount={effectiveLessonCount}
            isDailyLessonLimitReached={isDailyLessonLimitReached}
            isIPadLandscape={isIPadLandscape}
            shouldShowRecentMistakes={shouldShowRecentMistakes}
            currentStreak={currentStreak}
            longestStreak={longestStreak}
            freezeAvailable={freezeAvailable}
            freezeDaysUntilReload={freezeDaysUntilReload}
            streakRecentDays={streakRecentDays}
            isStreakLoading={isStreakLoading}
            streakError={streakError}
            recentLessonsWindow={homeRecentLessonsWindow}
            recentLessonCountForWindow={recentLessonCountForWindow}
            onLessonsPress={handleLessonsPress}
            onLessonPicker={handleLessonPicker}
            onReviewsPress={handleReviewsPress}
            srsBreakdownView="details"
            srsBreakdownGroupStagesScope="details"
          />,
        );
        continue;
      }

      widgetElements.push(
        <HomeDashboardWidget
          key={`${widgetId}-${index}`}
          widgetId={widgetId}
          dashboardData={dashboardData}
          userData={userData}
          effectiveLessonCount={effectiveLessonCount}
          isDailyLessonLimitReached={isDailyLessonLimitReached}
          isIPadLandscape={isIPadLandscape}
          shouldShowRecentMistakes={shouldShowRecentMistakes}
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          freezeAvailable={freezeAvailable}
          freezeDaysUntilReload={freezeDaysUntilReload}
          streakRecentDays={streakRecentDays}
          isStreakLoading={isStreakLoading}
          streakError={streakError}
          recentLessonsWindow={homeRecentLessonsWindow}
          recentLessonCountForWindow={recentLessonCountForWindow}
          onLessonsPress={handleLessonsPress}
          onLessonPicker={handleLessonPicker}
          onReviewsPress={handleReviewsPress}
          activeExtraStudySessionModeIds={activeExtraStudySessionModeIds}
          srsBreakdownView={
            widgetId === "srsBreakdown"
              ? homeSrsBreakdownDisplayMode === "graph"
                ? "graph"
                : homeSrsBreakdownDisplayMode === "details"
                  ? "details"
                  : "combined"
              : undefined
          }
        />,
      );
    }

    return widgetElements;
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <StatusBar style={theme.statusBarStyle} />
      <OpenSourceModal
        visible={showOpenSourceModal}
        onClose={handleOpenSourceModalClose}
      />

      <View
        style={[styles.header, { backgroundColor: theme.headerBackground }]}
      >
        <View style={styles.headerOverlay} />
        <View style={styles.profileContainer}>
          <TouchableOpacity
            style={styles.profileImage}
            onPress={() =>
              router.push({
                pathname: "/settings",
                params: { scrollTo: "profile" },
              })
            }
          >
            <View style={styles.profileImageOverlay} />
            <UserAvatar
              size={48}
              fallback={
                <Ionicons name="person" size={24} color={theme.headerText} />
              }
            />
          </TouchableOpacity>
          <View style={styles.profileInfo}>
            <Text style={[styles.username, { color: theme.headerText }]}>
              {userData?.username || "User"}
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons
                  name="stats-chart"
                  size={14}
                  color={theme.headerText}
                />
                <Text style={[styles.statText, { color: theme.headerText }]}>
                  Lvl{" "}
                  {dashboardData.dataLoadingState.userData
                    ? dashboardData.currentLevel
                    : userData?.level || 1}
                </Text>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="book" size={14} color={theme.headerText} />
                <Text style={[styles.statText, { color: theme.headerText }]}>
                  {dashboardData.dataLoadingState.subjects
                    ? dashboardData.learnedKanjiCount
                    : (learnedKanjiCount ?? "...")}{" "}
                  Kanji
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.headerButtons}>
          {canAccessBunpro && (
            <GlassButton
              onPress={() => router.push("/(app)/(bunpro-tabs)")}
            >
              <BunproSwitchIcon
                size={20}
                color={headerIconColor}
              />
            </GlassButton>
          )}
          {Platform.OS !== "android" && (
            <GlassButton
              iconName="gift-outline"
              onPress={() => router.push("/tip-developer")}
              iconColor={headerIconColor}
            />
          )}
          {!supportsNativeTabs() && (
            <GlassButton
              iconName="search-outline"
              onPress={() => router.push("/search")}
              iconColor={headerIconColor}
            />
          )}
          <GlassButton
            iconName="settings-outline"
            onPress={() => router.push("/settings")}
            iconColor={headerIconColor}
          />
        </View>
      </View>

      {isUpdateAvailable && (
        <TouchableOpacity
          style={[styles.updateBanner, { backgroundColor: theme.secondary }]}
          onPress={handleUpdateApp}
          disabled={isDownloadingUpdate}
        >
          <Ionicons
            name={isDownloadingUpdate ? "cloud-download" : "refresh"}
            size={20}
            color="white"
          />
          <Text style={styles.updateBannerText}>
            {isDownloadingUpdate ? "Applying update..." : "Tap to update app"}
          </Text>
          {!isDownloadingUpdate && (
            <Ionicons name="chevron-forward" size={20} color="white" />
          )}
        </TouchableOpacity>
      )}

      <LoadingProgressBar
        isLoading={isLoading || backgroundTasksRunning}
        progress={loadingProgress}
        color={theme.secondary}
        style={{ marginTop: 0 }}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.scrollViewContent,
          shouldUseNativeTabsPadding && styles.nativeTabsPadding,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            progressViewOffset={10}
            tintColor={theme.primary}
          />
        }
      >
        {errorStatus && (
          <View
            style={[
              styles.errorContainer,
              {
                backgroundColor: theme.isDark
                  ? "rgba(100, 30, 30, 0.5)"
                  : "rgba(255, 235, 235, 0.9)",
              },
            ]}
          >
            <Ionicons
              name="warning-outline"
              size={20}
              color={theme.error}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.errorText, { color: theme.error }]}>
              {errorStatus}
            </Text>
          </View>
        )}

        <View style={styles.cardsContainer}>
          {/* Level-up recap card — shown when the user has leveled up since last view */}
          {lastWrappedLevel !== null &&
            dashboardData.currentLevel > lastWrappedLevel && (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  const completedLevel = dashboardData.currentLevel - 1;
                  setLastWrappedLevel(dashboardData.currentLevel);
                  router.push(`/level-wrapped/${completedLevel}`);
                }}
                style={{ marginBottom: 10 }}
              >
                <LinearGradient
                  colors={[
                    withAlpha(subjectColors.vocabulary, 0.4),
                    withAlpha(subjectColors.vocabulary, 0.7),
                    subjectColors.vocabulary,
                  ]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    borderRadius: 16,
                    padding: 18,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                  }}
                >
                  <Ionicons name="sparkles" size={28} color="#fbbf24" />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: "#fff",
                        fontSize: 17,
                        fontWeight: "700",
                      }}
                    >
                      Level {dashboardData.currentLevel - 1} Recap
                    </Text>
                    <Text
                      style={{
                        color: "rgba(255,255,255,0.7)",
                        fontSize: 13,
                        marginTop: 2,
                      }}
                    >
                      See your level-up summary
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color="rgba(255,255,255,0.6)"
                  />
                </LinearGradient>
              </TouchableOpacity>
            )}
          {renderHomeWidgets()}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    position: "relative",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "rgba(0, 0, 0, 0.15)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(255, 255, 255, 0.12)",
  },
  profileContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  profileImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "rgba(0, 0, 0, 0.3)",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
    overflow: "hidden",
  },
  profileImageOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderRadius: 24,
  },
  profileInfo: {
    marginLeft: 12,
    flex: 1,
  },
  username: {
    fontSize: 18,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  statText: {
    fontSize: 14,
    marginLeft: 4,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  content: {
    flex: 1,
  },
  scrollViewContent: {
    paddingTop: 0,
  },
  nativeTabsPadding: {
    paddingBottom: 120,
  },
  cardsContainer: {
    padding: 16,
  },
  secondaryCardsRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "stretch",
  },
  secondaryCardColumn: {
    flex: 1,
    minWidth: 0,
  },
  secondaryCardEqualHeight: {
    flex: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  srsSplitRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "stretch",
  },
  srsSplitColumn: {
    flex: 1,
    minWidth: 0,
  },
  srsSplitWidget: {
    flex: 1,
  },
  updateBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  updateBannerText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});
