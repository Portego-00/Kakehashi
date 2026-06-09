import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import YoutubePlayer from "react-native-youtube-iframe";
import { useTheme } from "../../../src/utils/theme";

export default function YouTubePlayerScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    videoId: string;
    title: string;
    channelTitle: string;
  }>();

  const { width } = Dimensions.get("window");
  const videoHeight = (width * 9) / 16;

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

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
        <Text
          style={[styles.headerTitle, { color: theme.textColor }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {params.title}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Video Player */}
      <View style={styles.playerContainer}>
        <YoutubePlayer
          height={videoHeight}
          videoId={params.videoId}
          play={true}
          webViewProps={{
            allowsFullscreenVideo: true,
          }}
        />
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
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    marginHorizontal: 12,
  },
  headerSpacer: {
    width: 44,
  },
  playerContainer: {
    width: "100%",
    backgroundColor: "#000",
  },
  infoContainer: {
    padding: 16,
  },
  channelTitle: {
    fontSize: 14,
  },
});
