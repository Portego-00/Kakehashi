import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

type AnkiScope = "both" | "meaning" | "reading";

const ANKI_SCOPE_OPTIONS: { value: AnkiScope; label: string }[] = [
  { value: "both", label: "Both" },
  { value: "meaning", label: "Meaning" },
  { value: "reading", label: "Reading" },
];

export default function AnkiSettingsScreen() {
  const { theme } = useTheme();
  const {
    ankiCardModeScope,
    setAnkiCardModeScope,
    ankiGroupQuestions,
    setAnkiGroupQuestions,
    ankiHideAnswerCompletely,
    setAnkiHideAnswerCompletely,
    ankiButtonlessMode,
    setAnkiButtonlessMode,
    ankiShowReplayAudioButton,
    setAnkiShowReplayAudioButton,
    ankiShowOtherAcceptedAnswersAndUserSynonyms,
    setAnkiShowOtherAcceptedAnswersAndUserSynonyms,
    ankiShowWaniKaniGrammarTags,
    setAnkiShowWaniKaniGrammarTags,
  } = useSettingsStore();

  const handleScopeChange = (scope: AnkiScope) => {
    setAnkiCardModeScope(scope);
    if (scope !== "both" && ankiGroupQuestions) {
      setAnkiGroupQuestions(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />

      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.headerBackground,
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.headerText} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.title, { color: theme.headerText }]}>
            Anki Settings
          </Text>
          <Text style={[styles.subtitle, { color: theme.headerText }]}>
            Fine-tune reveal and answer behavior
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
      >
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Card Behavior
          </Text>

          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <Ionicons
              name="funnel-outline"
              size={20}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Anki Applies To
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Choose which review question types use Anki cards.
              </Text>
            </View>
          </View>

          <View style={styles.scopeSelector}>
            {ANKI_SCOPE_OPTIONS.map((option) => {
              const isSelected = ankiCardModeScope === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.scopeButton,
                    {
                      borderColor: theme.border,
                      backgroundColor: isSelected ? theme.primary : "transparent",
                    },
                  ]}
                  onPress={() => handleScopeChange(option.value)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.scopeButtonText,
                      { color: isSelected ? "#FFFFFF" : theme.textColor },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <Ionicons
              name="git-merge-outline"
              size={20}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Group Questions
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Show meaning and reading together in one card.
              </Text>
              {ankiCardModeScope !== "both" && (
                <Text
                  style={[
                    styles.inlineHint,
                    { color: theme.textSecondary },
                  ]}
                >
                  Only available when &quot;Both&quot; is selected.
                </Text>
              )}
            </View>
            <Switch
              value={ankiGroupQuestions}
              onValueChange={setAnkiGroupQuestions}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
              disabled={ankiCardModeScope !== "both"}
            />
          </View>

          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <Ionicons
              name="eye-off-outline"
              size={20}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Hide Answer Completely
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Off: show the answer blurred before reveal. On: hide the answer
                completely until reveal (no length hints).
              </Text>
            </View>
            <Switch
              value={ankiHideAnswerCompletely}
              onValueChange={setAnkiHideAnswerCompletely}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <Ionicons
              name="hand-left-outline"
              size={20}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Buttonless Anki Mode
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                After reveal: tap left for incorrect, tap right for correct, swipe
                up for details, and swipe down to skip.
              </Text>
            </View>
            <Switch
              value={ankiButtonlessMode}
              onValueChange={setAnkiButtonlessMode}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <Ionicons
              name="volume-high-outline"
              size={20}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Show Replay Button
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                After revealing an Anki card, show a Replay button to play
                vocabulary audio again when available.
              </Text>
            </View>
            <Switch
              value={ankiShowReplayAudioButton}
              onValueChange={setAnkiShowReplayAudioButton}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
            <Ionicons
              name="list-outline"
              size={20}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Show Other Accepted Answers
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                In Anki cards, also show non-primary accepted answers and your
                user synonyms after reveal.
              </Text>
            </View>
            <Switch
              value={ankiShowOtherAcceptedAnswersAndUserSynonyms}
              onValueChange={setAnkiShowOtherAcceptedAnswersAndUserSynonyms}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View style={[styles.settingRow, styles.settingRowLast]}>
            <Ionicons
              name="library-outline"
              size={20}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Show Part of Speech
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                In Anki cards, show WaniKani part-of-speech info (including
                transitive/intransitive, godan/ichidan/irregular, and
                na/no adjectives) when available.
              </Text>
            </View>
            <Switch
              value={ankiShowWaniKaniGrammarTags}
              onValueChange={setAnkiShowWaniKaniGrammarTags}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 6,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    paddingBottom: 28,
    gap: 14,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    paddingBottom: 12,
    overflow: "hidden",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  settingText: {
    fontSize: 15,
    fontWeight: "600",
  },
  settingSubtext: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  inlineHint: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: "500",
  },
  scopeSelector: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    marginTop: -2,
  },
  scopeButton: {
    flex: 1,
    borderRadius: 9,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  scopeButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
