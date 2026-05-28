import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";
import type { OtaUpdateExperience } from "../../../utils/store";

const UPDATE_EXPERIENCE_OPTIONS: {
  value: OtaUpdateExperience;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}[] = [
  {
    value: "startup-blocking",
    title: "Update before opening",
    description: "Check and apply updates before the dashboard loads.",
    icon: "cloud-download-outline",
  },
  {
    value: "startup-timeboxed",
    title: "Wait up to 1 second",
    description:
      "Start with the current flow, but continue opening the app if the check takes too long.",
    icon: "timer-outline",
  },
  {
    value: "background-next-open",
    title: "Update next open",
    description:
      "Download updates in the background and apply them the next time you open Kakehashi.",
    icon: "play-skip-forward-outline",
  },
  {
    value: "background-banner",
    title: "Show Home banner",
    description:
      "Download updates in the background, then show a Home banner. Tapping it reloads Home and may repeat WaniKani calls.",
    icon: "notifications-outline",
  },
];

export function UpdateExperienceSection() {
  const {
    otaUpdateExperience,
    setOtaUpdateExperience,
    theme,
    updateSectionOffset,
  } = useSettingsControllerContext();

  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
      ]}
      onLayout={(event) => {
        updateSectionOffset("updates", event.nativeEvent.layout.y);
      }}
    >
      <Text
        style={[
          styles.sectionTitle,
          { color: theme.textColor, borderBottomColor: theme.border },
        ]}
      >
        Updates
      </Text>

      {UPDATE_EXPERIENCE_OPTIONS.map((option, index) => {
        const isSelected = otaUpdateExperience === option.value;
        const isLast = index === UPDATE_EXPERIENCE_OPTIONS.length - 1;

        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.settingItemColumn,
              styles.updateExperienceOption,
              { borderBottomColor: isLast ? "transparent" : theme.border },
            ]}
            onPress={() => setOtaUpdateExperience(option.value)}
            activeOpacity={0.75}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
          >
            <View style={styles.settingRow}>
              <Ionicons
                name={option.icon}
                size={24}
                color={isSelected ? theme.primary : theme.textSecondary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  {option.title}
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  {option.description}
                </Text>
              </View>
              <Ionicons
                name={isSelected ? "radio-button-on" : "radio-button-off"}
                size={22}
                color={isSelected ? theme.primary : theme.textSecondary}
              />
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
