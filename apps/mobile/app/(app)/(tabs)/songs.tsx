import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FlashList } from "@shopify/flash-list";
import { Directory, File, Paths } from "expo-file-system";
import * as FileSystem from "expo-file-system";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Keyboard,
  Platform,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { CoachMarks, CoachMarkStep } from "../../../src/components/CoachMarks";
import { appleMusicService } from "../../../src/services/appleMusicService";
import {
  spotifyService,
  type MusicPlaylist,
  type SpotifyTrack,
} from "../../../src/services/spotifyService";
import { supportsNativeTabs } from "../../../src/utils/nativeTabs";
import { useSettingsStore } from "../../../src/utils/store";
import { useTheme } from "../../../src/utils/theme";
import {
  SONGS_TUTORIAL_STEPS,
  TUTORIAL_STORAGE_KEYS,
} from "../../../src/utils/tutorialSteps";

const CACHE_FILE_NAME = "song-history.json";
const MAX_HISTORY_ITEMS = 20;
const IMAGES_CACHE_DIR = "song-images";
const LYRICS_CACHE_PREFIX = "wanikani_lyrics_v1_";

interface MusicSection {
  title: string;
  subtitle?: string;
  data: SpotifyTrack[];
  loading: boolean;
}

type MusicSource = "spotify" | "apple";

export default function SongsTab() {
  const { theme } = useTheme();
  const inputRef = useRef<TextInput>(null);
  const songsPlaybackSource = useSettingsStore(
    (state) => state.songsPlaybackSource,
  );
  const appleMusicAuthStatus = useSettingsStore(
    (state) => state.appleMusicAuthStatus,
  );
  const spotifyAuthStatus = useSettingsStore(
    (state) => state.spotifyAuthStatus,
  );
  const selectedMusicSource: MusicSource =
    Platform.OS === "ios" && songsPlaybackSource === "appleMusic"
      ? "apple"
      : "spotify";
  const musicSourceLabel =
    selectedMusicSource === "apple" ? "Apple Music" : "Spotify";
  const appleMusicNeedsAuthorization =
    selectedMusicSource === "apple" && appleMusicAuthStatus !== "authorized";
  const spotifyAccountNeedsAuthorization =
    selectedMusicSource === "spotify" && spotifyAuthStatus !== "authorized";
  const spotifyPlaybackNeedsAuthorization =
    selectedMusicSource === "spotify" &&
    songsPlaybackSource === "spotify" &&
    spotifyAuthStatus !== "authorized";
  const spotifyCatalogNeedsAuthorization =
    selectedMusicSource === "spotify" &&
    !spotifyService.hasClientCredentials() &&
    spotifyAuthStatus !== "authorized";
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [songHistory, setSongHistory] = useState<SpotifyTrack[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [importedPlaylists, setImportedPlaylists] = useState<MusicPlaylist[]>(
    [],
  );
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialSteps, setTutorialSteps] = useState<CoachMarkStep[]>([]);
  const searchBarRef = useRef<View>(null);
  const categorySectionRef = useRef<View>(null);

  // Music sections
  const [newReleases, setNewReleases] = useState<MusicSection>({
    title: "New Japanese Releases",
    subtitle: "Fresh tracks from Japan",
    data: [],
    loading: true,
  });
  const [popularSongs, setPopularSongs] = useState<MusicSection>({
    title: "Popular J-Pop",
    subtitle: "Trending Japanese music",
    data: [],
    loading: true,
  });
  const [animeSongs, setAnimeSongs] = useState<MusicSection>({
    title: "Anime Openings & Endings",
    subtitle: "Your favorite anime soundtracks",
    data: [],
    loading: true,
  });

  // Get cached album art URI if exists
  const getCachedAlbumArt = useCallback(
    async (song: SpotifyTrack): Promise<string> => {
      try {
        const cacheDir = new Directory(Paths.cache, "songs");
        const imagesDir = new Directory(cacheDir.uri, IMAGES_CACHE_DIR);
        const filename = `${song.id}.jpg`;
        const localUri = `${imagesDir.uri}/${filename}`;

        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (fileInfo.exists) {
          return localUri;
        }
      } catch {
        // Ignore error and return original URL
      }
      return song.albumArt;
    },
    [],
  );

  // Load song history from cache on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const cacheDir = new Directory(Paths.cache, "songs");
        cacheDir.create({ idempotent: true });

        const historyFile = new File(cacheDir, CACHE_FILE_NAME);

        if (historyFile.exists) {
          const content = await historyFile.text();
          const history = JSON.parse(content) as SpotifyTrack[];

          // Update album art URLs to use cached versions if available
          const historyWithCachedImages = await Promise.all(
            history.map(async (song) => ({
              ...song,
              albumArt: await getCachedAlbumArt(song),
            })),
          );

          setSongHistory(historyWithCachedImages);
          console.log(`✅ Loaded ${history.length} songs from history`);
        }
      } catch (error) {
        console.error("Error loading song history:", error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [getCachedAlbumArt]);

  // Check if tutorial should be shown (first visit)
  useEffect(() => {
    const checkTutorialStatus = async () => {
      try {
        const completed = await AsyncStorage.getItem(
          TUTORIAL_STORAGE_KEYS.SONGS_COMPLETED,
        );
        if (!completed) {
          // Small delay to let the UI render first
          setTimeout(() => {
            measureElementsAndShowTutorial();
          }, 800);
        }
      } catch (error) {
        console.error("Error checking tutorial status:", error);
      }
    };

    checkTutorialStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Measure UI elements and build tutorial steps with targets
  const measureElementsAndShowTutorial = useCallback(() => {
    const steps: CoachMarkStep[] = [];
    // On Android, measureInWindow returns coordinates that don't account for
    // the status bar when used with statusBarTranslucent modals
    const statusBarOffset =
      Platform.OS === "android" ? RNStatusBar.currentHeight || 0 : 0;

    // Step 1: Welcome (no target, centered)
    steps.push({
      ...SONGS_TUTORIAL_STEPS[0],
      target: null,
    });

    // Step 2: Search bar
    if (searchBarRef.current) {
      searchBarRef.current.measureInWindow((x, y, width, height) => {
        steps.push({
          ...SONGS_TUTORIAL_STEPS[1],
          target: { x, y: y + statusBarOffset, width, height },
        });

        // Step 3: Categories section
        if (categorySectionRef.current) {
          categorySectionRef.current.measureInWindow((cx, cy, cw, ch) => {
            steps.push({
              ...SONGS_TUTORIAL_STEPS[2],
              target: { x: cx, y: cy + statusBarOffset, width: cw, height: ch },
            });

            setTutorialSteps(steps);
            setShowTutorial(true);
          });
        } else {
          // If no category section ref, just use the steps we have
          setTutorialSteps(steps);
          setShowTutorial(true);
        }
      });
    } else {
      // Fallback: show tutorial without specific targets
      const fallbackSteps = SONGS_TUTORIAL_STEPS.map((step) => ({
        ...step,
        target: null,
      }));
      setTutorialSteps(fallbackSteps);
      setShowTutorial(true);
    }
  }, []);

  // Handle tutorial completion
  const handleTutorialComplete = useCallback(async () => {
    setShowTutorial(false);
    try {
      await AsyncStorage.setItem(TUTORIAL_STORAGE_KEYS.SONGS_COMPLETED, "true");
    } catch (error) {
      console.error("Error saving tutorial completion:", error);
    }
  }, []);

  // Clear lyrics and video cache for testing
  const handleClearLyricsCache = useCallback(async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const lyricsKeys = allKeys.filter((key) =>
        key.startsWith(LYRICS_CACHE_PREFIX),
      );

      if (lyricsKeys.length > 0) {
        await AsyncStorage.multiRemove(lyricsKeys);
        console.log(
          `🗑️ Cleared ${lyricsKeys.length} cached lyrics/video entries`,
        );
        alert(`Cleared ${lyricsKeys.length} cached songs`);
      } else {
        console.log("No lyrics cache to clear");
        alert("No cached songs to clear");
      }
    } catch (error) {
      console.error("Error clearing lyrics cache:", error);
      alert("Failed to clear cache");
    }
  }, []);

  const clearSongHistory = useCallback(() => {
    try {
      const cacheDir = new Directory(Paths.cache, "songs");
      const historyFile = new File(cacheDir, CACHE_FILE_NAME);

      if (historyFile.exists) {
        historyFile.delete();
      }

      setSongHistory([]);
      console.log("🗑️ Cleared song history");
    } catch (error) {
      console.error("Error clearing song history:", error);
      Alert.alert("Failed to clear history", "Please try again.");
    }
  }, []);

  const handleConfirmClearHistory = useCallback(() => {
    Alert.alert(
      "Clear listening history?",
      "This will remove your recently played songs from this device.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear", style: "destructive", onPress: clearSongHistory },
      ],
    );
  }, [clearSongHistory]);

  // Load music sections
  useEffect(() => {
    const loadMusicSections = async () => {
      if (
        selectedMusicSource === "apple" &&
        appleMusicAuthStatus !== "authorized"
      ) {
        setNewReleases((prev) => ({ ...prev, data: [], loading: false }));
        setPopularSongs((prev) => ({ ...prev, data: [], loading: false }));
        setAnimeSongs((prev) => ({ ...prev, data: [], loading: false }));
        return;
      }

      if (
        spotifyPlaybackNeedsAuthorization ||
        spotifyCatalogNeedsAuthorization
      ) {
        setNewReleases((prev) => ({ ...prev, data: [], loading: false }));
        setPopularSongs((prev) => ({ ...prev, data: [], loading: false }));
        setAnimeSongs((prev) => ({ ...prev, data: [], loading: false }));
        return;
      }

      const service =
        selectedMusicSource === "apple" ? appleMusicService : spotifyService;
      const sectionLimit = selectedMusicSource === "apple" ? 24 : 20;

      setNewReleases((prev) => ({ ...prev, data: [], loading: true }));
      setPopularSongs((prev) => ({ ...prev, data: [], loading: true }));
      setAnimeSongs((prev) => ({ ...prev, data: [], loading: true }));

      const [releasesResult, popularResult, animeResult] =
        await Promise.allSettled([
          service.getNewJapaneseReleases(sectionLimit),
          service.getPopularJapaneseSongs(sectionLimit),
          service.getAnimeSongs(sectionLimit),
        ]);

      if (releasesResult.status === "fulfilled") {
        setNewReleases((prev) => ({
          ...prev,
          data: releasesResult.value,
          loading: false,
        }));
      } else {
        console.error("Error loading new releases:", releasesResult.reason);
        setNewReleases((prev) => ({ ...prev, loading: false }));
      }

      if (popularResult.status === "fulfilled") {
        setPopularSongs((prev) => ({
          ...prev,
          data: popularResult.value,
          loading: false,
        }));
      } else {
        console.error("Error loading popular songs:", popularResult.reason);
        setPopularSongs((prev) => ({ ...prev, loading: false }));
      }

      if (animeResult.status === "fulfilled") {
        setAnimeSongs((prev) => ({
          ...prev,
          data: animeResult.value,
          loading: false,
        }));
      } else {
        console.error("Error loading anime songs:", animeResult.reason);
        setAnimeSongs((prev) => ({ ...prev, loading: false }));
      }
    };

    if (!hasSearched) {
      loadMusicSections();
    }
  }, [
    hasSearched,
    selectedMusicSource,
    appleMusicAuthStatus,
    spotifyPlaybackNeedsAuthorization,
    spotifyCatalogNeedsAuthorization,
  ]);

  useEffect(() => {
    let didCancel = false;

    const loadImportedPlaylists = async () => {
      if (
        selectedMusicSource === "apple" &&
        appleMusicAuthStatus !== "authorized"
      ) {
        setImportedPlaylists([]);
        setIsLoadingPlaylists(false);
        return;
      }

      if (
        selectedMusicSource === "spotify" &&
        spotifyAuthStatus !== "authorized"
      ) {
        setImportedPlaylists([]);
        setIsLoadingPlaylists(false);
        return;
      }

      const service =
        selectedMusicSource === "apple" ? appleMusicService : spotifyService;

      setIsLoadingPlaylists(true);
      try {
        const playlists = await service.getUserPlaylists(20);
        if (!didCancel) {
          setImportedPlaylists(playlists);
        }
      } catch (playlistError) {
        console.error("Error loading imported playlists:", playlistError);
        if (!didCancel) {
          setImportedPlaylists([]);
        }
      } finally {
        if (!didCancel) {
          setIsLoadingPlaylists(false);
        }
      }
    };

    void loadImportedPlaylists();

    return () => {
      didCancel = true;
    };
  }, [selectedMusicSource, appleMusicAuthStatus, spotifyAuthStatus]);

  // Cache album art image
  const cacheAlbumArt = useCallback(
    async (song: SpotifyTrack): Promise<string> => {
      try {
        const cacheDir = new Directory(Paths.cache, "songs");
        cacheDir.create({ idempotent: true });

        const imagesDir = new Directory(cacheDir.uri, IMAGES_CACHE_DIR);
        imagesDir.create({ idempotent: true });

        // Create a safe filename from the song ID
        const filename = `${song.id}.jpg`;
        const localUri = `${imagesDir.uri}/${filename}`;

        // Check if image already exists
        const fileInfo = await FileSystem.getInfoAsync(localUri);
        if (fileInfo.exists) {
          return localUri;
        }

        // Download and cache the image
        const downloadResult = await FileSystem.downloadAsync(
          song.albumArt,
          localUri,
        );

        if (downloadResult.status === 200) {
          console.log(`✅ Cached album art for ${song.title}`);
          return localUri;
        }

        return song.albumArt; // Fallback to original URL
      } catch (error) {
        console.error("Error caching album art:", error);
        return song.albumArt; // Fallback to original URL
      }
    },
    [],
  );

  // Save song history to cache
  const saveHistory = useCallback(
    async (history: SpotifyTrack[]) => {
      try {
        const cacheDir = new Directory(Paths.cache, "songs");
        cacheDir.create({ idempotent: true });

        const historyFile = new File(cacheDir, CACHE_FILE_NAME);
        historyFile.write(JSON.stringify(history, null, 2));

        console.log(`✅ Saved ${history.length} songs to history`);

        // Cache album art for all songs in history
        history.forEach((song) => {
          cacheAlbumArt(song);
        });
      } catch (error) {
        console.error("Error saving song history:", error);
      }
    },
    [cacheAlbumArt],
  );

  // Add song to history (called when user clicks on a song)
  const addToHistory = useCallback(
    (song: SpotifyTrack) => {
      setSongHistory((prevHistory) => {
        // Remove the song if it already exists in history
        const filteredHistory = prevHistory.filter((s) => s.id !== song.id);

        // Add song to the beginning
        const newHistory = [song, ...filteredHistory].slice(
          0,
          MAX_HISTORY_ITEMS,
        );

        // Save to cache
        saveHistory(newHistory);

        return newHistory;
      });
    },
    [saveHistory],
  );

  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        setHasSearched(false);
        return;
      }

      // Check if Spotify credentials are available when Spotify is selected.
      if (
        selectedMusicSource === "spotify" &&
        spotifyPlaybackNeedsAuthorization
      ) {
        setError(
          "Connect Spotify in Settings first, then try searching again.",
        );
        return;
      }

      if (
        selectedMusicSource === "spotify" &&
        !spotifyService.hasClientCredentials() &&
        spotifyAuthStatus !== "authorized"
      ) {
        setError(
          "Connect Spotify in Settings, or add EXPO_PUBLIC_SPOTIFY_CLIENT_KEY for anonymous catalog search.",
        );
        return;
      }

      if (
        selectedMusicSource === "apple" &&
        appleMusicAuthStatus !== "authorized"
      ) {
        setError(
          "Authorize Apple Music in Settings first, then try searching again.",
        );
        return;
      }

      try {
        setIsSearching(true);
        setError(null);
        setHasSearched(true);
        const service =
          selectedMusicSource === "apple" ? appleMusicService : spotifyService;

        const results = await service.searchTracks(query.trim());
        setSearchResults(results);
      } catch (err) {
        console.error("Error searching songs:", err);
        setError(
          `Failed to search ${musicSourceLabel} songs. Please try again.`,
        );
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [
      selectedMusicSource,
      musicSourceLabel,
      appleMusicAuthStatus,
      spotifyAuthStatus,
      spotifyPlaybackNeedsAuthorization,
    ],
  );

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  const handleSongPress = useCallback(
    (song: SpotifyTrack) => {
      const trackSource: MusicSource =
        song.source === "apple" || song.id.startsWith("apple-")
          ? "apple"
          : "spotify";

      // Add to history
      addToHistory(song);

      // Navigate to lyrics screen
      router.push({
        pathname: "/song-lyrics",
        params: {
          songId: song.id,
          songTitle: song.title,
          artist: song.artist,
          albumArt: song.albumArt,
          songUrl: song.url,
          duration: song.duration.toString(),
          musicSource: trackSource,
        },
      });
    },
    [addToHistory],
  );

  const handlePlaylistPress = useCallback(
    (playlist: MusicPlaylist) => {
      if (playlist.source === "spotify" && spotifyAuthStatus !== "authorized") {
        setError("Connect Spotify in Settings first, then import playlists.");
        return;
      }

      if (
        playlist.source === "apple" &&
        appleMusicAuthStatus !== "authorized"
      ) {
        setError(
          "Authorize Apple Music in Settings first, then import playlists.",
        );
        return;
      }

      router.push({
        pathname: "/playlist-detail",
        params: {
          playlistId: playlist.id,
          playlistName: playlist.name,
          playlistImageUrl: playlist.imageUrl,
          playlistDescription: playlist.description,
          playlistOwnerName: playlist.ownerName || "",
          playlistSource: playlist.source,
          playlistTrackCount: String(playlist.trackCount),
        },
      });
    },
    [appleMusicAuthStatus, spotifyAuthStatus],
  );

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults([]);
    setError(null);
    setHasSearched(false);
    // Clear the input using ref (for uncontrolled input)
    inputRef.current?.clear();
  }, []);

  // Switching source should refresh search context.
  useEffect(() => {
    setSearchResults([]);
    setHasSearched(false);
    setError(null);
    setSearchQuery("");
    inputRef.current?.clear();
  }, [selectedMusicSource]);

  // Horizontal carousel item for recently played (square cards)
  const renderRecentlyPlayedItem = ({ item }: { item: SpotifyTrack }) => (
    <TouchableOpacity
      style={styles.recentlyPlayedCard}
      onPress={() => handleSongPress(item)}
      activeOpacity={0.7}
    >
      <Image source={{ uri: item.albumArt }} style={styles.recentlyPlayedArt} />
      <View style={styles.recentlyPlayedOverlay}>
        <Text
          style={[styles.recentlyPlayedTitle, { color: "#fff" }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text
          style={[
            styles.recentlyPlayedArtist,
            { color: "rgba(255,255,255,0.9)" },
          ]}
          numberOfLines={1}
        >
          {item.artist}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderPlaylistCard = ({ item }: { item: MusicPlaylist }) => (
    <TouchableOpacity
      style={[
        styles.playlistCard,
        { backgroundColor: theme.cardBackground, borderColor: theme.border },
      ]}
      onPress={() => {
        void handlePlaylistPress(item);
      }}
      activeOpacity={0.7}
    >
      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={styles.playlistArt} />
      ) : (
        <View
          style={[
            styles.playlistArt,
            styles.playlistArtFallback,
            { backgroundColor: theme.primary },
          ]}
        >
          <Ionicons name="musical-notes" size={28} color="#fff" />
        </View>
      )}
      <View style={styles.playlistInfo}>
        <Text
          style={[styles.playlistTitle, { color: theme.textColor }]}
          numberOfLines={2}
        >
          {item.name}
        </Text>
        <View style={styles.playlistMetaRow}>
          <View
            style={[
              styles.playlistSourcePill,
              {
                backgroundColor:
                  item.source === "spotify" ? "#1DB954" : "#FA2D48",
              },
            ]}
          >
            <Text style={styles.playlistSourceText}>
              {item.source === "spotify" ? "Spotify" : "Apple"}
            </Text>
          </View>
          <Text
            style={[styles.playlistSubtitle, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {item.trackCount} song{item.trackCount === 1 ? "" : "s"}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </TouchableOpacity>
  );

  // Horizontal card for suggested sections (3 rows visible, horizontal layout)
  const renderHorizontalSongCard = ({ item }: { item: SpotifyTrack }) => (
    <TouchableOpacity
      style={[
        styles.horizontalSongCard,
        { backgroundColor: theme.cardBackground },
      ]}
      onPress={() => handleSongPress(item)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.albumArt }}
        style={[
          styles.horizontalCardImage,
          { backgroundColor: theme.isDark ? "#333" : "#e0e0e0" },
        ]}
      />
      <View style={styles.horizontalCardInfo}>
        <Text
          style={[styles.horizontalCardTitle, { color: theme.textColor }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text
          style={[styles.horizontalCardArtist, { color: theme.textSecondary }]}
          numberOfLines={1}
        >
          {item.artist}
        </Text>
      </View>
    </TouchableOpacity>
  );

  // Standard card for search results
  const renderSongCard = ({ item }: { item: SpotifyTrack }) => (
    <TouchableOpacity
      style={[
        styles.songCard,
        { backgroundColor: theme.cardBackground, borderColor: theme.border },
      ]}
      onPress={() => handleSongPress(item)}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.albumArt }}
        style={[
          styles.albumArt,
          { backgroundColor: theme.isDark ? "#333" : "#e0e0e0" },
        ]}
      />
      <View style={styles.songInfo}>
        <Text
          style={[styles.songTitle, { color: theme.textColor }]}
          numberOfLines={2}
        >
          {item.title}
        </Text>
        <Text
          style={[styles.artistName, { color: theme.textSecondary }]}
          numberOfLines={1}
        >
          {item.artist}
        </Text>
        <Text
          style={[styles.albumName, { color: theme.textLight }]}
          numberOfLines={1}
        >
          {item.albumName}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
    </TouchableOpacity>
  );

  const { width } = Dimensions.get("window");
  const isTablet = width > 768;

  // Render search results view
  const renderSearchResults = () => (
    <View style={styles.searchResultsContainer}>
      {isSearching ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.centerText, { color: theme.textSecondary }]}>
            {`Searching ${musicSourceLabel}...`}
          </Text>
        </View>
      ) : searchResults.length === 0 ? (
        <View style={styles.centerContent}>
          <Ionicons name="search-outline" size={64} color={theme.textLight} />
          <Text style={[styles.emptyTitle, { color: theme.textColor }]}>
            No Songs Found
          </Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Try a different search term
          </Text>
        </View>
      ) : (
        <View style={styles.resultsList}>
          <Text style={[styles.resultsCount, { color: theme.textSecondary }]}>
            Found {searchResults.length} song
            {searchResults.length !== 1 ? "s" : ""}
          </Text>
          <FlashList
            data={searchResults}
            renderItem={renderSongCard}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            onScrollBeginDrag={Keyboard.dismiss}
          />
        </View>
      )}
    </View>
  );

  // Render home view with carousels
  const renderHomeView = () => (
    <ScrollView
      style={styles.homeScrollView}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.homeContent}
      keyboardShouldPersistTaps="handled"
      onScrollBeginDrag={Keyboard.dismiss}
    >
      {/* Recently Played Horizontal Carousel */}
      {!isLoadingHistory && songHistory.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                Recently Played
              </Text>
              <Text
                style={[styles.sectionSubtitle, { color: theme.textSecondary }]}
              >
                Your listening history
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleConfirmClearHistory}
              style={styles.sectionActionButton}
              activeOpacity={0.7}
            >
              <Ionicons
                name="trash-outline"
                size={16}
                color={theme.textSecondary}
              />
              <Text
                style={[
                  styles.sectionActionText,
                  { color: theme.textSecondary },
                ]}
              >
                Clear
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalScrollContent}
          >
            {songHistory.map((song) => (
              <View key={song.id}>
                {renderRecentlyPlayedItem({ item: song })}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {(isLoadingPlaylists ||
        importedPlaylists.length > 0 ||
        spotifyAccountNeedsAuthorization ||
        appleMusicNeedsAuthorization) && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
                Your {musicSourceLabel} Playlists
              </Text>
              <Text
                style={[styles.sectionSubtitle, { color: theme.textSecondary }]}
              >
                Import tracks into lyrics practice
              </Text>
            </View>
          </View>
          {isLoadingPlaylists ? (
            <ActivityIndicator
              size="small"
              color={theme.primary}
              style={styles.sectionLoader}
            />
          ) : importedPlaylists.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalCardsContent}
            >
              <View style={styles.playlistGridContainer}>
                {importedPlaylists.map((playlist) => (
                  <View key={`${playlist.source}-${playlist.id}`}>
                    {renderPlaylistCard({ item: playlist })}
                  </View>
                ))}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.offlineContainer}>
              <Ionicons
                name="albums-outline"
                size={48}
                color={theme.textLight}
              />
              <Text
                style={[styles.offlineText, { color: theme.textSecondary }]}
              >
                {appleMusicNeedsAuthorization
                  ? "Authorize Apple Music in Settings to import playlists"
                  : spotifyAccountNeedsAuthorization
                    ? "Connect Spotify in Settings to import playlists"
                    : "No playlists found"}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* New Japanese Releases */}
      <View ref={categorySectionRef} style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
              {newReleases.title}
            </Text>
            {newReleases.subtitle && (
              <Text
                style={[styles.sectionSubtitle, { color: theme.textSecondary }]}
              >
                {newReleases.subtitle}
              </Text>
            )}
          </View>
        </View>
        {newReleases.loading ? (
          <ActivityIndicator
            size="small"
            color={theme.primary}
            style={styles.sectionLoader}
          />
        ) : newReleases.data.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalCardsContent}
          >
            <View style={styles.gridContainer}>
              {newReleases.data.map((song) => (
                <View key={song.id}>
                  {renderHorizontalSongCard({ item: song })}
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.offlineContainer}>
            <Ionicons
              name="cloud-offline-outline"
              size={48}
              color={theme.textLight}
            />
            <Text style={[styles.offlineText, { color: theme.textSecondary }]}>
              {appleMusicNeedsAuthorization
                ? "Authorize Apple Music in Settings to load songs"
                : spotifyPlaybackNeedsAuthorization ||
                    spotifyCatalogNeedsAuthorization
                  ? "Connect Spotify in Settings to load songs"
                  : "Connect to WiFi to discover new music"}
            </Text>
          </View>
        )}
      </View>

      {/* Popular J-Pop */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
              {popularSongs.title}
            </Text>
            {popularSongs.subtitle && (
              <Text
                style={[styles.sectionSubtitle, { color: theme.textSecondary }]}
              >
                {popularSongs.subtitle}
              </Text>
            )}
          </View>
        </View>
        {popularSongs.loading ? (
          <ActivityIndicator
            size="small"
            color={theme.primary}
            style={styles.sectionLoader}
          />
        ) : popularSongs.data.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalCardsContent}
          >
            <View style={styles.gridContainer}>
              {popularSongs.data.map((song) => (
                <View key={song.id}>
                  {renderHorizontalSongCard({ item: song })}
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.offlineContainer}>
            <Ionicons
              name="cloud-offline-outline"
              size={48}
              color={theme.textLight}
            />
            <Text style={[styles.offlineText, { color: theme.textSecondary }]}>
              {appleMusicNeedsAuthorization
                ? "Authorize Apple Music in Settings to load songs"
                : spotifyPlaybackNeedsAuthorization ||
                    spotifyCatalogNeedsAuthorization
                  ? "Connect Spotify in Settings to load songs"
                  : "Connect to WiFi to discover new music"}
            </Text>
          </View>
        )}
      </View>

      {/* Anime Music */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
              {animeSongs.title}
            </Text>
            {animeSongs.subtitle && (
              <Text
                style={[styles.sectionSubtitle, { color: theme.textSecondary }]}
              >
                {animeSongs.subtitle}
              </Text>
            )}
          </View>
        </View>
        {animeSongs.loading ? (
          <ActivityIndicator
            size="small"
            color={theme.primary}
            style={styles.sectionLoader}
          />
        ) : animeSongs.data.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.horizontalCardsContent}
          >
            <View style={styles.gridContainer}>
              {animeSongs.data.map((song) => (
                <View key={song.id}>
                  {renderHorizontalSongCard({ item: song })}
                </View>
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.offlineContainer}>
            <Ionicons
              name="cloud-offline-outline"
              size={48}
              color={theme.textLight}
            />
            <Text style={[styles.offlineText, { color: theme.textSecondary }]}>
              {appleMusicNeedsAuthorization
                ? "Authorize Apple Music in Settings to load songs"
                : spotifyPlaybackNeedsAuthorization ||
                    spotifyCatalogNeedsAuthorization
                  ? "Connect Spotify in Settings to load songs"
                  : "Connect to WiFi to discover new music"}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

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
            backgroundColor: theme.backgroundColor,
            paddingTop: supportsNativeTabs() && isTablet ? 60 + 20 : 60,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>
          Music
        </Text>
        {__DEV__ && (
          <TouchableOpacity
            onPress={handleClearLyricsCache}
            style={styles.clearCacheButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name="trash-outline"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View
          ref={searchBarRef}
          style={[
            styles.searchBar,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: theme.textColor }]}
            placeholder={`Search ${musicSourceLabel} songs...`}
            placeholderTextColor={theme.textSecondary}
            defaultValue={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={handleClearSearch} activeOpacity={0.7}>
              <Ionicons
                name="close-circle"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}
          {isSearching && (
            <ActivityIndicator size="small" color={theme.primary} />
          )}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {error ? (
          <View style={styles.centerContent}>
            <Ionicons
              name="alert-circle-outline"
              size={64}
              color={theme.error}
            />
            <Text style={[styles.emptyTitle, { color: theme.error }]}>
              Error
            </Text>
            <Text
              style={[styles.emptySubtitle, { color: theme.textSecondary }]}
            >
              {error}
            </Text>
          </View>
        ) : hasSearched ? (
          renderSearchResults()
        ) : (
          renderHomeView()
        )}
      </View>

      {/* Tutorial Coach Marks */}
      <CoachMarks
        steps={tutorialSteps}
        visible={showTutorial}
        onComplete={handleTutorialComplete}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 4,
  },
  clearCacheButton: {
    padding: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: "100%",
  },
  content: {
    flex: 1,
  },
  homeScrollView: {
    flex: 1,
  },
  homeContent: {
    paddingBottom: 180,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
  },
  sectionActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  sectionActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  sectionLoader: {
    paddingVertical: 20,
  },
  horizontalScrollContent: {
    paddingLeft: 16,
    paddingRight: 16,
    gap: 12,
  },
  recentlyPlayedCard: {
    width: 140,
    height: 140,
    borderRadius: 12,
    overflow: "hidden",
    marginRight: 12,
    position: "relative",
  },
  recentlyPlayedArt: {
    width: 140,
    height: 140,
    backgroundColor: "#333",
  },
  recentlyPlayedOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
    padding: 8,
    paddingTop: 12,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  recentlyPlayedTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  recentlyPlayedArtist: {
    fontSize: 10,
    fontWeight: "500",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  playlistCard: {
    width: Dimensions.get("window").width * 0.75,
    height: 88,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  playlistArt: {
    width: 64,
    height: 64,
    borderRadius: 8,
  },
  playlistArtFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  playlistInfo: {
    flex: 1,
  },
  playlistTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  playlistSubtitle: {
    fontSize: 12,
    flexShrink: 1,
  },
  playlistMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  playlistSourcePill: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  playlistSourceText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  horizontalCardsContent: {
    paddingLeft: 16,
    paddingRight: 16,
  },
  playlistGridContainer: {
    flexDirection: "column",
    flexWrap: "wrap",
    height: 192,
    gap: 12,
  },
  gridContainer: {
    flexDirection: "column",
    flexWrap: "wrap",
    height: 210,
    gap: 12,
  },
  horizontalSongCard: {
    width: Dimensions.get("window").width * 0.75,
    height: 60,
    borderRadius: 12,
    overflow: "hidden",
    flexDirection: "row",
  },
  horizontalCardImage: {
    width: 60,
    height: 60,
    backgroundColor: "#333",
  },
  horizontalCardInfo: {
    flex: 1,
    padding: 8,
    justifyContent: "center",
  },
  horizontalCardTitle: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 2,
  },
  horizontalCardArtist: {
    fontSize: 10,
  },
  verticalList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  songCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  albumArt: {
    width: 60,
    height: 60,
    borderRadius: 8,
  },
  songInfo: {
    flex: 1,
    marginLeft: 12,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  artistName: {
    fontSize: 14,
    marginBottom: 4,
  },
  albumName: {
    fontSize: 12,
    fontStyle: "italic",
  },
  noDataText: {
    paddingHorizontal: 16,
    fontSize: 14,
    fontStyle: "italic",
  },
  searchResultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  resultsList: {
    flex: 1,
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 12,
  },
  listContent: {
    paddingBottom: 120,
  },
  centerContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  centerText: {
    fontSize: 16,
    marginTop: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  offlineContainer: {
    paddingHorizontal: 16,
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  offlineText: {
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
  },
});
