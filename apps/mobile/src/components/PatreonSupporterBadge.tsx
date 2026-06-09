import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../utils/theme";

type PatreonSupporterBadgeProps = {
  compact?: boolean;
};

export function PatreonSupporterBadge({
  compact = false,
}: PatreonSupporterBadgeProps) {
  const { theme } = useTheme();
  const backgroundColor = theme.isDark ? "rgba(249, 104, 84, 0.22)" : "#FCE7E3";
  const borderColor = theme.isDark ? "rgba(249, 104, 84, 0.45)" : "#F6B2A8";
  const textColor = theme.isDark ? "#FFC7BD" : "#B7412F";

  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        { backgroundColor, borderColor },
      ]}
    >
      <MaterialCommunityIcons
        name="patreon"
        size={compact ? 10 : 11}
        color={textColor}
      />
      <Text style={[styles.text, compact && styles.textCompact, { color: textColor }]}>
        Supporter
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    gap: 3,
  },
  text: {
    fontSize: 10,
    fontWeight: "700",
  },
  textCompact: {
    fontSize: 9,
  },
});
