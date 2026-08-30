import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useActivityTracking } from "../../hooks/useActivityTracking";
import { azureSpeechService } from "../../utils/azureSpeech";
import { fontStyles } from "../../utils/fonts";
import * as Haptics from "../../utils/haptics";
import { useAuthStore } from "../../utils/store";
import { withAlpha } from "../../utils/subjectColors";
import { useTheme } from "../../utils/theme";
import {
  advanceJlptSession,
  answerCurrentJlptQuestion,
  answerForQuestion,
  createJlptSession,
  currentJlptQuestionId,
  expireJlptSection,
  jlptListeningPlaybackScript,
  JLPT_LEVELS,
  JLPT_MOCK_STRUCTURES,
  loadJlptQuestionBank,
  OFFICIAL_TYPE_LABELS,
  pauseJlptSession,
  recordJlptListeningPlay,
  releaseJlptListeningPlay,
  remainingSectionSeconds,
  resumeJlptSession,
  SKILL_LABELS,
  startNextJlptSection,
  type JlptLevel,
  type JlptQuestion,
  type JlptQuizMode,
  type JlptSession,
  type JlptSkill,
} from "./domain";
import { InspectableJapaneseText } from "./inspectable-japanese-text";
import { JlptResults } from "./jlpt-results";
import { JlptVerbalScene } from "./jlpt-verbal-scene";
import {
  clearNativeJlptSession,
  loadNativeJlptHistory,
  loadNativeJlptSession,
  rememberNativeJlptSelection,
  saveNativeJlptSession,
} from "./storage";

type AudioState = "idle" | "loading" | "playing" | "error";

function isJlptLevel(value: unknown): value is JlptLevel {
  return typeof value === "string" && JLPT_LEVELS.includes(value as JlptLevel);
}

function formatTimer(seconds: number | null) {
  if (seconds === null) return "Untimed";
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export const listeningPlaybackScript = jlptListeningPlaybackScript;

function LoadingScreen({ message }: { message: string }) {
  const { theme } = useTheme();
  return (
    <SafeAreaView
      style={[styles.centered, { backgroundColor: theme.backgroundColor }]}
    >
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.loadingTitle, { color: theme.textColor }]}>
        {message}
      </Text>
      <Text style={[styles.loadingDetail, { color: theme.textSecondary }]}>
        Preparing the level-specific question bank…
      </Text>
    </SafeAreaView>
  );
}

export function JlptSessionScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    level?: string;
    mode?: string;
    feedback?: string;
    resume?: string;
    weakSkills?: string;
  }>();
  const userData = useAuthStore((state) => state.userData);
  const scope = userData?.id ?? userData?.username ?? "anonymous";
  const [session, setSession] = useState<JlptSession | null>(null);
  const sessionRef = useRef<JlptSession | null>(null);
  const [questions, setQuestions] = useState<readonly JlptQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selection, setSelection] = useState("");
  const [compositionOrder, setCompositionOrder] = useState<string[]>([]);
  const [nowMs, setNowMs] = useState(Date.now());
  const [audioState, setAudioState] = useState<AudioState>("idle");
  const initialized = useRef(false);

  useActivityTracking("jlpt", {
    enabled: Boolean(session && session.status !== "complete"),
  });

  const persistSession = useCallback(
    (next: JlptSession) => {
      sessionRef.current = next;
      setSession(next);
      void saveNativeJlptSession(scope, next).catch(() => {
        setError("Progress could not be saved on this device.");
      });
    },
    [scope],
  );

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    let active = true;

    const initialize = async () => {
      try {
        if (params.resume === "true") {
          const saved = await loadNativeJlptSession(scope);
          if (!saved) throw new Error("No saved session");
          const bank = await loadJlptQuestionBank(saved.level);
          let next = saved;
          if (next.status === "paused") next = resumeJlptSession(next);
          if (
            next.status === "active" &&
            next.mode === "mock" &&
            remainingSectionSeconds(next) === 0
          ) {
            next = expireJlptSection(next);
          }
          if (!active) return;
          setQuestions(bank);
          persistSession(next);
          return;
        }

        const level = isJlptLevel(params.level) ? params.level : "N5";
        const mode: JlptQuizMode =
          params.mode === "mock"
            ? "mock"
            : params.mode === "weak"
              ? "weak"
              : "quick";
        const bank = await loadJlptQuestionBank(level);
        const history = await loadNativeJlptHistory(scope, level);
        const weakSkills = (params.weakSkills ?? "")
          .split(",")
          .filter((skill): skill is JlptSkill =>
            ["kanji", "vocabulary", "grammar", "reading", "listening"].includes(
              skill,
            ),
          );
        const next = createJlptSession({
          level,
          mode,
          questions: bank,
          immediateFeedback: params.feedback !== "false",
          weakSkills,
          excludedQuestionIds: history.questionIds,
          excludedSemanticKeys: history.semanticKeys,
        });
        if (!active) return;
        setQuestions(bank);
        persistSession(next);
      } catch {
        if (active)
          setError(
            params.resume === "true"
              ? "This saved JLPT session could not be reopened."
              : "This JLPT question bank could not be prepared.",
          );
      } finally {
        if (active) setLoading(false);
      }
    };

    void initialize();
    return () => {
      active = false;
    };
  }, [
    params.feedback,
    params.level,
    params.mode,
    params.resume,
    params.weakSkills,
    persistSession,
    scope,
  ]);

  const questionById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );
  const questionId = session ? currentJlptQuestionId(session) : null;
  const question = questionId ? questionById.get(questionId) : undefined;
  const storedAnswer =
    session && question ? answerForQuestion(session, question.id) : undefined;
  const compositionQuestion = Boolean(question?.sentenceComposition);
  const selectedOrder =
    storedAnswer?.selectedOrderOptionIds ?? compositionOrder;
  const selectedOptionId =
    compositionQuestion && question?.sentenceComposition
      ? (selectedOrder[question.sentenceComposition.starredPosition] ?? "")
      : (storedAnswer?.selectedOptionId ?? selection);

  useEffect(() => {
    setSelection("");
    setCompositionOrder([]);
    setAudioState("idle");
    void azureSpeechService.stop();
  }, [questionId, session?.id]);

  useEffect(
    () => () => {
      void azureSpeechService.stop();
    },
    [],
  );

  useEffect(() => {
    if (session?.mode !== "mock" || session.status !== "active") return;
    const update = () => {
      const current = sessionRef.current;
      if (!current || current.status !== "active" || current.mode !== "mock")
        return;
      const now = new Date();
      const remaining = remainingSectionSeconds(current, now);
      setNowMs(now.getTime());
      if (remaining === 0) {
        void azureSpeechService.stop();
        persistSession(expireJlptSection(current, now));
      }
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [persistSession, session?.mode, session?.status]);

  const exitSession = useCallback(() => {
    const current = sessionRef.current;
    if (!current || current.status === "complete") {
      router.replace("/jlpt" as any);
      return;
    }
    Alert.alert(
      "Leave JLPT session?",
      "You can save your place or discard this attempt.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue Later",
          onPress: () => {
            const next =
              current.status === "active" ? pauseJlptSession(current) : current;
            persistSession(next);
            void azureSpeechService.stop();
            router.replace("/jlpt" as any);
          },
        },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => {
            void clearNativeJlptSession(scope);
            void azureSpeechService.stop();
            router.replace("/jlpt" as any);
          },
        },
      ],
    );
  }, [persistSession, scope]);

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          exitSession();
          return true;
        },
      );
      return () => subscription.remove();
    }, [exitSession]),
  );

  const chooseOption = (optionId: string) => {
    if (!session || !question || storedAnswer || session.status !== "active")
      return;
    void Haptics.selectionAsync();
    if (compositionQuestion) {
      setCompositionOrder((current) =>
        current.includes(optionId)
          ? current.filter((id) => id !== optionId)
          : [...current, optionId],
      );
    } else {
      setSelection(optionId);
    }
  };

  const submitAnswer = () => {
    if (!session || !question || storedAnswer || !selectedOptionId) return;
    if (compositionQuestion && selectedOrder.length !== question.options.length)
      return;
    const next = answerCurrentJlptQuestion(
      session,
      question,
      selectedOptionId,
      new Date(),
      compositionQuestion ? selectedOrder : undefined,
    );
    if (next === session) return;
    const answer = answerForQuestion(next, question.id);
    void Haptics.notificationAsync(
      answer?.correct
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
    void rememberNativeJlptSelection(scope, session.level, [question]).catch(
      () => undefined,
    );
    persistSession(next);
  };

  const continueSession = () => {
    const current = sessionRef.current;
    if (!current || !storedAnswer) return;
    persistSession(advanceJlptSession(current));
  };

  const playListening = () => {
    const current = sessionRef.current;
    if (
      !current ||
      !question?.listening ||
      current.status !== "active" ||
      audioState === "loading" ||
      audioState === "playing"
    )
      return;
    const allowed = current.mode === "mock" ? 1 : question.listening.maxPlays;
    const used = current.listeningPlays[question.id] ?? 0;
    if (used >= allowed) return;
    const next = recordJlptListeningPlay(current, question);
    persistSession(next);
    setAudioState("loading");
    void azureSpeechService.speak(
      listeningPlaybackScript(question),
      () => setAudioState("playing"),
      () => setAudioState("idle"),
      () => {
        setAudioState("error");
        const latest = sessionRef.current;
        if (!latest) return;
        const released = releaseJlptListeningPlay(latest, question.id);
        if (released !== latest) persistSession(released);
      },
      { speedMultiplier: question.listening.rate },
    );
  };

  const beginWeakPractice = async (skills: JlptSkill[]) => {
    if (!session) return;
    setLoading(true);
    try {
      const bank = questions.length
        ? questions
        : await loadJlptQuestionBank(session.level);
      const history = await loadNativeJlptHistory(scope, session.level);
      const next = createJlptSession({
        level: session.level,
        mode: "weak",
        questions: bank,
        weakSkills: skills,
        immediateFeedback: true,
        excludedQuestionIds: history.questionIds,
        excludedSemanticKeys: history.semanticKeys,
      });
      setQuestions(bank);
      persistSession(next);
    } catch {
      Alert.alert("Couldn’t start practice", "Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingScreen message="Preparing your JLPT session" />;
  if (error || !session || !questions.length) {
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: theme.backgroundColor }]}
      >
        <Ionicons name="alert-circle-outline" size={32} color={theme.error} />
        <Text style={[styles.loadingTitle, { color: theme.textColor }]}>
          This quiz could not continue
        </Text>
        <Text style={[styles.loadingDetail, { color: theme.textSecondary }]}>
          {error || "The saved question is no longer available."}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace("/jlpt" as any)}
          style={[styles.errorButton, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.primaryButtonText}>Return to JLPT</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (session.status === "complete") {
    return (
      <SafeAreaView
        style={[styles.safeArea, { backgroundColor: theme.backgroundColor }]}
        edges={["top"]}
      >
        <StatusBar style={theme.statusBarStyle} />
        <JlptResults
          session={session}
          questions={questions}
          onPracticeWeakAreas={(skills) => void beginWeakPractice(skills)}
          onReturn={() => router.replace("/jlpt" as any)}
        />
      </SafeAreaView>
    );
  }

  const structure = JLPT_MOCK_STRUCTURES[session.level];
  const section = structure.sections[session.currentSectionIndex];
  if (session.status === "section-complete") {
    const nextSection = structure.sections[session.currentSectionIndex + 1];
    return (
      <SafeAreaView
        style={[styles.centered, { backgroundColor: theme.backgroundColor }]}
      >
        <View
          style={[
            styles.completeIcon,
            { backgroundColor: withAlpha(theme.primary, 0.12) },
          ]}
        >
          <Ionicons
            name="lock-closed-outline"
            size={28}
            color={theme.primary}
          />
        </View>
        <Text style={[styles.completeKicker, { color: theme.primary }]}>
          {session.level} REPRESENTATIVE MOCK
        </Text>
        <Text style={[styles.completeTitle, { color: theme.textColor }]}>
          {section?.shortTitle ?? "Section"} complete
        </Text>
        <Text
          style={[styles.completeDescription, { color: theme.textSecondary }]}
        >
          Your answers are locked. Correct answers remain hidden until every
          timed section is complete.
        </Text>
        {nextSection ? (
          <View
            style={[
              styles.nextSectionCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.nextLabel, { color: theme.textSecondary }]}>
              UP NEXT
            </Text>
            <Text style={[styles.nextTitle, { color: theme.textColor }]}>
              {nextSection.title}
            </Text>
            <Text style={[styles.nextTime, { color: theme.textSecondary }]}>
              {nextSection.durationMinutes} minutes · timer begins when you
              continue
            </Text>
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => persistSession(startNextJlptSection(session))}
          style={[styles.wideButton, { backgroundColor: theme.primary }]}
        >
          <Text style={styles.primaryButtonText}>
            Begin {nextSection?.shortTitle ?? "next section"}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={exitSession}
          style={styles.textButton}
        >
          <Text
            style={[styles.textButtonLabel, { color: theme.textSecondary }]}
          >
            Continue later
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (!question || !section)
    return <LoadingScreen message="Loading question" />;

  const questionIds =
    session.sectionQuestionIds[session.currentSectionIndex] ?? [];
  const allQuestionIds = session.sectionQuestionIds.flat();
  const answeredCount = session.answers.filter((answer) =>
    allQuestionIds.includes(answer.questionId),
  ).length;
  const progress = allQuestionIds.length
    ? (answeredCount / allQuestionIds.length) * 100
    : 0;
  const seconds = remainingSectionSeconds(session, new Date(nowMs));
  const canReveal = Boolean(
    storedAnswer && session.mode !== "mock" && session.immediateFeedback,
  );
  const allowedPlays = question.listening
    ? session.mode === "mock"
      ? 1
      : question.listening.maxPlays
    : 0;
  const usedPlays = session.listeningPlays[question.id] ?? 0;
  const advanceQuestionIsAudioOnly =
    session.mode === "mock" &&
    (question.officialType === "listening-task" ||
      question.officialType === "listening-key-points");
  const spokenQuestionOnly =
    question.officialType === "listening-outline" ||
    question.officialType === "listening-integrated";
  const verbalExpression = question.officialType === "listening-verbal";

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: theme.backgroundColor }]}
      edges={["top", "bottom"]}
    >
      <StatusBar style={theme.statusBarStyle} />
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.headerTop}>
          <Pressable
            accessibilityLabel="Pause and exit"
            accessibilityRole="button"
            hitSlop={9}
            onPress={exitSession}
            style={[styles.closeButton, { borderColor: theme.border }]}
          >
            <Ionicons name="close" size={20} color={theme.textColor} />
          </Pressable>
          <View style={styles.headerIdentity}>
            <Text style={[styles.headerTitle, { color: theme.textColor }]}>
              {session.level} ·{" "}
              {session.mode === "mock"
                ? "Mock exam"
                : session.mode === "weak"
                  ? "Weak-area practice"
                  : "Quick quiz"}
            </Text>
            <Text style={[styles.headerMeta, { color: theme.textSecondary }]}>
              {session.mode === "mock"
                ? `${section.shortTitle} · Section ${session.currentSectionIndex + 1}/${structure.sections.length}`
                : "Mixed skills"}
            </Text>
          </View>
          {session.mode === "mock" ? (
            <View
              style={[
                styles.timer,
                seconds !== null && seconds <= 300
                  ? { backgroundColor: withAlpha(theme.error, 0.12) }
                  : { backgroundColor: theme.cardBackground },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={15}
                color={
                  seconds !== null && seconds <= 300
                    ? theme.error
                    : theme.textSecondary
                }
              />
              <Text
                style={[
                  styles.timerText,
                  {
                    color:
                      seconds !== null && seconds <= 300
                        ? theme.error
                        : theme.textColor,
                  },
                ]}
              >
                {formatTimer(seconds)}
              </Text>
            </View>
          ) : (
            <Text
              style={[styles.headerQuestion, { color: theme.textSecondary }]}
            >
              {session.currentQuestionIndex + 1}/{questionIds.length}
            </Text>
          )}
        </View>
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${progress}%`, backgroundColor: theme.primary },
            ]}
          />
        </View>
      </View>

      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.questionContent}
        keyboardShouldPersistTaps="handled"
        testID="jlpt-question-scroll"
      >
        <View style={styles.questionMeta}>
          <Text
            style={[
              styles.metaChip,
              {
                color: theme.primary,
                borderColor: withAlpha(theme.primary, 0.45),
              },
            ]}
          >
            {SKILL_LABELS[question.skill]}
          </Text>
          <Text
            style={[
              styles.metaChip,
              { color: theme.textSecondary, borderColor: theme.border },
            ]}
          >
            {OFFICIAL_TYPE_LABELS[question.officialType]}
          </Text>
        </View>
        <Text style={[styles.instruction, { color: theme.textSecondary }]}>
          {question.instruction}
        </Text>

        {question.passage ? (
          <View
            style={[
              styles.passage,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            {question.passage.title ? (
              <Text style={[styles.passageTitle, { color: theme.textColor }]}>
                {question.passage.title}
              </Text>
            ) : null}
            {session.mode === "mock" ? (
              <Text
                selectable
                style={[
                  styles.passageText,
                  fontStyles.japaneseText,
                  { color: theme.textColor },
                ]}
              >
                {question.passage.body}
              </Text>
            ) : (
              <InspectableJapaneseText
                text={question.passage.body}
                style={styles.passageText}
              />
            )}
          </View>
        ) : null}

        {verbalExpression ? (
          <Text style={[styles.stem, { color: theme.textColor }]}>
            Look at the illustration and listen.
          </Text>
        ) : advanceQuestionIsAudioOnly ? (
          <Text style={[styles.stem, { color: theme.textColor }]}>
            Listen to the situation and question, then the passage.
          </Text>
        ) : spokenQuestionOnly ? (
          <Text style={[styles.stem, { color: theme.textColor }]}>
            Listen for the question after the passage.
          </Text>
        ) : session.mode === "mock" ? (
          <Text
            selectable
            style={[
              styles.stem,
              fontStyles.japaneseBold,
              { color: theme.textColor },
            ]}
          >
            {question.stem}
          </Text>
        ) : (
          <InspectableJapaneseText text={question.stem} style={styles.stem} />
        )}

        {verbalExpression && question.listening?.verbalScene ? (
          <JlptVerbalScene scene={question.listening.verbalScene} />
        ) : null}
        {question.focus ? (
          <Text
            style={[
              styles.focus,
              fontStyles.japaneseBold,
              {
                color: theme.textColor,
                backgroundColor: withAlpha(theme.primary, 0.1),
                borderColor: withAlpha(theme.primary, 0.35),
              },
            ]}
          >
            {question.focus}
          </Text>
        ) : null}

        {compositionQuestion && question.sentenceComposition ? (
          <View style={styles.compositionBlock}>
            <Text style={[styles.builderLabel, { color: theme.textSecondary }]}>
              BUILD THE FULL SENTENCE
            </Text>
            <View style={styles.compositionSlots}>
              {question.options.map((_, index) => {
                const optionId = selectedOrder[index];
                const option = question.options.find(
                  (candidate) => candidate.id === optionId,
                );
                const starred =
                  index === question.sentenceComposition!.starredPosition;
                return (
                  <Pressable
                    accessibilityLabel={
                      option
                        ? `Remove ${option.label} from position ${index + 1}`
                        : `Empty position ${index + 1}`
                    }
                    disabled={!option || Boolean(storedAnswer)}
                    key={index}
                    onPress={() => option && chooseOption(option.id)}
                    testID={`jlpt-composition-slot-${index}`}
                    style={[
                      styles.compositionSlot,
                      {
                        borderColor: starred ? theme.secondary : theme.border,
                        backgroundColor: theme.cardBackground,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.slotPosition,
                        { color: starred ? theme.secondary : theme.textLight },
                      ]}
                    >
                      {starred ? "★" : index + 1}
                    </Text>
                    <Text
                      style={[
                        styles.slotText,
                        fontStyles.japaneseText,
                        { color: option ? theme.textColor : theme.textLight },
                      ]}
                    >
                      {option?.label ?? "—"}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {selectedOrder.length ? (
              <Pressable
                disabled={Boolean(storedAnswer)}
                onPress={() => setCompositionOrder([])}
              >
                <Text
                  style={[styles.clearOrder, { color: theme.textSecondary }]}
                >
                  Clear order
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {question.listening ? (
          <View
            style={[
              styles.listeningCard,
              {
                borderColor: withAlpha(theme.primary, 0.45),
                backgroundColor: withAlpha(
                  theme.primary,
                  theme.isDark ? 0.09 : 0.05,
                ),
              },
            ]}
          >
            <View style={styles.listeningTop}>
              <View
                style={[
                  styles.listeningIcon,
                  { backgroundColor: theme.primary },
                ]}
              >
                <Ionicons name="headset" size={19} color="#fff" />
              </View>
              <View style={styles.listeningCopy}>
                <Text
                  style={[styles.listeningTitle, { color: theme.textColor }]}
                >
                  Listening audio
                </Text>
                <Text
                  style={[
                    styles.listeningSubtitle,
                    { color: theme.textSecondary },
                  ]}
                >
                  {session.mode === "mock"
                    ? "One forward item play · stimulus heard once"
                    : `${allowedPlays} total practice plays`}
                </Text>
              </View>
              <Text style={[styles.playCount, { color: theme.textSecondary }]}>
                {usedPlays}/{allowedPlays}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={
                usedPlays >= allowedPlays ||
                audioState === "loading" ||
                audioState === "playing"
              }
              onPress={playListening}
              style={({ pressed }) => [
                styles.audioButton,
                {
                  backgroundColor: theme.primary,
                  opacity:
                    usedPlays >= allowedPlays ? 0.42 : pressed ? 0.72 : 1,
                },
              ]}
            >
              {audioState === "loading" || audioState === "playing" ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons
                  name={usedPlays ? "refresh" : "play"}
                  size={17}
                  color="#fff"
                />
              )}
              <Text style={styles.audioButtonText}>
                {audioState === "loading"
                  ? "Preparing audio…"
                  : audioState === "playing"
                    ? "Playing…"
                    : usedPlays >= allowedPlays
                      ? "Audio played"
                      : usedPlays
                        ? "Play again"
                        : "Play audio"}
              </Text>
            </Pressable>
            {audioState === "error" ? (
              <Text style={[styles.audioError, { color: theme.error }]}>
                Audio could not be played. Check your connection and try again.
              </Text>
            ) : null}
          </View>
        ) : null}

        <View accessibilityRole="radiogroup" style={styles.options}>
          {question.options.map((option, index) => {
            const selected = compositionQuestion
              ? selectedOrder.includes(option.id)
              : selectedOptionId === option.id;
            const correct =
              canReveal &&
              !compositionQuestion &&
              option.id === question.correctOptionId;
            const wrong =
              canReveal &&
              !compositionQuestion &&
              selected &&
              option.id !== question.correctOptionId;
            const borderColor = correct
              ? "#20A464"
              : wrong
                ? theme.error
                : selected
                  ? theme.primary
                  : theme.border;
            const backgroundColor = correct
              ? withAlpha("#20A464", 0.1)
              : wrong
                ? withAlpha(theme.error, 0.09)
                : selected
                  ? withAlpha(theme.primary, theme.isDark ? 0.14 : 0.08)
                  : theme.cardBackground;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{
                  checked: selected,
                  disabled: Boolean(storedAnswer),
                }}
                disabled={Boolean(storedAnswer)}
                key={option.id}
                onPress={() => chooseOption(option.id)}
                testID={`jlpt-option-${option.id}`}
                style={({ pressed }) => [
                  styles.option,
                  { borderColor, backgroundColor, opacity: pressed ? 0.72 : 1 },
                ]}
              >
                <View
                  style={[
                    styles.optionNumber,
                    {
                      borderColor: selected ? theme.primary : theme.border,
                      backgroundColor: selected
                        ? theme.primary
                        : theme.backgroundColor,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.optionNumberText,
                      { color: selected ? "#fff" : theme.textSecondary },
                    ]}
                  >
                    {index + 1}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.optionText,
                    fontStyles.japaneseText,
                    { color: theme.textColor },
                  ]}
                >
                  {question.listening?.audioOnlyOptions
                    ? `Choice ${index + 1}`
                    : option.label}
                </Text>
                {correct ? (
                  <Ionicons name="checkmark-circle" size={21} color="#20A464" />
                ) : wrong ? (
                  <Ionicons name="close-circle" size={21} color={theme.error} />
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {storedAnswer && session.mode !== "mock" ? (
          <View
            style={[
              styles.feedback,
              {
                borderColor: storedAnswer.correct
                  ? withAlpha("#20A464", 0.5)
                  : withAlpha(theme.error, 0.5),
                backgroundColor: storedAnswer.correct
                  ? withAlpha("#20A464", 0.07)
                  : withAlpha(theme.error, 0.07),
              },
            ]}
          >
            <View style={styles.feedbackTitleRow}>
              <Ionicons
                name={
                  storedAnswer.correct ? "checkmark-circle" : "close-circle"
                }
                size={21}
                color={storedAnswer.correct ? "#20A464" : theme.error}
              />
              <Text style={[styles.feedbackTitle, { color: theme.textColor }]}>
                {session.immediateFeedback
                  ? storedAnswer.correct
                    ? "Correct"
                    : "Not quite"
                  : "Answer recorded"}
              </Text>
            </View>
            {session.immediateFeedback ? (
              <Text
                style={[styles.feedbackText, { color: theme.textSecondary }]}
              >
                {question.explanation}
              </Text>
            ) : null}
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            paddingBottom: Math.max(insets.bottom, 10),
            borderTopColor: theme.border,
            backgroundColor: theme.backgroundColor,
          },
        ]}
      >
        <View style={styles.footerProgress}>
          <Text style={[styles.footerQuestion, { color: theme.textSecondary }]}>
            Question {session.currentQuestionIndex + 1} of {questionIds.length}
          </Text>
          <Text style={[styles.footerAnswered, { color: theme.textSecondary }]}>
            Overall {answeredCount}/{allQuestionIds.length} answered
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={
            storedAnswer
              ? false
              : !selectedOptionId ||
                (compositionQuestion &&
                  selectedOrder.length !== question.options.length)
          }
          onPress={storedAnswer ? continueSession : submitAnswer}
          testID="jlpt-submit"
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: theme.primary,
              opacity: (
                storedAnswer
                  ? false
                  : !selectedOptionId ||
                    (compositionQuestion &&
                      selectedOrder.length !== question.options.length)
              )
                ? 0.42
                : pressed
                  ? 0.75
                  : 1,
            },
          ]}
        >
          <Text style={styles.submitText}>
            {storedAnswer
              ? session.currentQuestionIndex === questionIds.length - 1
                ? session.currentSectionIndex ===
                  session.sectionQuestionIds.length - 1
                  ? "See results"
                  : "Finish section"
                : "Continue"
              : compositionQuestion &&
                  selectedOrder.length < question.options.length
                ? `Choose ${question.options.length - selectedOrder.length} more`
                : "Submit answer"}
          </Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: {
    flex: 1,
    paddingHorizontal: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 18,
  },
  loadingDetail: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginTop: 7,
  },
  errorButton: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 20,
    justifyContent: "center",
    marginTop: 20,
  },
  header: { borderBottomWidth: 1, paddingHorizontal: 14, paddingTop: 7 },
  headerTop: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 11,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  headerIdentity: { flex: 1, minWidth: 0 },
  headerTitle: { fontSize: 14, lineHeight: 19, fontWeight: "800" },
  headerMeta: { fontSize: 11, lineHeight: 15, marginTop: 1 },
  headerQuestion: { fontSize: 12, fontWeight: "700" },
  timer: {
    minHeight: 34,
    borderRadius: 11,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  timerText: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  progressTrack: { height: 3, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  questionContent: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 28 },
  questionMeta: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  metaChip: {
    borderWidth: 1,
    borderRadius: 13,
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 10,
    fontWeight: "800",
  },
  instruction: { fontSize: 13, lineHeight: 19, marginTop: 14 },
  passage: { borderWidth: 1, borderRadius: 15, padding: 16, marginTop: 17 },
  passageTitle: { fontSize: 15, fontWeight: "800", marginBottom: 8 },
  passageText: { fontSize: 17, lineHeight: 29 },
  stem: { fontSize: 24, lineHeight: 38, fontWeight: "700", marginTop: 20 },
  focus: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
    fontSize: 19,
    marginTop: 12,
  },
  compositionBlock: { marginTop: 18 },
  builderLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  compositionSlots: { flexDirection: "row", gap: 6 },
  compositionSlot: {
    flex: 1,
    minWidth: 0,
    minHeight: 70,
    borderWidth: 1,
    borderRadius: 11,
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  slotPosition: { fontSize: 10, fontWeight: "800", marginBottom: 3 },
  slotText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  clearOrder: {
    alignSelf: "flex-end",
    fontSize: 12,
    fontWeight: "700",
    paddingVertical: 9,
  },
  listeningCard: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 14,
    marginTop: 18,
  },
  listeningTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  listeningIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  listeningCopy: { flex: 1 },
  listeningTitle: { fontSize: 14, fontWeight: "800" },
  listeningSubtitle: { fontSize: 11, marginTop: 2 },
  playCount: { fontSize: 12, fontWeight: "800" },
  audioButton: {
    minHeight: 46,
    borderRadius: 11,
    marginTop: 13,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  audioButtonText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  audioError: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  options: { gap: 10, marginTop: 20 },
  option: {
    minHeight: 60,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  optionNumber: {
    width: 30,
    height: 30,
    borderRadius: 9,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  optionNumberText: { fontSize: 12, fontWeight: "800" },
  optionText: { flex: 1, fontSize: 16, lineHeight: 24 },
  feedback: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 16 },
  feedbackTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  feedbackTitle: { fontSize: 15, fontWeight: "800" },
  feedbackText: { fontSize: 13, lineHeight: 20, marginTop: 7 },
  footer: { borderTopWidth: 1, paddingTop: 9, paddingHorizontal: 14 },
  footerProgress: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  footerQuestion: { fontSize: 11, fontWeight: "700" },
  footerAnswered: { fontSize: 11 },
  submitButton: {
    minHeight: 50,
    borderRadius: 13,
    paddingHorizontal: 17,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  submitText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  primaryButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  completeIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  completeKicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    marginTop: 19,
  },
  completeTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 7,
  },
  completeDescription: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 8,
  },
  nextSectionCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 15,
    padding: 16,
    marginTop: 21,
  },
  nextLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  nextTitle: { fontSize: 15, lineHeight: 21, fontWeight: "800", marginTop: 4 },
  nextTime: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  wideButton: {
    width: "100%",
    minHeight: 50,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
  },
  textButton: { minHeight: 44, justifyContent: "center", alignItems: "center" },
  textButtonLabel: { fontSize: 13, fontWeight: "700" },
});
