import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  createDefaultSearchFilters,
  ALL_SEARCH_SRS_STAGES,
  SearchFilterModal,
  SearchFilters,
} from "../../src/components/SearchFilterModal";
//
import { SvgXml } from "react-native-svg";
import { WaniKaniItemType } from "../../src/types/wanikani";
import {
  clearSubjectsCache,
  fetchAllPages,
  getAllAssignmentsCached,
  getSubjects,
  Subject,
} from "../../src/utils/api";
import {
  ALL_SUBJECTS_CACHE_KEY,
  getAllSubjects,
  saveToCache,
} from "../../src/utils/cache";
import { fontStyles } from "../../src/utils/fonts";
import {
  EXTRA_STUDY_SESSION_STORAGE_KEYS,
  clearExtraStudySessionState,
  hasExtraStudySessionState,
} from "../../src/utils/extraStudySessionPersistence";
import { pickBestImage, useRemoteSvg } from "../../src/utils/radicalSvg";
import { getSubjectTypeColor } from "../../src/utils/subjectColors";
import {
  getSubjectIdSetForListIds,
  getSubjectLists,
  SubjectList,
  syncSubjectListsNow,
} from "../../src/utils/subjectLists";
import { useAuthStore } from "../../src/utils/store";
import {
  rankSubjectsByQuery,
  sortSubjectsByLevelAndType,
} from "../../src/utils/subjectSearch";
import { formatLevelWithSrsStage } from "../../src/utils/srsStageLabel";
import { useTheme } from "../../src/utils/theme";

//

export default function CustomReviewSelectionScreen() {
  const { apiToken, userData } = useAuthStore();
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<number>>(
    new Set()
  );
  const [allSubjects, setAllSubjects] = useState<Subject[] | null>(null);
  const [filteredSubjects, setFilteredSubjects] = useState<Subject[]>([]);
  const [subjectSrsStageMap, setSubjectSrsStageMap] = useState<
    Map<number, number>
  >(new Map());
  const [matchingSubjectIds, setMatchingSubjectIds] = useState<number[]>([]);
  //
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isCacheMissing, setIsCacheMissing] = useState(false);
  const [isRebuildingCache, setIsRebuildingCache] = useState(false);
  const [cacheRebuildProgress, setCacheRebuildProgress] = useState(0);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [showListFilterModal, setShowListFilterModal] = useState(false);
  const [availableLists, setAvailableLists] = useState<SubjectList[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [subjectIdsFromSelectedLists, setSubjectIdsFromSelectedLists] = useState<
    Set<number>
  >(new Set());
  const [filters, setFilters] = useState<SearchFilters>(() =>
    createDefaultSearchFilters()
  );
  const hasAppliedUserLevelDefaultRef = useRef(false);
  const hasCheckedForResumableSessionRef = useRef(false);

  useEffect(() => {
    if (hasAppliedUserLevelDefaultRef.current) return;

    const userLevel = userData?.level;
    if (typeof userLevel !== "number" || !Number.isFinite(userLevel)) return;

    const cappedLevel = Math.max(1, Math.min(60, Math.floor(userLevel)));

    setFilters((prev) => {
      // Only apply when filters are still at their untouched defaults.
      if (prev.minLevel !== 1 || prev.maxLevel !== 60) {
        return prev;
      }

      return { ...prev, maxLevel: cappedLevel };
    });

    hasAppliedUserLevelDefaultRef.current = true;
  }, [userData?.level]);

  useEffect(() => {
    if (hasCheckedForResumableSessionRef.current) {
      return;
    }
    hasCheckedForResumableSessionRef.current = true;

    let isMounted = true;
    const checkForSavedSession = async () => {
      const hasSavedSession = await hasExtraStudySessionState(
        EXTRA_STUDY_SESSION_STORAGE_KEYS.CUSTOM_REVIEW,
      );
      if (!hasSavedSession || !isMounted) {
        return;
      }

      Alert.alert(
        "Resume Custom Review?",
        "You have a custom review in progress.",
        [
          { text: "Not Now", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              void clearExtraStudySessionState(
                EXTRA_STUDY_SESSION_STORAGE_KEYS.CUSTOM_REVIEW,
              );
            },
          },
          {
            text: "Resume",
            onPress: () => {
              router.push({
                pathname: "/custom-review",
                params: { resume: "true" },
              });
            },
          },
        ],
      );
    };

    void checkForSavedSession();

    return () => {
      isMounted = false;
    };
  }, []);

  const loadSubjectSrsStages = useCallback(async () => {
    if (!apiToken) return;

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
    } catch (err) {
      console.warn(
        "Failed to load assignment SRS stages for custom review selection:",
        err
      );
      setSubjectSrsStageMap(new Map());
    }
  }, [apiToken]);

  const loadAllSubjects = useCallback(async () => {
    if (!apiToken) return;

    setIsLoadingSubjects(true);
    setError(null);
    setIsCacheMissing(false);

    try {
      console.log("Loading all subjects for custom review selection...");
      const subjects = await getAllSubjects();
      if (!subjects || subjects.length === 0) {
        console.log("Cache is empty or missing");
        setIsCacheMissing(true);
        setAllSubjects([]);
        return;
      }
      setAllSubjects(sortSubjectsByLevelAndType(subjects));
      console.log(
        `Loaded ${subjects.length} subjects for custom review selection`
      );
    } catch (err) {
      console.error("Error loading subjects:", err);
      setError("Failed to load subjects. Please try again.");
      setIsCacheMissing(true);
    } finally {
      setIsLoadingSubjects(false);
    }
  }, [apiToken]);

  // Load all subjects when screen mounts
  useEffect(() => {
    if (!allSubjects && apiToken) {
      loadAllSubjects();
    }
  }, [apiToken, allSubjects, loadAllSubjects]);

  useEffect(() => {
    if (apiToken) {
      loadSubjectSrsStages();
    }
  }, [apiToken, loadSubjectSrsStages]);

  useEffect(() => {
    let isMounted = true;
    const run = async () => {
      if (selectedListIds.length === 0) {
        if (isMounted) {
          setSubjectIdsFromSelectedLists(new Set());
        }
        return;
      }

      const ids = await getSubjectIdSetForListIds(selectedListIds);
      if (isMounted) {
        setSubjectIdsFromSelectedLists(ids);
      }
    };
    run();
    return () => {
      isMounted = false;
    };
  }, [selectedListIds]);

  const loadAvailableLists = useCallback(async () => {
    setIsLoadingLists(true);
    try {
      const loaded = await getSubjectLists();
      setAvailableLists(loaded);

      const validIds = new Set(loaded.map((list) => list.id));
      setSelectedListIds((prev) => prev.filter((id) => validIds.has(id)));

      void (async () => {
        try {
          await syncSubjectListsNow();
          const synced = await getSubjectLists();
          setAvailableLists(synced);
          const syncedIds = new Set(synced.map((list) => list.id));
          setSelectedListIds((prev) => prev.filter((id) => syncedIds.has(id)));
        } catch (syncError) {
          console.warn(
            "Failed to refresh subject lists for custom review after sync:",
            syncError
          );
        }
      })();
    } catch (error) {
      console.error("Failed to load subject lists for custom review:", error);
      setAvailableLists([]);
    } finally {
      setIsLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    if (!showListFilterModal) {
      return;
    }
    loadAvailableLists();
  }, [loadAvailableLists, showListFilterModal]);

  useEffect(() => {
    loadAvailableLists();
  }, [loadAvailableLists]);

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

      console.log(
        `Successfully rebuilt cache with ${allSubjectsData.data.length} subjects`
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

  // Filter and search subjects
  useEffect(() => {
    if (!allSubjects) {
      setFilteredSubjects([]);
      setMatchingSubjectIds([]);
      return;
    }

    const filteredByFacets = allSubjects
      .filter((subject) =>
        selectedListIds.length === 0
          ? true
          : subjectIdsFromSelectedLists.has(subject.id)
      )
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
      );

    const query = searchQuery.trim();
    let filtered = query
      ? rankSubjectsByQuery(filteredByFacets, query).map(({ subject }) => subject)
      : sortSubjectsByLevelAndType(filteredByFacets);

    // Keep track of all matching subjects (before display limit) for bulk selection.
    setMatchingSubjectIds(filtered.map((subject) => subject.id));

    // Limit to 200 results
    if (filtered.length > 200) {
      filtered = filtered.slice(0, 200);
    }

    setFilteredSubjects(filtered);
  }, [
    searchQuery,
    allSubjects,
    filters,
    selectedListIds,
    subjectIdsFromSelectedLists,
    subjectSrsStageMap,
  ]);

  const toggleSubjectSelection = (subject: Subject) => {
    Keyboard.dismiss();
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(subject.id)) {
        next.delete(subject.id);
      } else {
        next.add(subject.id);
      }
      return next;
    });
  };

  const handleSubjectTilePress = (subject: Subject) => {
    router.push(`/subject/${subject.id}`);
  };

  const isSubjectSelected = (subjectId: number) =>
    selectedSubjectIds.has(subjectId);

  const startCustomReview = async () => {
    if (selectedSubjectIds.size === 0) return;
    await clearExtraStudySessionState(
      EXTRA_STUDY_SESSION_STORAGE_KEYS.CUSTOM_REVIEW,
    );
    const ids = Array.from(selectedSubjectIds.values());
    router.push({
      pathname: "/custom-review",
      params: { subjectIds: ids.join(",") },
    });
  };

  const clearSelection = () => {
    setSelectedSubjectIds(new Set());
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    filters.minLevel > 1 ||
    filters.maxLevel < 60 ||
    filters.types.size < 4 ||
    filters.srsStages.size < ALL_SEARCH_SRS_STAGES.length ||
    selectedListIds.length > 0;

  const allMatchingSelected =
    matchingSubjectIds.length > 0 &&
    matchingSubjectIds.every((id) => selectedSubjectIds.has(id));

  const toggleSelectAllMatching = () => {
    if (matchingSubjectIds.length === 0) return;

    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);
      const shouldDeselect = matchingSubjectIds.every((id) => next.has(id));

      if (shouldDeselect) {
        matchingSubjectIds.forEach((id) => next.delete(id));
      } else {
        matchingSubjectIds.forEach((id) => next.add(id));
      }

      return next;
    });
  };

  const getSubjectIdsForLists = useCallback(
    (listIds: string[]) => {
      const selectedIds = new Set(listIds);
      const subjectIds = new Set<number>();

      availableLists.forEach((list) => {
        if (!selectedIds.has(list.id)) {
          return;
        }

        list.subjectIds.forEach((subjectId) => subjectIds.add(subjectId));
      });

      return subjectIds;
    },
    [availableLists]
  );

  const toggleListSelection = (listId: string) => {
    const previousListIds = selectedListIds;
    const nextListIdSet = new Set(previousListIds);
    const isRemovingList = nextListIdSet.has(listId);

    if (isRemovingList) {
      nextListIdSet.delete(listId);
    } else {
      nextListIdSet.add(listId);
    }

    const nextListIds = Array.from(nextListIdSet.values());
    const previouslyListSelectedSubjectIds = getSubjectIdsForLists(previousListIds);
    const nextListSelectedSubjectIds = getSubjectIdsForLists(nextListIds);

    setSelectedListIds(nextListIds);
    setSelectedSubjectIds((prev) => {
      const next = new Set(prev);

      if (isRemovingList) {
        previouslyListSelectedSubjectIds.forEach((subjectId) => {
          if (!nextListSelectedSubjectIds.has(subjectId)) {
            next.delete(subjectId);
          }
        });
      } else {
        nextListSelectedSubjectIds.forEach((subjectId) => next.add(subjectId));
      }

      return next;
    });
  };

  const selectedListSubjectCount = useMemo(() => {
    if (selectedListIds.length === 0) return 0;
    const selectedSet = new Set(selectedListIds);
    const uniqueSubjectIds = new Set<number>();
    availableLists.forEach((list) => {
      if (!selectedSet.has(list.id)) return;
      list.subjectIds.forEach((subjectId) => {
        if (selectedSubjectIds.has(subjectId)) {
          uniqueSubjectIds.add(subjectId);
        }
      });
    });
    return uniqueSubjectIds.size;
  }, [availableLists, selectedListIds, selectedSubjectIds]);

  //

  const getItemTypeColor = (itemType: string) => {
    return getSubjectTypeColor(itemType as any);
  };

  // Removed: handleFilterPress
  // Removed: handleLevelChange

  const handleCloseFilters = useCallback(() => {
    setShowFilters(false);
  }, []);

  const handleApplyFilters = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);
    setShowFilters(false);
  }, []);

  const handleDebugLongPress = useCallback(async () => {
    console.log("Debug: Clearing subjects cache...");
    await clearSubjectsCache();
    setAllSubjects(null);
    loadAllSubjects();
  }, [loadAllSubjects]);

  // Render radical character with SVG fallback (Subject variant)
  const SubjectRadicalCharacter = ({ item }: { item: Subject }) => {
    const bestImg = pickBestImage(item.data.character_images || undefined);
    const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
    const svgXml = useRemoteSvg(svgUrl, "#ffffff");
    const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(
      null
    );

    useEffect(() => {
      if (bestImg?.type === "png") {
        const cleaned = bestImg.url.replace(/^@/, "");
        setProcessedImageUrl(cleaned);
      } else if ((item.data as any).image_url) {
        const cleaned = String((item.data as any).image_url).replace(/^@/, "");
        setProcessedImageUrl(cleaned);
      } else {
        setProcessedImageUrl(null);
      }
    }, [bestImg, item.data]);

    if (item.data.characters && item.data.characters.trim()) {
      return (
        <Text
          style={[styles.itemCharacter, fontStyles.japaneseText]}
          numberOfLines={1}
        >
          {item.data.characters}
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
        <Text
          style={[styles.itemCharacter, fontStyles.japaneseText]}
          numberOfLines={1}
        >
          {item.data.meanings[0].meaning}
        </Text>
      );
    }
  };

  const renderSubjectItem = ({ item }: { item: Subject }) => {
    const isSelected = isSubjectSelected(item.id);
    const typeColor = getItemTypeColor(item.object);
    const srsStage = subjectSrsStageMap.get(item.id) ?? 0;

    return (
      <TouchableOpacity
        style={[
          styles.itemContainer,
          { backgroundColor: theme.cardBackground },
          isSelected && { borderColor: typeColor, borderWidth: 2 },
        ]}
        onPress={() => toggleSubjectSelection(item)}
        activeOpacity={0.7}
      >
        <TouchableOpacity
          style={[
            styles.itemBox,
            { backgroundColor: typeColor },
            (item.object === "vocabulary" ||
              item.object === "kana_vocabulary") &&
              item.data.characters &&
              item.data.characters.length > 1 && {
                width: 48 + (item.data.characters.length - 2) * 24 + 16,
              },
          ]}
          onPress={(event) => {
            event.stopPropagation();
            handleSubjectTilePress(item);
          }}
          activeOpacity={0.8}
        >
          {item.object === "radical" ? (
            <SubjectRadicalCharacter item={item} />
          ) : (
            <Text
              style={[styles.itemCharacter, fontStyles.japaneseText]}
              numberOfLines={1}
            >
              {item.data.characters || item.data.meanings[0].meaning}
            </Text>
          )}
        </TouchableOpacity>
        <View style={styles.itemDetails}>
          <Text style={[styles.itemMeaning, { color: theme.textColor }]}>
            {item.data.meanings[0].meaning}
          </Text>
          <View style={styles.itemMetadata}>
            <Text style={[styles.itemType, { color: theme.textSecondary }]}>
              {item.object}
            </Text>
            <Text style={[styles.itemLevel, { color: theme.textLight }]}>
              {formatLevelWithSrsStage(item.data.level, srsStage)}
            </Text>
          </View>
        </View>
        <View style={styles.selectionIndicator}>
          <Ionicons
            name={isSelected ? "checkbox" : "square-outline"}
            size={24}
            color={isSelected ? typeColor : theme.textSecondary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.backgroundColor }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text
          style={[styles.headerTitle, { color: theme.textColor }]}
          onLongPress={handleDebugLongPress}
        >
          Custom Review
        </Text>
      </View>

      <View style={styles.searchRow}>
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.textColor }]}
            placeholder="Search by character, meaning, or reading..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
            )}
          </View>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: theme.cardBackground },
          ]}
          onPress={() => setShowListFilterModal(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="list" size={21} color={theme.textSecondary} />
          {selectedListIds.length > 0 ? (
            <View style={[styles.filterBadge, { backgroundColor: theme.primary }]}>
              <Text style={styles.filterBadgeText}>{selectedListIds.length}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: theme.cardBackground },
          ]}
          onPress={() => setShowFilters(true)}
          activeOpacity={0.7}
        >
          <Ionicons name="options" size={22} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.bulkActionsRow}>
        <TouchableOpacity
          style={[
            styles.bulkActionButton,
            { backgroundColor: theme.cardBackground },
            matchingSubjectIds.length === 0 && styles.bulkActionButtonDisabled,
          ]}
          onPress={toggleSelectAllMatching}
          disabled={matchingSubjectIds.length === 0}
          activeOpacity={0.7}
        >
          <Ionicons
            name={allMatchingSelected ? "remove-circle-outline" : "checkmark-done-outline"}
            size={18}
            color={theme.textSecondary}
          />
          <Text style={[styles.bulkActionText, { color: theme.textSecondary }]}>
            {allMatchingSelected
              ? hasActiveFilters
                ? "Deselect Filtered"
                : "Deselect All"
              : hasActiveFilters
                ? "Select Filtered"
                : "Select All"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.bulkActionButton,
            { backgroundColor: theme.cardBackground },
            selectedSubjectIds.size === 0 && styles.bulkActionButtonDisabled,
          ]}
          onPress={clearSelection}
          disabled={selectedSubjectIds.size === 0}
          activeOpacity={0.7}
        >
          <Ionicons name="close-circle-outline" size={18} color={theme.textSecondary} />
          <Text style={[styles.bulkActionText, { color: theme.textSecondary }]}>
            Clear Selection
          </Text>
        </TouchableOpacity>
      </View>

      {/* Subject List */}
      {isLoadingSubjects ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading subjects...
          </Text>
        </View>
      ) : isCacheMissing && !isRebuildingCache ? (
        <View style={styles.cacheErrorContainer}>
          <Ionicons
            name="warning-outline"
            size={64}
            color={theme.textSecondary}
          />
          <Text style={[styles.cacheErrorTitle, { color: theme.textColor }]}>
            Data Missing
          </Text>
          <Text
            style={[styles.cacheErrorMessage, { color: theme.textSecondary }]}
          >
            Subject data is missing. Download it to continue.
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
            <Text style={styles.rebuildButtonText}>Download Data</Text>
          </TouchableOpacity>
        </View>
      ) : isRebuildingCache ? (
        <View style={styles.cacheRebuildContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.cacheRebuildTitle, { color: theme.textColor }]}>
            Downloading Data
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
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={filteredSubjects}
          renderItem={renderSubjectItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          extraData={selectedSubjectIds}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {searchQuery ||
                filters.minLevel > 1 ||
                filters.maxLevel < 60 ||
                filters.types.size < 4 ||
                filters.srsStages.size < ALL_SEARCH_SRS_STAGES.length
                  ? "No subjects found matching your search and filters"
                  : "No subjects available"}
              </Text>
            </View>
          }
        />
      )}

      {/* Start Review Button */}
      {selectedSubjectIds.size > 0 && (
        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: theme.primary }]}
          onPress={startCustomReview}
          activeOpacity={0.8}
        >
          <Ionicons name="play" size={24} color="white" />
          <Text style={styles.startButtonText}>
            Start Review ({selectedSubjectIds.size} item
            {selectedSubjectIds.size !== 1 ? "s" : ""})
          </Text>
        </TouchableOpacity>
      )}

      <Modal
        visible={showListFilterModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowListFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.cardBackground, borderColor: theme.border },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textColor }]}>
                Select Subject List
              </Text>
              <TouchableOpacity onPress={() => setShowListFilterModal(false)}>
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            {isLoadingLists ? (
              <Text style={[styles.modalStateText, { color: theme.textSecondary }]}>
                Loading lists...
              </Text>
            ) : availableLists.length === 0 ? (
              <View style={styles.modalEmptyState}>
                <Text style={[styles.modalStateText, { color: theme.textSecondary }]}>
                  No lists yet. Create one from Manage.
                </Text>
                <TouchableOpacity
                  style={[styles.manageListsButton, { borderColor: theme.border }]}
                  onPress={() => {
                    setShowListFilterModal(false);
                    router.push("/subject-lists");
                  }}
                >
                  <Ionicons name="list" size={16} color={theme.textSecondary} />
                  <Text
                    style={[styles.manageListsButtonText, { color: theme.textSecondary }]}
                  >
                    Manage Lists
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <ScrollView style={styles.modalList}>
                  {availableLists.map((list) => {
                    const isSelected = selectedListIds.includes(list.id);
                    return (
                      <TouchableOpacity
                        key={list.id}
                        style={[
                          styles.modalListItem,
                          {
                            borderColor: isSelected ? theme.primary : theme.border,
                            backgroundColor: isSelected
                              ? `${theme.primary}15`
                              : theme.backgroundColor,
                          },
                        ]}
                        onPress={() => toggleListSelection(list.id)}
                      >
                        <Ionicons
                          name={isSelected ? "checkbox" : "square-outline"}
                          size={20}
                          color={isSelected ? theme.primary : theme.textSecondary}
                        />
                        <View style={styles.modalListItemText}>
                          <Text
                            style={[
                              styles.modalListItemTitle,
                              { color: isSelected ? theme.primary : theme.textColor },
                            ]}
                            numberOfLines={1}
                          >
                            {list.name}
                          </Text>
                          <Text
                            style={[styles.modalListItemMeta, { color: theme.textSecondary }]}
                          >
                            {list.subjectIds.length} subjects
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <View style={styles.modalFooter}>
                  <Text style={[styles.modalFooterText, { color: theme.textSecondary }]}>
                    {selectedListIds.length === 0
                      ? "No subject list selected."
                      : `${selectedListIds.length} list${
                          selectedListIds.length === 1 ? "" : "s"
                        } selected • ${selectedListSubjectCount} subjects selected.`}
                  </Text>
                  <View style={styles.modalFooterButtons}>
                    <TouchableOpacity
                      style={[styles.modalFooterButton, { borderColor: theme.border }]}
                      onPress={() => {
                        setShowListFilterModal(false);
                        router.push("/subject-lists");
                      }}
                    >
                      <Text
                        style={[styles.modalFooterButtonText, { color: theme.textSecondary }]}
                      >
                        Manage
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.modalFooterButton,
                        styles.modalFooterPrimaryButton,
                        { backgroundColor: theme.primary },
                      ]}
                      onPress={() => setShowListFilterModal(false)}
                    >
                      <Text style={styles.modalFooterPrimaryButtonText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 12,
  },
  headerRight: {
    width: 32,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
  },
  filterHeaderButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
    shadowColor: "rgba(0, 0, 0, 0.05)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    gap: 8,
  },
  bulkActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  bulkActionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: "rgba(0, 0, 0, 0.08)",
  },
  bulkActionButtonDisabled: {
    opacity: 0.5,
  },
  bulkActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 12,
    shadowColor: "rgba(0, 0, 0, 0.05)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 0.5,
    borderColor: "rgba(0, 0, 0, 0.06)",
  },
  filterButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
    shadowColor: "rgba(0, 0, 0, 0.05)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  filterBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 4,
    borderRadius: 12,
    shadowColor: "rgba(0,0,0,0.06)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
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
  itemType: {
    fontSize: 12,
    textTransform: "capitalize",
    marginRight: 8,
  },
  itemLevel: {
    fontSize: 12,
  },
  selectionIndicator: {
    marginLeft: 12,
  },
  separator: {
    height: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
  },
  startButton: {
    position: "absolute",
    bottom: 30,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 18,
    borderRadius: 16,
    shadowColor: "rgba(0, 0, 0, 0.2)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 6,
  },
  startButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    maxHeight: "80%",
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalStateText: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalEmptyState: {
    gap: 10,
  },
  manageListsButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  manageListsButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  modalList: {
    maxHeight: 280,
  },
  modalListItem: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  modalListItemText: {
    flex: 1,
  },
  modalListItemTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalListItemMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  modalFooter: {
    marginTop: 10,
    gap: 10,
  },
  modalFooterText: {
    fontSize: 12,
  },
  modalFooterButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalFooterButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  modalFooterPrimaryButton: {
    borderColor: "transparent",
  },
  modalFooterButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalFooterPrimaryButtonText: {
    color: "#fff",
    fontSize: 13,
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
});
