import { Ionicons } from "@expo/vector-icons";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import React from "react";
import {
  Platform,
  StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

interface GlassButtonProps {
  iconName?: keyof typeof Ionicons.glyphMap;
  children?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  iconColor?: string;
  iconSize?: number;
  /**
   * Variant for Android fallback styling:
   * - "colored": For use on colored/dark backgrounds (default) - uses white tint
   * - "light": For use on light/neutral backgrounds - uses gray tint
   */
  variant?: "colored" | "light";
}

export function GlassButton({
  iconName,
  children,
  onPress,
  style,
  iconColor = "#fff",
  iconSize = 24,
  variant = "colored",
}: GlassButtonProps) {
  const useGlassEffect = Platform.OS === "ios" && isLiquidGlassAvailable();

  const content =
    children ||
    (iconName ? (
      <Ionicons name={iconName} size={iconSize} color={iconColor} />
    ) : null);

  if (useGlassEffect) {
    if (!onPress) {
      return (
        <View style={[styles.button, style]}>
          <GlassView
            glassEffectStyle="regular"
            isInteractive={false}
            style={styles.glassView}
          >
            {content}
          </GlassView>
        </View>
      );
    }

    return (
      <TouchableOpacity
        style={[styles.button, style]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <GlassView
          glassEffectStyle="regular"
          isInteractive={true}
          style={styles.glassView}
        >
          {content}
        </GlassView>
      </TouchableOpacity>
    );
  }

  // Fallback for non-iOS or older iOS versions
  // Use different styling based on variant
  const fallbackStyle = variant === "light"
    ? styles.fallbackButtonLight
    : styles.fallbackButtonColored;

  const innerStyle = variant === "light"
    ? styles.glassButtonInnerLight
    : styles.glassButtonInnerColored;

  if (!onPress) {
    return (
      <View style={[styles.button, fallbackStyle, style]}>
        <View style={innerStyle} />
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, fallbackStyle, style]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={innerStyle} />
      {content}
    </TouchableOpacity>
  );
}

const BUTTON_SIZE = 44;

const styles = StyleSheet.create({
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  glassView: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BUTTON_SIZE / 2,
  },
  // Fallback for colored/dark backgrounds (home screen, etc.)
  fallbackButtonColored: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    shadowColor: "rgba(0, 0, 0, 0.3)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    ...Platform.select({
      ios: { elevation: 4 },
      android: {},
    }),
  },
  glassButtonInnerColored: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  // Fallback for light/neutral backgrounds (news header in light mode, etc.)
  fallbackButtonLight: {
    backgroundColor: "rgba(0, 0, 0, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.12)",
    shadowColor: "rgba(0, 0, 0, 0.15)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 4,
    ...Platform.select({
      ios: { elevation: 4 },
      android: {},
    }),
  },
  glassButtonInnerLight: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    borderRadius: BUTTON_SIZE / 2,
    borderWidth: 0.5,
    borderColor: "rgba(0, 0, 0, 0.06)",
  },
});
