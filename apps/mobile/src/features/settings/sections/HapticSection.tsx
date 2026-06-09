import React from "react";
import { MaterialIcons } from "@expo/vector-icons";
import { Switch, Text, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function HapticSection() {
  const {
    hapticFeedbackEnabled,
    setHapticFeedbackEnabled,
    theme,
    updateSectionOffset,
  } = useSettingsControllerContext();

  return (
    <>
      {/* Feedback Section */}
      <View
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("haptic", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          Haptic
        </Text>

        <View
          style={[styles.settingItem, { borderBottomColor: "transparent" }]}
        >
          <MaterialIcons
            name="vibration"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Haptic Feedback
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Vibrate on key actions across the app
            </Text>
          </View>
          <Switch
            value={hapticFeedbackEnabled}
            onValueChange={setHapticFeedbackEnabled}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>
      </View>
    </>
  );
}
