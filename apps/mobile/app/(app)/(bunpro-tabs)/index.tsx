import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { GlassButton } from "../../../src/components/GlassButton";
import { WanikaniSwitchIcon } from "../../../src/components/SwitchModeIcons";
import BunproActivityCard from "../../../src/components/bunpro/BunproActivityCard";
import BunproForecastCard from "../../../src/components/bunpro/BunproForecastCard";
import BunproJlptProgressCard from "../../../src/components/bunpro/BunproJlptProgressCard";
import BunproProgressCard from "../../../src/components/bunpro/BunproProgressCard";
import BunproStudyQueueCard from "../../../src/components/bunpro/BunproStudyQueueCard";
import {
  BunproDashboardPayload,
  BunproJlptLevelProgress,
  BunproSrsStage,
} from "../../../src/types/bunpro";
import {
  BunproApiError,
  clearBunproApiToken,
  getBunproApiTokenFromEnv,
  getBunproDashboard,
  getStoredBunproApiToken,
  saveBunproApiToken,
  validateBunproApiToken,
} from "../../../src/utils/bunproApi";
import { summarizeBunproQueue } from "../../../src/utils/bunproQueue";
import { supportsNativeTabs } from "../../../src/utils/nativeTabs";
import { isPortegoUsername } from "../../../src/utils/portegoAccess";
import { useAuthStore } from "../../../src/utils/store";
import { getBestContrastTextColor, withAlpha } from "../../../src/utils/subjectColors";
import { useTheme } from "../../../src/utils/theme";

type TokenStatus = {
  message: string;
  isError: boolean;
};

type ReviewableKind = "grammar" | "vocab";
type ForecastMode = "hourly" | "daily";

type ActivityPoint = {
  key: string;
  label: string;
  grammar: number;
  vocab: number;
};

type ForecastPoint = {
  key: string;
  label: string;
  grammar: number;
  vocab: number;
  total: number;
};

const SRS_STAGES: BunproSrsStage[] = [
  "beginner",
  "adept",
  "seasoned",
  "expert",
  "master",
];

const JLPT_LEVELS: ("5" | "4" | "3" | "2" | "1")[] = [
  "5",
  "4",
  "3",
  "2",
  "1",
];

function formatBunproError(error: unknown): string {
  if (error instanceof BunproApiError) {
    if (error.code) {
      return `${error.message} (${error.code})`;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong while loading Bunpro data.";
}

function getStartedJlptCount(levelData: BunproJlptLevelProgress): number {
  return (
    levelData.beginner +
    levelData.adept +
    levelData.seasoned +
    levelData.expert +
    levelData.master
  );
}

function getForecastBucketValue(
  series: Record<string, number> | undefined,
  key: string
): number {
  if (!series) {
    return 0;
  }
  const value = series[key];
  return typeof value === "number" ? value : 0;
}

function formatShortDate(dateString: string): string {
  const parsedDate = new Date(dateString);
  if (Number.isNaN(parsedDate.getTime())) {
    return dateString;
  }

  return parsedDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatWeekDayLabel(dateString: string): string {
  const parsedDate = new Date(dateString);
  if (Number.isNaN(parsedDate.getTime())) {
    return dateString;
  }

  return parsedDate.toLocaleDateString(undefined, {
    weekday: "short",
  });
}

function formatHourLabel(isoHour: string): string {
  const parsedDate = new Date(isoHour);
  if (Number.isNaN(parsedDate.getTime())) {
    return isoHour;
  }

  return parsedDate.toLocaleTimeString(undefined, {
    hour: "numeric",
  });
}

function buildSmoothCurveCommands(points: { x: number; y: number }[]): string[] {
  if (points.length < 2) {
    return [];
  }

  const commands: string[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const nextNext = points[index + 2] ?? next;

    const controlPoint1X = current.x + (next.x - previous.x) / 6;
    const controlPoint1Y = current.y + (next.y - previous.y) / 6;
    const controlPoint2X = next.x - (nextNext.x - current.x) / 6;
    const controlPoint2Y = next.y - (nextNext.y - current.y) / 6;

    commands.push(
      `C ${controlPoint1X} ${controlPoint1Y}, ${controlPoint2X} ${controlPoint2Y}, ${next.x} ${next.y}`
    );
  }

  return commands;
}

function buildSmoothLinePath(points: { x: number; y: number }[]): string {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    const only = points[0];
    return `M ${only.x} ${only.y}`;
  }

  const first = points[0];
  const commands = buildSmoothCurveCommands(points);
  return `M ${first.x} ${first.y} ${commands.join(" ")}`;
}

function buildSmoothAreaPath(
  points: { x: number; y: number }[],
  chartBottomY: number
): string {
  if (points.length === 0) {
    return "";
  }

  const first = points[0];
  const last = points[points.length - 1];
  const commands = buildSmoothCurveCommands(points);

  if (points.length === 1) {
    return `M ${first.x} ${chartBottomY} L ${first.x} ${first.y} L ${first.x} ${chartBottomY} Z`;
  }

  return `M ${first.x} ${chartBottomY} L ${first.x} ${first.y} ${commands.join(
    " "
  )} L ${last.x} ${chartBottomY} Z`;
}

function findNumericField(
  source: Record<string, unknown> | null | undefined,
  candidateKeys: string[]
): number | null {
  if (!source) {
    return null;
  }

  for (const key of candidateKeys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return value;
    }
  }

  return null;
}

export default function BunproTab() {
  const { theme, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const { userData } = useAuthStore();
  const isPortegoUser = isPortegoUsername(userData?.username);
  const shouldUseNativeTabsPadding = supportsNativeTabs();

  const [tokenInput, setTokenInput] = useState("");
  const tokenInputRef = useRef("");
  const [hasStoredToken, setHasStoredToken] = useState(false);
  const [isLoadingToken, setIsLoadingToken] = useState(true);
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [showTokenEditor, setShowTokenEditor] = useState(false);

  const [dashboardData, setDashboardData] = useState<BunproDashboardPayload | null>(
    null
  );
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const hasHandledInitialFocusRef = useRef(false);
  const isFocusRefreshInFlightRef = useRef(false);

  const [progressMode, setProgressMode] = useState<ReviewableKind>("grammar");
  const [jlptMode, setJlptMode] = useState<ReviewableKind>("grammar");
  const [forecastMode, setForecastMode] = useState<ForecastMode>("daily");
  const [showActivityGrammar, setShowActivityGrammar] = useState(true);
  const [showActivityVocab, setShowActivityVocab] = useState(true);
  const [showForecastGrammar, setShowForecastGrammar] = useState(true);
  const [showForecastVocab, setShowForecastVocab] = useState(true);

  const accent = isDark ? "#db6466" : "#cc5b5d";
  const accentSoft = isDark ? "#d8bcbc" : "#e8d3d4";
  const accentMuted = isDark ? "#b58586" : "#c18e90";
  const panelBackground = isDark ? "#1c1f24" : "#ffffff";
  const panelBorder = isDark ? "#3a3f47" : theme.border;
  const softText = isDark ? "#b7bbc3" : theme.textSecondary;
  const graphGridColor = isDark ? "rgba(255,255,255,0.12)" : "rgba(20,20,20,0.1)";
  const accentTextColor = getBestContrastTextColor(accent, "#17181d", "#ffffff");
  const accentMutedTextColor = getBestContrastTextColor(accentMuted, "#191a1f", "#ffffff");
  const inactiveStreakDotBackground = isDark
    ? "rgba(255,255,255,0.2)"
    : withAlpha(theme.textSecondary, 0.14);
  const inactiveStreakDotBorder = isDark
    ? "rgba(255,255,255,0.18)"
    : withAlpha(theme.textSecondary, 0.24);
  const inactiveStreakDotInner = isDark
    ? "rgba(255,255,255,0.46)"
    : withAlpha(theme.textSecondary, 0.42);

  useEffect(() => {
    tokenInputRef.current = tokenInput;
  }, [tokenInput]);

  const loadDashboard = useCallback(
    async (tokenOverride?: string | null, asRefresh = false) => {
      if (!isPortegoUser) {
        return;
      }

      if (asRefresh) {
        setIsRefreshing(true);
      } else {
        setIsLoadingData(true);
      }

      const normalizedToken = tokenOverride?.trim() || undefined;
      try {
        const payload = await getBunproDashboard({
          apiToken: normalizedToken,
        });
        setDashboardData(payload);
        setErrorMessage(null);
        setLastUpdatedAt(Date.now());
      } catch (error) {
        setErrorMessage(formatBunproError(error));
      } finally {
        if (asRefresh) {
          setIsRefreshing(false);
        } else {
          setIsLoadingData(false);
        }
      }
    },
    [isPortegoUser]
  );

  useEffect(() => {
    let isMounted = true;

    async function bootstrapBunpro() {
      setIsLoadingToken(true);
      try {
        const storedToken = await getStoredBunproApiToken();
        const envToken = getBunproApiTokenFromEnv();
        const initialToken = storedToken ?? envToken ?? "";

        if (!isMounted) {
          return;
        }

        setTokenInput(initialToken);
        setHasStoredToken(Boolean(storedToken));
        setShowTokenEditor(!Boolean(storedToken));

        if (isPortegoUser) {
          await loadDashboard(initialToken);
        }
      } catch (error) {
        if (!isMounted) {
          return;
        }
        setErrorMessage(formatBunproError(error));
      } finally {
        if (isMounted) {
          setIsLoadingToken(false);
        }
      }
    }

    void bootstrapBunpro();

    return () => {
      isMounted = false;
    };
  }, [isPortegoUser, loadDashboard]);

  const handleSaveToken = useCallback(async () => {
    const normalizedToken = tokenInput.trim();
    setTokenStatus(null);

    if (!normalizedToken) {
      setTokenStatus({
        message: "Enter your Bunpro API token first.",
        isError: true,
      });
      return;
    }

    setIsSavingToken(true);
    setTokenStatus({
      message: "Validating Bunpro API token...",
      isError: false,
    });

    try {
      const isValid = await validateBunproApiToken(normalizedToken);
      if (!isValid) {
        setTokenStatus({
          message: "That token is invalid or Bunpro is unavailable right now.",
          isError: true,
        });
        return;
      }

      await saveBunproApiToken(normalizedToken);
      setHasStoredToken(true);
      setTokenStatus({
        message: "Bunpro API token saved.",
        isError: false,
      });
      setShowTokenEditor(false);
      await loadDashboard(normalizedToken);
    } catch (error) {
      setTokenStatus({
        message: formatBunproError(error),
        isError: true,
      });
    } finally {
      setIsSavingToken(false);
    }
  }, [loadDashboard, tokenInput]);

  const handleRemoveToken = useCallback(async () => {
    setIsSavingToken(true);
    setTokenStatus(null);
    try {
      await clearBunproApiToken();
      setHasStoredToken(false);
      setTokenInput("");
      setDashboardData(null);
      setErrorMessage(null);
      setShowTokenEditor(true);
      setTokenStatus({
        message: "Bunpro API token removed.",
        isError: false,
      });
    } catch (error) {
      setTokenStatus({
        message: formatBunproError(error),
        isError: true,
      });
    } finally {
      setIsSavingToken(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) {
      return;
    }
    await loadDashboard(tokenInput, true);
  }, [isRefreshing, loadDashboard, tokenInput]);

  useFocusEffect(
    useCallback(() => {
      if (!isPortegoUser) {
        return;
      }

      if (!hasHandledInitialFocusRef.current) {
        hasHandledInitialFocusRef.current = true;
        return;
      }

      if (isFocusRefreshInFlightRef.current) {
        return;
      }

      isFocusRefreshInFlightRef.current = true;
      void loadDashboard(tokenInputRef.current, true).finally(() => {
        isFocusRefreshInFlightRef.current = false;
      });
    }, [isPortegoUser, loadDashboard])
  );

  const bunproUser = dashboardData?.user.user.data.attributes;
  const baseStats = dashboardData?.baseStats.facts;
  const srsOverview = dashboardData?.srsLevelOverview;

  const xpProgress = useMemo(() => {
    if (!bunproUser) {
      return 0;
    }
    const currentXp = Number(bunproUser.xp);
    const previousXp = Number(bunproUser.prev_level_xp);
    const nextXp = Number(bunproUser.next_level_xp);
    const xpRange = nextXp - previousXp;
    if (!Number.isFinite(xpRange) || xpRange <= 0) {
      return 0;
    }
    const progress = (currentXp - previousXp) / xpRange;
    return Math.max(0, Math.min(progress, 1));
  }, [bunproUser]);

  const dueNowBreakdown = useMemo(() => {
    const grammarFromDue =
      typeof dashboardData?.due.total_due_grammar === "number"
        ? dashboardData.due.total_due_grammar
        : null;
    const vocabFromDue =
      typeof dashboardData?.due.total_due_vocab === "number"
        ? dashboardData.due.total_due_vocab
        : null;

    const grammarFallback = getForecastBucketValue(
      dashboardData?.forecastDaily.grammar,
      "later"
    );
    const vocabFallback = getForecastBucketValue(
      dashboardData?.forecastDaily.vocab,
      "later"
    );

    const grammar = grammarFromDue ?? grammarFallback;
    const vocab = vocabFromDue ?? vocabFallback;
    return { grammar, vocab };
  }, [dashboardData?.due, dashboardData?.forecastDaily.grammar, dashboardData?.forecastDaily.vocab]);

  const dueNow = useMemo(() => {
    return dueNowBreakdown.grammar + dueNowBreakdown.vocab;
  }, [dueNowBreakdown.grammar, dueNowBreakdown.vocab]);

  const dueTomorrow = useMemo(() => {
    const grammarTomorrow = getForecastBucketValue(
      dashboardData?.forecastDaily.grammar,
      "tomorrow"
    );
    const vocabTomorrow = getForecastBucketValue(
      dashboardData?.forecastDaily.vocab,
      "tomorrow"
    );
    return grammarTomorrow + vocabTomorrow;
  }, [dashboardData?.forecastDaily.grammar, dashboardData?.forecastDaily.vocab]);

  const nextForecastDays = useMemo(() => {
    if (!dashboardData) {
      return [] as ForecastPoint[];
    }

    const grammar = dashboardData.forecastDaily.grammar;
    const vocab = dashboardData.forecastDaily.vocab;
    const dateKeys = Array.from(
      new Set(
        [...Object.keys(grammar), ...Object.keys(vocab)].filter(
          (key) => key !== "later" && key !== "tomorrow"
        )
      )
    )
      .filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(key))
      .sort()
      .slice(0, 8);

    return dateKeys.map((dayKey) => {
      const grammarValue = getForecastBucketValue(grammar, dayKey);
      const vocabValue = getForecastBucketValue(vocab, dayKey);
      return {
        key: dayKey,
        label: formatShortDate(dayKey),
        grammar: grammarValue,
        vocab: vocabValue,
        total: grammarValue + vocabValue,
      };
    });
  }, [dashboardData]);

  const activityPoints = useMemo(() => {
    if (!dashboardData) {
      return [] as ActivityPoint[];
    }

    const grammar = dashboardData.reviewActivity.grammar;
    const vocab = dashboardData.reviewActivity.vocab;

    const allDays = Array.from(
      new Set([...Object.keys(grammar), ...Object.keys(vocab)])
    ).sort();

    const lastFourteenDays = allDays.slice(-14);

    return lastFourteenDays.map((day) => ({
      key: day,
      label: formatWeekDayLabel(day),
      grammar: getForecastBucketValue(grammar, day),
      vocab: getForecastBucketValue(vocab, day),
    }));
  }, [dashboardData]);

  const compactLayout = width < 390;
  const activityChartWidth = Math.max(200, Math.round(width - 96));
  const activityChartHeight = 180;

  const activityChart = useMemo(() => {
    if (activityPoints.length === 0) {
      return {
        grammarPath: "",
        vocabPath: "",
        grammarAreaPath: "",
        vocabAreaPath: "",
        maxValue: 1,
      };
    }

    const chartLeftPadding = 6;
    const chartRightPadding = 6;
    const chartTopPadding = 8;
    const chartBottomPadding = 14;
    const drawableHeight = activityChartHeight - chartTopPadding - chartBottomPadding;
    const chartBottomY = activityChartHeight - chartBottomPadding;

    const visibleValues = activityPoints.flatMap((entry) => [
      showActivityGrammar ? entry.grammar : 0,
      showActivityVocab ? entry.vocab : 0,
    ]);
    const maxValue = Math.max(1, ...visibleValues);

    const stepX =
      activityPoints.length <= 1
        ? 0
        : (activityChartWidth - chartLeftPadding - chartRightPadding) /
          (activityPoints.length - 1);

    const buildPoints = (key: "grammar" | "vocab", isVisible: boolean) => {
      if (!isVisible) {
        return [] as { x: number; y: number }[];
      }

      return activityPoints.map((entry, index) => {
        const x = chartLeftPadding + index * stepX;
        const normalized = Math.max(0, entry[key]) / maxValue;
        const y = chartBottomY - normalized * drawableHeight;
        return { x, y };
      });
    };

    const grammarPoints = buildPoints("grammar", showActivityGrammar);
    const vocabPoints = buildPoints("vocab", showActivityVocab);

    return {
      grammarPath: buildSmoothLinePath(grammarPoints),
      vocabPath: buildSmoothLinePath(vocabPoints),
      grammarAreaPath: buildSmoothAreaPath(grammarPoints, chartBottomY),
      vocabAreaPath: buildSmoothAreaPath(vocabPoints, chartBottomY),
      maxValue,
    };
  }, [
    activityChartHeight,
    activityChartWidth,
    activityPoints,
    showActivityGrammar,
    showActivityVocab,
  ]);

  const hourlyForecastPoints = useMemo(() => {
    if (!dashboardData) {
      return [] as ForecastPoint[];
    }

    const grammarSeries = dashboardData.forecastHourly.grammar;
    const vocabSeries = dashboardData.forecastHourly.vocab;

    const keys = Array.from(
      new Set([...Object.keys(grammarSeries), ...Object.keys(vocabSeries)])
    )
      .sort((left, right) => {
        const leftTime = Date.parse(left);
        const rightTime = Date.parse(right);
        return leftTime - rightTime;
      })
      .slice(0, compactLayout ? 20 : 24);

    return keys.map((key) => {
      const grammarValue = getForecastBucketValue(grammarSeries, key);
      const vocabValue = getForecastBucketValue(vocabSeries, key);

      return {
        key,
        label: formatHourLabel(key),
        grammar: grammarValue,
        vocab: vocabValue,
        total: grammarValue + vocabValue,
      };
    });
  }, [compactLayout, dashboardData]);

  const forecastBasePoints = useMemo(() => {
    if (!dashboardData) {
      return [] as ForecastPoint[];
    }

    if (forecastMode === "hourly") {
      return hourlyForecastPoints;
    }

    const grammarTomorrow = getForecastBucketValue(
      dashboardData.forecastDaily.grammar,
      "tomorrow"
    );
    const vocabTomorrow = getForecastBucketValue(
      dashboardData.forecastDaily.vocab,
      "tomorrow"
    );

    return [
      {
        key: "tomorrow",
        label: "Tomorrow",
        grammar: grammarTomorrow,
        vocab: vocabTomorrow,
        total: grammarTomorrow + vocabTomorrow,
      },
      ...nextForecastDays,
    ];
  }, [dashboardData, forecastMode, hourlyForecastPoints, nextForecastDays]);

  const forecastPoints = useMemo(() => {
    if (forecastBasePoints.length === 0 && dueNow === 0) {
      return [] as ForecastPoint[];
    }

    let runningGrammar = showForecastGrammar ? dueNowBreakdown.grammar : 0;
    let runningVocab = showForecastVocab ? dueNowBreakdown.vocab : 0;

    const cumulativePoints: ForecastPoint[] = [
      {
        key: `${forecastMode}-now`,
        label: "Now",
        grammar: runningGrammar,
        vocab: runningVocab,
        total: runningGrammar + runningVocab,
      },
    ];

    forecastBasePoints.forEach((entry) => {
      if (showForecastGrammar) {
        runningGrammar += entry.grammar;
      }
      if (showForecastVocab) {
        runningVocab += entry.vocab;
      }

      cumulativePoints.push({
        ...entry,
        grammar: runningGrammar,
        vocab: runningVocab,
        total: runningGrammar + runningVocab,
      });
    });

    return cumulativePoints;
  }, [
    dueNow,
    dueNowBreakdown.grammar,
    dueNowBreakdown.vocab,
    forecastBasePoints,
    forecastMode,
    showForecastGrammar,
    showForecastVocab,
  ]);

  const weeklyStreakEntries = useMemo(() => {
    return baseStats?.weekly_streak ?? [];
  }, [baseStats?.weekly_streak]);

  const activeSrsBuckets = useMemo(() => {
    if (!srsOverview) {
      return null;
    }
    return srsOverview[progressMode];
  }, [progressMode, srsOverview]);

  const stagePalette = useMemo(() => {
    if (isDark) {
      return ["#ccb5b8", "#b78183", "#df8f90", "#8f5757", "#6d3e3f"];
    }
    return ["#e5cfd1", "#d8a8a9", "#e99092", "#bb6e70", "#a05658"];
  }, [isDark]);
  const dimmedStageColor = isDark ? "#4a4f58" : "#d9dde4";

  const jlptRows = useMemo(() => {
    if (!dashboardData) {
      return [];
    }

    return JLPT_LEVELS.map((level) => {
      const row = dashboardData.jlptProgressMixed[jlptMode][level];
      const started = getStartedJlptCount(row);
      return {
        level,
        row,
        started,
      };
    });
  }, [dashboardData, jlptMode]);

  const queueSummary = useMemo(() => {
    return summarizeBunproQueue(dashboardData?.queue);
  }, [dashboardData?.queue]);

  const availableReviews = useMemo(() => {
    const dueTotal =
      (dashboardData?.due.total_due_grammar ?? 0) +
      (dashboardData?.due.total_due_vocab ?? 0);

    if (dueTotal > 0 || dashboardData?.due) {
      return dueTotal;
    }

    const candidateFromUser = findNumericField(bunproUser ?? null, [
      "reviews_available",
      "available_reviews",
      "review_count",
      "reviews_count",
      "current_reviews",
    ]);

    if (candidateFromUser !== null) {
      return candidateFromUser;
    }

    const candidateFromFacts = findNumericField(
      (baseStats as unknown as Record<string, unknown>) ?? null,
      ["reviews_available", "available_reviews", "review_count", "reviews_count"]
    );

    return candidateFromFacts ?? dueNow;
  }, [baseStats, bunproUser, dashboardData?.due, dueNow]);

  const openBunproReviews = useCallback(
    (mode: "all" | "grammar" | "vocab") => {
      router.push({
        pathname: "/bunpro-reviews",
        params: { mode },
      });
    },
    []
  );
  const openBunproLessons = useCallback(() => {
    router.push({
      pathname: "/bunpro-lessons",
      params: queueSummary.next?.deckId ? { deckId: String(queueSummary.next.deckId) } : {},
    });
  }, [queueSummary.next?.deckId]);
  const headerIconColor = theme.isDark ? theme.headerText : "#000000";

  if (!isPortegoUser) {
    return (
      <View style={[styles.gatedContainer, { backgroundColor: theme.backgroundColor }]}> 
        <StatusBar style={theme.statusBarStyle} />
        <Ionicons name="lock-closed-outline" size={24} color={theme.textSecondary} />
        <Text style={[styles.gatedTitle, { color: theme.textColor }]}>Bunpro Beta Is Portego-Only</Text>
        <Text style={[styles.gatedSubtitle, { color: theme.textSecondary }]}>This tab is currently enabled only for the Portego account.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
      <StatusBar style={theme.statusBarStyle} />

      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.headerBackground,
          },
        ]}
      >
        <View style={styles.headerOverlay} />
        <View style={styles.profileContainer}>
          <View style={styles.profileImage}>
            <View style={styles.profileImageOverlay} />
            {bunproUser?.avatar_url ? (
              <Image source={{ uri: bunproUser.avatar_url }} style={styles.headerAvatarImage} />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Ionicons name="person" size={24} color={theme.headerText} />
              </View>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.username, { color: theme.headerText }]}>
              {bunproUser?.username ?? userData?.username ?? "Bunpro"}
            </Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Ionicons name="stats-chart" size={14} color={theme.headerText} />
                <Text style={[styles.statText, { color: theme.headerText }]}>
                  Lvl {bunproUser?.level ?? "--"}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.headerXpTrack,
                { backgroundColor: isDark ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.38)" },
              ]}
            >
              <View
                style={[
                  styles.headerXpFill,
                  {
                    backgroundColor: isDark ? "#f2b2b3" : "#ffffff",
                    width: `${Math.round(xpProgress * 100)}%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>
        <View style={styles.headerButtons}>
          <GlassButton
            onPress={() => router.replace("/(app)/(tabs)")}
          >
            <WanikaniSwitchIcon size={24} color={headerIconColor} />
          </GlassButton>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          shouldUseNativeTabsPadding && styles.nativeTabsPadding,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              void handleRefresh();
            }}
            colors={[accent]}
            tintColor={accent}
          />
        }
      >
        {errorMessage ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: isDark ? "rgba(120, 35, 35, 0.35)" : "#ffecec",
                borderColor: theme.error,
              },
            ]}
          >
            <Text style={[styles.errorText, { color: theme.error }]}>{errorMessage}</Text>
          </View>
        ) : null}

        {isLoadingData && !dashboardData ? (
          <View
            style={[
              styles.loadingCard,
              { backgroundColor: panelBackground, borderColor: panelBorder },
            ]}
          >
            <ActivityIndicator size="large" color={accent} />
            <Text style={[styles.loadingText, { color: softText }]}>Loading Bunpro dashboard...</Text>
          </View>
        ) : null}

        {dashboardData && bunproUser && baseStats && srsOverview ? (
          <>
            <BunproStudyQueueCard
              panelBackground={panelBackground}
              panelBorder={panelBorder}
              accent={accent}
              accentSoft={accentSoft}
              softText={softText}
              learnGoal={queueSummary.overall.dailyGoal}
              learnedTodayCount={queueSummary.overall.done}
              nextLessonBatchCount={queueSummary.overall.nextBatch}
              remainingLessons={queueSummary.overall.remaining}
              availableReviews={availableReviews}
              dueTomorrow={dueTomorrow}
              dueNowGrammar={dueNowBreakdown.grammar}
              dueNowVocab={dueNowBreakdown.vocab}
              onPressLearn={openBunproLessons}
              onPressReviewAll={() => {
                openBunproReviews("all");
              }}
              onPressReviewGrammar={() => {
                openBunproReviews("grammar");
              }}
              onPressReviewVocab={() => {
                openBunproReviews("vocab");
              }}
            />

            <View
              style={[
                styles.profileCard,
                { backgroundColor: panelBackground, borderColor: panelBorder },
              ]}
            >
              <View style={styles.profileHeaderRow}>
                {bunproUser.avatar_url ? (
                  <Image source={{ uri: bunproUser.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: accentMuted }]}> 
                    <Text style={styles.avatarFallbackLabel}>
                      {(bunproUser.username?.[0] ?? "P").toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.profileHeaderTextContainer}>
                  <Text style={[styles.profileName, { color: theme.textColor }]}>{bunproUser.username}</Text>
                  <Text style={[styles.profileLevel, { color: softText }]}>Level {bunproUser.level}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.refreshMiniButton, { borderColor: panelBorder }]}
                  disabled={isLoadingData || isRefreshing}
                  onPress={() => {
                    void handleRefresh();
                  }}
                >
                  <Ionicons name="refresh" size={18} color={softText} />
                </TouchableOpacity>
              </View>

              <View style={[styles.xpTrack, { backgroundColor: isDark ? "#14161b" : "#eceef1" }]}> 
                <View
                  style={[
                    styles.xpFill,
                    {
                      backgroundColor: accent,
                      width: `${Math.round(xpProgress * 100)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.xpMeta, { color: softText }]}>XP {bunproUser.xp.toLocaleString()} ({bunproUser.prev_level_xp.toLocaleString()} → {bunproUser.next_level_xp.toLocaleString()})</Text>

              <View style={[styles.streakPanel, { backgroundColor: isDark ? "#2a2f37" : "#f5f7fa" }]}> 
                <Text style={[styles.streakTitle, { color: theme.textColor }]}>Current Streak - {baseStats.streak}</Text>
                <View style={styles.streakDotsRow}>
                  {weeklyStreakEntries.map((entry) => (
                    <View key={entry.day} style={styles.streakDotCell}>
                      <View
                        style={[
                          styles.streakDot,
                          {
                            backgroundColor: entry.val
                              ? accent
                              : inactiveStreakDotBackground,
                            borderColor: entry.val ? accent : inactiveStreakDotBorder,
                          },
                        ]}
                      >
                        {entry.val ? (
                          <Ionicons name="checkmark" size={13} color={accentTextColor} />
                        ) : (
                          <View
                            style={[
                              styles.streakDotInner,
                              { backgroundColor: inactiveStreakDotInner },
                            ]}
                          />
                        )}
                      </View>
                      <Text style={[styles.streakDayLabel, { color: softText }]}> 
                        {formatShortDate(entry.day)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View style={[styles.quickStatsStrip, { backgroundColor: accentMuted }]}> 
                <View style={styles.quickStatItem}>
                  <Ionicons name="calendar-outline" size={18} color={accentMutedTextColor} />
                  <Text style={[styles.quickStatValue, { color: accentMutedTextColor }]}>
                    {baseStats.days_studied}
                  </Text>
                  <Text
                    style={[
                      styles.quickStatLabel,
                      {
                        color:
                          accentMutedTextColor === "#ffffff"
                            ? "rgba(255,255,255,0.86)"
                            : "#25262b",
                      },
                    ]}
                  >
                    Days
                  </Text>
                </View>
                <View style={styles.quickStatItem}>
                  <Ionicons name="pulse-outline" size={18} color={accentMutedTextColor} />
                  <Text style={[styles.quickStatValue, { color: accentMutedTextColor }]}>
                    {Math.round(baseStats.last_session)}%
                  </Text>
                  <Text
                    style={[
                      styles.quickStatLabel,
                      {
                        color:
                          accentMutedTextColor === "#ffffff"
                            ? "rgba(255,255,255,0.86)"
                            : "#25262b",
                      },
                    ]}
                  >
                    Last Session
                  </Text>
                </View>
                <View style={styles.quickStatItem}>
                  <Ionicons name="ribbon-outline" size={18} color={accentMutedTextColor} />
                  <Text style={[styles.quickStatValue, { color: accentMutedTextColor }]}>
                    {baseStats.total_badges}
                  </Text>
                  <Text
                    style={[
                      styles.quickStatLabel,
                      {
                        color:
                          accentMutedTextColor === "#ffffff"
                            ? "rgba(255,255,255,0.86)"
                            : "#25262b",
                      },
                    ]}
                  >
                    Badges
                  </Text>
                </View>
              </View>
            </View>

            <BunproActivityCard
              panelBackground={panelBackground}
              panelBorder={panelBorder}
              themeTextColor={theme.textColor}
              softText={softText}
              graphGridColor={graphGridColor}
              accent={accent}
              accentSoft={accentSoft}
              compactLayout={compactLayout}
              activityChartWidth={activityChartWidth}
              activityChartHeight={activityChartHeight}
              activityPoints={activityPoints}
              activityChart={activityChart}
              showActivityGrammar={showActivityGrammar}
              showActivityVocab={showActivityVocab}
              onToggleActivityGrammar={() =>
                setShowActivityGrammar((previous) => !previous)
              }
              onToggleActivityVocab={() => setShowActivityVocab((previous) => !previous)}
            />

            <BunproProgressCard
              panelBackground={panelBackground}
              panelBorder={panelBorder}
              themeTextColor={theme.textColor}
              graphGridColor={graphGridColor}
              isDark={isDark}
              compactLayout={compactLayout}
              accent={accent}
              progressMode={progressMode}
              onSetProgressMode={setProgressMode}
              activeSrsBuckets={activeSrsBuckets}
              srsStages={SRS_STAGES}
              stagePalette={stagePalette}
              dimmedStageColor={dimmedStageColor}
            />

            <BunproForecastCard
              panelBackground={panelBackground}
              panelBorder={panelBorder}
              themeTextColor={theme.textColor}
              softText={softText}
              accent={accent}
              accentMuted={accentMuted}
              accentSoft={accentSoft}
              isDark={isDark}
              compactLayout={compactLayout}
              forecastMode={forecastMode}
              onSetForecastMode={setForecastMode}
              showForecastGrammar={showForecastGrammar}
              showForecastVocab={showForecastVocab}
              onToggleForecastGrammar={() =>
                setShowForecastGrammar((previous) => !previous)
              }
              onToggleForecastVocab={() => setShowForecastVocab((previous) => !previous)}
              forecastPoints={forecastPoints}
            />

            <BunproJlptProgressCard
              panelBackground={panelBackground}
              panelBorder={panelBorder}
              themeTextColor={theme.textColor}
              softText={softText}
              compactLayout={compactLayout}
              accent={accent}
              isDark={isDark}
              jlptMode={jlptMode}
              onSetJlptMode={setJlptMode}
              jlptRows={jlptRows}
              stagePalette={stagePalette}
              srsStages={SRS_STAGES}
            />

            {lastUpdatedAt ? (
              <Text style={[styles.updatedAtText, { color: softText }]}> 
                Updated {new Date(lastUpdatedAt).toLocaleString()}
              </Text>
            ) : null}
          </>
        ) : null}

        <View
          style={[
            styles.connectionCard,
            { backgroundColor: panelBackground, borderColor: panelBorder },
          ]}
        >
          <View style={styles.connectionHeaderRow}>
            <View>
              <Text style={[styles.connectionTitle, { color: theme.textColor }]}>Bunpro Connection</Text>
              <Text style={[styles.connectionSubtitle, { color: softText }]}> 
                {hasStoredToken ? "Token is saved in SecureStore." : "Token needed for Bunpro frontend API."}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.connectionActionButton, { borderColor: panelBorder }]}
              onPress={() => setShowTokenEditor((previous) => !previous)}
            >
              <Text style={[styles.connectionActionLabel, { color: softText }]}> 
                {showTokenEditor ? "Hide" : "Manage"}
              </Text>
            </TouchableOpacity>
          </View>

          {showTokenEditor ? (
            <>
              <TextInput
                value={tokenInput}
                onChangeText={(value) => {
                  setTokenInput(value);
                  setTokenStatus(null);
                }}
                placeholder="Paste Bunpro API token"
                placeholderTextColor={theme.textLight}
                autoCapitalize="none"
                autoCorrect={false}
                spellCheck={false}
                secureTextEntry
                style={[
                  styles.tokenInput,
                  {
                    color: theme.textColor,
                    borderColor: panelBorder,
                    backgroundColor: isDark ? "#16191f" : "#f7f8fa",
                  },
                ]}
              />
              <View style={styles.tokenActions}>
                <TouchableOpacity
                  style={[
                    styles.tokenActionButton,
                    {
                      backgroundColor: accent,
                      opacity: isSavingToken ? 0.6 : 1,
                    },
                  ]}
                  disabled={isSavingToken || isLoadingToken}
                  onPress={() => {
                    void handleSaveToken();
                  }}
                >
                  <Text style={styles.tokenActionButtonText}>
                    {isSavingToken ? "Saving..." : "Save Token"}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.tokenActionButton,
                    {
                      backgroundColor: isDark ? "#2e323a" : "#e8eaee",
                      opacity: isSavingToken ? 0.6 : 1,
                    },
                  ]}
                  disabled={isSavingToken || isLoadingToken}
                  onPress={() => {
                    void handleRemoveToken();
                  }}
                >
                  <Text
                    style={[
                      styles.tokenActionButtonText,
                      { color: isDark ? "#f1f3f5" : "#24262b" },
                    ]}
                  >
                    Remove
                  </Text>
                </TouchableOpacity>
              </View>
              {tokenStatus ? (
                <Text
                  style={[
                    styles.tokenStatus,
                    { color: tokenStatus.isError ? theme.error : accent },
                  ]}
                >
                  {tokenStatus.message}
                </Text>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
  headerAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  headerAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
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
  },
  statText: {
    fontSize: 14,
    marginLeft: 4,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  headerXpTrack: {
    marginTop: 6,
    height: 7,
    borderRadius: 999,
    overflow: "hidden",
  },
  headerXpFill: {
    height: "100%",
    borderRadius: 999,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 14,
  },
  nativeTabsPadding: {
    paddingBottom: 120,
  },
  errorBanner: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 18,
  },
  loadingCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 30,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    textAlign: "center",
  },
  studyQueueCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  studyQueueRow: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 66,
  },
  studyQueueCopy: {
    flex: 1,
    paddingRight: 10,
  },
  studyQueueTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#18191d",
  },
  studyQueueSubtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: "#2a2b31",
  },
  studyQueueCount: {
    fontSize: 20,
    fontWeight: "700",
    color: "#18191d",
    flexShrink: 0,
  },
  reviewCountPill: {
    minWidth: 74,
    borderRadius: 20,
    backgroundColor: "#15161a",
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  reviewCountText: {
    fontSize: 18,
    fontWeight: "700",
  },
  studyQueueMeta: {
    fontSize: 12,
    textAlign: "center",
  },
  profileCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  profileHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackLabel: {
    fontSize: 21,
    fontWeight: "700",
    color: "#15161a",
  },
  profileHeaderTextContainer: {
    flex: 1,
  },
  profileName: {
    fontSize: 21,
    fontWeight: "700",
    lineHeight: 24,
  },
  profileLevel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
  },
  refreshMiniButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  xpTrack: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    borderRadius: 999,
  },
  xpMeta: {
    fontSize: 12,
  },
  streakPanel: {
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  streakTitle: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  streakDotsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  streakDotCell: {
    alignItems: "center",
    gap: 6,
    flex: 1,
  },
  streakDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  streakDotInner: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "rgba(255,255,255,0.46)",
  },
  streakDayLabel: {
    fontSize: 11,
  },
  quickStatsStrip: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  quickStatItem: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  quickStatValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#191a1f",
  },
  quickStatLabel: {
    fontSize: 11,
    color: "#25262b",
  },
  sectionCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    flexShrink: 1,
  },
  sectionTitleCompact: {
    fontSize: 16,
  },
  sectionMeta: {
    fontSize: 10,
    fontWeight: "500",
  },
  togglePill: {
    height: 32,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    width: 154,
    maxWidth: "100%",
    marginLeft: "auto",
  },
  togglePillMini: {
    height: 28,
    width: 128,
    borderRadius: 10,
  },
  togglePillCompact: {
    width: 136,
  },
  toggleButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  toggleLabelMini: {
    fontSize: 11,
  },
  toggleLabelCompact: {
    fontSize: 11,
  },
  seriesToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  seriesToggleMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seriesToggleButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  seriesToggleButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  seriesToggleText: {
    fontSize: 11,
    fontWeight: "600",
  },
  activityChartWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  activityLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -2,
  },
  activityDayLabel: {
    fontSize: 9,
    width: 14,
    textAlign: "center",
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  legendSwatch: {
    width: 24,
    height: 7,
    borderRadius: 999,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  progressGrid: {
    marginTop: 2,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  progressStageCard: {
    width: "48.5%",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 8,
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressStageLabel: {
    textTransform: "capitalize",
    fontSize: 12,
    color: "#1a1a1e",
  },
  progressStageCount: {
    marginTop: 1,
    fontSize: 18,
    fontWeight: "800",
    color: "#141519",
  },
  divider: {
    marginTop: 4,
    height: 1,
  },
  progressFooterRow: {
    marginTop: 6,
    flexDirection: "row",
    gap: 10,
  },
  progressFooterCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  progressFooterTitle: {
    fontSize: 12,
    color: "#1f1f24",
  },
  progressFooterCount: {
    fontSize: 17,
    fontWeight: "800",
    color: "#141519",
  },
  forecastScrollView: {
    marginTop: 2,
  },
  forecastScrollContent: {
    alignItems: "flex-end",
    paddingHorizontal: 4,
    gap: 8,
  },
  forecastBarCell: {
    width: 48,
    alignItems: "center",
    gap: 6,
  },
  forecastBarTopValue: {
    fontSize: 10,
    fontWeight: "500",
    minHeight: 14,
  },
  forecastBarTrack: {
    width: 34,
    height: 126,
    borderRadius: 8,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  forecastBarStack: {
    width: "100%",
    justifyContent: "flex-end",
    overflow: "hidden",
    borderRadius: 8,
  },
  forecastBarGrammar: {
    width: "100%",
  },
  forecastBarVocab: {
    width: "100%",
  },
  forecastBarLabel: {
    fontSize: 9,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 11,
  },
  jlptRowsContainer: {
    marginTop: 4,
    gap: 8,
  },
  jlptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  jlptLevelLabel: {
    width: 26,
    fontSize: 14,
    fontWeight: "700",
  },
  jlptTrack: {
    flex: 1,
    borderRadius: 6,
    height: 16,
    overflow: "hidden",
  },
  jlptSegmentsRow: {
    width: "100%",
    height: "100%",
    flexDirection: "row",
  },
  jlptCountLabel: {
    minWidth: 52,
    textAlign: "right",
    fontSize: 11,
    fontWeight: "600",
  },
  emptyLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  updatedAtText: {
    textAlign: "center",
    fontSize: 12,
    marginTop: 2,
    marginBottom: 4,
  },
  connectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  connectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  connectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  connectionSubtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  connectionActionButton: {
    borderWidth: 1,
    borderRadius: 9,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  connectionActionLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  tokenInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  tokenActions: {
    flexDirection: "row",
    gap: 10,
  },
  tokenActionButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tokenActionButtonText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  tokenStatus: {
    fontSize: 12,
  },
  gatedContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 26,
    gap: 8,
  },
  gatedTitle: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  gatedSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
