import { format } from "date-fns";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { GestureResponderEvent } from "react-native";
import { NhkEasyItem } from "../../services/NhkEasyService";
import { useTheme } from "../../utils/theme";

interface NewsCardProps {
  item: NhkEasyItem;
  onPress: (item: NhkEasyItem) => void;
  variant?: "breaking" | "standard";
  knownKanjiPercentage?: number;
  disablePress?: boolean;
}

const BREAKING_HEIGHT = 230;
const MAX_TAP_MOVEMENT_PX = 8;

export const NewsCard: React.FC<NewsCardProps> = ({
  item,
  onPress,
  variant = "standard",
  knownKanjiPercentage,
  disablePress = false,
}) => {
  const { theme } = useTheme();
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);
  const movedBeyondTapThresholdRef = useRef(false);
  const formattedDate = item.pubDate
    ? format(new Date(item.pubDate), "MMM d, yyyy")
    : "";

  const handlePressIn = (event: GestureResponderEvent) => {
    movedBeyondTapThresholdRef.current = false;
    pressStartRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };
  };

  const handleTouchMove = (event: GestureResponderEvent) => {
    if (!pressStartRef.current || movedBeyondTapThresholdRef.current) {
      return;
    }

    const dx = event.nativeEvent.pageX - pressStartRef.current.x;
    const dy = event.nativeEvent.pageY - pressStartRef.current.y;
    const movement = Math.hypot(dx, dy);

    if (movement > MAX_TAP_MOVEMENT_PX) {
      movedBeyondTapThresholdRef.current = true;
    }
  };

  const handleBreakingPress = () => {
    if (disablePress || movedBeyondTapThresholdRef.current) {
      return;
    }

    onPress(item);
  };

  const renderPercentageBadge = () => {
    if (knownKanjiPercentage === undefined) return null;

    // Choose color based on percentage
    let badgeColor = theme.primary;
    if (knownKanjiPercentage >= 90) badgeColor = "#88cc00"; // High match
    else if (knownKanjiPercentage >= 70)
      badgeColor = "#d48806"; // Medium (Darker for readability)
    else badgeColor = "#ff4444"; // Low

    return (
      <View style={[styles.badge, { backgroundColor: badgeColor }]}>
        <Text style={styles.badgeText}>{knownKanjiPercentage}% Known</Text>
      </View>
    );
  };

  if (variant === "breaking") {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.container,
          styles.breakingContainer,
          {
            backgroundColor: theme.cardBackground,
            opacity: pressed ? 0.9 : 1,
            shadowColor: "#000",
            borderColor: "transparent", // No border for full image look
          },
        ]}
        onPress={handleBreakingPress}
        onPressIn={handlePressIn}
        onTouchMove={handleTouchMove}
      >
        {item.imageUrl && (
          <Image
            source={{ uri: item.imageUrl }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            pointerEvents="none"
          />
        )}

        {/* Gradient Overlay for Text Readability */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.8)"]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.breakingContent}>
          {/* Optional Tag or Badge (e.g., "NHK News") if available */}
          <View style={styles.breakingMetaRowTop}>
            {renderPercentageBadge()}
          </View>

          <View>
            <Text style={[styles.breakingTitle]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.breakingDate}>{formattedDate}</Text>
          </View>
        </View>
      </Pressable>
    );
  }

  // Standard Variant (Horizontal List Item)
  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        styles.standardContainer,
        {
          backgroundColor: theme.cardBackground,
          opacity: pressed ? 0.7 : 1,
          borderColor: theme.border,
          shadowColor: "#000",
        },
      ]}
      onPress={() => onPress(item)}
    >
      <View style={styles.contentContainer}>
        {item.imageUrl && (
          <Image
            source={{ uri: item.imageUrl }}
            style={styles.standardImage}
            contentFit="cover"
            transition={200}
            pointerEvents="none"
          />
        )}
        <View style={styles.textContainer}>
          <Text
            style={[styles.title, { color: theme.textColor }]}
            numberOfLines={2}
          >
            {item.title}
          </Text>
          {/* Tag + Date Row */}
          <View style={styles.metaRow}>
            {renderPercentageBadge()}
            <Text style={[styles.date, { color: theme.textSecondary }]}>
              {formattedDate}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  // Breaking (Carousel) Styles
  breakingContainer: {
    width: "100%",
    height: BREAKING_HEIGHT,
  },
  breakingContent: {
    flex: 1,
    justifyContent: "space-between",
    padding: 16,
  },
  breakingMetaRowTop: {
    alignSelf: "flex-start",
  },
  breakingTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 6,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    lineHeight: 26,
  },
  breakingDate: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    fontWeight: "600",
  },

  // Standard (List) Styles
  standardContainer: {
    borderWidth: 1,
    marginBottom: 12,
  },
  contentContainer: {
    flexDirection: "row",
    height: 100, // Fixed height for consistency
  },
  standardImage: {
    width: 100,
    height: "100%",
  },
  textContainer: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  date: {
    fontSize: 12,
    fontWeight: "500",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  badgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
});
