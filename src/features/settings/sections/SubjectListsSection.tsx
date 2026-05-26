import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function SubjectListsSection() {
  const { router, theme, updateSectionOffset } = useSettingsControllerContext();

  return (
    <>
      {/* Subject Lists Section */}
      <View
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("subjectLists", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          Subject Lists
        </Text>

        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          onPress={() => router.push("/subject-lists")}
        >
          <Ionicons
            name="list"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Manage Subject Lists
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Create and manage saved subject collections for custom study
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>
      </View>
    </>
  );
}
