import { SettingsRowIcon } from "../../../ui/settings/settings-row-icon";
import { SettingsSectionSurface } from "../../../ui/settings/settings-section-surface";
import { SettingsLabel } from "../../../ui/settings/settings-search";

import React from "react";

import { Switch, Text, View } from "react-native";

import { useSettingsStore } from "../../../utils/store";
import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function SubjectDetailsSection() {
  const { theme, updateSectionOffset } = useSettingsControllerContext();
  const showSubjectHistory = useSettingsStore(
    (state) => state.showSubjectHistory,
  );
  const setShowSubjectHistory = useSettingsStore(
    (state) => state.setShowSubjectHistory,
  );

  return (
    <SettingsSectionSurface
      style={[
        styles.section,
        { backgroundColor: theme.cardBackground, borderColor: theme.border },
      ]}
      onLayout={(event) => {
        updateSectionOffset("subjectDetails", event.nativeEvent.layout.y);
      }}
    >
      <Text
        style={[
          styles.sectionTitle,
          { color: theme.textColor, borderBottomColor: theme.border },
        ]}
      >
        Subject Details
      </Text>
      <View style={[styles.settingItem, { borderBottomColor: "transparent" }]}>

        <SettingsRowIcon setting="history" color={theme.primary} />
        <View style={styles.settingTextContainer}>
          <SettingsLabel
            style={[styles.settingText, { color: theme.textColor }]}
          >
            Subject Update History
          </SettingsLabel>
          <Text style={[styles.settingSubtext, { color: theme.textSecondary }]}>
            Show the update history button on subject detail pages
          </Text>
        </View>
        <Switch
          value={showSubjectHistory}
          onValueChange={setShowSubjectHistory}
          trackColor={{ false: "#767577", true: theme.primary }}
          thumbColor="#f4f3f4"
          accessibilityLabel="Show subject update history"
        />
      </View>
    </SettingsSectionSurface>
  );
}
