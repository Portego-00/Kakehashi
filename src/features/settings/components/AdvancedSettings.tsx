import { SettingsIcon as Ionicons } from "../../../ui/settings/settings-icon";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { StyleSheet, Text, TouchableOpacity } from "react-native";
import {
  SettingsSearchRegistryContext,
  SettingsSearchReveal,
} from "../../../ui/settings/settings-search";
import Animated, {
  CurvedTransition,
  Easing,
  FadeInDown,
  FadeOutUp,
  interpolate,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useSettingsControllerContext } from "../SettingsControllerContext";

const disclosureLayoutTransition = CurvedTransition.duration(220)
  .easingX(Easing.bezier(0.2, 0, 0, 1))
  .easingY(Easing.bezier(0.2, 0, 0, 1))
  .easingWidth(Easing.bezier(0.2, 0, 0, 1))
  .easingHeight(Easing.bezier(0.2, 0, 0, 1))
  .reduceMotion(ReduceMotion.System);

const advancedSettingEntering = FadeInDown.duration(200)
  .easing(Easing.out(Easing.cubic))
  .reduceMotion(ReduceMotion.System);

const advancedSettingExiting = FadeOutUp.duration(140)
  .easing(Easing.in(Easing.cubic))
  .reduceMotion(ReduceMotion.System);

export const AdvancedSettingsContext = createContext(false);

const componentStyles = StyleSheet.create({
  settingItem: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingIcon: {
    marginRight: 16,
  },
  settingText: {
    flex: 1,
    fontSize: 14,
  },
});

export function AdvancedSettingsGroup({
  children,
  grouped = false,
}: {
  children: React.ReactNode;
  grouped?: boolean;
}) {
  const { theme } = useSettingsControllerContext();
  const [isExpanded, setIsExpanded] = useState(false);
  const expansionProgress = useSharedValue(0);

  useEffect(() => {
    expansionProgress.value = withTiming(isExpanded ? 1 : 0, {
      duration: isExpanded ? 200 : 140,
      easing: isExpanded ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      reduceMotion: ReduceMotion.System,
    });
  }, [expansionProgress, isExpanded]);

  const toggleAdvancedSettings = useCallback(() => {
    setIsExpanded((currentValue) => !currentValue);
  }, []);
  const reveal = useCallback(() => setIsExpanded(true), []);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(expansionProgress.value, [0, 1], [0, 180])}deg`,
      },
    ],
  }));

  if (grouped) return <>{children}</>;

  return (
    <AdvancedSettingsContext.Provider value={isExpanded}>
      <SettingsSearchReveal reveal={reveal}>
        <Animated.View layout={disclosureLayoutTransition}>
          {children}
          <TouchableOpacity
            style={[
              componentStyles.settingItem,
              {
                borderTopColor: theme.border,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}
            onPress={toggleAdvancedSettings}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityLabel={
              isExpanded ? "Collapse advanced settings" : "Advanced settings"
            }
            accessibilityHint={
              isExpanded
                ? "Hides less commonly used settings"
                : "Shows less commonly used settings"
            }
            accessibilityState={{ expanded: isExpanded }}
          >
            <Ionicons
              name="options-outline"
              size={22}
              color={theme.textSecondary}
              style={componentStyles.settingIcon}
            />
            <Text
              style={[componentStyles.settingText, { color: theme.textColor }]}
            >
              {isExpanded ? "Collapse advanced settings" : "Advanced settings"}
            </Text>
            <Animated.View style={chevronStyle}>
              <Ionicons
                name="chevron-down"
                size={20}
                color={theme.textSecondary}
              />
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </SettingsSearchReveal>
    </AdvancedSettingsContext.Provider>
  );
}

export function AdvancedSetting({ children }: { children: React.ReactNode }) {
  const isExpanded = useContext(AdvancedSettingsContext);
  const searchRegistry = useContext(SettingsSearchRegistryContext);

  if (!isExpanded && !searchRegistry) {
    return null;
  }

  return (
    <Animated.View
      entering={advancedSettingEntering}
      exiting={advancedSettingExiting}
      layout={disclosureLayoutTransition}
      style={!isExpanded ? { height: 0, overflow: "hidden" } : undefined}
      pointerEvents={isExpanded ? "auto" : "none"}
      accessibilityElementsHidden={!isExpanded}
      importantForAccessibility={isExpanded ? "auto" : "no-hide-descendants"}
    >
      {children}
    </Animated.View>
  );
}
