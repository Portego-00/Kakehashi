import React from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function AndroidVocabularyVoicePickerModal() {
  const {
    closeVocabularyAudioVoicePicker,
    getVocabularyAudioVoiceIconName,
    Platform,
    selectVocabularyAudioVoice,
    sheetBottomPadding,
    sheetHorizontalPadding,
    showVocabularyVoiceMenu,
    theme,
    VOCABULARY_AUDIO_VOICE_OPTIONS,
    vocabularyAudioVoice,
  } = useSettingsControllerContext();

  return (
    <>
      {/* Android Vocabulary Voice Picker Modal */}
      {Platform.OS === "android" && (
        <Modal
          visible={showVocabularyVoiceMenu}
          transparent
          animationType="fade"
          onRequestClose={closeVocabularyAudioVoicePicker}
        >
          <TouchableWithoutFeedback onPress={closeVocabularyAudioVoicePicker}>
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
                    styles.voicePickerModalContent,
                    { backgroundColor: theme.cardBackground },
                  ]}
                >
                  <Text
                    style={[
                      styles.voicePickerModalTitle,
                      { color: theme.textColor },
                    ]}
                  >
                    Vocabulary Audio Voice
                  </Text>

                  {VOCABULARY_AUDIO_VOICE_OPTIONS.map((option) => {
                    const isSelected = vocabularyAudioVoice === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.voicePickerModalOption,
                          { borderTopColor: theme.border },
                        ]}
                        onPress={() => selectVocabularyAudioVoice(option.value)}
                      >
                        <Ionicons
                          name={getVocabularyAudioVoiceIconName(option.value)}
                          size={20}
                          color={theme.textColor}
                        />
                        <Text
                          style={[
                            styles.voicePickerModalOptionText,
                            { color: theme.textColor },
                          ]}
                        >
                          {option.label}
                        </Text>
                        {isSelected && (
                          <Ionicons
                            name="checkmark"
                            size={20}
                            color={theme.primary}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  })}

                  <TouchableOpacity
                    style={[
                      styles.voicePickerModalOption,
                      styles.voicePickerModalCancel,
                      { borderTopColor: theme.border },
                    ]}
                    onPress={closeVocabularyAudioVoicePicker}
                  >
                    <Text
                      style={[
                        styles.voicePickerModalCancelText,
                        { color: theme.error },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      )}
    </>
  );
}
