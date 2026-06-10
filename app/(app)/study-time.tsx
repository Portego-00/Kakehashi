import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { router } from "expo-router";
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
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
} from "react-native-reanimated";
import { GlassButton } from "../../src/components/GlassButton";
import RollingNumberText from "../../src/components/RollingNumberText";
import { STUDY_TIME_CATEGORY_META } from "../../src/constants/studyTimeCategories";
import {
  ACTIVITY_CATEGORIES,
} from "../../src/services/timeTrackingCore";
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
import {
  readStudyTimeRangeData,
  STUDY_TIME_RANGE_IDS,
  STUDY_TIME_RANGE_LABELS,
  type StudyTimeRangeData,
  type StudyTimeRangeId,
} from "../../src/utils/studyTimeRanges";
import { useTheme } from "../../src/utils/theme";

const CHART_HEIGHT = 96;

// Drives card expand/collapse and bar resizing when the range changes.
// Timing-based: settles without spring overshoot.
const cardLayout = LinearTransition.easing(Easing.inOut(Easing.quad))
  .duration(240)
  .reduceMotion(ReduceMotion.System);

const sectionEntering = FadeIn.duration(180).reduceMotion(ReduceMotion.System);
const sectionExiting = FadeOut.duration(120).reduceMotion(ReduceMotion.System);

type ScreenData = StudyTimeRangeData & {
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

function readScreenData(range: StudyTimeRangeId): ScreenData {
  return {
    ...readStudyTimeRangeData(range),
    syncStatus: getStudyTimeSyncStatus(),
  };
}

export default function StudyTimeScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [rangeIndex, setRangeIndex] = useState(0);
  const range = STUDY_TIME_RANGE_IDS[rangeIndex];
  const [data, setData] = useState<ScreenData>(() => readScreenData("today"));
  const [selectedBucketId, setSelectedBucketId] = useState<string | null>(null);
  const [showChartBreakdown, setShowChartBreakdown] = useState(false);

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

  const { summary, elapsedDays, series, syncStatus, chartTitle, chartUnit } = data;

  const activeCategories = useMemo(
    () =>
      ACTIVITY_CATEGORIES.filter((category) => summary.byCategory[category] > 0).sort(
        (a, b) => summary.byCategory[b] - summary.byCategory[a]
      ),
    [summary]
  );

  const chartMaxMs = Math.max(1, ...series.map((day) => day.studyMs));
  const selectedBucket =
    series.find((bucket) => bucket.id === selectedBucketId) ?? null;
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
          values={STUDY_TIME_RANGE_LABELS}
          selectedIndex={rangeIndex}
          onChange={(event) => {
            const index = event.nativeEvent.selectedSegmentIndex;
            setRangeIndex(index);
            setSelectedBucketId(null);
            setData(readScreenData(STUDY_TIME_RANGE_IDS[index]));
          }}
          style={styles.segmentedControl}
          tintColor={theme.primary}
          fontStyle={{ color: theme.textSecondary, fontSize: 13 }}
          activeFontStyle={{ color: "#fff", fontSize: 13, fontWeight: "600" }}
        />

        {/* Total for the selected range */}
        <Animated.View style={cardStyle} layout={cardLayout}>
          <Text style={[styles.heroLabel, { color: theme.textSecondary }]}>
            Total study time
          </Text>
          <RollingNumberText
            text={formatDurationMs(summary.studyMs)}
            style={[styles.heroValue, { color: theme.textColor }]}
            containerStyle={styles.heroValueContainer}
          />
          {range !== "today" && (
            <Animated.View
              style={styles.heroMetaRow}
              entering={sectionEntering}
              exiting={sectionExiting}
              layout={cardLayout}
            >
              <View style={styles.heroMetaItem}>
                <RollingNumberText
                  text={formatDurationMsCoarse(averagePerDayMs)}
                  style={[styles.heroMetaValue, { color: theme.textColor }]}
                />
                <Text style={[styles.heroMetaLabel, { color: theme.textSecondary }]}>
                  avg / day
                </Text>
              </View>
              <View style={styles.heroMetaItem}>
                <RollingNumberText
                  text={`${summary.activeDayCount}/${elapsedDays}`}
                  style={[styles.heroMetaValue, { color: theme.textColor }]}
                />
                <Text style={[styles.heroMetaLabel, { color: theme.textSecondary }]}>
                  active days
                </Text>
              </View>
              <View style={styles.heroMetaItem}>
                <RollingNumberText
                  text={formatDurationMsCoarse(
                    summary.activeDayCount > 0
                      ? summary.studyMs / summary.activeDayCount
                      : 0
                  )}
                  style={[styles.heroMetaValue, { color: theme.textColor }]}
                />
                <Text style={[styles.heroMetaLabel, { color: theme.textSecondary }]}>
                  avg / active day
                </Text>
              </View>
            </Animated.View>
          )}
        </Animated.View>

        {/* Per-category breakdown */}
        <Animated.View style={cardStyle} layout={cardLayout}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Breakdown
          </Text>
          {activeCategories.length === 0 ? (
            <Animated.Text
              entering={sectionEntering}
              exiting={sectionExiting}
              style={[styles.emptyText, { color: theme.textSecondary }]}
            >
              Nothing tracked in this period yet.
            </Animated.Text>
          ) : (
            activeCategories.map((category) => {
              const meta = STUDY_TIME_CATEGORY_META[category];
              const categoryMs = summary.byCategory[category];
              const share = summary.studyMs > 0 ? categoryMs / summary.studyMs : 0;

              return (
                <Animated.View
                  key={category}
                  style={styles.categoryRow}
                  entering={sectionEntering}
                  exiting={sectionExiting}
                  layout={cardLayout}
                >
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
                    <Animated.View
                      layout={cardLayout}
                      style={[
                        styles.categoryFill,
                        {
                          backgroundColor: meta.color,
                          width: `${Math.max(2, Math.round(share * 100))}%`,
                        },
                      ]}
                    />
                  </View>
                </Animated.View>
              );
            })
          )}
        </Animated.View>

        {/* Range chart */}
        <Animated.View style={cardStyle} layout={cardLayout}>
          <View style={styles.chartHeaderRow}>
            <Text style={[styles.sectionTitle, styles.chartSectionTitle, { color: theme.textColor }]}>
              {chartTitle}
            </Text>
            <TouchableOpacity
              onPress={() => setShowChartBreakdown((value) => !value)}
              style={[
                styles.chartToggle,
                {
                  backgroundColor: showChartBreakdown ? theme.primary : trackColor,
                },
              ]}
              accessibilityRole="switch"
              accessibilityLabel="Color bars by category"
              accessibilityState={{ checked: showChartBreakdown }}
              activeOpacity={0.85}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name="color-palette-outline"
                size={16}
                color={showChartBreakdown ? "#fff" : theme.textSecondary}
              />
            </TouchableOpacity>
          </View>
          <View style={styles.chartRow}>
            {series.map((bucket) => {
              const isSelected = bucket.id === selectedBucketId;
              const barHeight =
                bucket.studyMs > 0
                  ? Math.max(3, (bucket.studyMs / chartMaxMs) * CHART_HEIGHT)
                  : 2;

              return (
                <Pressable
                  key={bucket.id}
                  style={styles.chartColumn}
                  onPress={() =>
                    setSelectedBucketId(isSelected ? null : bucket.id)
                  }
                >
                  <View style={styles.chartBarSlot}>
                    <Animated.View
                      layout={cardLayout}
                      style={[
                        styles.chartBar,
                        {
                          height: barHeight,
                          backgroundColor:
                            bucket.studyMs > 0
                              ? showChartBreakdown
                                ? "transparent"
                                : isSelected || bucket.isCurrent
                                  ? theme.primary
                                  : `${theme.primary}88`
                              : trackColor,
                        },
                      ]}
                    >
                      {showChartBreakdown && bucket.studyMs > 0
                        ? ACTIVITY_CATEGORIES.map((category) => {
                            const categoryMs = bucket.byCategory[category] ?? 0;
                            if (categoryMs <= 0) {
                              return null;
                            }
                            return (
                              <Animated.View
                                key={category}
                                entering={sectionEntering}
                                layout={cardLayout}
                                style={{
                                  height: (categoryMs / bucket.studyMs) * barHeight,
                                  backgroundColor:
                                    STUDY_TIME_CATEGORY_META[category].color,
                                }}
                              />
                            );
                          })
                        : null}
                    </Animated.View>
                  </View>
                  <Text
                    style={[
                      styles.chartDayLabel,
                      {
                        color: bucket.isCurrent ? theme.textColor : theme.textSecondary,
                        fontWeight: bucket.isCurrent ? "700" : "400",
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {bucket.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={[styles.chartCaption, { color: theme.textSecondary }]}>
            {selectedBucket
              ? `${selectedBucket.accessibilityLabel} — ${formatDurationMs(selectedBucket.studyMs)}`
              : `Tap a ${chartUnit} bar to see that period's total`}
          </Text>
        </Animated.View>

        {/* App total */}
        <Animated.View style={cardStyle} layout={cardLayout}>
          <View style={styles.appTotalRow}>
            <View style={styles.categoryLabelGroup}>
              <Ionicons name="phone-portrait-outline" size={16} color={theme.textSecondary} />
              <Text style={[styles.categoryLabel, { color: theme.textColor }]}>
                Total time in app
              </Text>
            </View>
            <RollingNumberText
              text={formatDurationMs(summary.appTotalMs)}
              style={[styles.categoryValue, { color: theme.textColor }]}
            />
          </View>
          <Text style={[styles.footnote, { color: theme.textSecondary }]}>
            Includes everything you do in the app, not just study screens. Time
            only counts while the app is in the foreground.
          </Text>
        </Animated.View>

        {/* Sync status — visible so device testers can debug without a console */}
        <Animated.View style={cardStyle} layout={cardLayout}>
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
        </Animated.View>
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
    fontVariant: ["tabular-nums"],
  },
  heroValueContainer: {
    marginTop: 4,
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
  chartHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 8,
  },
  chartSectionTitle: {
    marginBottom: 0,
    flexShrink: 1,
  },
  chartToggle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
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
    overflow: "hidden",
    // Stacked category segments render bottom-up.
    flexDirection: "column-reverse",
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
