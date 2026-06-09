import React from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function LevelAnalyticsExportModal() {
  const {
    availableLevelAnalyticsLevels,
    clearLevelAnalyticsLevels,
    handleConfirmLevelAnalyticsExport,
    isExportingLevelAnalytics,
    levelAnalyticsExportFormat,
    selectAllLevelAnalyticsLevels,
    selectedLevelAnalyticsLevels,
    setLevelAnalyticsExportFormat,
    setShowLevelAnalyticsExportModal,
    sheetBottomPadding,
    sheetHorizontalPadding,
    showLevelAnalyticsExportModal,
    theme,
    toggleLevelAnalyticsLevelSelection,
  } = useSettingsControllerContext();

  return (
    <>
      <Modal
        visible={showLevelAnalyticsExportModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLevelAnalyticsExportModal(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setShowLevelAnalyticsExportModal(false)}
        >
          <View
            style={[
              styles.voicePickerModalOverlay,
              {
                paddingHorizontal: sheetHorizontalPadding,
                paddingBottom: sheetBottomPadding,
              },
            ]}
          >
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.levelAnalyticsExportModalContent,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Text
                  style={[
                    styles.voicePickerModalTitle,
                    { color: theme.textColor, paddingBottom: 8 },
                  ]}
                >
                  Export Level Analytics
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary, paddingHorizontal: 16 },
                  ]}
                >
                  Select dataset type and levels to include in your CSV export.
                </Text>

                <View style={styles.levelAnalyticsFormatRow}>
                  <TouchableOpacity
                    style={[
                      styles.levelAnalyticsFormatButton,
                      {
                        borderColor:
                          levelAnalyticsExportFormat === "summary"
                            ? theme.primary
                            : theme.border,
                        backgroundColor:
                          levelAnalyticsExportFormat === "summary"
                            ? `${theme.primary}20`
                            : "transparent",
                      },
                    ]}
                    onPress={() => setLevelAnalyticsExportFormat("summary")}
                  >
                    <Text
                      style={[
                        styles.levelAnalyticsFormatButtonTitle,
                        {
                          color:
                            levelAnalyticsExportFormat === "summary"
                              ? theme.primary
                              : theme.textColor,
                        },
                      ]}
                    >
                      Summary
                    </Text>
                    <Text
                      style={[
                        styles.levelAnalyticsFormatButtonSubtitle,
                        { color: theme.textSecondary },
                      ]}
                    >
                      One row per level
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.levelAnalyticsFormatButton,
                      {
                        borderColor:
                          levelAnalyticsExportFormat === "detailed"
                            ? theme.primary
                            : theme.border,
                        backgroundColor:
                          levelAnalyticsExportFormat === "detailed"
                            ? `${theme.primary}20`
                            : "transparent",
                      },
                    ]}
                    onPress={() => setLevelAnalyticsExportFormat("detailed")}
                  >
                    <Text
                      style={[
                        styles.levelAnalyticsFormatButtonTitle,
                        {
                          color:
                            levelAnalyticsExportFormat === "detailed"
                              ? theme.primary
                              : theme.textColor,
                        },
                      ]}
                    >
                      Detailed
                    </Text>
                    <Text
                      style={[
                        styles.levelAnalyticsFormatButtonSubtitle,
                        { color: theme.textSecondary },
                      ]}
                    >
                      One row per subject
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.levelAnalyticsLevelHeader}>
                  <Text
                    style={[
                      styles.levelAnalyticsLevelTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    Included Levels ({selectedLevelAnalyticsLevels.length})
                  </Text>
                  <View style={styles.levelAnalyticsQuickActions}>
                    <TouchableOpacity
                      style={[
                        styles.levelAnalyticsQuickActionButton,
                        { borderColor: theme.border },
                      ]}
                      onPress={selectAllLevelAnalyticsLevels}
                    >
                      <Text
                        style={[
                          styles.levelAnalyticsQuickActionText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        All
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.levelAnalyticsQuickActionButton,
                        { borderColor: theme.border },
                      ]}
                      onPress={clearLevelAnalyticsLevels}
                    >
                      <Text
                        style={[
                          styles.levelAnalyticsQuickActionText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        None
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <ScrollView
                  style={styles.levelAnalyticsLevelsScroll}
                  contentContainerStyle={styles.levelAnalyticsLevelsContent}
                  showsVerticalScrollIndicator={false}
                >
                  {availableLevelAnalyticsLevels.map((level) => {
                    const isSelected =
                      selectedLevelAnalyticsLevels.includes(level);
                    return (
                      <TouchableOpacity
                        key={`level-export-${level}`}
                        style={[
                          styles.levelAnalyticsLevelRow,
                          { borderBottomColor: theme.border },
                        ]}
                        onPress={() =>
                          toggleLevelAnalyticsLevelSelection(level)
                        }
                      >
                        <Text
                          style={[
                            styles.levelAnalyticsLevelRowText,
                            { color: theme.textColor },
                          ]}
                        >
                          Level {level}
                        </Text>
                        <Ionicons
                          name={isSelected ? "checkbox" : "square-outline"}
                          size={22}
                          color={
                            isSelected ? theme.primary : theme.textSecondary
                          }
                        />
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.reminderTimeActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.reminderTimeButton,
                      { borderColor: theme.border },
                    ]}
                    onPress={() => setShowLevelAnalyticsExportModal(false)}
                  >
                    <Text
                      style={[
                        styles.reminderTimeButtonText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.reminderTimeButton,
                      styles.reminderTimeSaveButton,
                      {
                        backgroundColor:
                          selectedLevelAnalyticsLevels.length > 0
                            ? theme.primary
                            : theme.border,
                      },
                    ]}
                    onPress={() => {
                      void handleConfirmLevelAnalyticsExport();
                    }}
                    disabled={
                      selectedLevelAnalyticsLevels.length === 0 ||
                      isExportingLevelAnalytics
                    }
                  >
                    <Text
                      style={[styles.reminderTimeButtonText, { color: "#fff" }]}
                    >
                      Export CSV
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
