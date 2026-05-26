import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function ThemeSection() {
  const { isDark, setThemeMode, theme, themeMode, updateSectionOffset } =
    useSettingsControllerContext();

  return (
    <>
      {/* Theme Section */}
      <View
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("theme", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          Theme
        </Text>
        <View
          style={[styles.settingItem, { borderBottomColor: "transparent" }]}
        >
          <Ionicons
            name={
              themeMode === "system"
                ? "phone-portrait"
                : themeMode === "midnight"
                  ? "contrast"
                  : themeMode === "sepia"
                    ? "leaf"
                    : isDark
                      ? "moon"
                      : "sunny"
            }
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Theme Preset
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              {themeMode === "system"
                ? "Following system appearance"
                : themeMode === "midnight"
                  ? "Pure black dark mode"
                  : themeMode === "sepia"
                    ? "Warm paper-like light mode"
                    : isDark
                      ? "Always dark"
                      : "Always light"}
            </Text>
          </View>
        </View>
        <View style={[styles.themeSelector, { borderTopColor: theme.border }]}>
          <TouchableOpacity
            style={[
              styles.themeSelectorButton,
              { borderColor: theme.border },
              themeMode === "light" && {
                backgroundColor: theme.primary,
                borderColor: theme.primary,
              },
            ]}
            onPress={() => setThemeMode("light")}
          >
            <Ionicons
              name="sunny"
              size={18}
              color={themeMode === "light" ? "#fff" : theme.textSecondary}
            />
            <Text
              style={[
                styles.themeSelectorText,
                { color: themeMode === "light" ? "#fff" : theme.textColor },
              ]}
            >
              Light
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.themeSelectorButton,
              { borderColor: theme.border },
              themeMode === "dark" && {
                backgroundColor: theme.primary,
                borderColor: theme.primary,
              },
            ]}
            onPress={() => setThemeMode("dark")}
          >
            <Ionicons
              name="moon"
              size={18}
              color={themeMode === "dark" ? "#fff" : theme.textSecondary}
            />
            <Text
              style={[
                styles.themeSelectorText,
                { color: themeMode === "dark" ? "#fff" : theme.textColor },
              ]}
            >
              Dark
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.themeSelectorButton,
              { borderColor: theme.border },
              themeMode === "midnight" && {
                backgroundColor: theme.primary,
                borderColor: theme.primary,
              },
            ]}
            onPress={() => setThemeMode("midnight")}
          >
            <Ionicons
              name="contrast"
              size={18}
              color={themeMode === "midnight" ? "#fff" : theme.textSecondary}
            />
            <Text
              style={[
                styles.themeSelectorText,
                { color: themeMode === "midnight" ? "#fff" : theme.textColor },
              ]}
            >
              Midnight
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.themeSelectorButton,
              { borderColor: theme.border },
              themeMode === "sepia" && {
                backgroundColor: theme.primary,
                borderColor: theme.primary,
              },
            ]}
            onPress={() => setThemeMode("sepia")}
          >
            <Ionicons
              name="leaf"
              size={18}
              color={themeMode === "sepia" ? "#fff" : theme.textSecondary}
            />
            <Text
              style={[
                styles.themeSelectorText,
                { color: themeMode === "sepia" ? "#fff" : theme.textColor },
              ]}
            >
              Sepia
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.themeSelectorButton,
              { borderColor: theme.border },
              themeMode === "system" && {
                backgroundColor: theme.primary,
                borderColor: theme.primary,
              },
            ]}
            onPress={() => setThemeMode("system")}
          >
            <Ionicons
              name="phone-portrait"
              size={18}
              color={themeMode === "system" ? "#fff" : theme.textSecondary}
            />
            <Text
              style={[
                styles.themeSelectorText,
                { color: themeMode === "system" ? "#fff" : theme.textColor },
              ]}
            >
              System
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}
