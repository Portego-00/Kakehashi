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

export function KanjiLearningSection() {
  const {
    groupKanjiVocabularyExamplesByReading,
    setGroupKanjiVocabularyExamplesByReading,
    setShowInlineRadicalReminders,
    setShowKanjiEtymology,
    setKanjiReadingTextToSpeechEnabled,
    setShowOnyomiInKatakana,
    setShowStrokeOrder,
    setStrokeLeniency,
    setVisuallySimilarKanjiSource,
    showInlineRadicalReminders,
    showKanjiEtymology,
    kanjiReadingTextToSpeechEnabled,
    showOnyomiInKatakana,
    showStrokeOrder,
    strokeLeniency,
    theme,
    updateSectionOffset,
    visuallySimilarKanjiSource,
  } = useSettingsControllerContext();

  return (
    <>
      {/* Kanji Learning Section */}
      <SettingsSectionSurface
        style={[
          styles.section,
          {
            backgroundColor: theme.cardBackground,
            borderColor: theme.border,
          },
        ]}
        onLayout={(event) => {
          updateSectionOffset("kanji", event.nativeEvent.layout.y);
        }}
      >
        <Text
          style={[
            styles.sectionTitle,
            { color: theme.textColor, borderBottomColor: theme.border },
          ]}
        >
          Kanji Learning
        </Text>

        <AdvancedSettingsGroup>
          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >

            <SettingsRowIcon setting="stroke-animation" color={theme.primary} />
            <View style={styles.settingTextContainer}>
              <SettingsLabel
                style={[styles.settingText, { color: theme.textColor }]}
              >
                Stroke Order Animation
              </SettingsLabel>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show animated stroke order in kanji details
              </Text>
            </View>
            <Switch
              value={showStrokeOrder}
              onValueChange={setShowStrokeOrder}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >

            <SettingsRowIcon setting="radical-reminders" color={theme.primary} />
            <View style={styles.settingTextContainer}>
              <SettingsLabel
                style={[styles.settingText, { color: theme.textColor }]}
              >
                Inline Radical Reminders
              </SettingsLabel>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show radical mnemonics and illustrations inside kanji details
              </Text>
            </View>
            <Switch
              value={showInlineRadicalReminders}
              onValueChange={setShowInlineRadicalReminders}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
              accessibilityLabel="Show inline radical reminders"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >

            <SettingsRowIcon setting="etymology" color={theme.primary} />
            <View style={styles.settingTextContainer}>
              <SettingsLabel
                style={[styles.settingText, { color: theme.textColor }]}
              >
                Kanji Etymology
              </SettingsLabel>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show character origins and structure in details and lessons
              </Text>
            </View>
            <Switch
              value={showKanjiEtymology}
              onValueChange={setShowKanjiEtymology}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
              accessibilityLabel="Show kanji etymology"
            />
          </View>

          <View
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >

            <SettingsRowIcon setting="reading-speech" color={theme.primary} />
            <View style={styles.settingTextContainer}>
              <SettingsLabel
                style={[styles.settingText, { color: theme.textColor }]}
              >
                Kanji Reading Speech
              </SettingsLabel>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Tap a kanji reading to hear it with your device&apos;s Japanese
                voice
              </Text>
            </View>
            <Switch
              value={kanjiReadingTextToSpeechEnabled}
              onValueChange={setKanjiReadingTextToSpeechEnabled}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
              accessibilityLabel="Enable kanji reading speech"
            />
          </View>

          <AdvancedSetting>
            <View
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
            >

              <SettingsRowIcon setting="stroke-strictness" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Stroke Strictness
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Tolerance for stroke accuracy
                </Text>
              </View>
              <View style={styles.batchSizeSelector}>
                <TouchableOpacity
                  style={[
                    styles.batchSizeButton,
                    { backgroundColor: theme.border },
                    strokeLeniency <= 0.8 && styles.batchSizeButtonDisabled,
                  ]}
                  onPress={() => {
                    const levels = [0.8, 1.2, 1.8, 2.5];
                    // Find closest level index for legacy values
                    const currentIdx = levels.findIndex(
                      (l, i) => strokeLeniency <= l || i === levels.length - 1,
                    );
                    if (currentIdx > 0) {
                      setStrokeLeniency(levels[currentIdx - 1]);
                    }
                  }}
                  disabled={strokeLeniency <= 0.8}
                >
                  <Ionicons
                    name="remove"
                    size={18}
                    color={
                      strokeLeniency <= 0.8
                        ? theme.textSecondary
                        : theme.textColor
                    }
                  />
                </TouchableOpacity>
                <Text
                  style={[styles.leniencyValue, { color: theme.textColor }]}
                >
                  {strokeLeniency <= 0.8
                    ? "Very Strict"
                    : strokeLeniency <= 1.2
                      ? "Strict"
                      : strokeLeniency <= 1.8
                        ? "Lenient"
                        : "Very Lenient"}
                </Text>
                <TouchableOpacity
                  style={[
                    styles.batchSizeButton,
                    { backgroundColor: theme.border },
                    strokeLeniency >= 2.5 && styles.batchSizeButtonDisabled,
                  ]}
                  onPress={() => {
                    const levels = [0.8, 1.2, 1.8, 2.5];
                    // Find closest level index for legacy values
                    const currentIdx = levels.findIndex(
                      (l, i) => strokeLeniency <= l || i === levels.length - 1,
                    );
                    if (currentIdx < levels.length - 1) {
                      setStrokeLeniency(levels[currentIdx + 1]);
                    } else if (strokeLeniency > 2.5) {
                      // Handle legacy values above max - snap to max
                      setStrokeLeniency(2.5);
                    }
                  }}
                  disabled={strokeLeniency >= 2.5}
                >
                  <Ionicons
                    name="add"
                    size={18}
                    color={
                      strokeLeniency >= 2.5
                        ? theme.textSecondary
                        : theme.textColor
                    }
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
            >

              <SettingsRowIcon setting="reading-examples" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Group Vocabulary by Reading
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Organize kanji examples under On&apos;yomi, Kun&apos;yomi, and
                  Nanori readings
                </Text>
              </View>
              <Switch
                value={groupKanjiVocabularyExamplesByReading}
                onValueChange={setGroupKanjiVocabularyExamplesByReading}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
                accessibilityLabel="Group kanji vocabulary examples by reading"
              />
            </View>

            <View
              style={[styles.settingItem, { borderBottomColor: theme.border }]}
            >
              <Text
                style={[
                  styles.settingIcon,
                  {
                    fontSize: 20,
                    fontWeight: "bold",
                    color: theme.primary,
                    width: 24,
                    textAlign: "center",
                  },
                ]}
              >
                ア
              </Text>
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Katakana Madness
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Display On&apos;yomi readings in katakana instead of hiragana
                </Text>
              </View>
              <Switch
                value={showOnyomiInKatakana}
                onValueChange={setShowOnyomiInKatakana}
                trackColor={{ false: "#767577", true: theme.primary }}
                thumbColor="#f4f3f4"
              />
            </View>

            <View
              style={[styles.settingItem, { borderBottomColor: "transparent" }]}
            >

              <SettingsRowIcon setting="similar-kanji-source" color={theme.primary} />
              <View style={styles.settingTextContainer}>
                <SettingsLabel
                  style={[styles.settingText, { color: theme.textColor }]}
                >
                  Similar Kanji Source
                </SettingsLabel>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  {visuallySimilarKanjiSource === "wanikani"
                    ? "Using WaniKani's built-in similar kanji"
                    : "Using Niai community database (more comprehensive)"}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.voiceSelectionButton,
                  { borderColor: theme.border },
                ]}
                onPress={() =>
                  setVisuallySimilarKanjiSource(
                    visuallySimilarKanjiSource === "wanikani"
                      ? "niai"
                      : "wanikani",
                  )
                }
              >
                <Text
                  style={[
                    styles.voiceSelectionText,
                    { color: theme.textColor },
                  ]}
                >
                  {visuallySimilarKanjiSource === "wanikani"
                    ? "WaniKani"
                    : "Niai"}
                </Text>
              </TouchableOpacity>
            </View>
          </AdvancedSetting>
        </AdvancedSettingsGroup>
      </SettingsSectionSurface>
    </>
  );
}
