import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { Switch, Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function ReadingDefaultsSection() {
  const {
    handleBlockedFullModeSelection,
    hasStoredJpdbApiKey,
    hideVocabularyTooltipMeanings,
    hideVocabularyTooltipReadings,
    newsDefaultStudyMode,
    setHideVocabularyTooltipMeanings,
    setHideVocabularyTooltipReadings,
    setNewsDefaultStudyMode,
    setSongsLyricsDefaultStudyMode,
    songsLyricsDefaultStudyMode,
    STUDY_MODE_DEFAULT_OPTIONS,
    StyleSheet,
    theme,
    updateSectionOffset,
  } = useSettingsControllerContext();

  return (
    <>
      <View
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
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                NHK News Default View
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Pick the study mode that opens first in News articles.
              </Text>
            </View>
          </View>
          <View style={styles.playbackSelector}>
            {STUDY_MODE_DEFAULT_OPTIONS.map((option) => {
              const isBlocked = option.value === "full" && !hasStoredJpdbApiKey;

              return (
                <TouchableOpacity
                  key={`news-study-mode-${option.value}`}
                  style={[
                    styles.playbackSourceButton,
                    isBlocked ? { opacity: 0.6 } : null,
                    {
                      borderColor: theme.border,
                      backgroundColor:
                        newsDefaultStudyMode === option.value
                          ? theme.primary
                          : "transparent",
                    },
                  ]}
                  onPress={() => {
                    if (isBlocked) {
                      handleBlockedFullModeSelection("news");
                      return;
                    }
                    setNewsDefaultStudyMode(option.value);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.playbackSourceButtonText,
                      {
                        color:
                          newsDefaultStudyMode === option.value
                            ? "#fff"
                            : theme.textColor,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
          <Ionicons
            name="eye-off-outline"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Hide meaning in tooltips
            </Text>
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
          <Ionicons
            name="text-outline"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Hide reading in tooltips
            </Text>
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
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Song Lyrics Default View
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Pick the default highlight mode for lyric lines.
              </Text>
            </View>
          </View>
          <View style={styles.playbackSelector}>
            {STUDY_MODE_DEFAULT_OPTIONS.map((option) => {
              const isBlocked = option.value === "full" && !hasStoredJpdbApiKey;

              return (
                <TouchableOpacity
                  key={`lyrics-study-mode-${option.value}`}
                  style={[
                    styles.playbackSourceButton,
                    isBlocked ? { opacity: 0.6 } : null,
                    {
                      borderColor: theme.border,
                      backgroundColor:
                        songsLyricsDefaultStudyMode === option.value
                          ? theme.primary
                          : "transparent",
                    },
                  ]}
                  onPress={() => {
                    if (isBlocked) {
                      handleBlockedFullModeSelection("lyrics");
                      return;
                    }
                    setSongsLyricsDefaultStudyMode(option.value);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.playbackSourceButtonText,
                      {
                        color:
                          songsLyricsDefaultStudyMode === option.value
                            ? "#fff"
                            : theme.textColor,
                      },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </>
  );
}
