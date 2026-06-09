import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, { Easing, Layout } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import {
  DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS,
  normalizeAnalyticsWidgetColor,
} from "../utils/analyticsWidgetStyles";
import { useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SwiftUI = Platform.OS === "ios" ? require("@expo/ui/swift-ui") : null;

type ReviewStats = {
  id: number;
  data_updated_at?: string;
  data: {
    subject_id?: number;
    subject_type: "radical" | "kanji" | "vocabulary" | "kana_vocabulary";
    meaning_correct: number;
    meaning_incorrect: number;
    reading_correct: number;
    reading_incorrect: number;
    percentage_correct: number;
    hidden: boolean;
  };
};

type Subject = {
  id: number;
  data?: {
    level?: number;
  };
};

type ReviewStatsTableProps = {
  reviewStats: ReviewStats[];
  subjects?: Subject[];
  currentLevel?: number | null;
};

type ProcessedStats = {
  totalReviews: {
    meaning: number;
    reading: number;
    total: number;
  };
  correctReviews: {
    meaning: number;
    reading: number;
    total: number;
  };
  overallAccuracy: {
    meaning: number;
    reading: number;
    total: number;
  };
};

const SpeedometerChart = ({
  percentage,
  color,
  size = 60,
  strokeWidth = 6,
  backgroundColor,
  id,
}: {
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  backgroundColor: string;
  id: string;
}) => {
  // Config
  const numSegments = 20;
  const startAngle = 250; // Start at bottom-left
  const endAngle = 470; // End at bottom-right (Total 220 degrees)
  const totalAngle = endAngle - startAngle;
  const gap = 4; // Gap between segments in degrees

  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  // Helper to calculate coordinates
  const polarToCartesian = (
    centerX: number,
    centerY: number,
    radius: number,
    angleInDegrees: number
  ) => {
    const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
    return {
      x: centerX + radius * Math.cos(angleInRadians),
      y: centerY + radius * Math.sin(angleInRadians),
    };
  };

  // Helper to create a single segment path
  const describeSegment = (
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number
  ) => {
    const start = polarToCartesian(x, y, radius, endAngle);
    const end = polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
    return [
      "M",
      start.x,
      start.y,
      "A",
      radius,
      radius,
      0,
      largeArcFlag,
      0,
      end.x,
      end.y,
    ].join(" ");
  };

  // Generate segments
  const segments = [];
  const segmentAngle = (totalAngle - (numSegments - 1) * gap) / numSegments;

  for (let i = 0; i < numSegments; i++) {
    const segmentStart = startAngle + i * (segmentAngle + gap);
    const segmentEnd = segmentStart + segmentAngle;

    const activeData = i < (percentage / 100) * numSegments;

    segments.push(
      <Path
        key={i}
        d={describeSegment(center, center, radius, segmentStart, segmentEnd)}
        stroke={activeData ? color : backgroundColor}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="butt"
        strokeOpacity={activeData ? 1 : 0.3}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size * 0.85,
        alignItems: "center",
        justifyContent: "flex-start",
      }}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments}
      </Svg>
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            alignItems: "center",
            justifyContent: "center",
            paddingTop: size * 0.15,
          },
        ]}
      >
        <Text
          style={{
            fontSize: size * 0.22,
            fontWeight: "800",
            color,
            lineHeight: size * 0.28,
          }}
        >
          {percentage.toFixed(0)}
          <Text style={{ fontSize: size * 0.14 }}>%</Text>
        </Text>
      </View>
    </View>
  );
};

export default function ReviewStatsTable({
  reviewStats,
  subjects = [],
  currentLevel = null,
}: ReviewStatsTableProps) {
  const { theme } = useTheme();
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [showLevelPickerModal, setShowLevelPickerModal] = useState(false);
  const [draftLevelValue, setDraftLevelValue] = useState(0);

  const widgetReviewStatsExcellentColor = useSettingsStore(
    (state) => state.widgetReviewStatsExcellentColor,
  );
  const widgetReviewStatsGoodColor = useSettingsStore(
    (state) => state.widgetReviewStatsGoodColor,
  );
  const widgetReviewStatsWarningColor = useSettingsStore(
    (state) => state.widgetReviewStatsWarningColor,
  );
  const widgetReviewStatsPoorColor = useSettingsStore(
    (state) => state.widgetReviewStatsPoorColor,
  );
  const widgetReviewStatsBadColor = useSettingsStore(
    (state) => state.widgetReviewStatsBadColor,
  );
  const widgetReviewStatsMeaningAccentColor = useSettingsStore(
    (state) => state.widgetReviewStatsMeaningAccentColor,
  );
  const widgetReviewStatsReadingAccentColor = useSettingsStore(
    (state) => state.widgetReviewStatsReadingAccentColor,
  );
  const widgetReviewStatsTotalAccentColor = useSettingsStore(
    (state) => state.widgetReviewStatsTotalAccentColor,
  );

  const subjectLevelMap = useMemo(() => {
    const levelMap = new Map<number, number>();
    subjects.forEach((subject) => {
      const level = subject?.data?.level;
      if (typeof level === "number") {
        levelMap.set(subject.id, level);
      }
    });
    return levelMap;
  }, [subjects]);

  const availableLevels = useMemo(() => {
    const parsedCurrentLevel =
      currentLevel === null || currentLevel === undefined
        ? Number.NaN
        : Number(currentLevel);
    const normalizedCurrentLevel =
      Number.isFinite(parsedCurrentLevel) && parsedCurrentLevel > 0
        ? Math.floor(parsedCurrentLevel)
        : null;

    // Preferred source: always show every level up to current level.
    if (normalizedCurrentLevel !== null) {
      const levels = Array.from(
        { length: normalizedCurrentLevel },
        (_, index) => index + 1
      );
      return levels;
    }

    // Fallback for edge cases where current level is unavailable.
    const levelsFromStats = new Set<number>();
    reviewStats.forEach((stat) => {
      const subjectId = stat.data.subject_id;
      if (typeof subjectId !== "number") return;
      const level = subjectLevelMap.get(subjectId);
      if (typeof level === "number") {
        levelsFromStats.add(level);
      }
    });
    if (levelsFromStats.size > 0) {
      return Array.from(levelsFromStats).sort((a, b) => a - b);
    }

    const fallbackLevels = new Set<number>();
    subjectLevelMap.forEach((level) => fallbackLevels.add(level));
    return Array.from(fallbackLevels).sort((a, b) => a - b);
  }, [currentLevel, reviewStats, subjectLevelMap]);

  useEffect(() => {
    if (
      selectedLevel !== null &&
      !availableLevels.some((level) => level === selectedLevel)
    ) {
      setSelectedLevel(null);
    }
  }, [availableLevels, selectedLevel]);

  const openLevelPickerFallback = () => {
    setDraftLevelValue(selectedLevel ?? 0);
    setShowLevelPickerModal(true);
  };

  const handleLevelButtonPress = () => {
    openLevelPickerFallback();
  };

  const applyDraftLevel = () => {
    setSelectedLevel(draftLevelValue === 0 ? null : draftLevelValue);
    setShowLevelPickerModal(false);
  };

  const filteredReviewStats = useMemo(() => {
    if (!reviewStats || reviewStats.length === 0) {
      return [];
    }
    if (selectedLevel === null) {
      return reviewStats;
    }

    return reviewStats.filter((stat) => {
      const subjectId = stat.data.subject_id;
      if (typeof subjectId !== "number") return false;
      return subjectLevelMap.get(subjectId) === selectedLevel;
    });
  }, [reviewStats, selectedLevel, subjectLevelMap]);

  const subtitleText = useMemo(
    () =>
      selectedLevel === null
        ? "Lifetime Statistics"
        : `Level ${selectedLevel} Subjects`,
    [selectedLevel]
  );

  // Process review statistics
  const processedStats: ProcessedStats = useMemo(() => {
    if (!filteredReviewStats || filteredReviewStats.length === 0) {
      return {
        totalReviews: { meaning: 0, reading: 0, total: 0 },
        correctReviews: { meaning: 0, reading: 0, total: 0 },
        overallAccuracy: { meaning: 0, reading: 0, total: 0 },
      };
    }

    const stats = {
      totalReviews: { meaning: 0, reading: 0, total: 0 },
      correctReviews: { meaning: 0, reading: 0, total: 0 },
      incorrectReviews: { meaning: 0, reading: 0, total: 0 },
    };

    filteredReviewStats.forEach((stat) => {
      // Logic from wkstats: exclude hidden items
      if (stat.data.hidden) return;

      const meaningCorrect = stat.data.meaning_correct;
      const meaningIncorrect = stat.data.meaning_incorrect;
      const readingCorrect = stat.data.reading_correct;
      const readingIncorrect = stat.data.reading_incorrect;
      const subjectType = stat.data.subject_type;

      // Meaning totals
      stats.totalReviews.meaning += meaningCorrect + meaningIncorrect;
      stats.correctReviews.meaning += meaningCorrect;
      stats.incorrectReviews.meaning += meaningIncorrect;

      // Reading totals - exclude Radicals and Kana Vocab
      if (subjectType !== "radical" && subjectType !== "kana_vocabulary") {
        stats.totalReviews.reading += readingCorrect + readingIncorrect;
        stats.correctReviews.reading += readingCorrect;
        stats.incorrectReviews.reading += readingIncorrect;
      }
    });

    const totalReviews =
      stats.totalReviews.meaning + stats.totalReviews.reading;
    const totalCorrect =
      stats.correctReviews.meaning + stats.correctReviews.reading;

    return {
      totalReviews: {
        ...stats.totalReviews,
        total: totalReviews,
      },
      correctReviews: {
        ...stats.correctReviews,
        total: totalCorrect,
      },
      overallAccuracy: {
        meaning:
          stats.totalReviews.meaning > 0
            ? (stats.correctReviews.meaning / stats.totalReviews.meaning) * 100
            : 0,
        reading:
          stats.totalReviews.reading > 0
            ? (stats.correctReviews.reading / stats.totalReviews.reading) * 100
            : 0,
        total: totalReviews > 0 ? (totalCorrect / totalReviews) * 100 : 0,
      },
    };
  }, [filteredReviewStats]);

  const statsColors = useMemo(
    () => ({
      excellent: normalizeAnalyticsWidgetColor(
        widgetReviewStatsExcellentColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsExcellentColor,
      ),
      good: normalizeAnalyticsWidgetColor(
        widgetReviewStatsGoodColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsGoodColor,
      ),
      warning: normalizeAnalyticsWidgetColor(
        widgetReviewStatsWarningColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsWarningColor,
      ),
      poor: normalizeAnalyticsWidgetColor(
        widgetReviewStatsPoorColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsPoorColor,
      ),
      bad: normalizeAnalyticsWidgetColor(
        widgetReviewStatsBadColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsBadColor,
      ),
      meaning: normalizeAnalyticsWidgetColor(
        widgetReviewStatsMeaningAccentColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsMeaningAccentColor,
      ),
      reading: normalizeAnalyticsWidgetColor(
        widgetReviewStatsReadingAccentColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsReadingAccentColor,
      ),
      total: normalizeAnalyticsWidgetColor(
        widgetReviewStatsTotalAccentColor,
        DEFAULT_ANALYTICS_WIDGET_STYLE_COLORS.widgetReviewStatsTotalAccentColor,
      ),
    }),
    [
      widgetReviewStatsBadColor,
      widgetReviewStatsExcellentColor,
      widgetReviewStatsGoodColor,
      widgetReviewStatsMeaningAccentColor,
      widgetReviewStatsPoorColor,
      widgetReviewStatsReadingAccentColor,
      widgetReviewStatsTotalAccentColor,
      widgetReviewStatsWarningColor,
    ],
  );

  const getAccuracyColor = (accuracy: number): string => {
    // Return different colors for chart gradients
    if (accuracy >= 95) return statsColors.excellent;
    if (accuracy >= 90) return statsColors.good;
    if (accuracy >= 80) return statsColors.warning;
    if (accuracy >= 70) return statsColors.poor;
    return statsColors.bad;
  };

  if (!reviewStats || reviewStats.length === 0) {
    return (
      <Animated.View
        layout={Layout.duration(200).easing(Easing.ease)}
        style={[styles.container, { backgroundColor: theme.cardBackground }]}
      >
        <Text style={[styles.noDataText, { color: theme.textSecondary }]}>
          No review data found. Complete some reviews to see statistics!
        </Text>
      </Animated.View>
    );
  }

  return (
    <Animated.View
      layout={Layout.duration(400).easing(Easing.out(Easing.cubic))}
      style={[styles.container, { backgroundColor: theme.cardBackground }]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: theme.textColor }]}>
            Review Stats
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {subtitleText}
          </Text>
        </View>
        <View style={styles.headerRight}>
          {Platform.OS === "ios" && SwiftUI ? (
            <SwiftUI.Host matchContents>
              <SwiftUI.Menu
                label={
                  <SwiftUI.RNHostView matchContents>
                    <View style={styles.levelMenuButton}>
                      <Ionicons
                        name="layers-outline"
                        size={18}
                        color={theme.textColor}
                      />
                    </View>
                  </SwiftUI.RNHostView>
                }
              >
                <SwiftUI.Button
                  label="All Levels"
                  systemImage={
                    selectedLevel === null ? "checkmark.circle.fill" : "circle"
                  }
                  onPress={() => setSelectedLevel(null)}
                />
                {availableLevels.map((level) => (
                  <SwiftUI.Button
                    key={`level-menu-${level}`}
                    label={`Level ${level}`}
                    systemImage={
                      selectedLevel === level ? "checkmark.circle.fill" : "circle"
                    }
                    onPress={() => setSelectedLevel(level)}
                  />
                ))}
              </SwiftUI.Menu>
            </SwiftUI.Host>
          ) : (
            <TouchableOpacity
              style={styles.levelMenuButton}
              onPress={handleLevelButtonPress}
              activeOpacity={0.75}
            >
              <Ionicons name="layers-outline" size={18} color={theme.textColor} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {filteredReviewStats.length === 0 ? (
        <Text style={[styles.emptyWindowText, { color: theme.textSecondary }]}>
          {selectedLevel === null
            ? "No review data found."
            : `No review data found for Level ${selectedLevel}.`}
        </Text>
      ) : null}

      <View style={styles.cardsContainer}>
        {/* Meaning Card */}
        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.isDark ? "#1a1e24" : "#f8f9fa" },
          ]}
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${statsColors.meaning}20` },
            ]}
          >
            <Ionicons name="book-outline" size={16} color={statsColors.meaning} />
          </View>

          <SpeedometerChart
            id="meaning"
            percentage={processedStats.overallAccuracy.meaning}
            color={getAccuracyColor(processedStats.overallAccuracy.meaning)}
            backgroundColor={theme.isDark ? "#2d333b" : "#e1e4e8"}
            size={80}
            strokeWidth={8}
          />

          <View style={styles.cardFooter}>
            <Text style={[styles.cardTitle, { color: theme.textColor }]}>
              Meaning
            </Text>
            <Text style={[styles.cardValue, { color: theme.textSecondary }]}>
              {processedStats.totalReviews.meaning.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Reading Card */}
        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.isDark ? "#1a1e24" : "#f8f9fa" },
          ]}
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${statsColors.reading}20` },
            ]}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={16}
              color={statsColors.reading}
            />
          </View>

          <SpeedometerChart
            id="reading"
            percentage={processedStats.overallAccuracy.reading}
            color={getAccuracyColor(processedStats.overallAccuracy.reading)}
            backgroundColor={theme.isDark ? "#2d333b" : "#e1e4e8"}
            size={80}
            strokeWidth={8}
          />

          <View style={styles.cardFooter}>
            <Text style={[styles.cardTitle, { color: theme.textColor }]}>
              Reading
            </Text>
            <Text style={[styles.cardValue, { color: theme.textSecondary }]}>
              {processedStats.totalReviews.reading.toLocaleString()}
            </Text>
          </View>
        </View>

        {/* Total Card */}
        <View
          style={[
            styles.statCard,
            { backgroundColor: theme.isDark ? "#1a1e24" : "#f8f9fa" },
          ]}
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${statsColors.total}20` },
            ]}
          >
            <Ionicons
              name="stats-chart-outline"
              size={16}
              color={statsColors.total}
            />
          </View>

          <SpeedometerChart
            id="total"
            percentage={processedStats.overallAccuracy.total}
            color={getAccuracyColor(processedStats.overallAccuracy.total)}
            backgroundColor={theme.isDark ? "#2d333b" : "#e1e4e8"}
            size={80}
            strokeWidth={8}
          />

          <View style={styles.cardFooter}>
            <Text style={[styles.cardTitle, { color: theme.textColor }]}>
              Total
            </Text>
            <Text style={[styles.cardValue, { color: theme.textSecondary }]}>
              {processedStats.totalReviews.total.toLocaleString()}
            </Text>
          </View>
        </View>
      </View>

      <Modal
        visible={showLevelPickerModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowLevelPickerModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowLevelPickerModal(false)}>
          <View style={styles.pickerModalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.pickerModalContent,
                  { backgroundColor: theme.cardBackground, borderColor: theme.border },
                ]}
              >
                <View style={styles.pickerModalHeader}>
                  <TouchableOpacity onPress={() => setShowLevelPickerModal(false)}>
                    <Text style={[styles.pickerCancelText, { color: theme.textSecondary }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <Text style={[styles.pickerModalTitle, { color: theme.textColor }]}>
                    Select Level
                  </Text>
                  <TouchableOpacity onPress={applyDraftLevel}>
                    <Text style={[styles.pickerDoneText, { color: theme.primary }]}>
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.levelList} contentContainerStyle={styles.levelListContent}>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    style={[
                      styles.levelListItem,
                      draftLevelValue === 0 && {
                        borderColor: theme.primary,
                        backgroundColor: `${theme.primary}1A`,
                      },
                    ]}
                    onPress={() => setDraftLevelValue(0)}
                  >
                    <Text
                      style={[
                        styles.levelListItemText,
                        {
                          color: draftLevelValue === 0 ? theme.primary : theme.textColor,
                          fontWeight: draftLevelValue === 0 ? "700" : "500",
                        },
                      ]}
                    >
                      All Levels
                    </Text>
                    {draftLevelValue === 0 ? (
                      <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                    ) : null}
                  </TouchableOpacity>
                  {availableLevels.map((level) => {
                    const isSelected = draftLevelValue === level;
                    return (
                      <TouchableOpacity
                        key={level}
                        activeOpacity={0.75}
                        style={[
                          styles.levelListItem,
                          isSelected && {
                            borderColor: theme.primary,
                            backgroundColor: `${theme.primary}1A`,
                          },
                        ]}
                        onPress={() => setDraftLevelValue(level)}
                      >
                        <Text
                          style={[
                            styles.levelListItemText,
                            {
                              color: isSelected ? theme.primary : theme.textColor,
                              fontWeight: isSelected ? "700" : "500",
                            },
                          ]}
                        >
                          Level {level}
                        </Text>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    marginHorizontal: 4,
    // Soft shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  levelMenuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(127,127,127,0.32)",
    backgroundColor: "rgba(127,127,127,0.08)",
    zIndex: 2,
  },
  emptyWindowText: {
    fontSize: 12,
    marginBottom: 16,
  },
  totalBadge: {
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  totalValue: {
    fontSize: 15,
    fontWeight: "800",
  },
  totalLabel: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cardsContainer: {
    flexDirection: "row",
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    alignItems: "center",
    position: "relative",
    paddingTop: 40,
  },
  iconContainer: {
    position: "absolute",
    top: 12,
    left: 12,
    width: 24,
    height: 24,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  cardFooter: {
    alignItems: "center",
    marginTop: -4,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  cardValue: {
    fontSize: 12,
    fontWeight: "500",
  },
  noDataText: {
    textAlign: "center",
    padding: 20,
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  pickerModalContent: {
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
  },
  pickerModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(127, 127, 127, 0.3)",
  },
  pickerModalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  pickerCancelText: {
    fontSize: 16,
    fontWeight: "500",
  },
  pickerDoneText: {
    fontSize: 16,
    fontWeight: "700",
  },
  levelList: {
    maxHeight: 280,
  },
  levelListContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  levelListItem: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(127,127,127,0.28)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  levelListItemText: {
    fontSize: 15,
  },
});
