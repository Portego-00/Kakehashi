import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function ApiDebugSection() {
  const {
    canAccessApiDebugTools,
    handleClearApiDebug,
    handleClearApiTimeline,
    handleDevClearAndLogout,
    handleExportApiTimeline,
    handleShowApiDetails,
    handleShowApiSummary,
    handleShowApiTimelineSummary,
    theme,
    updateSectionOffset,
  } = useSettingsControllerContext();

  return (
    <>
      {/* API Debug Section - Dev and Portego */}
      {canAccessApiDebugTools && (
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("apiDebug", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            API Debug Tools
          </Text>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={handleShowApiTimelineSummary}
          >
            <Ionicons
              name="time"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Show API Timeline Summary
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Print request timeline stats with slowest calls
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={handleExportApiTimeline}
          >
            <Ionicons
              name="download-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Export API Timeline JSON
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Export URL, params, response preview, and timing per call
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={handleShowApiSummary}
          >
            <Ionicons
              name="bar-chart"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Show API Summary
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Print API call statistics to console
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={handleShowApiDetails}
          >
            <Ionicons
              name="list"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Show API Details
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Print detailed call log with timestamps and payloads
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
            onPress={handleClearApiTimeline}
          >
            <Ionicons
              name="trash-outline"
              size={24}
              color="#ff9500"
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Clear API Timeline
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Remove captured request timeline entries only
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.settingItem,
              {
                borderBottomColor: __DEV__ ? theme.border : "transparent",
              },
            ]}
            onPress={handleClearApiDebug}
          >
            <Ionicons
              name="trash-bin"
              size={24}
              color="#ff9500"
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Clear API Debug History
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Reset API call history and in-memory cache
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>

          {__DEV__ && (
            <TouchableOpacity
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
              onPress={handleDevClearAndLogout}
            >
              <Ionicons
                name="bug"
                size={24}
                color="#ff3b30"
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: "#ff3b30" }]}>
                  Clear All Data & Logout
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Completely reset app to fresh state (for debugging first-time
                  issues)
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
      )}
    </>
  );
}
