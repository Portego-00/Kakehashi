import { Ionicons } from "@expo/vector-icons";
import React, { useMemo } from "react";
import { StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";
import {
  calculateDailyStudyActivityToday,
  type DailyStudyAssignment,
  type DailyStudyReviewStatistic,
} from "../utils/dailyStudyActivity";
import { withAlpha } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";

type TodayStudyActivityCardProps = {
  assignments?: DailyStudyAssignment[];
  reviewStats?: DailyStudyReviewStatistic[];
  style?: StyleProp<ViewStyle>;
};

export default function TodayStudyActivityCard({
  assignments = [],
  reviewStats = [],
  style,
}: TodayStudyActivityCardProps) {
  const { theme } = useTheme();

  const { lessonsCompletedToday, reviewsCompletedToday } = useMemo(
    () => calculateDailyStudyActivityToday(assignments, reviewStats),
    [assignments, reviewStats],
  );

  const todayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

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
            <Ionicons name="today-outline" size={18} color={theme.primary} />
          </View>

          <View>
            <Text style={[styles.title, { color: theme.textColor }]}>
              Today&apos;s Study
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {todayLabel}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <View
          style={[
            styles.metricCard,
            {
              borderColor: withAlpha(theme.border, theme.isDark ? 0.9 : 0.65),
              backgroundColor: theme.isDark
                ? "rgba(255,255,255,0.04)"
                : "rgba(255,255,255,0.72)",
            },
          ]}
        >
          <View style={styles.metricTopRow}>
            <Ionicons name="book-outline" size={16} color={theme.primary} />
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
              Lessons
            </Text>
          </View>
          <Text style={[styles.metricValue, { color: theme.textColor }]}>
            {lessonsCompletedToday}
          </Text>
        </View>

        <View
          style={[
            styles.metricCard,
            {
              borderColor: withAlpha(theme.border, theme.isDark ? 0.9 : 0.65),
              backgroundColor: theme.isDark
                ? "rgba(255,255,255,0.04)"
                : "rgba(255,255,255,0.72)",
            },
          ]}
        >
          <View style={styles.metricTopRow}>
            <Ionicons name="checkmark-done-outline" size={16} color={theme.secondary} />
            <Text style={[styles.metricLabel, { color: theme.textSecondary }]}>
              Reviews
            </Text>
          </View>
          <Text style={[styles.metricValue, { color: theme.textColor }]}>
            {reviewsCompletedToday}
          </Text>
        </View>
      </View>
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
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
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
  subtitle: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
  },
  metricsRow: {
    marginTop: 14,
    flexDirection: "row",
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  metricTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
  },
});
