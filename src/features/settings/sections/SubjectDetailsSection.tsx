import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Switch, Text, View } from "react-native";

import { useSettingsStore } from "../../../utils/store";
import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function SubjectDetailsSection() {
  const { theme, updateSectionOffset } = useSettingsControllerContext();
  const showSubjectHistory = useSettingsStore((state) => state.showSubjectHistory);
  const setShowSubjectHistory = useSettingsStore((state) => state.setShowSubjectHistory);

  return (
    <View
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
        <Ionicons
          name="time-outline"
          size={24}
          color={theme.primary}
          style={styles.settingIcon}
        />
        <View style={styles.settingTextContainer}>
          <Text style={[styles.settingText, { color: theme.textColor }]}>
            Subject Update History
          </Text>
          <Text
            style={[styles.settingSubtext, { color: theme.textSecondary }]}
          >
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
    </View>
  );
}
