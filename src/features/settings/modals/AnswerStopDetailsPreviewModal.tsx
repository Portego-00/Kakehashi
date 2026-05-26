import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import {
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function AnswerStopDetailsPreviewModal() {
  const {
    answerStopPreviewImageHeight,
    setShowAnswerStopDetailsPreview,
    sheetBottomPadding,
    sheetHorizontalPadding,
    showAnswerStopDetailsPreview,
    STOP_DETAILS_PREVIEW_IMAGE,
    theme,
  } = useSettingsControllerContext();

  return (
    <>
      <Modal
        visible={showAnswerStopDetailsPreview}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAnswerStopDetailsPreview(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setShowAnswerStopDetailsPreview(false)}
        >
          <View
            style={[
              styles.voicePickerModalOverlay,
              {
                paddingHorizontal: sheetHorizontalPadding,
                paddingBottom: sheetBottomPadding,
              },
            ]}
          >
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.answerStopPreviewCard,
                  {
                    backgroundColor: theme.cardBackground,
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.answerStopPreviewHeader}>
                  <View
                    style={[
                      styles.answerStopPreviewIcon,
                      {
                        backgroundColor: theme.isDark
                          ? "rgba(255,255,255,0.08)"
                          : "rgba(0,0,0,0.04)",
                      },
                    ]}
                  >
                    <Ionicons name="help" size={17} color={theme.primary} />
                  </View>
                  <Text
                    style={[
                      styles.answerStopPreviewTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    Answer Pause Details
                  </Text>
                </View>

                <Text
                  style={[
                    styles.answerStopPreviewDescription,
                    { color: theme.textSecondary },
                  ]}
                >
                  When a review stops after an answer, the answer field,
                  actions, and subject details slide up together below the
                  subject.
                </Text>

                <View
                  style={[
                    styles.answerStopPreviewScreenshotFrame,
                    {
                      backgroundColor: theme.backgroundColor,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Image
                    source={STOP_DETAILS_PREVIEW_IMAGE}
                    style={[
                      styles.answerStopPreviewScreenshot,
                      { height: answerStopPreviewImageHeight },
                    ]}
                    contentFit="contain"
                    accessibilityLabel="Preview of the answer pause details sheet"
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.answerStopPreviewCloseButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={() => setShowAnswerStopDetailsPreview(false)}
                  activeOpacity={0.85}
                >
                  <Text style={styles.answerStopPreviewCloseText}>Got it</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
