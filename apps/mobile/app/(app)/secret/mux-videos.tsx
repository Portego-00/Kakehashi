import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MuxVideoCard } from "../../../src/components/MuxVideoCard";
import { muxService, MuxVideo } from "../../../src/services/muxService";
import { useTheme } from "../../../src/utils/theme";

export default function MuxVideosScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [videos, setVideos] = useState<MuxVideo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVideos = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const fetchedVideos = await muxService.getVideos();
      setVideos(fetchedVideos);
    } catch (err) {
      console.error("Error loading MUX videos:", err);
      setError("Failed to load videos. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleVideoPress = useCallback(
    (video: MuxVideo) => {
      router.push({
        pathname: "/secret/mux-player",
        params: {
          playbackId: video.playbackId,
          title: video.title,
          trackId: video.trackId || "",
        },
      });
    },
    [router]
  );

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const renderVideo = useCallback(
    ({ item }: { item: MuxVideo }) => (
      <MuxVideoCard
        title={item.title}
        description={item.description}
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
            Loading videos...
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
            onPress={loadVideos}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.centerContainer}>
        <Ionicons name="videocam-off-outline" size={48} color={theme.textLight} />
        <Text style={[styles.statusText, { color: theme.textSecondary }]}>
          No videos available
        </Text>
        <Text style={[styles.subText, { color: theme.textLight }]}>
          Add videos to your Supabase mux_videos table
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
        <View style={styles.headerTitleContainer}>
          <Ionicons name="play-circle" size={24} color="#E50914" />
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>
            Secret Videos
          </Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      {videos.length > 0 ? (
        <FlatList
          data={videos}
          renderItem={renderVideo}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
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
  headerTitleContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerSpacer: {
    width: 44,
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
