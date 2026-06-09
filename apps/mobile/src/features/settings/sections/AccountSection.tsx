import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function AccountSection() {
  const { handleLogout, theme, updateSectionOffset } =
    useSettingsControllerContext();

  return (
    <>
      {/* Account Section */}
      <View
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("account", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          Account
        </Text>

        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          onPress={handleLogout}
        >
          <Ionicons
            name="log-out"
            size={24}
            color="#e53935"
            style={styles.settingIcon}
          />
          <Text style={[styles.settingText, { color: "#e53935" }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
