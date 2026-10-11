import { SettingsRowIcon } from "../../../ui/settings/settings-row-icon";
import { SettingsSectionSurface } from "../../../ui/settings/settings-section-surface";
import { SettingsLabel } from "../../../ui/settings/settings-search";
import { SettingsChoiceCards } from "../../../ui/settings/settings-choice-cards";
import { SettingsDisclosure } from "../components/settings-disclosure";
import React from "react";
import { SettingsIcon as Ionicons } from "../../../ui/settings/settings-icon";
import { Switch, Text, TextInput, TouchableOpacity, View } from "react-native";

import {
  AdvancedSetting,
  AdvancedSettingsGroup,
} from "../components/AdvancedSettings";
import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";
import {
  LESSON_SRS_THRESHOLD_MAX,
  normalizeLessonSrsThreshold,
} from "../../../utils/lessonSrsThreshold";
import { useSettingsStore } from "../../../utils/store";

function LessonThresholdInput({
  accessibilityLabel,
  borderColor,
  textColor,
  value,
  onChange,
}: {
  accessibilityLabel: string;
  borderColor: string;
  textColor: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = React.useState(String(value));
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    if (!isEditing) {
      setDraftValue(String(value));
    }
  }, [isEditing, value]);

  const commitDraftValue = () => {
    const normalizedValue = normalizeLessonSrsThreshold(
      draftValue.length > 0 ? Number(draftValue) : 0,
    );
    onChange(normalizedValue);
    setDraftValue(String(normalizedValue));
    setIsEditing(false);
  };

  return (
    <TextInput
      accessibilityLabel={accessibilityLabel}
      accessibilityHint="Enter zero to disable this limit"
      style={[styles.lessonThresholdInput, { borderColor, color: textColor }]}
      value={draftValue}
      onFocus={() => {
        setIsEditing(true);
        if (value === 0) {
          setDraftValue("");
        }
      }}
      onChangeText={(text) => setDraftValue(text.replace(/\D/g, ""))}
      onBlur={commitDraftValue}
      onSubmitEditing={commitDraftValue}
      keyboardType="number-pad"
      inputMode="numeric"
      maxLength={String(LESSON_SRS_THRESHOLD_MAX).length}
      selectTextOnFocus={value > 0}
      textAlign="center"
    />
  );
}

export function LessonSettingsSection() {
  const lessonSearchButtonEnabled = useSettingsStore(
    (state) => state.lessonSearchButtonEnabled,
  );
  const setLessonSearchButtonEnabled = useSettingsStore(
    (state) => state.setLessonSearchButtonEnabled,
  );
  const apprenticeLessonThreshold = useSettingsStore(
    (state) => state.apprenticeLessonThreshold,
  );
  const guruLessonThreshold = useSettingsStore(
    (state) => state.guruLessonThreshold,
  );
  const setApprenticeLessonThreshold = useSettingsStore(
    (state) => state.setApprenticeLessonThreshold,
  );
  const setGuruLessonThreshold = useSettingsStore(
    (state) => state.setGuruLessonThreshold,
  );
  const {
    dailyLessonLimit,
    dailyLessonLimitMax,
    dailyLessonLimitMin,
    dailyLessonLimitStep,
    dailyLessonReminderIncludeWeekends,
    excludeKanaVocabularyFromLessons,
    getLessonOrderLabel,
    getNextDailyLessonLimit,
    getPreviousDailyLessonLimit,
    handleDailyLessonLimitToggle,
    handleDailyLessonReminderIncludeWeekendsChange,
    interleaveLessonTypesEnabled,
    isDailyLessonLimitEnabled,
    lessonBatchSize,
    minimumRadicalKanjiPerBatchEnabled,
    lessonOrder,
    lessonPickerViewMode,
    lessonTypeOrderEnabled,
    router,
    setDailyLessonLimit,
    setExcludeKanaVocabularyFromLessons,
    setLessonBatchSize,
    setLessonPickerViewMode,
    setShowMnemonicIllustrations,
    setSinglePageLessonView,
    setSkipCustomLessonQuiz,
    showMnemonicIllustrations,
    singlePageLessonView,
    skipCustomLessonQuiz,
    theme,
    updateSectionOffset,
  } = useSettingsControllerContext();
  const lessonOrderSummary = [
    getLessonOrderLabel(lessonOrder),
    lessonTypeOrderEnabled
      ? "type groups"
      : interleaveLessonTypesEnabled
        ? "interleaved mix"
        : null,
    minimumRadicalKanjiPerBatchEnabled ? "batch minimums" : null,
  ]
    .filter(Boolean)
    .join(" + ");

  return (
    <>
      {/* Lesson Settings Section */}
      <SettingsSectionSurface
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("lessons", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          Lesson Settings
        </Text>
        <AdvancedSettingsGroup grouped>
          <View>
            <View
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            >

              <SettingsRowIcon setting="lesson-count" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Lesson Batch Size
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Number of items per lesson batch (2-10)
                </Text>
              </View>
              <View style={styles.batchSizeSelector}>
                <TouchableOpacity
                  style={[
                    styles.batchSizeButton,
                    { backgroundColor: theme.border },
                    lessonBatchSize <= 2 && styles.batchSizeButtonDisabled,
                  ]}
                  onPress={() =>
                    lessonBatchSize > 2 &&
                    setLessonBatchSize(lessonBatchSize - 1)
                  }
                  disabled={lessonBatchSize <= 2}
                >
                  <Ionicons
                    name="remove"
                    size={18}
                    color={
                      lessonBatchSize <= 2
                        ? theme.textSecondary
                        : theme.textColor
                    }
                  />
                </TouchableOpacity>
                <Text
                  style={[styles.batchSizeValue, { color: theme.textColor }]}
                >
                  {lessonBatchSize}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.batchSizeButton,
                    { backgroundColor: theme.border },
                    lessonBatchSize >= 10 && styles.batchSizeButtonDisabled,
                  ]}
                  onPress={() =>
                    lessonBatchSize < 10 &&
                    setLessonBatchSize(lessonBatchSize + 1)
                  }
                  disabled={lessonBatchSize >= 10}
                >
                  <Ionicons
                    name="add"
                    size={18}
                    color={
                      lessonBatchSize >= 10
                        ? theme.textSecondary
                        : theme.textColor
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>
            <View
              style={[
                styles.settingItem,
                {
                  borderBottomColor: theme.border,
                },
              ]}
            >

              <SettingsRowIcon setting="daily-cap" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Daily Lesson Limit
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Cap lessons per day in your device timezone
                </Text>
              </View>
              <Switch
                value={isDailyLessonLimitEnabled}
                onValueChange={handleDailyLessonLimitToggle}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>
            {isDailyLessonLimitEnabled && (
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="daily-count" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Daily Limit
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {`Number of lessons per day (${dailyLessonLimitMin}-${dailyLessonLimitMax}, step ${dailyLessonLimitStep})`}
                  </Text>
                </View>
                <View style={styles.batchSizeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.batchSizeButton,
                      { backgroundColor: theme.border },
                      dailyLessonLimit <= dailyLessonLimitMin &&
                        styles.batchSizeButtonDisabled,
                    ]}
                    onPress={() =>
                      dailyLessonLimit > dailyLessonLimitMin &&
                      setDailyLessonLimit(
                        getPreviousDailyLessonLimit(dailyLessonLimit),
                      )
                    }
                    disabled={dailyLessonLimit <= dailyLessonLimitMin}
                  >
                    <Ionicons
                      name="remove"
                      size={18}
                      color={
                        dailyLessonLimit <= dailyLessonLimitMin
                          ? theme.textSecondary
                          : theme.textColor
                      }
                    />
                  </TouchableOpacity>
                  <Text
                    style={[styles.batchSizeValue, { color: theme.textColor }]}
                  >
                    {dailyLessonLimit}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.batchSizeButton,
                      { backgroundColor: theme.border },
                      dailyLessonLimit >= dailyLessonLimitMax &&
                        styles.batchSizeButtonDisabled,
                    ]}
                    onPress={() =>
                      dailyLessonLimit < dailyLessonLimitMax &&
                      setDailyLessonLimit(
                        getNextDailyLessonLimit(dailyLessonLimit),
                      )
                    }
                    disabled={dailyLessonLimit >= dailyLessonLimitMax}
                  >
                    <Ionicons
                      name="add"
                      size={18}
                      color={
                        dailyLessonLimit >= dailyLessonLimitMax
                          ? theme.textSecondary
                          : theme.textColor
                      }
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            <View
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
            >

              <SettingsRowIcon setting="apprentice-cap" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Apprentice Lesson Threshold
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Stop offering home-page lessons above this count (0 = no
                  limit)
                </Text>
              </View>
              <LessonThresholdInput
                accessibilityLabel="Apprentice lesson threshold"
                borderColor={theme.border}
                textColor={theme.textColor}
                value={apprenticeLessonThreshold}
                onChange={setApprenticeLessonThreshold}
              />
            </View>
            <View
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
            >

              <SettingsRowIcon setting="guru-cap" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Guru Lesson Threshold
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Stop offering home-page lessons above this count (0 = no
                  limit)
                </Text>
              </View>
              <LessonThresholdInput
                accessibilityLabel="Guru lesson threshold"
                borderColor={theme.border}
                textColor={theme.textColor}
                value={guruLessonThreshold}
                onChange={setGuruLessonThreshold}
              />
            </View>
            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
              onPress={() => router.push("/lesson-order-settings")}
            >

              <SettingsRowIcon setting="lesson-order" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Lesson Order
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  {lessonOrderSummary}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </View>
          <SettingsDisclosure
            title="Lesson presentation"
            description="Browsing, detail layout and illustrations"
            icon="lessons"
          >
            <AdvancedSetting>
              <SettingsChoiceCards
                label="Lesson picker layout"
                compact
                value={lessonPickerViewMode}
                theme={theme}
                options={[
                  { value: "cards", label: "Cards", art: "tiles" },
                  { value: "list", label: "List", art: "list" },
                ]}
                onChange={setLessonPickerViewMode}
              />
            </AdvancedSetting>
            <AdvancedSetting>
              <SettingsChoiceCards
                label="Lesson detail layout"
                compact
                value={singlePageLessonView ? "page" : "tabs"}
                theme={theme}
                options={[
                  { value: "tabs", label: "Tabs", art: "tabs" },
                  { value: "page", label: "Single page", art: "page" },
                ]}
                onChange={(value) => setSinglePageLessonView(value === "page")}
              />
            </AdvancedSetting>
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: "transparent" },
                ]}
              >

                <SettingsRowIcon setting="mnemonic-images" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Mnemonic Illustrations
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Show radical mnemonic images in subject details and lesson
                    pages
                  </Text>
                </View>
                <Switch
                  value={showMnemonicIllustrations}
                  onValueChange={setShowMnemonicIllustrations}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>
            </AdvancedSetting>
          </SettingsDisclosure>
          <SettingsDisclosure
            title="Advanced lesson preferences"
            description="Content filters, quizzes and reminders"
            icon="settings"
            accessibilityLabel="Advanced settings"
          >
            <AdvancedSetting>
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >

                <SettingsRowIcon setting="weekend-reminders" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Weekend Lesson Reminders
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Send lesson reminders on Saturdays and Sundays
                  </Text>
                </View>
                <Switch
                  value={dailyLessonReminderIncludeWeekends}
                  onValueChange={(includeWeekends) => {
                    void handleDailyLessonReminderIncludeWeekendsChange(
                      includeWeekends,
                    );
                  }}
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

                <SettingsRowIcon setting="exclude-kana" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Hide Kana Vocabulary
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Exclude kana vocabulary from lessons and lesson counts
                  </Text>
                </View>
                <Switch
                  value={excludeKanaVocabularyFromLessons}
                  onValueChange={setExcludeKanaVocabularyFromLessons}
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

                <SettingsRowIcon setting="lesson-search" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Lesson Search Button
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Search from lesson cards without leaving your lesson session
                  </Text>
                </View>
                <Switch
                  accessibilityLabel="Lesson Search Button"
                  value={lessonSearchButtonEnabled}
                  onValueChange={setLessonSearchButtonEnabled}
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

                <SettingsRowIcon setting="skip-lesson-quiz" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Skip Custom Lesson Quiz
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Skip the quiz step in custom lessons
                  </Text>
                </View>
                <Switch
                  value={skipCustomLessonQuiz}
                  onValueChange={setSkipCustomLessonQuiz}
                  trackColor={{ false: "#767577", true: theme.primary }}
                  thumbColor="#f4f3f4"
                />
              </View>
            </AdvancedSetting>
          </SettingsDisclosure>
        </AdvancedSettingsGroup>
      </SettingsSectionSurface>
    </>
  );
}
