import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, Stack, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import KanjiFreehandQuiz, {
  FreehandDecisionDetails,
  KanjiFreehandQuizResult,
} from "../../src/components/KanjiFreehandQuiz";
import {
  Subject as ApiSubject,
  Assignment,
  getAllAssignmentsCached,
} from "../../src/utils/api";
import { getSubjectById } from "../../src/utils/cache";
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
import { preloadKanjiWriterData } from "../../src/utils/kanjiWriterDataLoader";
import { useSubjectColors } from "../../src/utils/subjectColors";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

interface WritingQuestion {
  id: number;
  subject: ApiSubject;
  character: string;
  meanings: string[];
  readings: string[];
}

interface QuestionResult {
  subject: ApiSubject;
  totalMistakes: number;
  skipped: boolean;
  similarityPercent?: number;
  isCorrect?: boolean;
  decisionDetails?: FreehandDecisionDetails;
}

interface WritingPracticeSavedSession {
  savedAt: number;
  mode: "guided" | "freehand";
  config: WritingPracticeConfig;
  questions: WritingQuestion[];
  currentIndex: number;
  results: QuestionResult[];
  candidatePool: ApiSubject[];
  isSubmissionVisible?: boolean;
}

interface WritingPracticeConfig {
  numberOfKanji: number;
  useForceFreehandMode?: boolean;
  useCustomLevelRange: boolean;
  minLevel: number;
  maxLevel: number;
  srsStages: {
    apprentice: boolean;
    guru: boolean;
    master: boolean;
    enlightened: boolean;
    burned: boolean;
  };
  selectedListIds?: string[];
}

const WRITING_PRACTICE_SESSION_KEY =
  EXTRA_STUDY_SESSION_STORAGE_KEYS.WRITING_PRACTICE;

export default function WritingPracticeSessionScreen() {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const insets = useSafeAreaInsets();
  const { apiToken } = useAuthStore();
  const { strokeLeniency } = useSettingsStore();
  const params = useLocalSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("Loading...");
  const [questions, setQuestions] = useState<WritingQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [config, setConfig] = useState<WritingPracticeConfig | null>(null);
  // Pool of extra kanji candidates to use when stroke data is unavailable
  const [candidatePool, setCandidatePool] = useState<ApiSubject[]>([]);
  const [isSubmissionVisible, setIsSubmissionVisible] = useState(false);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const practiceBottomPadding = isSubmissionVisible
    ? Math.max(96, insets.bottom + 64)
    : Math.max(32, insets.bottom + 12);

  useEffect(() => {
    setIsSubmissionVisible(false);
  }, [currentIndex]);

  const clearSavedWritingPracticeSession = useCallback(async () => {
    await clearExtraStudySessionState(WRITING_PRACTICE_SESSION_KEY);
  }, []);

  const restoreSavedWritingPracticeSession = useCallback(async (): Promise<boolean> => {
    const savedSession = await loadExtraStudySessionState<WritingPracticeSavedSession>(
      WRITING_PRACTICE_SESSION_KEY,
    );
    if (!savedSession) {
      return false;
    }

    if (savedSession.mode === "guided") {
      router.replace({
        pathname: "/writing-practice-session",
        params: { resume: "true" },
      });
      return true;
    }

    if (
      !savedSession.config ||
      typeof savedSession.config !== "object" ||
      !Array.isArray(savedSession.questions) ||
      savedSession.questions.length === 0
    ) {
      await clearSavedWritingPracticeSession();
      return false;
    }

    const safeIndex = Math.max(
      0,
      Math.min(savedSession.currentIndex || 0, savedSession.questions.length - 1),
    );

    setConfig(savedSession.config);
    setQuestions(savedSession.questions);
    setCurrentIndex(safeIndex);
    setResults(Array.isArray(savedSession.results) ? savedSession.results : []);
    setCandidatePool(
      Array.isArray(savedSession.candidatePool) ? savedSession.candidatePool : [],
    );
    setIsSubmissionVisible(savedSession.isSubmissionVisible === true);
    setIsComplete(false);
    setHasRestoredSession(true);
    setIsLoading(false);
    return true;
  }, [clearSavedWritingPracticeSession]);

  const saveWritingPracticeSessionForLater = useCallback(async (): Promise<boolean> => {
    if (
      !config ||
      isComplete ||
      questions.length === 0 ||
      currentIndex < 0 ||
      currentIndex >= questions.length
    ) {
      return false;
    }

    const payload: WritingPracticeSavedSession = {
      savedAt: Date.now(),
      mode: "freehand",
      config,
      questions,
      currentIndex,
      results,
      candidatePool,
      isSubmissionVisible,
    };

    return saveExtraStudySessionState(WRITING_PRACTICE_SESSION_KEY, payload);
  }, [
    candidatePool,
    config,
    currentIndex,
    isComplete,
    isSubmissionVisible,
    questions,
    results,
  ]);

  // Load config from AsyncStorage
  const loadConfig = useCallback(async () => {
    try {
      const shouldResume = params.resume === "true";
      if (shouldResume) {
        const restored = await restoreSavedWritingPracticeSession();
        if (restored) {
          return;
        }
        if (!params.sessionId) {
          Alert.alert(
            "Session Not Available",
            "Couldn't restore that writing practice session.",
            [{ text: "OK", onPress: () => router.replace("/writing-practice-config") }],
          );
          return;
        }
      }

      setHasRestoredSession(false);

      if (params.sessionId) {
        const configData = await AsyncStorage.getItem(
          `writing_config_${params.sessionId}`
        );
        if (configData) {
          const parsedConfig = JSON.parse(configData) as Partial<WritingPracticeConfig>;
          setConfig({
            ...(parsedConfig as WritingPracticeConfig),
            useForceFreehandMode: parsedConfig.useForceFreehandMode === true,
            selectedListIds: parseSelectedListIds(parsedConfig.selectedListIds),
          });
          await AsyncStorage.removeItem(`writing_config_${params.sessionId}`);
        } else {
          throw new Error("Config not found");
        }
      }
    } catch (error) {
      console.error("Failed to load config:", error);
      Alert.alert("Error", "Failed to load practice configuration.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [params.resume, params.sessionId, restoreSavedWritingPracticeSession]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Load kanji questions
  const loadQuestions = useCallback(async () => {
    if (!apiToken || !config) return;

    try {
      setIsLoading(true);
      setLoadingMessage("Fetching your kanji...");
      await clearSavedWritingPracticeSession();

      // Get assignments based on SRS filter
      const srsStages: number[] = [];
      if (config.srsStages.apprentice) srsStages.push(1, 2, 3, 4);
      if (config.srsStages.guru) srsStages.push(5, 6);
      if (config.srsStages.master) srsStages.push(7);
      if (config.srsStages.enlightened) srsStages.push(8);
      if (config.srsStages.burned) srsStages.push(9);

      let assignmentsResponse: { data: Assignment[] } | null = null;
      try {
        assignmentsResponse = await getAllAssignmentsCached(apiToken, {
          srs_stages: srsStages,
        });
      } catch (e) {
        console.warn("Failed to fetch assignments:", e);
      }

      if (!assignmentsResponse || assignmentsResponse.data.length === 0) {
        Alert.alert(
          "No Kanji Available",
          "No kanji found matching your SRS stage filters. Try including more stages or complete some lessons first!",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      // Filter to kanji only
      const kanjiAssignments = assignmentsResponse.data.filter(
        (a) => a.data.subject_type === "kanji"
      );

      if (kanjiAssignments.length === 0) {
        Alert.alert(
          "No Kanji Available",
          "You haven't learned any kanji yet. Complete some kanji lessons first!",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      setLoadingMessage("Loading kanji details...");

      // Get subject details
      const selectedListSubjectIds = await getSelectedListSubjectIdSet(
        config.selectedListIds || []
      );
      const kanjiSubjects: ApiSubject[] = [];
      for (const assignment of kanjiAssignments) {
        const subject = await getSubjectById(assignment.data.subject_id);
        if (subject && subject.object === "kanji") {
          // Filter by level range
          const level = subject.data?.level || 0;
          const inRange = config.useCustomLevelRange
            ? level >= config.minLevel && level <= config.maxLevel
            : true;
          if (
            inRange &&
            subjectMatchesSelectedLists(
              subject.id,
              config.selectedListIds || [],
              selectedListSubjectIds
            )
          ) {
            kanjiSubjects.push(subject);
          }
        }
      }

      if (kanjiSubjects.length === 0) {
        Alert.alert(
          "No Matching Kanji",
          "No kanji match your level range. Try adjusting your settings.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      // Shuffle all kanji
      const shuffled = kanjiSubjects.sort(() => Math.random() - 0.5);

      // Take the requested number for questions, keep the rest as backup candidates
      const selectedKanji = shuffled.slice(0, config.numberOfKanji);
      const remainingKanji = shuffled.slice(config.numberOfKanji);

      // Create questions
      const writingQuestions: WritingQuestion[] = selectedKanji.map(
        (subject, idx) => ({
          id: idx,
          subject,
          character: subject.data.characters || "",
          meanings:
            subject.data.meanings
              ?.filter((m: any) => m.primary || m.accepted_answer)
              .map((m: any) => m.meaning) || [],
          readings:
            subject.data.readings
              ?.filter((r: any) => r.primary || r.accepted_answer)
              .map((r: any) => r.reading) || [],
        })
      );

      // Store remaining kanji as candidates for replacement if stroke data unavailable
      setCandidatePool(remainingKanji);

      // Preload stroke data for first few kanji
      setLoadingMessage("Preloading stroke data...");
      const charsToPreload = writingQuestions
        .slice(0, 3)
        .map((q) => q.character);
      await preloadKanjiWriterData(charsToPreload);

      setQuestions(writingQuestions);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to load questions:", error);
      Alert.alert("Error", "Failed to load kanji for practice.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [apiToken, clearSavedWritingPracticeSession, config]);

  useEffect(() => {
    if (config && !hasRestoredSession) {
      loadQuestions();
    }
  }, [config, hasRestoredSession, loadQuestions]);

  const currentQuestion = questions[currentIndex];
  const routeSessionKey =
    typeof params.sessionId === "string"
      ? params.sessionId
      : Array.isArray(params.sessionId)
        ? params.sessionId.join("-")
        : params.resume === "true"
          ? "resume"
          : "session";
  const currentQuestionKey = currentQuestion
    ? [
        routeSessionKey,
        currentIndex,
        currentQuestion.subject.id,
        currentQuestion.character,
      ].join("-")
    : routeSessionKey;

  const handleComplete = useCallback(
    (result: KanjiFreehandQuizResult) => {
      setResults((prev) => [
        ...prev,
        {
          subject: currentQuestion.subject,
          totalMistakes: result.totalMistakes,
          skipped: false,
          similarityPercent: result.similarityPercent,
          isCorrect: result.isCorrect,
          decisionDetails: result.decisionDetails,
        },
      ]);

      if (currentIndex < questions.length - 1) {
        setCurrentIndex((prev) => prev + 1);
      } else {
        setIsComplete(true);
      }
    },
    [currentIndex, questions.length, currentQuestion]
  );

  const handleSkip = useCallback(() => {
    setResults((prev) => [
      ...prev,
      {
        subject: currentQuestion.subject,
        totalMistakes: 0,
        skipped: true,
      },
    ]);

    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsComplete(true);
    }
  }, [currentIndex, questions.length, currentQuestion]);

  // Handle when stroke data is unavailable - replace with candidate from pool
  const handleUnavailable = useCallback(() => {
    if (candidatePool.length > 0) {
      // Get the next candidate from the pool
      const [nextCandidate, ...remainingPool] = candidatePool;
      setCandidatePool(remainingPool);

      // Create a new question from the candidate
      const newQuestion: WritingQuestion = {
        id: currentQuestion.id,
        subject: nextCandidate,
        character: nextCandidate.data.characters || "",
        meanings:
          nextCandidate.data.meanings
            ?.filter((m: any) => m.primary || m.accepted_answer)
            .map((m: any) => m.meaning) || [],
        readings:
          nextCandidate.data.readings
            ?.filter((r: any) => r.primary || r.accepted_answer)
            .map((r: any) => r.reading) || [],
      };

      // Replace the current question
      setQuestions((prev) => {
        const updated = [...prev];
        updated[currentIndex] = newQuestion;
        return updated;
      });
    } else {
      // No more candidates, skip this one
      handleSkip();
    }
  }, [candidatePool, currentIndex, currentQuestion, handleSkip]);

  const handleExit = useCallback(() => {
    if (!isComplete && questions.length > 0) {
      Alert.alert(
        "Exit Practice?",
        "Want to continue this writing practice later?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue Later",
            onPress: async () => {
              const wasSaved = await saveWritingPracticeSessionForLater();
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
              await clearSavedWritingPracticeSession();
              router.back();
            },
          },
        ]
      );
    } else {
      router.back();
    }
  }, [
    clearSavedWritingPracticeSession,
    isComplete,
    questions.length,
    saveWritingPracticeSessionForLater,
  ]);

  useEffect(() => {
    if (isComplete) {
      void clearSavedWritingPracticeSession();
    }
  }, [clearSavedWritingPracticeSession, isComplete]);

  // Calculate results
  const calculateResults = useCallback(() => {
    const perfectCount = results.filter(
      (r) => !r.skipped && r.totalMistakes === 0
    ).length;
    const goodCount = results.filter(
      (r) => !r.skipped && r.totalMistakes > 0 && r.totalMistakes <= 2
    ).length;
    const skippedCount = results.filter((r) => r.skipped).length;
    const totalMistakes = results.reduce(
      (sum, r) => sum + r.totalMistakes,
      0
    );
    const attemptedCount = results.filter((r) => !r.skipped).length;
    const avgMistakesPerKanji =
      attemptedCount > 0
        ? (totalMistakes / attemptedCount).toFixed(1)
        : "0.0";

    return {
      perfectCount,
      goodCount,
      skippedCount,
      totalMistakes,
      avgMistakesPerKanji,
      total: results.length,
      attemptedCount,
    };
  }, [results]);

  // Loading state
  if (isLoading) {
    return (
      <>
        <Stack.Screen
          options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
        />
        <SafeAreaView
          style={[styles.container, { backgroundColor: theme.backgroundColor }]}
        >
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#4caf50" />
            <Text style={[styles.loadingText, { color: theme.textColor }]}>
              {loadingMessage}
            </Text>
          </View>
        </SafeAreaView>
      </>
    );
  }

  // Results screen
  if (isComplete) {
    const stats = calculateResults();

    return (
      <>
        <Stack.Screen
          options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
        />
        <SafeAreaView
          style={[styles.container, { backgroundColor: theme.backgroundColor }]}
        >
          <ScrollView contentContainerStyle={styles.resultsContainer}>
            {/* Header */}
            <Text style={[styles.resultsTitle, { color: theme.textColor }]}>
              Practice Complete!
            </Text>
            <Text
              style={[styles.resultsSubtitle, { color: theme.textSecondary }]}
            >
              You practiced {stats.total} kanji
            </Text>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={styles.statsRow}>
              <View
                style={[styles.statCard, { backgroundColor: theme.cardBackground }]}
              >
                <Text style={[styles.statValue, { color: "#4caf50" }]}>
                  {stats.perfectCount}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Perfect
                </Text>
              </View>
              <View
                style={[styles.statCard, { backgroundColor: theme.cardBackground }]}
              >
                <Text style={[styles.statValue, { color: "#f44336" }]}>
                  {stats.totalMistakes}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Total Mistakes
                </Text>
              </View>
            </View>
            <View style={styles.statsRow}>
              <View
                style={[styles.statCard, { backgroundColor: theme.cardBackground }]}
              >
                <Text style={[styles.statValue, { color: "#ff9800" }]}>
                  {stats.avgMistakesPerKanji}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Avg mistakes per Kanji
                </Text>
              </View>
              <View
                style={[styles.statCard, { backgroundColor: theme.cardBackground }]}
              >
                <Text style={[styles.statValue, { color: theme.textSecondary }]}>
                  {stats.skippedCount}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Skipped
                </Text>
              </View>
            </View>
          </View>

          {/* Kanji Grid */}
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            All Kanji
          </Text>
          <View style={styles.kanjiGrid}>
            {/* Render kanji in rows of 2 */}
            {Array.from({ length: Math.ceil(results.length / 2) }).map(
              (_, rowIndex) => {
                const item1 = results[rowIndex * 2];
                const item2 = results[rowIndex * 2 + 1];

                const renderKanjiCard = (item: QuestionResult) => {
                  const isPerfect = !item.skipped && item.totalMistakes === 0;
                  const isSkipped = item.skipped;
                  const cardColor = isSkipped
                    ? theme.textSecondary
                    : isPerfect
                      ? "#4caf50"
                      : item.totalMistakes <= 2
                        ? "#ff9800"
                        : "#f44336";

                  return (
                    <TouchableOpacity
                      key={item.subject.id}
                      style={[
                        styles.kanjiCard,
                        { backgroundColor: theme.cardBackground },
                      ]}
                      onPress={() =>
                        router.push({
                          pathname: "/subject/[id]",
                          params: { id: item.subject.id },
                        })
                      }
                    >
                      <View
                        style={[
                          styles.kanjiHeader,
                          { backgroundColor: subjectColors.kanji },
                        ]}
                      >
                        <Text
                          style={[
                            styles.kanjiCharacter,
                            fontStyles.japaneseText,
                          ]}
                        >
                          {item.subject.data.characters}
                        </Text>
                      </View>
                      <View style={styles.kanjiInfo}>
                        <Text
                          style={[
                            styles.kanjiMeaning,
                            { color: theme.textColor },
                          ]}
                          numberOfLines={1}
                        >
                          {item.subject.data.meanings?.[0]?.meaning || ""}
                        </Text>
                        <View style={styles.kanjiStatus}>
                          {isSkipped ? (
                            <Ionicons
                              name="remove-circle"
                              size={16}
                              color={cardColor}
                            />
                          ) : isPerfect ? (
                            <Ionicons
                              name="checkmark-circle"
                              size={16}
                              color={cardColor}
                            />
                          ) : (
                            <Text
                              style={[
                                styles.mistakeCount,
                                { color: cardColor },
                              ]}
                            >
                              {item.totalMistakes}
                            </Text>
                          )}
                          <Text
                            style={[
                              styles.statusText,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {isSkipped
                              ? "Skipped"
                              : isPerfect
                                ? "Perfect"
                                : item.totalMistakes === 1
                                  ? "mistake"
                                  : "mistakes"}
                          </Text>
                        </View>
                        {item.similarityPercent !== undefined && !isSkipped && (
                          <Text
                            style={[
                              styles.similarityText,
                              { color: theme.textSecondary },
                            ]}
                          >
                            {item.similarityPercent}% match
                          </Text>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                };

                return (
                  <View key={rowIndex} style={styles.kanjiRow}>
                    {renderKanjiCard(item1)}
                    {item2 ? (
                      renderKanjiCard(item2)
                    ) : (
                      <View style={styles.kanjiCard} />
                    )}
                  </View>
                );
              }
            )}
          </View>
          </ScrollView>

          {/* Sticky Action Buttons */}
          <View
            style={[
              styles.stickyButtonContainer,
              { backgroundColor: theme.backgroundColor },
            ]}
          >
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: "#4caf50" }]}
              onPress={() => {
                void clearSavedWritingPracticeSession();
                router.dismissAll();
                router.replace("/");
              }}
            >
              <Text style={styles.primaryButtonText}>Back to Dashboard</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: theme.border }]}
              onPress={() => {
                // Clear stack, set home as root, then push config on top
                void clearSavedWritingPracticeSession();
                router.dismissAll();
                router.replace("/");
                router.push("/writing-practice-config");
              }}
            >
              <Text
                style={[styles.secondaryButtonText, { color: theme.textColor }]}
              >
                Practice Again
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  // Practice screen
  return (
    <>
      <Stack.Screen
        options={{ gestureEnabled: false, fullScreenGestureEnabled: false }}
      />
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleExit} style={styles.exitButton}>
            <Ionicons name="close" size={24} color={theme.textColor} />
          </TouchableOpacity>
          <View style={styles.progressInfo}>
            <Text style={[styles.progressText, { color: theme.textColor }]}>
              {currentIndex + 1} / {questions.length}
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Progress Bar */}
        <View style={[styles.progressBar, { backgroundColor: theme.border }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: "#4caf50",
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
              },
            ]}
          />
        </View>

        <ScrollView
          style={styles.practiceContainer}
          contentContainerStyle={[
            styles.practiceContentContainer,
            { paddingBottom: practiceBottomPadding },
          ]}
          scrollEnabled={isSubmissionVisible}
          showsVerticalScrollIndicator={isSubmissionVisible}
          bounces={isSubmissionVisible}
          scrollIndicatorInsets={{ bottom: insets.bottom }}
        >
          {!isSubmissionVisible && (
            <View style={styles.promptContainer}>
              <Text style={[styles.promptLabel, { color: theme.textSecondary }]}>
                Meaning
              </Text>
              <Text style={[styles.promptText, { color: theme.textColor }]}>
                {currentQuestion.meanings.join(", ")}
              </Text>
              {currentQuestion.readings.length > 0 && (
                <>
                  <Text
                    style={[
                      styles.promptLabel,
                      { color: theme.textSecondary, marginTop: 8 },
                    ]}
                  >
                    Reading
                  </Text>
                  <Text
                    style={[styles.promptReading, { color: theme.textSecondary }]}
                  >
                    {currentQuestion.readings.join(", ")}
                  </Text>
                </>
              )}
            </View>
          )}

          <KanjiFreehandQuiz
            key={currentQuestionKey}
            character={currentQuestion.character}
            onComplete={handleComplete}
            onSkip={handleSkip}
            onUnavailable={handleUnavailable}
            onSubmissionStateChange={setIsSubmissionVisible}
            leniency={strokeLeniency}
          />
        </ScrollView>
      </SafeAreaView>
    </>
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  exitButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  progressInfo: {
    alignItems: "center",
  },
  progressText: {
    fontSize: 16,
    fontWeight: "600",
  },
  progressBar: {
    height: 4,
    marginHorizontal: 16,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  practiceContainer: {
    flex: 1,
  },
  practiceContentContainer: {
    padding: 16,
    alignItems: "center",
    paddingBottom: 28,
  },
  promptContainer: {
    alignItems: "center",
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  promptLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  promptText: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
  },
  promptReading: {
    fontSize: 20,
    textAlign: "center",
  },
  resultsContainer: {
    padding: 24,
    paddingBottom: 16,
    alignItems: "center",
  },
  resultsTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
  },
  resultsSubtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  statsGrid: {
    width: "100%",
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
  },
  statLabel: {
    fontSize: 14,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  kanjiGrid: {
    width: "100%",
  },
  kanjiRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  kanjiCard: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  kanjiHeader: {
    padding: 12,
    alignItems: "center",
  },
  kanjiCharacter: {
    fontSize: 32,
    color: "white",
    fontWeight: "bold",
  },
  kanjiInfo: {
    padding: 12,
  },
  kanjiMeaning: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  kanjiStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  mistakeCount: {
    fontSize: 14,
    fontWeight: "600",
  },
  statusText: {
    fontSize: 12,
  },
  similarityText: {
    fontSize: 12,
    marginTop: 4,
  },
  stickyButtonContainer: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  actionButtons: {
    width: "100%",
    marginTop: 24,
    gap: 12,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  secondaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
