import { SettingsSectionSurface } from "../../../ui/settings/settings-section-surface";
import { SettingsLabel } from "../../../ui/settings/settings-search";
import { SettingsIcon as Ionicons } from "../../../ui/settings/settings-icon";
import React from "react";

import { Text, TouchableOpacity } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function AccountSection() {
  const { handleLogout, theme, updateSectionOffset } =
    useSettingsControllerContext();

  return (
    <>
      {/* Account Section */}
      <SettingsSectionSurface
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("account", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          Account
        </Text>

        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          onPress={handleLogout}
        >
          <Ionicons
            name="log-out"
            size={24}
            color="#e53935"
            style={styles.settingIcon}
          />
          <SettingsLabel style={[styles.settingText, { color: "#e53935" }]}>
            Sign Out
          </SettingsLabel>
        </TouchableOpacity>
      </SettingsSectionSurface>
    </>
  );
}
