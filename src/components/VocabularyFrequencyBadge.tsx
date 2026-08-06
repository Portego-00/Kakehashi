import React from "react";
import { StyleSheet, Text } from "react-native";
import { useVocabularyFrequency } from "../hooks/useVocabularyFrequency";
import type { VocabularyFrequencySubject } from "../services/vocabularyFrequencyService";
import { useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";

interface VocabularyFrequencyBadgeProps {
  subject: VocabularyFrequencySubject;
  variant?: "review" | "details";
}

export default function VocabularyFrequencyBadge({
  subject,
  variant = "review",
}: VocabularyFrequencyBadgeProps) {
  const settingEnabled = useSettingsStore(
    (state) => state.showVocabularyFrequency,
  );

  if (!settingEnabled) {
    return null;
  }

  return <EnabledVocabularyFrequencyBadge subject={subject} variant={variant} />;
}

function EnabledVocabularyFrequencyBadge({
  subject,
  variant = "review",
}: VocabularyFrequencyBadgeProps) {
  const { theme } = useTheme();
  const { result } = useVocabularyFrequency(subject);
  const isDetails = variant === "details";
  const value = result
    ? `#${result.frequencyRank.toLocaleString()}`
    : "#---";
  const accessibilityLabel = result
    ? `Vocabulary frequency ${value}`
    : "Vocabulary frequency unavailable";

  return (
    <Text
      selectable
      style={[
        isDetails ? styles.detailsText : styles.reviewText,
        isDetails && { color: theme.textColor },
      ]}
      accessibilityLabel={accessibilityLabel}
    >
      {value}
    </Text>
  );
}

const styles = StyleSheet.create({
  reviewText: {
    marginTop: 8,
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  detailsText: {
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
});
