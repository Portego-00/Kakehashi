import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router/react-navigation";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassButton } from "../../src/components/GlassButton";
import { isPortegoUsername } from "../../src/utils/portegoAccess";
import {
  mangaLibraryService,
  type MangaLibraryItem,
  type MangaPickerSource,
} from "../../src/services/mangaLibraryService";
import { useAuthStore } from "../../src/utils/store";
import { withAlpha } from "../../src/utils/subjectColors";
import { useTheme } from "../../src/utils/theme";

type MangaLibraryScreenProps = {
  showBackButton?: boolean;
};

function formatRelativeDate(timestamp: number): string {
  const now = Date.now();
  const diffMs = Math.max(0, now - timestamp);
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) {
    return "just now";
  }

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  try {
    return new Date(timestamp).toLocaleDateString();
  } catch {
    return "recently";
  }
}

function formatSourceType(sourceType: MangaLibraryItem["sourceType"]): string {
  if (sourceType === "pdf") {
    return "PDF";
  }

  if (sourceType === "cbz") {
    return "CBZ";
  }

  return "IMAGE FOLDER";
}

export default function MangaLibraryScreen({
  showBackButton = true,
}: MangaLibraryScreenProps) {
  const { theme } = useTheme();
  const { userData } = useAuthStore();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const canAccessManga = isPortegoUsername(userData?.username);

  const [mangas, setMangas] = useState<MangaLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const loadLibrary = useCallback(async () => {
    try {
      const libraryItems = await mangaLibraryService.listMangas();
      setMangas(libraryItems);
    } catch (error) {
      console.error("Failed to load manga library:", error);
      Alert.alert("Could not load mangas", "Please try again in a moment.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!canAccessManga) {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsImporting(false);
        setMangas([]);
        return;
      }
      void loadLibrary();
    }, [canAccessManga, loadLibrary])
  );

  const handleRefresh = useCallback(() => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    void loadLibrary();
  }, [isRefreshing, loadLibrary]);

  const openReader = useCallback((mangaId: string) => {
    router.push({
      pathname: "/manga-reader",
      params: { mangaId },
    });
  }, [router]);

  const runImport = useCallback(
    async (source: MangaPickerSource) => {
      if (isImporting) {
        return;
      }

      setIsImporting(true);
      try {
        const importedManga = await mangaLibraryService.importFromPicker(source);
        if (!importedManga) {
          return;
        }

        await loadLibrary();
        openReader(importedManga.id);
      } catch (error) {
        console.error("Failed to import manga:", error);
        Alert.alert(
          "Import failed",
          "This source could not be imported. Choose a valid CBZ file or a folder containing manga images."
        );
      } finally {
        setIsImporting(false);
      }
    },
    [isImporting, loadLibrary, openReader]
  );

  const handleImport = useCallback(() => {
    if (!canAccessManga) {
      Alert.alert("Restricted", "This feature is only available to Portego.");
      return;
    }

    if (isImporting) {
      return;
    }

    Alert.alert("Import manga", "Choose your source format.", [
      {
        text: "CBZ file",
        onPress: () => {
          void runImport("file");
        },
      },
      {
        text: "Image folder",
        onPress: () => {
          void runImport("directory");
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [canAccessManga, isImporting, runImport]);

  const confirmDelete = useCallback(
    (item: MangaLibraryItem) => {
      if (!canAccessManga) {
        Alert.alert("Restricted", "This feature is only available to Portego.");
        return;
      }

      Alert.alert(
        "Remove this manga?",
        `${item.title} will be deleted from this device, including OCR cache.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await mangaLibraryService.deleteManga(item.id);
                await loadLibrary();
              } catch (error) {
                console.error("Failed to delete manga:", error);
                Alert.alert("Delete failed", "Please try again.");
              }
            },
          },
        ]
      );
    },
    [canAccessManga, loadLibrary]
  );

  const totalPages = useMemo(() => {
    return mangas.reduce((sum, manga) => sum + Math.max(0, manga.pageCount || 0), 0);
  }, [mangas]);

  if (!canAccessManga) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar style={theme.statusBarStyle} />
        <View
          style={[
            styles.header,
            {
              paddingTop: Math.max(insets.top + 8, 20),
            },
          ]}
        >
          {showBackButton ? (
            <GlassButton
              iconName="arrow-back"
              iconSize={20}
              iconColor={theme.textColor}
              variant="light"
              style={styles.headerButton}
              onPress={() => router.back()}
            />
          ) : (
            <View style={styles.headerButton} />
          )}
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>Manga</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.emptyWrap}>
          <Ionicons
            name="lock-closed-outline"
            size={56}
            color={withAlpha(theme.textSecondary, 0.75)}
          />
          <Text style={[styles.emptyTitle, { color: theme.textColor }]}>Restricted</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            This feature is only available to user Portego.
          </Text>
          <TouchableOpacity
            style={[
              styles.importButton,
              {
                marginTop: 14,
                backgroundColor: withAlpha(theme.primary, theme.isDark ? 0.28 : 0.14),
                borderColor: withAlpha(theme.primary, theme.isDark ? 0.6 : 0.35),
                paddingHorizontal: 16,
              },
            ]}
            onPress={() => router.replace("/")}
            activeOpacity={0.82}
          >
            <Text style={[styles.importButtonText, { color: theme.primary }]}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
      <StatusBar style={theme.statusBarStyle} />

      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top + 8, 20),
          },
        ]}
      >
        {showBackButton ? (
          <GlassButton
            iconName="arrow-back"
            iconSize={20}
            iconColor={theme.textColor}
            variant="light"
            style={styles.headerButton}
            onPress={() => router.back()}
          />
        ) : (
          <View style={styles.headerButton} />
        )}

        <Text style={[styles.headerTitle, { color: theme.textColor }]}>Manga</Text>

        <GlassButton
          iconName={isImporting ? "hourglass" : "add"}
          iconSize={22}
          iconColor={theme.textColor}
          variant="light"
          style={styles.headerButton}
          onPress={handleImport}
        />
      </View>

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading manga library...</Text>
        </View>
      ) : (
        <FlatList
          data={mangas}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 28, 32) },
          ]}
          refreshControl={
            <RefreshControl
              tintColor={theme.primary}
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
            />
          }
          ListHeaderComponent={
            <View style={styles.summaryWrap}>
              <Text style={[styles.summaryText, { color: theme.textSecondary }]}> 
                {mangas.length} volume{mangas.length === 1 ? "" : "s"} · {totalPages} total pages
              </Text>

              <TouchableOpacity
                style={[
                  styles.importButton,
                  {
                    backgroundColor: withAlpha(theme.primary, theme.isDark ? 0.28 : 0.14),
                    borderColor: withAlpha(theme.primary, theme.isDark ? 0.6 : 0.35),
                  },
                ]}
                onPress={handleImport}
                activeOpacity={0.82}
              >
                {isImporting ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <Ionicons name="cloud-upload-outline" size={18} color={theme.primary} />
                )}
                <Text style={[styles.importButtonText, { color: theme.primary }]}>Import Manga</Text>
              </TouchableOpacity>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="book-outline" size={56} color={withAlpha(theme.textSecondary, 0.75)} />
              <Text style={[styles.emptyTitle, { color: theme.textColor }]}>No manga yet</Text>
              <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>Import a CBZ file or an image folder to start reading with OCR and word lookup.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const progress = item.pageCount > 0 ? item.lastReadPage / item.pageCount : 0;
            const progressLabel = `${Math.max(1, item.lastReadPage)} / ${Math.max(1, item.pageCount)} pages`;

            return (
              <TouchableOpacity
                style={[
                  styles.card,
                  {
                    borderColor: withAlpha(theme.border, 0.62),
                    backgroundColor: withAlpha(theme.cardBackground, theme.isDark ? 0.8 : 0.95),
                  },
                ]}
                activeOpacity={0.84}
                onPress={() => openReader(item.id)}
              >
                {item.coverUri ? (
                  <Image source={{ uri: item.coverUri }} style={styles.cover} resizeMode="cover" />
                ) : (
                  <View
                    style={[
                      styles.coverFallback,
                      {
                        backgroundColor: withAlpha(theme.primary, theme.isDark ? 0.25 : 0.12),
                      },
                    ]}
                  >
                    <Ionicons
                      name={item.sourceType === "pdf" ? "document-text-outline" : "book-outline"}
                      size={28}
                      color={theme.primary}
                    />
                  </View>
                )}

                <View style={styles.cardBody}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.cardTitle, { color: theme.textColor }]} numberOfLines={2}>
                      {item.title}
                    </Text>

                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => confirmDelete(item)}
                      hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
                    >
                      <Ionicons name="trash-outline" size={17} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.cardMeta, { color: theme.textSecondary }]}> 
                    {formatSourceType(item.sourceType)} · {progressLabel}
                  </Text>

                  <View
                    style={[
                      styles.progressTrack,
                      { backgroundColor: withAlpha(theme.border, theme.isDark ? 0.55 : 0.35) },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(100, Math.max(0, progress * 100))}%`,
                          backgroundColor: theme.primary,
                        },
                      ]}
                    />
                  </View>

                  <Text style={[styles.cardFooter, { color: theme.textSecondary }]}> 
                    Updated {formatRelativeDate(item.updatedAt)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          }}
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
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  summaryWrap: {
    marginBottom: 10,
    gap: 10,
  },
  summaryText: {
    fontSize: 13,
    fontWeight: "500",
  },
  importButton: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  importButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  emptyWrap: {
    marginTop: 80,
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  emptySubtitle: {
    textAlign: "center",
    fontSize: 14,
    lineHeight: 22,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    gap: 12,
  },
  cover: {
    width: 72,
    height: 102,
    borderRadius: 10,
  },
  coverFallback: {
    width: 72,
    height: 102,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    justifyContent: "space-between",
    minHeight: 102,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 20,
  },
  deleteButton: {
    padding: 2,
    marginTop: 1,
  },
  cardMeta: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.15,
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  cardFooter: {
    fontSize: 12,
  },
});
