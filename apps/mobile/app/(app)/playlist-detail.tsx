import { Ionicons } from "@expo/vector-icons";
import { FlashList, type FlashListRef } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";
import { Directory, File, Paths } from "expo-file-system";
import * as FileSystem from "expo-file-system";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { appleMusicService } from "../../src/services/appleMusicService";
import {
  spotifyService,
  type SpotifyTrack,
} from "../../src/services/spotifyService";
import { useTheme } from "../../src/utils/theme";

const CACHE_FILE_NAME = "song-history.json";
const MAX_HISTORY_ITEMS = 20;
const IMAGES_CACHE_DIR = "song-images";

const getParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] || "" : value || "";

const formatSongCount = (count: number): string =>
  `${count} song${count === 1 ? "" : "s"}`;

export default function PlaylistDetailScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const playlistId = getParam(params.playlistId);
  const playlistName = getParam(params.playlistName) || "Playlist";
  const playlistImageUrl = getParam(params.playlistImageUrl);
  const playlistDescription = getParam(params.playlistDescription);
  const playlistOwnerName = getParam(params.playlistOwnerName);
  const playlistSource =
    getParam(params.playlistSource) === "apple" ? "apple" : "spotify";
  const playlistTrackCount = Number.parseInt(
    getParam(params.playlistTrackCount),
    10,
  );
  const declaredTrackCount = Number.isFinite(playlistTrackCount)
    ? Math.max(0, playlistTrackCount)
    : 0;

  const [tracks, setTracks] = useState<SpotifyTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isStickyHeaderInteractive, setIsStickyHeaderInteractive] =
    useState(false);
  const listRef = useRef<FlashListRef<SpotifyTrack>>(null);
  const isStickyHeaderInteractiveRef = useRef(false);
  const scrollY = useSharedValue(0);

  const sourceLabel = playlistSource === "apple" ? "Apple Music" : "Spotify";
  const detailsLine = useMemo(() => {
    const parts = [
      playlistOwnerName || sourceLabel,
      formatSongCount(declaredTrackCount || tracks.length),
    ];
    return parts.filter(Boolean).join(" • ");
  }, [declaredTrackCount, playlistOwnerName, sourceLabel, tracks.length]);

  const stickyHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [90, 140, 190],
      [0, 0.45, 1],
      Extrapolation.CLAMP,
    );

    const translateY = interpolate(
      scrollY.value,
      [90, 150],
      [-52, 0],
      Extrapolation.CLAMP,
    );

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextScrollY = event.nativeEvent.contentOffset.y;
      scrollY.value = nextScrollY;
      const nextInteractive = nextScrollY > 150;
      if (isStickyHeaderInteractiveRef.current !== nextInteractive) {
        isStickyHeaderInteractiveRef.current = nextInteractive;
        setIsStickyHeaderInteractive(nextInteractive);
      }
    },
    [scrollY],
  );

  const scrollToTop = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const cacheAlbumArt = useCallback(
    async (song: SpotifyTrack): Promise<string> => {
      try {
        const cacheDir = new Directory(Paths.cache, "songs");
        cacheDir.create({ idempotent: true });

        const imagesDir = new Directory(cacheDir.uri, IMAGES_CACHE_DIR);
        imagesDir.create({ idempotent: true });

        const localUri = `${imagesDir.uri}/${song.id}.jpg`;
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (fileInfo.exists) {
          return localUri;
        }

        const downloadResult = await FileSystem.downloadAsync(
          song.albumArt,
          localUri,
        );

        return downloadResult.status === 200 ? localUri : song.albumArt;
      } catch {
        return song.albumArt;
      }
    },
    [],
  );

  const addToHistory = useCallback(
    async (song: SpotifyTrack) => {
      try {
        const cacheDir = new Directory(Paths.cache, "songs");
        cacheDir.create({ idempotent: true });

        const historyFile = new File(cacheDir, CACHE_FILE_NAME);
        const existingHistory = historyFile.exists
          ? (JSON.parse(await historyFile.text()) as SpotifyTrack[])
          : [];
        const filteredHistory = existingHistory.filter(
          (historySong) => historySong.id !== song.id,
        );
        const cachedAlbumArt = await cacheAlbumArt(song);
        const nextHistory = [
          { ...song, albumArt: cachedAlbumArt },
          ...filteredHistory,
        ].slice(0, MAX_HISTORY_ITEMS);

        historyFile.write(JSON.stringify(nextHistory, null, 2));
      } catch (historyError) {
        console.error("Error saving playlist song history:", historyError);
      }
    },
    [cacheAlbumArt],
  );

  useEffect(() => {
    let didCancel = false;

    const loadPlaylistTracks = async () => {
      if (!playlistId) {
        setError("Playlist ID is missing.");
        setIsLoading(false);
        return;
      }

      const service =
        playlistSource === "apple" ? appleMusicService : spotifyService;

      try {
        setIsLoading(true);
        setError(null);
        const limit =
          declaredTrackCount > 0
            ? declaredTrackCount
            : Number.POSITIVE_INFINITY;
        const playlistTracks = await service.getPlaylistTracks(
          playlistId,
          limit,
        );

        if (!didCancel) {
          setTracks(playlistTracks);
        }
      } catch (playlistError) {
        console.error("Error loading playlist tracks:", playlistError);
        if (!didCancel) {
          setError(`Failed to load ${playlistName}. Please try again.`);
          setTracks([]);
        }
      } finally {
        if (!didCancel) {
          setIsLoading(false);
        }
      }
    };

    void loadPlaylistTracks();

    return () => {
      didCancel = true;
    };
  }, [declaredTrackCount, playlistId, playlistName, playlistSource, reloadKey]);

  const handleSongPress = useCallback(
    (song: SpotifyTrack) => {
      void addToHistory(song);

      router.push({
        pathname: "/song-lyrics",
        params: {
          songId: song.id,
          songTitle: song.title,
          artist: song.artist,
          albumArt: song.albumArt,
          songUrl: song.url,
          duration: song.duration.toString(),
          musicSource: playlistSource,
        },
      });
    },
    [addToHistory, playlistSource],
  );

  const handleRetry = useCallback(() => {
    if (!playlistId) {
      Alert.alert("Playlist unavailable", "This playlist cannot be loaded.");
      return;
    }

    setError(null);
    setIsLoading(true);
    setTracks([]);
    setReloadKey((key) => key + 1);
  }, [playlistId]);

  const renderTrack = useCallback(
    ({ item, index }: { item: SpotifyTrack; index: number }) => (
      <TouchableOpacity
        style={styles.trackRow}
        onPress={() => handleSongPress(item)}
        activeOpacity={0.72}
      >
        <Text style={[styles.trackIndex, { color: theme.textSecondary }]}>
          {index + 1}
        </Text>
        <Image
          source={{ uri: item.albumArt }}
          style={[
            styles.trackArtwork,
            { backgroundColor: theme.isDark ? "#252525" : "#e5e7eb" },
          ]}
        />
        <View style={styles.trackInfo}>
          <Text
            style={[styles.trackTitle, { color: theme.textColor }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text
            style={[styles.trackArtist, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {item.artist}
          </Text>
        </View>
        <Ionicons
          name="chevron-forward"
          size={18}
          color={theme.textSecondary}
        />
      </TouchableOpacity>
    ),
    [handleSongPress, theme.isDark, theme.textColor, theme.textSecondary],
  );

  const renderHeader = useCallback(
    () => (
      <View>
        <LinearGradient
          colors={[theme.isDark ? "#1f7a4d" : "#58d184", theme.backgroundColor]}
          style={styles.hero}
        >
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={28} color="#fff" />
          </Pressable>

          {playlistImageUrl ? (
            <Image
              source={{ uri: playlistImageUrl }}
              style={styles.playlistArtwork}
            />
          ) : (
            <View style={[styles.playlistArtwork, styles.playlistFallback]}>
              <Ionicons name="musical-notes" size={56} color="#fff" />
            </View>
          )}

          <View style={styles.heroText}>
            <Text style={styles.sourceLabel}>{sourceLabel} playlist</Text>
            <Text style={styles.playlistTitle} numberOfLines={2}>
              {playlistName}
            </Text>
            {playlistDescription ? (
              <Text style={styles.playlistDescription} numberOfLines={2}>
                {playlistDescription}
              </Text>
            ) : null}
            <Text style={styles.playlistDetails}>{detailsLine}</Text>
          </View>
        </LinearGradient>

        <View style={styles.actionRow}>
          <Text style={[styles.loadedCount, { color: theme.textSecondary }]}>
            {isLoading
              ? "Loading songs..."
              : `${formatSongCount(tracks.length)} loaded`}
          </Text>
          <TouchableOpacity
            style={[
              styles.playAction,
              {
                backgroundColor: theme.primary,
                opacity: tracks.length > 0 ? 1 : 0.45,
              },
            ]}
            onPress={() => {
              if (tracks[0]) {
                handleSongPress(tracks[0]);
              }
            }}
            activeOpacity={0.75}
            disabled={tracks.length === 0}
          >
            <Ionicons name="play" size={26} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    ),
    [
      detailsLine,
      isLoading,
      playlistDescription,
      playlistImageUrl,
      playlistName,
      sourceLabel,
      theme.backgroundColor,
      theme.isDark,
      theme.primary,
      theme.textSecondary,
      handleSongPress,
      tracks,
    ],
  );

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <StatusBar style={theme.statusBarStyle} />

      {isLoading ? (
        <View style={styles.loadingShell}>
          {renderHeader()}
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.centerText, { color: theme.textSecondary }]}>
              Loading playlist...
            </Text>
          </View>
        </View>
      ) : error ? (
        <View style={styles.loadingShell}>
          {renderHeader()}
          <View style={styles.centerContent}>
            <Ionicons
              name="alert-circle-outline"
              size={56}
              color={theme.error}
            />
            <Text style={[styles.errorTitle, { color: theme.error }]}>
              Playlist Error
            </Text>
            <Text style={[styles.errorText, { color: theme.textSecondary }]}>
              {error}
            </Text>
            <TouchableOpacity
              style={[styles.retryButton, { backgroundColor: theme.primary }]}
              onPress={handleRetry}
              activeOpacity={0.75}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlashList
          ref={listRef}
          data={tracks}
          renderItem={renderTrack}
          keyExtractor={(item, index) => `${item.source}-${item.id}-${index}`}
          ListHeaderComponent={renderHeader}
          ListEmptyComponent={
            <View style={styles.centerContent}>
              <Ionicons
                name="musical-notes-outline"
                size={56}
                color={theme.textLight}
              />
              <Text style={[styles.errorTitle, { color: theme.textColor }]}>
                No Songs
              </Text>
              <Text style={[styles.errorText, { color: theme.textSecondary }]}>
                This playlist does not have playable songs.
              </Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
        />
      )}

      <Animated.View
        pointerEvents={isStickyHeaderInteractive ? "auto" : "none"}
        style={[
          styles.stickyHeader,
          {
            backgroundColor: theme.cardBackground,
            borderBottomColor: theme.border,
            paddingTop: insets.top + 8,
            height: insets.top + 72,
          },
          stickyHeaderStyle,
        ]}
      >
        <TouchableOpacity
          style={styles.stickyBackButton}
          onPress={() => router.back()}
          hitSlop={12}
          activeOpacity={0.75}
        >
          <Ionicons name="chevron-back" size={26} color={theme.textColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.stickyContent}
          onPress={scrollToTop}
          activeOpacity={0.75}
        >
          {playlistImageUrl ? (
            <Image
              source={{ uri: playlistImageUrl }}
              style={[
                styles.stickyArtwork,
                { backgroundColor: theme.isDark ? "#252525" : "#e5e7eb" },
              ]}
            />
          ) : (
            <View
              style={[
                styles.stickyArtwork,
                styles.stickyArtworkFallback,
                { backgroundColor: theme.primary },
              ]}
            >
              <Ionicons name="musical-notes" size={20} color="#fff" />
            </View>
          )}

          <View style={styles.stickyTextContainer}>
            <Text
              style={[styles.stickyTitle, { color: theme.textColor }]}
              numberOfLines={1}
            >
              {playlistName}
            </Text>
            <Text
              style={[styles.stickySubtitle, { color: theme.textSecondary }]}
              numberOfLines={1}
            >
              {detailsLine}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingShell: {
    flex: 1,
  },
  hero: {
    paddingTop: Platform.OS === "ios" ? 64 : 42,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -12,
    marginBottom: 8,
  },
  playlistArtwork: {
    width: 190,
    height: 190,
    borderRadius: 8,
    alignSelf: "center",
    marginBottom: 24,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  playlistFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: {
    gap: 6,
  },
  sourceLabel: {
    color: "rgba(255,255,255,0.86)",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  playlistTitle: {
    color: "#fff",
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "800",
  },
  playlistDescription: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 14,
    lineHeight: 20,
  },
  playlistDetails: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  loadedCount: {
    fontSize: 14,
    fontWeight: "600",
  },
  playAction: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: 3,
  },
  listContent: {
    paddingBottom: 140,
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 9,
    minHeight: 66,
  },
  trackIndex: {
    width: 30,
    textAlign: "center",
    fontSize: 13,
    fontWeight: "600",
  },
  trackArtwork: {
    width: 48,
    height: 48,
    borderRadius: 5,
    marginLeft: 8,
  },
  trackInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 3,
  },
  trackArtist: {
    fontSize: 14,
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  centerText: {
    fontSize: 16,
    marginTop: 14,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 15,
    lineHeight: 21,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 18,
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stickyBackButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  stickyContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  stickyArtwork: {
    width: 42,
    height: 42,
    borderRadius: 6,
  },
  stickyArtworkFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  stickyTextContainer: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 8,
  },
  stickyTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  stickySubtitle: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
  },
});
