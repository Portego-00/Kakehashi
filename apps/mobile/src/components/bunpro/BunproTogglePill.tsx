import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { getBestContrastTextColor } from "../../utils/subjectColors";

type BunproTogglePillProps = {
  leftLabel: string;
  rightLabel: string;
  activeSide: "left" | "right";
  onLeftPress: () => void;
  onRightPress: () => void;
  accent: string;
  compactLayout?: boolean;
  size?: "default" | "compact";
};

export default function BunproTogglePill({
  leftLabel,
  rightLabel,
  activeSide,
  onLeftPress,
  onRightPress,
  accent,
  compactLayout = false,
  size = "default",
}: BunproTogglePillProps) {
  const isCompact = size === "compact";
  const activeLabelColor = getBestContrastTextColor(accent, "#16161a", "#ffffff");

  return (
    <View
      style={[
        styles.togglePill,
        isCompact && styles.togglePillCompactSize,
        compactLayout && styles.togglePillCompactLayout,
        { borderColor: accent },
      ]}
    >
      <TouchableOpacity
        style={[styles.toggleButton, activeSide === "left" && { backgroundColor: accent }]}
        onPress={onLeftPress}
      >
        <Text
          style={[
            styles.toggleLabel,
            isCompact && styles.toggleLabelCompactSize,
            compactLayout && styles.toggleLabelCompactLayout,
            { color: activeSide === "left" ? activeLabelColor : accent },
          ]}
        >
          {leftLabel}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.toggleButton, activeSide === "right" && { backgroundColor: accent }]}
        onPress={onRightPress}
      >
        <Text
          style={[
            styles.toggleLabel,
            isCompact && styles.toggleLabelCompactSize,
            compactLayout && styles.toggleLabelCompactLayout,
            { color: activeSide === "right" ? activeLabelColor : accent },
          ]}
        >
          {rightLabel}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  togglePill: {
    height: 32,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    overflow: "hidden",
    width: 154,
    maxWidth: "100%",
    marginLeft: "auto",
  },
  togglePillCompactSize: {
    height: 28,
    width: 128,
    borderRadius: 10,
  },
  togglePillCompactLayout: {
    width: 136,
  },
  toggleButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  toggleLabelCompactSize: {
    fontSize: 11,
  },
  toggleLabelCompactLayout: {
    fontSize: 11,
  },
});
