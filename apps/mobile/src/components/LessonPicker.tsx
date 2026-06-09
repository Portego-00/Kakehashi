import { Ionicons } from "@expo/vector-icons";
import { FlashList } from "@shopify/flash-list";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import AddToSubjectListsModal from "./AddToSubjectListsModal";
import { pickBestImage, useRemoteSvg } from "../utils/radicalSvg";
import { useSettingsStore } from "../utils/store";
import {
  getSubjectLists,
  SubjectList,
  syncSubjectListsNow,
} from "../utils/subjectLists";
import { getSubjectTypeColor } from "../utils/subjectColors";
import { rankSubjectsByQuery } from "../utils/subjectSearch";
import { useTheme } from "../utils/theme";

export interface LessonPickerItem {
  id: number;
  assignmentId: number;
  subjectId: number;
  subject: {
    id: number;
    object: "radical" | "kanji" | "vocabulary" | "kana_vocabulary";
    data: {
      characters: string | null;
      meanings: { meaning: string; primary?: boolean }[];
      readings?: { reading: string; primary?: boolean }[];
      level: number;
      character_images?: any[];
    };
  };
}

interface LevelSectionData {
  level: number;
  radicals: LessonPickerItem[];
  kanji: LessonPickerItem[];
  vocabulary: LessonPickerItem[];
}

interface LessonPickerProps {
  lessons: LessonPickerItem[];
  onStart: (selectedLessons: LessonPickerItem[]) => void;
  onCancel: () => void;
}

type LessonListHeaderItem = {
  id: string;
  type: "level-header";
  level: number;
  lessons: LessonPickerItem[];
};

type LessonListItemRow = {
  id: string;
  type: "lesson-row";
  lesson: LessonPickerItem;
};

type LessonListDataItem = LessonListHeaderItem | LessonListItemRow;

type SubjectIconSizing = {
  glyphSize: number;
  textSize: number;
  itemPaddingHorizontal: number;
  itemPaddingVertical: number;
  itemMinSize: number;
  itemBorderRadius: number;
  itemGap: number;
};

const DEFAULT_SUBJECT_ICON_SIZING: SubjectIconSizing = {
  glyphSize: 20,
  textSize: 16,
  itemPaddingHorizontal: 16,
  itemPaddingVertical: 12,
  itemMinSize: 48,
  itemBorderRadius: 8,
  itemGap: 8,
};

const LARGE_SUBJECT_ICON_SIZING: SubjectIconSizing = {
  glyphSize: 28,
  textSize: 20,
  itemPaddingHorizontal: 20,
  itemPaddingVertical: 14,
  itemMinSize: 60,
  itemBorderRadius: 10,
  itemGap: 10,
};

const LIST_SUBJECT_ICON_SIZING: SubjectIconSizing = {
  ...DEFAULT_SUBJECT_ICON_SIZING,
  glyphSize: 24,
  textSize: 18,
};

const LESSON_TYPE_ORDER: Record<
  LessonPickerItem["subject"]["object"],
  number
> = {
  radical: 0,
  kanji: 1,
  vocabulary: 2,
  kana_vocabulary: 3,
};

function getResponsiveSubjectIconSizing(screenWidth: number): SubjectIconSizing {
  const minWidth = 390;
  const maxWidth = 1100;
  const normalizedProgress = Math.min(
    1,
    Math.max(0, (screenWidth - minWidth) / (maxWidth - minWidth))
  );

  const lerp = (smallValue: number, largeValue: number): number =>
    Math.round(smallValue + (largeValue - smallValue) * normalizedProgress);

  return {
    glyphSize: lerp(
      DEFAULT_SUBJECT_ICON_SIZING.glyphSize,
      LARGE_SUBJECT_ICON_SIZING.glyphSize
    ),
    textSize: lerp(
      DEFAULT_SUBJECT_ICON_SIZING.textSize,
      LARGE_SUBJECT_ICON_SIZING.textSize
    ),
    itemPaddingHorizontal: lerp(
      DEFAULT_SUBJECT_ICON_SIZING.itemPaddingHorizontal,
      LARGE_SUBJECT_ICON_SIZING.itemPaddingHorizontal
    ),
    itemPaddingVertical: lerp(
      DEFAULT_SUBJECT_ICON_SIZING.itemPaddingVertical,
      LARGE_SUBJECT_ICON_SIZING.itemPaddingVertical
    ),
    itemMinSize: lerp(
      DEFAULT_SUBJECT_ICON_SIZING.itemMinSize,
      LARGE_SUBJECT_ICON_SIZING.itemMinSize
    ),
    itemBorderRadius: lerp(
      DEFAULT_SUBJECT_ICON_SIZING.itemBorderRadius,
      LARGE_SUBJECT_ICON_SIZING.itemBorderRadius
    ),
    itemGap: lerp(
      DEFAULT_SUBJECT_ICON_SIZING.itemGap,
      LARGE_SUBJECT_ICON_SIZING.itemGap
    ),
  };
}

const getTypeColor = (type: string, theme: any) => {
  if (
    type === "radical" ||
    type === "kanji" ||
    type === "vocabulary" ||
    type === "kana_vocabulary"
  ) {
    return getSubjectTypeColor(type);
  }

  return theme.textSecondary;
};

const getPrimaryMeaning = (item: LessonPickerItem) =>
  item.subject.data.meanings[0]?.meaning || "?";

const getPrimaryReading = (item: LessonPickerItem) => {
  if (
    item.subject.object !== "kanji" &&
    item.subject.object !== "vocabulary" &&
    item.subject.object !== "kana_vocabulary"
  ) {
    return null;
  }

  const primaryReading = item.subject.data.readings?.find((r) => r.primary);
  return primaryReading?.reading || item.subject.data.readings?.[0]?.reading || null;
};

const sortLessonsForList = (items: LessonPickerItem[]) =>
  [...items].sort((a, b) => {
    const typeDiff = LESSON_TYPE_ORDER[a.subject.object] - LESSON_TYPE_ORDER[b.subject.object];
    if (typeDiff !== 0) {
      return typeDiff;
    }

    return getPrimaryMeaning(a).localeCompare(getPrimaryMeaning(b));
  });

const LessonItemCharacter = React.memo(
  ({
    item,
    isSelected,
    theme,
    sizing,
  }: {
    item: LessonPickerItem;
    isSelected: boolean;
    theme: any;
    sizing: SubjectIconSizing;
  }) => {
    const isRadical = item.subject.object === "radical";

    // For radicals, try SVG fallback if no characters
    const bestImg =
      isRadical && item.subject.data.character_images?.length
        ? pickBestImage(item.subject.data.character_images)
        : null;
    const svgUrl = bestImg?.type === "svg" ? bestImg.url : null;
    const glyphColor = isSelected
      ? "#ffffff"
      : theme.isDark
      ? "#ffffff"
      : "#000000";
    const svgXml = useRemoteSvg(svgUrl, glyphColor);

    // Display logic: characters → SVG → meaning
    if (item.subject.data.characters) {
      return (
        <Text
          style={[
            styles.lessonItemText,
            { fontSize: sizing.textSize },
            { color: isSelected ? "white" : theme.textColor },
          ]}
        >
          {item.subject.data.characters}
        </Text>
      );
    }

    if (svgXml) {
      return (
        <SvgXml
          xml={svgXml}
          width={sizing.glyphSize}
          height={sizing.glyphSize}
        />
      );
    }

    if (bestImg?.type === "png") {
      return (
        <Image
          source={{ uri: bestImg.url }}
          style={{
            width: sizing.glyphSize,
            height: sizing.glyphSize,
            tintColor: glyphColor,
          }}
          resizeMode="contain"
        />
      );
    }

    // Fallback to meaning for radicals without characters or SVG
    return (
      <Text
        style={[
          styles.lessonItemText,
          { fontSize: sizing.textSize },
          { color: isSelected ? "white" : theme.textColor },
        ]}
      >
        {item.subject.data.meanings[0]?.meaning || "?"}
      </Text>
    );
  }
);

LessonItemCharacter.displayName = "LessonItemCharacter";

const LessonItem = React.memo(
  ({
    item,
    isSelected,
    onToggle,
    sizing,
  }: {
    item: LessonPickerItem;
    isSelected: boolean;
    onToggle: (id: number) => void;
    sizing: SubjectIconSizing;
  }) => {
    const { theme } = useTheme();
    const typeColor = getTypeColor(item.subject.object, theme);

    return (
      <TouchableOpacity
        style={[
          styles.lessonItem,
          {
            backgroundColor: isSelected ? typeColor : theme.cardBackground,
            borderColor: typeColor,
            paddingHorizontal: sizing.itemPaddingHorizontal,
            paddingVertical: sizing.itemPaddingVertical,
            minWidth: sizing.itemMinSize,
            minHeight: sizing.itemMinSize,
            borderRadius: sizing.itemBorderRadius,
          },
        ]}
        onPress={() => onToggle(item.id)}
      >
        <LessonItemCharacter
          item={item}
          isSelected={isSelected}
          theme={theme}
          sizing={sizing}
        />
      </TouchableOpacity>
    );
  }
);

LessonItem.displayName = "LessonItem";

const SectionHeader = React.memo(
  ({
    title,
    isAllSelected,
    onToggleSection,
  }: {
    title: string;
    isAllSelected: boolean;
    onToggleSection: () => void;
  }) => {
    const { theme } = useTheme();

    return (
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
          {title}
        </Text>
        <TouchableOpacity
          style={[
            styles.selectAllContainer,
            { borderColor: getSubjectTypeColor("radical") },
          ]}
          onPress={onToggleSection}
        >
          <Text
            style={[
              styles.selectAllText,
              { color: getSubjectTypeColor("radical") },
            ]}
          >
            {isAllSelected ? "Deselect All" : "Select All"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }
);

SectionHeader.displayName = "SectionHeader";

const LessonGroup = React.memo(
  ({
    title,
    items,
    selectedItems,
    onToggleItem,
    onToggleSection,
    isLast,
    sizing,
  }: {
    title: string;
    items: LessonPickerItem[];
    selectedItems: Set<number>;
    onToggleItem: (id: number) => void;
    onToggleSection: (items: LessonPickerItem[]) => void;
    isLast: boolean;
    sizing: SubjectIconSizing;
  }) => {
    const { theme } = useTheme();

    const handleToggleSection = useCallback(
      () => onToggleSection(items),
      [items, onToggleSection]
    );

    if (items.length === 0) return null;

    const allSelected = items.every((item) => selectedItems.has(item.id));

    return (
      <View style={[styles.section, isLast && styles.lastSection]}>
        <SectionHeader
          title={title}
          isAllSelected={allSelected}
          onToggleSection={handleToggleSection}
        />
        <View style={[styles.itemsContainer, { gap: sizing.itemGap }]}>
          {items.map((item) => (
            <LessonItem
              key={item.id}
              item={item}
              isSelected={selectedItems.has(item.id)}
              onToggle={onToggleItem}
              sizing={sizing}
            />
          ))}
        </View>
        {!isLast && (
          <View
            style={[styles.sectionDivider, { backgroundColor: theme.border }]}
          />
        )}
      </View>
    );
  }
);

LessonGroup.displayName = "LessonGroup";

const LevelSection = React.memo(
  ({
    section,
    selectedItems,
    onToggleItem,
    onToggleSection,
    sizing,
  }: {
    section: LevelSectionData;
    selectedItems: Set<number>;
    onToggleItem: (id: number) => void;
    onToggleSection: (items: LessonPickerItem[]) => void;
    sizing: SubjectIconSizing;
  }) => {
    const { theme } = useTheme();
    const sections = [
      { title: "Radicals", items: section.radicals },
      { title: "Kanji", items: section.kanji },
      { title: "Vocabulary", items: section.vocabulary },
    ].filter((s) => s.items.length > 0);

    return (
      <View style={styles.levelSection}>
        <Text style={[styles.levelTitle, { color: theme.textSecondary }]}>
          Level {section.level}
        </Text>
        <View
          style={[
            styles.levelCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          {sections.map((s, index) => (
            <LessonGroup
              key={s.title}
              title={s.title}
              items={s.items}
              selectedItems={selectedItems}
              onToggleItem={onToggleItem}
              onToggleSection={onToggleSection}
              isLast={index === sections.length - 1}
              sizing={sizing}
            />
          ))}
        </View>
      </View>
    );
  }
);

LevelSection.displayName = "LevelSection";

export default function LessonPicker({
  lessons,
  onStart,
  onCancel,
}: LessonPickerProps) {
  const { theme } = useTheme();
  const lessonPickerViewMode = useSettingsStore(
    (state) => state.lessonPickerViewMode
  );
  const { width: screenWidth } = useWindowDimensions();
  const iconSizing = useMemo(
    () => getResponsiveSubjectIconSizing(screenWidth),
    [screenWidth]
  );
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedLevels, setCollapsedLevels] = useState<Set<number>>(new Set());
  const [isBookmarkModalVisible, setIsBookmarkModalVisible] = useState(false);
  const [showListPickerModal, setShowListPickerModal] = useState(false);
  const [availableLists, setAvailableLists] = useState<SubjectList[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [listLoadError, setListLoadError] = useState<string | null>(null);

  // Filter lessons based on search query
  const filteredLessons = useMemo(() => {
    const query = searchQuery.trim();
    if (!query) {
      return lessons;
    }

    const searchableLessons = lessons.map((lesson) => ({
      id: lesson.id,
      object: lesson.subject.object,
      data: {
        level: lesson.subject.data.level,
        characters: lesson.subject.data.characters,
        meanings: lesson.subject.data.meanings,
        readings: lesson.subject.data.readings ?? null,
      },
      lesson,
    }));

    return rankSubjectsByQuery(searchableLessons, query).map(
      ({ subject }) => subject.lesson
    );
  }, [lessons, searchQuery]);

  // Organize lessons by level and type
  const levelSections = useMemo(() => {
    const sections: { [level: number]: LevelSectionData } = {};

    filteredLessons.forEach((lesson) => {
      const level = lesson.subject.data.level;
      if (!sections[level]) {
        sections[level] = {
          level,
          radicals: [],
          kanji: [],
          vocabulary: [],
        };
      }

      const type = lesson.subject.object;
      if (type === "radical") {
        sections[level].radicals.push(lesson);
      } else if (type === "kanji") {
        sections[level].kanji.push(lesson);
      } else if (type === "vocabulary" || type === "kana_vocabulary") {
        sections[level].vocabulary.push(lesson);
      }
    });

    return Object.values(sections).sort((a, b) => a.level - b.level);
  }, [filteredLessons]);

  useEffect(() => {
    setCollapsedLevels((previousLevels) => {
      const availableLevels = new Set(levelSections.map((section) => section.level));
      const nextLevels = new Set(
        [...previousLevels].filter((level) => availableLevels.has(level))
      );

      if (nextLevels.size === previousLevels.size) {
        return previousLevels;
      }

      return nextLevels;
    });
  }, [levelSections]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }
    setCollapsedLevels(new Set());
  }, [searchQuery]);

  const getLessonIdsForListIds = useCallback(
    (listIds: string[]) => {
      const selectedListIdSet = new Set(listIds);
      const subjectIds = new Set<number>();

      availableLists.forEach((list) => {
        if (!selectedListIdSet.has(list.id)) {
          return;
        }

        list.subjectIds.forEach((subjectId) => subjectIds.add(subjectId));
      });

      const lessonIds = new Set<number>();
      lessons.forEach((lesson) => {
        if (subjectIds.has(lesson.subjectId)) {
          lessonIds.add(lesson.id);
        }
      });

      return lessonIds;
    },
    [availableLists, lessons]
  );

  const loadAvailableLists = useCallback(async () => {
    setIsLoadingLists(true);
    setListLoadError(null);

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
          setSelectedListIds((prev) =>
            prev.filter((id) => syncedIds.has(id))
          );
        } catch (syncError) {
          console.warn(
            "Failed to refresh lesson picker lists after sync:",
            syncError
          );
        }
      })();
    } catch (error) {
      console.error("Failed to load lesson picker subject lists:", error);
      setAvailableLists([]);
      setListLoadError("Failed to load your lists.");
    } finally {
      setIsLoadingLists(false);
    }
  }, []);

  useEffect(() => {
    if (!showListPickerModal) {
      return;
    }

    loadAvailableLists();
  }, [loadAvailableLists, showListPickerModal]);

  const toggleItem = useCallback((itemId: number) => {
    setSelectedItems((prev) => {
      const newSelected = new Set(prev);
      if (newSelected.has(itemId)) {
        newSelected.delete(itemId);
      } else {
        newSelected.add(itemId);
      }
      return newSelected;
    });
  }, []);

  const toggleListSelection = useCallback(
    (listId: string) => {
      const previousListIds = selectedListIds;
      const nextListIdSet = new Set(previousListIds);
      const isRemovingList = nextListIdSet.has(listId);

      if (isRemovingList) {
        nextListIdSet.delete(listId);
      } else {
        nextListIdSet.add(listId);
      }

      const nextListIds = Array.from(nextListIdSet.values());
      const previouslyListSelectedLessonIds =
        getLessonIdsForListIds(previousListIds);
      const nextListSelectedLessonIds = getLessonIdsForListIds(nextListIds);

      setSelectedListIds(nextListIds);
      setSelectedItems((prev) => {
        const next = new Set(prev);

        if (isRemovingList) {
          previouslyListSelectedLessonIds.forEach((lessonId) => {
            if (!nextListSelectedLessonIds.has(lessonId)) {
              next.delete(lessonId);
            }
          });
        } else {
          nextListSelectedLessonIds.forEach((lessonId) => next.add(lessonId));
        }

        return next;
      });
    },
    [getLessonIdsForListIds, selectedListIds]
  );

  const toggleSection = useCallback((items: LessonPickerItem[]) => {
    const itemIds = items.map((item) => item.id);
    setSelectedItems((prev) => {
      const allSelected = itemIds.every((id) => prev.has(id));
      const newSelected = new Set(prev);

      if (allSelected) {
        itemIds.forEach((id) => newSelected.delete(id));
      } else {
        itemIds.forEach((id) => newSelected.add(id));
      }
      return newSelected;
    });
  }, []);

  const toggleLevelCollapsed = useCallback((level: number) => {
    setCollapsedLevels((previousLevels) => {
      const nextLevels = new Set(previousLevels);
      if (nextLevels.has(level)) {
        nextLevels.delete(level);
      } else {
        nextLevels.add(level);
      }
      return nextLevels;
    });
  }, []);

  const toggleAllLessons = useCallback(() => {
    // Check if ALL filtered lessons are selected
    const allFilteredSelected = filteredLessons.every((lesson) =>
      selectedItems.has(lesson.id)
    );

    if (allFilteredSelected) {
      // Deselect all filtered
      const newSelected = new Set(selectedItems);
      filteredLessons.forEach((lesson) => newSelected.delete(lesson.id));
      setSelectedItems(newSelected);
    } else {
      // Select all filtered
      const newSelected = new Set(selectedItems);
      filteredLessons.forEach((lesson) => newSelected.add(lesson.id));
      setSelectedItems(newSelected);
    }
  }, [filteredLessons, selectedItems]);

  const getSelectedLessons = () => {
    return lessons.filter((lesson) => selectedItems.has(lesson.id));
  };

  const selectedLessons = getSelectedLessons();
  const selectedLessonSubjectIds = selectedLessons.map(
    (lesson) => lesson.subjectId
  );

  const selectedListLessonCount = useMemo(() => {
    const listLessonIds = getLessonIdsForListIds(selectedListIds);
    return [...listLessonIds].filter((lessonId) => selectedItems.has(lessonId))
      .length;
  }, [getLessonIdsForListIds, selectedItems, selectedListIds]);

  const availableLessonCountByListId = useMemo(() => {
    const lessonSubjectIds = new Set(lessons.map((lesson) => lesson.subjectId));
    const counts = new Map<string, number>();

    availableLists.forEach((list) => {
      const availableSubjectIds = new Set(
        list.subjectIds.filter((subjectId) => lessonSubjectIds.has(subjectId))
      );
      counts.set(list.id, availableSubjectIds.size);
    });

    return counts;
  }, [availableLists, lessons]);

  const renderLevelSection = useCallback(
    ({ item }: { item: LevelSectionData }) => (
      <View style={styles.levelSectionContainer}>
        <LevelSection
          section={item}
          selectedItems={selectedItems}
          onToggleItem={toggleItem}
          onToggleSection={toggleSection}
          sizing={iconSizing}
        />
      </View>
    ),
    [iconSizing, selectedItems, toggleItem, toggleSection]
  );

  const listModeData = useMemo<LessonListDataItem[]>(() => {
    const data: LessonListDataItem[] = [];

    levelSections.forEach((section) => {
      const combinedLevelLessons = sortLessonsForList([
        ...section.radicals,
        ...section.kanji,
        ...section.vocabulary,
      ]);

      data.push({
        id: `level-${section.level}`,
        type: "level-header",
        level: section.level,
        lessons: combinedLevelLessons,
      });

      if (!collapsedLevels.has(section.level)) {
        combinedLevelLessons.forEach((lesson) => {
          data.push({
            id: `lesson-${section.level}-${lesson.id}`,
            type: "lesson-row",
            lesson,
          });
        });
      }
    });

    return data;
  }, [collapsedLevels, levelSections]);

  const renderListModeItem = useCallback(
    ({ item }: { item: LessonListDataItem }) => {
      if (item.type === "level-header") {
        const selectedCount = item.lessons.filter((lesson) =>
          selectedItems.has(lesson.id)
        ).length;
        const hasLessons = item.lessons.length > 0;
        const isAllSelected = hasLessons && selectedCount === item.lessons.length;
        const isCollapsed = collapsedLevels.has(item.level);

        return (
          <View
            style={[
              styles.listLevelHeader,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <TouchableOpacity
              style={styles.listLevelHeaderLeft}
              onPress={() => toggleLevelCollapsed(item.level)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isCollapsed ? "chevron-forward" : "chevron-down"}
                size={18}
                color={theme.textSecondary}
              />
              <Text style={[styles.listLevelTitle, { color: theme.textColor }]}>
                Level {item.level}
              </Text>
              <Text
                style={[styles.listLevelMeta, { color: theme.textSecondary }]}
              >
                {item.lessons.length} lesson{item.lessons.length === 1 ? "" : "s"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.listLevelSelectAllButton,
                { borderColor: getSubjectTypeColor("radical") },
              ]}
              onPress={() => toggleSection(item.lessons)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.listLevelSelectAllText,
                  { color: getSubjectTypeColor("radical") },
                ]}
              >
                {isAllSelected ? "Deselect All" : "Select All"}
              </Text>
            </TouchableOpacity>
          </View>
        );
      }

      const lesson = item.lesson;
      const isSelected = selectedItems.has(lesson.id);
      const primaryReading = getPrimaryReading(lesson);
      const typeColor = getTypeColor(lesson.subject.object, theme);
      const characters = lesson.subject.data.characters || "";

      return (
        <TouchableOpacity
          style={[
            styles.listLessonRow,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onPress={() => toggleItem(lesson.id)}
          activeOpacity={0.7}
        >
          <View
            style={[
              styles.listLessonCharacterBox,
              { backgroundColor: typeColor },
              (lesson.subject.object === "vocabulary" ||
                lesson.subject.object === "kana_vocabulary") &&
                characters.length > 1 && {
                  width: 48 + (characters.length - 2) * 24 + 16,
                },
            ]}
          >
            <LessonItemCharacter
              item={lesson}
              isSelected
              theme={theme}
              sizing={LIST_SUBJECT_ICON_SIZING}
            />
          </View>
          <View style={styles.listLessonDetails}>
            <Text style={[styles.listLessonMeaning, { color: theme.textColor }]}>
              {getPrimaryMeaning(lesson)}
            </Text>
            <View style={styles.listLessonMetaRow}>
              <Text style={[styles.listLessonType, { color: theme.textSecondary }]}>
                {lesson.subject.object === "kana_vocabulary"
                  ? "Kana Vocab"
                  : lesson.subject.object.charAt(0).toUpperCase() +
                    lesson.subject.object.slice(1)}
              </Text>
              {primaryReading ? (
                <Text
                  style={[
                    styles.listLessonReading,
                    { color: theme.textSecondary },
                  ]}
                >
                  {primaryReading}
                </Text>
              ) : null}
            </View>
          </View>
          <Ionicons
            name={isSelected ? "checkmark-circle" : "ellipse-outline"}
            size={22}
            color={isSelected ? getSubjectTypeColor("kanji") : theme.textLight}
          />
        </TouchableOpacity>
      );
    },
    [
      collapsedLevels,
      selectedItems,
      theme,
      toggleItem,
      toggleLevelCollapsed,
      toggleSection,
    ]
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <StatusBar style={theme.statusBarStyle} />

      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.headerBackground,
          },
        ]}
      >
        <View style={styles.headerOverlay} />
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={onCancel} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={theme.headerText} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.headerText }]}>
            Choose Lessons
          </Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.headerIconButton,
                {
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderColor: "rgba(255, 255, 255, 0.2)",
                },
              ]}
              onPress={() => setShowListPickerModal(true)}
              activeOpacity={0.75}
            >
              <Ionicons name="list" size={18} color={theme.headerText} />
              {selectedListIds.length > 0 ? (
                <View style={styles.headerBadge}>
                  <Text style={styles.headerBadgeText}>
                    {selectedListIds.length}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.globalSelectAllButton,
                {
                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                  borderColor: "rgba(255, 255, 255, 0.2)",
                },
              ]}
              onPress={toggleAllLessons}
              activeOpacity={0.75}
            >
              <Text
                style={[styles.globalSelectAllText, { color: theme.headerText }]}
                numberOfLines={1}
              >
                {filteredLessons.length > 0 &&
                filteredLessons.every((lesson) => selectedItems.has(lesson.id))
                  ? "Deselect"
                  : "Select All"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={[
            styles.searchContainer,
            { backgroundColor: "rgba(255, 255, 255, 0.1)" },
          ]}
        >
          <Ionicons
            name="search"
            size={20}
            color={theme.headerText}
            style={styles.searchIcon}
          />
          <TextInput
            style={[styles.searchInput, { color: theme.headerText }]}
            placeholder="Search by meaning or characters..."
            placeholderTextColor="rgba(255, 255, 255, 0.7)"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              style={styles.clearButton}
            >
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.headerText}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.listContainer}>
        {lessonPickerViewMode === "cards" ? (
          <FlashList
            data={levelSections}
            renderItem={renderLevelSection}
            extraData={selectedItems}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlashList
            data={listModeData}
            renderItem={renderListModeItem}
            extraData={selectedItems}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={[
              styles.bookmarkButton,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
                opacity: selectedItems.size === 0 ? 0.5 : 1,
              },
            ]}
            onPress={() => setIsBookmarkModalVisible(true)}
            disabled={selectedItems.size === 0}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Bookmark selected lessons"
          >
            <Ionicons
              name="bookmark-outline"
              size={21}
              color={
                selectedItems.size > 0
                  ? getSubjectTypeColor("kanji")
                : theme.textSecondary
              }
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.startButton,
              {
                backgroundColor:
                  selectedItems.size > 0
                    ? getSubjectTypeColor("kanji")
                    : theme.textSecondary,
              },
            ]}
            onPress={() => onStart(getSelectedLessons())}
            disabled={selectedItems.size === 0}
          >
            <Text
              style={styles.startButtonText}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.82}
            >
              Start {selectedItems.size} Lesson
              {selectedItems.size !== 1 ? "s" : ""}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showListPickerModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowListPickerModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.textColor }]}>
                Load Subject List
              </Text>
              <TouchableOpacity
                onPress={() => setShowListPickerModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            {isLoadingLists ? (
              <View style={styles.modalStateContainer}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            ) : listLoadError ? (
              <Text style={[styles.modalStateText, { color: theme.error }]}>
                {listLoadError}
              </Text>
            ) : availableLists.length === 0 ? (
              <Text
                style={[styles.modalStateText, { color: theme.textSecondary }]}
              >
                No subject lists yet.
              </Text>
            ) : (
              <ScrollView style={styles.modalList}>
                {availableLists.map((list) => {
                  const isSelected = selectedListIds.includes(list.id);
                  const availableLessonCount =
                    availableLessonCountByListId.get(list.id) ?? 0;

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
                      activeOpacity={0.75}
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
                          style={[
                            styles.modalListItemMeta,
                            { color: theme.textSecondary },
                          ]}
                        >
                          {availableLessonCount} available lesson
                          {availableLessonCount === 1 ? "" : "s"}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            <View style={styles.modalFooter}>
              <Text
                style={[styles.modalFooterText, { color: theme.textSecondary }]}
              >
                {selectedListIds.length === 0
                  ? "No subject list selected."
                  : `${selectedListIds.length} list${
                      selectedListIds.length === 1 ? "" : "s"
                    } selected • ${selectedListLessonCount} lessons selected.`}
              </Text>
              <TouchableOpacity
                style={[
                  styles.modalDoneButton,
                  { backgroundColor: theme.primary },
                ]}
                onPress={() => setShowListPickerModal(false)}
              >
                <Text style={styles.modalDoneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AddToSubjectListsModal
        visible={isBookmarkModalVisible}
        subjectIds={selectedLessonSubjectIds}
        subjectLabel={`${selectedItems.size} selected lessons`}
        onClose={() => setIsBookmarkModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    position: "relative",
    zIndex: 10,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  headerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  backButton: {
    padding: 8,
    width: 44,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    flex: 1,
    textAlign: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconButton: {
    width: 36,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 1,
  },
  headerBadge: {
    position: "absolute",
    top: -5,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  headerBadgeText: {
    color: "#111827",
    fontSize: 10,
    fontWeight: "800",
  },
  globalSelectAllButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    width: 74,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
    borderWidth: 1,
  },
  globalSelectAllText: {
    fontSize: 12,
    fontWeight: "bold",
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
    textAlign: "center",
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  levelSection: {
    marginBottom: 24,
  },
  levelSectionContainer: {
    marginBottom: 24,
  },
  levelTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  levelCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  section: {
    marginBottom: 20,
  },
  lastSection: {
    marginBottom: 0,
  },
  sectionDivider: {
    height: 1,
    marginTop: 16,
    marginHorizontal: -4,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  selectAllContainer: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "transparent",
  },
  selectAllText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  itemsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  lessonItem: {
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  lessonItemText: {
    textAlign: "center",
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  footerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bookmarkButton: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
  },
  startButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  startButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  clearButton: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "82%",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalCloseButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
  },
  modalStateContainer: {
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  modalStateText: {
    paddingVertical: 28,
    fontSize: 14,
    textAlign: "center",
  },
  modalList: {
    maxHeight: 360,
  },
  modalListItem: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  modalListItemText: {
    flex: 1,
    marginLeft: 10,
  },
  modalListItemTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  modalListItemMeta: {
    marginTop: 2,
    fontSize: 12,
  },
  modalFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
  },
  modalFooterText: {
    flex: 1,
    fontSize: 13,
  },
  modalDoneButton: {
    minWidth: 88,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  modalDoneButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  listLevelHeader: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  listLevelHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  listLevelTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 6,
  },
  listLevelMeta: {
    fontSize: 13,
    marginLeft: 8,
  },
  listLevelSelectAllButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  listLevelSelectAllText: {
    fontSize: 12,
    fontWeight: "700",
  },
  listLessonRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    marginLeft: 10,
  },
  listLessonCharacterBox: {
    width: 48,
    height: 48,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  listLessonDetails: {
    flex: 1,
  },
  listLessonMeaning: {
    fontSize: 16,
    fontWeight: "700",
  },
  listLessonMetaRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  listLessonType: {
    fontSize: 12,
    marginRight: 8,
  },
  listLessonReading: {
    fontSize: 12,
  },
});
