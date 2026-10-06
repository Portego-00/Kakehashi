import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { EpubAnnotation } from "../services/epub/annotations";
import { useTheme } from "../utils/theme";

type Props = {
  visible: boolean;
  annotations: EpubAnnotation[];
  isSaving: boolean;
  error: string | null;
  onClose: () => void;
  onOpen: (annotation: EpubAnnotation) => void;
  onDelete: (annotation: EpubAnnotation) => void;
};

export function EpubSavedPassagesSheet({ visible, annotations, isSaving, error, onClose, onOpen, onDelete }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [kind, setKind] = useState<EpubAnnotation["kind"]>("bookmark");
  const entries = annotations.filter((item) => item.kind === kind).sort((a, b) => a.page - b.page || a.createdAt - b.createdAt);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close saved passages" />
        <View style={[styles.sheet, { backgroundColor: theme.cardBackground, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.textColor }]}>Saved passages</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close saved passages" onPress={onClose} style={styles.iconButton}>
              <Ionicons name="close" size={22} color={theme.textSecondary} />
            </Pressable>
          </View>
          <View style={[styles.tabs, { borderBottomColor: theme.border }]}>
            {(["bookmark", "highlight"] as const).map((tab) => (
              <Pressable key={tab} onPress={() => setKind(tab)} accessibilityRole="tab" accessibilityState={{ selected: kind === tab }}
                style={[styles.tab, { borderBottomColor: kind === tab ? theme.primary : "transparent" }]}>
                <Text style={[styles.tabText, { color: kind === tab ? theme.textColor : theme.textSecondary }]}>
                  {tab === "bookmark" ? "Bookmarks" : "Highlights"}
                </Text>
              </Pressable>
            ))}
          </View>
          {error ? <Text accessibilityRole="alert" style={[styles.error, { color: theme.error }]}>{error}</Text> : null}
          <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.list}>
            {entries.length === 0 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyTitle, { color: theme.textColor }]}>
                  {kind === "bookmark" ? "No bookmarks yet" : "No highlights yet"}
                </Text>
                <Text style={[styles.emptyHint, { color: theme.textSecondary }]}>
                  {kind === "bookmark" ? "Tap the bookmark icon in the reader to save a page." : "Select a passage in the book, then tap Highlight."}
                </Text>
              </View>
            ) : entries.map((entry) => (
              <View key={entry.id} style={[styles.row, { borderBottomColor: theme.border }]}>
                <Pressable style={styles.passage} onPress={() => onOpen(entry)} accessibilityRole="button"
                  accessibilityLabel={`Go to ${entry.kind} on page ${entry.page}. ${entry.text}`}>
                  <View style={styles.pageLabel}>
                    <Ionicons name={entry.kind === "bookmark" ? "bookmark-outline" : "pencil-outline"} size={16} color={theme.textSecondary} />
                    <Text style={[styles.pageText, { color: theme.textSecondary }]}>Page {entry.page}</Text>
                  </View>
                  {entry.text ? <Text numberOfLines={3} style={[styles.excerpt, { color: theme.textColor }]}>{entry.text}</Text> : null}
                </Pressable>
                <Pressable onPress={() => onDelete(entry)} disabled={isSaving} accessibilityRole="button"
                  accessibilityLabel={`Delete ${entry.kind} on page ${entry.page}`} style={styles.iconButton}>
                  <Ionicons name="trash-outline" size={19} color={theme.textSecondary} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.3)" },
  sheet: { maxHeight: "70%", borderTopLeftRadius: 12, borderTopRightRadius: 12, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 20, paddingRight: 8, paddingTop: 8 },
  title: { fontSize: 18, fontWeight: "600" },
  iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  tabs: { flexDirection: "row", paddingHorizontal: 20, gap: 24, borderBottomWidth: 1 },
  tab: { paddingVertical: 14, borderBottomWidth: 2 },
  tabText: { fontSize: 15, fontWeight: "500" },
  list: { paddingHorizontal: 20 },
  empty: { paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "500" },
  emptyHint: { fontSize: 14, lineHeight: 21 },
  row: { flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth },
  passage: { flex: 1, paddingVertical: 16, gap: 8 },
  pageLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  pageText: { fontSize: 12, fontVariant: ["tabular-nums"] },
  excerpt: { fontSize: 16, lineHeight: 24 },
  error: { fontSize: 14, paddingHorizontal: 20, paddingTop: 12 },
});
