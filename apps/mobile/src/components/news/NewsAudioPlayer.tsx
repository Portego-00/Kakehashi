import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../utils/theme";

interface NewsAudioPlayerProps {
  visible: boolean;
  isPlaying: boolean;
  duration: number; // in milliseconds
  position: number; // in milliseconds
  onPlayPause: () => void;
  onSeek: (value: number) => void;
  onForward: () => void;
  onRewind: () => void;
  onClose: () => void;
}

const { width } = Dimensions.get("window");

export const NewsAudioPlayer: React.FC<NewsAudioPlayerProps> = ({
  visible,
  isPlaying,
  duration,
  position,
  onPlayPause,
  onSeek,
  onForward,
  onRewind,
  onClose,
}) => {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(100)).current; // Start hidden (offset 100)

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 200, // 0 = visible, 200 = hidden below screen
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  }, [visible]);

  const formatTime = (millis: number) => {
    if (!millis || millis < 0) return "0:00";
    const totalSeconds = Math.floor(millis / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // We rely on the parent to unmount or just let it animate off-screen.

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.cardBackground,
          borderTopColor: theme.border,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      {/* Top Row: Time and Close */}
      <View style={styles.headerRow}>
        <View style={styles.timeContainer}>
          <Text style={[styles.timeText, { color: theme.textSecondary }]}>
            {formatTime(position)} / {formatTime(duration)}
          </Text>
        </View>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Slider */}
      <View style={styles.sliderRow}>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={duration || 1}
          value={position}
          onSlidingComplete={onSeek}
          minimumTrackTintColor={theme.primary}
          maximumTrackTintColor={theme.border}
          thumbTintColor={theme.primary}
        />
      </View>

      {/* Controls Row */}
      <View style={styles.controlsRow}>
        <TouchableOpacity onPress={onRewind} style={styles.controlButton}>
          <MaterialIcons name="replay-10" size={32} color={theme.textColor} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onPlayPause}
          style={[styles.playButton, { backgroundColor: theme.primary }]}
        >
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={32}
            color="#fff" // Always white on primary
          />
        </TouchableOpacity>

        <TouchableOpacity onPress={onForward} style={styles.controlButton}>
          <MaterialIcons name="forward-10" size={32} color={theme.textColor} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 30, // Floating margin
    left: 12,
    right: 12,
    paddingVertical: 16, // Clean vertical padding
    paddingHorizontal: 16,
    borderRadius: 16, // Rounded corners
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 }, // More natural shadow
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 100,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  timeContainer: {
    flex: 1,
  },
  timeText: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  closeButton: {
    padding: 4,
  },
  sliderRow: {
    marginBottom: 8,
  },
  slider: {
    width: "100%",
    height: 40,
  },
  controlsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 32,
  },
  controlButton: {
    padding: 8,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2e8b57", // We'll override this with theme.primary in component, actually let's hardcode for now then use style prop
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
});
