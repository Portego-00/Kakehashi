import type { TextStyle, ViewStyle } from "react-native";

/**
 * Sizes for the card shown while a review is paused on an answer, scaled by
 * the "Answer Reveal Size" and "Correction Button Size" settings. At scale 1
 * every value matches the base stylesheet in ReviewQuestionScreen.
 */
export type ReviewPausedUiStyles = {
  reveal: {
    iconSize: number;
    iconContainer: ViewStyle;
    title: TextStyle;
    answerLabel: TextStyle;
    answerText: TextStyle;
    detailsBadge: ViewStyle;
    detailsBadgeIconSize: number;
    detailsBadgeLabel: TextStyle;
    detailsAnswerText: TextStyle;
    detailsAnswerLines: number;
  };
  buttons: {
    primaryIconSize: number;
    primaryButton: ViewStyle;
    primaryText: TextStyle;
    secondaryIconSize: number;
    secondaryButton: ViewStyle;
    secondaryText: TextStyle;
    detailsIconSize: number;
    detailsButton: ViewStyle;
    detailsText: TextStyle;
  };
};

const safeScale = (scale: number | undefined) =>
  typeof scale === "number" && Number.isFinite(scale) && scale > 0 ? scale : 1;

export function buildReviewPausedUiStyles(
  answerRevealScale: number | undefined,
  correctionButtonScale: number | undefined,
): ReviewPausedUiStyles {
  const r = safeScale(answerRevealScale);
  const b = safeScale(correctionButtonScale);

  return {
    reveal: {
      iconSize: Math.round(24 * r),
      iconContainer: {
        width: Math.round(32 * r),
        height: Math.round(32 * r),
        borderRadius: Math.round(16 * r),
      },
      title: { fontSize: Math.round(18 * r) },
      answerLabel: { fontSize: Math.round(13 * r) },
      answerText: { fontSize: Math.round(22 * r) },
      detailsBadge: {
        paddingHorizontal: Math.round(7 * r),
        paddingVertical: Math.round(4 * r),
        gap: Math.round(4 * r),
      },
      detailsBadgeIconSize: Math.round(12 * r),
      detailsBadgeLabel: { fontSize: Math.round(10 * r) },
      detailsAnswerText: {
        fontSize: Math.round(14 * r),
        lineHeight: Math.round(18 * r),
      },
      detailsAnswerLines: r > 1 ? 3 : 2,
    },
    buttons: {
      primaryIconSize: Math.round(18 * b),
      primaryButton: { paddingVertical: Math.round(12 * b) },
      primaryText: { fontSize: Math.round(11 * b) },
      secondaryIconSize: Math.round(16 * b),
      secondaryButton: { paddingVertical: Math.round(10 * b) },
      secondaryText: { fontSize: Math.round(12 * b) },
      detailsIconSize: Math.round(16 * b),
      detailsButton: {
        minHeight: Math.round(34 * b),
        paddingVertical: Math.round(7 * b),
      },
      detailsText: { fontSize: Math.round(11 * b) },
    },
  };
}
