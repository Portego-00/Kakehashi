import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router/react-navigation";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  readingGoalsService,
  type ReadingGoalDay,
  type ReadingGoalsProgress,
} from "../../src/services/readingGoalsService";
import { supportsNativeTabs } from "../../src/utils/nativeTabs";
import { useTheme } from "../../src/utils/theme";

const GOAL_PRESETS = [5, 10, 15, 20, 30];
const COMPLETED_PROGRESS_COLOR = "#43AA8B";

function fallbackWeekDays(): ReadingGoalDay[] {
  const days: ReadingGoalDay[] = [];
  const now = new Date();

  for (let offset = 6; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const dateKey = `${year}-${month}-${day}`;
    const label = new Intl.DateTimeFormat(undefined, { weekday: "short" })
      .format(date)
      .slice(0, 1)
      .toUpperCase();

    days.push({
      dateKey,
      label,
      completed: false,
      isToday: offset === 0,
    });
  }

  return days;
}

function getFallbackGoalsProgress(): ReadingGoalsProgress {
  return {
    goalMinutes: 5,
    todayMinutes: 0,
    todaySeconds: 0,
    todayRatio: 0,
    todayCompleted: false,
    streakCurrent: 0,
    streakBest: 0,
    week: fallbackWeekDays(),
  };
}

export default function EpubSettingsScreen() {
  const { theme } = useTheme();
  const [goalsProgress, setGoalsProgress] = useState<ReadingGoalsProgress | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadProgress = useCallback(async () => {
    try {
      const progress = await readingGoalsService.getProgress();
      setGoalsProgress(progress);
    } catch (error) {
      console.error("Failed to load EPUB reading settings:", error);
      Alert.alert("Could not load settings", "Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProgress();
    }, [loadProgress])
  );

  const updateGoal = useCallback(
    async (nextGoalMinutes: number) => {
      if (isSaving) {
        return;
      }

      setIsSaving(true);
      try {
        const updated = await readingGoalsService.setGoalMinutes(nextGoalMinutes);
        setGoalsProgress(updated);
      } catch (error) {
        console.error("Failed to update EPUB reading goal:", error);
        Alert.alert("Could not update goal", "Please try again.");
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving]
  );

  const progress = goalsProgress ?? getFallbackGoalsProgress();
  const remainingMinutes = Math.max(0, progress.goalMinutes - progress.todayMinutes);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />

      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.backgroundColor,
            paddingTop: supportsNativeTabs() ? 66 : 52,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.headerButton, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}
          onPress={() => router.back()}
          activeOpacity={0.82}
        >
          <Ionicons name="arrow-back" size={20} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>EPUB Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.centerStateText, { color: theme.textSecondary }]}>Loading settings...</Text>
        </View>
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
        >
          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.textColor }]}>Daily Reading Goal</Text>
            <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>
              Set how many minutes you want to read each day.
            </Text>

            <View style={styles.goalAdjustRow}>
              <TouchableOpacity
                style={[styles.goalAdjustButton, { borderColor: theme.border, backgroundColor: theme.backgroundColor }]}
                onPress={() => updateGoal(progress.goalMinutes - 1)}
                disabled={isSaving}
                activeOpacity={0.82}
              >
                <Ionicons name="remove" size={16} color={theme.textColor} />
              </TouchableOpacity>

              <View style={[styles.goalValuePill, { borderColor: theme.border }]}>
                <Text style={[styles.goalValueText, { color: theme.textColor }]}>
                  {progress.goalMinutes} min/day
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.goalAdjustButton, { borderColor: theme.border, backgroundColor: theme.backgroundColor }]}
                onPress={() => updateGoal(progress.goalMinutes + 1)}
                disabled={isSaving}
                activeOpacity={0.82}
              >
                <Ionicons name="add" size={16} color={theme.textColor} />
              </TouchableOpacity>
            </View>

            <View style={styles.goalPresetRow}>
              {GOAL_PRESETS.map((preset) => {
                const selected = progress.goalMinutes === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.goalPresetButton,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected ? `${theme.primary}18` : theme.backgroundColor,
                      },
                    ]}
                    onPress={() => updateGoal(preset)}
                    disabled={isSaving}
                    activeOpacity={0.82}
                  >
                    <Text style={[styles.goalPresetText, { color: selected ? theme.primary : theme.textSecondary }]}>
                      {preset}m
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View
            style={[
              styles.card,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.cardTitle, { color: theme.textColor }]}>Today</Text>
            <Text style={[styles.todayValue, { color: theme.textColor }]}>
              {progress.todayMinutes} / {progress.goalMinutes} min
            </Text>
            <View
              style={[
                styles.goalsTrack,
                { backgroundColor: theme.isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)" },
              ]}
            >
              <View
                style={[
                  styles.goalsFill,
                  {
                    width: `${Math.max(3, Math.round(progress.todayRatio * 100))}%`,
                    backgroundColor: progress.todayCompleted
                      ? COMPLETED_PROGRESS_COLOR
                      : theme.primary,
                  },
                ]}
              />
            </View>
            <Text style={[styles.todayHint, { color: theme.textSecondary }]}>
              {progress.todayCompleted
                ? "Goal completed for today."
                : `${remainingMinutes} more minute${remainingMinutes === 1 ? "" : "s"} needed.`}
            </Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  headerSpacer: {
    width: 38,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 60,
    gap: 14,
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  cardSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  goalAdjustRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  goalAdjustButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  goalValuePill: {
    minWidth: 126,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  goalValueText: {
    fontSize: 14,
    fontWeight: "700",
  },
  goalPresetRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  goalPresetButton: {
    minWidth: 44,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  goalPresetText: {
    fontSize: 12,
    fontWeight: "700",
  },
  todayValue: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  goalsTrack: {
    width: "100%",
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
  },
  goalsFill: {
    height: "100%",
    borderRadius: 999,
  },
  todayHint: {
    fontSize: 13,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  centerStateText: {
    marginTop: 12,
    fontSize: 14,
  },
});
