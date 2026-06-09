import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AnimeMALInfo,
  fetchAnimeInfoBatch,
  formatMediaType,
  loadAllCachedAnimeInfo,
} from "../../src/services/animeInfoService";
import { setPendingAnimeSelection } from "../../src/utils/animeSelectionBridge";
import { getAvailableAnimes } from "../../src/services/immersionKitService";
import { useSubjectColors, withAlpha } from "../../src/utils/subjectColors";
import { useTheme } from "../../src/utils/theme";

interface AnimeItem {
  id: string;
  title: string;
  isSelected: boolean;
}

export default function ListeningAnimeSelector() {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const params = useLocalSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [animes, setAnimes] = useState<AnimeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // MAL anime info (images, synopsis, etc.)
  const [animeInfo, setAnimeInfo] = useState<Record<string, AnimeMALInfo>>({});
  const [infoFetchProgress, setInfoFetchProgress] = useState<{
    fetched: number;
    total: number;
  } | null>(null);
  const fetchAbortRef = useRef<AbortController | null>(null);

  // Load available animes and set initial selection
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        const availableAnimes = await getAvailableAnimes();

        // Parse current selection from params
        const currentSelection = params.currentSelection
          ? JSON.parse(params.currentSelection as string)
          : [];
        const selectedSet = new Set(currentSelection);

        const items = availableAnimes.map((anime) => ({
          ...anime,
          isSelected: selectedSet.has(anime.id),
        }));

        setAnimes(items);
      } catch (error) {
        console.error("Failed to load anime list", error);
        Alert.alert("Error", "Failed to load anime list.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [params.currentSelection]);

  // Fetch MAL anime info (images, scores, etc.) after the anime list loads.
  // We intentionally depend on animes.length (not animes) because we only
  // want to trigger when the initial list loads, not on selection toggles.
  useEffect(() => {
    if (animes.length === 0) return;

    const controller = new AbortController();
    fetchAbortRef.current = controller;

    const loadInfo = async () => {
      // 1. Load cached info
      const cached = await loadAllCachedAnimeInfo();
      if (controller.signal.aborted) return;
      setAnimeInfo(cached);

      // 2. Find anime without cached info
      const uncached = animes.filter((a) => !cached[a.id]);
      if (uncached.length === 0) return;

      setInfoFetchProgress({ fetched: 0, total: uncached.length });

      // 3. Fetch missing info progressively
      let fetched = 0;
      await fetchAnimeInfoBatch(
        uncached,
        (id, info) => {
          setAnimeInfo((prev) => ({ ...prev, [id]: info }));
          fetched++;
          setInfoFetchProgress({ fetched, total: uncached.length });
        },
        controller.signal
      );

      if (!controller.signal.aborted) {
        setInfoFetchProgress(null);
      }
    };

    loadInfo();

    return () => {
      controller.abort();
      fetchAbortRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animes.length]);

  const filteredAnimes = useMemo(() => {
    if (!searchQuery) return animes;
    const lowerQuery = searchQuery.toLowerCase();
    return animes.filter((anime) =>
      anime.title.toLowerCase().includes(lowerQuery)
    );
  }, [animes, searchQuery]);

  const toggleAnime = (id: string) => {
    setAnimes((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isSelected: !item.isSelected } : item
      )
    );
  };

  const handleSave = () => {
    const selectedIds = animes
      .filter((item) => item.isSelected)
      .map((item) => item.id);

    // Store selection and go back (avoids duplicate screens in stack)
    setPendingAnimeSelection(selectedIds);
    router.back();
  };

  const handleSelectAll = () => {
    setAnimes((prev) => prev.map((item) => ({ ...item, isSelected: true })));
  };

  const handleDeselectAll = () => {
    setAnimes((prev) => prev.map((item) => ({ ...item, isSelected: false })));
  };

  const renderItem = ({ item }: { item: AnimeItem }) => {
    const info = animeInfo[item.id];
    const metaParts = [
      info?.mediaType ? formatMediaType(info.mediaType) : null,
      info?.episodes ? `${info.episodes} eps` : null,
      info?.score ? `★ ${info.score}` : null,
    ].filter(Boolean);

    return (
      <TouchableOpacity
        style={[
          styles.itemContainer,
          {
            borderBottomColor: theme.border,
            backgroundColor: item.isSelected
              ? theme.isDark
                ? withAlpha(subjectColors.vocabulary, 0.1)
                : withAlpha(subjectColors.vocabulary, 0.05)
              : "transparent",
          },
        ]}
        onPress={() => toggleAnime(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.checkboxContainer}>
          <Ionicons
            name={item.isSelected ? "checkbox" : "square-outline"}
            size={24}
            color={item.isSelected ? theme.primary : theme.textSecondary}
          />
        </View>

        {/* Poster Image */}
        <View style={styles.posterContainer}>
          {info?.imageUrl ? (
            <Image
              source={{ uri: info.imageUrl }}
              style={styles.posterImage}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <View
              style={[
                styles.posterPlaceholder,
                {
                  backgroundColor: theme.isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.04)",
                },
              ]}
            >
              <Ionicons
                name="film-outline"
                size={18}
                color={theme.textSecondary}
                style={{ opacity: 0.5 }}
              />
            </View>
          )}
        </View>

        {/* Anime Info */}
        <View style={styles.animeInfoContainer}>
          <Text
            style={[styles.animeTitle, { color: theme.textColor }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {metaParts.length > 0 && (
            <Text
              style={[styles.animeMeta, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {metaParts.join(" · ")}
            </Text>
          )}
          {info?.synopsis && (
            <Text
              style={[styles.animeSynopsis, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {info.synopsis}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const selectedCount = animes.filter((a) => a.isSelected).length;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <StatusBar style={theme.statusBarStyle} />

      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.headerBackground,
            paddingTop: 60,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={theme.headerText} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.headerText }]}>
          Select Anime
        </Text>
        <TouchableOpacity
          style={styles.saveButton}
          onPress={handleSave}
          disabled={selectedCount === 0}
        >
          <Text
            style={[
              styles.saveButtonText,
              {
                color: theme.headerText,
                opacity: selectedCount > 0 ? 1 : 0.5,
              },
            ]}
          >
            Save
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <>
            {/* Search Bar */}
            <View
              style={[
                styles.searchContainer,
                {
                  backgroundColor: theme.cardBackground,
                  borderColor: theme.border,
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
                style={[styles.searchInput, { color: theme.textColor }]}
                placeholder="Search anime..."
                placeholderTextColor={theme.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
              />
            </View>

            {/* Actions */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={[
                  styles.chipButton,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.border,
                  },
                ]}
                onPress={handleSelectAll}
              >
                <Text style={[styles.chipText, { color: theme.textColor }]}>
                  Select All
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.chipButton,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.border,
                  },
                ]}
                onPress={handleDeselectAll}
              >
                <Text style={[styles.chipText, { color: theme.textColor }]}>
                  Deselect All
                </Text>
              </TouchableOpacity>
            </View>

            {/* Count */}
            <View style={styles.countRow}>
              <Text style={[styles.countText, { color: theme.textSecondary }]}>
                {selectedCount} of {filteredAnimes.length} selected
              </Text>
              {infoFetchProgress && (
                <Text style={[styles.countText, { color: theme.textSecondary }]}>
                  {" "}· Loading info {infoFetchProgress.fetched}/{infoFetchProgress.total}
                </Text>
              )}
            </View>

            {/* List */}
            <FlatList
              data={filteredAnimes}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              getItemLayout={(_, index) => ({
                length: 88,
                offset: 88 * index,
                index,
              })}
              initialNumToRender={15}
            />
          </>
        )}
      </View>
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
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  saveButton: {
    padding: 8,
    marginRight: -8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 16,
  },
  actionsContainer: {
    flexDirection: "row",
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
    flexWrap: "wrap",
  },
  chipButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "500",
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  countText: {
    fontSize: 12,
  },
  listContent: {
    paddingBottom: 32,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 88,
  },
  checkboxContainer: {
    marginRight: 12,
  },
  posterContainer: {
    width: 46,
    height: 65,
    borderRadius: 6,
    overflow: "hidden",
    marginRight: 12,
  },
  posterImage: {
    width: "100%" as any,
    height: "100%" as any,
  },
  posterPlaceholder: {
    width: "100%" as any,
    height: "100%" as any,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    borderRadius: 6,
  },
  animeInfoContainer: {
    flex: 1,
    justifyContent: "center" as const,
  },
  animeTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    lineHeight: 20,
    marginBottom: 2,
  },
  animeMeta: {
    fontSize: 12,
    lineHeight: 16,
    marginBottom: 1,
  },
  animeSynopsis: {
    fontSize: 11,
    lineHeight: 15,
    opacity: 0.7,
  },
});
