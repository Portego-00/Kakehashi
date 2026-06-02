import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Slider from "@react-native-community/slider";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  memo,
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useMusicPlayer } from "../../src/contexts/MusicPlayerContext";
import { appleMusicService } from "../../src/services/appleMusicService";
import {
  LyricsResult,
  LyricsSearchResult,
  lyricsService,
  TimedLyricsLine,
} from "../../src/services/lyricsService";
import { youtubeService } from "../../src/services/youtubeService";
import { getAllSubjects } from "../../src/utils/cache";
import { fontStyles } from "../../src/utils/fonts";
import {
  getStoredJpdbApiKey,
  JpdbApiError,
  translateJapaneseToEnglish,
} from "../../src/utils/jpdbApi";
import { withAlpha } from "../../src/utils/subjectColors";
import {
  type StudyModePreference,
  useAuthStore,
  useSettingsStore,
} from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

import { CoachMarks, CoachMarkStep } from "../../src/components/CoachMarks";
import { GlassButton } from "../../src/components/GlassButton";
import { VocabularyTooltip } from "../../src/components/VocabularyTooltip";
import {
  findVocabularyMatchesWithJpdbFirstPass as findMatches,
  getHighlightSegments,
  getItemColor,
  isWaniKaniBackedMatch,
  JpdbParsedTokenAnnotation,
  KanjiMatch,
  VocabularyMatch,
} from "../../src/utils/textHighlighting";
import {
  LYRICS_TUTORIAL_STEPS,
  TUTORIAL_STORAGE_KEYS,
} from "../../src/utils/tutorialSteps";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SwiftUI = Platform.OS === "ios" ? require("@expo/ui/swift-ui") : null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const SwiftUIModifiers = Platform.OS === "ios" ? require("@expo/ui/swift-ui/modifiers") : null;

const GRAMMAR_TOOLTIP_ID_MIN = -9000000;
const TOKEN_UNDERLINE_SEPARATOR = "\u200A";
const LRC_TIMESTAMP_REGEX = /\[(?:\d{1,2}:)?\d{1,2}(?:\.\d{1,3})?\]/g;
const LEADING_COMMA_PATTERN = /^\s*,\s*/;
const JAPANESE_TEXT_PATTERN =
  /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff\u3005\u3006\u303b\uff66-\uff9f]/;
const LYRICS_TIMING_OFFSET_MIN_MS = -60000;
const LYRICS_TIMING_OFFSET_MAX_MS = 60000;
const LYRICS_TIMING_OFFSET_STEP_MS = 500;

function clampLyricsTimingOffsetMs(offsetMs: number): number {
  if (!Number.isFinite(offsetMs)) {
    return 0;
  }

  const roundedOffsetMs =
    Math.round(offsetMs / LYRICS_TIMING_OFFSET_STEP_MS) *
    LYRICS_TIMING_OFFSET_STEP_MS;
  return Math.min(
    LYRICS_TIMING_OFFSET_MAX_MS,
    Math.max(LYRICS_TIMING_OFFSET_MIN_MS, roundedOffsetMs)
  );
}

function formatLyricsTimingOffset(offsetMs: number): string {
  if (offsetMs === 0) {
    return "In sync";
  }

  const seconds = Math.abs(offsetMs) / 1000;
  return offsetMs > 0
    ? `Delay +${seconds.toFixed(1)}s`
    : `Advance ${seconds.toFixed(1)}s`;
}

function normalizeLyricLineForTranslation(line: string): string {
  return line.replace(LRC_TIMESTAMP_REGEX, "").trim();
}

function containsJapaneseText(line: string): boolean {
  return JAPANESE_TEXT_PATTERN.test(line);
}

function buildDisplayTranslationsForLines(
  lyricLines: string[],
  translationsByNormalizedLine: Record<string, string>
): (string | null)[] {
  const resolvedLines = lyricLines.map((line) => {
    const normalizedLine = normalizeLyricLineForTranslation(line);
    if (!normalizedLine || !containsJapaneseText(normalizedLine)) {
      return null;
    }

    const translatedText = translationsByNormalizedLine[normalizedLine];
    if (!translatedText) {
      return null;
    }

    return translatedText.trim();
  });

  const adjustedLines = [...resolvedLines];

  for (let index = 1; index < adjustedLines.length; index += 1) {
    const currentLine = adjustedLines[index];
    if (!currentLine) {
      continue;
    }

    const commaMatch = currentLine.match(LEADING_COMMA_PATTERN);
    if (!commaMatch) {
      continue;
    }

    let previousIndex = index - 1;
    while (previousIndex >= 0) {
      const previousLine = adjustedLines[previousIndex];
      if (previousLine) {
        const normalizedPreviousLine = previousLine.replace(/\s+$/, "");
        adjustedLines[previousIndex] = normalizedPreviousLine.endsWith(",")
          ? normalizedPreviousLine
          : `${normalizedPreviousLine},`;
        break;
      }
      previousIndex -= 1;
    }

    if (previousIndex < 0) {
      continue;
    }

    const trimmedCurrentLine = currentLine.slice(commaMatch[0].length).trimStart();
    adjustedLines[index] = trimmedCurrentLine.length > 0 ? trimmedCurrentLine : null;
  }

  return adjustedLines;
}

const StreamingLineText = memo(function StreamingLineText({
  text,
  color,
  characterIntervalMs = 10,
}: {
  text: string;
  color: string;
  characterIntervalMs?: number;
}): ReactElement {
  const [visibleCharacterCount, setVisibleCharacterCount] = useState<number>(0);
  const previousTextRef = useRef<string>("");

  useEffect(() => {
    if (!text) {
      previousTextRef.current = "";
      setVisibleCharacterCount(0);
      return;
    }

    const previousText = previousTextRef.current;
    previousTextRef.current = text;

    if (previousText && !text.startsWith(previousText)) {
      // Non-prefix updates (for example punctuation carry-over) should not
      // restart the animation to avoid visible flicker.
      setVisibleCharacterCount(text.length);
      return;
    }

    const startCount = previousText ? previousText.length : 0;
    setVisibleCharacterCount((currentCount) => Math.max(currentCount, startCount));

    const charsPerTick = text.length > 140 ? 8 : text.length > 80 ? 6 : 4;
    const interval = Math.max(6, characterIntervalMs);
    const timer = setInterval(() => {
      setVisibleCharacterCount((currentCount) => {
        if (currentCount >= text.length) {
          clearInterval(timer);
          return currentCount;
        }

        const nextCount = Math.min(text.length, currentCount + charsPerTick);
        if (nextCount >= text.length) {
          clearInterval(timer);
        }
        return nextCount;
      });
    }, interval);

    return () => {
      clearInterval(timer);
    };
  }, [text, characterIntervalMs]);

  return (
    <Text style={[styles.lineTranslationText, { color }]}>
      {text.slice(0, visibleCharacterCount)}
    </Text>
  );
}, (previousProps, nextProps) => {
  return (
    previousProps.text === nextProps.text &&
    previousProps.color === nextProps.color &&
    previousProps.characterIntervalMs === nextProps.characterIntervalMs
  );
});

function buildGrammarTooltipItem(token: JpdbParsedTokenAnnotation): VocabularyMatch {
  const meaningText = token.meaning?.trim() || "Grammar point";
  const partsOfSpeechSummary = token.partsOfSpeech.filter(Boolean).join(", ");
  const details = partsOfSpeechSummary
    ? `${meaningText}\nPart of Speech: ${partsOfSpeechSummary}`
    : meaningText;

  return {
    id: -9000000 - token.start * 1000 - token.end,
    characters: token.surface || token.spelling || token.reading || "Grammar",
    meaning: details,
    type: "vocabulary",
    level: 0,
    readings: token.reading
      ? [{ reading: token.reading, primary: true }]
      : undefined,
    isWaniKaniSubject: false,
    disableConjugationExpansion: true,
  };
}

export default function SongLyricsScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { userData } = useAuthStore();
  const {
    songsPlaybackSource,
    appleMusicAuthStatus,
    songsLyricsDefaultStudyMode,
    songsLyricsLineTranslationsEnabled,
    setSongsLyricsDefaultStudyMode,
    setSongsLyricsLineTranslationsEnabled,
  } = useSettingsStore();
  const userLevel = userData?.level || 0;
  const { songId, songTitle, artist, albumArt, songUrl, musicSource } =
    useLocalSearchParams<{
      songId: string;
      songTitle: string;
      artist: string;
      albumArt: string;
      songUrl: string;
      musicSource?: "spotify" | "apple";
    }>();
  const isAppleMusicFlow =
    Platform.OS === "ios" &&
    songsPlaybackSource === "appleMusic" &&
    appleMusicAuthStatus === "authorized";

  // Use the global music player context
  const {
    playerRef,
    isPlaying,
    currentTime,
    isPlayerExpanded,
    setSongInfo,
    setIsPlaying,
    setTimedLyrics: setGlobalTimedLyrics,
    lyricsTimingOffsetMs,
    setLyricsTimingOffsetMs,
  } = useMusicPlayer();

  const [lyrics, setLyrics] = useState<string>("");
  const [vocabularyMatches, setVocabularyMatches] = useState<VocabularyMatch[]>(
    []
  );
  const [kanjiMatches, setKanjiMatches] = useState<KanjiMatch[]>([]);
  const [jpdbParsedTokens, setJpdbParsedTokens] = useState<JpdbParsedTokenAnnotation[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Timed lyrics state
  const [timedLyrics, setTimedLyrics] = useState<TimedLyricsLine[]>([]);
  const [isTimedMode, setIsTimedMode] = useState(false); // Will be set to true when timed lyrics load
  const [timedLyricsStatus, setTimedLyricsStatus] = useState<
    "loading" | "available" | "unavailable" | null
  >("loading");
  const scrollViewRef = useRef<ScrollView>(null);
  const lineRefs = useRef<{ [key: number]: View | null }>({});

  // Autoscroll state - track if user has manually scrolled
  const [isAutoscrollEnabled, setIsAutoscrollEnabled] = useState(true);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUserScrollingRef = useRef(false);

  // Tooltip state
  const [selectedItem, setSelectedItem] = useState<
    (VocabularyMatch | KanjiMatch) | null
  >(null);
  const [selectedSurfaceText, setSelectedSurfaceText] = useState<string | null>(
    null
  );
  const [selectedTokenKey, setSelectedTokenKey] = useState<string | null>(null);
  const [tooltipInteractionMode, setTooltipInteractionMode] = useState<
    "press" | "hover" | null
  >(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const tooltipOpacity = useSharedValue(0);

  // Override settings modal state
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [activeOverrideMode, setActiveOverrideMode] = useState<
    "video" | "lyrics" | null
  >(null);
  const [videoSearchQuery, setVideoSearchQuery] = useState("");
  const [videoSearchResults, setVideoSearchResults] = useState<any[]>([]);
  const [isSearchingVideos, setIsSearchingVideos] = useState(false);
  const [lyricsSearchSong, setLyricsSearchSong] = useState("");
  const [lyricsSearchArtist, setLyricsSearchArtist] = useState("");
  const [lyricsSearchResults, setLyricsSearchResults] = useState<
    LyricsSearchResult[]
  >([]);
  const [isSearchingLyrics, setIsSearchingLyrics] = useState(false);
  const [currentVideoId, setCurrentVideoId] = useState<string | null>(null);
  const [hasStoredJpdbApiKey, setHasStoredJpdbApiKey] = useState(false);
  const [lineTranslations, setLineTranslations] = useState<
    Record<string, string>
  >({});
  const [isTranslatingLyrics, setIsTranslatingLyrics] = useState(false);
  const [hasLoadedLineTranslationsCache, setHasLoadedLineTranslationsCache] =
    useState(false);
  const [lyricsTranslationStatusMessage, setLyricsTranslationStatusMessage] =
    useState<string | null>(null);
  const [hasLoadedLyricsTimingOffset, setHasLoadedLyricsTimingOffset] =
    useState(false);
  const [isLyricsTimingAdjustmentEnabled, setIsLyricsTimingAdjustmentEnabled] =
    useState(false);
  const [isLyricsTimingControlVisible, setIsLyricsTimingControlVisible] =
    useState(false);

  const vocabularyMatchesById = useMemo(
    () => new Map(vocabularyMatches.map((match) => [match.id, match])),
    [vocabularyMatches]
  );
  const grammarUnderlineColor = theme.isDark ? "#fbbf24" : "#b45309";
  const verbUnderlineColor = theme.isDark ? "#34d399" : "#0f766e";
  const vocabUnderlineColor = theme.isDark ? "#60a5fa" : "#1d4ed8";
  const hoverPreviewEnabled =
    Platform.OS === "ios" ||
    Platform.OS === "web" ||
    (Platform.OS as string) === "macos";
  const supportsNativeHeaderStudyMenu =
    Platform.OS === "ios" && Boolean(SwiftUI);
  const activeStudyMode: StudyModePreference =
    songsLyricsDefaultStudyMode === "full" && !hasStoredJpdbApiKey
      ? "wk"
      : songsLyricsDefaultStudyMode;
  const fullAnalysisEnabled =
    activeStudyMode === "full";
  const wkStudyModeEnabled = activeStudyMode === "wk";
  const lineTranslationsEnabled =
    songsLyricsLineTranslationsEnabled && hasStoredJpdbApiKey;
  const songLyricsCacheBaseKey = useMemo(() => {
    if (!songTitle || !artist) {
      return null;
    }

    return `wanikani_lyrics_v1_${songTitle.replace(/\s+/g, "")}_${artist.replace(/\s+/g, "")}`;
  }, [songTitle, artist]);
  const lineTranslationsCacheKey = songLyricsCacheBaseKey
    ? `${songLyricsCacheBaseKey}_translations`
    : null;
  const lyricsTimingOffsetCacheKey = songLyricsCacheBaseKey
    ? `${songLyricsCacheBaseKey}_lyrics_timing_offset_ms`
    : null;
  const lyricsTimingOffsetSeconds = lyricsTimingOffsetMs / 1000;
  const lyricsTimingOffsetDisplay = useMemo(
    () => formatLyricsTimingOffset(lyricsTimingOffsetMs),
    [lyricsTimingOffsetMs]
  );
  const activeLyricsTimingOffsetMs = isLyricsTimingAdjustmentEnabled
    ? lyricsTimingOffsetMs
    : 0;
  const canAdjustLyricsTiming = timedLyrics.length > 0 && isTimedMode;
  const shouldShowLyricsTimingControl =
    canAdjustLyricsTiming &&
    isLyricsTimingAdjustmentEnabled &&
    isLyricsTimingControlVisible;
  const lyricsTimingOffsetMsRef = useRef(0);
  const staticLyricLines = useMemo(() => {
    if (!lyrics) {
      return [];
    }

    const lines = lyrics.split("\n");
    let offset = 0;

    return lines.map((line, index) => {
      const startOffset = offset;
      offset += line.length;
      if (index < lines.length - 1) {
        offset += 1;
      }

      return {
        key: `${startOffset}-${index}`,
        text: line,
        startOffset,
      };
    });
  }, [lyrics]);
  const visibleLinesForTranslation = useMemo(
    () =>
      isTimedMode && timedLyrics.length > 0
        ? timedLyrics.map((line) => line.words ?? "")
        : staticLyricLines.map((line) => line.text),
    [isTimedMode, timedLyrics, staticLyricLines]
  );
  const normalizedVisibleLinesForTranslation = useMemo(
    () =>
      visibleLinesForTranslation
        .map((line) => normalizeLyricLineForTranslation(line))
        .filter(
          (line): line is string =>
            line.length > 0 && containsJapaneseText(line)
        ),
    [visibleLinesForTranslation]
  );
  const timedLineTranslationsForDisplay = useMemo(() => {
    if (!lineTranslationsEnabled) {
      return [];
    }

    return buildDisplayTranslationsForLines(
      timedLyrics.map((line) => line.words ?? ""),
      lineTranslations
    );
  }, [lineTranslations, lineTranslationsEnabled, timedLyrics]);
  const staticLineTranslationsForDisplay = useMemo(() => {
    if (!lineTranslationsEnabled) {
      return [];
    }

    return buildDisplayTranslationsForLines(
      staticLyricLines.map((line) => line.text),
      lineTranslations
    );
  }, [lineTranslations, lineTranslationsEnabled, staticLyricLines]);
  const timedLineOffsets = useMemo(() => {
    if (timedLyrics.length === 0) {
      return [];
    }

    if (!lyrics) {
      let syntheticCursor = 0;
      return timedLyrics.map((line) => {
        const start = syntheticCursor;
        syntheticCursor += line.words.length + 1;
        return start;
      });
    }

    const offsets: number[] = [];
    let cursor = 0;

    timedLyrics.forEach((line) => {
      const lineText = line.words ?? "";
      if (!lineText) {
        offsets.push(cursor);
        return;
      }

      const forwardMatchIndex = lyrics.indexOf(lineText, cursor);
      if (forwardMatchIndex >= 0) {
        offsets.push(forwardMatchIndex);
        cursor = forwardMatchIndex + lineText.length;
        return;
      }

      const fallbackMatchIndex = lyrics.indexOf(lineText);
      if (fallbackMatchIndex >= 0) {
        offsets.push(fallbackMatchIndex);
        cursor = fallbackMatchIndex + lineText.length;
        return;
      }

      offsets.push(cursor);
      cursor += lineText.length + 1;
    });

    return offsets;
  }, [lyrics, timedLyrics]);

  useEffect(() => {
    let didCancel = false;

    const loadStoredJpdbKey = async () => {
      try {
        const storedKey = await getStoredJpdbApiKey();
        if (!didCancel) {
          setHasStoredJpdbApiKey(Boolean(storedKey));
        }
      } catch {
        if (!didCancel) {
          setHasStoredJpdbApiKey(false);
        }
      }
    };

    void loadStoredJpdbKey();

    return () => {
      didCancel = true;
    };
  }, []);

  useEffect(() => {
    if (!hasStoredJpdbApiKey && songsLyricsLineTranslationsEnabled) {
      setSongsLyricsLineTranslationsEnabled(false);
    }
  }, [
    hasStoredJpdbApiKey,
    songsLyricsLineTranslationsEnabled,
    setSongsLyricsLineTranslationsEnabled,
  ]);

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialSteps, setTutorialSteps] = useState<CoachMarkStep[]>([]);
  const [isFirstVisit, setIsFirstVisit] = useState<boolean | null>(null); // null = checking, true/false = determined
  const [pendingAutoPlay, setPendingAutoPlay] = useState(false); // Track if we should auto-play after tutorial
  const settingsButtonRef = useRef<View>(null);
  const syncToggleRef = useRef<View>(null);
  const lyricsContentRef = useRef<View>(null);

  // Skeleton loader animation
  const skeletonOpacity = useSharedValue(0.3);

  useEffect(() => {
    if (timedLyricsStatus === "loading") {
      skeletonOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 800 }),
          withTiming(0.3, { duration: 800 })
        ),
        -1,
        true
      );
    }
  }, [timedLyricsStatus]);

  // Animated spacer for smooth transition when player expands/collapses
  const animatedSpacerHeight = useSharedValue(0);

  useEffect(() => {
    animatedSpacerHeight.value = withTiming(isPlayerExpanded ? 500 : 0, {
      duration: 300,
    });
  }, [isPlayerExpanded]);

  // Check tutorial status on mount (before lyrics load)
  useEffect(() => {
    const checkTutorialStatus = async () => {
      try {
        const completed = await AsyncStorage.getItem(
          TUTORIAL_STORAGE_KEYS.LYRICS_COMPLETED
        );
        setIsFirstVisit(!completed);
      } catch (error) {
        console.error("Error checking lyrics tutorial status:", error);
        setIsFirstVisit(false); // Assume not first visit on error
      }
    };

    checkTutorialStatus();
  }, []);

  // Show tutorial after lyrics have loaded (only on first visit)
  useEffect(() => {
    if (isFirstVisit && !isLoading && (lyrics || timedLyrics.length > 0)) {
      // Delay to let lyrics render first
      setTimeout(() => {
        measureElementsAndShowTutorial();
      }, 500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFirstVisit, isLoading, lyrics, timedLyrics.length]);

  // Auto-play after tutorial completes (if we were waiting)
  useEffect(() => {
    if (pendingAutoPlay && !showTutorial && isFirstVisit === false) {
      setPendingAutoPlay(false);
      setIsPlaying(true);
    }
  }, [pendingAutoPlay, showTutorial, isFirstVisit, setIsPlaying]);

  // Measure UI elements and build tutorial steps with targets
  const measureElementsAndShowTutorial = useCallback(() => {
    const steps: CoachMarkStep[] = [];
    // On Android, measureInWindow returns coordinates that don't account for
    // the status bar when used with statusBarTranslucent modals
    const statusBarOffset = Platform.OS === "android" ? (StatusBar.currentHeight || 0) : 0;

    // Step 1: Welcome (no target, centered)
    steps.push({
      ...LYRICS_TUTORIAL_STEPS[0],
      target: null,
    });

    // Step 2: Sync toggle (if timed lyrics available)
    if (syncToggleRef.current && timedLyrics.length > 0) {
      syncToggleRef.current.measureInWindow((x, y, width, height) => {
        steps.push({
          ...LYRICS_TUTORIAL_STEPS[1],
          target: { x, y: y + statusBarOffset, width, height },
        });
        continueWithSettingsButton(steps, statusBarOffset);
      });
    } else {
      // Skip sync step if no timed lyrics
      continueWithSettingsButton(steps, statusBarOffset);
    }
  }, [timedLyrics.length]);

  const continueWithSettingsButton = useCallback((steps: CoachMarkStep[], statusBarOffset: number) => {
    // Step 3: Settings button
    if (settingsButtonRef.current) {
      settingsButtonRef.current.measureInWindow((x, y, width, height) => {
        steps.push({
          ...LYRICS_TUTORIAL_STEPS[2],
          target: { x, y: y + statusBarOffset, width, height },
        });
        continueWithVocabulary(steps, statusBarOffset);
      });
    } else {
      continueWithVocabulary(steps, statusBarOffset);
    }
  }, []);

  const continueWithVocabulary = useCallback((steps: CoachMarkStep[], statusBarOffset: number) => {
    // Step 4: Vocabulary highlights
    if (lyricsContentRef.current) {
      lyricsContentRef.current.measureInWindow((x, y, width, height) => {
        steps.push({
          ...LYRICS_TUTORIAL_STEPS[3],
          target: { x, y: y + statusBarOffset, width: width, height: Math.min(height, 150) },
        });
        setTutorialSteps(steps);
        setShowTutorial(true);
      });
    } else {
      // Add vocabulary step without target
      steps.push({
        ...LYRICS_TUTORIAL_STEPS[3],
        target: null,
      });
      setTutorialSteps(steps);
      setShowTutorial(true);
    }
  }, []);

  // Handle tutorial completion
  const handleTutorialComplete = useCallback(async () => {
    setShowTutorial(false);
    setIsFirstVisit(false); // Mark as no longer first visit to trigger pending auto-play
    try {
      await AsyncStorage.setItem(TUTORIAL_STORAGE_KEYS.LYRICS_COMPLETED, "true");
    } catch (error) {
      console.error("Error saving lyrics tutorial completion:", error);
    }
  }, []);

  const animatedSpacerStyle = useAnimatedStyle(() => ({
    height: animatedSpacerHeight.value,
  }));

  // Helper function to extract YouTube video ID from URL
  const extractYoutubeVideoId = (url: string): string | null => {
    try {
      const regExp =
        /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = url.match(regExp);
      return match && match[2].length === 11 ? match[2] : null;
    } catch (error) {
      console.error("Error extracting YouTube video ID:", error);
      return null;
    }
  };

  const loadLyrics = useCallback(async () => {
    setError(null);
    setTimedLyricsStatus("loading");
    setVocabularyMatches([]);
    setKanjiMatches([]);
    setJpdbParsedTokens([]);

    // Validate required data
    if (!songTitle || !artist) {
      console.log("⚠️ No song metadata available");
      setError(
        "Song information incomplete. Cannot fetch lyrics without song title and artist."
      );
      setTimedLyricsStatus("unavailable");
      setIsLoading(false);
      return;
    }

    console.log("🔍 Loading song:", { songTitle, artist });

    const cacheKey = `wanikani_lyrics_v1_${songTitle.replace(/\s+/g, "")}_${artist.replace(/\s+/g, "")}`;
    const lyricsCacheKey = `${cacheKey}_lyrics`;
    const videoCacheKey = `${cacheKey}_video`;
    let effectiveAppleSongId = songId;

    try {
      if (isAppleMusicFlow && (!effectiveAppleSongId || musicSource !== "apple")) {
        try {
          const appleResults = await appleMusicService.searchTracks(
            `${songTitle} ${artist}`,
            10
          );
          if (appleResults.length > 0) {
            const bestAppleMatch = appleResults[0];
            effectiveAppleSongId = bestAppleMatch.id;
          }
        } catch (appleSearchError) {
          console.warn(
            "⚠️ Failed to resolve Apple Music playback track:",
            appleSearchError
          );
        }
      }

      // Step 1: Check cache for lyrics and (for Spotify mode) video.
      const [cachedLyricsJson, cachedVideoId] = await Promise.all([
        AsyncStorage.getItem(lyricsCacheKey),
        isAppleMusicFlow ? Promise.resolve(null) : AsyncStorage.getItem(videoCacheKey),
      ]);

      let lyricsData: LyricsResult | null = null;
      let videoId: string | null = cachedVideoId;

      // Use cached lyrics if available
      if (cachedLyricsJson) {
        console.log("✅ Using cached lyrics");
        lyricsData = JSON.parse(cachedLyricsJson);
      }

      // Step 2: Fetch lyrics if not cached
      if (!lyricsData) {
        console.log("🔍 Fetching lyrics from LRCLIB...");
        try {
          lyricsData = await lyricsService.getLyrics(songTitle, artist);
          // Cache the lyrics
          AsyncStorage.setItem(lyricsCacheKey, JSON.stringify(lyricsData)).catch(
            (e) => console.error("Error caching lyrics:", e)
          );
        } catch (error) {
          console.warn("⚠️ Lyrics not found:", error);
          if (error instanceof Error && error.message === "LYRICS_NOT_FOUND") {
            setError(
              "Lyrics not found for this song. Try using the override settings to search manually."
            );
          }
        }
      }

      // Apply lyrics to state
      if (lyricsData) {
        const { plainLyrics, timedLyrics: timedLines } = lyricsData;

        if (plainLyrics) {
          setLyrics(plainLyrics);
          await findVocabularyMatches(plainLyrics);
        }

        if (timedLines && timedLines.length > 0) {
          setTimedLyrics(timedLines);
          setTimedLyricsStatus("available");
          setIsTimedMode(true);
        } else {
          setTimedLyricsStatus("unavailable");
          setIsTimedMode(false);
        }
      } else {
        setTimedLyricsStatus("unavailable");
        setIsTimedMode(false);
      }

      const timedLinesForPlayer = lyricsData?.timedLyrics || [];

      if (isAppleMusicFlow) {
        if (!effectiveAppleSongId) {
          setError(
            "Could not find this track in Apple Music. Switch playback to YouTube or pick a different song."
          );
          setTimedLyricsStatus("unavailable");
          return;
        }

        setSongInfo({
          albumArt,
          songTitle,
          artist,
          youtubeVideoId: null,
          songId: effectiveAppleSongId,
          songUrl: musicSource === "apple" ? songUrl : undefined,
          musicSource: "apple",
          lyricsTimingOffsetMs: lyricsTimingOffsetMsRef.current,
        });
        if (timedLinesForPlayer.length > 0) {
          setGlobalTimedLyrics(timedLinesForPlayer);
        }

        setTimeout(async () => {
          const tutorialCompleted = await AsyncStorage.getItem(
            TUTORIAL_STORAGE_KEYS.LYRICS_COMPLETED
          );
          if (tutorialCompleted) {
            setIsPlaying(true);
          } else {
            setPendingAutoPlay(true);
          }
        }, 500);
      } else {
        // Step 3: Fetch video if not cached
        if (!videoId) {
          console.log("🔍 Searching YouTube for video...");
          try {
            const duration = lyricsData?.duration || 0;
            const bestMatch = await youtubeService.findBestMatch(
              songTitle,
              artist,
              duration
            );
            if (bestMatch) {
              videoId = bestMatch.videoId;
              // Cache the video ID
              AsyncStorage.setItem(videoCacheKey, videoId).catch((e) =>
                console.error("Error caching video:", e)
              );
            }
          } catch (videoError) {
            console.error("❌ Failed to find YouTube video:", videoError);
          }
        } else {
          console.log("✅ Using cached video:", videoId);
        }

        // Apply video to player
        if (!videoId) return;

        setSongInfo({
          albumArt,
          songTitle,
          artist,
          youtubeVideoId: videoId,
          songId,
          songUrl,
          musicSource: "spotify",
          lyricsTimingOffsetMs: lyricsTimingOffsetMsRef.current,
        });
        if (timedLinesForPlayer.length > 0) {
          setGlobalTimedLyrics(timedLinesForPlayer);
        }

        // Auto-play after a short delay (respecting tutorial)
        setTimeout(async () => {
          const tutorialCompleted = await AsyncStorage.getItem(
            TUTORIAL_STORAGE_KEYS.LYRICS_COMPLETED
          );
          if (tutorialCompleted) {
            setIsPlaying(true);
          } else {
            setPendingAutoPlay(true);
          }
        }, 500);
      }
    } catch (err) {
      console.error("Error loading song:", err);
    } finally {
      setIsLoading(false);
    }
  }, [
    songTitle,
    artist,
    albumArt,
    songId,
    songUrl,
    musicSource,
    isAppleMusicFlow,
    setSongInfo,
    setIsPlaying,
    setGlobalTimedLyrics,
  ]);

  useEffect(() => {
    if (songTitle && artist) {
      loadLyrics();
    }
  }, [songTitle, artist, loadLyrics]);

  useEffect(() => {
    if (songTitle && artist) {
      setVideoSearchQuery(`${songTitle} ${artist}`);
      setLyricsSearchSong(songTitle);
      setLyricsSearchArtist(artist);

      // Pre-populate results
      if (!isAppleMusicFlow) {
        searchVideos(`${songTitle} ${artist}`);
      }
      searchLyrics(songTitle, artist);
    }
  }, [songTitle, artist, isAppleMusicFlow]);

  useEffect(() => {
    setLyricsTranslationStatusMessage(null);
  }, [songTitle, artist]);

  useEffect(() => {
    let didCancel = false;

    setHasLoadedLyricsTimingOffset(false);
    setIsLyricsTimingAdjustmentEnabled(false);
    setIsLyricsTimingControlVisible(false);
    lyricsTimingOffsetMsRef.current = 0;
    setLyricsTimingOffsetMs(0);

    const loadLyricsTimingOffset = async () => {
      if (!lyricsTimingOffsetCacheKey) {
        if (!didCancel) {
          setHasLoadedLyricsTimingOffset(true);
        }
        return;
      }

      try {
        const cachedOffsetMs = await AsyncStorage.getItem(
          lyricsTimingOffsetCacheKey
        );
        if (didCancel) {
          return;
        }

        const parsedOffsetMs =
          cachedOffsetMs === null ? 0 : Number.parseFloat(cachedOffsetMs);
        const nextOffsetMs = clampLyricsTimingOffsetMs(parsedOffsetMs);
        lyricsTimingOffsetMsRef.current = nextOffsetMs;
        setLyricsTimingOffsetMs(nextOffsetMs);
        setIsLyricsTimingAdjustmentEnabled(nextOffsetMs !== 0);
        setIsLyricsTimingControlVisible(false);
        setHasLoadedLyricsTimingOffset(true);
      } catch (cacheError) {
        console.error("Error loading lyric timing offset:", cacheError);
        if (!didCancel) {
          lyricsTimingOffsetMsRef.current = 0;
          setLyricsTimingOffsetMs(0);
          setIsLyricsTimingAdjustmentEnabled(false);
          setIsLyricsTimingControlVisible(false);
          setHasLoadedLyricsTimingOffset(true);
        }
      }
    };

    void loadLyricsTimingOffset();

    return () => {
      didCancel = true;
    };
  }, [lyricsTimingOffsetCacheKey, setLyricsTimingOffsetMs]);

  useEffect(() => {
    lyricsTimingOffsetMsRef.current = lyricsTimingOffsetMs;
  }, [lyricsTimingOffsetMs]);

  useEffect(() => {
    if (!lyricsTimingOffsetCacheKey || !hasLoadedLyricsTimingOffset) {
      return;
    }

    const normalizedOffsetMs = isLyricsTimingAdjustmentEnabled
      ? clampLyricsTimingOffsetMs(lyricsTimingOffsetMs)
      : 0;
    const saveTimeout = setTimeout(() => {
      if (normalizedOffsetMs === 0) {
        AsyncStorage.removeItem(lyricsTimingOffsetCacheKey).catch((cacheError) =>
          console.error("Error clearing lyric timing offset:", cacheError)
        );
        return;
      }

      AsyncStorage.setItem(
        lyricsTimingOffsetCacheKey,
        String(normalizedOffsetMs)
      ).catch((cacheError) =>
        console.error("Error saving lyric timing offset:", cacheError)
      );
    }, 250);

    return () => {
      clearTimeout(saveTimeout);
    };
  }, [
    lyricsTimingOffsetCacheKey,
    lyricsTimingOffsetMs,
    isLyricsTimingAdjustmentEnabled,
    hasLoadedLyricsTimingOffset,
  ]);

  useEffect(() => {
    let didCancel = false;
    setHasLoadedLineTranslationsCache(false);

    const loadCachedLineTranslations = async () => {
      if (!lineTranslationsCacheKey) {
        if (!didCancel) {
          setLineTranslations({});
          setHasLoadedLineTranslationsCache(true);
        }
        return;
      }

      try {
        const cachedJson = await AsyncStorage.getItem(lineTranslationsCacheKey);
        if (didCancel) {
          return;
        }

        if (!cachedJson) {
          setLineTranslations({});
          setHasLoadedLineTranslationsCache(true);
          return;
        }

        const parsedCache = JSON.parse(cachedJson) as unknown;
        if (!parsedCache || typeof parsedCache !== "object" || Array.isArray(parsedCache)) {
          setLineTranslations({});
          setHasLoadedLineTranslationsCache(true);
          return;
        }

        const normalizedTranslations = Object.entries(
          parsedCache as Record<string, unknown>
        ).reduce<Record<string, string>>((accumulator, [key, value]) => {
          if (typeof key !== "string") {
            return accumulator;
          }
          const normalizedKey = normalizeLyricLineForTranslation(key);
          if (!normalizedKey || !containsJapaneseText(normalizedKey)) {
            return accumulator;
          }
          if (typeof value !== "string") {
            return accumulator;
          }

          const trimmedValue = value.trim();
          if (trimmedValue.length === 0) {
            return accumulator;
          }

          accumulator[normalizedKey] = trimmedValue;
          return accumulator;
        }, {});

        setLineTranslations(normalizedTranslations);
        setHasLoadedLineTranslationsCache(true);
      } catch (cacheError) {
        console.error("Error loading lyric translations cache:", cacheError);
        if (!didCancel) {
          setLineTranslations({});
          setHasLoadedLineTranslationsCache(true);
        }
      }
    };

    void loadCachedLineTranslations();

    return () => {
      didCancel = true;
    };
  }, [lineTranslationsCacheKey]);

  useEffect(() => {
    if (!lineTranslationsCacheKey || !hasLoadedLineTranslationsCache) {
      return;
    }

    const translationCount = Object.keys(lineTranslations).length;
    if (translationCount === 0) {
      AsyncStorage.removeItem(lineTranslationsCacheKey).catch((cacheError) =>
        console.error("Error clearing lyric translations cache:", cacheError)
      );
      return;
    }

    AsyncStorage.setItem(
      lineTranslationsCacheKey,
      JSON.stringify(lineTranslations)
    ).catch((cacheError) =>
      console.error("Error saving lyric translations cache:", cacheError)
    );
  }, [lineTranslationsCacheKey, lineTranslations, hasLoadedLineTranslationsCache]);

  useEffect(() => {
    if (!lineTranslationsEnabled) {
      setIsTranslatingLyrics(false);
      setLyricsTranslationStatusMessage(null);
      return;
    }

    const uniqueVisibleLines = Array.from(
      new Set(normalizedVisibleLinesForTranslation)
    );
    if (uniqueVisibleLines.length === 0) {
      setIsTranslatingLyrics(false);
      setLyricsTranslationStatusMessage(null);
      return;
    }

    const missingLines = uniqueVisibleLines.filter(
      (line) => !lineTranslations[line]
    );
    if (missingLines.length === 0) {
      setIsTranslatingLyrics(false);
      setLyricsTranslationStatusMessage(null);
      return;
    }

    let didCancel = false;

    const translateVisibleLyrics = async () => {
      const storedApiKey = await getStoredJpdbApiKey();
      if (!storedApiKey) {
        if (!didCancel) {
          setHasStoredJpdbApiKey(false);
          setIsTranslatingLyrics(false);
          setLyricsTranslationStatusMessage(
            "Add your JPDB API key in Settings to enable lyric translations."
          );
        }
        return;
      }

      setIsTranslatingLyrics(true);
      setLyricsTranslationStatusMessage(null);

      const accumulatedTranslations: Record<string, string> = {
        ...lineTranslations,
      };
      let statusMessage: string | null = null;
      let previousJapaneseContext: string | null = null;
      let previousEnglishContext: string | null = null;

      for (const line of uniqueVisibleLines) {
        if (didCancel) {
          return;
        }

        const existingTranslation = accumulatedTranslations[line];
        if (existingTranslation) {
          previousJapaneseContext = line;
          previousEnglishContext = existingTranslation;
          continue;
        }

        try {
          const context: [string, string] | null =
            previousJapaneseContext && previousEnglishContext
              ? [previousJapaneseContext, previousEnglishContext]
              : null;
          const translation = await translateJapaneseToEnglish(line, {
            apiKey: storedApiKey,
            context,
          });
          const translatedText = translation.text.trim();

          if (!translatedText) {
            continue;
          }

          accumulatedTranslations[line] = translatedText;
          if (!didCancel) {
            setLineTranslations((previous) => {
              if (previous[line] === translatedText) {
                return previous;
              }
              return {
                ...previous,
                [line]: translatedText,
              };
            });
          }
          previousJapaneseContext = line;
          previousEnglishContext = translatedText;
        } catch (translationError) {
          if (translationError instanceof JpdbApiError) {
            if (translationError.code === "bad_key") {
              statusMessage = "JPDB API key is invalid. Update it in Settings.";
              setHasStoredJpdbApiKey(false);
              break;
            }

            if (translationError.code === "too_many_requests") {
              statusMessage =
                "JPDB rate limit reached. Try lyric translation again in a moment.";
              break;
            }

            if (translationError.code === "api_unavailable") {
              statusMessage =
                "JPDB translation is temporarily unavailable. Please retry later.";
              break;
            }

            if (translationError.code === "text_too_long") {
              statusMessage = "Some lyric lines were too long to translate.";
              continue;
            }
          }

          console.error("Error translating lyric line:", translationError);
          statusMessage = "Could not translate lyrics right now.";
          break;
        }
      }

      if (!didCancel) {
        setIsTranslatingLyrics(false);
        setLyricsTranslationStatusMessage(statusMessage);
      }
    };

    void translateVisibleLyrics();

    return () => {
      didCancel = true;
    };
  }, [
    lineTranslations,
    lineTranslationsEnabled,
    normalizedVisibleLinesForTranslation,
  ]);

  const findVocabularyMatches = async (text: string) => {
    try {
      // Get all subjects from cache
      const allSubjects = await getAllSubjects();

      const {
        vocabularyMatches,
        kanjiMatches,
        jpdbParsedTokens: parsedTokens,
      } = await findMatches(
        text,
        allSubjects
      );

      setVocabularyMatches(vocabularyMatches);
      setKanjiMatches(kanjiMatches);
      setJpdbParsedTokens(Array.isArray(parsedTokens) ? parsedTokens : []);
    } catch (err) {
      console.error("Error finding vocabulary matches:", err);
      setJpdbParsedTokens([]);
    }
  };

  const handleVocabularyPress = useCallback(
    (
      itemId: number,
      surfaceText: string,
      event: any,
      itemOverride?: VocabularyMatch | KanjiMatch,
      tokenKey?: string,
      interactionMode: "press" | "hover" = "press"
    ) => {
      // Find the item in matches
      const item =
        itemOverride ??
        [...vocabularyMatches, ...kanjiMatches].find((m) => m.id === itemId);
      if (!item) {
        return;
      }

      const openTooltipAtAnchor = (
        x: number,
        y: number,
        width: number,
        height: number,
        source: "measure" | "page" = "measure"
      ) => {
        const statusBarOffset =
          source === "measure" && Platform.OS === "android"
            ? (StatusBar.currentHeight || 0)
            : 0;
        const adjustedY = y + statusBarOffset;

        const screenWidth = Dimensions.get("window").width;
        const screenHeight = Dimensions.get("window").height;
        const tooltipWidth = 280;
        const tooltipEstimatedHeight = 180;

        let left = x + width / 2 - tooltipWidth / 2;
        left = Math.max(16, Math.min(left, screenWidth - tooltipWidth - 16));

        const spaceBelow = screenHeight - (adjustedY + height);
        const spaceAbove = adjustedY;
        const top =
          spaceBelow >= tooltipEstimatedHeight || spaceBelow > spaceAbove
            ? adjustedY + height + 8
            : adjustedY - tooltipEstimatedHeight - 8;

        setTooltipPosition({ x: left, y: top, width });
        setSelectedItem(item);
        setSelectedSurfaceText(surfaceText);
        setSelectedTokenKey(tokenKey ?? null);
        setTooltipInteractionMode(interactionMode);

        tooltipOpacity.value = withTiming(1, {
          duration: interactionMode === "hover" ? 120 : 200,
        });
      };

      const measureFromTarget = (x: number, y: number, width: number, height: number) => {
        if (
          Number.isFinite(x) &&
          Number.isFinite(y) &&
          Number.isFinite(width) &&
          Number.isFinite(height) &&
          width > 0 &&
          height > 0
        ) {
          openTooltipAtAnchor(x, y, width, height, "measure");
          return true;
        }
        return false;
      };

      const measurementTag =
        typeof event?.currentTarget === "number"
          ? event.currentTarget
          : typeof event?.target === "number"
            ? event.target
            : null;
      if (
        measurementTag !== null &&
        typeof UIManager.measureInWindow === "function"
      ) {
        UIManager.measureInWindow(
          measurementTag,
          (x: number, y: number, width: number, height: number) => {
            if (measureFromTarget(x, y, width, height)) {
              return;
            }

            const pageX = Number(event?.nativeEvent?.pageX);
            const pageY = Number(event?.nativeEvent?.pageY);
            if (
              Number.isFinite(pageX) &&
              Number.isFinite(pageY) &&
              pageX > 1 &&
              pageY > 1
            ) {
              openTooltipAtAnchor(pageX - 12, pageY - 12, 24, 24, "page");
            }
          }
        );
        return;
      }

      const measurementTarget = event?.target as
        | { measureInWindow?: (callback: (x: number, y: number, w: number, h: number) => void) => void }
        | undefined;

      if (
        measurementTarget &&
        typeof measurementTarget.measureInWindow === "function"
      ) {
        measurementTarget.measureInWindow((x: number, y: number, width: number, height: number) => {
          if (measureFromTarget(x, y, width, height)) {
            return;
          }

          const pageX = Number(event?.nativeEvent?.pageX);
          const pageY = Number(event?.nativeEvent?.pageY);
          if (
            Number.isFinite(pageX) &&
            Number.isFinite(pageY) &&
            pageX > 1 &&
            pageY > 1
          ) {
            openTooltipAtAnchor(pageX - 12, pageY - 12, 24, 24, "page");
          }
        });
        return;
      }

      const pageX = Number(event?.nativeEvent?.pageX);
      const pageY = Number(event?.nativeEvent?.pageY);
      if (
        Number.isFinite(pageX) &&
        Number.isFinite(pageY) &&
        pageX > 1 &&
        pageY > 1
      ) {
        openTooltipAtAnchor(pageX - 12, pageY - 12, 24, 24, "page");
      }
    },
    [vocabularyMatches, kanjiMatches, tooltipOpacity]
  );

  const handleCloseTooltip = useCallback(() => {
    // Instantly close without animation
    tooltipOpacity.value = 0;
    setSelectedItem(null);
    setSelectedSurfaceText(null);
    setSelectedTokenKey(null);
    setTooltipInteractionMode(null);
    setTooltipPosition(null);
  }, [tooltipOpacity]);

  const handleHoverTokenLeave = useCallback(
    (tokenKey: string) => {
      if (tooltipInteractionMode !== "hover") {
        return;
      }
      if (selectedTokenKey !== tokenKey) {
        return;
      }
      handleCloseTooltip();
    },
    [tooltipInteractionMode, selectedTokenKey, handleCloseTooltip]
  );

  const handleViewDetails = useCallback(() => {
    if (selectedItem && isWaniKaniBackedMatch(selectedItem)) {
      handleCloseTooltip();
      router.push({
        pathname: "/subject/[id]",
        params: { id: selectedItem.id.toString(), from: "song-lyrics" },
      });
    }
  }, [selectedItem, router, handleCloseTooltip]);

  const handleViewSubject = useCallback(
    (subjectId: number) => {
      handleCloseTooltip();
      router.push({
        pathname: "/subject/[id]",
        params: { id: subjectId.toString(), from: "song-lyrics" },
      });
    },
    [handleCloseTooltip, router]
  );

  const handleClose = useCallback(() => {
    router.back();
  }, [router]);

  const openJpdbApiKeySettings = useCallback(() => {
    router.push({
      pathname: "/settings",
      params: { scrollTo: "jpdbApiKey" },
    });
  }, [router]);

  const selectStudyMode = useCallback((mode: StudyModePreference) => {
    if (mode === "full" && !hasStoredJpdbApiKey) {
      Alert.alert(
        "JPDB API Key Required",
        "Full grammar study mode is blocked until you save a JPDB API key.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Open Settings",
            onPress: openJpdbApiKeySettings,
          },
        ]
      );
      return;
    }

    setSongsLyricsDefaultStudyMode(mode);
  }, [
    hasStoredJpdbApiKey,
    openJpdbApiKeySettings,
    setSongsLyricsDefaultStudyMode,
  ]);

  const toggleLineTranslationsFromMenu = useCallback(() => {
    if (!hasStoredJpdbApiKey) {
      return;
    }

    setSongsLyricsLineTranslationsEnabled(!lineTranslationsEnabled);
  }, [
    hasStoredJpdbApiKey,
    lineTranslationsEnabled,
    setSongsLyricsLineTranslationsEnabled,
  ]);

  const openLyricsTimingAdjustment = useCallback(() => {
    setIsLyricsTimingAdjustmentEnabled(true);
    setIsLyricsTimingControlVisible(true);
    setIsAutoscrollEnabled(true);
  }, []);

  const closeLyricsTimingAdjustment = useCallback(() => {
    setIsLyricsTimingControlVisible(false);
    if (lyricsTimingOffsetMs === 0) {
      setIsLyricsTimingAdjustmentEnabled(false);
    }
  }, [lyricsTimingOffsetMs]);

  const handleLyricsTimingOffsetChange = useCallback(
    (offsetSeconds: number) => {
      const nextOffsetMs = clampLyricsTimingOffsetMs(offsetSeconds * 1000);
      lyricsTimingOffsetMsRef.current = nextOffsetMs;
      setIsLyricsTimingAdjustmentEnabled(true);
      setIsLyricsTimingControlVisible(true);
      setLyricsTimingOffsetMs(nextOffsetMs);
      setIsAutoscrollEnabled(true);
    },
    [setLyricsTimingOffsetMs]
  );

  const adjustLyricsTimingOffset = useCallback(
    (deltaMs: number) => {
      const nextOffsetMs = clampLyricsTimingOffsetMs(
        lyricsTimingOffsetMs + deltaMs
      );
      lyricsTimingOffsetMsRef.current = nextOffsetMs;
      setIsLyricsTimingAdjustmentEnabled(true);
      setIsLyricsTimingControlVisible(true);
      setLyricsTimingOffsetMs(nextOffsetMs);
      setIsAutoscrollEnabled(true);
    },
    [lyricsTimingOffsetMs, setLyricsTimingOffsetMs]
  );

  const resetLyricsTimingOffset = useCallback(() => {
    lyricsTimingOffsetMsRef.current = 0;
    setIsLyricsTimingAdjustmentEnabled(false);
    setIsLyricsTimingControlVisible(false);
    setLyricsTimingOffsetMs(0);
    setIsAutoscrollEnabled(true);
  }, [setLyricsTimingOffsetMs]);

  const searchVideos = useCallback(async (query: string) => {
    if (!query.trim()) return;

    setIsSearchingVideos(true);
    try {
      const results = await youtubeService.searchVideos(query);
      setVideoSearchResults(results);
    } catch (error) {
      console.error("Error searching videos:", error);
    } finally {
      setIsSearchingVideos(false);
    }
  }, []);

  const handleSelectVideo = useCallback(
    (videoId: string) => {
      setError(null);
      setCurrentVideoId(videoId);
      setSongInfo({
        albumArt,
        songTitle,
        artist,
        youtubeVideoId: videoId,
        songId,
        songUrl,
        musicSource: "spotify",
        lyricsTimingOffsetMs: lyricsTimingOffsetMsRef.current,
      });
      setShowOverrideModal(false);

      // Update Cache
      if (songTitle && artist) {
        const cacheKeyBase = `wanikani_lyrics_v1_${songTitle.replace(
          /\s+/g,
          ""
        )}_${artist.replace(/\s+/g, "")}`;
        AsyncStorage.setItem(`${cacheKeyBase}_video`, videoId).catch((e) =>
          console.error("Error checking video cache update:", e)
        );
      }
    },
    [albumArt, songTitle, artist, songId, songUrl, setSongInfo]
  );

  const searchLyrics = useCallback(async (song: string, artist: string) => {
    if (!song.trim() && !artist.trim()) return;

    setIsSearchingLyrics(true);
    try {
      const results = await lyricsService.searchLyrics(song, artist);
      setLyricsSearchResults(results);
    } catch (error) {
      console.error("Error searching lyrics:", error);
    } finally {
      setIsSearchingLyrics(false);
    }
  }, []);

  const handleSelectLyrics = useCallback(
    async (lyricsId: number) => {
      setTimedLyricsStatus("loading");
      setError(null);
      setShowOverrideModal(false);

      try {
        const lyricsResult = await lyricsService.getLyricsById(lyricsId);
        const { plainLyrics, timedLyrics: timedLines } = lyricsResult;

        if (plainLyrics) {
          setLyrics(plainLyrics);
          await findVocabularyMatches(plainLyrics);
        }

        if (timedLines.length > 0) {
          setTimedLyrics(timedLines);
          setGlobalTimedLyrics(timedLines); // Sync with global player
          setTimedLyricsStatus("available");
          setIsTimedMode(true);
        } else {
          setTimedLyricsStatus("unavailable");
          setIsTimedMode(false);
        }

        // Update Cache
        if (songTitle && artist) {
          const cacheKeyBase = `wanikani_lyrics_v1_${songTitle.replace(
            /\s+/g,
            ""
          )}_${artist.replace(/\s+/g, "")}`;
          AsyncStorage.setItem(
            `${cacheKeyBase}_lyrics`,
            JSON.stringify(lyricsResult)
          ).catch((e) => console.error("Error updating lyrics cache:", e));
        }
      } catch (error) {
        console.error("Error loading selected lyrics:", error);
        setError("Failed to load selected lyrics");
        setTimedLyricsStatus("unavailable");
      } finally {
        setIsLoading(false);
      }
    },
    [findVocabularyMatches, songTitle, artist]
  );

  const seekToTime = useCallback(
    async (timeInSeconds: number) => {
      if (!playerRef.current) return;

      try {
        await playerRef.current.seekTo(timeInSeconds);
        // Re-enable autoscroll when user clicks on a lyric line
        setIsAutoscrollEnabled(true);
      } catch (error) {
        console.error("Error seeking to time:", error);
      }
    },
    [playerRef]
  );

  // Auto-scroll to current timed lyric line (only if autoscroll is enabled)
  useEffect(() => {
    if (
      !isTimedMode ||
      !isPlaying ||
      timedLyrics.length === 0 ||
      !isAutoscrollEnabled
    )
      return;

    const adjustedCurrentTimeMs =
      currentTime * 1000 - activeLyricsTimingOffsetMs;
    const currentLineIndex = timedLyrics.findIndex((line, index) => {
      const nextLine = timedLyrics[index + 1];
      return (
        adjustedCurrentTimeMs >= line.startTimeMs &&
        (!nextLine || adjustedCurrentTimeMs < nextLine.startTimeMs)
      );
    });

    if (currentLineIndex !== -1 && lineRefs.current[currentLineIndex]) {
      lineRefs.current[currentLineIndex]?.measureLayout(
        scrollViewRef.current as any,
        (x, y) => {
          const screenHeight = Dimensions.get("window").height;
          const offset = screenHeight / 2 - 250;

          scrollViewRef.current?.scrollTo({
            y: Math.max(0, y - offset),
            animated: true,
          });
        },
        () => {}
      );
    }
  }, [
    currentTime,
    activeLyricsTimingOffsetMs,
    isTimedMode,
    isPlaying,
    timedLyrics,
    isAutoscrollEnabled,
    isPlayerExpanded,
  ]);

  // Handle manual scrolling
  const handleScroll = useCallback(() => {
    // If user manually scrolls, disable autoscroll
    if (isUserScrollingRef.current) {
      setIsAutoscrollEnabled(false);

      // Clear any existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set new timeout to re-enable autoscroll after 5 seconds of no scrolling
      scrollTimeoutRef.current = setTimeout(() => {
        setIsAutoscrollEnabled(true);
        isUserScrollingRef.current = false;
      }, 5000);
    }
  }, []);

  const handleScrollBeginDrag = useCallback(() => {
    // User has started scrolling manually
    isUserScrollingRef.current = true;
  }, []);

  const handleScrollEndDrag = useCallback(() => {
    // User has stopped dragging, start the timeout
    handleScroll();
  }, [handleScroll]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const renderUnderlinedAnalyzedText = (
    text: string,
    textStartOffset: number,
    baseTextStyle: any
  ): ReactElement => {
    if (!text) {
      return <Text style={baseTextStyle}>{text}</Text>;
    }

    type ParsedInlineSegment = {
      text: string;
      tokenType: "plain" | "grammar" | "verb" | "vocabulary";
      token?: JpdbParsedTokenAnnotation;
    };

    const textEndOffset = textStartOffset + text.length;
    const inlineSegments: ParsedInlineSegment[] = [];

    if (jpdbParsedTokens.length === 0) {
      inlineSegments.push({
        text,
        tokenType: "plain",
      });
    } else {
      const textTokens = jpdbParsedTokens
        .filter(
          (token) =>
            token.start >= textStartOffset &&
            token.end <= textEndOffset &&
            token.end > token.start
        )
        .sort((a, b) => {
          if (a.start !== b.start) {
            return a.start - b.start;
          }
          return b.end - b.start - (a.end - a.start);
        });

      let cursor = 0;
      for (const token of textTokens) {
        const localStart = token.start - textStartOffset;
        const localEnd = token.end - textStartOffset;
        if (localStart < cursor || localStart < 0 || localEnd > text.length) {
          continue;
        }

        if (localStart > cursor) {
          inlineSegments.push({
            text: text.slice(cursor, localStart),
            tokenType: "plain",
          });
        }

        const tokenText = text.slice(localStart, localEnd);
        if (tokenText) {
          inlineSegments.push({
            text: tokenText,
            tokenType: token.tokenType,
            token,
          });
        }

        cursor = localEnd;
      }

      if (cursor < text.length) {
        inlineSegments.push({
          text: text.slice(cursor),
          tokenType: "plain",
        });
      }
    }

    return (
      <View style={styles.underlinedInlineContainer}>
        {inlineSegments.flatMap((segment, index) => {
          const renderedNodes: ReactElement[] = [];

          if (segment.tokenType === "plain" || !segment.token) {
            renderedNodes.push(
              <Text key={`plain-${textStartOffset}-${index}`} style={baseTextStyle}>
                {segment.text}
              </Text>
            );
            return renderedNodes;
          }

          const mappedMatch =
            typeof segment.token.mappedVocabularyId === "number"
              ? vocabularyMatchesById.get(segment.token.mappedVocabularyId)
              : undefined;
          const grammarTooltipItem =
            segment.tokenType === "grammar"
              ? buildGrammarTooltipItem(segment.token)
              : null;
          const tooltipItem = grammarTooltipItem ?? mappedMatch ?? null;
          const tokenKey = `${segment.token.start}-${segment.token.end}-${segment.text}`;
          const isSelectedToken =
            Boolean(selectedItem) && selectedTokenKey === tokenKey;
          const underlineColor =
            segment.tokenType === "grammar"
              ? grammarUnderlineColor
              : segment.tokenType === "verb"
                ? verbUnderlineColor
                : vocabUnderlineColor;
          const tokenUnderlineColor = withAlpha(
            underlineColor,
            theme.isDark ? 0.95 : 0.75
          );
          const selectedTokenBorderColor = withAlpha(
            theme.textColor,
            theme.isDark ? 0.58 : 0.34
          );
          const selectedTokenBackground = withAlpha(
            underlineColor,
            theme.isDark ? 0.24 : 0.18
          );

          const tokenText = (
            <Text
              style={[
                baseTextStyle,
                styles.inlineUnderlineToken,
                isSelectedToken ? styles.inlineUnderlineTokenSelected : null,
                {
                  borderBottomColor: tokenUnderlineColor,
                  ...(isSelectedToken
                    ? {
                        borderColor: selectedTokenBorderColor,
                        backgroundColor: selectedTokenBackground,
                      }
                    : null),
                },
              ]}
            >
              {segment.text}
            </Text>
          );

          const tokenNodeKey = `token-${textStartOffset}-${index}-${segment.token.start}-${segment.token.end}`;
          if (!tooltipItem) {
            renderedNodes.push(
              <View key={tokenNodeKey} style={styles.underlinedTokenPressable}>
                {tokenText}
              </View>
            );
          } else {
            renderedNodes.push(
              <Pressable
                key={tokenNodeKey}
                style={styles.underlinedTokenPressable}
                onPress={(event) =>
                  handleVocabularyPress(
                    tooltipItem.id,
                    segment.text,
                    event,
                    tooltipItem,
                    tokenKey,
                    "press"
                  )
                }
                onHoverIn={
                  hoverPreviewEnabled
                    ? (event) =>
                        handleVocabularyPress(
                          tooltipItem.id,
                          segment.text,
                          event,
                          tooltipItem,
                          tokenKey,
                          "hover"
                        )
                    : undefined
                }
                onHoverOut={
                  hoverPreviewEnabled
                    ? () => handleHoverTokenLeave(tokenKey)
                    : undefined
                }
              >
                {tokenText}
              </Pressable>
            );
          }

          const nextSegment = inlineSegments[index + 1];
          const hasAdjacentHighlightedSegment =
            nextSegment &&
            nextSegment.tokenType !== "plain" &&
            Boolean(nextSegment.token);
          if (hasAdjacentHighlightedSegment) {
            renderedNodes.push(
              <Text
                key={`sep-${textStartOffset}-${index}`}
                style={[baseTextStyle, styles.inlineUnderlineSeparator]}
              >
                {TOKEN_UNDERLINE_SEPARATOR}
              </Text>
            );
          }

          return renderedNodes;
        })}
      </View>
    );
  };

  // Helper function to highlight vocabulary in timed lyrics with inline chips
  const highlightTimedLyricLine = (
    text: string,
    textStartOffset: number
  ): ReactElement => {
    if (!text) return <Text>{text}</Text>;

    const allMatches = [...vocabularyMatches, ...kanjiMatches];
    const segments = getHighlightSegments(text, allMatches);

    return (
      <>
        {segments.map((segment, index) => {
          if (!segment.match) {
            return <Text key={`text-${index}`}>{segment.text}</Text>;
          }

          const highlight = segment.match;
          const color = getItemColor(highlight.type);
          const isWaniKaniBacked = isWaniKaniBackedMatch(highlight);
          const shouldKnow = isWaniKaniBacked ? highlight.level <= userLevel : true;
          const showLevelBadge = !shouldKnow && isWaniKaniBacked;
          const showJpdbBadge = !isWaniKaniBacked;

          return (
            <TouchableOpacity
              key={`chip-${index}-${highlight.id}`}
              onPress={(e) => handleVocabularyPress(highlight.id, segment.text, e)}
              activeOpacity={0.7}
              style={[
                styles.inlineChipWrapper,
                (showLevelBadge || showJpdbBadge) && styles.inlineChipWrapperWithBadge,
              ]}
            >
              <View
                style={[
                  styles.inlineChip,
                  {
                    backgroundColor: color,
                    opacity: shouldKnow ? 1 : 0.7,
                  },
                ]}
              >
                <Text style={styles.inlineChipText}>{segment.text}</Text>
                {showLevelBadge && (
                  <View
                    style={[styles.levelBadgeChip, { backgroundColor: color }]}
                  >
                    <Text style={styles.levelBadgeText}>{highlight.level}</Text>
                  </View>
                )}
                {showJpdbBadge && (
                  <View style={[styles.levelBadgeChip, styles.jpdbBadgeChip]}>
                    <Text style={styles.levelBadgeText}>JP</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </>
    );
  };

  // Helper function to render timed lyrics
  const renderTimedLyrics = (): ReactElement => {
    const adjustedCurrentTimeMs =
      currentTime * 1000 - activeLyricsTimingOffsetMs;

    return (
      <>
        {timedLyrics.map((line, index) => {
          const isCurrentLine =
            adjustedCurrentTimeMs >= line.startTimeMs &&
            (!timedLyrics[index + 1] ||
              adjustedCurrentTimeMs < timedLyrics[index + 1].startTimeMs);

          const isPastLine =
            adjustedCurrentTimeMs > line.startTimeMs && !isCurrentLine;
          const translatedLineText =
            timedLineTranslationsForDisplay[index] ?? null;
          const seekTimeSeconds = Math.max(
            0,
            (line.startTimeMs + activeLyricsTimingOffsetMs) / 1000
          );

          return (
            <TouchableOpacity
              key={index}
              ref={(ref: any) => {
                if (ref) lineRefs.current[index] = ref;
              }}
              style={styles.timedLyricLine}
              onPress={
                fullAnalysisEnabled ? undefined : () => seekToTime(seekTimeSeconds)
              }
              disabled={fullAnalysisEnabled}
              activeOpacity={fullAnalysisEnabled ? 1 : 0.7}
            >
              {fullAnalysisEnabled ? (
                renderUnderlinedAnalyzedText(
                  line.words,
                  timedLineOffsets[index] ?? 0,
                  [
                    styles.timedLyricText,
                    fontStyles.japaneseText,
                    { color: theme.textColor },
                    isCurrentLine && styles.currentTimedLyric,
                    isPastLine && styles.pastTimedLyric,
                  ]
                )
              ) : wkStudyModeEnabled ? (
                <Text
                  style={[
                    styles.timedLyricText,
                    fontStyles.japaneseText,
                    { color: theme.textColor },
                    isCurrentLine && styles.currentTimedLyric,
                    isPastLine && styles.pastTimedLyric,
                  ]}
                >
                  {highlightTimedLyricLine(line.words, timedLineOffsets[index] ?? 0)}
                </Text>
              ) : (
                <Text
                  style={[
                    styles.timedLyricText,
                    fontStyles.japaneseText,
                    { color: theme.textColor },
                    isCurrentLine && styles.currentTimedLyric,
                    isPastLine && styles.pastTimedLyric,
                  ]}
                >
                  {line.words}
                </Text>
              )}
              {translatedLineText ? (
                <StreamingLineText
                  text={translatedLineText}
                  color={theme.textSecondary}
                />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </>
    );
  };

  // Helper function to render one static lyric line with highlights
  const renderStaticLyricLine = (
    lineText: string,
    lineStartOffset: number
  ): ReactElement => {
    if (fullAnalysisEnabled) {
      return renderUnderlinedAnalyzedText(lineText, lineStartOffset, [
        styles.lyricsText,
        { color: theme.textColor },
        fontStyles.japaneseText,
      ]);
    }

    if (!wkStudyModeEnabled) {
      return (
        <Text
          style={[
            styles.lyricsText,
            { color: theme.textColor },
            fontStyles.japaneseText,
          ]}
        >
          {lineText}
        </Text>
      );
    }

    const allMatches = [...vocabularyMatches, ...kanjiMatches];
    const segments = getHighlightSegments(lineText, allMatches);

    return (
      <Text
        style={[
          styles.lyricsText,
          { color: theme.textColor },
          fontStyles.japaneseText,
        ]}
      >
        {segments.map((segment, index) => {
          if (!segment.match) {
            return <Text key={`text-${lineStartOffset}-${index}`}>{segment.text}</Text>;
          }

          const highlight = segment.match;
          const color = getItemColor(highlight.type);
          const isWaniKaniBacked = isWaniKaniBackedMatch(highlight);
          const shouldKnow = isWaniKaniBacked ? highlight.level <= userLevel : true;
          const showLevelBadge = !shouldKnow && isWaniKaniBacked;
          const showJpdbBadge = !isWaniKaniBacked;

          return (
            <TouchableOpacity
              key={`chip-static-${lineStartOffset}-${index}-${highlight.id}`}
              onPress={(event) =>
                handleVocabularyPress(highlight.id, segment.text, event)
              }
              activeOpacity={0.7}
              style={[
                styles.inlineChipWrapper,
                (showLevelBadge || showJpdbBadge) && styles.inlineChipWrapperWithBadge,
              ]}
            >
              <View
                style={[
                  styles.inlineChip,
                  {
                    backgroundColor: color,
                    opacity: shouldKnow ? 1 : 0.7,
                  },
                ]}
              >
                <Text style={styles.inlineChipText}>{segment.text}</Text>
                {showLevelBadge && (
                  <View
                    style={[styles.levelBadgeChip, { backgroundColor: color }]}
                  >
                    <Text style={styles.levelBadgeText}>{highlight.level}</Text>
                  </View>
                )}
                {showJpdbBadge && (
                  <View style={[styles.levelBadgeChip, styles.jpdbBadgeChip]}>
                    <Text style={styles.levelBadgeText}>JP</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </Text>
    );
  };

  const renderStaticLyrics = (): ReactElement => {
    if (!lyrics) {
      return (
        <Text
          style={[
            styles.lyricsText,
            { color: theme.textColor },
            fontStyles.japaneseText,
          ]}
        >
          {lyrics}
        </Text>
      );
    }

    return (
      <>
        {staticLyricLines.map((line, index) => {
          const translatedLineText = staticLineTranslationsForDisplay[index] ?? null;
          const hasVisibleText = line.text.trim().length > 0;

          return (
            <View key={line.key} style={styles.staticLyricLine}>
              {hasVisibleText ? (
                renderStaticLyricLine(line.text, line.startOffset)
              ) : (
                <Text
                  style={[
                    styles.lyricsText,
                    { color: theme.textColor },
                    fontStyles.japaneseText,
                  ]}
                >
                  {" "}
                </Text>
              )}
              {translatedLineText ? (
                <StreamingLineText
                  text={translatedLineText}
                  color={theme.textSecondary}
                />
              ) : null}
            </View>
          );
        })}
      </>
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.cardBackground,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleClose}
          style={styles.backButton}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color={theme.textColor} />
        </TouchableOpacity>
        <Image source={{ uri: albumArt }} style={styles.headerAlbumArt} />
        <View style={styles.headerInfo}>
          <Text
            style={[styles.headerSongTitle, { color: theme.textColor }]}
            numberOfLines={1}
          >
            {songTitle}
          </Text>
          <Text
            style={[styles.headerArtist, { color: theme.textSecondary }]}
            numberOfLines={1}
          >
            {artist}
          </Text>
        </View>
        <View style={styles.headerActions}>
          {supportsNativeHeaderStudyMenu ? (
            <SwiftUI.Host matchContents style={styles.headerActionHost}>
              <SwiftUI.Menu
                label={
                  <SwiftUI.RNHostView matchContents>
                    <GlassButton
                      iconName="language-outline"
                      iconSize={20}
                      iconColor={theme.textColor}
                      variant={theme.isDark ? "colored" : "light"}
                    />
                  </SwiftUI.RNHostView>
                }
              >
                <SwiftUI.Menu label="Study Mode" systemImage="graduationcap">
                  <SwiftUI.Button
                    label="No study mode"
                    systemImage={
                      activeStudyMode === "none"
                        ? "checkmark.circle.fill"
                        : "circle"
                    }
                    onPress={() => selectStudyMode("none")}
                  />
                  <SwiftUI.Button
                    label="WK study mode"
                    systemImage={
                      activeStudyMode === "wk"
                        ? "checkmark.circle.fill"
                        : "circle"
                    }
                    onPress={() => selectStudyMode("wk")}
                  />
                  <SwiftUI.Button
                    label="Full grammar study mode"
                    systemImage={
                      !hasStoredJpdbApiKey
                        ? "lock"
                        : activeStudyMode === "full"
                          ? "checkmark.circle.fill"
                          : "circle"
                    }
                    onPress={() => selectStudyMode("full")}
                  />
                </SwiftUI.Menu>
                <SwiftUI.Button
                  label={
                    lineTranslationsEnabled
                      ? "Disable English line translations"
                      : "Enable English line translations"
                  }
                  systemImage={lineTranslationsEnabled ? "checkmark.circle.fill" : "circle"}
                  onPress={toggleLineTranslationsFromMenu}
                  modifiers={
                    SwiftUIModifiers
                      ? [SwiftUIModifiers.disabled(!hasStoredJpdbApiKey)]
                      : undefined
                  }
                />
              </SwiftUI.Menu>
            </SwiftUI.Host>
          ) : null}
          <View ref={settingsButtonRef}>
            <GlassButton
              iconName="settings-outline"
              iconSize={20}
              iconColor={theme.textColor}
              variant={theme.isDark ? "colored" : "light"}
              onPress={() => {
                setActiveOverrideMode(isAppleMusicFlow ? "lyrics" : "video");
                setShowOverrideModal(true);
              }}
            />
          </View>
        </View>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: theme.primary }]}
            onPress={loadLyrics}
            activeOpacity={0.7}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.content}
          contentContainerStyle={{
            paddingBottom: 120,
          }}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScrollEndDrag={handleScrollEndDrag}
          onMomentumScrollEnd={handleScroll}
          scrollEventThrottle={16}
        >
          {/* Lyrics */}
          <View
            style={[styles.lyricsCard, { backgroundColor: theme.cardBackground }]}
          >
            <View style={styles.lyricsTitleRow}>
              <Text style={[styles.lyricsTitle, { color: theme.textColor }]}>
                Lyrics
              </Text>
              {timedLyrics.length > 0 && (
                <View style={styles.lyricsTitleActions}>
                  {isTimedMode && (
                    <TouchableOpacity
                      style={[
                        styles.lyricsTimingToggleButton,
                        {
                          borderColor: theme.border,
                          backgroundColor:
                            isLyricsTimingAdjustmentEnabled
                              ? withAlpha(
                                  theme.primary,
                                  theme.isDark ? 0.28 : 0.12
                                )
                              : "transparent",
                        },
                      ]}
                      onPress={openLyricsTimingAdjustment}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="time-outline"
                        size={14}
                        color={
                          isLyricsTimingAdjustmentEnabled
                            ? theme.primary
                            : theme.textSecondary
                        }
                      />
                      <Text
                        style={[
                          styles.lyricsTimingToggleButtonText,
                          {
                            color:
                              isLyricsTimingAdjustmentEnabled
                                ? theme.primary
                                : theme.textSecondary,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {isLyricsTimingAdjustmentEnabled &&
                        lyricsTimingOffsetMs !== 0
                          ? lyricsTimingOffsetDisplay
                          : "Delay"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <View ref={syncToggleRef} style={styles.syncToggleRow}>
                    <Ionicons
                      name="sync"
                      size={18}
                      color={theme.textSecondary}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.syncToggleLabel,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Sync
                    </Text>
                    <Switch
                      value={isTimedMode}
                      onValueChange={(value) => {
                        setIsTimedMode(value);
                        if (value) {
                          setIsAutoscrollEnabled(true);
                        } else {
                          setIsLyricsTimingControlVisible(false);
                        }
                      }}
                      trackColor={{ false: "#767577", true: theme.primary }}
                      thumbColor="#f4f3f4"
                    />
                  </View>
                </View>
              )}
            </View>

            {shouldShowLyricsTimingControl ? (
              <View
                style={[
                  styles.lyricsTimingControl,
                  {
                    borderColor: theme.border,
                  },
                ]}
              >
                <View style={styles.lyricsTimingHeader}>
                  <View style={styles.lyricsTimingTitleGroup}>
                    <Ionicons
                      name="time-outline"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.lyricsTimingTitle,
                        { color: theme.textColor },
                      ]}
                    >
                      Lyrics timing
                    </Text>
                  </View>
                  <View style={styles.lyricsTimingHeaderActions}>
                    <Text
                      style={[
                        styles.lyricsTimingValue,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {lyricsTimingOffsetDisplay}
                    </Text>
                    <TouchableOpacity
                      style={styles.lyricsTimingCloseButton}
                      onPress={closeLyricsTimingAdjustment}
                      activeOpacity={0.7}
                    >
                      <Ionicons
                        name="close"
                        size={18}
                        color={theme.textSecondary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
                <Slider
                  style={styles.lyricsTimingSlider}
                  minimumValue={LYRICS_TIMING_OFFSET_MIN_MS / 1000}
                  maximumValue={LYRICS_TIMING_OFFSET_MAX_MS / 1000}
                  step={LYRICS_TIMING_OFFSET_STEP_MS / 1000}
                  value={lyricsTimingOffsetSeconds}
                  onValueChange={handleLyricsTimingOffsetChange}
                  minimumTrackTintColor={theme.primary}
                  maximumTrackTintColor={theme.border}
                  thumbTintColor={theme.primary}
                />
                <View style={styles.lyricsTimingActions}>
                  <TouchableOpacity
                    style={[
                      styles.lyricsTimingButton,
                      { borderColor: theme.border },
                      lyricsTimingOffsetMs <= LYRICS_TIMING_OFFSET_MIN_MS &&
                        styles.lyricsTimingButtonDisabled,
                    ]}
                    onPress={() =>
                      adjustLyricsTimingOffset(-LYRICS_TIMING_OFFSET_STEP_MS)
                    }
                    disabled={
                      lyricsTimingOffsetMs <= LYRICS_TIMING_OFFSET_MIN_MS
                    }
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="play-back-outline"
                      size={15}
                      color={theme.textColor}
                    />
                    <Text
                      style={[
                        styles.lyricsTimingButtonText,
                        { color: theme.textColor },
                      ]}
                    >
                      -0.5s
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.lyricsTimingButton,
                      { borderColor: theme.border },
                      lyricsTimingOffsetMs === 0 &&
                        styles.lyricsTimingButtonDisabled,
                    ]}
                    onPress={resetLyricsTimingOffset}
                    disabled={lyricsTimingOffsetMs === 0}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="refresh-outline"
                      size={15}
                      color={theme.textColor}
                    />
                    <Text
                      style={[
                        styles.lyricsTimingButtonText,
                        { color: theme.textColor },
                      ]}
                    >
                      Reset
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.lyricsTimingButton,
                      { borderColor: theme.border },
                      lyricsTimingOffsetMs >= LYRICS_TIMING_OFFSET_MAX_MS &&
                        styles.lyricsTimingButtonDisabled,
                    ]}
                    onPress={() =>
                      adjustLyricsTimingOffset(LYRICS_TIMING_OFFSET_STEP_MS)
                    }
                    disabled={
                      lyricsTimingOffsetMs >= LYRICS_TIMING_OFFSET_MAX_MS
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.lyricsTimingButtonText,
                        { color: theme.textColor },
                      ]}
                    >
                      +0.5s
                    </Text>
                    <Ionicons
                      name="play-forward-outline"
                      size={15}
                      color={theme.textColor}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            {/* Show info message when timed lyrics unavailable and we're in static mode */}
            {timedLyricsStatus === "unavailable" &&
              !isTimedMode &&
              timedLyrics.length === 0 && (
                <View
                  style={[styles.infoMessage, { backgroundColor: theme.border }]}
                >
                  <View style={styles.infoMessageContent}>
                    <Ionicons
                      name="information-circle-outline"
                      size={16}
                      color={theme.textSecondary}
                      style={styles.infoIcon}
                    />
                    <Text
                      style={[
                        styles.infoMessageText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Time-synced lyrics not available for this song
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.manualSearchButton,
                      { backgroundColor: theme.cardBackground },
                    ]}
                    onPress={() => {
                      setActiveOverrideMode("lyrics");
                      setShowOverrideModal(true);
                      setLyricsSearchSong(songTitle || "");
                      setLyricsSearchArtist("");
                      searchLyrics(songTitle || "", "");
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="search" size={14} color={theme.primary} />
                    <Text
                      style={[
                        styles.manualSearchButtonText,
                        { color: theme.primary },
                      ]}
                    >
                      Search Manually
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

            {lineTranslationsEnabled &&
              (isTranslatingLyrics || lyricsTranslationStatusMessage) && (
                <View style={styles.translationStatusRow}>
                  <Text
                    style={[
                      styles.translationStatusText,
                      {
                        color: isTranslatingLyrics
                          ? theme.textSecondary
                          : theme.error,
                      },
                    ]}
                  >
                    {isTranslatingLyrics
                      ? "Translating lyric lines..."
                      : lyricsTranslationStatusMessage}
                  </Text>
                </View>
              )}

            <View ref={lyricsContentRef} style={styles.lyricsContent}>
              {timedLyricsStatus === "loading" ? (
                <View style={styles.skeletonContainer}>
                  {/* Skeleton loader for lyrics */}
                  {[...Array(8)].map((_, groupIndex) => (
                    <View
                      key={`group-${groupIndex}`}
                      style={styles.skeletonGroup}
                    >
                      {[...Array(Math.floor(Math.random() * 3) + 2)].map(
                        (_, lineIndex) => (
                          <Animated.View
                            key={`line-${groupIndex}-${lineIndex}`}
                            style={[
                              styles.skeletonLine,
                              {
                                backgroundColor: theme.border,
                                width: `${60 + Math.random() * 35}%`,
                                opacity: skeletonOpacity,
                              },
                            ]}
                          />
                        )
                      )}
                    </View>
                  ))}
                </View>
              ) : isTimedMode && timedLyrics.length > 0 ? (
                renderTimedLyrics()
              ) : (
                renderStaticLyrics()
              )}
            </View>
          </View>
          {/* Animated Spacer for MiniPlayer */}
          <Animated.View style={animatedSpacerStyle} />
        </ScrollView>
      )}

      {/* Tooltip Modal */}
      <VocabularyTooltip
        selectedItem={selectedItem}
        position={tooltipPosition}
        opacity={tooltipOpacity}
        selectedSurfaceText={selectedSurfaceText}
        interactionMode={tooltipInteractionMode ?? "press"}
        headerColorOverride={
          selectedItem && selectedItem.id <= GRAMMAR_TOOLTIP_ID_MIN
            ? grammarUnderlineColor
            : undefined
        }
        onClose={handleCloseTooltip}
        onViewDetails={handleViewDetails}
        onViewSubject={handleViewSubject}
      />

      {/* Override Settings Modal */}
      <Modal
        visible={showOverrideModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOverrideModal(false)}
      >
        <View style={styles.overrideModalOverlay}>
          <View
            style={[
              styles.overrideModalContent,
              { backgroundColor: theme.cardBackground },
            ]}
          >
            {/* Header */}
            <View style={styles.overrideModalHeader}>
              <Text
                style={[styles.overrideModalTitle, { color: theme.textColor }]}
              >
                Settings
              </Text>
              <TouchableOpacity onPress={() => setShowOverrideModal(false)}>
                <Ionicons name="close" size={24} color={theme.textColor} />
              </TouchableOpacity>
            </View>

            {!supportsNativeHeaderStudyMenu && (
              <>
                <View
                  style={[
                    styles.analysisModeRow,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <View style={styles.analysisModeInfo}>
                    <Text
                      style={[
                        styles.analysisModeTitle,
                        { color: theme.textColor },
                      ]}
                    >
                      Study mode
                    </Text>
                    <Text
                      style={[
                        styles.analysisModeSubtitle,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Choose between plain lyrics, WK chips, or full JPDB grammar underlines.
                    </Text>
                  </View>
                </View>

                <View
                  style={[
                    styles.analysisModeSelector,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.analysisModeSelectorButton,
                      {
                        borderColor: theme.border,
                        backgroundColor:
                          activeStudyMode === "none"
                            ? theme.primary
                            : "transparent",
                      },
                    ]}
                    onPress={() => selectStudyMode("none")}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.analysisModeSelectorButtonText,
                        {
                          color:
                            activeStudyMode === "none"
                              ? "#fff"
                              : theme.textColor,
                        },
                      ]}
                    >
                      Normal
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.analysisModeSelectorButton,
                      {
                        borderColor: theme.border,
                        backgroundColor:
                          activeStudyMode === "wk"
                            ? theme.primary
                            : "transparent",
                      },
                    ]}
                    onPress={() => selectStudyMode("wk")}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.analysisModeSelectorButtonText,
                        {
                          color:
                            activeStudyMode === "wk"
                              ? "#fff"
                              : theme.textColor,
                        },
                      ]}
                    >
                      Vocab
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.analysisModeSelectorButton,
                      !hasStoredJpdbApiKey && styles.analysisModeSelectorButtonDisabled,
                      {
                        borderColor: theme.border,
                        backgroundColor:
                          activeStudyMode === "full"
                            ? theme.primary
                            : "transparent",
                      },
                    ]}
                    onPress={() => selectStudyMode("full")}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.analysisModeSelectorButtonText,
                        {
                          color:
                            activeStudyMode === "full"
                              ? "#fff"
                              : theme.textColor,
                        },
                      ]}
                    >
                      Full
                    </Text>
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    styles.analysisModeRow,
                    styles.analysisModeRowWithTopPadding,
                    { borderBottomColor: theme.border },
                  ]}
                >
                  <View style={styles.analysisModeInfo}>
                    <Text
                      style={[
                        styles.analysisModeTitle,
                        { color: theme.textColor },
                      ]}
                    >
                      English line translations
                    </Text>
                    <Text
                      style={[
                        styles.analysisModeSubtitle,
                        { color: theme.textSecondary },
                      ]}
                    >
                      {hasStoredJpdbApiKey
                        ? "Use JPDB machine translation and show English under each lyric line."
                        : "Requires a saved JPDB API key in Settings"}
                    </Text>
                  </View>
                  <Switch
                    value={lineTranslationsEnabled}
                    onValueChange={(enabled) => {
                      if (!hasStoredJpdbApiKey) {
                        return;
                      }
                      setSongsLyricsLineTranslationsEnabled(enabled);
                    }}
                    trackColor={{ false: "#767577", true: theme.primary }}
                    thumbColor="#f4f3f4"
                    disabled={!hasStoredJpdbApiKey}
                  />
                </View>
              </>
            )}

            {/* Tabs */}
            <View style={[styles.tabsContainer, { borderBottomColor: theme.border }]}>
              {!isAppleMusicFlow && (
                <TouchableOpacity
                  style={[
                    styles.tab,
                    activeOverrideMode === "video" && styles.activeTab,
                    activeOverrideMode === "video" && {
                      borderBottomColor: theme.primary,
                    },
                  ]}
                  onPress={() => setActiveOverrideMode("video")}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name="videocam"
                    size={20}
                    color={
                      activeOverrideMode === "video"
                        ? theme.primary
                        : theme.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.tabText,
                      {
                        color:
                          activeOverrideMode === "video"
                            ? theme.primary
                            : theme.textSecondary,
                      },
                    ]}
                  >
                    Video Source
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeOverrideMode === "lyrics" && styles.activeTab,
                  activeOverrideMode === "lyrics" && { borderBottomColor: theme.primary }
                ]}
                onPress={() => setActiveOverrideMode("lyrics")}
                activeOpacity={0.7}
              >
                <Ionicons
                  name="musical-notes"
                  size={20}
                  color={activeOverrideMode === "lyrics" ? theme.primary : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.tabText,
                    { color: activeOverrideMode === "lyrics" ? theme.primary : theme.textSecondary }
                  ]}
                >
                  Lyrics
                </Text>
              </TouchableOpacity>
            </View>

            {/* Sticky Search Area for Lyrics */}
            {activeOverrideMode === "lyrics" && (
              <View style={[styles.stickySearchArea, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <Text
                  style={[
                    styles.overrideSectionDescription,
                    { color: theme.textSecondary },
                  ]}
                >
                  Search and select different synced lyrics from LRCLIB
                </Text>

                {/* Song Search Input */}
                <View
                  style={[
                    styles.searchContainer,
                    {
                      backgroundColor: theme.backgroundColor,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="musical-note"
                    size={20}
                    color={theme.textSecondary}
                  />
                  <TextInput
                    style={[styles.searchInput, { color: theme.textColor }]}
                    placeholder="Song name (optional)"
                    placeholderTextColor={theme.textSecondary}
                    value={lyricsSearchSong}
                    onChangeText={setLyricsSearchSong}
                    onSubmitEditing={() =>
                      searchLyrics(lyricsSearchSong, lyricsSearchArtist)
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {lyricsSearchSong.length > 0 && (
                    <TouchableOpacity onPress={() => setLyricsSearchSong("")}>
                      <Ionicons
                        name="close-circle"
                        size={20}
                        color={theme.textSecondary}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Artist Search Input */}
                <View
                  style={[
                    styles.searchContainer,
                    {
                      backgroundColor: theme.backgroundColor,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="person"
                    size={20}
                    color={theme.textSecondary}
                  />
                  <TextInput
                    style={[styles.searchInput, { color: theme.textColor }]}
                    placeholder="Artist name (optional)"
                    placeholderTextColor={theme.textSecondary}
                    value={lyricsSearchArtist}
                    onChangeText={setLyricsSearchArtist}
                    onSubmitEditing={() =>
                      searchLyrics(lyricsSearchSong, lyricsSearchArtist)
                    }
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {lyricsSearchArtist.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setLyricsSearchArtist("")}
                    >
                      <Ionicons
                        name="close-circle"
                        size={20}
                        color={theme.textSecondary}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.searchButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={() =>
                    searchLyrics(lyricsSearchSong, lyricsSearchArtist)
                  }
                  activeOpacity={0.7}
                >
                  {isSearchingLyrics ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Ionicons name="search" size={18} color="white" />
                      <Text style={styles.searchButtonText}>
                        Search Lyrics
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {/* Sticky Search Area for Video */}
            {!isAppleMusicFlow && activeOverrideMode === "video" && (
              <View style={[styles.stickySearchArea, { backgroundColor: theme.cardBackground, borderBottomColor: theme.border }]}>
                <Text
                  style={[
                    styles.overrideSectionDescription,
                    { color: theme.textSecondary },
                  ]}
                >
                  Search and select a different YouTube video
                </Text>

                {/* Search Input */}
                <View
                  style={[
                    styles.searchContainer,
                    {
                      backgroundColor: theme.backgroundColor,
                      borderColor: theme.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="search"
                    size={20}
                    color={theme.textSecondary}
                  />
                  <TextInput
                    style={[styles.searchInput, { color: theme.textColor }]}
                    placeholder={`Search for "${songTitle}" videos...`}
                    placeholderTextColor={theme.textSecondary}
                    value={videoSearchQuery}
                    onChangeText={setVideoSearchQuery}
                    onSubmitEditing={() => searchVideos(videoSearchQuery)}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {videoSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setVideoSearchQuery("")}>
                      <Ionicons
                        name="close-circle"
                        size={20}
                        color={theme.textSecondary}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={[
                    styles.searchButton,
                    { backgroundColor: theme.primary },
                  ]}
                  onPress={() =>
                    searchVideos(videoSearchQuery || `${songTitle} ${artist}`)
                  }
                  activeOpacity={0.7}
                >
                  {isSearchingVideos ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Ionicons name="search" size={18} color="white" />
                      <Text style={styles.searchButtonText}>
                        Search Videos
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}

            <ScrollView
              style={styles.overrideModalScroll}
              contentContainerStyle={styles.overrideModalScrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            >
              {activeOverrideMode === "lyrics" && (
                /* Lyrics Section */
                <View style={styles.overrideSection}>
                  {/* Lyrics Search Results */}
                  {lyricsSearchResults.length > 0 && (
                    <View style={styles.videoResultsContainer}>
                      {lyricsSearchResults.map((result) => (
                        <TouchableOpacity
                          key={result.id}
                          style={[
                            styles.lyricsResultItem,
                            {
                              backgroundColor: theme.backgroundColor,
                              borderColor: theme.border,
                            },
                          ]}
                          onPress={() => handleSelectLyrics(result.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.lyricsResultInfo}>
                            <Text
                              style={[
                                styles.lyricsResultTitle,
                                { color: theme.textColor },
                              ]}
                              numberOfLines={1}
                            >
                              {result.trackName}
                            </Text>
                            <Text
                              style={[
                                styles.lyricsResultArtist,
                                { color: theme.textSecondary },
                              ]}
                            >
                              {result.artistName}
                            </Text>
                            {result.plainLyrics && (
                              <View
                                style={[
                                  styles.lyricsPreviewContainer,
                                  {
                                    backgroundColor: "rgba(127, 127, 127, 0.1)",
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.lyricsResultPreview,
                                    { color: theme.textSecondary },
                                  ]}
                                  numberOfLines={2}
                                >
                                  {result.plainLyrics
                                    .split("\n")
                                    .slice(0, 2)
                                    .join("\n")}
                                </Text>
                              </View>
                            )}
                            {result.albumName && (
                              <Text
                                style={[
                                  styles.lyricsResultAlbum,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                {result.albumName}
                              </Text>
                            )}
                            {result.duration > 0 && (
                              <Text
                                style={[
                                  styles.lyricsResultDuration,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                Duration: {Math.floor(result.duration / 60)}:
                                {String(
                                  Math.floor(result.duration) % 60
                                ).padStart(2, "0")}
                              </Text>
                            )}
                          </View>
                          <View
                            style={[
                              styles.syncBadge,
                              { backgroundColor: theme.primary },
                            ]}
                          >
                            <Ionicons name="timer" size={14} color="white" />
                            <Text style={styles.syncBadgeText}>Synced</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {!isAppleMusicFlow && activeOverrideMode === "video" && (
                /* Video Source Section */
                <View style={styles.overrideSection}>
                  {/* Video Search Results */}
                  {videoSearchResults.length > 0 && (
                    <View style={styles.videoResultsContainer}>
                      {videoSearchResults.map((video) => (
                        <TouchableOpacity
                          key={video.videoId}
                          style={[
                            styles.videoResultItem,
                            {
                              backgroundColor: theme.backgroundColor,
                              borderColor: theme.border,
                            },
                          ]}
                          onPress={() => handleSelectVideo(video.videoId)}
                          activeOpacity={0.7}
                        >
                          <Image
                            source={{ uri: video.thumbnail }}
                            style={styles.videoThumbnail}
                          />
                          <View style={styles.videoInfo}>
                            <Text
                              style={[
                                styles.videoTitle,
                                { color: theme.textColor },
                              ]}
                              numberOfLines={2}
                            >
                              {video.title}
                            </Text>
                            <Text
                              style={[
                                styles.videoChannel,
                                { color: theme.textSecondary },
                              ]}
                            >
                              {video.channelTitle}
                            </Text>
                            {video.duration && (
                              <Text
                                style={[
                                  styles.videoDuration,
                                  { color: theme.textSecondary },
                                ]}
                              >
                                Duration: {Math.floor(video.duration / 60)}:
                                {String(video.duration % 60).padStart(2, "0")}
                              </Text>
                            )}
                          </View>
                          <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={theme.textSecondary}
                          />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Tutorial Coach Marks */}
      <CoachMarks
        steps={tutorialSteps}
        visible={showTutorial}
        onComplete={handleTutorialComplete}
        allowSkip={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerAlbumArt: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#333",
  },
  headerInfo: {
    flex: 1,
    justifyContent: "center",
  },
  headerSongTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 2,
  },
  headerArtist: {
    fontSize: 14,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerActionHost: {
    width: 40,
    height: 40,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  lyricsCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  lyricsTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  lyricsTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  lyricsTitleActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 8,
    flexShrink: 1,
  },
  syncToggleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  syncToggleLabel: {
    fontSize: 14,
    marginRight: 8,
  },
  lyricsTimingToggleButton: {
    minHeight: 32,
    maxWidth: 126,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  lyricsTimingToggleButtonText: {
    fontSize: 12,
    fontWeight: "700",
    flexShrink: 1,
  },
  lyricsTimingControl: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    marginBottom: 16,
  },
  lyricsTimingHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  lyricsTimingHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lyricsTimingCloseButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  lyricsTimingTitleGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
  },
  lyricsTimingTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  lyricsTimingValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  lyricsTimingSlider: {
    height: 36,
    marginTop: 4,
  },
  lyricsTimingActions: {
    flexDirection: "row",
    gap: 8,
  },
  lyricsTimingButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 8,
  },
  lyricsTimingButtonDisabled: {
    opacity: 0.42,
  },
  lyricsTimingButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  infoMessage: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  infoMessageContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  infoIcon: {},
  infoMessageText: {
    fontSize: 13,
    flex: 1,
  },
  manualSearchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  manualSearchButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  lyricsContent: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    minHeight: 200,
  },
  skeletonContainer: {
    paddingVertical: 8,
  },
  skeletonGroup: {
    marginBottom: 24,
  },
  skeletonLine: {
    height: 24,
    borderRadius: 4,
    marginBottom: 8,
  },
  lyricsText: {
    fontSize: 18,
    lineHeight: 36,
  },
  staticLyricLine: {
    marginBottom: 10,
  },
  translationStatusRow: {
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  translationStatusText: {
    fontSize: 12,
    lineHeight: 16,
  },
  timedLyricLine: {
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  timedLyricText: {
    fontSize: 20,
    lineHeight: 36,
    opacity: 0.6,
  },
  currentTimedLyric: {
    opacity: 1,
    fontWeight: "700",
  },
  pastTimedLyric: {
    opacity: 0.6,
  },
  lineTranslationText: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
    marginLeft: 2,
  },
  inlineChipWrapper: {
    // Wrapper to keep chip inline in text flow
    display: "inline-flex" as any,
    position: "relative",
  },
  inlineChipWrapperWithBadge: {
    // Extra margin for chips with level badges to prevent overlap
    marginRight: 6,
  },
  inlineChip: {
    position: "relative",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginHorizontal: 2,
    minHeight: 28,
    justifyContent: "center",
    alignItems: "center",
    transform: [{ translateY: 6 }], // Vertically align with text baseline
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.4)",
    shadowColor: "rgba(0,0,0,0.3)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 2,
    overflow: "visible",
  },
  inlineChipText: {
    color: "white",
    fontWeight: "700",
    fontSize: 18,
    includeFontPadding: false as any,
    textAlignVertical: "center" as any,
  },
  levelBadgeChip: {
    position: "absolute",
    top: -5,
    right: -5,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "white",
    shadowColor: "rgba(0,0,0,0.5)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.8,
    shadowRadius: 2,
    elevation: 5,
  },
  levelBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
  },
  jpdbBadgeChip: {
    backgroundColor: "rgba(0, 0, 0, 0.78)",
  },
  inlineUnderlineToken: {
    paddingBottom: 1,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    borderWidth: 1.5,
    borderColor: "transparent",
    borderRadius: 8,
    paddingVertical: 0,
    paddingHorizontal: 2,
    overflow: "hidden",
  },
  underlinedInlineContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "baseline",
  },
  underlinedTokenPressable: {
    borderRadius: 8,
    marginHorizontal: 0.6,
  },
  inlineUnderlineTokenSelected: {},
  inlineUnderlineSeparator: {
    textDecorationLine: "none",
  },
  overrideModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  overrideModalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: "90%",
    paddingBottom: 40,
  },
  overrideModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
  },
  analysisModeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
    borderBottomWidth: 1,
  },
  analysisModeRowWithTopPadding: {
    paddingTop: 12,
  },
  analysisModeSelector: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  analysisModeSelectorButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  analysisModeSelectorButtonDisabled: {
    opacity: 0.6,
  },
  analysisModeSelectorButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  analysisModeInfo: {
    flex: 1,
  },
  analysisModeTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  analysisModeSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  overrideModalTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  tabsContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    gap: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  activeTab: {
    // Border color applied inline
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
  },
  overrideModalScroll: {
    flex: 1,
  },
  overrideModalScrollContent: {
    paddingBottom: 20,
  },
  stickySearchArea: {
    padding: 20,
    borderBottomWidth: 1,
  },
  overrideSection: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128, 128, 128, 0.1)",
  },
  overrideSectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  overrideSectionDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  optionButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  searchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
    marginBottom: 16,
  },
  searchButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  videoResultsContainer: {
    gap: 12,
  },
  videoResultItem: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    alignItems: "center",
  },
  videoThumbnail: {
    width: 120,
    height: 68,
    borderRadius: 8,
    backgroundColor: "#333",
  },
  videoInfo: {
    flex: 1,
    gap: 4,
  },
  videoTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  videoChannel: {
    fontSize: 12,
  },
  videoDuration: {
    fontSize: 11,
  },
  lyricsResultItem: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
    alignItems: "center",
  },
  lyricsResultInfo: {
    flex: 1,
    gap: 4,
  },
  lyricsResultTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  lyricsResultArtist: {
    fontSize: 12,
  },
  lyricsResultPreview: {
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 18,
  },
  lyricsPreviewContainer: {
    marginTop: 6,
    marginBottom: 6,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(127, 127, 127, 0.1)",
  },
  lyricsResultAlbum: {
    fontSize: 11,
    fontStyle: "italic",
  },
  lyricsResultDuration: {
    fontSize: 11,
  },
  syncBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  syncBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "600",
  },
});
