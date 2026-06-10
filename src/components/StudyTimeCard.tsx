import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { STUDY_TIME_CATEGORY_META } from "../constants/studyTimeCategories";
import {
  ACTIVITY_CATEGORIES,
} from "../services/timeTrackingCore";
import { formatDurationMs } from "../utils/durationFormat";
import { withAlpha } from "../utils/subjectColors";
import {
  readStudyTimeRangeData,
  STUDY_TIME_RANGE_IDS,
  STUDY_TIME_RANGE_LABELS,
  type StudyTimeRangeData,
} from "../utils/studyTimeRanges";
import { useTheme } from "../utils/theme";

const CARD_CHART_HEIGHT = 58;

type StudyTimeCardProps = {
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function StudyTimeCard({
  interactive = true,
  style,
}: StudyTimeCardProps) {
  const { theme } = useTheme();
  const [rangeIndex, setRangeIndex] = useState(0);
  const range = STUDY_TIME_RANGE_IDS[rangeIndex];
  const [data, setData] = useState<StudyTimeRangeData>(() =>
    readStudyTimeRangeData("today"),
  );

  // Live clock: refresh once a second while the tab is focused. Reads are
  // in-memory (MMKV cache) and the tracker never writes on reads.
  useFocusEffect(
    useCallback(() => {
      setData(readStudyTimeRangeData(range));
      const timer = setInterval(() => {
        setData(readStudyTimeRangeData(range));
      }, 1000);
      return () => clearInterval(timer);
    }, [range])
  );

  const { summary, series, chartTitle } = data;
  const activeCategories = ACTIVITY_CATEGORIES.filter(
    (category) => summary.byCategory[category] > 0
  ).sort((a, b) => summary.byCategory[b] - summary.byCategory[a]);

  const trackColor = theme.isDark ? "#2a2a2a" : "#f0f0f0";
  const chartMaxMs = Math.max(1, ...series.map((bucket) => bucket.studyMs));

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.iconBadge,
              { backgroundColor: withAlpha(theme.primary, theme.isDark ? 0.34 : 0.18) },
            ]}
          >
            <Ionicons name="time-outline" size={18} color={theme.primary} />
          </View>
          <Text style={[styles.title, { color: theme.textColor }]}>
            Study Time
          </Text>
        </View>
        <TouchableOpacity
          style={styles.todayGroup}
          onPress={() => {
            if (interactive) {
              router.push("/study-time" as any);
            }
          }}
          activeOpacity={interactive ? 0.85 : 1}
          disabled={!interactive}
        >
          <Text style={[styles.todayValue, { color: theme.textColor }]}>
            {formatDurationMs(summary.studyMs)}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <SegmentedControl
        values={STUDY_TIME_RANGE_LABELS}
        selectedIndex={rangeIndex}
        onChange={(event) => {
          const index = event.nativeEvent.selectedSegmentIndex;
          setRangeIndex(index);
          setData(readStudyTimeRangeData(STUDY_TIME_RANGE_IDS[index]));
        }}
        style={styles.segmentedControl}
        tintColor={theme.primary}
        fontStyle={{ color: theme.textSecondary, fontSize: 12 }}
        activeFontStyle={{ color: "#fff", fontSize: 12, fontWeight: "600" }}
        enabled={interactive}
      />

      <View style={styles.chartHeaderRow}>
        <Text style={[styles.chartTitle, { color: theme.textSecondary }]}>
          {chartTitle}
        </Text>
      </View>
      <View style={styles.chartRow}>
        {series.map((bucket, index) => {
          const barHeight =
            bucket.studyMs > 0
              ? Math.max(3, (bucket.studyMs / chartMaxMs) * CARD_CHART_HEIGHT)
              : 2;
          const shouldShowLabel =
            bucket.isCurrent || index === 0 || index === series.length - 1;

          return (
            <View key={bucket.id} style={styles.chartColumn}>
              <View style={styles.chartBarSlot}>
                <View
                  style={[
                    styles.chartBar,
                    {
                      height: barHeight,
                      backgroundColor:
                        bucket.studyMs > 0
                          ? bucket.isCurrent
                            ? theme.primary
                            : `${theme.primary}88`
                          : trackColor,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.chartLabel,
                  {
                    color: bucket.isCurrent
                      ? theme.textColor
                      : theme.textSecondary,
                    fontWeight: bucket.isCurrent ? "700" : "500",
                  },
                ]}
                numberOfLines={1}
              >
                {shouldShowLabel ? bucket.label : ""}
              </Text>
            </View>
          );
        })}
      </View>

      {summary.studyMs > 0 ? (
        <>
          <View style={[styles.stackedBar, { backgroundColor: trackColor }]}>
            {activeCategories.map((category) => (
              <View
                key={category}
                style={{
                  flex: summary.byCategory[category],
                  backgroundColor: STUDY_TIME_CATEGORY_META[category].color,
                }}
              />
            ))}
          </View>
          <View style={styles.chipsRow}>
            {activeCategories.map((category) => (
              <View key={category} style={styles.chip}>
                <View
                  style={[
                    styles.chipDot,
                    { backgroundColor: STUDY_TIME_CATEGORY_META[category].color },
                  ]}
                />
                <Text style={[styles.chipLabel, { color: theme.textSecondary }]}>
                  {STUDY_TIME_CATEGORY_META[category].label}{" "}
                  {formatDurationMs(summary.byCategory[category])}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          No study time in this range yet. Time spent on reviews, lessons, extra study,
          news, songs, reading, and videos shows up here.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    padding: 16,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  todayGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  todayValue: {
    fontSize: 16,
    fontWeight: "bold",
    fontVariant: ["tabular-nums"],
  },
  segmentedControl: {
    height: 32,
    marginTop: 14,
  },
  chartHeaderRow: {
    marginTop: 14,
  },
  chartTitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    marginTop: 8,
  },
  chartColumn: {
    flex: 1,
    alignItems: "center",
    minWidth: 0,
  },
  chartBarSlot: {
    height: CARD_CHART_HEIGHT,
    justifyContent: "flex-end",
    alignSelf: "stretch",
  },
  chartBar: {
    borderRadius: 3,
    alignSelf: "stretch",
  },
  chartLabel: {
    marginTop: 5,
    minHeight: 12,
    fontSize: 9,
  },
  stackedBar: {
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    marginTop: 14,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
});
