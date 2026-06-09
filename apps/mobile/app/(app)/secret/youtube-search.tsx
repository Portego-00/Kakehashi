import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YouTubeVideoCard } from "../../../src/components/YouTubeVideoCard";
import {
  youtubeService,
  YouTubeSearchResult,
} from "../../../src/services/youtubeService";
import { useTheme } from "../../../src/utils/theme";

export default function YouTubeSearchScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const textInputRef = useRef<TextInput>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Focus search input on mount
  useEffect(() => {
    const timeout = setTimeout(() => {
      textInputRef.current?.focus();
    }, 100);
    return () => clearTimeout(timeout);
  }, []);

  const performSearch = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) return;

    Keyboard.dismiss();
    setIsLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const searchResults = await youtubeService.searchAllVideos(query, 20);
      setResults(searchResults);
    } catch (err) {
      console.error("YouTube search error:", err);
      setError("Failed to search videos. Please try again.");
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery]);

  const handleVideoPress = useCallback(
    (video: YouTubeSearchResult) => {
      router.push({
        pathname: "/secret/youtube-player",
        params: {
          videoId: video.videoId,
          title: video.title,
          channelTitle: video.channelTitle,
        },
      });
    },
    [router]
  );

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleScrollBeginDrag = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const renderVideo = useCallback(
    ({ item }: { item: YouTubeSearchResult }) => (
      <YouTubeVideoCard
        videoId={item.videoId}
        title={item.title}
        channelTitle={item.channelTitle}
        thumbnailUrl={item.thumbnailUrl}
        duration={item.duration}
        onPress={() => handleVideoPress(item)}
      />
    ),
    [handleVideoPress]
  );

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.statusText, { color: theme.textSecondary }]}>
            Searching...
          </Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={performSearch}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (hasSearched && results.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <Ionicons name="videocam-off-outline" size={48} color={theme.textLight} />
          <Text style={[styles.statusText, { color: theme.textSecondary }]}>
            No videos found
          </Text>
          <Text style={[styles.subText, { color: theme.textLight }]}>
            Try a different search term
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Ionicons name="logo-youtube" size={64} color="#FF0000" />
        <Text style={[styles.welcomeText, { color: theme.textColor }]}>
          Secret YouTube
        </Text>
        <Text style={[styles.subText, { color: theme.textSecondary }]}>
          Search for any video to watch
        </Text>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundColor,
          paddingTop: insets.top,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.cardBackground }]}
          onPress={handleBack}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <View
          style={[
            styles.searchInputContainer,
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
            ref={textInputRef}
            style={[styles.searchInput, { color: theme.textColor }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search YouTube..."
            placeholderTextColor={theme.textSecondary}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={performSearch}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.searchButton,
            {
              backgroundColor: searchQuery.trim()
                ? theme.primary
                : theme.cardBackground,
            },
          ]}
          onPress={performSearch}
          activeOpacity={0.7}
          disabled={!searchQuery.trim() || isLoading}
        >
          <Ionicons
            name="search"
            size={22}
            color={searchQuery.trim() ? "white" : theme.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {/* Content */}
      {results.length > 0 ? (
        <FlatList
          data={results}
          renderItem={renderVideo}
          keyExtractor={(item) => item.videoId}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={handleScrollBeginDrag}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        renderEmptyState()
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "rgba(0,0,0,0.08)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    borderWidth: 1,
    shadowColor: "rgba(0,0,0,0.05)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: 44,
  },
  searchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "rgba(0,0,0,0.08)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 32,
  },
  centerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 16,
  },
  statusText: {
    fontSize: 16,
    marginTop: 16,
  },
  subText: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 16,
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
});
