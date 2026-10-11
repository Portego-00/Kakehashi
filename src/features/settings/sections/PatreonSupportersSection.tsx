import { SettingsSectionSurface } from "../../../ui/settings/settings-section-surface";
import { SettingsLabel } from "../../../ui/settings/settings-search";
import {
  SettingsIcon as Ionicons,
  SettingsIcon as MaterialCommunityIcons,
} from "../../../ui/settings/settings-icon";
import React from "react";

import { Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function PatreonSupportersSection() {
  const { router, theme, updateSectionOffset } = useSettingsControllerContext();

  return (
    <>
      {/* Patreon Supporters Section */}
      <SettingsSectionSurface
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("patreon", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          Patreon Supporters
        </Text>
        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          onPress={() => router.push("/patreon-supporters")}
        >
          <MaterialCommunityIcons
            name="patreon"
            size={24}
            color={theme.textColor}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <SettingsLabel
              style={[styles.settingText, { color: theme.textColor }]}
            >
              View Supporters
            </SettingsLabel>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              See all Patreon supporters and join them
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      </SettingsSectionSurface>
    </>
  );
}
