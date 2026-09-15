import React from "react";
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import type { VocabularyFrequencySubject } from "../services/vocabularyFrequencyService";
import { getJLPTLevelForSubject } from "../utils/jlptClassification";
import { useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";
import VocabularyFrequencyBadge from "./VocabularyFrequencyBadge";

interface SubjectMetadataRowsProps {
  subject: VocabularyFrequencySubject;
  style?: StyleProp<ViewStyle>;
}

export default function SubjectMetadataRows({
  subject,
  style,
}: SubjectMetadataRowsProps) {
  const showJLPTLevel = useSettingsStore((state) => state.showJLPTLevel);
  const showVocabularyFrequency = useSettingsStore(
    (state) => state.showVocabularyFrequency,
  );
  const { theme } = useTheme();
  const isVocabulary =
    subject.object === "vocabulary" || subject.object === "kana_vocabulary";
  const showLevel =
    showJLPTLevel && (isVocabulary || subject.object === "kanji");
  const showFrequency = showVocabularyFrequency && isVocabulary;

  if (!showLevel && !showFrequency) return null;

  const level = showLevel ? getJLPTLevelForSubject(subject) : null;

  return (
    <View style={[styles.rows, style]}>
      {showLevel ? (
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            JLPT Level
          </Text>
          <Text selectable style={[styles.value, { color: theme.textColor }]}>
            {level ?? "Not classified"}
          </Text>
        </View>
      ) : null}
      {showFrequency ? (
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>
            Frequency
          </Text>
          <View style={styles.frequencyValue}>
            <VocabularyFrequencyBadge subject={subject} variant="details" />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center" },
  label: { width: 100, fontSize: 14 },
  value: { flex: 1, fontSize: 16, fontWeight: "500" },
  frequencyValue: { flex: 1 },
});
