import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { fontStyles } from "../utils/fonts";
import { hiraganaToKata } from "../utils/katakanaMadness";
import {
  groupKanjiReadingExamples,
  type KanjiReadingExampleVocabulary,
  type KanjiReadingInput,
  type KanjiReadingType,
} from "../utils/kanji-reading-examples";
import { useSubjectColors } from "../utils/subjectColors";
import { useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";

interface KanjiReadingExamplesProps {
  groupByReading: boolean;
  kanjiCharacters: string;
  kanjiReadings: KanjiReadingInput[];
  vocabulary: KanjiReadingExampleVocabulary[];
  onSubjectPress?: (subjectId: number) => void;
  initialExamplesPerReading?: number;
  initialUngroupedExamples?: number;
}

const READING_TYPE_LABELS: Record<KanjiReadingType, string> = {
  onyomi: "On’yomi",
  kunyomi: "Kun’yomi",
  nanori: "Nanori",
};

function getPrimaryReading(example: KanjiReadingExampleVocabulary): string {
  return (
    example.readings.find((reading) => reading.primary)?.reading ??
    example.readings[0]?.reading ??
    ""
  );
}

export default function KanjiReadingExamples({
  groupByReading,
  kanjiCharacters,
  kanjiReadings,
  vocabulary,
  onSubjectPress,
  initialExamplesPerReading = 3,
  initialUngroupedExamples = 6,
}: KanjiReadingExamplesProps) {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const showOnyomiInKatakana = useSettingsStore(
    (state) => state.showOnyomiInKatakana
  );
  const [showAll, setShowAll] = useState(false);
  const groups = useMemo(
    () =>
      groupKanjiReadingExamples({
        kanjiCharacters,
        kanjiReadings,
        vocabulary,
      }),
    [kanjiCharacters, kanjiReadings, vocabulary]
  );
  const sortedVocabulary = useMemo(
    () =>
      [...vocabulary].sort(
        (left, right) =>
          (left.level ?? Number.MAX_SAFE_INTEGER) -
            (right.level ?? Number.MAX_SAFE_INTEGER) ||
          left.characters.length - right.characters.length ||
          left.id - right.id
      ),
    [vocabulary]
  );

  const renderExampleRow = (
    example: KanjiReadingExampleVocabulary,
    isLast: boolean
  ) => {
    const primaryReading = getPrimaryReading(example);
    const primaryMeaning = example.meanings[0] ?? "No meaning";

    return (
      <TouchableOpacity
        key={example.id}
        style={[
          styles.exampleRow,
          isLast
            ? styles.lastExampleRow
            : { borderBottomColor: theme.border },
        ]}
        onPress={() => onSubjectPress?.(example.id)}
        disabled={!onSubjectPress}
        accessibilityRole={onSubjectPress ? "button" : undefined}
        accessibilityLabel={`${example.characters}, ${primaryReading}, ${primaryMeaning}`}
      >
        <Text
          selectable
          numberOfLines={1}
          adjustsFontSizeToFit
          style={[
            styles.characters,
            fontStyles.japaneseBold,
            { color: theme.textColor },
          ]}
        >
          {example.characters}
        </Text>
        <View style={styles.exampleText}>
          <Text
            selectable
            numberOfLines={1}
            style={[
              styles.vocabularyReading,
              fontStyles.japaneseText,
              { color: theme.textColor },
            ]}
          >
            {primaryReading}
          </Text>
          <Text
            selectable
            numberOfLines={1}
            style={[styles.meaning, { color: theme.textSecondary }]}
          >
            {primaryMeaning}
          </Text>
        </View>
        {onSubjectPress ? (
          <Ionicons
            name="chevron-forward"
            size={18}
            color={theme.textSecondary}
          />
        ) : null}
      </TouchableOpacity>
    );
  };

  const renderShowMoreButton = (hiddenExampleCount: number) => {
    if (hiddenExampleCount <= 0) {
      return null;
    }

    return (
      <TouchableOpacity
        style={[styles.showMoreButton, { borderTopColor: theme.border }]}
        onPress={() => setShowAll((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={
          showAll
            ? "Show fewer vocabulary examples"
            : `Show ${hiddenExampleCount} more vocabulary examples`
        }
      >
        <Text style={[styles.showMoreText, { color: subjectColors.kanji }]}>
          {showAll ? "Show fewer examples" : `Show ${hiddenExampleCount} more`}
        </Text>
        <Ionicons
          name={showAll ? "chevron-up" : "chevron-down"}
          size={18}
          color={subjectColors.kanji}
        />
      </TouchableOpacity>
    );
  };

  if (!groupByReading) {
    if (sortedVocabulary.length === 0) {
      return (
        <Text
          selectable
          style={[styles.emptyText, { color: theme.textSecondary }]}
        >
          No vocabulary examples available.
        </Text>
      );
    }

    const visibleExamples = showAll
      ? sortedVocabulary
      : sortedVocabulary.slice(0, initialUngroupedExamples);
    const hiddenExampleCount = Math.max(
      0,
      sortedVocabulary.length - initialUngroupedExamples
    );

    return (
      <View>
        {visibleExamples.map((example, exampleIndex) =>
          renderExampleRow(example, exampleIndex === visibleExamples.length - 1)
        )}
        {renderShowMoreButton(hiddenExampleCount)}
      </View>
    );
  }

  if (groups.length === 0) {
    return (
      <Text selectable style={[styles.emptyText, { color: theme.textSecondary }]}>
        No vocabulary could be matched confidently to a specific reading.
      </Text>
    );
  }

  const hiddenExampleCount = groups.reduce(
    (total, group) =>
      total + Math.max(0, group.examples.length - initialExamplesPerReading),
    0
  );

  return (
    <View>
      {groups.map((group, groupIndex) => {
        const displayReading =
          group.type === "onyomi" && showOnyomiInKatakana
            ? hiraganaToKata(group.reading)
            : group.reading;
        const visibleExamples = showAll
          ? group.examples
          : group.examples.slice(0, initialExamplesPerReading);
        const previousGroup = groups[groupIndex - 1];
        const showTypeHeading =
          groupIndex === 0 || previousGroup.type !== group.type;

        return (
          <View
            key={`${group.type}-${group.normalizedReading}`}
            style={[
              styles.readingGroup,
              groupIndex > 0 && {
                borderTopColor: theme.border,
                borderTopWidth: 1,
              },
            ]}
          >
            {showTypeHeading ? (
              <Text
                selectable
                style={[styles.typeHeading, { color: theme.textColor }]}
              >
                {READING_TYPE_LABELS[group.type]}
              </Text>
            ) : null}

            <View style={styles.readingHeading}>
              <Text
                selectable
                style={[
                  styles.readingText,
                  fontStyles.japaneseBold,
                  { color: subjectColors.kanji },
                ]}
              >
                {displayReading}
              </Text>
              {group.primary ? (
                <Text
                  style={[
                    styles.primaryLabel,
                    {
                      color: subjectColors.kanji,
                      borderColor: subjectColors.kanji,
                    },
                  ]}
                >
                  Primary
                </Text>
              ) : null}
            </View>

            <View>
              {visibleExamples.map((example, exampleIndex) =>
                renderExampleRow(
                  example,
                  exampleIndex === visibleExamples.length - 1
                )
              )}
            </View>
          </View>
        );
      })}

      {renderShowMoreButton(hiddenExampleCount)}
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  readingGroup: {
    paddingVertical: 14,
  },
  typeHeading: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  readingHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
  },
  readingText: {
    fontSize: 17,
  },
  primaryLabel: {
    borderRadius: 6,
    borderWidth: 1,
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  exampleRow: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 12,
    minHeight: 58,
    paddingVertical: 8,
  },
  lastExampleRow: {
    borderBottomWidth: 0,
  },
  characters: {
    fontSize: 22,
    minWidth: 72,
    maxWidth: 120,
  },
  exampleText: {
    flex: 1,
    gap: 2,
  },
  vocabularyReading: {
    fontSize: 15,
  },
  meaning: {
    fontSize: 13,
    lineHeight: 18,
  },
  showMoreButton: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    paddingTop: 14,
  },
  showMoreText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
