import { SettingsSectionSurface } from "../../../ui/settings/settings-section-surface";
import { SettingsLabel } from "../../../ui/settings/settings-search";
import { SettingsIcon as Ionicons } from "../../../ui/settings/settings-icon";
import React from "react";

import { Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function WidgetSection() {
  const { router, showWidgetsSection, theme, updateSectionOffset } =
    useSettingsControllerContext();

  return (
    <>
      {/* Widget Section */}
      {showWidgetsSection && (
        <SettingsSectionSurface
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("widgets", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Widgets
          </Text>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            onPress={() => router.push("/widget-settings")}
          >
            <Ionicons
              name="phone-portrait"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <View style={styles.settingRow}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Home Widget
                </SettingsLabel>
                <View style={styles.betaBadge}>
                  <Text style={styles.betaBadgeText}>BETA</Text>
                </View>
              </View>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Configure widget content and streak background gradient
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </SettingsSectionSurface>
      )}
    </>
  );
}
