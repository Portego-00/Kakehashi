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
import { UnlockItem, WaniKaniItemType } from "../../src/types/wanikani";
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

// Extended type for kana vocabulary
type ItemType = WaniKaniItemType | "kana_vocabulary";
type StartedFilterOption = "all" | "not_started";

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

// Character display component with SVG fallback for radicals
const UnlockItemCharacter = ({ item }: { item: UnlockItem }) => {
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
    console.log("[UnlockPageSVG Debug] Radical without characters:", {
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
    console.log("[UnlockPageSVG Debug] Rendering SVG for:", item.meaning);
    return <SvgXml xml={svgXml} width={24} height={24} />;
  }

  // If we have an SVG URL but no svgXml yet, show nothing (still loading)
  if (svgUrl) {
    console.log("[UnlockPageSVG Debug] SVG loading for:", item.meaning);
    return null;
  }

  // Final fallback to meaning (only if no SVG available)
  console.log(
    "[UnlockPageSVG Debug] No SVG available, showing meaning for:",
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

export default function UnlocksScreen() {
  const { apiToken } = useAuthStore();
  const navigation = useNavigation();
  const router = useRouter();
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allUnlockItems, setAllUnlockItems] = useState<UnlockItem[]>([]);
  const [filter, setFilter] = useState<ItemType | "all">("all");
  const [timeRange, setTimeRange] = useState<number>(30); // Default: last 30 days
  const [appliedFilter, setAppliedFilter] = useState<ItemType | "all">("all");
  const [startedFilter, setStartedFilter] =
    useState<StartedFilterOption>("all");
  const [appliedStartedFilter, setAppliedStartedFilter] =
    useState<StartedFilterOption>("all");
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);

  const headerIconColor = theme.isDark ? theme.headerText : "#000000";

  // MAX_DAYS for initial fetch
  const MAX_DAYS = 90;

  // Compute unlockItems based on current timeRange
  const unlockItems = useMemo(() => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - timeRange);

    return allUnlockItems.filter((item) => {
      const itemDate = new Date(item.dateUnlocked);
      return itemDate >= cutoffDate;
    });
  }, [allUnlockItems, timeRange]);

  // Get filtered and sectioned items from the computed unlockItems
  const sectionedItems = useMemo(() => {
    const filteredByType =
      appliedFilter === "all"
        ? unlockItems
        : unlockItems.filter((item) => item.type === appliedFilter);
    const filteredItems =
      appliedStartedFilter === "not_started"
        ? filteredByType.filter((item) => !item.startedAt)
        : filteredByType;

    // Group by date
    const groupedByDate = filteredItems.reduce((acc, item) => {
      const dateKey = formatDate(item.dateUnlocked);

      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }

      acc[dateKey].push(item);
      return acc;
    }, {} as Record<string, UnlockItem[]>);

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
          new Date(b.data[0].dateUnlocked).getTime() -
          new Date(a.data[0].dateUnlocked).getTime()
        );
      });
  }, [unlockItems, appliedFilter, appliedStartedFilter]);

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

  // Fetch unlocks
  const fetchUnlocks = useCallback(
    async (daysRange = MAX_DAYS) => {
      if (!apiToken) return;

      setIsLoading(true);
      setError(null);

      try {
        console.log(`Fetching all unlocks for the last ${daysRange} days...`);

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysRange);

        // Fetch all assignments
        const initialAssignmentsResponse = await getAssignments(apiToken);
        const allAssignments = await fetchAllPages(
          initialAssignmentsResponse,
          apiToken
        );

        // Filter by unlock date on the client side
        const filteredAssignments = allAssignments.data.filter((assignment) => {
          if (!assignment.data.unlocked_at) return false;
          const unlockDate = new Date(assignment.data.unlocked_at);
          return unlockDate >= startDate && unlockDate <= endDate;
        });

        console.log(
          `Total unlocked assignments found: ${filteredAssignments.length}`
        );

        if (!filteredAssignments.length) {
          setAllUnlockItems([]);
          setIsLoading(false);
          return;
        }

        // Get all subject IDs
        const subjectIds = filteredAssignments.map(
          (assignment) => assignment.data.subject_id
        );

        // Fetch all subjects
        const subjectsResponse = await getSubjects(
          apiToken,
          { ids: subjectIds },
          { skipCollectionCache: true }
        );

        const subjectsById = subjectsResponse.data.reduce(
          (acc: Record<number, any>, subject: any) => {
            acc[subject.id] = subject;
            return acc;
          },
          {}
        );

        const items: UnlockItem[] = [];
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
            dateUnlocked: assignment.data.unlocked_at || "",
            startedAt: assignment.data.started_at,
            character_images: subject.data.character_images,
            reading,
            ...(subject.data.level !== undefined && {
              level: subject.data.level,
            }),
          });
        }

        items.sort(
          (a, b) =>
            new Date(b.dateUnlocked).getTime() -
            new Date(a.dateUnlocked).getTime()
        );

        setAllUnlockItems(items);
      } catch (error) {
        console.error("Error fetching unlocks:", error);
        setError("Failed to load unlocked items. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [apiToken]
  );

  useEffect(() => {
    fetchUnlocks(MAX_DAYS);
  }, [fetchUnlocks]);

  // Apply filter with debounce effect to prevent UI lag
  useEffect(() => {
    const timer = setTimeout(() => {
      setAppliedFilter(filter);
      setAppliedStartedFilter(startedFilter);
    }, 50);

    return () => clearTimeout(timer);
  }, [filter, startedFilter]);

  const handleItemPress = (item: UnlockItem) => {
    router.push(`/subject/${item.id}`);
  };

  const handleRetry = () => {
    fetchUnlocks(MAX_DAYS);
  };

  const handleApplyFilters = (values: Record<string, any>) => {
    setFilter(values.subjectType);
    setTimeRange(values.timeRange);
    setStartedFilter(values.startedState);
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
        { id: 7, label: "7 days" },
        { id: 30, label: "30 days" },
        { id: 90, label: "90 days" },
      ],
    },
    {
      id: "startedState",
      title: "Progress",
      options: [
        { id: "all", label: "All" },
        { id: "not_started", label: "Not Started" },
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

    const unlockItem = item.data as UnlockItem;
    const getItemColor = (type: WaniKaniItemType) => {
      return getSubjectTypeColor(type);
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
        onPress={() => handleItemPress(unlockItem)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.itemBox,
            { backgroundColor: getItemColor(unlockItem.type) },
            (unlockItem.type === "vocabulary" ||
              unlockItem.type === "kana_vocabulary") &&
              unlockItem.characters &&
              unlockItem.characters.length > 1 && {
                width: 48 + (unlockItem.characters.length - 2) * 24 + 16,
              },
          ]}
        >
          <UnlockItemCharacter item={unlockItem} />
        </View>
        <View style={styles.itemDetails}>
          <Text style={[styles.itemMeaning, { color: theme.textColor }]}>
            {unlockItem.meaning}
          </Text>
          <View style={styles.itemMetadata}>
            {(unlockItem.type === "kanji" ||
              unlockItem.type === "vocabulary") &&
              unlockItem.reading && (
                <Text style={[styles.itemType, { color: theme.textSecondary }]}>
                  {unlockItem.reading}
                </Text>
              )}
            <Text style={[styles.itemLevel, { color: theme.textLight }]}>
              Level {unlockItem.level}
            </Text>
          </View>
        </View>
        <Text style={[styles.itemDate, { color: theme.textLight }]}>
          {new Date(unlockItem.dateUnlocked).toLocaleTimeString([], {
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
            Recent Unlocks
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
          startedState: startedFilter,
        }}
        sections={filterSections}
        title="Filter Unlocks"
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading unlocked items...
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
          <Ionicons
            name="folder-open-outline"
            size={48}
            color={theme.textLight}
          />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No unlocks found
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textLight }]}>
            {appliedFilter === "all" && appliedStartedFilter === "all"
              ? `No items have been unlocked in the last ${timeRange} days.`
              : "No items match your current filters."}
          </Text>
        </View>
      ) : (
        <FlashList
          data={flatListData}
          renderItem={renderFlashListItem}
          keyExtractor={(item) => item.id}
          overrideItemLayout={(layout, item) => {
            // Adjust layout for headers vs regular items
            if (item.type === "header") {
              layout.span = 37; // Height of section header
            } else {
              layout.span = 73; // Height of regular items
            }
          }}
          extraData={`${appliedFilter}-${appliedStartedFilter}`} // Re-render when filter changes
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
    paddingBottom: 16,
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
