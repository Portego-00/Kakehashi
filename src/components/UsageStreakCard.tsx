import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { UsageStreakDay } from "../hooks/useUsageStreak";
import { withAlpha } from "../utils/subjectColors";
import { useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";
import {
  DEFAULT_WIDGET_CARD_STYLE_COLORS,
  normalizeWidgetCardColor,
} from "../utils/widgetCardStyles";

type UsageStreakCardProps = {
  currentStreak: number;
  longestStreak: number;
  freezeAvailable: boolean;
  freezeDaysUntilReload: number;
  recentDays: UsageStreakDay[];
  isLoading: boolean;
  error: string | null;
  style?: StyleProp<ViewStyle>;
};

type MilestoneVariant = "none" | "day42" | "day84" | "day126" | "day168";

const MILESTONE_FLAME_COLORS: Record<Exclude<MilestoneVariant, "none">, string> = {
  day42: "#FFC53D",
  day84: "#FF3B30",
  day126: "#38BDF8",
  day168: "#A855F7",
};

function getMilestoneVariant(streak: number | null): MilestoneVariant {
  if (streak === null || streak <= 0 || streak % 42 !== 0) {
    return "none";
  }

  if (streak === 84) {
    return "day84";
  }

  if (streak === 126) {
    return "day126";
  }

  if (streak === 168) {
    return "day168";
  }

  return "day42";
}

function getVisibleStreakDayNumbers(
  days: UsageStreakDay[],
  currentStreak: number,
): (number | null)[] {
  const streakDayNumbers: (number | null)[] = new Array(days.length).fill(null);
  let activeDaysAfter = 0;

  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];
    if (!day.active) {
      continue;
    }

    const streakDay = currentStreak - activeDaysAfter;
    streakDayNumbers[index] = streakDay > 0 ? streakDay : null;
    activeDaysAfter += 1;
  }

  return streakDayNumbers;
}

export default function UsageStreakCard({
  currentStreak,
  longestStreak,
  freezeAvailable,
  freezeDaysUntilReload,
  recentDays,
  isLoading,
  error,
  style,
}: UsageStreakCardProps) {
  const { theme, themeMode } = useTheme();
  const widgetStreakCardFollowTheme = useSettingsStore(
    (state) => state.widgetStreakCardFollowTheme
  );
  const widgetStreakCardGradientStart = useSettingsStore(
    (state) => state.widgetStreakCardGradientStart
  );
  const flameColor = !widgetStreakCardFollowTheme
    ? normalizeWidgetCardColor(
        widgetStreakCardGradientStart,
        DEFAULT_WIDGET_CARD_STYLE_COLORS.widgetStreakCardGradientStart
      )
    : themeMode === "sepia"
      ? "#C26A3D"
      : "#FF7A18";
  const inactiveDayColor = theme.textLight;
  const streakAlive = currentStreak > 0;
  const freezeText = error
    ? "Freeze status unavailable"
    : freezeAvailable
      ? "Freeze ready"
      : `Freeze reload: ${freezeDaysUntilReload}d`;
  const visibleStreakDayNumbers = React.useMemo(
    () => getVisibleStreakDayNumbers(recentDays, currentStreak),
    [recentDays, currentStreak],
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.cardBackground, borderColor: theme.border },
        style,
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.titleWrap}>
          <Ionicons name="flame" size={18} color={flameColor} />
          <Text style={[styles.title, { color: theme.textColor }]}>App Streak</Text>
        </View>
        <View style={[styles.bestBadge, { backgroundColor: withAlpha(flameColor, 0.15) }]}>
          <Text style={[styles.bestBadgeText, { color: flameColor }]}>
            Best {longestStreak}
          </Text>
        </View>
      </View>

      <View style={styles.mainRow}>
        {isLoading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={flameColor} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Updating...
            </Text>
          </View>
        ) : (
          <>
            <Text style={[styles.streakNumber, { color: theme.textColor }]}>
              {currentStreak}
            </Text>
            <Text style={[styles.streakUnit, { color: theme.textSecondary }]}>日</Text>
          </>
        )}
      </View>

      <View style={styles.freezeRow}>
        <Ionicons name="snow-outline" size={14} color={theme.textSecondary} />
        <Text style={[styles.freezeText, { color: theme.textSecondary }]}>
          {freezeText}
        </Text>
      </View>

      <View style={[styles.weekRow, { borderTopColor: theme.border }]}>
        {recentDays.map((day, index) => {
          const streakDayNumber = visibleStreakDayNumbers[index];
          const milestoneVariant = getMilestoneVariant(streakDayNumber);
          const dayFlameColor =
            milestoneVariant === "none"
              ? flameColor
              : MILESTONE_FLAME_COLORS[milestoneVariant];

          return (
            <View key={day.dayKey} style={styles.dayItem}>
              <View
                style={[
                  styles.dayIconContainer,
                  {
                    backgroundColor: day.active
                      ? withAlpha(dayFlameColor, 0.15)
                      : withAlpha(inactiveDayColor, 0.12),
                  },
                ]}
              >
                <Ionicons
                  name={day.active ? "flame" : "flame-outline"}
                  size={18}
                  color={day.active ? dayFlameColor : inactiveDayColor}
                />
              </View>
              <Text
                style={[
                  styles.dayLabel,
                  { color: theme.textSecondary },
                  day.isToday && [styles.dayLabelToday, { color: theme.textColor }],
                ]}
              >
                {day.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 12,
    overflow: "hidden",
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  titleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  bestBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bestBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  mainRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  heroFlame: {
    marginBottom: 2,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "600",
  },
  streakNumber: {
    fontSize: 42,
    lineHeight: 44,
    fontWeight: "900",
  },
  streakUnit: {
    fontSize: 24,
    marginBottom: 4,
    fontWeight: "700",
  },
  freezeRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  freezeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  weekRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayItem: {
    alignItems: "center",
    gap: 6,
    minWidth: 34,
  },
  dayIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  dayLabelToday: {
    fontWeight: "800",
  },
});
