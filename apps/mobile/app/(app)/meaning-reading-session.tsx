import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import ReviewQuestionScreen from "../../src/components/ReviewQuestionScreen";
import ReviewResultsScreen from "../../src/components/ReviewResultsScreen";
import { useSession } from "../../src/contexts/AuthContext";
import { Subject as ApiSubject, Assignment, getAllAssignmentsCached } from "../../src/utils/api";
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
import { useAuthStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

interface MRQuestion {
  id: number;
  subject: ApiSubject;
  questionType: "reading";
}

interface MRReviewItem {
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

interface MeaningReadingSessionConfig {
  includeKanji: boolean;
  includeVocabulary: boolean;
  includeKanaVocabulary: boolean;
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

interface MeaningReadingProgressState {
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

interface MeaningReadingSavedSession {
  savedAt: number;
  config: MeaningReadingSessionConfig;
  questions: MRQuestion[];
  currentIndex: number;
  reviewItems: MRReviewItem[];
  progress: MeaningReadingProgressState;
  kanjiVocabularyHintMap: Record<number, string[]>;
}

const DEFAULT_SRS_GROUPS = {
  apprentice: true,
  guru: true,
  master: true,
  enlightened: true,
  burned: true,
};

const EMPTY_PROGRESS_STATE: MeaningReadingProgressState = {
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

const KANJI_VOCAB_HINT_MAX = 5;
const KANJI_VOCAB_HINT_CANDIDATE_LIMIT = KANJI_VOCAB_HINT_MAX * 4;
const RESULTS_TRANSITION_DELAY_MS = 2000;
const MEANING_READING_SESSION_KEY =
  EXTRA_STUDY_SESSION_STORAGE_KEYS.MEANING_READING;

function getPrimaryMeaning(subject: ApiSubject | null | undefined): string | null {
  if (!subject) {
    return null;
  }

  const primaryMeaning = subject.data.meanings?.find((meaning: any) => meaning.primary)?.meaning;
  const fallbackMeaning = subject.data.meanings?.[0]?.meaning;
  const resolved = (primaryMeaning || fallbackMeaning || "").trim();
  return resolved.length > 0 ? resolved : null;
}

async function buildKanjiVocabularyHintMap(
  questions: MRQuestion[],
): Promise<Record<number, string[]>> {
  const kanjiCandidateIdsBySubjectId = new Map<number, number[]>();
  const candidateVocabularyIds = new Set<number>();

  for (const question of questions) {
    if (question.subject.object !== "kanji") {
      continue;
    }

    const candidateIds = Array.isArray((question.subject.data as any).amalgamation_subject_ids)
      ? ((question.subject.data as any).amalgamation_subject_ids as number[]).slice(
          0,
          KANJI_VOCAB_HINT_CANDIDATE_LIMIT,
        )
      : [];

    if (candidateIds.length === 0) {
      continue;
    }

    kanjiCandidateIdsBySubjectId.set(question.subject.id, candidateIds);
    candidateIds.forEach((candidateId) => candidateVocabularyIds.add(candidateId));
  }

  if (kanjiCandidateIdsBySubjectId.size === 0 || candidateVocabularyIds.size === 0) {
    return {};
  }

  const subjectById = new Map<number, ApiSubject>();
  await Promise.all(
    Array.from(candidateVocabularyIds).map(async (subjectId) => {
      const subject = await getSubjectById(subjectId);
      if (subject) {
        subjectById.set(subjectId, subject);
      }
    }),
  );

  const hintsByKanjiId: Record<number, string[]> = {};

  for (const [kanjiId, candidateIds] of kanjiCandidateIdsBySubjectId.entries()) {
    const meanings: string[] = [];
    const seenMeanings = new Set<string>();

    for (const candidateId of candidateIds) {
      const candidateSubject = subjectById.get(candidateId);
      if (!candidateSubject) {
        continue;
      }
      if (candidateSubject.object !== "vocabulary") {
        continue;
      }

      const meaning = getPrimaryMeaning(candidateSubject);
      if (!meaning) {
        continue;
      }

      const normalizedMeaning = meaning.toLowerCase();
      if (seenMeanings.has(normalizedMeaning)) {
        continue;
      }

      seenMeanings.add(normalizedMeaning);
      meanings.push(meaning);

      if (meanings.length >= KANJI_VOCAB_HINT_MAX) {
        break;
      }
    }

    if (meanings.length > 0) {
      hintsByKanjiId[kanjiId] = meanings;
    }
  }

  return hintsByKanjiId;
}

export default function MeaningReadingSessionScreen() {
  const { theme } = useTheme();
  const { apiToken } = useAuthStore();
  const { isLoading: isAuthLoading } = useSession();
  const params = useLocalSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [questions, setQuestions] = useState<MRQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewItems, setReviewItems] = useState<MRReviewItem[]>([]);
  const [progress, setProgress] = useState<MeaningReadingProgressState>(
    EMPTY_PROGRESS_STATE,
  );
  const [isComplete, setIsComplete] = useState(false);
  const [config, setConfig] = useState<MeaningReadingSessionConfig | null>(null);
  const [kanjiVocabularyHintMap, setKanjiVocabularyHintMap] = useState<
    Record<number, string[]>
  >({});
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const completionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearCompletionTimeout = useCallback(() => {
    if (completionTimeoutRef.current) {
      clearTimeout(completionTimeoutRef.current);
      completionTimeoutRef.current = null;
    }
  }, []);

  const clearSavedMeaningReadingSession = useCallback(async () => {
    await clearExtraStudySessionState(MEANING_READING_SESSION_KEY);
  }, []);

  const restoreSavedMeaningReadingSession = useCallback(async (): Promise<boolean> => {
    const savedSession = await loadExtraStudySessionState<MeaningReadingSavedSession>(
      MEANING_READING_SESSION_KEY,
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
      await clearSavedMeaningReadingSession();
      return false;
    }

    const safeIndex = Math.max(
      0,
      Math.min(savedSession.currentIndex || 0, savedSession.questions.length - 1),
    );

    clearCompletionTimeout();
    setConfig(savedSession.config);
    setQuestions(savedSession.questions);
    setCurrentIndex(safeIndex);
    setReviewItems(savedSession.reviewItems);
    setProgress({
      ...EMPTY_PROGRESS_STATE,
      ...(savedSession.progress || {}),
    });
    setKanjiVocabularyHintMap(savedSession.kanjiVocabularyHintMap || {});
    setIsComplete(false);
    setHasRestoredSession(true);
    setIsLoading(false);
    return true;
  }, [clearCompletionTimeout, clearSavedMeaningReadingSession]);

  const saveMeaningReadingSessionForLater = useCallback(async (): Promise<boolean> => {
    if (!config || questions.length === 0 || isComplete) {
      return false;
    }

    const payload: MeaningReadingSavedSession = {
      savedAt: Date.now(),
      config,
      questions,
      currentIndex,
      reviewItems,
      progress,
      kanjiVocabularyHintMap,
    };

    return saveExtraStudySessionState(MEANING_READING_SESSION_KEY, payload);
  }, [
    config,
    currentIndex,
    isComplete,
    kanjiVocabularyHintMap,
    progress,
    questions,
    reviewItems,
  ]);

  const loadConfig = useCallback(async () => {
    try {
      const shouldResume = params.resume === "true";
      if (shouldResume) {
        const restored = await restoreSavedMeaningReadingSession();
        if (restored) {
          return;
        }
      }

      setHasRestoredSession(false);

      if (params.sessionId) {
        const configData = await AsyncStorage.getItem(`meaning_reading_config_${params.sessionId}`);
        if (configData) {
          const parsed = JSON.parse(configData);
          setConfig({
            includeKanji: parsed.includeKanji ?? false,
            includeVocabulary: parsed.includeVocabulary,
            includeKanaVocabulary: parsed.includeKanaVocabulary,
            numberOfQuestions: parsed.numberOfQuestions,
            srsGroups: {
              ...DEFAULT_SRS_GROUPS,
              ...(parsed.srsGroups || {}),
            },
            useCustomLevelRange: parsed.useCustomLevelRange ?? false,
            minLevel: parsed.minLevel ?? 1,
            maxLevel: parsed.maxLevel ?? 60,
            selectedListIds: parseSelectedListIds(parsed.selectedListIds),
          });
          await AsyncStorage.removeItem(`meaning_reading_config_${params.sessionId}`);
        } else {
          throw new Error("Config not found in storage");
        }
      } else {
        setConfig({
          includeKanji: params.includeKanji === 'true',
          includeVocabulary: params.includeVocabulary === 'true',
          includeKanaVocabulary: params.includeKanaVocabulary === 'true',
          numberOfQuestions: parseInt(params.numberOfQuestions as string, 10),
          srsGroups: {
            apprentice: params.srsApprentice !== 'false',
            guru: params.srsGuru !== 'false',
            master: params.srsMaster !== 'false',
            enlightened: params.srsEnlightened !== 'false',
            burned: params.srsBurned !== 'false',
          },
          useCustomLevelRange: params.useCustomLevelRange === 'true',
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
      console.error('Failed to load meaning→reading config:', error);
      Alert.alert("Error", "Failed to load test configuration.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [params.includeKanaVocabulary, params.includeKanji, params.includeVocabulary, params.maxLevel, params.minLevel, params.numberOfQuestions, params.resume, params.selectedListIds, params.sessionId, params.srsApprentice, params.srsBurned, params.srsEnlightened, params.srsGuru, params.srsMaster, params.useCustomLevelRange, restoreSavedMeaningReadingSession]);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  useEffect(
    () => () => {
      clearCompletionTimeout();
    },
    [clearCompletionTimeout],
  );

  const loadQuestions = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    if (!apiToken) {
      setIsLoading(false);
      return;
    }
    if (!config) return;

    try {
      clearCompletionTimeout();
      await clearSavedMeaningReadingSession();
      setIsLoading(true);
      setIsComplete(false);
      setKanjiVocabularyHintMap({});

      const assignmentsResponse = await getAllAssignmentsCached(apiToken, {
        srs_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9],
      });
      if (assignmentsResponse.data.length === 0) {
        Alert.alert(
          "No Learned Items",
          "You haven't learned enough items yet to take a test.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      const subjectIds = assignmentsResponse.data.map((a: Assignment) => a.data.subject_id);

      const allSubjects: ApiSubject[] = [];
      for (const subjectId of subjectIds) {
        const subject = await getSubjectById(subjectId);
        if (subject) allSubjects.push(subject);
      }

      // Build subject -> srs_stage map
      const subjectIdToStage = new Map<number, number>();
      (assignmentsResponse.data as any[]).forEach((a) => subjectIdToStage.set(a.data.subject_id, a.data.srs_stage));
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

      const filtered = allSubjects.filter((s: ApiSubject) => {
        const isSupportedType =
          s.object === "kanji" ||
          s.object === "vocabulary" ||
          s.object === "kana_vocabulary";
        if (!isSupportedType) return false;
        if (!config.includeKanji && s.object === "kanji") return false;
        if (!config.includeVocabulary && s.object === 'vocabulary') return false;
        if (!config.includeKanaVocabulary && s.object === 'kana_vocabulary') return false;

        const stage = subjectIdToStage.get(s.id) ?? 0;
        if (!srsStageAllowed(stage)) return false;

        const inLevelRange = !config.useCustomLevelRange || ((s as any).data?.level >= config.minLevel && (s as any).data?.level <= config.maxLevel);
        return (
          inLevelRange &&
          subjectMatchesSelectedLists(
            s.id,
            config.selectedListIds || [],
            selectedListSubjectIds
          )
        );
      });

      if (filtered.length === 0) {
        Alert.alert(
          "No Matching Items",
          "No learned subjects match your selected criteria.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      const selected: MRQuestion[] = [];
      const used = new Set<number>();
      const maxAttempts = config.numberOfQuestions * 10;
      let attempts = 0;
      while (selected.length < config.numberOfQuestions && attempts < maxAttempts) {
        attempts++;
        const s = filtered[Math.floor(Math.random() * filtered.length)];
        if (used.has(s.id)) continue;
        used.add(s.id);
        selected.push({ id: selected.length, subject: s, questionType: "reading" });
      }

      const shuffled = selected.sort(() => Math.random() - 0.5);
      if (shuffled.length === 0) {
        Alert.alert("No Questions Generated", "Could not generate questions.", [{ text: "OK", onPress: () => router.back() }]);
        return;
      }
      const hintsByKanjiId = await buildKanjiVocabularyHintMap(shuffled);
      setQuestions(shuffled);
      setKanjiVocabularyHintMap(hintsByKanjiId);
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
          Alert.alert("Offline", "No cached subjects available. Please open the app online once to cache data.", [{ text: "OK", onPress: () => router.back() }]);
          return;
        }

        // This mode supports kanji, vocabulary, and kana_vocabulary.
        const filtered = (allSubjectsRaw as ApiSubject[]).filter((s) => {
          const isSupportedType =
            s.object === "kanji" ||
            s.object === "vocabulary" ||
            s.object === "kana_vocabulary";
          if (!isSupportedType) return false;
          if (!config.includeKanji && s.object === "kanji") return false;
          if (!config.includeVocabulary && s.object === "vocabulary") return false;
          if (!config.includeKanaVocabulary && s.object === "kana_vocabulary") return false;
          const inLevelRange = !config.useCustomLevelRange || ((s as any).data?.level >= config.minLevel && (s as any).data?.level <= config.maxLevel);
          return (
            inLevelRange &&
            subjectMatchesSelectedLists(
              s.id,
              config.selectedListIds || [],
              selectedListSubjectIds
            )
          );
        });

        if (filtered.length === 0) {
          Alert.alert("No Matching Items", "No cached subjects match your selected criteria.", [{ text: "OK", onPress: () => router.back() }]);
          return;
        }

        const max = Math.min(config.numberOfQuestions, filtered.length);
        const pool = [...filtered];
        // unbiased partial Fisher–Yates: fill first `max` positions, then slice head
        for (let i = 0; i < max; i++) {
          const j = i + Math.floor(Math.random() * (pool.length - i));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        const chosen = pool.slice(0, max);
        const selected = chosen.map((s, idx) => ({ id: idx, subject: s, questionType: 'reading' as const }));
        if (selected.length === 0) {
          Alert.alert("No Questions Generated", "Could not generate questions offline.", [{ text: "OK", onPress: () => router.back() }]);
          return;
        }
        const hintsByKanjiId = await buildKanjiVocabularyHintMap(selected);
        setQuestions(selected);
        setKanjiVocabularyHintMap(hintsByKanjiId);
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
      } catch (fallbackErr) {
        console.error("Offline fallback failed:", fallbackErr);
        Alert.alert("Error", "Failed to load questions.", [{ text: "OK", onPress: () => router.back() }]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [apiToken, clearCompletionTimeout, clearSavedMeaningReadingSession, config, isAuthLoading]);

  useEffect(() => {
    if (config && !hasRestoredSession) {
      loadQuestions();
    }
  }, [config, hasRestoredSession, loadQuestions]);

  const handleAnswer = (
    item: { id: number; subject: any },
    questionType: "meaning" | "reading",
    isCorrect: boolean,
    wasIncorrect: boolean
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
          readingIncorrectCounted: wasIncorrect || !isCorrect,
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
      clearCompletionTimeout();
      completionTimeoutRef.current = setTimeout(() => {
        setIsComplete(true);
        completionTimeoutRef.current = null;
      }, RESULTS_TRANSITION_DELAY_MS);
    }
  };

  const handleSkip = useCallback(
    (item: { id: number; subject: any }, _questionType: "meaning" | "reading") => {
      clearCompletionTimeout();
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
    [clearCompletionTimeout, currentIndex]
  );

  useEffect(() => {
    if (isComplete) {
      void clearSavedMeaningReadingSession();
    }
  }, [clearSavedMeaningReadingSession, isComplete]);

  const handleBackToDashboard = () => {
    void clearSavedMeaningReadingSession();
    router.dismissAll();
    router.replace("/");
  };

  const handleExit = () => {
    Alert.alert(
      "Exit Test",
      "Want to continue this reading test later?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue Later",
          onPress: async () => {
            clearCompletionTimeout();
            const wasSaved = await saveMeaningReadingSessionForLater();
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
            await clearSavedMeaningReadingSession();
            router.back();
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.secondary} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>Preparing your reading test...</Text>
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
        onSecondaryAction={() => router.replace("/meaning-reading-config")}
      />
    );
  }

  if (questions.length === 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>No test questions available</Text>
          <TouchableOpacity style={[styles.errorButton, { backgroundColor: theme.secondary }]} onPress={() => router.back()}> 
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

  const primaryMeaning = current.subject.data.meanings?.find((m: any) => m.primary)?.meaning || current.subject.data.meanings?.[0]?.meaning || "";
  const alternativeMeanings = current.subject.data.meanings
    ?.filter((m: any) => !m.primary)
    ?.map((m: any) => m.meaning)
    ?.join(", ") || "";
  const vocabularyMeaningHintsForKanji = current.subject.object === "kanji"
    ? (kanjiVocabularyHintMap[current.subject.id] || [])
    : [];
  const defaultContextHints = (current.subject.data as any).context_sentences
    ?.filter((s: any) => s.en)
    .map((s: any) => ({ en: s.en }));
  const joinedKanjiHintText = vocabularyMeaningHintsForKanji.join(", ");
  const hintsForCurrentQuestion = current.subject.object === "kanji"
    ? (joinedKanjiHintText ? [{ en: joinedKanjiHintText }] : [])
    : defaultContextHints;
  const contextHintMaxItems = current.subject.object === "kanji" ? 1 : 3;

  // Prepare readings, ensuring kana_vocabulary has a reading fallback
  const originalCharacters = current.subject.data.characters;
  const readingsForItem = (current.subject.data.readings && current.subject.data.readings.length > 0)
    ? current.subject.data.readings.map((r: any) => ({ reading: r.reading, primary: r.primary, type: r.type, accepted_answer: r.accepted_answer }))
    : (current.subject.object === 'kana_vocabulary' && originalCharacters
        ? [{ reading: originalCharacters, primary: true, type: 'kunyomi', accepted_answer: true }]
        : undefined);

  return (
    <ReviewQuestionScreen
      item={{
        id: current.id,
        srsStage: currentReviewItem?.srsStage,
        subject: {
          id: current.subject.id,
          object: (current.subject.object === 'kana_vocabulary' ? 'vocabulary' : current.subject.object) as "radical" | "kanji" | "vocabulary" | "kana_vocabulary",
          data: {
            level: current.subject.data.level,
            // Keep characters so the previous-answer card shows the vocab text
            characters: current.subject.data.characters,
            meanings: current.subject.data.meanings.map((m: any) => ({ meaning: m.meaning, primary: m.primary, accepted_answer: m.accepted_answer })),
            readings: readingsForItem,
            character_images: undefined,
            pronunciation_audios:
              current.subject.data.pronunciation_audios || undefined,
          }
        }
      }}
      questionType={"reading"}
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
      // Override prompt to show English meaning instead of characters
      overridePromptText={primaryMeaning}
      overridePromptSubtext={alternativeMeanings || undefined}
      // Pass context sentences (English only) as hints to disambiguate similar meanings
      contextSentencesHint={hintsForCurrentQuestion}
      contextHintMaxItems={contextHintMaxItems}
      // In this specific mode, allow either reading kana or vocab characters (kanji) as correct.
      acceptCharactersAsCorrectForReading={true}
      // In this mode, reveal both subject characters and reading in Anki/paused answer cards.
      showCharactersAndReadingForReadingQuestion={true}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 16, fontSize: 16 },
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16 },
  errorText: { fontSize: 18, textAlign: "center", marginBottom: 20 },
  errorButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  errorButtonText: { color: "white", fontSize: 16, fontWeight: "bold" },
  resultsContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
  resultsTitle: { fontSize: 28, fontWeight: "bold", marginBottom: 16, textAlign: "center" },
  resultsScore: { fontSize: 48, fontWeight: "bold", marginBottom: 8 },
  resultsAccuracy: { fontSize: 20, marginBottom: 32, textAlign: "center" },
  resultsButtons: { width: "100%", gap: 16 },
  resultButton: { paddingVertical: 16, paddingHorizontal: 24, borderRadius: 12, alignItems: "center" },
  secondaryButton: { backgroundColor: "transparent", borderWidth: 2 },
  resultButtonText: { color: "white", fontSize: 18, fontWeight: "bold" },
  resultButtonTextSecondary: { fontSize: 18, fontWeight: "bold" },
});
