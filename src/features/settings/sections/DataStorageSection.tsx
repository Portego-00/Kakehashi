import { SettingsSectionSurface } from "../../../ui/settings/settings-section-surface";
import { SettingsLabel } from "../../../ui/settings/settings-search";
import { SettingsIcon as Ionicons } from "../../../ui/settings/settings-icon";
import React from "react";

import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function DataStorageSection() {
  const {
    cacheHealthStatus,
    handleCheckCacheHealth,
    handleRepairCache,
    isCheckingCacheHealth,
    isRepairingCache,
    showDataStorageSection,
    theme,
    updateSectionOffset,
  } = useSettingsControllerContext();

  return (
    <>
      {/* Data & Storage Section - Feature flagged by user email */}
      {showDataStorageSection && (
        <SettingsSectionSurface
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("dataStorage", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Data & Storage
          </Text>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={handleCheckCacheHealth}
            disabled={isCheckingCacheHealth || isRepairingCache}
          >
            <Ionicons
              name="medkit"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <SettingsLabel
                style={[styles.settingText, { color: theme.textColor }]}
              >
                Check Cache Health
              </SettingsLabel>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                {cacheHealthStatus
                  ? cacheHealthStatus.isHealthy
                    ? `Healthy - ${cacheHealthStatus.validSubjects} subjects`
                    : `Issues detected - ${cacheHealthStatus.issues.length} problem(s)`
                  : "Verify search and offline data integrity"}
              </Text>
            </View>
            {isCheckingCacheHealth ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            onPress={handleRepairCache}
            disabled={isRepairingCache || isCheckingCacheHealth}
          >
            <Ionicons
              name="build"
              size={24}
              color="#ff9500"
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <SettingsLabel
                style={[styles.settingText, { color: theme.textColor }]}
              >
                Repair Cache
              </SettingsLabel>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Fix corrupted data for search and offline mode
              </Text>
            </View>
            {isRepairingCache ? (
              <ActivityIndicator size="small" color="#ff9500" />
            ) : (
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            )}
          </TouchableOpacity>
        </SettingsSectionSurface>
      )}
    </>
  );
}
