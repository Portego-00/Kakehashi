import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router/react-navigation";
import { router } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GlassButton } from "../../src/components/GlassButton";
import { getAllSubjects } from "../../src/utils/cache";
import { getSubjectTypeColor } from "../../src/utils/subjectColors";
import { useTheme } from "../../src/utils/theme";
import {
  createSubjectList,
  deleteSubjectList,
  getSubjectLists,
  syncSubjectListsNow,
  SubjectList,
} from "../../src/utils/subjectLists";
const noListsIllustration = require("../../assets/images/NoLists.png");

function getItemTypeColor(itemType: string): string {
  if (itemType === "radical" || itemType === "kanji" || itemType === "vocabulary" || itemType === "kana_vocabulary") {
    return getSubjectTypeColor(itemType);
  }

  return "#64748b";
}

function getSubjectPreviewLabel(subject: any): string {
  const characters =
    typeof subject?.data?.characters === "string"
      ? subject.data.characters.trim()
      : "";
  if (characters) {
    return characters;
  }

  const meaning =
    typeof subject?.data?.meanings?.[0]?.meaning === "string"
      ? subject.data.meanings[0].meaning.trim()
      : "";
  return meaning ? meaning.slice(0, 2).toUpperCase() : "•";
}

function formatUpdatedAt(updatedAt: string): string {
  try {
    return new Date(updatedAt).toLocaleDateString();
  } catch {
    return "";
  }
}

export default function SubjectListsScreen() {
  const { theme } = useTheme();
  const [lists, setLists] = useState<SubjectList[]>([]);
  const [subjectsById, setSubjectsById] = useState<Map<number, any>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const openCreateModal = () => {
    setNewListName("");
    setIsCreateModalVisible(true);
  };

  const closeCreateModal = () => {
    setIsCreateModalVisible(false);
    setNewListName("");
  };

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const [loadedLists, cachedSubjects] = await Promise.all([
        getSubjectLists(),
        getAllSubjects(),
      ]);
      setLists(loadedLists);

      const nextSubjectsById = new Map<number, any>();
      if (Array.isArray(cachedSubjects)) {
        cachedSubjects.forEach((subject) => {
          if (subject?.id) {
            nextSubjectsById.set(subject.id, subject);
          }
        });
      }
      setSubjectsById(nextSubjectsById);

      // Keep UI cache-first, then refresh once cloud sync completes so
      // cross-device changes appear without leaving/re-entering the screen.
      void (async () => {
        try {
          await syncSubjectListsNow();
          const syncedLists = await getSubjectLists();
          setLists(syncedLists);
        } catch (syncError) {
          console.warn("Failed to refresh subject lists after sync:", syncError);
        }
      })();
    } catch (error) {
      console.error("Failed to load subject lists:", error);
      setLists([]);
      setSubjectsById(new Map());
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const handleCreate = async () => {
    const name = newListName.trim();
    if (!name) return;
    setIsCreating(true);
    try {
      const created = await createSubjectList(name);
      setNewListName("");
      setIsCreateModalVisible(false);
      await reload();
      router.push({
        pathname: "/subject-list/[id]",
        params: { id: created.id },
      });
    } catch (error) {
      console.error("Failed to create list:", error);
      Alert.alert("Error", "Failed to create list.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = (list: SubjectList) => {
    Alert.alert(
      "Delete List",
      `Delete "${list.name}"? This action cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteSubjectList(list.id);
            await reload();
          },
        },
      ],
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: 60,
          },
        ]}
      >
        <GlassButton
          iconName="arrow-back"
          onPress={() => router.back()}
          iconColor={theme.textColor}
          variant={theme.isDark ? "colored" : "light"}
        />
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>
          Subject Lists
        </Text>
        <GlassButton
          iconName="add"
          onPress={openCreateModal}
          iconColor={theme.textColor}
          variant={theme.isDark ? "colored" : "light"}
        />
      </View>

      {isLoading ? (
        <View style={styles.centerState}>
          <Text style={[styles.stateText, { color: theme.textSecondary }]}>
            Loading lists...
          </Text>
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={[styles.emptyTitle, { color: theme.textColor }]}>
                No Lists
              </Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Create your first list to save subjects for custom study.
              </Text>
              <Image
                source={noListsIllustration}
                style={styles.emptyImage}
                resizeMode="contain"
              />
              <TouchableOpacity
                style={[styles.emptyAction, { backgroundColor: theme.primary }]}
                onPress={openCreateModal}
              >
                <Text style={styles.emptyActionText}>Create List</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) =>
            (() => {
              const previewSubjects = item.subjectIds
                .slice(0, 4)
                .map((subjectId) => subjectsById.get(subjectId))
                .filter(Boolean);
              const remainingPreviewCount = Math.max(
                0,
                item.subjectIds.length - previewSubjects.length,
              );

              return (
                <TouchableOpacity
                  style={[
                    styles.listCard,
                    { backgroundColor: theme.cardBackground },
                  ]}
                  onPress={() =>
                    router.push({
                      pathname: "/subject-list/[id]",
                      params: { id: item.id },
                    })
                  }
                  activeOpacity={0.75}
                >
                  <View style={styles.listCardContent}>
                    <Text style={[styles.listName, { color: theme.textColor }]}>
                      {item.name}
                    </Text>
                    <Text
                      style={[styles.listMeta, { color: theme.textSecondary }]}
                    >
                      {item.subjectIds.length} item
                      {item.subjectIds.length === 1 ? "" : "s"} • Updated{" "}
                      {formatUpdatedAt(item.updatedAt)}
                    </Text>
                    {previewSubjects.length > 0 && (
                      <View style={styles.previewRow}>
                        {previewSubjects.map((subject) => (
                          <View
                            key={subject.id}
                            style={[
                              styles.previewChip,
                              {
                                backgroundColor: getItemTypeColor(
                                  subject.object,
                                ),
                              },
                            ]}
                          >
                            <Text
                              style={styles.previewChipText}
                              numberOfLines={1}
                              allowFontScaling={false}
                            >
                              {getSubjectPreviewLabel(subject)}
                            </Text>
                          </View>
                        ))}
                        {remainingPreviewCount > 0 && (
                          <View
                            style={[
                              styles.previewMoreChip,
                              {
                                borderColor: theme.border,
                                backgroundColor: theme.backgroundColor,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.previewMoreText,
                                { color: theme.textSecondary },
                              ]}
                              numberOfLines={1}
                              allowFontScaling={false}
                            >
                              +{remainingPreviewCount}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() =>
                        router.push({
                          pathname: "/subject-list/[id]",
                          params: { id: item.id },
                        })
                      }
                    >
                      <Ionicons
                        name="create-outline"
                        size={20}
                        color={theme.textSecondary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleDelete(item)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={20}
                        color={theme.error}
                      />
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })()
          }
        />
      )}

      <Modal
        visible={isCreateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCreateModal}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>
              New Subject List
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  borderColor: theme.border,
                  color: theme.textColor,
                  backgroundColor: theme.backgroundColor,
                },
              ]}
              value={newListName}
              onChangeText={setNewListName}
              placeholder="List name"
              placeholderTextColor={theme.textLight}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { borderColor: theme.border }]}
                onPress={closeCreateModal}
                disabled={isCreating}
              >
                <Text
                  style={[styles.modalButtonText, { color: theme.textColor }]}
                >
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  {
                    backgroundColor: theme.primary,
                    opacity: isCreating ? 0.7 : 1,
                  },
                ]}
                onPress={handleCreate}
                disabled={newListName.trim().length === 0 || isCreating}
              >
                <Text style={styles.modalPrimaryButtonText}>
                  {isCreating ? "Creating..." : "Create"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingTop: 10,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    flexGrow: 1,
  },
  listCard: {
    borderRadius: 14,
    marginBottom: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listCardContent: {
    flex: 1,
    marginRight: 10,
  },
  listName: {
    fontSize: 16,
    fontWeight: "700",
  },
  listMeta: {
    marginTop: 4,
    fontSize: 13,
  },
  previewRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  previewChip: {
    minWidth: 34,
    height: 30,
    maxHeight: 30,
    borderRadius: 8,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
    marginBottom: 6,
    overflow: "hidden",
  },
  previewChipText: {
    color: "#fff",
    fontSize: 14,
    lineHeight: 16,
    fontWeight: "700",
  },
  previewMoreChip: {
    minWidth: 34,
    height: 30,
    maxHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
    marginBottom: 6,
    overflow: "hidden",
  },
  previewMoreText: {
    fontSize: 12,
    lineHeight: 14,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  stateText: {
    fontSize: 14,
  },
  emptyTitle: {
    marginTop: 14,
    fontSize: 20,
    fontWeight: "700",
  },
  emptyImage: {
    width: 180,
    height: 180,
  },
  emptyText: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
  },
  emptyAction: {
    marginTop: 14,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyActionText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  modalActions: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  modalButton: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 90,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  modalPrimaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
});
