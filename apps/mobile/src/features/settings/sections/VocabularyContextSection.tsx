import React from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Switch, Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function VocabularyContextSection() {
  const {
    hideContextSentenceTranslations,
    router,
    setHideContextSentenceTranslations,
    setShowContextSentenceSpeedControl,
    setShowMediaContextSentences,
    setShowPatternsOfUse,
    setShowPitchAccent,
    setShowSimilarVocabulary,
    setShowSingleKanjiVocabularySimilarKanji,
    showContextSentenceSpeedControl,
    showMediaContextSentences,
    showPatternsOfUse,
    showPitchAccent,
    showSimilarVocabulary,
    showSingleKanjiVocabularySimilarKanji,
    theme,
    updateSectionOffset,
  } = useSettingsControllerContext();

  return (
    <>
      {/* Vocabulary Context Section */}
      <View
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

        <View
          style={[styles.settingItem, { borderBottomColor: "transparent" }]}
        >
          <Ionicons
            name="pulse"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Pitch Accent Visualization
            </Text>
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
          <MaterialCommunityIcons
            name="shape-outline"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Patterns of Use
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Show selectable usage patterns in vocabulary details and lesson
              pages
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
          <MaterialCommunityIcons
            name="compare-horizontal"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Similar Vocabulary
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Show vocabulary with matching readings and meanings in vocabulary
              details
            </Text>
          </View>
          <Switch
            value={showSimilarVocabulary}
            onValueChange={setShowSimilarVocabulary}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>

        <View style={[styles.settingItem, { borderBottomColor: theme.border }]}>
          <Ionicons
            name="git-compare-outline"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Single-Kanji Vocab Similar Kanji
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Show visually similar kanji on vocabulary details and lessons when
              the vocabulary is exactly one kanji
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
          <Ionicons
            name="eye-off"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Hide translations
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Hide English translations in vocabulary details and lessons until
              you tap to reveal
            </Text>
          </View>
          <Switch
            value={hideContextSentenceTranslations}
            onValueChange={setHideContextSentenceTranslations}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>
        <View
          style={[styles.settingItem, { borderBottomColor: "transparent" }]}
        >
          <Ionicons
            name="speedometer"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Context Audio Speed Control
            </Text>
            <Text
              style={[styles.settingSubtext, { color: theme.textSecondary }]}
            >
              Show per-sentence playback speed controls in vocabulary context
            </Text>
          </View>
          <Switch
            value={showContextSentenceSpeedControl}
            onValueChange={setShowContextSentenceSpeedControl}
            trackColor={{ false: "#767577", true: theme.primary }}
            thumbColor="#f4f3f4"
          />
        </View>
        <View
          style={[styles.settingItem, { borderBottomColor: "transparent" }]}
        >
          <Ionicons
            name="film"
            size={24}
            color={theme.primary}
            style={styles.settingIcon}
          />
          <View style={styles.settingTextContainer}>
            <Text style={[styles.settingText, { color: theme.textColor }]}>
              Media Context Sentences
            </Text>
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
            <Ionicons
              name="list"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Manage Anime List
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
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
      </View>
    </>
  );
}
