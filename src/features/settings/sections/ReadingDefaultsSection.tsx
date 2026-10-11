import { SettingsRowIcon } from "../../../ui/settings/settings-row-icon";
import { SettingsSectionSurface } from "../../../ui/settings/settings-section-surface";
import { SettingsLabel } from "../../../ui/settings/settings-search";
import { SettingsChoiceCards } from "../../../ui/settings/settings-choice-cards";
import { SettingsIcon as Ionicons } from "../../../ui/settings/settings-icon";
import React from "react";

import { Switch, Text, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function ReadingDefaultsSection() {
  const {
    handleBlockedFullModeSelection,
    hasStoredJpdbApiKey,
    hideNewsFuriganaByDefault,
    hideVocabularyTooltipMeanings,
    hideVocabularyTooltipReadings,
    newsDefaultStudyMode,
    setHideNewsFuriganaByDefault,
    setHideVocabularyTooltipMeanings,
    setHideVocabularyTooltipReadings,
    setNewsDefaultStudyMode,
    setSongsLyricsDefaultStudyMode,
    songsLyricsDefaultStudyMode,
    SONG_LYRICS_STUDY_MODE_DEFAULT_OPTIONS,
    STUDY_MODE_DEFAULT_OPTIONS,
    StyleSheet,
    theme,
    updateSectionOffset,
  } = useSettingsControllerContext();

  return (
    <>
      <SettingsSectionSurface
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("readingDefaults", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          Reading Defaults
        </Text>

        <View
          style={[
            styles.settingItemColumn,
            {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.border,
            },
          ]}
        >
          <View style={[styles.settingRow, { marginBottom: 8 }]}>
            <Ionicons
              name="newspaper-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <SettingsLabel
                style={[styles.settingText, { color: theme.textColor }]}
              >
                NHK News Default View
              </SettingsLabel>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Pick the study mode that opens first in News articles.
              </Text>
            </View>
          </View>
          <SettingsChoiceCards
            compact
            label="News study mode"
            value={newsDefaultStudyMode}
            theme={theme}
            options={STUDY_MODE_DEFAULT_OPTIONS.map((option) => ({
              ...option,
              description:
                option.value === "full" && !hasStoredJpdbApiKey
                  ? "Connect JPDB"
                  : undefined,
              art: `news-${option.value}`,

            }))}
            onChange={(value) => {
              if (value === "full" && !hasStoredJpdbApiKey) {
                handleBlockedFullModeSelection("news");
                return;
              }
              setNewsDefaultStudyMode(value);
            }}
          />
        </View>

        <View
          style={[
            styles.settingItem,
            {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.border,
            },
          ]}
        >

          <SettingsRowIcon setting="furigana" color={theme.primary} />
          <View style={styles.settingTextContainer}>
            <SettingsLabel
              style={[styles.settingText, { color: theme.textColor }]}
            >
              Hide Furigana by Default
            </SettingsLabel>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Start News articles without furigana when No Study Mode is
              selected.
            </Text>
          </View>
          <Switch
            value={hideNewsFuriganaByDefault}
            onValueChange={setHideNewsFuriganaByDefault}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>

        <View
          style={[
            styles.settingItem,
            {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.border,
            },
          ]}
        >

          <SettingsRowIcon setting="hide-tooltip-meaning" color={theme.primary} />
          <View style={styles.settingTextContainer}>
            <SettingsLabel
              style={[styles.settingText, { color: theme.textColor }]}
            >
              Hide meaning in tooltips
            </SettingsLabel>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Tap the meaning row in reader vocabulary tooltips to reveal it.
            </Text>
          </View>
          <Switch
            value={hideVocabularyTooltipMeanings}
            onValueChange={setHideVocabularyTooltipMeanings}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>

        <View
          style={[
            styles.settingItem,
            {
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderBottomColor: theme.border,
            },
          ]}
        >

          <SettingsRowIcon setting="hide-tooltip-reading" color={theme.primary} />
          <View style={styles.settingTextContainer}>
            <SettingsLabel
              style={[styles.settingText, { color: theme.textColor }]}
            >
              Hide reading in tooltips
            </SettingsLabel>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Tap the reading row in reader vocabulary tooltips to reveal it.
            </Text>
          </View>
          <Switch
            value={hideVocabularyTooltipReadings}
            onValueChange={setHideVocabularyTooltipReadings}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>

        <View
          style={[
            styles.settingItemColumn,
            { borderBottomColor: "transparent" },
          ]}
        >
          <View style={[styles.settingRow, { marginBottom: 8 }]}>
            <Ionicons
              name="musical-notes-outline"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <SettingsLabel
                style={[styles.settingText, { color: theme.textColor }]}
              >
                Song Lyrics Default View
              </SettingsLabel>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Pick the default study mode for lyric lines.
              </Text>
            </View>
          </View>
          <SettingsChoiceCards
            compact
            label="Song lyrics study mode"
            value={songsLyricsDefaultStudyMode}
            theme={theme}
            options={SONG_LYRICS_STUDY_MODE_DEFAULT_OPTIONS.map((option) => ({
              ...option,
              description:
                option.value === "full" && !hasStoredJpdbApiKey
                  ? "Connect JPDB"
                  : undefined,
              art: `lyrics-${option.value}`,

            }))}
            onChange={(value) => {
              if (value === "full" && !hasStoredJpdbApiKey) {
                handleBlockedFullModeSelection("lyrics");
                return;
              }
              setSongsLyricsDefaultStudyMode(value);
            }}
          />
        </View>
      </SettingsSectionSurface>
    </>
  );
}
