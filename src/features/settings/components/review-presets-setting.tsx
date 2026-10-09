import React from "react";
import { Switch, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSettingsStore } from "../../../utils/store";
import { useTheme } from "../../../utils/theme";
import { MAX_REVIEW_PRESETS } from "../../../utils/review-presets";
import { getReviewOrderLabel } from "../../../utils/reviewOrdering";
import { styles } from "../styles";

export function ReviewPresetsSetting() {
  const { theme } = useTheme();
  const enabled = useSettingsStore((state) => state.reviewPresetsEnabled);
  const presets = useSettingsStore((state) => state.reviewPresets);
  const setEnabled = useSettingsStore((state) => state.setReviewPresetsEnabled);
  const atLimit = presets.length >= MAX_REVIEW_PRESETS;

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: theme.border }}>
      <View style={styles.settingItem}>
        <Ionicons name="grid-outline" size={24} color={theme.primary} style={styles.settingIcon} />
        <View style={styles.settingTextContainer}>
          <Text style={[styles.settingText, { color: theme.textColor }]}>Review Presets</Text>
          <Text style={[styles.settingSubtext, { color: theme.textSecondary }]}>Choose up to 3 presets from the Home card</Text>
        </View>
        <Switch accessibilityLabel="Review Presets" value={enabled} onValueChange={setEnabled} trackColor={{ false: "#767577", true: theme.primary }} thumbColor="#f4f3f4" />
      </View>
      {enabled ? (
        <View style={{ marginLeft: 56, marginRight: 16, marginBottom: 16 }}>
          {presets.map((preset) => (
            <TouchableOpacity
              key={preset.id}
              onPress={() => router.push({ pathname: "/review-preset", params: { id: preset.id } })}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${preset.name} preset`}
              style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: 1, borderTopColor: theme.border }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: "600", color: theme.textColor }}>{preset.name}</Text>
                <Text style={{ fontSize: 13, marginTop: 3, color: theme.textSecondary }}>{preset.batchSize} reviews · {getReviewOrderLabel(preset.reviewOrder)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => router.push("/review-preset")}
            disabled={atLimit}
            accessibilityRole="button"
            accessibilityLabel="Add Preset"
            accessibilityState={{ disabled: atLimit }}
            style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 6, padding: 12, borderRadius: 8, backgroundColor: theme.border, opacity: atLimit ? 0.4 : 1 }}
          >
            <Ionicons name="add" size={18} color={theme.primary} />
            <Text style={{ fontSize: 14, fontWeight: "600", color: theme.primary }}>Add Preset</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 12, textAlign: "center", color: theme.textSecondary, marginTop: 8 }}>{presets.length} of {MAX_REVIEW_PRESETS} presets{atLimit ? " · limit reached" : ""}</Text>
        </View>
      ) : null}
    </View>
  );
}
