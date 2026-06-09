import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../utils/theme";
import {
  addSubjectsToLists,
  createSubjectList,
  getListIdsContainingSubject,
  getSubjectLists,
  setSubjectMembershipForLists,
  SubjectList,
  syncSubjectListsNow,
} from "../utils/subjectLists";

interface AddToSubjectListsModalProps {
  visible: boolean;
  subjectId?: number;
  subjectIds?: number[];
  subjectType?: string;
  subjectLabel?: string;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
}

export default function AddToSubjectListsModal({
  visible,
  subjectId,
  subjectIds,
  subjectType,
  subjectLabel,
  onClose,
  onSaved,
}: AddToSubjectListsModalProps) {
  const { theme } = useTheme();
  const [lists, setLists] = useState<SubjectList[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targetSubjectIds = useMemo(() => {
    const rawIds = Array.isArray(subjectIds) && subjectIds.length > 0 ? subjectIds : [subjectId];
    const seen = new Set<number>();
    const normalized: number[] = [];
    rawIds.forEach((value) => {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return;
      }
      const id = Math.trunc(value);
      if (id <= 0 || seen.has(id)) {
        return;
      }
      seen.add(id);
      normalized.push(id);
    });
    return normalized;
  }, [subjectId, subjectIds]);
  const isBulkMode = targetSubjectIds.length > 1;
  const singleSubjectId = targetSubjectIds[0];

  const subtitle = useMemo(() => {
    if (subjectLabel && subjectType) {
      return `${subjectLabel} (${subjectType})`;
    }
    if (subjectLabel) {
      return subjectLabel;
    }
    if (isBulkMode) {
      return `${targetSubjectIds.length} subjects`;
    }
    if (subjectType) {
      return subjectType;
    }
    if (singleSubjectId) {
      return `Subject #${singleSubjectId}`;
    }
    return "No subjects selected";
  }, [
    isBulkMode,
    singleSubjectId,
    subjectLabel,
    subjectType,
    targetSubjectIds.length,
  ]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [allLists, listIdsContainingSubject] = await Promise.all([
        getSubjectLists(),
        !isBulkMode && singleSubjectId
          ? getListIdsContainingSubject(singleSubjectId)
          : Promise.resolve([]),
      ]);
      setLists(allLists);
      setSelectedListIds(new Set(listIdsContainingSubject));

      // Pull remote updates immediately so this modal reflects latest state.
      void (async () => {
        try {
          await syncSubjectListsNow();
          const syncedLists = await getSubjectLists();
          setLists(syncedLists);
        } catch (syncError) {
          console.warn("Failed to refresh AddToSubjectLists modal after sync:", syncError);
        }
      })();
    } catch (err) {
      console.error("Failed to load subject list modal data:", err);
      setError("Failed to load your lists.");
    } finally {
      setIsLoading(false);
    }
  }, [isBulkMode, singleSubjectId]);

  useEffect(() => {
    if (!visible) {
      return;
    }
    loadData();
  }, [loadData, visible]);

  const toggleList = (listId: string) => {
    setSelectedListIds((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) {
        next.delete(listId);
      } else {
        next.add(listId);
      }
      return next;
    });
  };

  const handleCreateList = async () => {
    const name = newListName.trim();
    if (!name) {
      return;
    }

    try {
      setIsCreatingList(true);
      const created = await createSubjectList(
        name,
        isBulkMode ? targetSubjectIds : []
      );
      setNewListName("");
      setLists((prev) => [created, ...prev]);
      setSelectedListIds((prev) => {
        const next = new Set(prev);
        next.add(created.id);
        return next;
      });
    } catch (err) {
      console.error("Failed to create subject list:", err);
      setError("Failed to create the list.");
    } finally {
      setIsCreatingList(false);
    }
  };

  const handleSave = async () => {
    const selectedListIdArray = Array.from(selectedListIds.values());
    if (targetSubjectIds.length === 0) {
      setError("No subjects selected.");
      return;
    }
    if (isBulkMode && selectedListIdArray.length === 0) {
      setError("Select at least one list.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      if (isBulkMode) {
        await addSubjectsToLists(selectedListIdArray, targetSubjectIds);
      } else {
        if (!singleSubjectId) {
          setError("No subject selected.");
          return;
        }
        await setSubjectMembershipForLists(singleSubjectId, selectedListIdArray);
      }
      if (onSaved) {
        await onSaved();
      }
      onClose();
    } catch (err) {
      console.error("Failed to save list membership:", err);
      setError("Failed to save list changes.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Close add to lists modal"
          accessibilityRole="button"
          style={styles.backdropPressable}
          onPress={onClose}
        />
        <View
          style={[
            styles.container,
            { backgroundColor: theme.cardBackground, borderColor: theme.border },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.title, { color: theme.textColor }]}>
                Add to Lists
              </Text>
              <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                {subtitle}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.createRow}>
            <TextInput
              style={[
                styles.input,
                {
                  color: theme.textColor,
                  borderColor: theme.border,
                  backgroundColor: theme.backgroundColor,
                },
              ]}
              placeholder="Create new list"
              placeholderTextColor={theme.textLight}
              value={newListName}
              onChangeText={setNewListName}
              onSubmitEditing={handleCreateList}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[
                styles.createButton,
                {
                  backgroundColor: theme.primary,
                  opacity:
                    newListName.trim().length === 0 || isCreatingList ? 0.6 : 1,
                },
              ]}
              disabled={newListName.trim().length === 0 || isCreatingList}
              onPress={handleCreateList}
            >
              {isCreatingList ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="add" size={20} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.stateContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : (
            <ScrollView style={styles.listContainer}>
              {lists.length === 0 ? (
                <View style={styles.stateContainer}>
                  <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                    No lists yet. Create your first one above.
                  </Text>
                </View>
              ) : (
                lists.map((list) => {
                  const isSelected = selectedListIds.has(list.id);
                  return (
                    <TouchableOpacity
                      key={list.id}
                      style={[
                        styles.listRow,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.backgroundColor,
                        },
                        isSelected && {
                          borderColor: theme.primary,
                          backgroundColor: `${theme.primary}18`,
                        },
                      ]}
                      onPress={() => toggleList(list.id)}
                      activeOpacity={0.75}
                    >
                      <View style={styles.listMeta}>
                        <Text style={[styles.listName, { color: theme.textColor }]}>
                          {list.name}
                        </Text>
                        <Text
                          style={[styles.listCount, { color: theme.textSecondary }]}
                        >
                          {list.subjectIds.length} item
                          {list.subjectIds.length === 1 ? "" : "s"}
                        </Text>
                      </View>
                      <Ionicons
                        name={isSelected ? "checkbox" : "square-outline"}
                        size={22}
                        color={isSelected ? theme.primary : theme.textSecondary}
                      />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}

          {!!error && (
            <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          )}

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.footerButton, { borderColor: theme.border }]}
              onPress={onClose}
              disabled={isSaving}
            >
              <Text style={[styles.footerButtonText, { color: theme.textColor }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.footerButton,
                styles.footerSaveButton,
                { backgroundColor: theme.primary, opacity: isSaving ? 0.7 : 1 },
              ]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.footerSaveButtonText}>
                  {isBulkMode ? "Add All" : "Save"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropPressable: {
    ...StyleSheet.absoluteFill,
  },
  container: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
    maxHeight: "82%",
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
  },
  createRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  createButton: {
    width: 42,
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  listContainer: {
    maxHeight: 360,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  listMeta: {
    flex: 1,
    marginRight: 10,
  },
  listName: {
    fontSize: 15,
    fontWeight: "600",
  },
  listCount: {
    marginTop: 2,
    fontSize: 12,
  },
  stateContainer: {
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  errorText: {
    fontSize: 13,
    marginTop: 8,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 14,
  },
  footerButton: {
    minWidth: 92,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  footerButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  footerSaveButton: {
    borderWidth: 0,
  },
  footerSaveButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
});
