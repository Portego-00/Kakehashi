import React from "react";
import { Ionicons } from "@expo/vector-icons";
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
    <View
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

      <View
        style={[styles.settingItem, { borderBottomColor: "transparent" }]}
      >
        <Ionicons
          name="create-outline"
          size={24}
          color={theme.primary}
          style={styles.settingIcon}
        />
        <View style={styles.settingTextContainer}>
          <Text style={[styles.settingText, { color: theme.textColor }]}>
            Advanced note editor
          </Text>
          <Text
            style={[styles.settingSubtext, { color: theme.textSecondary }]}
          >
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
    </View>
  );
}
