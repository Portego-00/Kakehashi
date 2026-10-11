import { SettingsSectionSurface } from "../../../ui/settings/settings-section-surface";
import { SettingsLabel } from "../../../ui/settings/settings-search";
import {
  SettingsIcon as Ionicons,
  SettingsIcon as MaterialCommunityIcons,
} from "../../../ui/settings/settings-icon";
import React from "react";
import GitHubMark from "../../../components/GitHubMark";

import { Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function SupportSection() {
  const {
    getCurrentPatchNotesVersion,
    handlePatreonPress,
    handleRateAppPress,
    lastSeenPatchNotesVersion,
    Platform,
    router,
    setShowBunproSurveyModal,
    setShowOpenSourceModal,
    showBunproSurvey,
    theme,
    updateSectionOffset,
  } = useSettingsControllerContext();

  return (
    <>
      {/* Support Section */}
      <SettingsSectionSurface
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("support", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          Support
        </Text>

        <TouchableOpacity
          style={[styles.settingItem, { borderBottomColor: theme.border }]}
          onPress={() => router.push("/issues")}
        >
          <Ionicons
            name="chat"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <SettingsLabel
              style={[styles.settingText, { color: theme.textColor }]}
            >
              Issues & Feedback
            </SettingsLabel>

            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Join the discussion, report bugs, and request features
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
          onPress={() => setShowOpenSourceModal(true)}
        >
          <View style={styles.settingIcon}>
            <GitHubMark
              size={24}
              color={theme.isDark ? "#FFFFFF" : "#24292F"}
              accessibilityLabel="GitHub"
            />
          </View>
          <View style={styles.settingTextContainer}>
            <SettingsLabel
              style={[styles.settingText, { color: theme.textColor }]}
            >
              Open Source
            </SettingsLabel>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Contribute to Kakehashi or star the repo
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
              borderBottomColor: theme.border,
            },
          ]}
          onPress={() => {
            void handleRateAppPress();
          }}
        >
          <Ionicons
            name="star"
            size={24}
            color="#FFD700"
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <SettingsLabel
              style={[styles.settingText, { color: theme.textColor }]}
            >
              Rate App
            </SettingsLabel>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Help others discover this App
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
          onPress={() => {
            void handlePatreonPress();
          }}
        >
          <MaterialCommunityIcons
            name="patreon"
            size={24}
            color={theme.textColor}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <SettingsLabel
              style={[styles.settingText, { color: theme.textColor }]}
            >
              Patreon
            </SettingsLabel>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Support the app with recurring support
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
              borderBottomColor:
                showBunproSurvey || Platform.OS === "android"
                  ? theme.border
                  : "transparent",
            },
          ]}
          onPress={() => router.push("/whats-new")}
        >
          <Ionicons
            name="sparkles"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <SettingsLabel
              style={[styles.settingText, { color: theme.textColor }]}
            >
              What&apos;s New
            </SettingsLabel>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              See the latest updates
            </Text>
          </View>
          {lastSeenPatchNotesVersion !== getCurrentPatchNotesVersion() && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>NEW</Text>
            </View>
          )}
          <Ionicons
            name="chevron-forward"
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        {showBunproSurvey && (
          <TouchableOpacity
            style={[
              styles.settingItem,
              {
                borderBottomColor:
                  Platform.OS === "android" ? theme.border : "transparent",
              },
            ]}
            onPress={() => setShowBunproSurveyModal(true)}
          >
            <Ionicons
              name="survey"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <SettingsLabel
                style={[styles.settingText, { color: theme.textColor }]}
              >
                Bunpro Survey
              </SettingsLabel>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                2 quick questions
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        )}

        {Platform.OS === "android" && (
          <TouchableOpacity
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            onPress={() => router.push("/tip-developer")}
          >
            <Ionicons
              name="gift"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <SettingsLabel
                style={[styles.settingText, { color: theme.textColor }]}
              >
                Tip Developer
              </SettingsLabel>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Support ongoing development
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        )}
      </SettingsSectionSurface>
    </>
  );
}
