import React from "react";
import SrsProgressionSettingIcon from "../../../components/SrsProgressionSettingIcon";
import { FontAwesome, Ionicons } from "@expo/vector-icons";
import { Switch, Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function ReviewSettingsSection() {
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
    disableAutoProgressOnCloseAnswer,
    disableAutoProgressOnCorrect,
    disableAutoProgressOnWrong,
    effectiveReviewWrapUpQuestionGap,
    formatReviewCharacterFontScale,
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
    reviewAnimatePreviousQuestion,
    reviewBatchSize,
    reviewBatchSizeEnabled,
    reviewCharacterFontScale,
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
    setAnkiCardMode,
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
    setReviewSearchButtonEnabled,
    setReviewWrapUpTargetSubjects,
    setShowAddSynonymButton,
    setShowAnswerStopDetailsPreview,
    setShowAnswerStopSubjectDetails,
    setShowReviewItemLevelAndSrsStage,
    setVoiceReviewAnswersEnabled,
    showAddSynonymButton,
    showAnswerStopSubjectDetails,
    showReviewItemLevelAndSrsStage,
    srsProgressionCardDisplayMode,
    theme,
    updateSectionOffset,
    voiceReviewAnswersEnabled,
  } = useSettingsControllerContext();

  return (
    <>
      {/* Review Settings Section */}
      <View
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

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="shuffle"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Jitai (Font Randomizer)
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
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
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={() => router.push("/jitai-font-settings")}
          >
            <Ionicons
              name="text"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Jitai Font Pool
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
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

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="resize-outline"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Review Character Size
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Scale the Japanese font size in reviews
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
                  reviewCharacterFontScale - REVIEW_CHARACTER_FONT_SCALE_STEP,
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
              {formatReviewCharacterFontScale(reviewCharacterFontScale)}
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
                  reviewCharacterFontScale + REVIEW_CHARACTER_FONT_SCALE_STEP,
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

        <View
          style={[
            styles.settingItem,
            {
              borderBottomColor: ankiCardMode ? theme.border : "transparent",
            },
          ]}
        >
          <Ionicons
            name="card"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Anki Card Mode
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Reveal answers on tap with self-grading controls
            </Text>
          </View>
          <Switch
            value={ankiCardMode}
            onValueChange={setAnkiCardMode}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>

        {ankiCardMode && (
          <TouchableOpacity
            style={[
              styles.settingItemColumn,
              { borderBottomColor: theme.border },
            ]}
            onPress={() => router.push("/anki-settings")}
            activeOpacity={0.78}
          >
            <View style={styles.settingRow}>
              <Ionicons
                name="options-outline"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Anki Advanced Settings
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  {`Applies to ${ankiCardModeScope}. ${ankiGroupQuestions ? "Grouped cards enabled." : "Grouped cards disabled."}`}
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

        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: theme.border }]}
          onPress={() => router.push("/review-order-settings")}
        >
          <Ionicons
            name="funnel"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Review Order
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              {reviewTypeOrderEnabled
                ? `${getReviewOrderLabel(reviewOrder)} + type groups`
                : getReviewOrderLabel(reviewOrder)}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="trending-up"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Prioritize Critical Items
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
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

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="pause-circle"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Pause on Wrong Answer
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
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

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="warning"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Pause on Close Answer
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              For fuzzy meaning matches, confirm whether to mark correct or
              incorrect
            </Text>
          </View>
          <Switch
            value={disableAutoProgressOnCloseAnswer}
            onValueChange={setDisableAutoProgressOnCloseAnswer}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="play-skip-forward"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Allow Skipping Reviews
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Submit an empty answer to move the item to the end and reset it
            </Text>
          </View>
          <Switch
            value={allowSkippingReviews}
            onValueChange={setAllowSkippingReviews}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="checkmark-circle"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Pause on Correct Answer
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
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

        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: theme.border }]}
          onPress={openReviewShortcutModal}
        >
          <FontAwesome
            name="keyboard-o"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Review Key Shortcuts
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
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

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="information-circle"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Show Details on Answer Pause
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Slide subject details below the answer field when reviews pause
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
              <Ionicons name="help" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
            <Switch
              value={showAnswerStopSubjectDetails}
              onValueChange={setShowAnswerStopSubjectDetails}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="pricetags"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Accept User Synonyms
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
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

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="add-circle"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Show + Synonym Button
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Show the synonym action when a meaning answer is paused as wrong
            </Text>
          </View>
          <Switch
            value={showAddSynonymButton}
            onValueChange={setShowAddSynonymButton}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="school-outline"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Accept Any On&apos;yomi (Kanji)
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
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

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="swap-vertical"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Back-to-Back Questions
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Show meaning and reading questions consecutively for each item
            </Text>
          </View>
          <Switch
            value={backToBackQuestions}
            onValueChange={setBackToBackQuestions}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
            disabled={
              ankiCardMode && ankiGroupQuestions && ankiCardModeScope === "both"
            }
          />
        </View>

        {backToBackQuestions &&
        !(
          ankiCardMode &&
          ankiGroupQuestions &&
          ankiCardModeScope === "both"
        ) ? (
          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="flash-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Immediate Retry on Wrong
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
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

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="flag"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Wrap Up Target
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Subjects left after tapping Wrap Up (5-20). Paired questions stay
              within {effectiveReviewWrapUpQuestionGap} questions.
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
              disabled={reviewWrapUpTargetSubjects <= reviewWrapUpTargetMin}
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
            <Text style={[styles.batchSizeValue, { color: theme.textColor }]}>
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
              disabled={reviewWrapUpTargetSubjects >= reviewWrapUpTargetMax}
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

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="search"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Review Search Button
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
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

        {KeyboardManager &&
          (Platform.OS === "ios" || Platform.OS === "android") && (
            <View
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            >
              <Ionicons
                name="language"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Switch to Japanese Keyboard
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Automatically switch to a Japanese keyboard for reading
                  answers
                </Text>
              </View>
              <Switch
                value={autoSwitchKeyboard}
                onValueChange={async (value) => {
                  if (value && KeyboardManager) {
                    const hasJa = await KeyboardManager.hasJapaneseKeyboard();
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

        {Platform.OS === "ios" && (
          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="mic"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <View style={styles.settingRow}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Voice Review Answers
                </Text>
                <View style={styles.betaBadge}>
                  <Text style={styles.betaBadgeText}>BETA</Text>
                </View>
              </View>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Answer review questions with speech recognition
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

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <View style={styles.settingIcon}>
            <SrsProgressionSettingIcon size={24} color={theme.primary} />
          </View>
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              SRS Progression
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Show the new SRS stage of the submitted answer
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.voiceSelectionButton, { borderColor: theme.border }]}
            onPress={openSrsProgressionCardModePicker}
            activeOpacity={0.7}
          >
            <View style={styles.voiceSelectionButtonContent}>
              <Text
                style={[styles.voiceSelectionText, { color: theme.textColor }]}
              >
                {getSrsProgressionCardModeLabel(srsProgressionCardDisplayMode)}
              </Text>
              <Ionicons
                name="chevron-down"
                size={14}
                color={theme.textSecondary}
              />
            </View>
          </TouchableOpacity>
        </View>

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="stats-chart-outline"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Show Item Level & SRS Stage
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Display the subject level and current SRS stage during reviews
            </Text>
          </View>
          <Switch
            value={showReviewItemLevelAndSrsStage}
            onValueChange={setShowReviewItemLevelAndSrsStage}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="move-outline"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Animate Previous Question
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
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
          <Ionicons
            name="layers"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Review Batch Size
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
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

        {reviewBatchSizeEnabled && (
          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >
            <Ionicons
              name="options"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Batch Size
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
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
                  reviewBatchSize > 5 && setReviewBatchSize(reviewBatchSize - 5)
                }
                disabled={reviewBatchSize <= 5}
              >
                <Ionicons
                  name="remove"
                  size={18}
                  color={
                    reviewBatchSize <= 5 ? theme.textSecondary : theme.textColor
                  }
                />
              </TouchableOpacity>
              <Text style={[styles.batchSizeValue, { color: theme.textColor }]}>
                {reviewBatchSize}
              </Text>
              <TouchableOpacity
                style={[
                  styles.batchSizeButton,
                  { backgroundColor: theme.border },
                  reviewBatchSize >= 100 && styles.batchSizeButtonDisabled,
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
      </View>
    </>
  );
}
