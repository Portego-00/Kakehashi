import { SettingsIcon as Ionicons } from "../../../ui/settings/settings-icon";
import { SettingsLabel } from "../../../ui/settings/settings-search";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { router } from "expo-router";
import { useSettingsStore } from "../../../utils/store";
import { useTheme } from "../../../utils/theme";
import {
  MAX_LEARNING_PAGES,
  describeLearningPageFilter,
} from "../../../utils/learningPages";
import { styles } from "../styles";

export function LearningPagesSetting() {
  const { theme } = useTheme();
  const pages = useSettingsStore((state) => state.learningPages);
  const atLimit = pages.length >= MAX_LEARNING_PAGES;

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
      <View style={[styles.settingItem, { borderBottomColor: "transparent" }]}>
        <Ionicons name="layers-outline" size={24} color={theme.primary} style={styles.settingIcon} />
        <View style={styles.settingTextContainer}>
          <SettingsLabel style={[styles.settingText, { color: theme.textColor }]}>
            Learning Pages
          </SettingsLabel>
          <Text style={[styles.settingSubtext, { color: theme.textSecondary }]}>
            Filtered versions of Home. Switch between them at the top of Home.
          </Text>
        </View>
      </View>
      <View style={{ marginLeft: 56, marginRight: 16, marginBottom: 16 }}>
        {pages.map((page) => (
          <TouchableOpacity
            key={page.id}
            onPress={() => router.push({ pathname: "/learning-page", params: { id: page.id } })}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${page.name} learning page`}
            style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.border }}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: theme.textColor }}>{page.name}</Text>
              <Text style={{ fontSize: 13, marginTop: 3, color: theme.textSecondary }}>
                {describeLearningPageFilter(page.filter)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={() => router.push("/learning-page")}
          disabled={atLimit}
          accessibilityRole="button"
          accessibilityLabel="Add Learning Page"
          accessibilityState={{ disabled: atLimit }}
          style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, padding: 12, borderRadius: 8, backgroundColor: theme.border, opacity: atLimit ? 0.4 : 1 }}
        >
          <Ionicons name="add" size={18} color={theme.primary} />
          <Text style={{ fontSize: 14, fontWeight: "600", color: theme.primary }}>Add Page</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 12, textAlign: "center", color: theme.textSecondary, marginTop: 8 }}>
          {pages.length} of {MAX_LEARNING_PAGES} pages{atLimit ? " · limit reached" : ""}
        </Text>
      </View>
    </View>
  );
}
