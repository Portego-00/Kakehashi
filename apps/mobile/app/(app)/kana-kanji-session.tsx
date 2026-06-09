import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ReviewQuestionScreen from "../../src/components/ReviewQuestionScreen";
import ReviewResultsScreen from "../../src/components/ReviewResultsScreen";
import { useSession } from "../../src/contexts/AuthContext";
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
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF]/;

interface KanaKanjiQuestion {
  id: number;
  subject: ApiSubject;
  questionType: "reading";
}

interface KanaKanjiReviewItem {
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

interface KanaKanjiConfig {
  numberOfQuestions: number;
  srsGroups: {
    apprentice: boolean;
    guru: boolean;
    master: boolean;
    enlightened: boolean;
    burned: boolean;
  };
  useCustomLevelRange: boolean;
  minLevel: number;
  maxLevel: number;
  selectedListIds: string[];
}

interface KanaKanjiProgressState {
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

interface KanaKanjiSavedSession {
  savedAt: number;
  config: KanaKanjiConfig;
  questions: KanaKanjiQuestion[];
  currentIndex: number;
  reviewItems: KanaKanjiReviewItem[];
  progress: KanaKanjiProgressState;
}

const EMPTY_PROGRESS_STATE: KanaKanjiProgressState = {
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

const KANA_KANJI_SESSION_KEY = EXTRA_STUDY_SESSION_STORAGE_KEYS.KANA_KANJI;

export default function KanaKanjiSessionScreen() {
  const { theme } = useTheme();
  const { apiToken } = useAuthStore();
  const { isLoading: isAuthLoading } = useSession();
  const { autoSwitchKeyboard } = useSettingsStore();
  const params = useLocalSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [questions, setQuestions] = useState<KanaKanjiQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewItems, setReviewItems] = useState<KanaKanjiReviewItem[]>([]);
  const [progress, setProgress] = useState({
    ...EMPTY_PROGRESS_STATE,
  });
  const [isComplete, setIsComplete] = useState(false);
  const [config, setConfig] = useState<KanaKanjiConfig | null>(null);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);

  const clearSavedKanaKanjiSession = useCallback(async () => {
    await clearExtraStudySessionState(KANA_KANJI_SESSION_KEY);
  }, []);

  const restoreSavedKanaKanjiSession = useCallback(async (): Promise<boolean> => {
    const savedSession = await loadExtraStudySessionState<KanaKanjiSavedSession>(
      KANA_KANJI_SESSION_KEY,
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
      await clearSavedKanaKanjiSession();
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
    setIsComplete(false);
    setHasRestoredSession(true);
    setIsLoading(false);
    return true;
  }, [clearSavedKanaKanjiSession]);

  const saveKanaKanjiSessionForLater = useCallback(async (): Promise<boolean> => {
    if (
      !config ||
      isComplete ||
      questions.length === 0 ||
      currentIndex < 0 ||
      currentIndex >= questions.length
    ) {
      return false;
    }

    const payload: KanaKanjiSavedSession = {
      savedAt: Date.now(),
      config,
      questions,
      currentIndex,
      reviewItems,
      progress,
    };

    return saveExtraStudySessionState(KANA_KANJI_SESSION_KEY, payload);
  }, [config, currentIndex, isComplete, progress, questions, reviewItems]);

  const loadConfig = useCallback(async () => {
    try {
      const shouldResume = params.resume === "true";
      if (shouldResume) {
        const restored = await restoreSavedKanaKanjiSession();
        if (restored) {
          return;
        }
        if (!params.sessionId) {
          Alert.alert(
            "Session Not Available",
            "Couldn't restore that kana to kanji session.",
            [{ text: "OK", onPress: () => router.replace("/kana-kanji-config") }],
          );
          return;
        }
      }

      setHasRestoredSession(false);

      if (params.sessionId) {
        const configData = await AsyncStorage.getItem(
          `kana_kanji_config_${params.sessionId}`,
        );
        if (configData) {
          const parsed = JSON.parse(configData);
          setConfig({
            numberOfQuestions: parsed.numberOfQuestions,
            srsGroups: parsed.srsGroups || {
              apprentice: true,
              guru: true,
              master: true,
              enlightened: true,
              burned: true,
            },
            useCustomLevelRange: parsed.useCustomLevelRange ?? false,
            minLevel: parsed.minLevel ?? 1,
            maxLevel: parsed.maxLevel ?? 60,
            selectedListIds: parseSelectedListIds(parsed.selectedListIds),
          });
          await AsyncStorage.removeItem(`kana_kanji_config_${params.sessionId}`);
        } else {
          throw new Error("Config not found in storage");
        }
      } else {
        setConfig({
          numberOfQuestions: parseInt(params.numberOfQuestions as string, 10),
          srsGroups: {
            apprentice: params.srsApprentice !== "false",
            guru: params.srsGuru !== "false",
            master: params.srsMaster !== "false",
            enlightened: params.srsEnlightened !== "false",
            burned: params.srsBurned !== "false",
          },
          useCustomLevelRange: params.useCustomLevelRange === "true",
          minLevel: params.minLevel ? parseInt(params.minLevel as string, 10) : 1,
          maxLevel: params.maxLevel ? parseInt(params.maxLevel as string, 10) : 60,
          selectedListIds: parseSelectedListIds(
            typeof params.selectedListIds === "string"
              ? (params.selectedListIds as string).split(",")
              : []
          ),
        });
      }
    } catch (error) {
      console.error("Failed to load kana->kanji config:", error);
      Alert.alert("Error", "Failed to load test configuration.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [
    params.maxLevel,
    params.minLevel,
    params.numberOfQuestions,
    params.resume,
    params.selectedListIds,
    params.sessionId,
    params.srsApprentice,
    params.srsBurned,
    params.srsEnlightened,
    params.srsGuru,
    params.srsMaster,
    params.useCustomLevelRange,
    restoreSavedKanaKanjiSession,
  ]);

  useEffect(() => {
    loadConfig();
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

    if (!autoSwitchKeyboard) {
      setIsLoading(false);
      Alert.alert(
        "Japanese Keyboard Required",
        "Enable \"Switch to Japanese Keyboard\" before starting Kana to Kanji mode.",
        [{ text: "OK", onPress: () => router.replace("/kana-kanji-config") }],
      );
      return;
    }

    try {
      setIsLoading(true);
      await clearSavedKanaKanjiSession();

      const assignmentsResponse = await getAllAssignmentsCached(apiToken, {
        srs_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      });

      if (assignmentsResponse.data.length === 0) {
        Alert.alert(
          "No Learned Items",
          "You haven't learned enough items yet to take a test.",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }

      const subjectIds = assignmentsResponse.data.map(
        (assignment: Assignment) => assignment.data.subject_id,
      );

      const allSubjects: ApiSubject[] = [];
      for (const subjectId of subjectIds) {
        const subject = await getSubjectById(subjectId);
        if (subject) {
          allSubjects.push(subject);
        }
      }

      const subjectIdToStage = new Map<number, number>();
      assignmentsResponse.data.forEach((assignment: any) => {
        subjectIdToStage.set(assignment.data.subject_id, assignment.data.srs_stage);
      });
      const selectedListSubjectIds = await getSelectedListSubjectIdSet(
        config.selectedListIds || []
      );

      const srsStageAllowed = (stage: number) => {
        if (stage >= 1 && stage <= 4) return config.srsGroups.apprentice;
        if (stage >= 5 && stage <= 6) return config.srsGroups.guru;
        if (stage === 7) return config.srsGroups.master;
        if (stage === 8) return config.srsGroups.enlightened;
        if (stage === 9) return config.srsGroups.burned;
        return false;
      };

      const filtered = allSubjects.filter((subject) => {
        if (subject.object !== "vocabulary") {
          return false;
        }

        const characters = subject.data?.characters ?? "";
        if (!KANJI_REGEX.test(characters)) {
          return false;
        }

        const stage = subjectIdToStage.get(subject.id) ?? 0;
        if (!srsStageAllowed(stage)) return false;

        const level = (subject as any).data?.level;
        const inLevelRange =
          !config.useCustomLevelRange ||
          (level >= config.minLevel && level <= config.maxLevel);

        return (
          inLevelRange &&
          subjectMatchesSelectedLists(
            subject.id,
            config.selectedListIds || [],
            selectedListSubjectIds
          )
        );
      });

      if (filtered.length === 0) {
        Alert.alert(
          "No Matching Items",
          "No learned kanji vocabulary items match your selected criteria.",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }

      const selected: KanaKanjiQuestion[] = [];
      const used = new Set<number>();
      const maxAttempts = config.numberOfQuestions * 10;
      let attempts = 0;

      while (selected.length < config.numberOfQuestions && attempts < maxAttempts) {
        attempts += 1;
        const randomSubject = filtered[Math.floor(Math.random() * filtered.length)];
        if (used.has(randomSubject.id)) {
          continue;
        }

        used.add(randomSubject.id);
        selected.push({
          id: selected.length,
          subject: randomSubject,
          questionType: "reading",
        });
      }

      const shuffled = selected.sort(() => Math.random() - 0.5);
      if (shuffled.length === 0) {
        Alert.alert("No Questions Generated", "Could not generate questions.", [
          { text: "OK", onPress: () => router.back() },
        ]);
        return;
      }

      setQuestions(shuffled);
      setReviewItems(
        shuffled.map((question, index) => ({
          id: question.id,
          assignmentId: -(index + 1),
          subjectId: question.subject.id,
          subject: question.subject,
          srsStage: subjectIdToStage.get(question.subject.id),
          meaningDone: false,
          readingDone: false,
          meaningApplicable: false,
          readingApplicable: true,
          meaningIncorrect: 0,
          readingIncorrect: 0,
          meaningCorrectlyAnswered: false,
          readingCorrectlyAnswered: false,
          meaningIncorrectCounted: false,
          readingIncorrectCounted: false,
        }))
      );
      setProgress({
        ...EMPTY_PROGRESS_STATE,
        total: shuffled.length,
        totalItems: shuffled.length,
      });
    } catch (error) {
      console.warn("Falling back to offline subjects-only mode due to error:", error);

      try {
        const allSubjectsRaw = await getAllSubjects();
        const selectedListSubjectIds = await getSelectedListSubjectIdSet(
          config.selectedListIds || []
        );
        if (!allSubjectsRaw || allSubjectsRaw.length === 0) {
          Alert.alert(
            "Offline",
            "No cached subjects available. Please open the app online once to cache data.",
            [{ text: "OK", onPress: () => router.back() }],
          );
          return;
        }

        const filtered = (allSubjectsRaw as ApiSubject[]).filter((subject) => {
          if (subject.object !== "vocabulary") {
            return false;
          }

          const characters = subject.data?.characters ?? "";
          if (!KANJI_REGEX.test(characters)) {
            return false;
          }

          const level = (subject as any).data?.level;
          const inLevelRange =
            !config.useCustomLevelRange ||
            (level >= config.minLevel && level <= config.maxLevel);
          return (
            inLevelRange &&
            subjectMatchesSelectedLists(
              subject.id,
              config.selectedListIds || [],
              selectedListSubjectIds
            )
          );
        });

        if (filtered.length === 0) {
          Alert.alert(
            "No Matching Items",
            "No cached kanji vocabulary items match your selected criteria.",
            [{ text: "OK", onPress: () => router.back() }],
          );
          return;
        }

        const max = Math.min(config.numberOfQuestions, filtered.length);
        const pool = [...filtered];
        for (let index = 0; index < max; index += 1) {
          const randomIndex =
            index + Math.floor(Math.random() * (pool.length - index));
          [pool[index], pool[randomIndex]] = [pool[randomIndex], pool[index]];
        }

        const chosen = pool.slice(0, max);
        const selected = chosen.map((subject, index) => ({
          id: index,
          subject,
          questionType: "reading" as const,
        }));

        if (selected.length === 0) {
          Alert.alert(
            "No Questions Generated",
            "Could not generate questions offline.",
            [{ text: "OK", onPress: () => router.back() }],
          );
          return;
        }

        setQuestions(selected);
        setReviewItems(
          selected.map((question, index) => ({
            id: question.id,
            assignmentId: -(index + 1),
            subjectId: question.subject.id,
            subject: question.subject,
            meaningDone: false,
            readingDone: false,
            meaningApplicable: false,
            readingApplicable: true,
            meaningIncorrect: 0,
            readingIncorrect: 0,
            meaningCorrectlyAnswered: false,
            readingCorrectlyAnswered: false,
            meaningIncorrectCounted: false,
            readingIncorrectCounted: false,
          }))
        );
        setProgress({
          ...EMPTY_PROGRESS_STATE,
          total: selected.length,
          totalItems: selected.length,
        });
      } catch (fallbackError) {
        console.error("Offline fallback failed:", fallbackError);
        Alert.alert("Error", "Failed to load questions.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiToken, autoSwitchKeyboard, clearSavedKanaKanjiSession, config, isAuthLoading]);

  useEffect(() => {
    if (config && !hasRestoredSession) {
      loadQuestions();
    }
  }, [config, hasRestoredSession, loadQuestions]);

  const handleAnswer = (
    item: { id: number; subject: any },
    _questionType: "meaning" | "reading",
    isCorrect: boolean,
    _wasIncorrect: boolean,
  ) => {
    setReviewItems((prev) =>
      prev.map((reviewItem) => {
        if (reviewItem.id !== item.id) {
          return reviewItem;
        }

        return {
          ...reviewItem,
          readingDone: true,
          readingCorrectlyAnswered: isCorrect,
          readingIncorrect: isCorrect
            ? reviewItem.readingIncorrect
            : reviewItem.readingIncorrect + 1,
          readingIncorrectCounted: !isCorrect,
        };
      })
    );
    setProgress((prev) => ({
      ...prev,
      current: prev.current + 1,
      answeredCount: prev.answeredCount + 1,
      completedItems: prev.completedItems + 1,
      readingAttempts: prev.readingAttempts + 1,
      readingCorrect: isCorrect ? prev.readingCorrect + 1 : prev.readingCorrect,
      correctAnswersCount: isCorrect
        ? prev.correctAnswersCount + 1
        : prev.correctAnswersCount,
    }));

    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setIsComplete(true);
    }
  };

  const handleSkip = useCallback(
    (item: { id: number; subject: any }, _questionType: "meaning" | "reading") => {
      setReviewItems((prev) =>
        prev.map((reviewItem) =>
          reviewItem.id === item.id
            ? {
                ...reviewItem,
                meaningDone: false,
                readingDone: false,
                meaningIncorrect: 0,
                readingIncorrect: 0,
                meaningCorrectlyAnswered: false,
                readingCorrectlyAnswered: false,
                meaningIncorrectCounted: false,
                readingIncorrectCounted: false,
              }
            : reviewItem
        )
      );

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

      setIsComplete(false);
    },
    [currentIndex]
  );

  const handleExit = () => {
    Alert.alert(
      "Exit Test",
      "Want to continue this test later?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue Later",
          onPress: async () => {
            const wasSaved = await saveKanaKanjiSessionForLater();
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
            await clearSavedKanaKanjiSession();
            router.back();
          },
        },
      ],
    );
  };

  useEffect(() => {
    if (isComplete) {
      void clearSavedKanaKanjiSession();
    }
  }, [clearSavedKanaKanjiSession, isComplete]);

  const handleBackToDashboard = () => {
    void clearSavedKanaKanjiSession();
    router.dismissAll();
    router.replace("/");
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.secondary} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>Preparing your kana to kanji test...</Text>
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
        secondaryActionLabel="Take Another Test"
        onSecondaryAction={() => router.replace("/kana-kanji-config")}
      />
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>No test questions available</Text>
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

  const current = questions[currentIndex];
  const currentReviewItem = reviewItems.find(
    (reviewItem) => reviewItem.subjectId === current.subject.id,
  );
  const sessionProgress = {
    totalItems: questions.length,
    currentItem: progress.answeredCount,
    completedCount: progress.completedItems,
    correctAnswersCount: progress.correctAnswersCount,
  };

  const originalCharacters = current.subject.data.characters;
  const readingsForItem =
    current.subject.data.readings && current.subject.data.readings.length > 0
      ? current.subject.data.readings.map((reading: any) => ({
          reading: reading.reading,
          primary: reading.primary,
          type: reading.type,
          accepted_answer: reading.accepted_answer,
        }))
      : undefined;

  const promptKana =
    readingsForItem?.find((reading: any) => reading.primary)?.reading ||
    readingsForItem?.[0]?.reading ||
    originalCharacters ||
    "";

  return (
    <ReviewQuestionScreen
      item={{
        id: current.id,
        srsStage: currentReviewItem?.srsStage,
        subject: {
          id: current.subject.id,
          object: current.subject.object as
            | "radical"
            | "kanji"
            | "vocabulary"
            | "kana_vocabulary",
          data: {
            level: current.subject.data.level,
            characters: current.subject.data.characters,
            meanings: current.subject.data.meanings.map((meaning: any) => ({
              meaning: meaning.meaning,
              primary: meaning.primary,
              accepted_answer: meaning.accepted_answer,
            })),
            readings: readingsForItem,
            character_images: undefined,
            pronunciation_audios:
              current.subject.data.pronunciation_audios || undefined,
          },
        },
      }}
      questionType="reading"
      onAnswer={handleAnswer}
      onSkip={handleSkip}
      onExit={handleExit}
      showHeader={true}
      showBackgroundColor={true}
      totalItems={sessionProgress.totalItems}
      currentItem={sessionProgress.currentItem}
      completedCount={sessionProgress.completedCount}
      correctAnswersCount={sessionProgress.correctAnswersCount}
      forceDisableAnkiGrouping={true}
      overridePromptText={promptKana}
      overridePromptUsesJapaneseFont={true}
      overridePausedCorrectAnswerText={current.subject.data.characters || undefined}
      contextSentencesHint={(current.subject.data as any).context_sentences
        ?.filter((sentence: any) => sentence.en)
        .map((sentence: any) => ({ en: sentence.en }))}
      acceptCharactersAsCorrectForReading={true}
      requireSubjectCharactersForReading={true}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 16 },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  errorText: { fontSize: 18, textAlign: "center", marginBottom: 20 },
  errorButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  errorButtonText: { color: "white", fontSize: 16, fontWeight: "bold" },
  resultsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  resultsTitle: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  resultsScore: { fontSize: 48, fontWeight: "bold", marginBottom: 8 },
  resultsAccuracy: { fontSize: 20, marginBottom: 32, textAlign: "center" },
  resultsButtons: { width: "100%", gap: 16 },
  resultButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  secondaryButton: { backgroundColor: "transparent", borderWidth: 2 },
  resultButtonText: { color: "white", fontSize: 18, fontWeight: "bold" },
  resultButtonTextSecondary: { fontSize: 18, fontWeight: "bold" },
});
