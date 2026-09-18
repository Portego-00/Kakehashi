import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { VoiceDebugTrace } from "../hooks/useVoiceRecognitionDebug";
import { useTheme } from "../utils/theme";

export function VoiceRecognitionDebug({ traces, onClear }: {
  traces: VoiceDebugTrace[];
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { theme } = useTheme();
  const textStyle = [styles.detail, { color: theme.textSecondary }];
  return (
    <View style={styles.container}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={expanded ? "Hide voice diagnostics" : "Show voice diagnostics"}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        style={styles.toggle}
      >
        <Ionicons name="bug-outline" size={14} color={theme.textSecondary} />
        <Text style={textStyle}>Voice debug</Text>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={12} color={theme.textSecondary} />
      </TouchableOpacity>
      {expanded && (
        <ScrollView style={[styles.panel, { borderColor: theme.border, backgroundColor: theme.cardBackground }]} contentContainerStyle={styles.panelContent} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {!traces.length && <Text style={textStyle}>Start the mic to inspect a capture.</Text>}
          {traces.map((trace) => (
            <View key={trace.id} style={[styles.capture, { borderColor: theme.border }]}>
              <Text style={[styles.title, { color: theme.textColor }]}>#{trace.id} · {trace.subject} · {trace.locale}</Text>
              <Text style={textStyle}>Engine: {trace.engine === "speech-transcriber" ? "Apple SpeechTranscriber" : "Apple Speech (legacy)"}</Text>
              <Text style={textStyle}>Actual processing: {trace.processing === "on-device" ? "On-device" : "Not reported by iOS"}</Text>
              {trace.processing === "system-selected" && <Text style={textStyle}>Cloud allowed does not mean cloud used.</Text>}
              {!!trace.fallbackReason && <Text style={textStyle}>Fallback: {trace.fallbackReason}</Text>}
              <Text style={textStyle}>Requested mode: {trace.processing === "on-device" ? "On-device only" : "Automatic (cloud allowed)"}</Text>
              <Text style={textStyle}>{trace.phase} · Hint: {trace.taskHint}</Text>
              <Text style={textStyle}>Vocabulary hints: {trace.contextualStrings.join(" · ") || "None"}</Text>
              {trace.firstResultMs !== undefined && (
                <Text style={textStyle}>First text: {trace.firstResultMs} ms · Latest {trace.final ? "final" : "partial"}: {trace.latestResultMs} ms</Text>
              )}
              {trace.alternatives.map((alternative, index) => (
                <Text key={index} selectable style={[styles.detail, { color: theme.textColor }]}>
                  {index + 1}. {alternative.transcript} → {alternative.reading || "unresolved"}
                  {Number.isFinite(alternative.confidence) && alternative.confidence > 0
                    ? ` (${Math.round(alternative.confidence * 100)}%)` : " (confidence unavailable)"}
                </Text>
              ))}
              {!!trace.selectedAnswer && <Text style={textStyle}>Selected answer: {trace.selectedAnswer}</Text>}
              {!!trace.error && <Text style={[styles.detail, { color: theme.error }]}>{trace.error}</Text>}
            </View>
          ))}
          <View style={styles.footer}>
            <Text style={[textStyle, styles.note]}>Last 3 captures · kept only in this session</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear voice diagnostics" onPress={onClear} hitSlop={8}>
              <Text style={[styles.detail, { color: theme.primary }]}>Clear</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 6 },
  toggle: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", gap: 6, paddingVertical: 8 },
  panelContent: { padding: 12, gap: 6 },
  panel: { maxHeight: 260, borderWidth: StyleSheet.hairlineWidth, borderRadius: 8 },
  capture: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 3 },
  title: { fontSize: 12, fontWeight: "600" },
  detail: { fontSize: 12, lineHeight: 17 },
  footer: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 6 },
  note: { flex: 1 },
});
