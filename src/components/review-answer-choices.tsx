import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { fontStyles } from "../utils/fonts";
import type { ReviewAnswerChoice } from "../utils/review-multiple-choice";
import { useTheme } from "../utils/theme";

export default function ReviewAnswerChoices({
  choices,
  selectedAnswer,
  disabled,
  isReading,
  fontSize,
  maxHeight,
  onSelect,
}: {
  choices: readonly ReviewAnswerChoice[];
  selectedAnswer?: string;
  disabled: boolean;
  isReading: boolean;
  fontSize: number;
  maxHeight: number;
  onSelect: (choice: ReviewAnswerChoice) => void;
}) {
  const { theme } = useTheme();
  return (
    <ScrollView
      style={{ maxHeight, flexShrink: 1 }}
      contentContainerStyle={{ gap: 8, padding: 12 }}
      keyboardShouldPersistTaps="handled"
    >
      {choices.map((choice, index) => {
        const selected = selectedAnswer === choice.text;
        const revealed = selectedAnswer !== undefined;
        const correct = revealed && choice.isCorrect;
        const incorrect = selected && !choice.isCorrect;
        const accent = correct
          ? theme.isDark
            ? "#81c784"
            : "#26743a"
          : incorrect
            ? theme.isDark
              ? "#ff8a80"
              : "#b3261e"
            : theme.textSecondary;
        return (
          <Pressable
            key={choice.text}
            accessibilityRole="button"
            accessibilityLabel={`${index + 1}. ${choice.text}${correct ? ". Correct answer" : incorrect ? ". Incorrect answer" : ""}`}
            accessibilityState={{ disabled, selected }}
            disabled={disabled}
            onPress={() => onSelect(choice)}
            style={({ pressed }) => ({
              minHeight: 52,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 10,
              borderCurve: "continuous",
              borderWidth: 1,
              borderColor: correct || incorrect ? accent : theme.border,
              backgroundColor: correct
                ? theme.isDark
                  ? "#193423"
                  : "#edf7ef"
                : incorrect
                  ? theme.isDark
                    ? "#442320"
                    : "#fff0ee"
                  : theme.cardBackground,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                color: accent,
                fontSize: 14,
                fontWeight: "600",
                fontVariant: ["tabular-nums"],
                minWidth: 16,
              }}
            >
              {index + 1}
            </Text>
            <Text
              style={[
                isReading && fontStyles.japaneseText,
                {
                  flex: 1,
                  color: theme.textColor,
                  fontSize,
                  lineHeight: fontSize * 1.4,
                },
              ]}
            >
              {choice.text}
            </Text>
            {correct || incorrect ? (
              <Ionicons
                name={correct ? "checkmark-circle" : "close-circle"}
                size={21}
                color={accent}
              />
            ) : (
              <View style={{ width: 21 }} />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
