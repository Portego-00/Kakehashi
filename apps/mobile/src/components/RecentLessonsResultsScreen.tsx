import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { fontStyles } from "../utils/fonts";
import { pickBestImage, useRemoteSvg } from "../utils/radicalSvg";
import { GroupedReviewItem } from "../utils/reviewUtils";
import { getSubjectTypeColor } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";

const { width } = Dimensions.get("window");

// Circular Progress Ring Component
const CircularProgress = ({
  percentage,
  size = 80,
  strokeWidth = 8,
  color = "#4caf50",
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <SvgXml
        xml={`
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            <circle
              cx="${size / 2}"
              cy="${size / 2}"
              r="${radius}"
              stroke="#e0e0e0"
              stroke-width="${strokeWidth}"
              fill="transparent"
            />
            <circle
              cx="${size / 2}"
              cy="${size / 2}"
              r="${radius}"
              stroke="${color}"
              stroke-width="${strokeWidth}"
              fill="transparent"
              stroke-linecap="round"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${strokeDashoffset}"
              transform="rotate(-90 ${size / 2} ${size / 2})"
            />
          </svg>
        `}
        width={size}
        height={size}
      />
      <View style={{ position: "absolute", alignItems: "center" }}>
        <Text style={{ fontSize: size * 0.2, fontWeight: "bold", color }}>
          {percentage}%
        </Text>
      </View>
    </View>
  );
};

interface AnswerStats {
  answered: number;
  correct: number;
  completedItems: number;
  meaningAttempts: number;
  readingAttempts: number;
  meaningCorrect: number;
  readingCorrect: number;
}

interface RecentLessonsResultsProps {
  reviewItems: GroupedReviewItem[];
  answerStats: AnswerStats;
  incorrectAnswers: Record<number, { meaning: number; reading: number }>;
  answeredParts: Record<number, { meaning: boolean; reading: boolean }>;
  onRestart: () => void;
  onBackToDashboard: () => void;
}

interface ItemPerformance {
  item: GroupedReviewItem;
  meaningStatus: "correct" | "incorrect" | "none";
  readingStatus: "correct" | "incorrect" | "none";
  totalMistakes: number;
}

export default function RecentLessonsResultsScreen({
  reviewItems,
  answerStats,
  incorrectAnswers,
  answeredParts,
  onRestart,
  onBackToDashboard,
}: RecentLessonsResultsProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState<"mistakes" | "all">(
    "mistakes"
  );
  const bottomActionPadding =
    Platform.OS === "android" ? Math.max(insets.bottom, 16) : 34;

  // Filter to only show items that were actually completed
  const completedItems = reviewItems.filter((item) => {
    const answered = answeredParts[item.id];
    if (!answered) return false;

    // For radicals (no reading), only meaning needs to be done
    if (!item.readingQuestion) {
      return answered.meaning;
    }

    // For kanji and vocab with reading, both meaning and reading must be done
    return answered.meaning && answered.reading;
  });

  // Calculate completed items that have reading questions
  const getCompletedItemsWithReadings = () => {
    return completedItems.filter((item) => item.readingQuestion);
  };

  const completedItemsWithReadings = getCompletedItemsWithReadings();
  const readingCorrectCount = completedItemsWithReadings.filter((item) => {
    const mistakes = incorrectAnswers[item.id] || { meaning: 0, reading: 0 };
    return mistakes.reading === 0;
  }).length;

  // Calculate detailed statistics
  const getItemColor = (itemType: string) => {
    return getSubjectTypeColor(itemType as any);
  };

  // Analyze item performance (only for completed items)
  const getItemPerformance = (): ItemPerformance[] => {
    return completedItems.map((item) => {
      const mistakes = incorrectAnswers[item.id] || { meaning: 0, reading: 0 };

      const meaningStatus: "correct" | "incorrect" | "none" =
        mistakes.meaning > 0 ? "incorrect" : "correct"; // In recent lessons, all items are attempted

      const readingStatus: "correct" | "incorrect" | "none" =
        !item.readingQuestion
          ? "none" // No reading for radicals
          : mistakes.reading > 0
          ? "incorrect"
          : "correct";

      const totalMistakes = mistakes.meaning + mistakes.reading;

      return {
        item,
        meaningStatus,
        readingStatus,
        totalMistakes,
      };
    });
  };

  const itemPerformance = getItemPerformance();
  const itemsWithMistakes = itemPerformance.filter(
    (perf) => perf.totalMistakes > 0
  );
  const perfectItems = itemPerformance.filter(
    (perf) => perf.totalMistakes === 0
  );

  // Calculate category statistics
  const getStatsByCategory = () => {
    const stats = {
      radical: { total: 0, perfect: 0, mistakes: 0 },
      kanji: { total: 0, perfect: 0, mistakes: 0 },
      vocabulary: { total: 0, perfect: 0, mistakes: 0 },
    };

    itemPerformance.forEach((perf) => {
      const type =
        perf.item.type === "kana_vocabulary" ? "vocabulary" : perf.item.type;
      if (stats[type as keyof typeof stats]) {
        stats[type as keyof typeof stats].total++;
        if (perf.totalMistakes === 0) {
          stats[type as keyof typeof stats].perfect++;
        } else {
          stats[type as keyof typeof stats].mistakes++;
        }
      }
    });

    return stats;
  };

  const categoryStats = getStatsByCategory();

  // Character display component with SVG fallback for radicals
  const CharacterDisplay = ({
    item,
    size = 32,
  }: {
    item: GroupedReviewItem;
    size?: number;
  }) => {
    const isRadical = item.type === "radical";

    // For radicals, try SVG fallback if no characters
    const bestImg =
      isRadical && item.characterImages?.length
        ? pickBestImage(item.characterImages)
        : null;
    const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
    const svgXml = useRemoteSvg(svgUrl, "#ffffff");

    // Display logic: characters → SVG → meaning
    if (item.characters) {
      return (
        <Text
          style={[
            styles.itemCharacter,
            fontStyles.japaneseText,
            { fontSize: size },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {item.characters}
        </Text>
      );
    }

    if (svgXml) {
      return <SvgXml xml={svgXml} width={size} height={size} />;
    }

    // Final fallback to meaning
    return (
      <Text
        style={[styles.itemCharacter, { fontSize: Math.max(size * 0.6, 12) }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {item.meanings[0].meaning}
      </Text>
    );
  };

  // Render item card
  const renderItemCard = ({ item: perf }: { item: ItemPerformance }) => {
    const { item, meaningStatus, readingStatus, totalMistakes } = perf;
    const hasReading = item.readingQuestion;

    return (
      <TouchableOpacity
        style={[
          styles.itemCard,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
            borderTopColor: getItemColor(item.type),
          },
        ]}
        onPress={() => {
          router.push({
            pathname: "/subject/[id]",
            params: { id: item.subjectId.toString() },
          });
        }}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.itemHeader,
            { backgroundColor: getItemColor(item.type) },
          ]}
        >
          <CharacterDisplay item={item} size={28} />
          {totalMistakes > 0 && (
            <View style={styles.mistakesBadge}>
              <Text style={styles.mistakesBadgeText}>{totalMistakes}</Text>
            </View>
          )}
        </View>

        <View style={styles.itemContent}>
          <Text
            style={[styles.itemMeaning, { color: theme.textColor }]}
            numberOfLines={2}
          >
            {item.meanings[0].meaning}
          </Text>

          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <Text
                style={[styles.statusLabel, { color: theme.textSecondary }]}
              >
                Meaning
              </Text>
              <Ionicons
                name={
                  meaningStatus === "correct"
                    ? "checkmark-circle"
                    : meaningStatus === "incorrect"
                    ? "close-circle"
                    : "remove-circle"
                }
                size={16}
                color={
                  meaningStatus === "correct"
                    ? "#4caf50"
                    : meaningStatus === "incorrect"
                    ? "#f44336"
                    : theme.textSecondary
                }
              />
            </View>

            {hasReading && (
              <View style={styles.statusItem}>
                <Text
                  style={[styles.statusLabel, { color: theme.textSecondary }]}
                >
                  Reading
                </Text>
                <Ionicons
                  name={
                    readingStatus === "correct"
                      ? "checkmark-circle"
                      : readingStatus === "incorrect"
                      ? "close-circle"
                      : "remove-circle"
                  }
                  size={16}
                  color={
                    readingStatus === "correct"
                      ? "#4caf50"
                      : readingStatus === "incorrect"
                      ? "#f44336"
                      : theme.textSecondary
                  }
                />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Get items to display based on selected tab
  const getDisplayItems = () => {
    switch (selectedTab) {
      case "mistakes":
        return itemsWithMistakes;
      case "all":
        return itemPerformance;
      default:
        return itemsWithMistakes;
    }
  };

  const displayItems = getDisplayItems();

  return (
    <SafeAreaView
      edges={["top"]}
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.textColor }]}>
            Practice Complete!
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Great job practicing your recent lessons!
          </Text>
        </View>

        {/* Summary Stats with Ring Progress */}
        <View
          style={[
            styles.summaryContainer,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <View style={styles.summaryWithProgress}>
            <View style={styles.progressSection}>
              <CircularProgress
                percentage={Math.round(
                  (answerStats.correct / answerStats.answered) * 100
                )}
                size={100}
                strokeWidth={10}
                color={theme.secondary}
              />
            </View>

            <View style={styles.statsSection}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.textColor }]}>
                  {completedItems.length}
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  Items Completed
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.textColor }]}>
                  {completedItems.length > 0
                    ? Math.round(
                        (completedItems.filter((item) => {
                          const mistakes = incorrectAnswers[item.id] || {
                            meaning: 0,
                            reading: 0,
                          };
                          return mistakes.meaning === 0;
                        }).length /
                          completedItems.length) *
                          100
                      )
                    : 0}
                  %
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  Meaning Accuracy
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.textColor }]}>
                  {completedItemsWithReadings.length > 0
                    ? Math.round(
                        (readingCorrectCount /
                          completedItemsWithReadings.length) *
                          100
                      )
                    : 0}
                  %
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  Reading Accuracy
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Category Breakdown */}
        <View
          style={[
            styles.categoryContainer,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            By Category
          </Text>

          <View style={styles.categoryChartsContainer}>
            {["radical", "kanji", "vocabulary"].map((category) => {
              const stats =
                categoryStats[category as keyof typeof categoryStats];
              if (stats.total === 0) return null;

              const accuracy =
                stats.total > 0
                  ? Math.round((stats.perfect / stats.total) * 100)
                  : 0;
              const color = getItemColor(category);

              return (
                <View key={category} style={styles.categoryChart}>
                  <CircularProgress
                    percentage={accuracy}
                    size={70}
                    strokeWidth={6}
                    color={color}
                  />
                  <Text
                    style={[
                      styles.categoryChartTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </Text>
                  <Text
                    style={[
                      styles.categoryChartSubtitle,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {stats.perfect}/{stats.total}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Tab Navigation */}
        <View
          style={[
            styles.tabContainer,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === "mistakes" && styles.activeTab,
              selectedTab === "mistakes" && { backgroundColor: "#f44336" },
            ]}
            onPress={() => setSelectedTab("mistakes")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    selectedTab === "mistakes" ? "white" : theme.textSecondary,
                },
              ]}
            >
              Mistakes ({itemsWithMistakes.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tab,
              selectedTab === "all" && styles.activeTab,
              selectedTab === "all" && { backgroundColor: theme.secondary },
            ]}
            onPress={() => setSelectedTab("all")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: selectedTab === "all" ? "white" : theme.textSecondary,
                },
              ]}
            >
              All Items
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content based on selected tab */}
        <View style={styles.itemsContainer}>
          {displayItems.length > 0 ? (
            <FlatList
              data={displayItems}
              renderItem={renderItemCard}
              keyExtractor={(item) => item.item.id.toString()}
              numColumns={2}
              columnWrapperStyle={styles.itemRow}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle" size={64} color="#4caf50" />
              <Text style={[styles.emptyStateText, { color: theme.textColor }]}>
                {selectedTab === "mistakes"
                  ? "Perfect! No mistakes found."
                  : "No items to display."}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View
        style={[
          styles.bottomContainer,
          { backgroundColor: theme.backgroundColor },
          { paddingBottom: bottomActionPadding },
        ]}
      >
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: "#2196f3" }]}
            onPress={onRestart}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>Practice Again</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.secondary }]}
            onPress={onBackToDashboard}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
  },
  summaryContainer: {
    margin: 16,
    marginTop: 0,
    borderRadius: 12,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  summaryWithProgress: {
    flexDirection: "row",
    alignItems: "center",
  },
  progressSection: {
    marginRight: 20,
  },
  statsSection: {
    flex: 1,
  },
  statItem: {
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
  },
  categoryContainer: {
    margin: 16,
    borderRadius: 12,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 16,
  },
  categoryChartsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
  categoryChart: {
    alignItems: "center",
    flex: 1,
  },
  categoryChartTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center",
  },
  categoryChartSubtitle: {
    fontSize: 12,
    marginTop: 2,
    textAlign: "center",
  },
  tabContainer: {
    flexDirection: "row",
    margin: 16,
    borderRadius: 8,
    padding: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 6,
  },
  activeTab: {
    // Background color set dynamically
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },
  detailsContainer: {
    margin: 16,
    borderRadius: 12,
    padding: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  statValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  itemsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  itemRow: {
    justifyContent: "space-between",
  },
  itemCard: {
    width: (width - 48) / 2,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderTopWidth: 4,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  itemHeader: {
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  itemCharacter: {
    color: "white",
    fontWeight: "400",
    textAlign: "center",
  },
  mistakesBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  mistakesBadgeText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#f44336",
  },
  itemContent: {
    padding: 12,
  },
  itemMeaning: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
    textAlign: "center",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statusItem: {
    alignItems: "center",
  },
  statusLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
  },
  emptyStateText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: "center",
  },
  bottomContainer: {
    padding: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  actionButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  actionButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
});
