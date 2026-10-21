import { SettingsRowIcon } from "../../../ui/settings/settings-row-icon";
import { SettingsSectionSurface } from "../../../ui/settings/settings-section-surface";
import { SettingsLabel } from "../../../ui/settings/settings-search";
import { SettingsDisclosure } from "../components/settings-disclosure";
import { ReviewAnswerModeSetting } from "../components/review-answer-mode-setting";
import React from "react";
import { useSettingsStore } from "../../../utils/store";

import { SettingsIcon as Ionicons } from "../../../ui/settings/settings-icon";
import { Switch, Text, TouchableOpacity, View } from "react-native";

import {
  AdvancedSetting,
  AdvancedSettingsGroup,
} from "../components/AdvancedSettings";
import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";
import { ReviewPresetsSetting } from "../components/review-presets-setting";
import { ReviewPromptColorSetting } from "../components/review-prompt-color-setting";

export function ReviewSettingsSection() {
  const jitaiCycleAllFonts = useSettingsStore(
    (state) => state.jitaiCycleAllFonts,
  );
  const setJitaiCycleAllFonts = useSettingsStore(
    (state) => state.setJitaiCycleAllFonts,
  );
  const {
    acceptAnyKanjiOnyomiReading,
    acceptUserSynonymsAsAnswers,
    Alert,
    allowSkippingReviews,
    ankiCardMode,
    ankiCardModeScope,
    ankiGroupQuestions,
    autoSwitchKeyboard,
    backToBackImmediateRetryIncorrect,
    backToBackQuestions,
    canDecreaseReviewCharacterFontScale,
    canIncreaseReviewCharacterFontScale,
    canDecreaseReviewInputFontScale,
    canIncreaseReviewInputFontScale,
    customReviewOrder,
    disableAutoProgressOnCloseAnswer,
    disableAutoProgressOnCorrect,
    disableAutoProgressOnWrong,
    effectiveReviewWrapUpQuestionGap,
    formatReviewFontScale,
    getReviewOrderLabel,
    getSrsProgressionCardModeLabel,
    JAPANESE_KEYBOARD_SETUP_INSTRUCTIONS,
    jitaiEnabled,
    jitaiSelectedFontIds,
    KeyboardManager,
    openReviewShortcutModal,
    openSrsProgressionCardModePicker,
    Platform,
    prioritizeCriticalItems,
    REVIEW_CHARACTER_FONT_SCALE_STEP,
    REVIEW_INPUT_FONT_SCALE_STEP,
    reviewAnimatePreviousQuestion,
    reviewBatchSize,
    reviewBatchSizeEnabled,
    reviewCharacterFontScale,
    reviewInputFontScale,
    reviewOrder,
    reviewSearchButtonEnabled,
    reviewTypeOrderEnabled,
    reviewWrapUpTargetMax,
    reviewWrapUpTargetMin,
    reviewWrapUpTargetStep,
    reviewWrapUpTargetSubjects,
    router,
    setAcceptAnyKanjiOnyomiReading,
    setAcceptUserSynonymsAsAnswers,
    setAllowSkippingReviews,
    setAutoSwitchKeyboard,
    setBackToBackImmediateRetryIncorrect,
    setBackToBackQuestions,
    setDisableAutoProgressOnCloseAnswer,
    setDisableAutoProgressOnCorrect,
    setDisableAutoProgressOnWrong,
    setJitaiEnabled,
    setPrioritizeCriticalItems,
    setReviewAnimatePreviousQuestion,
    setReviewBatchSize,
    setReviewBatchSizeEnabled,
    setReviewCharacterFontScale,
    setReviewInputFontScale,
    setReviewSearchButtonEnabled,
    setReviewWrapUpTargetSubjects,
    setShowAddSynonymButton,
    setShowAnswerStopDetailsPreview,
    setShowAnswerStopSubjectDetails,
    setShowReviewItemLevelAndSrsStage,
    setShowVocabContextSentencesInReviews,
    setVoiceReviewAnswersEnabled,
    showAddSynonymButton,
    showAnswerStopSubjectDetails,
    showReviewItemLevelAndSrsStage,
    showVocabContextSentencesInReviews,
    srsProgressionCardDisplayMode,
    theme,
    updateSectionOffset,
    voiceReviewAnswersEnabled,
  } = useSettingsControllerContext();

  return (
    <>
      {/* Review Settings Section */}
      <SettingsSectionSurface
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("reviews", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          Review Settings
        </Text>
        <AdvancedSettingsGroup grouped>
          <ReviewAnswerModeSetting />
          <View>
            <View
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
            >

              <SettingsRowIcon setting="pause-wrong" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Pause on Wrong Answer
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Show correct answer and options before progressing
                </Text>
              </View>
              <Switch
                value={disableAutoProgressOnWrong}
                onValueChange={setDisableAutoProgressOnWrong}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>
            {(ankiCardMode || Platform.OS === "android") && (
              <TouchableOpacity
                style={[
                  styles.settingItemColumn,
                  { borderBottomColor: theme.border },
                ]}
                onPress={() => router.push("/anki-settings")}
                activeOpacity={0.78}
              >
                <View style={styles.settingRow}>

                  <SettingsRowIcon setting="anki-advanced" color={theme.primary} />
                  <View style={styles.settingTextContainer}>
                    <SettingsLabel
                      style={[styles.settingText, { color: theme.textColor }]}
                    >
                      {Platform.OS === "android"
                        ? "Anki Settings & Export"
                        : "Anki Advanced Settings"}
                    </SettingsLabel>
                    <Text
                      style={[
                        styles.settingSubtext,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {ankiCardMode
                        ? `Applies to ${ankiCardModeScope}. ${ankiGroupQuestions ? "Grouped cards enabled." : "Grouped cards disabled."}`
                        : "Configure AnkiDroid context sentence export."}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={theme.textSecondary}
                  />
                </View>
              </TouchableOpacity>
            )}
          </View>
          <SettingsDisclosure
            title="Order & session size"
            description="Priority, question pairing and workload"
            icon="order"
          >
            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
              onPress={() => router.push("/review-order-settings")}
            >

              <SettingsRowIcon setting="subject-order" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Review Order
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  {`Reviews: ${
                    reviewTypeOrderEnabled
                      ? `${getReviewOrderLabel(reviewOrder)} + type groups`
                      : getReviewOrderLabel(reviewOrder)
                  } · Custom: ${getReviewOrderLabel(customReviewOrder)}`}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="priority" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Prioritize Critical Items
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Show current-level apprentice radicals/kanji first
                  </Text>
                </View>
                <Switch
                  value={prioritizeCriticalItems}
                  onValueChange={setPrioritizeCriticalItems}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>
            </AdvancedSetting>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="back-to-back" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Back-to-Back Questions
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Show meaning and reading questions consecutively for each
                    item
                  </Text>
                </View>
                <Switch
                  value={backToBackQuestions}
                  onValueChange={setBackToBackQuestions}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                  disabled={
                    ankiCardMode &&
                    ankiGroupQuestions &&
                    ankiCardModeScope === "both"
                  }
                />
              </View>
            </AdvancedSetting>
            <AdvancedSetting>
              {backToBackQuestions &&
              !(
                ankiCardMode &&
                ankiGroupQuestions &&
                ankiCardModeScope === "both"
              ) ? (
                <View
                  style={[
                    styles.settingItem,
                    { borderBottomColor: theme.border },
                  ]}
                >

                  <SettingsRowIcon setting="retry" color={theme.primary} />
                  <View style={styles.settingTextContainer}>
                    <SettingsLabel
                      style={[styles.settingText, { color: theme.textColor }]}
                    >
                      Immediate Retry on Wrong
                    </SettingsLabel>
                    <Text
                      style={[
                        styles.settingSubtext,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Re-ask failed questions right away in back-to-back mode
                    </Text>
                  </View>
                  <Switch
                    value={backToBackImmediateRetryIncorrect}
                    onValueChange={setBackToBackImmediateRetryIncorrect}
                    trackColor={{ false: "#767577", true: theme.primary }}
                    thumbColor="#f4f3f4"
                  />
                </View>
              ) : null}
            </AdvancedSetting>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="wrap-up" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Wrap Up Target
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Subjects left after tapping Wrap Up (5-20). Paired questions
                    stay within {effectiveReviewWrapUpQuestionGap} questions.
                  </Text>
                </View>
                <View style={styles.batchSizeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.batchSizeButton,
                      { backgroundColor: theme.border },
                      reviewWrapUpTargetSubjects <= reviewWrapUpTargetMin &&
                        styles.batchSizeButtonDisabled,
                    ]}
                    onPress={() =>
                      reviewWrapUpTargetSubjects > reviewWrapUpTargetMin &&
                      setReviewWrapUpTargetSubjects(
                        reviewWrapUpTargetSubjects - reviewWrapUpTargetStep,
                      )
                    }
                    disabled={
                      reviewWrapUpTargetSubjects <= reviewWrapUpTargetMin
                    }
                  >
                    <Ionicons
                      name="remove"
                      size={18}
                      color={
                        reviewWrapUpTargetSubjects <= reviewWrapUpTargetMin
                          ? theme.textSecondary
                          : theme.textColor
                      }
                    />
                  </TouchableOpacity>
                  <Text
                    style={[styles.batchSizeValue, { color: theme.textColor }]}
                  >
                    {reviewWrapUpTargetSubjects}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.batchSizeButton,
                      { backgroundColor: theme.border },
                      reviewWrapUpTargetSubjects >= reviewWrapUpTargetMax &&
                        styles.batchSizeButtonDisabled,
                    ]}
                    onPress={() =>
                      reviewWrapUpTargetSubjects < reviewWrapUpTargetMax &&
                      setReviewWrapUpTargetSubjects(
                        reviewWrapUpTargetSubjects + reviewWrapUpTargetStep,
                      )
                    }
                    disabled={
                      reviewWrapUpTargetSubjects >= reviewWrapUpTargetMax
                    }
                  >
                    <Ionicons
                      name="add"
                      size={18}
                      color={
                        reviewWrapUpTargetSubjects >= reviewWrapUpTargetMax
                          ? theme.textSecondary
                          : theme.textColor
                      }
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </AdvancedSetting>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  {
                    borderBottomColor: reviewBatchSizeEnabled
                      ? theme.border
                      : "transparent",
                  },
                ]}
              >

                <SettingsRowIcon setting="review-cap" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Review Batch Size
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Cap the number of reviews loaded into the queue
                  </Text>
                </View>
                <Switch
                  value={reviewBatchSizeEnabled}
                  onValueChange={setReviewBatchSizeEnabled}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>
            </AdvancedSetting>
            <AdvancedSetting>
              {reviewBatchSizeEnabled && (
                <View
                  style={[
                    styles.settingItem,
                    { borderBottomColor: "transparent" },
                  ]}
                >

                  <SettingsRowIcon setting="review-count" color={theme.primary} />
                  <View style={styles.settingTextContainer}>
                    <SettingsLabel
                      style={[styles.settingText, { color: theme.textColor }]}
                    >
                      Batch Size
                    </SettingsLabel>
                    <Text
                      style={[
                        styles.settingSubtext,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Number of items per review session (5-100)
                    </Text>
                  </View>
                  <View style={styles.batchSizeSelector}>
                    <TouchableOpacity
                      style={[
                        styles.batchSizeButton,
                        { backgroundColor: theme.border },
                        reviewBatchSize <= 5 && styles.batchSizeButtonDisabled,
                      ]}
                      onPress={() =>
                        reviewBatchSize > 5 &&
                        setReviewBatchSize(reviewBatchSize - 5)
                      }
                      disabled={reviewBatchSize <= 5}
                    >
                      <Ionicons
                        name="remove"
                        size={18}
                        color={
                          reviewBatchSize <= 5
                            ? theme.textSecondary
                            : theme.textColor
                        }
                      />
                    </TouchableOpacity>
                    <Text
                      style={[
                        styles.batchSizeValue,
                        { color: theme.textColor },
                      ]}
                    >
                      {reviewBatchSize}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.batchSizeButton,
                        { backgroundColor: theme.border },
                        reviewBatchSize >= 100 &&
                          styles.batchSizeButtonDisabled,
                      ]}
                      onPress={() =>
                        reviewBatchSize < 100 &&
                        setReviewBatchSize(reviewBatchSize + 5)
                      }
                      disabled={reviewBatchSize >= 100}
                    >
                      <Ionicons
                        name="add"
                        size={18}
                        color={
                          reviewBatchSize >= 100
                            ? theme.textSecondary
                            : theme.textColor
                        }
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </AdvancedSetting>
            <AdvancedSetting>
              {reviewBatchSizeEnabled ? <ReviewPresetsSetting /> : null}
            </AdvancedSetting>
          </SettingsDisclosure>
          <SettingsDisclosure
            title="Answer feedback"
            description="Pauses, accepted answers and corrections"
            icon="answer"
          >
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="pause-close" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Pause on Close Answer
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    For fuzzy meaning matches, confirm whether to mark correct
                    or incorrect
                  </Text>
                </View>
                <Switch
                  value={disableAutoProgressOnCloseAnswer}
                  onValueChange={setDisableAutoProgressOnCloseAnswer}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>
            </AdvancedSetting>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="skip" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Allow Skipping Reviews
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Submit an empty answer to move the item to the end and reset
                    it
                  </Text>
                </View>
                <Switch
                  value={allowSkippingReviews}
                  onValueChange={setAllowSkippingReviews}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>
            </AdvancedSetting>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="pause-correct" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Pause on Correct Answer
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Show accepted answers before progressing
                  </Text>
                </View>
                <Switch
                  value={disableAutoProgressOnCorrect}
                  onValueChange={setDisableAutoProgressOnCorrect}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>
            </AdvancedSetting>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="details-auto" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Show Details on Answer Pause
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Slide subject details below the answer field when reviews
                    pause
                  </Text>
                </View>
                <View style={styles.settingTrailingControls}>
                  <TouchableOpacity
                    style={[
                      styles.settingHelpButton,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.isDark ? "#1f1f1f" : "#f5f5f5",
                      },
                    ]}
                    onPress={() => setShowAnswerStopDetailsPreview(true)}
                    activeOpacity={0.75}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Preview answer pause details setting"
                  >
                    <Ionicons
                      name="help"
                      size={16}
                      color={theme.textSecondary}
                    />
                  </TouchableOpacity>
                  <Switch
                    value={showAnswerStopSubjectDetails}
                    onValueChange={setShowAnswerStopSubjectDetails}
                    trackColor={{ false: "#767577", true: theme.primary }}
                    thumbColor="#f4f3f4"
                  />
                </View>
              </View>
            </AdvancedSetting>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="synonyms" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Accept User Synonyms
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Accept your custom synonyms as correct meaning answers
                  </Text>
                </View>
                <Switch
                  value={acceptUserSynonymsAsAnswers}
                  onValueChange={setAcceptUserSynonymsAsAnswers}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>
            </AdvancedSetting>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="add-synonym" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Show + Synonym Button
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Show the synonym action when a meaning answer is paused as
                    wrong
                  </Text>
                </View>
                <Switch
                  value={showAddSynonymButton}
                  onValueChange={setShowAddSynonymButton}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>
            </AdvancedSetting>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="onyomi" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Accept Any On&apos;yomi (Kanji)
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Treat all on&apos;yomi readings as correct in kanji reading
                    reviews
                  </Text>
                </View>
                <Switch
                  value={acceptAnyKanjiOnyomiReading}
                  onValueChange={setAcceptAnyKanjiOnyomiReading}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>
            </AdvancedSetting>
          </SettingsDisclosure>
          <SettingsDisclosure
            title="Prompt & display"
            description="Text size, hints and review information"
            icon="text"
          >
            <ReviewPromptColorSetting provider="wanikani" />
            <View
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
            >

              <SettingsRowIcon setting="character-size" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Review Character Size
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Make review characters smaller or larger without changing
                  other text
                </Text>
              </View>
              <View style={styles.batchSizeSelector}>
                <TouchableOpacity
                  style={[
                    styles.batchSizeButton,
                    { backgroundColor: theme.border },
                    !canDecreaseReviewCharacterFontScale &&
                      styles.batchSizeButtonDisabled,
                  ]}
                  onPress={() =>
                    canDecreaseReviewCharacterFontScale &&
                    setReviewCharacterFontScale(
                      reviewCharacterFontScale -
                        REVIEW_CHARACTER_FONT_SCALE_STEP,
                    )
                  }
                  disabled={!canDecreaseReviewCharacterFontScale}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease review character size"
                >
                  <Ionicons
                    name="remove"
                    size={18}
                    color={
                      canDecreaseReviewCharacterFontScale
                        ? theme.textColor
                        : theme.textSecondary
                    }
                  />
                </TouchableOpacity>
                <Text
                  style={[
                    styles.batchSizeValue,
                    styles.reviewCharacterSizeValue,
                    { color: theme.textColor },
                  ]}
                >
                  {formatReviewFontScale(reviewCharacterFontScale)}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.batchSizeButton,
                    { backgroundColor: theme.border },
                    !canIncreaseReviewCharacterFontScale &&
                      styles.batchSizeButtonDisabled,
                  ]}
                  onPress={() =>
                    canIncreaseReviewCharacterFontScale &&
                    setReviewCharacterFontScale(
                      reviewCharacterFontScale +
                        REVIEW_CHARACTER_FONT_SCALE_STEP,
                    )
                  }
                  disabled={!canIncreaseReviewCharacterFontScale}
                  accessibilityRole="button"
                  accessibilityLabel="Increase review character size"
                >
                  <Ionicons
                    name="add"
                    size={18}
                    color={
                      canIncreaseReviewCharacterFontScale
                        ? theme.textColor
                        : theme.textSecondary
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="input-size" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Review Input Size
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Scale the answer text size in reviews
                  </Text>
                </View>
                <View style={styles.batchSizeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.batchSizeButton,
                      { backgroundColor: theme.border },
                      !canDecreaseReviewInputFontScale &&
                        styles.batchSizeButtonDisabled,
                    ]}
                    onPress={() =>
                      canDecreaseReviewInputFontScale &&
                      setReviewInputFontScale(
                        reviewInputFontScale - REVIEW_INPUT_FONT_SCALE_STEP,
                      )
                    }
                    disabled={!canDecreaseReviewInputFontScale}
                    accessibilityRole="button"
                    accessibilityLabel="Decrease review input size"
                  >
                    <Ionicons
                      name="remove"
                      size={18}
                      color={
                        canDecreaseReviewInputFontScale
                          ? theme.textColor
                          : theme.textSecondary
                      }
                    />
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.batchSizeValue,
                      styles.reviewCharacterSizeValue,
                      { color: theme.textColor },
                    ]}
                  >
                    {formatReviewFontScale(reviewInputFontScale)}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.batchSizeButton,
                      { backgroundColor: theme.border },
                      !canIncreaseReviewInputFontScale &&
                        styles.batchSizeButtonDisabled,
                    ]}
                    onPress={() =>
                      canIncreaseReviewInputFontScale &&
                      setReviewInputFontScale(
                        reviewInputFontScale + REVIEW_INPUT_FONT_SCALE_STEP,
                      )
                    }
                    disabled={!canIncreaseReviewInputFontScale}
                    accessibilityRole="button"
                    accessibilityLabel="Increase review input size"
                  >
                    <Ionicons
                      name="add"
                      size={18}
                      color={
                        canIncreaseReviewInputFontScale
                          ? theme.textColor
                          : theme.textSecondary
                      }
                    />
                  </TouchableOpacity>
                </View>
              </View>
            </AdvancedSetting>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="review-search" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Review Search Button
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Show a search shortcut below Wrap Up during reviews
                  </Text>
                </View>
                <Switch
                  value={reviewSearchButtonEnabled}
                  onValueChange={setReviewSearchButtonEnabled}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>
            </AdvancedSetting>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >
                <View style={styles.settingIcon}>
                  <Ionicons name="chart" size={24} color={theme.primary} />
                </View>
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    SRS Progression
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Show the new SRS stage of the submitted answer
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.voiceSelectionButton,
                    { borderColor: theme.border },
                  ]}
                  onPress={openSrsProgressionCardModePicker}
                  activeOpacity={0.7}
                >
                  <View style={styles.voiceSelectionButtonContent}>
                    <Text
                      style={[
                        styles.voiceSelectionText,
                        { color: theme.textColor },
                      ]}
                    >
                      {getSrsProgressionCardModeLabel(
                        srsProgressionCardDisplayMode,
                      )}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={14}
                      color={theme.textSecondary}
                    />
                  </View>
                </TouchableOpacity>
              </View>
            </AdvancedSetting>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="subject-meta" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Show Item Level & SRS Stage
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Display the subject level and current SRS stage during
                    reviews
                  </Text>
                </View>
                <Switch
                  value={showReviewItemLevelAndSrsStage}
                  onValueChange={setShowReviewItemLevelAndSrsStage}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>
            </AdvancedSetting>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="review-context" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Vocabulary Context Sentence Hints
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Show context sentence hints during vocabulary review
                    questions. Translations stay hidden until you reveal them
                    from the hint
                  </Text>
                </View>
                <Switch
                  value={showVocabContextSentencesInReviews}
                  onValueChange={setShowVocabContextSentencesInReviews}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>
            </AdvancedSetting>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="question-motion" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Animate Previous Question
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Move the previous answer card from center to top-left
                  </Text>
                </View>
                <Switch
                  value={reviewAnimatePreviousQuestion}
                  onValueChange={setReviewAnimatePreviousQuestion}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>
            </AdvancedSetting>
          </SettingsDisclosure>
          <SettingsDisclosure
            title="Font practice"
            description="A font pool for varied Japanese handwriting"
            icon="font"
          >
            <View
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
            >

              <SettingsRowIcon setting="font-shuffle" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Jitai (Font Randomizer)
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Randomize Japanese fonts during reviews and lesson quizzes to
                  improve reading ability
                </Text>
              </View>
              <Switch
                value={jitaiEnabled}
                onValueChange={setJitaiEnabled}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>
            {jitaiEnabled && (
              <TouchableOpacity
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
                onPress={() => router.push("/jitai-font-settings")}
              >

                <SettingsRowIcon setting="font-pool" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Jitai Font Pool
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {`${jitaiSelectedFontIds.length} selected. Manage fonts and downloads.`}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            )}
            {jitaiEnabled && (
              <AdvancedSetting>
                <View
                  style={[
                    styles.settingItem,
                    { borderBottomColor: theme.border },
                  ]}
                >

                  <SettingsRowIcon setting="font-cycle" color={theme.primary} />
                  <View style={styles.settingTextContainer}>
                    <SettingsLabel
                      style={[styles.settingText, { color: theme.textColor }]}
                    >
                      Cycle through all Jitai fonts
                    </SettingsLabel>
                    <Text
                      style={[
                        styles.settingSubtext,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Cycle all selected styles, with Source Han Sans second
                      unless shown first. When off, switch between the initial
                      font and Source Han Sans.
                    </Text>
                  </View>
                  <Switch
                    accessibilityLabel="Cycle through all Jitai fonts"
                    value={jitaiCycleAllFonts}
                    onValueChange={setJitaiCycleAllFonts}
                    trackColor={{ false: "#767577", true: theme.primary }}
                    thumbColor="#f4f3f4"
                  />
                </View>
              </AdvancedSetting>
            )}
          </SettingsDisclosure>
          <SettingsDisclosure
            title="Keyboard & input"
            description="Shortcuts, Japanese input and voice answers"
            icon="keyboard"
            accessibilityLabel="Advanced settings"
          >
            <AdvancedSetting>
              <TouchableOpacity
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
                onPress={openReviewShortcutModal}
              >

                <SettingsRowIcon setting="shortcuts" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Review Key Shortcuts
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    External keyboards only
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </AdvancedSetting>
            <AdvancedSetting>
              {KeyboardManager &&
                (Platform.OS === "ios" || Platform.OS === "android") && (
                  <View
                    style={[
                      styles.settingItem,
                      { borderBottomColor: "transparent" },
                    ]}
                  >

                    <SettingsRowIcon setting="japanese-keyboard" color={theme.primary} />
                    <View style={styles.settingTextContainer}>
                      <SettingsLabel
                        style={[styles.settingText, { color: theme.textColor }]}
                      >
                        Japanese Input Keyboard
                      </SettingsLabel>
                      <Text
                        style={[
                          styles.settingSubtext,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Automatically switch to a Japanese keyboard for Japanese
                        answer entry throughout the app
                      </Text>
                    </View>
                    <Switch
                      value={autoSwitchKeyboard}
                      onValueChange={async (value) => {
                        if (value && KeyboardManager) {
                          const hasJa =
                            await KeyboardManager.hasJapaneseKeyboard();
                          if (!hasJa) {
                            Alert.alert(
                              "No Japanese Keyboard",
                              JAPANESE_KEYBOARD_SETUP_INSTRUCTIONS,
                            );
                            return;
                          }
                        }
                        setAutoSwitchKeyboard(value);
                      }}
                      trackColor={{ false: "#767577", true: theme.primary }}
                      thumbColor="#f4f3f4"
                    />
                  </View>
                )}
            </AdvancedSetting>
            <AdvancedSetting>
              {Platform.OS === "ios" && (
                <View
                  style={[
                    styles.settingItem,
                    { borderBottomColor: theme.border },
                  ]}
                >

                  <SettingsRowIcon setting="voice-input" color={theme.primary} />
                  <View style={styles.settingTextContainer}>
                    <View style={styles.settingRow}>
                      <SettingsLabel
                        style={[styles.settingText, { color: theme.textColor }]}
                      >
                        Voice Review Answers
                      </SettingsLabel>
                      <View style={styles.betaBadge}>
                        <Text style={styles.betaBadgeText}>BETA</Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.settingSubtext,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Tap the mic once to answer consecutive questions. Tap
                      again to stop.
                    </Text>
                  </View>
                  <Switch
                    value={voiceReviewAnswersEnabled}
                    onValueChange={setVoiceReviewAnswersEnabled}
                    trackColor={{ false: "#767577", true: theme.primary }}
                    thumbColor="#f4f3f4"
                  />
                </View>
              )}
            </AdvancedSetting>
          </SettingsDisclosure>
        </AdvancedSettingsGroup>
      </SettingsSectionSurface>
    </>
  );
}
