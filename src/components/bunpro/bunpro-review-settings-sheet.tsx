import React from "react";
import { Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSettingsStore } from "../../utils/store";
import { useTheme } from "../../utils/theme";

export function BunproReviewSettingsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const hidden = useSettingsStore(state => state.bunproHideFurigana);
  const setHidden = useSettingsStore(state => state.setBunproHideFurigana);
  if (!visible) return null;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close Bunpro review settings" onPress={onClose} />
      <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: theme.cardBackground || theme.backgroundColor, borderColor: theme.border }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.textColor }]}>Bunpro review settings</Text>
        <View style={styles.row}>
          <Text style={[styles.label, { color: theme.textColor }]}>Hide Bunpro furigana</Text>
          <Switch accessibilityLabel="Hide Bunpro furigana" value={hidden ?? false} onValueChange={setHidden} trackColor={{ true: theme.primary || "#cc5b5d" }} />
        </View>
        <Text style={{ color: theme.textSecondary }}>Tap a word to keep its reading visible. Tap again to hide it. Readings reset on the next question.</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Done with Bunpro review settings" onPress={onClose} style={styles.done}>
          <Text style={{ color: theme.primary || theme.textColor, fontWeight: "600" }}>Done</Text>
        </Pressable>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "center", padding: 24, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderWidth: 1, borderRadius: 12, padding: 20, gap: 16 },
  title: { fontSize: 20, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  label: { flex: 1, fontSize: 16 },
  done: { alignSelf: "flex-end", minHeight: 44, minWidth: 64, alignItems: "center", justifyContent: "center" },
});
