import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio, type AudioSound } from "../../src/utils/expoAvCompat";
import { router, useLocalSearchParams } from "expo-router";
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
  Animated,
  Dimensions,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import KanaInput, {
  KanaInputHandle,
} from "../../src/components/TextToKanaInput";
import { useSession } from "../../src/contexts/AuthContext";
import AudioSessionManager from "../../src/modules/AudioSessionManager";
import { resolveOfflineVocabularyAudioUri } from "../../src/services/offlineVocabularyAudioService";
import {
  Assignment,
  Subject as ApiSubject,
  getAllAssignmentsCached,
} from "../../src/utils/api";
import { getAllSubjects, getSubjectById } from "../../src/utils/cache";
import {
  CrosswordPuzzle,
  PlacedCrosswordWord,
  generateCrossword,
  getCellsForWord,
  getWordById,
} from "../../src/utils/crosswordGenerator";
import {
  CROSSWORD_HARD_AVOID_PUZZLE_LIMIT,
  buildCrosswordGenerationPool,
  getCrosswordHardAvoidSubjectIds,
  getRecentCrosswordSubjectIds,
  loadCrosswordWordHistory,
  saveCrosswordWordHistoryEntry,
  type CrosswordWordHistoryEntry,
} from "../../src/utils/crosswordHistory";
import {
  EXTRA_STUDY_SESSION_STORAGE_KEYS,
  clearExtraStudySessionState,
  loadExtraStudySessionState,
  saveExtraStudySessionState,
} from "../../src/utils/extraStudySessionPersistence";
import {
  getSelectedListSubjectIdSet,
  parseSelectedListIds,
  subjectMatchesSelectedLists,
} from "../../src/utils/extraStudySubjectLists";
import { fontStyles } from "../../src/utils/fonts";
import * as Haptics from "../../src/utils/haptics";
import { getAssignmentsFromPermanentStorage } from "../../src/utils/permanentStorage";
import { pickPreferredPronunciationAudios } from "../../src/utils/pronunciationAudio";
import { useAuthStore, useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

const HIRAGANA_RANGE_REGEX = /^[぀-ゟー]+$/;
const KATAKANA_REGEX = /[ァ-ヴー]/;
const JAPANESE_CHARACTER_REGEX = /[一-龯ぁ-ゟァ-ヿ]/;

const CROSSWORD_SESSION_KEY = EXTRA_STUDY_SESSION_STORAGE_KEYS.CROSSWORD;
const CROSSWORD_SUCCESS_COLOR = "#3DDC84";
const GRID_WRAPPER_PADDING = 8;
const GRID_CELL_MARGIN = 1;
const WORD_SCROLL_EDGE_PADDING = 12;
const CROSSWORD_MIN_FRESH_POOL_SIZE = 30;
const CROSSWORD_RECENT_WORD_GENERATOR_PENALTY = 4;

type CrosswordSizeId = "small" | "medium" | "large";
type CrosswordClueDisplayMode = "english" | "kanji" | "english_kanji";

const SIZE_BY_ID: Record<
  CrosswordSizeId,
  { gridSize: number; defaultMaxWords: number }
> = {
  small: { gridSize: 9, defaultMaxWords: 6 },
  medium: { gridSize: 13, defaultMaxWords: 10 },
  large: { gridSize: 17, defaultMaxWords: 16 },
};

interface CrosswordConfig {
  size: CrosswordSizeId;
  maxWords: number;
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
  hiraganaOnly: boolean;
  clueDisplayMode: CrosswordClueDisplayMode;
  playAudioOnCorrectAnswer: boolean;
}

interface CrosswordWordResultEntry {
  subjectId: number;
  hiragana: string;
  meaning: string;
  number: number;
  direction: "across" | "down";
  level?: number;
  attempts: number;
  solved: boolean;
  revealed: boolean;
}

interface SavedCrosswordSession {
  savedAt: number;
  config: CrosswordConfig;
  puzzle: CrosswordPuzzle;
  completedWordIds: string[];
  revealedWordIds?: string[];
  revealCount?: number;
  mistakes: number;
  attemptsByWordId: Record<string, number>;
  startedAt: number;
  elapsedMs: number;
}

interface WordCompletionAnimationState {
  wordId: string;
  revealedCount: number;
}

function getDefaultCrosswordConfig(userLevel: number): CrosswordConfig {
  return {
    size: "medium",
    maxWords: SIZE_BY_ID.medium.defaultMaxWords,
    srsGroups: {
      apprentice: true,
      guru: true,
      master: true,
      enlightened: true,
      burned: true,
    },
    useCustomLevelRange: false,
    minLevel: 1,
    maxLevel: userLevel,
    selectedListIds: [],
    hiraganaOnly: false,
    clueDisplayMode: "english",
    playAudioOnCorrectAnswer: true,
  };
}

function sanitizeCrosswordConfig(
  rawConfig: Partial<CrosswordConfig>,
  userLevel: number
): CrosswordConfig {
  const defaults = getDefaultCrosswordConfig(userLevel);
  const size =
    rawConfig.size === "small" ||
    rawConfig.size === "medium" ||
    rawConfig.size === "large"
      ? rawConfig.size
      : defaults.size;
  const fallbackMaxWords = SIZE_BY_ID[size].defaultMaxWords;

  return {
    size,
    maxWords:
      typeof rawConfig.maxWords === "number" && Number.isFinite(rawConfig.maxWords)
        ? Math.max(1, Math.round(rawConfig.maxWords))
        : fallbackMaxWords,
    srsGroups: {
      apprentice:
        typeof rawConfig.srsGroups?.apprentice === "boolean"
          ? rawConfig.srsGroups.apprentice
          : defaults.srsGroups.apprentice,
      guru:
        typeof rawConfig.srsGroups?.guru === "boolean"
          ? rawConfig.srsGroups.guru
          : defaults.srsGroups.guru,
      master:
        typeof rawConfig.srsGroups?.master === "boolean"
          ? rawConfig.srsGroups.master
          : defaults.srsGroups.master,
      enlightened:
        typeof rawConfig.srsGroups?.enlightened === "boolean"
          ? rawConfig.srsGroups.enlightened
          : defaults.srsGroups.enlightened,
      burned:
        typeof rawConfig.srsGroups?.burned === "boolean"
          ? rawConfig.srsGroups.burned
          : defaults.srsGroups.burned,
    },
    useCustomLevelRange:
      typeof rawConfig.useCustomLevelRange === "boolean"
        ? rawConfig.useCustomLevelRange
        : defaults.useCustomLevelRange,
    minLevel:
      typeof rawConfig.minLevel === "number" && Number.isFinite(rawConfig.minLevel)
        ? Math.max(1, Math.round(rawConfig.minLevel))
        : defaults.minLevel,
    maxLevel:
      typeof rawConfig.maxLevel === "number" && Number.isFinite(rawConfig.maxLevel)
        ? Math.max(1, Math.round(rawConfig.maxLevel))
        : defaults.maxLevel,
    selectedListIds: parseSelectedListIds(rawConfig.selectedListIds),
    hiraganaOnly:
      typeof rawConfig.hiraganaOnly === "boolean"
        ? rawConfig.hiraganaOnly
        : defaults.hiraganaOnly,
    clueDisplayMode:
      rawConfig.clueDisplayMode === "kanji" ||
      rawConfig.clueDisplayMode === "english_kanji"
        ? rawConfig.clueDisplayMode
        : "english",
    playAudioOnCorrectAnswer:
      typeof rawConfig.playAudioOnCorrectAnswer === "boolean"
        ? rawConfig.playAudioOnCorrectAnswer
        : defaults.playAudioOnCorrectAnswer,
  };
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

function getPrimaryReading(subject: ApiSubject): string | null {
  if (
    subject.object === "kana_vocabulary" &&
    typeof subject.data.characters === "string" &&
    subject.data.characters.length > 0
  ) {
    return normalizeKatakanaToHiragana(subject.data.characters);
  }

  const readings = subject.data.readings;
  if (!readings || readings.length === 0) return null;
  const primary =
    readings.find((reading) => reading.primary) ?? readings[0];
  if (!primary) return null;
  return normalizeKatakanaToHiragana(primary.reading);
}

function getPrimaryMeaning(subject: ApiSubject): string | null {
  const meanings = subject.data.meanings;
  if (!meanings || meanings.length === 0) return null;
  const primary = meanings.find((m) => m.primary) ?? meanings[0];
  return primary?.meaning ?? null;
}

interface VocabCandidate {
  subjectId: number;
  hiragana: string;
  meaning: string;
  level?: number;
}

function buildCandidates(
  subjects: ApiSubject[],
  hiraganaOnly: boolean
): VocabCandidate[] {
  const out: VocabCandidate[] = [];
  for (const subject of subjects) {
    if (
      subject.object !== "vocabulary" &&
      subject.object !== "kana_vocabulary"
    ) {
      continue;
    }

    const reading = getPrimaryReading(subject);
    if (!reading) continue;
    if (!HIRAGANA_RANGE_REGEX.test(reading)) continue;

    if (hiraganaOnly) {
      const characters = subject.data.characters ?? "";
      if (
        characters &&
        characters !== reading &&
        (KATAKANA_REGEX.test(characters) || /[一-鿿]/.test(characters))
      ) {
        continue;
      }
    }

    const meaning = getPrimaryMeaning(subject);
    if (!meaning) continue;

    out.push({
      subjectId: subject.id,
      hiragana: reading,
      meaning,
      level: subject.data.level,
    });
  }
  return out;
}

function buildAllowedSrsStages(config: CrosswordConfig): Set<number> {
  const allowedStages = new Set<number>();
  if (config.srsGroups.apprentice) {
    [1, 2, 3, 4].forEach((s) => allowedStages.add(s));
  }
  if (config.srsGroups.guru) {
    [5, 6].forEach((s) => allowedStages.add(s));
  }
  if (config.srsGroups.master) allowedStages.add(7);
  if (config.srsGroups.enlightened) allowedStages.add(8);
  if (config.srsGroups.burned) allowedStages.add(9);
  return allowedStages;
}

function buildHintMessagesForWord(
  word: PlacedCrosswordWord,
  subject: ApiSubject | null,
  clueDisplayMode: CrosswordClueDisplayMode
): string[] {
  const messages: string[] = [];
  const alternativeMeanings =
    subject?.data?.meanings
      ?.filter((meaning) => !meaning.primary)
      .map((meaning) => meaning.meaning.trim())
      .filter(
        (meaning) =>
          meaning.length > 0 &&
          meaning.toLowerCase() !== word.meaning.toLowerCase(),
      ) ?? [];
  const uniqueAlternativeMeanings = Array.from(new Set(alternativeMeanings));

  if (clueDisplayMode === "kanji") {
    messages.push(`Meaning: ${word.meaning}`);
    if (uniqueAlternativeMeanings.length > 0) {
      messages.push(
        `Alternative meanings: ${uniqueAlternativeMeanings.join(", ")}`
      );
    }
    return messages;
  }

  if (clueDisplayMode === "english_kanji") {
    if (uniqueAlternativeMeanings.length > 0) {
      messages.push(
        `Alternative meanings: ${uniqueAlternativeMeanings.join(", ")}`
      );
    }
    return messages;
  }

  if (!subject) {
    return [];
  }

  if (uniqueAlternativeMeanings.length > 0) {
    messages.push(`Alternative meanings: ${uniqueAlternativeMeanings.join(", ")}`);
  }

  const subjectCharacters = subject.data?.characters;
  const isKanaVocab = subject.object === "kana_vocabulary";
  const hasDistinctKanji =
    typeof subjectCharacters === "string" &&
    subjectCharacters.length > 0 &&
    subjectCharacters !== word.word;

  if (!isKanaVocab && hasDistinctKanji) {
    messages.push(`Kanji form: ${subjectCharacters}`);
  }

  return messages;
}

function getSubjectKanjiForm(
  subject: ApiSubject | null,
  fallbackReading: string
): string | null {
  const characters = subject?.data?.characters;
  if (typeof characters !== "string" || characters.trim().length === 0) {
    return null;
  }
  if (characters === fallbackReading) {
    return null;
  }
  return characters;
}

function getClueTextForWord(
  word: PlacedCrosswordWord,
  clueDisplayMode: CrosswordClueDisplayMode,
  subject: ApiSubject | null
): string {
  const kanjiForm = getSubjectKanjiForm(subject, word.word);

  if (clueDisplayMode === "kanji") {
    return kanjiForm ?? word.word;
  }

  if (clueDisplayMode === "english_kanji") {
    return kanjiForm ? `${word.meaning} • ${kanjiForm}` : word.meaning;
  }

  return word.meaning;
}

function containsJapaneseCharacters(value: string): boolean {
  return JAPANESE_CHARACTER_REGEX.test(value);
}

export default function CrosswordSessionScreen() {
  const { theme } = useTheme();
  const { apiToken, userData } = useAuthStore();
  const vocabularyAudioVoice = useSettingsStore(
    (state) => state.vocabularyAudioVoice
  );
  const userLevel = userData?.level ?? 60;
  const { isLoading: isAuthLoading } = useSession();
  const params = useLocalSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<CrosswordConfig | null>(null);
  const [puzzle, setPuzzle] = useState<CrosswordPuzzle | null>(null);
  const [selectedWordId, setSelectedWordId] = useState<string | null>(null);
  const [completedWordIds, setCompletedWordIds] = useState<Set<string>>(
    () => new Set()
  );
  const [revealedWordIds, setRevealedWordIds] = useState<Set<string>>(
    () => new Set()
  );
  const [revealCount, setRevealCount] = useState(0);
  const [attemptsByWordId, setAttemptsByWordId] = useState<
    Record<string, number>
  >({});
  const [mistakes, setMistakes] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [hasAcknowledgedCompletion, setHasAcknowledgedCompletion] =
    useState(false);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [feedbackState, setFeedbackState] = useState<
    "idle" | "correct" | "incorrect"
  >("idle");
  const [hintStageByWordId, setHintStageByWordId] = useState<
    Record<string, number>
  >({});
  const [hintMessagesByWordId, setHintMessagesByWordId] = useState<
    Record<string, string[]>
  >({});
  const [hintAvailableCountByWordId, setHintAvailableCountByWordId] = useState<
    Record<string, number>
  >({});
  const [wordCompletionAnimation, setWordCompletionAnimation] =
    useState<WordCompletionAnimationState | null>(null);
  const [isAnswerAnimating, setIsAnswerAnimating] = useState(false);
  const clueDisplayMode = config?.clueDisplayMode ?? "english";

  const inputRef = useRef<KanaInputHandle>(null);
  const mainScrollRef = useRef<ScrollView>(null);
  const subjectByIdRef = useRef<Map<number, ApiSubject>>(new Map());
  const vocabularySoundRef = useRef<AudioSound | null>(null);
  const vocabularyAudioRequestIdRef = useRef(0);
  const vocabularyPlaybackFinalizeRef = useRef<(() => void) | null>(null);
  const scrollYRef = useRef(0);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const [scrollViewportHeight, setScrollViewportHeight] = useState(0);
  const [gridLayout, setGridLayout] = useState<{ y: number; height: number } | null>(
    null
  );

  const clearSavedSession = useCallback(async () => {
    await clearExtraStudySessionState(CROSSWORD_SESSION_KEY);
  }, []);

  const persistSession = useCallback(async () => {
    if (!config || !puzzle || isComplete || puzzle.words.length === 0) {
      return false;
    }
    const payload: SavedCrosswordSession = {
      savedAt: Date.now(),
      config,
      puzzle,
      completedWordIds: Array.from(completedWordIds),
      revealedWordIds: Array.from(revealedWordIds),
      revealCount,
      mistakes,
      attemptsByWordId,
      startedAt,
      elapsedMs,
    };
    return saveExtraStudySessionState(CROSSWORD_SESSION_KEY, payload);
  }, [
    attemptsByWordId,
    completedWordIds,
    config,
    elapsedMs,
    isComplete,
    mistakes,
    puzzle,
    revealCount,
    revealedWordIds,
    startedAt,
  ]);

  const restoreSavedSession = useCallback(async (): Promise<boolean> => {
    const saved = await loadExtraStudySessionState<SavedCrosswordSession>(
      CROSSWORD_SESSION_KEY
    );
    if (!saved) return false;
    if (
      !saved.config ||
      !saved.puzzle ||
      !Array.isArray(saved.puzzle.words) ||
      saved.puzzle.words.length === 0
    ) {
      await clearSavedSession();
      return false;
    }
    const cachedSubjects = await getAllSubjects();
    if (Array.isArray(cachedSubjects)) {
      subjectByIdRef.current = new Map<number, ApiSubject>(
        cachedSubjects.map((subject) => [subject.id, subject as ApiSubject])
      );
    }
    setConfig(sanitizeCrosswordConfig(saved.config, userLevel));
    setPuzzle(saved.puzzle);
    setCompletedWordIds(new Set(saved.completedWordIds ?? []));
    setRevealedWordIds(new Set(saved.revealedWordIds ?? []));
    setRevealCount(saved.revealCount ?? 0);
    setMistakes(saved.mistakes ?? 0);
    setAttemptsByWordId(saved.attemptsByWordId ?? {});
    setStartedAt(saved.startedAt ?? Date.now());
    setElapsedMs(saved.elapsedMs ?? 0);
    setIsComplete(false);
    setHasAcknowledgedCompletion(false);
    setIsAnswerAnimating(false);
    setWordCompletionAnimation(null);
    setHasRestoredSession(true);
    setIsLoading(false);
    setSelectedWordId(saved.puzzle.words[0]?.id ?? null);
    setHintStageByWordId({});
    setHintMessagesByWordId({});
    setHintAvailableCountByWordId({});
    return true;
  }, [clearSavedSession, userLevel]);

  const loadConfig = useCallback(async () => {
    try {
      const shouldResume = params.resume === "true";
      if (shouldResume) {
        const restored = await restoreSavedSession();
        if (restored) return;
        if (!params.sessionId) {
          Alert.alert(
            "Session Not Available",
            "Couldn't restore that crossword session.",
            [{ text: "OK", onPress: () => router.replace("/crossword-config") }]
          );
          return;
        }
      }

      setHasRestoredSession(false);

      if (params.sessionId) {
        const configData = await AsyncStorage.getItem(
          `crossword_config_${params.sessionId}`
        );
        if (configData) {
          const parsed = JSON.parse(configData) as Partial<CrosswordConfig>;
          setConfig(sanitizeCrosswordConfig(parsed, userLevel));
          await AsyncStorage.removeItem(`crossword_config_${params.sessionId}`);
        } else {
          throw new Error("Config not found in storage");
        }
      } else {
        setConfig(sanitizeCrosswordConfig({
          size: ((params.size as string) || "medium") as CrosswordSizeId,
          maxWords: parseInt((params.maxWords as string) || "10", 10),
          srsGroups: {
            apprentice: params.srsApprentice !== "false",
            guru: params.srsGuru !== "false",
            master: params.srsMaster !== "false",
            enlightened: params.srsEnlightened !== "false",
            burned: params.srsBurned !== "false",
          },
          useCustomLevelRange: params.useCustomLevelRange === "true",
          minLevel: params.minLevel
            ? parseInt(params.minLevel as string, 10)
            : 1,
          maxLevel: params.maxLevel
            ? parseInt(params.maxLevel as string, 10)
            : 60,
          selectedListIds: parseSelectedListIds(
            typeof params.selectedListIds === "string"
              ? (params.selectedListIds as string).split(",")
              : []
          ),
          hiraganaOnly: params.hiraganaOnly === "true",
          clueDisplayMode:
            params.clueDisplayMode === "kanji" ||
            params.clueDisplayMode === "english_kanji"
              ? (params.clueDisplayMode as CrosswordClueDisplayMode)
              : "english",
          playAudioOnCorrectAnswer: params.playAudioOnCorrectAnswer !== "false",
        }, userLevel));
      }
    } catch (error) {
      console.error("Failed to load crossword config:", error);
      Alert.alert("Error", "Failed to load crossword configuration.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [
    params.hiraganaOnly,
    params.clueDisplayMode,
    params.maxLevel,
    params.maxWords,
    params.minLevel,
    params.playAudioOnCorrectAnswer,
    params.resume,
    params.selectedListIds,
    params.sessionId,
    params.size,
    params.srsApprentice,
    params.srsBurned,
    params.srsEnlightened,
    params.srsGuru,
    params.srsMaster,
    params.useCustomLevelRange,
    restoreSavedSession,
    userLevel,
  ]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const buildPuzzle = useCallback(async () => {
    if (isAuthLoading || !config) return;

    try {
      setIsLoading(true);
      await clearSavedSession();

      let candidates: ApiSubject[] = [];
      const cachedSubjects = await getAllSubjects();
      const allCachedSubjects = Array.isArray(cachedSubjects)
        ? (cachedSubjects as ApiSubject[])
        : [];
      const subjectById = new Map<number, ApiSubject>(
        allCachedSubjects.map((subject) => [subject.id, subject])
      );

      const allowedStages = buildAllowedSrsStages(config);
      const shouldFilterBySrs = allowedStages.size < 9;

      const cachedAssignments =
        (await getAssignmentsFromPermanentStorage({ ignoreTTL: true })) ?? [];
      if (cachedAssignments.length > 0) {
        const subjectIdsFromAssignments = new Set<number>();
        cachedAssignments.forEach((assignment) => {
          const assignmentData = assignment?.data;
          if (!assignmentData) {
            return;
          }
          if (assignmentData.hidden || !assignmentData.unlocked_at) {
            return;
          }
          if (!allowedStages.has(assignmentData.srs_stage)) {
            return;
          }
          if (typeof assignmentData.subject_id !== "number") {
            return;
          }
          subjectIdsFromAssignments.add(assignmentData.subject_id);
        });

        for (const subjectId of subjectIdsFromAssignments) {
          const fromCache = subjectById.get(subjectId);
          if (fromCache) {
            candidates.push(fromCache);
            continue;
          }

          const fromMemoryCache = await getSubjectById(subjectId);
          if (fromMemoryCache) {
            candidates.push(fromMemoryCache as ApiSubject);
          }
        }
      }

      // Offline-first: use cached subjects by default.
      if (candidates.length > 0) {
        // Already hydrated from cached assignments.
      } else if (!shouldFilterBySrs) {
        candidates = allCachedSubjects;
      } else if (apiToken) {
        try {
          const assignmentsResponse = await getAllAssignmentsCached(apiToken, {
            srs_stages: Array.from(allowedStages),
          });

          const subjectIds = assignmentsResponse.data.map(
            (assignment: Assignment) => assignment.data.subject_id
          );
          const uniqueSubjectIds = new Set(subjectIds);

          for (const subjectId of uniqueSubjectIds) {
            const fromCache = subjectById.get(subjectId);
            if (fromCache) {
              candidates.push(fromCache);
              continue;
            }

            const fromMemoryCache = await getSubjectById(subjectId);
            if (fromMemoryCache) {
              candidates.push(fromMemoryCache as ApiSubject);
            }
          }
        } catch (err) {
          console.warn(
            "Crossword: failed to load SRS-filtered assignments, falling back to cached subjects",
            err
          );
        }
      }

      if (candidates.length === 0) {
        candidates = allCachedSubjects;
      }

      // Apply level + list filters.
      const selectedListSubjectIds = await getSelectedListSubjectIdSet(
        config.selectedListIds || []
      );
      const effectiveMinLevel = config.useCustomLevelRange ? config.minLevel : 1;
      const requestedMaxLevel = config.useCustomLevelRange
        ? config.maxLevel
        : userLevel;
      const effectiveMaxLevel = Math.min(requestedMaxLevel, userLevel);

      const filtered = candidates.filter((subject) => {
        const level = subject.data?.level;
        const inLevelRange =
          typeof level === "number" &&
          level >= effectiveMinLevel &&
          level <= effectiveMaxLevel;
        if (!inLevelRange) return false;
        return subjectMatchesSelectedLists(
          subject.id,
          config.selectedListIds || [],
          selectedListSubjectIds
        );
      });

      const wordCandidates = buildCandidates(filtered, config.hiraganaOnly);

      if (wordCandidates.length < 4) {
        Alert.alert(
          "Not Enough Vocabulary",
          "Not enough learned vocabulary matches your filters to build a crossword. Try widening your filters.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      const sizePreset = SIZE_BY_ID[config.size] ?? SIZE_BY_ID.medium;

      const candidatePoolSize = Math.max(config.maxWords * 10, 90);
      let wordHistory: CrosswordWordHistoryEntry[] = [];
      try {
        wordHistory = await loadCrosswordWordHistory();
      } catch (historyError) {
        console.warn("Crossword: failed to load recent word history", historyError);
      }
      const recentSubjectIds = getRecentCrosswordSubjectIds(wordHistory);
      const hardAvoidSubjectIds = getCrosswordHardAvoidSubjectIds(
        wordHistory,
        CROSSWORD_HARD_AVOID_PUZZLE_LIMIT
      );
      const minFreshCandidates = Math.max(
        config.maxWords * 4,
        CROSSWORD_MIN_FRESH_POOL_SIZE
      );
      const generationPool = buildCrosswordGenerationPool(wordCandidates, {
        poolSize: candidatePoolSize,
        recentSubjectIds,
        hardAvoidSubjectIds,
        minFreshCandidates,
      });
      const generationOptions = {
        gridSize: sizePreset.gridSize,
        maxWords: config.maxWords,
        minWordLength: 2,
        maxWordLength: Math.max(3, sizePreset.gridSize - 2),
        attempts: 18,
        seed: Math.floor(Date.now() + Math.random() * 1_000_000),
        recentSubjectIds,
        recentWordPenalty: CROSSWORD_RECENT_WORD_GENERATOR_PENALTY,
      };

      let built = generateCrossword(generationPool, generationOptions);
      if (
        built.words.length === 0 &&
        generationPool.length !== wordCandidates.length
      ) {
        const fallbackPool = buildCrosswordGenerationPool(wordCandidates, {
          poolSize: wordCandidates.length,
          recentSubjectIds,
        });
        built = generateCrossword(fallbackPool, generationOptions);
      }

      if (built.words.length === 0) {
        Alert.alert(
          "Couldn't Build Crossword",
          "We couldn't fit any words together. Try a different SRS or level range.",
          [{ text: "OK", onPress: () => router.back() }]
        );
        return;
      }

      try {
        await saveCrosswordWordHistoryEntry(
          built.words.map((word) => word.subjectId)
        );
      } catch (historyError) {
        console.warn("Crossword: failed to save recent word history", historyError);
      }

      setPuzzle(built);
      setSelectedWordId(built.words[0]?.id ?? null);
      setCompletedWordIds(new Set());
      setRevealedWordIds(new Set());
      setRevealCount(0);
      setAttemptsByWordId({});
      setMistakes(0);
      setStartedAt(Date.now());
      setElapsedMs(0);
      setIsComplete(false);
      setHasAcknowledgedCompletion(false);
      setIsAnswerAnimating(false);
      setWordCompletionAnimation(null);
      setHintStageByWordId({});
      setHintMessagesByWordId({});
      setHintAvailableCountByWordId({});
      subjectByIdRef.current = subjectById;
    } catch (error) {
      console.error("Failed to build crossword:", error);
      Alert.alert("Error", "Failed to build crossword.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [
    apiToken,
    clearSavedSession,
    config,
    isAuthLoading,
    userLevel,
  ]);

  useEffect(() => {
    if (config && !hasRestoredSession) {
      void buildPuzzle();
    }
  }, [buildPuzzle, config, hasRestoredSession]);

  // Timer.
  useEffect(() => {
    if (!puzzle || isComplete || isLoading) return;
    const interval = setInterval(() => {
      setElapsedMs((prev) => prev + 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, [isComplete, isLoading, puzzle]);

  // Auto-detect completion.
  useEffect(() => {
    if (!puzzle) return;
    if (puzzle.words.length === 0) return;
    if (completedWordIds.size === puzzle.words.length && !isComplete) {
      setIsComplete(true);
      setHasAcknowledgedCompletion(false);
      void clearSavedSession();
    }
  }, [clearSavedSession, completedWordIds.size, isComplete, puzzle]);

  const selectedWord = useMemo<PlacedCrosswordWord | null>(() => {
    if (!puzzle || !selectedWordId) return null;
    return getWordById(puzzle, selectedWordId) ?? null;
  }, [puzzle, selectedWordId]);

  const selectedCellSet = useMemo(() => {
    if (!puzzle || !selectedWord) return new Set<string>();
    const cells = getCellsForWord(puzzle, selectedWord);
    return new Set(cells.map((c) => `${c.row}:${c.col}`));
  }, [puzzle, selectedWord]);

  const completedCellSet = useMemo(() => {
    if (!puzzle) return new Set<string>();
    const out = new Set<string>();
    for (const word of puzzle.words) {
      if (!completedWordIds.has(word.id)) continue;
      for (const cell of getCellsForWord(puzzle, word)) {
        out.add(`${cell.row}:${cell.col}`);
      }
    }
    return out;
  }, [completedWordIds, puzzle]);

  const cellSize = useMemo(() => {
    if (!puzzle) return 36;
    const horizontalPadding = 24;
    const screenWidth = Dimensions.get("window").width - horizontalPadding;
    const target = Math.floor(screenWidth / Math.max(puzzle.cols, 1));
    return Math.max(14, Math.min(48, target));
  }, [puzzle]);

  const scrollWordIntoView = useCallback(
    (wordId: string, animated = true) => {
      if (!puzzle || !gridLayout || scrollViewportHeight <= 0) {
        return;
      }
      const word = getWordById(puzzle, wordId);
      if (!word) {
        return;
      }

      const wordLength = Array.from(word.word).length;
      const startRow = word.row;
      const endRow =
        word.direction === "down" ? word.row + wordLength - 1 : word.row;
      const cellStride = cellSize + GRID_CELL_MARGIN * 2;
      const wordTopY =
        gridLayout.y + GRID_WRAPPER_PADDING + startRow * cellStride;
      const wordBottomY =
        gridLayout.y + GRID_WRAPPER_PADDING + (endRow + 1) * cellStride;

      const currentY = scrollYRef.current;
      const visibleTopY = currentY + WORD_SCROLL_EDGE_PADDING;
      const visibleBottomY =
        currentY + scrollViewportHeight - WORD_SCROLL_EDGE_PADDING;

      let nextScrollY = currentY;
      if (wordTopY < visibleTopY) {
        nextScrollY = Math.max(0, wordTopY - WORD_SCROLL_EDGE_PADDING);
      } else if (wordBottomY > visibleBottomY) {
        nextScrollY = Math.max(
          0,
          wordBottomY - scrollViewportHeight + WORD_SCROLL_EDGE_PADDING
        );
      }

      if (Math.abs(nextScrollY - currentY) < 1) {
        return;
      }

      mainScrollRef.current?.scrollTo({ y: nextScrollY, animated });
      scrollYRef.current = nextScrollY;
    },
    [cellSize, gridLayout, puzzle, scrollViewportHeight]
  );

  const selectWord = useCallback(
    (wordId: string, clearInput = true, keepKeyboardOpen = false) => {
      setSelectedWordId(wordId);
      setFeedbackState("idle");
      if (clearInput) {
        setInputValue("");
        inputRef.current?.clearInput();
      }
      setTimeout(() => {
        scrollWordIntoView(wordId, true);
      }, 0);
      if (keepKeyboardOpen) {
        setTimeout(() => inputRef.current?.focus?.(), 0);
      }
    },
    [scrollWordIntoView],
  );

  useEffect(() => {
    if (!selectedWordId) {
      return;
    }
    const raf = requestAnimationFrame(() => {
      scrollWordIntoView(selectedWordId, true);
    });
    return () => cancelAnimationFrame(raf);
  }, [gridLayout, scrollViewportHeight, scrollWordIntoView, selectedWordId]);

  const selectNextWord = useCallback(
    (fromWordId: string) => {
      if (!puzzle || puzzle.words.length === 0) {
        return;
      }

      const ordered = [...puzzle.words].sort((a, b) => a.number - b.number);
      const currentIndex = ordered.findIndex((word) => word.id === fromWordId);
      const unsolved = ordered.filter((word) => !completedWordIds.has(word.id));
      const orderedUnsolvedIndices = unsolved
        .map((word) => ordered.findIndex((orderedWord) => orderedWord.id === word.id))
        .filter((index) => index >= 0)
        .sort((left, right) => left - right);

      const nextUnsolvedIndex = orderedUnsolvedIndices.find(
        (index) => index > currentIndex,
      );
      const targetIndex =
        nextUnsolvedIndex ??
        orderedUnsolvedIndices[0] ??
        (currentIndex >= 0 ? (currentIndex + 1) % ordered.length : 0);
      const targetWord = ordered[targetIndex];
      if (!targetWord) {
        return;
      }

      selectWord(targetWord.id, true, true);
    },
    [completedWordIds, puzzle, selectWord],
  );

  const getWordCellIndex = useCallback(
    (word: PlacedCrosswordWord, row: number, col: number): number => {
      const wordLength = Array.from(word.word).length;
      if (word.direction === "across") {
        if (row !== word.row) return -1;
        const index = col - word.col;
        return index >= 0 && index < wordLength ? index : -1;
      }

      if (col !== word.col) return -1;
      const index = row - word.row;
      return index >= 0 && index < wordLength ? index : -1;
    },
    [],
  );

  const animateWordCompletion = useCallback(async (word: PlacedCrosswordWord) => {
    const wordLength = Array.from(word.word).length;
    setWordCompletionAnimation({ wordId: word.id, revealedCount: 0 });
    for (let count = 1; count <= wordLength; count += 1) {
      setWordCompletionAnimation({ wordId: word.id, revealedCount: count });
      await new Promise((resolve) => setTimeout(resolve, 70));
    }
  }, []);

  const handleCellPress = useCallback(
    (row: number, col: number) => {
      if (isAnswerAnimating) return;
      if (!puzzle) return;
      const cell = puzzle.cells[row]?.[col];
      if (!cell) return;
      // Prefer a word that hasn't been completed yet.
      const ids = cell.wordIds;
      const incompleteIds = ids.filter((id) => !completedWordIds.has(id));

      if (incompleteIds.length === 0) {
        const completedTargetId =
          (selectedWordId && ids.includes(selectedWordId) && selectedWordId) ||
          ids[0];
        const completedTargetWord =
          completedTargetId && getWordById(puzzle, completedTargetId);
        if (completedTargetWord) {
          router.push(`/subject/${completedTargetWord.subjectId}` as any);
        }
        return;
      }

      let nextId =
        incompleteIds[0] ?? ids[0] ?? null;

      if (selectedWordId && ids.includes(selectedWordId) && ids.length > 1) {
        const pool = incompleteIds.length > 0 ? incompleteIds : ids;
        const currentIndex = pool.indexOf(selectedWordId);
        if (currentIndex !== -1) {
          nextId = pool[(currentIndex + 1) % pool.length];
        }
      }

      if (nextId) {
        selectWord(nextId);
      }
    },
    [completedWordIds, isAnswerAnimating, puzzle, selectWord, selectedWordId]
  );

  const handleClueSelect = useCallback(
    (word: PlacedCrosswordWord) => {
      if (isAnswerAnimating) return;
      if (completedWordIds.has(word.id)) {
        router.push(`/subject/${word.subjectId}` as any);
        return;
      }

      selectWord(word.id);
      setTimeout(() => inputRef.current?.focus?.(), 50);
    },
    [completedWordIds, isAnswerAnimating, selectWord],
  );

  const playShake = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, {
        toValue: 1,
        duration: 60,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: -1,
        duration: 60,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 1,
        duration: 60,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
      Animated.timing(shakeAnim, {
        toValue: 0,
        duration: 60,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start();
  }, [shakeAnim]);

  const playSuccess = useCallback(() => {
    successAnim.setValue(0);
    Animated.sequence([
      Animated.timing(successAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(successAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [successAnim]);

  const unloadVocabularySound = useCallback(async () => {
    if (vocabularyPlaybackFinalizeRef.current) {
      const finalize = vocabularyPlaybackFinalizeRef.current;
      vocabularyPlaybackFinalizeRef.current = null;
      finalize();
    }

    const sound = vocabularySoundRef.current;
    vocabularySoundRef.current = null;
    if (!sound) {
      return;
    }
    try {
      sound.setOnPlaybackStatusUpdate(null);
    } catch {
      // no-op
    }
    try {
      await sound.stopAsync();
    } catch {
      // no-op
    }
    try {
      await sound.unloadAsync();
    } catch {
      // no-op
    }
  }, []);

  useEffect(() => {
    return () => {
      void unloadVocabularySound();
    };
  }, [unloadVocabularySound]);

  const playWaniKaniVocabularyAudio = useCallback(
    async (subject: ApiSubject) => {
      const pronunciationAudios = (subject.data as any)?.pronunciation_audios;
      if (!Array.isArray(pronunciationAudios) || pronunciationAudios.length === 0) {
        return;
      }

      const audioFiles = pickPreferredPronunciationAudios(
        pronunciationAudios,
        subject.data.readings ?? null,
        vocabularyAudioVoice || "female",
        { preferredContentType: "audio/mpeg" }
      );
      if (audioFiles.length === 0) {
        return;
      }

      const requestId = ++vocabularyAudioRequestIdRef.current;
      await unloadVocabularySound();

      for (const audioFile of audioFiles) {
        if (requestId !== vocabularyAudioRequestIdRef.current) {
          return;
        }

        try {
          if (Platform.OS === "ios") {
            try {
              await AudioSessionManager.overrideSpeaker();
            } catch {
              // Best effort; continue playback.
            }
          }

          const cachedAudioUri = await resolveOfflineVocabularyAudioUri(
            subject.id,
            audioFile
          );

          if (requestId !== vocabularyAudioRequestIdRef.current) {
            return;
          }

          const { sound } = await Audio.Sound.createAsync(
            { uri: cachedAudioUri ?? audioFile.url },
            {
              shouldPlay: true,
              volume: 1.0,
            }
          );

          vocabularySoundRef.current = sound;

          await new Promise<void>((resolve) => {
            let settled = false;

            const finalize = () => {
              if (settled) return;
              settled = true;
              vocabularyPlaybackFinalizeRef.current = null;
              try {
                sound.setOnPlaybackStatusUpdate(null);
              } catch {
                // no-op
              }
              if (vocabularySoundRef.current === sound) {
                vocabularySoundRef.current = null;
              }
              void sound.unloadAsync().finally(() => resolve());
            };
            vocabularyPlaybackFinalizeRef.current = finalize;

            sound.setOnPlaybackStatusUpdate((status: any) => {
              if (!status.isLoaded) {
                if (status.error) {
                  finalize();
                }
                return;
              }
              if (status.didJustFinish) {
                finalize();
              }
            });
          });
        } catch (error) {
          console.error("Crossword vocabulary audio playback failed:", error);
          await unloadVocabularySound();
        }
      }
    },
    [unloadVocabularySound, vocabularyAudioVoice]
  );

  const playCorrectAnswerAudio = useCallback(
    async (word: PlacedCrosswordWord) => {
      if (!config?.playAudioOnCorrectAnswer) {
        return;
      }

      let subject = subjectByIdRef.current.get(word.subjectId) ?? null;
      if (!subject) {
        const fetched = await getSubjectById(word.subjectId);
        if (fetched) {
          subject = fetched as ApiSubject;
          subjectByIdRef.current.set(word.subjectId, subject);
        }
      }

      if (!subject) {
        return;
      }

      if (
        subject.object !== "vocabulary" &&
        subject.object !== "kana_vocabulary"
      ) {
        return;
      }

      await playWaniKaniVocabularyAudio(subject);
    },
    [config?.playAudioOnCorrectAnswer, playWaniKaniVocabularyAudio]
  );

  const handleSubmit = useCallback(async () => {
    if (!selectedWord || isAnswerAnimating) return;
    const flushed = inputRef.current?.flushKana?.() ?? inputValue;
    const candidate = normalizeKatakanaToHiragana((flushed || "").trim());
    if (!candidate) {
      setTimeout(() => inputRef.current?.focus?.(), 0);
      selectNextWord(selectedWord.id);
      return;
    }

    setAttemptsByWordId((prev) => ({
      ...prev,
      [selectedWord.id]: (prev[selectedWord.id] ?? 0) + 1,
    }));

    if (candidate === selectedWord.word) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setFeedbackState("correct");
      playSuccess();
      setIsAnswerAnimating(true);
      setInputValue(selectedWord.word);
      inputRef.current?.setInputText?.(selectedWord.word);
      void playCorrectAnswerAudio(selectedWord);

      try {
        await animateWordCompletion(selectedWord);
      } finally {
        setCompletedWordIds((prev) => {
          const next = new Set(prev);
          next.add(selectedWord.id);
          return next;
        });
        setWordCompletionAnimation(null);
        setInputValue("");
        inputRef.current?.clearInput();
        setIsAnswerAnimating(false);

        // Auto-advance to next unsolved word.
        if (puzzle && completedWordIds.size + 1 < puzzle.words.length) {
          setTimeout(() => {
            selectNextWord(selectedWord.id);
          }, 120);
        }
      }
    } else {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setFeedbackState("incorrect");
      setMistakes((prev) => prev + 1);
      playShake();
      setTimeout(() => setFeedbackState("idle"), 600);
    }
  }, [
    animateWordCompletion,
    isAnswerAnimating,
    inputValue,
    completedWordIds.size,
    playShake,
    playSuccess,
    playCorrectAnswerAudio,
    puzzle,
    selectNextWord,
    selectedWord,
  ]);

  const handleRevealLetter = useCallback(() => {
    if (!selectedWord || !puzzle || isAnswerAnimating) return;
    if (completedWordIds.has(selectedWord.id)) return;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setFeedbackState("correct");
    playSuccess();
    setMistakes((prev) => prev + 1);
    setRevealCount((prev) => prev + 1);
    setRevealedWordIds((prev) => {
      const next = new Set(prev);
      next.add(selectedWord.id);
      return next;
    });
    setAttemptsByWordId((prev) => ({
      ...prev,
      [selectedWord.id]: (prev[selectedWord.id] ?? 0) + 1,
    }));
    setCompletedWordIds((prev) => {
      const next = new Set(prev);
      next.add(selectedWord.id);
      return next;
    });
    setInputValue(selectedWord.word);
    inputRef.current?.setInputText?.(selectedWord.word);

    setTimeout(() => {
      setInputValue("");
      inputRef.current?.clearInput();
      setWordCompletionAnimation(null);
      const remaining = puzzle.words.filter(
        (w) => w.id !== selectedWord.id && !completedWordIds.has(w.id)
      );
      if (remaining.length > 0) {
        remaining.sort((a, b) => a.number - b.number);
        selectWord(remaining[0].id, false);
      }
      setFeedbackState("idle");
    }, 260);
  }, [
    completedWordIds,
    isAnswerAnimating,
    playSuccess,
    puzzle,
    setRevealCount,
    setRevealedWordIds,
    selectWord,
    selectedWord,
  ]);

  const handleHint = useCallback(async () => {
    if (!selectedWord) {
      return;
    }

    const currentHintStage = hintStageByWordId[selectedWord.id] ?? 0;
    let subject = subjectByIdRef.current.get(selectedWord.subjectId) ?? null;
    if (!subject) {
      const fetched = await getSubjectById(selectedWord.subjectId);
      if (fetched) {
        subject = fetched as ApiSubject;
        subjectByIdRef.current.set(selectedWord.subjectId, subject);
      }
    }

    const availableHintMessages = buildHintMessagesForWord(
      selectedWord,
      subject,
      clueDisplayMode
    );
    const hintCount = availableHintMessages.length;
    setHintAvailableCountByWordId((prev) => ({
      ...prev,
      [selectedWord.id]: hintCount,
    }));

    if (hintCount <= 0 || currentHintStage >= hintCount) {
      return;
    }

    const nextHintStage = Math.min(currentHintStage + 1, hintCount);

    setHintStageByWordId((prev) => ({
      ...prev,
      [selectedWord.id]: nextHintStage,
    }));
    setHintMessagesByWordId((prev) => ({
      ...prev,
      [selectedWord.id]: availableHintMessages.slice(0, nextHintStage),
    }));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [clueDisplayMode, hintStageByWordId, selectedWord]);

  const handleExit = useCallback(() => {
    if (isComplete) {
      router.back();
      return;
    }
    Alert.alert("Exit Crossword", "Want to save your progress for later?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Save & Exit",
        onPress: async () => {
          const ok = await persistSession();
          if (!ok) {
            Alert.alert("Couldn't Save", "Please try again.");
            return;
          }
          router.back();
        },
      },
      {
        text: "Discard",
        style: "destructive",
        onPress: async () => {
          await clearSavedSession();
          router.back();
        },
      },
    ]);
  }, [clearSavedSession, isComplete, persistSession]);

  const handleBackToDashboard = useCallback(() => {
    void clearSavedSession();
    router.dismissAll();
    router.replace("/");
  }, [clearSavedSession]);

  const handlePlayAgain = useCallback(() => {
    router.replace("/crossword-config");
  }, []);

  const typedPreviewByCell = useMemo(() => {
    const preview = new Map<string, string>();
    if (!selectedWord || completedWordIds.has(selectedWord.id)) {
      return preview;
    }

    const normalizedInput = normalizeKatakanaToHiragana((inputValue || "").trim());
    if (!normalizedInput) {
      return preview;
    }

    const typedCharacters = Array.from(normalizedInput);
    const solutionLength = Array.from(selectedWord.word).length;
    const limit = Math.min(typedCharacters.length, solutionLength);

    for (let i = 0; i < limit; i += 1) {
      const row =
        selectedWord.direction === "down"
          ? selectedWord.row + i
          : selectedWord.row;
      const col =
        selectedWord.direction === "across"
          ? selectedWord.col + i
          : selectedWord.col;
      preview.set(`${row}:${col}`, typedCharacters[i]);
    }

    return preview;
  }, [completedWordIds, inputValue, selectedWord]);
  const selectedHintStage = selectedWord
    ? hintStageByWordId[selectedWord.id] ?? 0
    : 0;
  const selectedHintMessages = selectedWord
    ? hintMessagesByWordId[selectedWord.id] ?? []
    : [];
  useEffect(() => {
    if (!selectedWord) {
      return;
    }
    if (typeof hintAvailableCountByWordId[selectedWord.id] === "number") {
      return;
    }

    let isCancelled = false;

    const loadHintCount = async () => {
      let subject = subjectByIdRef.current.get(selectedWord.subjectId) ?? null;
      if (!subject) {
        const fetched = await getSubjectById(selectedWord.subjectId);
        if (fetched) {
          subject = fetched as ApiSubject;
          subjectByIdRef.current.set(selectedWord.subjectId, subject);
        }
      }

      if (isCancelled) {
        return;
      }

      const hintCount = buildHintMessagesForWord(
        selectedWord,
        subject,
        clueDisplayMode
      ).length;
      setHintAvailableCountByWordId((prev) => {
        if (prev[selectedWord.id] === hintCount) {
          return prev;
        }
        return {
          ...prev,
          [selectedWord.id]: hintCount,
        };
      });
    };

    void loadHintCount();

    return () => {
      isCancelled = true;
    };
  }, [clueDisplayMode, hintAvailableCountByWordId, selectedWord]);

  const selectedHintTotal = selectedWord
    ? hintAvailableCountByWordId[selectedWord.id]
    : undefined;
  const isHintCountKnown = typeof selectedHintTotal === "number";
  const resolvedSelectedHintTotal = selectedHintTotal ?? 0;
  const canUseHint =
    !!selectedWord &&
    !isAnswerAnimating &&
    (!isHintCountKnown || selectedHintStage < resolvedSelectedHintTotal);
  const hintButtonLabel = !selectedWord
    ? "Hint"
    : !isHintCountKnown
      ? "Hint"
      : resolvedSelectedHintTotal <= 0
        ? "No hints"
        : `Hint ${Math.min(selectedHintStage + 1, resolvedSelectedHintTotal)}/${resolvedSelectedHintTotal}`;
  const selectedClueText = useMemo(() => {
    if (!selectedWord) {
      return "Pick a clue or tap a cell";
    }
    const subject = subjectByIdRef.current.get(selectedWord.subjectId) ?? null;
    return getClueTextForWord(selectedWord, clueDisplayMode, subject);
  }, [clueDisplayMode, selectedWord]);
  const useLargePromptClue = useMemo(
    () => containsJapaneseCharacters(selectedClueText),
    [selectedClueText]
  );

  if (isLoading) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}>
            Building your crossword...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!puzzle) {
    return (
      <SafeAreaView
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.textColor }]}>
            Couldn&apos;t load crossword.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isComplete && !hasAcknowledgedCompletion) {
    return (
      <CrosswordCompletionCheckpoint
        puzzle={puzzle}
        clueDisplayMode={clueDisplayMode}
        completedWordIds={completedWordIds}
        subjectById={subjectByIdRef.current}
        onViewStats={() => setHasAcknowledgedCompletion(true)}
      />
    );
  }

  if (isComplete) {
    return (
      <CrosswordSummary
        puzzle={puzzle}
        completedWordIds={completedWordIds}
        revealedWordIds={revealedWordIds}
        revealCount={revealCount}
        attemptsByWordId={attemptsByWordId}
        mistakes={mistakes}
        elapsedMs={elapsedMs}
        onPlayAgain={handlePlayAgain}
        onBackToDashboard={handleBackToDashboard}
      />
    );
  }

  const totalWords = puzzle.words.length;
  const solvedCount = completedWordIds.size;

  const expectedLength = selectedWord
    ? Array.from(selectedWord.word).length
    : 0;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={handleExit}
            style={styles.iconButton}
            activeOpacity={0.7}
          >
            <Ionicons
              name="chevron-back"
              size={24}
              color={theme.textColor}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>
            Crossword
          </Text>
        </View>
        <View style={styles.headerRight}>
          <View
            style={[
              styles.headerStatPill,
              { backgroundColor: `${theme.primary}1A`, borderColor: `${theme.primary}40` },
            ]}
          >
            <Ionicons
              name="grid-outline"
              size={12}
              color={theme.primary}
            />
            <Text style={[styles.headerPillText, { color: theme.primary }]}>
              {solvedCount}/{totalWords}
            </Text>
          </View>
          <View
            style={[
              styles.headerStatPill,
              { backgroundColor: theme.cardBackground, borderColor: theme.border },
            ]}
          >
            <Ionicons
              name="time-outline"
              size={12}
              color={theme.textSecondary}
            />
            <Text style={[styles.headerPillText, { color: theme.textSecondary }]}>
              {formatElapsed(elapsedMs)}
            </Text>
          </View>
          <View
            style={[
              styles.headerStatPill,
              { backgroundColor: theme.cardBackground, borderColor: theme.border },
            ]}
          >
            <Ionicons
              name="close-circle-outline"
              size={12}
              color={theme.textSecondary}
            />
            <Text style={[styles.headerPillText, { color: theme.textSecondary }]}>
              {mistakes}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={mainScrollRef}
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        onScroll={(event) => {
          scrollYRef.current = event.nativeEvent.contentOffset.y;
        }}
        onLayout={(event) => {
          const nextHeight = event.nativeEvent.layout.height;
          setScrollViewportHeight((prev) =>
            Math.abs(prev - nextHeight) < 1 ? prev : nextHeight
          );
        }}
      >
        <View
          onLayout={(event) => {
            const nextLayout = {
              y: event.nativeEvent.layout.y,
              height: event.nativeEvent.layout.height,
            };
            setGridLayout((prev) => {
              if (
                prev &&
                Math.abs(prev.y - nextLayout.y) < 1 &&
                Math.abs(prev.height - nextLayout.height) < 1
              ) {
                return prev;
              }
              return nextLayout;
            });
          }}
        >
          <Animated.View
            style={{
              transform: [
                {
                  translateX: shakeAnim.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [-8, 0, 8],
                  }),
                },
              ],
            }}
          >
            <CrosswordGridView
              puzzle={puzzle}
              cellSize={cellSize}
              selectedWordId={selectedWordId}
              selectedCellSet={selectedCellSet}
              completedCellSet={completedCellSet}
              typedPreviewByCell={typedPreviewByCell}
              wordCompletionAnimation={wordCompletionAnimation}
              getWordCellIndex={getWordCellIndex}
              onCellPress={handleCellPress}
              theme={theme}
            />
          </Animated.View>
        </View>

        <View style={styles.cluesSection}>
          <Text style={[styles.cluesTitle, { color: theme.textColor }]}>
            Clues
          </Text>
          <ClueList
            puzzle={puzzle}
            direction="across"
            label="Across"
            selectedWordId={selectedWordId}
            completedWordIds={completedWordIds}
            clueDisplayMode={clueDisplayMode}
            subjectById={subjectByIdRef.current}
            onSelect={handleClueSelect}
            theme={theme}
          />
          <ClueList
            puzzle={puzzle}
            direction="down"
            label="Down"
            selectedWordId={selectedWordId}
            completedWordIds={completedWordIds}
            clueDisplayMode={clueDisplayMode}
            subjectById={subjectByIdRef.current}
            onSelect={handleClueSelect}
            theme={theme}
          />
        </View>
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.inputDock,
            {
              backgroundColor: theme.cardBackground,
              borderTopColor: theme.border,
            },
          ]}
        >
        <View style={styles.cluePromptRow}>
          <View
            style={[
              styles.cluePill,
              {
                backgroundColor: `${theme.primary}1A`,
                borderColor: theme.primary,
              },
            ]}
          >
            <Text style={[styles.cluePillText, { color: theme.primary }]}>
              {selectedWord
                ? `${selectedWord.number} ${
                    selectedWord.direction === "across" ? "Across" : "Down"
                  }`
                : "Select a word"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleRevealLetter}
            style={styles.revealButton}
            activeOpacity={0.7}
            disabled={!selectedWord || isAnswerAnimating}
          >
            <Ionicons
              name="bulb-outline"
              size={16}
              color={theme.textSecondary}
            />
            <Text
              style={[styles.revealText, { color: theme.textSecondary }]}
            >
              Reveal
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => void handleHint()}
            style={styles.revealButton}
            activeOpacity={0.7}
            disabled={!canUseHint}
          >
            <Ionicons
              name="sparkles-outline"
              size={16}
              color={
                canUseHint ? theme.textSecondary : theme.textLight
              }
            />
            <Text
              style={[
                styles.revealText,
                {
                  color: canUseHint ? theme.textSecondary : theme.textLight,
                },
              ]}
            >
              {hintButtonLabel}
            </Text>
          </TouchableOpacity>
        </View>
        <Text
          style={[
            styles.cluePrompt,
            useLargePromptClue ? styles.cluePromptLarge : null,
            { color: theme.textColor },
          ]}
          numberOfLines={2}
        >
          {selectedClueText}
        </Text>
        {selectedHintMessages.length > 0 && (
          <View style={styles.hintBlock}>
            {selectedHintMessages.map((hint, index) => (
              <Text
                key={`${selectedWord?.id ?? "hint"}-${index}`}
                style={[styles.hintText, { color: theme.textSecondary }]}
              >
                {`Hint ${index + 1}: ${hint}`}
              </Text>
            ))}
          </View>
        )}
        <View style={styles.inputRow}>
          <View
            style={[
              styles.inputBox,
              {
                borderColor:
                  feedbackState === "incorrect"
                    ? theme.error
                    : feedbackState === "correct"
                    ? CROSSWORD_SUCCESS_COLOR
                    : theme.border,
                backgroundColor: theme.backgroundColor,
              },
            ]}
          >
            <KanaInput
              ref={inputRef}
              onKanaChange={(kana) => setInputValue(kana)}
              preferUncontrolledAndroidInput
              placeholder={
                expectedLength > 0
                  ? `Enter ${expectedLength} character${
                      expectedLength === 1 ? "" : "s"
                    }`
                  : "Select a clue"
              }
              placeholderTextColor={theme.textSecondary}
              style={[
                styles.input,
                fontStyles.japaneseText,
                { color: theme.textColor },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
              blurOnSubmit={false}
              returnKeyType="go"
              onSubmitEditing={() => void handleSubmit()}
              editable={!!selectedWord}
              resetSignal={selectedWord?.id}
            />
          </View>
          <TouchableOpacity
            onPress={() => void handleSubmit()}
            style={[
              styles.submitButton,
              {
                backgroundColor: theme.primary,
                opacity: selectedWord && !isAnswerAnimating ? 1 : 0.5,
              },
            ]}
            activeOpacity={0.85}
            disabled={!selectedWord || isAnswerAnimating}
          >
            <Text style={styles.submitText}>Submit</Text>
          </TouchableOpacity>
        </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface CrosswordGridViewProps {
  puzzle: CrosswordPuzzle;
  cellSize: number;
  selectedWordId: string | null;
  selectedCellSet: Set<string>;
  completedCellSet: Set<string>;
  typedPreviewByCell: Map<string, string>;
  wordCompletionAnimation: WordCompletionAnimationState | null;
  getWordCellIndex: (
    word: PlacedCrosswordWord,
    row: number,
    col: number,
  ) => number;
  onCellPress: (row: number, col: number) => void;
  theme: ReturnType<typeof useTheme>["theme"];
}

function CrosswordGridView({
  puzzle,
  cellSize,
  selectedWordId,
  selectedCellSet,
  completedCellSet,
  typedPreviewByCell,
  wordCompletionAnimation,
  getWordCellIndex,
  onCellPress,
  theme,
}: CrosswordGridViewProps) {
  const selectedWord = selectedWordId
    ? getWordById(puzzle, selectedWordId)
    : null;
  const animatedWord = wordCompletionAnimation
    ? getWordById(puzzle, wordCompletionAnimation.wordId)
    : null;

  return (
    <View style={[styles.gridWrapper]}>
      {puzzle.cells.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={{ flexDirection: "row" }}>
          {row.map((cell, colIndex) => {
            if (!cell) {
              return (
                <View
                  key={`cell-${rowIndex}-${colIndex}`}
                  style={[
                    styles.cell,
                    styles.emptyCell,
                    { width: cellSize, height: cellSize },
                  ]}
                />
              );
            }
            const key = `${rowIndex}:${colIndex}`;
            const isSelected = selectedCellSet.has(key);
            const animatedIndex =
              animatedWord ? getWordCellIndex(animatedWord, rowIndex, colIndex) : -1;
            const isAnimatedCompleted =
              animatedIndex >= 0 &&
              !!wordCompletionAnimation &&
              animatedIndex < wordCompletionAnimation.revealedCount;
            const isCompleted = completedCellSet.has(key) || isAnimatedCompleted;
            const previewLetter = typedPreviewByCell.get(key);
            const displayedLetter = isCompleted ? cell.solution : previewLetter;

            const startsSelectedWord =
              !!selectedWord &&
              selectedWord.row === rowIndex &&
              selectedWord.col === colIndex;

            const backgroundColor = isCompleted
              ? `${CROSSWORD_SUCCESS_COLOR}33`
              : isSelected
                ? theme.primary
                : theme.cardBackground;

            const borderColor = isCompleted
              ? CROSSWORD_SUCCESS_COLOR
              : isSelected
                ? theme.primary
                : theme.border;

            const textColor = isCompleted
              ? theme.textColor
              : isSelected
                ? "white"
                : theme.textColor;

            return (
              <TouchableOpacity
                key={`cell-${rowIndex}-${colIndex}`}
                onPress={() => onCellPress(rowIndex, colIndex)}
                activeOpacity={0.85}
                style={[
                  styles.cell,
                  {
                    width: cellSize,
                    height: cellSize,
                    backgroundColor,
                    borderColor,
                  },
                ]}
              >
                {cell.number !== undefined && (
                  <Text
                    style={[
                      styles.cellNumber,
                      {
                        color: isCompleted
                          ? theme.textSecondary
                          : isSelected
                            ? "rgba(255,255,255,0.85)"
                            : theme.textSecondary,
                      },
                    ]}
                  >
                    {cell.number}
                  </Text>
                )}
                {startsSelectedWord && (
                  <View style={styles.directionMark}>
                    <Ionicons
                      name={
                        selectedWord!.direction === "across"
                          ? "play"
                          : "caret-down"
                      }
                      size={Math.max(8, Math.floor(cellSize / 4))}
                      color={
                        isCompleted
                          ? theme.textColor
                          : isSelected
                            ? "rgba(255,255,255,0.9)"
                            : theme.primary
                      }
                    />
                  </View>
                )}
                {displayedLetter && (
                  <Text
                    style={[
                      styles.cellLetter,
                      isCompleted
                        ? fontStyles.japaneseBold
                        : fontStyles.japaneseText,
                      {
                        color: textColor,
                        fontSize: Math.floor(cellSize * 0.55),
                        opacity: isCompleted ? 1 : 0.92,
                      },
                    ]}
                  >
                    {displayedLetter}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

interface ClueListProps {
  puzzle: CrosswordPuzzle;
  direction: "across" | "down";
  label: string;
  selectedWordId: string | null;
  completedWordIds: Set<string>;
  clueDisplayMode: CrosswordClueDisplayMode;
  subjectById: Map<number, ApiSubject>;
  onSelect: (word: PlacedCrosswordWord) => void;
  theme: ReturnType<typeof useTheme>["theme"];
}

function ClueList({
  puzzle,
  direction,
  label,
  selectedWordId,
  completedWordIds,
  clueDisplayMode,
  subjectById,
  onSelect,
  theme,
}: ClueListProps) {
  const items = puzzle.words
    .filter((w) => w.direction === direction)
    .sort((a, b) => a.number - b.number);
  if (items.length === 0) return null;
  return (
    <View style={styles.cluesGroup}>
      <Text style={[styles.cluesGroupTitle, { color: theme.textSecondary }]}>
        {label}
      </Text>
      {items.map((word) => {
        const isSelected = word.id === selectedWordId;
        const isSolved = completedWordIds.has(word.id);
        const subject = subjectById.get(word.subjectId) ?? null;
        const clueText = getClueTextForWord(word, clueDisplayMode, subject);
        const useLargeClueText = containsJapaneseCharacters(clueText);
        return (
          <TouchableOpacity
            key={word.id}
            onPress={() => onSelect(word)}
            style={[
              styles.clueRow,
              {
                backgroundColor: isSelected
                  ? `${theme.primary}1A`
                  : "transparent",
                borderColor: isSelected ? theme.primary : "transparent",
              },
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.clueNumber, { color: theme.textSecondary }]}>
              {word.number}.
            </Text>
            <Text
              style={[
                styles.clueText,
                useLargeClueText ? styles.clueTextLarge : null,
                {
                  color: isSolved ? theme.textSecondary : theme.textColor,
                  textDecorationLine: isSolved ? "line-through" : "none",
                },
              ]}
              numberOfLines={2}
            >
              {clueText}
            </Text>
            <Text
              style={[
                styles.clueLength,
                { color: theme.textSecondary },
              ]}
            >
              ({Array.from(word.word).length})
            </Text>
            {isSolved && (
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={CROSSWORD_SUCCESS_COLOR}
                style={{ marginLeft: 6 }}
              />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

interface CrosswordCompletionCheckpointProps {
  puzzle: CrosswordPuzzle;
  completedWordIds: Set<string>;
  clueDisplayMode: CrosswordClueDisplayMode;
  subjectById: Map<number, ApiSubject>;
  onViewStats: () => void;
}

function CrosswordCompletionCheckpoint({
  puzzle,
  completedWordIds,
  clueDisplayMode,
  subjectById,
  onViewStats,
}: CrosswordCompletionCheckpointProps) {
  const { theme } = useTheme();
  const completedCellSet = useMemo(() => {
    const out = new Set<string>();
    for (const word of puzzle.words) {
      if (!completedWordIds.has(word.id)) continue;
      for (const cell of getCellsForWord(puzzle, word)) {
        out.add(`${cell.row}:${cell.col}`);
      }
    }
    return out;
  }, [completedWordIds, puzzle]);

  const cellSize = useMemo(() => {
    const horizontalPadding = 24;
    const screenWidth = Dimensions.get("window").width - horizontalPadding;
    const target = Math.floor(screenWidth / Math.max(puzzle.cols, 1));
    return Math.max(14, Math.min(48, target));
  }, [puzzle]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <View
        style={[styles.summaryHeader, { borderBottomColor: theme.border }]}
      >
        <Text style={[styles.summaryTitle, { color: theme.textColor }]}>
          Crossword Complete!
        </Text>
        <Text style={[styles.summarySubtitle, { color: theme.textSecondary }]}>
          Nice work. Take a moment to enjoy the finished grid.
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View style={styles.completionBadgeRow}>
          <View
            style={[
              styles.completionBadge,
              {
                backgroundColor: `${theme.primary}1A`,
                borderColor: `${theme.primary}50`,
              },
            ]}
          >
            <Ionicons name="trophy" size={16} color={theme.primary} />
            <Text
              style={[styles.completionBadgeText, { color: theme.primary }]}
            >
              Level Cleared
            </Text>
          </View>
        </View>

        <CrosswordGridView
          puzzle={puzzle}
          cellSize={cellSize}
          selectedWordId={null}
          selectedCellSet={new Set()}
          completedCellSet={completedCellSet}
          typedPreviewByCell={new Map()}
          wordCompletionAnimation={null}
          getWordCellIndex={() => -1}
          onCellPress={() => {}}
          theme={theme}
        />

        <View style={styles.cluesSection}>
          <Text style={[styles.cluesTitle, { color: theme.textColor }]}>
            Completed Clues
          </Text>
          <ClueList
            puzzle={puzzle}
            direction="across"
            label="Across"
            selectedWordId={null}
            completedWordIds={completedWordIds}
            clueDisplayMode={clueDisplayMode}
            subjectById={subjectById}
            onSelect={() => {}}
            theme={theme}
          />
          <ClueList
            puzzle={puzzle}
            direction="down"
            label="Down"
            selectedWordId={null}
            completedWordIds={completedWordIds}
            clueDisplayMode={clueDisplayMode}
            subjectById={subjectById}
            onSelect={() => {}}
            theme={theme}
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.summaryFooter,
          {
            backgroundColor: theme.cardBackground,
            borderTopColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.summaryButton, { backgroundColor: theme.primary }]}
          onPress={onViewStats}
          activeOpacity={0.85}
        >
          <Ionicons
            name="stats-chart"
            size={20}
            color="white"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.summaryButtonText}>View Statistics</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

interface CrosswordSummaryProps {
  puzzle: CrosswordPuzzle;
  completedWordIds: Set<string>;
  revealedWordIds: Set<string>;
  revealCount: number;
  attemptsByWordId: Record<string, number>;
  mistakes: number;
  elapsedMs: number;
  onPlayAgain: () => void;
  onBackToDashboard: () => void;
}

function CrosswordSummary({
  puzzle,
  completedWordIds,
  revealedWordIds,
  revealCount,
  attemptsByWordId,
  mistakes,
  elapsedMs,
  onPlayAgain,
  onBackToDashboard,
}: CrosswordSummaryProps) {
  const { theme } = useTheme();
  const total = puzzle.words.length;
  const solved = puzzle.words.filter((w) => completedWordIds.has(w.id)).length;
  const revealed = puzzle.words.filter((w) => revealedWordIds.has(w.id)).length;
  const solvedByTyping = Math.max(0, solved - revealed);
  const solvedFirstTry = puzzle.words.filter(
    (w) =>
      completedWordIds.has(w.id) &&
      !revealedWordIds.has(w.id) &&
      (attemptsByWordId[w.id] ?? 0) <= 1
  ).length;
  const accuracy =
    solvedByTyping > 0 ? Math.round((solvedFirstTry / solvedByTyping) * 100) : 0;

  const entries: CrosswordWordResultEntry[] = puzzle.words
    .slice()
    .sort((a, b) => a.number - b.number)
    .map((w) => ({
      subjectId: w.subjectId,
      hiragana: w.word,
      meaning: w.meaning,
      number: w.number,
      direction: w.direction,
      level: w.level,
      attempts: attemptsByWordId[w.id] ?? 0,
      solved: completedWordIds.has(w.id),
      revealed: revealedWordIds.has(w.id),
    }));

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <View style={[styles.summaryHeader, { borderBottomColor: theme.border }]}>
        <Text style={[styles.summaryTitle, { color: theme.textColor }]}>
          Crossword Complete!
        </Text>
        <Text style={[styles.summarySubtitle, { color: theme.textSecondary }]}>
          {solved === total
            ? "You filled in every word."
            : `Solved ${solved} of ${total} words.`}
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120 }}>
        <View style={styles.summaryStatsRow}>
          <SummaryStat
            theme={theme}
            iconName="checkmark-done"
            label="Solved"
            value={`${solved}/${total}`}
          />
          <SummaryStat
            theme={theme}
            iconName="create"
            label="Typed"
            value={`${solvedByTyping}/${total}`}
          />
          <SummaryStat
            theme={theme}
            iconName="bulb"
            label="Revealed"
            value={`${revealed}/${total}`}
          />
          <SummaryStat
            theme={theme}
            iconName="time"
            label="Time"
            value={formatElapsed(elapsedMs)}
          />
        </View>

        <View
          style={[
            styles.summaryBreakdownCard,
            { backgroundColor: theme.cardBackground, borderColor: theme.border },
          ]}
        >
          <View style={styles.summaryBreakdownRow}>
            <Text
              style={[
                styles.summaryBreakdownLabel,
                { color: theme.textSecondary },
              ]}
            >
              Reveal button presses
            </Text>
            <Text
              style={[styles.summaryBreakdownValue, { color: theme.textColor }]}
            >
              {revealCount}
            </Text>
          </View>
          <View style={styles.summaryBreakdownRow}>
            <Text
              style={[
                styles.summaryBreakdownLabel,
                { color: theme.textSecondary },
              ]}
            >
              First-try accuracy (typed only)
            </Text>
            <Text
              style={[styles.summaryBreakdownValue, { color: theme.textColor }]}
            >
              {`${accuracy}%`}
            </Text>
          </View>
          <View style={styles.summaryBreakdownRow}>
            <Text
              style={[
                styles.summaryBreakdownLabel,
                { color: theme.textSecondary },
              ]}
            >
              Mistakes
            </Text>
            <Text
              style={[styles.summaryBreakdownValue, { color: theme.textColor }]}
            >
              {mistakes}
            </Text>
          </View>
        </View>

        <Text style={[styles.summarySection, { color: theme.textColor }]}>
          Words
        </Text>
        <View
          style={[
            styles.summaryCard,
            { backgroundColor: theme.cardBackground },
          ]}
        >
          {entries.map((entry, index) => (
            <TouchableOpacity
              key={`${entry.subjectId}-${entry.number}-${entry.direction}`}
              onPress={() => router.push(`/subject/${entry.subjectId}` as any)}
              activeOpacity={0.75}
              style={[
                styles.summaryRow,
                index < entries.length - 1
                  ? { borderBottomColor: theme.border, borderBottomWidth: 1 }
                  : null,
              ]}
            >
              <View
                style={[
                  styles.summaryRowNumber,
                  { backgroundColor: `${theme.primary}1A` },
                ]}
              >
                <Text
                  style={[
                    styles.summaryRowNumberText,
                    { color: theme.primary },
                  ]}
                >
                  {entry.number}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.summaryHiragana,
                    fontStyles.japaneseBold,
                    { color: theme.textColor },
                  ]}
                >
                  {entry.hiragana}
                </Text>
                <Text
                  style={[
                    styles.summaryMeaning,
                    { color: theme.textSecondary },
                  ]}
                  numberOfLines={2}
                >
                  {entry.meaning}
                </Text>
              </View>
              <View style={styles.summaryRight}>
                <Text
                  style={[
                    styles.summaryDirection,
                    { color: theme.textSecondary },
                  ]}
                >
                  {entry.direction === "across" ? "Across" : "Down"}
                </Text>
                <View style={styles.summaryAttempts}>
                  {entry.revealed ? (
                    <Ionicons name="bulb" size={18} color={theme.primary} />
                  ) : entry.solved ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={18}
                      color={CROSSWORD_SUCCESS_COLOR}
                    />
                  ) : (
                    <Ionicons
                      name="ellipse-outline"
                      size={18}
                      color={theme.textSecondary}
                    />
                  )}
                  <Text
                    style={[
                      styles.summaryAttemptsText,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {entry.revealed
                      ? "Revealed"
                      : entry.attempts > 0
                      ? `${entry.attempts} ${
                          entry.attempts === 1 ? "try" : "tries"
                        }`
                      : "Skipped"}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View
        style={[
          styles.summaryFooter,
          {
            backgroundColor: theme.cardBackground,
            borderTopColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.summaryButton,
            { backgroundColor: theme.primary },
          ]}
          onPress={onPlayAgain}
          activeOpacity={0.85}
        >
          <Ionicons
            name="grid"
            size={20}
            color="white"
            style={{ marginRight: 8 }}
          />
          <Text style={styles.summaryButtonText}>New Crossword</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.summaryButton,
            {
              backgroundColor: "transparent",
              borderColor: theme.border,
              borderWidth: 1,
            },
          ]}
          onPress={onBackToDashboard}
          activeOpacity={0.85}
        >
          <Text
            style={[styles.summaryButtonText, { color: theme.textColor }]}
          >
            Back to Dashboard
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

interface SummaryStatProps {
  theme: ReturnType<typeof useTheme>["theme"];
  iconName: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
}

function SummaryStat({ theme, iconName, label, value }: SummaryStatProps) {
  return (
    <View
      style={[
        styles.summaryStatBox,
        { backgroundColor: theme.cardBackground },
      ]}
    >
      <Ionicons name={iconName} size={18} color={theme.primary} />
      <Text style={[styles.summaryStatValue, { color: theme.textColor }]}>
        {value}
      </Text>
      <Text style={[styles.summaryStatLabel, { color: theme.textSecondary }]}>
        {label}
      </Text>
    </View>
  );
}

function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: { marginTop: 16, fontSize: 16, textAlign: "center" },
  restrictedTitle: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: "700",
  },
  restrictedSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerStatPill: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
  },
  headerPillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  scrollArea: { flex: 1 },
  scrollContent: {
    paddingVertical: 16,
    alignItems: "center",
    paddingBottom: 32,
  },
  gridWrapper: {
    alignSelf: "center",
    padding: GRID_WRAPPER_PADDING,
    borderRadius: 12,
  },
  cell: {
    margin: 1,
    borderWidth: 1,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  emptyCell: {
    borderWidth: 0,
    backgroundColor: "transparent",
  },
  cellNumber: {
    position: "absolute",
    top: 1,
    left: 2,
    fontSize: 9,
    fontWeight: "600",
  },
  directionMark: {
    position: "absolute",
    top: 1,
    right: 1,
  },
  cellLetter: {
    fontWeight: "700",
  },
  cluesSection: { width: "100%", paddingHorizontal: 16, marginTop: 16 },
  cluesTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  cluesGroup: { marginBottom: 16 },
  cluesGroupTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  clueRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    marginBottom: 4,
  },
  clueNumber: { fontSize: 13, fontWeight: "700", width: 24 },
  clueText: { flex: 1, fontSize: 14, lineHeight: 20 },
  clueTextLarge: { fontSize: 16, lineHeight: 22 },
  clueLength: { fontSize: 12 },
  inputDock: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cluePromptRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  cluePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  cluePillText: { fontSize: 12, fontWeight: "700" },
  revealButton: { flexDirection: "row", alignItems: "center", gap: 4 },
  revealText: { fontSize: 12, fontWeight: "600" },
  cluePrompt: { fontSize: 16, fontWeight: "600", marginBottom: 10 },
  cluePromptLarge: { fontSize: 18, lineHeight: 24 },
  hintBlock: {
    marginBottom: 10,
    gap: 4,
  },
  hintText: {
    fontSize: 13,
    lineHeight: 18,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputBox: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    justifyContent: "center",
  },
  input: {
    fontSize: 18,
    paddingVertical: 0,
  },
  submitButton: {
    paddingHorizontal: 18,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  submitText: { color: "white", fontSize: 16, fontWeight: "700" },
  summaryHeader: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryTitle: { fontSize: 24, fontWeight: "800" },
  summarySubtitle: { fontSize: 14, marginTop: 4 },
  summaryStatsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  summaryBreakdownCard: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 20,
    gap: 8,
  },
  summaryBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  summaryBreakdownLabel: {
    fontSize: 13,
    flex: 1,
  },
  summaryBreakdownValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  summaryStatBox: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: "center",
    gap: 4,
  },
  summaryStatValue: { fontSize: 16, fontWeight: "800" },
  summaryStatLabel: { fontSize: 11, fontWeight: "500" },
  summarySection: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    marginLeft: 4,
  },
  completionBadgeRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 12,
  },
  completionBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  completionBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  summaryCard: { borderRadius: 12, paddingHorizontal: 4 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
  },
  summaryRowNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryRowNumberText: { fontSize: 13, fontWeight: "800" },
  summaryHiragana: { fontSize: 18, fontWeight: "700" },
  summaryMeaning: { fontSize: 12, marginTop: 2 },
  summaryRight: { alignItems: "flex-end", gap: 4 },
  summaryDirection: { fontSize: 11, fontWeight: "600" },
  summaryAttempts: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  summaryAttemptsText: { fontSize: 11 },
  summaryFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 10,
  },
  summaryButton: {
    flex: 1,
    flexDirection: "row",
    paddingVertical: 14,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  summaryButtonText: { color: "white", fontSize: 15, fontWeight: "700" },
});
