import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Keyboard,
  LayoutAnimation,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  UIManager,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AnimeMALInfo,
  fetchAnimeInfoBatch,
  formatMediaType,
  loadAllCachedAnimeInfo,
} from "../../src/services/animeInfoService";
import { getAvailableAnimes } from "../../src/services/immersionKitService";
import {
  getWatchedAnimeIds,
  getWatchedAnimeNormalizedTitles,
  normalizeTitle,
  syncMyAnimeList,
} from "../../src/services/myAnimeListService";
import {
  getWatchedAniListIds,
  getWatchedAniListNormalizedTitles,
  normalizeTitle as normalizeAniListTitle,
  syncAniList,
} from "../../src/services/aniListService";
import {
  getMalIdForAnime,
  getAniListIdForAnime,
} from "../../src/data/animeIdMappings";
import { useSubjectColors, withAlpha } from "../../src/utils/subjectColors";
import { useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// MyAnimeList Icon Component
const MALIcon = ({ size = 20, color = "#2E51A2" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M8.273 7.247v8.423l-2.103-.003v-5.216l-2.03 2.404-1.989-2.458-.02 5.285H.001L0 7.247h2.203l1.865 2.545 2.015-2.546 2.19.001zm8.628 2.069l.025 6.335h-2.365l-.008-2.871h-2.8c.07.499.21 1.266.417 1.779.155.381.298.751.583 1.128l-1.705 1.125c-.349-.636-.622-1.337-.878-2.082a9.296 9.296 0 0 1-.507-2.179c-.085-.75-.097-1.471.107-2.212a3.908 3.908 0 0 1 1.161-1.866c.313-.293.749-.5 1.1-.687.351-.187.743-.264 1.107-.359a7.405 7.405 0 0 1 1.191-.183c.398-.034 1.107-.066 2.39-.028l.545 1.749H14.51c-.593.008-.878.001-1.341.209a2.236 2.236 0 0 0-1.278 1.92l2.663.033.038-1.81h2.309zm3.992-2.099v6.627l3.107.032-.43 1.775h-4.807V7.187l2.13.03z"
      fill={color}
    />
  </Svg>
);

// AniList Icon Component
const AniListIcon = ({ size = 20, color = "#02A9FF" }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path
      d="M6.361 2.943 0 21.056h4.942l1.077-3.133H11.4l1.052 3.133H22.9c.71 0 1.1-.392 1.1-1.101V17.53c0-.71-.39-1.101-1.1-1.101h-6.483V4.045c0-.71-.392-1.102-1.101-1.102h-2.422c-.71 0-1.101.392-1.101 1.102v1.064l-.758-2.166zm2.324 5.948 1.688 5.018H7.144z"
      fill={color}
    />
  </Svg>
);

interface AnimeItem {
  id: string; // Internal ID (slug)
  title: string; // Readable title
  isSelected: boolean;
}

export default function ImmersionKitSettings() {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ showSection?: string }>();
  const { myAnimeListUsername, aniListUsername, immersionKitAnimes, setImmersionKitAnimes, setMyAnimeListUsername, setAniListUsername } =
    useSettingsStore();

  const [isLoading, setIsLoading] = useState(true);
  const [animes, setAnimes] = useState<AnimeItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSyncing, setIsSyncing] = useState(false);
  const [malUsernameInput, setMalUsernameInput] = useState(myAnimeListUsername ?? "");
  const [malSyncStats, setMalSyncStats] = useState<{ watched: number; matched: number } | null>(null);
  const [showMalSync, setShowMalSync] = useState(!!myAnimeListUsername);

  // AniList sync state
  const [aniListUsernameInput, setAniListUsernameInput] = useState(aniListUsername ?? "");
  const [aniListSyncStats, setAniListSyncStats] = useState<{ watched: number; matched: number } | null>(null);
  const [showAniListSync, setShowAniListSync] = useState(() => {
    // Auto-open AniList section if coming from patch notes
    if (params.showSection === "anilist") return true;
    return !!aniListUsername;
  });

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

        let initialSelection = new Set<string>();

        // If we have saved manual selection, use it
        if (immersionKitAnimes !== null) {
          initialSelection = new Set(immersionKitAnimes);
        }
        // Otherwise, if we have MAL username, try to sync
        else if (myAnimeListUsername) {
          try {
            // Get watched anime IDs for ID-based matching (preferred)
            const watchedIds = await getWatchedAnimeIds(myAnimeListUsername);
            // Also get normalized titles as fallback
            const watchedTitles = await getWatchedAnimeNormalizedTitles(myAnimeListUsername);

            // Match MAL anime to IK titles using ID-based matching first
            availableAnimes.forEach((anime) => {
              // First try ID-based matching (more reliable)
              const malId = getMalIdForAnime(anime.id);
              if (malId !== undefined && watchedIds.has(malId)) {
                initialSelection.add(anime.id);
                return;
              }

              // Fallback to title-based matching
              const normalized = normalizeTitle(anime.title);
              const normalizedId = normalizeTitle(anime.id);

              if (
                (normalized && watchedTitles.has(normalized)) ||
                (normalizedId && watchedTitles.has(normalizedId))
              ) {
                initialSelection.add(anime.id);
              }
            });
          } catch (e) {
            console.warn("Failed to sync with MAL for initial state", e);
          }
        }
        // If neither, start with empty selection (or maybe select all? usually empty is safer)

        const items = availableAnimes.map((anime) => ({
          ...anime,
          isSelected: initialSelection.has(anime.id),
        }));

        setAnimes(items);
      } catch (error) {
        console.error("Failed to load Immersion Kit data", error);
        Alert.alert("Error", "Failed to load available anime list.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Fetch MAL anime info (images, scores, etc.) after the anime list loads.
  useEffect(() => {
    if (animes.length === 0) return;

    const controller = new AbortController();
    fetchAbortRef.current = controller;

    const loadInfo = async () => {
      // Load cached info
      const cached = await loadAllCachedAnimeInfo();
      if (controller.signal.aborted) return;
      setAnimeInfo(cached);

      // Find anime without cached info
      const uncached = animes.filter((a) => !cached[a.id]);
      if (uncached.length === 0) return;

      setInfoFetchProgress({ fetched: 0, total: uncached.length });

      // Fetch missing info progressively
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
    Keyboard.dismiss();
    setAnimes((prev) => {
      const updated = prev.map((item) =>
        item.id === id ? { ...item, isSelected: !item.isSelected } : item
      );

      // Auto-save: immediately persist the selection
      const selectedIds = updated
        .filter((item) => item.isSelected)
        .map((item) => item.id);
      setImmersionKitAnimes(selectedIds);

      return updated;
    });
  };

  const handleSelectAll = () => {
    setAnimes((prev) => {
      const updated = prev.map((item) => ({ ...item, isSelected: true }));

      // Auto-save: persist all selections
      const selectedIds = updated.map((item) => item.id);
      setImmersionKitAnimes(selectedIds);

      return updated;
    });
  };

  const handleDeselectAll = () => {
    setAnimes((prev) => {
      const updated = prev.map((item) => ({ ...item, isSelected: false }));

      // Auto-save: persist empty selection
      setImmersionKitAnimes([]);

      return updated;
    });
  };

  const toggleMalSync = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowMalSync((prev) => {
      if (!prev) {
        // Opening MAL, close AniList
        setShowAniListSync(false);
      } else {
        // Closing MAL, clear saved username
        setMyAnimeListUsername(null);
        setMalUsernameInput("");
        setMalSyncStats(null);
      }
      return !prev;
    });
  };

  const toggleAniListSync = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowAniListSync((prev) => {
      if (!prev) {
        // Opening AniList, close MAL
        setShowMalSync(false);
      } else {
        // Closing AniList, clear saved username
        setAniListUsername(null);
        setAniListUsernameInput("");
        setAniListSyncStats(null);
      }
      return !prev;
    });
  };

  const handleSyncFromMAL = async () => {
    const username = malUsernameInput.trim();
    if (!username) {
      Alert.alert("Error", "Please enter your MyAnimeList username.");
      return;
    }

    Keyboard.dismiss();
    setIsSyncing(true);
    try {
      // Sync with MAL API to fetch and cache watched anime
      const syncResult = await syncMyAnimeList(username);
      const watchedCount = syncResult.count;

      // Get watched anime IDs for ID-based matching (preferred)
      const watchedIds = await getWatchedAnimeIds(username);
      // Also get normalized titles as fallback
      const watchedTitles = await getWatchedAnimeNormalizedTitles(username);

      // Deselect all first, then select only MAL matches
      let matchedCount = 0;
      setAnimes((prev) => {
        const updated = prev.map((anime) => {
          // First try ID-based matching (more reliable)
          const malId = getMalIdForAnime(anime.id);
          let isMatch = malId !== undefined && watchedIds.has(malId);

          // Fallback to title-based matching if no ID mapping exists
          if (!isMatch) {
            const normalized = normalizeTitle(anime.title);
            const normalizedId = normalizeTitle(anime.id);
            isMatch =
              (!!normalized && watchedTitles.has(normalized)) ||
              (!!normalizedId && watchedTitles.has(normalizedId));
          }

          if (isMatch) matchedCount++;
          return {
            ...anime,
            isSelected: isMatch,
          };
        });

        // Auto-save: persist MAL-synced selections
        const selectedIds = updated
          .filter((item) => item.isSelected)
          .map((item) => item.id);
        setImmersionKitAnimes(selectedIds);

        return updated;
      });

      // Save the MAL username to store
      setMyAnimeListUsername(username);

      // Update stats
      setMalSyncStats({ watched: watchedCount, matched: matchedCount });

      Alert.alert(
        "Synced",
        `Found ${watchedCount} watched anime on ${username}'s MyAnimeList.\n${matchedCount} matched with Immersion Kit anime.`
      );
    } catch (error) {
      console.error("Failed to sync MAL", error);
      Alert.alert("Error", "Failed to sync with MyAnimeList. Please check the username and try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncFromAniList = async () => {
    const username = aniListUsernameInput.trim();
    if (!username) {
      Alert.alert("Error", "Please enter your AniList username.");
      return;
    }

    Keyboard.dismiss();
    setIsSyncing(true);
    try {
      // Sync with AniList API to fetch and cache watched anime
      const syncResult = await syncAniList(username);
      const watchedCount = syncResult.count;

      // Get watched anime IDs for ID-based matching (preferred)
      const watchedIds = await getWatchedAniListIds(username);
      // Also get normalized titles as fallback
      const watchedTitles = await getWatchedAniListNormalizedTitles(username);

      // Deselect all first, then select only AniList matches
      let matchedCount = 0;
      setAnimes((prev) => {
        const updated = prev.map((anime) => {
          // First try ID-based matching (more reliable)
          const aniListId = getAniListIdForAnime(anime.id);
          let isMatch = aniListId !== undefined && watchedIds.has(aniListId);

          // Fallback to title-based matching if no ID mapping exists
          if (!isMatch) {
            const normalized = normalizeAniListTitle(anime.title);
            const normalizedId = normalizeAniListTitle(anime.id);
            isMatch =
              (!!normalized && watchedTitles.has(normalized)) ||
              (!!normalizedId && watchedTitles.has(normalizedId));
          }

          if (isMatch) matchedCount++;
          return {
            ...anime,
            isSelected: isMatch,
          };
        });

        // Auto-save: persist AniList-synced selections
        const selectedIds = updated
          .filter((item) => item.isSelected)
          .map((item) => item.id);
        setImmersionKitAnimes(selectedIds);

        return updated;
      });

      // Save the AniList username to store
      setAniListUsername(username);

      // Update stats
      setAniListSyncStats({ watched: watchedCount, matched: matchedCount });

      Alert.alert(
        "Synced",
        `Found ${watchedCount} watched anime on ${username}'s AniList.\n${matchedCount} matched with Immersion Kit anime.`
      );
    } catch (error) {
      console.error("Failed to sync AniList", error);
      Alert.alert("Error", "Failed to sync with AniList. Please check the username and try again.");
    } finally {
      setIsSyncing(false);
    }
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
            backgroundColor: item.isSelected
              ? theme.isDark
                ? withAlpha(subjectColors.vocabulary, 0.1)
                : withAlpha(subjectColors.vocabulary, 0.05)
              : "transparent",
            borderBottomColor: theme.border,
          },
        ]}
        onPress={() => toggleAnime(item.id)}
        activeOpacity={0.7}
      >
        <View
          style={[
            styles.checkbox,
            {
              backgroundColor: item.isSelected ? theme.primary : "transparent",
              borderColor: item.isSelected ? theme.primary : theme.border,
            },
          ]}
        >
          {item.isSelected && (
            <Ionicons name="checkmark" size={16} color="white" />
          )}
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
            style={[
              styles.animeTitle,
              {
                color: item.isSelected ? theme.textColor : theme.textSecondary,
                fontWeight: item.isSelected ? "600" : "400",
              },
            ]}
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
            paddingTop: insets.top,
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
          Immersion Kit Anime
        </Text>
        <View style={styles.headerSpacer} />
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

            {/* Toolbar Row */}
            <View style={styles.toolbarRow}>
              {/* Selection count */}
              <View style={styles.countBadge}>
                <Text style={[styles.countBadgeText, { color: theme.primary }]}>
                  {animes.filter(a => a.isSelected).length}
                </Text>
                <Text style={[styles.countBadgeLabel, { color: theme.textSecondary }]}>
                  /{animes.length}
                </Text>
              </View>

              {/* Action buttons */}
              <View style={styles.toolbarActions}>
                <TouchableOpacity
                  style={[styles.toolbarButton, { backgroundColor: theme.cardBackground }]}
                  onPress={handleSelectAll}
                >
                  <Ionicons name="checkmark-done" size={18} color={theme.primary} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toolbarButton, { backgroundColor: theme.cardBackground }]}
                  onPress={handleDeselectAll}
                >
                  <Ionicons name="close" size={18} color={theme.textSecondary} />
                </TouchableOpacity>

                <View style={styles.toolbarDivider} />

                <TouchableOpacity
                  style={[
                    styles.toolbarButton,
                    {
                      backgroundColor: showMalSync ? "#2E51A2" : theme.cardBackground,
                    },
                  ]}
                  onPress={toggleMalSync}
                >
                  <MALIcon size={16} color={showMalSync ? "#fff" : "#2E51A2"} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.toolbarButton,
                    {
                      backgroundColor: showAniListSync ? "#02A9FF" : theme.cardBackground,
                    },
                  ]}
                  onPress={toggleAniListSync}
                >
                  <AniListIcon size={16} color={showAniListSync ? "#fff" : "#02A9FF"} />
                </TouchableOpacity>
              </View>
            </View>

            {/* MAL Sync Section - Compact inline */}
            {showMalSync && (
              <View
                style={[
                  styles.syncSectionCompact,
                  { backgroundColor: theme.cardBackground, borderColor: "#2E51A2" },
                ]}
              >
                <MALIcon size={18} color="#2E51A2" />
                <TextInput
                  value={malUsernameInput}
                  onChangeText={setMalUsernameInput}
                  placeholder="MAL username"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.syncInputCompact, { color: theme.textColor }]}
                />
                {malSyncStats && (
                  <Text style={[styles.syncStatsCompact, { color: theme.textSecondary }]}>
                    {malSyncStats.matched}/{malSyncStats.watched}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={handleSyncFromMAL}
                  disabled={isSyncing || !malUsernameInput.trim()}
                  style={[
                    styles.syncButtonCompact,
                    { backgroundColor: "#2E51A2" },
                    (isSyncing || !malUsernameInput.trim()) && styles.syncButtonDisabled,
                  ]}
                >
                  {isSyncing ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Ionicons name="sync" size={16} color="white" />
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* AniList Sync Section - Compact inline */}
            {showAniListSync && (
              <View
                style={[
                  styles.syncSectionCompact,
                  { backgroundColor: theme.cardBackground, borderColor: "#02A9FF" },
                ]}
              >
                <AniListIcon size={18} color="#02A9FF" />
                <TextInput
                  value={aniListUsernameInput}
                  onChangeText={setAniListUsernameInput}
                  placeholder="AniList username"
                  placeholderTextColor={theme.textSecondary}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.syncInputCompact, { color: theme.textColor }]}
                />
                {aniListSyncStats && (
                  <Text style={[styles.syncStatsCompact, { color: theme.textSecondary }]}>
                    {aniListSyncStats.matched}/{aniListSyncStats.watched}
                  </Text>
                )}
                <TouchableOpacity
                  onPress={handleSyncFromAniList}
                  disabled={isSyncing || !aniListUsernameInput.trim()}
                  style={[
                    styles.syncButtonCompact,
                    { backgroundColor: "#02A9FF" },
                    (isSyncing || !aniListUsernameInput.trim()) && styles.syncButtonDisabled,
                  ]}
                >
                  {isSyncing ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Ionicons name="sync" size={16} color="white" />
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Info row */}
            {(searchQuery || infoFetchProgress) && (
              <View style={styles.infoRow}>
                {searchQuery && (
                  <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                    {filteredAnimes.length} results
                  </Text>
                )}
                {infoFetchProgress && (
                  <Text style={[styles.infoText, { color: theme.textSecondary }]}>
                    Loading {infoFetchProgress.fetched}/{infoFetchProgress.total}
                  </Text>
                )}
              </View>
            )}

            <FlatList
              data={filteredAnimes}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onScrollBeginDrag={Keyboard.dismiss}
              getItemLayout={(_, index) => ({
                length: 88, // Height with poster + meta
                offset: 88 * index,
                index,
              })}
              initialNumToRender={15}
              ListEmptyComponent={
                <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                  <View style={styles.emptyContainer}>
                    <Ionicons name="search-outline" size={48} color={theme.textSecondary} style={{ opacity: 0.5 }} />
                    <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                      No anime found matching &quot;{searchQuery}&quot;
                    </Text>
                  </View>
                </TouchableWithoutFeedback>
              }
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
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  headerSpacer: {
    width: 40, // Match backButton width for symmetry
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
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    height: "100%",
    fontSize: 15,
    fontWeight: "400",
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  countBadge: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  countBadgeText: {
    fontSize: 22,
    fontWeight: "700",
  },
  countBadgeLabel: {
    fontSize: 14,
    fontWeight: "500",
  },
  toolbarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toolbarButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  toolbarDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(128,128,128,0.2)",
    marginHorizontal: 4,
  },
  syncSectionCompact: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 10,
  },
  syncInputCompact: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    paddingVertical: 6,
  },
  syncStatsCompact: {
    fontSize: 12,
    fontWeight: "600",
  },
  syncButtonCompact: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  infoRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 12,
  },
  infoText: {
    fontSize: 12,
    fontWeight: "500",
  },
  listContent: {
    paddingBottom: 32,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 15,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 22,
  },
  itemContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 88,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  posterContainer: {
    width: 46,
    height: 65,
    borderRadius: 6,
    overflow: "hidden",
    marginRight: 12,
  },
  posterImage: {
    width: "100%",
    height: "100%",
  },
  posterPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
  },
  animeInfoContainer: {
    flex: 1,
    justifyContent: "center",
  },
  animeTitle: {
    fontSize: 15,
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
  syncButtonDisabled: {
    opacity: 0.5,
  },
});
