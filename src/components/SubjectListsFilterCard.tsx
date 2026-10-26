import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router/react-navigation";
import { router } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { WaniKaniItemType } from "../types/wanikani";
import { getAllSubjects } from "../utils/cache";
import { useTheme } from "../utils/theme";
import { getSubjectLists, SubjectList, syncSubjectListsNow } from "../utils/subjectLists";

interface SubjectListsFilterCardProps {
  selectedListIds: string[];
  onChange: (listIds: string[]) => void;
  title?: string;
  description?: string;
  allowEmptySelection?: boolean;
  subjectTypes?: WaniKaniItemType[];
}

function getCountUnit(subjectTypes?: WaniKaniItemType[]): {
  singular: string;
  plural: string;
} {
  if (!subjectTypes || subjectTypes.length === 0) {
    return { singular: "subject", plural: "subjects" };
  }

  const typeSet = new Set(subjectTypes);
  if (typeSet.size === 1) {
    const onlyType = Array.from(typeSet.values())[0];
    switch (onlyType) {
      case "radical":
        return { singular: "radical", plural: "radicals" };
      case "kanji":
        return { singular: "kanji", plural: "kanji" };
      case "vocabulary":
        return { singular: "vocabulary", plural: "vocabulary" };
      case "kana_vocabulary":
        return { singular: "kana vocab", plural: "kana vocab" };
      default:
        return { singular: "subject", plural: "subjects" };
    }
  }

  if (
    typeSet.size === 2 &&
    typeSet.has("vocabulary") &&
    typeSet.has("kana_vocabulary")
  ) {
    return { singular: "vocabulary", plural: "vocabulary" };
  }

  return { singular: "subject", plural: "subjects" };
}

export default function SubjectListsFilterCard({
  selectedListIds,
  onChange,
  title = "Subject Lists",
  description = "Optional: limit this mode to one or more saved lists.",
  allowEmptySelection = true,
  subjectTypes,
}: SubjectListsFilterCardProps) {
  const { theme } = useTheme();
  const [lists, setLists] = useState<SubjectList[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [subjectTypeMap, setSubjectTypeMap] = useState<Map<number, WaniKaniItemType>>(
    new Map()
  );

  const relevantTypeSet = useMemo(() => {
    if (!subjectTypes || subjectTypes.length === 0) {
      return null;
    }
    return new Set(subjectTypes);
  }, [subjectTypes]);

  const countUnit = useMemo(() => getCountUnit(subjectTypes), [subjectTypes]);

  const loadLists = useCallback(async () => {
    setIsLoading(true);
    try {
      const loaded = await getSubjectLists();
      setLists(loaded);

      const validIds = new Set(loaded.map((list) => list.id));
      const filteredSelection = selectedListIds.filter((id) => validIds.has(id));
      if (filteredSelection.length !== selectedListIds.length) {
        onChange(filteredSelection);
      }

      // Revalidate immediately so remote edits from other devices appear
      // while this card is still open.
      void (async () => {
        try {
          await syncSubjectListsNow();
          const synced = await getSubjectLists();
          setLists(synced);

          const syncedIds = new Set(synced.map((list) => list.id));
          const nextSelection = selectedListIds.filter((id) => syncedIds.has(id));
          if (nextSelection.length !== selectedListIds.length) {
            onChange(nextSelection);
          }
        } catch (syncError) {
          console.warn("Failed to refresh subject lists filter after sync:", syncError);
        }
      })();
    } catch (error) {
      console.error("Failed to load lists for filter card:", error);
      setLists([]);
    } finally {
      setIsLoading(false);
    }
  }, [onChange, selectedListIds]);

  const loadSubjectTypes = useCallback(async () => {
    try {
      const subjects = await getAllSubjects();
      if (!subjects || subjects.length === 0) {
        setSubjectTypeMap(new Map());
        return;
      }

      const nextMap = new Map<number, WaniKaniItemType>();
      subjects.forEach((subject) => {
        nextMap.set(subject.id, subject.object as WaniKaniItemType);
      });
      setSubjectTypeMap(nextMap);
    } catch (error) {
      console.warn("Failed to load subjects for list-count filtering:", error);
      setSubjectTypeMap(new Map());
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadLists();
      loadSubjectTypes();
    }, [loadLists, loadSubjectTypes])
  );

  const selectedSet = useMemo(
    () => new Set(selectedListIds),
    [selectedListIds]
  );

  const countListSubjects = useCallback(
    (list: SubjectList) => {
      if (!relevantTypeSet || subjectTypeMap.size === 0) {
        return list.subjectIds.length;
      }

      let count = 0;
      list.subjectIds.forEach((subjectId) => {
        const type = subjectTypeMap.get(subjectId);
        if (type && relevantTypeSet.has(type)) {
          count += 1;
        }
      });
      return count;
    },
    [relevantTypeSet, subjectTypeMap]
  );

  const listCountMap = useMemo(() => {
    const entries = lists.map((list) => [list.id, countListSubjects(list)] as const);
    return new Map(entries);
  }, [countListSubjects, lists]);

  const selectedSubjectCount = useMemo(() => {
    if (selectedSet.size === 0) return 0;
    const set = new Set<number>();
    lists.forEach((list) => {
      if (!selectedSet.has(list.id)) return;
      list.subjectIds.forEach((id) => {
        if (!relevantTypeSet || subjectTypeMap.size === 0) {
          set.add(id);
          return;
        }
        const type = subjectTypeMap.get(id);
        if (type && relevantTypeSet.has(type)) {
          set.add(id);
        }
      });
    });
    return set.size;
  }, [lists, relevantTypeSet, selectedSet, subjectTypeMap]);

  const toggle = (listId: string) => {
    const next = new Set(selectedSet);
    if (next.has(listId)) {
      next.delete(listId);
    } else {
      next.add(listId);
    }
    if (!allowEmptySelection && next.size === 0) {
      return;
    }
    onChange(Array.from(next.values()));
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: theme.textColor }]}>{title}</Text>
          <Text style={[styles.description, { color: theme.textSecondary }]}>
            {description}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.manageButton, { borderColor: theme.border }]}
          onPress={() => router.push("/subject-lists")}
        >
          <Ionicons name="list" size={16} color={theme.textSecondary} />
          <Text style={[styles.manageButtonText, { color: theme.textSecondary }]}>
            Manage
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <Text style={[styles.stateText, { color: theme.textSecondary }]}>
          Loading lists...
        </Text>
      ) : lists.length === 0 ? (
        <Text style={[styles.stateText, { color: theme.textSecondary }]}>
          No lists yet. Create one from Manage.
        </Text>
      ) : (
        <View style={styles.optionsColumn}>
          {lists.map((list) => {
            const isSelected = selectedSet.has(list.id);
            const count = listCountMap.get(list.id) ?? 0;
            return (
              <TouchableOpacity
                key={list.id}
                style={[
                  styles.optionRow,
                  {
                    borderColor: isSelected ? theme.primary : theme.border,
                    backgroundColor: isSelected
                      ? `${theme.primary}15`
                      : theme.backgroundColor,
                  },
                ]}
                onPress={() => toggle(list.id)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.optionIndicator,
                    {
                      backgroundColor: isSelected
                        ? theme.primary
                        : theme.backgroundColor,
                      borderColor: isSelected ? theme.primary : theme.border,
                    },
                  ]}
                >
                  {isSelected ? (
                    <Ionicons name="checkmark" size={12} color="#fff" />
                  ) : null}
                </View>
                <View style={styles.optionContent}>
                  <Text
                    style={[
                      styles.optionTitle,
                      { color: isSelected ? theme.primary : theme.textColor },
                    ]}
                    numberOfLines={1}
                  >
                    {list.name}
                  </Text>
                  <Text style={[styles.optionMeta, { color: theme.textSecondary }]}>
                    {count} {count === 1 ? countUnit.singular : countUnit.plural}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.optionTrailingCount,
                    { color: isSelected ? theme.primary : theme.textSecondary },
                  ]}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      <Text style={[styles.footerText, { color: theme.textSecondary }]}>
        {selectedSet.size === 0
          ? "Using all matching subjects."
          : `${selectedSet.size} list${
              selectedSet.size === 1 ? "" : "s"
            } selected • ${selectedSubjectCount} unique ${
              selectedSubjectCount === 1 ? countUnit.singular : countUnit.plural
            }.`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  description: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
  },
  manageButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  manageButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  stateText: {
    fontSize: 13,
    marginTop: 2,
  },
  optionsColumn: {
    gap: 8,
  },
  optionRow: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  optionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  optionMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  optionTrailingCount: {
    minWidth: 28,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "700",
  },
  footerText: {
    marginTop: 10,
    fontSize: 12,
  },
});
