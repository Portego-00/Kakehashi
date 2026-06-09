import React from "react";
import { LevelRecapIcon } from "../../../components/wrapped/LevelRecapIcon";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function LevelRecapSection() {
  const {
    dashboardData,
    handleOpenLevelAnalyticsExportModal,
    isExportingLevelAnalytics,
    router,
    showLevelRecapSection,
    theme,
    updateSectionOffset,
  } = useSettingsControllerContext();

  return (
    <>
      {/* Level Recap */}
      {showLevelRecapSection && (
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("levelRecap", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Level Recap
          </Text>

          {dashboardData.currentLevel > 1 && (
            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
              onPress={() =>
                router.push(`/level-wrapped/${dashboardData.currentLevel - 1}`)
              }
            >
              <View style={styles.settingIcon}>
                <LevelRecapIcon size={24} color="#7c3aed" />
              </View>
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Level {dashboardData.currentLevel - 1} Summary
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  View your previous level recap
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            onPress={() => {
              handleOpenLevelAnalyticsExportModal();
            }}
            disabled={isExportingLevelAnalytics}
          >
            <Ionicons
              name="download-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Export Level Analytics
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Choose levels and export summary or detailed CSV
              </Text>
            </View>
            {isExportingLevelAnalytics ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            )}
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}
