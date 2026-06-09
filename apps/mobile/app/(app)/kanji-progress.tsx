import { Ionicons } from "@expo/vector-icons";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { FlashList } from "@shopify/flash-list";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { getSRSColorByStage } from "../../src/constants/srsColors";
import {
  FREQUENCY_TOTALS,
  getFrequencyBracketName,
  getKanjiForBracket,
} from "../../src/data/frequencyKanji";
import { getKanjiForLevel, JLPT_TOTALS } from "../../src/data/jlptKanji";
import {
  getJoyoGradeLabel,
  getJoyoGradeName,
  getKanjiForGrade,
  JOYO_TOTALS,
} from "../../src/data/joyoKanji";
import { useDashboardData } from "../../src/hooks/useDashboardData";
import { getAllSubjects } from "../../src/utils/cache";
import { useTheme } from "../../src/utils/theme";

type ProgressCategory = "jlpt" | "joyo" | "frequency";
type KanjiData = {
  kanji: string;
  learned: boolean;
  srsStage: number;
  wanikaniLevel?: number;
  inWanikani: boolean;
};

export default function KanjiProgressScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams();
  const { dashboardData, isLoading } = useDashboardData();

  const category = params.category as ProgressCategory;
  const level = params.level as string;
  const learnedThreshold = parseInt(params.learnedThreshold as string) || 5;

  const [selectedSubLevel, setSelectedSubLevel] = useState<string>(level);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [screenData, setScreenData] = useState(Dimensions.get("window"));
  const [allSubjects, setAllSubjects] = useState<any[] | null>(null);

  // Set initial selectedIndex based on level parameter
  useEffect(() => {
    const subLevels = getSubLevels();
    const index = subLevels.indexOf(level);
    if (index !== -1) {
      setSelectedIndex(index);
    }
  }, [level]);

  // Handle segmented control change
  const handleSegmentedControlChange = (index: number) => {
    const subLevels = getSubLevels();
    setSelectedIndex(index);
    setSelectedSubLevel(subLevels[index]);
  };

  // Listen for orientation changes
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setScreenData(window);
    });
    return () => subscription?.remove();
  }, []);

  // Load all subjects from cache
  useEffect(() => {
    const loadAllSubjects = async () => {
      try {
        const subjects = await getAllSubjects();
        setAllSubjects(subjects);
      } catch (error) {
        console.error("Error loading all subjects:", error);
      }
    };

    loadAllSubjects();
  }, []);

  // Calculate grid columns based on screen width
  const numColumns = Math.floor(screenData.width / 60); // ~60px per kanji including margin

  // Get all sub-levels for the category
  const getSubLevels = () => {
    switch (category) {
      case "jlpt":
        return ["N5", "N4", "N3", "N2", "N1"];
      case "joyo":
        return ["1", "2", "3", "4", "5", "6", "9"];
      case "frequency":
        return ["500", "1000", "1500", "2000", "2500"];
      default:
        return [];
    }
  };

  // Memoize the lookup maps to avoid recreating them on every render
  const lookupMaps = useMemo(() => {
    if (!dashboardData.subjects || !dashboardData.assignments || !allSubjects) {
      return null;
    }

    // Create assignment lookup for faster access
    const assignmentMap = new Map<number, any>();
    dashboardData.assignments.forEach((assignment: any) => {
      assignmentMap.set(assignment.data.subject_id, assignment);
    });

    // Create subject lookup by kanji character from user's started subjects
    const startedKanjiSubjectMap = new Map<string, any>();
    dashboardData.subjects.forEach((subject: any) => {
      if (subject.object === "kanji" && subject.data.characters) {
        startedKanjiSubjectMap.set(subject.data.characters, subject);
      }
    });

    // Create lookup for ALL WaniKani kanji using cached subjects
    const allWaniKaniKanjiMap = new Map<string, any>();
    allSubjects.forEach((subject: any) => {
      if (subject.object === "kanji" && subject.data.characters) {
        allWaniKaniKanjiMap.set(subject.data.characters, subject);
      }
    });

    return {
      assignmentMap,
      startedKanjiSubjectMap,
      allWaniKaniKanjiMap,
    };
  }, [dashboardData.subjects, dashboardData.assignments, allSubjects]);

  // Get kanji data and Sort
  const kanjiData = useMemo(() => {
    if (!lookupMaps) return [];

    let kanjiList: readonly string[] = [];

    switch (category) {
      case "jlpt":
        kanjiList = getKanjiForLevel(
          selectedSubLevel as keyof typeof JLPT_TOTALS
        );
        break;
      case "joyo":
        kanjiList = getKanjiForGrade(
          selectedSubLevel as keyof typeof JOYO_TOTALS
        );
        break;
      case "frequency":
        kanjiList = getKanjiForBracket(
          selectedSubLevel as keyof typeof FREQUENCY_TOTALS
        );
        break;
    }

    const { assignmentMap, startedKanjiSubjectMap, allWaniKaniKanjiMap } =
      lookupMaps;

    const mapped = kanjiList.map((kanji) => {
      // First, check if this kanji is in WaniKani at all using cached subjects
      const waniKaniSubject = allWaniKaniKanjiMap.get(kanji);

      if (!waniKaniSubject) {
        // Kanji not in WaniKani at all
        return {
          kanji,
          learned: false,
          srsStage: -1, // Distinction for "Not in WK"
          inWanikani: false,
        };
      }

      // Kanji is in WaniKani, now check if user has started it
      const startedSubject = startedKanjiSubjectMap.get(kanji);

      if (!startedSubject) {
        // Kanji is in WaniKani but user hasn't started it yet (locked/not unlocked)
        return {
          kanji,
          learned: false,
          srsStage: 0, // Locked/Not Started
          wanikaniLevel: waniKaniSubject.data.level,
          inWanikani: true,
        };
      }

      // Kanji is in WaniKani and user has started it
      const assignment = assignmentMap.get(startedSubject.id);
      const srsStage = assignment?.data.srs_stage || 0;
      const isLearned = srsStage >= learnedThreshold;

      return {
        kanji,
        learned: isLearned,
        srsStage,
        wanikaniLevel: startedSubject.data.level,
        inWanikani: true,
      };
    });

    // Sort: SRS Stage Descending, then Character
    return mapped.sort((a, b) => {
      if (a.srsStage !== b.srsStage) {
        return b.srsStage - a.srsStage;
      }
      return a.kanji.localeCompare(b.kanji);
    });
  }, [category, selectedSubLevel, lookupMaps, learnedThreshold]);

  // Get statistics
  const stats = useMemo(() => {
    const total = kanjiData.length;
    const learned = kanjiData.filter((k) => k.srsStage >= 5).length;
    const learning = kanjiData.filter(
      (k) => k.srsStage > 0 && k.srsStage < 5
    ).length;
    const locked = kanjiData.filter(
      (k) => k.srsStage === 0 && k.inWanikani
    ).length;
    const notInWK = kanjiData.filter((k) => !k.inWanikani).length;

    return {
      total,
      learned,
      learning,
      locked,
      notInWK,
      learnedPercent: total > 0 ? Math.round((learned / total) * 100) : 0,
      coveragePercent:
        total > 0 ? Math.round(((total - notInWK) / total) * 100) : 0,
    };
  }, [kanjiData]);

  // Get color for kanji based on SRS stage
  const getKanjiColor = (item: KanjiData) => {
    if (!item.inWanikani) {
      return theme.isDark ? "#1a1a1a" : "#999";
    }
    if (item.srsStage === 0) {
      return theme.isDark ? "#555" : "#d0d0d0"; // Locked
    }
    return getSRSColorByStage(item.srsStage, theme.isDark);
  };

  // No longer needed
  // const getKanjiTextColor = ...

  const getCategoryTitle = () => {
    switch (category) {
      case "jlpt":
        return "JLPT Levels";
      case "joyo":
        return "Jōyō Grades";
      case "frequency":
        return "Frequency Brackets";
      default:
        return "Progress";
    }
  };

  const getSubLevelLabel = (subLevel: string) => {
    switch (category) {
      case "jlpt":
        return subLevel;
      case "joyo":
        return getJoyoGradeName(subLevel as keyof typeof JOYO_TOTALS);
      case "frequency":
        return getFrequencyBracketName(
          subLevel as keyof typeof FREQUENCY_TOTALS
        );
      default:
        return subLevel;
    }
  };

  const getSegmentedControlLabel = (subLevel: string) => {
    switch (category) {
      case "jlpt":
        return subLevel;
      case "joyo":
        return getJoyoGradeLabel(subLevel as keyof typeof JOYO_TOTALS);
      case "frequency":
        return getFrequencyBracketName(
          subLevel as keyof typeof FREQUENCY_TOTALS
        );
      default:
        return subLevel;
    }
  };

  const renderKanjiItem = useCallback(
    ({ item }: { item: KanjiData }) => {
      // Accent color is the SRS or Status color
      const accentColor = getKanjiColor(item);
      const isLockedOrMissing = !item.inWanikani || item.srsStage === 0;

      return (
        <TouchableOpacity
          style={[
            styles.kanjiItem,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
              borderTopColor: accentColor,
              opacity: isLockedOrMissing ? 0.6 : 1,
            },
          ]}
          onPress={() => {
            if (item.inWanikani && item.wanikaniLevel) {
              let subject = dashboardData.subjects?.find(
                (s: any) =>
                  s.object === "kanji" && s.data.characters === item.kanji
              );

              if (!subject && allSubjects) {
                subject = allSubjects.find(
                  (s: any) =>
                    s.object === "kanji" && s.data.characters === item.kanji
                );
              }

              if (subject) {
                router.push(`/subject/${subject.id}`);
              }
            }
          }}
          disabled={!item.inWanikani}
        >
          <Text style={[styles.kanjiText, { color: theme.textColor }]}>
            {item.kanji}
          </Text>
        </TouchableOpacity>
      );
    },
    [theme, dashboardData.subjects, allSubjects]
  );

  const keyExtractor = useCallback(
    (item: KanjiData) => `${category}-${selectedSubLevel}-${item.kanji}`,
    [category, selectedSubLevel]
  );

  // Header Component (Segmented Control + Stats)
  const ListHeader = useMemo(() => {
    // Stats colors
    const passedColor = theme.isDark ? "#27ae60" : "#219653";
    const learningColor = theme.isDark ? "#e67e22" : "#d35400";
    const lockedColor = theme.isDark ? "#555" : "#ccc";
    const missingColor = theme.isDark ? "#1a1a1a" : "#eee";

    return (
      <View>
        {/* Sub-level selector */}
        <View
          style={[
            styles.segmentedControlWrapper,
            { backgroundColor: theme.backgroundColor },
          ]}
        >
          <View
            style={[
              styles.segmentedControlContainer,
              { backgroundColor: theme.backgroundColor },
            ]}
          >
            <SegmentedControl
              values={getSubLevels().map((subLevel) =>
                getSegmentedControlLabel(subLevel)
              )}
              selectedIndex={selectedIndex}
              onChange={(event) => {
                handleSegmentedControlChange(
                  event.nativeEvent.selectedSegmentIndex
                );
              }}
              style={styles.segmentedControl}
              tintColor={theme.primary}
              fontStyle={{ color: theme.textSecondary, fontSize: 12 }}
              activeFontStyle={{
                color: "#fff",
                fontSize: 12,
                fontWeight: "600",
              }}
            />
          </View>
        </View>

        {/* Progress Overview */}
        <View
          style={[
            styles.progressOverview,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <View style={styles.overviewHeader}>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
              {getCategoryTitle()} Stats
            </Text>
          </View>

          {/* Main Progression Bar */}
          <View style={styles.mainProgressBarContainer}>
            {/* Learned */}
            {stats.learned > 0 && (
              <View
                style={[
                  styles.progressSegment,
                  {
                    flex: stats.learned,
                    backgroundColor: passedColor,
                    marginRight: 2,
                  },
                ]}
              />
            )}
            {/* Learning */}
            {stats.learning > 0 && (
              <View
                style={[
                  styles.progressSegment,
                  {
                    flex: stats.learning,
                    backgroundColor: learningColor,
                    marginRight: 2,
                  },
                ]}
              />
            )}
            {/* Locked */}
            {stats.locked > 0 && (
              <View
                style={[
                  styles.progressSegment,
                  {
                    flex: stats.locked,
                    backgroundColor: lockedColor,
                    marginRight: stats.notInWK > 0 ? 2 : 0,
                  },
                ]}
              />
            )}
            {/* Not In WK */}
            {stats.notInWK > 0 && (
              <View
                style={[
                  styles.progressSegment,
                  {
                    flex: stats.notInWK,
                    backgroundColor: missingColor,
                    marginRight: 0,
                  },
                ]}
              />
            )}
          </View>

          {/* Legend */}
          <View style={styles.legendRow}>
            {/* Stats Legend (Learned/Learning etc) */}
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: passedColor }]}
              />
              <Text
                style={[styles.legendLabel, { color: theme.textSecondary }]}
              >
                Learned
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: learningColor }]}
              />
              <Text
                style={[styles.legendLabel, { color: theme.textSecondary }]}
              >
                Learning
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: lockedColor }]}
              />
              <Text
                style={[styles.legendLabel, { color: theme.textSecondary }]}
              >
                Locked
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: missingColor }]}
              />
              <Text
                style={[styles.legendLabel, { color: theme.textSecondary }]}
              >
                Not in WK
              </Text>
            </View>
          </View>

          {/* SRS Legend Separator */}
          <View style={styles.divider} />
          <Text
            style={[styles.sectionSubtitle, { color: theme.textSecondary }]}
          >
            SRS Levels
          </Text>

          {/* SRS Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: getSRSColorByStage(1, theme.isDark) },
                ]}
              />
              <Text
                style={[styles.legendLabel, { color: theme.textSecondary }]}
              >
                Appr.
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: getSRSColorByStage(5, theme.isDark) },
                ]}
              />
              <Text
                style={[styles.legendLabel, { color: theme.textSecondary }]}
              >
                Guru
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: getSRSColorByStage(7, theme.isDark) },
                ]}
              />
              <Text
                style={[styles.legendLabel, { color: theme.textSecondary }]}
              >
                Master
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: getSRSColorByStage(8, theme.isDark) },
                ]}
              />
              <Text
                style={[styles.legendLabel, { color: theme.textSecondary }]}
              >
                Enlight.
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[
                  styles.legendDot,
                  { backgroundColor: getSRSColorByStage(9, theme.isDark) },
                ]}
              />
              <Text
                style={[styles.legendLabel, { color: theme.textSecondary }]}
              >
                Burned
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statGridItem}>
              <Text
                style={[styles.statGridLabel, { color: theme.textSecondary }]}
              >
                Pass Rate
              </Text>
              <Text style={[styles.statGridValue, { color: theme.textColor }]}>
                {stats.learnedPercent}%
              </Text>
            </View>
            <View style={styles.statGridItem}>
              <Text
                style={[styles.statGridLabel, { color: theme.textSecondary }]}
              >
                Total
              </Text>
              <Text style={[styles.statGridValue, { color: theme.textColor }]}>
                {stats.total}
              </Text>
            </View>
            <View style={styles.statGridItem}>
              <Text
                style={[styles.statGridLabel, { color: theme.textSecondary }]}
              >
                Coverage
              </Text>
              <Text style={[styles.statGridValue, { color: theme.textColor }]}>
                {stats.coveragePercent}%
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  }, [theme, stats, selectedIndex, selectedSubLevel]);

  if (!category || !level) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <Text style={[styles.errorText, { color: theme.error }]}>
          Invalid parameters
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      {/* Header */}
      <View
        style={[styles.header, { backgroundColor: theme.headerBackground }]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.headerText} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.headerText }]}>
            {getCategoryTitle()} {getSubLevelLabel(selectedSubLevel)}
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Scrollable Content */}
      {!lookupMaps ||
      !allSubjects ||
      !dashboardData.subjects ||
      !dashboardData.assignments ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.secondary} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>
            Loading kanji data...
          </Text>
        </View>
      ) : kanjiData.length > 0 ? (
        <FlashList
          data={kanjiData}
          renderItem={renderKanjiItem}
          numColumns={numColumns}
          key={`${selectedSubLevel}-${numColumns}`} // Re-render when level or columns change
          showsVerticalScrollIndicator={false}
          keyExtractor={keyExtractor}
          getItemType={() => "kanji"} // All items are the same type
          removeClippedSubviews={true}
          drawDistance={500}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={styles.gridContainer}
        />
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            No kanji data available for {getSubLevelLabel(selectedSubLevel)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: "center",
  },
  headerSpacer: {
    width: 40, // Same width as back button (24 + 16 margin)
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  headerSubtitle: {
    fontSize: 16,
    marginTop: 2,
    opacity: 0.8,
  },
  segmentedControlWrapper: {
    paddingTop: 16,
    paddingBottom: 8,
    borderRadius: 8,
  },
  segmentedControlContainer: {
    padding: 0,
    borderRadius: 8,
  },
  segmentedControl: {
    height: 32,
  },
  progressOverview: {
    marginTop: 10,
    padding: 20,
    borderRadius: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: -8,
    textTransform: "uppercase",
  },
  overviewHeader: {
    marginBottom: 16,
  },
  mainProgressBarContainer: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    marginBottom: 16,
    width: "100%",
  },
  progressSegment: {
    height: "100%",
  },
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendLabel: {
    fontSize: 12,
    fontWeight: "500",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(128,128,128,0.1)",
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  statGridItem: {
    flex: 1,
    alignItems: "center",
  },
  statGridLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statGridValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  gridContainer: {
    padding: 16,
  },
  kanjiItem: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderTopWidth: 4,
    justifyContent: "center",
    alignItems: "center",
    margin: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  kanjiText: {
    fontSize: 24,
    fontWeight: "bold",
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
  errorText: {
    fontSize: 16,
    textAlign: "center",
    margin: 32,
  },
});
