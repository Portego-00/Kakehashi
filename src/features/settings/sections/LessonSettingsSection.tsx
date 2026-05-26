import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Switch, Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function LessonSettingsSection() {
  const {
    dailyLessonLimit,
    dailyLessonLimitMax,
    dailyLessonLimitMin,
    dailyLessonLimitStep,
    excludeKanaVocabularyFromLessons,
    getLessonOrderLabel,
    getNextDailyLessonLimit,
    getPreviousDailyLessonLimit,
    handleDailyLessonLimitToggle,
    interleaveLessonTypesEnabled,
    isDailyLessonLimitEnabled,
    lessonBatchSize,
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

  return (
    <>
      {/* Lesson Settings Section */}
      <View
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

        <View
          style={[styles.settingItem, { borderBottomColor: "transparent" }]}
        >
          <Ionicons
            name="layers"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Lesson Batch Size
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
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
                lessonBatchSize > 2 && setLessonBatchSize(lessonBatchSize - 1)
              }
              disabled={lessonBatchSize <= 2}
            >
              <Ionicons
                name="remove"
                size={18}
                color={
                  lessonBatchSize <= 2 ? theme.textSecondary : theme.textColor
                }
              />
            </TouchableOpacity>
            <Text style={[styles.batchSizeValue, { color: theme.textColor }]}>
              {lessonBatchSize}
            </Text>
            <TouchableOpacity
              style={[
                styles.batchSizeButton,
                { backgroundColor: theme.border },
                lessonBatchSize >= 10 && styles.batchSizeButtonDisabled,
              ]}
              onPress={() =>
                lessonBatchSize < 10 && setLessonBatchSize(lessonBatchSize + 1)
              }
              disabled={lessonBatchSize >= 10}
            >
              <Ionicons
                name="add"
                size={18}
                color={
                  lessonBatchSize >= 10 ? theme.textSecondary : theme.textColor
                }
              />
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={[
            styles.settingItem,
            {
              borderBottomColor: isDailyLessonLimitEnabled
                ? theme.border
                : "transparent",
            },
          ]}
        >
          <Ionicons
            name="calendar-outline"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Daily Lesson Limit
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
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
                Daily Limit
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
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
              <Text style={[styles.batchSizeValue, { color: theme.textColor }]}>
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
                  setDailyLessonLimit(getNextDailyLessonLimit(dailyLessonLimit))
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

        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: theme.border }]}
          onPress={() => router.push("/lesson-order-settings")}
        >
          <Ionicons
            name="funnel"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Lesson Order
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              {lessonTypeOrderEnabled
                ? `${getLessonOrderLabel(lessonOrder)} + type groups`
                : interleaveLessonTypesEnabled
                  ? `${getLessonOrderLabel(lessonOrder)} + interleaved mix`
                  : getLessonOrderLabel(lessonOrder)}
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
            name="list-outline"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Lesson Picker List View
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Use unlock-style list view for lesson selection (default: cards)
            </Text>
          </View>
          <Switch
            value={lessonPickerViewMode === "list"}
            onValueChange={(enabled) =>
              setLessonPickerViewMode(enabled ? "list" : "cards")
            }
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="language-outline"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Hide Kana Vocabulary
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
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

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="reader"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Single Page View
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Show all lesson content in one scrollable page instead of tabs
            </Text>
          </View>
          <Switch
            value={singlePageLessonView}
            onValueChange={setSinglePageLessonView}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="play-skip-forward-outline"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Skip Custom Lesson Quiz
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
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

        <View
          style={[styles.settingItem, { borderBottomColor: "transparent" }]}
        >
          <Ionicons
            name="image-outline"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Mnemonic Illustrations
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Show radical mnemonic images in subject details and lesson pages
            </Text>
          </View>
          <Switch
            value={showMnemonicIllustrations}
            onValueChange={setShowMnemonicIllustrations}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>
      </View>
    </>
  );
}
