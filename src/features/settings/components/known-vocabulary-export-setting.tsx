import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Alert, Clipboard, Text, TouchableOpacity, View } from "react-native";

import { buildKnownVocabularyList } from "../../../utils/known-vocabulary-export";
import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function KnownVocabularyExportSetting() {
  const { dashboardData, theme } = useSettingsControllerContext();

  const copyKnownVocabulary = () => {
    if (
      !dashboardData.dataLoadingState.assignments ||
      !dashboardData.dataLoadingState.subjects
    ) {
      Alert.alert(
        "Vocabulary data not ready",
        "Refresh your dashboard and wait for your WaniKani progress to finish loading, then try again.",
      );
      return;
    }

    try {
      const words = buildKnownVocabularyList(
        dashboardData.subjects,
        dashboardData.assignments,
      );

      if (words.length === 0) {
        Alert.alert(
          "No vocabulary to copy",
          "Complete a WaniKani vocabulary lesson to add words to your known vocabulary list.",
        );
        return;
      }

      Clipboard.setString(words.join("\n"));
      Alert.alert(
        "Vocabulary copied",
        `${words.length.toLocaleString()} ${words.length === 1 ? "word" : "words"} copied to your clipboard, one per line. You can paste the list into Migaku or another app.`,
      );
    } catch (error) {
      console.error("Failed to copy known vocabulary:", error);
      Alert.alert(
        "Could not copy vocabulary",
        "Refresh your dashboard and try again.",
      );
    }
  };

  return (
    <TouchableOpacity
      style={[styles.settingItem, { borderBottomColor: "transparent" }]}
      onPress={copyKnownVocabulary}
      accessibilityRole="button"
      accessibilityLabel="Copy Known Vocabulary"
      accessibilityHint="Copies your learned WaniKani vocabulary to the clipboard, one Japanese word per line"
    >
      <Ionicons
        name="copy-outline"
        size={24}
        color={theme.primary}
        style={styles.settingIcon}
      />
      <View style={styles.settingTextContainer}>
        <Text style={[styles.settingText, { color: theme.textColor }]}>
          Copy Known Vocabulary
        </Text>
        <Text style={[styles.settingSubtext, { color: theme.textSecondary }]}>
          Copy WaniKani vocabulary from completed lessons, including kana-only
          words. One Japanese word per line, from Apprentice through Burned.
        </Text>
      </View>
    </TouchableOpacity>
  );
}
