import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router/react-navigation";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import {
  createDefaultSearchFilters,
  SearchFilterModal,
  SearchFilters,
} from "../../../src/components/SearchFilterModal";
import { GlassButton } from "../../../src/components/GlassButton";
import { WaniKaniItemType } from "../../../src/types/wanikani";
import {
  fetchAllPages,
  getAllAssignmentsCached,
  getSubjects,
  Subject,
} from "../../../src/utils/api";
import {
  ALL_SUBJECTS_CACHE_KEY,
  getAllSubjects,
  saveToCache,
} from "../../../src/utils/cache";
import { fontStyles } from "../../../src/utils/fonts";
import { pickBestImage, useRemoteSvg } from "../../../src/utils/radicalSvg";
import { getSubjectTypeColor } from "../../../src/utils/subjectColors";
import {
  deleteSubjectList,
  getSubjectLists,
  renameSubjectList,
  replaceSubjectIdsInList,
  SubjectList,
} from "../../../src/utils/subjectLists";
import { useAuthStore } from "../../../src/utils/store";
import {
  rankSubjectsByQuery,
  sortSubjectsByLevelAndType,
} from "../../../src/utils/subjectSearch";
import { formatLevelWithSrsStage } from "../../../src/utils/srsStageLabel";
import { useTheme } from "../../../src/utils/theme";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SwiftUI = Platform.OS === "ios" ? require("@expo/ui/swift-ui") : null;
const DEFAULT_ACTIVE_SRS_STAGES = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);

function setsEqual(a: Set<number>, b: Set<number>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a.values()) {
    if (!b.has(value)) return false;
  }
  return true;
}

export default function SubjectListEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { apiToken } = useAuthStore();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [isLoadingList, setIsLoadingList] = useState(true);
  const [list, setList] = useState<SubjectList | null>(null);
  const [listName, setListName] = useState("");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<number>>(
    new Set()
  );
  const [initialName, setInitialName] = useState("");
  const [initialSubjectIds, setInitialSubjectIds] = useState<Set<number>>(
    new Set()
  );
  const [isSaving, setIsSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"browse" | "selected">("browse");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(() => {
    const defaults = createDefaultSearchFilters();
    defaults.srsStages = new Set(DEFAULT_ACTIVE_SRS_STAGES);
    return defaults;
  });
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [pendingListName, setPendingListName] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);

  const [allSubjects, setAllSubjects] = useState<Subject[] | null>(null);
  const [filteredSubjects, setFilteredSubjects] = useState<Subject[]>([]);
  const [matchingSubjectIds, setMatchingSubjectIds] = useState<number[]>([]);
  const [subjectSrsStageMap, setSubjectSrsStageMap] = useState<
    Map<number, number>
  >(new Map());
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isCacheMissing, setIsCacheMissing] = useState(false);
  const [isRebuildingCache, setIsRebuildingCache] = useState(false);
  const [cacheRebuildProgress, setCacheRebuildProgress] = useState(0);

  const loadList = useCallback(async () => {
    if (!id) return;
    setIsLoadingList(true);
    try {
      const lists = await getSubjectLists();
      const found = lists.find((entry) => entry.id === id);
      if (!found) {
        Alert.alert("List not found", "This list may have been deleted.", [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]);
        return;
      }
      setList(found);
      setListName(found.name);
      setInitialName(found.name);
      const subjectIdSet = new Set(found.subjectIds);
      setSelectedSubjectIds(subjectIdSet);
      setInitialSubjectIds(subjectIdSet);
    } catch (error) {
      console.error("Failed to load subject list:", error);
      Alert.alert("Error", "Failed to load this list.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setIsLoadingList(false);
    }
  }, [id, router]);

  const loadSubjectSrsStages = useCallback(async () => {
    if (!apiToken) return;
    try {
      const assignments = await getAllAssignmentsCached(apiToken);
      const stageMap = new Map<number, number>();
      assignments.data.forEach((assignment) => {
        stageMap.set(
          assignment.data.subject_id,
          assignment.data.srs_stage ?? 0
        );
      });
      setSubjectSrsStageMap(stageMap);
    } catch (error) {
      console.warn("Failed to load SRS stages for list editor:", error);
      setSubjectSrsStageMap(new Map());
    }
  }, [apiToken]);

  const loadAllSubjects = useCallback(async () => {
    if (!apiToken) return;
    setIsLoadingSubjects(true);
    setIsCacheMissing(false);
    try {
      const subjects = await getAllSubjects();
      if (!subjects || subjects.length === 0) {
        setIsCacheMissing(true);
        setAllSubjects([]);
      } else {
        setAllSubjects(sortSubjectsByLevelAndType(subjects));
      }
    } catch (error) {
      console.error("Failed to load subjects in list editor:", error);
      setIsCacheMissing(true);
      setAllSubjects([]);
    } finally {
      setIsLoadingSubjects(false);
    }
  }, [apiToken]);

  useFocusEffect(
    useCallback(() => {
      loadList();
      loadAllSubjects();
      loadSubjectSrsStages();
    }, [loadAllSubjects, loadList, loadSubjectSrsStages])
  );

  const rebuildCache = useCallback(async () => {
    if (!apiToken) return;

    setIsRebuildingCache(true);
    setCacheRebuildProgress(0);
    try {
      setCacheRebuildProgress(10);
      const response = await getSubjects(
        apiToken,
        {},
        { skipCollectionCache: true }
      );
      setCacheRebuildProgress(30);
      const allSubjectsData = await fetchAllPages(response, apiToken);
      setCacheRebuildProgress(80);

      await saveToCache(
        ALL_SUBJECTS_CACHE_KEY,
        allSubjectsData.data,
        allSubjectsData.data_updated_at
      );

      setCacheRebuildProgress(95);
      setAllSubjects(sortSubjectsByLevelAndType(allSubjectsData.data));
      setIsCacheMissing(false);
      setCacheRebuildProgress(100);
    } catch (error) {
      console.error("Failed to rebuild cache for list editor:", error);
      Alert.alert("Error", "Failed to download subject data. Please try again.");
    } finally {
      setTimeout(() => {
        setIsRebuildingCache(false);
        setCacheRebuildProgress(0);
      }, 400);
    }
  }, [apiToken]);

  useEffect(() => {
    if (!allSubjects) {
      setFilteredSubjects([]);
      setMatchingSubjectIds([]);
      return;
    }

    const filteredByFacets = allSubjects
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

    setMatchingSubjectIds(filtered.map((subject) => subject.id));

    if (filtered.length > 250) {
      filtered = filtered.slice(0, 250);
    }

    setFilteredSubjects(filtered);
  }, [
    allSubjects,
    filters,
    searchQuery,
    subjectSrsStageMap,
  ]);

  const hasUnsavedChanges = useMemo(() => {
    const normalizedName = listName.trim();
    const effectiveName = normalizedName.length > 0 ? normalizedName : "Untitled List";
    if (effectiveName !== initialName) {
      return true;
    }
    return !setsEqual(selectedSubjectIds, initialSubjectIds);
  }, [initialName, initialSubjectIds, listName, selectedSubjectIds]);

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

  const clearSelection = () => {
    setSelectedSubjectIds(new Set());
  };

  const selectedSubjects = useMemo(() => {
    if (!allSubjects) {
      return [];
    }

    const onlySelected = allSubjects.filter((subject) =>
      selectedSubjectIds.has(subject.id)
    );
    const query = searchQuery.trim();

    const ranked = query
      ? rankSubjectsByQuery(onlySelected, query).map(({ subject }) => subject)
      : sortSubjectsByLevelAndType(onlySelected);

    if (ranked.length > 250) {
      return ranked.slice(0, 250);
    }

    return ranked;
  }, [allSubjects, searchQuery, selectedSubjectIds]);

  const allMatchingSelected =
    matchingSubjectIds.length > 0 &&
    matchingSubjectIds.every((subjectId) => selectedSubjectIds.has(subjectId));

  const hasNonDefaultSrsSelection =
    filters.srsStages.has(0) ||
    filters.srsStages.size !== DEFAULT_ACTIVE_SRS_STAGES.size ||
    !setsEqual(filters.srsStages, DEFAULT_ACTIVE_SRS_STAGES);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    filters.minLevel > 1 ||
    filters.maxLevel < 60 ||
    filters.types.size < 4 ||
    hasNonDefaultSrsSelection;

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

  const getItemTypeColor = (itemType: string) => {
    return getSubjectTypeColor(itemType as any);
  };

  const SubjectRadicalCharacter = ({ item }: { item: Subject }) => {
    const bestImg = pickBestImage(item.data.character_images || undefined);
    const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
    const svgXml = useRemoteSvg(svgUrl, "#ffffff");
    const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(
      null
    );

    useEffect(() => {
      if (bestImg?.type === "png") {
        setProcessedImageUrl(bestImg.url.replace(/^@/, ""));
      } else if ((item.data as any).image_url) {
        setProcessedImageUrl(String((item.data as any).image_url).replace(/^@/, ""));
      } else {
        setProcessedImageUrl(null);
      }
    }, [bestImg, item.data]);

    if (item.data.characters && item.data.characters.trim()) {
      return (
        <Text style={[styles.itemCharacter, fontStyles.japaneseText]}>
          {item.data.characters}
        </Text>
      );
    }
    if (svgXml) {
      return <SvgXml xml={svgXml} width={24} height={24} />;
    }
    if (processedImageUrl) {
      return (
        <Image
          source={{ uri: processedImageUrl }}
          style={{ width: 24, height: 24 }}
          resizeMode="contain"
        />
      );
    }
    return (
      <Text style={[styles.itemCharacter, fontStyles.japaneseText]}>
        {item.data.meanings[0].meaning}
      </Text>
    );
  };

  const handleSave = async () => {
    if (!list || !id) return;
    setIsSaving(true);
    try {
      const trimmedName = listName.trim();
      const targetName = trimmedName.length > 0 ? trimmedName : "Untitled List";
      await Promise.all([
        renameSubjectList(list.id, targetName),
        replaceSubjectIdsInList(list.id, Array.from(selectedSubjectIds.values())),
      ]);
      setInitialName(targetName);
      setInitialSubjectIds(new Set(selectedSubjectIds));
      setList((prev) =>
        prev
          ? {
              ...prev,
              name: targetName,
              subjectIds: Array.from(selectedSubjectIds.values()),
            }
          : prev
      );
    } catch (error) {
      console.error("Failed to save list:", error);
      Alert.alert("Error", "Failed to save list changes.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!list) return;
    Alert.alert(
      "Delete List",
      `Delete "${list.name}"? This won't delete any subjects.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const deleted = await deleteSubjectList(list.id);
            if (deleted) {
              router.back();
            }
          },
        },
      ]
    );
  };

  const handleStartRename = () => {
    setPendingListName(listName);
    setIsRenameModalVisible(true);
  };

  const handleApplyRename = async () => {
    if (!list) return;

    const trimmed = pendingListName.trim();
    const targetName = trimmed.length > 0 ? trimmed : "Untitled List";

    if (targetName === listName) {
      setIsRenameModalVisible(false);
      return;
    }

    setIsRenaming(true);
    try {
      const renamed = await renameSubjectList(list.id, targetName);
      if (!renamed) {
        Alert.alert("Error", "Could not rename this list.");
        return;
      }

      setListName(targetName);
      setInitialName(targetName);
      setList((prev) => (prev ? { ...prev, name: targetName } : prev));
      setIsRenameModalVisible(false);
    } catch (error) {
      console.error("Failed to rename list:", error);
      Alert.alert("Error", "Failed to rename this list.");
    } finally {
      setIsRenaming(false);
    }
  };

  const openHeaderMenu = () => {
    Alert.alert(listName || "List options", undefined, [
      { text: "Rename", onPress: handleStartRename },
      { text: "Delete", style: "destructive", onPress: handleDelete },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const handleBack = () => {
    if (!hasUnsavedChanges) {
      router.back();
      return;
    }
    Alert.alert("Discard changes?", "You have unsaved changes in this list.", [
      { text: "Keep Editing", style: "cancel" },
      { text: "Discard", style: "destructive", onPress: () => router.back() },
    ]);
  };

  const renderBrowseSubjectItem = ({ item }: { item: Subject }) => {
    const isSelected = selectedSubjectIds.has(item.id);
    const typeColor = getItemTypeColor(item.object);
    const srsStage = subjectSrsStageMap.get(item.id) ?? 0;
    return (
      <TouchableOpacity
        style={[
          styles.itemContainer,
          { backgroundColor: theme.cardBackground },
          isSelected && {
            borderColor: `${typeColor}cc`,
            borderWidth: 1.5,
            backgroundColor: `${typeColor}14`,
          },
        ]}
        onPress={() => toggleSubjectSelection(item)}
        activeOpacity={0.75}
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
            <Text style={[styles.itemCharacter, fontStyles.japaneseText]}>
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
        <Ionicons
          name={isSelected ? "checkbox" : "square-outline"}
          size={22}
          color={isSelected ? typeColor : theme.textSecondary}
        />
      </TouchableOpacity>
    );
  };

  const renderSelectedSubjectItem = ({ item }: { item: Subject }) => {
    const typeColor = getItemTypeColor(item.object);
    const srsStage = subjectSrsStageMap.get(item.id) ?? 0;
    return (
      <View
        style={[
          styles.selectedItemContainer,
          {
            backgroundColor: theme.cardBackground,
            borderColor: `${typeColor}55`,
          },
        ]}
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
            <Text style={[styles.itemCharacter, fontStyles.japaneseText]}>
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
        <TouchableOpacity
          style={[
            styles.removeButton,
            {
              borderColor: `${theme.error}66`,
              backgroundColor: `${theme.error}14`,
            },
          ]}
          onPress={() => toggleSubjectSelection(item)}
          activeOpacity={0.75}
        >
          <Ionicons name="remove-circle-outline" size={16} color={theme.error} />
          <Text style={[styles.removeButtonText, { color: theme.error }]}>
            Remove
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (isLoadingList || !list) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundColor }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading list...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <GlassButton
            iconName="arrow-back"
            onPress={handleBack}
            iconColor={theme.textColor}
            style={styles.headerIconButton}
            variant={theme.isDark ? "colored" : "light"}
          />
          <View style={styles.headerTitleContainer}>
            <Text
              style={[styles.headerTitle, { color: theme.textColor }]}
              numberOfLines={1}
            >
              {listName.trim() || "Untitled List"}
            </Text>
            <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              {selectedSubjectIds.size} item
              {selectedSubjectIds.size === 1 ? "" : "s"} in list
            </Text>
          </View>
          {Platform.OS === "ios" && SwiftUI ? (
            <SwiftUI.Host matchContents style={styles.headerIconButton}>
              <SwiftUI.Menu
                label={
                  <SwiftUI.RNHostView matchContents>
                    <GlassButton
                      iconName="ellipsis-horizontal"
                      iconColor={theme.textColor}
                      style={styles.headerIconButton}
                      variant={theme.isDark ? "colored" : "light"}
                    />
                  </SwiftUI.RNHostView>
                }
              >
                <SwiftUI.Button
                  label="Rename"
                  systemImage="pencil"
                  onPress={handleStartRename}
                />
                <SwiftUI.Button
                  label="Delete"
                  systemImage="trash"
                  role="destructive"
                  onPress={handleDelete}
                />
              </SwiftUI.Menu>
            </SwiftUI.Host>
          ) : (
            <GlassButton
              iconName="ellipsis-horizontal"
              onPress={openHeaderMenu}
              iconColor={theme.textColor}
              style={styles.headerIconButton}
              variant={theme.isDark ? "colored" : "light"}
            />
          )}
        </View>

        <View
          style={[
            styles.tabsContainer,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "browse" && {
                backgroundColor: `${theme.primary}20`,
                borderColor: `${theme.primary}55`,
              },
            ]}
            onPress={() => setActiveTab("browse")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabButtonText,
                { color: activeTab === "browse" ? theme.primary : theme.textSecondary },
              ]}
            >
              Browse
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === "selected" && {
                backgroundColor: `${theme.primary}20`,
                borderColor: `${theme.primary}55`,
              },
            ]}
            onPress={() => setActiveTab("selected")}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabButtonText,
                { color: activeTab === "selected" ? theme.primary : theme.textSecondary },
              ]}
            >
              In List ({selectedSubjectIds.size})
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchContainer,
              { backgroundColor: theme.cardBackground, borderColor: theme.border },
            ]}
          >
            <Ionicons name="search" size={18} color={theme.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={
                activeTab === "browse"
                  ? "Search subjects..."
                  : "Search selected subjects..."
              }
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.textColor }]}
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
          {activeTab === "browse" ? (
            <TouchableOpacity
              style={[
                styles.filterButton,
                { backgroundColor: theme.cardBackground, borderColor: theme.border },
              ]}
              onPress={() => setShowFilters(true)}
            >
              <Ionicons name="options" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {activeTab === "browse" ? (
          <View style={styles.bulkActionsRow}>
            <TouchableOpacity
              style={[
                styles.bulkActionButton,
                { backgroundColor: theme.cardBackground, borderColor: theme.border },
                matchingSubjectIds.length === 0 && styles.bulkActionButtonDisabled,
              ]}
              disabled={matchingSubjectIds.length === 0}
              onPress={toggleSelectAllMatching}
            >
              <Ionicons
                name={
                  allMatchingSelected
                    ? "remove-circle-outline"
                    : "checkmark-done-outline"
                }
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
                { backgroundColor: theme.cardBackground, borderColor: theme.border },
                selectedSubjectIds.size === 0 && styles.bulkActionButtonDisabled,
              ]}
              onPress={clearSelection}
              disabled={selectedSubjectIds.size === 0}
            >
              <Ionicons
                name="close-circle-outline"
                size={18}
                color={theme.textSecondary}
              />
              <Text style={[styles.bulkActionText, { color: theme.textSecondary }]}>
                Clear All
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.bulkActionsRow}>
            <TouchableOpacity
              style={[
                styles.bulkActionButton,
                { backgroundColor: theme.cardBackground, borderColor: theme.border },
                selectedSubjectIds.size === 0 && styles.bulkActionButtonDisabled,
              ]}
              onPress={clearSelection}
              disabled={selectedSubjectIds.size === 0}
            >
              <Ionicons name="trash-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.bulkActionText, { color: theme.textSecondary }]}>
                Remove All From List
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isLoadingSubjects ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading subjects...
            </Text>
          </View>
        ) : isCacheMissing && !isRebuildingCache ? (
          <View style={styles.centerState}>
            <Ionicons name="warning-outline" size={56} color={theme.textSecondary} />
            <Text style={[styles.centerStateTitle, { color: theme.textColor }]}>
              Data Missing
            </Text>
            <Text style={[styles.centerStateText, { color: theme.textSecondary }]}>
              Subject data is missing. Download it to edit this list.
            </Text>
            <TouchableOpacity
              style={[styles.downloadButton, { backgroundColor: theme.primary }]}
              onPress={rebuildCache}
            >
              <Text style={styles.downloadButtonText}>Download Data</Text>
            </TouchableOpacity>
          </View>
        ) : isRebuildingCache ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.centerStateTitle, { color: theme.textColor }]}>
              Downloading Data
            </Text>
            <Text style={[styles.centerStateText, { color: theme.textSecondary }]}>
              {cacheRebuildProgress}% complete
            </Text>
          </View>
        ) : (
          <FlatList
            data={activeTab === "browse" ? filteredSubjects : selectedSubjects}
            renderItem={
              activeTab === "browse"
                ? renderBrowseSubjectItem
                : renderSelectedSubjectItem
            }
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: 112 + insets.bottom },
            ]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={[styles.emptyStateText, { color: theme.textSecondary }]}>
                  {activeTab === "browse"
                    ? "No subjects match your current search and filters."
                    : "No selected subjects match your search."}
                </Text>
              </View>
            }
          />
        )}

        <View
          style={[
            styles.footer,
            {
              backgroundColor: theme.cardBackground,
              borderTopColor: theme.border,
              paddingBottom: 12 + insets.bottom,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.saveButton,
              {
                backgroundColor: hasUnsavedChanges ? theme.primary : theme.border,
                opacity: hasUnsavedChanges ? 1 : 0.7,
              },
            ]}
            onPress={handleSave}
            disabled={!hasUnsavedChanges || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="save-outline" size={20} color="#fff" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <Modal
          visible={isRenameModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsRenameModalVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalCard,
                { backgroundColor: theme.cardBackground, borderColor: theme.border },
              ]}
            >
              <Text style={[styles.modalTitle, { color: theme.textColor }]}>
                Rename List
              </Text>
              <TextInput
                value={pendingListName}
                onChangeText={setPendingListName}
                style={[
                  styles.modalInput,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.backgroundColor,
                    color: theme.textColor,
                  },
                ]}
                placeholder="List name"
                placeholderTextColor={theme.textLight}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={() => {
                  void handleApplyRename();
                }}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalButton, { borderColor: theme.border }]}
                  onPress={() => setIsRenameModalVisible(false)}
                  disabled={isRenaming}
                >
                  <Text style={[styles.modalButtonText, { color: theme.textColor }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.modalButton,
                    { backgroundColor: theme.primary, opacity: isRenaming ? 0.7 : 1 },
                  ]}
                  onPress={() => {
                    void handleApplyRename();
                  }}
                  disabled={isRenaming}
                >
                  <Text style={styles.modalPrimaryButtonText}>
                    {isRenaming ? "Saving..." : "Save"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        <SearchFilterModal
          visible={showFilters && activeTab === "browse"}
          currentFilters={filters}
          onClose={() => setShowFilters(false)}
          onApply={(nextFilters) => {
            setFilters(nextFilters);
            setShowFilters(false);
          }}
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
    paddingBottom: 12,
  },
  headerIconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleContainer: {
    flex: 1,
    paddingHorizontal: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
  },
  tabsContainer: {
    marginHorizontal: 16,
    marginBottom: 10,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    flexDirection: "row",
  },
  tabButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "transparent",
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    gap: 10,
    height: 46,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  bulkActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 8,
  },
  bulkActionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  bulkActionButtonDisabled: {
    opacity: 0.45,
  },
  bulkActionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  itemContainer: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  selectedItemContainer: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
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
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  itemDetails: {
    flex: 1,
    marginRight: 10,
  },
  removeButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  removeButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  itemMeaning: {
    fontSize: 15,
    fontWeight: "600",
  },
  itemMetadata: {
    flexDirection: "row",
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
  emptyState: {
    paddingVertical: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateText: {
    fontSize: 15,
    textAlign: "center",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
  centerStateTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 12,
    marginBottom: 8,
    textAlign: "center",
  },
  centerStateText: {
    fontSize: 15,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
  },
  downloadButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  downloadButtonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 14,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalActions: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalButton: {
    minWidth: 90,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalPrimaryButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
