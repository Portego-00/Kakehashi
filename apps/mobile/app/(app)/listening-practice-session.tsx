import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio, type AudioSound } from "@/src/utils/expoAvCompat";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AudioSessionManager from "../../src/modules/AudioSessionManager";
import { useSession } from "../../src/contexts/AuthContext";
import { fontStyles } from "../../src/utils/fonts";
import ListeningQuestionScreen from "../../src/components/ListeningQuestionScreen";
import { generateListeningQuestionsProgressively } from "../../src/services/listeningPracticeService";
import type {
  ListeningAnswer,
  ListeningPracticeConfig,
  ListeningQuestion,
  ListeningSolutionMode,
} from "../../src/types/listening";
import { getStudyMaterials } from "../../src/utils/api";
import { parseSelectedListIds } from "../../src/utils/extraStudySubjectLists";
import {
  EXTRA_STUDY_SESSION_STORAGE_KEYS,
  clearExtraStudySessionState,
  loadExtraStudySessionState,
  saveExtraStudySessionState,
} from "../../src/utils/extraStudySessionPersistence";
import { useSubjectColors } from "../../src/utils/subjectColors";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

const RESULTS_TRANSITION_DELAY_MS = 2000;
const LISTENING_PRACTICE_SESSION_KEY =
  EXTRA_STUDY_SESSION_STORAGE_KEYS.LISTENING_PRACTICE;

interface ListeningPracticeSavedSession {
  savedAt: number;
  questions: ListeningQuestion[];
  currentIndex: number;
  answers: ListeningAnswer[];
  currentQuestionPhase: "kanji" | "meaning";
  lastCompletedItem: {
    id: number;
    characters: string;
    meaning: string;
    isCorrect: boolean;
  } | null;
  expectedTotalQuestions: number;
  solutionMode: ListeningSolutionMode;
  studyMaterialEntries: [number, { meaning_synonyms?: string[] }][];
}

export default function ListeningPracticeSession() {
  const { theme } = useTheme();
  const { apiToken, userData } = useAuthStore();
  const { isLoading: isAuthLoading } = useSession();
  const {
    immersionKitAnimes,
    listeningAutoPlayAudio,
    acceptUserSynonymsAsAnswers,
    autoSwitchKeyboard,
  } = useSettingsStore();
  const params = useLocalSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [questions, setQuestions] = useState<ListeningQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<ListeningAnswer[]>([]);
  const [currentQuestionPhase, setCurrentQuestionPhase] = useState<
    "kanji" | "meaning"
  >("kanji");
  const [isComplete, setIsComplete] = useState(false);
  const [lastCompletedItem, setLastCompletedItem] = useState<{
    id: number;
    characters: string;
    meaning: string;
    isCorrect: boolean;
  } | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [expectedTotalQuestions, setExpectedTotalQuestions] = useState(0);
  const [solutionMode, setSolutionMode] =
    useState<ListeningSolutionMode>("multiple_choice");
  const [studyMaterialsMap, setStudyMaterialsMap] = useState<
    Map<number, { meaning_synonyms?: string[] }>
  >(new Map());
  const generatorRef = useRef<AsyncGenerator<{ question: ListeningQuestion; progress: number; total: number }> | null>(null);
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearCompletionTimeout = useCallback(() => {
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
  }, []);

  const clearSavedListeningPracticeSession = useCallback(async () => {
    await clearExtraStudySessionState(LISTENING_PRACTICE_SESSION_KEY);
  }, []);

  const restoreSavedListeningPracticeSession = useCallback(async (): Promise<boolean> => {
    const savedSession = await loadExtraStudySessionState<ListeningPracticeSavedSession>(
      LISTENING_PRACTICE_SESSION_KEY,
    );
    if (!savedSession) {
      return false;
    }

    if (!Array.isArray(savedSession.questions) || savedSession.questions.length === 0) {
      await clearSavedListeningPracticeSession();
      return false;
    }

    const safeIndex = Math.max(
      0,
      Math.min(savedSession.currentIndex || 0, savedSession.questions.length - 1),
    );
    const normalizedEntries = Array.isArray(savedSession.studyMaterialEntries)
      ? savedSession.studyMaterialEntries.filter(
          (entry): entry is [number, { meaning_synonyms?: string[] }] =>
            Array.isArray(entry) &&
            entry.length === 2 &&
            typeof entry[0] === "number" &&
            !!entry[1] &&
            typeof entry[1] === "object",
        )
      : [];

    clearCompletionTimeout();
    generatorRef.current = null;
    setQuestions(savedSession.questions);
    setCurrentIndex(safeIndex);
    setAnswers(Array.isArray(savedSession.answers) ? savedSession.answers : []);
    setCurrentQuestionPhase(
      savedSession.currentQuestionPhase === "meaning" ? "meaning" : "kanji",
    );
    setLastCompletedItem(savedSession.lastCompletedItem ?? null);
    setExpectedTotalQuestions(
      typeof savedSession.expectedTotalQuestions === "number"
        ? savedSession.expectedTotalQuestions
        : savedSession.questions.length,
    );
    setSolutionMode(
      savedSession.solutionMode === "writing" ? "writing" : "multiple_choice",
    );
    setStudyMaterialsMap(new Map(normalizedEntries));
    setIsLoadingMore(false);
    setIsComplete(false);
    setIsLoading(false);
    return true;
  }, [clearCompletionTimeout, clearSavedListeningPracticeSession]);

  const saveListeningPracticeSessionForLater = useCallback(async (): Promise<boolean> => {
    if (
      isComplete ||
      questions.length === 0 ||
      currentIndex < 0 ||
      currentIndex >= questions.length
    ) {
      return false;
    }

    const payload: ListeningPracticeSavedSession = {
      savedAt: Date.now(),
      questions,
      currentIndex,
      answers,
      currentQuestionPhase,
      lastCompletedItem,
      expectedTotalQuestions,
      solutionMode,
      studyMaterialEntries: Array.from(studyMaterialsMap.entries()),
    };

    return saveExtraStudySessionState(LISTENING_PRACTICE_SESSION_KEY, payload);
  }, [
    answers,
    currentIndex,
    currentQuestionPhase,
    expectedTotalQuestions,
    isComplete,
    lastCompletedItem,
    questions,
    solutionMode,
    studyMaterialsMap,
  ]);

  const loadStudyMaterialsForQuestions = useCallback(
    async (questionsToLoad: ListeningQuestion[]) => {
      if (
        !acceptUserSynonymsAsAnswers ||
        !apiToken ||
        questionsToLoad.length === 0
      ) {
        return;
      }

      const subjectIds = Array.from(
        new Set(questionsToLoad.map((q) => q.vocab.id)),
      );

      try {
        const studyMaterialsResponse = await getStudyMaterials(apiToken, {
          subject_ids: subjectIds,
        });

        const materialsMap = new Map<number, { meaning_synonyms?: string[] }>();
        if (studyMaterialsResponse?.data) {
          studyMaterialsResponse.data.forEach((material: any) => {
            if (material.data?.subject_id) {
              materialsMap.set(material.data.subject_id, {
                meaning_synonyms: material.data.meaning_synonyms || [],
              });
            }
          });
        }

        if (materialsMap.size > 0) {
          setStudyMaterialsMap((prev) => {
            const updated = new Map(prev);
            materialsMap.forEach((value, key) => {
              updated.set(key, value);
            });
            return updated;
          });
        }
      } catch (error) {
        console.warn(
          "[ListeningSession] Failed to load study materials for synonyms:",
          error,
        );
      }
    },
    [acceptUserSynonymsAsAnswers, apiToken],
  );

  // Load config and generate questions
  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!apiToken) {
      setIsLoading(false);
      return;
    }

    loadConfigAndGenerateQuestions(apiToken);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiToken, isAuthLoading]);

  const loadConfigAndGenerateQuestions = async (token: string) => {
    try {
      const shouldResume = params.resume === "true";
      if (shouldResume) {
        const restored = await restoreSavedListeningPracticeSession();
        if (restored) {
          return;
        }
        if (!params.sessionId) {
          Alert.alert(
            "Session Not Available",
            "Couldn't restore that listening practice session.",
            [{ text: "OK", onPress: () => router.replace("/listening-practice-config") }],
          );
          return;
        }
      }

      clearCompletionTimeout();
      await clearSavedListeningPracticeSession();
      setIsLoading(true);
      setIsComplete(false);
      setStudyMaterialsMap(new Map());

      // Try to load config from AsyncStorage first
      let config: ListeningPracticeConfig;

      if (params.sessionId) {
        const storedConfig = await AsyncStorage.getItem(
          `listening_config_${params.sessionId}`
        );
        if (storedConfig) {
          const parsedStoredConfig = JSON.parse(
            storedConfig
          ) as ListeningPracticeConfig;
          config = {
            ...parsedStoredConfig,
            selectedListIds: parseSelectedListIds(
              parsedStoredConfig.selectedListIds
            ),
          };
        } else {
          throw new Error("Config not found in storage");
        }
      } else {
        // Fallback: parse from URL params
        config = {
          includeVocabulary: params.includeVocabulary === "true",
          includeKanaVocabulary: params.includeKanaVocabulary === "true",
          solutionMode:
            params.solutionMode === "writing" ? "writing" : "multiple_choice",
          numberOfQuestions: parseInt(params.numberOfQuestions as string) || 10,
          srsGroups: {
            apprentice: params.srsApprentice === "true",
            guru: params.srsGuru === "true",
            master: params.srsMaster === "true",
            enlightened: params.srsEnlightened === "true",
            burned: params.srsBurned === "true",
          },
          useCustomLevelRange: params.useCustomLevelRange === "true",
          minLevel: parseInt(params.minLevel as string) || 1,
          maxLevel:
            parseInt(params.maxLevel as string) || userData?.level || 60,
          sessionAnimes: params.sessionAnimes
            ? JSON.parse(params.sessionAnimes as string)
            : null,
          selectedListIds: parseSelectedListIds(
            typeof params.selectedListIds === "string"
              ? (params.selectedListIds as string).split(",")
              : []
          ),
        };
      }

      // Use global anime settings if no session-specific ones
      if (!config.sessionAnimes) {
        config.sessionAnimes = immersionKitAnimes;
      }

      const normalizedSolutionMode: ListeningSolutionMode =
        config.solutionMode === "writing" ? "writing" : "multiple_choice";
      config.solutionMode = normalizedSolutionMode;
      setSolutionMode(normalizedSolutionMode);

      if (normalizedSolutionMode === "writing" && !autoSwitchKeyboard) {
        setIsLoading(false);
        Alert.alert(
          "Japanese Keyboard Required",
          "Enable \"Switch to Japanese Keyboard\" before starting listening writing mode.",
          [{ text: "OK", onPress: () => router.replace("/listening-practice-config") }]
        );
        return;
      }

      console.log("[ListeningSession] Loaded config:", config);
      setExpectedTotalQuestions(config.numberOfQuestions);

      // Start progressive loading
      const generator = generateListeningQuestionsProgressively(
        config,
        token,
        userData?.level || 1
      );
      generatorRef.current = generator;

      // Load the first question immediately
      const firstResult = await generator.next();
      if (firstResult.done || !firstResult.value) {
        Alert.alert(
          "No Questions Available",
          "Could not find enough vocabulary with anime examples. Try adjusting your settings or selecting more anime sources.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      // Set the first question and dismiss loading screen
      setQuestions([firstResult.value.question]);
      setIsLoading(false);

      // Load study materials for the first question in the background.
      // This enables user synonyms for early answers in the session.
      loadStudyMaterialsForQuestions([firstResult.value.question]);

      // Preload the first question's image
      if (firstResult.value.question.example.imageUrl) {
        Image.prefetch(firstResult.value.question.example.imageUrl).catch((err) =>
          console.log(
            `[ListeningSession] Failed to preload image: ${firstResult.value.question.example.imageUrl}`,
            err
          )
        );
      }

      // Load remaining questions in the background
      setIsLoadingMore(true);
      loadRemainingQuestions(generator, firstResult.value.total);
    } catch (error) {
      console.error("[ListeningSession] Error loading questions:", error);

      // Check if it's a rate limit error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.startsWith("RATE_LIMIT:")) {
        const message = errorMessage.replace("RATE_LIMIT:", "");
        Alert.alert("Rate Limit Exceeded", message, [
          { text: "OK", onPress: () => router.back() },
        ]);
      } else {
        Alert.alert(
          "Error",
          "Failed to load listening practice questions. Please try again.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      }
    }
  };

  useEffect(
    () => () => {
      clearCompletionTimeout();
    },
    [clearCompletionTimeout],
  );

  const loadRemainingQuestions = async (
    generator: AsyncGenerator<{ question: ListeningQuestion; progress: number; total: number }>,
    total: number
  ) => {
    const loadedQuestions: ListeningQuestion[] = [];

    try {
      for await (const { question } of generator) {
        loadedQuestions.push(question);

        // Update questions array progressively
        setQuestions((prev) => [...prev, question]);

        // Preload image for this question
        if (question.example.imageUrl) {
          Image.prefetch(question.example.imageUrl).catch((err) =>
            console.log(
              `[ListeningSession] Failed to preload image: ${question.example.imageUrl}`,
              err
            )
          );
        }

        console.log(
          `[ListeningSession] Loaded question ${loadedQuestions.length + 1}/${total} in background`
        );
      }

      setIsLoadingMore(false);
      console.log(
        `[ListeningSession] Finished loading all ${loadedQuestions.length + 1} questions`
      );
    } catch (error) {
      console.error("[ListeningSession] Error loading remaining questions:", error);
      setIsLoadingMore(false);

      // Calculate how many questions we managed to load
      const currentQuestionCount = questions.length;
      const expectedQuestions = total;
      const missingQuestions = expectedQuestions - currentQuestionCount;

      // Check if it's a rate limit error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.startsWith("RATE_LIMIT:")) {
        Alert.alert(
          "Rate Limit Exceeded",
          `We couldn't load ${missingQuestions} question${
            missingQuestions === 1 ? "" : "s"
          } due to rate limiting.\n\nYour practice session will have ${currentQuestionCount} question${
            currentQuestionCount === 1 ? "" : "s"
          } instead of ${expectedQuestions}.`,
          [{ text: "OK" }]
        );
      } else {
        // Show error for other failures during background loading
        Alert.alert(
          "Loading Error",
          `We couldn't load all questions. Your practice session will have ${currentQuestionCount} question${
            currentQuestionCount === 1 ? "" : "s"
          } instead of ${expectedQuestions}.`,
          [{ text: "OK" }]
        );
      }
    } finally {
      // Load study materials for whichever background questions were loaded.
      loadStudyMaterialsForQuestions(loadedQuestions);
    }
  };

  const handleKanjiAnswer = (isCorrect: boolean, kanjiAnswer: string) => {
    console.log(
      `[ListeningSession] Kanji answer: ${kanjiAnswer}, correct: ${isCorrect}`
    );

    // Store kanji answer temporarily (we'll complete the full answer after meaning phase)
    setAnswers((prev) => {
      const newAnswers = [...prev];
      const currentQuestion = questions[currentIndex];

      // Update or create answer record
      const existingIndex = newAnswers.findIndex(
        (a) => a.vocab.id === currentQuestion.vocab.id
      );

      const answerRecord: ListeningAnswer = {
        vocab: currentQuestion.vocab,
        example: currentQuestion.example,
        kanjiCorrect: isCorrect,
        meaningCorrect: false, // Will be updated in meaning phase
        kanjiAnswer: kanjiAnswer,
        meaningAnswer: "", // Will be updated in meaning phase
      };

      if (existingIndex >= 0) {
        newAnswers[existingIndex] = answerRecord;
      } else {
        newAnswers.push(answerRecord);
      }

      return newAnswers;
    });

    // Move to meaning phase
    setCurrentQuestionPhase("meaning");
  };

  const handleMeaningAnswer = (isCorrect: boolean, meaningAnswer: string) => {
    console.log(
      `[ListeningSession] Meaning answer: ${meaningAnswer}, correct: ${isCorrect}`
    );

    // Complete the answer record
    setAnswers((prev) => {
      const newAnswers = [...prev];
      const lastAnswer = newAnswers[newAnswers.length - 1];
      if (lastAnswer) {
        lastAnswer.meaningCorrect = isCorrect;
        lastAnswer.meaningAnswer = meaningAnswer;
      }
      return newAnswers;
    });

    // Track last completed item for "previous item" UI
    const currentQuestion = questions[currentIndex];
    // Determine correctness (meaning is correct here, check previous kanji answer)
    // We can't rely on the 'answers' state updated in the closure above immediately.
    // But we know 'meaningAnswer' is correct if isCorrect is true.
    // We need to look up the kanji correctness.
    const kanjiWasCorrect =
      answers.find((a) => a.vocab.id === currentQuestion.vocab.id)
        ?.kanjiCorrect ?? false;

    setLastCompletedItem({
      id: currentQuestion.vocab.id,
      characters: currentQuestion.vocab.data.characters ?? "",
      meaning: currentQuestion.vocab.data.meanings[0].meaning,
      isCorrect: kanjiWasCorrect && isCorrect,
    });

    // Move to next question or complete
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentQuestionPhase("kanji");
    } else {
      clearCompletionTimeout();
      completionTimeoutRef.current = setTimeout(() => {
        setIsComplete(true);
        completionTimeoutRef.current = null;
      }, RESULTS_TRANSITION_DELAY_MS);
    }
  };

  // Accuracy Calculation
  // We need to count total correct responses (both kanji and meaning) vs total attempts so far
  const totalAttempts = answers.reduce((acc, a) => {
    let count = 0;
    if (a.kanjiAnswer) count++;
    if (a.meaningAnswer) count++;
    return acc + count;
  }, 0);

  const correctCount = answers.reduce((acc, a) => {
    let count = 0;
    if (a.kanjiCorrect) count++;
    if (a.meaningCorrect) count++;
    return acc + count;
  }, 0);

  const accuracyPercent =
    totalAttempts > 0 ? Math.round((correctCount / totalAttempts) * 100) : 100;

  // Total Correct answers for display (simple count of correct phases)
  const correctAnswers = correctCount;

  useEffect(() => {
    if (isComplete) {
      void clearSavedListeningPracticeSession();
    }
  }, [clearSavedListeningPracticeSession, isComplete]);

  const handleExit = () => {
    Alert.alert(
      "Exit Listening Practice?",
      "Want to continue this listening practice later?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue Later",
          onPress: async () => {
            clearCompletionTimeout();
            const wasSaved = await saveListeningPracticeSessionForLater();
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
            await clearSavedListeningPracticeSession();
            router.back();
          },
        },
      ]
    );
  };

  // Calculate stats
  const kanjiCorrectCount = answers.filter((a) => a.kanjiCorrect).length;
  const meaningCorrectCount = answers.filter((a) => a.meaningCorrect).length;

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <StatusBar style={theme.statusBarStyle} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>
            Finding audio examples...
          </Text>
          <Text style={[styles.loadingSubtext, { color: theme.textSecondary }]}>
            This may take a moment
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isComplete) {
    const kanjiAccuracy =
      answers.length > 0
        ? Math.round((kanjiCorrectCount / answers.length) * 100)
        : 0;
    const meaningAccuracy =
      answers.length > 0
        ? Math.round((meaningCorrectCount / answers.length) * 100)
        : 0;

    return (
      <SummaryScreen
        theme={theme}
        answers={answers}
        accuracyPercent={accuracyPercent}
        kanjiCorrectCount={kanjiCorrectCount}
        meaningCorrectCount={meaningCorrectCount}
        kanjiAccuracy={kanjiAccuracy}
        meaningAccuracy={meaningAccuracy}
        onBack={() => {
          void clearSavedListeningPracticeSession();
          router.back();
        }}
        onPracticeAgain={() => {
          if (!apiToken) {
            return;
          }

          clearCompletionTimeout();
          void clearSavedListeningPracticeSession();
          setIsLoading(true);
          setQuestions([]);
          setCurrentIndex(0);
          setAnswers([]);
          setCurrentQuestionPhase("kanji");
          setIsComplete(false);
          setIsLoadingMore(false);
          setExpectedTotalQuestions(0);
          setStudyMaterialsMap(new Map());
          generatorRef.current = null;
          loadConfigAndGenerateQuestions(apiToken);
        }}
      />
    );
  }

  if (questions.length === 0) {
    return null;
  }

  const currentQuestion = questions[currentIndex];

  return (
    <ListeningQuestionScreen
      question={currentQuestion}
      questionPhase={currentQuestionPhase}
      solutionMode={solutionMode}
      useJapaneseKeyboard={autoSwitchKeyboard}
      onKanjiAnswer={handleKanjiAnswer}
      onMeaningAnswer={handleMeaningAnswer}
      onExit={handleExit}
      currentItem={currentIndex + 1}
      totalItems={questions.length}
      correctAnswersCount={correctAnswers}
      accuracyPercent={accuracyPercent}
      lastCompletedItem={lastCompletedItem}
      isLoadingMore={isLoadingMore}
      expectedTotalQuestions={expectedTotalQuestions}
      autoPlayAudio={listeningAutoPlayAudio}
      studyMaterials={
        acceptUserSynonymsAsAnswers
          ? studyMaterialsMap.get(currentQuestion.vocab.id)
          : undefined
      }
    />
  );
}

// ─── Summary Answer Card ─────────────────────────────────────────────
function SummaryAnswerCard({
  answer,
  index,
  theme,
}: {
  answer: ListeningAnswer;
  index: number;
  theme: any;
}) {
  const subjectColors = useSubjectColors();
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const soundRef = useRef<AudioSound | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
        soundRef.current = null;
      }
    };
  }, []);

  const playAudio = useCallback(async () => {
    if (isPlayingAudio || isLoadingAudio || !answer.example.audio) return;

    try {
      setIsLoadingAudio(true);

      if (Platform.OS === "ios") {
        try {
          await AudioSessionManager.overrideSpeaker();
        } catch {
          // Ignore
        }
      }

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: answer.example.audio },
        { shouldPlay: true, volume: 1.0 }
      );

      setIsLoadingAudio(false);
      setIsPlayingAudio(true);
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlayingAudio(false);
          sound.unloadAsync();
          soundRef.current = null;
        }
      });
    } catch (error) {
      console.error("[Summary] Failed to play audio:", error);
      setIsLoadingAudio(false);
      setIsPlayingAudio(false);
    }
  }, [isPlayingAudio, isLoadingAudio, answer.example.audio]);

  const bothCorrect = answer.kanjiCorrect && answer.meaningCorrect;
  const vocabText = answer.vocab.data.characters || "";
  const primaryMeaning = answer.vocab.data.meanings[0]?.meaning || "";

  // Render sentence with highlighted vocab
  const renderHighlightedSentence = () => {
    const sentence = answer.example.sentence;
    const parts = sentence.split(vocabText);

    if (parts.length === 1 || !vocabText) {
      return (
        <Text style={[summaryStyles.sentenceText, fontStyles.japaneseText, { color: theme.textColor }]}>
          {sentence}
        </Text>
      );
    }

    return (
      <Text style={[summaryStyles.sentenceText, fontStyles.japaneseText, { color: theme.textColor }]}>
        {parts[0]}
        <Text
          style={[
            summaryStyles.highlightedVocab,
            bothCorrect
              ? { backgroundColor: "rgba(76, 175, 80, 0.2)", color: "#4caf50" }
              : { backgroundColor: "rgba(244, 67, 54, 0.2)", color: "#f44336" },
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
      {/* Card Header: Vocab pill + meaning + correctness */}
      <View style={summaryStyles.cardHeader}>
        <View style={summaryStyles.cardHeaderLeft}>
          <Text style={[summaryStyles.questionNumber, { color: theme.textSecondary }]}>
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
              {vocabText}
            </Text>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <Text style={[summaryStyles.vocabMeaning, { color: theme.textSecondary }]}>
            {primaryMeaning}
          </Text>
        </View>
        <View style={summaryStyles.correctnessIndicators}>
          <View style={summaryStyles.indicatorRow}>
            <Text style={[summaryStyles.indicatorLabel, { color: theme.textSecondary }]}>
              Vocab
            </Text>
            <View
              style={[
                summaryStyles.indicatorDot,
                { backgroundColor: answer.kanjiCorrect ? "#4caf50" : "#f44336" },
              ]}
            >
              <Ionicons
                name={answer.kanjiCorrect ? "checkmark" : "close"}
                size={10}
                color="white"
              />
            </View>
          </View>
          <View style={summaryStyles.indicatorRow}>
            <Text style={[summaryStyles.indicatorLabel, { color: theme.textSecondary }]}>
              Meaning
            </Text>
            <View
              style={[
                summaryStyles.indicatorDot,
                { backgroundColor: answer.meaningCorrect ? "#4caf50" : "#f44336" },
              ]}
            >
              <Ionicons
                name={answer.meaningCorrect ? "checkmark" : "close"}
                size={10}
                color="white"
              />
            </View>
          </View>
        </View>
      </View>

      {/* Image + Audio Row */}
      <View style={summaryStyles.mediaRow}>
        {answer.example.imageUrl ? (
          <Image
            source={{ uri: answer.example.imageUrl }}
            style={summaryStyles.cardImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[summaryStyles.cardImagePlaceholder, { backgroundColor: theme.border }]}>
            <Ionicons name="image-outline" size={24} color={theme.textSecondary} />
          </View>
        )}
        {answer.example.audio && (
          <TouchableOpacity
            onPress={playAudio}
            style={[
              summaryStyles.audioButton,
              {
                backgroundColor: isPlayingAudio ? theme.primary : (theme.isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)"),
                borderColor: isPlayingAudio ? theme.primary : theme.border,
              },
            ]}
            disabled={isPlayingAudio || isLoadingAudio}
            activeOpacity={0.7}
          >
            {isLoadingAudio ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons
                name={isPlayingAudio ? "volume-high" : "play"}
                size={18}
                color={isPlayingAudio ? "white" : theme.primary}
              />
            )}
            <Text
              style={[
                summaryStyles.audioButtonText,
                { color: isPlayingAudio ? "white" : theme.primary },
              ]}
            >
              {isPlayingAudio ? "Playing..." : "Replay"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Sentence */}
      <View style={[summaryStyles.sentenceContainer, { backgroundColor: theme.isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" }]}>
        {renderHighlightedSentence()}
        <Text style={[summaryStyles.translationText, { color: theme.textSecondary }]}>
          {answer.example.translation}
        </Text>
      </View>

      {/* Your Answers */}
      <View style={summaryStyles.yourAnswersRow}>
        <View style={summaryStyles.yourAnswerItem}>
          <Text style={[summaryStyles.yourAnswerLabel, { color: theme.textSecondary }]}>
            Your vocabulary answer
          </Text>
          <Text
            style={[
              summaryStyles.yourAnswerValue,
              fontStyles.japaneseText,
              {
                color: answer.kanjiCorrect ? "#4caf50" : "#f44336",
              },
            ]}
          >
            {answer.kanjiAnswer || "—"}
          </Text>
        </View>
        <View style={summaryStyles.yourAnswerItem}>
          <Text style={[summaryStyles.yourAnswerLabel, { color: theme.textSecondary }]}>
            Your meaning answer
          </Text>
          <Text
            style={[
              summaryStyles.yourAnswerValue,
              {
                color: answer.meaningCorrect ? "#4caf50" : "#f44336",
              },
            ]}
          >
            {answer.meaningAnswer || "—"}
          </Text>
        </View>
      </View>
    </View>
  );
}

// ─── Summary Screen ──────────────────────────────────────────────────
function SummaryScreen({
  theme,
  answers,
  accuracyPercent,
  kanjiCorrectCount,
  meaningCorrectCount,
  kanjiAccuracy,
  meaningAccuracy,
  onBack,
  onPracticeAgain,
}: {
  theme: any;
  answers: ListeningAnswer[];
  accuracyPercent: number;
  kanjiCorrectCount: number;
  meaningCorrectCount: number;
  kanjiAccuracy: number;
  meaningAccuracy: number;
  onBack: () => void;
  onPracticeAgain: () => void;
}) {
  // Determine score color
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

      {/* Header */}
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
        {/* Score Overview */}
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
            <Text style={[summaryStyles.scoreCircleLabel, { color: theme.textSecondary }]}>
              Overall
            </Text>
          </View>

          <View style={summaryStyles.scoreDetailsCol}>
            <View style={summaryStyles.scoreDetailRow}>
              <Ionicons name="language-outline" size={16} color={theme.textSecondary} />
              <Text style={[summaryStyles.scoreDetailLabel, { color: theme.textColor }]}>
                Vocabulary
              </Text>
              <Text
                style={[
                  summaryStyles.scoreDetailValue,
                  { color: getScoreColor(kanjiAccuracy) },
                ]}
              >
                {kanjiCorrectCount}/{answers.length} ({kanjiAccuracy}%)
              </Text>
            </View>
            <View style={summaryStyles.scoreDetailRow}>
              <Ionicons name="chatbox-ellipses-outline" size={16} color={theme.textSecondary} />
              <Text style={[summaryStyles.scoreDetailLabel, { color: theme.textColor }]}>
                Meaning
              </Text>
              <Text
                style={[
                  summaryStyles.scoreDetailValue,
                  { color: getScoreColor(meaningAccuracy) },
                ]}
              >
                {meaningCorrectCount}/{answers.length} ({meaningAccuracy}%)
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

        {/* Section Title */}
        <Text style={[summaryStyles.sectionTitle, { color: theme.textColor }]}>
          Question Details
        </Text>

        {/* Answer Cards */}
        {answers.map((answer, index) => (
          <SummaryAnswerCard
            key={`${answer.vocab.id}-${index}`}
            answer={answer}
            index={index}
            theme={theme}
          />
        ))}

        {/* Action Buttons */}
        <View style={summaryStyles.actionsContainer}>
          <TouchableOpacity
            style={[
              summaryStyles.actionButton,
              summaryStyles.actionButtonSecondary,
              { borderColor: theme.border },
            ]}
            onPress={onBack}
          >
            <Ionicons name="home" size={20} color={theme.textColor} style={{ marginRight: 8 }} />
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
            <Ionicons name="refresh" size={20} color="white" style={{ marginRight: 8 }} />
            <Text style={summaryStyles.actionButtonPrimaryText}>Practice Again</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Summary Styles ──────────────────────────────────────────────────
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
  // Score Overview
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
  // Section
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  // Answer Card
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
    backgroundColor: "transparent",
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
  // Media Row
  mediaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  cardImage: {
    width: 100,
    height: 60,
    borderRadius: 8,
  },
  cardImagePlaceholder: {
    width: 100,
    height: 60,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  audioButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  audioButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Sentence
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
    borderRadius: 4,
  },
  translationText: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
    fontStyle: "italic",
  },
  // Your Answers
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
  // Actions
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
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  loadingSubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});
