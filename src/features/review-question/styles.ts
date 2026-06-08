import { Platform, StyleSheet } from "react-native";

import { fontStyles } from "../../utils/fonts";
import {
  ANSWER_INPUT_FONT_SIZE,
  ANSWER_INPUT_HEIGHT,
  FLOATING_REVIEW_TOOL_BUTTON_RADIUS,
  FLOATING_REVIEW_TOOL_BUTTON_SIZE,
  SRS_CARD_COMPACT_WIDTH,
  SRS_CARD_SIDE_OFFSET,
  SRS_CARD_WIDTH,
  TOP_STATUS_POPUP_OFFSET,
  height,
  width,
} from "./constants";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 70,
  },
  statText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 5,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    width: "100%",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "white",
  },
  permissionWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginHorizontal: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    zIndex: 120,
  },
  permissionWarningText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 8,
  },
  permissionWarningDismiss: {
    marginLeft: 8,
    padding: 2,
  },
  skipCueContainer: {
    position: "absolute",
    top: TOP_STATUS_POPUP_OFFSET,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 150,
  },
  srsTopPopupContainer: {
    position: "absolute",
    top: TOP_STATUS_POPUP_OFFSET,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 149,
  },
  skipCuePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  skipCueText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  answeredItemBox: {
    position: "absolute",
    top: height / 2, // Start at center
    left: width / 2, // Start at center
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  answeredItemBoxTouchable: {
    minWidth: 80,
    maxWidth: 200,
    height: 65,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center", // Center the text
    paddingHorizontal: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  answeredItemCharacter: {
    color: "white",
    fontSize: Math.min(width * 0.07, 30),
    fontWeight: "400",
    flexShrink: 1,
    textAlign: "center",
    fontFamily: "SourceHanSansJP-Regular",
    // Android-specific: remove extra font padding and center vertically
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  answeredItemCharacterFallback: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    flexShrink: 1,
    textAlign: "center",
    paddingHorizontal: 4,
  },
  answeredItemStatusIndicator: {
    position: "absolute",
    top: -10,
    right: -10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  inputContainer: {
    width: "100%",
  },
  banner: {
    padding: 12,
    alignSelf: "stretch",
    alignItems: "center",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  bannerMeaning: {
    backgroundColor: "rgba(255, 255, 255, 0.7)", // Semitransparent white for meaning
  },
  bannerReading: {
    backgroundColor: "#333333", // Black for reading questions
  },
  bannerGrouped: {
    backgroundColor: "#333333", // Dark gray for grouped questions (same as reading)
  },
  bannerText: {
    fontSize: 16,
  },
  bannerTextBold: {
    fontWeight: "bold",
  },
  bannerTextMeaning: {
    color: "#333", // Dark text for white background
  },
  bannerTextReading: {
    color: "white", // White text for black background
  },
  bannerTextGrouped: {
    color: "white", // White text for dark gray background
  },
  inputWrapper: {
    position: "relative",
    alignSelf: "stretch",
  },
  inputGlowContainer: {
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 25,
      },
      android: {
        elevation: 15,
      },
    }),
  },
  submitButtonInside: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
    elevation: 2,
  },
  voiceButtonInside: {
    position: "absolute",
    left: 8,
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
    elevation: 2,
  },
  voiceButtonActive: {
    backgroundColor: "#d32f2f",
  },
  voiceRetryButtonInside: {
    position: "absolute",
    left: 52,
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1976d2",
    elevation: 2,
  },
  questionContainer: {
    flex: 1,
    padding: 16,
  },
  reviewInteractionPane: {
    flex: 1,
  },
  reviewInteractionPaneWithDetails: {
    justifyContent: "space-between",
    minHeight: 220,
  },
  characterWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  characterWrapperWithDetails: {
    minHeight: 96,
    paddingBottom: 10,
  },
  characterContainer: {
    alignItems: "center",
    justifyContent: "center",
  },
  reviewMetadataStack: {
    alignSelf: "flex-start",
    gap: 8,
    marginBottom: 10,
    marginLeft: 2,
  },
  reviewMetadataStackInRow: {
    marginBottom: 0,
    marginLeft: 0,
  },
  reviewMetadataPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.25)",
    backgroundColor: "rgba(0, 0, 0, 0.18)",
  },
  reviewMetadataSrsIcon: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewMetadataText: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  floatingReviewToolButton: {
    position: "absolute",
    right: 16,
    width: FLOATING_REVIEW_TOOL_BUTTON_SIZE,
    height: FLOATING_REVIEW_TOOL_BUTTON_SIZE,
    borderRadius: FLOATING_REVIEW_TOOL_BUTTON_RADIUS,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    zIndex: 100,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(0, 0, 0, 0.4)",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  floatingReviewToolButtonInner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: FLOATING_REVIEW_TOOL_BUTTON_RADIUS,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  characterText: {
    fontSize: Math.min(width * 0.25, 120),
    color: "white",
    fontWeight: "400",
    textAlign: "center",
    fontFamily: "SourceHanSansJP-Regular",
    // Android-specific: remove extra font padding and center vertically
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  placeholderText: {
    fontSize: Math.min(width * 0.09, 36),
    color: "white",
    fontWeight: "500",
    textAlign: "center",
  },
  placeholderSubtext: {
    marginTop: 8,
    fontSize: Math.min(width * 0.05, 18),
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    paddingHorizontal: 12,
  },
  answerContainer: {
    alignSelf: "stretch",
    justifyContent: "flex-end",
    marginTop: "auto",
  },
  pausedUnifiedDetailsSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    marginHorizontal: -16,
    marginBottom: -16,
    paddingTop: 12,
    paddingHorizontal: 12,
    overflow: "hidden",
  },
  pausedAnswerControlArea: {
    paddingBottom: 10,
  },
  pausedDetailsCorrectAnswer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 8,
    marginTop: 7,
  },
  pausedDetailsCorrectAnswerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  pausedDetailsCorrectAnswerLabel: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  pausedDetailsCorrectAnswerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },
  pausedSubjectDetailsPanel: {
    alignSelf: "stretch",
    overflow: "hidden",
    marginHorizontal: -12,
  },
  pausedDetailsActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  pausedDetailsActionButton: {
    flexGrow: 1,
    flexBasis: "30%",
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  pausedDetailsActionButtonText: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    flexShrink: 1,
  },
  answerInput: {
    alignSelf: "stretch",
    height: ANSWER_INPUT_HEIGHT,
    paddingHorizontal: 16,
    fontSize: ANSWER_INPUT_FONT_SIZE,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginTop: Platform.OS === "android" ? -StyleSheet.hairlineWidth : 0,
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  answerInputReading: {
    ...fontStyles.japaneseText,
  },
  answerInputVoiceMode: {
    paddingLeft: 56,
    paddingRight: 56,
  },
  answerInputVoiceModeDual: {
    paddingLeft: 100,
    paddingRight: 56,
  },
  correctButton: {
    backgroundColor: "#4caf50",
  },
  closeButton: {
    backgroundColor: "#ff9800",
  },
  incorrectButton: {
    backgroundColor: "#f44336",
  },
  retryFeedback: {
    backgroundColor: "rgba(255, 152, 0, 0.8)",
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  voiceStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  voiceStatusListening: {
    backgroundColor: "rgba(25, 118, 210, 0.9)",
  },
  voiceStatusError: {
    backgroundColor: "rgba(244, 67, 54, 0.9)",
  },
  voiceStatusText: {
    flex: 1,
    marginLeft: 6,
    color: "white",
    fontSize: 13,
  },
  retryFeedbackText: {
    fontSize: 14,
    color: "white",
    textAlign: "center",
  },
  backButton: {
    padding: 8,
    marginRight: "auto",
  },
  disabledTouchable: {
    opacity: 0.7, // Slightly dim the button when disabled
  },
  srsProgressionCard: {
    position: "absolute",
    bottom: 115,
    width: SRS_CARD_WIDTH,
    borderRadius: 24,
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  srsProgressionCardCompact: {
    width: SRS_CARD_COMPACT_WIDTH,
    borderRadius: 20,
  },
  srsCardContent: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  srsCardContentCompact: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  srsIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  srsIconContainerCompact: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  srsTextContainer: {
    flexDirection: "column",
    alignItems: "flex-start",
    flex: 1,
  },
  srsArrowAndLevel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  srsCardLevel: {
    color: "white",
    fontSize: 12,
    fontWeight: "700",
  },
  srsCardLevelCompact: {
    fontSize: 11,
  },
  srsNextReview: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },
  srsNextReviewCompact: {
    fontSize: 9,
    marginTop: 1,
  },
  // Anki Card Mode Styles
  ankiCardContainer: {
    flex: 1,
    position: "relative",
  },
  ankiAnswerContainer: {
    flex: 1,
    alignSelf: "stretch",
    justifyContent: "flex-end",
  },
  ankiSrsProgressionOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  ankiSrsProgressionOverlayCentered: {
    alignItems: "center",
  },
  ankiSrsProgressionOverlaySide: {
    alignItems: "flex-end",
    paddingRight: SRS_CARD_SIDE_OFFSET,
  },
  srsProgressionCardInline: {
    width: SRS_CARD_WIDTH,
    borderRadius: 24,
    zIndex: 1000,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  ankiPreCardOverlayRow: {
    position: "relative",
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 10,
  },
  ankiPreRevealSkipChip: {
    alignSelf: "flex-end",
    marginRight: 14,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.14,
        shadowRadius: 5,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  ankiPreRevealSkipChipLight: {
    backgroundColor: "rgba(248, 250, 252, 0.95)",
    borderColor: "rgba(71, 85, 105, 0.2)",
  },
  ankiPreRevealSkipChipDark: {
    backgroundColor: "rgba(15, 23, 42, 0.94)",
    borderColor: "rgba(148, 163, 184, 0.4)",
  },
  ankiPreRevealSkipChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  ankiContentContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    overflow: "hidden",
    marginTop: -1, // Remove potential gap
  },
  ankiAnswerSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ankiBlurContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  ankiAnswerText: {
    fontSize: Math.min(width * 0.05, 20),
    fontWeight: "500",
    textAlign: "center",
    paddingHorizontal: 20,
    color: "#333",
  },
  ankiSupplementaryAnswersContainer: {
    marginTop: 10,
    width: "100%",
    gap: 6,
  },
  ankiSupplementaryAnswerRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  ankiSupplementaryAnswerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(0, 0, 0, 0.55)",
    textAlign: "center",
    marginBottom: 2,
  },
  ankiSupplementaryAnswerValue: {
    fontSize: 13,
    fontWeight: "500",
    color: "#2A2A2A",
    textAlign: "center",
  },
  ankiBlurOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 6,
    overflow: "hidden",
  },
  ankiTapHint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  ankiTapToReveal: {
    fontSize: 14,
    color: "rgba(0,0,0,0.6)",
    fontWeight: "500",
  },
  ankiReplaySection: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  ankiReplayButton: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "#F5F3FF",
    borderColor: "rgba(109, 40, 217, 0.2)",
  },
  ankiReplayButtonDark: {
    backgroundColor: "rgba(76, 29, 149, 0.28)",
    borderColor: "rgba(221, 214, 254, 0.42)",
  },
  ankiReplayButtonDisabled: {
    opacity: 0.6,
  },
  ankiReplayButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  ankiButtonSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 4,
    gap: 12,
  },
  ankiButtonlessOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
  },
  ankiButton: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16, // More rounded
    minHeight: 70,
    backgroundColor: "#F2F4F7", // Light grey background
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  ankiButtonIconContainer: {
    marginBottom: 6,
  },
  ankiButtonWrong: {
    backgroundColor: "#FEF2F2", // Very light red
    borderWidth: 1,
    borderColor: "rgba(244, 67, 54, 0.1)",
  },
  ankiButtonDetails: {
    backgroundColor: "#F0F9FF", // Very light blue
    borderWidth: 1,
    borderColor: "rgba(33, 150, 243, 0.1)",
  },
  ankiButtonSkip: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "rgba(71, 85, 105, 0.15)",
  },
  ankiButtonCorrect: {
    backgroundColor: "#F0FDF4", // Very light green
    borderWidth: 1,
    borderColor: "rgba(76, 175, 80, 0.1)",
  },
  ankiButtonText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  ankiWrongOptionsContainer: {
    flex: 1,
    width: "100%",
    marginTop: 10,
  },
  ankiWrongTitle: {
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 12,
  },
  ankiWrongGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  ankiButtonOption: {
    flex: 1,
    minHeight: 60,
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  ankiButtonOptionReading: {
    flex: 1, // Reading button
    minHeight: 60,
    backgroundColor: "#2c2c2c",
    borderWidth: 1,
    borderColor: "#1a1a1a",
  },
  ankiButtonOptionMeaning: {
    flex: 1, // Meaning button
    minHeight: 60,
    backgroundColor: "#f0f0f0",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  ankiButtonOptionFull: {
    backgroundColor: "#FEF2F2", // Light red for "Both"
    borderColor: "rgba(244, 67, 54, 0.2)",
  },
  ankiButtonOptionText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  ankiButtonOptionTextLight: {
    fontSize: 12,
    fontWeight: "600",
    color: "white",
    textAlign: "center",
  },
  ankiButtonOptionTextDark: {
    fontSize: 12,
    fontWeight: "600",
    color: "#333",
    textAlign: "center",
  },
  ankiCancelButton: {
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: -20,
  },
  ankiCancelText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "500",
  },
  floatingWrapUpButton: {
    position: "absolute",
    top: 140, // Same height as previous answer card
    right: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 100,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(0, 0, 0, 0.4)",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  floatingWrapUpButtonInner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  floatingWrapUpButtonText: {
    color: "white",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
    textShadowColor: "rgba(0, 0, 0, 0.1)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  floatingWrapUpIndicator: {
    position: "absolute",
    top: 140, // Same height as previous answer card
    right: 16,
    backgroundColor: "rgba(255, 215, 0, 0.15)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    zIndex: 100,
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.3)",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "rgba(0, 0, 0, 0.4)",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 1,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  floatingWrapUpIndicatorInner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 215, 0, 0.08)",
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "rgba(255, 215, 0, 0.15)",
  },
  floatingWrapUpIndicatorText: {
    color: "#ffd700",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
    textShadowColor: "rgba(0, 0, 0, 0.2)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Paused on wrong answer styles
  pausedCard: {
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  pausedCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  pausedCardIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(244, 67, 54, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  pausedCardIconContainerCorrect: {
    backgroundColor: "rgba(76, 175, 80, 0.15)",
  },
  pausedCardIconContainerClose: {
    backgroundColor: "rgba(255, 152, 0, 0.2)",
  },
  pausedCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f44336",
  },
  pausedCardTitleClose: {
    color: "#ff9800",
  },
  pausedCardTitleCorrect: {
    color: "#4caf50",
  },
  correctAnswerSection: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  correctAnswerLabel: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.6)",
    marginBottom: 6,
    textAlign: "center",
  },
  correctAnswerText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#4caf50",
    textAlign: "center",
  },
  correctAnswerTextClose: {
    color: "#ff9800",
  },
  pausedPrimaryActions: {
    flexDirection: "row",
    gap: 8,
  },
  pausedActionButton: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  pausedButtonCorrect: {
    backgroundColor: "rgba(76, 175, 80, 0.15)",
  },
  pausedButtonSkip: {
    backgroundColor: "rgba(33, 150, 243, 0.15)",
  },
  pausedButtonIncorrect: {
    backgroundColor: "rgba(244, 67, 54, 0.15)",
  },
  pausedButtonSynonym: {
    backgroundColor: "rgba(255, 152, 0, 0.15)",
  },
  pausedButtonDetails: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  pausedButtonReplay: {
    backgroundColor: "rgba(149, 117, 205, 0.2)",
  },
  pausedActionButtonText: {
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  pausedActionDisabled: {
    opacity: 0.55,
  },
  pausedSecondaryActions: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  pausedSecondaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  pausedSecondaryActionText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    flexShrink: 1,
  },
  wrongAnswerDisplay: {
    justifyContent: "center",
    alignItems: "center",
  },
  pausedAnswerOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  pausedInputTextHidden: {
    color: "transparent",
  },
  hiddenPausedShortcutInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },
  wrongAnswerInput: {
    fontSize: ANSWER_INPUT_FONT_SIZE,
    backgroundColor: "transparent",
    color: "#f44336",
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  correctPausedAnswerInput: {
    fontSize: ANSWER_INPUT_FONT_SIZE,
    backgroundColor: "transparent",
    color: "#4caf50",
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  closePausedAnswerInput: {
    fontSize: ANSWER_INPUT_FONT_SIZE,
    backgroundColor: "transparent",
    color: "#ff9800",
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  // Context hint styles
  contextHintContainer: {
    marginTop: 16,
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 20,
  },
  contextHintButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  contextHintButtonText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    fontWeight: "500",
  },
  contextHintContent: {
    marginTop: 12,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    borderRadius: 12,
    padding: 14,
    width: "100%",
    maxWidth: 350,
  },
  contextHintSentenceGroup: {
    marginBottom: 8,
  },
  contextHintSentence: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    lineHeight: 20,
    fontStyle: "italic",
  },
  contextHintSentenceJapanese: {
    fontStyle: "normal",
    color: "rgba(255, 255, 255, 0.95)",
  },
});
