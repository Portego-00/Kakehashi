import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { Subject } from "../types/wanikani";
import { fontStyles } from "../utils/fonts";
import { pickBestImage, useRemoteSvg } from "../utils/radicalSvg";
import { getSubjectTypeColor } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";
import AddToSubjectListsModal from "./AddToSubjectListsModal";

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

interface ReviewItem {
  id: number;
  assignmentId: number;
  subjectId: number;
  subject: Subject;
  meaningDone: boolean;
  readingDone: boolean;
  meaningApplicable?: boolean;
  readingApplicable?: boolean;
  meaningIncorrect: number;
  readingIncorrect: number;
  submitted?: boolean;
  submissionFailed?: boolean;
  progressCounted?: boolean;
  meaningCorrectlyAnswered?: boolean;
  readingCorrectlyAnswered?: boolean;
  meaningIncorrectCounted?: boolean;
  readingIncorrectCounted?: boolean;
  srsStage?: number;
}

interface ReviewProgress {
  current: number;
  total: number;
  meaningCorrect: number;
  readingCorrect: number;
  totalItems: number;
  answeredCount: number;
  completedItems: number;
  meaningAttempts: number;
  readingAttempts: number;
  correctAnswersCount: number;
}

interface ReviewResultsProps {
  reviewItems: ReviewItem[];
  progress: ReviewProgress;
  submittingResults: boolean;
  onBackToDashboard: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

interface ItemPerformance {
  item: ReviewItem;
  meaningStatus: "correct" | "incorrect" | "none";
  readingStatus: "correct" | "incorrect" | "none";
  totalMistakes: number;
}

export default function ReviewResultsScreen({
  reviewItems,
  progress,
  submittingResults,
  onBackToDashboard,
  secondaryActionLabel,
  onSecondaryAction,
}: ReviewResultsProps) {
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selectedTab, setSelectedTab] = useState<"mistakes" | "all">(
    "mistakes"
  );
  const [hideAnswersForRequiz, setHideAnswersForRequiz] = useState(false);
  const [revealedItemIds, setRevealedItemIds] = useState<Set<number>>(
    new Set()
  );
  const [showAddMistakesToListModal, setShowAddMistakesToListModal] =
    useState(false);
  const itemCardWidth = Math.max((windowWidth - 48) / 2, 0);
  const bottomActionPadding =
    Platform.OS === "android" ? Math.max(insets.bottom, 16) : 34;

  const isMeaningApplicable = (item: ReviewItem) =>
    item.meaningApplicable ?? true;

  const isReadingApplicable = (item: ReviewItem) => {
    if (typeof item.readingApplicable === "boolean") {
      return item.readingApplicable;
    }

    const isRadical = item.subject.object === "radical";
    const isKanaVocab = (item.subject.object as any) === "kana_vocabulary";
    const isVocabWithoutReading =
      item.subject.object === "vocabulary" && !item.subject.data.readings;

    return !isRadical && !isKanaVocab && !isVocabWithoutReading;
  };

  // Filter to only show items that were actually completed
  const completedItems = reviewItems.filter((item) => {
    const needsMeaning = isMeaningApplicable(item);
    const needsReading = isReadingApplicable(item);

    if (!needsMeaning && !needsReading) {
      return false;
    }

    if (needsMeaning && !item.meaningDone) {
      return false;
    }

    if (needsReading && !item.readingDone) {
      return false;
    }

    return true;
  });

  // Calculate completed items that have reading questions
  const getCompletedItemsWithReadings = () => {
    return completedItems.filter((item) => isReadingApplicable(item));
  };

  const completedItemsWithMeanings = completedItems.filter((item) =>
    isMeaningApplicable(item)
  );
  const completedItemsWithReadings = getCompletedItemsWithReadings();
  const meaningAccurateCount = completedItemsWithMeanings.filter(
    (item) => item.meaningIncorrect === 0
  ).length;
  const readingAccurateCount = completedItemsWithReadings.filter(
    (item) => item.readingIncorrect === 0
  ).length;
  const meaningAccuracyDisplay =
    completedItemsWithMeanings.length > 0
      ? `${Math.round(
          (meaningAccurateCount / completedItemsWithMeanings.length) * 100
        )}%`
      : "N/A";
  const readingAccuracyDisplay =
    completedItemsWithReadings.length > 0
      ? `${Math.round(
          (readingAccurateCount / completedItemsWithReadings.length) * 100
        )}%`
      : "N/A";
  const overallAccuracy =
    progress.answeredCount > 0
      ? Math.round((progress.correctAnswersCount / progress.answeredCount) * 100)
      : 0;

  // Calculate detailed statistics
  const getItemColor = (itemType: string) => {
    return getSubjectTypeColor(itemType as any);
  };

  // Analyze item performance (only for completed items)
  const getItemPerformance = (): ItemPerformance[] => {
    return completedItems.map((item) => {
      const meaningStatus: "correct" | "incorrect" | "none" =
        !isMeaningApplicable(item)
          ? "none"
          : item.meaningIncorrect > 0
          ? "incorrect"
          : item.meaningCorrectlyAnswered
          ? "correct"
          : "none";

      const readingStatus: "correct" | "incorrect" | "none" =
        !isReadingApplicable(item)
          ? "none"
          : item.readingIncorrect > 0
          ? "incorrect"
          : item.readingCorrectlyAnswered
          ? "correct"
          : "none";

      const totalMistakes =
        (isMeaningApplicable(item) ? item.meaningIncorrect : 0) +
        (isReadingApplicable(item) ? item.readingIncorrect : 0);

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
  const mistakeSubjectIds = Array.from(
    new Set(
      itemsWithMistakes.map(
        (perf) => perf.item.subject?.id ?? perf.item.subjectId ?? perf.item.id
      )
    )
  );
  const hasMistakeSubjects = mistakeSubjectIds.length > 0;

  // Calculate category statistics
  const getStatsByCategory = () => {
    const stats = {
      radical: { total: 0, perfect: 0, mistakes: 0 },
      kanji: { total: 0, perfect: 0, mistakes: 0 },
      vocabulary: { total: 0, perfect: 0, mistakes: 0 },
    };

    itemPerformance.forEach((perf) => {
      const type =
        (perf.item.subject.object as any) === "kana_vocabulary"
          ? "vocabulary"
          : perf.item.subject.object;
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

  const openSubjectDetails = (subjectId: number) => {
    router.push({
      pathname: "/subject/[id]",
      params: { id: subjectId.toString() },
    });
  };

  const handlePracticeMistakes = () => {
    if (!hasMistakeSubjects) {
      return;
    }

    router.push({
      pathname: "/custom-review",
      params: { subjectIds: mistakeSubjectIds.join(",") },
    });
  };

  const handleAddMistakesToList = () => {
    if (!hasMistakeSubjects) {
      return;
    }
    setShowAddMistakesToListModal(true);
  };

  const hasSecondaryAction = Boolean(secondaryActionLabel && onSecondaryAction);

  const toggleItemReveal = (itemId: number) => {
    setRevealedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const toggleRequizMode = () => {
    setHideAnswersForRequiz((prev) => !prev);
    setRevealedItemIds(new Set());
  };

  const getPrimaryReading = (subject: Subject): string | null => {
    const readings = subject.data.readings;
    if (!readings || readings.length === 0) {
      return null;
    }

    const primaryReadings = readings.filter((reading) => reading.primary);
    const acceptedReadings = readings.filter((reading) => reading.accepted_answer);
    const candidates =
      primaryReadings.length > 0
        ? primaryReadings
        : acceptedReadings.length > 0
        ? acceptedReadings
        : readings;

    return candidates.map((reading) => reading.reading).slice(0, 2).join(" ・ ");
  };

  // Character display component with SVG fallback for radicals
  const CharacterDisplay = ({
    subject,
    size = 32,
  }: {
    subject: Subject;
    size?: number;
  }) => {
    const isRadical = subject.object === "radical";

    // For radicals, try SVG fallback if no characters
    const bestImg =
      isRadical && subject.data.character_images?.length
        ? pickBestImage(subject.data.character_images)
        : null;
    const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
    const svgXml = useRemoteSvg(svgUrl, "#ffffff");

    // Display logic: characters → SVG → meaning
    if (subject.data.characters) {
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
          {subject.data.characters}
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
        {subject.data.meanings[0].meaning}
      </Text>
    );
  };

  // Render item card
  const renderItemCard = ({ item: perf }: { item: ItemPerformance }) => {
    const { item, meaningStatus, readingStatus, totalMistakes } = perf;
    const hasMeaning = isMeaningApplicable(item);
    const hasReading = isReadingApplicable(item);
    const isRevealed = !hideAnswersForRequiz || revealedItemIds.has(item.id);
    const primaryMeaning = item.subject.data.meanings[0]?.meaning ?? "—";
    const primaryReading = hasReading ? getPrimaryReading(item.subject) : null;

    return (
      <TouchableOpacity
        style={[
          styles.itemCard,
          { width: itemCardWidth },
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
            borderTopColor: getItemColor(item.subject.object),
          },
        ]}
        onPress={() => {
          if (hideAnswersForRequiz) {
            toggleItemReveal(item.id);
            return;
          }
          openSubjectDetails(item.subject.id);
        }}
        onLongPress={() => openSubjectDetails(item.subject.id)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.itemHeader,
            { backgroundColor: getItemColor(item.subject.object) },
          ]}
        >
          <CharacterDisplay subject={item.subject} size={28} />
          {totalMistakes > 0 && (
            <View style={styles.mistakesBadge}>
              <Text style={styles.mistakesBadgeText}>{totalMistakes}</Text>
            </View>
          )}
        </View>

        <View style={styles.itemContent}>
          {hasMeaning && (
            <View style={styles.answerBlock}>
              <View style={styles.answerHeaderRow}>
                <Text
                  style={[styles.answerLabel, { color: theme.textSecondary }]}
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
                  size={14}
                  color={
                    meaningStatus === "correct"
                      ? "#4caf50"
                      : meaningStatus === "incorrect"
                      ? "#f44336"
                      : theme.textSecondary
                  }
                />
              </View>
              <Text
                style={[
                  styles.answerValue,
                  {
                    color: isRevealed ? theme.textColor : theme.textSecondary,
                  },
                  !isRevealed && styles.answerHiddenValue,
                ]}
                numberOfLines={2}
              >
                {isRevealed ? primaryMeaning : "Tap to reveal"}
              </Text>
            </View>
          )}

          {hasReading && (
            <View style={styles.answerBlock}>
              <View style={styles.answerHeaderRow}>
                <Text
                  style={[styles.answerLabel, { color: theme.textSecondary }]}
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
                  size={14}
                  color={
                    readingStatus === "correct"
                      ? "#4caf50"
                      : readingStatus === "incorrect"
                      ? "#f44336"
                      : theme.textSecondary
                  }
                />
              </View>
              <Text
                style={[
                  styles.answerValue,
                  isRevealed && fontStyles.japaneseText,
                  {
                    color: isRevealed ? theme.textColor : theme.textSecondary,
                  },
                  !isRevealed && styles.answerHiddenValue,
                ]}
                numberOfLines={2}
              >
                {isRevealed ? primaryReading ?? "—" : "Tap to reveal"}
              </Text>
            </View>
          )}

          {hideAnswersForRequiz ? (
            <Text style={[styles.requizHint, { color: theme.textSecondary }]}>
              Long press for details
            </Text>
          ) : null}
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

  if (submittingResults) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.submittingContainer}>
          <ActivityIndicator size="large" color={theme.secondary} />
          <Text style={[styles.submittingText, { color: theme.textSecondary }]}>
            Submitting your results...
          </Text>
        </View>
      </View>
    );
  }

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
            Review Complete!
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Great job! Here&apos;s how you did:
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
                percentage={overallAccuracy}
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
                  {meaningAccuracyDisplay}
                </Text>
                <Text
                  style={[styles.statLabel, { color: theme.textSecondary }]}
                >
                  Meaning Accuracy
                </Text>
              </View>

              <View style={styles.statItem}>
                <Text style={[styles.statNumber, { color: theme.textColor }]}>
                  {readingAccuracyDisplay}
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

        {/* Requiz Mode */}
        <View
          style={[
            styles.requizContainer,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <TouchableOpacity
            style={styles.requizToggleRow}
            onPress={toggleRequizMode}
            activeOpacity={0.8}
          >
            <View style={styles.requizToggleLeft}>
              <Ionicons
                name={hideAnswersForRequiz ? "eye-off-outline" : "eye-outline"}
                size={18}
                color={theme.textColor}
                style={styles.requizIcon}
              />
              <Text style={[styles.requizToggleTitle, { color: theme.textColor }]}>
                Tap To Reveal Answers
              </Text>
            </View>
            <View
              style={[
                styles.requizBadge,
                {
                  backgroundColor: hideAnswersForRequiz
                    ? theme.secondary
                    : theme.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.requizBadgeText,
                  {
                    color: hideAnswersForRequiz ? "white" : theme.textSecondary,
                  },
                ]}
              >
                {hideAnswersForRequiz ? "ON" : "OFF"}
              </Text>
            </View>
          </TouchableOpacity>
          <Text style={[styles.requizDescription, { color: theme.textSecondary }]}>
            {hideAnswersForRequiz
              ? "Tap cards to reveal meaning/reading."
              : "Show meaning and reading directly on cards."}
          </Text>
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

      {/* Bottom Action Button */}
      <View
        style={[
          styles.bottomContainer,
          { backgroundColor: theme.backgroundColor },
          { paddingBottom: bottomActionPadding },
        ]}
      >
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.secondary }]}
          onPress={onBackToDashboard}
          activeOpacity={0.8}
        >
          <Text style={styles.backButtonText}>Back to Dashboard</Text>
        </TouchableOpacity>
        {hasMistakeSubjects ? (
          <View style={styles.mistakesActionsRow}>
            <TouchableOpacity
              style={[
                styles.practiceMistakesButton,
                { borderColor: "#f44336" },
              ]}
              onPress={handlePracticeMistakes}
              activeOpacity={0.8}
            >
              <Text style={styles.practiceMistakesButtonText}>
                {`Practice Mistakes • ${mistakeSubjectIds.length}`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.iconOnlyActionButton,
                { borderColor: theme.secondary },
              ]}
              onPress={handleAddMistakesToList}
              activeOpacity={0.8}
              accessibilityLabel="Add mistakes to lists"
            >
              <Ionicons
                name="bookmark-outline"
                size={20}
                color={theme.secondary}
              />
            </TouchableOpacity>

            {hasSecondaryAction ? (
              <TouchableOpacity
                style={[
                  styles.iconOnlyActionButton,
                  { borderColor: theme.secondary },
                ]}
                onPress={onSecondaryAction}
                activeOpacity={0.8}
                accessibilityLabel={secondaryActionLabel}
              >
                <Ionicons name="refresh-outline" size={20} color={theme.secondary} />
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
        {!hasMistakeSubjects && secondaryActionLabel && onSecondaryAction ? (
          <TouchableOpacity
            style={[
              styles.secondaryActionButton,
              { borderColor: theme.secondary },
            ]}
            onPress={onSecondaryAction}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.secondaryActionButtonText,
                { color: theme.secondary },
              ]}
            >
              {secondaryActionLabel}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <AddToSubjectListsModal
        visible={showAddMistakesToListModal}
        subjectIds={mistakeSubjectIds}
        subjectLabel={`Session mistakes (${mistakeSubjectIds.length})`}
        onClose={() => setShowAddMistakesToListModal(false)}
      />
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
  submittingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  submittingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: "center",
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
  requizContainer: {
    marginHorizontal: 16,
    marginTop: 0,
    marginBottom: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  requizToggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  requizToggleLeft: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 1,
    marginRight: 8,
  },
  requizIcon: {
    marginRight: 8,
  },
  requizToggleTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  requizBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    minWidth: 42,
    alignItems: "center",
  },
  requizBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  requizDescription: {
    marginTop: 8,
    fontSize: 12,
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
    alignItems: "flex-start",
  },
  itemCard: {
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
  answerBlock: {
    marginBottom: 8,
  },
  answerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  answerLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  answerValue: {
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 18,
  },
  answerHiddenValue: {
    letterSpacing: 0.2,
  },
  requizHint: {
    fontSize: 11,
    marginTop: 2,
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
  backButton: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  backButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  practiceMistakesButton: {
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    alignItems: "center",
    flex: 1,
    backgroundColor: "rgba(244, 67, 54, 0.08)",
  },
  practiceMistakesButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#f44336",
  },
  mistakesActionsRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  iconOnlyActionButton: {
    width: 54,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  secondaryActionButton: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 2,
    padding: 16,
    alignItems: "center",
  },
  secondaryActionButtonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
