import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { STUDY_TIME_CATEGORY_META } from "../constants/studyTimeCategories";
import {
  ACTIVITY_CATEGORIES,
  addRecordToSummary,
  emptyRangeSummary,
  type RangeSummary,
} from "../services/timeTrackingCore";
import { timeTrackingService } from "../services/timeTrackingService";
import { formatDurationMs } from "../utils/durationFormat";
import { useTheme } from "../utils/theme";

function readTodaySummary(): RangeSummary {
  const summary = emptyRangeSummary();
  addRecordToSummary(summary, timeTrackingService.getLiveToday());
  return summary;
}

export default function StudyTimeCard() {
  const { theme } = useTheme();
  const [today, setToday] = useState<RangeSummary>(readTodaySummary);

  // Live clock: refresh once a second while the tab is focused. Reads are
  // in-memory (MMKV cache) and the tracker never writes on reads.
  useFocusEffect(
    useCallback(() => {
      setToday(readTodaySummary());
      const timer = setInterval(() => {
        setToday(readTodaySummary());
      }, 1000);
      return () => clearInterval(timer);
    }, [])
  );

  const activeCategories = ACTIVITY_CATEGORIES.filter(
    (category) => today.byCategory[category] > 0
  ).sort((a, b) => today.byCategory[b] - today.byCategory[a]);

  const trackColor = theme.isDark ? "#2a2a2a" : "#f0f0f0";

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.cardBackground }]}
      onPress={() => router.push("/study-time")}
      activeOpacity={0.85}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <Ionicons name="time-outline" size={18} color={theme.textColor} />
          <Text style={[styles.title, { color: theme.textColor }]}>Study Time</Text>
        </View>
        <View style={styles.todayGroup}>
          <Text style={[styles.todayValue, { color: theme.textColor }]}>
            {formatDurationMs(today.studyMs)}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
        </View>
      </View>

      {today.studyMs > 0 ? (
        <>
          <View style={[styles.stackedBar, { backgroundColor: trackColor }]}>
            {activeCategories.map((category) => (
              <View
                key={category}
                style={{
                  flex: today.byCategory[category],
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
                  {formatDurationMs(today.byCategory[category])}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
          No study time yet today. Time spent on reviews, lessons, extra study,
          news, songs, reading, and videos shows up here.
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 4,
    marginBottom: 16,
    shadowColor: "rgba(0,0,0,0.15)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: "600",
  },
  todayGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  todayValue: {
    fontSize: 16,
    fontWeight: "bold",
    fontVariant: ["tabular-nums"],
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
