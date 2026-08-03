import React from "react";
import {
  Linking,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import {
  getKanjiEtymology,
  type KanjiEtymologyEntry,
} from "../data/kanjiEtymology";
import { useTheme } from "../utils/theme";

interface KanjiEtymologySectionProps {
  characters: string | null | undefined;
  presentation?: "details" | "lesson";
  visible?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function KanjiEtymologySection({
  characters,
  presentation = "lesson",
  visible = true,
  style,
}: KanjiEtymologySectionProps) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const entry: KanjiEtymologyEntry | null = visible
    ? getKanjiEtymology(characters)
    : null;

  if (!entry) {
    return null;
  }

  const openSource = () => {
    void Linking.openURL(entry.source.url).catch(() => undefined);
  };

  const content = (
    <>
      <Text
        selectable
        style={[
          styles.explanation,
          presentation === "details"
            ? styles.detailsExplanation
            : styles.lessonExplanation,
        ]}
      >
        {entry.explanation}
      </Text>
      {entry.note ? (
        <Text selectable style={styles.note}>
          {entry.note}
        </Text>
      ) : null}
      <TouchableOpacity
        accessibilityHint="Opens the etymology source"
        accessibilityLabel={`Source: ${entry.source.title}`}
        accessibilityRole="link"
        activeOpacity={0.7}
        onPress={openSource}
        style={styles.sourceLink}
      >
        <Text selectable style={styles.sourceText}>
          Source: {entry.source.title} ↗
        </Text>
      </TouchableOpacity>
    </>
  );

  if (presentation === "details") {
    return (
      <View
        accessibilityLabel="Kanji etymology"
        style={[styles.detailsSection, style]}
        testID="kanji-etymology-section"
      >
        <Text selectable style={styles.detailsTitle}>
          Etymology
        </Text>
        <View style={styles.detailsCard} testID="kanji-etymology-card">
          {content}
        </View>
      </View>
    );
  }

  return (
    <View
      accessibilityLabel="Kanji etymology"
      style={[styles.lessonCard, style]}
      testID="kanji-etymology-section"
    >
      <Text selectable style={styles.lessonTitle}>
        Etymology
      </Text>
      {content}
    </View>
  );
}

const createStyles = (theme: ReturnType<typeof useTheme>["theme"]) =>
  StyleSheet.create({
    lessonCard: {
      backgroundColor: theme.cardBackground,
      borderCurve: "continuous",
      borderColor: theme.border,
      borderRadius: 20,
      borderWidth: 0.5,
      boxShadow: theme.isDark
        ? "0 2px 12px rgba(0, 0, 0, 0.3)"
        : "0 2px 12px rgba(0, 0, 0, 0.08)",
      marginBottom: 20,
      padding: 24,
    },
    lessonTitle: {
      color: theme.textColor,
      fontSize: 16,
      fontWeight: "800",
      letterSpacing: -0.3,
      marginBottom: 20,
      textTransform: "uppercase",
    },
    detailsSection: {
      marginHorizontal: 16,
      marginTop: 16,
    },
    detailsTitle: {
      color: theme.textColor,
      fontSize: 18,
      fontWeight: "bold",
      marginBottom: 8,
    },
    detailsCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: 8,
      padding: 16,
      shadowColor: "rgba(0,0,0,0.1)",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.8,
      shadowRadius: 1,
      ...Platform.select({
        ios: { elevation: 1 },
        android: {
          borderColor: "rgba(0,0,0,0.06)",
          borderWidth: 1,
        },
      }),
    },
    explanation: {
      fontWeight: "400",
    },
    lessonExplanation: {
      color: theme.textSecondary,
      fontSize: 17,
      lineHeight: 26,
    },
    detailsExplanation: {
      color: theme.textColor,
      fontSize: 16,
      lineHeight: 24,
    },
    note: {
      color: theme.textLight,
      fontSize: 14,
      fontStyle: "italic",
      lineHeight: 21,
      marginTop: 12,
    },
    sourceLink: {
      alignItems: "center",
      alignSelf: "flex-start",
      flexDirection: "row",
      gap: 6,
      marginTop: 16,
      minHeight: 44,
    },
    sourceText: {
      color: theme.primary,
      fontSize: 14,
      fontWeight: "600",
    },
  });
