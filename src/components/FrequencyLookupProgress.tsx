import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { VocabularyFrequencyLookupError, VocabularyFrequencyProgress } from "../hooks/useVocabularyFrequencyRanks";
import { useTheme } from "../utils/theme";

interface FrequencyLookupProgressProps {
  total: number;
  resolvedCount: number;
  unresolvedCount: number;
  isScanningCache: boolean;
  progress: VocabularyFrequencyProgress;
  needsApproval: boolean;
  lookupError: VocabularyFrequencyLookupError | null;
  onApprove: () => void;
  onRetry: () => void;
  onClear: () => void;
}

export function FrequencyLookupProgress({
  total, resolvedCount, unresolvedCount, isScanningCache, progress,
  needsApproval, lookupError, onApprove, onRetry, onClear,
}: FrequencyLookupProgressProps) {
  const { theme } = useTheme();
  const completed = Math.min(total, Math.max(0, isScanningCache ? progress.completed : resolvedCount));
  const fraction = total > 0 ? completed / total : 0;
  const automaticRetry = lookupError?.phase === "network" && lookupError.reason === "automatic_retry";
  const retryCoolingDown = lookupError?.phase === "network" && (lookupError.retryAt ?? 0) > Date.now();
  const showLookupAction = needsApproval || (lookupError && !automaticRetry);
  const status = isScanningCache
    ? "Checking saved frequencies"
    : automaticRetry
      ? "Paused · Resumes automatically"
      : lookupError
        ? lookupError.phase === "cache" ? "Saved data unavailable" : "Frequency check interrupted"
        : needsApproval ? "Word frequencies" : "Checking word frequencies";

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
      <View style={styles.heading}>
        <Text style={[styles.title, { color: theme.textColor }]}>{status}</Text>
        <Text style={[styles.count, { color: theme.textSecondary }]}>
          {completed.toLocaleString()} / {total.toLocaleString()}
        </Text>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={isScanningCache ? "Saved frequency check progress" : "Word frequency check progress"}
        accessibilityValue={{ min: 0, max: Math.max(1, total), now: completed, text: `${completed} of ${total} words checked` }}
        style={[styles.track, { backgroundColor: theme.border }]}
      >
        <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: theme.primary }]} />
      </View>
      <Text style={[styles.note, { color: theme.textSecondary }]}>One-time check · Saved for next time</Text>
      <View style={styles.actions}>
        {showLookupAction ? (
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel={needsApproval ? "Check remaining word frequencies" : "Retry word frequency check"}
            accessibilityState={{ disabled: retryCoolingDown }}
            disabled={retryCoolingDown}
            onPress={needsApproval ? onApprove : onRetry}
            style={[styles.action, { backgroundColor: theme.primary, borderColor: theme.primary }, retryCoolingDown && styles.disabled]}
          >
            <Text style={styles.primaryActionText}>
              {needsApproval ? `Check ${unresolvedCount.toLocaleString()} words` : retryCoolingDown ? "Retry paused" : "Retry"}
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Clear word frequency filter"
          onPress={onClear}
          style={[styles.action, { borderColor: theme.border }]}
        >
          <Text style={[styles.actionText, { color: theme.textSecondary }]}>Clear filter</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 16, marginBottom: 8, padding: 12, borderWidth: 1, borderRadius: 12, gap: 8 },
  heading: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, fontSize: 13, fontWeight: "600" },
  count: { fontSize: 12, fontVariant: ["tabular-nums"] },
  track: { height: 4, borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%" },
  note: { fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { flex: 1, minWidth: 120, minHeight: 44, paddingHorizontal: 8, paddingVertical: 10, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  actionText: { fontSize: 12, fontWeight: "600", textAlign: "center" },
  primaryActionText: { color: "white", fontSize: 12, fontWeight: "600", textAlign: "center" },
  disabled: { opacity: 0.45 },
});
