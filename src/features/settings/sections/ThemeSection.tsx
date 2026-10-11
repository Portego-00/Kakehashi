import { SettingsSectionSurface } from "../../../ui/settings/settings-section-surface";
import React from "react";
import { Text } from "react-native";
import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";
import { SettingsChoiceCards } from "../../../ui/settings/settings-choice-cards";
export function ThemeSection() {
  const { theme, themeMode, setThemeMode, updateSectionOffset } =
    useSettingsControllerContext();
  return (
    <SettingsSectionSurface
      style={[
        styles.section,
        { backgroundColor: theme.cardBackground, borderColor: theme.border },
      ]}
      onLayout={(event) =>
        updateSectionOffset("theme", event.nativeEvent.layout.y)
      }
    >
      <Text
        style={[
          styles.sectionTitle,
          { color: theme.textColor, borderBottomColor: theme.border },
        ]}
      >
        Theme
      </Text>
      <SettingsChoiceCards
        label="Appearance"
        value={themeMode}
        theme={theme}
        compact
        options={[
          {
            value: "system",
            label: "System",
            description: "Match your device",
            art: "system",
          },
          {
            value: "light",
            label: "Light",
            description: "Bright surfaces",
            art: "light",
          },
          {
            value: "dark",
            label: "Dark",
            description: "Comfort after dark",
            art: "dark",
          },
          {
            value: "sepia",
            label: "Sepia",
            description: "Warm reading paper",
            art: "sepia",
          },
          {
            value: "midnight",
            label: "Midnight",
            description: "Pure black",
            art: "midnight",
          },
        ]}
        onChange={setThemeMode}
      />
    </SettingsSectionSurface>
  );
}
