import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { type Subject, getSubject } from "../utils/api";
import { getSubjectById } from "../utils/cache";
import { fontStyles } from "../utils/fonts";
import { registerOpenNoteSubjectPreview } from "../utils/note-subject-preview-state";
import {
  getBestContrastTextColor,
  type SubjectType,
  useSubjectColors,
} from "../utils/subjectColors";
import { useAuthStore } from "../utils/store";
import { useTheme } from "../utils/theme";

type NoteSubjectPreviewProps = {
  linkText: string;
  onClose: () => void;
  subjectId: number;
};

function isSubject(value: unknown): value is Subject {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Subject>;
  return (
    Number.isInteger(candidate.id) &&
    typeof candidate.object === "string" &&
    !!candidate.data &&
    Array.isArray(candidate.data.meanings)
  );
}

function getPrimaryMeaning(subject: Subject): string {
  return (
    subject.data.meanings.find((meaning) => meaning.primary)?.meaning ||
    subject.data.meanings[0]?.meaning ||
    "Unknown meaning"
  );
}

function getSubjectType(type: string): SubjectType {
  switch (type) {
    case "radical":
    case "kanji":
    case "kana_vocabulary":
      return type;
    default:
      return "vocabulary";
  }
}

function formatSubjectType(type: string): string {
  return type.replace("_", " ");
}

function formatPartsOfSpeech(partsOfSpeech: string[] | null): string {
  return (partsOfSpeech ?? [])
    .map((part) => part.replaceAll("_", " "))
    .join(" · ");
}

export default function NoteSubjectPreview({
  linkText,
  onClose,
  subjectId,
}: NoteSubjectPreviewProps) {
  const { theme } = useTheme();
  const apiToken = useAuthStore((state) => state.apiToken);
  const subjectColors = useSubjectColors();
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const [subject, setSubject] = useState<Subject | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);

  useEffect(() => registerOpenNoteSubjectPreview(), []);

  useEffect(() => {
    let cancelled = false;

    async function loadSubject() {
      setIsLoading(true);
      setError(false);
      setSubject(null);

      try {
        const cachedSubject = await getSubjectById(subjectId);
        if (cancelled) return;

        if (isSubject(cachedSubject)) {
          setSubject(cachedSubject);
          return;
        }

        if (!apiToken) throw new Error("No WaniKani account is available.");

        const fetchedSubject = await getSubject(apiToken, subjectId);
        if (cancelled) return;
        if (!isSubject(fetchedSubject)) throw new Error("Invalid subject data.");
        setSubject(fetchedSubject);
      } catch {
        if (!cancelled) {
          setSubject(null);
          setError(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadSubject();
    return () => {
      cancelled = true;
    };
  }, [apiToken, loadAttempt, subjectId]);

  const previewData = useMemo(() => {
    if (!subject) return null;

    const orderedReadings = [...(subject.data.readings ?? [])].sort(
      (left, right) =>
        left.primary === right.primary ? 0 : left.primary ? -1 : 1,
    );
    const readings = Array.from(
      new Set(orderedReadings.map((reading) => reading.reading)),
    ).join(" · ");
    const meanings = Array.from(
      new Set(subject.data.meanings.map((meaning) => meaning.meaning)),
    )
      .slice(0, 4)
      .join(" · ");

    return {
      characters: subject.data.characters || getPrimaryMeaning(subject),
      meanings,
      readings,
      partsOfSpeech: formatPartsOfSpeech(subject.data.parts_of_speech),
      type: formatSubjectType(subject.object),
    };
  }, [subject]);

  const subjectColor = subject
    ? subjectColors.getColorForType(getSubjectType(subject.object))
    : theme.primary;
  const headerTextColor = getBestContrastTextColor(subjectColor);
  const cardWidth = Math.min(380, width - 32);
  const cardMaxHeight = Math.max(
    240,
    height - Math.max(insets.top, 16) - Math.max(insets.bottom, 16) - 32,
  );

  return (
    <Modal
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.overlay}>
        <Pressable
          accessible={false}
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View
          accessibilityViewIsModal
          style={[
            styles.card,
            {
              width: cardWidth,
              maxHeight: cardMaxHeight,
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={[styles.header, { backgroundColor: subjectColor }]}>
            <View style={styles.headerText}>
              <Text
                numberOfLines={2}
                selectable
                style={[
                  styles.characters,
                  fontStyles.japaneseText,
                  { color: headerTextColor },
                ]}
              >
                {previewData?.characters || linkText}
              </Text>
              {subject ? (
                <Text style={[styles.headerMeta, { color: headerTextColor }]}>
                  {previewData?.type} · Level {subject.data.level}
                </Text>
              ) : null}
            </View>

            <Pressable
              accessibilityLabel="Close word preview"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                { opacity: pressed ? 0.55 : 1 },
              ]}
            >
              <Ionicons name="close" size={22} color={headerTextColor} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            contentInsetAdjustmentBehavior="never"
          >
            {isLoading ? (
              <View style={styles.state}>
                <ActivityIndicator size="small" color={theme.primary} />
                <Text
                  style={[styles.stateText, { color: theme.textSecondary }]}
                >
                  Loading subject…
                </Text>
              </View>
            ) : error || !previewData ? (
              <View style={styles.state}>
                <Text
                  selectable
                  style={[styles.stateText, { color: theme.textSecondary }]}
                >
                  This linked subject could not be loaded. It may no longer be available.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setLoadAttempt((attempt) => attempt + 1)}
                  style={({ pressed }) => [
                    styles.retryButton,
                    { borderColor: theme.border, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text style={[styles.retryText, { color: theme.primary }]}>
                    Try again
                  </Text>
                </Pressable>
              </View>
            ) : (
              <>
                {previewData.readings ? (
                  <View style={styles.row}>
                    <Text
                      style={[styles.label, { color: theme.textSecondary }]}
                    >
                      Reading
                    </Text>
                    <Text
                      selectable
                      style={[
                        styles.value,
                        fontStyles.japaneseText,
                        { color: theme.textColor },
                      ]}
                    >
                      {previewData.readings}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.row}>
                  <Text style={[styles.label, { color: theme.textSecondary }]}>
                    Meaning
                  </Text>
                  <Text
                    selectable
                    style={[styles.value, { color: theme.textColor }]}
                  >
                    {previewData.meanings}
                  </Text>
                </View>

                {previewData.partsOfSpeech ? (
                  <View style={styles.row}>
                    <Text
                      style={[styles.label, { color: theme.textSecondary }]}
                    >
                      Grammar
                    </Text>
                    <Text
                      selectable
                      style={[styles.value, { color: theme.textColor }]}
                    >
                      {previewData.partsOfSpeech}
                    </Text>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    padding: 16,
    backgroundColor: "rgba(0, 0, 0, 0.48)",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  header: {
    minHeight: 82,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  characters: {
    fontSize: 27,
    lineHeight: 36,
    fontWeight: "700",
  },
  headerMeta: {
    fontSize: 13,
    opacity: 0.88,
    textTransform: "capitalize",
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 16,
    gap: 14,
  },
  row: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
  },
  value: {
    fontSize: 16,
    lineHeight: 23,
  },
  state: {
    minHeight: 120,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  stateText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  retryButton: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  retryText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
