import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  Layout,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { GlassButton } from "../../src/components/GlassButton";
import HomeDashboardWidget from "../../src/components/HomeDashboardWidget";
import { useDashboardData } from "../../src/hooks/useDashboardData";
import { useUsageStreak } from "../../src/hooks/useUsageStreak";
import {
  getEffectiveLessonCount,
  getRemainingDailyLessonSlots,
} from "../../src/utils/dailyLessonLimit";
import {
  DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS,
  normalizeAnalyticsWidgetColor,
  type AnalyticsWidgetStyleColorKey,
} from "../../src/utils/analyticsWidgetStyles";
import {
  getAvailableExtraStudyModes,
  normalizeHomeExtraStudyModeOrder,
  type ExtraStudyModeId,
} from "../../src/utils/extraStudyModes";
import {
  HOME_WIDGET_DEFINITIONS,
  type HomeWidgetId,
  normalizeHomeWidgetOrder,
} from "../../src/utils/homeWidgets";
import {
  filterRecentLessonAssignments,
  type RecentLessonsWindow,
} from "../../src/utils/recentLessonsWindow";
import { type Assignment } from "../../src/utils/api";
import {
  type HomeSrsBreakdownDisplayMode,
  useAuthStore,
  useSettingsStore,
} from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";
import {
  DEFAULT_WIDGET_CARD_STYLE_COLORS,
  normalizeWidgetCardColor,
  type WidgetCardStyleColorKey,
} from "../../src/utils/widgetCardStyles";

// Only import expo/ui on iOS - it uses SwiftUI which doesn't exist on Android
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SwiftUI = Platform.OS === "ios" ? require("@expo/ui/swift-ui") : null;

type EmbeddedColorKey = WidgetCardStyleColorKey | AnalyticsWidgetStyleColorKey;
type EmbeddedColorField = { key: EmbeddedColorKey; label: string };
type SheetOption = {
  id: string;
  title: string;
  subtitle?: string;
  selected?: boolean;
  onPress: () => void;
};

const RECENT_LESSON_WINDOW_OPTIONS: {
  value: RecentLessonsWindow;
  label: string;
  subtitle: string;
}[] = [
  {
    value: "apprentice",
    label: "Default",
    subtitle: "Matches WaniKani (apprentice-stage lessons).",
  },
  {
    value: "24h",
    label: "Last 24 hours",
    subtitle: "Only lessons completed in the last 24h.",
  },
  {
    value: "7d",
    label: "Last 7 days",
    subtitle: "Only lessons completed in the last 7 days.",
  },
  {
    value: "30d",
    label: "Last 30 days",
    subtitle: "Only lessons completed in the last 30 days.",
  },
];

const SRS_BREAKDOWN_DISPLAY_OPTIONS: {
  value: HomeSrsBreakdownDisplayMode;
  label: string;
  subtitle: string;
}[] = [
  {
    value: "combined",
    label: "Single Card (Navigable)",
    subtitle: "Graph + breakdown in one card with Details/Back.",
  },
  {
    value: "split",
    label: "Two Cards",
    subtitle:
      "Graph and breakdown in separate cards (side by side on wide layouts).",
  },
  {
    value: "graph",
    label: "Graph Only",
    subtitle: "Show only the graph card with no details navigation.",
  },
  {
    value: "details",
    label: "Breakdown Only",
    subtitle: "Show only the breakdown list card with no graph navigation.",
  },
];

const LESSON_CARD_COLOR_FIELDS: EmbeddedColorField[] = [
  { key: "widgetLessonCardGradientStart", label: "Lesson Gradient Start" },
  { key: "widgetLessonCardGradientEnd", label: "Lesson Gradient End" },
];

const REVIEW_CARD_COLOR_FIELDS: EmbeddedColorField[] = [
  { key: "widgetReviewCardGradientStart", label: "Review Gradient Start" },
  { key: "widgetReviewCardGradientEnd", label: "Review Gradient End" },
];

const STREAK_CARD_COLOR_FIELDS: EmbeddedColorField[] = [
  { key: "widgetStreakCardGradientStart", label: "Streak Gradient Start" },
  { key: "widgetStreakCardGradientMiddle", label: "Streak Gradient Middle" },
  { key: "widgetStreakCardGradientEnd", label: "Streak Gradient End" },
];

const ANALYTICS_WIDGET_COLOR_FIELDS: Partial<
  Record<HomeWidgetId, EmbeddedColorField[]>
> = {
  reviewHeatmap: [
    { key: "widgetReviewHeatmapLevel1Color", label: "Heatmap Low" },
    { key: "widgetReviewHeatmapLevel2Color", label: "Heatmap Mid-Low" },
    { key: "widgetReviewHeatmapLevel3Color", label: "Heatmap Mid-High" },
    { key: "widgetReviewHeatmapLevel4Color", label: "Heatmap High" },
  ],
  levelTiming: [
    { key: "widgetLevelTimingFastColor", label: "Fast Level Color" },
    { key: "widgetLevelTimingAverageColor", label: "Average Level Color" },
    { key: "widgetLevelTimingSlowColor", label: "Slow Level Color" },
    { key: "widgetLevelTimingCurrentColor", label: "Current Level Color" },
    { key: "widgetLevelTimingResetColor", label: "Reset Marker Color" },
  ],
  reviewStats: [
    { key: "widgetReviewStatsExcellentColor", label: "Excellent Accuracy" },
    { key: "widgetReviewStatsGoodColor", label: "Good Accuracy" },
    { key: "widgetReviewStatsWarningColor", label: "Warning Accuracy" },
    { key: "widgetReviewStatsPoorColor", label: "Poor Accuracy" },
    { key: "widgetReviewStatsBadColor", label: "Bad Accuracy" },
    { key: "widgetReviewStatsMeaningAccentColor", label: "Meaning Accent" },
    { key: "widgetReviewStatsReadingAccentColor", label: "Reading Accent" },
    { key: "widgetReviewStatsTotalAccentColor", label: "Total Accent" },
  ],
};

const EMBEDDED_COLOR_KEYS: EmbeddedColorKey[] = [
  "widgetLessonCardGradientStart",
  "widgetLessonCardGradientEnd",
  "widgetReviewCardGradientStart",
  "widgetReviewCardGradientEnd",
  "widgetStreakCardGradientStart",
  "widgetStreakCardGradientMiddle",
  "widgetStreakCardGradientEnd",
  "widgetReviewHeatmapLevel1Color",
  "widgetReviewHeatmapLevel2Color",
  "widgetReviewHeatmapLevel3Color",
  "widgetReviewHeatmapLevel4Color",
  "widgetLevelTimingFastColor",
  "widgetLevelTimingAverageColor",
  "widgetLevelTimingSlowColor",
  "widgetLevelTimingCurrentColor",
  "widgetLevelTimingResetColor",
  "widgetReviewStatsExcellentColor",
  "widgetReviewStatsGoodColor",
  "widgetReviewStatsWarningColor",
  "widgetReviewStatsPoorColor",
  "widgetReviewStatsBadColor",
  "widgetReviewStatsMeaningAccentColor",
  "widgetReviewStatsReadingAccentColor",
  "widgetReviewStatsTotalAccentColor",
];

const COLOR_DEFAULTS = {
  ...DEFAULT_WIDGET_CARD_STYLE_COLORS,
  ...DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS,
} as Record<EmbeddedColorKey, string>;

const CARD_COLOR_KEYS = new Set<WidgetCardStyleColorKey>(
  Object.keys(DEFAULT_WIDGET_CARD_STYLE_COLORS) as WidgetCardStyleColorKey[],
);

function isCardColorKey(key: EmbeddedColorKey): key is WidgetCardStyleColorKey {
  return CARD_COLOR_KEYS.has(key as WidgetCardStyleColorKey);
}

function isValidHexColor(value: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function toEditableHex(value: string): string {
  return normalizeWidgetCardColor(value, "#000000").replace(/^#/, "").toUpperCase();
}

function buildDrafts(
  colors: Record<EmbeddedColorKey, string>,
): Record<EmbeddedColorKey, string> {
  return EMBEDDED_COLOR_KEYS.reduce(
    (acc, key) => {
      acc[key] = toEditableHex(colors[key]);
      return acc;
    },
    {} as Record<EmbeddedColorKey, string>,
  );
}

export default function HomeCustomizationSettings() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isIPadLandscape = width > 768 && width > height;
  const listRef = useRef<FlatList<HomeWidgetId>>(null);
  const { dashboardData } = useDashboardData();
  const { userData } = useAuthStore();
  const {
    dailyLessonLimit,
    homeWidgetOrder,
    setHomeWidgetOrder,
    removeHomeWidget,
    resetHomeWidgetOrder,
    homeExtraStudyModeOrder,
    homeExtraStudyHiddenModeIds,
    setHomeExtraStudyModeOrder,
    addHomeExtraStudyMode,
    removeHomeExtraStudyMode,
    resetHomeExtraStudyModeOrder,
    homeRecentLessonsWindow,
    setHomeRecentLessonsWindow,
    homeSrsBreakdownDisplayMode,
    setHomeSrsBreakdownDisplayMode,
    widgetLessonCardFollowTheme,
    widgetReviewCardFollowTheme,
    widgetStreakCardFollowTheme,
    setWidgetLessonCardFollowTheme,
    setWidgetReviewCardFollowTheme,
    setWidgetStreakCardFollowTheme,
    widgetLessonCardGradientStart,
    widgetLessonCardGradientEnd,
    widgetReviewCardGradientStart,
    widgetReviewCardGradientEnd,
    widgetStreakCardGradientStart,
    widgetStreakCardGradientMiddle,
    widgetStreakCardGradientEnd,
    widgetReviewHeatmapLevel1Color,
    widgetReviewHeatmapLevel2Color,
    widgetReviewHeatmapLevel3Color,
    widgetReviewHeatmapLevel4Color,
    widgetLevelTimingFastColor,
    widgetLevelTimingAverageColor,
    widgetLevelTimingSlowColor,
    widgetLevelTimingCurrentColor,
    widgetLevelTimingResetColor,
    widgetReviewStatsExcellentColor,
    widgetReviewStatsGoodColor,
    widgetReviewStatsWarningColor,
    widgetReviewStatsPoorColor,
    widgetReviewStatsBadColor,
    widgetReviewStatsMeaningAccentColor,
    widgetReviewStatsReadingAccentColor,
    widgetReviewStatsTotalAccentColor,
    setWidgetCardStyleColor,
    setAnalyticsWidgetStyleColor,
  } = useSettingsStore(
    useShallow((state) => ({
      dailyLessonLimit: state.dailyLessonLimit,
      homeWidgetOrder: state.homeWidgetOrder,
      setHomeWidgetOrder: state.setHomeWidgetOrder,
      removeHomeWidget: state.removeHomeWidget,
      resetHomeWidgetOrder: state.resetHomeWidgetOrder,
      homeExtraStudyModeOrder: state.homeExtraStudyModeOrder,
      homeExtraStudyHiddenModeIds: state.homeExtraStudyHiddenModeIds,
      setHomeExtraStudyModeOrder: state.setHomeExtraStudyModeOrder,
      addHomeExtraStudyMode: state.addHomeExtraStudyMode,
      removeHomeExtraStudyMode: state.removeHomeExtraStudyMode,
      resetHomeExtraStudyModeOrder: state.resetHomeExtraStudyModeOrder,
      homeRecentLessonsWindow: state.homeRecentLessonsWindow,
      setHomeRecentLessonsWindow: state.setHomeRecentLessonsWindow,
      homeSrsBreakdownDisplayMode: state.homeSrsBreakdownDisplayMode,
      setHomeSrsBreakdownDisplayMode: state.setHomeSrsBreakdownDisplayMode,
      widgetLessonCardFollowTheme: state.widgetLessonCardFollowTheme,
      widgetReviewCardFollowTheme: state.widgetReviewCardFollowTheme,
      widgetStreakCardFollowTheme: state.widgetStreakCardFollowTheme,
      setWidgetLessonCardFollowTheme: state.setWidgetLessonCardFollowTheme,
      setWidgetReviewCardFollowTheme: state.setWidgetReviewCardFollowTheme,
      setWidgetStreakCardFollowTheme: state.setWidgetStreakCardFollowTheme,
      widgetLessonCardGradientStart: state.widgetLessonCardGradientStart,
      widgetLessonCardGradientEnd: state.widgetLessonCardGradientEnd,
      widgetReviewCardGradientStart: state.widgetReviewCardGradientStart,
      widgetReviewCardGradientEnd: state.widgetReviewCardGradientEnd,
      widgetStreakCardGradientStart: state.widgetStreakCardGradientStart,
      widgetStreakCardGradientMiddle: state.widgetStreakCardGradientMiddle,
      widgetStreakCardGradientEnd: state.widgetStreakCardGradientEnd,
      widgetReviewHeatmapLevel1Color: state.widgetReviewHeatmapLevel1Color,
      widgetReviewHeatmapLevel2Color: state.widgetReviewHeatmapLevel2Color,
      widgetReviewHeatmapLevel3Color: state.widgetReviewHeatmapLevel3Color,
      widgetReviewHeatmapLevel4Color: state.widgetReviewHeatmapLevel4Color,
      widgetLevelTimingFastColor: state.widgetLevelTimingFastColor,
      widgetLevelTimingAverageColor: state.widgetLevelTimingAverageColor,
      widgetLevelTimingSlowColor: state.widgetLevelTimingSlowColor,
      widgetLevelTimingCurrentColor: state.widgetLevelTimingCurrentColor,
      widgetLevelTimingResetColor: state.widgetLevelTimingResetColor,
      widgetReviewStatsExcellentColor: state.widgetReviewStatsExcellentColor,
      widgetReviewStatsGoodColor: state.widgetReviewStatsGoodColor,
      widgetReviewStatsWarningColor: state.widgetReviewStatsWarningColor,
      widgetReviewStatsPoorColor: state.widgetReviewStatsPoorColor,
      widgetReviewStatsBadColor: state.widgetReviewStatsBadColor,
      widgetReviewStatsMeaningAccentColor:
        state.widgetReviewStatsMeaningAccentColor,
      widgetReviewStatsReadingAccentColor:
        state.widgetReviewStatsReadingAccentColor,
      widgetReviewStatsTotalAccentColor: state.widgetReviewStatsTotalAccentColor,
      setWidgetCardStyleColor: state.setWidgetCardStyleColor,
      setAnalyticsWidgetStyleColor: state.setAnalyticsWidgetStyleColor,
    })),
  );
  const {
    currentStreak,
    longestStreak,
    freezeAvailable,
    freezeDaysUntilReload,
    recentDays: streakRecentDays,
    isLoading: isStreakLoading,
    error: streakError,
  } = useUsageStreak(userData?.id);
  const [isExtraStudyExpanded, setIsExtraStudyExpanded] = useState(false);
  const [expandedColorWidgetIds, setExpandedColorWidgetIds] = useState<
    Partial<Record<HomeWidgetId, boolean>>
  >({});
  const [pendingScrollWidget, setPendingScrollWidget] =
    useState<HomeWidgetId | null>(null);
  const [selectionSheet, setSelectionSheet] = useState<{
    title: string;
    subtitle?: string;
    options: SheetOption[];
  } | null>(null);

  const activeWidgetOrder = useMemo(
    () => normalizeHomeWidgetOrder(homeWidgetOrder),
    [homeWidgetOrder],
  );
  const widgetDefinitionMap = useMemo(
    () => new Map(HOME_WIDGET_DEFINITIONS.map((widget) => [widget.id, widget])),
    [],
  );
  const availableWidgets = useMemo(
    () =>
      HOME_WIDGET_DEFINITIONS.filter(
        (widget) => !activeWidgetOrder.includes(widget.id),
      ),
    [activeWidgetOrder],
  );
  const availableExtraStudyModes = useMemo(
    () => getAvailableExtraStudyModes(userData?.username),
    [userData?.username],
  );
  const availableExtraStudyModeMap = useMemo(
    () => new Map(availableExtraStudyModes.map((mode) => [mode.id, mode])),
    [availableExtraStudyModes],
  );
  const activeExtraStudyModeOrder = useMemo(
    () =>
      normalizeHomeExtraStudyModeOrder(
        homeExtraStudyModeOrder,
        availableExtraStudyModes,
        homeExtraStudyHiddenModeIds,
      ),
    [
      availableExtraStudyModes,
      homeExtraStudyHiddenModeIds,
      homeExtraStudyModeOrder,
    ],
  );
  const hiddenExtraStudyModes = useMemo(
    () =>
      availableExtraStudyModes.filter(
        (mode) => !activeExtraStudyModeOrder.includes(mode.id),
      ),
    [activeExtraStudyModeOrder, availableExtraStudyModes],
  );
  const canAddWidgets = availableWidgets.length > 0;
  const canAddExtraStudyModes = hiddenExtraStudyModes.length > 0;
  const selectedSrsBreakdownDisplayOption = useMemo(
    () =>
      SRS_BREAKDOWN_DISPLAY_OPTIONS.find(
        (option) => option.value === homeSrsBreakdownDisplayMode,
      ) ?? SRS_BREAKDOWN_DISPLAY_OPTIONS[0],
    [homeSrsBreakdownDisplayMode],
  );

  const remainingDailyLessonSlots = useMemo(
    () =>
      getRemainingDailyLessonSlots(dailyLessonLimit, dashboardData.assignments),
    [dailyLessonLimit, dashboardData.assignments],
  );
  const effectiveLessonCount = useMemo(
    () =>
      getEffectiveLessonCount(
        dashboardData.lessonCount,
        dailyLessonLimit,
        dashboardData.assignments,
      ),
    [dailyLessonLimit, dashboardData.assignments, dashboardData.lessonCount],
  );
  const isDailyLessonLimitReached =
    dailyLessonLimit > 0 &&
    dashboardData.lessonCount > 0 &&
    Number.isFinite(remainingDailyLessonSlots) &&
    remainingDailyLessonSlots <= 0;
  const isOnVacation = Boolean(userData?.current_vacation_started_at);
  const shouldShowRecentMistakes =
    !isOnVacation && dashboardData.recentMistakes.length > 0;
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

  const activeColors = useMemo(
    () => ({
      widgetLessonCardGradientStart: normalizeWidgetCardColor(
        widgetLessonCardGradientStart,
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetLessonCardGradientStart,
      ),
      widgetLessonCardGradientEnd: normalizeWidgetCardColor(
        widgetLessonCardGradientEnd,
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetLessonCardGradientEnd,
      ),
      widgetReviewCardGradientStart: normalizeWidgetCardColor(
        widgetReviewCardGradientStart,
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetReviewCardGradientStart,
      ),
      widgetReviewCardGradientEnd: normalizeWidgetCardColor(
        widgetReviewCardGradientEnd,
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetReviewCardGradientEnd,
      ),
      widgetStreakCardGradientStart: normalizeWidgetCardColor(
        widgetStreakCardGradientStart,
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetStreakCardGradientStart,
      ),
      widgetStreakCardGradientMiddle: normalizeWidgetCardColor(
        widgetStreakCardGradientMiddle,
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetStreakCardGradientMiddle,
      ),
      widgetStreakCardGradientEnd: normalizeWidgetCardColor(
        widgetStreakCardGradientEnd,
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetStreakCardGradientEnd,
      ),
      widgetReviewHeatmapLevel1Color: normalizeAnalyticsWidgetColor(
        widgetReviewHeatmapLevel1Color,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewHeatmapLevel1Color,
      ),
      widgetReviewHeatmapLevel2Color: normalizeAnalyticsWidgetColor(
        widgetReviewHeatmapLevel2Color,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewHeatmapLevel2Color,
      ),
      widgetReviewHeatmapLevel3Color: normalizeAnalyticsWidgetColor(
        widgetReviewHeatmapLevel3Color,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewHeatmapLevel3Color,
      ),
      widgetReviewHeatmapLevel4Color: normalizeAnalyticsWidgetColor(
        widgetReviewHeatmapLevel4Color,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewHeatmapLevel4Color,
      ),
      widgetLevelTimingFastColor: normalizeAnalyticsWidgetColor(
        widgetLevelTimingFastColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetLevelTimingFastColor,
      ),
      widgetLevelTimingAverageColor: normalizeAnalyticsWidgetColor(
        widgetLevelTimingAverageColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetLevelTimingAverageColor,
      ),
      widgetLevelTimingSlowColor: normalizeAnalyticsWidgetColor(
        widgetLevelTimingSlowColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetLevelTimingSlowColor,
      ),
      widgetLevelTimingCurrentColor: normalizeAnalyticsWidgetColor(
        widgetLevelTimingCurrentColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetLevelTimingCurrentColor,
      ),
      widgetLevelTimingResetColor: normalizeAnalyticsWidgetColor(
        widgetLevelTimingResetColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetLevelTimingResetColor,
      ),
      widgetReviewStatsExcellentColor: normalizeAnalyticsWidgetColor(
        widgetReviewStatsExcellentColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsExcellentColor,
      ),
      widgetReviewStatsGoodColor: normalizeAnalyticsWidgetColor(
        widgetReviewStatsGoodColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsGoodColor,
      ),
      widgetReviewStatsWarningColor: normalizeAnalyticsWidgetColor(
        widgetReviewStatsWarningColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsWarningColor,
      ),
      widgetReviewStatsPoorColor: normalizeAnalyticsWidgetColor(
        widgetReviewStatsPoorColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsPoorColor,
      ),
      widgetReviewStatsBadColor: normalizeAnalyticsWidgetColor(
        widgetReviewStatsBadColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsBadColor,
      ),
      widgetReviewStatsMeaningAccentColor: normalizeAnalyticsWidgetColor(
        widgetReviewStatsMeaningAccentColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsMeaningAccentColor,
      ),
      widgetReviewStatsReadingAccentColor: normalizeAnalyticsWidgetColor(
        widgetReviewStatsReadingAccentColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsReadingAccentColor,
      ),
      widgetReviewStatsTotalAccentColor: normalizeAnalyticsWidgetColor(
        widgetReviewStatsTotalAccentColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsTotalAccentColor,
      ),
    }),
    [
      widgetLessonCardGradientEnd,
      widgetLessonCardGradientStart,
      widgetLevelTimingAverageColor,
      widgetLevelTimingCurrentColor,
      widgetLevelTimingFastColor,
      widgetLevelTimingResetColor,
      widgetLevelTimingSlowColor,
      widgetReviewCardGradientEnd,
      widgetReviewCardGradientStart,
      widgetReviewHeatmapLevel1Color,
      widgetReviewHeatmapLevel2Color,
      widgetReviewHeatmapLevel3Color,
      widgetReviewHeatmapLevel4Color,
      widgetReviewStatsBadColor,
      widgetReviewStatsExcellentColor,
      widgetReviewStatsGoodColor,
      widgetReviewStatsMeaningAccentColor,
      widgetReviewStatsPoorColor,
      widgetReviewStatsReadingAccentColor,
      widgetReviewStatsTotalAccentColor,
      widgetReviewStatsWarningColor,
      widgetStreakCardGradientEnd,
      widgetStreakCardGradientMiddle,
      widgetStreakCardGradientStart,
    ],
  );
  const [drafts, setDrafts] = useState<Record<EmbeddedColorKey, string>>(
    buildDrafts(activeColors),
  );

  useEffect(() => {
    setDrafts(buildDrafts(activeColors));
  }, [activeColors]);

  useEffect(() => {
    if (!pendingScrollWidget) {
      return;
    }

    const nextIndex = activeWidgetOrder.indexOf(pendingScrollWidget);
    if (nextIndex < 0) {
      setPendingScrollWidget(null);
      return;
    }

    const timeout = setTimeout(() => {
      listRef.current?.scrollToIndex?.({
        index: nextIndex,
        animated: true,
        viewPosition: 0.5,
      });
      setPendingScrollWidget(null);
    }, 180);

    return () => clearTimeout(timeout);
  }, [activeWidgetOrder, pendingScrollWidget]);

  const openSheet = (title: string, options: SheetOption[], subtitle?: string) =>
    setSelectionSheet({ title, subtitle, options });
  const closeSheet = () => setSelectionSheet(null);

  const applyColor = (key: EmbeddedColorKey, value: string) => {
    const fallback = COLOR_DEFAULTS[key];
    const normalized = isCardColorKey(key)
      ? normalizeWidgetCardColor(value, fallback)
      : normalizeAnalyticsWidgetColor(value, fallback);

    if (isCardColorKey(key)) {
      setWidgetCardStyleColor(key, normalized);
    } else {
      setAnalyticsWidgetStyleColor(key, normalized as AnalyticsWidgetStyleColorKey);
    }

    setDrafts((prev) => ({
      ...prev,
      [key]: toEditableHex(normalized),
    }));
  };

  const handleDraftChange = (key: EmbeddedColorKey, nextDraft: string) => {
    const sanitized = nextDraft.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);

    setDrafts((prev) => ({
      ...prev,
      [key]: sanitized.toUpperCase(),
    }));

    if (sanitized.length === 6) {
      applyColor(key, sanitized);
    }
  };

  const handleDraftBlur = (key: EmbeddedColorKey) => {
    const withHash = `#${drafts[key]}`;

    if (isValidHexColor(withHash)) {
      applyColor(key, withHash);
      return;
    }

    setDrafts((prev) => ({
      ...prev,
      [key]: toEditableHex(activeColors[key]),
    }));
  };

  const handleAddWidget = (widgetId: HomeWidgetId) => {
    if (activeWidgetOrder.includes(widgetId)) {
      return;
    }

    setHomeWidgetOrder([...activeWidgetOrder, widgetId]);
    setPendingScrollWidget(widgetId);
  };

  const openAddWidgetMenu = () => {
    if (availableWidgets.length === 0) {
      return;
    }

    openSheet(
      "Add Widget",
      availableWidgets.map((widget) => ({
        id: widget.id,
        title: widget.title,
        subtitle: widget.description,
        onPress: () => handleAddWidget(widget.id),
      })),
      "Choose a widget to add to your Home screen.",
    );
  };

  const openAddExtraStudyMenu = () => {
    if (hiddenExtraStudyModes.length === 0) {
      return;
    }

    openSheet(
      "Add Extra Study Mode",
      hiddenExtraStudyModes.map((mode) => ({
        id: mode.id,
        title: mode.title,
        subtitle: mode.subtitle,
        onPress: () => addHomeExtraStudyMode(mode.id),
      })),
    );
  };

  const openRecentLessonsSettings = () => {
    openSheet(
      "Recent Lessons Range",
      RECENT_LESSON_WINDOW_OPTIONS.map((option) => ({
        id: option.value,
        title: option.label,
        subtitle: option.subtitle,
        selected: homeRecentLessonsWindow === option.value,
        onPress: () => setHomeRecentLessonsWindow(option.value),
      })),
      "Only this Extra Study mode uses this setting.",
    );
  };

  const openSrsBreakdownDisplayModeSettings = () => {
    openSheet(
      "SRS Breakdown Layout",
      SRS_BREAKDOWN_DISPLAY_OPTIONS.map((option) => ({
        id: option.value,
        title: option.label,
        subtitle: option.subtitle,
        selected: homeSrsBreakdownDisplayMode === option.value,
        onPress: () => setHomeSrsBreakdownDisplayMode(option.value),
      })),
      "Applies to Home and Progress tabs.",
    );
  };

  const moveExtraStudyMode = (modeId: ExtraStudyModeId, direction: -1 | 1) => {
    const currentIndex = activeExtraStudyModeOrder.indexOf(modeId);
    if (currentIndex < 0) {
      return;
    }

    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= activeExtraStudyModeOrder.length) {
      return;
    }

    const reordered = [...activeExtraStudyModeOrder];
    [reordered[currentIndex], reordered[targetIndex]] = [
      reordered[targetIndex],
      reordered[currentIndex],
    ];
    setHomeExtraStudyModeOrder(reordered);
  };

  const moveWidget = (widgetId: HomeWidgetId, direction: -1 | 1) => {
    const currentIndex = activeWidgetOrder.indexOf(widgetId);
    if (currentIndex < 0) {
      return;
    }

    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= activeWidgetOrder.length) {
      return;
    }

    const reordered = [...activeWidgetOrder];
    [reordered[currentIndex], reordered[nextIndex]] = [
      reordered[nextIndex],
      reordered[currentIndex],
    ];
    setHomeWidgetOrder(reordered);
    setPendingScrollWidget(widgetId);
  };

  const handleResetPress = () => {
    Alert.alert(
      "Reset Home Customization?",
      "This will restore your default Home widgets, Extra Study carousel, and Recent Lessons range.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: () => {
            resetHomeWidgetOrder();
            resetHomeExtraStudyModeOrder();
            setHomeRecentLessonsWindow("apprentice");
            setHomeSrsBreakdownDisplayMode("combined");
            setIsExtraStudyExpanded(false);
          },
        },
      ],
    );
  };

  const resetLessonsReviewsColors = () => {
    setWidgetLessonCardFollowTheme(true);
    setWidgetReviewCardFollowTheme(true);
    setWidgetCardStyleColor(
      "widgetLessonCardGradientStart",
      DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetLessonCardGradientStart,
    );
    setWidgetCardStyleColor(
      "widgetLessonCardGradientEnd",
      DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetLessonCardGradientEnd,
    );
    setWidgetCardStyleColor(
      "widgetReviewCardGradientStart",
      DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetReviewCardGradientStart,
    );
    setWidgetCardStyleColor(
      "widgetReviewCardGradientEnd",
      DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetReviewCardGradientEnd,
    );
  };

  const resetStreakColors = () => {
    setWidgetStreakCardFollowTheme(true);
    setWidgetCardStyleColor(
      "widgetStreakCardGradientStart",
      DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetStreakCardGradientStart,
    );
    setWidgetCardStyleColor(
      "widgetStreakCardGradientMiddle",
      DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetStreakCardGradientMiddle,
    );
    setWidgetCardStyleColor(
      "widgetStreakCardGradientEnd",
      DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetStreakCardGradientEnd,
    );
  };

  const resetAnalyticsColors = (fields: EmbeddedColorField[]) => {
    fields.forEach((field) => {
      if (isCardColorKey(field.key)) {
        setWidgetCardStyleColor(field.key, COLOR_DEFAULTS[field.key]);
        return;
      }

      setAnalyticsWidgetStyleColor(field.key, COLOR_DEFAULTS[field.key]);
    });
  };

  const isColorSectionExpanded = (widgetId: HomeWidgetId) =>
    Boolean(expandedColorWidgetIds[widgetId]);

  const toggleColorSection = (widgetId: HomeWidgetId) => {
    setExpandedColorWidgetIds((prev) => ({
      ...prev,
      [widgetId]: !prev[widgetId],
    }));
  };

  const renderColorControls = (
    fields: EmbeddedColorField[],
    disabled = false,
  ) => (
    <View
      style={[
        styles.colorControlsWrap,
        { opacity: disabled ? 0.55 : 1 },
      ]}
      pointerEvents={disabled ? "none" : "auto"}
    >
      {fields.map((field) => {
        const colorValue = activeColors[field.key];

        return (
          <View
            key={field.key}
            style={[styles.colorRow, { borderColor: theme.border }]}
          >
            <View style={styles.colorLabelWrap}>
              <Text style={[styles.colorLabel, { color: theme.textColor }]}>
                {field.label}
              </Text>
            </View>

            <View style={styles.colorControlWrap}>
              <View
                style={[
                  styles.colorPreview,
                  { backgroundColor: colorValue, borderColor: theme.border },
                ]}
              />

              {Platform.OS === "ios" && SwiftUI ? (
                <SwiftUI.Host
                  matchContents
                  style={styles.colorPickerButtonHost}
                  colorScheme={theme.isDark ? "dark" : "light"}
                >
                  <SwiftUI.ColorPicker
                    label=""
                    selection={colorValue}
                    supportsOpacity={false}
                    onSelectionChange={(value: string) => applyColor(field.key, value)}
                  />
                </SwiftUI.Host>
              ) : (
                <View style={styles.inputRow}>
                  <Text style={[styles.hashPrefix, { color: theme.textSecondary }]}>
                    #
                  </Text>
                  <TextInput
                    value={drafts[field.key]}
                    onChangeText={(text) => handleDraftChange(field.key, text)}
                    onBlur={() => handleDraftBlur(field.key)}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={6}
                    style={[
                      styles.hexInput,
                      {
                        color: theme.textColor,
                        borderColor: theme.border,
                        backgroundColor: theme.isDark ? "#1f1f1f" : "#f6f6f6",
                      },
                    ]}
                    selectionColor={colorValue}
                  />
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />

      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.cardBackground,
            borderBottomColor: theme.border,
            paddingTop: Math.max(insets.top, 56),
          },
        ]}
      >
        <GlassButton
          iconName="arrow-back"
          iconSize={22}
          iconColor={theme.textColor}
          variant="light"
          onPress={() => router.back()}
          style={styles.headerGlassButton}
        />

        <View style={styles.headerTextContainer}>
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>
            Home Customization
          </Text>
        </View>

        <View style={styles.headerActions}>
          <GlassButton
            iconName="add"
            iconSize={22}
            iconColor={canAddWidgets ? theme.textColor : theme.textSecondary}
            variant="light"
            onPress={canAddWidgets ? openAddWidgetMenu : undefined}
            style={
              canAddWidgets
                ? styles.headerGlassButton
                : styles.headerGlassButtonDisabled
            }
          />

          <GlassButton
            iconName="refresh"
            iconSize={20}
            iconColor={theme.textColor}
            variant="light"
            onPress={handleResetPress}
            style={styles.headerGlassButton}
          />
        </View>
      </View>

      <FlatList
        ref={listRef}
        data={activeWidgetOrder}
        keyExtractor={(item) => item}
        onScrollToIndexFailed={({ index }) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex?.({
              index,
              animated: true,
              viewPosition: 0.5,
            });
          }, 250);
        }}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 320 },
        ]}
        renderItem={({ item, index }) => {
          const definition = widgetDefinitionMap.get(item);
          if (!definition) {
            return null;
          }

          const analyticsFields = ANALYTICS_WIDGET_COLOR_FIELDS[item];
          const isPinnedWidget = item === "lessonsReviews";
          const isWidgetRemovalDisabled =
            isPinnedWidget || activeWidgetOrder.length <= 1;

          return (
            <Animated.View
              style={[
                styles.widgetEditorCard,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.border,
                },
              ]}
              layout={Layout.duration(220).easing(Easing.out(Easing.cubic))}
            >
              <View style={styles.widgetEditorHeader}>
                <View style={styles.widgetEditorTitleContainer}>
                  <Text style={[styles.widgetEditorTitle, { color: theme.textColor }]}>
                    {definition.title}
                  </Text>
                  <Text
                    style={[
                      styles.widgetEditorSubtitle,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {definition.description}
                  </Text>
                </View>

                <View style={styles.widgetEditorActions}>
                  <TouchableOpacity
                    style={[
                      styles.actionIconButton,
                      {
                        backgroundColor: theme.isDark
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(0,0,0,0.05)",
                        opacity: index === 0 ? 0.4 : 1,
                      },
                    ]}
                    disabled={index === 0}
                    onPress={() => moveWidget(item, -1)}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${definition.title} up`}
                  >
                    <Ionicons name="chevron-up" size={18} color={theme.textColor} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionIconButton,
                      {
                        backgroundColor: theme.isDark
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(0,0,0,0.05)",
                        opacity: index === activeWidgetOrder.length - 1 ? 0.4 : 1,
                      },
                    ]}
                    disabled={index === activeWidgetOrder.length - 1}
                    onPress={() => moveWidget(item, 1)}
                    accessibilityRole="button"
                    accessibilityLabel={`Move ${definition.title} down`}
                  >
                    <Ionicons name="chevron-down" size={18} color={theme.textColor} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.actionIconButton,
                      {
                        backgroundColor: theme.isDark
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(0,0,0,0.05)",
                        opacity: isWidgetRemovalDisabled ? 0.5 : 1,
                      },
                    ]}
                    onPress={() => removeHomeWidget(item)}
                    disabled={isWidgetRemovalDisabled}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isPinnedWidget
                        ? `${definition.title} cannot be removed`
                        : `Remove ${definition.title}`
                    }
                  >
                    <Ionicons
                      name={isPinnedWidget ? "lock-closed" : "close"}
                      size={18}
                      color={
                        isWidgetRemovalDisabled
                          ? theme.textSecondary
                          : theme.error
                      }
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.widgetPreviewContainer} pointerEvents="none">
                {item === "srsBreakdown" && homeSrsBreakdownDisplayMode === "split" ? (
                  isIPadLandscape ? (
                    <View style={styles.srsSplitPreviewRow}>
                      <View style={styles.srsSplitPreviewColumn}>
                        <HomeDashboardWidget
                          widgetId={item}
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
                          onLessonsPress={() => {}}
                          onLessonPicker={() => {}}
                          onReviewsPress={() => {}}
                          srsBreakdownView="graph"
                          srsBreakdownGroupStagesScope="graph"
                          style={styles.srsSplitPreviewWidget}
                          previewMode
                        />
                      </View>
                      <View style={styles.srsSplitPreviewColumn}>
                        <HomeDashboardWidget
                          widgetId={item}
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
                          onLessonsPress={() => {}}
                          onLessonPicker={() => {}}
                          onReviewsPress={() => {}}
                          srsBreakdownView="details"
                          srsBreakdownGroupStagesScope="details"
                          style={styles.srsSplitPreviewWidget}
                          previewMode
                        />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.srsSplitPreviewStack}>
                      <HomeDashboardWidget
                        widgetId={item}
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
                        onLessonsPress={() => {}}
                        onLessonPicker={() => {}}
                        onReviewsPress={() => {}}
                        srsBreakdownView="graph"
                        srsBreakdownGroupStagesScope="graph"
                        previewMode
                      />
                      <HomeDashboardWidget
                        widgetId={item}
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
                        onLessonsPress={() => {}}
                        onLessonPicker={() => {}}
                        onReviewsPress={() => {}}
                        srsBreakdownView="details"
                        srsBreakdownGroupStagesScope="details"
                        previewMode
                      />
                    </View>
                  )
                ) : (
                  <HomeDashboardWidget
                    widgetId={item}
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
                    onLessonsPress={() => {}}
                    onLessonPicker={() => {}}
                    onReviewsPress={() => {}}
                    srsBreakdownView={
                      item === "srsBreakdown"
                        ? homeSrsBreakdownDisplayMode === "graph"
                          ? "graph"
                          : homeSrsBreakdownDisplayMode === "details"
                            ? "details"
                            : "combined"
                        : undefined
                    }
                    previewMode
                  />
                )}
              </View>

              {item === "extraStudy" && (
                <View style={styles.widgetSettingBlock}>
                  <TouchableOpacity
                    style={[
                      styles.expandSectionButton,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.isDark
                          ? "rgba(255,255,255,0.03)"
                          : "rgba(0,0,0,0.02)",
                      },
                    ]}
                    onPress={() => setIsExtraStudyExpanded((prev) => !prev)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isExtraStudyExpanded
                        ? "Hide extra study options"
                        : "Show extra study options"
                    }
                  >
                    <Text style={[styles.widgetSettingLabel, { color: theme.textSecondary }]}>
                      Extra Study Carousel
                    </Text>
                    <View style={styles.expandSectionButtonRight}>
                      <Text style={[styles.expandSectionButtonText, { color: theme.textColor }]}>
                        {isExtraStudyExpanded ? "Hide" : "Customize"}
                      </Text>
                      <Ionicons
                        name={isExtraStudyExpanded ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={theme.textColor}
                      />
                    </View>
                  </TouchableOpacity>

                  {isExtraStudyExpanded ? (
                    <Animated.View
                      entering={FadeInDown.duration(220)}
                      exiting={FadeOutUp.duration(180)}
                      layout={Layout.duration(220).easing(Easing.out(Easing.cubic))}
                      style={styles.extraStudyExpandedContent}
                    >
                      <View style={styles.inlineSectionHeader}>
                        <Text
                          style={[
                            styles.widgetSettingLabel,
                            { color: theme.textSecondary },
                          ]}
                        >
                          Manage Carousel Modes
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.smallActionButton,
                            !canAddExtraStudyModes && styles.smallActionButtonDisabled,
                            {
                              borderColor: theme.border,
                              backgroundColor: theme.isDark
                                ? "rgba(255,255,255,0.05)"
                                : "rgba(0,0,0,0.03)",
                            },
                          ]}
                          onPress={openAddExtraStudyMenu}
                          disabled={!canAddExtraStudyModes}
                        >
                          <Ionicons
                            name="add"
                            size={14}
                            color={
                              !canAddExtraStudyModes
                                ? theme.textSecondary
                                : theme.textColor
                            }
                          />
                          <Text
                            style={[
                              styles.smallActionButtonText,
                              {
                                color:
                                  !canAddExtraStudyModes
                                    ? theme.textSecondary
                                    : theme.textColor,
                              },
                            ]}
                          >
                            Add Mode
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {!canAddExtraStudyModes ? (
                        <Text style={[styles.disabledHintText, { color: theme.textSecondary }]}>
                          All available Extra Study modes are already added.
                        </Text>
                      ) : null}

                      <View style={styles.modeRowsWrap}>
                        {activeExtraStudyModeOrder.map((modeId, modeIndex) => {
                          const mode = availableExtraStudyModeMap.get(modeId);
                          if (!mode) {
                            return null;
                          }

                          return (
                            <View
                              key={mode.id}
                              style={[
                                styles.modeRow,
                                {
                                  borderColor: theme.border,
                                  backgroundColor: theme.isDark
                                    ? "rgba(255,255,255,0.03)"
                                    : "rgba(0,0,0,0.02)",
                                },
                              ]}
                            >
                              <View style={styles.modeInfo}>
                                <Text style={[styles.modeTitle, { color: theme.textColor }]}>
                                  {mode.title}
                                </Text>
                                <Text
                                  style={[
                                    styles.modeSubtitle,
                                    { color: theme.textSecondary },
                                  ]}
                                >
                                  {mode.subtitle}
                                </Text>
                              </View>

                              <View style={styles.modeActions}>
                                {mode.id === "recent-lessons" && (
                                  <TouchableOpacity
                                    style={[
                                      styles.modeActionIconButton,
                                      {
                                        borderColor: theme.border,
                                        backgroundColor: theme.isDark
                                          ? "rgba(255,255,255,0.06)"
                                          : "rgba(0,0,0,0.04)",
                                      },
                                    ]}
                                    onPress={openRecentLessonsSettings}
                                  >
                                    <Ionicons
                                      name="settings-outline"
                                      size={16}
                                      color={theme.textColor}
                                    />
                                  </TouchableOpacity>
                                )}

                                <TouchableOpacity
                                  style={[
                                    styles.modeActionIconButton,
                                    {
                                      borderColor: theme.border,
                                      backgroundColor: theme.isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.04)",
                                      opacity: modeIndex === 0 ? 0.4 : 1,
                                    },
                                  ]}
                                  disabled={modeIndex === 0}
                                  onPress={() => moveExtraStudyMode(mode.id, -1)}
                                >
                                  <Ionicons
                                    name="chevron-up"
                                    size={16}
                                    color={theme.textColor}
                                  />
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={[
                                    styles.modeActionIconButton,
                                    {
                                      borderColor: theme.border,
                                      backgroundColor: theme.isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.04)",
                                      opacity:
                                        modeIndex === activeExtraStudyModeOrder.length - 1
                                          ? 0.4
                                          : 1,
                                    },
                                  ]}
                                  disabled={
                                    modeIndex === activeExtraStudyModeOrder.length - 1
                                  }
                                  onPress={() => moveExtraStudyMode(mode.id, 1)}
                                >
                                  <Ionicons
                                    name="chevron-down"
                                    size={16}
                                    color={theme.textColor}
                                  />
                                </TouchableOpacity>

                                <TouchableOpacity
                                  style={[
                                    styles.modeActionIconButton,
                                    {
                                      borderColor: theme.border,
                                      backgroundColor: theme.isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.04)",
                                      opacity:
                                        activeExtraStudyModeOrder.length <= 1 ? 0.4 : 1,
                                    },
                                  ]}
                                  disabled={activeExtraStudyModeOrder.length <= 1}
                                  onPress={() => removeHomeExtraStudyMode(mode.id)}
                                >
                                  <Ionicons
                                    name="close"
                                    size={16}
                                    color={
                                      activeExtraStudyModeOrder.length <= 1
                                        ? theme.textSecondary
                                        : theme.error
                                    }
                                  />
                                </TouchableOpacity>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </Animated.View>
                  ) : null}
                </View>
              )}

              {item === "lessonsReviews" && (
                <View style={styles.widgetSettingBlock}>
                  <TouchableOpacity
                    style={[
                      styles.expandSectionButton,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.isDark
                          ? "rgba(255,255,255,0.03)"
                          : "rgba(0,0,0,0.02)",
                      },
                    ]}
                    onPress={() => toggleColorSection(item)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isColorSectionExpanded(item)
                        ? "Hide lessons and reviews color settings"
                        : "Show lessons and reviews color settings"
                    }
                  >
                    <Text style={[styles.widgetSettingLabel, { color: theme.textSecondary }]}>
                      Lessons & Reviews Colors
                    </Text>
                    <View style={styles.expandSectionButtonRight}>
                      <Text style={[styles.expandSectionButtonText, { color: theme.textColor }]}>
                        {isColorSectionExpanded(item) ? "Hide" : "Customize"}
                      </Text>
                      <Ionicons
                        name={isColorSectionExpanded(item) ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={theme.textColor}
                      />
                    </View>
                  </TouchableOpacity>

                  {isColorSectionExpanded(item) ? (
                    <Animated.View
                      entering={FadeInDown.duration(220)}
                      exiting={FadeOutUp.duration(180)}
                      layout={Layout.duration(220).easing(Easing.out(Easing.cubic))}
                      style={styles.colorExpandedContent}
                    >
                      <View style={styles.inlineSectionHeader}>
                        <Text style={[styles.widgetSettingLabel, { color: theme.textSecondary }]}>
                          Card Color Settings
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.smallActionButton,
                            {
                              borderColor: theme.border,
                              backgroundColor: theme.isDark
                                ? "rgba(255,255,255,0.05)"
                                : "rgba(0,0,0,0.03)",
                            },
                          ]}
                          onPress={resetLessonsReviewsColors}
                        >
                          <Ionicons name="refresh" size={14} color={theme.textColor} />
                          <Text
                            style={[styles.smallActionButtonText, { color: theme.textColor }]}
                          >
                            Reset Colors
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.switchRowCompact}>
                        <Text style={[styles.inlineSwitchLabel, { color: theme.textColor }]}>
                          Lesson Card Follows Theme
                        </Text>
                        <Switch
                          value={widgetLessonCardFollowTheme}
                          onValueChange={setWidgetLessonCardFollowTheme}
                          trackColor={{ false: "#767577", true: theme.primary }}
                          thumbColor={widgetLessonCardFollowTheme ? "#fff" : "#f4f3f4"}
                        />
                      </View>
                      {renderColorControls(
                        LESSON_CARD_COLOR_FIELDS,
                        widgetLessonCardFollowTheme,
                      )}

                      <View style={styles.switchRowCompact}>
                        <Text style={[styles.inlineSwitchLabel, { color: theme.textColor }]}>
                          Review Card Follows Theme
                        </Text>
                        <Switch
                          value={widgetReviewCardFollowTheme}
                          onValueChange={setWidgetReviewCardFollowTheme}
                          trackColor={{ false: "#767577", true: theme.primary }}
                          thumbColor={widgetReviewCardFollowTheme ? "#fff" : "#f4f3f4"}
                        />
                      </View>
                      {renderColorControls(
                        REVIEW_CARD_COLOR_FIELDS,
                        widgetReviewCardFollowTheme,
                      )}
                    </Animated.View>
                  ) : null}
                </View>
              )}

              {item === "streak" && (
                <View style={styles.widgetSettingBlock}>
                  <TouchableOpacity
                    style={[
                      styles.expandSectionButton,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.isDark
                          ? "rgba(255,255,255,0.03)"
                          : "rgba(0,0,0,0.02)",
                      },
                    ]}
                    onPress={() => toggleColorSection(item)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isColorSectionExpanded(item)
                        ? "Hide streak color settings"
                        : "Show streak color settings"
                    }
                  >
                    <Text style={[styles.widgetSettingLabel, { color: theme.textSecondary }]}>
                      Streak Card Colors
                    </Text>
                    <View style={styles.expandSectionButtonRight}>
                      <Text style={[styles.expandSectionButtonText, { color: theme.textColor }]}>
                        {isColorSectionExpanded(item) ? "Hide" : "Customize"}
                      </Text>
                      <Ionicons
                        name={isColorSectionExpanded(item) ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={theme.textColor}
                      />
                    </View>
                  </TouchableOpacity>

                  {isColorSectionExpanded(item) ? (
                    <Animated.View
                      entering={FadeInDown.duration(220)}
                      exiting={FadeOutUp.duration(180)}
                      layout={Layout.duration(220).easing(Easing.out(Easing.cubic))}
                      style={styles.colorExpandedContent}
                    >
                      <View style={styles.inlineSectionHeader}>
                        <Text style={[styles.widgetSettingLabel, { color: theme.textSecondary }]}>
                          Card Color Settings
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.smallActionButton,
                            {
                              borderColor: theme.border,
                              backgroundColor: theme.isDark
                                ? "rgba(255,255,255,0.05)"
                                : "rgba(0,0,0,0.03)",
                            },
                          ]}
                          onPress={resetStreakColors}
                        >
                          <Ionicons name="refresh" size={14} color={theme.textColor} />
                          <Text
                            style={[styles.smallActionButtonText, { color: theme.textColor }]}
                          >
                            Reset Colors
                          </Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.switchRowCompact}>
                        <Text style={[styles.inlineSwitchLabel, { color: theme.textColor }]}>
                          Streak Card Follows Theme
                        </Text>
                        <Switch
                          value={widgetStreakCardFollowTheme}
                          onValueChange={setWidgetStreakCardFollowTheme}
                          trackColor={{ false: "#767577", true: theme.primary }}
                          thumbColor={widgetStreakCardFollowTheme ? "#fff" : "#f4f3f4"}
                        />
                      </View>
                      {renderColorControls(
                        STREAK_CARD_COLOR_FIELDS,
                        widgetStreakCardFollowTheme,
                      )}
                    </Animated.View>
                  ) : null}
                </View>
              )}

              {item === "srsBreakdown" && (
                <View style={styles.widgetSettingBlock}>
                  <TouchableOpacity
                    style={[
                      styles.expandSectionButton,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.isDark
                          ? "rgba(255,255,255,0.03)"
                          : "rgba(0,0,0,0.02)",
                      },
                    ]}
                    onPress={openSrsBreakdownDisplayModeSettings}
                    accessibilityRole="button"
                    accessibilityLabel="Show SRS breakdown layout options"
                  >
                    <Text style={[styles.widgetSettingLabel, { color: theme.textSecondary }]}>
                      SRS Breakdown Layout
                    </Text>
                    <View style={styles.expandSectionButtonRight}>
                      <Text style={[styles.expandSectionButtonText, { color: theme.textColor }]}>
                        {selectedSrsBreakdownDisplayOption.label}
                      </Text>
                      <Ionicons name="chevron-forward" size={16} color={theme.textColor} />
                    </View>
                  </TouchableOpacity>
                  <Text style={[styles.disabledHintText, { color: theme.textSecondary }]}>
                    {selectedSrsBreakdownDisplayOption.subtitle}
                  </Text>
                </View>
              )}

              {analyticsFields && analyticsFields.length > 0 && (
                <View style={styles.widgetSettingBlock}>
                  <TouchableOpacity
                    style={[
                      styles.expandSectionButton,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.isDark
                          ? "rgba(255,255,255,0.03)"
                          : "rgba(0,0,0,0.02)",
                      },
                    ]}
                    onPress={() => toggleColorSection(item)}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isColorSectionExpanded(item)
                        ? "Hide widget color settings"
                        : "Show widget color settings"
                    }
                  >
                    <Text style={[styles.widgetSettingLabel, { color: theme.textSecondary }]}>
                      Widget Colors
                    </Text>
                    <View style={styles.expandSectionButtonRight}>
                      <Text style={[styles.expandSectionButtonText, { color: theme.textColor }]}>
                        {isColorSectionExpanded(item) ? "Hide" : "Customize"}
                      </Text>
                      <Ionicons
                        name={isColorSectionExpanded(item) ? "chevron-up" : "chevron-down"}
                        size={16}
                        color={theme.textColor}
                      />
                    </View>
                  </TouchableOpacity>

                  {isColorSectionExpanded(item) ? (
                    <Animated.View
                      entering={FadeInDown.duration(220)}
                      exiting={FadeOutUp.duration(180)}
                      layout={Layout.duration(220).easing(Easing.out(Easing.cubic))}
                      style={styles.colorExpandedContent}
                    >
                      <View style={styles.inlineSectionHeader}>
                        <Text style={[styles.widgetSettingLabel, { color: theme.textSecondary }]}>
                          Widget Color Settings
                        </Text>
                        <TouchableOpacity
                          style={[
                            styles.smallActionButton,
                            {
                              borderColor: theme.border,
                              backgroundColor: theme.isDark
                                ? "rgba(255,255,255,0.05)"
                                : "rgba(0,0,0,0.03)",
                            },
                          ]}
                          onPress={() => resetAnalyticsColors(analyticsFields)}
                        >
                          <Ionicons name="refresh" size={14} color={theme.textColor} />
                          <Text
                            style={[styles.smallActionButtonText, { color: theme.textColor }]}
                          >
                            Reset Colors
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {renderColorControls(analyticsFields)}
                    </Animated.View>
                  ) : null}
                </View>
              )}
            </Animated.View>
          );
        }}
      />

      <Modal
        visible={Boolean(selectionSheet)}
        transparent
        animationType="fade"
        onRequestClose={closeSheet}
      >
        <Pressable style={styles.sheetBackdrop} onPress={closeSheet}>
          <Pressable
            style={[
              styles.sheetCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
                paddingBottom: Math.max(insets.bottom, 14),
              },
            ]}
            onPress={() => {}}
          >
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderText}>
                <Text style={[styles.sheetTitle, { color: theme.textColor }]}>
                  {selectionSheet?.title}
                </Text>
                {selectionSheet?.subtitle ? (
                  <Text
                    style={[styles.sheetSubtitle, { color: theme.textSecondary }]}
                  >
                    {selectionSheet.subtitle}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.sheetCloseButton}
                onPress={closeSheet}
                accessibilityRole="button"
                accessibilityLabel="Close menu"
              >
                <Ionicons name="close" size={20} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.sheetOptionsList}>
              {selectionSheet?.options.map((option, optionIndex) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.sheetOption,
                    optionIndex > 0 && styles.sheetOptionSpacing,
                    {
                      borderColor: theme.border,
                      backgroundColor: option.selected
                        ? theme.isDark
                          ? "rgba(58,134,255,0.2)"
                          : "rgba(58,134,255,0.1)"
                        : theme.isDark
                          ? "rgba(255,255,255,0.03)"
                          : "rgba(0,0,0,0.02)",
                    },
                  ]}
                  onPress={() => {
                    closeSheet();
                    option.onPress();
                  }}
                >
                  <View style={styles.sheetOptionText}>
                    <Text style={[styles.sheetOptionTitle, { color: theme.textColor }]}>
                      {option.title}
                    </Text>
                    {option.subtitle ? (
                      <Text
                        style={[
                          styles.sheetOptionSubtitle,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {option.subtitle}
                      </Text>
                    ) : null}
                  </View>
                  {option.selected ? (
                    <Ionicons name="checkmark" size={18} color={theme.primary} />
                  ) : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerGlassButton: {
    width: 40,
    height: 40,
  },
  headerGlassButtonDisabled: {
    width: 40,
    height: 40,
    opacity: 0.4,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  widgetEditorCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  widgetEditorHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  widgetEditorTitleContainer: {
    flex: 1,
  },
  widgetEditorTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  widgetEditorSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  widgetEditorActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionIconButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  widgetPreviewContainer: {
    marginHorizontal: -4,
  },
  srsSplitPreviewRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "stretch",
  },
  srsSplitPreviewColumn: {
    flex: 1,
    minWidth: 0,
  },
  srsSplitPreviewWidget: {
    flex: 1,
  },
  srsSplitPreviewStack: {
    gap: 8,
  },
  widgetSettingBlock: {
    gap: 10,
  },
  widgetSettingLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  inlineSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  expandSectionButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  expandSectionButtonRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  expandSectionButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  extraStudyExpandedContent: {
    gap: 10,
  },
  colorExpandedContent: {
    gap: 10,
  },
  smallActionButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  smallActionButtonText: {
    fontSize: 11,
    fontWeight: "600",
  },
  smallActionButtonDisabled: {
    opacity: 0.45,
  },
  disabledHintText: {
    fontSize: 11,
    fontStyle: "italic",
  },
  modeRowsWrap: {
    gap: 8,
  },
  modeRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modeInfo: {
    flex: 1,
    gap: 2,
  },
  modeTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  modeSubtitle: {
    fontSize: 11,
  },
  modeActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modeActionIconButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  switchRowCompact: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 2,
  },
  inlineSwitchLabel: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  colorControlsWrap: {
    gap: 8,
  },
  colorRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  colorLabelWrap: {
    flex: 1,
  },
  colorLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  colorControlWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorPreview: {
    width: 28,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
  },
  colorPickerButtonHost: {
    width: 32,
    height: 32,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hashPrefix: {
    fontSize: 14,
    fontWeight: "600",
  },
  hexInput: {
    width: 90,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 1,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheetCard: {
    borderWidth: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    padding: 14,
    gap: 10,
    width: "100%",
  },
  sheetHeader: {
    flexDirection: "row",
    gap: 8,
  },
  sheetHeaderText: {
    flex: 1,
    gap: 2,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sheetSubtitle: {
    fontSize: 12,
    lineHeight: 17,
  },
  sheetCloseButton: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetOption: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sheetOptionSpacing: {
    marginTop: 8,
  },
  sheetOptionText: {
    flex: 1,
    gap: 2,
  },
  sheetOptionTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  sheetOptionSubtitle: {
    fontSize: 11,
    lineHeight: 16,
  },
  sheetOptionsList: {
    maxHeight: 420,
  },
});
