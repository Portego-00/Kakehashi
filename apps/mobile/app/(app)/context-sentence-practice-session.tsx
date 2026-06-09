import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ContextSentenceQuestionScreen from "../../src/components/ContextSentenceQuestionScreen";
import { useSession } from "../../src/contexts/AuthContext";
import { generateContextSentenceQuestions } from "../../src/services/contextSentencePracticeService";
import type {
  ContextSentenceAnswer,
  ContextSentencePracticeConfig,
  ContextSentenceQuestion,
} from "../../src/types/contextSentencePractice";
import type { ListeningSolutionMode } from "../../src/types/listening";
import { parseSelectedListIds } from "../../src/utils/extraStudySubjectLists";
import {
  EXTRA_STUDY_SESSION_STORAGE_KEYS,
  clearExtraStudySessionState,
  loadExtraStudySessionState,
  saveExtraStudySessionState,
} from "../../src/utils/extraStudySessionPersistence";
import { fontStyles } from "../../src/utils/fonts";
import { useSubjectColors } from "../../src/utils/subjectColors";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

const DEFAULT_SRS_GROUPS = {
  apprentice: true,
  guru: true,
  master: true,
  enlightened: true,
  burned: false,
};
const RESULTS_TRANSITION_DELAY_MS = 2000;
const CONTEXT_SENTENCE_PRACTICE_SESSION_KEY =
  EXTRA_STUDY_SESSION_STORAGE_KEYS.CONTEXT_SENTENCE_PRACTICE;

interface ContextSentencePracticeSavedSession {
  savedAt: number;
  questions: ContextSentenceQuestion[];
  currentIndex: number;
  answers: ContextSentenceAnswer[];
  solutionMode: ListeningSolutionMode;
  enableSentenceAudio: boolean;
  autoPlaySentenceAudio: boolean;
  hideTranslationUntilTap: boolean;
  enableJpdbSentenceBreakdown: boolean;
  stopAfterAnswer: boolean;
}

function parseSolutionMode(raw: unknown): ListeningSolutionMode {
  return raw === "writing" ? "writing" : "multiple_choice";
}

function parseBoolean(raw: unknown, defaultValue = false): boolean {
  if (typeof raw !== "string") {
    return defaultValue;
  }
  return raw === "true";
}

function parseNumber(raw: unknown, defaultValue: number): number {
  if (typeof raw !== "string") {
    return defaultValue;
  }

  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    return defaultValue;
  }

  return parsed;
}

function parseSubjectIds(raw: unknown): number[] {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[,\s]+/)
      : [];

  const parsed = values
    .map((value) => {
      const numericValue =
        typeof value === "number"
          ? value
          : Number.parseInt(String(value), 10);
      if (!Number.isInteger(numericValue) || numericValue <= 0) {
        return null;
      }

      return numericValue;
    })
    .filter((value): value is number => value !== null);

  return Array.from(new Set(parsed));
}

export default function ContextSentencePracticeSession() {
  const { theme } = useTheme();
  const { apiToken, userData } = useAuthStore();
  const { autoSwitchKeyboard, showContextSentenceSpeedControl } =
    useSettingsStore();
  const { isLoading: isAuthLoading } = useSession();
  const params = useLocalSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [questions, setQuestions] = useState<ContextSentenceQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<ContextSentenceAnswer[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [solutionMode, setSolutionMode] =
    useState<ListeningSolutionMode>("multiple_choice");
  const [enableSentenceAudio, setEnableSentenceAudio] = useState(false);
  const [autoPlaySentenceAudio, setAutoPlaySentenceAudio] = useState(false);
  const [hideTranslationUntilTap, setHideTranslationUntilTap] = useState(false);
  const [enableJpdbSentenceBreakdown, setEnableJpdbSentenceBreakdown] =
    useState(false);
  const [stopAfterAnswer, setStopAfterAnswer] = useState(true);
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearCompletionTimeout = useCallback(() => {
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
  }, []);

  const clearSavedContextSentencePracticeSession = useCallback(async () => {
    await clearExtraStudySessionState(CONTEXT_SENTENCE_PRACTICE_SESSION_KEY);
  }, []);

  const restoreSavedContextSentencePracticeSession = useCallback(
    async (): Promise<boolean> => {
      const savedSession =
        await loadExtraStudySessionState<ContextSentencePracticeSavedSession>(
          CONTEXT_SENTENCE_PRACTICE_SESSION_KEY,
        );
      if (!savedSession) {
        return false;
      }

      if (!Array.isArray(savedSession.questions) || savedSession.questions.length === 0) {
        await clearSavedContextSentencePracticeSession();
        return false;
      }

      const safeIndex = Math.max(
        0,
        Math.min(savedSession.currentIndex || 0, savedSession.questions.length - 1),
      );

      clearCompletionTimeout();
      setQuestions(savedSession.questions);
      setCurrentIndex(safeIndex);
      setAnswers(Array.isArray(savedSession.answers) ? savedSession.answers : []);
      setSolutionMode(
        savedSession.solutionMode === "writing" ? "writing" : "multiple_choice",
      );
      setEnableSentenceAudio(savedSession.enableSentenceAudio === true);
      setAutoPlaySentenceAudio(savedSession.autoPlaySentenceAudio === true);
      setHideTranslationUntilTap(savedSession.hideTranslationUntilTap === true);
      setEnableJpdbSentenceBreakdown(
        savedSession.enableJpdbSentenceBreakdown === true,
      );
      setStopAfterAnswer(savedSession.stopAfterAnswer !== false);
      setIsComplete(false);
      setIsLoading(false);
      return true;
    },
    [clearCompletionTimeout, clearSavedContextSentencePracticeSession],
  );

  const saveContextSentencePracticeSessionForLater = useCallback(
    async (): Promise<boolean> => {
      if (
        isComplete ||
        questions.length === 0 ||
        currentIndex < 0 ||
        currentIndex >= questions.length
      ) {
        return false;
      }

      const payload: ContextSentencePracticeSavedSession = {
        savedAt: Date.now(),
        questions,
        currentIndex,
        answers,
        solutionMode,
        enableSentenceAudio,
        autoPlaySentenceAudio,
        hideTranslationUntilTap,
        enableJpdbSentenceBreakdown,
        stopAfterAnswer,
      };

      return saveExtraStudySessionState(CONTEXT_SENTENCE_PRACTICE_SESSION_KEY, payload);
    },
    [
      answers,
      autoPlaySentenceAudio,
      currentIndex,
      enableSentenceAudio,
      enableJpdbSentenceBreakdown,
      hideTranslationUntilTap,
      isComplete,
      questions,
      solutionMode,
      stopAfterAnswer,
    ],
  );

  const loadConfig = useCallback(async (): Promise<ContextSentencePracticeConfig> => {
    const userLevel = userData?.level ?? 60;

    if (params.sessionId) {
      const stored = await AsyncStorage.getItem(
        `context_sentence_config_${params.sessionId}`,
      );

      if (!stored) {
        throw new Error("Config not found in storage");
      }

      const parsed = JSON.parse(stored);
      await AsyncStorage.removeItem(`context_sentence_config_${params.sessionId}`);

      return {
        includeVocabulary: Boolean(parsed.includeVocabulary),
        includeKanaVocabulary: Boolean(parsed.includeKanaVocabulary),
        solutionMode: parseSolutionMode(parsed.solutionMode),
        numberOfQuestions:
          Number.parseInt(String(parsed.numberOfQuestions), 10) || 15,
        enableSentenceAudio: Boolean(parsed.enableSentenceAudio),
        autoPlaySentenceAudio: Boolean(parsed.autoPlaySentenceAudio),
        hideTranslationUntilTap: Boolean(parsed.hideTranslationUntilTap),
        enableJpdbSentenceBreakdown: Boolean(parsed.enableJpdbSentenceBreakdown),
        stopAfterAnswer:
          typeof parsed.stopAfterAnswer === "boolean"
            ? parsed.stopAfterAnswer
            : true,
        srsGroups: parsed.srsGroups || DEFAULT_SRS_GROUPS,
        useCustomLevelRange: Boolean(parsed.useCustomLevelRange),
        minLevel: Number.parseInt(String(parsed.minLevel), 10) || 1,
        maxLevel: Number.parseInt(String(parsed.maxLevel), 10) || userLevel,
        selectedListIds: parseSelectedListIds(parsed.selectedListIds),
        devSelectedSubjectIds: parseSubjectIds(parsed.devSelectedSubjectIds),
      };
    }

    return {
      includeVocabulary: parseBoolean(params.includeVocabulary, true),
      includeKanaVocabulary: parseBoolean(params.includeKanaVocabulary, false),
      solutionMode: parseSolutionMode(params.solutionMode),
      numberOfQuestions: parseNumber(params.numberOfQuestions, 15),
      enableSentenceAudio: parseBoolean(params.enableSentenceAudio, false),
      autoPlaySentenceAudio: parseBoolean(params.autoPlaySentenceAudio, false),
      hideTranslationUntilTap: parseBoolean(
        params.hideTranslationUntilTap,
        false,
      ),
      enableJpdbSentenceBreakdown: parseBoolean(
        params.enableJpdbSentenceBreakdown,
        false,
      ),
      stopAfterAnswer: parseBoolean(params.stopAfterAnswer, true),
      srsGroups: {
        apprentice: parseBoolean(params.srsApprentice, true),
        guru: parseBoolean(params.srsGuru, true),
        master: parseBoolean(params.srsMaster, true),
        enlightened: parseBoolean(params.srsEnlightened, true),
        burned: parseBoolean(params.srsBurned, false),
      },
      useCustomLevelRange: parseBoolean(params.useCustomLevelRange, false),
      minLevel: parseNumber(params.minLevel, 1),
      maxLevel: parseNumber(params.maxLevel, userLevel),
      selectedListIds: parseSelectedListIds(
        typeof params.selectedListIds === "string"
          ? (params.selectedListIds as string).split(",")
          : []
      ),
      devSelectedSubjectIds: parseSubjectIds(params.devSelectedSubjectIds),
    };
  }, [
    params.devSelectedSubjectIds,
    params.autoPlaySentenceAudio,
    params.enableSentenceAudio,
    params.enableJpdbSentenceBreakdown,
    params.includeKanaVocabulary,
    params.includeVocabulary,
    params.hideTranslationUntilTap,
    params.maxLevel,
    params.minLevel,
    params.numberOfQuestions,
    params.selectedListIds,
    params.sessionId,
    params.solutionMode,
    params.srsApprentice,
    params.srsBurned,
    params.srsEnlightened,
    params.srsGuru,
    params.srsMaster,
    params.stopAfterAnswer,
    params.useCustomLevelRange,
    userData?.level,
  ]);

  const loadQuestions = useCallback(
    async (token: string) => {
      try {
        const shouldResume = params.resume === "true";
        if (shouldResume) {
          const restored = await restoreSavedContextSentencePracticeSession();
          if (restored) {
            return;
          }
          if (!params.sessionId) {
            Alert.alert(
              "Session Not Available",
              "Couldn't restore that practice session.",
              [
                {
                  text: "OK",
                  onPress: () => router.replace("/context-sentence-practice-config"),
                },
              ],
            );
            return;
          }
        }

        clearCompletionTimeout();
        await clearSavedContextSentencePracticeSession();
        setIsLoading(true);
        setQuestions([]);
        setAnswers([]);
        setCurrentIndex(0);
        setIsComplete(false);

        const config = await loadConfig();
        setSolutionMode(config.solutionMode);
        setEnableSentenceAudio(config.enableSentenceAudio);
        setAutoPlaySentenceAudio(config.autoPlaySentenceAudio);
        setHideTranslationUntilTap(config.hideTranslationUntilTap);
        setEnableJpdbSentenceBreakdown(config.enableJpdbSentenceBreakdown);
        setStopAfterAnswer(config.stopAfterAnswer);

        const generatedQuestions = await generateContextSentenceQuestions(
          config,
          token,
        );

        if (generatedQuestions.length === 0) {
          Alert.alert(
            "No Questions Available",
            "Could not find learned vocabulary with context sentences for your selected filters.",
            [{ text: "OK", onPress: () => router.back() }],
          );
          return;
        }

        setQuestions(generatedQuestions);
      } catch (error) {
        console.error("[ContextSentenceSession] Failed to load questions:", error);
        Alert.alert(
          "Error",
          "Failed to load context sentence questions. Please try again.",
          [{ text: "OK", onPress: () => router.back() }],
        );
      } finally {
        setIsLoading(false);
      }
    },
    [
      clearCompletionTimeout,
      clearSavedContextSentencePracticeSession,
      loadConfig,
      params.resume,
      params.sessionId,
      restoreSavedContextSentencePracticeSession,
    ],
  );

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!apiToken) {
      setIsLoading(false);
      return;
    }

    void loadQuestions(apiToken);
  }, [apiToken, isAuthLoading, loadQuestions]);

  useEffect(
    () => () => {
      clearCompletionTimeout();
    },
    [clearCompletionTimeout],
  );

  const handleAnswer = (isCorrect: boolean, answer: string) => {
    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) {
      return;
    }

    setAnswers((prev) => [
      ...prev,
      {
        vocab: currentQuestion.vocab,
        sentence: currentQuestion.sentence,
        translation: currentQuestion.translation,
        isCorrect,
        answer,
      },
    ]);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      return;
    }

    clearCompletionTimeout();
    completionTimeoutRef.current = setTimeout(() => {
      setIsComplete(true);
      completionTimeoutRef.current = null;
    }, RESULTS_TRANSITION_DELAY_MS);
  };

  useEffect(() => {
    if (isComplete) {
      void clearSavedContextSentencePracticeSession();
    }
  }, [clearSavedContextSentencePracticeSession, isComplete]);

  const handleExit = () => {
    Alert.alert(
      "Exit Practice?",
      "Want to continue this practice later?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue Later",
          onPress: async () => {
            clearCompletionTimeout();
            const wasSaved = await saveContextSentencePracticeSessionForLater();
            if (!wasSaved) {
              Alert.alert("Couldn't Save Progress", "Please try again in a moment.");
              return;
            }
            router.back();
          },
        },
        {
          text: "Exit",
          style: "destructive",
          onPress: async () => {
            await clearSavedContextSentencePracticeSession();
            router.back();
          },
        },
      ],
    );
  };

  const correctAnswersCount = useMemo(
    () => answers.filter((answer) => answer.isCorrect).length,
    [answers],
  );

  const accuracyPercent =
    answers.length > 0
      ? Math.round((correctAnswersCount / answers.length) * 100)
      : 100;

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <StatusBar style={theme.statusBarStyle} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>Preparing context sentence practice...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isComplete) {
    const incorrectAnswersCount = Math.max(0, answers.length - correctAnswersCount);
    return (
      <SummaryScreen
        theme={theme}
        answers={answers}
        accuracyPercent={accuracyPercent}
        correctAnswersCount={correctAnswersCount}
        incorrectAnswersCount={incorrectAnswersCount}
        onBack={() => {
          void clearSavedContextSentencePracticeSession();
          router.dismissAll();
          router.replace("/");
        }}
        onPracticeAgain={() => {
          void clearSavedContextSentencePracticeSession();
          router.replace("/context-sentence-practice-config");
        }}
      />
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <StatusBar style={theme.statusBarStyle} />
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>No questions available</Text>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const currentQuestion = questions[currentIndex];

  return (
    <ContextSentenceQuestionScreen
      question={currentQuestion}
      solutionMode={solutionMode}
      useJapaneseKeyboard={autoSwitchKeyboard}
      onAnswer={handleAnswer}
      onExit={handleExit}
      currentItem={currentIndex + 1}
      totalItems={questions.length}
      correctAnswersCount={correctAnswersCount}
      accuracyPercent={accuracyPercent}
      enableSentenceAudio={enableSentenceAudio}
      autoPlaySentenceAudio={autoPlaySentenceAudio}
      showSentenceAudioSpeedControl={showContextSentenceSpeedControl}
      hideTranslationUntilTap={hideTranslationUntilTap}
      enableJpdbSentenceBreakdown={enableJpdbSentenceBreakdown}
      stopAfterAnswer={stopAfterAnswer}
    />
  );
}

function SummaryAnswerCard({
  answer,
  index,
  theme,
}: {
  answer: ContextSentenceAnswer;
  index: number;
  theme: any;
}) {
  const subjectColors = useSubjectColors();
  const vocabText = answer.vocab.data.characters || "";
  const primaryMeaning = answer.vocab.data.meanings[0]?.meaning || "";
  const expectedAnswer = vocabText || "—";

  const renderHighlightedSentence = () => {
    const sentence = answer.sentence;
    const parts = sentence.split(vocabText);

    if (parts.length === 1 || !vocabText) {
      return (
        <Text
          style={[
            summaryStyles.sentenceText,
            fontStyles.japaneseText,
            { color: theme.textColor },
          ]}
        >
          {sentence}
        </Text>
      );
    }

    return (
      <Text
        style={[
          summaryStyles.sentenceText,
          fontStyles.japaneseText,
          { color: theme.textColor },
        ]}
      >
        {parts[0]}
        <Text
          style={[
            summaryStyles.highlightedVocab,
            { color: answer.isCorrect ? "#4caf50" : "#f44336" },
          ]}
        >
          {vocabText}
        </Text>
        {parts.slice(1).join(vocabText)}
      </Text>
    );
  };

  return (
    <View
      style={[
        summaryStyles.answerCard,
        { backgroundColor: theme.cardBackground },
      ]}
    >
      <View style={summaryStyles.cardHeader}>
        <View style={summaryStyles.cardHeaderLeft}>
          <Text
            style={[summaryStyles.questionNumber, { color: theme.textSecondary }]}
          >
            #{index + 1}
          </Text>
          <TouchableOpacity
            onPress={() => {
              router.push({
                pathname: "/subject/[id]",
                params: { id: answer.vocab.id },
              });
            }}
            activeOpacity={0.7}
            style={[
              summaryStyles.vocabPill,
              { backgroundColor: subjectColors.vocabulary },
            ]}
          >
            <Text style={[summaryStyles.vocabCharacters, fontStyles.japaneseText]}>
              {vocabText || "—"}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={14}
              color="rgba(255,255,255,0.7)"
            />
          </TouchableOpacity>
          <Text style={[summaryStyles.vocabMeaning, { color: theme.textSecondary }]}>
            {primaryMeaning}
          </Text>
        </View>
        <View style={summaryStyles.correctnessIndicators}>
          <View style={summaryStyles.indicatorRow}>
            <Text
              style={[summaryStyles.indicatorLabel, { color: theme.textSecondary }]}
            >
              Result
            </Text>
            <View
              style={[
                summaryStyles.indicatorDot,
                { backgroundColor: answer.isCorrect ? "#4caf50" : "#f44336" },
              ]}
            >
              <Ionicons
                name={answer.isCorrect ? "checkmark" : "close"}
                size={10}
                color="white"
              />
            </View>
          </View>
        </View>
      </View>

      <View
        style={[
          summaryStyles.sentenceContainer,
          {
            backgroundColor: theme.isDark
              ? "rgba(255,255,255,0.05)"
              : "rgba(0,0,0,0.03)",
          },
        ]}
      >
        {renderHighlightedSentence()}
        <Text style={[summaryStyles.translationText, { color: theme.textSecondary }]}>
          {answer.translation}
        </Text>
      </View>

      <View style={summaryStyles.yourAnswersRow}>
        <View style={summaryStyles.yourAnswerItem}>
          <Text style={[summaryStyles.yourAnswerLabel, { color: theme.textSecondary }]}>
            Your answer
          </Text>
          <Text
            style={[
              summaryStyles.yourAnswerValue,
              fontStyles.japaneseText,
              { color: answer.isCorrect ? "#4caf50" : "#f44336" },
            ]}
          >
            {answer.answer || "—"}
          </Text>
        </View>

        {!answer.isCorrect && (
          <View style={summaryStyles.yourAnswerItem}>
            <Text
              style={[summaryStyles.yourAnswerLabel, { color: theme.textSecondary }]}
            >
              Correct answer
            </Text>
            <Text
              style={[
                summaryStyles.yourAnswerValue,
                fontStyles.japaneseText,
                { color: "#4caf50" },
              ]}
            >
              {expectedAnswer}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function SummaryScreen({
  theme,
  answers,
  accuracyPercent,
  correctAnswersCount,
  incorrectAnswersCount,
  onBack,
  onPracticeAgain,
}: {
  theme: any;
  answers: ContextSentenceAnswer[];
  accuracyPercent: number;
  correctAnswersCount: number;
  incorrectAnswersCount: number;
  onBack: () => void;
  onPracticeAgain: () => void;
}) {
  const getScoreColor = (pct: number) => {
    if (pct >= 80) return "#4caf50";
    if (pct >= 60) return "#ff9800";
    return "#f44336";
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <StatusBar style={theme.statusBarStyle} />

      <View style={summaryStyles.header}>
        <TouchableOpacity onPress={onBack} style={summaryStyles.headerBackBtn}>
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Text style={[summaryStyles.headerTitle, { color: theme.textColor }]}>
          Session Results
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={summaryStyles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            summaryStyles.scoreOverview,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          <View style={summaryStyles.scoreCircleContainer}>
            <View
              style={[
                summaryStyles.scoreCircle,
                { borderColor: getScoreColor(accuracyPercent) },
              ]}
            >
              <Text
                style={[
                  summaryStyles.scoreCircleText,
                  { color: getScoreColor(accuracyPercent) },
                ]}
              >
                {accuracyPercent}%
              </Text>
            </View>
            <Text
              style={[summaryStyles.scoreCircleLabel, { color: theme.textSecondary }]}
            >
              Overall
            </Text>
          </View>

          <View style={summaryStyles.scoreDetailsCol}>
            <View style={summaryStyles.scoreDetailRow}>
              <Ionicons
                name="checkmark-circle-outline"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[summaryStyles.scoreDetailLabel, { color: theme.textColor }]}>
                Correct
              </Text>
              <Text
                style={[summaryStyles.scoreDetailValue, { color: "#4caf50" }]}
              >
                {correctAnswersCount}
              </Text>
            </View>
            <View style={summaryStyles.scoreDetailRow}>
              <Ionicons
                name="close-circle-outline"
                size={16}
                color={theme.textSecondary}
              />
              <Text style={[summaryStyles.scoreDetailLabel, { color: theme.textColor }]}>
                Incorrect
              </Text>
              <Text
                style={[summaryStyles.scoreDetailValue, { color: "#f44336" }]}
              >
                {incorrectAnswersCount}
              </Text>
            </View>
            <View style={summaryStyles.scoreDetailRow}>
              <Ionicons name="help-circle-outline" size={16} color={theme.textSecondary} />
              <Text style={[summaryStyles.scoreDetailLabel, { color: theme.textColor }]}>
                Questions
              </Text>
              <Text style={[summaryStyles.scoreDetailValue, { color: theme.textColor }]}>
                {answers.length}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[summaryStyles.sectionTitle, { color: theme.textColor }]}>
          Question Details
        </Text>

        {answers.map((answer, index) => (
          <SummaryAnswerCard
            key={`${answer.vocab.id}-${index}`}
            answer={answer}
            index={index}
            theme={theme}
          />
        ))}

        <View style={summaryStyles.actionsContainer}>
          <TouchableOpacity
            style={[
              summaryStyles.actionButton,
              summaryStyles.actionButtonSecondary,
              { borderColor: theme.border },
            ]}
            onPress={onBack}
          >
            <Ionicons
              name="home"
              size={20}
              color={theme.textColor}
              style={{ marginRight: 8 }}
            />
            <Text style={[summaryStyles.actionButtonText, { color: theme.textColor }]}>
              Back to Dashboard
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              summaryStyles.actionButton,
              summaryStyles.actionButtonPrimary,
              { backgroundColor: theme.primary },
            ]}
            onPress={onPracticeAgain}
          >
            <Ionicons
              name="refresh"
              size={20}
              color="white"
              style={{ marginRight: 8 }}
            />
            <Text style={summaryStyles.actionButtonPrimaryText}>Practice Again</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const summaryStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  scrollContent: {
    padding: 16,
  },
  scoreOverview: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  scoreCircleContainer: {
    alignItems: "center",
    marginRight: 20,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  scoreCircleText: {
    fontSize: 24,
    fontWeight: "bold",
  },
  scoreCircleLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  scoreDetailsCol: {
    flex: 1,
    gap: 10,
  },
  scoreDetailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  scoreDetailLabel: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  scoreDetailValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  answerCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
    flexWrap: "wrap",
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: "600",
  },
  vocabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingLeft: 10,
    paddingRight: 6,
    borderRadius: 6,
  },
  vocabCharacters: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
  },
  vocabMeaning: {
    fontSize: 13,
    fontStyle: "italic",
  },
  correctnessIndicators: {
    gap: 4,
    alignItems: "flex-end",
  },
  indicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  indicatorLabel: {
    fontSize: 11,
  },
  indicatorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  sentenceContainer: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  sentenceText: {
    fontSize: 16,
    lineHeight: 24,
  },
  highlightedVocab: {
    fontWeight: "700",
  },
  translationText: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
    fontStyle: "italic",
  },
  yourAnswersRow: {
    flexDirection: "row",
    gap: 12,
  },
  yourAnswerItem: {
    flex: 1,
  },
  yourAnswerLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  yourAnswerValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  actionsContainer: {
    gap: 12,
    marginTop: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 12,
  },
  actionButtonSecondary: {
    borderWidth: 2,
  },
  actionButtonPrimary: {},
  actionButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  actionButtonPrimaryText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 16,
    textAlign: "center",
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  resultsTitle: {
    fontSize: 30,
    fontWeight: "700",
    marginBottom: 8,
  },
  resultsScore: {
    fontSize: 52,
    fontWeight: "700",
    marginBottom: 8,
  },
  resultsAccuracy: {
    fontSize: 18,
    marginBottom: 24,
  },
  primaryButton: {
    width: "100%",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  primaryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  errorContainer: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 16,
    marginBottom: 14,
  },
});
