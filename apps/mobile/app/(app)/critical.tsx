import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useNavigation, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import {
  CommonFilterModal,
  FilterSection,
} from "../../src/components/CommonFilterModal";
import { GlassButton } from "../../src/components/GlassButton";
import { CriticalItem, WaniKaniItemType } from "../../src/types/wanikani";
import {
  ApiError,
  fetchAllPages,
  getReviewStatistics,
  getSubjects,
} from "../../src/utils/api";
import { fontStyles } from "../../src/utils/fonts";
import { errorService } from "../../src/services/errorService";
import { pickBestImage, useRemoteSvg } from "../../src/utils/radicalSvg";
import { getSubjectTypeColor } from "../../src/utils/subjectColors";
import { useAuthStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SwiftUI = Platform.OS === "ios" ? require("@expo/ui/swift-ui") : null;

// Extended type to include kana_vocabulary
type ItemType = WaniKaniItemType | "kana_vocabulary";
const DEFAULT_THRESHOLD = 75;
const SUBJECT_IDS_BATCH_SIZE = 1000;

export default function CriticalItemsScreen() {
  const { apiToken } = useAuthStore();
  const navigation = useNavigation();
  const router = useRouter();
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allCriticalItems, setAllCriticalItems] = useState<CriticalItem[]>([]);
  const [filter, setFilter] = useState<ItemType | "all">("all");
  const [appliedFilter, setAppliedFilter] = useState<ItemType | "all">("all");
  const [threshold, setThreshold] = useState<number>(DEFAULT_THRESHOLD);
  const [loadedThreshold, setLoadedThreshold] = useState<number>(DEFAULT_THRESHOLD);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  const headerIconColor = theme.isDark ? theme.headerText : "#000000";

  // Compute criticalItems based on current threshold
  const criticalItems = useMemo(() => {
    return allCriticalItems.filter((item) => item.percentage < threshold);
  }, [allCriticalItems, threshold]);

  // Get filtered items
  const filteredItems = useMemo(() => {
    if (appliedFilter === "all") return criticalItems;
    return criticalItems.filter((item) => item.type === appliedFilter);
  }, [criticalItems, appliedFilter]);

  // Fetch critical items
  const fetchCriticalItems = useCallback(
    async (maxPercent = DEFAULT_THRESHOLD) => {
      if (!apiToken) return;

      setIsLoading(true);
      setError(null);

      const reviewStatisticsParams = {
        percentages_less_than: maxPercent,
      };
      let fetchStep = "load_review_statistics_initial";
      let initialReviewStatsCount: number | null = null;
      let totalReviewStatsCount: number | null = null;
      let subjectIds: number[] = [];
      let uniqueSubjectIdsCount: number | null = null;
      let subjectsReturnedCount: number | null = null;
      let subjectsBatchCount: number | null = null;
      let failedSubjectsBatchIndex: number | null = null;
      let failedSubjectsBatchSize: number | null = null;

      try {
        console.log(
          `Fetching all critical items with accuracy below ${maxPercent}%...`
        );
        // Fetch review statistics with percentage under maxPercent.
        const initialResponse = await getReviewStatistics(
          apiToken,
          reviewStatisticsParams
        );
        initialReviewStatsCount = initialResponse.data.length;

        fetchStep = "load_review_statistics_all_pages";
        const reviewStats = await fetchAllPages(initialResponse, apiToken);
        totalReviewStatsCount = reviewStats.data.length;

        if (!reviewStats.data.length) {
          setLoadedThreshold((prev) => Math.max(prev, maxPercent));
          setAllCriticalItems([]);
          setIsLoading(false);
          return;
        }

        // Get all subject IDs from the review statistics
        fetchStep = "extract_subject_ids";
        subjectIds = reviewStats.data.map(
          (stat: any) => stat.data.subject_id
        );
        const uniqueSubjectIds = Array.from(new Set(subjectIds));
        uniqueSubjectIdsCount = uniqueSubjectIds.length;

        // Fetch all subjects for these IDs
        fetchStep = "load_subjects";
        const subjectIdBatches: number[][] = [];
        for (
          let i = 0;
          i < uniqueSubjectIds.length;
          i += SUBJECT_IDS_BATCH_SIZE
        ) {
          const batch = uniqueSubjectIds.slice(i, i + SUBJECT_IDS_BATCH_SIZE);
          if (batch.length > 0) {
            subjectIdBatches.push(batch);
          }
        }
        subjectsBatchCount = subjectIdBatches.length;

        const allSubjects: any[] = [];
        for (let batchIndex = 0; batchIndex < subjectIdBatches.length; batchIndex++) {
          const batchIds = subjectIdBatches[batchIndex];
          try {
            const subjectsResponse = await getSubjects(
              apiToken,
              { ids: batchIds }
            );
            allSubjects.push(...subjectsResponse.data);
          } catch (batchError) {
            failedSubjectsBatchIndex = batchIndex + 1;
            failedSubjectsBatchSize = batchIds.length;
            throw batchError;
          }
        }
        subjectsReturnedCount = allSubjects.length;

        // Create a map of subjects by ID for easy lookup
        const subjectsById = allSubjects.reduce(
          (acc: Record<number, any>, subject: any) => {
            acc[subject.id] = subject;
            return acc;
          },
          {}
        );

        // Map and process the critical items
        fetchStep = "map_critical_items";
        const processedItems = reviewStats.data
          .map((stat: any) => {
            const subject = subjectsById[stat.data.subject_id];
            if (!subject) return null;

            // Extract primary reading for kanji and vocabulary
            let reading = "";
            if (
              (subject.object === "kanji" || subject.object === "vocabulary") &&
              subject.data.readings
            ) {
              const primaryReading = subject.data.readings.find(
                (r: any) => r.primary
              );
              reading = primaryReading ? primaryReading.reading : "";
            }

            return {
              id: subject.id,
              characters: subject.data.characters || "",
              meaning: subject.data.meanings[0].meaning,
              type: subject.object as ItemType,
              percentage: stat.data.percentage_correct,
              meaningIncorrect: stat.data.meaning_incorrect,
              meaningCorrect: stat.data.meaning_correct,
              readingIncorrect:
                subject.object !== "radical" ? stat.data.reading_incorrect : 0,
              readingCorrect:
                subject.object !== "radical" ? stat.data.reading_correct : 0,
              character_images: subject.data.character_images,
              reading,
            } as CriticalItem;
          })
          .filter((item): item is CriticalItem => item !== null)
          .sort((a, b) => a.percentage - b.percentage);

        setLoadedThreshold((prev) => Math.max(prev, maxPercent));
        setAllCriticalItems(processedItems);
      } catch (error) {
        console.error("Error fetching critical items:", error);

        const errorObj = error instanceof Error ? error : new Error(String(error));
        const statusCode = error instanceof ApiError ? error.statusCode : null;
        const apiErrorDetails = error instanceof ApiError ? error.details : null;

        errorService.logError(errorObj, {
          extra: {
            context: "critical_items_load",
            step: fetchStep,
            maxPercent,
            reviewStatisticsParams,
            initialReviewStatsCount,
            totalReviewStatsCount,
            subjectIdsCount: subjectIds.length,
            uniqueSubjectIdsCount,
            subjectIdsSample: subjectIds.slice(0, 25),
            subjectsReturnedCount,
            subjectsBatchSize: SUBJECT_IDS_BATCH_SIZE,
            subjectsBatchCount,
            failedSubjectsBatchIndex,
            failedSubjectsBatchSize,
            statusCode,
            apiErrorDetails,
            errorName: errorObj.name,
            errorMessage: errorObj.message,
          },
        });

        setError("Failed to load critical items. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [apiToken]
  );

  useEffect(() => {
    fetchCriticalItems(DEFAULT_THRESHOLD);
  }, [fetchCriticalItems]); // Initial load (default threshold only)

  // Only fetch more data if user expands the threshold beyond what we've loaded.
  useEffect(() => {
    if (threshold > loadedThreshold) {
      fetchCriticalItems(threshold);
    }
  }, [fetchCriticalItems, loadedThreshold, threshold]);

  // Apply filter with debounce effect to prevent UI lag
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedFilter(filter);
    }, 50); // Small delay to prevent UI lag

    return () => clearTimeout(timer);
  }, [filter]);

  const handleItemPress = (item: CriticalItem) => {
    router.push(`/subject/${item.id}`);
  };

  const startCustomSessionForFilteredItems = useCallback(
    (mode: "lesson" | "review") => {
      const subjectIds = Array.from(new Set(filteredItems.map((item) => item.id)));

      if (subjectIds.length === 0) {
        Alert.alert(
          "No items to study",
          "There are no critical items in the current filter."
        );
        return;
      }

      router.push({
        pathname: mode === "lesson" ? "/custom-lesson" : "/custom-review",
        params: { subjectIds: subjectIds.join(",") },
      });
    },
    [filteredItems, router]
  );

  const handleRedoLessons = useCallback(() => {
    startCustomSessionForFilteredItems("lesson");
  }, [startCustomSessionForFilteredItems]);

  const handleReviewItems = useCallback(() => {
    startCustomSessionForFilteredItems("review");
  }, [startCustomSessionForFilteredItems]);

  const openStudyMenuFallback = useCallback(() => {
    Alert.alert("Critical Items", "Choose an action", [
      { text: "Re-do lessons", onPress: handleRedoLessons },
      { text: "Review Items", onPress: handleReviewItems },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [handleRedoLessons, handleReviewItems]);

  const handleApplyFilters = (values: Record<string, any>) => {
    setFilter(values.subjectType);
    setThreshold(values.threshold);
  };

  const filterSections: FilterSection[] = [
    {
      id: "subjectType",
      title: "Subject Type",
      options: [
        { id: "all", label: "All" },
        { id: "radical", label: "Radicals" },
        { id: "kanji", label: "Kanji" },
        { id: "vocabulary", label: "Vocabulary" },
        { id: "kana_vocabulary", label: "Kana Vocab" },
      ],
    },
    {
      id: "threshold",
      title: "Accuracy Below",
      options: [
        { id: 90, label: "90%" },
        { id: 75, label: "75%" },
        { id: 60, label: "60%" },
      ],
    },
  ];

  // Character display component with SVG fallback
  const CriticalItemCharacter = ({ item }: { item: CriticalItem }) => {
    const isRadical = item.type === "radical";

    // For radicals, try SVG fallback if no characters
    const bestImg =
      isRadical && item.character_images?.length
        ? pickBestImage(item.character_images)
        : null;
    const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
    const svgXml = useRemoteSvg(svgUrl, "#ffffff"); // White color for visibility

    // Debug logging for radicals without characters
    if (isRadical && !item.characters) {
      console.log("[CriticalPageSVG Debug] Radical without characters:", {
        id: item.id,
        meaning: item.meaning,
        character_images: item.character_images,
        bestImg,
        svgUrl,
        svgXml: !!svgXml,
      });
    }

    // Display logic: characters → SVG → meaning (no fallback while loading)
    if (item.characters) {
      return (
        <Text
          style={[styles.itemCharacter, fontStyles.japaneseText]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.characters}
        </Text>
      );
    }

    if (svgXml) {
      console.log("[CriticalPageSVG Debug] Rendering SVG for:", item.meaning);
      return <SvgXml xml={svgXml} width={24} height={24} />;
    }

    // If we have an SVG URL but no svgXml yet, show nothing (still loading)
    if (svgUrl) {
      console.log("[CriticalPageSVG Debug] SVG loading for:", item.meaning);
      return null;
    }

    // Final fallback to meaning (only if no SVG available)
    console.log(
      "[CriticalPageSVG Debug] No SVG available, showing meaning for:",
      item.meaning
    );
    return (
      <Text
        style={[styles.itemCharacter, fontStyles.japaneseText]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {item.meaning}
      </Text>
    );
  };

  // Render an item
  const renderItem = ({ item }: { item: CriticalItem }) => {
    const getItemColor = (type: ItemType) => {
      return getSubjectTypeColor(type as any);
    };

    return (
      <TouchableOpacity
        style={[
          styles.itemContainer,
          { backgroundColor: theme.cardBackground, borderColor: theme.border },
        ]}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.itemBox,
            { backgroundColor: getItemColor(item.type as ItemType) },
            // Make vocabulary boxes wider based on character length with no limit
            (item.type === "vocabulary" || item.type === "kana_vocabulary") &&
              item.characters &&
              item.characters.length > 1 && {
                width: 48 + (item.characters.length - 2) * 24 + 16,
              }, // Double width per character + padding
          ]}
        >
          <CriticalItemCharacter item={item} />
        </View>
        <View style={styles.itemDetails}>
          <Text style={[styles.itemMeaning, { color: theme.textColor }]}>
            {item.meaning}
          </Text>
          {(item.type === "kanji" || item.type === "vocabulary") &&
            item.reading && (
              <Text style={[styles.itemType, { color: theme.textSecondary }]}>
                {item.reading}
              </Text>
            )}
        </View>
        <View style={styles.percentageContainer}>
          <Text
            style={[
              styles.percentageText,
              { color: item.percentage < 50 ? theme.error : theme.accent },
            ]}
          >
            {Math.round(item.percentage)}%
          </Text>
          <View style={styles.statsContainer}>
            <Text style={[styles.statsText, { color: theme.textLight }]}>
              Meaning: {item.meaningCorrect ?? 0}/
              {(item.meaningCorrect ?? 0) + (item.meaningIncorrect ?? 0)}
            </Text>
            {item.type !== "radical" && (
              <Text style={[styles.statsText, { color: theme.textLight }]}>
                Reading: {item.readingCorrect ?? 0}/
                {(item.readingCorrect ?? 0) + (item.readingIncorrect ?? 0)}
              </Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <StatusBar style={theme.statusBarStyle} />
      <View
        style={[styles.header, { backgroundColor: theme.headerBackground }]}
      >
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={theme.headerText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headerText }]}>
            Critical Items
          </Text>
        </View>
        <View style={styles.headerActions}>
          {Platform.OS === "ios" && SwiftUI ? (
            <SwiftUI.Host matchContents>
              <SwiftUI.Menu
                label={
                  <SwiftUI.RNHostView matchContents>
                    <GlassButton
                      iconName="ellipsis-horizontal"
                      iconColor={headerIconColor}
                      iconSize={20}
                    />
                  </SwiftUI.RNHostView>
                }
              >
                <SwiftUI.Button
                  label="Re-do lessons"
                  systemImage="arrow.counterclockwise"
                  onPress={handleRedoLessons}
                />
                <SwiftUI.Button
                  label="Review Items"
                  systemImage="checkmark.circle"
                  onPress={handleReviewItems}
                />
              </SwiftUI.Menu>
            </SwiftUI.Host>
          ) : (
            <GlassButton
              iconName="ellipsis-horizontal"
              onPress={openStudyMenuFallback}
              iconColor={headerIconColor}
              iconSize={20}
            />
          )}
          <GlassButton
            iconName="filter"
            onPress={() => setIsFilterModalVisible(true)}
            iconColor={headerIconColor}
            iconSize={20}
          />
        </View>
      </View>

      <CommonFilterModal
        visible={isFilterModalVisible}
        onClose={() => setIsFilterModalVisible(false)}
        onApply={handleApplyFilters}
        currentValues={{
          subjectType: filter,
          threshold: threshold,
        }}
        sections={filterSections}
        title="Filter Critical Items"
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading critical items...
          </Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={() =>
              fetchCriticalItems(Math.max(loadedThreshold, threshold))
            }
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="checkmark-circle-outline"
            size={48}
            color={theme.accent}
          />
          <Text style={[styles.emptyText, { color: theme.accent }]}>
            No critical items found
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textSecondary }]}>
            Great job! All your items are above {threshold}% accuracy.
          </Text>
        </View>
      ) : (
        <FlashList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id.toString()}
          extraData={appliedFilter}
          contentContainerStyle={styles.listContent}
        />
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
    justifyContent: "space-between",
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
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
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
  },
  retryButtonText: {
    color: "white",
    fontWeight: "bold",
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: "bold",
  },
  emptySubtext: {
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
  },
  listContent: {
    padding: 16,
  },
  itemContainer: {
    flexDirection: "row",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 1,
    elevation: 1,
    alignItems: "center",
  },
  itemBox: {
    width: 48,
    height: 48,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  itemCharacter: {
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: "SourceHanSansJP-Bold",
  },
  itemDetails: {
    flex: 1,
  },
  itemMeaning: {
    fontSize: 16,
    fontWeight: "bold",
  },
  itemType: {
    fontSize: 12,
    textTransform: "capitalize",
  },
  percentageContainer: {
    alignItems: "flex-end",
  },
  percentageText: {
    fontSize: 20,
    fontWeight: "bold",
  },
  statsContainer: {
    marginTop: 4,
  },
  statsText: {
    fontSize: 10,
  },
});
