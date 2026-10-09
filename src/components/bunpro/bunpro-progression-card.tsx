import React from "react";
import { Text, View } from "react-native";
import type { BunproProgression } from "../../utils/bunpro-progression";
import { useSettingsStore } from "../../utils/store";
import { useTheme } from "../../utils/theme";

export function BunproProgressionCard({ progression }: { progression?: BunproProgression | null }) {
  const { theme } = useTheme();
  const mode = useSettingsStore(state => state.srsProgressionCardDisplayMode);
  if (!progression?.to || mode === "hidden") return null;
  return <View accessibilityLiveRegion="polite" style={{ padding: 12, gap: 4, borderWidth: 1, borderRadius: 8, borderColor: theme.border, backgroundColor: theme.cardBackground }}>
    {mode !== "compact" ? <Text numberOfLines={1} style={{ color: theme.textColor, fontWeight: "600" }}>{progression.title}</Text> : null}
    <Text style={{ color: progression.direction === "down" ? theme.error : "#017b37" }}>{progression.from} → {progression.to}</Text>
    {mode !== "compact" && progression.nextReview ? <Text style={{ color: theme.textSecondary }}>Next review {progression.nextReview}</Text> : null}
  </View>;
}
