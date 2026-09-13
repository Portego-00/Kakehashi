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
        style={[
          styles.toggleButton,
          styles.toggleButtonLeft,
          isCompact && styles.toggleButtonCompactSize,
          compactLayout && styles.toggleButtonCompactLayout,
          activeSide === "left" && { backgroundColor: accent },
        ]}
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
        style={[
          styles.toggleButton,
          styles.toggleButtonRight,
          isCompact && styles.toggleButtonCompactSize,
          compactLayout && styles.toggleButtonCompactLayout,
          activeSide === "right" && { backgroundColor: accent },
        ]}
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
    minHeight: 32,
    minWidth: 154,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: "row",
    maxWidth: "100%",
    marginLeft: "auto",
  },
  togglePillCompactSize: {
    minHeight: 28,
    minWidth: 128,
  },
  togglePillCompactLayout: {
    minWidth: 136,
  },
  toggleButton: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  toggleButtonCompactSize: {
    paddingHorizontal: 8,
  },
  toggleButtonCompactLayout: {
    paddingHorizontal: 8,
  },
  toggleButtonLeft: {
    borderTopLeftRadius: 999,
    borderBottomLeftRadius: 999,
  },
  toggleButtonRight: {
    borderTopRightRadius: 999,
    borderBottomRightRadius: 999,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  toggleLabelCompactSize: {
    fontSize: 11,
  },
  toggleLabelCompactLayout: {
    fontSize: 11,
  },
});
