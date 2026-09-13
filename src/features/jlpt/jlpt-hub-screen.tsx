import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuthStore } from "../../utils/store";
import { withAlpha } from "../../utils/subjectColors";
import { useTheme } from "../../utils/theme";
import {
  approximateMockQuestionCount,
  JLPT_LEVELS,
  JLPT_MOCK_STRUCTURES,
  type JlptLevel,
  type JlptQuizMode,
  type JlptSession,
} from "./domain";
import { clearNativeJlptSession, loadNativeJlptSession } from "./storage";

const LEVEL_COPY: Record<JlptLevel, { label: string; summary: string }> = {
  N5: {
    label: "Foundation",
    summary:
      "Basic words, sentence patterns, notices, and short everyday exchanges.",
  },
  N4: {
    label: "Elementary",
    summary:
      "Familiar daily situations, broader vocabulary, and connected reading.",
  },
  N3: {
    label: "Bridge",
    summary:
      "Natural everyday Japanese, longer texts, and more nuanced grammar.",
  },
  N2: {
    label: "Upper intermediate",
    summary:
      "Articles, argument structure, and varied natural-speed listening.",
  },
  N1: {
    label: "Advanced",
    summary: "Abstract reasoning, precise usage, and dense spoken information.",
  },
};

function sessionLabel(session: JlptSession) {
  if (session.mode === "mock") return "mock exam";
  if (session.mode === "weak") return "weak-area practice";
  return "quick quiz";
}

function statusLabel(session: JlptSession) {
  if (session.status === "complete") return "Results ready";
  if (session.status === "section-complete") return "Section complete";
  if (session.status === "paused") return "Paused";
  return "In progress";
}

export function JlptHubScreen() {
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const userData = useAuthStore((state) => state.userData);
  const scope = userData?.id ?? userData?.username ?? "anonymous";
  const [selectedLevel, setSelectedLevel] = useState<JlptLevel>("N5");
  const [immediateFeedback, setImmediateFeedback] = useState(true);
  const [savedSession, setSavedSession] = useState<JlptSession | null>(null);
  const compact = width < 400;

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void loadNativeJlptSession(scope).then((session) => {
        if (!active) return;
        setSavedSession(session);
        if (session) setSelectedLevel(session.level);
      });
      return () => {
        active = false;
      };
    }, [scope]),
  );

  const structure = JLPT_MOCK_STRUCTURES[selectedLevel];
  const totalMinutes = useMemo(
    () =>
      structure.sections.reduce(
        (total, section) => total + section.durationMinutes,
        0,
      ),
    [structure.sections],
  );

  const openSession = (params: {
    mode?: Exclude<JlptQuizMode, "weak">;
    resume?: "true";
  }) => {
    router.push({
      pathname: "/jlpt-session" as any,
      params: {
        ...params,
        level: selectedLevel,
        feedback: immediateFeedback ? "true" : "false",
      },
    });
  };

  const start = (mode: Exclude<JlptQuizMode, "weak">) => {
    if (savedSession && savedSession.status !== "complete") {
      Alert.alert(
        "Replace saved JLPT session?",
        "Starting a new session will replace the attempt currently saved on this device.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Start New",
            style: "destructive",
            onPress: () => openSession({ mode }),
          },
        ],
      );
      return;
    }
    openSession({ mode });
  };

  const discard = () => {
    Alert.alert(
      "Discard saved JLPT session?",
      "The answers in this attempt will be removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            void clearNativeJlptSession(scope).then(() =>
              setSavedSession(null),
            );
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.backgroundColor }]}
      edges={["top"]}
    >
      <StatusBar style={theme.statusBarStyle} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        style={styles.scroll}
        testID="jlpt-hub"
      >
        <View style={styles.navigationRow}>
          <Pressable
            accessibilityLabel="Back"
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.iconButton,
              { borderColor: theme.border, opacity: pressed ? 0.55 : 1 },
            ]}
          >
            <Ionicons name="arrow-back" size={21} color={theme.textColor} />
          </Pressable>
          <View
            style={[
              styles.researchPill,
              {
                borderColor: theme.border,
                backgroundColor: theme.cardBackground,
              },
            ]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={15}
              color={theme.primary}
            />
            <Text style={[styles.researchText, { color: theme.textSecondary }]}>
              Format researched
            </Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={[styles.eyebrow, { color: theme.primary }]}>
            JAPANESE PROFICIENCY
          </Text>
          <Text style={[styles.title, { color: theme.textColor }]}>
            JLPT Quiz
          </Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Original questions shaped around each level’s published item types,
            sections, and timing.
          </Text>
        </View>

        {savedSession ? (
          <View
            accessibilityLabel="Saved JLPT session"
            style={[
              styles.resumeCard,
              {
                backgroundColor: withAlpha(
                  theme.primary,
                  theme.isDark ? 0.12 : 0.08,
                ),
                borderColor: withAlpha(theme.primary, 0.55),
              },
            ]}
          >
            <View
              style={[styles.resumeIcon, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="time-outline" size={21} color="#fff" />
            </View>
            <View style={styles.resumeCopy}>
              <Text style={[styles.resumeTitle, { color: theme.textColor }]}>
                {savedSession.level} {sessionLabel(savedSession)}
              </Text>
              <Text style={[styles.resumeMeta, { color: theme.textSecondary }]}>
                {statusLabel(savedSession)} · {savedSession.answers.length} of{" "}
                {savedSession.sectionQuestionIds.flat().length} answered
              </Text>
            </View>
            <View style={styles.resumeActions}>
              <Pressable
                accessibilityRole="button"
                onPress={() => openSession({ resume: "true" })}
                style={({ pressed }) => [
                  styles.smallPrimaryButton,
                  {
                    backgroundColor: theme.primary,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <Text style={styles.smallPrimaryText}>
                  {savedSession.status === "complete" ? "Results" : "Resume"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={discard}
              >
                <Text
                  style={[styles.discardText, { color: theme.textSecondary }]}
                >
                  Discard
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHeading}>
          <Text style={[styles.step, { color: theme.primary }]}>01</Text>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Choose a level
          </Text>
        </View>
        <View style={[styles.levelPicker, { borderColor: theme.border }]}>
          {JLPT_LEVELS.map((level, index) => {
            const selected = selectedLevel === level;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={level}
                onPress={() => setSelectedLevel(level)}
                testID={`jlpt-level-${level}`}
                style={({ pressed }) => [
                  styles.levelOption,
                  index > 0 && {
                    borderLeftWidth: StyleSheet.hairlineWidth,
                    borderLeftColor: theme.border,
                  },
                  selected && { backgroundColor: theme.primary },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Text
                  style={[
                    styles.levelName,
                    { color: selected ? "#fff" : theme.textColor },
                  ]}
                >
                  {level}
                </Text>
                {!compact ? (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.levelLabel,
                      {
                        color: selected
                          ? "rgba(255,255,255,0.82)"
                          : theme.textSecondary,
                      },
                    ]}
                  >
                    {LEVEL_COPY[level].label}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.levelSummary}>
          <Text style={[styles.levelSummaryTitle, { color: theme.textColor }]}>
            {selectedLevel} · {LEVEL_COPY[selectedLevel].label}
          </Text>
          <Text
            style={[styles.levelSummaryText, { color: theme.textSecondary }]}
          >
            {LEVEL_COPY[selectedLevel].summary}
          </Text>
        </View>

        <View style={[styles.sectionHeading, styles.sessionHeading]}>
          <Text style={[styles.step, { color: theme.primary }]}>02</Text>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Choose a session
          </Text>
        </View>

        <View
          style={[
            styles.modeCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: withAlpha(theme.primary, 0.55),
            },
          ]}
        >
          <View style={styles.modeTopline}>
            <Ionicons name="sparkles-outline" size={18} color={theme.primary} />
            <Text style={[styles.modeKicker, { color: theme.primary }]}>
              5–10 MINUTES
            </Text>
          </View>
          <Text style={[styles.modeTitle, { color: theme.textColor }]}>
            Quick Quiz
          </Text>
          <Text
            style={[styles.modeDescription, { color: theme.textSecondary }]}
          >
            Ten randomized, unseen-first questions across kanji, vocabulary,
            grammar, reading, and listening.
          </Text>
          <View style={[styles.settingRow, { borderColor: theme.border }]}>
            <View style={styles.settingCopy}>
              <Text style={[styles.settingTitle, { color: theme.textColor }]}>
                Immediate feedback
              </Text>
              <Text
                style={[styles.settingSubtitle, { color: theme.textSecondary }]}
              >
                Show the answer and explanation after each response.
              </Text>
            </View>
            <Switch
              accessibilityLabel="Immediate feedback"
              value={immediateFeedback}
              onValueChange={setImmediateFeedback}
              trackColor={{
                false: theme.border,
                true: withAlpha(theme.primary, 0.55),
              }}
              thumbColor={immediateFeedback ? theme.primary : theme.textLight}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => start("quick")}
            testID="jlpt-start-quick"
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.76 : 1 },
            ]}
          >
            <Text style={styles.primaryButtonText}>Start quick quiz</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>

        <View
          style={[
            styles.modeCard,
            styles.mockCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.modeTopline}>
            <Ionicons name="timer-outline" size={18} color={theme.secondary} />
            <Text style={[styles.modeKicker, { color: theme.secondary }]}>
              TIMED · {totalMinutes} MINUTES
            </Text>
          </View>
          <Text style={[styles.modeTitle, { color: theme.textColor }]}>
            Representative Mock Exam
          </Text>
          <Text
            style={[styles.modeDescription, { color: theme.textSecondary }]}
          >
            About {approximateMockQuestionCount(selectedLevel)} questions in the
            published {selectedLevel} section order. Answers remain locked until
            the end.
          </Text>
          <View style={styles.timeline}>
            {structure.sections.map((section, index) => (
              <View key={section.id} style={styles.timelineRow}>
                <View
                  style={[styles.timelineNumber, { borderColor: theme.border }]}
                >
                  <Text
                    style={[
                      styles.timelineNumberText,
                      { color: theme.textColor },
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.timelineCopy}>
                  <Text
                    style={[styles.timelineTitle, { color: theme.textColor }]}
                  >
                    {section.shortTitle}
                  </Text>
                  <Text
                    style={[
                      styles.timelineTime,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {section.durationMinutes} minutes
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <View style={[styles.mockNote, { borderColor: theme.border }]}>
            <Ionicons
              name="headset-outline"
              size={16}
              color={theme.textSecondary}
            />
            <Text style={[styles.mockNoteText, { color: theme.textSecondary }]}>
              Listening plays once in mock mode. Pause/resume is a Kakehashi
              accommodation.
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => start("mock")}
            testID="jlpt-start-mock"
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.secondary, opacity: pressed ? 0.76 : 1 },
            ]}
          >
            <Text style={styles.primaryButtonText}>Start timed mock</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
        </View>

        <View style={[styles.bankNote, { borderTopColor: theme.border }]}>
          <Ionicons
            name="shuffle-outline"
            size={17}
            color={theme.textSecondary}
          />
          <Text style={[styles.bankNoteText, { color: theme.textSecondary }]}>
            Each available item type has 200 controlled renderings. New semantic
            items are prioritized before variants repeat for this account.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingBottom: 44 },
  navigationRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 52,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  researchPill: {
    minHeight: 34,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  researchText: { fontSize: 12, fontWeight: "600" },
  hero: { paddingTop: 22, paddingBottom: 26 },
  eyebrow: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  title: {
    fontSize: 42,
    lineHeight: 47,
    fontWeight: "800",
    letterSpacing: -1.4,
  },
  subtitle: { fontSize: 16, lineHeight: 23, marginTop: 10, maxWidth: 570 },
  resumeCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 28,
  },
  resumeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  resumeCopy: { flex: 1, minWidth: 0 },
  resumeTitle: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  resumeMeta: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  resumeActions: { alignItems: "center", gap: 8 },
  smallPrimaryButton: {
    minHeight: 36,
    borderRadius: 10,
    paddingHorizontal: 13,
    justifyContent: "center",
  },
  smallPrimaryText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  discardText: { fontSize: 12, fontWeight: "600" },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
    marginBottom: 13,
  },
  sessionHeading: { marginTop: 31 },
  step: { fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  sectionTitle: { fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  levelPicker: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 13,
    overflow: "hidden",
    minHeight: 66,
  },
  levelOption: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 2,
    paddingVertical: 9,
  },
  levelName: { fontSize: 20, fontWeight: "800" },
  levelLabel: { fontSize: 9, marginTop: 2, maxWidth: "96%" },
  levelSummary: { paddingTop: 12 },
  levelSummaryTitle: { fontSize: 14, fontWeight: "700" },
  levelSummaryText: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  modeCard: { borderWidth: 1, borderRadius: 18, padding: 18 },
  mockCard: { marginTop: 14 },
  modeTopline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 14,
  },
  modeKicker: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8 },
  modeTitle: {
    fontSize: 26,
    lineHeight: 31,
    fontWeight: "800",
    letterSpacing: -0.6,
  },
  modeDescription: { fontSize: 14, lineHeight: 21, marginTop: 7 },
  settingRow: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingVertical: 14,
    marginVertical: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingCopy: { flex: 1 },
  settingTitle: { fontSize: 14, fontWeight: "700" },
  settingSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  primaryButton: {
    minHeight: 52,
    borderRadius: 13,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  timeline: { gap: 10, marginVertical: 17 },
  timelineRow: { flexDirection: "row", alignItems: "center", gap: 11 },
  timelineNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineNumberText: { fontSize: 12, fontWeight: "800" },
  timelineCopy: { flex: 1 },
  timelineTitle: { fontSize: 13, fontWeight: "700" },
  timelineTime: { fontSize: 12, marginTop: 1 },
  mockNote: {
    borderTopWidth: 1,
    paddingTop: 13,
    marginBottom: 17,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  mockNoteText: { flex: 1, fontSize: 12, lineHeight: 17 },
  bankNote: {
    borderTopWidth: 1,
    marginTop: 26,
    paddingTop: 17,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  bankNoteText: { flex: 1, fontSize: 12, lineHeight: 18 },
});
