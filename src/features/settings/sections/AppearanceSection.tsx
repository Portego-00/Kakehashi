import React from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { Platform, Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";
import {
  formatAppTextSizeScale,
  useSettingsStore,
} from "../../../utils/store";

const APP_TEXT_SIZE_SETTINGS_ROUTE = "/app-text-size-settings" as Href;

export function AppearanceSection() {
  const { router, theme, updateSectionOffset } =
    useSettingsControllerContext();
  const appTextSizeScale = useSettingsStore((state) => state.appTextSizeScale);
  const showAppTextSizeSetting = Platform.OS === "ios";

  return (
    <>
      {/* Appearance Section */}
      <View
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("appearance", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          Appearance
        </Text>

        {showAppTextSizeSetting ? (
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={() => router.push(APP_TEXT_SIZE_SETTINGS_ROUTE)}
            accessibilityRole="button"
            accessibilityLabel="Open app text size settings"
          >
            <Ionicons
              name="text-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                App Text Size
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Adjust text size across Kakehashi
              </Text>
            </View>
            <Text
              style={[styles.settingValueText, { color: theme.textSecondary }]}
            >
              {formatAppTextSizeScale(appTextSizeScale)}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: theme.border }]}
          onPress={() => router.push("/tab-settings")}
        >
          <Ionicons
            name="apps"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Customize Tabs
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Choose which tabs to show in the navigation bar
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: theme.border }]}
          onPress={() => router.push("/subject-colors-settings")}
        >
          <Ionicons
            name="color-palette"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Subject Colors
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Customize radical, kanji, and vocabulary colors
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          onPress={() => router.push("/home-customization-settings")}
        >
          <MaterialCommunityIcons
            name="view-dashboard-outline"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Home Customization
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Reorder, add, remove, and theme Home widgets
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </>
  );
}
