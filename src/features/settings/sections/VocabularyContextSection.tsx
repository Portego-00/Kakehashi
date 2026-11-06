import { SettingsRowIcon } from "../../../ui/settings/settings-row-icon";
import { SettingsSectionSurface } from "../../../ui/settings/settings-section-surface";
import { SettingsLabel } from "../../../ui/settings/settings-search";
import { SettingsIcon as Ionicons } from "../../../ui/settings/settings-icon";
import React from "react";

import { Switch, Text, TouchableOpacity, View } from "react-native";

import {
  AdvancedSetting,
  AdvancedSettingsGroup,
} from "../components/AdvancedSettings";
import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function VocabularyContextSection() {
  const {
    hideContextSentenceTranslations,
    hideContextSentenceTranslationsCompletely,
    router,
    setHideContextSentenceTranslations,
    setHideContextSentenceTranslationsCompletely,
    setShowContextSentenceSpeedControl,
    setShowMediaContextSentences,
    setShowPatternsOfUse,
    setShowPitchAccent,
    setShowSimilarVocabulary,
    setShowSingleKanjiVocabularySimilarKanji,
    setShowVocabularyFrequency,
    setShowJLPTLevel,
    showContextSentenceSpeedControl,
    showMediaContextSentences,
    showYouGlishContext,
    setShowYouGlishContext,
    isPortegoUser,
    showPatternsOfUse,
    showPitchAccent,
    showSimilarVocabulary,
    showSingleKanjiVocabularySimilarKanji,
    showVocabularyFrequency,
    showJLPTLevel,
    theme,
    updateSectionOffset,
  } = useSettingsControllerContext();

  return (
    <>
      {/* Vocabulary Context Section */}
      <SettingsSectionSurface
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("vocabContext", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          Vocabulary Context
        </Text>

        <AdvancedSettingsGroup>
          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >

            <SettingsRowIcon setting="pitch-graph" color={theme.primary} />
            <View style={styles.settingTextContainer}>
              <SettingsLabel
                style={[styles.settingText, { color: theme.textColor }]}
              >
                Pitch Accent Visualization
              </SettingsLabel>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show high/low pitch patterns in vocabulary details and lesson
                pages
              </Text>
            </View>
            <Switch
              value={showPitchAccent}
              onValueChange={setShowPitchAccent}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >

            <SettingsRowIcon setting="hide-translation" color={theme.primary} />
            <View style={styles.settingTextContainer}>
              <SettingsLabel
                style={[styles.settingText, { color: theme.textColor }]}
              >
                Hide translations until tapped
              </SettingsLabel>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Hide English translations in vocabulary details and lessons
                until you tap to reveal
              </Text>
            </View>
            <Switch
              accessibilityLabel="Hide context sentence translations until tapped"
              value={hideContextSentenceTranslations}
              onValueChange={setHideContextSentenceTranslations}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
              disabled={hideContextSentenceTranslationsCompletely}
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: "transparent" }]}
          >

            <SettingsRowIcon setting="media-context" color={theme.primary} />
            <View style={styles.settingTextContainer}>
              <SettingsLabel
                style={[styles.settingText, { color: theme.textColor }]}
              >
                Media Context Sentences
              </SettingsLabel>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show vocabulary examples from anime, dramas, and games
              </Text>
            </View>
            <Switch
              value={showMediaContextSentences}
              onValueChange={setShowMediaContextSentences}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          {isPortegoUser ? <View style={[styles.settingItem, { borderBottomColor: "transparent" }]}>
            <SettingsRowIcon setting="media-context" color={theme.primary} />
            <View style={styles.settingTextContainer}>
              <SettingsLabel style={[styles.settingText, { color: theme.textColor }]}>YouGlish Context</SettingsLabel>
              <Text style={[styles.settingSubtext, { color: theme.textSecondary }]}>Add a YouGlish source in vocabulary Context tabs to find Japanese video examples of the current word. Loads YouGlish and YouTube when selected.</Text>
            </View>
            <Switch accessibilityLabel="YouGlish Context" value={showYouGlishContext} onValueChange={setShowYouGlishContext} trackColor={{ false: "#767577", true: theme.primary }} thumbColor="#f4f3f4" />
          </View> : null}

          <AdvancedSetting>
            <View
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            >

              <SettingsRowIcon setting="remove-translation" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Remove translations
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Show only Japanese in context sentences, media examples, and
                  patterns of use in vocabulary details and lessons. No
                  translation text or tap-to-reveal button.
                </Text>
              </View>
              <Switch
                accessibilityLabel="Remove context sentence translations"
                value={hideContextSentenceTranslationsCompletely}
                onValueChange={setHideContextSentenceTranslationsCompletely}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>
            <View
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            >

              <SettingsRowIcon setting="jlpt" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  JLPT Level
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Show estimated JLPT levels for kanji and vocabulary in
                  details, reviews, and lessons, using offline study lists
                </Text>
              </View>
              <Switch
                accessibilityLabel="Show JLPT levels"
                value={showJLPTLevel}
                onValueChange={setShowJLPTLevel}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>
            <View
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            >

              <SettingsRowIcon setting="vocab-frequency" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Vocabulary Frequency
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Show Jiten frequency ranks and enable lesson and Custom Review
                  filters. Matching vocabulary terms may be sent individually to
                  Jiten during the initial lookup, then cached locally to reduce
                  future checks.
                </Text>
              </View>
              <Switch
                value={showVocabularyFrequency}
                onValueChange={setShowVocabularyFrequency}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
                accessibilityLabel="Show vocabulary frequency ranks"
              />
            </View>
            <View
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            >

              <SettingsRowIcon setting="patterns" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Patterns of Use
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Show selectable usage patterns in vocabulary details and
                  lesson pages
                </Text>
              </View>
              <Switch
                value={showPatternsOfUse}
                onValueChange={setShowPatternsOfUse}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>
            <View
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            >

              <SettingsRowIcon setting="similar-vocab" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Similar Vocabulary
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Show vocabulary with matching readings and meanings in
                  vocabulary details
                </Text>
              </View>
              <Switch
                value={showSimilarVocabulary}
                onValueChange={setShowSimilarVocabulary}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>

            <View
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
            >

              <SettingsRowIcon setting="similar-single-kanji" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Single-Kanji Vocab Similar Kanji
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Show visually similar kanji on vocabulary details and lessons
                  when the vocabulary is exactly one kanji
                </Text>
              </View>
              <Switch
                value={showSingleKanjiVocabularySimilarKanji}
                onValueChange={setShowSingleKanjiVocabularySimilarKanji}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>
            <View
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            >

              <SettingsRowIcon setting="audio-speed" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Context Audio Speed Control
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Show per-sentence playback speed controls in vocabulary
                  context
                </Text>
              </View>
              <Switch
                value={showContextSentenceSpeedControl}
                onValueChange={setShowContextSentenceSpeedControl}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>
            {showMediaContextSentences && (
              <TouchableOpacity
                style={[
                  styles.settingItem,
                  {
                    borderColor: theme.border,
                    borderBottomWidth: 0,
                  },
                ]}
                onPress={() => router.push("/immersion-kit-settings")}
              >

                <SettingsRowIcon setting="anime-list" color={theme.primary} />
                <View style={styles.settingTextContainer}>
                  <SettingsLabel
                    style={[styles.settingText, { color: theme.textColor }]}
                  >
                    Manage Anime List
                  </SettingsLabel>
                  <Text
                    style={[
                      styles.settingSubtext,
                      { color: theme.textSecondary },
                    ]}
                  >
                    Manually select available animes
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            )}
          </AdvancedSetting>
        </AdvancedSettingsGroup>
      </SettingsSectionSurface>
    </>
  );
}
