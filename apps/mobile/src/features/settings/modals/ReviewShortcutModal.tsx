import React from "react";
import {
  Modal,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function ReviewShortcutModal() {
  const {
    beginReviewShortcutCapture,
    capturingReviewShortcutKey,
    closeReviewShortcutModal,
    disableAutoProgressOnCloseAnswer,
    disableAutoProgressOnCorrect,
    disableAutoProgressOnWrong,
    formatReviewShortcutLabel,
    handleReviewShortcutCaptureKeyPress,
    handleReviewShortcutCaptureSubmit,
    REVIEW_CORRECT_SHORTCUT_FIELDS,
    REVIEW_INCORRECT_SHORTCUT_FIELDS,
    reviewCorrectShortcutDraft,
    reviewIncorrectShortcutDraft,
    reviewShortcutCaptureInputRef,
    reviewShortcutSheetTopPadding,
    setCapturingReviewShortcutKey,
    setDisableAutoProgressOnCorrect,
    setDisableAutoProgressOnWrong,
    sheetBottomPadding,
    sheetHorizontalPadding,
    showReviewShortcutModal,
    StyleSheet,
    theme,
  } = useSettingsControllerContext();

  return (
    <>
      <Modal
        visible={showReviewShortcutModal}
        transparent
        animationType="fade"
        onRequestClose={closeReviewShortcutModal}
      >
        <TouchableWithoutFeedback onPress={closeReviewShortcutModal}>
          <View
            style={[
              styles.voicePickerModalOverlay,
              {
                paddingHorizontal: sheetHorizontalPadding,
                paddingTop: reviewShortcutSheetTopPadding,
                paddingBottom: sheetBottomPadding,
              },
            ]}
          >
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.reviewShortcutModalContent,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <ScrollView
                  style={styles.reviewShortcutModalScrollView}
                  contentContainerStyle={
                    styles.reviewShortcutModalScrollContent
                  }
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  <Text
                    style={[
                      styles.voicePickerModalTitle,
                      { color: theme.textColor, paddingBottom: 8 },
                    ]}
                  >
                    Review Key Shortcuts
                  </Text>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary, paddingHorizontal: 16 },
                    ]}
                  >
                    External keyboards only. Tap a shortcut, then press one key.
                    Press Backspace to clear.
                  </Text>
                  <View
                    style={[
                      styles.reviewShortcutGroup,
                      { borderColor: theme.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.reviewShortcutGroupHeader,
                        { borderBottomColor: theme.border },
                      ]}
                    >
                      <View
                        style={styles.reviewShortcutGroupHeaderTextContainer}
                      >
                        <Text
                          style={[
                            styles.reviewShortcutGroupTitle,
                            { color: theme.textColor },
                          ]}
                        >
                          Stop on Incorrect
                        </Text>
                        <Text
                          style={[
                            styles.reviewShortcutGroupSubtitle,
                            { color: theme.textSecondary },
                          ]}
                        >
                          Active when Pause on Wrong Answer or Pause on Close
                          Answer is enabled.
                        </Text>
                      </View>
                      <Switch
                        value={disableAutoProgressOnWrong}
                        onValueChange={(enabled) => {
                          setDisableAutoProgressOnWrong(enabled);
                          if (
                            !enabled &&
                            capturingReviewShortcutKey?.group === "incorrect"
                          ) {
                            setCapturingReviewShortcutKey(null);
                          }
                        }}
                        trackColor={{ false: "#767577", true: theme.primary }}
                        thumbColor="#f4f3f4"
                      />
                    </View>

                    <View
                      style={[
                        styles.reviewShortcutList,
                        !disableAutoProgressOnWrong &&
                          !disableAutoProgressOnCloseAnswer &&
                          styles.reviewShortcutListDisabled,
                      ]}
                    >
                      {REVIEW_INCORRECT_SHORTCUT_FIELDS.map(
                        (shortcutField, index) => {
                          const isCapturingThisKey =
                            capturingReviewShortcutKey?.group === "incorrect" &&
                            capturingReviewShortcutKey.key ===
                              shortcutField.key;

                          return (
                            <TouchableOpacity
                              key={`incorrect-${shortcutField.key}`}
                              activeOpacity={0.8}
                              onPress={() =>
                                beginReviewShortcutCapture({
                                  group: "incorrect",
                                  key: shortcutField.key,
                                })
                              }
                              disabled={
                                !disableAutoProgressOnWrong &&
                                !disableAutoProgressOnCloseAnswer
                              }
                              style={[
                                styles.reviewShortcutRow,
                                index > 0 && {
                                  borderTopWidth: StyleSheet.hairlineWidth,
                                  borderTopColor: theme.border,
                                },
                              ]}
                            >
                              <View style={styles.reviewShortcutTextContainer}>
                                <Text
                                  style={[
                                    styles.reviewShortcutLabel,
                                    { color: theme.textColor },
                                  ]}
                                >
                                  {shortcutField.label}
                                </Text>
                                <Text
                                  style={[
                                    styles.reviewShortcutHint,
                                    { color: theme.textSecondary },
                                  ]}
                                >
                                  {shortcutField.hint}
                                </Text>
                              </View>

                              <View
                                style={[
                                  styles.reviewShortcutValueButton,
                                  {
                                    borderColor: theme.border,
                                    backgroundColor: theme.isDark
                                      ? "#1f1f1f"
                                      : "#f5f5f5",
                                  },
                                  isCapturingThisKey && {
                                    borderColor: theme.primary,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.reviewShortcutValueText,
                                    { color: theme.textColor },
                                  ]}
                                >
                                  {isCapturingThisKey
                                    ? "Press key"
                                    : formatReviewShortcutLabel(
                                        reviewIncorrectShortcutDraft[
                                          shortcutField.key
                                        ],
                                      )}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        },
                      )}
                    </View>
                  </View>

                  <View
                    style={[
                      styles.reviewShortcutGroup,
                      { borderColor: theme.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.reviewShortcutGroupHeader,
                        { borderBottomColor: theme.border },
                      ]}
                    >
                      <View
                        style={styles.reviewShortcutGroupHeaderTextContainer}
                      >
                        <Text
                          style={[
                            styles.reviewShortcutGroupTitle,
                            { color: theme.textColor },
                          ]}
                        >
                          Stop on Correct
                        </Text>
                        <Text
                          style={[
                            styles.reviewShortcutGroupSubtitle,
                            { color: theme.textSecondary },
                          ]}
                        >
                          Active when Pause on Correct Answer is enabled.
                        </Text>
                      </View>
                      <Switch
                        value={disableAutoProgressOnCorrect}
                        onValueChange={(enabled) => {
                          setDisableAutoProgressOnCorrect(enabled);
                          if (
                            !enabled &&
                            capturingReviewShortcutKey?.group === "correct"
                          ) {
                            setCapturingReviewShortcutKey(null);
                          }
                        }}
                        trackColor={{ false: "#767577", true: theme.primary }}
                        thumbColor="#f4f3f4"
                      />
                    </View>

                    <View
                      style={[
                        styles.reviewShortcutList,
                        !disableAutoProgressOnCorrect &&
                          styles.reviewShortcutListDisabled,
                      ]}
                    >
                      {REVIEW_CORRECT_SHORTCUT_FIELDS.map(
                        (shortcutField, index) => {
                          const isCapturingThisKey =
                            capturingReviewShortcutKey?.group === "correct" &&
                            capturingReviewShortcutKey.key ===
                              shortcutField.key;

                          return (
                            <TouchableOpacity
                              key={`correct-${shortcutField.key}`}
                              activeOpacity={0.8}
                              onPress={() =>
                                beginReviewShortcutCapture({
                                  group: "correct",
                                  key: shortcutField.key,
                                })
                              }
                              disabled={!disableAutoProgressOnCorrect}
                              style={[
                                styles.reviewShortcutRow,
                                index > 0 && {
                                  borderTopWidth: StyleSheet.hairlineWidth,
                                  borderTopColor: theme.border,
                                },
                              ]}
                            >
                              <View style={styles.reviewShortcutTextContainer}>
                                <Text
                                  style={[
                                    styles.reviewShortcutLabel,
                                    { color: theme.textColor },
                                  ]}
                                >
                                  {shortcutField.label}
                                </Text>
                                <Text
                                  style={[
                                    styles.reviewShortcutHint,
                                    { color: theme.textSecondary },
                                  ]}
                                >
                                  {shortcutField.hint}
                                </Text>
                              </View>

                              <View
                                style={[
                                  styles.reviewShortcutValueButton,
                                  {
                                    borderColor: theme.border,
                                    backgroundColor: theme.isDark
                                      ? "#1f1f1f"
                                      : "#f5f5f5",
                                  },
                                  isCapturingThisKey && {
                                    borderColor: theme.primary,
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.reviewShortcutValueText,
                                    { color: theme.textColor },
                                  ]}
                                >
                                  {isCapturingThisKey
                                    ? "Press key"
                                    : formatReviewShortcutLabel(
                                        reviewCorrectShortcutDraft[
                                          shortcutField.key
                                        ],
                                      )}
                                </Text>
                              </View>
                            </TouchableOpacity>
                          );
                        },
                      )}
                    </View>
                  </View>

                  <View style={styles.reminderTimeActionRow}>
                    <TouchableOpacity
                      style={[
                        styles.reminderTimeButton,
                        { borderColor: theme.border },
                      ]}
                      onPress={closeReviewShortcutModal}
                    >
                      <Text
                        style={[
                          styles.reminderTimeButtonText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Done
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>

                <TextInput
                  ref={reviewShortcutCaptureInputRef}
                  value=""
                  onChangeText={() => {}}
                  onKeyPress={handleReviewShortcutCaptureKeyPress}
                  onSubmitEditing={handleReviewShortcutCaptureSubmit}
                  style={styles.hiddenShortcutCaptureInput}
                  autoCorrect={false}
                  autoCapitalize="none"
                  blurOnSubmit={false}
                  returnKeyType="done"
                />
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
