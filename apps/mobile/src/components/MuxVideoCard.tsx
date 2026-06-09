import React, { memo } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../utils/theme";

interface MuxVideoCardProps {
  title: string;
  description?: string;
  thumbnailUrl: string;
  duration?: number;
  onPress: () => void;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function MuxVideoCardComponent({
  title,
  description,
  thumbnailUrl,
  duration,
  onPress,
}: MuxVideoCardProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.cardBackground }]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.thumbnailContainer}>
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
        {duration !== undefined && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          </View>
        )}
      </View>
      <View style={styles.infoContainer}>
        <Text
          style={[styles.title, { color: theme.textColor }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
        {description && (
          <Text
            style={[styles.description, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {description}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export const MuxVideoCard = memo(MuxVideoCardComponent);

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: "rgba(0,0,0,0.08)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  thumbnailContainer: {
    position: "relative",
    width: "100%",
    aspectRatio: 16 / 9,
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  durationBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.8)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  durationText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  infoContainer: {
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
  },
});
