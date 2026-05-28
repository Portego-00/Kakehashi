import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "../utils/haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React, { useMemo } from "react";
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import IncompleteLevelsProgress from "./IncompleteLevelsProgress";
import { LessonsReviewsCardPair } from "./LessonsReviewsCard";
import LevelProgress from "./LevelProgress";
import LevelTimingChart from "./LevelTimingChart";
import RecentMistakesCard from "./RecentMistakesCard";
import ReviewForecast from "./ReviewForecast";
import ReviewHeatmap from "./ReviewHeatmap";
import ReviewStatsTable from "./ReviewStatsTable";
import SrsBreakdown, {
  type SrsBreakdownGroupStagesScope,
  type SrsBreakdownViewMode,
} from "./SrsBreakdown";
import TodayStudyActivityCard from "./TodayStudyActivityCard";
import {
  BurnedItems,
  CriticalItems,
  RecentUnlocks,
} from "./UnlocksAndCritical";
import { useSubjectLists } from "../hooks/useSubjectLists";
import UsageStreakCard from "./UsageStreakCard";
import { type UsageStreakDay } from "../hooks/useUsageStreak";
import { type HomeWidgetId } from "../utils/homeWidgets";
import {
  type ExtraStudyModeId,
  getAvailableExtraStudyModes,
  normalizeHomeExtraStudyModeOrder,
} from "../utils/extraStudyModes";
import {
  getRecentLessonsWindowSubtitle,
  type RecentLessonsWindow,
} from "../utils/recentLessonsWindow";
import { getReadableTextColor, withAlpha } from "../utils/subjectColors";
import { useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";

type HomeDashboardWidgetProps = {
  widgetId: HomeWidgetId;
  dashboardData: any;
  userData: any;
  effectiveLessonCount: number;
  isDailyLessonLimitReached: boolean;
  isIPadLandscape: boolean;
  shouldShowRecentMistakes: boolean;
  currentStreak: number;
  longestStreak: number;
  freezeAvailable: boolean;
  freezeDaysUntilReload: number;
  streakRecentDays: UsageStreakDay[];
  isStreakLoading: boolean;
  streakError: string | null;
  recentLessonsWindow: RecentLessonsWindow;
  recentLessonCountForWindow: number;
  onLessonsPress: () => void;
  onLessonPicker: () => void;
  onReviewsPress: () => void;
  srsBreakdownView?: SrsBreakdownViewMode;
  srsBreakdownGroupStagesScope?: SrsBreakdownGroupStagesScope;
  activeExtraStudySessionModeIds?: readonly ExtraStudyModeId[];
  previewMode?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function HomeDashboardWidget({
  widgetId,
  dashboardData,
  userData,
  effectiveLessonCount,
  isDailyLessonLimitReached,
  isIPadLandscape,
  shouldShowRecentMistakes,
  currentStreak,
  longestStreak,
  freezeAvailable,
  freezeDaysUntilReload,
  streakRecentDays,
  isStreakLoading,
  streakError,
  recentLessonsWindow,
  recentLessonCountForWindow,
  onLessonsPress,
  onLessonPicker,
  onReviewsPress,
  srsBreakdownView,
  srsBreakdownGroupStagesScope,
  activeExtraStudySessionModeIds = [],
  previewMode = false,
  style,
}: HomeDashboardWidgetProps) {
  const { theme } = useTheme();
  const homeExtraStudyModeOrder = useSettingsStore(
    (state) => state.homeExtraStudyModeOrder,
  );
  const homeExtraStudyHiddenModeIds = useSettingsStore(
    (state) => state.homeExtraStudyHiddenModeIds,
  );
  const excludeKanaVocabularyFromLessons = useSettingsStore(
    (state) => state.excludeKanaVocabularyFromLessons,
  );
  const isOnVacation = Boolean(userData?.current_vacation_started_at);
  const availableLessonCountBeforeDailyLimit = useMemo(() => {
    if (!excludeKanaVocabularyFromLessons) {
      return dashboardData.lessonCount;
    }

    if (!Array.isArray(dashboardData.assignments)) {
      return 0;
    }

    const subjectTypeById = new Map<number, string>();
    if (Array.isArray(dashboardData.subjects)) {
      dashboardData.subjects.forEach((subject: any) => {
        if (typeof subject?.id === "number" && typeof subject?.object === "string") {
          subjectTypeById.set(subject.id, subject.object);
        }
      });
    }

    const filteredCount = dashboardData.assignments.filter((assignment: any) => {
      if (
        !assignment?.data?.unlocked_at ||
        assignment.data.started_at ||
        assignment.data.hidden
      ) {
        return false;
      }

      const subjectType = subjectTypeById.get(assignment.data.subject_id);
      return subjectType !== "kana_vocabulary";
    }).length;

    return Math.min(filteredCount, dashboardData.lessonCount);
  }, [
    dashboardData.assignments,
    dashboardData.lessonCount,
    dashboardData.subjects,
    excludeKanaVocabularyFromLessons,
  ]);
  const recentLessonsSubtitle = getRecentLessonsWindowSubtitle(recentLessonsWindow);
  const interactive = !previewMode;

  const maybeHaptic = () => {
    if (!interactive) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleRoutePush = (route: string) => {
    if (!interactive) {
      return;
    }
    router.push(route as any);
  };

  const availableExtraStudyModes = useMemo(
    () => getAvailableExtraStudyModes(userData?.username),
    [userData?.username],
  );
  const availableExtraStudyModeMap = useMemo(
    () => new Map(availableExtraStudyModes.map((mode) => [mode.id, mode])),
    [availableExtraStudyModes],
  );
  const orderedExtraStudyModeIds = useMemo(
    () =>
      normalizeHomeExtraStudyModeOrder(
        homeExtraStudyModeOrder,
        availableExtraStudyModes,
        homeExtraStudyHiddenModeIds,
      ),
    [
      availableExtraStudyModes,
      homeExtraStudyHiddenModeIds,
      homeExtraStudyModeOrder,
    ],
  );
  const activeExtraStudySessionModeIdSet = useMemo(
    () => new Set(activeExtraStudySessionModeIds),
    [activeExtraStudySessionModeIds],
  );
  const getExtraStudyModeGradient = (modeId: string): [string, string] => {
    switch (modeId) {
      case "recent-lessons":
        return [withAlpha(theme.primary, 0.96), withAlpha(theme.primary, 0.74)];
      case "random-test":
        return [withAlpha(theme.secondary, 0.94), withAlpha(theme.secondary, 0.72)];
      case "reading-test":
        return [withAlpha(theme.accent, 0.92), withAlpha(theme.secondary, 0.74)];
      case "hiragana-vocab-meaning":
        return [withAlpha(theme.secondary, 0.9), withAlpha(theme.primary, 0.72)];
      case "kana-kanji-test":
        return [withAlpha(theme.primary, 0.86), withAlpha(theme.accent, 0.76)];
      case "listening-practice":
        return [withAlpha(theme.accent, 0.86), withAlpha(theme.primary, 0.78)];
      case "context-sentence-practice":
        return [withAlpha(theme.primary, 0.82), withAlpha(theme.secondary, 0.7)];
      case "writing-practice":
        return [withAlpha(theme.secondary, 0.8), withAlpha(theme.accent, 0.72)];
      case "crossword":
        return [withAlpha(theme.accent, 0.9), withAlpha(theme.primary, 0.7)];
      case "wordle":
        return [withAlpha(theme.secondary, 0.9), withAlpha(theme.primary, 0.75)];
      case "custom-review":
        return [withAlpha(theme.error, 0.88), withAlpha(theme.secondary, 0.78)];
      case "custom-lessons":
        return [withAlpha(theme.primary, 0.8), withAlpha(theme.error, 0.68)];
      case "subject-lists":
        return [withAlpha(theme.primary, 0.88), withAlpha(theme.secondary, 0.72)];
      default:
        return [withAlpha(theme.primary, 0.92), withAlpha(theme.accent, 0.78)];
    }
  };
  const extraStudyItems: {
    id: string;
    title: string;
    subtitle: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconText?: string;
    route: string;
    count?: number;
    hasActiveSession?: boolean;
    gradient: [string, string];
  }[] = orderedExtraStudyModeIds.reduce((items, modeId) => {
      const mode = availableExtraStudyModeMap.get(modeId);
      if (!mode) {
        return items;
      }

      items.push({
        id: mode.id,
        title: mode.title,
        subtitle:
          mode.id === "recent-lessons"
            ? recentLessonsSubtitle
            : activeExtraStudySessionModeIdSet.has(mode.id)
              ? "Session in progress"
              : mode.subtitle,
        icon: mode.icon,
        iconText: mode.iconText,
        route: mode.route,
        count:
          mode.id === "recent-lessons"
            ? recentLessonCountForWindow
            : undefined,
        hasActiveSession:
          activeExtraStudySessionModeIdSet.has(mode.id),
        gradient: getExtraStudyModeGradient(mode.id),
      });

      return items;
    }, [] as {
      id: string;
      title: string;
      subtitle: string;
      icon: keyof typeof Ionicons.glyphMap;
      iconText?: string;
      route: string;
      count?: number;
      hasActiveSession?: boolean;
      gradient: [string, string];
    }[]);

  switch (widgetId) {
    case "lessonsReviews":
      return isOnVacation ? (
        <View
          style={[
            styles.vacationCard,
            style,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <LinearGradient
            colors={["#F5A623", "#F7C948"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.vacationIconContainer}
          >
            <Ionicons name="umbrella" size={28} color="white" />
          </LinearGradient>
          <Text style={[styles.vacationTitle, { color: theme.textColor }]}>
            Vacation Mode
          </Text>
          <Text style={[styles.vacationSubtitle, { color: theme.textSecondary }]}>
            Your SRS progress is paused. Reviews and lessons are on hold until
            you return. Enjoy your break!
          </Text>
          <Text style={[styles.vacationSince, { color: theme.textSecondary }]}>
            On vacation since{" "}
            {new Date(userData.current_vacation_started_at).toLocaleDateString(
              undefined,
              {
                month: "long",
                day: "numeric",
                year: "numeric",
              },
            )}
          </Text>
        </View>
      ) : (
        <LessonsReviewsCardPair
          lessonCount={effectiveLessonCount}
          totalLessonCount={availableLessonCountBeforeDailyLimit}
          reviewCount={dashboardData.reviewCount}
          pendingLessonSyncCount={dashboardData.pendingLessonSyncCount ?? 0}
          pendingReviewSyncCount={dashboardData.pendingReviewSyncCount ?? 0}
          currentLevel={dashboardData.currentLevel}
          subjects={dashboardData.subjects}
          assignments={dashboardData.assignments}
          onLessonsPress={onLessonsPress}
          onLessonPicker={onLessonPicker}
          onReviewsPress={onReviewsPress}
          isDoneLessons={effectiveLessonCount === 0}
          isLessonDailyLimitReached={isDailyLessonLimitReached}
          nextLessonTime={dashboardData.nextLessonDate || undefined}
          nextReviewTime={dashboardData.nextReviewDate || undefined}
          isIPadLandscape={isIPadLandscape}
        />
      );
    case "recentMistakes":
      return shouldShowRecentMistakes ? (
        <RecentMistakesCard
          recentMistakes={dashboardData.recentMistakes}
          style={style}
        />
      ) : null;
    case "streak":
      return (
        <UsageStreakCard
          currentStreak={currentStreak}
          longestStreak={longestStreak}
          freezeAvailable={freezeAvailable}
          freezeDaysUntilReload={freezeDaysUntilReload}
          recentDays={streakRecentDays}
          isLoading={isStreakLoading}
          error={streakError}
          style={style}
        />
      );
    case "extraStudy":
      return (
        <View style={[styles.section, { marginHorizontal: -16 }]}>
          <View style={[styles.sectionHeader, { paddingHorizontal: 16 }]}>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
              Extra Study
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Practice without affecting SRS
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.extraStudyHorizontalScroll}
            decelerationRate="fast"
            snapToAlignment="start"
            snapToInterval={172}
          >
            <View style={styles.extraStudyCardsRow}>
              {extraStudyItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.extraStudyCardContainer}
                  onPress={() => {
                    maybeHaptic();
                    if (!interactive) {
                      return;
                    }

                    if (item.id === "recent-lessons") {
                      router.push({
                        pathname: "/recent-lessons-review",
                        params: { window: recentLessonsWindow },
                      });
                      return;
                    }

                    router.push(item.route as any);
                  }}
                  activeOpacity={interactive ? 0.7 : 1}
                >
                  <View
                    style={[
                      styles.extraStudyCard,
                      {
                        backgroundColor: theme.cardBackground,
                        borderColor: theme.border,
                        shadowColor: theme.isDark ? "#000" : "rgba(0,0,0,0.1)",
                      },
                    ]}
                  >
                    <LinearGradient
                      colors={item.gradient as any}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cardIconContainer}
                    >
                      {item.iconText ? (
                        <Text
                          style={[
                            styles.cardIconText,
                            {
                              color: getReadableTextColor(
                                (item.gradient as string[])[1],
                              ),
                            },
                          ]}
                        >
                          {item.iconText}
                        </Text>
                      ) : (
                        <Ionicons
                          name={item.icon as any}
                          size={24}
                          color={getReadableTextColor((item.gradient as string[])[1])}
                        />
                      )}
                    </LinearGradient>

                    <View style={styles.cardInfo}>
                      <Text
                        style={[styles.extraStudyCardTitle, { color: theme.textColor }]}
                        numberOfLines={1}
                      >
                        {item.title}
                      </Text>
                      <Text
                        style={[
                          styles.extraStudyCardSubtitle,
                          { color: theme.textSecondary },
                        ]}
                        numberOfLines={2}
                      >
                        {item.subtitle}
                      </Text>
                    </View>

                    {item.hasActiveSession ? (
                      <View
                        style={[
                          styles.cardStatusBadge,
                          { backgroundColor: theme.secondary },
                        ]}
                      >
                        <Ionicons
                          name="play-circle"
                          size={11}
                          color={getReadableTextColor(theme.secondary)}
                        />
                        <Text
                          style={[
                            styles.cardStatusBadgeText,
                            { color: getReadableTextColor(theme.secondary) },
                          ]}
                          numberOfLines={1}
                        >
                          Resume
                        </Text>
                      </View>
                    ) : item.count !== undefined && item.count > 0 ? (
                      <View
                        style={[styles.cardBadge, { backgroundColor: theme.primary }]}
                      >
                        <Text
                          style={[
                            styles.cardBadgeText,
                            { color: getReadableTextColor(theme.primary) },
                          ]}
                        >
                          {item.count}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      );
    case "subjectLists":
      return (
        <SubjectListsEntryWidget
          interactive={interactive}
          onPress={() => {
            maybeHaptic();
            handleRoutePush("/subject-lists");
          }}
          style={style}
        />
      );
    case "reviewForecast":
      return (
        <ReviewForecast
          forecast={dashboardData.forecast}
          currentReviewCount={dashboardData.reviewCount}
          currentLevel={dashboardData.currentLevel}
          subjects={dashboardData.subjects}
          assignments={dashboardData.assignments}
        />
      );
    case "levelProgress":
      return (
        <LevelProgress
          level={dashboardData.currentLevel}
          completedCount={dashboardData.completedCount}
          totalCount={dashboardData.totalCount}
          srsStagesCompleted={dashboardData.srsStagesCompleted}
          srsStagesTotal={dashboardData.srsStagesTotal}
          levelTimeRemaining={dashboardData.levelTimeRemaining.timeText}
          levelTimeRemainingIsEstimate={dashboardData.levelTimeRemaining.isEstimate}
          items={dashboardData.levelItems}
          onItemPress={(item) => {
            if (!interactive) {
              return;
            }
            handleRoutePush(`/subject/${item.id}`);
          }}
        />
      );
    case "incompleteLevels":
      return (
        <IncompleteLevelsProgress
          subjects={dashboardData.subjects}
          assignments={dashboardData.assignments}
          currentLevel={dashboardData.currentLevel}
        />
      );
    case "recentUnlocks":
      return (
        <RecentUnlocks
          items={dashboardData.recentUnlocks}
          onItemPress={(item) => {
            if (!interactive) {
              return;
            }
            handleRoutePush(`/subject/${item.id}`);
          }}
          onViewAll={() => handleRoutePush("/unlocks")}
        />
      );
    case "criticalItems":
      return (
        <CriticalItems
          items={dashboardData.criticalItems}
          onItemPress={(item) => {
            if (!interactive) {
              return;
            }
            handleRoutePush(`/subject/${item.id}`);
          }}
          onViewAll={() => handleRoutePush("/critical")}
        />
      );
    case "burnedItems":
      return (
        <BurnedItems
          items={dashboardData.burnedItems}
          onItemPress={(item) => {
            if (!interactive) {
              return;
            }
            handleRoutePush(`/subject/${item.id}`);
          }}
          onViewAll={() => handleRoutePush("/burned")}
        />
      );
    case "reviewHeatmap":
      return <ReviewHeatmap assignments={dashboardData.assignments || []} />;
    case "levelTiming":
      return (
        <LevelTimingChart
          levelProgressions={dashboardData.levelProgressions}
          resets={dashboardData.resets}
          currentLevel={dashboardData.currentLevel}
        />
      );
    case "reviewStats":
      return (
        <ReviewStatsTable
          reviewStats={dashboardData.reviewStatistics}
          subjects={dashboardData.subjects}
          currentLevel={dashboardData.currentLevel}
        />
      );
    case "dailyStudyActivity":
      return (
        <TodayStudyActivityCard
          assignments={dashboardData.assignments || []}
          reviewStats={dashboardData.reviewStatistics || []}
          style={style}
        />
      );
    case "srsBreakdown":
      return (
        <View style={[styles.srsSection, style]}>
          <SrsBreakdown
            levels={dashboardData.srsLevels || []}
            assignments={dashboardData.assignments || []}
            subjects={dashboardData.subjects || []}
            viewMode={srsBreakdownView ?? "combined"}
            groupStagesScope={srsBreakdownGroupStagesScope ?? "shared"}
            style={
              srsBreakdownView && srsBreakdownView !== "combined"
                ? styles.srsBreakdownSplitCard
                : undefined
            }
            onStagePress={(stage, stageLabel, options) => {
              if (!interactive) {
                return;
              }
              router.push({
                pathname: "/srs-subjects",
                params: {
                  srsStage: stage.toString(),
                  stageName: stageLabel,
                  exactStage: options?.exactStage === false ? "false" : "true",
                },
              });
            }}
          />
        </View>
      );
    default:
      return null;
  }
}

function SubjectListsEntryWidget({
  interactive,
  onPress,
  style,
}: {
  interactive: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const { lists, isLoading } = useSubjectLists();
  const totalSubjectCount = useMemo(
    () => lists.reduce((total, list) => total + list.subjectIds.length, 0),
    [lists],
  );
  const listCountLabel = `${lists.length}`;
  const subjectCountLabel = `${totalSubjectCount}`;
  const summary = isLoading
    ? "Loading saved collections..."
    : lists.length > 0
      ? "Saved sets for custom lessons and reviews"
      : "Create a reusable set of subjects for focused study.";
  const metricSurfaceColor = theme.isDark
    ? "rgba(255,255,255,0.04)"
    : "rgba(255,255,255,0.72)";
  const mutedSurfaceColor = theme.isDark
    ? "rgba(255,255,255,0.035)"
    : "rgba(0,0,0,0.025)";
  const metricBorderColor = withAlpha(theme.border, theme.isDark ? 0.9 : 0.65);

  return (
    <TouchableOpacity
      style={[
        styles.subjectListsWidget,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
          shadowColor: theme.isDark ? "#000" : "rgba(0,0,0,0.1)",
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={interactive ? 0.75 : 1}
      disabled={!interactive}
      accessibilityRole="button"
      accessibilityLabel="Manage subject lists"
    >
      <View style={styles.subjectListsHeader}>
        <View style={styles.subjectListsHeaderLeft}>
          <View
            style={[
              styles.subjectListsIconBadge,
              {
                backgroundColor: withAlpha(
                  theme.primary,
                  theme.isDark ? 0.34 : 0.18,
                ),
              },
            ]}
          >
            <Ionicons name="list" size={20} color={theme.primary} />
          </View>
          <View style={styles.subjectListsHeadingText}>
            <Text style={[styles.subjectListsTitle, { color: theme.textColor }]}>
              Subject Lists
            </Text>
            <Text style={[styles.subjectListsSubtitle, { color: theme.textSecondary }]}>
              {summary}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.subjectListsManagePill,
            { backgroundColor: mutedSurfaceColor, borderColor: theme.border },
          ]}
        >
          <Text style={[styles.subjectListsManageText, { color: theme.textColor }]}>
            Manage
          </Text>
          <Ionicons name="chevron-forward" size={14} color={theme.textSecondary} />
        </View>
      </View>

      <View style={styles.subjectListsStatsRow}>
        <SubjectListsMetric
          icon="albums-outline"
          label="Lists"
          value={isLoading ? "-" : listCountLabel}
          theme={theme}
          surfaceColor={metricSurfaceColor}
          borderColor={metricBorderColor}
          accentColor={theme.primary}
        />
        <SubjectListsMetric
          icon="bookmark-outline"
          label="Saved Items"
          value={isLoading ? "-" : subjectCountLabel}
          theme={theme}
          surfaceColor={metricSurfaceColor}
          borderColor={metricBorderColor}
          accentColor={theme.secondary}
        />
      </View>
    </TouchableOpacity>
  );
}

function SubjectListsMetric({
  icon,
  label,
  value,
  theme,
  surfaceColor,
  borderColor,
  accentColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>["theme"];
  surfaceColor: string;
  borderColor: string;
  accentColor: string;
}) {
  return (
    <View
      style={[
        styles.subjectListsStat,
        {
          backgroundColor: surfaceColor,
          borderColor,
        },
      ]}
    >
      <View style={styles.subjectListsMetricTopRow}>
        <Ionicons name={icon} size={16} color={accentColor} />
        <Text
          style={[styles.subjectListsStatLabel, { color: theme.textSecondary }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <Text
        style={[styles.subjectListsStatValue, { color: theme.textColor }]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  vacationCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 8,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
  },
  vacationIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "rgba(245, 166, 35, 0.4)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  vacationTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  vacationSubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },
  vacationSince: {
    fontSize: 12,
    fontStyle: "italic",
  },
  section: {
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  sectionSubtitle: {
    fontSize: 14,
    marginLeft: 8,
  },
  extraStudyHorizontalScroll: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  extraStudyCardsRow: {
    flexDirection: "row",
  },
  extraStudyCardContainer: {
    width: 160,
    height: 160,
    marginRight: 12,
  },
  extraStudyCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    justifyContent: "space-between",
    borderWidth: 1,
    overflow: "hidden",
    elevation: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "rgba(0,0,0,0.2)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardIconText: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 26,
    includeFontPadding: false,
  },
  cardInfo: {
    marginTop: 8,
  },
  extraStudyCardTitle: {
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 2,
  },
  extraStudyCardSubtitle: {
    fontSize: 11,
    opacity: 0.8,
  },
  cardBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  cardBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
  },
  cardStatusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    minHeight: 20,
    maxWidth: 78,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  cardStatusBadgeText: {
    fontSize: 10,
    fontWeight: "bold",
    lineHeight: 12,
  },
  subjectListsWidget: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 14,
    marginBottom: 16,
    padding: 16,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subjectListsHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  subjectListsHeaderLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  subjectListsIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  subjectListsHeadingText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  subjectListsTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  subjectListsSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
  },
  subjectListsManagePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  subjectListsManageText: {
    fontSize: 12,
    fontWeight: "700",
  },
  subjectListsStatsRow: {
    flexDirection: "row",
    gap: 8,
  },
  subjectListsStat: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  subjectListsMetricTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  subjectListsStatValue: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
    fontVariant: ["tabular-nums"],
  },
  subjectListsStatLabel: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  srsSection: {
    marginBottom: 16,
  },
  srsBreakdownSplitCard: {
    flex: 1,
  },
  srsSectionHeader: {
    marginBottom: 20,
    alignItems: "center",
  },
  srsSectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },
  srsSectionDescription: {
    fontSize: 14,
    textAlign: "center",
  },
});
