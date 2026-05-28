import { StyleSheet } from "react-native";

import { STOP_DETAILS_PREVIEW_ASPECT_RATIO } from "./useSettingsController";

export const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
  content: {
    flex: 1,
    paddingTop: 16,
  },
  sectionChipBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionChipContent: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  sectionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sectionChipText: {
    fontSize: 13,
    fontWeight: "600",
  },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingItemColumn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  settingIcon: {
    marginRight: 16,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  settingText: {
    fontSize: 16,
  },
  settingHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  settingInfoButton: {
    padding: 2,
  },
  settingTrailingControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  settingHelpButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  settingSubtext: {
    fontSize: 14,
    marginTop: 2,
  },
  updateExperienceOption: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bunproSurveyModalContent: {
    paddingBottom: 24,
  },
  bunproSurveyQuestion: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 10,
  },
  bunproSurveyButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  bunproSurveyChoiceButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  bunproSurveyChoiceButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  bunproSurveyFollowUpContainer: {
    marginTop: 14,
  },
  bunproSurveyInput: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 92,
    textAlignVertical: "top",
    fontSize: 14,
  },
  bunproSurveySubmitButton: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  bunproSurveySubmitButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  settingValueText: {
    fontSize: 15,
    fontWeight: "600",
    marginRight: 8,
  },
  newBadge: {
    backgroundColor: "#e53935",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 8,
  },
  newBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  betaBadge: {
    backgroundColor: "#ff9800",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  betaBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: "600",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  voiceOption: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderRadius: 8,
    marginVertical: 4,
    overflow: "hidden",
  },
  voiceMainArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingRight: 12,
    paddingVertical: 16,
  },
  voiceInfo: {
    flex: 1,
  },
  voiceName: {
    fontSize: 16,
    fontWeight: "500",
  },
  voiceDetails: {
    fontSize: 14,
    marginTop: 2,
  },
  testVoiceButton: {
    padding: 12,
    borderLeftWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cacheSection: {
    padding: 16,
    borderBottomWidth: 1,
  },
  cacheSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  cacheRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cacheLabel: {
    fontSize: 16,
  },
  cacheValue: {
    fontSize: 16,
    fontWeight: "bold",
  },
  cacheActionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
  },
  cacheActionText: {
    fontSize: 16,
    marginLeft: 8,
  },
  categoryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: "bold",
  },
  categoryDetails: {
    fontSize: 14,
    marginTop: 2,
  },
  largestItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
  },
  largestItemRank: {
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 8,
  },
  largestItemInfo: {
    flex: 1,
  },
  largestItemKey: {
    fontSize: 16,
    fontWeight: "bold",
  },
  largestItemDetails: {
    fontSize: 14,
    marginTop: 2,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginTop: 8,
  },
  syncControls: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  syncButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  syncButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncStatusText: {
    fontSize: 14,
    marginTop: 8,
  },
  playbackSelector: {
    flexDirection: "row",
    width: "100%",
    gap: 8,
  },
  playbackSourceButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  playbackSourceButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  musicLoginActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
  },
  voiceSelectionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  voiceSelectionHost: {
    borderRadius: 8,
  },
  voiceSelectionButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  voiceSelectionText: {
    fontSize: 14,
    fontWeight: "500",
  },
  offlineAudioDeleteRow: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  offlineAudioDeleteIconButton: {
    borderWidth: 1,
    borderRadius: 8,
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  answerStopPreviewCard: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 12,
  },
  answerStopPreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  answerStopPreviewIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  answerStopPreviewTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  answerStopPreviewDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  answerStopPreviewScreenshotFrame: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    paddingVertical: 8,
  },
  answerStopPreviewScreenshot: {
    aspectRatio: STOP_DETAILS_PREVIEW_ASPECT_RATIO,
    borderRadius: 8,
  },
  answerStopPreviewCloseButton: {
    borderRadius: 8,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  answerStopPreviewCloseText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  voicePickerModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  voicePickerModalContent: {
    borderRadius: 14,
    overflow: "hidden",
  },
  reminderTimeModalContent: {
    borderRadius: 14,
    overflow: "hidden",
    paddingBottom: 16,
  },
  levelAnalyticsExportModalContent: {
    borderRadius: 14,
    overflow: "hidden",
    paddingBottom: 16,
  },
  levelAnalyticsFormatRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  levelAnalyticsFormatButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  levelAnalyticsFormatButtonTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  levelAnalyticsFormatButtonSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  levelAnalyticsLevelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  levelAnalyticsLevelTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  levelAnalyticsQuickActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelAnalyticsQuickActionButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  levelAnalyticsQuickActionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  levelAnalyticsLevelsScroll: {
    marginTop: 10,
    maxHeight: 280,
  },
  levelAnalyticsLevelsContent: {
    paddingBottom: 4,
  },
  levelAnalyticsLevelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  levelAnalyticsLevelRowText: {
    fontSize: 15,
    fontWeight: "500",
  },
  reviewShortcutModalContent: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 55,
    borderBottomRightRadius: 55,
    maxHeight: "100%",
    overflow: "hidden",
  },
  reviewShortcutModalScrollView: {
    maxHeight: "100%",
  },
  reviewShortcutModalScrollContent: {
    paddingBottom: 12,
  },
  reviewShortcutGroup: {
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    overflow: "hidden",
  },
  reviewShortcutGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reviewShortcutGroupHeaderTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  reviewShortcutGroupTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  reviewShortcutGroupSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  reviewShortcutList: {
    overflow: "hidden",
  },
  reviewShortcutListDisabled: {
    opacity: 0.45,
  },
  reviewShortcutRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reviewShortcutTextContainer: {
    flex: 1,
    marginRight: 10,
  },
  reviewShortcutLabel: {
    fontSize: 14,
    fontWeight: "600",
  },
  reviewShortcutHint: {
    fontSize: 12,
    marginTop: 2,
  },
  reviewShortcutValueButton: {
    width: 78,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  reviewShortcutValueText: {
    fontSize: 13,
    fontWeight: "600",
  },
  hiddenShortcutCaptureInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },
  reminderTimePickerContainer: {
    borderWidth: 1,
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 4,
  },
  reminderTimePickerRow: {
    flexDirection: "row",
    gap: 8,
  },
  reminderTimePickerColumn: {
    flex: 1,
  },
  reminderTimePickerLabel: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  reminderTimeValuePicker: {
    height: 180,
  },
  reminderTimeValuePickerItem: {
    fontSize: 20,
  },
  reminderTimeActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 16,
  },
  reminderTimeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    marginBottom: 12,
  },
  reminderTimeSaveButton: {
    borderWidth: 0,
  },
  reminderTimeButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  voicePickerModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  voicePickerModalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  voicePickerModalOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 12,
  },
  voicePickerModalCancel: {
    justifyContent: "center",
  },
  voicePickerModalCancelText: {
    width: "100%",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "600",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  inputIconButton: {
    width: 44,
    height: 44,
    marginLeft: 8,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  batchSizeSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  batchSizeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  batchSizeButtonDisabled: {
    opacity: 0.5,
  },
  batchSizeValue: {
    fontSize: 16,
    fontWeight: "600",
    minWidth: 24,
    textAlign: "center",
  },
  reviewCharacterSizeValue: {
    minWidth: 42,
  },
  leniencyValue: {
    fontSize: 13,
    fontWeight: "600",
    minWidth: 80,
    textAlign: "center",
  },
  themeSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: 1,
  },
  themeSelectorButton: {
    flexGrow: 1,
    flexBasis: "31%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  themeSelectorText: {
    fontSize: 14,
    fontWeight: "500",
  },
});
