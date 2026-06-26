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
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Line } from "react-native-svg";
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
  SimilarKanjiRound,
  SimilarKanjiSource,
  buildSimilarKanjiRounds,
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
  kanjiPerQuestion: number;
  similarKanjiSource: SimilarKanjiSource;
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

type MatchConnections = Record<number, number>;

interface SimilarKanjiSavedSession {
  savedAt: number;
  config: SimilarKanjiConfig;
  rounds: SimilarKanjiRound<ApiSubject>[];
  currentIndex: number;
  reviewItems: SimilarKanjiReviewItem[];
  progress: SimilarKanjiProgressState;
  connections: MatchConnections;
  selectedKanjiItemId: number | null;
  hasSubmittedCurrentRound: boolean;
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
const MATCH_ITEM_HEIGHT = 72;
const MATCH_ITEM_GAP = 10;
const KANJI_COLUMN_WIDTH = 88;
const WIRE_COLUMN_WIDTH = 48;
const SUCCESS_COLOR = "#4caf50";
const ERROR_COLOR = "#f44336";

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

const isKanjiSubject = (
  subject: ApiSubject | null | undefined,
): subject is ApiSubject =>
  Boolean(
    subject &&
      subject.object === "kanji" &&
      subject.data?.characters &&
      getPrimaryKanjiMeaning(subject),
  );

function normalizeConfig(rawConfig: Partial<SimilarKanjiConfig>): SimilarKanjiConfig {
  const similarKanjiSource =
    rawConfig.similarKanjiSource === "wanikani" ||
    rawConfig.similarKanjiSource === "niai"
      ? rawConfig.similarKanjiSource
      : "niai";

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
    kanjiPerQuestion:
      typeof rawConfig.kanjiPerQuestion === "number"
        ? Math.min(6, Math.max(2, Math.round(rawConfig.kanjiPerQuestion)))
        : 4,
    similarKanjiSource,
  };
}

function getSubjectCharacters(subject: ApiSubject): string {
  return subject.data.characters?.trim() ?? "";
}

function getRoundBoardHeight(round: SimilarKanjiRound<ApiSubject>): number {
  return (
    round.items.length * MATCH_ITEM_HEIGHT +
    Math.max(0, round.items.length - 1) * MATCH_ITEM_GAP
  );
}

function getRowCenterY(index: number): number {
  return index * (MATCH_ITEM_HEIGHT + MATCH_ITEM_GAP) + MATCH_ITEM_HEIGHT / 2;
}

function getConnectedKanjiItemId(
  connections: MatchConnections,
  choiceId: number,
): number | null {
  for (const [itemId, connectedChoiceId] of Object.entries(connections)) {
    if (connectedChoiceId === choiceId) {
      return Number(itemId);
    }
  }

  return null;
}

function buildReviewItemsFromRounds(
  rounds: SimilarKanjiRound<ApiSubject>[],
  subjectIdToStage: ReadonlyMap<number, number>,
): SimilarKanjiReviewItem[] {
  return rounds.flatMap((round) =>
    round.items.map((item) => ({
      id: item.id,
      assignmentId: -item.id,
      subjectId: item.subject.id,
      subject: item.subject,
      srsStage: subjectIdToStage.get(item.subject.id),
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
}

function countRoundItems(rounds: SimilarKanjiRound<ApiSubject>[]): number {
  return rounds.reduce((total, round) => total + round.items.length, 0);
}

export default function SimilarKanjiSessionScreen() {
  useActivityTracking("similar_kanji");
  const { theme } = useTheme();
  const { apiToken } = useAuthStore();
  const { isLoading: isAuthLoading } = useSession();
  const params = useLocalSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [rounds, setRounds] = useState<SimilarKanjiRound<ApiSubject>[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewItems, setReviewItems] = useState<SimilarKanjiReviewItem[]>([]);
  const [progress, setProgress] = useState({ ...EMPTY_PROGRESS_STATE });
  const [isComplete, setIsComplete] = useState(false);
  const [config, setConfig] = useState<SimilarKanjiConfig | null>(null);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const [connections, setConnections] = useState<MatchConnections>({});
  const [selectedKanjiItemId, setSelectedKanjiItemId] = useState<number | null>(
    null,
  );
  const [hasSubmittedCurrentRound, setHasSubmittedCurrentRound] =
    useState(false);

  const clearSavedSimilarKanjiSession = useCallback(async () => {
    await clearExtraStudySessionState(SIMILAR_KANJI_SESSION_KEY);
  }, []);

  const restoreSavedSimilarKanjiSession =
    useCallback(async (): Promise<boolean> => {
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
        !Array.isArray(savedSession.rounds) ||
        !Array.isArray(savedSession.reviewItems) ||
        savedSession.rounds.length === 0
      ) {
        await clearSavedSimilarKanjiSession();
        return false;
      }

      const safeIndex = Math.max(
        0,
        Math.min(savedSession.currentIndex || 0, savedSession.rounds.length - 1),
      );

      setConfig(savedSession.config);
      setRounds(savedSession.rounds);
      setCurrentIndex(safeIndex);
      setReviewItems(savedSession.reviewItems);
      setProgress({
        ...EMPTY_PROGRESS_STATE,
        ...(savedSession.progress || {}),
      });
      setConnections(savedSession.connections || {});
      setSelectedKanjiItemId(savedSession.selectedKanjiItemId ?? null);
      setHasSubmittedCurrentRound(
        savedSession.hasSubmittedCurrentRound === true,
      );
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
        rounds.length === 0 ||
        currentIndex < 0 ||
        currentIndex >= rounds.length
      ) {
        return false;
      }

      const payload: SimilarKanjiSavedSession = {
        savedAt: Date.now(),
        config,
        rounds,
        currentIndex,
        reviewItems,
        progress,
        connections,
        selectedKanjiItemId,
        hasSubmittedCurrentRound,
      };

      return saveExtraStudySessionState(SIMILAR_KANJI_SESSION_KEY, payload);
    }, [
      config,
      connections,
      currentIndex,
      hasSubmittedCurrentRound,
      isComplete,
      progress,
      reviewItems,
      rounds,
      selectedKanjiItemId,
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
          kanjiPerQuestion: params.kanjiPerQuestion
            ? Number.parseInt(params.kanjiPerQuestion as string, 10)
            : 4,
          similarKanjiSource:
            params.similarKanjiSource === "wanikani" ||
            params.similarKanjiSource === "niai"
              ? params.similarKanjiSource
              : "niai",
        }),
      );
    } catch (error) {
      console.error("Failed to load similar kanji config:", error);
      Alert.alert("Error", "Failed to load match configuration.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [
    params.kanjiPerQuestion,
    params.maxLevel,
    params.minLevel,
    params.numberOfQuestions,
    params.onlyLearnedSimilarKanji,
    params.resume,
    params.selectedListIds,
    params.sessionId,
    params.similarKanjiSource,
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

  const loadRounds = useCallback(async () => {
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
      const candidateSubjects =
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

      const generatedRounds = buildSimilarKanjiRounds({
        targetSubjects,
        allKanjiSubjects: candidateSubjects,
        learnedKanjiSubjectIds,
        includeUnlearnedSimilarKanji: !config.onlyLearnedSimilarKanji,
        numberOfRounds: config.numberOfQuestions,
        maxKanjiPerRound: config.kanjiPerQuestion,
        source: config.similarKanjiSource,
        getNiaiSimilarKanji,
      });

      if (generatedRounds.length === 0) {
        Alert.alert(
          "No Matching Rounds",
          "No visually similar kanji groups match your selected criteria.",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }

      const totalItems = countRoundItems(generatedRounds);
      setRounds(generatedRounds);
      setReviewItems(
        buildReviewItemsFromRounds(generatedRounds, subjectIdToStage),
      );
      setProgress({
        ...EMPTY_PROGRESS_STATE,
        total: totalItems,
        totalItems,
      });
      setConnections({});
      setSelectedKanjiItemId(null);
      setHasSubmittedCurrentRound(false);
    } catch (error) {
      console.error("Failed to load similar kanji rounds:", error);
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
      void loadRounds();
    }
  }, [config, hasRestoredSession, loadRounds]);

  useEffect(() => {
    if (isComplete) {
      void clearSavedSimilarKanjiSession();
    }
  }, [clearSavedSimilarKanjiSession, isComplete]);

  const currentRound = rounds[currentIndex];
  const connectedCount = currentRound
    ? currentRound.items.filter((item) => connections[item.id] !== undefined)
        .length
    : 0;
  const canSubmitRound =
    Boolean(currentRound) &&
    !hasSubmittedCurrentRound &&
    connectedCount === currentRound.items.length;

  const scoreSummary = useMemo(() => {
    if (progress.answeredCount === 0) {
      return "0/0";
    }

    return `${progress.correctAnswersCount}/${progress.answeredCount}`;
  }, [progress.answeredCount, progress.correctAnswersCount]);

  const resetCurrentRound = () => {
    if (hasSubmittedCurrentRound) {
      return;
    }

    setConnections({});
    setSelectedKanjiItemId(null);
  };

  const handleKanjiPress = (itemId: number, subjectId: number) => {
    if (hasSubmittedCurrentRound) {
      router.push({
        pathname: "/subject/[id]",
        params: { id: String(subjectId) },
      });
      return;
    }

    setSelectedKanjiItemId((prev) => (prev === itemId ? null : itemId));
  };

  const handleMeaningPress = (choiceId: number) => {
    if (hasSubmittedCurrentRound) {
      return;
    }

    if (selectedKanjiItemId === null) {
      setSelectedKanjiItemId(getConnectedKanjiItemId(connections, choiceId));
      return;
    }

    setConnections((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((rawItemId) => {
        const itemId = Number(rawItemId);
        if (next[itemId] === choiceId) {
          delete next[itemId];
        }
      });
      next[selectedKanjiItemId] = choiceId;
      return next;
    });
    setSelectedKanjiItemId(null);
  };

  const submitCurrentRound = () => {
    if (!currentRound || !canSubmitRound) {
      return;
    }

    let correctCount = 0;
    currentRound.items.forEach((item) => {
      if (connections[item.id] === item.id) {
        correctCount += 1;
      }
    });

    const currentRoundItemIds = new Set(currentRound.items.map((item) => item.id));
    setReviewItems((prev) =>
      prev.map((reviewItem) => {
        if (!currentRoundItemIds.has(reviewItem.id)) {
          return reviewItem;
        }

        const isCorrect = connections[reviewItem.id] === reviewItem.id;
        return {
          ...reviewItem,
          meaningDone: true,
          meaningCorrectlyAnswered: isCorrect,
          meaningIncorrect: isCorrect
            ? reviewItem.meaningIncorrect
            : reviewItem.meaningIncorrect + 1,
          meaningIncorrectCounted: !isCorrect,
        };
      }),
    );
    setProgress((prev) => ({
      ...prev,
      current: prev.current + currentRound.items.length,
      answeredCount: prev.answeredCount + currentRound.items.length,
      completedItems: prev.completedItems + currentRound.items.length,
      meaningAttempts: prev.meaningAttempts + currentRound.items.length,
      meaningCorrect: prev.meaningCorrect + correctCount,
      correctAnswersCount: prev.correctAnswersCount + correctCount,
    }));
    setHasSubmittedCurrentRound(true);
    setSelectedKanjiItemId(null);
  };

  const goToNextRound = () => {
    if (!hasSubmittedCurrentRound) {
      return;
    }

    if (currentIndex < rounds.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setConnections({});
      setSelectedKanjiItemId(null);
      setHasSubmittedCurrentRound(false);
      return;
    }

    setIsComplete(true);
  };

  const skipRound = () => {
    if (hasSubmittedCurrentRound) {
      return;
    }

    setRounds((prevRounds) => {
      if (
        currentIndex < 0 ||
        currentIndex >= prevRounds.length ||
        prevRounds.length <= 1
      ) {
        return prevRounds;
      }

      const reordered = [...prevRounds];
      const [skippedRound] = reordered.splice(currentIndex, 1);
      reordered.push(skippedRound);
      return reordered;
    });
    setConnections({});
    setSelectedKanjiItemId(null);
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

  const getConnectionColor = (itemId: number): string => {
    if (!hasSubmittedCurrentRound) {
      return selectedKanjiItemId === itemId ? theme.secondary : theme.primary;
    }

    return connections[itemId] === itemId ? SUCCESS_COLOR : ERROR_COLOR;
  };

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.secondary} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>
            Preparing similar kanji boards...
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

  if (!currentRound) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: theme.error }]}>
            No similar kanji boards available
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

  const boardHeight = getRoundBoardHeight(currentRound);
  const connectionLines = currentRound.items
    .map((item, leftIndex) => {
      const choiceId = connections[item.id];
      if (choiceId === undefined) {
        return null;
      }

      const rightIndex = currentRound.meaningChoices.findIndex(
        (choice) => choice.id === choiceId,
      );
      if (rightIndex < 0) {
        return null;
      }

      return {
        itemId: item.id,
        key: `${item.id}-${choiceId}`,
        x1: KANJI_COLUMN_WIDTH,
        y1: getRowCenterY(leftIndex),
        x2: KANJI_COLUMN_WIDTH + WIRE_COLUMN_WIDTH,
        y2: getRowCenterY(rightIndex),
      };
    })
    .filter(
      (
        line,
      ): line is {
        itemId: number;
        key: string;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      } => Boolean(line),
    );

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
            {currentIndex + 1}/{rounds.length} · Score {scoreSummary}
          </Text>
        </View>
        <TouchableOpacity
          onPress={skipRound}
          style={[
            styles.headerButton,
            hasSubmittedCurrentRound && { opacity: 0.35 },
          ]}
          disabled={hasSubmittedCurrentRound}
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
                  Math.min(
                    100,
                    (progress.answeredCount /
                      Math.max(1, progress.totalItems || 1)) *
                      100,
                  ),
                )}%`,
              },
            ]}
          />
        </View>

        <View style={styles.boardHeader}>
          <View>
            <Text style={[styles.boardTitle, { color: theme.textColor }]}>
              Connect matches
            </Text>
            <Text style={[styles.boardMeta, { color: theme.textSecondary }]}>
              {connectedCount}/{currentRound.items.length}
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.resetButton,
              {
                borderColor:
                  connectedCount > 0 && !hasSubmittedCurrentRound
                    ? theme.border
                    : "transparent",
                opacity:
                  connectedCount > 0 && !hasSubmittedCurrentRound ? 1 : 0.35,
              },
            ]}
            onPress={resetCurrentRound}
            disabled={connectedCount === 0 || hasSubmittedCurrentRound}
            activeOpacity={0.75}
          >
            <Ionicons name="refresh" size={18} color={theme.textColor} />
          </TouchableOpacity>
        </View>

        <View style={[styles.columnLabels, { width: "100%" }]}>
          <Text
            style={[
              styles.columnLabel,
              { width: KANJI_COLUMN_WIDTH, color: theme.textSecondary },
            ]}
          >
            Kanji
          </Text>
          <View style={{ width: WIRE_COLUMN_WIDTH }} />
          <Text
            style={[styles.columnLabel, { flex: 1, color: theme.textSecondary }]}
          >
            Meanings
          </Text>
        </View>

        <View style={[styles.matchBoard, { minHeight: boardHeight }]}>
          <Svg
            width="100%"
            height={boardHeight}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          >
            {connectionLines.map((line) => {
              const color = getConnectionColor(line.itemId);
              return (
                <React.Fragment key={line.key}>
                  <Line
                    x1={line.x1}
                    y1={line.y1}
                    x2={line.x2}
                    y2={line.y2}
                    stroke={color}
                    strokeWidth={3}
                    strokeLinecap="round"
                  />
                  <Circle cx={line.x1} cy={line.y1} r={4} fill={color} />
                  <Circle cx={line.x2} cy={line.y2} r={4} fill={color} />
                </React.Fragment>
              );
            })}
          </Svg>

          <View style={[styles.kanjiColumn, { width: KANJI_COLUMN_WIDTH }]}>
            {currentRound.items.map((item) => {
              const isSelected = selectedKanjiItemId === item.id;
              const isConnected = connections[item.id] !== undefined;
              const isCorrect = connections[item.id] === item.id;
              const borderColor = hasSubmittedCurrentRound
                ? isCorrect
                  ? SUCCESS_COLOR
                  : ERROR_COLOR
                : isSelected
                  ? theme.secondary
                  : isConnected
                    ? theme.primary
                    : theme.border;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.kanjiButton,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor,
                    },
                  ]}
                  onPress={() => handleKanjiPress(item.id, item.subject.id)}
                  onLongPress={() =>
                    router.push({
                      pathname: "/subject/[id]",
                      params: { id: String(item.subject.id) },
                    })
                  }
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.kanjiText,
                      fontStyles.japaneseText,
                      {
                        color: theme.textColor,
                      },
                    ]}
                    maxFontSizeMultiplier={1}
                    numberOfLines={1}
                  >
                    {getSubjectCharacters(item.subject)}
                  </Text>
                  <View
                    style={[
                      styles.leftConnectorDot,
                      {
                        backgroundColor: isConnected
                          ? getConnectionColor(item.id)
                          : theme.border,
                      },
                    ]}
                  />
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={{ width: WIRE_COLUMN_WIDTH }} />

          <View style={styles.meaningColumn}>
            {currentRound.meaningChoices.map((choice) => {
              const connectedItemId = getConnectedKanjiItemId(
                connections,
                choice.id,
              );
              const isConnected = connectedItemId !== null;
              const isSelectedConnection =
                selectedKanjiItemId !== null &&
                connections[selectedKanjiItemId] === choice.id;
              const isCorrect = connectedItemId === choice.id;
              const borderColor = hasSubmittedCurrentRound
                ? isCorrect
                  ? SUCCESS_COLOR
                  : ERROR_COLOR
                : isSelectedConnection
                  ? theme.secondary
                  : isConnected
                    ? theme.primary
                    : theme.border;

              return (
                <TouchableOpacity
                  key={choice.id}
                  style={[
                    styles.meaningButton,
                    {
                      backgroundColor: theme.cardBackground,
                      borderColor,
                    },
                  ]}
                  onPress={() => handleMeaningPress(choice.id)}
                  disabled={hasSubmittedCurrentRound}
                  activeOpacity={0.75}
                >
                  <View
                    style={[
                      styles.rightConnectorDot,
                      {
                        backgroundColor: isConnected
                          ? getConnectionColor(connectedItemId ?? choice.id)
                          : theme.border,
                      },
                    ]}
                  />
                  <Text
                    style={[styles.meaningText, { color: theme.textColor }]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                  >
                    {choice.meaning}
                  </Text>
                  {hasSubmittedCurrentRound && isConnected ? (
                    <Ionicons
                      name={isCorrect ? "checkmark-circle" : "close-circle"}
                      size={20}
                      color={isCorrect ? SUCCESS_COLOR : ERROR_COLOR}
                    />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {hasSubmittedCurrentRound ? (
          <View
            style={[
              styles.revealCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            {currentRound.items.map((item) => {
              const selectedChoiceId = connections[item.id];
              const selectedChoice = currentRound.meaningChoices.find(
                (choice) => choice.id === selectedChoiceId,
              );
              const isCorrect = selectedChoiceId === item.id;

              return (
                <View key={item.id} style={styles.answerRow}>
                  <Text
                    style={[
                      styles.answerKanji,
                      fontStyles.japaneseText,
                      { color: getSubjectTypeColor("kanji") },
                    ]}
                  >
                    {getSubjectCharacters(item.subject)}
                  </Text>
                  <View style={styles.answerTextColumn}>
                    <Text
                      style={[styles.answerMeaning, { color: theme.textColor }]}
                      numberOfLines={1}
                    >
                      {item.meaning}
                    </Text>
                    {!isCorrect && selectedChoice ? (
                      <Text
                        style={[
                          styles.answerCorrection,
                          { color: theme.textSecondary },
                        ]}
                        numberOfLines={1}
                      >
                        You chose {selectedChoice.meaning}
                      </Text>
                    ) : null}
                  </View>
                  <Ionicons
                    name={isCorrect ? "checkmark-circle" : "close-circle"}
                    size={21}
                    color={isCorrect ? SUCCESS_COLOR : ERROR_COLOR}
                  />
                </View>
              );
            })}
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
        {hasSubmittedCurrentRound ? (
          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: theme.primary }]}
            onPress={goToNextRound}
            activeOpacity={0.8}
          >
            <Text style={styles.nextButtonText}>
              {currentIndex < rounds.length - 1 ? "Next Round" : "Finish"}
            </Text>
            <Ionicons
              name={
                currentIndex < rounds.length - 1 ? "arrow-forward" : "checkmark"
              }
              size={22}
              color="white"
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.nextButton,
              {
                backgroundColor: canSubmitRound ? theme.primary : theme.border,
                opacity: canSubmitRound ? 1 : 0.7,
              },
            ]}
            onPress={submitCurrentRound}
            disabled={!canSubmitRound}
            activeOpacity={0.8}
          >
            <Text style={styles.nextButtonText}>Submit</Text>
            <Ionicons name="checkmark" size={22} color="white" />
          </TouchableOpacity>
        )}
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
    fontVariant: ["tabular-nums"],
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
  boardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  boardTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  boardMeta: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
    fontVariant: ["tabular-nums"],
  },
  resetButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  columnLabels: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  columnLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  matchBoard: {
    flexDirection: "row",
    position: "relative",
    marginBottom: 16,
  },
  kanjiColumn: {
    gap: MATCH_ITEM_GAP,
    zIndex: 2,
  },
  meaningColumn: {
    flex: 1,
    gap: MATCH_ITEM_GAP,
    zIndex: 2,
  },
  kanjiButton: {
    height: MATCH_ITEM_HEIGHT,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  kanjiText: {
    width: "100%",
    fontSize: 44,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 58,
    includeFontPadding: false,
  },
  meaningButton: {
    height: MATCH_ITEM_HEIGHT,
    borderRadius: 10,
    borderWidth: 2,
    paddingLeft: 16,
    paddingRight: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  meaningText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
  },
  leftConnectorDot: {
    position: "absolute",
    right: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rightConnectorDot: {
    position: "absolute",
    left: -5,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  revealCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  answerRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  answerKanji: {
    width: 36,
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
  },
  answerTextColumn: {
    flex: 1,
  },
  answerMeaning: {
    fontSize: 15,
    fontWeight: "800",
  },
  answerCorrection: {
    fontSize: 12,
    marginTop: 2,
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
