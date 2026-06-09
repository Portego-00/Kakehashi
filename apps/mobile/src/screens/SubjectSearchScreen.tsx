import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { GlassButton } from "../components/GlassButton";
import { useDashboardData } from "../hooks/useDashboardData";
import {
  createDefaultSearchFilters,
  SearchFilterModal,
  SearchFilters,
} from "../components/SearchFilterModal";
import { WaniKaniItemType } from "../types/wanikani";
import {
  fetchAllPages,
  getAllAssignmentsCached,
  getSubjects,
  Subject,
} from "../utils/api";
import {
  ALL_SUBJECTS_CACHE_KEY,
  getAllSubjects,
  saveToCache,
} from "../utils/cache";
import { fontStyles } from "../utils/fonts";
import { supportsNativeTabs } from "../utils/nativeTabs";
import { pickBestImage, useRemoteSvg } from "../utils/radicalSvg";
import { getSubjectTypeColor } from "../utils/subjectColors";
import { useAuthStore } from "../utils/store";
import {
  getDefaultSubjectSearchConfig,
  rankSubjectsByQuery,
  sortSubjectsByLevelAndType,
} from "../utils/subjectSearch";
import { useTheme } from "../utils/theme";

interface SearchResultReading {
  reading: string;
  primary: boolean;
}

interface SearchResult {
  id: number;
  characters: string;
  meaning: string;
  type: WaniKaniItemType;
  level: number;
  readings: SearchResultReading[];
  characterImages?:
    | {
        url: string;
        content_type: string;
        metadata: {
          inline_styles?: boolean;
          color?: string;
          dimensions?: string;
          style_name?: string;
        };
      }[]
    | null;
  imageUrl?: string | null;
}

const SEARCH_BUTTON_TOTAL_WIDTH = 52;

function getReadingsForDisplay(subject: Subject): SearchResultReading[] {
  if (!subject.data.readings || subject.data.readings.length === 0) {
    return [];
  }

  const orderedReadings = [...subject.data.readings].sort((a, b) => {
    if (!!a.primary === !!b.primary) {
      return 0;
    }
    return a.primary ? -1 : 1;
  });

  const uniqueReadings: SearchResultReading[] = [];
  const seen = new Set<string>();
  for (const reading of orderedReadings) {
    if (!seen.has(reading.reading)) {
      seen.add(reading.reading);
      uniqueReadings.push({
        reading: reading.reading,
        primary: !!reading.primary,
      });
    }
  }

  return uniqueReadings;
}

// Adaptive debounce - longer delay for shorter queries to reduce API calls
function useAdaptiveDebounce(value: string, baseDelay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Longer delay for shorter queries to reduce performance impact
    const delay =
      value.length <= 1
        ? baseDelay * 3
        : value.length <= 2
        ? baseDelay * 2
        : baseDelay;

    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, baseDelay]);

  return debouncedValue;
}

function subjectToSearchResult(subject: Subject): SearchResult {
  return {
    id: subject.id,
    characters: subject.data.characters || "",
    meaning:
      subject.data.meanings.find((m) => m.primary)?.meaning ||
      subject.data.meanings[0]?.meaning ||
      "",
    type: subject.object as WaniKaniItemType,
    level: subject.data.level || 1,
    readings: getReadingsForDisplay(subject),
    characterImages:
      subject.object === "radical" ? subject.data.character_images : undefined,
    imageUrl:
      subject.object === "radical" && !subject.data.characters
        ? (subject.data as any).image_url || null
        : null,
  };
}

type SubjectSearchScreenProps = {
  forceInlineSearchBar?: boolean;
  topPadding?: number;
  showNativeTopTitle?: boolean;
};

export default function SubjectSearchScreen({
  forceInlineSearchBar = false,
  topPadding = 60,
  showNativeTopTitle = true,
}: SubjectSearchScreenProps = {}) {
  const { theme } = useTheme();
  const { apiToken } = useAuthStore();
  const { dashboardData } = useDashboardData();
  const router = useRouter();
  const params = useLocalSearchParams<{ query?: string }>();
  const usesNativeTabSearch = supportsNativeTabs() && !forceInlineSearchBar;
  const { width } = Dimensions.get("window");
  const isTablet = width > 768;
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allSubjects, setAllSubjects] = useState<Subject[] | null>(null);
  const [subjectSrsStageMap, setSubjectSrsStageMap] = useState<
    Map<number, number>
  >(new Map());
  const [isFocused, setIsFocused] = useState(false);
  const [isCacheMissing, setIsCacheMissing] = useState(false);
  const [isRebuildingCache, setIsRebuildingCache] = useState(false);
  const [cacheRebuildProgress, setCacheRebuildProgress] = useState(0);
  // Search and Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Filter State
  const [filters, setFilters] = useState<SearchFilters>(() =>
    createDefaultSearchFilters()
  );

  const buttonOpacity = useRef(new Animated.Value(1)).current;
  const buttonWidth = useRef(
    new Animated.Value(SEARCH_BUTTON_TOTAL_WIDTH)
  ).current;
  const textInputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList<SearchResult>>(null);
  const hasLoadedSubjectSrsStagesRef = useRef(false);
  const subjectSrsLoadInFlightRef = useRef(false);

  const debouncedSearchQuery = useAdaptiveDebounce(searchQuery, 300);
  const headerSearchQuery =
    typeof params.query === "string" ? params.query : "";
  const showInlineSearchBar = forceInlineSearchBar || !usesNativeTabSearch;
  const headerIconColor = theme.isDark ? theme.headerText : "#000000";

  useEffect(() => {
    if (!usesNativeTabSearch) {
      return;
    }
    setSearchQuery((prev) => {
      if (prev === headerSearchQuery) {
        return prev;
      }
      return headerSearchQuery;
    });

    // Sync native input with header query
    if (textInputRef.current) {
      textInputRef.current.setNativeProps({ text: headerSearchQuery });
    }
  }, [headerSearchQuery, usesNativeTabSearch]);

  useFocusEffect(
    useCallback(() => {
      let focusTimeout: ReturnType<typeof setTimeout> | null = null;
      if (showInlineSearchBar) {
        focusTimeout = setTimeout(() => {
          textInputRef.current?.focus();
        }, 100);
        return () => {
          if (focusTimeout) {
            clearTimeout(focusTimeout);
          }
        };
      }

      return undefined;
    }, [showInlineSearchBar])
  );

  // Load all subjects when screen mounts
  useEffect(() => {
    if (!allSubjects && apiToken) {
      loadAllSubjects();
    }
  }, [apiToken, allSubjects]);

  const loadSubjectSrsStages = useCallback(async () => {
    if (!apiToken) return;

    const dashboardAssignments = Array.isArray(dashboardData.assignments)
      ? dashboardData.assignments
      : [];

    if (dashboardAssignments.length > 0) {
      const nextSrsStageMap = new Map<number, number>();
      dashboardAssignments.forEach((assignment: any) => {
        const assignmentData = assignment?.data;
        if (typeof assignmentData?.subject_id === "number") {
          nextSrsStageMap.set(
            assignmentData.subject_id,
            assignmentData.srs_stage ?? 0
          );
        }
      });
      setSubjectSrsStageMap(nextSrsStageMap);
      hasLoadedSubjectSrsStagesRef.current = true;
      return;
    }

    try {
      const assignments = await getAllAssignmentsCached(apiToken);
      const nextSrsStageMap = new Map<number, number>();

      assignments.data.forEach((assignment) => {
        nextSrsStageMap.set(
          assignment.data.subject_id,
          assignment.data.srs_stage ?? 0
        );
      });

      setSubjectSrsStageMap(nextSrsStageMap);
      hasLoadedSubjectSrsStagesRef.current = true;
    } catch (err) {
      console.warn("Failed to load assignment SRS stages for search:", err);
      setSubjectSrsStageMap(new Map());
    }
  }, [apiToken, dashboardData.assignments]);

  useFocusEffect(
    useCallback(() => {
      if (!apiToken || hasLoadedSubjectSrsStagesRef.current) {
        return undefined;
      }

      if (subjectSrsLoadInFlightRef.current) {
        return undefined;
      }

      subjectSrsLoadInFlightRef.current = true;
      let isActive = true;

      void loadSubjectSrsStages().finally(() => {
        if (isActive) {
          subjectSrsLoadInFlightRef.current = false;
        }
      });

      return () => {
        isActive = false;
        subjectSrsLoadInFlightRef.current = false;
      };
    }, [apiToken, loadSubjectSrsStages])
  );

  // Show initial results when subjects are loaded
  useEffect(() => {
    if (allSubjects && !searchQuery.trim()) {
      const initialResults = allSubjects
        .filter((subject) =>
          filters.types.has(subject.object as WaniKaniItemType)
        )
        .filter(
          (subject) =>
            subject.data.level >= filters.minLevel &&
            subject.data.level <= filters.maxLevel
        )
        .filter((subject) =>
          filters.srsStages.has(subjectSrsStageMap.get(subject.id) ?? 0)
        )
        .slice(0, 200)
        .map(subjectToSearchResult);

      setSearchResults(initialResults);
    }
  }, [allSubjects, filters, searchQuery, subjectSrsStageMap]);

  // Secret YouTube mode trigger
  useEffect(() => {
    if (debouncedSearchQuery.toLowerCase() === "portego00") {
      // Clear the search and navigate to secret screen
      setSearchQuery("");
      if (textInputRef.current) {
        textInputRef.current.setNativeProps({ text: "" });
      }
      router.push("/secret/youtube-search");
    }
  }, [debouncedSearchQuery, router]);

  // Secret MUX videos mode trigger
  useEffect(() => {
    if (debouncedSearchQuery.toLowerCase() === "portego2000") {
      // Clear the search and navigate to secret MUX videos screen
      setSearchQuery("");
      if (textInputRef.current) {
        textInputRef.current.setNativeProps({ text: "" });
      }
      router.push("/secret/mux-videos");
    }
  }, [debouncedSearchQuery, router]);

  // Perform search when debounced query changes
  useEffect(() => {
    if (!allSubjects) return;

    if (!debouncedSearchQuery.trim()) {
      // Show initial results when search is cleared
      const initialResults = allSubjects
        .filter((subject) =>
          filters.types.has(subject.object as WaniKaniItemType)
        )
        .filter(
          (subject) =>
            subject.data.level >= filters.minLevel &&
            subject.data.level <= filters.maxLevel
        )
        .filter((subject) =>
          filters.srsStages.has(subjectSrsStageMap.get(subject.id) ?? 0)
        )
        .slice(0, 200)
        .map(subjectToSearchResult);

      setSearchResults(initialResults);
      setIsLoading(false);
      return;
    }

    performSearch(debouncedSearchQuery.trim());
  }, [debouncedSearchQuery, allSubjects, filters, subjectSrsStageMap]);

  const loadAllSubjects = useCallback(async () => {
    if (!apiToken) return;

    setIsLoadingSubjects(true);
    setError(null);
    setIsCacheMissing(false);

    try {
      console.log("Loading all subjects for search...");
      const subjects = await getAllSubjects();

      // Check if cache is empty or missing
      if (!subjects || subjects.length === 0) {
        console.log("Cache is empty or missing");
        setIsCacheMissing(true);
        setAllSubjects([]);
        return;
      }

      setAllSubjects(sortSubjectsByLevelAndType(subjects));

      // Count subjects by type for debugging
      const counts = subjects.reduce(
        (acc: Record<string, number>, subject: any) => {
          const type = subject.object;
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      console.log(`Loaded ${subjects.length} subjects for search:`, counts);
    } catch (err) {
      console.error("Error loading subjects:", err);
      setError("Failed to load subjects for search. Please try again.");
      setIsCacheMissing(true);
    } finally {
      setIsLoadingSubjects(false);
    }
  }, [apiToken]);

  const rebuildCache = useCallback(async () => {
    if (!apiToken) return;

    setIsRebuildingCache(true);
    setCacheRebuildProgress(0);
    setError(null);

    try {
      console.log("Rebuilding subjects cache...");

      // Fetch all subjects from API
      setCacheRebuildProgress(10);
      const response = await getSubjects(
        apiToken,
        {},
        { skipCollectionCache: true }
      );

      setCacheRebuildProgress(30);

      // Handle pagination to get all subjects
      const allSubjectsData = await fetchAllPages(response, apiToken);

      setCacheRebuildProgress(80);

      // Save to cache
      await saveToCache(
        ALL_SUBJECTS_CACHE_KEY,
        allSubjectsData.data,
        allSubjectsData.data_updated_at
      );

      setCacheRebuildProgress(90);

      // Load the subjects
      setAllSubjects(sortSubjectsByLevelAndType(allSubjectsData.data));
      setIsCacheMissing(false);

      setCacheRebuildProgress(100);

      // Count subjects by type for debugging
      const counts = allSubjectsData.data.reduce(
        (acc: Record<string, number>, subject: any) => {
          const type = subject.object;
          acc[type] = (acc[type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>
      );

      console.log(
        `Successfully rebuilt cache with ${allSubjectsData.data.length} subjects:`,
        counts
      );

      // Small delay before hiding progress
      setTimeout(() => {
        setIsRebuildingCache(false);
        setCacheRebuildProgress(0);
      }, 500);
    } catch (err) {
      console.error("Error rebuilding cache:", err);
      setError(
        "Failed to rebuild cache. Please check your internet connection and try again."
      );
      setIsRebuildingCache(false);
      setCacheRebuildProgress(0);
    }
  }, [apiToken]);

  const performSearchWithFilters = useCallback(
    async (query: string, searchFilters: SearchFilters) => {
      if (!allSubjects) return;

      setIsLoading(true);

      try {
        const filteredSubjects = allSubjects
          .filter((subject) =>
            searchFilters.types.has(subject.object as WaniKaniItemType)
          )
          .filter(
            (subject) =>
              subject.data.level >= searchFilters.minLevel &&
              subject.data.level <= searchFilters.maxLevel
          )
          .filter((subject) =>
            searchFilters.srsStages.has(subjectSrsStageMap.get(subject.id) ?? 0)
          );

        const searchConfig = getDefaultSubjectSearchConfig(query.length);
        const scoredMatches = rankSubjectsByQuery(filteredSubjects, query, {
          minScore: searchConfig.minScore,
        });

        const results = scoredMatches
          .slice(0, searchConfig.maxResults)
          .map(({ subject }) => subjectToSearchResult(subject));

        let vocabCount = 0;
        let kanjiCount = 0;
        let radicalCount = 0;
        for (const result of results) {
          if (
            result.type === "vocabulary" ||
            result.type === "kana_vocabulary"
          ) {
            vocabCount++;
          } else if (result.type === "kanji") {
            kanjiCount++;
          } else if (result.type === "radical") {
            radicalCount++;
          }
        }

        setSearchResults(results);
        console.log(
          `Search for "${query}" returned ${results.length}/${searchConfig.maxResults} results from ${scoredMatches.length} scored matches`
        );
        console.log(
          `Breakdown: ${radicalCount} radicals, ${kanjiCount} kanji, ${vocabCount} vocabulary`
        );
      } catch (err) {
        console.error("Search error:", err);
        setError("Search failed. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [allSubjects, subjectSrsStageMap]
  );

  const performSearch = useCallback(
    async (query: string) => {
      return performSearchWithFilters(query, filters);
    },
    [performSearchWithFilters, filters]
  );

  const handleSubjectPress = useCallback(
    (subjectId: number) => {
      // Navigate to subject details - the user can use back button to return to search
      router.push(`/subject/${subjectId}`);
    },
    [router]
  );

  const getItemColor = (type: WaniKaniItemType) => {
    return getSubjectTypeColor(type);
  };

  // Component to render radical character with SVG fallback
  const RadicalCharacter = ({ item }: { item: SearchResult }) => {
    const bestImg = pickBestImage(item.characterImages || undefined);
    const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
    const svgXml = useRemoteSvg(svgUrl, "#ffffff");
    const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(
      null
    );

    useEffect(() => {
      if (bestImg?.type === "png") {
        const cleaned = bestImg.url.replace(/^@/, "");
        setProcessedImageUrl(cleaned);
      } else if (item.imageUrl) {
        const cleaned = item.imageUrl.replace(/^@/, "");
        setProcessedImageUrl(cleaned);
      } else {
        setProcessedImageUrl(null);
      }
    }, [bestImg, item.imageUrl]);

    if (item.characters && item.characters.trim()) {
      return (
        <Text
          style={[styles.itemCharacter, fontStyles.japaneseText]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {item.characters}
        </Text>
      );
    } else if (svgXml) {
      return <SvgXml xml={svgXml} width={24} height={24} />;
    } else if (processedImageUrl) {
      return (
        <Image
          source={{ uri: processedImageUrl }}
          style={{ width: 24, height: 24 }}
          resizeMode="contain"
        />
      );
    } else {
      return (
        <Text style={[styles.itemCharacter, fontStyles.japaneseText]}>
          {item.meaning}
        </Text>
      );
    }
  };

  const renderSearchResult = ({ item }: { item: SearchResult }) => {
    const itemColor = getItemColor(item.type);
    const visibleReadings = item.readings.slice(0, 2);
    const hiddenReadingsCount = Math.max(0, item.readings.length - 2);

    return (
      <TouchableOpacity
        style={[styles.itemContainer, { backgroundColor: theme.cardBackground }]}
        activeOpacity={0.7}
        onPress={() => handleSubjectPress(item.id)}
      >
        <View
          style={[
            styles.itemBox,
            { backgroundColor: itemColor },
            (item.type === "vocabulary" || item.type === "kana_vocabulary") &&
              item.characters &&
              item.characters.length > 1 && {
                width: 48 + (item.characters.length - 2) * 24 + 16,
              },
          ]}
        >
          {item.type === "radical" ? (
            <RadicalCharacter item={item} />
          ) : (
            <Text
              style={[styles.itemCharacter, fontStyles.japaneseText]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {item.characters || item.meaning}
            </Text>
          )}
        </View>
        <View style={styles.itemDetails}>
          <Text style={[styles.itemMeaning, { color: theme.textColor }]}>
            {item.meaning}
          </Text>
          <View style={styles.itemMetadata}>
            {visibleReadings.length > 0 ? (
              <View style={styles.readingsContainer}>
                {visibleReadings.map((reading) => (
                  <View
                    key={`${item.id}-${reading.reading}`}
                    style={[
                      styles.readingChip,
                      reading.primary && {
                        backgroundColor: itemColor,
                        borderColor: itemColor,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.readingChipText,
                        fontStyles.japaneseText,
                        {
                          color: reading.primary ? "#ffffff" : theme.textSecondary,
                        },
                      ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {reading.reading}
                    </Text>
                  </View>
                ))}
                {hiddenReadingsCount > 0 && (
                  <View
                    style={[
                      styles.readingChip,
                      styles.readingOverflowChip,
                      {
                        borderColor: theme.textLight,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.readingOverflowText,
                        { color: theme.textLight },
                      ]}
                    >
                      +{hiddenReadingsCount}
                    </Text>
                  </View>
                )}
              </View>
            ) : (
              <Text style={[styles.itemType, { color: theme.textSecondary }]}>
                {item.type}
              </Text>
            )}
            <Text style={[styles.itemLevel, { color: theme.textLight }]}>
              Level {item.level}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const flatListData = useMemo(() => searchResults, [searchResults]);

  // Scroll to top when search results change
  useEffect(() => {
    if (flatListRef.current && searchResults.length > 0) {
      flatListRef.current.scrollToOffset({ offset: 0, animated: false });
    }
  }, [searchResults]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    Animated.parallel([
      Animated.timing(buttonOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(buttonWidth, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [buttonOpacity, buttonWidth]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    Animated.parallel([
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.timing(buttonWidth, {
        toValue: SEARCH_BUTTON_TOTAL_WIDTH,
        duration: 200,
        useNativeDriver: false,
      }),
    ]).start();
  }, [buttonOpacity, buttonWidth]);

  const blurSearchInput = useCallback(() => {
    if (showInlineSearchBar) {
      textInputRef.current?.blur();
    }
  }, [showInlineSearchBar]);

  const handleTapOutside = useCallback(() => {
    blurSearchInput();
  }, [blurSearchInput]);

  const handleScrollBeginDrag = useCallback(() => {
    blurSearchInput();
  }, [blurSearchInput]);

  const handleCloseFilters = useCallback(() => {
    setShowFilters(false);
  }, []);

  const handleApplyFilters = useCallback(
    async (newFilters: SearchFilters) => {
      setFilters(newFilters);
      if (searchQuery.trim()) {
        await performSearchWithFilters(searchQuery.trim(), newFilters);
      }
      setShowFilters(false);
    },
    [searchQuery, performSearchWithFilters]
  );

  // Show loading state if subjects haven't been loaded yet
  if (isLoadingSubjects) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading subjects for search...
          </Text>
        </View>
      </View>
    );
  }

  // Show cache missing state
  if (isCacheMissing && !isRebuildingCache) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.cacheErrorContainer}>
          <Ionicons
            name="warning-outline"
            size={64}
            color={theme.textSecondary}
          />
          <Text style={[styles.cacheErrorTitle, { color: theme.textColor }]}>
            Search Data Missing
          </Text>
          <Text
            style={[styles.cacheErrorMessage, { color: theme.textSecondary }]}
          >
            The search data has been cleared by your device. This can happen
            when your device is low on storage or after app updates.
          </Text>
          <TouchableOpacity
            style={[styles.rebuildButton, { backgroundColor: theme.primary }]}
            onPress={rebuildCache}
            activeOpacity={0.7}
          >
            <Ionicons
              name="refresh"
              size={20}
              color="white"
              style={{ marginRight: 8 }}
            />
            <Text style={styles.rebuildButtonText}>Download Search Data</Text>
          </TouchableOpacity>
          <Text style={[styles.cacheErrorNote, { color: theme.textLight }]}>
            This will download all WaniKani subjects to enable offline search.
          </Text>
        </View>
      </View>
    );
  }

  // Show rebuilding cache progress
  if (isRebuildingCache) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.cacheRebuildContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.cacheRebuildTitle, { color: theme.textColor }]}>
            Downloading Search Data
          </Text>
          <View
            style={[
              styles.progressBarContainer,
              { backgroundColor: theme.backgroundColor },
            ]}
          >
            <View
              style={[
                styles.progressBar,
                {
                  width: `${cacheRebuildProgress}%`,
                  backgroundColor: theme.primary,
                },
              ]}
            />
          </View>
          <Text
            style={[
              styles.cacheRebuildProgress,
              { color: theme.textSecondary },
            ]}
          >
            {cacheRebuildProgress}% Complete
          </Text>
          <Text style={[styles.cacheRebuildNote, { color: theme.textLight }]}>
            This only needs to be done once. The data will be saved for offline
            use.
          </Text>
        </View>
      </View>
    );
  }

  const renderContent = () => {
    if (!allSubjects) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="download-outline" size={64} color={theme.textLight} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Loading search data...
          </Text>
        </View>
      );
    } else if (!searchQuery.trim()) {
      return (
        <FlatList
          ref={flatListRef}
          data={flatListData}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={handleScrollBeginDrag}
          scrollEventThrottle={16}
        />
      );
    } else if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Searching...
          </Text>
        </View>
      );
    } else if (error) {
      return (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>
            {error}
          </Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={() => loadAllSubjects()}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (searchResults.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="file-tray-outline"
            size={48}
            color={theme.textLight}
          />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            No results found
          </Text>
          <Text style={[styles.emptySubtext, { color: theme.textLight }]}>
            Try searching with different terms
          </Text>
        </View>
      );
    } else {
      return (
        <FlatList
          ref={flatListRef}
          data={flatListData}
          renderItem={renderSearchResult}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={handleScrollBeginDrag}
          scrollEventThrottle={16}
        />
      );
    }
  };

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: theme.backgroundColor, paddingTop: topPadding },
      ]}
    >
      {/* Search bar */}
      {showInlineSearchBar ? (
        <View style={styles.searchContainer}>
          <View style={styles.searchBarRow}>
            <View
              style={[
                styles.searchInputContainer,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: "#bbb",
                },
              ]}
            >
              <Ionicons
                name="search"
                size={20}
                color={theme.textSecondary}
                style={styles.searchIcon}
              />
              <TextInput
                ref={textInputRef}
                style={[styles.searchInput, { color: theme.textColor }]}
                /* Uncontrolled to avoid RN controlled TextInput lag/cursor issues */
                onChangeText={setSearchQuery}
                onFocus={handleFocus}
                onBlur={handleBlur}
                placeholder="Search kanji, vocabulary, or meanings..."
                placeholderTextColor={theme.textSecondary}
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
                autoFocus
              />
            </View>
            <GlassButton
              iconName="options"
              iconSize={22}
              iconColor={headerIconColor}
              style={styles.inlineButton}
              variant={theme.isDark ? "colored" : "light"}
              onPress={() => {
                setShowFilters(true);
              }}
            />
            <Animated.View
              style={{
                opacity: buttonOpacity,
                width: buttonWidth,
              }}
            >
              <GlassButton
                iconName="language"
                iconSize={22}
                iconColor={headerIconColor}
                style={styles.inlineButton}
                variant={theme.isDark ? "colored" : "light"}
                onPress={() => router.push("/translator")}
              />
            </Animated.View>
            <Animated.View
              style={{
                opacity: buttonOpacity,
                width: buttonWidth,
              }}
            >
              <GlassButton
                iconName="camera"
                iconSize={22}
                iconColor={headerIconColor}
                style={styles.inlineButton}
                variant={theme.isDark ? "colored" : "light"}
                onPress={() => router.push("/camera-ocr")}
              />
            </Animated.View>
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.nativeSearchControls,
            showNativeTopTitle
              ? styles.nativeSearchControlsWithTitle
              : styles.nativeSearchControlsWithoutTitle,
          ]}
        >
          {showNativeTopTitle && (
            <Text style={[styles.nativeSearchTitle, { color: theme.textColor }]}>
              Search
            </Text>
          )}
          {!isTablet && (
            <View style={{ flexDirection: "row", gap: 12 }}>
              <GlassButton
                iconName="options"
                iconSize={22}
                iconColor={headerIconColor}
                variant={theme.isDark ? "colored" : "light"}
                onPress={() => {
                  setShowFilters(true);
                }}
              />
              <GlassButton
                iconName="language"
                iconSize={22}
                iconColor={headerIconColor}
                variant={theme.isDark ? "colored" : "light"}
                onPress={() => router.push("/translator")}
              />
              <GlassButton
                iconName="camera"
                iconSize={22}
                iconColor={headerIconColor}
                variant={theme.isDark ? "colored" : "light"}
                onPress={() => router.push("/camera-ocr")}
              />
            </View>
          )}
        </View>
      )}

      {/* Main Content */}
      {renderContent()}

      {/* Floating Buttons for Native Search Mode (Tablet only) */}
      {!showInlineSearchBar && isTablet && (
        <View
          style={[
            styles.nativeSearchButtons,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <GlassButton
            iconName="options"
            iconSize={22}
            iconColor={headerIconColor}
            variant={theme.isDark ? "colored" : "light"}
            onPress={() => {
              setShowFilters(true);
            }}
          />
          <GlassButton
            iconName="language"
            iconSize={22}
            iconColor={headerIconColor}
            variant={theme.isDark ? "colored" : "light"}
            onPress={() => router.push("/translator")}
          />
          <GlassButton
            iconName="camera"
            iconSize={22}
            iconColor={headerIconColor}
            variant={theme.isDark ? "colored" : "light"}
            onPress={() => router.push("/camera-ocr")}
          />
        </View>
      )}

      {/* Filter Modal */}
      <SearchFilterModal
        visible={showFilters}
        currentFilters={filters}
        onClose={handleCloseFilters}
        onApply={handleApplyFilters}
      />
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
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  nativeSearchControls: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  nativeSearchControlsWithTitle: {
    justifyContent: "space-between",
  },
  nativeSearchControlsWithoutTitle: {
    justifyContent: "flex-end",
  },
  nativeSearchButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    position: "absolute",
    bottom: 24,
    right: 24,
    borderRadius: 30,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    elevation: 5,
  },
  nativeSearchTitle: {
    fontSize: 32,
    fontWeight: "700",
  },
  searchBarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 28,
    paddingHorizontal: 16,
    height: 50,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
    flex: 1,
    shadowColor: "rgba(0, 0, 0, 0.05)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: 50,
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
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
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100, // Add bottom padding to allow scrolling past the bottom bar
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: "rgba(0,0,0,0.08)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 0.5,
    borderColor: "rgba(0, 0, 0, 0.06)",
  },
  itemBox: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  itemCharacter: {
    fontSize: 20,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
  },
  itemDetails: {
    flex: 1,
  },
  itemMeaning: {
    fontSize: 16,
    fontWeight: "500",
  },
  itemMetadata: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  readingsContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginRight: 8,
  },
  readingChip: {
    borderWidth: 1,
    borderColor: "rgba(120, 120, 120, 0.35)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    maxWidth: 110,
  },
  readingChipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  readingOverflowChip: {
    paddingHorizontal: 6,
  },
  readingOverflowText: {
    fontSize: 12,
    fontWeight: "700",
  },
  itemType: {
    fontSize: 12,
    textTransform: "capitalize",
    flex: 1,
    marginRight: 8,
  },
  itemLevel: {
    fontSize: 12,
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  inlineButton: {
    marginLeft: 8,
  },
  // Filter Panel Styles
  filterPanelBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    zIndex: 998,
  },
  backdropTouchable: {
    flex: 1,
  },
  filterPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    overflow: "hidden",
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
    zIndex: 100000,
  },
  filterPanelContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 5,
    backgroundColor: "rgba(150, 150, 150, 0.3)",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  modalCloseButton: {
    padding: 4,
  },
  filterSection: {
    marginBottom: 32,
  },
  filterSectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 16,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  typeFiltersRow: {
    flexDirection: "row",
    gap: 10,
  },
  chip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipLabel: {
    fontSize: 15,
  },
  // Level Inputs
  levelInputsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  levelInputCompact: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  levelInputLabelSmall: {
    fontSize: 11,
    textTransform: "uppercase",
    marginBottom: 4,
    fontWeight: "600",
    opacity: 0.7,
  },
  levelInputValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  levelArrow: {
    width: 24,
    alignItems: "center",
  },
  quickLevelsScroll: {
    gap: 10,
    paddingRight: 20,
  },
  quickLevelChip: {
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  quickLevelText: {
    fontSize: 14,
    fontWeight: "500",
  },
  // Footer
  modalFooter: {
    flexDirection: "row",
    gap: 16,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  modalCancelButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
  },
  modalApplyButton: {},
  modalButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  // Cache error and rebuild styles
  cacheErrorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  cacheErrorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 12,
    textAlign: "center",
  },
  cacheErrorMessage: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  rebuildButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginBottom: 16,
  },
  rebuildButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  cacheErrorNote: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  cacheRebuildContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  cacheRebuildTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  progressBarContainer: {
    width: "100%",
    height: 8,
    borderRadius: 4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  progressBar: {
    height: "100%",
    borderRadius: 4,
  },
  cacheRebuildProgress: {
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 12,
  },
  cacheRebuildNote: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  // Picker modal styles
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  pickerModalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  pickerModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0, 0, 0, 0.1)",
  },
  pickerModalTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  pickerCancelText: {
    fontSize: 17,
  },
  pickerDoneText: {
    fontSize: 17,
    fontWeight: "600",
  },
  picker: {
    width: "100%",
    height: 216,
  },
  pickerItem: {
    fontSize: 20,
  },
});
