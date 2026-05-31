import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Clipboard,
  Dimensions,
  Image,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassButton } from "../../src/components/GlassButton";
import { VocabularyTooltip } from "../../src/components/VocabularyTooltip";
import {
  fetchUrlReaderContent,
  type UrlContentBlock,
  type UrlReaderTweetData,
} from "../../src/services/urlContentService";
import { getAllSubjects } from "../../src/utils/cache";
import { fontStyles } from "../../src/utils/fonts";
import { getStoredJpdbApiKey } from "../../src/utils/jpdbApi";
import { useAuthStore } from "../../src/utils/store";
import {
  findVocabularyMatchesWithJpdbFirstPass as findMatches,
  getHighlightSegments,
  getItemColor,
  isWaniKaniBackedMatch,
  type JpdbParsedTokenAnnotation,
  type KanjiMatch,
  type VocabularyMatch,
} from "../../src/utils/textHighlighting";
import { withAlpha } from "../../src/utils/subjectColors";
import { useTheme } from "../../src/utils/theme";
import { useSharedValue, withTiming } from "react-native-reanimated";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const SwiftUI = Platform.OS === "ios" ? require("@expo/ui/swift-ui") : null;

type StudyMode = "none" | "wk" | "full";

type TooltipAnchor = {
  adjustedY: number;
  anchorHeight: number;
  screenHeight: number;
};

const TOOLTIP_WIDTH = 280;
const TOOLTIP_MARGIN = 12;
const GRAMMAR_TOOLTIP_ID_MIN = -9000000;
const TOKEN_UNDERLINE_SEPARATOR = "\u200A";
const MONTH_TO_INDEX: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};
const JPDB_PARTS_OF_SPEECH_LABELS: Record<string, string> = {
  adj: "Adjective",
  "adj-f": "Noun/Verbal Adjectival Prefix",
  "adj-i": "I-adjective",
  "adj-ix": "Yoi/Ii-type I-adjective",
  "adj-kari": "Kari Adjective (Classical)",
  "adj-ku": "Ku Adjective (Classical)",
  "adj-na": "Na-adjective",
  "adj-nari": "Nari Adjective (Classical)",
  "adj-no": "No-adjective",
  "adj-pn": "Prenominal Adjective",
  "adj-shiku": "Shiku Adjective (Classical)",
  "adj-t": "Taru Adjective",
  adv: "Adverb",
  "adv-to": "Adverb (to)",
  aux: "Auxiliary",
  "aux-adj": "Auxiliary Adjective",
  "aux-v": "Auxiliary Verb",
  conj: "Conjunction",
  cop: "Copula",
  ctr: "Counter",
  exp: "Expression",
  int: "Interjection",
  n: "Noun",
  "n-adv": "Adverbial Noun",
  "n-pr": "Proper Noun",
  "n-pref": "Noun Prefix",
  "n-suf": "Noun Suffix",
  "n-t": "Temporal Noun",
  num: "Number",
  pn: "Pronoun",
  pref: "Prefix",
  prt: "Particle",
  suf: "Suffix",
  unc: "Unclassified",
  v1: "Ichidan Verb",
  "v1-s": "Ichidan Verb (Special)",
  v2: "Nidan Verb",
  v4: "Yodan Verb",
  v5: "Godan Verb",
  "v5aru": "Godan Verb (-aru Special Class)",
  "v5b": "Godan Verb (bu-ending)",
  "v5g": "Godan Verb (gu-ending)",
  "v5k": "Godan Verb (ku-ending)",
  "v5k-s": "Godan Verb (iku/yuku Special Class)",
  "v5m": "Godan Verb (mu-ending)",
  "v5n": "Godan Verb (nu-ending)",
  "v5r": "Godan Verb (ru-ending)",
  "v5r-i": "Godan Verb (ru Irregular)",
  "v5s": "Godan Verb (su-ending)",
  "v5t": "Godan Verb (tsu-ending)",
  "v5u": "Godan Verb (u-ending)",
  "v5u-s": "Godan Verb (u Special Class)",
  "v5uru": "Godan Verb (Uru Old Class)",
  vi: "Intransitive Verb",
  vk: "Kuru Verb",
  vn: "Irregular Nu Verb",
  vr: "Irregular Ru Verb",
  vs: "Suru Verb",
  "vs-c": "Suru Verb (Included)",
  "vs-i": "Suru Verb (Independent)",
  "vs-s": "Suru Verb (Special Class)",
  vt: "Transitive Verb",
};

function isTruthyEnvFlag(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return (
    normalized === "1" ||
    normalized === "true" ||
    normalized === "yes" ||
    normalized === "on"
  );
}

function shouldLogUrlReaderDebug(): boolean {
  const envFlag = process.env.EXPO_PUBLIC_LOG_URL_READER;
  if (isTruthyEnvFlag(envFlag)) {
    return true;
  }

  return typeof __DEV__ !== "undefined" && __DEV__;
}

function getNowMs(): number {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function roundDuration(durationMs: number): number {
  return Math.round(durationMs * 10) / 10;
}

function logUrlReaderStage(
  stage: string,
  startMs: number,
  extra?: Record<string, unknown>
): void {
  if (!shouldLogUrlReaderDebug()) {
    return;
  }

  console.log(`[URL Reader Screen] ${stage}`, {
    durationMs: roundDuration(getNowMs() - startMs),
    ...(extra ?? {}),
  });
}

function formatReadableTimestamp(rawTimestamp: string | null): string | null {
  if (!rawTimestamp) {
    return null;
  }

  const parsedDate = parseTimestampToDate(rawTimestamp);
  if (!parsedDate) {
    return rawTimestamp
      .replace(/\s+[+-]\d{4}\b/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(parsedDate);
  } catch {
    return parsedDate.toLocaleString();
  }
}

function parseTimestampToDate(rawTimestamp: string): Date | null {
  const trimmedTimestamp = rawTimestamp.trim();
  if (!trimmedTimestamp) {
    return null;
  }

  const directDate = new Date(trimmedTimestamp);
  if (!Number.isNaN(directDate.getTime())) {
    return directDate;
  }

  // Handles Twitter-like timestamps: Tue Mar 31 12:25:13 +0000 2026
  const twitterStyleMatch = trimmedTimestamp.match(
    /^(?:[A-Za-z]{3}\s+)([A-Za-z]{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{4})\s+(\d{4})$/
  );
  if (twitterStyleMatch) {
    const [, monthToken, dayToken, timeToken, offsetToken, yearToken] =
      twitterStyleMatch;
    const month = MONTH_TO_INDEX[monthToken.toLowerCase()];
    if (month) {
      const day = dayToken.padStart(2, "0");
      const isoDate = `${yearToken}-${month}-${day}T${timeToken}${formatOffsetForIso(offsetToken)}`;
      const parsedIsoDate = new Date(isoDate);
      if (!Number.isNaN(parsedIsoDate.getTime())) {
        return parsedIsoDate;
      }
    }
  }

  // Handles fallback "Published Time" values like: Wed, 01 Apr 2026 11:51:58 GMT
  const publishedTimeMatch = trimmedTimestamp.match(
    /^(?:[A-Za-z]{3},\s+)?(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(\d{2}:\d{2}:\d{2})\s+(GMT|UTC|[+-]\d{4})$/i
  );
  if (publishedTimeMatch) {
    const [, dayToken, monthToken, yearToken, timeToken, timezoneToken] =
      publishedTimeMatch;
    const month = MONTH_TO_INDEX[monthToken.toLowerCase()];
    if (month) {
      const day = dayToken.padStart(2, "0");
      const normalizedOffset =
        /^(gmt|utc)$/i.test(timezoneToken)
          ? "+00:00"
          : formatOffsetForIso(timezoneToken);
      const isoDate = `${yearToken}-${month}-${day}T${timeToken}${normalizedOffset}`;
      const parsedIsoDate = new Date(isoDate);
      if (!Number.isNaN(parsedIsoDate.getTime())) {
        return parsedIsoDate;
      }
    }
  }

  return null;
}

function formatOffsetForIso(offsetToken: string): string {
  if (!/^[+-]\d{4}$/.test(offsetToken)) {
    return offsetToken;
  }

  return `${offsetToken.slice(0, 3)}:${offsetToken.slice(3)}`;
}

function toTitleCase(value: string): string {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatJpdbPartOfSpeechCode(code: string): string {
  const normalizedCode = code.trim().toLowerCase();
  if (!normalizedCode) {
    return "";
  }

  const directLabel = JPDB_PARTS_OF_SPEECH_LABELS[normalizedCode];
  if (directLabel) {
    return `${directLabel} (${normalizedCode})`;
  }

  if (normalizedCode.startsWith("v1")) {
    return `Ichidan Verb (${normalizedCode})`;
  }
  if (normalizedCode.startsWith("v5")) {
    return `Godan Verb (${normalizedCode})`;
  }
  if (normalizedCode.startsWith("v2")) {
    return `Nidan Verb (${normalizedCode})`;
  }
  if (normalizedCode.startsWith("v4")) {
    return `Yodan Verb (${normalizedCode})`;
  }
  if (normalizedCode.startsWith("vs")) {
    return `Suru Verb (${normalizedCode})`;
  }
  if (normalizedCode.startsWith("adj")) {
    return `Adjective (${normalizedCode})`;
  }
  if (normalizedCode.startsWith("n-")) {
    return `Noun (${normalizedCode})`;
  }

  return `${toTitleCase(normalizedCode)} (${normalizedCode})`;
}

function buildReadableJpdbPartOfSpeechSummary(codes: string[]): string {
  const seen = new Set<string>();
  const readableCodes = codes
    .map((code) => formatJpdbPartOfSpeechCode(code))
    .filter(Boolean)
    .filter((label) => {
      if (seen.has(label)) {
        return false;
      }
      seen.add(label);
      return true;
    });

  return readableCodes.join(", ");
}

function buildGrammarTooltipItem(token: JpdbParsedTokenAnnotation): VocabularyMatch {
  const posSummary = buildReadableJpdbPartOfSpeechSummary(token.partsOfSpeech);
  const meaningText = token.meaning?.trim() || "Grammar point";
  const details = posSummary
    ? `${meaningText}\nPart of Speech: ${posSummary}`
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

export default function UrlReaderScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { userData } = useAuthStore();
  const localParams = useLocalSearchParams<{ url?: string | string[] }>();
  const insets = useSafeAreaInsets();
  const userLevel = userData?.level || 0;

  const [urlInput, setUrlInput] = useState("");
  const [articleTitle, setArticleTitle] = useState("");
  const [contentKind, setContentKind] = useState<"tweet" | "article" | null>(null);
  const [blocks, setBlocks] = useState<UrlContentBlock[]>([]);
  const [tweetData, setTweetData] = useState<UrlReaderTweetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [studyMode, setStudyMode] = useState<StudyMode>("wk");
  const [showStudyModeMenu, setShowStudyModeMenu] = useState(false);
  const [hasStoredJpdbApiKey, setHasStoredJpdbApiKey] = useState(false);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);

  const [vocabularyMatches, setVocabularyMatches] = useState<VocabularyMatch[]>([]);
  const [kanjiMatches, setKanjiMatches] = useState<KanjiMatch[]>([]);
  const [jpdbParsedTokens, setJpdbParsedTokens] = useState<JpdbParsedTokenAnnotation[]>([]);

  const [selectedItem, setSelectedItem] = useState<(VocabularyMatch | KanjiMatch) | null>(null);
  const [selectedSurfaceText, setSelectedSurfaceText] = useState<string | null>(null);
  const [selectedTokenKey, setSelectedTokenKey] = useState<string | null>(null);
  const [tooltipInteractionMode, setTooltipInteractionMode] = useState<
    "press" | "hover" | null
  >(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const [tooltipReady, setTooltipReady] = useState(false);
  const [activeTweetMediaIndex, setActiveTweetMediaIndex] = useState<number | null>(null);

  const tooltipOpacity = useSharedValue(0);
  const tooltipAnchorRef = useRef<TooltipAnchor | null>(null);
  const tooltipMeasuredHeightRef = useRef(200);
  const tooltipDismissedAtRef = useRef(0);
  const autoLoadedSharedUrlRef = useRef<string | null>(null);
  const sharedUrlParam = useMemo(() => {
    const rawParam = localParams.url;
    if (Array.isArray(rawParam)) {
      return typeof rawParam[0] === "string" ? rawParam[0] : "";
    }
    return typeof rawParam === "string" ? rawParam : "";
  }, [localParams.url]);
  const refreshJpdbKeyState = useCallback(async () => {
    try {
      const storedKey = await getStoredJpdbApiKey();
      setHasStoredJpdbApiKey(Boolean(storedKey));
    } catch {
      setHasStoredJpdbApiKey(false);
    }
  }, []);

  useEffect(() => {
    void refreshJpdbKeyState();
  }, [refreshJpdbKeyState]);

  useEffect(() => {
    if (studyMode === "full" && !hasStoredJpdbApiKey) {
      setStudyMode("wk");
    }
  }, [studyMode, hasStoredJpdbApiKey]);

  useEffect(() => {
    let didCancel = false;
    const preloadStartMs = getNowMs();

    const preloadSubjects = async () => {
      try {
        const subjects = await getAllSubjects();
        if (!didCancel) {
          const normalizedSubjects = Array.isArray(subjects) ? subjects : [];
          setAllSubjects(normalizedSubjects);
          logUrlReaderStage("subjects preloaded", preloadStartMs, {
            subjectCount: normalizedSubjects.length,
          });
        }
      } catch (loadError) {
        console.error("Failed to preload subjects for URL reader:", loadError);
        logUrlReaderStage("subjects preload failed", preloadStartMs, {
          error:
            loadError instanceof Error
              ? { name: loadError.name, message: loadError.message }
              : String(loadError),
        });
      }
    };

    void preloadSubjects();

    return () => {
      didCancel = true;
    };
  }, []);

  const combinedText = useMemo(
    () => blocks.map((block) => block.content).join("\n"),
    [blocks]
  );
  const blocksWithOffsets = useMemo(() => {
    let cursor = 0;
    return blocks.map((block, index) => {
      const start = cursor;
      const end = start + block.content.length;
      cursor = end + (index < blocks.length - 1 ? 1 : 0);
      return {
        ...block,
        start,
        end,
      };
    });
  }, [blocks]);
  const vocabularyMatchesById = useMemo(
    () => new Map(vocabularyMatches.map((match) => [match.id, match])),
    [vocabularyMatches]
  );
  const allMatches = useMemo(
    () => [...vocabularyMatches, ...kanjiMatches],
    [vocabularyMatches, kanjiMatches]
  );
  const grammarUnderlineColor = theme.isDark ? "#fbbf24" : "#b45309";
  const verbUnderlineColor = theme.isDark ? "#34d399" : "#0f766e";
  const vocabUnderlineColor = theme.isDark ? "#60a5fa" : "#1d4ed8";
  const hoverPreviewEnabled =
    Platform.OS === "ios" ||
    Platform.OS === "web" ||
    (Platform.OS as string) === "macos";
  const fullModeEnabled = studyMode === "full" && hasStoredJpdbApiKey;
  const wkModeEnabled = studyMode === "wk";
  const headerHeight = insets.top + 56;
  const headerIconColor = theme.headerText;
  const formattedTweetTimestamp = useMemo(
    () => formatReadableTimestamp(tweetData?.createdAt ?? null),
    [tweetData?.createdAt]
  );
  const activeTweetMedia = useMemo(() => {
    if (typeof activeTweetMediaIndex !== "number") {
      return null;
    }

    return tweetData?.media?.[activeTweetMediaIndex] ?? null;
  }, [activeTweetMediaIndex, tweetData?.media]);
  const activeMediaVideoSource = useMemo(() => {
    if (!activeTweetMedia) {
      return null;
    }

    if (
      (activeTweetMedia.type === "video" || activeTweetMedia.type === "gif") &&
      activeTweetMedia.url
    ) {
      return activeTweetMedia.url;
    }

    return null;
  }, [activeTweetMedia]);
  const mediaModalVideoPlayer = useVideoPlayer(activeMediaVideoSource, (videoPlayer) => {
    videoPlayer.loop = false;
  });

  useEffect(() => {
    if (studyMode === "none" || !combinedText || allSubjects.length === 0) {
      setVocabularyMatches([]);
      setKanjiMatches([]);
      setJpdbParsedTokens([]);
      setIsAnalyzing(false);
      return;
    }

    let didCancel = false;
    const parseStartMs = getNowMs();

    const runParser = async () => {
      setIsAnalyzing(true);
      if (shouldLogUrlReaderDebug()) {
        console.log("[URL Reader Screen] parser started", {
          textLength: combinedText.length,
          subjectCount: allSubjects.length,
        });
      }
      try {
        const {
          vocabularyMatches: parsedVocabulary,
          kanjiMatches: parsedKanji,
          jpdbParsedTokens: parsedJpdbTokens,
        } = await findMatches(combinedText, allSubjects);
        if (!didCancel) {
          setVocabularyMatches(parsedVocabulary);
          setKanjiMatches(parsedKanji);
          setJpdbParsedTokens(Array.isArray(parsedJpdbTokens) ? parsedJpdbTokens : []);
          logUrlReaderStage("parser completed", parseStartMs, {
            vocabularyMatchCount: parsedVocabulary.length,
            kanjiMatchCount: parsedKanji.length,
            jpdbTokenCount: Array.isArray(parsedJpdbTokens) ? parsedJpdbTokens.length : 0,
          });
        }
      } catch (parseError) {
        console.error("Failed to parse URL reader text:", parseError);
        if (!didCancel) {
          setVocabularyMatches([]);
          setKanjiMatches([]);
          setJpdbParsedTokens([]);
          logUrlReaderStage("parser failed", parseStartMs, {
            error:
              parseError instanceof Error
                ? { name: parseError.name, message: parseError.message }
                : String(parseError),
          });
        }
      } finally {
        if (!didCancel) {
          setIsAnalyzing(false);
        }
      }
    };

    void runParser();

    return () => {
      didCancel = true;
    };
  }, [combinedText, allSubjects, studyMode]);

  useEffect(() => {
    if (!activeMediaVideoSource) {
      mediaModalVideoPlayer.pause();
      return;
    }

    mediaModalVideoPlayer.loop = activeTweetMedia?.type === "gif";
    mediaModalVideoPlayer.play();
  }, [activeMediaVideoSource, activeTweetMedia?.type, mediaModalVideoPlayer]);

  const handleTooltipLayout = useCallback((height: number) => {
    const anchor = tooltipAnchorRef.current;
    if (!anchor) {
      return;
    }

    const measuredHeight = Math.max(120, height);
    tooltipMeasuredHeightRef.current = measuredHeight;
    const { adjustedY, anchorHeight, screenHeight } = anchor;
    const spaceBelow = screenHeight - (adjustedY + anchorHeight);
    const spaceAbove = adjustedY;

    let top: number;
    if (spaceBelow >= measuredHeight || spaceBelow > spaceAbove) {
      top = adjustedY + anchorHeight + 8;
    } else {
      top = adjustedY - measuredHeight - 8;
    }

    const minTop = TOOLTIP_MARGIN;
    const maxTop = Math.max(minTop, screenHeight - measuredHeight - TOOLTIP_MARGIN);
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

  const handleCloseTooltip = useCallback(() => {
    tooltipDismissedAtRef.current = Date.now();
    tooltipOpacity.value = 0;
    setTooltipReady(false);
    setSelectedItem(null);
    setSelectedSurfaceText(null);
    setSelectedTokenKey(null);
    setTooltipInteractionMode(null);
    setTooltipPosition(null);
    tooltipAnchorRef.current = null;
  }, [tooltipOpacity]);
  const handleCloseMediaModal = useCallback(() => {
    mediaModalVideoPlayer.pause();
    setActiveTweetMediaIndex(null);
  }, [mediaModalVideoPlayer]);

  const handleViewDetails = useCallback(() => {
    if (!selectedItem || !isWaniKaniBackedMatch(selectedItem)) {
      return;
    }

    handleCloseTooltip();
    router.push(`/subject/${selectedItem.id}`);
  }, [handleCloseTooltip, router, selectedItem]);

  const handleViewSubject = useCallback(
    (subjectId: number) => {
      handleCloseTooltip();
      router.push(`/subject/${subjectId}`);
    },
    [handleCloseTooltip, router]
  );

  const handleVocabularyPress = useCallback(
    (
      itemId: number,
      surfaceText: string,
      event: any,
      itemOverride?: VocabularyMatch | KanjiMatch,
      tokenKey?: string,
      interactionMode: "press" | "hover" = "press"
    ) => {
      // Guard against immediate tap-through reopen when dismissing by tapping outside.
      if (Date.now() - tooltipDismissedAtRef.current < 220) {
        return;
      }

      const item =
        itemOverride ??
        [...vocabularyMatches, ...kanjiMatches].find(
          (candidate) => candidate.id === itemId
        );
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
        const statusBarOffset =
          source === "measure" && Platform.OS === "android"
            ? (NativeStatusBar.currentHeight || 0)
            : 0;
        const adjustedY = y + statusBarOffset;
        const screenWidth = Dimensions.get("window").width;
        const screenHeight = Dimensions.get("window").height;
        const tooltipEstimatedHeight = tooltipMeasuredHeightRef.current;

        let left = x + width / 2 - TOOLTIP_WIDTH / 2;
        left = Math.max(16, Math.min(left, screenWidth - TOOLTIP_WIDTH - 16));

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
        const minTop = TOOLTIP_MARGIN;
        const maxTop = Math.max(
          minTop,
          screenHeight - tooltipEstimatedHeight - TOOLTIP_MARGIN
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
            duration: interactionMode === "hover" ? 120 : 180,
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
        | { measureInWindow?: (callback: (x: number, y: number, w: number, h: number) => void) => void }
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
        const tapWidth = 24;
        const tapHeight = 24;
        openTooltipAtAnchor(
          pageX - tapWidth / 2,
          pageY - tapHeight / 2,
          tapWidth,
          tapHeight,
          "page"
        );
        return;
      }

      // Last resort fallback: center-ish placement so we never anchor to (0,0).
      const screenWidth = Dimensions.get("window").width;
      const screenHeight = Dimensions.get("window").height;
      openTooltipAtAnchor(screenWidth / 2 - 20, screenHeight / 2 - 20, 40, 24, "page");
    },
    [kanjiMatches, tooltipOpacity, vocabularyMatches]
  );

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

  const handleBackNavigation = useCallback(() => {
    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/news");
  }, [router]);

  const handleSelectStudyMode = useCallback(
    (mode: StudyMode) => {
      if (mode === "full" && !hasStoredJpdbApiKey) {
        setShowStudyModeMenu(false);
        router.push({
          pathname: "/settings",
          params: { scrollTo: "jpdbApiKey" },
        });
        return;
      }

      setStudyMode(mode);
      setShowStudyModeMenu(false);
    },
    [hasStoredJpdbApiKey, router]
  );

  const handleLoadUrl = useCallback(async (urlOverride?: string) => {
    const trimmedUrl = (urlOverride ?? urlInput).trim();
    if (!trimmedUrl) {
      setError("Enter a URL to fetch.");
      return;
    }

    const loadStartMs = getNowMs();
    if (shouldLogUrlReaderDebug()) {
      console.log("[URL Reader Screen] load started", {
        url: trimmedUrl,
      });
    }

    Keyboard.dismiss();
    handleCloseTooltip();
    setIsLoading(true);
    setError(null);
    setBlocks([]);
    setArticleTitle("");
    setContentKind(null);
    setTweetData(null);
    setActiveTweetMediaIndex(null);
    setVocabularyMatches([]);
    setKanjiMatches([]);
    setJpdbParsedTokens([]);

    try {
      const result = await fetchUrlReaderContent(trimmedUrl);
      setArticleTitle(result.title);
      setContentKind(result.kind);
      setTweetData(result.tweet);
      setBlocks(result.blocks);
      setUrlInput(result.requestedUrl);
      logUrlReaderStage("load completed", loadStartMs, {
        source: result.source,
        kind: result.kind,
        blockCount: result.blocks.length,
        mediaCount: result.tweet?.media.length ?? 0,
      });
    } catch (loadError) {
      console.error("Failed to load URL content:", loadError);
      const errorMessage =
        loadError instanceof Error
          ? loadError.message
          : "Could not fetch content from this URL.";
      setError(errorMessage);
      logUrlReaderStage("load failed", loadStartMs, {
        error:
          loadError instanceof Error
            ? { name: loadError.name, message: loadError.message }
            : String(loadError),
      });
    } finally {
      setIsLoading(false);
    }
  }, [handleCloseTooltip, urlInput]);

  const handlePasteAndLoad = useCallback(async () => {
    try {
      const clipboardApi = Clipboard as unknown as {
        getString?: () => string | Promise<string>;
      };
      const clipboardValue = clipboardApi?.getString
        ? await Promise.resolve(clipboardApi.getString())
        : typeof navigator !== "undefined" &&
            navigator?.clipboard &&
            typeof navigator.clipboard.readText === "function"
          ? await navigator.clipboard.readText()
          : "";
      const trimmedClipboardValue =
        typeof clipboardValue === "string" ? clipboardValue.trim() : "";

      if (!trimmedClipboardValue) {
        setError("Clipboard is empty.");
        return;
      }

      setUrlInput(trimmedClipboardValue);
      await handleLoadUrl(trimmedClipboardValue);
    } catch (clipboardError) {
      console.error("Failed to read clipboard:", clipboardError);
      setError("Could not read clipboard.");
    }
  }, [handleLoadUrl]);

  useEffect(() => {
    const trimmedSharedUrl = sharedUrlParam.trim();
    if (!trimmedSharedUrl) {
      return;
    }

    if (autoLoadedSharedUrlRef.current === trimmedSharedUrl) {
      return;
    }

    autoLoadedSharedUrlRef.current = trimmedSharedUrl;
    setUrlInput(trimmedSharedUrl);
    void handleLoadUrl(trimmedSharedUrl);
  }, [handleLoadUrl, sharedUrlParam]);

  const renderPlainText = useCallback(
    (text: string): ReactElement => (
      <Text style={[styles.parsedText, { color: theme.textColor }, fontStyles.japaneseText]}>
        {text}
      </Text>
    ),
    [theme.textColor]
  );

  const renderWkHighlightedText = useCallback(
    (text: string, blockStart: number): ReactElement => {
      if (!text) {
        return renderPlainText(text);
      }

      const segments = getHighlightSegments(text, allMatches);

      return (
        <View style={styles.underlinedInlineContainer}>
          {segments.map((segment, index) => {
            const baseTextStyle = [
              styles.parsedText,
              { color: theme.textColor },
              fontStyles.japaneseText,
            ];
            if (!segment.match) {
              return (
                <Text key={`wk-plain-${index}`} style={baseTextStyle}>
                  {segment.text}
                </Text>
              );
            }

            const highlight = segment.match;
            const color = getItemColor(highlight.type);
            const isWaniKaniBacked = isWaniKaniBackedMatch(highlight);
            const shouldKnow = isWaniKaniBacked ? highlight.level <= userLevel : true;
            const showLevelBadge = !shouldKnow && isWaniKaniBacked;
            const showJpdbBadge = !isWaniKaniBacked;
            const tokenKey = `${blockStart}-${index}-${highlight.id}-${segment.text}`;

            return (
              <Pressable
                key={`wk-token-${index}-${highlight.id}`}
                style={[
                  styles.inlineChipWrapper,
                  (showLevelBadge || showJpdbBadge) && styles.inlineChipWrapperWithBadge,
                ]}
                onPress={(event) =>
                  handleVocabularyPress(
                    highlight.id,
                    segment.text,
                    event,
                    highlight,
                    tokenKey,
                    "press"
                  )
                }
                onHoverIn={
                  hoverPreviewEnabled
                    ? (event) =>
                        handleVocabularyPress(
                          highlight.id,
                          segment.text,
                          event,
                          highlight,
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
                  {showLevelBadge ? (
                    <View style={[styles.levelBadgeChip, { backgroundColor: color }]}>
                      <Text style={styles.levelBadgeText}>{highlight.level}</Text>
                    </View>
                  ) : null}
                  {showJpdbBadge ? (
                    <View style={[styles.levelBadgeChip, styles.jpdbBadgeChip]}>
                      <Text style={styles.levelBadgeText}>JP</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      );
    },
    [
      allMatches,
      handleHoverTokenLeave,
      handleVocabularyPress,
      hoverPreviewEnabled,
      renderPlainText,
      theme.textColor,
      userLevel,
    ]
  );

  const renderParsedText = useCallback(
    (text: string, blockStart: number): ReactElement => {
      if (!text) {
        return renderPlainText(text);
      }

      type ParsedInlineSegment = {
        text: string;
        tokenType: "plain" | "grammar" | "verb" | "vocabulary";
        token?: JpdbParsedTokenAnnotation;
      };

      const blockEnd = blockStart + text.length;
      const segments: ParsedInlineSegment[] = [];

      if (jpdbParsedTokens.length === 0) {
        segments.push({
          text,
          tokenType: "plain",
        });
      } else {
        const blockTokens = jpdbParsedTokens
          .filter(
            (token) =>
              token.start >= blockStart &&
              token.end <= blockEnd &&
              token.end > token.start
          )
          .sort((a, b) => {
            if (a.start !== b.start) {
              return a.start - b.start;
            }
            return (b.end - b.start) - (a.end - a.start);
          });

        let cursor = 0;
        for (const token of blockTokens) {
          const localStart = token.start - blockStart;
          const localEnd = token.end - blockStart;
          if (localStart < cursor || localStart < 0 || localEnd > text.length) {
            continue;
          }

          if (localStart > cursor) {
            segments.push({
              text: text.slice(cursor, localStart),
              tokenType: "plain",
            });
          }

          const tokenText = text.slice(localStart, localEnd);
          if (tokenText) {
            segments.push({
              text: tokenText,
              tokenType: token.tokenType,
              token,
            });
          }

          cursor = localEnd;
        }

        if (cursor < text.length) {
          segments.push({
            text: text.slice(cursor),
            tokenType: "plain",
          });
        }
      }

      return (
        <View style={styles.underlinedInlineContainer}>
          {segments.flatMap((segment, index) => {
            const renderedNodes: ReactElement[] = [];
            const baseTextStyle = [
              styles.parsedText,
              { color: theme.textColor },
              fontStyles.japaneseText,
            ];
            if (segment.tokenType === "plain" || !segment.token) {
              renderedNodes.push(
                <Text key={`plain-${index}`} style={baseTextStyle}>
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
            const underlineColor =
              segment.tokenType === "grammar"
                ? grammarUnderlineColor
                : segment.tokenType === "verb"
                  ? verbUnderlineColor
                  : vocabUnderlineColor;
            const tokenKey = `${segment.token.start}-${segment.token.end}-${segment.text}`;
            const isSelectedToken =
              Boolean(selectedItem) && selectedTokenKey === tokenKey;
            const selectedTokenBorderColor = withAlpha(
              theme.textColor,
              theme.isDark ? 0.58 : 0.34
            );
            const selectedTokenBackground = withAlpha(
              underlineColor,
              theme.isDark ? 0.24 : 0.18
            );
            const tokenUnderlineColor = withAlpha(
              underlineColor,
              theme.isDark ? 0.95 : 0.75
            );
            const tokenText = (
              <Text
                style={[
                  baseTextStyle,
                  styles.parsedTokenText,
                  isSelectedToken ? styles.parsedTokenTextSelected : null,
                  { borderBottomColor: tokenUnderlineColor },
                  ...(isSelectedToken
                    ? [
                        {
                          borderColor: selectedTokenBorderColor,
                          backgroundColor: selectedTokenBackground,
                        },
                      ]
                    : []),
                ]}
              >
                {segment.text}
              </Text>
            );
            const tokenNodeKey = `token-${index}-${segment.token.start}-${segment.token.end}`;
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

            const nextSegment = segments[index + 1];
            const hasAdjacentHighlightedSegment =
              nextSegment &&
              nextSegment.tokenType !== "plain" &&
              Boolean(nextSegment.token);

            if (hasAdjacentHighlightedSegment) {
              renderedNodes.push(
                <Text key={`sep-${index}`} style={[baseTextStyle, styles.parsedTokenSeparator]}>
                  {TOKEN_UNDERLINE_SEPARATOR}
                </Text>
              );
            }

            return renderedNodes;
          })}
        </View>
      );
    },
    [
      grammarUnderlineColor,
      handleVocabularyPress,
      handleHoverTokenLeave,
      jpdbParsedTokens,
      hoverPreviewEnabled,
      renderPlainText,
      selectedItem,
      selectedTokenKey,
      theme.textColor,
      theme.isDark,
      verbUnderlineColor,
      vocabUnderlineColor,
      vocabularyMatchesById,
    ]
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.headerBackground,
            borderBottomColor: theme.border,
            paddingTop: insets.top + 4,
            height: headerHeight,
          },
        ]}
      >
        <GlassButton
          iconName="arrow-back"
          iconColor={headerIconColor}
          style={[styles.headerButtonBase, styles.backButton]}
          variant={theme.isDark ? "colored" : "light"}
          onPress={handleBackNavigation}
        />
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.headerText }]}>URL Reader</Text>
        </View>
        {Platform.OS === "ios" && SwiftUI ? (
          <SwiftUI.Host matchContents style={styles.headerActionHost}>
            <SwiftUI.Menu
              label={
                <SwiftUI.RNHostView matchContents>
                  <GlassButton
                    iconName="ellipsis-horizontal"
                    iconSize={20}
                    iconColor={headerIconColor}
                    variant={theme.isDark ? "colored" : "light"}
                  />
                </SwiftUI.RNHostView>
              }
            >
              <SwiftUI.Button
                label="No WK study mode"
                systemImage={
                  studyMode === "none" ? "checkmark.circle.fill" : "circle"
                }
                onPress={() => handleSelectStudyMode("none")}
              />
              <SwiftUI.Button
                label="WK study mode"
                systemImage={
                  studyMode === "wk" ? "checkmark.circle.fill" : "circle"
                }
                onPress={() => handleSelectStudyMode("wk")}
              />
              <SwiftUI.Button
                label={
                  hasStoredJpdbApiKey
                    ? "Full grammar study mode"
                    : "Full grammar study mode (JPDB key required)"
                }
                systemImage={
                  !hasStoredJpdbApiKey
                    ? "lock"
                    : studyMode === "full"
                      ? "checkmark.circle.fill"
                      : "circle"
                }
                onPress={() => handleSelectStudyMode("full")}
              />
            </SwiftUI.Menu>
          </SwiftUI.Host>
        ) : (
          <TouchableOpacity
            style={styles.headerActionButton}
            onPress={() => setShowStudyModeMenu(true)}
            activeOpacity={0.75}
          >
            <Ionicons
              name="ellipsis-horizontal-circle-outline"
              size={22}
              color={headerIconColor}
            />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.inputCard,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <View style={styles.inputRowCompact}>
            <Ionicons
              name="link-outline"
              size={18}
              color={theme.textSecondary}
              style={styles.urlLeadingIcon}
            />
            <TextInput
              value={urlInput}
              onChangeText={(value) => {
                setUrlInput(value);
                if (error) {
                  setError(null);
                }
              }}
              placeholder="https://x.com/username/status/123456789"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={() => void handleLoadUrl()}
              style={[
                styles.urlInputCompact,
                {
                  color: theme.textColor,
                },
              ]}
            />
            <TouchableOpacity
              style={[
                styles.inputIconButton,
                { borderColor: theme.border, backgroundColor: theme.cardBackground },
              ]}
              onPress={() => void handlePasteAndLoad()}
              activeOpacity={0.75}
            >
              <Ionicons name="clipboard-outline" size={18} color={theme.textColor} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.inputIconButton,
                { borderColor: theme.border, backgroundColor: theme.cardBackground },
                isLoading && styles.inputIconButtonDisabled,
              ]}
              onPress={isLoading ? undefined : () => void handleLoadUrl()}
              activeOpacity={0.75}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={theme.textSecondary} />
              ) : (
                <Ionicons name="search-outline" size={18} color={theme.textColor} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {error ? (
          <View
            style={[
              styles.stateCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.error,
              },
            ]}
          >
            <Ionicons name="alert-circle-outline" size={22} color={theme.error} />
            <Text style={[styles.stateText, { color: theme.error }]}>{error}</Text>
          </View>
        ) : null}

        {!isLoading && !error && blocks.length === 0 ? (
          <View
            style={[
              styles.stateCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <Ionicons name="globe-outline" size={24} color={theme.textSecondary} />
            <Text style={[styles.stateText, { color: theme.textSecondary }]}>
              Load an X post URL to parse tweet text with the JPDB-first highlighter.
            </Text>
          </View>
        ) : null}

        {blocks.length > 0 ? (
          <View
            style={[
              styles.articleCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            {contentKind === "tweet" && tweetData ? (
              <View style={styles.tweetHeader}>
                {tweetData.authorProfileImageUrl ? (
                  <Image
                    source={{ uri: tweetData.authorProfileImageUrl }}
                    style={styles.tweetAvatar}
                  />
                ) : (
                  <View
                    style={[
                      styles.tweetAvatarFallback,
                      { backgroundColor: theme.isDark ? "#30343a" : "#d7dde6" },
                    ]}
                  >
                    <Text style={[styles.tweetAvatarFallbackText, { color: theme.textColor }]}>
                      {(tweetData.authorName || "?").slice(0, 1)}
                    </Text>
                  </View>
                )}

                <View style={styles.tweetIdentity}>
                  <Text
                    style={[
                      styles.tweetAuthorName,
                      { color: theme.textColor },
                    ]}
                    numberOfLines={1}
                  >
                    {tweetData.authorName || articleTitle || "Unknown"}
                  </Text>
                  {tweetData.authorHandle ? (
                    <Text
                      style={[
                        styles.tweetAuthorHandle,
                        { color: theme.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      @{tweetData.authorHandle}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <Text style={[styles.articleTitle, { color: theme.textColor }]}>
                {articleTitle || "Untitled"}
              </Text>
            )}

            {isAnalyzing ? (
              <View style={styles.articleMetaRow}>
                <View style={styles.analyzingWrap}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={[styles.articleMetaText, { color: theme.textSecondary }]}>
                    Parsing...
                  </Text>
                </View>
              </View>
            ) : null}

            {blocksWithOffsets.map((block, index) => (
              <View
                key={`url-block-${index}`}
                style={styles.paragraphBlockWrap}
              >
                {studyMode === "none"
                  ? renderPlainText(block.content)
                  : fullModeEnabled && jpdbParsedTokens.length > 0
                    ? renderParsedText(block.content, block.start)
                    : renderWkHighlightedText(block.content, block.start)}
              </View>
            ))}

            {contentKind === "tweet" && tweetData?.media?.length ? (
              <View style={styles.tweetMediaWrap}>
                {tweetData.media.map((mediaItem, index) => {
                  const motionMediaCanRenderAsImage = /\.(jpe?g|png|webp|gif)(\?|$)/i.test(
                    mediaItem.url
                  );
                  const previewUrl =
                    mediaItem.type === "image"
                      ? mediaItem.url
                      : mediaItem.thumbnailUrl ||
                        (motionMediaCanRenderAsImage ? mediaItem.url : undefined);
                  const isVideoMedia =
                    mediaItem.type === "video" || mediaItem.type === "gif";
                  return (
                    <View
                      key={`tweet-media-${index}-${mediaItem.url}`}
                      style={[
                        styles.tweetMediaItemWrap,
                        tweetData.media.length === 1
                          ? styles.tweetMediaItemSingle
                          : styles.tweetMediaItemGrid,
                      ]}
                    >
                      <TouchableOpacity
                        activeOpacity={0.9}
                        style={styles.tweetMediaTouchable}
                        onPress={() => setActiveTweetMediaIndex(index)}
                      >
                        {previewUrl ? (
                          <Image
                            source={{ uri: previewUrl }}
                            style={styles.tweetMediaImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View
                            style={[
                              styles.tweetMediaPlaceholder,
                              { backgroundColor: theme.isDark ? "#22252b" : "#e8edf3" },
                            ]}
                          >
                            <Text
                              style={[
                                styles.tweetMediaPlaceholderText,
                                { color: theme.textSecondary },
                              ]}
                            >
                              {mediaItem.type === "video" ? "Video attached" : "Media attached"}
                            </Text>
                          </View>
                        )}
                        {isVideoMedia ? (
                          <View style={styles.tweetMediaVideoBadge}>
                            <Ionicons
                              name={mediaItem.type === "gif" ? "repeat" : "play"}
                              size={13}
                              color="#ffffff"
                            />
                          </View>
                        ) : null}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {contentKind === "tweet" && formattedTweetTimestamp ? (
              <Text style={[styles.tweetTimestamp, { color: theme.textSecondary }]}>
                {formattedTweetTimestamp}
              </Text>
            ) : null}

          </View>
        ) : null}
      </ScrollView>

      {tooltipReady ? (
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
          onTooltipLayout={handleTooltipLayout}
        />
      ) : null}

      {!(Platform.OS === "ios" && SwiftUI) ? (
        <Modal
          visible={showStudyModeMenu}
          transparent
          animationType="fade"
          onRequestClose={() => setShowStudyModeMenu(false)}
        >
          <TouchableWithoutFeedback onPress={() => setShowStudyModeMenu(false)}>
            <View style={styles.settingsModalOverlay}>
              <TouchableWithoutFeedback>
                <View
                  style={[
                    styles.settingsModalContent,
                    { backgroundColor: theme.cardBackground, borderColor: theme.border },
                  ]}
                >
                  <Text style={[styles.settingsModalTitle, { color: theme.textColor }]}>
                    Study Mode
                  </Text>

                  <TouchableOpacity
                    style={styles.settingsModeOption}
                    onPress={() => handleSelectStudyMode("none")}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.settingsModeLabel, { color: theme.textColor }]}>
                      No WK study mode
                    </Text>
                    {studyMode === "none" ? (
                      <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                    ) : null}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.settingsModeOption}
                    onPress={() => handleSelectStudyMode("wk")}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.settingsModeLabel, { color: theme.textColor }]}>
                      WK study mode
                    </Text>
                    {wkModeEnabled ? (
                      <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                    ) : null}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.settingsModeOption,
                      !hasStoredJpdbApiKey ? styles.settingsModeOptionDisabled : null,
                    ]}
                    onPress={() => handleSelectStudyMode("full")}
                    activeOpacity={0.8}
                  >
                    <View style={styles.settingsModeLabelWrap}>
                      <Text
                        style={[
                          styles.settingsModeLabel,
                          {
                            color: hasStoredJpdbApiKey
                              ? theme.textColor
                              : theme.textSecondary,
                          },
                        ]}
                      >
                        Full grammar study mode
                      </Text>
                      {!hasStoredJpdbApiKey ? (
                        <Text
                          style={[
                            styles.settingsModeSubtext,
                            { color: theme.textSecondary },
                          ]}
                        >
                          Requires JPDB API key
                        </Text>
                      ) : null}
                    </View>
                    {fullModeEnabled ? (
                      <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                    ) : !hasStoredJpdbApiKey ? (
                      <Ionicons
                        name="lock-closed-outline"
                        size={18}
                        color={theme.textSecondary}
                      />
                    ) : null}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.settingsModeCloseButton}
                    onPress={() => setShowStudyModeMenu(false)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.settingsModeCloseButtonText,
                        { color: theme.textSecondary },
                      ]}
                    >
                      Close
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            </View>
          </TouchableWithoutFeedback>
        </Modal>
      ) : null}

      <Modal
        visible={typeof activeTweetMediaIndex === "number"}
        transparent
        animationType="fade"
        onRequestClose={handleCloseMediaModal}
      >
        <View style={styles.mediaModalRoot}>
          <Pressable
            style={styles.mediaModalBackdrop}
            onPress={handleCloseMediaModal}
          />
          {activeTweetMedia ? (
            <View style={styles.mediaModalContent}>
              {activeMediaVideoSource ? (
                <VideoView
                  player={mediaModalVideoPlayer}
                  style={styles.mediaModalVideo}
                  contentFit="contain"
                  nativeControls
                />
              ) : (
                <Image
                  source={{
                    uri:
                      activeTweetMedia.type === "image"
                        ? activeTweetMedia.url
                        : activeTweetMedia.thumbnailUrl || activeTweetMedia.url,
                  }}
                  style={styles.mediaModalImage}
                  resizeMode="contain"
                />
              )}
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.mediaModalCloseButton}
            onPress={handleCloseMediaModal}
            activeOpacity={0.85}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </Modal>
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
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "bold",
  },
  headerButtonBase: {
    width: 44,
    height: 44,
  },
  backButton: {
    marginRight: 8,
  },
  headerActionButton: {
    padding: 8,
    marginLeft: 8,
  },
  headerActionHost: {
    width: 44,
    height: 44,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
    gap: 12,
  },
  inputCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  inputRowCompact: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  urlLeadingIcon: {
    marginLeft: 4,
  },
  urlInputCompact: {
    flex: 1,
    fontSize: 14,
    minHeight: 44,
    paddingVertical: 10,
  },
  inputIconButton: {
    height: 36,
    width: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  inputIconButtonDisabled: {
    opacity: 0.75,
  },
  stateCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  stateText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  articleCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
  },
  articleTitle: {
    fontSize: 26,
    lineHeight: 34,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  tweetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  tweetAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  tweetAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  tweetAvatarFallbackText: {
    fontSize: 18,
    fontWeight: "700",
  },
  tweetIdentity: {
    flex: 1,
    minWidth: 0,
  },
  tweetAuthorName: {
    fontSize: 16,
    fontWeight: "700",
  },
  tweetAuthorHandle: {
    marginTop: 1,
    fontSize: 13,
    fontWeight: "500",
  },
  articleMetaRow: {
    marginTop: 8,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  articleMetaText: {
    fontSize: 12,
    fontWeight: "500",
  },
  analyzingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  paragraphBlockWrap: {
    marginTop: 10,
  },
  parsedText: {
    fontSize: 17,
    lineHeight: 31,
  },
  parsedTokenText: {
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
  parsedTokenTextSelected: {},
  inlineChipWrapper: {
    position: "relative",
  },
  inlineChipWrapperWithBadge: {
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
    lineHeight: 22,
    includeFontPadding: false,
    textAlignVertical: "center",
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
  jpdbBadgeChip: {
    backgroundColor: "rgba(0, 0, 0, 0.78)",
  },
  levelBadgeText: {
    color: "white",
    fontSize: 10,
    fontWeight: "bold",
    textAlign: "center",
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
  parsedTokenSeparator: {
    opacity: 0,
  },
  tweetMediaWrap: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tweetMediaItemWrap: {
    borderRadius: 14,
    overflow: "hidden",
  },
  tweetMediaItemSingle: {
    width: "100%",
    aspectRatio: 16 / 10,
  },
  tweetMediaItemGrid: {
    width: "48.8%",
    aspectRatio: 1,
  },
  tweetMediaImage: {
    width: "100%",
    height: "100%",
  },
  tweetMediaTouchable: {
    flex: 1,
  },
  tweetMediaVideoBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.7)",
    pointerEvents: "none",
  },
  tweetMediaPlaceholder: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  tweetMediaPlaceholderText: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  tweetTimestamp: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "600",
  },
  settingsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.32)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  settingsModalContent: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  settingsModalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  settingsModeOption: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  settingsModeOptionDisabled: {
    opacity: 0.72,
  },
  settingsModeLabelWrap: {
    flex: 1,
    minWidth: 0,
  },
  settingsModeLabel: {
    fontSize: 15,
    fontWeight: "600",
  },
  settingsModeSubtext: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "500",
  },
  settingsModeCloseButton: {
    alignSelf: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginTop: 6,
  },
  settingsModeCloseButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  mediaModalRoot: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
  },
  mediaModalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  mediaModalContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 56,
  },
  mediaModalImage: {
    width: "100%",
    height: "100%",
  },
  mediaModalVideo: {
    width: "100%",
    height: "100%",
  },
  mediaModalCloseButton: {
    position: "absolute",
    top: 52,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
  },
});
