import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useRouter } from "expo-router";
import {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Pressable,
  Platform,
  StatusBar,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  UIManager,
  View,
} from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import ImageColors from "react-native-image-colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import YoutubePlayer from "react-native-youtube-iframe";
import { TimedLyricsLine } from "../services/lyricsService";
import { getAllSubjects } from "../utils/cache";
import { fontStyles } from "../utils/fonts";
import { getStoredJpdbApiKey } from "../utils/jpdbApi";
import { useAuthStore, useSettingsStore } from "../utils/store";
import {
  findVocabularyMatchesWithJpdbFirstPass,
  getHighlightSegments,
  getItemColor,
  isWaniKaniBackedMatch,
  JpdbParsedTokenAnnotation,
  KanjiMatch,
  VocabularyMatch,
} from "../utils/textHighlighting";
import { withAlpha } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";
import { VocabularyTooltip } from "./VocabularyTooltip";

const GRAMMAR_TOOLTIP_ID_MIN = -9100000;
const TOKEN_UNDERLINE_SEPARATOR = "\u200A";

function buildGrammarTooltipItem(
  token: JpdbParsedTokenAnnotation
): VocabularyMatch {
  const meaningText = token.meaning?.trim() || "Grammar point";
  const partsOfSpeechSummary = token.partsOfSpeech.filter(Boolean).join(", ");
  const details = partsOfSpeechSummary
    ? `${meaningText}\nPart of Speech: ${partsOfSpeechSummary}`
    : meaningText;

  return {
    id: -9100000 - token.start * 1000 - token.end,
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

interface MiniPlayerProps {
  visible: boolean;
  isPlaying: boolean;
  albumArt: string;
  songTitle: string;
  artist: string;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSkipBackward: () => void;
  onSkipForward: () => void;
  onStateChange?: (state: string) => void;
  playerRef?: any;
  videoId?: string;
  mediaSource?: "spotify" | "apple";
  trackUrl?: string;
  onExpandChange?: (isExpanded: boolean) => void;
  bottomOffsetTransform?: SharedValue<number>;
  onNavigateToLyrics?: () => void;
  showLyricsButton?: boolean;
  timedLyrics?: TimedLyricsLine[];
  lyricsTimingOffsetMs?: number;
}

export default function MiniPlayer({
  visible,
  isPlaying,
  albumArt,
  songTitle,
  artist,
  currentTime,
  duration,
  onPlayPause,
  onSkipBackward,
  onSkipForward,
  onStateChange,
  playerRef,
  videoId,
  mediaSource = "spotify",
  trackUrl,
  onExpandChange,
  bottomOffsetTransform,
  onNavigateToLyrics,
  showLyricsButton = false,
  timedLyrics = [],
  lyricsTimingOffsetMs = 0,
}: MiniPlayerProps) {
  const fadeAnim = useSharedValue(0);
  const translateY = useSharedValue(100);
  const expandAnim = useSharedValue(0);
  const [shouldRender, setShouldRender] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState("#1a1a1a");
  const [isExpanded, setIsExpanded] = useState(false);
  const [sliderValue, setSliderValue] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekTarget, setSeekTarget] = useState<number | null>(null);

  const { theme } = useTheme();
  const router = useRouter();
  const { userData } = useAuthStore();
  const songsLyricsDefaultStudyMode = useSettingsStore(
    (state) => state.songsLyricsDefaultStudyMode
  );
  const userLevel = userData?.level || 0;
  const [hasStoredJpdbApiKey, setHasStoredJpdbApiKey] = useState(false);
  const activeStudyMode =
    songsLyricsDefaultStudyMode === "full" && !hasStoredJpdbApiKey
      ? "wk"
      : songsLyricsDefaultStudyMode;
  const fullAnalysisEnabled =
    activeStudyMode === "full";
  const wkStudyModeEnabled = activeStudyMode === "wk";

  // Lyrics Highlighting State
  const [vocabularyMatches, setVocabularyMatches] = useState<VocabularyMatch[]>(
    []
  );
  const [kanjiMatches, setKanjiMatches] = useState<KanjiMatch[]>([]);
  const [jpdbParsedTokens, setJpdbParsedTokens] = useState<
    JpdbParsedTokenAnnotation[]
  >([]);
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
  const timedLineOffsets = useMemo(() => {
    let cursor = 0;
    return timedLyrics.map((line) => {
      const start = cursor;
      cursor += (line.words ?? "").length + 1;
      return start;
    });
  }, [timedLyrics]);

  // Tooltip State
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
  const tooltipAnchorRef = useRef<{
    adjustedY: number;
    anchorHeight: number;
    screenHeight: number;
  } | null>(null);
  const tooltipMeasuredHeightRef = useRef(200);
  const [tooltipReady, setTooltipReady] = useState(false);
  const tooltipOpacity = useSharedValue(0);

  const insets = useSafeAreaInsets();
  const isApplePreviewMode = mediaSource === "apple" && !videoId;
  const expandedTopPadding = videoId ? 8 : insets.top + 12;

  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [showLyricsList, setShowLyricsList] = useState(false); // Optimization: Delay rendering of list
  const [screenHeight, setScreenHeight] = useState(
    Dimensions.get("window").height
  );
  const [screenWidth, setScreenWidth] = useState(
    Dimensions.get("window").width
  );

  // Listen to dimension changes (device rotation)
  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setScreenHeight(window.height);
      setScreenWidth(window.width);
    });

    return () => subscription?.remove();
  }, []);

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

  // Calculate responsive video dimensions
  // For iPad and larger screens, use a larger player
  // YouTube player aspect ratio is 16:9
  const isTablet = screenWidth >= 768;
  const videoWidth = isTablet ? Math.min(screenWidth - 32, 700) : screenWidth;
  const videoHeight = (videoWidth * 9) / 16; // Maintain 16:9 aspect ratio

  // Extract dominant color from album art
  useEffect(() => {
    const extractColors = async () => {
      try {
        const result = await ImageColors.getColors(albumArt, {
          fallback: "#1a1a1a",
          cache: true,
          key: albumArt,
        });

        let dominantColor = "#1a1a1a";

        if (result.platform === "ios") {
          dominantColor = result.background || result.primary || "#1a1a1a";
        } else if (result.platform === "android") {
          dominantColor = result.dominant || result.vibrant || "#1a1a1a";
        }

        // Ensure the color is dark enough for white text
        dominantColor = ensureReadableColor(dominantColor);
        setBackgroundColor(dominantColor);
      } catch (error) {
        console.error("Error extracting colors:", error);
        setBackgroundColor("#1a1a1a");
      }
    };

    if (albumArt) {
      extractColors();
    }
  }, [albumArt]);

  // Find vocabulary matches when timed lyrics are available
  useEffect(() => {
    const loadMatches = async () => {
      if (!timedLyrics || timedLyrics.length === 0) {
        setVocabularyMatches([]);
        setKanjiMatches([]);
        setJpdbParsedTokens([]);
        return;
      }

      const fullText = timedLyrics.map((line) => line.words).join("\n");
      try {
        const allSubjects = await getAllSubjects();
        const { vocabularyMatches, kanjiMatches, jpdbParsedTokens } =
          await findVocabularyMatchesWithJpdbFirstPass(fullText, allSubjects);
        setVocabularyMatches(vocabularyMatches);
        setKanjiMatches(kanjiMatches);
        setJpdbParsedTokens(jpdbParsedTokens ?? []);
      } catch (error) {
        console.error("Error finding matches:", error);
      }
    };

    loadMatches();
  }, [timedLyrics]);

  // Function to calculate brightness and darken if needed
  const ensureReadableColor = (hexColor: string): string => {
    // Convert hex to RGB
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // If too bright, darken it
    if (luminance > 0.6) {
      const darkenFactor = 0.4;
      const newR = Math.floor(r * darkenFactor);
      const newG = Math.floor(g * darkenFactor);
      const newB = Math.floor(b * darkenFactor);
      return `#${newR.toString(16).padStart(2, "0")}${newG
        .toString(16)
        .padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
    }

    return hexColor;
  };

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      // Fade in and slide up
      fadeAnim.value = withTiming(1, { duration: 300 });
      translateY.value = withSpring(0, {
        stiffness: 100,
        damping: 18,
        mass: 1,
      });
    } else {
      // Fade out and slide down
      fadeAnim.value = withTiming(0, { duration: 250 });
      translateY.value = withTiming(100, { duration: 250 }, (finished) => {
        if (finished) {
          runOnJS(setShouldRender)(false);
        }
      });
    }
  }, [visible]);

  // Update slider value when currentTime changes (but not while seeking)
  useEffect(() => {
    if (!isSeeking && duration > 0) {
      // If we have a seek target, only update once currentTime catches up
      if (seekTarget !== null) {
        // Check if currentTime is close to the seek target (within 1 second)
        if (Math.abs(currentTime - seekTarget) < 1) {
          setSliderValue(currentTime);
          setSeekTarget(null); // Clear the seek target
        }
        // Otherwise keep the slider at the seek target
      } else {
        setSliderValue(currentTime);
      }
    } else if (!isSeeking && duration <= 0 && seekTarget === null) {
      setSliderValue(0);
    }
  }, [currentTime, duration, isSeeking, seekTarget]);

  // Reset local timing UI when the active video changes.
  useEffect(() => {
    setSliderValue(0);
    setSeekTarget(null);
    setIsSeeking(false);
    setCurrentIndex(-1);
  }, [videoId]);

  // Determine Active Lyrics Index
  useEffect(() => {
    if (!timedLyrics || timedLyrics.length === 0) {
      setCurrentIndex(-1);
      return;
    }

    const adjustedCurrentTime = currentTime - lyricsTimingOffsetMs / 1000;
    const index = timedLyrics.findIndex((line, idx) => {
      const nextLine = timedLyrics[idx + 1];
      const lineTime = line.startTimeMs / 1000;
      const nextLineTime = nextLine ? nextLine.startTimeMs / 1000 : Infinity;
      return (
        adjustedCurrentTime >= lineTime && adjustedCurrentTime < nextLineTime
      );
    });

    // Only update if changed to avoid unnecessary re-renders
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  }, [currentTime, lyricsTimingOffsetMs, timedLyrics, currentIndex]);

  // Scroll to active line
  useEffect(() => {
    // If expanded and we have a valid index, scroll to it
    // We add a small timeout to ensure Layout has happened if just expanded
    if (currentIndex >= 0 && flatListRef.current && isExpanded) {
      // Use a timeout to ensure list is ready
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({
          index: currentIndex,
          animated: true,
          viewPosition: 0.5,
        });
      }, 100);
    }
  }, [currentIndex, isExpanded]);

  const handleScrollToIndexFailed = (info: {
    index: number;
    highestMeasuredFrameIndex: number;
    averageItemLength: number;
  }) => {
    const wait = new Promise((resolve) => setTimeout(resolve, 500));
    wait.then(() => {
      flatListRef.current?.scrollToIndex({
        index: info.index,
        animated: true,
        viewPosition: 0.5,
      });
    });
  };

  const handleExpand = () => {
    setIsExpanded(true);
    onExpandChange?.(true);
    expandAnim.value = withSpring(
      1,
      {
        stiffness: 100,
        damping: 20,
        mass: 1,
      },
      (finished) => {
        if (finished) {
          runOnJS(setShowLyricsList)(true);
        }
      }
    );
  };

  const handleCollapse = (onComplete?: () => void) => {
    // Hide lyrics immediately to save frames during collapse
    setShowLyricsList(false);
    expandAnim.value = withSpring(
      0,
      {
        stiffness: 100,
        damping: 20,
        mass: 1,
      },
      (finished) => {
        if (finished) {
          runOnJS(setIsExpanded)(false);
          runOnJS(onExpandChange!)(false);
          if (onComplete) {
            runOnJS(onComplete)();
          }
        }
      }
    );
  };

  // Pan gesture for swipe down to collapse
  const panGesture = Gesture.Pan()
    .enabled(isExpanded)
    .activeOffsetY(10) // Must move 10px down to activate
    .failOffsetY(-10) // Fail if moving up
    .onUpdate((event) => {
      'worklet';
      // Only allow downward swipes when expanded
      if (event.translationY > 0) {
        const progress = Math.min(event.translationY / 200, 1);
        expandAnim.value = 1 - progress;
      }
    })
    .onEnd((event) => {
      'worklet';
      // If swiped down more than 100px or fast velocity, collapse
      if (event.translationY > 100 || event.velocityY > 500) {
        runOnJS(handleCollapse)();
      } else {
        // Snap back to expanded
        expandAnim.value = withSpring(1);
      }
    });

  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekChange = (value: number) => {
    setSliderValue(value);
  };

  const handleSeekComplete = async (value: number) => {
    if (playerRef?.current) {
      try {
        // Set the seek target and keep slider at this position
        setSeekTarget(value);
        setSliderValue(value);
        setIsSeeking(false);
        await playerRef.current.seekTo(value);
      } catch (error) {
        console.error("Error seeking:", error);
        setIsSeeking(false);
        setSeekTarget(null);
      }
    } else {
      setIsSeeking(false);
      setSeekTarget(null);
    }
  };

  const handleOpenTrackUrl = useCallback(() => {
    if (!trackUrl) return;
    Linking.openURL(trackUrl).catch((error) => {
      console.error("Failed to open track URL:", error);
    });
  }, [trackUrl]);

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds === 0) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Tooltip & Highlighting Handlers
  const updateTooltipVerticalPosition = useCallback((tooltipHeight: number) => {
    const anchor = tooltipAnchorRef.current;
    if (!anchor) {
      return;
    }

    const normalizedHeight = Math.max(120, tooltipHeight);
    const tooltipMargin = 12;
    const { adjustedY, anchorHeight, screenHeight } = anchor;
    const spaceBelow = screenHeight - (adjustedY + anchorHeight);
    const spaceAbove = adjustedY;

    let top: number;
    if (spaceBelow >= normalizedHeight || spaceBelow > spaceAbove) {
      top = adjustedY + anchorHeight + 8;
    } else {
      top = adjustedY - normalizedHeight - 8;
    }

    const minTop = tooltipMargin;
    const maxTop = Math.max(minTop, screenHeight - normalizedHeight - tooltipMargin);
    const clampedTop = Math.max(minTop, Math.min(top, maxTop));

    setTooltipPosition((previousPosition) => {
      if (!previousPosition) {
        return previousPosition;
      }
      if (Math.abs(previousPosition.y - clampedTop) < 1) {
        return previousPosition;
      }
      return {
        ...previousPosition,
        y: clampedTop,
      };
    });
  }, []);

  const handleVocabularyPress = useCallback(
    (
      itemId: number,
      surfaceText: string,
      event: any,
      providedItem?: VocabularyMatch | KanjiMatch,
      tokenKey?: string,
      interactionMode: "press" | "hover" = "press"
    ) => {
      const item =
        providedItem ??
        [...vocabularyMatches, ...kanjiMatches].find((m) => m.id === itemId);
      if (!item) {
        return;
      }

      setTooltipReady(false);
      tooltipOpacity.value = 0;

      const openTooltipAtAnchor = (
        x: number,
        y: number,
        width: number,
        height: number,
        source: "measure" | "page" = "measure"
      ) => {
        // On Android, measureInWindow coordinates don't include the status bar
        // when used with statusBarTranslucent modals.
        const statusBarOffset =
          source === "measure" && Platform.OS === "android"
            ? (StatusBar.currentHeight || 0)
            : 0;
        const adjustedY = y + statusBarOffset;

        const screenWidth = Dimensions.get("window").width;
        const screenHeight = Dimensions.get("window").height;
        const tooltipWidth = 280;
        const tooltipMargin = 12;
        const tooltipEstimatedHeight = tooltipMeasuredHeightRef.current;

        let left = x + width / 2 - tooltipWidth / 2;
        left = Math.max(16, Math.min(left, screenWidth - tooltipWidth - 16));

        tooltipAnchorRef.current = {
          adjustedY,
          anchorHeight: height,
          screenHeight,
        };
        const spaceBelow = screenHeight - (adjustedY + height);
        const spaceAbove = adjustedY;
        let top =
          spaceBelow >= tooltipEstimatedHeight || spaceBelow > spaceAbove
            ? adjustedY + height + 8
            : adjustedY - tooltipEstimatedHeight - 8;
        const minTop = tooltipMargin;
        const maxTop = Math.max(
          minTop,
          screenHeight - tooltipEstimatedHeight - tooltipMargin
        );
        top = Math.max(minTop, Math.min(top, maxTop));

        setTooltipPosition({ x: left, y: top, width });
        setSelectedItem(item);
        setSelectedSurfaceText(surfaceText);
        setSelectedTokenKey(tokenKey ?? null);
        setTooltipInteractionMode(interactionMode);

        requestAnimationFrame(() => {
          setTooltipReady(true);
          tooltipOpacity.value = withTiming(1, {
            duration: interactionMode === "hover" ? 120 : 200,
          });
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
        | {
            measureInWindow?: (
              callback: (x: number, y: number, w: number, h: number) => void
            ) => void;
          }
        | undefined;

      if (
        measurementTarget &&
        typeof measurementTarget.measureInWindow === "function"
      ) {
        measurementTarget.measureInWindow((x, y, width, height) => {
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
    tooltipOpacity.value = withTiming(0, { duration: 150 });
    setTooltipReady(false);
    setSelectedItem(null);
    setSelectedSurfaceText(null);
    setSelectedTokenKey(null);
    setTooltipInteractionMode(null);
    setTooltipPosition(null);
    tooltipAnchorRef.current = null;
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
      handleCollapse();
      router.push({
        pathname: "/subject/[id]",
        params: { id: selectedItem.id.toString(), from: "mini-player" },
      });
    }
  }, [selectedItem, router, handleCloseTooltip]);

  const handleViewSubject = useCallback(
    (subjectId: number) => {
      handleCollapse();
      router.push({
        pathname: "/subject/[id]",
        params: { id: subjectId.toString(), from: "mini-player" },
      });
    },
    [handleCollapse, router]
  );

  const renderUnderlinedAnalyzedLyricLine = (
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
      const lineTokens = jpdbParsedTokens
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
      for (const token of lineTokens) {
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
          const shouldKnow = isWaniKaniBacked
            ? highlight.level <= userLevel
            : true;
          const showLevelBadge = !shouldKnow && isWaniKaniBacked;
          const showJpdbBadge = !isWaniKaniBacked;

          return (
            <TouchableOpacity
              key={`chip-${index}-${highlight.id}`}
              onPress={(e) =>
                handleVocabularyPress(highlight.id, segment.text, e)
              }
              activeOpacity={0.7}
              style={[
                styles.inlineChipWrapper,
                (showLevelBadge || showJpdbBadge) &&
                  styles.inlineChipWrapperWithBadge,
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

  const renderLyricItem = useCallback(
    ({ item, index }: { item: TimedLyricsLine; index: number }) => {
      const isActive = index === currentIndex;
      const isPast = index < currentIndex;

      return (
        <TouchableOpacity
          style={styles.timedLyricLine}
          onPress={
            fullAnalysisEnabled
              ? undefined
              : () => {
                  if (playerRef?.current) {
                    const seekTime = Math.max(
                      0,
                      item.startTimeMs / 1000 + lyricsTimingOffsetMs / 1000
                    );
                    handleSeekComplete(seekTime);
                  }
                }
          }
          disabled={fullAnalysisEnabled}
          activeOpacity={fullAnalysisEnabled ? 1 : 0.7}
        >
          {fullAnalysisEnabled ? (
            renderUnderlinedAnalyzedLyricLine(
              item.words,
              timedLineOffsets[index] ?? 0,
              [
                styles.timedLyricText,
                fontStyles.japaneseText,
                isActive && styles.currentTimedLyric,
                isPast && styles.pastTimedLyric,
              ]
            )
          ) : wkStudyModeEnabled ? (
            <Text
              style={[
                styles.timedLyricText,
                fontStyles.japaneseText,
                isActive && styles.currentTimedLyric,
                isPast && styles.pastTimedLyric,
              ]}
            >
              {highlightTimedLyricLine(item.words, timedLineOffsets[index] ?? 0)}
            </Text>
          ) : (
            <Text
              style={[
                styles.timedLyricText,
                fontStyles.japaneseText,
                isActive && styles.currentTimedLyric,
                isPast && styles.pastTimedLyric,
              ]}
            >
              {item.words}
            </Text>
          )}
        </TouchableOpacity>
      );
    },
    [
      currentIndex,
      playerRef,
      fullAnalysisEnabled,
      wkStudyModeEnabled,
      timedLineOffsets,
      lyricsTimingOffsetMs,
      handleSeekComplete,
      highlightTimedLyricLine,
    ]
  );

  // Calculate progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const animatedContainerStyle = useAnimatedStyle(() => {
    const height = interpolate(expandAnim.value, [0, 1], [77, screenHeight]);
    const bottom = interpolate(expandAnim.value, [0, 1], [30, 0]);
    const margin = interpolate(expandAnim.value, [0, 1], [12, 0]);
    const borderRadius = interpolate(expandAnim.value, [0, 1], [16, 0]);

    const transform = [
      { translateY: translateY.value },
      ...(bottomOffsetTransform
        ? [{ translateY: bottomOffsetTransform.value }]
        : []),
    ];

    return {
      height,
      bottom,
      left: margin,
      right: margin,
      borderRadius,
      opacity: fadeAnim.value,
      transform,
    };
  }, [screenHeight]);

  const animatedVideoContainerStyle = useAnimatedStyle(() => {
    const height = interpolate(expandAnim.value, [0, 1], [0, videoHeight]);
    return {
      marginTop: isExpanded ? insets.top : 0,
      opacity: expandAnim.value,
      height,
    };
  }, [videoHeight, isExpanded, insets.top]);

  const animatedCollapsedStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(expandAnim.value, [0, 0.2], [1, 0]),
      transform: [{ scale: interpolate(expandAnim.value, [0, 1], [1, 0.9]) }],
    };
  });

  const animatedExpandedContentStyle = useAnimatedStyle(() => {
    return {
      opacity: expandAnim.value,
    };
  });

  if (!shouldRender) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.miniPlayer,
        { backgroundColor: backgroundColor },
        animatedContainerStyle,
      ]}
    >
      <Animated.View style={{ height: "100%", width: "100%" }}>
        {/* Video Player - Always rendered but hidden when collapsed */}
        {videoId && (
          <Animated.View
            style={[
              styles.videoContainer,
              isTablet && { alignItems: "center" },
              animatedVideoContainerStyle,
            ]}
          >
            <View style={{ width: videoWidth, height: videoHeight, position: "relative" }}>
              <View pointerEvents={isExpanded ? "none" : "auto"}>
                <YoutubePlayer
                  key={videoId}
                  ref={playerRef}
                  height={videoHeight}
                  videoId={videoId}
                  play={isPlaying}
                  onChangeState={onStateChange}
                  webViewProps={{
                    allowsFullscreenVideo: true,
                  }}
                />
              </View>
              {/* Transparent overlay to prevent YouTube player interaction when expanded */}
              {isExpanded && (
                <GestureDetector gesture={panGesture}>
                  <Animated.View
                    pointerEvents="box-only"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: videoWidth,
                      height: videoHeight,
                      backgroundColor: "rgba(0,0,0,0.01)", // Very subtle tint to ensure touch events work
                    }}
                  />
                </GestureDetector>
              )}
            </View>
          </Animated.View>
        )}

        {/* Collapsed Mini Player Content - Rendered always but faded out */}
        <Animated.View
          style={[
            styles.collapsedContainer,
            { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
            animatedCollapsedStyle,
          ]}
          pointerEvents={isExpanded ? "none" : "auto"}
        >
          <TouchableWithoutFeedback onPress={handleExpand}>
            <View style={styles.miniPlayerContent}>
              <Image source={{ uri: albumArt }} style={styles.miniPlayerArt} />
              <View style={styles.miniPlayerInfo}>
                <Text style={styles.miniPlayerTitle} numberOfLines={1}>
                  {songTitle}
                </Text>
                <Text style={styles.miniPlayerArtist} numberOfLines={1}>
                  {artist}
                </Text>
              </View>
              <View style={styles.miniPlayerControls}>
                <TouchableOpacity
                  style={styles.miniControlButton}
                  onPress={onSkipBackward}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="replay-10" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.miniMainControlButton}
                  onPress={onPlayPause}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={24}
                    color="white"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.miniControlButton}
                  onPress={onSkipForward}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="forward-10" size={24} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>

          {/* Progress Bar at the very bottom */}
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBar, { width: `${progress}%` }]} />
          </View>
        </Animated.View>

        {/* Expanded Content */}
        {isExpanded && (
          <Animated.View
            style={[
              styles.expandedContent,
              { paddingTop: expandedTopPadding },
              // Add absolute positioning to cover collapsed content?
              // The container grows, so standard flex logic usually works.
              // BUT if we have the collapsed content freely absolutely positioned,
              // then expanded content can just take the space naturally?
              // YES, because expandedContent is conditional.
              // When it is present, it will take flex space.
              // BUT wait, videoContainer is also there.
              // If we position collapsed content absolute, it won't affect layout.
              // So expandedContent (and videoContainer) will layout as if collapsed isn't there.
              // Which is correct.
              animatedExpandedContentStyle,
            ]}
          >
            {/* Header Row with Close and Lyrics Buttons - with swipe down gesture */}
            <GestureDetector gesture={panGesture}>
              <Animated.View>
                <View style={styles.expandedHeader}>
                  <View style={styles.headerSpacer} />
                  <TouchableOpacity
                    onPress={() => handleCollapse()}
                    style={styles.collapseButton}
                  >
                    <Ionicons name="chevron-down" size={24} color="white" />
                  </TouchableOpacity>
                  {showLyricsButton && onNavigateToLyrics ? (
                    <TouchableOpacity
                      style={styles.lyricsButton}
                      onPress={() => {
                        handleCollapse();
                        onNavigateToLyrics();
                      }}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="open-outline" size={20} color="white" />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.headerSpacer} />
                  )}
                </View>

                {/* Song Info */}
                <View style={styles.expandedSongInfo}>
                  <Text style={styles.expandedSongTitle} numberOfLines={1}>
                    {songTitle}
                  </Text>
                  <Text style={styles.expandedArtist} numberOfLines={1}>
                    {artist}
                  </Text>
                  {isApplePreviewMode && trackUrl && (
                    <TouchableOpacity
                      style={styles.openAppleButton}
                      onPress={handleOpenTrackUrl}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="logo-apple" size={14} color="white" />
                      <Text style={styles.openAppleButtonText}>
                        Open in Apple Music
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Animated.View>
            </GestureDetector>

            {/* Flexible Space for Lyrics */}
            <View style={{ flex: 1, justifyContent: "center" }}>
              {/* Lyrics Preview with Auto-Scroll */}
              {timedLyrics.length > 0 ? (
                <View style={styles.lyricsPreviewContainer}>
                  <FlatList
                    ref={flatListRef}
                    data={timedLyrics}
                    renderItem={renderLyricItem}
                    keyExtractor={(item, index) => index.toString()}
                    scrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    contentContainerStyle={{
                      paddingVertical: 40,
                      paddingHorizontal: 4,
                    }}
                    onScrollToIndexFailed={handleScrollToIndexFailed}
                    // Helper to ensure we can scroll immediately
                    onLayout={() => {
                      if (currentIndex >= 0) {
                        flatListRef.current?.scrollToIndex({
                          index: currentIndex,
                          animated: false,
                          viewPosition: 0.5,
                        });
                      }
                    }}
                  />
                </View>
              ) : (
                <View style={{ flex: 1 }} />
              )}
            </View>

            {/* Bottom Controls Section */}
            <View style={{ paddingBottom: insets.bottom + 20 }}>
              {/* Progress Slider */}
              <View style={styles.sliderContainer}>
                <Text style={styles.timeText}>{formatTime(sliderValue)}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={duration || 100}
                  value={sliderValue}
                  onSlidingStart={handleSeekStart}
                  onValueChange={handleSeekChange}
                  onSlidingComplete={handleSeekComplete}
                  minimumTrackTintColor="rgba(255, 255, 255, 0.9)"
                  maximumTrackTintColor="rgba(255, 255, 255, 0.3)"
                  thumbTintColor="white"
                />
                <Text style={styles.timeText}>{formatTime(duration)}</Text>
              </View>

              {/* Controls */}
              <View style={styles.expandedControls}>
                <TouchableOpacity
                  style={styles.expandedControlButton}
                  onPress={onSkipBackward}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="replay-10" size={32} color="white" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.expandedMainControlButton}
                  onPress={onPlayPause}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={36}
                    color="white"
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.expandedControlButton}
                  onPress={onSkipForward}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="forward-10" size={32} color="white" />
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        )}
      </Animated.View>
      {tooltipReady && (
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
          onTooltipLayout={(height) => {
            tooltipMeasuredHeightRef.current = height;
            updateTooltipVerticalPosition(height);
          }}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  miniPlayer: {
    position: "absolute",
    // position, bottom, left, right are now animated inline
    shadowColor: "#000",
    // borderRadius is now animated inline
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 16,
    overflow: "hidden",
  },
  collapsedContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  miniPlayerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  miniPlayerArt: {
    width: 50,
    height: 50,
    borderRadius: 8,
    backgroundColor: "#333",
  },
  miniPlayerInfo: {
    flex: 1,
    justifyContent: "center",
    marginRight: 8,
  },
  miniPlayerTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
    color: "white",
  },
  miniPlayerArtist: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
  },
  miniPlayerControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  miniControlButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  miniMainControlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "rgba(0,0,0,0.2)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  progressBarContainer: {
    height: 3,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    width: "100%",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.9)",
  },
  // Video Container
  videoContainer: {
    width: "100%",
    overflow: "hidden",
    backgroundColor: "#000",
  },
  // Expanded Content Styles
  expandedContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  expandedHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  headerSpacer: {
    width: 40,
  },
  collapseButton: {
    width: 40,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  lyricsButton: {
    width: 40,
    height: 30,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 8,
  },
  lyricsPreviewContainer: {
    height: "100%", // Fill available space
    width: "100%",
    paddingHorizontal: 0, // Removed padding
  },
  lyricsLinePrimary: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    marginVertical: 4,
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  lyricsLineSecondary: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.4)",
    textAlign: "center",
    marginVertical: 2,
  },
  expandedSongInfo: {
    marginBottom: 16,
    alignItems: "center",
  },
  expandedSongTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "white",
    textAlign: "center",
    marginBottom: 4,
  },
  expandedArtist: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    textAlign: "center",
  },
  openAppleButton: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  openAppleButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "600",
  },
  sliderContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 8,
    paddingHorizontal: 4,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  timeText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "500",
    minWidth: 40,
  },
  expandedControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
  },
  expandedControlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  expandedMainControlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  // Tooltip & Chip Styles
  inlineChipWrapper: {
    // Wrapper to keep chip inline in text flow
  },
  inlineChipWrapperWithBadge: {
    marginRight: 6,
  },
  inlineChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginHorizontal: 2,
    minHeight: 28,
    justifyContent: "center",
    alignItems: "center",
    transform: [{ translateY: 6 }],
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.4)",
    shadowColor: "rgba(0,0,0,0.3)",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 2,
    flexDirection: "row",
  },
  inlineChipText: {
    color: "white",
    fontWeight: "700",
    fontSize: 18,
    textAlignVertical: "center",
  },
  levelBadgeChip: {
    marginLeft: 4,
    top: -5,
    right: -5,
    position: "absolute",
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "white",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  jpdbBadgeChip: {
    backgroundColor: "rgba(15, 23, 42, 0.92)",
  },
  levelBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
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
    opacity: 0,
  },
  // Lyrics Styles
  timedLyricLine: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignItems: "flex-start", // Left align
  },
  timedLyricText: {
    fontSize: 20,
    lineHeight: 36,
    opacity: 0.6,
    color: "white",
    textAlign: "left", // Left align
  },
  currentTimedLyric: {
    opacity: 1,
    fontWeight: "700",
    textShadowColor: "rgba(0, 0, 0, 0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  pastTimedLyric: {
    opacity: 0.6,
  },
});
