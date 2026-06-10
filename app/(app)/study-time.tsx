import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { router } from "expo-router";
import { startOfMonth, startOfWeek } from "date-fns";
import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassButton } from "../../src/components/GlassButton";
import { STUDY_TIME_CATEGORY_META } from "../../src/constants/studyTimeCategories";
import {
  ACTIVITY_CATEGORIES,
  getLocalDateKey,
  type RangeSummary,
} from "../../src/services/timeTrackingCore";
import { timeTrackingService } from "../../src/services/timeTrackingService";
import {
  getDeviceId,
  getStudyTimeSyncStatus,
  maybeSyncStudyTime,
  type StudyTimeSyncStatus,
} from "../../src/services/timeTrackingSyncService";
import {
  formatDurationMs,
  formatDurationMsCoarse,
} from "../../src/utils/durationFormat";
import { useTheme } from "../../src/utils/theme";

type RangeId = "today" | "week" | "month" | "all";

const RANGE_LABELS = ["Today", "Week", "Month", "All"];
const RANGE_IDS: RangeId[] = ["today", "week", "month", "all"];
const CHART_DAY_COUNT = 14;
const CHART_HEIGHT = 96;

type ScreenData = {
  summary: RangeSummary;
  startKey: string;
  elapsedDays: number;
  series: { dateKey: string; studyMs: number }[];
  syncStatus: StudyTimeSyncStatus;
};

function formatTimeAgo(timestampMs: number | null): string {
  if (!timestampMs) {
    return "never";
  }
  const seconds = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (seconds < 5) {
    return "just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function daysBetweenInclusive(startKey: string, endKey: string): number {
  const oneDayMs = 24 * 60 * 60 * 1000;
  const diff = Math.round(
    (parseDateKey(endKey).getTime() - parseDateKey(startKey).getTime()) / oneDayMs
  );
  return Math.max(1, diff + 1);
}

function readScreenData(range: RangeId): ScreenData {
  const now = new Date();
  const todayKey = getLocalDateKey(now.getTime());

  let startKey = todayKey;
  if (range === "week") {
    startKey = getLocalDateKey(startOfWeek(now, { weekStartsOn: 1 }).getTime());
  } else if (range === "month") {
    startKey = getLocalDateKey(startOfMonth(now).getTime());
  } else if (range === "all") {
    const { firstDayKey } = timeTrackingService.getAllTimeSummary();
    startKey = firstDayKey ?? todayKey;
  }

  return {
    summary: timeTrackingService.getSummaryBetween(startKey, todayKey),
    startKey,
    elapsedDays: daysBetweenInclusive(startKey, todayKey),
    series: timeTrackingService.getDailyStudySeries(CHART_DAY_COUNT),
    syncStatus: getStudyTimeSyncStatus(),
  };
}

export default function StudyTimeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [rangeIndex, setRangeIndex] = useState(0);
  const range = RANGE_IDS[rangeIndex];
  const [data, setData] = useState<ScreenData>(() => readScreenData("today"));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  // Live refresh while focused; all reads are local and in-memory cached.
  useFocusEffect(
    useCallback(() => {
      // Good moment to push totals to Supabase (throttled internally).
      maybeSyncStudyTime();

      setData(readScreenData(range));
      const timer = setInterval(() => {
        setData(readScreenData(range));
      }, 1000);
      return () => clearInterval(timer);
    }, [range])
  );

  const { summary, elapsedDays, series, syncStatus } = data;

  const activeCategories = useMemo(
    () =>
      ACTIVITY_CATEGORIES.filter((category) => summary.byCategory[category] > 0).sort(
        (a, b) => summary.byCategory[b] - summary.byCategory[a]
      ),
    [summary]
  );

  const chartMaxMs = Math.max(1, ...series.map((day) => day.studyMs));
  const selectedDay = series.find((day) => day.dateKey === selectedDateKey) ?? null;
  const averagePerDayMs = summary.studyMs / elapsedDays;
  const trackColor = theme.isDark ? "#2a2a2a" : "#f0f0f0";
  const cardStyle = [styles.card, { backgroundColor: theme.cardBackground }];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundColor, paddingTop: insets.top + 4 },
      ]}
    >
      <View style={styles.headerRow}>
        <GlassButton
          iconName="arrow-back"
          onPress={() => router.back()}
          iconColor={theme.textColor}
          variant="light"
          style={styles.backButton}
        />
        <View style={styles.headerTextGroup}>
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>
            Study Time
          </Text>
          <Text style={[styles.headerMeta, { color: theme.textSecondary }]}>
            Tracked on this device while the app is open
          </Text>
        </View>
        <View style={styles.backButtonSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SegmentedControl
          values={RANGE_LABELS}
          selectedIndex={rangeIndex}
          onChange={(event) => {
            const index = event.nativeEvent.selectedSegmentIndex;
            setRangeIndex(index);
            setData(readScreenData(RANGE_IDS[index]));
          }}
          style={styles.segmentedControl}
          tintColor={theme.primary}
          fontStyle={{ color: theme.textSecondary, fontSize: 13 }}
          activeFontStyle={{ color: "#fff", fontSize: 13, fontWeight: "600" }}
        />

        {/* Total for the selected range */}
        <View style={cardStyle}>
          <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>
            Total study time
          </Text>
          <Text style={[styles.heroValue, { color: theme.textColor }]}>
            {formatDurationMs(summary.studyMs)}
          </Text>
          {range !== "today" && (
            <View style={styles.heroMetaRow}>
              <View style={styles.heroMetaItem}>
                <Text style={[styles.heroMetaValue, { color: theme.textColor }]}>
                  {formatDurationMsCoarse(averagePerDayMs)}
                </Text>
                <Text style={[styles.heroMetaLabel, { color: theme.textSecondary }]}>
                  avg / day
                </Text>
              </View>
              <View style={styles.heroMetaItem}>
                <Text style={[styles.heroMetaValue, { color: theme.textColor }]}>
                  {summary.activeDayCount}/{elapsedDays}
                </Text>
                <Text style={[styles.heroMetaLabel, { color: theme.textSecondary }]}>
                  active days
                </Text>
              </View>
              <View style={styles.heroMetaItem}>
                <Text style={[styles.heroMetaValue, { color: theme.textColor }]}>
                  {formatDurationMsCoarse(
                    summary.activeDayCount > 0
                      ? summary.studyMs / summary.activeDayCount
                      : 0
                  )}
                </Text>
                <Text style={[styles.heroMetaLabel, { color: theme.textSecondary }]}>
                  avg / active day
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Per-category breakdown */}
        <View style={cardStyle}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Breakdown
          </Text>
          {activeCategories.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Nothing tracked in this period yet.
            </Text>
          ) : (
            activeCategories.map((category) => {
              const meta = STUDY_TIME_CATEGORY_META[category];
              const categoryMs = summary.byCategory[category];
              const share = summary.studyMs > 0 ? categoryMs / summary.studyMs : 0;

              return (
                <View key={category} style={styles.categoryRow}>
                  <View style={styles.categoryHeader}>
                    <View style={styles.categoryLabelGroup}>
                      <Ionicons name={meta.icon} size={16} color={meta.color} />
                      <Text style={[styles.categoryLabel, { color: theme.textColor }]}>
                        {meta.label}
                      </Text>
                    </View>
                    <Text style={[styles.categoryValue, { color: theme.textColor }]}>
                      {formatDurationMs(categoryMs)}
                      <Text style={{ color: theme.textSecondary }}>
                        {"  "}{Math.round(share * 100)}%
                      </Text>
                    </Text>
                  </View>
                  <View style={[styles.categoryTrack, { backgroundColor: trackColor }]}>
                    <View
                      style={[
                        styles.categoryFill,
                        {
                          backgroundColor: meta.color,
                          width: `${Math.max(2, Math.round(share * 100))}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })
          )}
        </View>

        {/* Daily chart */}
        <View style={cardStyle}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Last {CHART_DAY_COUNT} days
          </Text>
          <View style={styles.chartRow}>
            {series.map((day) => {
              const isToday = day.dateKey === timeTrackingService.getTodayDateKey();
              const isSelected = day.dateKey === selectedDateKey;
              const barHeight =
                day.studyMs > 0
                  ? Math.max(3, (day.studyMs / chartMaxMs) * CHART_HEIGHT)
                  : 2;
              const weekdayLetter = new Intl.DateTimeFormat(undefined, {
                weekday: "short",
              })
                .format(parseDateKey(day.dateKey))
                .slice(0, 1)
                .toUpperCase();

              return (
                <Pressable
                  key={day.dateKey}
                  style={styles.chartColumn}
                  onPress={() =>
                    setSelectedDateKey(isSelected ? null : day.dateKey)
                  }
                >
                  <View style={styles.chartBarSlot}>
                    <View
                      style={[
                        styles.chartBar,
                        {
                          height: barHeight,
                          backgroundColor:
                            day.studyMs > 0
                              ? isSelected || isToday
                                ? theme.primary
                                : `${theme.primary}88`
                              : trackColor,
                        },
                      ]}
                    />
                  </View>
                  <Text
                    style={[
                      styles.chartDayLabel,
                      {
                        color: isToday ? theme.textColor : theme.textSecondary,
                        fontWeight: isToday ? "700" : "400",
                      },
                    ]}
                  >
                    {weekdayLetter}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.chartCaption, { color: theme.textSecondary }]}>
            {selectedDay
              ? `${parseDateKey(selectedDay.dateKey).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })} — ${formatDurationMs(selectedDay.studyMs)}`
              : "Tap a bar to see that day's total"}
          </Text>
        </View>

        {/* App total */}
        <View style={cardStyle}>
          <View style={styles.appTotalRow}>
            <View style={styles.categoryLabelGroup}>
              <Ionicons name="phone-portrait-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.categoryLabel, { color: theme.textColor }]}>
                Total time in app
              </Text>
            </View>
            <Text style={[styles.categoryValue, { color: theme.textColor }]}>
              {formatDurationMs(summary.appTotalMs)}
            </Text>
          </View>
          <Text style={[styles.footnote, { color: theme.textSecondary }]}>
            Includes everything you do in the app, not just study screens. Time
            only counts while the app is in the foreground.
          </Text>
        </View>

        {/* Sync status — visible so device testers can debug without a console */}
        <View style={cardStyle}>
          <View style={styles.appTotalRow}>
            <View style={styles.categoryLabelGroup}>
              <Ionicons
                name="cloud-upload-outline"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[styles.categoryLabel, { color: theme.textColor }]}>
                Sync
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.syncNowButton, { backgroundColor: theme.primary }]}
              onPress={() => {
                maybeSyncStudyTime({ force: true });
                setData(readScreenData(range));
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.syncNowButtonText}>Sync now</Text>
            </TouchableOpacity>
          </View>
          <Text
            style={[
              styles.syncDetail,
              {
                color:
                  syncStatus.state === "error"
                    ? theme.error
                    : syncStatus.state === "success"
                      ? "#22C55E"
                      : theme.textSecondary,
              },
            ]}
          >
            {syncStatus.detail}
            {syncStatus.at ? ` (${formatTimeAgo(syncStatus.at)})` : ""}
          </Text>
          <Text style={[styles.footnote, { color: theme.textSecondary }]}>
            Last successful push: {formatTimeAgo(syncStatus.lastSuccessAt)}
          </Text>
          <Text
            style={[styles.footnote, { color: theme.textSecondary }]}
            selectable
          >
            Device ID: {getDeviceId()}
          </Text>
          <Text
            style={[styles.footnote, { color: theme.textSecondary }]}
            selectable
          >
            Project: {getSupabaseHost()}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// Which Supabase project this build talks to (public client config), so RLS
// or missing-table errors can be matched against the right dashboard.
function getSupabaseHost(): string {
  try {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
    if (!url) {
      return "not configured";
    }
    return new URL(url).host;
  } catch {
    return "invalid URL";
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    marginRight: 12,
  },
  backButtonSpacer: {
    width: 44,
  },
  headerTextGroup: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  headerMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  segmentedControl: {
    height: 36,
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: "rgba(0,0,0,0.15)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  heroLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  heroValue: {
    fontSize: 34,
    fontWeight: "bold",
    marginTop: 4,
    fontVariant: ["tabular-nums"],
  },
  heroMetaRow: {
    flexDirection: "row",
    marginTop: 16,
    gap: 24,
  },
  heroMetaItem: {
    alignItems: "flex-start",
  },
  heroMetaValue: {
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  heroMetaLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 13,
  },
  categoryRow: {
    marginBottom: 14,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  categoryLabelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  categoryLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  categoryValue: {
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  categoryTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  categoryFill: {
    height: "100%",
    borderRadius: 4,
  },
  chartRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
  },
  chartColumn: {
    flex: 1,
    alignItems: "center",
  },
  chartBarSlot: {
    height: CHART_HEIGHT,
    justifyContent: "flex-end",
    alignSelf: "stretch",
  },
  chartBar: {
    borderRadius: 3,
    alignSelf: "stretch",
  },
  chartDayLabel: {
    fontSize: 10,
    marginTop: 6,
  },
  chartCaption: {
    fontSize: 12,
    marginTop: 12,
    textAlign: "center",
  },
  appTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 10,
  },
  syncNowButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  syncNowButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  syncDetail: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 12,
  },
});
