import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  getRecentRandomTestSubjectIds,
  loadRandomTestSubjectHistory,
  saveRandomTestSubjectHistoryEntry,
  selectRandomTestSubjects,
} from "../../src/utils/randomTestHistory";
import { buildReviewQuestionQueue } from "../../src/utils/reviewOrdering";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

type QuestionType = "meaning" | "reading";
type TestSessionMode = "random-test" | "hiragana-vocab-meaning";

interface TestQuestion {
  id: number;
  subject: ApiSubject;
  questionType: QuestionType;
  isAnkiMode?: boolean;
  requiredTypes?: QuestionType[];
}

interface RandomTestReviewItem {
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

interface SrsGroupsConfig {
  apprentice: boolean;
  guru: boolean;
  master: boolean;
  enlightened: boolean;
  burned: boolean;
}

interface TestSessionConfig {
  includeRadicals: boolean;
  includeKanji: boolean;
  includeVocabulary: boolean;
  includeKanaVocabulary: boolean;
  numberOfQuestions: number;
  includeMeaning: boolean;
  includeReading: boolean;
  srsGroups: SrsGroupsConfig;
  useCustomLevelRange: boolean;
  minLevel: number;
  maxLevel: number;
  selectedListIds: string[];
}

interface RandomTestProgress {
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

const DEFAULT_SRS_GROUPS: SrsGroupsConfig = {
  apprentice: true,
  guru: true,
  master: true,
  enlightened: true,
  burned: true,
};
const REVIEW_MAX_QUESTION_GAP = 10;
const RESULTS_TRANSITION_DELAY_MS = 2000;
const HIRAGANA_VOCAB_MEANING_MODE_PARAM = "hiragana-vocab-meaning";

const createInitialProgressCounters = () => ({
  answeredCount: 0,
  meaningAttempts: 0,
  readingAttempts: 0,
  meaningCorrect: 0,
  readingCorrect: 0,
  correctAnswersCount: 0,
});

type RandomTestProgressCounters = ReturnType<typeof createInitialProgressCounters>;

interface RandomTestSavedSession {
  savedAt: number;
  config: TestSessionConfig;
  testQuestions: TestQuestion[];
  currentQuestionIndex: number;
  reviewItems: RandomTestReviewItem[];
  progressCounters: RandomTestProgressCounters;
}

const RANDOM_TEST_SESSION_KEY = EXTRA_STUDY_SESSION_STORAGE_KEYS.RANDOM_TEST;

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

const hasReadingQuestion = (subject: ApiSubject): boolean => {
  if (subject.object === "radical") {
    return false;
  }

  const readings = subject.data.readings;
  return Array.isArray(readings) && readings.length > 0;
};

function resolveTestSessionMode(rawMode: unknown): TestSessionMode {
  if (
    typeof rawMode === "string" &&
    rawMode.trim() === HIRAGANA_VOCAB_MEANING_MODE_PARAM
  ) {
    return "hiragana-vocab-meaning";
  }
  return "random-test";
}

function normalizeKatakanaToHiragana(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x30a1 && code <= 0x30f6) {
      out += String.fromCodePoint(code - 0x60);
    } else {
      out += ch;
    }
  }
  return out;
}

function getPrimaryReadingAsHiragana(subject: ApiSubject): string | null {
  if (
    subject.object === "kana_vocabulary" &&
    typeof subject.data.characters === "string" &&
    subject.data.characters.trim().length > 0
  ) {
    return normalizeKatakanaToHiragana(subject.data.characters.trim());
  }

  const readings = subject.data.readings;
  if (!Array.isArray(readings) || readings.length === 0) {
    return null;
  }

  const primaryReading = readings.find((reading) => reading.primary) ?? readings[0];
  const rawReading =
    typeof primaryReading?.reading === "string"
      ? primaryReading.reading.trim()
      : "";
  if (!rawReading) {
    return null;
  }

  return normalizeKatakanaToHiragana(rawReading);
}

const TARGET_KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF々〆ヵヶ]/g;

function maskTargetKanjiInSentence(
  sentence: string,
  targetCharacters: string,
): string {
  const trimmedTarget = targetCharacters.trim();
  TARGET_KANJI_REGEX.lastIndex = 0;
  if (!trimmedTarget || !TARGET_KANJI_REGEX.test(trimmedTarget)) {
    return sentence;
  }

  TARGET_KANJI_REGEX.lastIndex = 0;
  let maskedSentence = sentence;
  const maskedTarget = trimmedTarget.replace(TARGET_KANJI_REGEX, "○");
  let replacedExactTarget = false;
  if (maskedTarget !== trimmedTarget) {
    const withExactReplacement = maskedSentence.split(trimmedTarget).join(maskedTarget);
    replacedExactTarget = withExactReplacement !== maskedSentence;
    maskedSentence = withExactReplacement;
  }

  if (replacedExactTarget) {
    return maskedSentence;
  }

  TARGET_KANJI_REGEX.lastIndex = 0;
  const kanjiChunks = Array.from(
    new Set(trimmedTarget.match(TARGET_KANJI_REGEX) ?? []),
  ).sort((a, b) => b.length - a.length);

  for (const chunk of kanjiChunks) {
    maskedSentence = maskedSentence
      .split(chunk)
      .join("○".repeat(chunk.length));
  }

  return maskedSentence;
}

function buildHiraganaMeaningContextHints(
  subject: ApiSubject,
): { ja?: string; en?: string }[] {
  const contextSentences = (subject.data as any).context_sentences;
  if (!Array.isArray(contextSentences) || contextSentences.length === 0) {
    return [];
  }

  const targetCharacters =
    typeof subject.data.characters === "string"
      ? subject.data.characters.trim()
      : "";

  return contextSentences
    .map((sentence: any) => {
      const rawJa = typeof sentence?.ja === "string" ? sentence.ja.trim() : "";
      const maskedJa =
        rawJa && targetCharacters
          ? maskTargetKanjiInSentence(rawJa, targetCharacters)
          : rawJa;

      // For this quiz mode, hide translations so hints don't leak the answer.
      if (!maskedJa) {
        return null;
      }

      return {
        ja: maskedJa || undefined,
      };
    })
    .filter((hint): hint is { ja?: string; en?: string } => Boolean(hint));
}

const getAvailableQuestionTypes = (
  subject: ApiSubject,
  config: TestSessionConfig,
): QuestionType[] => {
  const types: QuestionType[] = [];

  if (config.includeMeaning) {
    types.push("meaning");
  }

  if (config.includeReading && hasReadingQuestion(subject)) {
    types.push("reading");
  }

  return types;
};

const countCompletedItems = (reviewItems: RandomTestReviewItem[]): number => {
  return reviewItems.filter((item) => {
    const needsMeaning = item.meaningApplicable;
    const needsReading = item.readingApplicable;

    if (!needsMeaning && !needsReading) {
      return false;
    }

    if (needsMeaning && !item.meaningDone) {
      return false;
    }

    if (needsReading && !item.readingDone) {
      return false;
    }

    return true;
  }).length;
};

interface RandomQueueBehaviorOptions {
  groupQuestions: boolean;
  backToBack: boolean;
  questionTypeOrderEnabled: boolean;
  questionTypeOrder: QuestionType;
  maxQuestionGap: number;
}

const buildRandomTestSession = (
  subjects: ApiSubject[],
  config: TestSessionConfig,
  queueBehavior: RandomQueueBehaviorOptions,
  selectionOptions: {
    avoidSubjectIds?: ReadonlySet<number>;
  } = {},
): {
  questions: TestQuestion[];
  reviewItems: RandomTestReviewItem[];
} => {
  const candidates = subjects.filter(
    (subject) => getAvailableQuestionTypes(subject, config).length > 0,
  );

  if (candidates.length === 0) {
    return { questions: [], reviewItems: [] };
  }

  const maxSubjects = Math.min(config.numberOfQuestions, candidates.length);
  const selectedSubjects = selectRandomTestSubjects(candidates, maxSubjects, {
    avoidSubjectIds: selectionOptions.avoidSubjectIds,
  });
  const questions: TestQuestion[] = [];
  const reviewItems: RandomTestReviewItem[] = [];
  const subjectById = new Map<number, ApiSubject>();

  selectedSubjects.forEach((subject, index) => {
    const availableTypes = getAvailableQuestionTypes(subject, config);
    subjectById.set(subject.id, subject);

    reviewItems.push({
      id: subject.id,
      assignmentId: -(index + 1),
      subjectId: subject.id,
      subject,
      meaningDone: false,
      readingDone: false,
      meaningApplicable: availableTypes.includes("meaning"),
      readingApplicable: availableTypes.includes("reading"),
      meaningIncorrect: 0,
      readingIncorrect: 0,
      meaningCorrectlyAnswered: false,
      readingCorrectlyAnswered: false,
      meaningIncorrectCounted: false,
      readingIncorrectCounted: false,
    });

  });

  const pushQuestion = (subjectId: number, questionType: QuestionType) => {
    const subject = subjectById.get(subjectId);
    if (!subject) return;

    questions.push({
      id: questions.length,
      subject,
      questionType,
      isAnkiMode: false,
      requiredTypes: [questionType],
    });
  };

  if (config.includeMeaning && config.includeReading) {
    const queueItems = reviewItems.map((item) => ({
      id: item.id,
      subject: {
        object: item.subject.object as
          | "radical"
          | "kanji"
          | "vocabulary"
          | "kana_vocabulary",
        data: {
          readings: item.subject.data.readings,
        },
      },
    }));

    const orderedQueue = buildReviewQuestionQueue(queueItems, {
      groupQuestions: queueBehavior.groupQuestions,
      backToBack: queueBehavior.backToBack,
      questionTypeOrderEnabled: queueBehavior.questionTypeOrderEnabled,
      questionTypeOrder: queueBehavior.questionTypeOrder,
      maxQuestionGap: queueBehavior.maxQuestionGap,
    });

    orderedQueue.forEach((queueQuestion) => {
      pushQuestion(queueQuestion.itemId, queueQuestion.type);
    });
  } else if (config.includeMeaning) {
    reviewItems.forEach((item) => {
      pushQuestion(item.subjectId, "meaning");
    });
  } else {
    reviewItems.forEach((item) => {
      if (item.readingApplicable) {
        pushQuestion(item.subjectId, "reading");
      }
    });
  }

  return { questions, reviewItems };
};

export default function TestSessionScreen() {
  const { theme } = useTheme();
  const { apiToken } = useAuthStore();
  const { isLoading: isAuthLoading } = useSession();
  const params = useLocalSearchParams();
  const sessionMode = resolveTestSessionMode(params.mode);
  const isHiraganaVocabMeaningMode =
    sessionMode === "hiragana-vocab-meaning";
  const sessionStorageKey = isHiraganaVocabMeaningMode
    ? EXTRA_STUDY_SESSION_STORAGE_KEYS.HIRAGANA_VOCAB_MEANING
    : RANDOM_TEST_SESSION_KEY;
  const configRoute = isHiraganaVocabMeaningMode
    ? "/hiragana-vocab-meaning-config"
    : "/test-config";
  const sessionLabel = isHiraganaVocabMeaningMode
    ? "hiragana vocab quiz"
    : "random test";
  const {
    ankiCardMode,
    ankiGroupQuestions,
    ankiCardModeScope,
    backToBackQuestions,
    reviewQuestionOrderEnabled,
    meaningFirst,
  } = useSettingsStore();
  const preferredQuestionType: QuestionType = meaningFirst ? "meaning" : "reading";

  const [isLoading, setIsLoading] = useState(true);
  const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [reviewItems, setReviewItems] = useState<RandomTestReviewItem[]>([]);
  const [progressCounters, setProgressCounters] = useState(
    createInitialProgressCounters(),
  );
  const [isTestComplete, setIsTestComplete] = useState(false);
  const [config, setConfig] = useState<TestSessionConfig | null>(null);
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

  const clearSavedRandomTestSession = useCallback(async () => {
    await clearExtraStudySessionState(sessionStorageKey);
  }, [sessionStorageKey]);

  const restoreSavedRandomTestSession = useCallback(async (): Promise<boolean> => {
    const savedSession = await loadExtraStudySessionState<RandomTestSavedSession>(
      sessionStorageKey,
    );
    if (!savedSession) {
      return false;
    }

    if (
      !savedSession.config ||
      typeof savedSession.config !== "object" ||
      !Array.isArray(savedSession.testQuestions) ||
      !Array.isArray(savedSession.reviewItems) ||
      savedSession.testQuestions.length === 0
    ) {
      await clearSavedRandomTestSession();
      return false;
    }

    const safeIndex = Math.max(
      0,
      Math.min(
        savedSession.currentQuestionIndex || 0,
        savedSession.testQuestions.length - 1,
      ),
    );

    clearCompletionTimeout();
    setConfig(savedSession.config);
    setTestQuestions(savedSession.testQuestions);
    setCurrentQuestionIndex(safeIndex);
    setReviewItems(savedSession.reviewItems);
    setProgressCounters({
      ...createInitialProgressCounters(),
      ...(savedSession.progressCounters || {}),
    });
    setIsTestComplete(false);
    setHasRestoredSession(true);
    setIsLoading(false);
    return true;
  }, [clearCompletionTimeout, clearSavedRandomTestSession, sessionStorageKey]);

  const saveRandomTestSessionForLater = useCallback(async (): Promise<boolean> => {
    if (
      !config ||
      isTestComplete ||
      testQuestions.length === 0 ||
      currentQuestionIndex >= testQuestions.length
    ) {
      return false;
    }

    const payload: RandomTestSavedSession = {
      savedAt: Date.now(),
      config,
      testQuestions,
      currentQuestionIndex,
      reviewItems,
      progressCounters,
    };

    return saveExtraStudySessionState(sessionStorageKey, payload);
  }, [
    config,
    currentQuestionIndex,
    isTestComplete,
    progressCounters,
    reviewItems,
    sessionStorageKey,
    testQuestions,
  ]);

  const loadConfig = useCallback(async () => {
    try {
      const shouldResume = params.resume === "true";
      if (shouldResume) {
        const restored = await restoreSavedRandomTestSession();
        if (restored) {
          return;
        }
        if (!params.sessionId) {
          Alert.alert(
            "Session Not Available",
            `Couldn't restore that ${sessionLabel}.`,
            [{ text: "OK", onPress: () => router.replace(configRoute as any) }],
          );
          return;
        }
      }

      setHasRestoredSession(false);

      if (params.sessionId) {
        const configStorageKey = isHiraganaVocabMeaningMode
          ? `hiragana_vocab_meaning_config_${params.sessionId}`
          : `test_config_${params.sessionId}`;
        const configData = await AsyncStorage.getItem(configStorageKey);

        if (!configData) {
          throw new Error("Config not found in AsyncStorage");
        }

        const parsedConfig = JSON.parse(configData);
        setConfig({
          includeRadicals: isHiraganaVocabMeaningMode
            ? false
            : parsedConfig.includeRadicals === true,
          includeKanji: isHiraganaVocabMeaningMode
            ? false
            : parsedConfig.includeKanji === true,
          includeVocabulary: parsedConfig.includeVocabulary !== false,
          includeKanaVocabulary: parsedConfig.includeKanaVocabulary !== false,
          numberOfQuestions:
            typeof parsedConfig.numberOfQuestions === "number"
              ? parsedConfig.numberOfQuestions
              : 20,
          includeMeaning:
            isHiraganaVocabMeaningMode
              ? true
              : (parsedConfig.questionTypes?.meaning ??
                parsedConfig.includeMeaning ??
                true),
          includeReading:
            isHiraganaVocabMeaningMode
              ? false
              : (parsedConfig.questionTypes?.reading ??
                parsedConfig.includeReading ??
                true),
          srsGroups: {
            ...DEFAULT_SRS_GROUPS,
            ...(parsedConfig.srsGroups || {}),
          },
          useCustomLevelRange: parsedConfig.useCustomLevelRange ?? false,
          minLevel: parsedConfig.minLevel ?? 1,
          maxLevel:
            parsedConfig.maxLevel ?? useAuthStore.getState().userData?.level ?? 60,
          selectedListIds: parseSelectedListIds(parsedConfig.selectedListIds),
        });

        await AsyncStorage.removeItem(configStorageKey);
        return;
      }

      setConfig({
        includeRadicals:
          !isHiraganaVocabMeaningMode && params.includeRadicals === "true",
        includeKanji:
          !isHiraganaVocabMeaningMode && params.includeKanji === "true",
        includeVocabulary:
          params.includeVocabulary === "true" ||
          (isHiraganaVocabMeaningMode &&
            typeof params.includeVocabulary !== "string"),
        includeKanaVocabulary:
          params.includeKanaVocabulary === "true" ||
          (isHiraganaVocabMeaningMode &&
            typeof params.includeKanaVocabulary !== "string"),
        numberOfQuestions:
          Number.parseInt(params.numberOfQuestions as string, 10) || 20,
        includeMeaning:
          isHiraganaVocabMeaningMode ||
          params.includeMeaning === "true",
        includeReading:
          !isHiraganaVocabMeaningMode && params.includeReading === "true",
        srsGroups: {
          apprentice: params.srsApprentice !== "false",
          guru: params.srsGuru !== "false",
          master: params.srsMaster !== "false",
          enlightened: params.srsEnlightened !== "false",
          burned: params.srsBurned !== "false",
        },
        useCustomLevelRange: params.useCustomLevelRange === "true",
        minLevel: params.minLevel ? parseInt(params.minLevel as string, 10) : 1,
        maxLevel: params.maxLevel
          ? parseInt(params.maxLevel as string, 10)
          : useAuthStore.getState().userData?.level ?? 60,
        selectedListIds: parseSelectedListIds(
          typeof params.selectedListIds === "string"
            ? (params.selectedListIds as string).split(",")
            : [],
        ),
      });
    } catch (error) {
      console.error("Failed to load config:", error);
      Alert.alert("Error", "Failed to load test configuration.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [
    params.includeKanaVocabulary,
    params.includeKanji,
    params.includeMeaning,
    params.includeRadicals,
    params.includeReading,
    params.includeVocabulary,
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
    configRoute,
    isHiraganaVocabMeaningMode,
    restoreSavedRandomTestSession,
    sessionLabel,
  ]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(
    () => () => {
      clearCompletionTimeout();
    },
    [clearCompletionTimeout],
  );

  const initializeSessionState = useCallback(
    (questions: TestQuestion[], items: RandomTestReviewItem[]) => {
      clearCompletionTimeout();
      setTestQuestions(questions);
      setReviewItems(items);
      setCurrentQuestionIndex(0);
      setIsTestComplete(false);
      setProgressCounters(createInitialProgressCounters());
    },
    [clearCompletionTimeout],
  );

  const loadTestQuestions = useCallback(async () => {
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

    const loadRecentRandomTestSubjectIds = async (): Promise<Set<number>> => {
      if (isHiraganaVocabMeaningMode) {
        return new Set();
      }

      try {
        const history = await loadRandomTestSubjectHistory();
        return new Set(getRecentRandomTestSubjectIds(history));
      } catch (historyError) {
        console.warn(
          "Random Test: failed to load recent subject history",
          historyError,
        );
        return new Set();
      }
    };

    const saveGeneratedRandomTestHistory = async (
      items: RandomTestReviewItem[],
    ): Promise<void> => {
      if (isHiraganaVocabMeaningMode) {
        return;
      }

      try {
        await saveRandomTestSubjectHistoryEntry(
          items.map((item) => item.subjectId),
        );
      } catch (historyError) {
        console.warn(
          "Random Test: failed to save recent subject history",
          historyError,
        );
      }
    };

    let avoidRecentRandomTestSubjectIds = new Set<number>();

    try {
      setIsLoading(true);
      await clearSavedRandomTestSession();
      avoidRecentRandomTestSubjectIds = await loadRecentRandomTestSubjectIds();

      let assignmentsResponse: { data: Assignment[] } | null = null;
      try {
        assignmentsResponse = await getAllAssignmentsCached(apiToken, {
          srs_stages: [1, 2, 3, 4, 5, 6, 7, 8, 9],
        });
      } catch {
        console.warn("Assignments fetch failed; will attempt offline-only mode");
      }

      if (assignmentsResponse && assignmentsResponse.data.length === 0) {
        Alert.alert(
          "No Learned Items",
          "You haven't learned enough items yet to take a test. Complete some lessons first!",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }

      if (!assignmentsResponse) {
        throw new Error("Assignments unavailable");
      }

      const subjectIds = assignmentsResponse.data.map(
        (assignment) => assignment.data.subject_id,
      );

      const allSubjects: ApiSubject[] = [];
      for (const subjectId of subjectIds) {
        const subject = await getSubjectById(subjectId);
        if (subject) {
          allSubjects.push(subject);
        }
      }

      const subjectIdToStage = new Map<number, number>();
      assignmentsResponse.data.forEach((assignment) => {
        subjectIdToStage.set(assignment.data.subject_id, assignment.data.srs_stage);
      });

      const selectedListSubjectIds = await getSelectedListSubjectIdSet(
        config.selectedListIds,
      );

      const filteredSubjects = allSubjects.filter((subject) => {
        const stage = subjectIdToStage.get(subject.id) ?? 0;
        if (!isSrsStageAllowed(stage, config.srsGroups)) {
          return false;
        }

        const inLevelRange =
          !config.useCustomLevelRange ||
          ((subject as any).data?.level >= config.minLevel &&
            (subject as any).data?.level <= config.maxLevel);

        if (
          isHiraganaVocabMeaningMode &&
          !getPrimaryReadingAsHiragana(subject)
        ) {
          return false;
        }

        switch (subject.object) {
          case "radical":
            return (
              config.includeRadicals &&
              inLevelRange &&
              subjectMatchesSelectedLists(
                subject.id,
                config.selectedListIds,
                selectedListSubjectIds,
              )
            );
          case "kanji":
            return (
              config.includeKanji &&
              inLevelRange &&
              subjectMatchesSelectedLists(
                subject.id,
                config.selectedListIds,
                selectedListSubjectIds,
              )
            );
          case "vocabulary":
            return (
              config.includeVocabulary &&
              inLevelRange &&
              subjectMatchesSelectedLists(
                subject.id,
                config.selectedListIds,
                selectedListSubjectIds,
              )
            );
          case "kana_vocabulary":
            return (
              config.includeKanaVocabulary &&
              inLevelRange &&
              subjectMatchesSelectedLists(
                subject.id,
                config.selectedListIds,
                selectedListSubjectIds,
              )
            );
          default:
            return false;
        }
      });

      if (filteredSubjects.length === 0) {
        Alert.alert(
          "No Matching Items",
          "No learned items match your selected criteria. Try expanding subject types or SRS stages.",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }

      const shouldUseGroupedQuestions =
        ankiCardMode &&
        ankiGroupQuestions &&
        ankiCardModeScope === "both" &&
        config.includeMeaning &&
        config.includeReading;
      const queueBehavior: RandomQueueBehaviorOptions = {
        groupQuestions: shouldUseGroupedQuestions,
        backToBack: backToBackQuestions && !shouldUseGroupedQuestions,
        questionTypeOrderEnabled: reviewQuestionOrderEnabled,
        questionTypeOrder: preferredQuestionType,
        maxQuestionGap: REVIEW_MAX_QUESTION_GAP,
      };

      const { questions, reviewItems: generatedReviewItems } =
        buildRandomTestSession(filteredSubjects, config, queueBehavior, {
          avoidSubjectIds: avoidRecentRandomTestSubjectIds,
        });
      const reviewItemsWithSrs = generatedReviewItems.map((reviewItem) => ({
        ...reviewItem,
        srsStage: subjectIdToStage.get(reviewItem.subjectId),
      }));

      if (questions.length === 0) {
        Alert.alert(
          "No Questions Generated",
          "Could not generate questions with your selected criteria. Please adjust your settings.",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }

      await saveGeneratedRandomTestHistory(reviewItemsWithSrs);
      initializeSessionState(questions, reviewItemsWithSrs);
    } catch (error) {
      console.warn("Falling back to offline subjects-only mode due to error:", error);

      try {
        const allSubjectsRaw = await getAllSubjects();
        const selectedListSubjectIds = await getSelectedListSubjectIdSet(
          config.selectedListIds,
        );

        if (!allSubjectsRaw || allSubjectsRaw.length === 0) {
          Alert.alert(
            "Offline",
            "No cached subjects available. Please open the app online once to cache data.",
            [{ text: "OK", onPress: () => router.back() }],
          );
          return;
        }

        const filteredSubjects = (allSubjectsRaw as ApiSubject[]).filter((subject) => {
          const inLevelRange =
            !config.useCustomLevelRange ||
            ((subject as any).data?.level >= config.minLevel &&
              (subject as any).data?.level <= config.maxLevel);

          if (
            isHiraganaVocabMeaningMode &&
            !getPrimaryReadingAsHiragana(subject)
          ) {
            return false;
          }

          switch (subject.object) {
            case "radical":
              return (
                config.includeRadicals &&
                inLevelRange &&
                subjectMatchesSelectedLists(
                  subject.id,
                  config.selectedListIds,
                  selectedListSubjectIds,
                )
              );
            case "kanji":
              return (
                config.includeKanji &&
                inLevelRange &&
                subjectMatchesSelectedLists(
                  subject.id,
                  config.selectedListIds,
                  selectedListSubjectIds,
                )
              );
            case "vocabulary":
              return (
                config.includeVocabulary &&
                inLevelRange &&
                subjectMatchesSelectedLists(
                  subject.id,
                  config.selectedListIds,
                  selectedListSubjectIds,
                )
              );
            case "kana_vocabulary":
              return (
                config.includeKanaVocabulary &&
                inLevelRange &&
                subjectMatchesSelectedLists(
                  subject.id,
                  config.selectedListIds,
                  selectedListSubjectIds,
                )
              );
            default:
              return false;
          }
        });

        if (filteredSubjects.length === 0) {
          Alert.alert("No Matching Items", "No cached items match your selected criteria.", [
            { text: "OK", onPress: () => router.back() },
          ]);
          return;
        }

        const shouldUseGroupedQuestions =
          ankiCardMode &&
          ankiGroupQuestions &&
          ankiCardModeScope === "both" &&
          config.includeMeaning &&
          config.includeReading;
        const queueBehavior: RandomQueueBehaviorOptions = {
          groupQuestions: shouldUseGroupedQuestions,
          backToBack: backToBackQuestions && !shouldUseGroupedQuestions,
          questionTypeOrderEnabled: reviewQuestionOrderEnabled,
          questionTypeOrder: preferredQuestionType,
          maxQuestionGap: REVIEW_MAX_QUESTION_GAP,
        };

        const { questions, reviewItems: generatedReviewItems } =
          buildRandomTestSession(filteredSubjects, config, queueBehavior, {
            avoidSubjectIds: avoidRecentRandomTestSubjectIds,
          });

        if (questions.length === 0) {
          Alert.alert(
            "No Questions Generated",
            "Could not generate questions offline with your settings.",
            [{ text: "OK", onPress: () => router.back() }],
          );
          return;
        }

        await saveGeneratedRandomTestHistory(generatedReviewItems);
        initializeSessionState(questions, generatedReviewItems);
      } catch (fallbackError) {
        console.error("Offline fallback failed:", fallbackError);
        Alert.alert("Error", "Failed to load test questions.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  }, [
    ankiCardMode,
    ankiCardModeScope,
    ankiGroupQuestions,
    apiToken,
    backToBackQuestions,
    config,
    isAuthLoading,
    isHiraganaVocabMeaningMode,
    preferredQuestionType,
    reviewQuestionOrderEnabled,
    clearSavedRandomTestSession,
    initializeSessionState,
  ]);

  useEffect(() => {
    if (config && !hasRestoredSession) {
      loadTestQuestions();
    }
  }, [config, hasRestoredSession, loadTestQuestions]);

  const handleAnswer = (
    item: { id: number; subject: any },
    questionType: QuestionType,
    isCorrect: boolean,
    wasIncorrect: boolean,
    isGroupedAnswer: boolean = false,
  ) => {
    const subjectId = item.subject.id;

    setReviewItems((prev) =>
      prev.map((reviewItem) => {
        if (reviewItem.subjectId !== subjectId) {
          return reviewItem;
        }

        if (questionType === "meaning") {
          return {
            ...reviewItem,
            meaningDone: true,
            meaningCorrectlyAnswered: isCorrect,
            meaningIncorrect: isCorrect
              ? reviewItem.meaningIncorrect
              : reviewItem.meaningIncorrect + 1,
            meaningIncorrectCounted: wasIncorrect || !isCorrect,
          };
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
      }),
    );

    setProgressCounters((prev) => ({
      ...prev,
      answeredCount:
        !isGroupedAnswer || questionType === "meaning"
          ? prev.answeredCount + 1
          : prev.answeredCount,
      meaningAttempts:
        questionType === "meaning" ? prev.meaningAttempts + 1 : prev.meaningAttempts,
      readingAttempts:
        questionType === "reading" ? prev.readingAttempts + 1 : prev.readingAttempts,
      meaningCorrect:
        questionType === "meaning" && isCorrect
          ? prev.meaningCorrect + 1
          : prev.meaningCorrect,
      readingCorrect:
        questionType === "reading" && isCorrect
          ? prev.readingCorrect + 1
          : prev.readingCorrect,
      correctAnswersCount:
        isCorrect && (!isGroupedAnswer || questionType === "meaning")
          ? prev.correctAnswersCount + 1
          : prev.correctAnswersCount,
    }));

    if (!isGroupedAnswer || questionType === "reading") {
      if (currentQuestionIndex < testQuestions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
      } else {
        clearCompletionTimeout();
        completionTimeoutRef.current = setTimeout(() => {
          setIsTestComplete(true);
          completionTimeoutRef.current = null;
        }, RESULTS_TRANSITION_DELAY_MS);
      }
    }
  };

  const handleSkip = useCallback(
    (_item: { id: number; subject: any }, _questionType: QuestionType) => {
      clearCompletionTimeout();
      setTestQuestions((prevQuestions) => {
        if (
          currentQuestionIndex < 0 ||
          currentQuestionIndex >= prevQuestions.length ||
          prevQuestions.length <= 1
        ) {
          return prevQuestions;
        }

        const reordered = [...prevQuestions];
        const [skippedQuestion] = reordered.splice(currentQuestionIndex, 1);
        reordered.push(skippedQuestion);
        return reordered;
      });

      setIsTestComplete(false);
    },
    [clearCompletionTimeout, currentQuestionIndex],
  );

  useEffect(() => {
    if (isTestComplete) {
      void clearSavedRandomTestSession();
    }
  }, [clearSavedRandomTestSession, isTestComplete]);

  const handleBackToDashboard = () => {
    void clearSavedRandomTestSession();
    router.dismissAll();
    router.replace("/");
  };

  const handleExit = () => {
    Alert.alert(
      "Exit Test",
      `Want to continue this ${sessionLabel} later?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue Later",
          onPress: async () => {
            clearCompletionTimeout();
            const wasSaved = await saveRandomTestSessionForLater();
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
            await clearSavedRandomTestSession();
            router.back();
          },
        },
      ],
    );
  };

  const completedItems = useMemo(
    () => countCompletedItems(reviewItems),
    [reviewItems],
  );

  const progress: RandomTestProgress = useMemo(
    () => ({
      current: progressCounters.answeredCount,
      total: reviewItems.length,
      meaningCorrect: progressCounters.meaningCorrect,
      readingCorrect: progressCounters.readingCorrect,
      totalItems: reviewItems.length,
      answeredCount: progressCounters.answeredCount,
      completedItems,
      meaningAttempts: progressCounters.meaningAttempts,
      readingAttempts: progressCounters.readingAttempts,
      correctAnswersCount: progressCounters.correctAnswersCount,
    }),
    [completedItems, progressCounters, reviewItems.length],
  );

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.secondary} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>
            {isHiraganaVocabMeaningMode
              ? "Preparing your hiragana vocab quiz..."
              : "Preparing your test..."}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isTestComplete) {
    return (
      <ReviewResultsScreen
        reviewItems={reviewItems as any}
        progress={progress as any}
        submittingResults={false}
        onBackToDashboard={handleBackToDashboard}
        secondaryActionLabel="Take Another Test"
        onSecondaryAction={() => router.replace(configRoute as any)}
      />
    );
  }

  if (testQuestions.length === 0) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>
            No test questions available
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

  const currentQuestion = testQuestions[currentQuestionIndex];
  const shouldUseGroupedQuestions =
    ankiCardMode &&
    ankiGroupQuestions &&
    ankiCardModeScope === "both" &&
    !!config?.includeMeaning &&
    !!config?.includeReading;
  const sessionProgress = {
    totalItems: reviewItems.length,
    currentItem: progress.answeredCount,
    completedCount: completedItems,
    correctAnswersCount: progress.correctAnswersCount,
  };
  const hiraganaMeaningPrompt =
    isHiraganaVocabMeaningMode && currentQuestion.questionType === "meaning"
      ? getPrimaryReadingAsHiragana(currentQuestion.subject) ?? undefined
      : undefined;
  const hiraganaMeaningContextHints =
    isHiraganaVocabMeaningMode && currentQuestion.questionType === "meaning"
      ? buildHiraganaMeaningContextHints(currentQuestion.subject)
      : undefined;

  return (
    <ReviewQuestionScreen
      item={{
        id: currentQuestion.id,
        subject: {
          id: currentQuestion.subject.id,
          object: currentQuestion.subject.object as
            | "radical"
            | "kanji"
            | "vocabulary"
            | "kana_vocabulary",
          data: {
            level: currentQuestion.subject.data.level,
            characters: currentQuestion.subject.data.characters,
            meanings: currentQuestion.subject.data.meanings.map((meaning) => ({
              meaning: meaning.meaning,
              primary: meaning.primary,
              accepted_answer: meaning.accepted_answer,
            })),
            readings: currentQuestion.subject.data.readings?.map((reading) => ({
              reading: reading.reading,
              primary: reading.primary,
              type: reading.type,
              accepted_answer: reading.accepted_answer,
            })),
            character_images:
              currentQuestion.subject.data.character_images || undefined,
            pronunciation_audios:
              currentQuestion.subject.data.pronunciation_audios || undefined,
          },
        },
      }}
      questionType={currentQuestion.questionType}
      onAnswer={handleAnswer}
      onSkip={handleSkip}
      onExit={handleExit}
      showHeader={true}
      showBackgroundColor={true}
      totalItems={sessionProgress.totalItems}
      currentItem={sessionProgress.currentItem}
      completedCount={sessionProgress.completedCount}
      correctAnswersCount={sessionProgress.correctAnswersCount}
      forceDisableAnkiGrouping={!shouldUseGroupedQuestions}
      overridePromptText={hiraganaMeaningPrompt}
      overridePromptUsesJapaneseFont={Boolean(hiraganaMeaningPrompt)}
      contextSentencesHint={hiraganaMeaningContextHints}
      contextHintMaxItems={3}
    />
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
});
