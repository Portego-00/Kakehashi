import { SettingsRowIcon } from "../../../ui/settings/settings-row-icon";
import { SettingsSectionSurface } from "../../../ui/settings/settings-section-surface";
import { SettingsLabel } from "../../../ui/settings/settings-search";
import { SettingsIcon as Ionicons } from "../../../ui/settings/settings-icon";
import React from "react";

import {
  ActivityIndicator,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  AdvancedSetting,
  AdvancedSettingsGroup,
} from "../components/AdvancedSettings";
import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function VoiceSettingsSection() {
  const {
    autoplayLessonReadingAudio,
    autoplayVocabularyAudio,
    formatByteSize,
    formatCount,
    getVocabularyAudioVoiceLabel,
    handleClearOfflineAudioCache,
    handleOfflineVocabularyAudioToggle,
    isClearingOfflineAudioCache,
    offlineAudioCacheFileCount,
    offlineAudioCacheSizeBytes,
    offlineAudioProgress,
    offlineVocabularyAudioEnabled,
    openVocabularyAudioVoicePicker,
    setAutoplayLessonReadingAudio,
    setAutoplayVocabularyAudio,
    theme,
    updateSectionOffset,
    userData,
    vocabularyAudioVoice,
  } = useSettingsControllerContext();

  return (
    <>
      {/* Voice Settings Section */}
      <SettingsSectionSurface
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("voice", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          Japanese Voice
        </Text>

        <AdvancedSettingsGroup>
          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >

            <SettingsRowIcon setting="autoplay-vocabulary" color={theme.primary} />
            <View style={styles.settingTextContainer}>
              <SettingsLabel
                style={[styles.settingText, { color: theme.textColor }]}
              >
                Autoplay Vocabulary Audio
              </SettingsLabel>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Automatically play audio after answering vocabulary reading
                questions
              </Text>
            </View>
            <Switch
              value={autoplayVocabularyAudio}
              onValueChange={setAutoplayVocabularyAudio}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >

            <SettingsRowIcon setting="autoplay-lessons" color={theme.primary} />
            <View style={styles.settingTextContainer}>
              <SettingsLabel
                style={[styles.settingText, { color: theme.textColor }]}
              >
                Autoplay Lesson Reading Audio
              </SettingsLabel>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Automatically play vocabulary audio when opening the Reading tab
                during lessons
              </Text>
            </View>
            <Switch
              value={autoplayLessonReadingAudio}
              onValueChange={setAutoplayLessonReadingAudio}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          {/* Voice Actor Selection (show when any vocab autoplay mode is enabled) */}
          {(autoplayVocabularyAudio || autoplayLessonReadingAudio) && (
            <View
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            >

              <SettingsRowIcon setting="voice-actor" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Voice Actor
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Choose Female, Male, Random, or Both playback
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.voiceSelectionButton,
                  { borderColor: theme.border },
                ]}
                onPress={openVocabularyAudioVoicePicker}
              >
                <View style={styles.voiceSelectionButtonContent}>
                  <Text
                    style={[
                      styles.voiceSelectionText,
                      { color: theme.textColor },
                    ]}
                  >
                    {getVocabularyAudioVoiceLabel(vocabularyAudioVoice)}
                  </Text>
                  <Ionicons
                    name="chevron-down"
                    size={14}
                    color={theme.textSecondary}
                  />
                </View>
              </TouchableOpacity>
            </View>
          )}

          <AdvancedSetting>
            <View
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            >

              <SettingsRowIcon setting="offline-audio" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Offline Vocabulary Audio
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Pre-download pronunciation audio by level so replay keeps
                  working without internet. Storage use is typically 50 MB to
                  ~300 MB depending on your level.
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary, marginTop: 6 },
                  ]}
                >
                  {offlineAudioProgress.inProgress
                    ? `Downloading ${offlineAudioProgress.completed}/${offlineAudioProgress.total} clips`
                    : `Cached clips: ${formatCount(offlineAudioCacheFileCount)} (${formatByteSize(
                        offlineAudioCacheSizeBytes,
                      )})`}
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary, marginTop: 4 },
                  ]}
                >
                  {`Scope: levels 1-${Math.max(
                    1,
                    Math.floor((userData?.level ?? 1) + 1),
                  )}, both voices`}
                </Text>
              </View>
              <Switch
                value={offlineVocabularyAudioEnabled}
                onValueChange={handleOfflineVocabularyAudioToggle}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>

            {offlineVocabularyAudioEnabled && (
              <View style={styles.offlineAudioDeleteRow}>
                <TouchableOpacity
                  style={[
                    styles.offlineAudioDeleteIconButton,
                    {
                      borderColor: theme.border,
                      backgroundColor: theme.cardBackground,
                    },
                  ]}
                  onPress={handleClearOfflineAudioCache}
                  disabled={isClearingOfflineAudioCache}
                  accessibilityRole="button"
                  accessibilityLabel="Delete offline vocabulary audio cache"
                >
                  {isClearingOfflineAudioCache ? (
                    <ActivityIndicator
                      size="small"
                      color={theme.textSecondary}
                    />
                  ) : (
                    <Ionicons name="trash-outline" size={18} color="#d9534f" />
                  )}
                </TouchableOpacity>
              </View>
            )}
          </AdvancedSetting>
        </AdvancedSettingsGroup>
      </SettingsSectionSurface>
    </>
  );
}
