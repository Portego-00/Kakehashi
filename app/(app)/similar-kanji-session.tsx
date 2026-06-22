import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ReviewResultsScreen from "../../src/components/ReviewResultsScreen";
import { useSession } from "../../src/contexts/AuthContext";
import { useActivityTracking } from "../../src/hooks/useActivityTracking";
import {
  Assignment,
  Subject as ApiSubject,
  getAllAssignmentsCached,
} from "../../src/utils/api";
import { getAllSubjects, getSubjectById } from "../../src/utils/cache";
import {
  getSelectedListSubjectIdSet,
  parseSelectedListIds,
  subjectMatchesSelectedLists,
} from "../../src/utils/extraStudySubjectLists";
import {
  EXTRA_STUDY_SESSION_STORAGE_KEYS,
  clearExtraStudySessionState,
  loadExtraStudySessionState,
  saveExtraStudySessionState,
} from "../../src/utils/extraStudySessionPersistence";
import { fontStyles } from "../../src/utils/fonts";
import { getNiaiSimilarKanji } from "../../src/utils/niaiSimilarKanji";
import {
  SimilarKanjiQuestion,
  buildSimilarKanjiQuestions,
  getPrimaryKanjiMeaning,
} from "../../src/utils/similarKanjiQuiz";
import { useAuthStore } from "../../src/utils/store";
import { getSubjectTypeColor } from "../../src/utils/subjectColors";
import { useTheme } from "../../src/utils/theme";

interface SrsGroupsConfig {
  apprentice: boolean;
  guru: boolean;
  master: boolean;
  enlightened: boolean;
  burned: boolean;
}

interface SimilarKanjiConfig {
  numberOfQuestions: number;
  srsGroups: SrsGroupsConfig;
  useCustomLevelRange: boolean;
  minLevel: number;
  maxLevel: number;
  selectedListIds: string[];
  onlyLearnedSimilarKanji: boolean;
}

interface SimilarKanjiReviewItem {
  id: number;
  assignmentId: number;
  subjectId: number;
  subject: ApiSubject;
  srsStage?: number;
  meaningDone: boolean;
  readingDone: boolean;
  meaningApplicable: boolean;
  readingApplicable: boolean;
  meaningIncorrect: number;
  readingIncorrect: number;
  meaningCorrectlyAnswered: boolean;
  readingCorrectlyAnswered: boolean;
  meaningIncorrectCounted: boolean;
  readingIncorrectCounted: boolean;
}

interface SimilarKanjiProgressState {
  current: number;
  total: number;
  meaningCorrect: number;
  readingCorrect: number;
  totalItems: number;
  answeredCount: number;
  completedItems: number;
  meaningAttempts: number;
  readingAttempts: number;
  correctAnswersCount: number;
}

interface SimilarKanjiSavedSession {
  savedAt: number;
  config: SimilarKanjiConfig;
  questions: SimilarKanjiQuestion<ApiSubject>[];
  currentIndex: number;
  reviewItems: SimilarKanjiReviewItem[];
  progress: SimilarKanjiProgressState;
  selectedChoiceSubjectId: number | null;
}

const DEFAULT_SRS_GROUPS: SrsGroupsConfig = {
  apprentice: true,
  guru: true,
  master: true,
  enlightened: true,
  burned: true,
};

const EMPTY_PROGRESS_STATE: SimilarKanjiProgressState = {
  current: 0,
  total: 0,
  meaningCorrect: 0,
  readingCorrect: 0,
  totalItems: 0,
  answeredCount: 0,
  completedItems: 0,
  meaningAttempts: 0,
  readingAttempts: 0,
  correctAnswersCount: 0,
};

const SIMILAR_KANJI_SESSION_KEY =
  EXTRA_STUDY_SESSION_STORAGE_KEYS.SIMILAR_KANJI;

const isSrsStageAllowed = (
  stage: number,
  srsGroups: SrsGroupsConfig,
): boolean => {
  if (stage >= 1 && stage <= 4) return srsGroups.apprentice;
  if (stage >= 5 && stage <= 6) return srsGroups.guru;
  if (stage === 7) return srsGroups.master;
  if (stage === 8) return srsGroups.enlightened;
  if (stage === 9) return srsGroups.burned;
  return false;
};

const isKanjiSubject = (subject: ApiSubject | null | undefined): subject is ApiSubject =>
  Boolean(
    subject &&
      subject.object === "kanji" &&
      subject.data?.characters &&
      getPrimaryKanjiMeaning(subject),
  );

function normalizeConfig(rawConfig: Partial<SimilarKanjiConfig>): SimilarKanjiConfig {
  return {
    numberOfQuestions:
      typeof rawConfig.numberOfQuestions === "number"
        ? rawConfig.numberOfQuestions
        : 20,
    srsGroups: {
      ...DEFAULT_SRS_GROUPS,
      ...(rawConfig.srsGroups || {}),
    },
    useCustomLevelRange: rawConfig.useCustomLevelRange === true,
    minLevel: typeof rawConfig.minLevel === "number" ? rawConfig.minLevel : 1,
    maxLevel:
      typeof rawConfig.maxLevel === "number"
        ? rawConfig.maxLevel
        : useAuthStore.getState().userData?.level ?? 60,
    selectedListIds: parseSelectedListIds(rawConfig.selectedListIds),
    onlyLearnedSimilarKanji: rawConfig.onlyLearnedSimilarKanji !== false,
  };
}

function getSubjectCharacters(subject: ApiSubject): string {
  return subject.data.characters ?? "";
}

export default function SimilarKanjiSessionScreen() {
  useActivityTracking("similar_kanji");
  const { theme } = useTheme();
  const { apiToken } = useAuthStore();
  const { isLoading: isAuthLoading } = useSession();
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const kanjiFontSize = Math.min(88, Math.max(56, width / 4.2));

  const [isLoading, setIsLoading] = useState(true);
  const [questions, setQuestions] = useState<SimilarKanjiQuestion<ApiSubject>[]>(
    [],
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewItems, setReviewItems] = useState<SimilarKanjiReviewItem[]>([]);
  const [progress, setProgress] = useState({ ...EMPTY_PROGRESS_STATE });
  const [isComplete, setIsComplete] = useState(false);
  const [config, setConfig] = useState<SimilarKanjiConfig | null>(null);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const [selectedChoiceSubjectId, setSelectedChoiceSubjectId] = useState<
    number | null
  >(null);

  const clearSavedSimilarKanjiSession = useCallback(async () => {
    await clearExtraStudySessionState(SIMILAR_KANJI_SESSION_KEY);
  }, []);

  const restoreSavedSimilarKanjiSession = useCallback(async (): Promise<boolean> => {
    const savedSession =
      await loadExtraStudySessionState<SimilarKanjiSavedSession>(
        SIMILAR_KANJI_SESSION_KEY,
      );
    if (!savedSession) {
      return false;
    }

    if (
      !savedSession.config ||
      typeof savedSession.config !== "object" ||
      !Array.isArray(savedSession.questions) ||
      !Array.isArray(savedSession.reviewItems) ||
      savedSession.questions.length === 0
    ) {
      await clearSavedSimilarKanjiSession();
      return false;
    }

    const safeIndex = Math.max(
      0,
      Math.min(savedSession.currentIndex || 0, savedSession.questions.length - 1),
    );

    setConfig(savedSession.config);
    setQuestions(savedSession.questions);
    setCurrentIndex(safeIndex);
    setReviewItems(savedSession.reviewItems);
    setProgress({
      ...EMPTY_PROGRESS_STATE,
      ...(savedSession.progress || {}),
    });
    setSelectedChoiceSubjectId(savedSession.selectedChoiceSubjectId ?? null);
    setIsComplete(false);
    setHasRestoredSession(true);
    setIsLoading(false);
    return true;
  }, [clearSavedSimilarKanjiSession]);

  const saveSimilarKanjiSessionForLater =
    useCallback(async (): Promise<boolean> => {
      if (
        !config ||
        isComplete ||
        questions.length === 0 ||
        currentIndex < 0 ||
        currentIndex >= questions.length
      ) {
        return false;
      }

      const payload: SimilarKanjiSavedSession = {
        savedAt: Date.now(),
        config,
        questions,
        currentIndex,
        reviewItems,
        progress,
        selectedChoiceSubjectId,
      };

      return saveExtraStudySessionState(SIMILAR_KANJI_SESSION_KEY, payload);
    }, [
      config,
      currentIndex,
      isComplete,
      progress,
      questions,
      reviewItems,
      selectedChoiceSubjectId,
    ]);

  const loadConfig = useCallback(async () => {
    try {
      const shouldResume = params.resume === "true";
      if (shouldResume) {
        const restored = await restoreSavedSimilarKanjiSession();
        if (restored) {
          return;
        }
        if (!params.sessionId) {
          Alert.alert(
            "Session Not Available",
            "Couldn't restore that similar kanji session.",
            [
              {
                text: "OK",
                onPress: () => router.replace("/similar-kanji-config" as any),
              },
            ],
          );
          return;
        }
      }

      setHasRestoredSession(false);

      if (params.sessionId) {
        const configData = await AsyncStorage.getItem(
          `similar_kanji_config_${params.sessionId}`,
        );
        if (!configData) {
          throw new Error("Config not found in storage");
        }

        setConfig(normalizeConfig(JSON.parse(configData)));
        await AsyncStorage.removeItem(`similar_kanji_config_${params.sessionId}`);
        return;
      }

      setConfig(
        normalizeConfig({
          numberOfQuestions: params.numberOfQuestions
            ? Number.parseInt(params.numberOfQuestions as string, 10)
            : 20,
          srsGroups: {
            apprentice: params.srsApprentice !== "false",
            guru: params.srsGuru !== "false",
            master: params.srsMaster !== "false",
            enlightened: params.srsEnlightened !== "false",
            burned: params.srsBurned !== "false",
          },
          useCustomLevelRange: params.useCustomLevelRange === "true",
          minLevel: params.minLevel
            ? Number.parseInt(params.minLevel as string, 10)
            : 1,
          maxLevel: params.maxLevel
            ? Number.parseInt(params.maxLevel as string, 10)
            : useAuthStore.getState().userData?.level ?? 60,
          selectedListIds:
            typeof params.selectedListIds === "string"
              ? (params.selectedListIds as string).split(",")
              : [],
          onlyLearnedSimilarKanji: params.onlyLearnedSimilarKanji !== "false",
        }),
      );
    } catch (error) {
      console.error("Failed to load similar kanji config:", error);
      Alert.alert("Error", "Failed to load match configuration.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [
    params.maxLevel,
    params.minLevel,
    params.numberOfQuestions,
    params.onlyLearnedSimilarKanji,
    params.resume,
    params.selectedListIds,
    params.sessionId,
    params.srsApprentice,
    params.srsBurned,
    params.srsEnlightened,
    params.srsGuru,
    params.srsMaster,
    params.useCustomLevelRange,
    restoreSavedSimilarKanjiSession,
  ]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const loadQuestions = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    if (!apiToken) {
      setIsLoading(false);
      return;
    }

    if (!config) {
      return;
    }

    try {
      setIsLoading(true);
      await clearSavedSimilarKanjiSession();

      const assignmentsResponse = await getAllAssignmentsCached(apiToken, {
        srs_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        subject_types: ["kanji"],
      });

      if (assignmentsResponse.data.length === 0) {
        Alert.alert(
          "No Learned Kanji",
          "You haven't learned any kanji yet. Complete some kanji lessons first!",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }

      const allSubjectsRaw = (await getAllSubjects()) as ApiSubject[];
      const allSubjectsById = new Map<number, ApiSubject>();
      allSubjectsRaw.forEach((subject) => allSubjectsById.set(subject.id, subject));

      const learnedKanjiSubjects: ApiSubject[] = [];
      for (const assignment of assignmentsResponse.data) {
        const subjectId = assignment.data.subject_id;
        const subject =
          allSubjectsById.get(subjectId) ?? (await getSubjectById(subjectId));
        if (isKanjiSubject(subject)) {
          learnedKanjiSubjects.push(subject);
        }
      }

      const allKanjiSubjects = allSubjectsRaw.filter(isKanjiSubject);
      const pairCandidateSubjects =
        allKanjiSubjects.length > 0 ? allKanjiSubjects : learnedKanjiSubjects;

      const subjectIdToStage = new Map<number, number>();
      const learnedKanjiSubjectIds = new Set<number>();
      assignmentsResponse.data.forEach((assignment: Assignment) => {
        subjectIdToStage.set(assignment.data.subject_id, assignment.data.srs_stage);
        learnedKanjiSubjectIds.add(assignment.data.subject_id);
      });

      const selectedListSubjectIds = await getSelectedListSubjectIdSet(
        config.selectedListIds,
      );

      const targetSubjects = learnedKanjiSubjects.filter((subject) => {
        const stage = subjectIdToStage.get(subject.id) ?? 0;
        if (!isSrsStageAllowed(stage, config.srsGroups)) {
          return false;
        }

        const level = subject.data?.level ?? 0;
        const inLevelRange =
          !config.useCustomLevelRange ||
          (level >= config.minLevel && level <= config.maxLevel);

        return (
          inLevelRange &&
          subjectMatchesSelectedLists(
            subject.id,
            config.selectedListIds,
            selectedListSubjectIds,
          )
        );
      });

      const generatedQuestions = buildSimilarKanjiQuestions({
        targetSubjects,
        allKanjiSubjects: pairCandidateSubjects,
        learnedKanjiSubjectIds,
        includeUnlearnedSimilarKanji: !config.onlyLearnedSimilarKanji,
        numberOfQuestions: config.numberOfQuestions,
        getSimilarKanji: getNiaiSimilarKanji,
      });

      if (generatedQuestions.length === 0) {
        Alert.alert(
          "No Matching Pairs",
          "No visually similar kanji pairs match your selected criteria.",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }

      setQuestions(generatedQuestions);
      setReviewItems(
        generatedQuestions.map((question, index) => ({
          id: question.id,
          assignmentId: -(index + 1),
          subjectId: question.targetSubject.id,
          subject: question.targetSubject,
          srsStage: subjectIdToStage.get(question.targetSubject.id),
          meaningDone: false,
          readingDone: false,
          meaningApplicable: true,
          readingApplicable: false,
          meaningIncorrect: 0,
          readingIncorrect: 0,
          meaningCorrectlyAnswered: false,
          readingCorrectlyAnswered: false,
          meaningIncorrectCounted: false,
          readingIncorrectCounted: false,
        })),
      );
      setProgress({
        ...EMPTY_PROGRESS_STATE,
        total: generatedQuestions.length,
        totalItems: generatedQuestions.length,
      });
    } catch (error) {
      console.error("Failed to load similar kanji questions:", error);
      Alert.alert(
        "Error",
        "Failed to load your learned kanji. Please refresh your data and try again.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } finally {
      setIsLoading(false);
    }
  }, [
    apiToken,
    clearSavedSimilarKanjiSession,
    config,
    isAuthLoading,
  ]);

  useEffect(() => {
    if (config && !hasRestoredSession) {
      void loadQuestions();
    }
  }, [config, hasRestoredSession, loadQuestions]);

  useEffect(() => {
    if (isComplete) {
      void clearSavedSimilarKanjiSession();
    }
  }, [clearSavedSimilarKanjiSession, isComplete]);

  const currentQuestion = questions[currentIndex];
  const selectedAnswerIsCorrect =
    currentQuestion &&
    selectedChoiceSubjectId === currentQuestion.correctChoiceSubjectId;

  const scoreSummary = useMemo(() => {
    if (progress.answeredCount === 0) {
      return "0/0";
    }

    return `${progress.correctAnswersCount}/${progress.answeredCount}`;
  }, [progress.answeredCount, progress.correctAnswersCount]);

  const answerCurrentQuestion = (choiceSubjectId: number) => {
    if (!currentQuestion || selectedChoiceSubjectId !== null) {
      return;
    }

    const isCorrect = choiceSubjectId === currentQuestion.correctChoiceSubjectId;
    setSelectedChoiceSubjectId(choiceSubjectId);
    setReviewItems((prev) =>
      prev.map((reviewItem) => {
        if (reviewItem.id !== currentQuestion.id) {
          return reviewItem;
        }

        return {
          ...reviewItem,
          meaningDone: true,
          meaningCorrectlyAnswered: isCorrect,
          meaningIncorrect: isCorrect ? 0 : reviewItem.meaningIncorrect + 1,
          meaningIncorrectCounted: !isCorrect,
        };
      }),
    );
    setProgress((prev) => ({
      ...prev,
      current: prev.current + 1,
      answeredCount: prev.answeredCount + 1,
      completedItems: prev.completedItems + 1,
      meaningAttempts: prev.meaningAttempts + 1,
      meaningCorrect: isCorrect ? prev.meaningCorrect + 1 : prev.meaningCorrect,
      correctAnswersCount: isCorrect
        ? prev.correctAnswersCount + 1
        : prev.correctAnswersCount,
    }));
  };

  const goToNextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedChoiceSubjectId(null);
      return;
    }

    setIsComplete(true);
  };

  const skipQuestion = () => {
    if (selectedChoiceSubjectId !== null) {
      return;
    }

    setQuestions((prevQuestions) => {
      if (
        currentIndex < 0 ||
        currentIndex >= prevQuestions.length ||
        prevQuestions.length <= 1
      ) {
        return prevQuestions;
      }

      const reordered = [...prevQuestions];
      const [skippedQuestion] = reordered.splice(currentIndex, 1);
      reordered.push(skippedQuestion);
      return reordered;
    });
  };

  const handleExit = () => {
    Alert.alert("Exit Match", "Want to continue this session later?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Continue Later",
        onPress: async () => {
          const wasSaved = await saveSimilarKanjiSessionForLater();
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
          await clearSavedSimilarKanjiSession();
          router.back();
        },
      },
    ]);
  };

  const handleBackToDashboard = () => {
    void clearSavedSimilarKanjiSession();
    router.dismissAll();
    router.replace("/");
  };

  const openSubjectDetails = (subjectId: number) => {
    router.push({
      pathname: "/subject/[id]",
      params: { id: String(subjectId) },
    });
  };

  const renderKanjiCard = (
    subject: ApiSubject,
    label: string,
    isTarget: boolean,
  ) => (
    <TouchableOpacity
      style={[
        styles.kanjiCard,
        {
          backgroundColor: theme.cardBackground,
          borderColor: isTarget ? theme.primary : theme.border,
        },
      ]}
      onPress={() => openSubjectDetails(subject.id)}
      activeOpacity={0.8}
    >
      <View
        style={[
          styles.kanjiCardLabel,
          {
            backgroundColor: isTarget
              ? `${theme.primary}22`
              : theme.isDark
                ? "rgba(255,255,255,0.06)"
                : "rgba(0,0,0,0.04)",
          },
        ]}
      >
        <Text
          style={[
            styles.kanjiCardLabelText,
            { color: isTarget ? theme.primary : theme.textSecondary },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
      <Text
        style={[
          styles.kanjiText,
          fontStyles.japaneseText,
          { color: theme.textColor, fontSize: kanjiFontSize },
        ]}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {getSubjectCharacters(subject)}
      </Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.secondary} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>
            Preparing similar kanji pairs...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isComplete) {
    return (
      <ReviewResultsScreen
        reviewItems={reviewItems as any}
        progress={progress}
        submittingResults={false}
        onBackToDashboard={handleBackToDashboard}
        secondaryActionLabel="Try Another Match"
        onSecondaryAction={() => router.replace("/similar-kanji-config" as any)}
      />
    );
  }

  if (!currentQuestion) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>
            No similar kanji questions available
          </Text>
          <TouchableOpacity
            style={[styles.errorButton, { backgroundColor: theme.secondary }]}
            onPress={() => router.back()}
          >
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const targetMeaning = getPrimaryKanjiMeaning(currentQuestion.targetSubject);
  const similarMeaning = getPrimaryKanjiMeaning(currentQuestion.similarSubject);
  const hasAnswered = selectedChoiceSubjectId !== null;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <StatusBar style={theme.statusBarStyle} />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleExit}
          style={styles.headerButton}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>
            Similar Kanji
          </Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            {currentIndex + 1}/{questions.length} · Score {scoreSummary}
          </Text>
        </View>
        <TouchableOpacity
          onPress={skipQuestion}
          style={[
            styles.headerButton,
            selectedChoiceSubjectId !== null && { opacity: 0.35 },
          ]}
          disabled={selectedChoiceSubjectId !== null}
          activeOpacity={0.7}
        >
          <Ionicons name="play-skip-forward" size={22} color={theme.textColor} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: theme.primary,
                width: `${Math.max(
                  0,
                  Math.min(100, (progress.answeredCount / questions.length) * 100),
                )}%`,
              },
            ]}
          />
        </View>

        <View style={styles.kanjiPairRow}>
          {renderKanjiCard(currentQuestion.targetSubject, "Match", true)}
          {renderKanjiCard(currentQuestion.similarSubject, "Similar", false)}
        </View>

        <View
          style={[
            styles.promptCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.promptEyebrow, { color: theme.textSecondary }]}>
            Choose the meaning for
          </Text>
          <Text
            style={[
              styles.promptKanji,
              fontStyles.japaneseText,
              { color: theme.primary },
            ]}
          >
            {getSubjectCharacters(currentQuestion.targetSubject)}
          </Text>

          <View style={styles.choicesContainer}>
            {currentQuestion.choices.map((choice) => {
              const isSelected = selectedChoiceSubjectId === choice.subjectId;
              const isCorrect =
                choice.subjectId === currentQuestion.correctChoiceSubjectId;
              const borderColor = !hasAnswered
                ? theme.border
                : isCorrect
                  ? "#4caf50"
                  : isSelected
                    ? "#f44336"
                    : theme.border;
              const backgroundColor = !hasAnswered
                ? theme.backgroundColor
                : isCorrect
                  ? "rgba(76, 175, 80, 0.14)"
                  : isSelected
                    ? "rgba(244, 67, 54, 0.12)"
                    : theme.backgroundColor;

              return (
                <TouchableOpacity
                  key={choice.subjectId}
                  style={[
                    styles.choiceButton,
                    {
                      backgroundColor,
                      borderColor,
                    },
                  ]}
                  onPress={() => answerCurrentQuestion(choice.subjectId)}
                  disabled={hasAnswered}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[styles.choiceText, { color: theme.textColor }]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                  >
                    {choice.meaning}
                  </Text>
                  {hasAnswered && (isCorrect || isSelected) ? (
                    <Ionicons
                      name={isCorrect ? "checkmark-circle" : "close-circle"}
                      size={22}
                      color={isCorrect ? "#4caf50" : "#f44336"}
                    />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {hasAnswered ? (
          <View
            style={[
              styles.revealCard,
              {
                backgroundColor: selectedAnswerIsCorrect
                  ? "rgba(76, 175, 80, 0.12)"
                  : "rgba(244, 67, 54, 0.1)",
                borderColor: selectedAnswerIsCorrect ? "#4caf50" : "#f44336",
              },
            ]}
          >
            <View style={styles.revealHeader}>
              <Ionicons
                name={selectedAnswerIsCorrect ? "checkmark-circle" : "close-circle"}
                size={22}
                color={selectedAnswerIsCorrect ? "#4caf50" : "#f44336"}
              />
              <Text
                style={[
                  styles.revealTitle,
                  { color: selectedAnswerIsCorrect ? "#4caf50" : "#f44336" },
                ]}
              >
                {selectedAnswerIsCorrect ? "Correct" : "Not quite"}
              </Text>
            </View>

            <View style={styles.answerPairRow}>
              <View style={styles.answerPairItem}>
                <Text
                  style={[
                    styles.answerKanji,
                    fontStyles.japaneseText,
                    { color: getSubjectTypeColor("kanji") },
                  ]}
                >
                  {getSubjectCharacters(currentQuestion.targetSubject)}
                </Text>
                <Text
                  style={[styles.answerMeaning, { color: theme.textColor }]}
                  numberOfLines={2}
                >
                  {targetMeaning ?? "—"}
                </Text>
              </View>
              <View
                style={[
                  styles.answerDivider,
                  { backgroundColor: theme.border },
                ]}
              />
              <View style={styles.answerPairItem}>
                <Text
                  style={[
                    styles.answerKanji,
                    fontStyles.japaneseText,
                    { color: theme.textSecondary },
                  ]}
                >
                  {getSubjectCharacters(currentQuestion.similarSubject)}
                </Text>
                <Text
                  style={[styles.answerMeaning, { color: theme.textColor }]}
                  numberOfLines={2}
                >
                  {similarMeaning ?? "—"}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        <View style={{ height: 96 }} />
      </ScrollView>

      <View
        style={[
          styles.stickyFooter,
          { backgroundColor: theme.cardBackground, shadowColor: "#000" },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.nextButton,
            {
              backgroundColor: hasAnswered ? theme.primary : theme.border,
              opacity: hasAnswered ? 1 : 0.7,
            },
          ]}
          onPress={goToNextQuestion}
          disabled={!hasAnswered}
          activeOpacity={0.8}
        >
          <Text style={styles.nextButtonText}>
            {currentIndex < questions.length - 1 ? "Next Pair" : "Finish"}
          </Text>
          <Ionicons
            name={currentIndex < questions.length - 1 ? "arrow-forward" : "checkmark"}
            size={22}
            color="white"
          />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: "center",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  errorText: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 20,
  },
  errorButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  errorButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(127,127,127,0.18)",
    overflow: "hidden",
    marginBottom: 18,
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  kanjiPairRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  kanjiCard: {
    flex: 1,
    minHeight: 158,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  kanjiCardLabel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  kanjiCardLabelText: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  kanjiText: {
    lineHeight: 104,
    textAlign: "center",
  },
  promptCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  promptEyebrow: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    textTransform: "uppercase",
  },
  promptKanji: {
    fontSize: 42,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 14,
  },
  choicesContainer: {
    gap: 10,
  },
  choiceButton: {
    minHeight: 64,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  choiceText: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
  },
  revealCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  revealHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  revealTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  answerPairRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  answerPairItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
  },
  answerDivider: {
    width: 1,
    marginHorizontal: 8,
  },
  answerKanji: {
    fontSize: 34,
    fontWeight: "700",
  },
  answerMeaning: {
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  stickyFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 34,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
  },
  nextButton: {
    minHeight: 56,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  nextButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
});
