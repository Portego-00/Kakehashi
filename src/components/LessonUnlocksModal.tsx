import React from "react";
import { FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { useLearningDisplay } from "../features/translation-packages/display";
import type { LessonUnlockSubject } from "../utils/lessonUnlocks";
import { getSubjectTypeColor } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";
import type { LessonPickerItem } from "./LessonPicker";

interface LessonUnlocksModalProps {
  source: LessonPickerItem["subject"] | null;
  subjects: readonly LessonUnlockSubject[];
  onClose: () => void;
}

export default function LessonUnlocksModal({ source, subjects, onClose }: LessonUnlocksModalProps) {
  const { theme } = useTheme();
  const contentDisplay = useLearningDisplay();
  const isRadical = source?.object === "radical";
  const targetType = isRadical ? "kanji" : "vocabulary";
  const sourceMeaning = source?.data.meanings.find((meaning) => meaning.primary)?.meaning
    ?? source?.data.meanings[0]?.meaning ?? "";

  return (
    <Modal
      visible={source !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      allowSwipeDismissal
      onRequestClose={onClose}
    >
      <SafeAreaProvider>
        <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.textColor }]}>
              {isRadical ? "Kanji unlocks" : "Vocabulary unlocks"}
            </Text>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close unlocks"
              onPress={onClose}
              style={styles.closeButton}
            >
              <Text style={[styles.closeText, { color: theme.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.summary}>
            <Text selectable style={[styles.source, { color: theme.textColor }]}>
              {[source?.data.characters, source && contentDisplay.meaning(source, sourceMeaning)].filter(Boolean).join(" · ")}
            </Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {subjects.length} same-level {isRadical ? "kanji" : `vocabulary ${subjects.length === 1 ? "word" : "words"}`} {subjects.length === 1 ? "depends" : "depend"} on this {isRadical ? "radical" : "kanji"} reaching Guru.
              {isRadical
                ? " All radicals in each kanji must reach Guru to unlock it."
                : " All kanji in each word must reach Guru to unlock it."}
            </Text>
          </View>
          <FlatList
            data={subjects}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No same-level {targetType} unlocks for this {isRadical ? "radical" : "kanji"}.
              </Text>
            }
            renderItem={({ item }) => {
              const meaning = item.data.meanings.find((entry) => entry.primary)?.meaning
                ?? item.data.meanings[0]?.meaning ?? "";
              const reading = item.data.readings?.find((entry) => entry.primary)?.reading
                ?? item.data.readings?.[0]?.reading;
              return (
                <View style={[styles.row, { borderBottomColor: theme.border }]}>
                  <View style={[styles.characters, { backgroundColor: getSubjectTypeColor(targetType) }]}>
                    <Text selectable style={styles.characterText}>{item.data.characters}</Text>
                  </View>
                  <View style={styles.details}>
                    <Text selectable style={[styles.meaning, { color: theme.textColor }]}>
                      {contentDisplay.meaning(item, meaning)}
                    </Text>
                    {reading ? <Text selectable style={[styles.reading, { color: theme.textSecondary }]}>{reading}</Text> : null}
                  </View>
                  <Text style={{ color: theme.textSecondary }}>Level {item.data.level}</Text>
                </View>
              );
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingLeft: 20, paddingRight: 8, paddingTop: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { flex: 1, fontSize: 20, fontWeight: "700" },
  closeButton: { minWidth: 60, minHeight: 44, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 16, fontWeight: "600" },
  summary: { padding: 20, gap: 10 },
  source: { fontSize: 22, fontWeight: "600" },
  description: { fontSize: 14, lineHeight: 21 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  characters: { minWidth: 48, minHeight: 48, paddingHorizontal: 10, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  characterText: { color: "#ffffff", fontSize: 22 },
  details: { flex: 1, gap: 4 },
  meaning: { fontSize: 16, fontWeight: "600" },
  reading: { fontSize: 14 },
  emptyText: { fontSize: 15, lineHeight: 22, paddingVertical: 16 },
});
