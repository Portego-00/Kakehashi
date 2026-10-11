import { SettingsRowIcon } from "../../../ui/settings/settings-row-icon";
import { SettingsSectionSurface } from "../../../ui/settings/settings-section-surface";
import { SettingsLabel } from "../../../ui/settings/settings-search";

import React from "react";

import { Switch, Text, View } from "react-native";

import { useSettingsStore } from "../../../utils/store";
import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function NotesSection() {
  const advancedNoteEditorEnabled = useSettingsStore(
    (state) => state.advancedNoteEditorEnabled,
  );
  const setAdvancedNoteEditorEnabled = useSettingsStore(
    (state) => state.setAdvancedNoteEditorEnabled,
  );
  const { theme, updateSectionOffset } = useSettingsControllerContext();

  return (
    <SettingsSectionSurface
      style={[
        styles.section,
        {
          backgroundColor: theme.cardBackground,
          borderColor: theme.border,
        },
      ]}
      onLayout={(event) => {
        updateSectionOffset("notes", event.nativeEvent.layout.y);
      }}
    >
      <Text
        style={[
          styles.sectionTitle,
          { color: theme.textColor, borderBottomColor: theme.border },
        ]}
      >
        Notes
      </Text>

      <View style={[styles.settingItem, { borderBottomColor: "transparent" }]}>

        <SettingsRowIcon setting="advanced-note" color={theme.primary} />
        <View style={styles.settingTextContainer}>
          <SettingsLabel
            style={[styles.settingText, { color: theme.textColor }]}
          >
            Advanced note editor
          </SettingsLabel>
          <Text style={[styles.settingSubtext, { color: theme.textSecondary }]}>
            Use formatting and subject links in study notes. Existing formatted
            notes keep the advanced editor.
          </Text>
        </View>
        <Switch
          accessibilityLabel="Advanced note editor"
          value={advancedNoteEditorEnabled}
          onValueChange={setAdvancedNoteEditorEnabled}
          trackColor={{ false: "#767577", true: theme.primary }}
          thumbColor="#f4f3f4"
        />
      </View>
    </SettingsSectionSurface>
  );
}
