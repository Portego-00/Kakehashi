import { Ionicons } from "@expo/vector-icons";
import SegmentedControl from '@react-native-segmented-control/segmented-control';
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { GlassButton } from "../../../src/components/GlassButton";
import LevelTimingChart from "../../../src/components/LevelTimingChart";
import LoadingProgressBar from "../../../src/components/LoadingProgressBar";
import ReviewHeatmap from "../../../src/components/ReviewHeatmap";
import ReviewStatsTable from "../../../src/components/ReviewStatsTable";
import SrsBreakdown from "../../../src/components/SrsBreakdown";
import TodayStudyActivityCard from "../../../src/components/TodayStudyActivityCard";
import { useDashboardData } from "../../../src/hooks/useDashboardData";
import {
  AllProgressData,
  calculateProgressData,
  getCategoryLabel,
} from "../../../src/utils/analyticsCalculations";
import { endSession, startPerformanceTimer, startSession } from "../../../src/utils/performanceLogger";
import { supportsNativeTabs } from "../../../src/utils/nativeTabs";
import { useTheme } from "../../../src/utils/theme";

type ProgressCategory = 'jlpt' | 'joyo' | 'frequency';

export default function AnalyticsTab() {
  const { theme } = useTheme();
  const {
    dashboardData,
    isLoading,
    loadingProgress,
    refreshData,
    errorStatus,
    isFreshData,
  } = useDashboardData();
  

  const [activeCategory, setActiveCategory] = useState<ProgressCategory>('jlpt');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [progressData, setProgressData] = useState<AllProgressData>({
    jlpt: {},
    joyo: {},
    frequency: {},
  });
  // Removed unused screenData state used only for orientation changes
  const learnedThreshold = 5; // Always Guru 1

  // Animation values
  const progressFadeOpacity = useSharedValue(1);
  const cardHeight = useSharedValue(0);

  // Removed orientation change listener (unused)

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

  // Update card height when progress data changes
  useEffect(() => {
    const categoryData = progressData[activeCategory] || {};
    const itemCount = Object.keys(categoryData).length;
    // Calculate height more accurately:
    // - Selector: 52px (44px + 8px padding)
    // - Spacing after selector: 20px
    // - Each progress bar: 
    //   * Info section (label + stats): 32px
    //   * Progress track: 12px
    //   * Bottom margin: 16px
    //   * Total per item: 60px
    // - Last item has no bottom margin, so subtract 16px
    // - Add bottom padding for the card: 32px (extra padding for JLPT/frequency)
    const selectorHeight = 52;
    const spacingAfterSelector = 20;
    const itemHeight = 60; // includes bottom margin
    const lastItemReduction = 16; // last item has no bottom margin
    const cardBottomPadding = 32; // Increased padding for JLPT/frequency
    
    const newHeight = itemCount > 0 
      ? selectorHeight + spacingAfterSelector + (itemCount * itemHeight) - lastItemReduction + cardBottomPadding
      : selectorHeight + spacingAfterSelector + cardBottomPadding;
    
    cardHeight.value = withSpring(newHeight, {
      damping: 16,
      stiffness: 140,
      mass: 0.8,
    });
  }, [progressData, activeCategory, cardHeight]);

  // Set initial height
  useEffect(() => {
    if (cardHeight.value === 0) {
      const categoryData = progressData[activeCategory] || {};
      const itemCount = Object.keys(categoryData).length;
      const selectorHeight = 52;
      const spacingAfterSelector = 20;
      const itemHeight = 60;
      const lastItemReduction = 16;
      const cardBottomPadding = 32; // Increased padding for JLPT/frequency
      
      const initialHeight = itemCount > 0 
        ? selectorHeight + spacingAfterSelector + (itemCount * itemHeight) - lastItemReduction + cardBottomPadding
        : selectorHeight + spacingAfterSelector + cardBottomPadding;
      cardHeight.value = initialHeight;
    }
  }, [progressData, activeCategory, cardHeight]);

  const onRefresh = useCallback(async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    const sessionId = startSession('Analytics Refresh');
    const timer = startPerformanceTimer('Analytics onRefresh', 'analytics.tsx');
    
    try {
      await refreshData();
      timer.end({ sessionId });
    } catch (error: unknown) {
      timer.end({ sessionId, error: error instanceof Error ? error.message : String(error) }, false);
      throw error;
    } finally {
      endSession();
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshData]);

  const switchCategory = (newCategory: ProgressCategory) => {
    if (newCategory === activeCategory) return;

    progressFadeOpacity.value = withTiming(0, { duration: 100 }, (finished) => {
      'worklet';
      if (finished) {
        // Use runOnJS to call the state setter on the JS thread
        runOnJS(setActiveCategory)(newCategory);
      }
    });
  };

  // Fade in the new category only after React has committed the new state
  useEffect(() => {
    // Ensure this runs after the new content is rendered
    progressFadeOpacity.value = withTiming(1, { duration: 100 });
  }, [activeCategory, progressFadeOpacity]);

  // Handle segmented control change
  const handleSegmentedControlChange = (index: number) => {
    const categories: ProgressCategory[] = ['jlpt', 'joyo', 'frequency'];
    setSelectedIndex(index);
    switchCategory(categories[index]);
  };

  const getCategoryData = () => {
    return progressData[activeCategory] || {};
  };

  // Removed unused getSRSLevelName helper

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

  // Show initial loading only if we have no cached data
  if (isLoading && !isFreshData && !dashboardData.subjects) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={theme.secondary} />
        <Text style={[styles.loadingText, { color: theme.textColor }]}>Loading analytics data...</Text>
      </View>
    );
  }

  const shouldUseNativeTabsPadding = supportsNativeTabs();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <View style={[styles.header, { backgroundColor: theme.headerBackground }]}>
        <View style={styles.headerOverlay} />
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.headerText }]}>Analytics</Text>
          <Text style={[styles.headerSubtitle, { color: theme.headerText }]}>
            Progress insights and statistics
          </Text>
        </View>
        <View style={styles.headerButtons}>
          <GlassButton
            iconName="search-outline"
            onPress={() => router.push("/search")}
            iconColor={theme.headerText}
          />
          <GlassButton
            iconName="settings-outline"
            onPress={() => router.push("/settings")}
            iconColor={theme.headerText}
          />
        </View>
      </View>

      <LoadingProgressBar
        isLoading={isLoading}
        progress={loadingProgress}
        color={theme.secondary}
        style={{ marginTop: 0 }}
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

        <View style={styles.contentContainer}>
          {/* Review activity heatmap showing daily review counts over the year */}
          <ReviewHeatmap assignments={dashboardData.assignments || []} />
          
          {/* Level timing chart showing completion times for each level */}
          <LevelTimingChart 
            levelProgressions={dashboardData.levelProgressions}
            resets={dashboardData.resets}
            currentLevel={dashboardData.currentLevel}
          />
          
          {/* Review statistics table showing total reviews and accuracy */}
          <ReviewStatsTable 
            reviewStats={dashboardData.reviewStatistics}
            subjects={dashboardData.subjects}
            currentLevel={dashboardData.currentLevel}
          />

          <TodayStudyActivityCard
            assignments={dashboardData.assignments || []}
            reviewStats={dashboardData.reviewStatistics || []}
          />

          {/* Progress Section */}
          <View style={styles.progressSection}>
            <Animated.View style={[styles.progressCard, { backgroundColor: theme.cardBackground }, animatedCardStyle]}>
              {/* Category Selector inside card */}
              <View style={[styles.segmentedControlContainer, { backgroundColor: theme.cardBackground }]}>
                <SegmentedControl
                  values={['JLPT', 'Jōyō', 'Frequency']}
                  selectedIndex={selectedIndex}
                  onChange={(event) => {
                    handleSegmentedControlChange(event.nativeEvent.selectedSegmentIndex);
                  }}
                  style={styles.segmentedControl}
                  tintColor={theme.primary}
                  fontStyle={{ color: theme.textSecondary, fontSize: 14 }}
                  activeFontStyle={{ color: '#fff', fontSize: 14, fontWeight: '600' }}
                />
              </View>

              {/* Progress bars */}
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
          </View>

          {/* SRS Breakdown Section */}
          <View
            style={[
              styles.section,
              styles.sectionBeforeKanjiGrid,
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                SRS Breakdown
              </Text>
              <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
                Distribution of items across SRS levels
              </Text>
            </View>
            <SrsBreakdown
              levels={dashboardData.srsLevels || []}
              assignments={dashboardData.assignments || []}
              subjects={dashboardData.subjects || []}
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

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                Kanji Grid
              </Text>
              <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>
                Heatmap view of all kanji by SRS strength
              </Text>
            </View>
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
    if (percent >= 80) return '#4CAF50'; // Green
    if (percent >= 60) return '#FF9800'; // Orange
    if (percent >= 40) return '#FFC107'; // Yellow
    return '#F44336'; // Red
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
        {/* Simple flat progress bar */}
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
    flexDirection: 'row',
    alignItems: 'center',
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
    fontWeight: 'bold',
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
  content: {
    flex: 1,
  },
  scrollViewContent: {
    paddingTop: 0,
  },
  nativeTabsPadding: {
    paddingBottom: 120,
  },
  contentContainer: {
    padding: 16,
  },
  kanjiGridActionRow: {
    marginHorizontal: 4,
    marginTop: 2,
    marginBottom: 10,
    borderRadius: 14,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
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
  segmentedControlContainer: {
    padding: 4,
    borderRadius: 8,
    marginBottom: 20,
  },
  segmentedControl: {
    height: 36,
  },
  progressSection: {
    flex: 1,
  },
  section: {
    paddingVertical: 16,
  },
  sectionBeforeKanjiGrid: {
    paddingBottom: 6,
  },
  sectionHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  sectionDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
  progressCard: {
    padding: 20,
    borderRadius: 16,
    marginHorizontal: 4,
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
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingPlaceholder: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 4,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
  },
});
