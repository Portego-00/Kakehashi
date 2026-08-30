import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getAllSubjects } from "../../utils/cache";
import { fontStyles } from "../../utils/fonts";
import { getAssignmentsFromPermanentStorage } from "../../utils/permanentStorage";
import { withAlpha } from "../../utils/subjectColors";
import { useTheme } from "../../utils/theme";
import {
  answerForQuestion,
  OFFICIAL_TYPE_LABELS,
  scoreJlptSession,
  SKILL_LABELS,
  waniKaniKanjiInsight,
  type JlptPerformanceSlice,
  type JlptQuestion,
  type JlptSession,
  type JlptSkill,
} from "./domain";
import { JlptVerbalScene } from "./jlpt-verbal-scene";

function outcome(percent: number) {
  if (percent >= 85) return "Strong work on this question set.";
  if (percent >= 70) return "A solid base with a few clear gaps.";
  if (percent >= 50) return "Your next study priorities are clear.";
  return "Focus the foundation before adding more difficulty.";
}

function gradeColor(
  percent: number,
  theme: ReturnType<typeof useTheme>["theme"],
) {
  if (percent >= 80) return "#20A464";
  if (percent >= 60) return theme.accent;
  return theme.error;
}

function PerformanceRow({ slice }: { slice: JlptPerformanceSlice }) {
  const { theme } = useTheme();
  const color = gradeColor(slice.percent, theme);
  return (
    <View style={styles.performanceRow}>
      <View style={styles.performanceTop}>
        <View style={styles.performanceLabel}>
          <Text style={[styles.performanceName, { color: theme.textColor }]}>
            {slice.label}
          </Text>
          <Text
            style={[styles.performanceCount, { color: theme.textSecondary }]}
          >
            {slice.correct} of {slice.total}
          </Text>
        </View>
        <Text style={[styles.performancePercent, { color }]}>
          {slice.percent}%
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View
          style={[
            styles.trackFill,
            { width: `${slice.percent}%`, backgroundColor: color },
          ]}
        />
      </View>
    </View>
  );
}

type WaniKaniInsight = ReturnType<typeof waniKaniKanjiInsight>;

export function JlptResults({
  session,
  questions,
  onPracticeWeakAreas,
  onReturn,
}: {
  session: JlptSession;
  questions: readonly JlptQuestion[];
  onPracticeWeakAreas: (skills: JlptSkill[]) => void;
  onReturn: () => void;
}) {
  const { theme } = useTheme();
  const [openReviewId, setOpenReviewId] = useState<string | null>(null);
  const [wkInsight, setWkInsight] = useState<WaniKaniInsight | null>(null);
  const result = useMemo(
    () => scoreJlptSession(session, questions),
    [questions, session],
  );
  const questionById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );
  const questionNumberById = useMemo(
    () =>
      new Map(
        session.sectionQuestionIds.flat().map((id, index) => [id, index + 1]),
      ),
    [session.sectionQuestionIds],
  );
  const rankedTypes = useMemo(
    () =>
      [...result.byType].sort(
        (left, right) =>
          left.percent - right.percent || right.total - left.total,
      ),
    [result.byType],
  );
  const weakSkills = result.bySkill
    .filter((slice) => slice.percent < 70)
    .map((slice) => slice.id as JlptSkill);
  const practiceSkills = weakSkills.length
    ? weakSkills
    : result.weakest
      ? [result.weakest.id as JlptSkill]
      : [];
  const isMock = session.mode === "mock";

  useEffect(() => {
    let active = true;
    void Promise.all([
      getAllSubjects(),
      getAssignmentsFromPermanentStorage({ ignoreTTL: true }),
    ]).then(([subjects, assignments]) => {
      if (!active || !Array.isArray(assignments)) return;
      const guruKanjiIds = new Set(
        assignments
          .filter(
            (assignment: any) =>
              assignment?.data?.subject_type === "kanji" &&
              assignment?.data?.srs_stage >= 5,
          )
          .map((assignment: any) => assignment.data.subject_id),
      );
      const guruKanji = new Set<string>(
        subjects
          .filter((subject: any) => guruKanjiIds.has(subject.id))
          .map((subject: any) => subject?.data?.characters)
          .filter(
            (characters: unknown): characters is string =>
              typeof characters === "string",
          ),
      );
      const insight = waniKaniKanjiInsight(session, questions, guruKanji);
      setWkInsight(insight.tested > 0 ? insight : null);
    });
    return () => {
      active = false;
    };
  }, [questions, session]);

  const sampleNotice = isMock
    ? `${result.total} representative questions. This is raw accuracy—not an official JLPT score or pass prediction, because the real test uses scaled scores.`
    : `${result.total} questions are a directional sample. Use this result to guide study, not as a verdict on your JLPT level.`;
  const coverage = wkInsight?.tested
    ? Math.round((wkInsight.guru / wkInsight.tested) * 100)
    : 0;
  const skillLag =
    result.weakest?.id !== "kanji" ? result.weakest?.label : null;
  const wkInterpretation =
    coverage >= 70 && (wkInsight?.quizPercent ?? 0) >= 70 && skillLag
      ? `Your WaniKani foundation held up; ${skillLag.toLowerCase()} is the clearer next focus.`
      : coverage >= 70
        ? "Most kanji from this session are already Guru or higher in WaniKani."
        : "Some tested kanji are still ahead of your current WaniKani progress.";

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={styles.content}
      testID="jlpt-results"
    >
      <Pressable
        accessibilityRole="button"
        onPress={onReturn}
        style={styles.backButton}
      >
        <Ionicons name="arrow-back" size={17} color={theme.textSecondary} />
        <Text style={[styles.backText, { color: theme.textSecondary }]}>
          JLPT home
        </Text>
      </Pressable>

      <View style={styles.summary}>
        <View style={[styles.scoreBlock, { backgroundColor: theme.textColor }]}>
          <Text style={[styles.scorePercent, { color: theme.backgroundColor }]}>
            {result.percent}%
          </Text>
          <Text
            style={[
              styles.scoreLabel,
              { color: withAlpha(theme.backgroundColor, 0.78) },
            ]}
          >
            {isMock ? "estimated mock accuracy" : "practice accuracy"}
          </Text>
          <Text
            style={[
              styles.scoreCount,
              { color: withAlpha(theme.backgroundColor, 0.78) },
            ]}
          >
            {result.correct} of {result.total} correct
          </Text>
        </View>
        <View style={styles.summaryCopy}>
          <Text style={[styles.context, { color: theme.primary }]}>
            {session.level} ·{" "}
            {session.mode === "mock"
              ? "REPRESENTATIVE MOCK"
              : session.mode === "weak"
                ? "WEAK-AREA PRACTICE"
                : "QUICK QUIZ"}
          </Text>
          <Text style={[styles.title, { color: theme.textColor }]}>
            {isMock ? "Estimated mock performance" : "Quiz results"}
          </Text>
          <Text style={[styles.outcome, { color: theme.textSecondary }]}>
            {outcome(result.percent)}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.notice,
          {
            backgroundColor: withAlpha(
              theme.primary,
              theme.isDark ? 0.1 : 0.07,
            ),
            borderColor: withAlpha(theme.primary, 0.35),
          },
        ]}
      >
        <Ionicons
          name="information-circle-outline"
          size={19}
          color={theme.primary}
        />
        <Text style={[styles.noticeText, { color: theme.textSecondary }]}>
          {sampleNotice}
        </Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          disabled={!practiceSkills.length}
          onPress={() => onPracticeWeakAreas(practiceSkills)}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: theme.primary,
              opacity: !practiceSkills.length ? 0.45 : pressed ? 0.75 : 1,
            },
          ]}
        >
          <Ionicons name="barbell-outline" size={18} color="#fff" />
          <Text style={styles.primaryButtonText}>Practice weak areas</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={onReturn}
          style={({ pressed }) => [
            styles.secondaryButton,
            { borderColor: theme.border, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <Text
            style={[styles.secondaryButtonText, { color: theme.textColor }]}
          >
            Another test
          </Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
          What to do next
        </Text>
        <View
          style={[
            styles.priority,
            {
              borderColor: theme.border,
              backgroundColor: theme.cardBackground,
            },
          ]}
        >
          <Ionicons name="locate-outline" size={22} color={theme.error} />
          <View style={styles.priorityCopy}>
            <Text style={[styles.priorityKicker, { color: theme.error }]}>
              FIRST PRIORITY
            </Text>
            <Text style={[styles.priorityTitle, { color: theme.textColor }]}>
              {result.weakest
                ? `${result.weakest.label} has the most room to improve`
                : "Take another quiz for a clearer signal"}
            </Text>
            {result.weakest ? (
              <Text
                style={[styles.priorityText, { color: theme.textSecondary }]}
              >
                {result.weakest.correct} of {result.weakest.total} correct (
                {result.weakest.percent}%). A focused set will revisit this
                skill first.
              </Text>
            ) : null}
          </View>
        </View>
        {result.strongest && result.strongest.id !== result.weakest?.id ? (
          <View
            style={[
              styles.priority,
              {
                borderColor: theme.border,
                backgroundColor: theme.cardBackground,
              },
            ]}
          >
            <Ionicons name="trending-up-outline" size={22} color="#20A464" />
            <View style={styles.priorityCopy}>
              <Text style={[styles.priorityKicker, { color: "#20A464" }]}>
                STRONGEST AREA
              </Text>
              <Text style={[styles.priorityTitle, { color: theme.textColor }]}>
                {result.strongest.label} led this session
              </Text>
              <Text
                style={[styles.priorityText, { color: theme.textSecondary }]}
              >
                {result.strongest.correct} of {result.strongest.total} correct (
                {result.strongest.percent}%). Keep it in rotation.
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
          Skills
        </Text>
        <View
          style={[
            styles.panel,
            {
              borderColor: theme.border,
              backgroundColor: theme.cardBackground,
            },
          ]}
        >
          {result.bySkill.map((slice) => (
            <PerformanceRow key={slice.id} slice={slice} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
          JLPT scoring sections
        </Text>
        <View
          style={[
            styles.panel,
            {
              borderColor: theme.border,
              backgroundColor: theme.cardBackground,
            },
          ]}
        >
          {result.byScoringSection.map((slice) => (
            <PerformanceRow key={slice.id} slice={slice} />
          ))}
          <Text
            style={[
              styles.scaledNote,
              { color: theme.textSecondary, borderTopColor: theme.border },
            ]}
          >
            Official pass marks cannot be applied to raw accuracy because JLPT
            section scores are scaled.
          </Text>
        </View>
      </View>

      {wkInsight && wkInsight.tested > 0 ? (
        <View
          style={[
            styles.wkInsight,
            {
              borderColor: withAlpha(theme.primary, 0.45),
              backgroundColor: withAlpha(
                theme.primary,
                theme.isDark ? 0.1 : 0.06,
              ),
            },
          ]}
        >
          <Ionicons name="link-outline" size={22} color={theme.primary} />
          <View style={styles.wkInsightCopy}>
            <Text style={[styles.wkTitle, { color: theme.textColor }]}>
              WaniKani context
            </Text>
            <Text style={[styles.wkText, { color: theme.textSecondary }]}>
              {wkInterpretation}
            </Text>
            <Text style={[styles.wkStat, { color: theme.textColor }]}>
              {wkInsight.guru}/{wkInsight.tested} tested kanji are Guru+
              {wkInsight.quizPercent === null
                ? ""
                : ` · ${wkInsight.quizPercent}% on kanji questions`}
            </Text>
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
          Question types
        </Text>
        <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
          Lowest accuracy first
        </Text>
        <View
          style={[
            styles.panel,
            {
              borderColor: theme.border,
              backgroundColor: theme.cardBackground,
            },
          ]}
        >
          {rankedTypes.map((slice) => (
            <PerformanceRow key={slice.id} slice={slice} />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.reviewHeading}>
          <View style={styles.reviewHeadingCopy}>
            <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
              Missed question review
            </Text>
            <Text
              style={[styles.sectionSubtitle, { color: theme.textSecondary }]}
            >
              Compare your answer and read why the correct choice fits.
            </Text>
          </View>
          <Text style={[styles.reviewCount, { color: theme.error }]}>
            {result.missedQuestionIds.length
              ? `${result.missedQuestionIds.length} missed`
              : "No misses"}
          </Text>
        </View>

        {result.missedQuestionIds.length ? (
          result.missedQuestionIds.map((id, index) => {
            const question = questionById.get(id);
            if (!question) return null;
            const answer = answerForQuestion(session, id);
            const selected = question.options.find(
              (option) => option.id === answer?.selectedOptionId,
            );
            const correct = question.options.find(
              (option) => option.id === question.correctOptionId,
            );
            const selectedLabel = answer?.selectedOrderOptionIds
              ? answer.selectedOrderOptionIds
                  .map(
                    (optionId) =>
                      question.options.find((option) => option.id === optionId)
                        ?.label,
                  )
                  .filter(Boolean)
                  .join("　")
              : selected?.label;
            const correctLabel = question.sentenceComposition
              ? question.sentenceComposition.canonicalOrderOptionIds
                  .map(
                    (optionId) =>
                      question.options.find((option) => option.id === optionId)
                        ?.label,
                  )
                  .filter(Boolean)
                  .join("　")
              : correct?.label;
            const open =
              openReviewId === id || (openReviewId === null && index === 0);
            return (
              <View
                key={id}
                style={[
                  styles.reviewCard,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.cardBackground,
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: open }}
                  onPress={() => setOpenReviewId(open ? "" : id)}
                  style={styles.reviewSummary}
                >
                  <View style={styles.reviewSummaryCopy}>
                    <Text style={[styles.reviewNumber, { color: theme.error }]}>
                      QUESTION {questionNumberById.get(id) ?? index + 1}
                    </Text>
                    <Text
                      numberOfLines={open ? undefined : 2}
                      style={[
                        styles.reviewStem,
                        fontStyles.japaneseBold,
                        { color: theme.textColor },
                      ]}
                    >
                      {question.stem}
                    </Text>
                    <Text
                      style={[
                        styles.reviewMeta,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {SKILL_LABELS[question.skill]} ·{" "}
                      {OFFICIAL_TYPE_LABELS[question.officialType]}
                    </Text>
                  </View>
                  <Ionicons
                    name={open ? "chevron-up" : "chevron-down"}
                    size={19}
                    color={theme.textSecondary}
                  />
                </Pressable>
                {open ? (
                  <View
                    style={[
                      styles.reviewBody,
                      { borderTopColor: theme.border },
                    ]}
                  >
                    {question.passage ? (
                      <View
                        style={[
                          styles.reviewPassage,
                          { backgroundColor: theme.backgroundColor },
                        ]}
                      >
                        {question.passage.title ? (
                          <Text
                            style={[
                              styles.reviewPassageTitle,
                              { color: theme.textColor },
                            ]}
                          >
                            {question.passage.title}
                          </Text>
                        ) : null}
                        <Text
                          selectable
                          style={[
                            styles.reviewJapanese,
                            fontStyles.japaneseText,
                            { color: theme.textColor },
                          ]}
                        >
                          {question.passage.body}
                        </Text>
                      </View>
                    ) : null}
                    {question.listening?.verbalScene ? (
                      <JlptVerbalScene scene={question.listening.verbalScene} />
                    ) : null}
                    {question.listening ? (
                      <View
                        style={[
                          styles.transcript,
                          { borderColor: theme.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.answerLabel,
                            { color: theme.textSecondary },
                          ]}
                        >
                          LISTENING TRANSCRIPT
                        </Text>
                        <Text
                          selectable
                          style={[
                            styles.reviewJapanese,
                            fontStyles.japaneseText,
                            { color: theme.textColor },
                          ]}
                        >
                          {question.listening.script}
                        </Text>
                      </View>
                    ) : null}
                    <View style={styles.answerComparison}>
                      <View
                        style={[
                          styles.answerBox,
                          {
                            borderColor: withAlpha(theme.error, 0.45),
                            backgroundColor: withAlpha(theme.error, 0.07),
                          },
                        ]}
                      >
                        <Text
                          style={[styles.answerLabel, { color: theme.error }]}
                        >
                          YOUR ANSWER
                        </Text>
                        <Text
                          selectable
                          style={[
                            styles.answerValue,
                            fontStyles.japaneseBold,
                            { color: theme.textColor },
                          ]}
                        >
                          {selectedLabel || "No answer"}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.answerBox,
                          {
                            borderColor: withAlpha("#20A464", 0.45),
                            backgroundColor: withAlpha("#20A464", 0.07),
                          },
                        ]}
                      >
                        <Text
                          style={[styles.answerLabel, { color: "#20A464" }]}
                        >
                          CORRECT ANSWER
                        </Text>
                        <Text
                          selectable
                          style={[
                            styles.answerValue,
                            fontStyles.japaneseBold,
                            { color: theme.textColor },
                          ]}
                        >
                          {correctLabel}
                        </Text>
                      </View>
                    </View>
                    <View
                      style={[
                        styles.explanation,
                        { borderLeftColor: theme.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.explanationTitle,
                          { color: theme.textColor },
                        ]}
                      >
                        Why this is correct
                      </Text>
                      <Text
                        style={[
                          styles.explanationText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {question.explanation}
                      </Text>
                    </View>
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <View
            style={[
              styles.perfect,
              {
                borderColor: withAlpha("#20A464", 0.45),
                backgroundColor: withAlpha("#20A464", 0.07),
              },
            ]}
          >
            <Ionicons name="checkmark-circle" size={24} color="#20A464" />
            <Text style={[styles.perfectText, { color: theme.textColor }]}>
              Every answer was correct.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 52 },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  backText: { fontSize: 13, fontWeight: "700" },
  summary: { marginTop: 14, gap: 20 },
  scoreBlock: {
    borderRadius: 18,
    padding: 22,
    minHeight: 170,
    justifyContent: "flex-end",
  },
  scorePercent: {
    fontSize: 60,
    lineHeight: 65,
    fontWeight: "800",
    letterSpacing: -2.5,
  },
  scoreLabel: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  scoreCount: { fontSize: 13, marginTop: 8 },
  summaryCopy: { gap: 6 },
  context: { fontSize: 12, fontWeight: "800", letterSpacing: 0.9 },
  title: {
    fontSize: 31,
    lineHeight: 36,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  outcome: { fontSize: 17, lineHeight: 24 },
  notice: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
  },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  actionRow: { gap: 10, marginTop: 16 },
  primaryButton: {
    minHeight: 52,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 16,
  },
  primaryButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonText: { fontSize: 14, fontWeight: "700" },
  section: { marginTop: 30 },
  sectionTitle: {
    fontSize: 22,
    lineHeight: 27,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  sectionSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  priority: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 15,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 11,
  },
  priorityCopy: { flex: 1 },
  priorityKicker: { fontSize: 10, fontWeight: "800", letterSpacing: 0.9 },
  priorityTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
    marginTop: 3,
  },
  priorityText: { fontSize: 12, lineHeight: 18, marginTop: 4 },
  panel: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 15,
    gap: 16,
    marginTop: 11,
  },
  performanceRow: { gap: 8 },
  performanceTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  performanceLabel: { flex: 1 },
  performanceName: { fontSize: 14, fontWeight: "700" },
  performanceCount: { fontSize: 11, marginTop: 2 },
  performancePercent: { fontSize: 16, fontWeight: "800" },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  trackFill: { height: "100%", borderRadius: 3 },
  scaledNote: {
    borderTopWidth: 1,
    paddingTop: 13,
    fontSize: 11,
    lineHeight: 17,
  },
  wkInsight: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 15,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginTop: 28,
  },
  wkInsightCopy: { flex: 1 },
  wkTitle: { fontSize: 15, fontWeight: "800" },
  wkText: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  wkStat: { fontSize: 12, lineHeight: 18, fontWeight: "700", marginTop: 7 },
  reviewHeading: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  reviewHeadingCopy: { flex: 1 },
  reviewCount: { fontSize: 12, fontWeight: "800", marginTop: 5 },
  reviewCard: {
    borderWidth: 1,
    borderRadius: 15,
    overflow: "hidden",
    marginTop: 11,
  },
  reviewSummary: {
    minHeight: 74,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  reviewSummaryCopy: { flex: 1 },
  reviewNumber: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  reviewStem: { fontSize: 16, lineHeight: 24, fontWeight: "700", marginTop: 3 },
  reviewMeta: { fontSize: 11, marginTop: 3 },
  reviewBody: { borderTopWidth: 1, padding: 14, gap: 12 },
  reviewPassage: { borderRadius: 11, padding: 13 },
  reviewPassageTitle: { fontSize: 14, fontWeight: "800", marginBottom: 6 },
  reviewJapanese: { fontSize: 16, lineHeight: 27 },
  transcript: { borderWidth: 1, borderRadius: 11, padding: 13, gap: 5 },
  answerComparison: { gap: 9 },
  answerBox: { borderWidth: 1, borderRadius: 11, padding: 12 },
  answerLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.7 },
  answerValue: { fontSize: 17, lineHeight: 25, marginTop: 4 },
  explanation: { borderLeftWidth: 3, paddingLeft: 12 },
  explanationTitle: { fontSize: 13, fontWeight: "800" },
  explanationText: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  perfect: {
    borderWidth: 1,
    borderRadius: 15,
    minHeight: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 11,
  },
  perfectText: { fontSize: 15, fontWeight: "700" },
});
