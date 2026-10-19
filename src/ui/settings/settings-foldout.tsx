import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SettingsIcon } from "./settings-icon";
import { settingsLayoutTransition } from "./settings-section-surface";
import {
  SettingsSearchReveal,
  useSettingsSearchEntry,
} from "./settings-search";
type Theme = {
  primary: string;
  textColor: string;
  textSecondary: string;
  border: string;
};
export function SettingsFoldout({
  title,
  description,
  icon = "settings",
  children,
  accessibilityLabel,
  showTopBorder = true,
  theme,
}: {
  title: string;
  description: string;
  icon?: string;
  children: React.ReactNode;
  accessibilityLabel?: string;
  showTopBorder?: boolean;
  theme: Theme;
}) {
  const [open, setOpen] = useState(false);
  const [bodyHeight, setBodyHeight] = useState(0);
  const heading = useRef<View>(null);
  const reveal = useCallback(() => setOpen(true), []);
  const measure = useCallback((callback: (y: number) => void) => {
    setOpen(true);
    heading.current?.measureInWindow((_x, y) => callback(y));
  }, []);
  useSettingsSearchEntry(title, description, measure);
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(open ? 1 : 0, {
      duration: open ? 220 : 180,
      easing: Easing.bezier(0.2, 0, 0, 1),
      reduceMotion: ReduceMotion.System,
    });
  }, [open, progress]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 90}deg` }],
  }));
  const bodyStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  return (
    <Animated.View
      layout={settingsLayoutTransition}
      style={{
        borderTopWidth: showTopBorder ? 1 : 0,
        borderTopColor: theme.border,
      }}
    >
      <Pressable
        ref={heading}
        accessibilityRole="button"
        accessibilityLabel={
          accessibilityLabel
            ? open
              ? "Collapse advanced settings"
              : accessibilityLabel
            : title
        }
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((v) => !v)}
        style={({ pressed }) => ({
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          minHeight: 64,
          paddingHorizontal: 14,
          paddingVertical: 12,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <SettingsIcon name={icon} size={22} color={theme.primary} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            style={{ fontSize: 15, fontWeight: "700", color: theme.textColor }}
          >
            {title}
          </Text>
          <Text
            style={{ fontSize: 11, lineHeight: 16, color: theme.textSecondary }}
          >
            {description}
          </Text>
        </View>
        <Animated.View style={chevronStyle}>
          <SettingsIcon name="chevron" size={16} color={theme.textSecondary} />
        </Animated.View>
      </Pressable>
      <Animated.View
        layout={settingsLayoutTransition}
        style={{ height: open ? bodyHeight : 0, overflow: "hidden" }}
        pointerEvents={open ? "auto" : "none"}
        accessibilityElementsHidden={!open}
        importantForAccessibility={open ? "auto" : "no-hide-descendants"}
      >
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              borderTopWidth: 1,
              borderTopColor: theme.border,
            },
            bodyStyle,
          ]}
          onLayout={(event) =>
            setBodyHeight(Math.ceil(event.nativeEvent.layout.height))
          }
        >
          <SettingsSearchReveal reveal={reveal}>
            {children}
          </SettingsSearchReveal>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}
