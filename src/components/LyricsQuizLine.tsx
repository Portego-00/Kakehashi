import { Ionicons } from "@expo/vector-icons";
import type { ReactElement } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type TextStyle,
} from "react-native";

import type { LyricsQuizQuestion } from "../utils/lyricsQuiz";
import { fontStyles } from "../utils/fonts";

interface LyricsQuizLineProps {
  question: LyricsQuizQuestion;
  selectedAnswer?: string;
  showOptions: boolean;
  isPlaybackPaused?: boolean;
  onSelectAnswer: (answer: string) => void;
  onOpenAnswerDetails?: (event: GestureResponderEvent) => void;
  onReplay: () => void;
  onSkip: () => void;
  textStyle: StyleProp<TextStyle>;
  variant?: "screen" | "player";
  accentColor?: string;
  borderColor?: string;
  textColor?: string;
  mutedTextColor?: string;
  surfaceColor?: string;
}

const OPTION_LABELS = ["A", "B", "C", "D"] as const;

export function LyricsQuizLine({
  question,
  selectedAnswer,
  showOptions,
  isPlaybackPaused = false,
  onSelectAnswer,
  onOpenAnswerDetails,
  onReplay,
  onSkip,
  textStyle,
  variant = "screen",
  accentColor = "#7c3aed",
  borderColor = "rgba(148, 163, 184, 0.45)",
  textColor = "#111827",
  mutedTextColor = "#6b7280",
  surfaceColor = "rgba(127,127,127,0.06)",
}: LyricsQuizLineProps): ReactElement {
  const isCorrect = selectedAnswer === question.answer;
  const hasWrongAnswer = Boolean(selectedAnswer) && !isCorrect;
  const playerVariant = variant === "player";
  const resolvedTextColor = playerVariant ? "#fff" : textColor;
  const resolvedMutedTextColor = playerVariant
    ? "rgba(255,255,255,0.68)"
    : mutedTextColor;
  const resolvedSurfaceColor = playerVariant
    ? "rgba(255,255,255,0.08)"
    : surfaceColor;
  const instruction = hasWrongAnswer
    ? "Not quite. Try another word or replay the line."
    : isPlaybackPaused
      ? "Choose what you heard, or skip it for now."
      : "Choose the missing lyric.";

  return (
    <View style={[styles.container, showOptions && styles.activeContainer]}>
      <Text
        style={[
          textStyle,
          fontStyles.japaneseText,
          { color: resolvedTextColor },
        ]}
      >
        {question.beforeBlank}
        <Text
          accessibilityRole={
            isCorrect && onOpenAnswerDetails ? "button" : undefined
          }
          accessibilityLabel={
            isCorrect && onOpenAnswerDetails
              ? `View details for ${question.answer}`
              : undefined
          }
          onPress={
            isCorrect && onOpenAnswerDetails
              ? (event) => {
                  event.stopPropagation();
                  onOpenAnswerDetails(event);
                }
              : undefined
          }
          suppressHighlighting
          style={[
            styles.blank,
            isCorrect &&
              onOpenAnswerDetails &&
              styles.correctAnswerLink,
            {
              color: isCorrect
                ? playerVariant
                  ? "#86efac"
                  : "#15803d"
                : "transparent",
              borderBottomColor: hasWrongAnswer
                ? playerVariant
                  ? "#fca5a5"
                  : "#dc2626"
                : isCorrect
                  ? playerVariant
                    ? "#86efac"
                    : "#16a34a"
                  : playerVariant
                    ? "rgba(255,255,255,0.9)"
                    : accentColor,
              backgroundColor: playerVariant
                ? "rgba(255,255,255,0.1)"
                : "rgba(124,58,237,0.08)",
            },
          ]}
        >
          {isCorrect ? question.answer : "＿".repeat(Math.max(2, question.answer.length))}
        </Text>
        {question.afterBlank}
      </Text>

      {showOptions && !isCorrect ? (
        <View style={[styles.prompt, { borderTopColor: borderColor }]}>
          <Text
            style={[styles.instruction, { color: resolvedMutedTextColor }]}
          >
            {instruction}
          </Text>

          <View style={styles.options}>
            {question.options.map((option, optionIndex) => {
              const isSelectedWrong =
                selectedAnswer === option && option !== question.answer;
              const wrongColor = playerVariant ? "#fca5a5" : "#dc2626";
              const optionLabel =
                OPTION_LABELS[optionIndex] ?? String(optionIndex + 1);

              return (
                <Pressable
                  key={`${question.lineIndex}-${option}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Option ${optionLabel}: ${option}`}
                  onPress={(event) => {
                    event.stopPropagation();
                    onSelectAnswer(option);
                  }}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      borderColor: isSelectedWrong ? wrongColor : borderColor,
                      backgroundColor: isSelectedWrong
                        ? playerVariant
                          ? "rgba(220,38,38,0.24)"
                          : "rgba(220,38,38,0.08)"
                        : resolvedSurfaceColor,
                      opacity: pressed ? 0.68 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.optionLabel,
                      { borderRightColor: borderColor },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionLabelText,
                        {
                          color: isSelectedWrong
                            ? wrongColor
                            : resolvedMutedTextColor,
                        },
                      ]}
                    >
                      {optionLabel}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      fontStyles.japaneseText,
                      { color: resolvedTextColor },
                    ]}
                  >
                    {option}
                  </Text>
                  {isSelectedWrong ? (
                    <Ionicons
                      name="close-circle"
                      size={17}
                      color={wrongColor}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Replay this lyric line"
              onPress={(event) => {
                event.stopPropagation();
                onReplay();
              }}
              style={({ pressed }) => [
                styles.actionButton,
                { borderColor, opacity: pressed ? 0.68 : 1 },
              ]}
            >
              <Ionicons
                name="play-back-outline"
                size={16}
                color={resolvedTextColor}
              />
              <Text
                style={[styles.actionText, { color: resolvedTextColor }]}
              >
                Replay line
              </Text>
            </Pressable>

            {isPlaybackPaused ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Skip this question for now and continue the song"
                onPress={(event) => {
                  event.stopPropagation();
                  onSkip();
                }}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.skipButton,
                  {
                    backgroundColor: playerVariant ? "#fff" : accentColor,
                    borderColor: playerVariant ? "#fff" : accentColor,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.actionText,
                    { color: playerVariant ? "#171717" : "#fff" },
                  ]}
                >
                  Skip for now
                </Text>
                <Ionicons
                  name="play-forward-outline"
                  size={16}
                  color={playerVariant ? "#171717" : "#fff"}
                />
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 8,
  },
  activeContainer: {
    paddingBottom: 6,
  },
  blank: {
    borderBottomWidth: 2,
    borderRadius: 5,
    paddingHorizontal: 3,
  },
  correctAnswerLink: {
    textDecorationLine: "underline",
  },
  options: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  prompt: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 10,
    gap: 10,
  },
  instruction: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  option: {
    flexBasis: "47%",
    flexGrow: 1,
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    borderCurve: "continuous",
    overflow: "hidden",
    paddingRight: 9,
  },
  optionLabel: {
    width: 32,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  optionLabelText: {
    fontSize: 11,
    fontWeight: "800",
  },
  optionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    paddingHorizontal: 6,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
  },
  actionButton: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 8,
    borderCurve: "continuous",
    paddingHorizontal: 11,
  },
  skipButton: {
    flex: 1,
    maxWidth: 160,
  },
  actionText: {
    fontSize: 12,
    fontWeight: "700",
  },
});
