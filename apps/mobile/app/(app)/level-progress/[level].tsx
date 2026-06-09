import { Ionicons } from "@expo/vector-icons";
import SegmentedControl from "@react-native-segmented-control/segmented-control";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import PagerView from "react-native-pager-view";
import { SvgXml } from "react-native-svg";
import {
  SRS_COLORS,
  getSRSColorByStage,
} from "../../../src/constants/srsColors";
import { useDashboardData } from "../../../src/hooks/useDashboardData";
import { Assignment, Subject } from "../../../src/utils/api";
import { getAllSubjects } from "../../../src/utils/cache";
import {
  LevelProgress,
  getLevelProgressBreakdown,
} from "../../../src/utils/levelProgress";
import { pickBestImage, useRemoteSvg } from "../../../src/utils/radicalSvg";
import { getSubjectTypeColor } from "../../../src/utils/subjectColors";
import { useTheme } from "../../../src/utils/theme";

interface SubjectItemData {
  id: number;
  characters: string;
  meanings: string[];
  readings?: string[];
  type: "radical" | "kanji" | "vocabulary" | "kana_vocabulary";
  srsStage: number;
  level: number;
  isLocked: boolean;
  character_images?: any[] | null;
}

const SubjectStatItem = ({ label, value, total, color, theme }: any) => (
  <View style={styles.statGridItem}>
    <Text style={[styles.statGridLabel, { color: theme.textSecondary }]}>
      {label}
    </Text>
    <View style={styles.statGridValueContainer}>
      <Text style={[styles.statGridValue, { color: theme.textColor }]}>
        {value}
      </Text>
      <Text style={[styles.statGridTotal, { color: theme.textSecondary }]}>
        /{total}
      </Text>
    </View>
    <View
      style={[
        styles.statMiniBar,
        { backgroundColor: theme.isDark ? "#333" : "#eee" },
      ]}
    >
      <View
        style={[
          styles.statMiniFill,
          {
            width: `${(total > 0 ? value / total : 0) * 100}%`,
            backgroundColor: color,
          },
        ]}
      />
    </View>
  </View>
);

export default function LevelProgressScreen() {
  const { theme } = useTheme();
  const params = useLocalSearchParams();
  const { dashboardData } = useDashboardData();

  const entryLevel = parseInt(params.level as string);
  const [selectedType, setSelectedType] = useState<
    "all" | "radical" | "kanji" | "vocabulary"
  >("all");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const pagerRef = useRef<PagerView>(null);
  const [cachedSubjects, setCachedSubjects] = useState<Subject[] | null>(null);
  const minNavigableLevel = 1;
  const maxNavigableLevel = 60;

  const swipeLevels = useMemo(() => {
    const levelsCount = maxNavigableLevel - minNavigableLevel + 1;
    return Array.from(
      { length: levelsCount },
      (_, index) => minNavigableLevel + index
    );
  }, [maxNavigableLevel]);

  const initialPagerIndex = useMemo(() => {
    const index = swipeLevels.indexOf(entryLevel);
    return index >= 0 ? index : 0;
  }, [swipeLevels, entryLevel]);
  const [activePageIndex, setActivePageIndex] = useState(initialPagerIndex);
  const [activeLevel, setActiveLevel] = useState(
    swipeLevels[initialPagerIndex] ?? entryLevel
  );
  const lastSyncedEntryLevelRef = useRef<number | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const loadCachedSubjects = async () => {
      try {
        const allSubjects = await getAllSubjects();
        if (isCancelled || !Array.isArray(allSubjects) || allSubjects.length === 0) {
          return;
        }
        setCachedSubjects(allSubjects as Subject[]);
      } catch {
        // Best-effort only; dashboard subjects remain the fallback.
      }
    };

    void loadCachedSubjects();

    return () => {
      isCancelled = true;
    };
  }, []);

  const levelSubjectsSource = useMemo(() => {
    const mergedSubjectsById = new Map<number, Subject>();

    (dashboardData.subjects || []).forEach((subject: Subject) => {
      mergedSubjectsById.set(subject.id, subject);
    });

    (cachedSubjects || []).forEach((subject: Subject) => {
      mergedSubjectsById.set(subject.id, subject);
    });

    return Array.from(mergedSubjectsById.values());
  }, [dashboardData.subjects, cachedSubjects]);

  useEffect(() => {
    if (lastSyncedEntryLevelRef.current === entryLevel) {
      return;
    }
    lastSyncedEntryLevelRef.current = entryLevel;

    const index = swipeLevels.indexOf(entryLevel);
    const resolvedIndex = index >= 0 ? index : 0;
    const resolvedLevel = swipeLevels[resolvedIndex] ?? entryLevel;

    setActivePageIndex(resolvedIndex);
    setActiveLevel(resolvedLevel);

    if (pagerRef.current) {
      pagerRef.current.setPageWithoutAnimation(resolvedIndex);
    }
  }, [entryLevel, swipeLevels]);

  const calculateLevelPageData = useCallback(
    (targetLevel: number): {
      progress: LevelProgress | null;
      items: SubjectItemData[];
    } => {
      if (!dashboardData.assignments || levelSubjectsSource.length === 0) {
        return { progress: null, items: [] };
      }

      const progress = getLevelProgressBreakdown(
        targetLevel,
        levelSubjectsSource,
        dashboardData.assignments
      );

      // Create subject items for display (exclude hidden/deprecated subjects).
      const levelSubjects = levelSubjectsSource.filter(
        (subject: Subject) =>
          subject.data.level === targetLevel && !subject.data.hidden_at
      );
      const assignmentMap = new Map<number, Assignment>();
      dashboardData.assignments.forEach((assignment: Assignment) => {
        assignmentMap.set(assignment.data.subject_id, assignment);
      });

      const items: SubjectItemData[] = levelSubjects.map((subject: Subject) => {
        const assignment = assignmentMap.get(subject.id);
        const srsStage = assignment?.data.srs_stage || 0;
        const isLocked = !assignment || !assignment.data.started_at;

        return {
          id: subject.id,
          characters: subject.data.characters || "?",
          meanings: subject.data.meanings?.map((m: any) => m.meaning) || [],
          readings: subject.data.readings?.map((r: any) => r.reading) || undefined,
          type: subject.object as
            | "radical"
            | "kanji"
            | "vocabulary"
            | "kana_vocabulary",
          srsStage,
          level: subject.data.level,
          isLocked,
          character_images: subject.data.character_images,
        };
      });

      // Sort by type (radicals first, then kanji, then vocabulary) and then by characters.
      items.sort((a, b) => {
        const typeOrder = {
          radical: 0,
          kanji: 1,
          vocabulary: 2,
          kana_vocabulary: 2,
        };
        if (typeOrder[a.type] !== typeOrder[b.type]) {
          return typeOrder[a.type] - typeOrder[b.type];
        }
        return a.characters.localeCompare(b.characters);
      });

      return { progress, items };
    },
    [levelSubjectsSource, dashboardData.assignments]
  );

  // Define helper functions first
  const getTypeColor = (
    type: "radical" | "kanji" | "vocabulary" | "kana_vocabulary"
  ) => {
    return getSubjectTypeColor(type);
  };

  const getSRSColor = (srsStage: number, isLocked: boolean) => {
    if (isLocked) return theme.isDark ? "#555" : "#ccc";
    return getSRSColorByStage(srsStage, theme.isDark);
  };

  const renderProgressOverview = (progressData: LevelProgress) => {
    // Passed Color (Green - Intuitive "Done")
    const passedColor = theme.isDark ? "#27ae60" : "#219653";
    // Learning Color (Orange - Active)
    const learningColor = theme.isDark ? "#e67e22" : "#d35400";
    const lockedOpacity = theme.isDark ? 0.2 : 0.3;

    return (
      <View
        style={[
          styles.progressOverview,
          { backgroundColor: theme.cardBackground },
        ]}
      >
        <View style={styles.overviewHeader}>
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, marginBottom: 4 },
            ]}
          >
            Level Stats
          </Text>
        </View>

        {/* Main Progression Bar */}
        {/* Order: Learned (Green) -> Learning (Orange) -> Locked (Broken down) */}
        <View style={styles.mainProgressBarContainer}>
          {/* Passed (Guru+) */}
          {progressData.overall.guru > 0 && (
            <View
              style={[
                styles.progressSegment,
                {
                  flex: progressData.overall.guru,
                  backgroundColor: passedColor,
                  marginRight: 2,
                },
              ]}
            />
          )}

          {/* Learning (Apprentice) */}
          {progressData.overall.apprentice > 0 && (
            <View
              style={[
                styles.progressSegment,
                {
                  flex: progressData.overall.apprentice,
                  backgroundColor: learningColor,
                  marginRight: 2,
                },
              ]}
            />
          )}

          {/* Locked/Not Started - Broken down by type */}
          {/* Radicals */}
          {progressData.radical.notStarted > 0 && (
            <View
              style={[
                styles.progressSegment,
                {
                  flex: progressData.radical.notStarted,
                  backgroundColor: getTypeColor("radical"),
                  opacity: lockedOpacity,
                  marginRight: 1,
                },
              ]}
            />
          )}
          {/* Kanji */}
          {progressData.kanji.notStarted > 0 && (
            <View
              style={[
                styles.progressSegment,
                {
                  flex: progressData.kanji.notStarted,
                  backgroundColor: getTypeColor("kanji"),
                  opacity: lockedOpacity,
                  marginRight: 1,
                },
              ]}
            />
          )}
          {/* Vocabulary */}
          {progressData.vocabulary.notStarted > 0 && (
            <View
              style={[
                styles.progressSegment,
                {
                  flex: progressData.vocabulary.notStarted,
                  backgroundColor: getTypeColor("vocabulary"),
                  opacity: lockedOpacity,
                  marginRight: 0,
                },
              ]}
            />
          )}
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: passedColor }]}
            />
            <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>
              Learned
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View
              style={[styles.legendDot, { backgroundColor: learningColor }]}
            />
            <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>
              Learning
            </Text>
          </View>
          <View style={styles.legendItem}>
            {/* Visualizing "Locked" as a neutral gray dot, representing the faded colored sections */}
            <View
              style={[
                styles.legendDot,
                { backgroundColor: theme.isDark ? "#555" : "#ccc" },
              ]}
            />
            <Text style={[styles.legendLabel, { color: theme.textSecondary }]}>
              Locked
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Detailed Stats Grid */}
        <View style={styles.statsGrid}>
          <SubjectStatItem
            label="Radicals"
            value={progressData.radical.guru}
            total={progressData.radical.total}
            color={getTypeColor("radical")}
            theme={theme}
          />
          <SubjectStatItem
            label="Kanji"
            value={progressData.kanji.guru}
            total={progressData.kanji.total}
            color={getTypeColor("kanji")}
            theme={theme}
          />
          <SubjectStatItem
            label="Vocab"
            value={progressData.vocabulary.guru}
            total={progressData.vocabulary.total}
            color={getTypeColor("vocabulary")}
            theme={theme}
          />
        </View>
      </View>
    );
  };

  const filterAndSortItemsByType = useCallback(
    (allItems: SubjectItemData[]) => {
      let items = allItems;

      if (selectedType !== "all") {
        if (selectedType === "vocabulary") {
          // Include both vocabulary and kana_vocabulary for vocabulary filter.
          items = allItems.filter(
            (item) =>
              item.type === "vocabulary" || item.type === "kana_vocabulary"
          );
        } else {
          items = allItems.filter((item) => item.type === selectedType);
        }
      }

      // Sort by SRS progress (0-9, from less to more progress).
      return [...items].sort((a, b) => {
        // First sort by SRS stage.
        if (a.srsStage !== b.srsStage) {
          return a.srsStage - b.srsStage;
        }
        // Then by type for consistency.
        const typeOrder = {
          radical: 0,
          kanji: 1,
          vocabulary: 2,
          kana_vocabulary: 2,
        };
        if (typeOrder[a.type] !== typeOrder[b.type]) {
          return typeOrder[a.type] - typeOrder[b.type];
        }
        // Finally by characters.
        return a.characters.localeCompare(b.characters);
      });
    },
    [selectedType]
  );

  const groupItemsByType = useCallback((filteredItems: SubjectItemData[]) => {
    return {
      radical: filteredItems.filter((item) => item.type === "radical"),
      kanji: filteredItems.filter((item) => item.type === "kanji"),
      vocabulary: filteredItems.filter(
        (item) => item.type === "vocabulary" || item.type === "kana_vocabulary"
      ),
    };
  }, []);

  // Handle segmented control change
  const handleSegmentedControlChange = (index: number) => {
    const types: ("all" | "radical" | "kanji" | "vocabulary")[] = [
      "all",
      "radical",
      "kanji",
      "vocabulary",
    ];
    setSelectedIndex(index);
    setSelectedType(types[index]);
  };

  const levelPageDataMap = useMemo(() => {
    const map = new Map<
      number,
      {
        progress: LevelProgress | null;
        items: SubjectItemData[];
      }
    >();

    swipeLevels.forEach((targetLevel) => {
      map.set(targetLevel, calculateLevelPageData(targetLevel));
    });

    return map;
  }, [swipeLevels, calculateLevelPageData]);
  const levelData = levelPageDataMap.get(activeLevel)?.progress ?? null;
  const isLoading =
    !dashboardData.dataLoadingState?.subjects ||
    !dashboardData.dataLoadingState?.assignments;

  const handleLevelPageSelected = (event: {
    nativeEvent: { position: number };
  }) => {
    const selectedIndex = event.nativeEvent.position;
    const selectedLevel = swipeLevels[selectedIndex];
    if (!selectedLevel) {
      return;
    }

    setActivePageIndex(selectedIndex);
    setActiveLevel(selectedLevel);
  };

  const SubjectCharacter = ({ item }: { item: SubjectItemData }) => {
    const isRadical = item.type === "radical";

    // For radicals, try SVG fallback if no characters
    const bestImg =
      isRadical && item.character_images?.length
        ? pickBestImage(item.character_images)
        : null;
    const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
    const svgXml = useRemoteSvg(svgUrl, "#ffffff"); // White color for visibility

    // Display logic: characters → SVG → meaning
    if (item.characters && item.characters !== "?") {
      return (
        <Text style={[styles.subjectCharacter, { color: "#fff" }]}>
          {item.characters}
        </Text>
      );
    }

    if (svgXml) {
      return <SvgXml xml={svgXml} width={20} height={20} />;
    }

    // Fallback to meaning for radicals without characters or SVG
    return (
      <Text style={[styles.subjectCharacter, { color: "#fff" }]}>
        {item.meanings[0] || "?"}
      </Text>
    );
  };

  const renderSubjectItem = ({ item }: { item: SubjectItemData }) => {
    const isVocabulary =
      item.type === "vocabulary" || item.type === "kana_vocabulary";
    const baseItemStyle = isVocabulary
      ? styles.subjectItemVocabulary
      : styles.subjectItem;

    return (
      <TouchableOpacity
        style={[
          baseItemStyle,
          {
            backgroundColor: getTypeColor(item.type),
            borderColor: theme.border,
          },
        ]}
        onPress={() => {
          router.push(`/subject/${item.id}`);
        }}
      >
        <SubjectCharacter item={item} />
        <View
          style={[
            styles.typeIndicator,
            { backgroundColor: getSRSColor(item.srsStage, item.isLocked) },
          ]}
        />
      </TouchableOpacity>
    );
  };

  const renderLevelPage = (targetLevel: number) => {
    const pageData = levelPageDataMap.get(targetLevel);
    const pageLevelData = pageData?.progress ?? null;
    const pageSubjectItems = pageData?.items ?? [];
    const pageFilteredItems = filterAndSortItemsByType(pageSubjectItems);
    const pageGroupedItems = groupItemsByType(pageFilteredItems);

    return (
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {pageLevelData ? (
          renderProgressOverview(pageLevelData)
        ) : (
          <View
            style={[
              styles.progressOverview,
              { backgroundColor: theme.cardBackground },
            ]}
          >
            <Text style={[styles.errorText, { color: theme.error }]}>
              No data found for level {targetLevel}
            </Text>
          </View>
        )}

        {/* Subjects with Filter and Legend */}
        <View
          style={[
            styles.subjectsContainer,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Subjects ({pageFilteredItems.length})
          </Text>

          {/* Subject Type Filter */}
          <View
            style={[
              styles.segmentedControlContainer,
              { backgroundColor: theme.cardBackground },
            ]}
          >
            <SegmentedControl
              values={["All", "Radical", "Kanji", "Vocab"]}
              selectedIndex={selectedIndex}
              onChange={(event) => {
                handleSegmentedControlChange(
                  event.nativeEvent.selectedSegmentIndex
                );
              }}
              style={styles.segmentedControl}
              tintColor={theme.primary}
              fontStyle={{ color: theme.textSecondary, fontSize: 14 }}
              activeFontStyle={{
                color: "#fff",
                fontSize: 14,
                fontWeight: "600",
              }}
            />
          </View>

          {/* Legend */}
          <View style={styles.legendSection}>
            <Text style={[styles.legendTitle, { color: theme.textColor }]}>
              SRS Progress
            </Text>
            <View style={styles.legendItems}>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendColor,
                    { backgroundColor: theme.isDark ? "#555" : "#ccc" },
                  ]}
                />
                <Text
                  style={[styles.legendText, { color: theme.textSecondary }]}
                >
                  Not Started
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendColor,
                    { backgroundColor: SRS_COLORS.apprentice.hex },
                  ]}
                />
                <Text
                  style={[styles.legendText, { color: theme.textSecondary }]}
                >
                  Apprentice
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendColor,
                    { backgroundColor: SRS_COLORS.guru.hex },
                  ]}
                />
                <Text
                  style={[styles.legendText, { color: theme.textSecondary }]}
                >
                  Guru
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendColor,
                    { backgroundColor: SRS_COLORS.master.hex },
                  ]}
                />
                <Text
                  style={[styles.legendText, { color: theme.textSecondary }]}
                >
                  Master
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendColor,
                    { backgroundColor: SRS_COLORS.enlightened.hex },
                  ]}
                />
                <Text
                  style={[styles.legendText, { color: theme.textSecondary }]}
                >
                  Enlightened
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View
                  style={[
                    styles.legendColor,
                    { backgroundColor: SRS_COLORS.burned.hex },
                  ]}
                />
                <Text
                  style={[styles.legendText, { color: theme.textSecondary }]}
                >
                  Burned
                </Text>
              </View>
            </View>
          </View>

          {/* Grouped Subjects Sections */}
          {selectedType === "all" ? (
            <>
              {/* Radicals Section */}
              {pageGroupedItems.radical.length > 0 && (
                <View style={styles.subjectTypeSection}>
                  <Text
                    style={[
                      styles.subjectTypeSectionTitle,
                      { color: getTypeColor("radical") },
                    ]}
                  >
                    Radicals ({pageGroupedItems.radical.length})
                  </Text>
                  <View style={styles.subjectsGrid}>
                    {pageGroupedItems.radical.map((item) => (
                      <View key={`${item.type}-${item.id}`}>
                        {renderSubjectItem({ item })}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Kanji Section */}
              {pageGroupedItems.kanji.length > 0 && (
                <View style={styles.subjectTypeSection}>
                  <Text
                    style={[
                      styles.subjectTypeSectionTitle,
                      { color: getTypeColor("kanji") },
                    ]}
                  >
                    Kanji ({pageGroupedItems.kanji.length})
                  </Text>
                  <View style={styles.subjectsGrid}>
                    {pageGroupedItems.kanji.map((item) => (
                      <View key={`${item.type}-${item.id}`}>
                        {renderSubjectItem({ item })}
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {/* Vocabulary Section */}
              {pageGroupedItems.vocabulary.length > 0 && (
                <View style={styles.subjectTypeSection}>
                  <Text
                    style={[
                      styles.subjectTypeSectionTitle,
                      { color: getTypeColor("vocabulary") },
                    ]}
                  >
                    Vocabulary ({pageGroupedItems.vocabulary.length})
                  </Text>
                  <View style={styles.subjectsGrid}>
                    {pageGroupedItems.vocabulary.map((item) => (
                      <View key={`${item.type}-${item.id}`}>
                        {renderSubjectItem({ item })}
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </>
          ) : (
            /* Single Type View */
            <View style={styles.subjectsGrid}>
              {pageFilteredItems.map((item) => (
                <View key={`${item.type}-${item.id}`}>
                  {renderSubjectItem({ item })}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    );
  };

  if (!entryLevel || Number.isNaN(entryLevel)) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <Text style={[styles.errorText, { color: theme.error }]}>
          Invalid level
        </Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.secondary} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>
            Loading level {entryLevel} data...
          </Text>
        </View>
      </View>
    );
  }

  if (!levelData) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <Text style={[styles.errorText, { color: theme.error }]}>
          No data found for level {activeLevel}
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
        style={[
          styles.header,
          {
            backgroundColor: theme.headerBackground,
            paddingTop: 60,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.headerText} />
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={[styles.headerTitle, { color: theme.headerText }]}>
            Level {activeLevel}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <Text style={[styles.headerSubtitle, { color: theme.headerText }]}>
            {levelData.overall.completionPercent}%
          </Text>
        </View>
      </View>

      <PagerView
        ref={pagerRef}
        key={`level-pager-${entryLevel}`}
        style={styles.pagerContainer}
        initialPage={initialPagerIndex}
        scrollEnabled={swipeLevels.length > 1}
        onPageSelected={handleLevelPageSelected}
      >
        {swipeLevels.map((targetLevel, index) => (
          <View key={`level-page-${targetLevel}`} style={styles.pageContainer}>
            {Math.abs(index - activePageIndex) <= 1 ? (
              renderLevelPage(targetLevel)
            ) : (
              <View style={styles.pagePlaceholder} />
            )}
          </View>
        ))}
      </PagerView>
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
    fontSize: 24,
    fontWeight: "bold",
  },
  headerSubtitle: {
    fontSize: 16,
    marginTop: 2,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    padding: 16,
  },
  pagerContainer: {
    flex: 1,
  },
  pageContainer: {
    flex: 1,
  },
  pagePlaceholder: {
    flex: 1,
  },
  progressOverview: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  progressItem: {
    marginBottom: 16,
  },
  progressItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  progressStats: {
    fontSize: 14,
    fontWeight: "bold",
  },
  progressBarTrack: {
    width: "100%",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    paddingTop: 16,
    marginTop: 16,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  segmentedControlContainer: {
    padding: 4,
    borderRadius: 18,
    marginBottom: 16,
  },
  segmentedControl: {
    height: 36,
  },
  subjectsContainer: {
    padding: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  legendSection: {
    marginBottom: 20,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  legendItems: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 3,
    marginRight: 6,
  },
  legendText: {
    fontSize: 12,
  },
  subjectTypeSection: {
    marginBottom: 24,
  },
  subjectTypeSectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 12,
  },
  subjectsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  subjectItem: {
    width: 64,
    height: 64,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    margin: 4,
    position: "relative",
  },
  subjectItemVocabulary: {
    minWidth: 64,
    height: 64,
    maxWidth: 120,
    borderRadius: 8,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    margin: 4,
    position: "relative",
    paddingHorizontal: 8,
  },
  subjectCharacter: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  typeIndicator: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#fff",
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    margin: 32,
  },
  headerRight: {
    minWidth: 40,
    alignItems: "flex-end",
    justifyContent: "center",
    marginRight: 16,
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
    marginBottom: 20,
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
  statGridValueContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 6,
  },
  statGridValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  statGridTotal: {
    fontSize: 12,
    opacity: 0.7,
    marginLeft: 1,
  },
  statMiniBar: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  statMiniFill: {
    height: "100%",
    borderRadius: 2,
  },
});
