import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Switch, Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function NotificationsSection() {
  const {
    dailyLessonReminderEnabled,
    dailyLessonReminderMinimum,
    dailyLessonReminderMinimumMax,
    dailyLessonReminderMinimumMin,
    dailyLessonReminderMinimumStep,
    dailyReviewReminderEnabled,
    dailyReviewReminderHour,
    dailyReviewReminderMinute,
    enableReviewNotifications,
    formatReminderTimeLabel,
    getNextDailyLessonReminderMinimum,
    getPreviousDailyLessonReminderMinimum,
    handleBadgeNotificationChange,
    handleDailyLessonReminderChange,
    handleDailyLessonReminderMinimumChange,
    handleDailyReviewReminderChange,
    handleReviewNotificationChange,
    handleShowPendingNotifications,
    isAnyDailyReminderEnabled,
    openReminderTimeModal,
    Platform,
    showBadgeNotifications,
    theme,
    updateSectionOffset,
  } = useSettingsControllerContext();

  return (
    <>
      {/* Notifications Section */}
      <View
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("notifications", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          Notifications
        </Text>

        {Platform.OS !== "android" && (
          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="notifications"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                App Badge Notifications
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show review count in app icon badge
              </Text>
            </View>
            <Switch
              value={showBadgeNotifications}
              onValueChange={handleBadgeNotificationChange}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
        )}

        <View
          style={[
            styles.settingItem,
            {
              borderBottomColor:
                Platform.OS === "ios" || Platform.OS === "android" || __DEV__
                  ? theme.border
                  : "transparent",
            },
          ]}
        >
          <Ionicons
            name="alarm"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Review Notifications
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Get notified when new reviews become available
            </Text>
          </View>
          <Switch
            value={enableReviewNotifications}
            onValueChange={handleReviewNotificationChange}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>

        {(Platform.OS === "ios" || Platform.OS === "android") && (
          <>
            <View
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
            >
              <Ionicons
                name="time"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Daily Review Reminder
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Send one reminder at your chosen local time if reviews are
                  still pending
                </Text>
              </View>
              <Switch
                value={dailyReviewReminderEnabled}
                onValueChange={handleDailyReviewReminderChange}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>

            <View
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
            >
              <Ionicons
                name="book-outline"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Daily Lesson Reminder
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Send one reminder when your minimum daily lessons are not met
                  and lessons are still available
                </Text>
              </View>
              <Switch
                value={dailyLessonReminderEnabled}
                onValueChange={handleDailyLessonReminderChange}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>

            {dailyLessonReminderEnabled && (
              <View
                style={[
                  styles.settingItem,
                  { borderBottomColor: theme.border },
                ]}
              >
                <Ionicons
                  name="options"
                  size={24}
                  color={theme.primary}
                  style={styles.settingIcon}
                />
                <View style={styles.settingTextContainer}>
                  <Text
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Minimum Daily Lessons
                  </Text>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {`Set your daily lesson goal (${dailyLessonReminderMinimumMin}-${dailyLessonReminderMinimumMax}, step ${dailyLessonReminderMinimumStep})`}
                  </Text>
                </View>
                <View style={styles.batchSizeSelector}>
                  <TouchableOpacity
                    style={[
                      styles.batchSizeButton,
                      { backgroundColor: theme.border },
                      dailyLessonReminderMinimum <=
                        dailyLessonReminderMinimumMin &&
                        styles.batchSizeButtonDisabled,
                    ]}
                    onPress={() =>
                      void handleDailyLessonReminderMinimumChange(
                        getPreviousDailyLessonReminderMinimum(
                          dailyLessonReminderMinimum,
                        ),
                      )
                    }
                    disabled={
                      dailyLessonReminderMinimum <=
                      dailyLessonReminderMinimumMin
                    }
                  >
                    <Ionicons
                      name="remove"
                      size={18}
                      color={
                        dailyLessonReminderMinimum <=
                        dailyLessonReminderMinimumMin
                          ? theme.textSecondary
                          : theme.textColor
                      }
                    />
                  </TouchableOpacity>
                  <Text
                    style={[styles.batchSizeValue, { color: theme.textColor }]}
                  >
                    {dailyLessonReminderMinimum}
                  </Text>
                  <TouchableOpacity
                    style={[
                      styles.batchSizeButton,
                      { backgroundColor: theme.border },
                      dailyLessonReminderMinimum >=
                        dailyLessonReminderMinimumMax &&
                        styles.batchSizeButtonDisabled,
                    ]}
                    onPress={() =>
                      void handleDailyLessonReminderMinimumChange(
                        getNextDailyLessonReminderMinimum(
                          dailyLessonReminderMinimum,
                        ),
                      )
                    }
                    disabled={
                      dailyLessonReminderMinimum >=
                      dailyLessonReminderMinimumMax
                    }
                  >
                    <Ionicons
                      name="add"
                      size={18}
                      color={
                        dailyLessonReminderMinimum >=
                        dailyLessonReminderMinimumMax
                          ? theme.textSecondary
                          : theme.textColor
                      }
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.settingItem,
                {
                  borderBottomColor: __DEV__ ? theme.border : "transparent",
                  opacity: isAnyDailyReminderEnabled ? 1 : 0.5,
                },
              ]}
              disabled={!isAnyDailyReminderEnabled}
              onPress={openReminderTimeModal}
            >
              <Ionicons
                name="time-outline"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Reminder Time
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Shared by daily review and lesson reminders
                </Text>
              </View>
              <Text
                style={[styles.settingValueText, { color: theme.textColor }]}
              >
                {formatReminderTimeLabel(
                  dailyReviewReminderHour,
                  dailyReviewReminderMinute,
                )}
              </Text>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
          </>
        )}

        {__DEV__ && (
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            onPress={handleShowPendingNotifications}
          >
            <Ionicons
              name="list"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                View Scheduled Notifications
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Debug: See all pending notifications and badges
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        )}
      </View>
    </>
  );
}
