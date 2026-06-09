import React from "react";
import { Picker } from "@react-native-picker/picker";
import {
  Modal,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function ReminderTimeModal() {
  const {
    handleSaveReminderTime,
    reminderHourDraft,
    reminderMinuteDraft,
    setReminderHourDraft,
    setReminderMinuteDraft,
    setShowReminderTimeModal,
    sheetBottomPadding,
    sheetHorizontalPadding,
    showReminderTimeModal,
    theme,
  } = useSettingsControllerContext();

  return (
    <>
      <Modal
        visible={showReminderTimeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReminderTimeModal(false)}
      >
        <TouchableWithoutFeedback
          onPress={() => setShowReminderTimeModal(false)}
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
                  styles.reminderTimeModalContent,
                  { backgroundColor: theme.cardBackground },
                ]}
              >
                <Text
                  style={[
                    styles.voicePickerModalTitle,
                    { color: theme.textColor, paddingBottom: 8 },
                  ]}
                >
                  Daily Reminder Time
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary, paddingHorizontal: 16 },
                  ]}
                >
                  Shared by daily review and lesson reminders in your local
                  timezone.
                </Text>
                <View
                  style={[
                    styles.reminderTimePickerContainer,
                    {
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <View style={styles.reminderTimePickerRow}>
                    <View style={styles.reminderTimePickerColumn}>
                      <Text
                        style={[
                          styles.reminderTimePickerLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Hour
                      </Text>
                      <Picker
                        selectedValue={reminderHourDraft}
                        onValueChange={(value) =>
                          setReminderHourDraft(Number(value))
                        }
                        style={[
                          styles.reminderTimeValuePicker,
                          { color: theme.textColor },
                        ]}
                        itemStyle={[
                          styles.reminderTimeValuePickerItem,
                          { color: theme.textColor },
                        ]}
                      >
                        {Array.from({ length: 24 }, (_, hour) => (
                          <Picker.Item
                            key={`reminder-hour-${hour}`}
                            label={hour.toString().padStart(2, "0")}
                            value={hour}
                          />
                        ))}
                      </Picker>
                    </View>
                    <View style={styles.reminderTimePickerColumn}>
                      <Text
                        style={[
                          styles.reminderTimePickerLabel,
                          { color: theme.textSecondary },
                        ]}
                      >
                        Minute
                      </Text>
                      <Picker
                        selectedValue={reminderMinuteDraft}
                        onValueChange={(value) =>
                          setReminderMinuteDraft(Number(value))
                        }
                        style={[
                          styles.reminderTimeValuePicker,
                          { color: theme.textColor },
                        ]}
                        itemStyle={[
                          styles.reminderTimeValuePickerItem,
                          { color: theme.textColor },
                        ]}
                      >
                        {Array.from({ length: 60 }, (_, minute) => (
                          <Picker.Item
                            key={`reminder-minute-${minute}`}
                            label={minute.toString().padStart(2, "0")}
                            value={minute}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>
                </View>
                <View style={styles.reminderTimeActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.reminderTimeButton,
                      { borderColor: theme.border },
                    ]}
                    onPress={() => setShowReminderTimeModal(false)}
                  >
                    <Text
                      style={[
                        styles.reminderTimeButtonText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.reminderTimeButton,
                      styles.reminderTimeSaveButton,
                      { backgroundColor: theme.primary },
                    ]}
                    onPress={() => void handleSaveReminderTime()}
                  >
                    <Text
                      style={[styles.reminderTimeButtonText, { color: "#fff" }]}
                    >
                      Save
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
}
