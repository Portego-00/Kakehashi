import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { useNavigation, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
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
import { BurnedItem, WaniKaniItemType } from "../../src/types/wanikani";
import {
  fetchAllPages,
  getAssignments,
  getSubjects,
} from "../../src/utils/api";
import { fontStyles } from "../../src/utils/fonts";
import { pickBestImage, useRemoteSvg } from "../../src/utils/radicalSvg";
import { getSubjectTypeColor } from "../../src/utils/subjectColors";
import { useAuthStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

// Helper function to format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Check if date is today
  if (date.toDateString() === today.toDateString()) {
    return "Today";
  }

  // Check if date is yesterday
  if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  // Return formatted date (e.g., "Jan 1, 2023")
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Extended type for kana vocabulary
type ItemType = WaniKaniItemType | "kana_vocabulary";
const DEFAULT_TIME_RANGE_DAYS = 30;
const SUBJECT_IDS_BATCH_SIZE = 1000;

// Character display component with SVG fallback for radicals
const BurnedItemCharacter = ({ item }: { item: BurnedItem }) => {
  const isRadical = item.type === "radical";

  // For radicals, try SVG fallback if no characters
  const bestImg =
    isRadical && item.character_images?.length
      ? pickBestImage(item.character_images)
      : null;
  const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
  const svgXml = useRemoteSvg(svgUrl, "#ffffff"); // White color for visibility

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
    return <SvgXml xml={svgXml} width={24} height={24} />;
  }

  // If we have an SVG URL but no svgXml yet, show nothing (still loading)
  if (svgUrl) {
    return null;
  }

  // Final fallback to meaning (only if no SVG available)
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

export default function BurnedItemsScreen() {
  const { apiToken } = useAuthStore();
  const navigation = useNavigation();
  const router = useRouter();
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allBurnedItems, setAllBurnedItems] = useState<BurnedItem[]>([]);
  const [filter, setFilter] = useState<ItemType | "all">("all");
  const [timeRange, setTimeRange] = useState<number>(DEFAULT_TIME_RANGE_DAYS);
  const [loadedTimeRange, setLoadedTimeRange] = useState<number>(
    DEFAULT_TIME_RANGE_DAYS
  );
  const [appliedFilter, setAppliedFilter] = useState<ItemType | "all">("all");
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  const headerIconColor = theme.isDark ? theme.headerText : "#000000";

  // Compute burnedItems based on current timeRange
  const burnedItems = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRange);

    return allBurnedItems.filter((item) => {
      const itemDate = new Date(item.dateBurned);
      return itemDate >= cutoffDate;
    });
  }, [allBurnedItems, timeRange]);

  // Get filtered and sectioned items from the computed burnedItems
  const sectionedItems = useMemo(() => {
    // Filter by type if needed
    const filteredItems =
      appliedFilter === "all"
        ? burnedItems
        : burnedItems.filter((item) => item.type === appliedFilter);

    // Group by date
    const groupedByDate = filteredItems.reduce((acc, item) => {
      const dateKey = formatDate(item.dateBurned);

      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }

      acc[dateKey].push(item);
      return acc;
    }, {} as Record<string, BurnedItem[]>);

    // Convert to sections format with clear section identifiers
    return Object.keys(groupedByDate)
      .map((date) => ({
        title: date,
        data: groupedByDate[date],
        sectionId: date, // Add unique identifier for sections
      }))
      .sort((a, b) => {
        // Sort sections in reverse chronological order
        if (a.title === "Today") return -1;
        if (b.title === "Today") return 1;
        if (a.title === "Yesterday") return -1;
        if (b.title === "Yesterday") return 1;

        // Compare dates (newest first)
        return (
          new Date(b.data[0].dateBurned).getTime() -
          new Date(a.data[0].dateBurned).getTime()
        );
      });
  }, [burnedItems, appliedFilter]);

  // Transform sectioned data into flat list format with section headers included
  const flatListData = useMemo(() => {
    const result: { id: string; type: "header" | "item"; data: any }[] = [];

    sectionedItems.forEach((section) => {
      // Add header
      result.push({
        id: `header-${section.sectionId}`,
        type: "header",
        data: { title: section.title },
      });

      // Add items
      section.data.forEach((item) => {
        result.push({
          id: `item-${item.id}`,
          type: "item",
          data: item,
        });
      });
    });

    return result;
  }, [sectionedItems]);

  // Fetch burned items
  const fetchBurnedItems = useCallback(
    async (daysRange = DEFAULT_TIME_RANGE_DAYS) => {
      if (!apiToken) return;

      setIsLoading(true);
      setError(null);

      try {
        console.log(
          `Fetching all burned items for the last ${daysRange} days...`
        );

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysRange);

        // Fetch burned assignments
        const initialAssignmentsResponse = await getAssignments(apiToken, {
          burned: true,
          // Keep payload small by requesting only records updated in range.
          updated_after: startDate.toISOString(),
        });
        const allAssignments = await fetchAllPages(
          initialAssignmentsResponse,
          apiToken
        );

        // Filter by burned date on the client side
        const filteredAssignments = allAssignments.data.filter((assignment) => {
          if (!assignment.data.burned_at) return false;

          const burnedDate = new Date(assignment.data.burned_at);
          return burnedDate >= startDate && burnedDate <= endDate;
        });

        console.log(
          `Total burned items found in range: ${filteredAssignments.length}`
        );

        if (!filteredAssignments.length) {
          setLoadedTimeRange((prev) => Math.max(prev, daysRange));
          setAllBurnedItems([]);
          setIsLoading(false);
          return;
        }

        // Get all subject IDs from the assignments
        const subjectIds = filteredAssignments.map(
          (assignment) => assignment.data.subject_id
        );
        const uniqueSubjectIds = Array.from(new Set(subjectIds));

        // Fetch subjects in batches to avoid oversized ids query errors.
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
            console.error(
              `[Burned] Failed to fetch subjects batch ${batchIndex + 1}/${
                subjectIdBatches.length
              } (size=${batchIds.length})`,
              batchError
            );
            throw batchError;
          }
        }

        // Create a map of subjects by ID for easy lookup
        const subjectsById = allSubjects.reduce(
          (acc: Record<number, any>, subject: any) => {
            acc[subject.id] = subject;
            return acc;
          },
          {}
        );

        // Map and process the burned items
        const items: BurnedItem[] = [];

        for (const assignment of filteredAssignments) {
          const subject = subjectsById[assignment.data.subject_id];
          if (!subject) continue;

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

          items.push({
            id: subject.id,
            characters: subject.data.characters,
            meaning: subject.data.meanings[0].meaning,
            type: subject.object as WaniKaniItemType,
            dateBurned: assignment.data.burned_at || "",
            character_images: subject.data.character_images,
            reading,
          });
        }

        // Sort the items by burn date (newest first)
        items.sort(
          (a, b) =>
            new Date(b.dateBurned).getTime() - new Date(a.dateBurned).getTime()
        );

        setLoadedTimeRange((prev) => Math.max(prev, daysRange));
        setAllBurnedItems(items);
      } catch (error) {
        console.error("Error fetching burned items:", error);
        setError("Failed to load burned items. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [apiToken]
  );

  useEffect(() => {
    fetchBurnedItems(DEFAULT_TIME_RANGE_DAYS);
  }, [fetchBurnedItems]);

  // Only fetch more when the user expands beyond what is already loaded.
  useEffect(() => {
    if (timeRange > loadedTimeRange) {
      fetchBurnedItems(timeRange);
    }
  }, [fetchBurnedItems, loadedTimeRange, timeRange]);

  // Apply filter with debounce effect to prevent UI lag
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedFilter(filter);
    }, 50);

    return () => clearTimeout(timer);
  }, [filter]);

  const handleItemPress = (item: BurnedItem) => {
    router.push(`/subject/${item.id}`);
  };

  const handleFilterPress = (newFilter: ItemType | "all") => {
    setFilter(newFilter);
  };

  const handleTimeRangeChange = (days: number) => {
    setTimeRange(days);
  };

  const handleRetry = () => {
    fetchBurnedItems(Math.max(timeRange, loadedTimeRange));
  };

  const handleApplyFilters = (values: Record<string, any>) => {
    setFilter(values.subjectType);
    setTimeRange(values.timeRange);
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
      id: "timeRange",
      title: "Time Range",
      options: [
        { id: 30, label: "30 days" },
        { id: 90, label: "90 days" },
        { id: 365, label: "Year" },
      ],
    },
  ];

  const renderFlashListItem = ({ item }: { item: any }) => {
    if (item.type === "header") {
      return (
        <View
          style={[
            styles.sectionHeader,
            {
              backgroundColor: theme.backgroundColor,
              borderBottomColor: theme.border,
            },
          ]}
        >
          <Text
            style={[styles.sectionHeaderText, { color: theme.textSecondary }]}
          >
            {item.data.title}
          </Text>
        </View>
      );
    }

    const burnedItem = item.data as BurnedItem;
    const getItemColor = (type: ItemType) => {
      return getSubjectTypeColor(type as any);
    };

    return (
      <TouchableOpacity
        style={[
          styles.itemContainer,
          {
            backgroundColor: theme.cardBackground,
            borderBottomColor: theme.border,
          },
        ]}
        onPress={() => handleItemPress(burnedItem)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.itemBox,
            { backgroundColor: getItemColor(burnedItem.type as ItemType) },
            (burnedItem.type === "vocabulary" ||
              burnedItem.type === "kana_vocabulary") &&
              burnedItem.characters &&
              burnedItem.characters.length > 1 && {
                width: 48 + (burnedItem.characters.length - 2) * 24 + 16,
              },
          ]}
        >
          <BurnedItemCharacter item={burnedItem} />
        </View>
        <View style={styles.itemDetails}>
          <Text style={[styles.itemMeaning, { color: theme.textColor }]}>
            {burnedItem.meaning}
          </Text>
          <View style={styles.itemMetadata}>
            {(burnedItem.type === "kanji" ||
              burnedItem.type === "vocabulary") &&
              burnedItem.reading && (
                <Text style={[styles.itemType, { color: theme.textSecondary }]}>
                  {burnedItem.reading}
                </Text>
              )}
          </View>
        </View>
        <Text style={[styles.itemDate, { color: theme.textLight }]}>
          {new Date(burnedItem.dateBurned).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
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
            Burned Items
          </Text>
        </View>
        <GlassButton
          iconName="filter"
          onPress={() => setIsFilterModalVisible(true)}
          iconColor={headerIconColor}
          iconSize={20}
        />
      </View>

      <CommonFilterModal
        visible={isFilterModalVisible}
        onClose={() => setIsFilterModalVisible(false)}
        onApply={handleApplyFilters}
        currentValues={{
          subjectType: filter,
          timeRange: timeRange,
        }}
        sections={filterSections}
        title="Filter Burned Items"
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading burned items...
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
            onPress={handleRetry}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : flatListData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="flame-outline" size={48} color={theme.textLight} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No burned items found
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textLight }]}>
            No items have been burned in the last {timeRange} days.
          </Text>
        </View>
      ) : (
        <FlashList
          data={flatListData}
          renderItem={renderFlashListItem}
          keyExtractor={(item) => item.id}
          overrideItemLayout={(layout, item) => {
            if (item.type === "header") {
              layout.span = 37;
            } else {
              layout.span = 73;
            }
          }}
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
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  listContent: {
    paddingBottom: 16,
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
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  itemContainer: {
    flexDirection: "row",
    padding: 12,
    marginBottom: 1,
    borderBottomWidth: 1,
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
  itemMetadata: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  itemType: {
    fontSize: 12,
    textTransform: "capitalize",
    marginRight: 8,
  },
  itemLevel: {
    fontSize: 12,
  },
  itemDate: {
    fontSize: 12,
  },
});
