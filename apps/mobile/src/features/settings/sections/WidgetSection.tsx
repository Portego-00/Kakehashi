import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function WidgetSection() {
  const { router, showWidgetsSection, theme, updateSectionOffset } =
    useSettingsControllerContext();

  return (
    <>
      {/* Widget Section */}
      {showWidgetsSection && (
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("widgets", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Widgets
          </Text>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            onPress={() => router.push("/widget-settings")}
          >
            <Ionicons
              name="phone-portrait"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <View style={styles.settingRow}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Home Widget
                </Text>
                <View style={styles.betaBadge}>
                  <Text style={styles.betaBadgeText}>BETA</Text>
                </View>
              </View>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Configure widget content and streak background gradient
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}
