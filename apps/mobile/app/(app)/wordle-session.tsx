import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Alert,
  Dimensions,
  Easing,
  Keyboard,
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
  type KanaInputHandle,
} from "../../src/components/TextToKanaInput";
import { useSession } from "../../src/contexts/AuthContext";
import {
  Assignment,
  Subject as ApiSubject,
  getAllAssignmentsCached,
} from "../../src/utils/api";
import { getAllSubjects, getSubjectById } from "../../src/utils/cache";
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
import { isPortegoUsername } from "../../src/utils/portegoAccess";
import { getAssignmentsFromPermanentStorage } from "../../src/utils/permanentStorage";
import { useAuthStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

const HIRAGANA_RANGE_REGEX = /^[぀-ゟー]+$/;
const WORDLE_CORRECT_COLOR = "#3DDC84";
const WORDLE_PRESENT_COLOR = "#E9B949";
const WORDLE_ABSENT_COLOR = "#6D7280";

const WORDLE_SESSION_KEY = EXTRA_STUDY_SESSION_STORAGE_KEYS.WORDLE;

type ThemeColors = ReturnType<typeof useTheme>["theme"];
type LetterResult = "correct" | "present" | "absent";

interface WordleConfig {
  includeVocabulary: boolean;
  includeKanaVocabulary: boolean;
  wordLength: number;
  maxAttempts: number;
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

interface WordleCandidate {
  subjectId: number;
  reading: string;
  meaning: string;
  kanjiForm: string | null;
  level?: number;
  object: "vocabulary" | "kana_vocabulary";
}

interface WordleGuessEntry {
  guess: string;
  result: LetterResult[];
}

interface SavedWordleSession {
  savedAt: number;
  config: WordleConfig;
  targetWord: WordleCandidate;
  validWords: string[];
  guesses: WordleGuessEntry[];
  inputValue: string;
  mistakes: number;
  startedAt: number;
  elapsedMs: number;
}

function createDefaultConfig(userLevel: number): WordleConfig {
  return {
    includeVocabulary: true,
    includeKanaVocabulary: true,
    wordLength: 5,
    maxAttempts: 6,
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
  };
}

function sanitizeConfig(
  rawConfig: Partial<WordleConfig>,
  userLevel: number,
): WordleConfig {
  const defaults = createDefaultConfig(userLevel);
  const minLevelRaw =
    typeof rawConfig.minLevel === "number" && Number.isFinite(rawConfig.minLevel)
      ? Math.max(1, Math.round(rawConfig.minLevel))
      : defaults.minLevel;
  const maxLevelRaw =
    typeof rawConfig.maxLevel === "number" && Number.isFinite(rawConfig.maxLevel)
      ? Math.max(1, Math.round(rawConfig.maxLevel))
      : defaults.maxLevel;
  const boundedMaxLevel = Math.max(1, Math.round(userLevel));
  const minLevel = Math.min(Math.max(1, minLevelRaw), boundedMaxLevel);
  const maxLevel = Math.max(
    minLevel,
    Math.min(Math.max(1, maxLevelRaw), boundedMaxLevel),
  );

  return {
    includeVocabulary:
      typeof rawConfig.includeVocabulary === "boolean"
        ? rawConfig.includeVocabulary
        : defaults.includeVocabulary,
    includeKanaVocabulary:
      typeof rawConfig.includeKanaVocabulary === "boolean"
        ? rawConfig.includeKanaVocabulary
        : defaults.includeKanaVocabulary,
    wordLength:
      typeof rawConfig.wordLength === "number" && Number.isFinite(rawConfig.wordLength)
        ? Math.min(7, Math.max(3, Math.round(rawConfig.wordLength)))
        : defaults.wordLength,
    maxAttempts:
      typeof rawConfig.maxAttempts === "number" && Number.isFinite(rawConfig.maxAttempts)
        ? Math.min(8, Math.max(4, Math.round(rawConfig.maxAttempts)))
        : defaults.maxAttempts,
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
    minLevel,
    maxLevel,
    selectedListIds: parseSelectedListIds(rawConfig.selectedListIds),
  };
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function normalizeKatakanaToHiragana(input: string): string {
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0);
    if (!code) {
      continue;
    }
    if (code >= 0x30a1 && code <= 0x30f6) {
      out += String.fromCodePoint(code - 0x60);
    } else {
      out += ch;
    }
  }
  return out;
}

function normalizeWord(value: string): string {
  return normalizeKatakanaToHiragana(value).trim();
}

function getPrimaryReading(subject: ApiSubject): string | null {
  if (
    subject.object === "kana_vocabulary" &&
    typeof subject.data.characters === "string" &&
    subject.data.characters.length > 0
  ) {
    return normalizeWord(subject.data.characters);
  }

  const readings = subject.data.readings;
  if (!readings || readings.length === 0) {
    return null;
  }

  const primary = readings.find((reading) => reading.primary) ?? readings[0];
  if (!primary) {
    return null;
  }

  return normalizeWord(primary.reading);
}

function getPrimaryMeaning(subject: ApiSubject): string | null {
  const meanings = subject.data.meanings;
  if (!meanings || meanings.length === 0) {
    return null;
  }

  const primaryMeaning = meanings.find((meaning) => meaning.primary) ?? meanings[0];
  const resolved = primaryMeaning?.meaning?.trim();
  return resolved ? resolved : null;
}

function getKanjiForm(subject: ApiSubject, reading: string): string | null {
  const characters = subject.data.characters;
  if (typeof characters !== "string") {
    return null;
  }
  const trimmed = characters.trim();
  if (!trimmed) {
    return null;
  }

  const normalizedCharacters = normalizeWord(trimmed);
  return normalizedCharacters === reading ? null : trimmed;
}

function buildAllowedSrsStages(config: WordleConfig): Set<number> {
  const allowed = new Set<number>();
  if (config.srsGroups.apprentice) {
    [1, 2, 3, 4].forEach((stage) => allowed.add(stage));
  }
  if (config.srsGroups.guru) {
    [5, 6].forEach((stage) => allowed.add(stage));
  }
  if (config.srsGroups.master) {
    allowed.add(7);
  }
  if (config.srsGroups.enlightened) {
    allowed.add(8);
  }
  if (config.srsGroups.burned) {
    allowed.add(9);
  }
  return allowed;
}

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function buildWordleCandidates(
  subjects: ApiSubject[],
  config: WordleConfig,
): WordleCandidate[] {
  const out: WordleCandidate[] = [];

  for (const subject of subjects) {
    if (subject.object !== "vocabulary" && subject.object !== "kana_vocabulary") {
      continue;
    }

    if (subject.object === "vocabulary" && !config.includeVocabulary) {
      continue;
    }
    if (subject.object === "kana_vocabulary" && !config.includeKanaVocabulary) {
      continue;
    }

    const reading = getPrimaryReading(subject);
    if (!reading || !HIRAGANA_RANGE_REGEX.test(reading)) {
      continue;
    }

    if (Array.from(reading).length !== config.wordLength) {
      continue;
    }

    const meaning = getPrimaryMeaning(subject);
    if (!meaning) {
      continue;
    }

    out.push({
      subjectId: subject.id,
      reading,
      meaning,
      kanjiForm: getKanjiForm(subject, reading),
      level: subject.data.level,
      object: subject.object,
    });
  }

  return out;
}

function evaluateGuess(guess: string, answer: string): LetterResult[] {
  const guessChars = Array.from(guess);
  const answerChars = Array.from(answer);
  const result: LetterResult[] = Array.from({ length: answerChars.length }, () => "absent");

  const remaining = new Map<string, number>();

  for (let i = 0; i < answerChars.length; i += 1) {
    if (guessChars[i] === answerChars[i]) {
      result[i] = "correct";
      continue;
    }

    const currentCount = remaining.get(answerChars[i]) ?? 0;
    remaining.set(answerChars[i], currentCount + 1);
  }

  for (let i = 0; i < answerChars.length; i += 1) {
    if (result[i] === "correct") {
      continue;
    }

    const char = guessChars[i];
    if (!char) {
      continue;
    }

    const availableCount = remaining.get(char) ?? 0;
    if (availableCount > 0) {
      result[i] = "present";
      remaining.set(char, availableCount - 1);
    }
  }

  return result;
}

function mergeLetterResult(
  current: LetterResult | undefined,
  incoming: LetterResult,
): LetterResult {
  if (!current) {
    return incoming;
  }

  const rank: Record<LetterResult, number> = {
    absent: 1,
    present: 2,
    correct: 3,
  };

  return rank[incoming] > rank[current] ? incoming : current;
}

interface WordleBoardProps {
  theme: ThemeColors;
  wordLength: number;
  maxAttempts: number;
  guesses: WordleGuessEntry[];
  currentInput: string;
  showCurrentInput: boolean;
  revealingRowIndex: number | null;
  revealedTileCount: number;
  tileFlipAnimations: Animated.Value[];
}

function WordleBoard({
  theme,
  wordLength,
  maxAttempts,
  guesses,
  currentInput,
  showCurrentInput,
  revealingRowIndex,
  revealedTileCount,
  tileFlipAnimations,
}: WordleBoardProps) {
  const cellSize = useMemo(() => {
    const horizontalPadding = 36;
    const gaps = (wordLength - 1) * 8;
    const screenWidth = Dimensions.get("window").width - horizontalPadding - gaps;
    const candidateSize = Math.floor(screenWidth / Math.max(wordLength, 1));
    return Math.max(42, Math.min(64, candidateSize));
  }, [wordLength]);

  const currentChars = useMemo(
    () => Array.from(normalizeWord(currentInput)).slice(0, wordLength),
    [currentInput, wordLength],
  );

  return (
    <View style={styles.boardContainer}>
      {Array.from({ length: maxAttempts }).map((_, rowIndex) => {
        const guess = guesses[rowIndex];
        const isCurrentRow = showCurrentInput && rowIndex === guesses.length;
        const rowChars = guess
          ? Array.from(guess.guess)
          : isCurrentRow
            ? currentChars
            : [];
        const rowResults = guess?.result ?? [];

        return (
          <View key={`row-${rowIndex}`} style={styles.boardRow}>
            {Array.from({ length: wordLength }).map((_, colIndex) => {
              const char = rowChars[colIndex] ?? "";
              const result = rowResults[colIndex];
              const isFilled = char.length > 0;
              const isRevealingTile =
                revealingRowIndex === rowIndex &&
                !!guess &&
                colIndex < tileFlipAnimations.length;
              const isTileRevealed =
                !!result && (!isRevealingTile || colIndex < revealedTileCount);

              let backgroundColor = theme.cardBackground;
              let borderColor = theme.border;
              let textColor = theme.textColor;

              if (result === "correct" && isTileRevealed) {
                backgroundColor = WORDLE_CORRECT_COLOR;
                borderColor = WORDLE_CORRECT_COLOR;
                textColor = "#FFFFFF";
              } else if (result === "present" && isTileRevealed) {
                backgroundColor = WORDLE_PRESENT_COLOR;
                borderColor = WORDLE_PRESENT_COLOR;
                textColor = "#FFFFFF";
              } else if (result === "absent" && isTileRevealed) {
                backgroundColor = WORDLE_ABSENT_COLOR;
                borderColor = WORDLE_ABSENT_COLOR;
                textColor = "#FFFFFF";
              } else if (isCurrentRow && isFilled) {
                borderColor = theme.primary;
                backgroundColor = `${theme.primary}12`;
              }

              const flipAnimation = isRevealingTile
                ? tileFlipAnimations[colIndex]
                : null;
              const rotateX = flipAnimation
                ? flipAnimation.interpolate({
                    inputRange: [0, 0.5, 1],
                    outputRange: ["0deg", "-90deg", "0deg"],
                  })
                : "0deg";

              return (
                <Animated.View
                  key={`tile-${rowIndex}-${colIndex}`}
                  style={[
                    styles.tile,
                    {
                      width: cellSize,
                      height: cellSize,
                      borderColor,
                      backgroundColor,
                      transform: [{ perspective: 1000 }, { rotateX }],
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.tileText,
                      fontStyles.japaneseBold,
                      {
                        color: textColor,
                        fontSize: Math.max(20, Math.floor(cellSize * 0.48)),
                      },
                    ]}
                  >
                    {char}
                  </Text>
                </Animated.View>
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

interface WordleSummaryProps {
  theme: ThemeColors;
  config: WordleConfig;
  guesses: WordleGuessEntry[];
  targetWord: WordleCandidate;
  mistakes: number;
  elapsedMs: number;
  isWon: boolean;
  onPlayAgain: () => void;
  onBackToDashboard: () => void;
}

function WordleSummary({
  theme,
  config,
  guesses,
  targetWord,
  mistakes,
  elapsedMs,
  isWon,
  onPlayAgain,
  onBackToDashboard,
}: WordleSummaryProps) {
  const attemptsUsed = guesses.length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
      <View style={[styles.summaryHeader, { borderBottomColor: theme.border }]}> 
        <View
          style={[
            styles.summaryIcon,
            {
              backgroundColor: isWon ? `${WORDLE_CORRECT_COLOR}20` : `${theme.error}20`,
              borderColor: isWon ? WORDLE_CORRECT_COLOR : theme.error,
            },
          ]}
        >
          <Ionicons
            name={isWon ? "checkmark" : "close"}
            size={20}
            color={isWon ? WORDLE_CORRECT_COLOR : theme.error}
          />
        </View>
        <Text style={[styles.summaryTitle, { color: theme.textColor }]}> 
          {isWon ? "Solved!" : "Out of Tries"}
        </Text>
        <Text style={[styles.summarySubtitle, { color: theme.textSecondary }]}> 
          {isWon
            ? "That was a clean read."
            : "No worries, the answer is shown below."}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.summaryContent}> 
        <View style={[styles.answerCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
          <Text style={[styles.answerLabel, { color: theme.textSecondary }]}>Answer</Text>
          <Text style={[styles.answerReading, fontStyles.japaneseBold, { color: theme.textColor }]}> 
            {targetWord.reading}
          </Text>
          <Text style={[styles.answerMeaning, { color: theme.textSecondary }]}> 
            {targetWord.meaning}
            {targetWord.kanjiForm ? ` • ${targetWord.kanjiForm}` : ""}
          </Text>
        </View>

        <WordleBoard
          theme={theme}
          wordLength={config.wordLength}
          maxAttempts={config.maxAttempts}
          guesses={guesses}
          currentInput=""
          showCurrentInput={false}
          revealingRowIndex={null}
          revealedTileCount={0}
          tileFlipAnimations={[]}
        />

        <View style={styles.summaryStatsRow}>
          <View style={[styles.summaryStatPill, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}> 
            <Ionicons name="flag-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.summaryStatText, { color: theme.textSecondary }]}> 
              {attemptsUsed}/{config.maxAttempts}
            </Text>
          </View>
          <View style={[styles.summaryStatPill, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}> 
            <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.summaryStatText, { color: theme.textSecondary }]}> 
              {formatElapsed(elapsedMs)}
            </Text>
          </View>
          <View style={[styles.summaryStatPill, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}> 
            <Ionicons name="alert-circle-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.summaryStatText, { color: theme.textSecondary }]}> 
              {mistakes}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={[styles.summaryFooter, { borderTopColor: theme.border, backgroundColor: theme.cardBackground }]}> 
        <TouchableOpacity
          onPress={onPlayAgain}
          style={[styles.summaryButton, { backgroundColor: theme.primary }]}
          activeOpacity={0.85}
        >
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.summaryButtonText}>Play Again</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onBackToDashboard}
          style={[styles.summaryButton, { backgroundColor: theme.isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)" }]}
          activeOpacity={0.85}
        >
          <Ionicons name="home-outline" size={18} color={theme.textColor} />
          <Text style={[styles.summaryButtonText, { color: theme.textColor }]}>Dashboard</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function WordleSessionScreen() {
  const { theme } = useTheme();
  const { apiToken, userData } = useAuthStore();
  const userLevel = userData?.level ?? 60;
  const isPortegoUser = isPortegoUsername(userData?.username);
  const { isLoading: isAuthLoading } = useSession();
  const params = useLocalSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [config, setConfig] = useState<WordleConfig | null>(null);
  const [targetWord, setTargetWord] = useState<WordleCandidate | null>(null);
  const [validWords, setValidWords] = useState<string[]>([]);
  const [guesses, setGuesses] = useState<WordleGuessEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [mistakes, setMistakes] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(() => Date.now());
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [hasRestoredSession, setHasRestoredSession] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string>("");
  const [feedbackTone, setFeedbackTone] = useState<"neutral" | "success" | "error">(
    "neutral",
  );
  const [revealingRowIndex, setRevealingRowIndex] = useState<number | null>(null);
  const [revealedTileCount, setRevealedTileCount] = useState(0);
  const [isRevealAnimating, setIsRevealAnimating] = useState(false);

  const inputRef = useRef<KanaInputHandle>(null);
  const tileFlipAnimationsRef = useRef<Animated.Value[]>([]);

  const clearSavedSession = useCallback(async () => {
    await clearExtraStudySessionState(WORDLE_SESSION_KEY);
  }, []);

  const initializeFlipAnimations = useCallback((wordLength: number) => {
    tileFlipAnimationsRef.current = Array.from(
      { length: wordLength },
      () => new Animated.Value(0),
    );
  }, []);

  const animateFlipValue = useCallback(
    (value: Animated.Value, toValue: number, duration: number) =>
      new Promise<boolean>((resolve) => {
        Animated.timing(value, {
          toValue,
          duration,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }).start(({ finished }) => resolve(finished));
      }),
    [],
  );

  const runRevealAnimation = useCallback(
    async (rowIndex: number, wordLength: number): Promise<void> => {
      if (tileFlipAnimationsRef.current.length !== wordLength) {
        initializeFlipAnimations(wordLength);
      }

      const animations = tileFlipAnimationsRef.current;
      animations.forEach((animation) => {
        animation.stopAnimation();
        animation.setValue(0);
      });

      setIsRevealAnimating(true);
      setRevealingRowIndex(rowIndex);
      setRevealedTileCount(0);
      try {
        for (let index = 0; index < wordLength; index += 1) {
          const flipValue = animations[index];
          if (!flipValue) {
            continue;
          }

          const collapsed = await animateFlipValue(flipValue, 0.5, 120);
          if (!collapsed) {
            continue;
          }

          setRevealedTileCount(index + 1);
          await animateFlipValue(flipValue, 1, 120);
          flipValue.setValue(0);
        }
      } finally {
        setRevealingRowIndex(null);
        setRevealedTileCount(0);
        setIsRevealAnimating(false);
      }
    },
    [animateFlipValue, initializeFlipAnimations],
  );

  const persistSession = useCallback(async (): Promise<boolean> => {
    if (!config || !targetWord || isComplete) {
      return false;
    }

    const payload: SavedWordleSession = {
      savedAt: Date.now(),
      config,
      targetWord,
      validWords,
      guesses,
      inputValue,
      mistakes,
      startedAt,
      elapsedMs,
    };

    return saveExtraStudySessionState(WORDLE_SESSION_KEY, payload);
  }, [
    config,
    elapsedMs,
    guesses,
    inputValue,
    isComplete,
    mistakes,
    startedAt,
    targetWord,
    validWords,
  ]);

  const restoreSavedSession = useCallback(async (): Promise<boolean> => {
    const saved = await loadExtraStudySessionState<SavedWordleSession>(
      WORDLE_SESSION_KEY,
    );
    if (!saved) {
      return false;
    }

    const savedTarget = saved.targetWord;
    if (
      !saved.config ||
      !savedTarget ||
      typeof savedTarget.reading !== "string" ||
      !Array.isArray(saved.guesses)
    ) {
      await clearSavedSession();
      return false;
    }

    const sanitizedConfig = sanitizeConfig(saved.config, userLevel);
    if (Array.from(savedTarget.reading).length !== sanitizedConfig.wordLength) {
      await clearSavedSession();
      return false;
    }

    setConfig(sanitizedConfig);
    setTargetWord(savedTarget);
    setValidWords(
      Array.isArray(saved.validWords)
        ? saved.validWords.filter((entry) => typeof entry === "string")
        : [],
    );
    setGuesses(
      saved.guesses.filter(
        (guess) =>
          typeof guess.guess === "string" &&
          Array.isArray(guess.result) &&
          guess.result.length === sanitizedConfig.wordLength,
      ),
    );
    setInputValue(typeof saved.inputValue === "string" ? saved.inputValue : "");
    setMistakes(
      typeof saved.mistakes === "number" && Number.isFinite(saved.mistakes)
        ? Math.max(0, Math.round(saved.mistakes))
        : 0,
    );
    setStartedAt(
      typeof saved.startedAt === "number" && Number.isFinite(saved.startedAt)
        ? saved.startedAt
        : Date.now(),
    );
    setElapsedMs(
      typeof saved.elapsedMs === "number" && Number.isFinite(saved.elapsedMs)
        ? Math.max(0, Math.round(saved.elapsedMs))
        : 0,
    );
    setIsComplete(false);
    setIsWon(false);
    setHasRestoredSession(true);
    setFeedbackMessage("");
    setFeedbackTone("neutral");
    initializeFlipAnimations(sanitizedConfig.wordLength);
    setRevealingRowIndex(null);
    setRevealedTileCount(0);
    setIsRevealAnimating(false);
    setIsLoading(false);

    return true;
  }, [clearSavedSession, initializeFlipAnimations, userLevel]);

  const loadConfig = useCallback(async () => {
    if (!isPortegoUser) {
      return;
    }

    try {
      const shouldResume = params.resume === "true";
      if (shouldResume) {
        const restored = await restoreSavedSession();
        if (restored) {
          return;
        }

        if (!params.sessionId) {
          Alert.alert("Session Not Available", "Couldn't restore that Wordle run.", [
            { text: "OK", onPress: () => router.replace("/wordle-config") },
          ]);
          return;
        }
      }

      setHasRestoredSession(false);

      if (params.sessionId) {
        const rawConfig = await AsyncStorage.getItem(`wordle_config_${params.sessionId}`);
        if (!rawConfig) {
          throw new Error("Wordle config not found in storage");
        }

        const parsed = JSON.parse(rawConfig) as Partial<WordleConfig>;
        setConfig(sanitizeConfig(parsed, userLevel));
        await AsyncStorage.removeItem(`wordle_config_${params.sessionId}`);
      } else {
        const parsedConfig: Partial<WordleConfig> = {
          includeVocabulary: params.includeVocabulary !== "false",
          includeKanaVocabulary: params.includeKanaVocabulary !== "false",
          wordLength: params.wordLength
            ? parseInt(params.wordLength as string, 10)
            : undefined,
          maxAttempts: params.maxAttempts
            ? parseInt(params.maxAttempts as string, 10)
            : undefined,
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
            : undefined,
          maxLevel: params.maxLevel
            ? parseInt(params.maxLevel as string, 10)
            : undefined,
          selectedListIds: parseSelectedListIds(
            typeof params.selectedListIds === "string"
              ? (params.selectedListIds as string).split(",")
              : [],
          ),
        };
        setConfig(sanitizeConfig(parsedConfig, userLevel));
      }
    } catch (error) {
      console.error("Failed to load Wordle config:", error);
      Alert.alert("Error", "Failed to load Wordle configuration.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    }
  }, [
    isPortegoUser,
    params.includeKanaVocabulary,
    params.includeVocabulary,
    params.maxAttempts,
    params.maxLevel,
    params.minLevel,
    params.resume,
    params.selectedListIds,
    params.sessionId,
    params.srsApprentice,
    params.srsBurned,
    params.srsEnlightened,
    params.srsGuru,
    params.srsMaster,
    params.useCustomLevelRange,
    params.wordLength,
    restoreSavedSession,
    userLevel,
  ]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const buildGame = useCallback(async () => {
    if (isAuthLoading || !config) {
      return;
    }

    try {
      setIsLoading(true);
      await clearSavedSession();

      const allowedStages = buildAllowedSrsStages(config);
      const shouldFilterBySrs = allowedStages.size < 9;

      const cachedSubjects = await getAllSubjects();
      const allCachedSubjects = Array.isArray(cachedSubjects)
        ? (cachedSubjects as ApiSubject[])
        : [];
      const subjectById = new Map<number, ApiSubject>(
        allCachedSubjects.map((subject) => [subject.id, subject]),
      );

      let candidates: ApiSubject[] = [];

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

      if (candidates.length === 0) {
        if (!shouldFilterBySrs) {
          candidates = allCachedSubjects;
        } else if (apiToken) {
          try {
            const assignmentsResponse = await getAllAssignmentsCached(apiToken, {
              srs_stages: Array.from(allowedStages),
            });

            const subjectIds = assignmentsResponse.data.map(
              (assignment: Assignment) => assignment.data.subject_id,
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
          } catch (error) {
            console.warn(
              "Wordle: failed to load SRS-filtered assignments, falling back to cached subjects",
              error,
            );
          }
        }
      }

      if (candidates.length === 0) {
        candidates = allCachedSubjects;
      }

      const selectedListSubjectIds = await getSelectedListSubjectIdSet(
        config.selectedListIds || [],
      );
      const effectiveMinLevel = config.useCustomLevelRange ? config.minLevel : 1;
      const requestedMaxLevel = config.useCustomLevelRange
        ? config.maxLevel
        : userLevel;
      const effectiveMaxLevel = Math.min(requestedMaxLevel, userLevel);

      const filteredSubjects = candidates.filter((subject) => {
        const level = subject.data?.level;
        const inLevelRange =
          typeof level === "number" &&
          level >= effectiveMinLevel &&
          level <= effectiveMaxLevel;

        if (!inLevelRange) {
          return false;
        }

        return subjectMatchesSelectedLists(
          subject.id,
          config.selectedListIds || [],
          selectedListSubjectIds,
        );
      });

      const wordCandidates = buildWordleCandidates(filteredSubjects, config);
      if (wordCandidates.length < 6) {
        Alert.alert(
          "Not Enough Words",
          "Not enough learned words match your filters and length. Try widening your settings.",
          [{ text: "OK", onPress: () => router.replace("/wordle-config") }],
        );
        return;
      }

      const shuffledCandidates = shuffleInPlace([...wordCandidates]);
      const dedupedByReading = new Map<string, WordleCandidate>();
      shuffledCandidates.forEach((candidate) => {
        if (!dedupedByReading.has(candidate.reading)) {
          dedupedByReading.set(candidate.reading, candidate);
        }
      });

      const dedupedCandidates = Array.from(dedupedByReading.values());
      if (dedupedCandidates.length < 6) {
        Alert.alert(
          "Not Enough Unique Words",
          "Your current filters produce too few unique readings for a fair game.",
          [{ text: "OK", onPress: () => router.replace("/wordle-config") }],
        );
        return;
      }

      const nextTarget =
        dedupedCandidates[Math.floor(Math.random() * dedupedCandidates.length)];
      const validReadings = dedupedCandidates.map((candidate) => candidate.reading);

      setTargetWord(nextTarget);
      setValidWords(validReadings);
      setGuesses([]);
      setInputValue("");
      setMistakes(0);
      setStartedAt(Date.now());
      setElapsedMs(0);
      setIsComplete(false);
      setIsWon(false);
      setFeedbackMessage("Type your first guess.");
      setFeedbackTone("neutral");
      initializeFlipAnimations(config.wordLength);
      setRevealingRowIndex(null);
      setRevealedTileCount(0);
      setIsRevealAnimating(false);
    } catch (error) {
      console.error("Failed to build Wordle game:", error);
      Alert.alert("Error", "Failed to build Kana Wordle.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [
    apiToken,
    clearSavedSession,
    config,
    initializeFlipAnimations,
    isAuthLoading,
    userLevel,
  ]);

  useEffect(() => {
    if (config && !hasRestoredSession) {
      void buildGame();
    }
  }, [buildGame, config, hasRestoredSession]);

  useEffect(() => {
    if (!targetWord || isComplete || isLoading) {
      return;
    }

    const interval = setInterval(() => {
      setElapsedMs((prev) => prev + 1000);
    }, 1000);

    return () => clearInterval(interval);
  }, [isComplete, isLoading, targetWord]);

  useEffect(() => {
    if (!isLoading && !isComplete && !isRevealAnimating) {
      const timeout = setTimeout(() => {
        inputRef.current?.focus();
      }, 120);
      return () => clearTimeout(timeout);
    }

    return undefined;
  }, [isComplete, isLoading, isRevealAnimating]);

  const currentInput = useMemo(() => {
    if (!config) {
      return normalizeWord(inputValue);
    }
    return Array.from(normalizeWord(inputValue))
      .slice(0, config.wordLength)
      .join("");
  }, [config, inputValue]);

  const validWordSet = useMemo(() => new Set(validWords), [validWords]);

  const usedKana = useMemo(() => {
    const statusByKana = new Map<string, LetterResult>();

    guesses.forEach((entry) => {
      const chars = Array.from(entry.guess);
      chars.forEach((char, index) => {
        const result = entry.result[index];
        if (!result) {
          return;
        }
        const merged = mergeLetterResult(statusByKana.get(char), result);
        statusByKana.set(char, merged);
      });
    });

    const rank: Record<LetterResult, number> = {
      correct: 0,
      present: 1,
      absent: 2,
    };

    return Array.from(statusByKana.entries())
      .map(([kana, status]) => ({ kana, status }))
      .sort((left, right) => {
        const rankDiff = rank[left.status] - rank[right.status];
        if (rankDiff !== 0) {
          return rankDiff;
        }
        return left.kana.localeCompare(right.kana, "ja");
      });
  }, [guesses]);

  const remainingAttempts = useMemo(() => {
    if (!config) {
      return 0;
    }
    return Math.max(config.maxAttempts - guesses.length, 0);
  }, [config, guesses.length]);

  const canSubmitGuess = useMemo(() => {
    if (!config || isRevealAnimating) {
      return false;
    }
    return Array.from(currentInput).length === config.wordLength;
  }, [config, currentInput, isRevealAnimating]);

  const handleSubmitGuess = useCallback(async () => {
    if (!config || !targetWord || isComplete || isRevealAnimating) {
      return;
    }

    const flushedValue = inputRef.current?.flushKana?.() ?? inputValue;
    const nextGuess = Array.from(normalizeWord(flushedValue))
      .slice(0, config.wordLength)
      .join("");
    if (nextGuess !== inputValue) {
      setInputValue(nextGuess);
    }

    if (Array.from(nextGuess).length !== config.wordLength) {
      setFeedbackMessage(`Enter ${config.wordLength} kana.`);
      setFeedbackTone("error");
      setMistakes((prev) => prev + 1);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!HIRAGANA_RANGE_REGEX.test(nextGuess)) {
      setFeedbackMessage("Guess must be in hiragana.");
      setFeedbackTone("error");
      setMistakes((prev) => prev + 1);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    if (!validWordSet.has(nextGuess)) {
      setFeedbackMessage("Not in this mode's learned word list.");
      setFeedbackTone("error");
      setMistakes((prev) => prev + 1);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    const result = evaluateGuess(nextGuess, targetWord.reading);
    const guessEntry: WordleGuessEntry = {
      guess: nextGuess,
      result,
    };

    const nextGuessCount = guesses.length + 1;
    const didWin = nextGuess === targetWord.reading;
    const didLose = !didWin && nextGuessCount >= config.maxAttempts;
    const submittedRowIndex = guesses.length;

    setGuesses((prev) => [...prev, guessEntry]);
    setInputValue("");
    inputRef.current?.clearInput();
    setFeedbackMessage("Revealing...");
    setFeedbackTone("neutral");

    await runRevealAnimation(submittedRowIndex, config.wordLength);

    if (didWin) {
      setIsWon(true);
      setIsComplete(true);
      setFeedbackMessage("Perfect! You got it.");
      setFeedbackTone("success");
      Keyboard.dismiss();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await clearSavedSession();
      return;
    }

    if (didLose) {
      setIsWon(false);
      setIsComplete(true);
      setFeedbackMessage("No attempts left.");
      setFeedbackTone("error");
      Keyboard.dismiss();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      await clearSavedSession();
      return;
    }

    setFeedbackMessage(`${config.maxAttempts - nextGuessCount} attempts left.`);
    setFeedbackTone("neutral");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [
    clearSavedSession,
    config,
    guesses.length,
    inputValue,
    isComplete,
    isRevealAnimating,
    runRevealAnimation,
    targetWord,
    validWordSet,
  ]);

  const handleExit = useCallback(() => {
    if (isComplete) {
      router.back();
      return;
    }

    Alert.alert("Exit Kana Wordle", "Want to save this run for later?", [
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
    router.replace("/wordle-config");
  }, []);

  if (!isPortegoUser) {
    return (
      <SafeAreaView
        style={[styles.centeredContainer, { backgroundColor: theme.backgroundColor }]}
      >
        <Ionicons name="lock-closed-outline" size={28} color={theme.textSecondary} />
        <Text style={[styles.gatedTitle, { color: theme.textColor }]}>
          Wordle Is Portego-Only
        </Text>
        <Text style={[styles.gatedSubtitle, { color: theme.textSecondary }]}>
          This mode is currently enabled only for the Portego account.
        </Text>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textColor }]}> 
            Building your Kana Wordle...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!config || !targetWord) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.textColor }]}> 
            Couldn&apos;t load Kana Wordle.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isComplete) {
    return (
      <WordleSummary
        theme={theme}
        config={config}
        guesses={guesses}
        targetWord={targetWord}
        mistakes={mistakes}
        elapsedMs={elapsedMs}
        isWon={isWon}
        onPlayAgain={handlePlayAgain}
        onBackToDashboard={handleBackToDashboard}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.backgroundColor }]}> 
      <View style={[styles.header, { borderBottomColor: theme.border }]}> 
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleExit} style={styles.iconButton} activeOpacity={0.75}>
            <Ionicons name="chevron-back" size={24} color={theme.textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>Kana Wordle</Text>
        </View>

        <View style={styles.headerRight}>
          <View
            style={[
              styles.headerPill,
              { backgroundColor: `${theme.primary}1A`, borderColor: `${theme.primary}50` },
            ]}
          >
            <Ionicons name="flag-outline" size={12} color={theme.primary} />
            <Text style={[styles.headerPillText, { color: theme.primary }]}> 
              {guesses.length}/{config.maxAttempts}
            </Text>
          </View>

          <View
            style={[
              styles.headerPill,
              { backgroundColor: theme.cardBackground, borderColor: theme.border },
            ]}
          >
            <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
            <Text style={[styles.headerPillText, { color: theme.textSecondary }]}> 
              {formatElapsed(elapsedMs)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        <View style={styles.attemptsInfoRow}>
          <Text style={[styles.attemptsInfoText, { color: theme.textSecondary }]}>
            {remainingAttempts} attempt{remainingAttempts === 1 ? "" : "s"} left
          </Text>
        </View>

        <WordleBoard
          theme={theme}
          wordLength={config.wordLength}
          maxAttempts={config.maxAttempts}
          guesses={guesses}
          currentInput={currentInput}
          showCurrentInput
          revealingRowIndex={revealingRowIndex}
          revealedTileCount={revealedTileCount}
          tileFlipAnimations={tileFlipAnimationsRef.current}
        />

        <View
          style={[
            styles.feedbackRow,
            feedbackTone === "success"
              ? { backgroundColor: `${WORDLE_CORRECT_COLOR}20`, borderColor: `${WORDLE_CORRECT_COLOR}60` }
              : feedbackTone === "error"
                ? { backgroundColor: `${theme.error}20`, borderColor: `${theme.error}70` }
                : { backgroundColor: theme.cardBackground, borderColor: theme.border },
          ]}
        >
          <Text
            style={[
              styles.feedbackText,
              {
                color:
                  feedbackTone === "success"
                    ? WORDLE_CORRECT_COLOR
                    : feedbackTone === "error"
                      ? theme.error
                      : theme.textSecondary,
              },
            ]}
          >
            {feedbackMessage || "Type a guess and submit."}
          </Text>
        </View>

        {usedKana.length > 0 ? (
          <View style={[styles.usedKanaCard, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}> 
            <Text style={[styles.usedKanaTitle, { color: theme.textColor }]}>Used Kana</Text>
            <View style={styles.usedKanaWrap}>
              {usedKana.map(({ kana, status }) => {
                const backgroundColor =
                  status === "correct"
                    ? WORDLE_CORRECT_COLOR
                    : status === "present"
                      ? WORDLE_PRESENT_COLOR
                      : WORDLE_ABSENT_COLOR;

                return (
                  <View
                    key={`${kana}-${status}`}
                    style={[styles.usedKanaChip, { backgroundColor }]}
                  >
                    <Text style={[styles.usedKanaChipText, fontStyles.japaneseBold]}>{kana}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        <View style={{ height: 18 }} />
      </ScrollView>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.inputDock, { backgroundColor: theme.cardBackground, borderTopColor: theme.border }]}> 
          <View style={styles.inputRow}>
            <View
              style={[
                styles.inputContainer,
                {
                  borderColor:
                    feedbackTone === "error"
                      ? theme.error
                      : feedbackTone === "success"
                        ? WORDLE_CORRECT_COLOR
                        : theme.border,
                  backgroundColor: theme.backgroundColor,
                },
              ]}
            >
              <KanaInput
                ref={inputRef}
                onKanaChange={(value) => {
                  const normalized = normalizeWord(value);
                  const clipped = Array.from(normalized)
                    .slice(0, config.wordLength)
                    .join("");
                  setInputValue(clipped);
                }}
                preferUncontrolledAndroidInput
                placeholder={`${config.wordLength} kana`}
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, fontStyles.japaneseText, { color: theme.textColor }]}
                autoCapitalize="none"
                autoCorrect={false}
                blurOnSubmit={false}
                returnKeyType="go"
                onSubmitEditing={() => {
                  if (canSubmitGuess) {
                    void handleSubmitGuess();
                  }
                }}
                editable={!isRevealAnimating}
              />
            </View>

            <TouchableOpacity
              onPress={() => void handleSubmitGuess()}
              style={[
                styles.submitButton,
                {
                  backgroundColor: theme.primary,
                  opacity: canSubmitGuess ? 1 : 0.55,
                },
              ]}
              activeOpacity={0.85}
              disabled={!canSubmitGuess}
            >
              <Text style={styles.submitButtonText}>Guess</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  gatedTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  gatedSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    textAlign: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 20,
  },
  attemptsInfoRow: {
    alignItems: "center",
    marginBottom: 12,
  },
  attemptsInfoText: {
    fontSize: 13,
    fontWeight: "600",
  },
  boardContainer: {
    gap: 8,
    alignItems: "center",
    marginBottom: 14,
  },
  boardRow: {
    flexDirection: "row",
    gap: 8,
  },
  tile: {
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  tileText: {
    fontWeight: "700",
  },
  feedbackRow: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  feedbackText: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
  usedKanaCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  usedKanaTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  usedKanaWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  usedKanaChip: {
    borderRadius: 8,
    minWidth: 34,
    paddingHorizontal: 8,
    paddingVertical: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  usedKanaChipText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  inputDock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inputContainer: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    minHeight: 52,
    justifyContent: "center",
  },
  input: {
    fontSize: 24,
    paddingVertical: 8,
    textAlign: "center",
    letterSpacing: 1.5,
  },
  submitButton: {
    minHeight: 52,
    borderRadius: 10,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  summaryHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  summaryTitle: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  summarySubtitle: {
    fontSize: 14,
  },
  summaryContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  answerCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  answerLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.45,
    fontWeight: "700",
    marginBottom: 4,
  },
  answerReading: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 3,
  },
  answerMeaning: {
    fontSize: 14,
  },
  summaryStatsRow: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  summaryStatPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  summaryStatText: {
    fontSize: 12,
    fontWeight: "700",
  },
  summaryFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    gap: 10,
  },
  summaryButton: {
    minHeight: 46,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  summaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
