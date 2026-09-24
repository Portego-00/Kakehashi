import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../utils/theme";

export type AnalyticsSource = "wanikani" | "bunpro";

/** Shared by the dedicated analytics tab and the default Progress > Analytics segment. */
export default function BunproAnalyticsSourceTabs({ source, onChange }: { source: AnalyticsSource; onChange: (source: AnalyticsSource) => void }) {
  const { theme } = useTheme();
  return <View accessibilityRole="tablist" style={[styles.tabs, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
    {([['wanikani', 'WaniKani'], ['bunpro', 'Bunpro']] as const).map(([key, label]) => <TouchableOpacity key={key} accessibilityRole="tab" accessibilityState={{ selected: source === key }} onPress={() => onChange(key)} style={[styles.tab, { borderBottomColor: source === key ? (key === "bunpro" ? "#cc5b5d" : theme.primary) : "transparent" }]}>
      <Text style={[styles.label, { color: source === key ? theme.textColor : theme.textSecondary }]}>{label}</Text>
    </TouchableOpacity>)}
  </View>;
}

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 16 },
  tab: { flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderBottomWidth: 2 },
  label: { fontSize: 15, fontWeight: "600" },
});
