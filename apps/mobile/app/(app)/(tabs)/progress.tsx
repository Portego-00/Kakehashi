import { Ionicons } from "@expo/vector-icons";
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import Svg, { Circle } from "react-native-svg";
import Animated, {
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from "react-native-reanimated";
import { GlassButton } from "../../../src/components/GlassButton";
import IncompleteLevelsProgress from "../../../src/components/IncompleteLevelsProgress";
import LevelProgress from "../../../src/components/LevelProgress";
import LevelTimingChart from "../../../src/components/LevelTimingChart";
import LoadingProgressBar from "../../../src/components/LoadingProgressBar";
import ReviewHeatmap from "../../../src/components/ReviewHeatmap";
import ReviewStatsTable from "../../../src/components/ReviewStatsTable";
import SrsBreakdown from "../../../src/components/SrsBreakdown";
import {
    BurnedItems,
    CriticalItems,
    RecentUnlocks,
} from "../../../src/components/UnlocksAndCritical";
import { useDashboardData } from "../../../src/hooks/useDashboardData";
import { CriticalItem, LevelItem, UnlockItem } from "../../../src/types/wanikani";
import {
    AllProgressData,
    calculateProgressData,
    getCategoryLabel,
} from "../../../src/utils/analyticsCalculations";
import { getAllSubjects } from "../../../src/utils/cache";
import { supportsNativeTabs } from "../../../src/utils/nativeTabs";
import { useSubjectColors, withAlpha } from "../../../src/utils/subjectColors";
import { useAuthStore, useSettingsStore } from "../../../src/utils/store";
import { useTheme } from "../../../src/utils/theme";

type TabSegment = 'level' | 'items' | 'analytics';
type ProgressCategory = 'jlpt' | 'joyo' | 'frequency';

export default function ProgressTab() {
  const { userData } = useAuthStore();
  const { customTabOrder } = useSettingsStore();
  const homeSrsBreakdownDisplayMode = useSettingsStore(
    (state) => state.homeSrsBreakdownDisplayMode,
  );
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const { width, height } = useWindowDimensions();
  const {
    dashboardData,
    isLoading,
    loadingProgress,
    refreshData,
    errorStatus,
  } = useDashboardData();

  // Check if items/analytics have their own tabs
  const itemsHasOwnTab = customTabOrder.includes('items');
  const analyticsHasOwnTab = customTabOrder.includes('analytics');

  // Build available segments based on what's NOT a separate tab
  const availableSegments: { key: TabSegment; label: string }[] = useMemo(() => {
    const segments: { key: TabSegment; label: string }[] = [
      { key: 'level', label: 'Level' },
      ...(!itemsHasOwnTab ? [{ key: 'items' as TabSegment, label: 'Items' }] : []),
      ...(!analyticsHasOwnTab ? [{ key: 'analytics' as TabSegment, label: 'Analytics' }] : []),
    ];

    return segments;
  }, [analyticsHasOwnTab, itemsHasOwnTab]);

  const [activeSegment, setActiveSegment] = useState<TabSegment>('level');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Reset selection if the current segment is no longer available
  useEffect(() => {
    const isCurrentSegmentAvailable = availableSegments.some(s => s.key === activeSegment);
    if (!isCurrentSegmentAvailable) {
      setActiveSegment('level');
      setSelectedIndex(0);
    }
  }, [availableSegments, activeSegment]);

  // Analytics state
  const [activeCategory, setActiveCategory] = useState<ProgressCategory>('jlpt');
  const [categorySelectedIndex, setCategorySelectedIndex] = useState(0);
  const [progressData, setProgressData] = useState<AllProgressData>({
    jlpt: {},
    joyo: {},
    frequency: {},
  });
  const [allSubjectsCatalog, setAllSubjectsCatalog] = useState<any[]>([]);
  const learnedThreshold = 5; // Always Guru 1

  useEffect(() => {
    let isMounted = true;

    getAllSubjects()
      .then((subjects) => {
        if (!isMounted) return;
        setAllSubjectsCatalog(Array.isArray(subjects) ? subjects : []);
      })
      .catch(() => {
        if (!isMounted) return;
        setAllSubjectsCatalog([]);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const learnedItemsProgress = useMemo(() => {
    const counts = {
      radicals: { learned: 0, total: 0 },
      kanji: { learned: 0, total: 0 },
      vocabulary: { learned: 0, total: 0 },
    };

    const assignments = Array.isArray(dashboardData.assignments)
      ? dashboardData.assignments
      : [];
    const subjects =
      allSubjectsCatalog.length > 0
        ? allSubjectsCatalog
        : Array.isArray(dashboardData.subjects)
          ? dashboardData.subjects
          : [];

    const subjectTypeById = new Map<number, string>();
    subjects.forEach((subject: any) => {
      if (typeof subject?.id === "number" && typeof subject?.object === "string") {
        subjectTypeById.set(subject.id, subject.object);
      }
    });

    subjects.forEach((subject: any) => {
      if (subject?.data?.hidden_at) {
        return;
      }

      const object = (subject?.object || "").toLowerCase();
      if (object === "radical") {
        counts.radicals.total += 1;
        return;
      }
      if (object === "kanji") {
        counts.kanji.total += 1;
        return;
      }
      if (object === "vocabulary" || object === "kana_vocabulary") {
        counts.vocabulary.total += 1;
      }
    });

    assignments.forEach((assignment: any) => {
      const data = assignment?.data ?? assignment;
      const srsStage = data?.srs_stage;
      if (typeof srsStage !== "number") {
        return;
      }

      const subjectId = data?.subject_id;
      const subjectTypeFromSubject =
        typeof subjectId === "number" ? subjectTypeById.get(subjectId) : undefined;
      const subjectType = (subjectTypeFromSubject || data?.subject_type || "").toLowerCase();

      if (subjectType === "radical") {
        if (srsStage >= learnedThreshold) {
          counts.radicals.learned += 1;
        }
        return;
      }
      if (subjectType === "kanji") {
        if (srsStage >= learnedThreshold) {
          counts.kanji.learned += 1;
        }
        return;
      }
      if (subjectType === "vocabulary" || subjectType === "kana_vocabulary") {
        if (srsStage >= learnedThreshold) {
          counts.vocabulary.learned += 1;
        }
      }
    });

    const withPercent = {
      radicals: {
        ...counts.radicals,
        percent:
          counts.radicals.total > 0
            ? Math.round((counts.radicals.learned / counts.radicals.total) * 100)
            : 0,
      },
      kanji: {
        ...counts.kanji,
        percent:
          counts.kanji.total > 0
            ? Math.round((counts.kanji.learned / counts.kanji.total) * 100)
            : 0,
      },
      vocabulary: {
        ...counts.vocabulary,
        percent:
          counts.vocabulary.total > 0
            ? Math.round((counts.vocabulary.learned / counts.vocabulary.total) * 100)
            : 0,
      },
    };

    return withPercent;
  }, [allSubjectsCatalog, dashboardData.assignments, dashboardData.subjects, learnedThreshold]);

  // Animation values for analytics
  const progressFadeOpacity = useSharedValue(1);
  const cardHeight = useSharedValue(0);

  // Calculate progress data when dashboard data changes or threshold changes
  useEffect(() => {
    if (dashboardData.subjects && dashboardData.subjects.length > 0 &&
        dashboardData.assignments && dashboardData.assignments.length > 0) {
      const newProgressData = calculateProgressData(
        dashboardData.subjects,
        dashboardData.assignments,
        learnedThreshold
      );
      setProgressData(newProgressData);
    }
  }, [dashboardData.subjects, dashboardData.assignments, learnedThreshold]);

  // Update card height when progress data changes (for analytics)
  useEffect(() => {
    if (activeSegment !== 'analytics') return;

    const categoryData = progressData[activeCategory] || {};
    const itemCount = Object.keys(categoryData).length;
    const selectorHeight = 52;
    const spacingAfterSelector = 20;
    const itemHeight = 60;
    const lastItemReduction = 16;
    const cardBottomPadding = 32;

    const newHeight = itemCount > 0
      ? selectorHeight + spacingAfterSelector + (itemCount * itemHeight) - lastItemReduction + cardBottomPadding
      : selectorHeight + spacingAfterSelector + cardBottomPadding;

    cardHeight.value = withSpring(newHeight, {
      damping: 16,
      stiffness: 140,
      mass: 0.8,
    });
  }, [progressData, activeCategory, cardHeight, activeSegment]);

  // Set initial height for analytics
  useEffect(() => {
    if (activeSegment === 'analytics' && cardHeight.value === 0) {
      const categoryData = progressData[activeCategory] || {};
      const itemCount = Object.keys(categoryData).length;
      const selectorHeight = 52;
      const spacingAfterSelector = 20;
      const itemHeight = 60;
      const lastItemReduction = 16;
      const cardBottomPadding = 32;

      const initialHeight = itemCount > 0
        ? selectorHeight + spacingAfterSelector + (itemCount * itemHeight) - lastItemReduction + cardBottomPadding
        : selectorHeight + spacingAfterSelector + cardBottomPadding;
      cardHeight.value = initialHeight;
    }
  }, [progressData, activeCategory, cardHeight, activeSegment]);

  const onRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await refreshData();
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshData]);

  const handleItemPress = (item: LevelItem) => {
    router.push(`/subject/${item.id}`);
  };

  const handleUnlockItemPress = (item: UnlockItem) => {
    router.push(`/subject/${item.id}`);
  };

  const handleCriticalItemPress = (item: CriticalItem) => {
    router.push(`/subject/${item.id}`);
  };

  const handleViewAllUnlocks = () => {
    router.push("/unlocks");
  };

  const handleViewAllCritical = () => {
    router.push("/critical");
  };

  const handleSegmentChange = (index: number) => {
    if (index < 0 || index >= availableSegments.length) {
      return;
    }
    setSelectedIndex(index);
    setActiveSegment(availableSegments[index].key);
  };

  const switchCategory = (newCategory: ProgressCategory) => {
    if (newCategory === activeCategory) return;

    progressFadeOpacity.value = withTiming(0, { duration: 100 }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(setActiveCategory)(newCategory);
      }
    });
  };

  // Fade in the new category only after React has committed the new state
  useEffect(() => {
    if (activeSegment === 'analytics') {
      progressFadeOpacity.value = withTiming(1, { duration: 100 });
    }
  }, [activeCategory, progressFadeOpacity, activeSegment]);

  const handleCategorySegmentChange = (index: number) => {
    const categories: ProgressCategory[] = ['jlpt', 'joyo', 'frequency'];
    setCategorySelectedIndex(index);
    switchCategory(categories[index]);
  };

  const getCategoryData = () => {
    return progressData[activeCategory] || {};
  };

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      opacity: progressFadeOpacity.value,
    };
  });

  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      height: cardHeight.value,
    };
  });

  // Show initial loading only if we have no data at all
  if (isLoading && Object.keys(dashboardData).length === 0 && !dashboardData.dataLoadingState?.userData) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={theme.secondary} />
        <Text style={[styles.loadingText, { color: theme.textColor }]}>Loading data...</Text>
      </View>
    );
  }

  const shouldUseNativeTabsPadding = supportsNativeTabs();
  const isIPadLandscape = width > 768 && width > height;

  const getHeaderTitle = () => {
    switch (activeSegment) {
      case 'level':
        return 'Level Progress';
      case 'items':
        return 'Item Collections';
      case 'analytics':
        return 'Analytics';
    }
  };

  const getHeaderSubtitle = () => {
    switch (activeSegment) {
      case 'level':
        return `Level ${dashboardData.dataLoadingState?.userData ? dashboardData.currentLevel : (userData?.level || 1)}`;
      case 'items':
        return 'Unlocks, critical items, and more';
      case 'analytics':
        return 'Progress insights and statistics';
    }
  };

  const headerIconColor = theme.isDark ? theme.headerText : '#000000';

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />
      <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.headerText }]}>{getHeaderTitle()}</Text>
          <Text style={[styles.headerSubtitle, { color: theme.headerText }]}>
            {getHeaderSubtitle()}
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <GlassButton
            iconName="search-outline"
            onPress={() => router.push("/search")}
            iconColor={headerIconColor}
          />
          <GlassButton
            iconName="settings-outline"
            onPress={() => router.push("/settings")}
            iconColor={headerIconColor}
          />
        </View>
      </View>

      {/* Segmented Control - only show if there's more than one segment */}
      {availableSegments.length > 1 && (
        <View style={[styles.segmentedControlWrapper, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
          <SegmentedControl
            values={availableSegments.map(s => s.label)}
            selectedIndex={selectedIndex}
            onChange={(event) => {
              handleSegmentChange(event.nativeEvent.selectedSegmentIndex);
            }}
            style={styles.mainSegmentedControl}
            tintColor={theme.primary}
            fontStyle={{ color: theme.textSecondary, fontSize: 14 }}
            activeFontStyle={{ color: '#fff', fontSize: 14, fontWeight: '600' }}
          />
        </View>
      )}

      <LoadingProgressBar
        isLoading={isLoading}
        progress={loadingProgress}
        color={theme.secondary}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.scrollViewContent, shouldUseNativeTabsPadding && styles.nativeTabsPadding]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            progressViewOffset={10}
            tintColor={theme.primary}
          />
        }
      >
        {errorStatus && (
          <View style={[styles.errorContainer, { backgroundColor: theme.isDark ? 'rgba(100, 30, 30, 0.5)' : 'rgba(255, 235, 235, 0.9)' }]}>
            <Ionicons
              name="warning-outline"
              size={20}
              color={theme.error}
              style={{ marginRight: 8 }}
            />
            <Text style={[styles.errorText, { color: theme.error }]}>{errorStatus}</Text>
          </View>
        )}

        <View style={styles.cardsContainer}>
          {/* Level Progress Content */}
          {activeSegment === 'level' && (
            <>
              <LevelProgress
                level={dashboardData.currentLevel}
                completedCount={dashboardData.completedCount}
                totalCount={dashboardData.totalCount}
                srsStagesCompleted={dashboardData.srsStagesCompleted}
                srsStagesTotal={dashboardData.srsStagesTotal}
                levelTimeRemaining={dashboardData.levelTimeRemaining.timeText}
                levelTimeRemainingIsEstimate={
                  dashboardData.levelTimeRemaining.isEstimate
                }
                items={dashboardData.levelItems}
                onItemPress={handleItemPress}
              />

              {dashboardData.subjects && dashboardData.assignments && (
                <IncompleteLevelsProgress
                  subjects={dashboardData.subjects}
                  assignments={dashboardData.assignments}
                  currentLevel={dashboardData.currentLevel}
                />
              )}
            </>
          )}

          {/* Items Content */}
          {activeSegment === 'items' && (
            <>
              <RecentUnlocks
                items={dashboardData.recentUnlocks}
                onItemPress={handleUnlockItemPress}
                onViewAll={handleViewAllUnlocks}
              />

              <CriticalItems
                items={dashboardData.criticalItems}
                onItemPress={handleCriticalItemPress}
                onViewAll={handleViewAllCritical}
              />

              <BurnedItems 
                items={dashboardData.burnedItems || []} 
                onItemPress={(item) => router.push(`/subject/${item.id}`)}
                onViewAll={() => router.push('/burned')}
              />
            </>
          )}

          {/* Analytics Content */}
          {activeSegment === 'analytics' && (
            <>
              <ReviewHeatmap assignments={dashboardData.assignments || []} />

              <LevelTimingChart
                levelProgressions={dashboardData.levelProgressions}
                resets={dashboardData.resets}
                currentLevel={dashboardData.currentLevel}
              />

              <ReviewStatsTable
                reviewStats={dashboardData.reviewStatistics}
                subjects={dashboardData.subjects}
                currentLevel={dashboardData.currentLevel}
              />

              {/* Progress card */}
              <Animated.View style={[styles.progressCard, { backgroundColor: theme.cardBackground }, animatedCardStyle]}>
                <View style={[styles.categorySegmentedControlContainer, { backgroundColor: theme.cardBackground }]}>
                  <SegmentedControl
                    values={['JLPT', 'Jōyō', 'Frequency']}
                    selectedIndex={categorySelectedIndex}
                    onChange={(event) => {
                      handleCategorySegmentChange(event.nativeEvent.selectedSegmentIndex);
                    }}
                    style={styles.categorySegmentedControl}
                    tintColor={theme.primary}
                    fontStyle={{ color: theme.textSecondary, fontSize: 14 }}
                    activeFontStyle={{ color: '#fff', fontSize: 14, fontWeight: '600' }}
                  />
                </View>

                <Animated.View key={activeCategory} style={[styles.progressBarsContainer, animatedProgressStyle]}>
                  {Object.entries(getCategoryData()).map(([key, data], index, array) => (
                    <AnimatedProgressBar
                      key={`${activeCategory}-${key}`}
                      label={getCategoryLabel(activeCategory, key)}
                      learned={data.learned}
                      total={data.total}
                      percent={data.percent}
                      theme={theme}
                      isLast={index === array.length - 1}
                      category={activeCategory}
                      level={key}
                      learnedThreshold={learnedThreshold}
                    />
                  ))}
                </Animated.View>
              </Animated.View>

              {homeSrsBreakdownDisplayMode === "split" ? (
                isIPadLandscape ? (
                  <View style={styles.srsSplitRow}>
                    <View style={styles.srsSplitColumn}>
                      <View style={styles.srsSplitCardBlock}>
                        <SrsBreakdown
                          levels={dashboardData.srsLevels || []}
                          assignments={dashboardData.assignments || []}
                          subjects={dashboardData.subjects || []}
                          viewMode="graph"
                          groupStagesScope="graph"
                          style={[styles.unifiedCardNoBorder, styles.srsSplitCard]}
                          onStagePress={(stage, stageLabel, options) => {
                            router.push({
                              pathname: '/srs-subjects',
                              params: {
                                srsStage: stage.toString(),
                                stageName: stageLabel,
                                exactStage: options?.exactStage === false ? 'false' : 'true',
                              }
                            });
                          }}
                        />
                      </View>
                    </View>
                    <View style={styles.srsSplitColumn}>
                      <View style={styles.srsSplitCardBlock}>
                        <SrsBreakdown
                          levels={dashboardData.srsLevels || []}
                          assignments={dashboardData.assignments || []}
                          subjects={dashboardData.subjects || []}
                          viewMode="details"
                          groupStagesScope="details"
                          style={[styles.unifiedCardNoBorder, styles.srsSplitCard]}
                          onStagePress={(stage, stageLabel, options) => {
                            router.push({
                              pathname: '/srs-subjects',
                              params: {
                                srsStage: stage.toString(),
                                stageName: stageLabel,
                                exactStage: options?.exactStage === false ? 'false' : 'true',
                              }
                            });
                          }}
                        />
                      </View>
                    </View>
                  </View>
                ) : (
                  <>
                    <View style={styles.cardBlock}>
                      <SrsBreakdown
                        levels={dashboardData.srsLevels || []}
                        assignments={dashboardData.assignments || []}
                        subjects={dashboardData.subjects || []}
                        viewMode="graph"
                        groupStagesScope="graph"
                        style={styles.unifiedCardNoBorder}
                        onStagePress={(stage, stageLabel, options) => {
                          router.push({
                            pathname: '/srs-subjects',
                            params: {
                              srsStage: stage.toString(),
                              stageName: stageLabel,
                              exactStage: options?.exactStage === false ? 'false' : 'true',
                            }
                          });
                        }}
                      />
                    </View>
                    <View style={styles.cardBlock}>
                      <SrsBreakdown
                        levels={dashboardData.srsLevels || []}
                        assignments={dashboardData.assignments || []}
                        subjects={dashboardData.subjects || []}
                        viewMode="details"
                        groupStagesScope="details"
                        style={styles.unifiedCardNoBorder}
                        onStagePress={(stage, stageLabel, options) => {
                          router.push({
                            pathname: '/srs-subjects',
                            params: {
                              srsStage: stage.toString(),
                              stageName: stageLabel,
                              exactStage: options?.exactStage === false ? 'false' : 'true',
                            }
                          });
                        }}
                      />
                    </View>
                  </>
                )
              ) : (
                <View style={styles.cardBlock}>
                  <SrsBreakdown
                    levels={dashboardData.srsLevels || []}
                    assignments={dashboardData.assignments || []}
                    subjects={dashboardData.subjects || []}
                    viewMode={
                      homeSrsBreakdownDisplayMode === "graph"
                        ? "graph"
                        : homeSrsBreakdownDisplayMode === "details"
                          ? "details"
                          : "combined"
                    }
                    style={styles.unifiedCardNoBorder}
                    onStagePress={(stage, stageLabel, options) => {
                      router.push({
                        pathname: '/srs-subjects',
                        params: {
                          srsStage: stage.toString(),
                          stageName: stageLabel,
                          exactStage: options?.exactStage === false ? 'false' : 'true',
                        }
                      });
                    }}
                  />
                </View>
              )}

              <View style={styles.cardBlock}>
                <View
                  style={[
                    styles.learnedItemsCard,
                    { backgroundColor: theme.cardBackground },
                  ]}
                >
                  <Text style={[styles.learnedItemsTitle, { color: theme.textColor }]}>
                    Learned Items
                  </Text>

                  <View style={styles.learnedItemsStatsRow}>
                    <ProgressRing
                      label="Radicals"
                      learned={learnedItemsProgress.radicals.learned}
                      percent={learnedItemsProgress.radicals.percent}
                      color={subjectColors.radical}
                      textColor={theme.textColor}
                      secondaryTextColor={theme.textSecondary}
                      trackColor={withAlpha(subjectColors.radical, theme.isDark ? 0.32 : 0.2)}
                    />
                    <ProgressRing
                      label="Kanji"
                      learned={learnedItemsProgress.kanji.learned}
                      percent={learnedItemsProgress.kanji.percent}
                      color={subjectColors.kanji}
                      textColor={theme.textColor}
                      secondaryTextColor={theme.textSecondary}
                      trackColor={withAlpha(subjectColors.kanji, theme.isDark ? 0.32 : 0.2)}
                    />
                    <ProgressRing
                      label="Vocabulary"
                      learned={learnedItemsProgress.vocabulary.learned}
                      percent={learnedItemsProgress.vocabulary.percent}
                      color={subjectColors.vocabulary}
                      textColor={theme.textColor}
                      secondaryTextColor={theme.textSecondary}
                      trackColor={withAlpha(subjectColors.vocabulary, theme.isDark ? 0.32 : 0.2)}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.cardBlock}>
                <TouchableOpacity
                  style={[
                    styles.kanjiGridActionRow,
                    {
                      backgroundColor: theme.cardBackground,
                    },
                  ]}
                  onPress={() => router.push("/kanji-grid")}
                  activeOpacity={0.85}
                >
                  <View
                    style={[
                      styles.kanjiGridActionIcon,
                      {
                        backgroundColor: theme.primary,
                      },
                    ]}
                  >
                    <Ionicons name="grid-outline" size={28} color="#ffffff" />
                  </View>
                  <Text style={[styles.kanjiGridActionText, { color: theme.textColor }]}>
                    Open Kanji Grid Heatmap
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

interface AnimatedProgressBarProps {
  label: string;
  learned: number;
  total: number;
  percent: number;
  theme: any;
  isLast?: boolean;
  category: ProgressCategory;
  level: string;
  learnedThreshold: number;
}

function AnimatedProgressBar({ label, learned, total, percent, theme, isLast = false, category, level, learnedThreshold }: AnimatedProgressBarProps) {
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    progressWidth.value = withTiming(percent, { duration: 220 });
  }, [percent, progressWidth]);

  const animatedProgressStyle = useAnimatedStyle(() => {
    return {
      width: `${progressWidth.value}%`,
    };
  });

  const getProgressColor = (percent: number) => {
    if (percent >= 80) return '#4CAF50';
    if (percent >= 60) return '#FF9800';
    if (percent >= 40) return '#FFC107';
    return '#F44336';
  };

  const progressColor = getProgressColor(percent);

  const handlePress = () => {
    router.push({
      pathname: "/kanji-progress",
      params: {
        category,
        level,
        learnedThreshold: learnedThreshold.toString(),
      }
    });
  };

  return (
    <TouchableOpacity
      style={[styles.progressBarRow, isLast && styles.progressBarRowLast]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={styles.progressBarInfo}>
        <View style={styles.progressBarLabelContainer}>
          <Text style={[styles.progressBarLabel, { color: theme.textColor }]}>{label}</Text>
          <View style={styles.progressBarActions}>
            <TouchableOpacity
              style={[styles.viewDetailsButton, { backgroundColor: theme.isDark ? '#333' : '#f0f0f0' }]}
              onPress={handlePress}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="list" size={14} color={theme.textSecondary} />
              <Text style={[styles.viewDetailsText, { color: theme.textSecondary }]}>View</Text>
            </TouchableOpacity>
            <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
          </View>
        </View>
        <View style={styles.progressBarStatsContainer}>
          <Text style={[styles.progressBarPercent, { color: theme.textColor }]}>{percent}%</Text>
          <Text style={[styles.progressBarStats, { color: theme.textSecondary }]}>
            ({learned}/{total})
          </Text>
        </View>
      </View>

      <View style={[styles.progressBarTrack, { backgroundColor: theme.isDark ? '#2a2a2a' : '#f0f0f0' }]}>
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              backgroundColor: progressColor,
            },
            animatedProgressStyle,
          ]}
        />
      </View>
    </TouchableOpacity>
  );
}

interface ProgressRingProps {
  label: string;
  learned: number;
  percent: number;
  color: string;
  textColor: string;
  secondaryTextColor: string;
  trackColor: string;
}

function ProgressRing({
  label,
  learned,
  percent,
  color,
  textColor,
  secondaryTextColor,
  trackColor,
}: ProgressRingProps) {
  const size = 84;
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const safePercent = Math.max(0, Math.min(100, percent));
  const strokeDashoffset = circumference * (1 - safePercent / 100);

  return (
    <View style={styles.learnedRingItem}>
      <View style={styles.learnedRingWrap}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={trackColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.learnedRingCenter}>
          <Text style={[styles.learnedRingCenterValue, { color: textColor }]}>
            {learned.toLocaleString("en-US")}
          </Text>
        </View>
      </View>
      <Text style={[styles.learnedRingLabel, { color: secondaryTextColor }]}>
        {label}
      </Text>
      <Text style={[styles.learnedRingPercent, { color: secondaryTextColor }]}>
        {safePercent}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  errorText: {
    fontSize: 14,
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    position: "relative",
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: 'rgba(0, 0, 0, 0.15)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  headerContent: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  segmentedControlWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  mainSegmentedControl: {
    height: 36,
  },
  content: {
    flex: 1,
  },
  scrollViewContent: {
  },
  nativeTabsPadding: {
    paddingBottom: 120,
  },
  cardsContainer: {
    padding: 16,
  },
  cardBlock: {
    marginHorizontal: 4,
    marginBottom: 16,
  },
  unifiedCardNoBorder: {
    borderWidth: 0,
    borderRadius: 16,
  },
  srsSplitRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "stretch",
    marginBottom: 16,
  },
  srsSplitColumn: {
    flex: 1,
    minWidth: 0,
  },
  srsSplitCardBlock: {
    flex: 1,
    marginHorizontal: 4,
  },
  srsSplitCard: {
    flex: 1,
  },
  kanjiGridActionRow: {
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "rgba(0,0,0,0.15)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  kanjiGridActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  kanjiGridActionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  learnedItemsCard: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: "rgba(0,0,0,0.15)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  learnedItemsTitle: {
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.2,
    marginBottom: 10,
  },
  learnedItemsStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  learnedRingItem: {
    flex: 1,
    alignItems: "center",
  },
  learnedRingWrap: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  learnedRingCenter: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  learnedRingCenterValue: {
    fontSize: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  learnedRingLabel: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  learnedRingPercent: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  // Analytics-specific styles
  categorySegmentedControlContainer: {
    padding: 4,
    borderRadius: 8,
    marginBottom: 20,
  },
  categorySegmentedControl: {
    height: 36,
  },
  progressCard: {
    padding: 20,
    borderRadius: 16,
    marginHorizontal: 4,
    marginBottom: 16,
    shadowColor: "rgba(0,0,0,0.15)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
    overflow: 'hidden',
  },
  progressBarsContainer: {
    marginTop: 4,
  },
  progressBarRow: {
    marginBottom: 16,
  },
  progressBarRowLast: {
    marginBottom: 0,
  },
  progressBarInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBarLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  progressBarLabel: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  progressBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressBarStatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarPercent: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  progressBarTrack: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressBarStats: {
    fontSize: 12,
  },
});
