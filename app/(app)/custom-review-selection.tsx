import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
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
import SubjectListStudyMenu from "../../src/components/SubjectListStudyMenu";
//
import { SvgXml } from "react-native-svg";
import { useVocabularyFrequencyRanks } from "../../src/hooks/useVocabularyFrequencyRanks";
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
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import {
  rankSubjectsByQuery,
  sortSubjectsByLevelAndType,
} from "../../src/utils/subjectSearch";
import { formatLevelWithSrsStage } from "../../src/utils/srsStageLabel";
import { useTheme } from "../../src/utils/theme";
import {
  getJLPTLevelForSubject,
  subjectMatchesJLPTLevels,
} from "../../src/utils/jlptClassification";
import {
  getReadySelectedSubjectIds,
  matchesMaximumFrequencyRank,
} from "../../src/utils/customReviewFrequencyFilter";

function setsAreEqual<T>(left: ReadonlySet<T>, right: ReadonlySet<T>) {
  return (
    left.size === right.size &&
    Array.from(left).every((value) => right.has(value))
  );
}

function searchFiltersAreEqual(left: SearchFilters, right: SearchFilters) {
  return (
    left.minLevel === right.minLevel &&
    left.maxLevel === right.maxLevel &&
    left.maxFrequencyRank === right.maxFrequencyRank &&
    setsAreEqual(left.types, right.types) &&
    setsAreEqual(left.srsStages, right.srsStages) &&
    setsAreEqual(left.jlptLevels, right.jlptLevels)
  );
}

export default function CustomReviewSelectionScreen() {
  const { apiToken, userData } = useAuthStore();
  const showVocabularyFrequency = useSettingsStore(
    (state) => state.showVocabularyFrequency,
  );
  const setShowVocabularyFrequency = useSettingsStore(
    (state) => state.setShowVocabularyFrequency,
  );
  const { theme } = useTheme();
  const isScreenFocused = useIsFocused();
  const params = useLocalSearchParams<{ listId?: string | string[] }>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<number>>(
    new Set()
  );
  const [allSubjects, setAllSubjects] = useState<Subject[] | null>(null);
  const [subjectSrsStageMap, setSubjectSrsStageMap] = useState<
    Map<number, number>
  >(new Map());
  const [isLoadingSubjectSrsStages, setIsLoadingSubjectSrsStages] =
    useState(true);
  const [subjectSrsStageLoadError, setSubjectSrsStageLoadError] = useState<
    string | null
  >(null);
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
  const hasAppliedInitialListRef = useRef(false);
  const hasCheckedForResumableSessionRef = useRef(false);
  const frequencyAnnouncementKeyRef = useRef<string | null>(null);
  const initialListId = Array.isArray(params.listId)
    ? params.listId[0]
    : params.listId;

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
      const [hasSavedReview, hasSavedKanjiMatch] = await Promise.all([
        hasExtraStudySessionState(
          EXTRA_STUDY_SESSION_STORAGE_KEYS.CUSTOM_REVIEW,
        ),
        hasExtraStudySessionState(
          EXTRA_STUDY_SESSION_STORAGE_KEYS.CUSTOM_KANJI_MATCH,
        ),
      ]);
      if ((!hasSavedReview && !hasSavedKanjiMatch) || !isMounted) {
        return;
      }

      if (hasSavedKanjiMatch && !hasSavedReview) {
        Alert.alert(
          "Resume Kanji Match?",
          "You have a custom kanji match in progress.",
          [
            { text: "Not Now", style: "cancel" },
            {
              text: "Discard",
              style: "destructive",
              onPress: () => {
                void clearExtraStudySessionState(
                  EXTRA_STUDY_SESSION_STORAGE_KEYS.CUSTOM_KANJI_MATCH,
                );
              },
            },
            {
              text: "Resume",
              onPress: () => {
                router.push({
                  pathname: "/similar-kanji-session" as any,
                  params: { resume: "true", matchMode: "custom" },
                });
              },
            },
          ],
        );
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
    if (!apiToken) {
      setIsLoadingSubjectSrsStages(false);
      return;
    }

    setIsLoadingSubjectSrsStages(true);
    setSubjectSrsStageLoadError(null);
    try {
      const assignments = await getAllAssignmentsCached(
        apiToken,
        {},
        { forceRefresh: true },
      );
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
      setSubjectSrsStageLoadError(
        "Your assignment stages could not be loaded. SRS filters, including Burned, are unavailable until this succeeds.",
      );
    } finally {
      setIsLoadingSubjectSrsStages(false);
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

  useEffect(() => {
    if (hasAppliedInitialListRef.current || !initialListId) {
      return;
    }

    const initialList = availableLists.find((list) => list.id === initialListId);
    if (!initialList) {
      return;
    }

    hasAppliedInitialListRef.current = true;
    setSelectedListIds([initialList.id]);
    setSelectedSubjectIds(
      filters.maxFrequencyRank === null
        ? new Set(initialList.subjectIds)
        : new Set(),
    );
  }, [availableLists, filters.maxFrequencyRank, initialListId]);

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

  useEffect(() => {
    if (showVocabularyFrequency) {
      return;
    }

    setFilters((currentFilters) =>
      currentFilters.maxFrequencyRank === null
        ? currentFilters
        : { ...currentFilters, maxFrequencyRank: null },
    );
  }, [showVocabularyFrequency]);

  const subjectsMatchingNonFrequencyFacets = useMemo(() => {
    if (!allSubjects) {
      return [];
    }

    return allSubjects
      .filter((subject) =>
        selectedListIds.length === 0
          ? true
          : subjectIdsFromSelectedLists.has(subject.id),
      )
      .filter((subject) => {
        if (
          showVocabularyFrequency &&
          filters.maxFrequencyRank !== null
        ) {
          return (
            subject.object === "vocabulary" ||
            subject.object === "kana_vocabulary"
          );
        }

        return filters.types.has(subject.object as WaniKaniItemType);
      })
      .filter(
        (subject) =>
          subject.data.level >= filters.minLevel &&
          subject.data.level <= filters.maxLevel,
      )
      .filter((subject) =>
        filters.srsStages.has(subjectSrsStageMap.get(subject.id) ?? 0),
      )
      .filter((subject) =>
        subjectMatchesJLPTLevels(subject, filters.jlptLevels),
      );
  }, [
    allSubjects,
    filters.jlptLevels,
    filters.maxLevel,
    filters.maxFrequencyRank,
    filters.minLevel,
    filters.srsStages,
    filters.types,
    selectedListIds,
    showVocabularyFrequency,
    subjectIdsFromSelectedLists,
    subjectSrsStageMap,
  ]);

  const subjectsMatchingSearchAndNonFrequencyFacets = useMemo(() => {
    const query = searchQuery.trim();
    return query
      ? rankSubjectsByQuery(subjectsMatchingNonFrequencyFacets, query).map(
          ({ subject }) => subject,
        )
      : sortSubjectsByLevelAndType(subjectsMatchingNonFrequencyFacets);
  }, [searchQuery, subjectsMatchingNonFrequencyFacets]);

  const hasActiveFrequencyFilter =
    showVocabularyFrequency && filters.maxFrequencyRank !== null;
  const isSubjectSrsDataReady =
    !isLoadingSubjectSrsStages && !subjectSrsStageLoadError;
  const hasActiveSrsFilter =
    filters.srsStages.size < ALL_SEARCH_SRS_STAGES.length;
  const canApplyCurrentSrsFilter =
    !hasActiveSrsFilter || isSubjectSrsDataReady;
  const shouldResolveFrequencyFilter =
    hasActiveFrequencyFilter && canApplyCurrentSrsFilter;
  const frequencyCandidates = useMemo(
    () =>
      shouldResolveFrequencyFilter
        ? subjectsMatchingSearchAndNonFrequencyFacets.filter(
            (subject) =>
              subject.object === "vocabulary" ||
              subject.object === "kana_vocabulary",
          )
        : [],
    [
      shouldResolveFrequencyFilter,
      subjectsMatchingSearchAndNonFrequencyFacets,
    ],
  );
  const {
    ranks: frequencyRanks,
    isScanningCache: isScanningFrequencyCache,
    isLoading: isLoadingFrequencyRanks,
    progress: frequencyLoadProgress,
    dataReady: frequencyDataReady,
    canUseResults: canUseFrequencyResults,
    resolvedCount: resolvedFrequencyCount,
    needsApproval: needsFrequencyLookupApproval,
    unresolvedCount: unresolvedFrequencyCount,
    lookupError: frequencyLookupError,
    approveLookup: approveFrequencyLookup,
    retryLookup: retryFrequencyLookup,
    resetLookupState: resetFrequencyLookupState,
  } = useVocabularyFrequencyRanks({
    subjects: frequencyCandidates,
    enabled: shouldResolveFrequencyFilter,
  });

  // Apply the rank predicate synchronously so bulk actions can never see IDs
  // from a previously committed frequency threshold.
  const { filteredSubjects, matchingSubjectIds } = useMemo(() => {
    if (!allSubjects || !canUseFrequencyResults) {
      return { filteredSubjects: [], matchingSubjectIds: [] };
    }

    const filtered = hasActiveFrequencyFilter
      ? subjectsMatchingSearchAndNonFrequencyFacets.filter((subject) => {
          if (
            subject.object !== "vocabulary" &&
            subject.object !== "kana_vocabulary"
          ) {
            return false;
          }

          return (
            frequencyRanks.has(subject.id) &&
            matchesMaximumFrequencyRank(
              frequencyRanks.get(subject.id),
              filters.maxFrequencyRank,
            )
          );
        })
      : subjectsMatchingSearchAndNonFrequencyFacets;

    return {
      matchingSubjectIds: filtered.map((subject) => subject.id),
      filteredSubjects:
        filtered.length > 200 ? filtered.slice(0, 200) : filtered,
    };
  }, [
    allSubjects,
    filters.maxFrequencyRank,
    canUseFrequencyResults,
    frequencyRanks,
    hasActiveFrequencyFilter,
    subjectsMatchingSearchAndNonFrequencyFacets,
  ]);

  const readySelectedSubjectIds = useMemo(() => {
    return getReadySelectedSubjectIds(
      selectedSubjectIds.values(),
      frequencyRanks,
      hasActiveFrequencyFilter ? filters.maxFrequencyRank : null,
    );
  }, [
    filters.maxFrequencyRank,
    frequencyRanks,
    hasActiveFrequencyFilter,
    selectedSubjectIds,
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

  const selectedKanjiIds = useMemo(
    () =>
      (allSubjects ?? [])
        .filter(
          (subject) =>
            selectedSubjectIds.has(subject.id) &&
            subject.object === "kanji" &&
            Boolean(subject.data.characters?.trim()) &&
            subject.data.meanings.length > 0,
        )
        .map((subject) => subject.id),
    [allSubjects, selectedSubjectIds],
  );

  const startCustomReview = async () => {
    if (
      !canApplyCurrentSrsFilter ||
      readySelectedSubjectIds.length === 0
    ) {
      return;
    }
    await clearExtraStudySessionState(
      EXTRA_STUDY_SESSION_STORAGE_KEYS.CUSTOM_REVIEW,
    );
    router.push({
      pathname: "/custom-review",
      params: { subjectIds: readySelectedSubjectIds.join(",") },
    });
  };

  const startKanjiMatch = async () => {
    if (!canApplyCurrentSrsFilter) {
      return;
    }

    if (selectedKanjiIds.length < 2) {
      Alert.alert(
        "Select More Kanji",
        "Choose at least two kanji to start a matching review.",
      );
      return;
    }

    await clearExtraStudySessionState(
      EXTRA_STUDY_SESSION_STORAGE_KEYS.CUSTOM_KANJI_MATCH,
    );

    const config = {
      matchMode: "custom",
      selectedSubjectIds: selectedKanjiIds,
      selectedListIds,
      numberOfQuestions: Math.ceil(selectedKanjiIds.length / 4),
      srsGroups: {
        apprentice: true,
        guru: true,
        master: true,
        enlightened: true,
        burned: true,
      },
      useCustomLevelRange: false,
      minLevel: 1,
      maxLevel: 60,
      onlyLearnedSimilarKanji: true,
      kanjiPerQuestion: 4,
      similarKanjiSource: "niai",
    };

    try {
      const sessionId = `custom_kanji_match_${Date.now()}`;
      await AsyncStorage.setItem(
        `similar_kanji_config_${sessionId}`,
        JSON.stringify(config),
      );
      router.push({
        pathname: "/similar-kanji-session" as any,
        params: { sessionId, matchMode: "custom" },
      });
    } catch (error) {
      console.error("Failed to save custom kanji match config:", error);
      router.push({
        pathname: "/similar-kanji-session" as any,
        params: {
          matchMode: "custom",
          subjectIds: selectedKanjiIds.join(","),
          kanjiPerQuestion: "4",
        },
      });
    }
  };

  const startCustomLessons = () => {
    if (
      !canApplyCurrentSrsFilter ||
      readySelectedSubjectIds.length === 0
    ) {
      return;
    }

    router.push({
      pathname: "/custom-lesson",
      params: {
        subjectIds: readySelectedSubjectIds.join(","),
      },
    });
  };

  const openListStudyConfig = (
    pathname:
      | "/test-config"
      | "/similar-kanji-config"
      | "/writing-practice-config",
  ) => {
    if (selectedListIds.length === 0) {
      Alert.alert(
        "Select a Subject List",
        "This study mode needs a subject list selection.",
      );
      return;
    }

    router.push({
      pathname: pathname as any,
      params: { selectedListIds: selectedListIds.join(",") },
    });
  };

  const clearSelection = () => {
    setSelectedSubjectIds(new Set());
  };

  const clearFrequencyFilter = useCallback(() => {
    resetFrequencyLookupState();
    setFilters((currentFilters) => ({
      ...currentFilters,
      maxFrequencyRank: null,
    }));
  }, [resetFrequencyLookupState]);

  const clearSrsFilter = useCallback(() => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      srsStages: new Set(ALL_SEARCH_SRS_STAGES),
    }));
  }, []);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    filters.minLevel > 1 ||
    filters.maxLevel < 60 ||
    filters.types.size < 4 ||
    filters.srsStages.size < ALL_SEARCH_SRS_STAGES.length ||
    filters.jlptLevels.size > 0 ||
    filters.maxFrequencyRank !== null ||
    selectedListIds.length > 0;
  const activeFilterOptionCount = [
    filters.minLevel > 1 || filters.maxLevel < 60,
    filters.types.size < 4,
    filters.srsStages.size < ALL_SEARCH_SRS_STAGES.length,
    filters.jlptLevels.size > 0,
    filters.maxFrequencyRank !== null,
  ].filter(Boolean).length;
  const filterAccessibilityHint = filters.maxFrequencyRank !== null
    ? `Maximum frequency rank ${filters.maxFrequencyRank.toLocaleString()}`
    : undefined;

  const allMatchingSelected =
    matchingSubjectIds.length > 0 &&
    matchingSubjectIds.every((id) => selectedSubjectIds.has(id));
  const canToggleMatchingSubjects =
    canApplyCurrentSrsFilter &&
    canUseFrequencyResults &&
    !isScanningFrequencyCache &&
    matchingSubjectIds.length > 0;

  const toggleSelectAllMatching = () => {
    if (!canUseFrequencyResults || matchingSubjectIds.length === 0) return;

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
      } else if (!hasActiveFrequencyFilter) {
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

  const headerSelectionSummary = useMemo(() => {
    if (selectedListIds.length === 1) {
      const selectedList = availableLists.find(
        (list) => list.id === selectedListIds[0],
      );
      if (selectedList) {
        return `${selectedList.name} · ${selectedSubjectIds.size} selected`;
      }
    }

    if (selectedListIds.length > 1) {
      return `${selectedListIds.length} lists · ${selectedSubjectIds.size} selected`;
    }

    return `${selectedSubjectIds.size} selected`;
  }, [availableLists, selectedListIds, selectedSubjectIds.size]);

  //

  const getItemTypeColor = (itemType: string) => {
    return getSubjectTypeColor(itemType as any);
  };

  // Removed: handleFilterPress
  // Removed: handleLevelChange

  const handleCloseFilters = useCallback(() => {
    setShowFilters(false);
  }, []);

  const handleApplyFilters = useCallback(
    (newFilters: typeof filters) => {
      if (
        newFilters.maxFrequencyRank !== null &&
        !searchFiltersAreEqual(filters, newFilters)
      ) {
        setSelectedSubjectIds(new Set());
      }

      setFilters(newFilters);
      setShowFilters(false);
    },
    [filters],
  );

  const handleEnableFrequencyFilters = useCallback(() => {
    setShowVocabularyFrequency(true);
  }, [setShowVocabularyFrequency]);

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
    const jlptLevel = getJLPTLevelForSubject(item);
    const frequencyRank = frequencyRanks.get(item.id);
    const displayName =
      item.data.characters?.trim() || item.data.meanings[0].meaning;
    const openDetailsAccessibilityAction = `Open details for ${displayName}`;
    const levelAndSrsLabel = isSubjectSrsDataReady
      ? formatLevelWithSrsStage(item.data.level, srsStage)
      : `Level ${item.data.level}`;
    const accessibilityMetadata = [
      item.object.replace("_", " "),
      levelAndSrsLabel,
      typeof frequencyRank === "number"
        ? `frequency rank ${frequencyRank}`
        : null,
    ]
      .filter(Boolean)
      .join(", ");

    return (
      <TouchableOpacity
        style={[
          styles.itemContainer,
          { backgroundColor: theme.cardBackground },
          isSelected && { borderColor: typeColor, borderWidth: 2 },
        ]}
        onPress={() => toggleSubjectSelection(item)}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={`${displayName}, ${item.data.meanings[0].meaning}, ${accessibilityMetadata}`}
        accessibilityHint={
          isSelected ? "Deselects this subject" : "Selects this subject"
        }
        accessibilityActions={[
          {
            name: openDetailsAccessibilityAction,
            label: openDetailsAccessibilityAction,
          },
        ]}
        onAccessibilityAction={(event) => {
          if (
            event.nativeEvent.actionName === openDetailsAccessibilityAction
          ) {
            handleSubjectTilePress(item);
          }
        }}
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
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
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
            {jlptLevel && (
              <Text style={[styles.itemType, { color: theme.textSecondary }]}>
                {jlptLevel}
              </Text>
            )}
            {hasActiveFrequencyFilter && typeof frequencyRank === "number" ? (
              <Text
                style={[styles.itemType, { color: theme.textSecondary }]}
                accessibilityLabel={`Frequency rank ${frequencyRank}`}
              >
                #{frequencyRank.toLocaleString()}
              </Text>
            ) : null}
            <Text
              style={[styles.itemLevel, { color: theme.textLight }]}
            >
              {levelAndSrsLabel}
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

  const hasPartialFrequencyResults =
    hasActiveFrequencyFilter &&
    canUseFrequencyResults &&
    !frequencyDataReady;
  const hasScheduledFrequencyRetry =
    frequencyLookupError?.phase === "network" &&
    frequencyLookupError.reason === "automatic_retry";
  const manualFrequencyRetryAt =
    frequencyLookupError?.phase === "network" &&
    frequencyLookupError.reason === "request"
      ? (frequencyLookupError.retryAt ?? null)
      : null;
  const isManualFrequencyRetryCoolingDown =
    manualFrequencyRetryAt !== null && Date.now() < manualFrequencyRetryAt;
  const oneTimeFrequencyMessage =
    "This is usually a one-time setup for these words. Results are cached on this device, so they are normally ready next time.";
  const scheduledRetryReason =
    frequencyLookupError?.phase === "network" &&
    frequencyLookupError.reason === "automatic_retry" &&
    frequencyLookupError.cause === "rate_limit"
      ? "Jiten's request limit is resetting."
      : "Jiten took too long to respond.";
  const exhaustedFrequencyRetryMessage =
    frequencyLookupError?.phase === "network" &&
    frequencyLookupError.reason === "request" &&
    frequencyLookupError.cause === "rate_limit"
      ? isManualFrequencyRetryCoolingDown
        ? "Jiten's request limit is still active. Retry becomes available when the pause ends."
        : "Jiten paused the previous checks. Retry the remaining words."
      : frequencyLookupError?.phase === "network" &&
          frequencyLookupError.reason === "request" &&
          frequencyLookupError.cause === "timeout"
        ? isManualFrequencyRetryCoolingDown
          ? "Jiten did not respond after several automatic attempts. Retry becomes available when the pause ends."
          : "Automatic retries paused because Jiten did not respond. Retry the remaining words."
        : null;
  const readyFrequencyActionMessage =
    matchingSubjectIds.length > 0
      ? "You can study the ready words now."
      : "No checked words match your filter yet.";
  const partialFrequencyMessage = needsFrequencyLookupApproval
    ? `${unresolvedFrequencyCount.toLocaleString()} words still need to be checked. ${oneTimeFrequencyMessage}`
    : hasScheduledFrequencyRetry
      ? `${scheduledRetryReason} We'll check the remaining ${unresolvedFrequencyCount.toLocaleString()} automatically when the pause ends. ${readyFrequencyActionMessage} ${oneTimeFrequencyMessage}`
      : frequencyLookupError?.phase === "network"
        ? `${unresolvedFrequencyCount.toLocaleString()} words remain unchecked. ${exhaustedFrequencyRetryMessage ?? "Check your connection, then retry the rest."} ${readyFrequencyActionMessage} ${oneTimeFrequencyMessage}`
        : `Checking ${unresolvedFrequencyCount.toLocaleString()} remaining words. ${readyFrequencyActionMessage} ${oneTimeFrequencyMessage}`;

  const frequencyAnnouncementKey =
    !isScreenFocused || !shouldResolveFrequencyFilter
      ? null
      : frequencyLookupError?.phase === "cache"
        ? "cache_error"
        : hasScheduledFrequencyRetry
          ? `automatic_retry_${frequencyLookupError.cause}`
          : frequencyLookupError?.phase === "network"
            ? `network_error_${frequencyLookupError.cause ?? "request"}_${isManualFrequencyRetryCoolingDown ? "cooldown" : "ready"}`
            : needsFrequencyLookupApproval
              ? "approval"
              : frequencyDataReady
                ? "complete"
                : null;
  const frequencyAnnouncementMessage =
    frequencyLookupError?.phase === "cache"
      ? "Saved frequency check interrupted. Retry the local cache check."
      : hasScheduledFrequencyRetry
        ? `Frequency check paused. ${matchingSubjectIds.length.toLocaleString()} matching words are ready. The remaining ${unresolvedFrequencyCount.toLocaleString()} words will resume automatically when the pause ends.`
        : frequencyLookupError?.phase === "network"
          ? `Frequency check interrupted. ${matchingSubjectIds.length.toLocaleString()} matching words are ready. ${isManualFrequencyRetryCoolingDown ? "Retry becomes available when the pause ends." : "Retry the remaining words when ready."}`
          : needsFrequencyLookupApproval
            ? `${matchingSubjectIds.length.toLocaleString()} matching words are ready. ${unresolvedFrequencyCount.toLocaleString()} remaining words need approval before they are checked with Jiten.`
            : `Frequency check complete. ${matchingSubjectIds.length.toLocaleString()} matching words are ready.`;

  useEffect(() => {
    if (!frequencyAnnouncementKey) {
      frequencyAnnouncementKeyRef.current = null;
      return;
    }
    if (frequencyAnnouncementKeyRef.current === frequencyAnnouncementKey) {
      return;
    }

    frequencyAnnouncementKeyRef.current = frequencyAnnouncementKey;
    AccessibilityInfo.announceForAccessibility(frequencyAnnouncementMessage);
  }, [frequencyAnnouncementKey, frequencyAnnouncementMessage]);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.backgroundColor }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text
            style={[styles.headerTitle, { color: theme.textColor }]}
            onLongPress={handleDebugLongPress}
          >
            Custom Review
          </Text>
          <Text
            style={[styles.headerSubtitle, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {headerSelectionSummary}
          </Text>
        </View>
        <SubjectListStudyMenu
          selectedItemCount={
            canApplyCurrentSrsFilter
              ? readySelectedSubjectIds.length
              : 0
          }
          selectedKanjiCount={
            canApplyCurrentSrsFilter
              ? selectedKanjiIds.length
              : 0
          }
          hasSelectedLists={selectedListIds.length > 0}
          onStandardReview={startCustomReview}
          onKanjiMatch={startKanjiMatch}
          onCustomLessons={startCustomLessons}
          onRandomTest={() => openListStudyConfig("/test-config")}
          onSimilarKanji={() =>
            openListStudyConfig("/similar-kanji-config")
          }
          onKanjiWriting={() =>
            openListStudyConfig("/writing-practice-config")
          }
        />
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
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
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
          accessibilityRole="button"
          accessibilityLabel={
            selectedListIds.length > 0
              ? `Subject lists, ${selectedListIds.length} selected`
              : "Subject lists"
          }
        >
          <Ionicons name="list" size={21} color={theme.textSecondary} />
          {selectedListIds.length > 0 ? (
            <View
              style={[
                styles.filterBadge,
                { backgroundColor: theme.primary },
              ]}
            >
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
          accessibilityRole="button"
          accessibilityLabel={
            activeFilterOptionCount > 0
              ? `Filters, ${activeFilterOptionCount} active`
              : "Filters"
          }
          accessibilityHint={filterAccessibilityHint}
        >
          <Ionicons name="options" size={22} color={theme.textSecondary} />
          {activeFilterOptionCount > 0 ? (
            <View
              style={[
                styles.filterBadge,
                { backgroundColor: theme.primary },
              ]}
            >
              <Text style={styles.filterBadgeText}>
                {activeFilterOptionCount}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>

      <View style={styles.bulkActionsRow}>
        <TouchableOpacity
          style={[
            styles.bulkActionButton,
            { backgroundColor: theme.cardBackground },
            !canToggleMatchingSubjects && styles.bulkActionButtonDisabled,
          ]}
          onPress={toggleSelectAllMatching}
          disabled={!canToggleMatchingSubjects}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canToggleMatchingSubjects }}
          accessibilityLabel={
            allMatchingSelected
              ? `Deselect ${matchingSubjectIds.length} ready subjects`
              : `Select ${matchingSubjectIds.length} ready subjects`
          }
        >
          <Ionicons
            name={allMatchingSelected ? "remove-circle-outline" : "checkmark-done-outline"}
            size={18}
            color={theme.textSecondary}
          />
          <Text style={[styles.bulkActionText, { color: theme.textSecondary }]}>
            {allMatchingSelected
              ? hasActiveFrequencyFilter && !frequencyDataReady
                ? "Deselect Ready"
                : hasActiveFilters
                  ? "Deselect Filtered"
                  : "Deselect All"
              : hasActiveFrequencyFilter && !frequencyDataReady
                ? `Select ${matchingSubjectIds.length.toLocaleString()} Ready`
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
          accessibilityRole="button"
          accessibilityState={{ disabled: selectedSubjectIds.size === 0 }}
          accessibilityLabel="Clear subject selection"
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
      ) : hasActiveSrsFilter && isLoadingSubjectSrsStages ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text
            style={[styles.loadingText, { color: theme.textSecondary }]}
          >
            Loading study progress...
          </Text>
        </View>
      ) : hasActiveSrsFilter && subjectSrsStageLoadError ? (
        <View style={styles.frequencyLookupNotice}>
          <Ionicons
            name="warning-outline"
            size={36}
            color={theme.textSecondary}
          />
          <Text
            style={[styles.frequencyLookupTitle, { color: theme.textColor }]}
          >
            Study progress unavailable
          </Text>
          <Text
            style={[
              styles.frequencyLookupMessage,
              { color: theme.textSecondary },
            ]}
          >
            {subjectSrsStageLoadError}
          </Text>
          <View style={styles.frequencyLookupActions}>
            <TouchableOpacity
              style={[
                styles.frequencyLookupButton,
                { backgroundColor: theme.primary },
              ]}
              onPress={() => void loadSubjectSrsStages()}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.frequencyLookupPrimaryText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.frequencyLookupButton,
                styles.frequencyLookupSecondaryButton,
                { borderColor: theme.border },
              ]}
              onPress={clearSrsFilter}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={{ color: theme.textSecondary }}>Use All Stages</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : hasActiveFrequencyFilter && isScanningFrequencyCache ? (
        <View
          style={styles.loadingContainer}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Checking saved word frequencies"
          accessibilityValue={{
            min: 0,
            max: Math.max(1, frequencyLoadProgress.total),
            now: frequencyLoadProgress.completed,
            text: `${frequencyLoadProgress.completed} of ${frequencyLoadProgress.total}`,
          }}
        >
          <ActivityIndicator size="large" color={theme.primary} />
          <Text
            style={[styles.loadingText, { color: theme.textColor }]}
          >
            Checking saved frequencies...
          </Text>
          <Text
            style={[
              styles.frequencyLoadingProgress,
              { color: theme.textSecondary },
            ]}
          >
            {frequencyLoadProgress.completed.toLocaleString()} of{" "}
            {frequencyLoadProgress.total.toLocaleString()}
          </Text>
        </View>
      ) : needsFrequencyLookupApproval && !canUseFrequencyResults ? (
        <View style={styles.frequencyLookupNotice}>
          <Ionicons
            name="cloud-outline"
            size={36}
            color={theme.primary}
          />
          <Text
            style={[styles.frequencyLookupTitle, { color: theme.textColor }]}
          >
            Check uncached frequencies?
          </Text>
          <Text
            style={[
              styles.frequencyLookupMessage,
              { color: theme.textSecondary },
            ]}
          >
            {unresolvedFrequencyCount.toLocaleString()} words are not saved on
            this device. Checking them sends each Japanese word to Jiten and may
            take a while. This is usually a one-time setup for these words.
            Results are cached on this device, so they are normally ready next
            time.
          </Text>
          <View style={styles.frequencyLookupActions}>
            <TouchableOpacity
              style={[
                styles.frequencyLookupButton,
                { backgroundColor: theme.primary },
              ]}
              onPress={approveFrequencyLookup}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={styles.frequencyLookupPrimaryText}>
                Check {unresolvedFrequencyCount.toLocaleString()}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.frequencyLookupButton,
                styles.frequencyLookupSecondaryButton,
                { borderColor: theme.border },
              ]}
              onPress={clearFrequencyFilter}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={{ color: theme.textSecondary }}>Clear Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : frequencyLookupError && !canUseFrequencyResults ? (
        <View style={styles.frequencyLookupNotice}>
          <Ionicons
            name="warning-outline"
            size={36}
            color={theme.textSecondary}
          />
          <Text
            style={[styles.frequencyLookupTitle, { color: theme.textColor }]}
            accessibilityLiveRegion="polite"
          >
            {frequencyLookupError.phase === "cache"
              ? "Saved frequency check interrupted"
              : hasScheduledFrequencyRetry
                ? "Frequency check paused"
                : "Frequency check interrupted"}
          </Text>
          <Text
            style={[
              styles.frequencyLookupMessage,
              { color: theme.textSecondary },
            ]}
          >
            {frequencyLookupError.phase === "cache"
              ? "The saved frequency cache could not be read. No new words were sent to Jiten. Retry the local check."
              : hasScheduledFrequencyRetry
                ? `${scheduledRetryReason} We'll retry the remaining ${unresolvedFrequencyCount.toLocaleString()} words automatically when the pause ends. Normally, completed results are cached and ready next time.`
                : exhaustedFrequencyRetryMessage ??
                  "The frequency check could not continue. Check your connection, then retry the remaining words."}
          </Text>
          <View style={styles.frequencyLookupActions}>
            {!hasScheduledFrequencyRetry ? (
              <TouchableOpacity
                style={[
                  styles.frequencyLookupButton,
                  { backgroundColor: theme.primary },
                  isManualFrequencyRetryCoolingDown && { opacity: 0.5 },
                ]}
                onPress={retryFrequencyLookup}
                disabled={isManualFrequencyRetryCoolingDown}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: isManualFrequencyRetryCoolingDown,
                }}
              >
                <Text style={styles.frequencyLookupPrimaryText}>
                  {isManualFrequencyRetryCoolingDown
                    ? "Retry after Pause"
                    : "Retry"}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[
                styles.frequencyLookupButton,
                styles.frequencyLookupSecondaryButton,
                { borderColor: theme.border },
              ]}
              onPress={clearFrequencyFilter}
              activeOpacity={0.7}
              accessibilityRole="button"
            >
              <Text style={{ color: theme.textSecondary }}>Clear Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : hasActiveFrequencyFilter && !canUseFrequencyResults ? (
        <View
          style={styles.loadingContainer}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Checking word frequencies with Jiten"
          accessibilityValue={{
            min: 0,
            max: Math.max(1, frequencyLoadProgress.total),
            now: frequencyLoadProgress.completed,
            text: `${frequencyLoadProgress.completed} of ${frequencyLoadProgress.total}`,
          }}
          accessibilityLiveRegion="polite"
        >
          <ActivityIndicator size="large" color={theme.primary} />
          <Text
            style={[styles.loadingText, { color: theme.textColor }]}
          >
            Checking word frequencies...
          </Text>
          <Text
            style={[
              styles.frequencyLoadingProgress,
              { color: theme.textSecondary },
            ]}
          >
            {frequencyLoadProgress.completed.toLocaleString()} of{" "}
            {frequencyLoadProgress.total.toLocaleString()}
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
          ListHeaderComponent={
            hasPartialFrequencyResults ? (
              <View
                style={[
                  styles.frequencyPartialCard,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.frequencyPartialHeader}>
                  {isLoadingFrequencyRanks ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Ionicons
                      name={
                        hasScheduledFrequencyRetry
                          ? "time-outline"
                          : frequencyLookupError
                            ? "warning-outline"
                            : "cloud-download-outline"
                      }
                      size={20}
                      color={theme.primary}
                    />
                  )}
                  <Text
                    style={[
                      styles.frequencyPartialTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    {matchingSubjectIds.length.toLocaleString()} matching word
                    {matchingSubjectIds.length === 1 ? "" : "s"} ready
                  </Text>
                </View>
                <View
                  accessible
                  accessibilityRole="progressbar"
                  accessibilityLabel="Word frequencies checked"
                  accessibilityValue={{
                    min: 0,
                    max: Math.max(1, frequencyCandidates.length),
                    now: resolvedFrequencyCount,
                    text: `${resolvedFrequencyCount} of ${frequencyCandidates.length}`,
                  }}
                >
                  <Text
                    style={[
                      styles.frequencyPartialProgress,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {resolvedFrequencyCount.toLocaleString()} of{" "}
                    {frequencyCandidates.length.toLocaleString()} checked ·{" "}
                    {unresolvedFrequencyCount.toLocaleString()} remaining
                  </Text>
                </View>
                <Text
                  style={[
                    styles.frequencyPartialMessage,
                    { color: theme.textSecondary },
                  ]}
                >
                  {partialFrequencyMessage}
                </Text>
                {needsFrequencyLookupApproval ||
                (frequencyLookupError?.phase === "network" &&
                  frequencyLookupError.reason === "request") ? (
                  <TouchableOpacity
                    style={[
                      styles.frequencyPartialButton,
                      { backgroundColor: theme.primary },
                      isManualFrequencyRetryCoolingDown && { opacity: 0.5 },
                    ]}
                    onPress={
                      needsFrequencyLookupApproval
                        ? approveFrequencyLookup
                        : retryFrequencyLookup
                    }
                    disabled={isManualFrequencyRetryCoolingDown}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{
                      disabled: isManualFrequencyRetryCoolingDown,
                    }}
                    accessibilityLabel={
                      needsFrequencyLookupApproval
                        ? `Check ${unresolvedFrequencyCount} remaining word frequencies`
                        : `Retry ${unresolvedFrequencyCount} remaining word frequencies`
                    }
                  >
                    <Text style={styles.frequencyLookupPrimaryText}>
                      {needsFrequencyLookupApproval
                        ? `Check ${unresolvedFrequencyCount.toLocaleString()} Remaining`
                        : isManualFrequencyRetryCoolingDown
                          ? "Retry after Pause"
                          : `Retry ${unresolvedFrequencyCount.toLocaleString()} Remaining`}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                {hasPartialFrequencyResults
                  ? `No checked words match yet; ${unresolvedFrequencyCount.toLocaleString()} remain unchecked.`
                  : searchQuery ||
                    filters.minLevel > 1 ||
                    filters.maxLevel < 60 ||
                    filters.types.size < 4 ||
                    filters.srsStages.size < ALL_SEARCH_SRS_STAGES.length ||
                    filters.jlptLevels.size > 0 ||
                    filters.maxFrequencyRank !== null
                    ? "No subjects found matching your search and filters"
                    : "No subjects available"}
              </Text>
            </View>
          }
        />
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
        showJlptFilters
        showFrequencyFilters
        frequencyFiltersEnabled={showVocabularyFrequency}
        onEnableFrequencyFilters={handleEnableFrequencyFilters}
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
    justifyContent: "space-between",
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
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
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
  frequencyLoadingProgress: {
    marginTop: 6,
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  frequencyLookupNotice: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingBottom: 40,
  },
  frequencyLookupTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  frequencyLookupMessage: {
    maxWidth: 420,
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  frequencyLookupActions: {
    width: "100%",
    maxWidth: 340,
    marginTop: 20,
    flexDirection: "row",
    gap: 10,
  },
  frequencyLookupButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  frequencyLookupSecondaryButton: {
    borderWidth: 1,
  },
  frequencyLookupPrimaryText: {
    color: "white",
    fontWeight: "700",
  },
  frequencyPartialCard: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  frequencyPartialHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  frequencyPartialTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  frequencyPartialProgress: {
    marginTop: 8,
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  frequencyPartialMessage: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
  },
  frequencyPartialButton: {
    minHeight: 44,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
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
