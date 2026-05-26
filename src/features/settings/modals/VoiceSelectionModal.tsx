import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, ScrollView, Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function VoiceSelectionModal() {
  const {
    JAPANESE_VOICES,
    modalHeaderPaddingTop,
    saveSelectedVoice,
    selectedVoice,
    setShowVoiceModal,
    showVoiceModal,
    testingVoiceId,
    testVoice,
    theme,
  } = useSettingsControllerContext();

  return (
    <>
      {/* Voice Selection Modal */}
      <Modal
        visible={showVoiceModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.backgroundColor },
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              {
                backgroundColor: theme.cardBackground,
                borderBottomColor: theme.border,
                paddingTop: modalHeaderPaddingTop,
              },
            ]}
          >
            <TouchableOpacity onPress={() => setShowVoiceModal(false)}>
              <Text style={[styles.modalCancelText, { color: theme.primary }]}>
                Cancel
              </Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.textColor }]}>
              Select Voice
            </Text>
            <View style={{ width: 60 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {JAPANESE_VOICES.map((voice) => (
              <View
                key={voice.shortName}
                style={[
                  styles.voiceOption,
                  {
                    backgroundColor: theme.cardBackground,
                    borderBottomColor: theme.border,
                  },
                  selectedVoice === voice.shortName && {
                    backgroundColor: theme.primary + "20",
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.voiceMainArea}
                  onPress={() => saveSelectedVoice(voice.shortName)}
                >
                  <View style={styles.voiceInfo}>
                    <Text
                      style={[styles.voiceName, { color: theme.textColor }]}
                    >
                      {voice.displayName}
                    </Text>
                    <Text
                      style={[
                        styles.voiceDetails,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {voice.localName} • {voice.gender}
                    </Text>
                  </View>
                  {selectedVoice === voice.shortName && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={theme.primary}
                    />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.testVoiceButton,
                    { borderColor: theme.border },
                  ]}
                  onPress={() => testVoice(voice.shortName)}
                >
                  <Ionicons
                    name={
                      testingVoiceId === voice.shortName
                        ? "time"
                        : "volume-high"
                    }
                    size={20}
                    color={
                      testingVoiceId === voice.shortName
                        ? theme.textSecondary
                        : theme.primary
                    }
                  />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
