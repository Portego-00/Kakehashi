import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, FadeInDown, Layout } from "react-native-reanimated";
import {
  DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS,
  normalizeAnalyticsWidgetColor,
} from "../utils/analyticsWidgetStyles";
import {
  areLevelTimingExcludedLevelsEqual,
  loadLevelTimingExcludedLevels,
  normalizeLevelTimingExcludedLevels,
  saveLevelTimingExcludedLevels,
  subscribeLevelTimingExcludedLevels,
} from "../utils/levelTimingExclusions";
import { buildResetAwareLevelTimingData } from "../utils/levelProgress";
import { withAlpha } from "../utils/subjectColors";
import { useAuthStore, useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";

type LevelTimingData = {
  level: number;
  timeInDays: number;
  isComplete: boolean;
  isCurrent: boolean;
  startedAt: string | null;
  passedAt: string | null;
};

type ResetMarkerData = {
  level: number;
  confirmedAt: string | null;
};

type ChartRenderItem =
  | { type: "reset"; key: string; marker: ResetMarkerData }
  | { type: "level"; key: string; data: LevelTimingData };

type LevelTimingChartProps = {
  levelProgressions: any[];
  resets?: any[];
  currentLevel?: number;
};

// Convert numbers to Japanese kanji
const numberToJapanese = (num: number): string => {
  const japaneseNumbers: { [key: number]: string } = {
    1: "一",
    2: "二",
    3: "三",
    4: "四",
    5: "五",
    6: "六",
    7: "七",
    8: "八",
    9: "九",
    10: "十",
    11: "十一",
    12: "十二",
    13: "十三",
    14: "十四",
    15: "十五",
    16: "十六",
    17: "十七",
    18: "十八",
    19: "十九",
    20: "二十",
    21: "二十一",
    22: "二十二",
    23: "二十三",
    24: "二十四",
    25: "二十五",
    26: "二十六",
    27: "二十七",
    28: "二十八",
    29: "二十九",
    30: "三十",
    31: "三十一",
    32: "三十二",
    33: "三十三",
    34: "三十四",
    35: "三十五",
    36: "三十六",
    37: "三十七",
    38: "三十八",
    39: "三十九",
    40: "四十",
    41: "四十一",
    42: "四十二",
    43: "四十三",
    44: "四十四",
    45: "四十五",
    46: "四十六",
    47: "四十七",
    48: "四十八",
    49: "四十九",
    50: "五十",
    51: "五十一",
    52: "五十二",
    53: "五十三",
    54: "五十四",
    55: "五十五",
    56: "五十六",
    57: "五十七",
    58: "五十八",
    59: "五十九",
    60: "六十",
  };

  return japaneseNumbers[num] || num.toString();
};

/**
 * LevelTimingChart component displays a bar chart showing level completion times
 *
 * This component visualizes how long it took the user to complete each level
 * in WaniKani, showing completion times in days and providing statistics like
 * average completion time.
 *
 * Features:
 * - Bar chart showing completion time for each level
 * - Different colors for fast/average/slow completion times
 * - Statistics showing average, fastest, and slowest completion times
 * - Shows completed levels and current level (with different styling)
 * - Average line displayed across the chart
 * - Level numbers shown in Japanese kanji
 * - Responsive bar heights based on completion times
 *
 * @param props.levelProgressions - Array of level progression objects from WaniKani API
 * @param props.resets - Array of reset objects from WaniKani API
 * @param props.currentLevel - Current user level (optional)
 *
 * @example
 * <LevelTimingChart levelProgressions={dashboardData.levelProgressions} resets={dashboardData.resets} currentLevel={dashboardData.currentLevel} />
 */
export default function LevelTimingChart({
  levelProgressions,
  resets = [],
  currentLevel,
}: LevelTimingChartProps) {
  const { theme } = useTheme();
  const authUserId = useAuthStore((state) => state.userData?.id ?? null);
  const widgetLevelTimingFastColor = useSettingsStore(
    (state) => state.widgetLevelTimingFastColor,
  );
  const widgetLevelTimingAverageColor = useSettingsStore(
    (state) => state.widgetLevelTimingAverageColor,
  );
  const widgetLevelTimingSlowColor = useSettingsStore(
    (state) => state.widgetLevelTimingSlowColor,
  );
  const widgetLevelTimingCurrentColor = useSettingsStore(
    (state) => state.widgetLevelTimingCurrentColor,
  );
  const widgetLevelTimingResetColor = useSettingsStore(
    (state) => state.widgetLevelTimingResetColor,
  );
  const scrollViewRef = useRef<ScrollView>(null);
  const shouldPersistDisabledLevelsRef = useRef(false);
  const [disabledLevels, setDisabledLevels] = useState<number[]>([]);
  const [disabledLevelsHydrated, setDisabledLevelsHydrated] = useState(false);

  /* Responsive Layout Constants */
  const { width } = Dimensions.get("window");
  const isTablet = width > 768; // Standard breakpoint for tablets

  // Increase bar width for tablets to fill space better
  // Mobile: ~32px container, ~25px bar
  // Tablet: ~45px container, ~36px bar
  const BAR_CONTAINER_WIDTH = isTablet ? 45 : 32;
  const RESET_MARKER_WIDTH = isTablet ? 8 : 6;
  const BAR_WIDTH = isTablet ? 36 : "80%";
  const LABEL_FONT_size = isTablet ? 13 : 11;
  const VALUE_FONT_SIZE = isTablet ? 12 : 10;

  // Process level progressions to extract timing data
  const levelTimingData: LevelTimingData[] = useMemo(() => {
    return buildResetAwareLevelTimingData(
      levelProgressions,
      resets,
      currentLevel
    );
  }, [levelProgressions, currentLevel, resets]);

  const resetMarkers: ResetMarkerData[] = useMemo(() => {
    if (!Array.isArray(resets) || resets.length === 0 || levelTimingData.length === 0) {
      return [];
    }

    const visibleLevels = new Set(levelTimingData.map((entry) => entry.level));
    const latestResetByLevel = new Map<number, ResetMarkerData>();

    const toTimestamp = (value: string | null): number => {
      if (!value) return Number.NEGATIVE_INFINITY;
      const timestamp = Date.parse(value);
      return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
    };

    for (const row of resets) {
      const reset = row?.data ?? row;
      const targetLevel = Number(reset?.target_level);
      if (
        !Number.isFinite(targetLevel) ||
        targetLevel < 1 ||
        !visibleLevels.has(targetLevel)
      ) {
        continue;
      }

      const confirmedAt =
        typeof reset?.confirmed_at === "string" ? reset.confirmed_at : null;
      const existing = latestResetByLevel.get(targetLevel);
      if (!existing) {
        latestResetByLevel.set(targetLevel, {
          level: targetLevel,
          confirmedAt,
        });
        continue;
      }

      if (toTimestamp(confirmedAt) > toTimestamp(existing.confirmedAt)) {
        latestResetByLevel.set(targetLevel, {
          level: targetLevel,
          confirmedAt,
        });
      }
    }

    return Array.from(latestResetByLevel.values()).sort(
      (a, b) => a.level - b.level
    );
  }, [resets, levelTimingData]);

  useEffect(() => {
    let isCancelled = false;
    setDisabledLevelsHydrated(false);
    shouldPersistDisabledLevelsRef.current = false;

    const loadDisabledLevels = async () => {
      try {
        const levels = await loadLevelTimingExcludedLevels(authUserId);
        if (isCancelled) {
          return;
        }

        setDisabledLevels(levels);
      } catch (error) {
        console.warn("Failed to load level timing excluded levels", error);
        if (!isCancelled) {
          setDisabledLevels([]);
        }
      } finally {
        if (!isCancelled) {
          setDisabledLevelsHydrated(true);
        }
      }
    };

    loadDisabledLevels();

    return () => {
      isCancelled = true;
    };
  }, [authUserId]);

  useEffect(() => {
    if (!disabledLevelsHydrated || !shouldPersistDisabledLevelsRef.current) {
      return;
    }

    shouldPersistDisabledLevelsRef.current = false;
    saveLevelTimingExcludedLevels(authUserId, disabledLevels).catch((error) => {
      console.warn("Failed to save level timing excluded levels", error);
    });
  }, [authUserId, disabledLevels, disabledLevelsHydrated]);

  useEffect(() => {
    const unsubscribe = subscribeLevelTimingExcludedLevels(
      (changedUserId, levels) => {
        if ((changedUserId ?? "anonymous") !== (authUserId ?? "anonymous")) {
          return;
        }

        setDisabledLevels((current) =>
          areLevelTimingExcludedLevelsEqual(current, levels)
            ? current
            : normalizeLevelTimingExcludedLevels(levels)
        );
      }
    );

    return unsubscribe;
  }, [authUserId]);

  const toggleableCompletedLevelSet = useMemo(() => {
    const levels = new Set<number>();
    for (const entry of levelTimingData) {
      if (entry.isComplete && !entry.isCurrent) {
        levels.add(entry.level);
      }
    }
    return levels;
  }, [levelTimingData]);

  const activeDisabledLevels = useMemo(
    () => (disabledLevelsHydrated ? disabledLevels : []),
    [disabledLevels, disabledLevelsHydrated],
  );

  const excludedCompletedLevelSet = useMemo(() => {
    const levels = new Set<number>();
    for (const level of activeDisabledLevels) {
      if (toggleableCompletedLevelSet.has(level)) {
        levels.add(level);
      }
    }
    return levels;
  }, [activeDisabledLevels, toggleableCompletedLevelSet]);

  const toggleLevelExclusion = useCallback(
    (level: number) => {
      if (!disabledLevelsHydrated || !toggleableCompletedLevelSet.has(level)) {
        return;
      }

      shouldPersistDisabledLevelsRef.current = true;
      setDisabledLevels((current) => {
        if (current.includes(level)) {
          return current.filter((item) => item !== level);
        }

        return [...current, level].sort((a, b) => a - b);
      });
    },
    [disabledLevelsHydrated, toggleableCompletedLevelSet],
  );

  const chartRenderItems: ChartRenderItem[] = useMemo(() => {
    if (levelTimingData.length === 0) return [];

    const resetByLevel = new Map<number, ResetMarkerData>();
    for (const marker of resetMarkers) {
      resetByLevel.set(marker.level, marker);
    }

    const items: ChartRenderItem[] = [];
    for (const levelData of levelTimingData) {
      const marker = resetByLevel.get(levelData.level);
      if (marker) {
        items.push({
          type: "reset",
          key: `reset-${marker.level}-${marker.confirmedAt ?? "unknown"}`,
          marker,
        });
      }

      items.push({
        type: "level",
        key: `level-${levelData.level}`,
        data: levelData,
      });
    }

    return items;
  }, [levelTimingData, resetMarkers]);

  // Calculate statistics (only from completed levels, excluding current level)
  const statistics = useMemo(() => {
    const completedLevels = levelTimingData.filter(
      (d) => d.isComplete && !excludedCompletedLevelSet.has(d.level),
    );

    if (completedLevels.length === 0) {
      return { average: 0, fastest: 0, slowest: 0, median: 0, sampleSize: 0 };
    }

    const times = completedLevels.map((d) => d.timeInDays);
    const sum = times.reduce((acc, time) => acc + time, 0);
    const average = sum / times.length;
    const fastest = Math.min(...times);
    const slowest = Math.max(...times);

    // Calculate median
    const sortedTimes = [...times].sort((a, b) => a - b);
    const mid = Math.floor(sortedTimes.length / 2);
    const median =
      sortedTimes.length % 2 !== 0
        ? sortedTimes[mid]
        : (sortedTimes[mid - 1] + sortedTimes[mid]) / 2;

    return {
      average,
      fastest,
      slowest,
      median,
      sampleSize: completedLevels.length,
    };
  }, [excludedCompletedLevelSet, levelTimingData]);

  const hasIncludedCompletedLevels = statistics.sampleSize > 0;
  const disabledBarColor = useMemo(
    () => withAlpha(theme.textSecondary, theme.isDark ? 0.38 : 0.5),
    [theme.isDark, theme.textSecondary],
  );

  const timingColors = useMemo(
    () => ({
      fast: normalizeAnalyticsWidgetColor(
        widgetLevelTimingFastColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetLevelTimingFastColor,
      ),
      average: normalizeAnalyticsWidgetColor(
        widgetLevelTimingAverageColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetLevelTimingAverageColor,
      ),
      slow: normalizeAnalyticsWidgetColor(
        widgetLevelTimingSlowColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetLevelTimingSlowColor,
      ),
      current: normalizeAnalyticsWidgetColor(
        widgetLevelTimingCurrentColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetLevelTimingCurrentColor,
      ),
      reset: normalizeAnalyticsWidgetColor(
        widgetLevelTimingResetColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetLevelTimingResetColor,
      ),
    }),
    [
      widgetLevelTimingAverageColor,
      widgetLevelTimingCurrentColor,
      widgetLevelTimingFastColor,
      widgetLevelTimingResetColor,
      widgetLevelTimingSlowColor,
    ],
  );

  // Determine bar color based on completion time relative to average
  const getBarColor = (data: LevelTimingData): string => {
    if (data.isComplete && excludedCompletedLevelSet.has(data.level)) {
      return disabledBarColor;
    }

    if (data.isCurrent) {
      return timingColors.current;
    }

    if (!hasIncludedCompletedLevels) {
      return timingColors.average;
    }

    const { average } = statistics;
    if (data.timeInDays <= average * 0.7) {
      return timingColors.fast;
    } else if (data.timeInDays <= average * 1.3) {
      return timingColors.average;
    } else {
      return timingColors.slow;
    }
  };

  const maxTime = Math.max(
    ...levelTimingData.map((d) => d.timeInDays),
    hasIncludedCompletedLevels ? statistics.average : 1,
    1
  );

  // Auto-scroll to the end (rightmost position) when data loads
  useEffect(() => {
    if (levelTimingData.length > 0 && scrollViewRef.current) {
      // Small delay to ensure the ScrollView has rendered
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [levelTimingData]);

  if (levelTimingData.length === 0) {
    return (
      <Animated.View
        layout={Layout.duration(200).easing(Easing.ease)}
        style={[
          styles.container,
          {
            backgroundColor: theme.cardBackground,
            shadowColor: theme.isDark ? "#000" : "#000",
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.textColor }]}>
            Level Timing
          </Text>
        </View>
        <Text style={[styles.noDataText, { color: theme.textSecondary }]}>
          No level data found. Start your first level to see timing data!
        </Text>
      </Animated.View>
    );
  }

  // Calculate average line position
  const averageLineHeight =
    statistics.average > 0 ? (statistics.average / maxTime) * 120 : 0;

  return (
    <Animated.View
      layout={Layout.duration(200).easing(Easing.ease)}
      style={[
        styles.container,
        {
          backgroundColor: theme.cardBackground,
          shadowColor: theme.isDark ? "#000" : "#000",
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textColor }]}>
          Level Timing
        </Text>
        <View style={styles.statsContainer}>
          <Ionicons name="time" size={16} color={theme.textSecondary} />
          <Text style={[styles.statsText, { color: theme.textSecondary }]}>
            Avg:{" "}
            {hasIncludedCompletedLevels ? `${statistics.average.toFixed(1)}d` : "—"}
          </Text>
        </View>
      </View>

      {/* Statistics Row */}
      <View style={styles.statisticsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: timingColors.fast }]}>
            {hasIncludedCompletedLevels ? `${statistics.fastest.toFixed(1)}d` : "—"}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Fastest
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: theme.primary }]}>
            {hasIncludedCompletedLevels ? `${statistics.median.toFixed(1)}d` : "—"}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Median
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: timingColors.slow }]}>
            {hasIncludedCompletedLevels ? `${statistics.slowest.toFixed(1)}d` : "—"}
          </Text>
          <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
            Slowest
          </Text>
        </View>
      </View>

      {/* Bar Chart */}
      <View style={styles.chartContainer}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chartScrollView}
          contentContainerStyle={styles.chartBars}
        >
          {/* Average line */}
          {hasIncludedCompletedLevels && (
            <View
              style={[
                styles.averageLine,
                {
                  bottom: averageLineHeight + 24, // 24 accounts for label space
                  borderTopWidth: 2,
                  borderTopColor: theme.isDark ? "#444444" : "#DDDDDD",
                  borderStyle: "dashed",
                },
              ]}
            >
              <View
                style={[
                  styles.averageLineLabel,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Text
                  style={[
                    styles.averageLineLabelText,
                    { color: theme.textSecondary },
                  ]}
                >
                  Avg {statistics.average.toFixed(1)}d
                </Text>
              </View>
            </View>
          )}

          {chartRenderItems.map((item, index) => {
            if (item.type === "reset") {
              return (
                <Animated.View
                  key={item.key}
                  entering={FadeInDown.delay(index * 50).duration(300)}
                  style={[
                    styles.chartBarContainer,
                    { width: RESET_MARKER_WIDTH },
                  ]}
                >
                  <Text
                    style={[
                      styles.chartBarValue,
                      {
                        color: theme.textSecondary,
                        fontSize: VALUE_FONT_SIZE,
                      },
                    ]}
                  />
                  <View
                    style={[
                      styles.resetMarker,
                      {
                        height: 120,
                        backgroundColor: timingColors.reset,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.chartBarLabel,
                      {
                        color: theme.textSecondary,
                        fontSize: LABEL_FONT_size,
                      },
                    ]}
                  />
                </Animated.View>
              );
            }

            const levelData = item.data;
            const barHeight = Math.max((levelData.timeInDays / maxTime) * 120, 8);
            const barColor = getBarColor(levelData);
            const isExcluded = excludedCompletedLevelSet.has(levelData.level);
            const isToggleable =
              disabledLevelsHydrated && levelData.isComplete && !levelData.isCurrent;

            return (
              <Animated.View
                key={item.key}
                entering={FadeInDown.delay(index * 50).duration(300)}
                style={[
                  styles.chartBarContainer,
                  { width: BAR_CONTAINER_WIDTH },
                ]}
              >
                <Pressable
                  onPress={() => toggleLevelExclusion(levelData.level)}
                  disabled={!isToggleable}
                  hitSlop={6}
                  style={({ pressed }) => [
                    styles.levelBarPressable,
                    pressed && isToggleable && styles.levelBarPressablePressed,
                  ]}
                  accessibilityRole={isToggleable ? "button" : undefined}
                  accessibilityState={
                    isToggleable ? { selected: isExcluded } : undefined
                  }
                  accessibilityLabel={
                    isToggleable
                      ? `Level ${levelData.level}, ${isExcluded ? "excluded" : "included"} in averages`
                      : `Level ${levelData.level}`
                  }
                >
                  <Text
                    style={[
                      styles.chartBarValue,
                      {
                        color: isExcluded ? theme.textLight : theme.textSecondary,
                        fontSize: VALUE_FONT_SIZE,
                      },
                    ]}
                  >
                    {levelData.timeInDays < 10
                      ? levelData.timeInDays.toFixed(1)
                      : Math.round(levelData.timeInDays).toString()}
                    {levelData.isCurrent && "+"}
                  </Text>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: barHeight,
                        backgroundColor: barColor,
                        opacity: levelData.isCurrent ? 0.7 : 1,
                        width: BAR_WIDTH,
                        borderWidth: isExcluded ? 1 : 0,
                        borderColor: isExcluded
                          ? withAlpha(theme.textSecondary, theme.isDark ? 0.42 : 0.3)
                          : "transparent",
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.chartBarLabel,
                      {
                        color: levelData.isCurrent
                          ? theme.primary
                          : isExcluded
                            ? theme.textLight
                            : theme.textSecondary,
                        fontWeight: levelData.isCurrent
                          ? "bold"
                          : isExcluded
                            ? "600"
                            : "normal",
                        fontSize: LABEL_FONT_size,
                        textDecorationLine: isExcluded ? "line-through" : "none",
                      },
                    ]}
                  >
                    {numberToJapanese(levelData.level)}
                  </Text>
                </Pressable>
              </Animated.View>
            );
          })}
        </ScrollView>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: timingColors.fast }]} />
          <Text style={[styles.legendText, { color: theme.textSecondary }]}>
            Fast
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[styles.legendColor, { backgroundColor: timingColors.average }]}
          />
          <Text style={[styles.legendText, { color: theme.textSecondary }]}>
            Average
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: timingColors.slow }]} />
          <Text style={[styles.legendText, { color: theme.textSecondary }]}>
            Slow
          </Text>
        </View>
        <View style={styles.legendItem}>
          <View
            style={[
              styles.legendColor,
              { backgroundColor: timingColors.current },
            ]}
          />
          <Text style={[styles.legendText, { color: theme.textSecondary }]}>
            Current
          </Text>
        </View>
        {resetMarkers.length > 0 && (
          <View style={styles.legendItem}>
            <View
              style={[
                styles.legendColor,
                { backgroundColor: timingColors.reset },
              ]}
            />
            <Text style={[styles.legendText, { color: theme.textSecondary }]}>
              Reset
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 4,
    elevation: 2,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
  },
  statsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statsText: {
    fontSize: 14,
    fontWeight: "500",
  },
  statisticsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  chartContainer: {
    position: "relative",
    height: 160,
    marginBottom: 16,
  },
  chartScrollView: {
    height: 160,
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    minWidth: "100%",
  },
  chartBarContainer: {
    alignItems: "center",
    marginHorizontal: 2,
  },
  levelBarPressable: {
    alignItems: "center",
    width: "100%",
  },
  levelBarPressablePressed: {
    opacity: 0.72,
  },
  chartBarValue: {
    fontSize: 10,
    marginBottom: 4,
    height: 12,
    fontWeight: "500",
  },
  chartBar: {
    borderRadius: 2,
    minHeight: 8,
  },
  resetMarker: {
    width: "100%",
    borderRadius: 2,
    minHeight: 8,
    overflow: "hidden",
  },
  chartBarLabel: {
    fontSize: 11,
    marginTop: 4,
    textAlign: "center",
    fontWeight: "500",
  },
  averageLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 1,
    zIndex: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  averageLineLabel: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 8,
  },
  averageLineLabelText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
  },
  noDataText: {
    textAlign: "center",
    fontSize: 14,
    fontStyle: "italic",
    paddingVertical: 20,
  },
});
