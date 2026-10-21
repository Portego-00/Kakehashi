import React, { useEffect, useState } from "react";
import { Platform, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SettingsLabel } from "../../../ui/settings/settings-search";
import { SettingsRowIcon } from "../../../ui/settings/settings-row-icon";
import { normalizeReviewPromptTextColor } from "../../../utils/review-prompt-color";
import { useSettingsStore } from "../../../utils/store";
import { useTheme } from "../../../utils/theme";

function NativeColorPicker({ color, label, onChange, dark }: {
  color: string;
  label: string;
  onChange: (color: string) => void;
  dark: boolean;
}) {
  // Load the native picker only when its iOS control is actually displayed.
  /* eslint-disable @typescript-eslint/no-require-imports -- SwiftUI native views must not load on Android. */
  const { Host, ColorPicker } = require("@expo/ui/swift-ui") as typeof import("@expo/ui/swift-ui");
  const { accessibilityLabel } = require("@expo/ui/swift-ui/modifiers") as typeof import("@expo/ui/swift-ui/modifiers");
  /* eslint-enable @typescript-eslint/no-require-imports */
  return <Host matchContents colorScheme={dark ? "dark" : "light"} style={styles.picker}>
    <ColorPicker label="" modifiers={[accessibilityLabel(label)]} selection={color} supportsOpacity={false} onSelectionChange={(value) => {
      const normalized = normalizeReviewPromptTextColor(value.slice(0, 7));
      if (normalized) onChange(normalized);
    }} />
  </Host>;
}

export function ReviewPromptColorSetting({ provider }: { provider: "wanikani" | "bunpro" }) {
  const { theme } = useTheme();
  const bunpro = provider === "bunpro";
  const color = useSettingsStore((state) => bunpro ? state.bunproReviewPromptTextColor : state.reviewPromptTextColor);
  const setColor = useSettingsStore((state) => bunpro ? state.setBunproReviewPromptTextColor : state.setReviewPromptTextColor);
  const customColor = normalizeReviewPromptTextColor(color);
  const label = `${bunpro ? "Bunpro" : "WaniKani"} prompt text color`;
  const defaultColor = bunpro ? normalizeReviewPromptTextColor(theme.textColor) || "#202124" : "#ffffff";
  const [draft, setDraft] = useState(customColor.slice(1).toUpperCase());
  useEffect(() => setDraft(customColor.slice(1).toUpperCase()), [customColor]);

  return <View style={[styles.setting, { borderBottomColor: theme.border }]}>
    <View style={styles.row}>
      <SettingsRowIcon setting="character-size" color={theme.primary} />
      <View style={styles.copy}>
        <SettingsLabel style={[styles.label, { color: theme.textColor }]}>{label}</SettingsLabel>
        <Text style={[styles.description, { color: theme.textSecondary }]}>
          {bunpro ? "Color of the Japanese review sentence." : "Color of the reviewed item in WaniKani reviews and extra study."}
          {customColor ? "" : " Using the default color."}
        </Text>
      </View>
      <Switch accessibilityLabel={`Custom ${label}`} value={Boolean(customColor)} onValueChange={(enabled) => setColor(enabled ? defaultColor : "")} trackColor={{ false: "#767577", true: theme.primary }} thumbColor="#f4f3f4" />
    </View>
    {customColor ? <View style={styles.controls}>
      {Platform.OS === "ios" ? <NativeColorPicker color={customColor} label={label} onChange={setColor} dark={theme.isDark} /> : <View accessibilityLabel={`${label} preview`} style={[styles.swatch, { backgroundColor: customColor, borderColor: theme.border }]} />}
      <Text style={{ color: theme.textSecondary }}>#</Text>
      <TextInput accessibilityLabel={`${label} hexadecimal value`} value={draft} selectTextOnFocus autoCapitalize="characters" autoCorrect={false} maxLength={6} returnKeyType="done" onChangeText={(text) => {
        const next = text.replace(/[^0-9a-f]/gi, "").slice(0, 6).toUpperCase();
        setDraft(next);
        if (next.length === 6) setColor(`#${next}`);
      }} onEndEditing={() => setDraft(customColor.slice(1).toUpperCase())} style={[styles.input, { color: theme.textColor, borderColor: theme.border }]} />
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  setting: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  row: { minHeight: 44, flexDirection: "row", alignItems: "center" },
  copy: { flex: 1, marginRight: 12 },
  label: { fontSize: 14, fontWeight: "500" },
  description: { fontSize: 12, marginTop: 4 },
  controls: { flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 32 },
  picker: { width: 44, height: 44 },
  swatch: { width: 36, height: 36, borderWidth: 1, borderRadius: 6 },
  input: { minHeight: 44, minWidth: 100, paddingHorizontal: 12, borderWidth: 1, borderRadius: 6, fontSize: 16 },
});
