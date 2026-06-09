import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  StatusBar as NativeStatusBar,
  StyleSheet,
  type StyleProp,
  type TextStyle,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { VocabularyTooltip } from "../../src/components/VocabularyTooltip";
import { isPortegoUsername } from "../../src/utils/portegoAccess";
import {
  mangaLibraryService,
  type MangaPageData,
  type StoredMangaRecord,
} from "../../src/services/mangaLibraryService";
import { getAllSubjects } from "../../src/utils/cache";
import { fontStyles } from "../../src/utils/fonts";
import {
  getStoredJpdbApiKey,
  JpdbApiError,
  translateJapaneseToEnglish,
} from "../../src/utils/jpdbApi";
import { useAuthStore } from "../../src/utils/store";
import {
  findVocabularyMatchesWithJpdbFirstPass as findMatches,
  getHighlightSegments,
  isWaniKaniBackedMatch,
  type JpdbParsedTokenAnnotation,
  type KanjiMatch,
  type VocabularyMatch,
} from "../../src/utils/textHighlighting";
import { withAlpha } from "../../src/utils/subjectColors";
import { useTheme } from "../../src/utils/theme";

type ReaderMatch = VocabularyMatch | KanjiMatch;

type SentenceAnalysisState = {
  isLoading: boolean;
  text: string;
  vocabularyMatches: VocabularyMatch[];
  kanjiMatches: KanjiMatch[];
  jpdbParsedTokens: JpdbParsedTokenAnnotation[];
  errorMessage?: string;
};

type SelectedRegionState = {
  page: number;
  regionId: string;
  text: string;
};

type ReaderSpreadItem = {
  key: string;
  pages: number[];
};

const SCREEN_WIDTH = Dimensions.get("window").width;
const WIDE_SPREAD_MIN_WIDTH = 980;
const WIDE_SPREAD_MIN_ASPECT = 1.18;
const SPREAD_SIDE_PADDING = 14;
const SPREAD_GUTTER = 12;
const PAGE_ZOOM_MAX_SCALE = 3.2;
const GRAMMAR_TOOLTIP_ID_MIN = -9000000;
const JPDB_FALLBACK_TOOLTIP_ID_MIN = -8000000;
const TOKEN_UNDERLINE_SEPARATOR = "\u200A";

function inferFallbackVerbConjugationKind(
  partsOfSpeech: string[]
): VocabularyMatch["verbConjugationKind"] {
  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech.startsWith("vs"))) {
    return "suru";
  }
  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech === "vk")) {
    return "kuru";
  }
  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech.startsWith("v1"))) {
    return "ichidan";
  }
  if (partsOfSpeech.some((partOfSpeech) => partOfSpeech.startsWith("v5"))) {
    return "godan";
  }
  return undefined;
}

function buildGrammarTooltipItem(token: JpdbParsedTokenAnnotation): VocabularyMatch {
  const meaningText = token.meaning?.trim() || "Grammar point";
  const partsOfSpeechSummary = token.partsOfSpeech.filter(Boolean).join(", ");
  const details = partsOfSpeechSummary
    ? `${meaningText}\nPart of Speech: ${partsOfSpeechSummary}`
    : meaningText;

  return {
    id: GRAMMAR_TOOLTIP_ID_MIN - token.start * 1000 - token.end,
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

function buildJpdbFallbackTooltipItem(
  token: JpdbParsedTokenAnnotation,
  tokenType: "verb" | "vocabulary"
): VocabularyMatch {
  const meaningText = token.meaning?.trim() || "Detected by JPDB parser.";
  const partsOfSpeechSummary = token.partsOfSpeech.filter(Boolean).join(", ");
  const details = partsOfSpeechSummary
    ? `${meaningText}\nPart of Speech: ${partsOfSpeechSummary}`
    : meaningText;
  const displayText = token.spelling || token.surface || token.reading || "Vocabulary";
  const hasKanji = /[\u3400-\u9FFF々]/.test(displayText);
  const matchCandidates = Array.from(
    new Set([token.surface, token.spelling, token.reading].filter(Boolean))
  ).sort((a, b) => b.length - a.length);

  return {
    id: JPDB_FALLBACK_TOOLTIP_ID_MIN - token.start * 1000 - token.end,
    characters: displayText,
    meaning: details,
    type: hasKanji ? "vocabulary" : "kana_vocabulary",
    level: 0,
    readings: token.reading
      ? [{ reading: token.reading, primary: true }]
      : undefined,
    verbConjugationKind:
      tokenType === "verb"
        ? inferFallbackVerbConjugationKind(token.partsOfSpeech)
        : undefined,
    matchCandidates: matchCandidates.length > 0 ? matchCandidates : undefined,
    isWaniKaniSubject: false,
    disableConjugationExpansion: true,
  };
}

function getContainedImageFrame(
  containerWidth: number,
  containerHeight: number,
  imageWidth: number,
  imageHeight: number
): { x: number; y: number; width: number; height: number } {
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    return { x: 0, y: 0, width: containerWidth, height: containerHeight };
  }

  const containerAspect = containerWidth / containerHeight;
  const imageAspect = imageWidth / imageHeight;

  if (imageAspect > containerAspect) {
    const width = containerWidth;
    const height = width / imageAspect;
    return {
      x: 0,
      y: (containerHeight - height) / 2,
      width,
      height,
    };
  }

  const height = containerHeight;
  const width = height * imageAspect;
  return {
    x: (containerWidth - width) / 2,
    y: 0,
    width,
    height,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type ZoomableReaderPageTileProps = {
  page: number;
  width: number;
  height: number;
  imageUri: string | null;
  pageData?: MangaPageData;
  pageError?: string;
  isPageLoading: boolean;
  placeholderText: string;
  textSecondary: string;
  lookupModalVisible: boolean;
  onToggleChrome: () => void;
  onActivatePage: (page: number) => void;
  onRegionPress: (page: number, region: MangaPageData["regions"][number]) => void;
  onRetry: (page: number) => void;
};

function ZoomableReaderPageTile({
  page,
  width,
  height,
  imageUri,
  pageData,
  pageError,
  isPageLoading,
  placeholderText,
  textSecondary,
  lookupModalVisible,
  onToggleChrome,
  onActivatePage,
  onRegionPress,
  onRetry,
}: ZoomableReaderPageTileProps) {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const gestureStartScale = useSharedValue(1);
  const gestureStartTranslateX = useSharedValue(0);
  const gestureStartTranslateY = useSharedValue(0);
  const zoomedRef = useRef(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const updateZoomState = useCallback(
    (nextIsZoomed: boolean) => {
      if (zoomedRef.current === nextIsZoomed) {
        return;
      }
      zoomedRef.current = nextIsZoomed;
      setIsZoomed(nextIsZoomed);
    },
    []
  );

  const resetZoom = useCallback(() => {
    scale.value = withTiming(1, { duration: 170 });
    translateX.value = withTiming(0, { duration: 170 });
    translateY.value = withTiming(0, { duration: 170 });
    updateZoomState(false);
  }, [scale, translateX, translateY, updateZoomState]);

  useEffect(() => {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    updateZoomState(false);
  }, [
    height,
    imageUri,
    page,
    scale,
    translateX,
    translateY,
    updateZoomState,
    width,
  ]);

  const pinchGesture = useMemo(
    () =>
      Gesture.Pinch()
        .runOnJS(true)
        .enabled(Boolean(imageUri))
        .onStart(() => {
          gestureStartScale.value = scale.value;
          gestureStartTranslateX.value = translateX.value;
          gestureStartTranslateY.value = translateY.value;
        })
        .onUpdate((event) => {
          const nextScale = clamp(
            gestureStartScale.value * event.scale,
            1,
            PAGE_ZOOM_MAX_SCALE
          );
          const scaleRatio = nextScale / Math.max(0.0001, gestureStartScale.value);

          const focalOffsetX = event.focalX - width / 2;
          const focalOffsetY = event.focalY - height / 2;

          const nextTranslateX =
            focalOffsetX - (focalOffsetX - gestureStartTranslateX.value) * scaleRatio;
          const nextTranslateY =
            focalOffsetY - (focalOffsetY - gestureStartTranslateY.value) * scaleRatio;

          const maxTranslateX = Math.max(0, ((nextScale - 1) * width) / 2);
          const maxTranslateY = Math.max(0, ((nextScale - 1) * height) / 2);

          scale.value = nextScale;
          translateX.value = clamp(nextTranslateX, -maxTranslateX, maxTranslateX);
          translateY.value = clamp(nextTranslateY, -maxTranslateY, maxTranslateY);
        })
        .onEnd(() => {
          if (scale.value <= 1.01) {
            scale.value = withTiming(1, { duration: 140 });
            translateX.value = withTiming(0, { duration: 140 });
            translateY.value = withTiming(0, { duration: 140 });
            updateZoomState(false);
            return;
          }
          updateZoomState(true);
        }),
    [
      gestureStartScale,
      gestureStartTranslateX,
      gestureStartTranslateY,
      height,
      imageUri,
      scale,
      translateX,
      translateY,
      updateZoomState,
      width,
    ]
  );

  const animatedPageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const hasOcrRegions = Boolean(pageData && pageData.regions.length > 0);
  const imageFrame = pageData
    ? getContainedImageFrame(
        width,
        height,
        Math.max(1, pageData.imageWidth),
        Math.max(1, pageData.imageHeight)
      )
    : null;

  return (
    <Pressable
      style={[
        styles.pageWrap,
        {
          width,
          height,
        },
      ]}
      onPress={() => {
        onActivatePage(page);
        if (lookupModalVisible || isZoomed) {
          return;
        }
        onToggleChrome();
      }}
    >
      <GestureDetector gesture={pinchGesture}>
        <Animated.View style={[styles.pageZoomLayer, animatedPageStyle]}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.pageImage}
              contentFit="contain"
              transition={140}
            />
          ) : (
            <View style={styles.pagePlaceholder}>
              <Ionicons
                name="image-outline"
                size={42}
                color={withAlpha(textSecondary, 0.72)}
              />
              <Text style={[styles.pagePlaceholderText, { color: textSecondary }]}>
                {isPageLoading ? "Rendering page..." : placeholderText}
              </Text>
            </View>
          )}

          {hasOcrRegions && imageFrame && pageData ? (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {pageData.regions.map((region) => {
                const left =
                  imageFrame.x + (region.box.x / pageData.imageWidth) * imageFrame.width;
                const top =
                  imageFrame.y + (region.box.y / pageData.imageHeight) * imageFrame.height;
                const regionWidth =
                  (region.box.width / pageData.imageWidth) * imageFrame.width;
                const regionHeight =
                  (region.box.height / pageData.imageHeight) * imageFrame.height;

                if (regionWidth < 4 || regionHeight < 4) {
                  return null;
                }

                return (
                  <Pressable
                    key={`${page}-${region.id}`}
                    style={[
                      styles.ocrRegion,
                      {
                        left,
                        top,
                        width: regionWidth,
                        height: regionHeight,
                        borderColor: "transparent",
                        backgroundColor: "transparent",
                      },
                    ]}
                    onPress={(event) => {
                      event.stopPropagation?.();
                      onActivatePage(page);
                      onRegionPress(page, region);
                    }}
                  />
                );
              })}
            </View>
          ) : null}
        </Animated.View>
      </GestureDetector>

      {pageError ? (
        <View style={styles.pageErrorBadge}>
          <Text style={styles.pageErrorText}>{pageError}</Text>
          <TouchableOpacity onPress={() => onRetry(page)}>
            <Text style={styles.pageRetryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isZoomed ? (
        <TouchableOpacity style={styles.zoomResetButton} onPress={resetZoom}>
          <Ionicons name="contract-outline" size={14} color="#8bd4ff" />
          <Text style={styles.zoomResetButtonText}>Reset Zoom</Text>
        </TouchableOpacity>
      ) : null}
    </Pressable>
  );
}

export default function MangaReaderScreen() {
  const { theme } = useTheme();
  const { userData } = useAuthStore();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mangaId?: string }>();
  const mangaId = typeof params.mangaId === "string" ? params.mangaId : "";
  const canAccessManga = isPortegoUsername(userData?.username);

  const [manga, setManga] = useState<StoredMangaRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageViewport, setPageViewport] = useState({ width: SCREEN_WIDTH, height: 1 });
  const [chromeVisible, setChromeVisible] = useState(true);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [pageDataByNumber, setPageDataByNumber] = useState<Record<number, MangaPageData>>({});
  const [pageLoading, setPageLoading] = useState<Record<number, boolean>>({});
  const [pageErrors, setPageErrors] = useState<Record<number, string>>({});
  const [ocrCompletedPageNumbers, setOcrCompletedPageNumbers] = useState<number[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<SelectedRegionState | null>(null);
  const [sentenceAnalysis, setSentenceAnalysis] = useState<SentenceAnalysisState | null>(null);
  const [isTranslatingSelectedSentence, setIsTranslatingSelectedSentence] = useState(false);
  const [translationErrorMessage, setTranslationErrorMessage] = useState<string | null>(null);
  const [sentenceTranslationsByRegionKey, setSentenceTranslationsByRegionKey] = useState<
    Record<string, { text: string; isTruncated: boolean }>
  >({});
  const [hasStoredJpdbApiKey, setHasStoredJpdbApiKey] = useState(false);
  const [hasResolvedJpdbKeyState, setHasResolvedJpdbKeyState] = useState(false);
  const [lookupModalVisible, setLookupModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ReaderMatch | null>(null);
  const [selectedSurfaceText, setSelectedSurfaceText] = useState<string | null>(null);
  const [selectedTokenKey, setSelectedTokenKey] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
    width: number;
  } | null>(null);

  const tooltipOpacity = useSharedValue(0);
  const listRef = useRef<FlatList<ReaderSpreadItem>>(null);
  const chromeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentenceJobIdRef = useRef(0);
  const tooltipAnchorRef = useRef<{
    adjustedY: number;
    anchorHeight: number;
    screenHeight: number;
  } | null>(null);
  const tooltipMeasuredHeightRef = useRef(180);

  const totalPages = Math.max(1, manga?.metadata.pageCount || 1);
  // Manga is read right-to-left, so page 1 should appear on the right edge first.
  const pages = useMemo(
    () => Array.from({ length: totalPages }, (_, index) => totalPages - index),
    [totalPages]
  );
  const useWideSpreadLayout =
    pageViewport.width >= WIDE_SPREAD_MIN_WIDTH &&
    pageViewport.width >= pageViewport.height * WIDE_SPREAD_MIN_ASPECT;
  const readerSpreads = useMemo<ReaderSpreadItem[]>(() => {
    if (!useWideSpreadLayout) {
      return pages.map((page) => ({
        key: `single-${page}`,
        pages: [page],
      }));
    }

    const spreads: ReaderSpreadItem[] = [];
    for (let index = 0; index < pages.length; index += 2) {
      const spreadPages = pages.slice(index, index + 2);
      spreads.push({
        key: `spread-${spreadPages.join("-")}`,
        pages: spreadPages,
      });
    }
    return spreads;
  }, [pages, useWideSpreadLayout]);
  const pageToSpreadIndex = useMemo(() => {
    const pageMap: Record<number, number> = {};
    readerSpreads.forEach((spread, spreadIndex) => {
      spread.pages.forEach((page) => {
        pageMap[page] = spreadIndex;
      });
    });
    return pageMap;
  }, [readerSpreads]);

  const getVisualIndexFromPage = useCallback(
    (page: number) => {
      const normalizedPage = normalizePage(page, totalPages);
      return pageToSpreadIndex[normalizedPage] ?? 0;
    },
    [pageToSpreadIndex, totalPages]
  );

  const getPrimaryPageFromVisualIndex = useCallback(
    (index: number) => {
      const maxIndex = Math.max(0, readerSpreads.length - 1);
      const normalizedIndex = clamp(index, 0, maxIndex);
      return readerSpreads[normalizedIndex]?.pages[0] ?? 1;
    },
    [readerSpreads]
  );

  const ocrCompletedPageSet = useMemo(
    () => new Set(ocrCompletedPageNumbers),
    [ocrCompletedPageNumbers]
  );
  const visiblePages = useMemo(() => {
    const spreadIndex = getVisualIndexFromPage(currentPage);
    const spread = readerSpreads[spreadIndex];
    if (!spread || spread.pages.length === 0) {
      return [currentPage];
    }
    return spread.pages;
  }, [currentPage, getVisualIndexFromPage, readerSpreads]);

  const selectedRegionCacheKey = useMemo(() => {
    if (!selectedRegion) {
      return null;
    }

    return `${selectedRegion.page}:${selectedRegion.regionId}`;
  }, [selectedRegion]);

  const selectedRegionTranslation = useMemo(() => {
    if (!selectedRegionCacheKey) {
      return null;
    }

    return sentenceTranslationsByRegionKey[selectedRegionCacheKey] || null;
  }, [selectedRegionCacheKey, sentenceTranslationsByRegionKey]);

  const clearChromeTimer = useCallback(() => {
    if (!chromeTimerRef.current) {
      return;
    }
    clearTimeout(chromeTimerRef.current);
    chromeTimerRef.current = null;
  }, []);

  const scheduleChromeAutoHide = useCallback((delayMs = 2200) => {
    clearChromeTimer();
    chromeTimerRef.current = setTimeout(() => {
      setChromeVisible(false);
      chromeTimerRef.current = null;
    }, delayMs);
  }, [clearChromeTimer]);

  const revealChrome = useCallback((delayMs = 2200) => {
    setChromeVisible(true);
    scheduleChromeAutoHide(delayMs);
  }, [scheduleChromeAutoHide]);

  const queueProgressSave = useCallback((page: number) => {
    if (!manga?.metadata.id) {
      return;
    }

    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current);
    }

    progressTimerRef.current = setTimeout(() => {
      mangaLibraryService
        .updateReadingProgress(manga.metadata.id, page)
        .catch((error) => console.error("Failed to save manga progress:", error));
      progressTimerRef.current = null;
    }, 420);
  }, [manga?.metadata.id]);

  const closeTooltip = useCallback(() => {
    tooltipOpacity.value = withTiming(0, { duration: 120 });
    setSelectedItem(null);
    setSelectedSurfaceText(null);
    setSelectedTokenKey(null);
    setTooltipPosition(null);
    tooltipAnchorRef.current = null;
  }, [tooltipOpacity]);

  const handleTooltipLayout = useCallback((height: number) => {
    const anchor = tooltipAnchorRef.current;
    if (!anchor) {
      return;
    }

    const measuredHeight = Math.max(120, height);
    tooltipMeasuredHeightRef.current = measuredHeight;
    const tooltipMargin = 12;
    const { adjustedY, anchorHeight, screenHeight } = anchor;
    const spaceBelow = screenHeight - (adjustedY + anchorHeight);
    const spaceAbove = adjustedY;

    let top: number;
    if (spaceBelow >= measuredHeight || spaceBelow > spaceAbove) {
      top = adjustedY + anchorHeight + 8;
    } else {
      top = adjustedY - measuredHeight - 8;
    }

    const minTop = tooltipMargin;
    const maxTop = Math.max(minTop, screenHeight - measuredHeight - tooltipMargin);
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

  const handleTokenPress = useCallback(
    (match: ReaderMatch, text: string, event: any, tokenKey?: string) => {
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
        const tooltipWidth = 280;
        const tooltipEstimatedHeight = tooltipMeasuredHeightRef.current || 180;

        let left = x + width / 2 - tooltipWidth / 2;
        left = Math.max(16, Math.min(left, screenWidth - tooltipWidth - 16));

        const spaceBelow = screenHeight - (adjustedY + height);
        const spaceAbove = adjustedY;
        const top =
          spaceBelow >= tooltipEstimatedHeight || spaceBelow > spaceAbove
            ? adjustedY + height + 8
            : adjustedY - tooltipEstimatedHeight - 8;

        tooltipAnchorRef.current = {
          adjustedY,
          anchorHeight: height,
          screenHeight,
        };
        setTooltipPosition({ x: left, y: top, width });
        setSelectedItem(match);
        setSelectedSurfaceText(text);
        setSelectedTokenKey(tokenKey ?? null);
        tooltipOpacity.value = withTiming(1, { duration: 180 });
      };

      const measureFromTarget = (
        x: number,
        y: number,
        width: number,
        height: number
      ) => {
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
    [tooltipOpacity]
  );

  const refreshJpdbKeyState = useCallback(async () => {
    try {
      const storedKey = await getStoredJpdbApiKey();
      setHasStoredJpdbApiKey(Boolean(storedKey));
    } catch {
      setHasStoredJpdbApiKey(false);
    } finally {
      setHasResolvedJpdbKeyState(true);
    }
  }, []);

  const refreshOcrStatus = useCallback(async (targetMangaId: string) => {
    try {
      const status = await mangaLibraryService.getOcrStatus(targetMangaId);
      setOcrCompletedPageNumbers(status.completedPageNumbers);
    } catch (error) {
      console.error("Failed to refresh manga OCR status:", error);
      setOcrCompletedPageNumbers([]);
    }
  }, []);

  const analyzeSentence = useCallback(async (sentenceText: string) => {
    const jobId = sentenceJobIdRef.current + 1;
    sentenceJobIdRef.current = jobId;

    setSentenceAnalysis({
      isLoading: true,
      text: sentenceText,
      vocabularyMatches: [],
      kanjiMatches: [],
      jpdbParsedTokens: [],
    });

    try {
      const subjects =
        allSubjects.length > 0
          ? allSubjects
          : await getAllSubjects().catch(() => []);

      if (jobId !== sentenceJobIdRef.current) {
        return;
      }

      const {
        vocabularyMatches,
        kanjiMatches,
        jpdbParsedTokens,
      } = await findMatches(sentenceText, subjects);
      if (jobId !== sentenceJobIdRef.current) {
        return;
      }

      setSentenceAnalysis({
        isLoading: false,
        text: sentenceText,
        vocabularyMatches,
        kanjiMatches,
        jpdbParsedTokens: Array.isArray(jpdbParsedTokens) ? jpdbParsedTokens : [],
      });
    } catch (error) {
      console.error("Failed to analyze manga sentence:", error);
      if (jobId !== sentenceJobIdRef.current) {
        return;
      }

      setSentenceAnalysis({
        isLoading: false,
        text: sentenceText,
        vocabularyMatches: [],
        kanjiMatches: [],
        jpdbParsedTokens: [],
        errorMessage: "Could not analyze this sentence right now.",
      });
    }
  }, [allSubjects]);

  const handleTranslateSelectedSentence = useCallback(async () => {
    if (!selectedRegion || !selectedRegionCacheKey || isTranslatingSelectedSentence) {
      return;
    }

    const existingTranslation = sentenceTranslationsByRegionKey[selectedRegionCacheKey];
    if (existingTranslation) {
      setTranslationErrorMessage(null);
      return;
    }

    setIsTranslatingSelectedSentence(true);
    setTranslationErrorMessage(null);

    try {
      const translation = await translateJapaneseToEnglish(selectedRegion.text);
      const normalizedTranslation = translation.text.trim();

      if (!normalizedTranslation) {
        setTranslationErrorMessage("JPDB did not return a translation for this sentence.");
        return;
      }

      setSentenceTranslationsByRegionKey((previous) => ({
        ...previous,
        [selectedRegionCacheKey]: {
          text: normalizedTranslation,
          isTruncated: translation.isTruncated,
        },
      }));
    } catch (error) {
      if (error instanceof JpdbApiError) {
        if (error.code === "bad_key") {
          setTranslationErrorMessage("JPDB API key is missing or invalid in Settings.");
        } else if (error.code === "too_many_requests") {
          setTranslationErrorMessage("JPDB rate limit reached. Try again in a moment.");
        } else if (error.code === "api_unavailable") {
          setTranslationErrorMessage("JPDB translation is temporarily unavailable.");
        } else if (error.code === "text_too_long") {
          setTranslationErrorMessage("This sentence is too long for JPDB translation.");
        } else {
          setTranslationErrorMessage("Could not translate this sentence right now.");
        }
      } else {
        setTranslationErrorMessage("Could not translate this sentence right now.");
      }
    } finally {
      setIsTranslatingSelectedSentence(false);
    }
  }, [
    isTranslatingSelectedSentence,
    selectedRegion,
    selectedRegionCacheKey,
    sentenceTranslationsByRegionKey,
  ]);

  const handleRegionPress = useCallback((page: number, region: MangaPageData["regions"][number]) => {
    setTranslationErrorMessage(null);
    setLookupModalVisible(true);
    setSelectedRegion({ page, regionId: region.id, text: region.text });
    closeTooltip();
    void analyzeSentence(region.text);
  }, [analyzeSentence, closeTooltip]);

  const ensurePageData = useCallback(
    async (requestedPage: number, options: { forceRefresh?: boolean } = {}) => {
    if (!manga) {
      return;
    }

    const forceRefresh = options.forceRefresh === true;
    const page = normalizePage(requestedPage, manga.metadata.pageCount);
    if (!forceRefresh && (pageDataByNumber[page] || pageLoading[page])) {
      return;
    }

    setPageLoading((previous) => ({
      ...previous,
      [page]: true,
    }));

    setPageErrors((previous) => {
      if (!previous[page]) {
        return previous;
      }
      const next = { ...previous };
      delete next[page];
      return next;
    });

    try {
      const pageData = await mangaLibraryService.getPageData(manga.metadata.id, page, {
        forceRefresh,
      });
      if (!pageData) {
        throw new Error("Missing page data");
      }

      setPageDataByNumber((previous) => ({
        ...previous,
        [page]: pageData,
      }));
      setOcrCompletedPageNumbers((previous) => {
        if (previous.includes(page)) {
          return previous;
        }
        return [...previous, page].sort((left, right) => left - right);
      });

      if (pageData.totalPages !== manga.metadata.pageCount) {
        setManga((previous) => {
          if (!previous) {
            return previous;
          }

          if (previous.metadata.pageCount === pageData.totalPages) {
            return previous;
          }

          return {
            ...previous,
            metadata: {
              ...previous.metadata,
              pageCount: pageData.totalPages,
            },
          };
        });
      }
    } catch (error) {
      console.error(`Failed to load manga page ${page}:`, error);
      setPageErrors((previous) => ({
        ...previous,
        [page]: "Could not load this page.",
      }));
    } finally {
      setPageLoading((previous) => ({
        ...previous,
        [page]: false,
      }));
    }
  }, [manga, pageDataByNumber, pageLoading]);

  const reloadManga = useCallback(async () => {
    if (!canAccessManga) {
      setLoadError("This feature is only available to user Portego.");
      setManga(null);
      setIsLoading(false);
      return;
    }

    if (!mangaId) {
      setLoadError("No manga was selected.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    setPageDataByNumber({});
    setPageLoading({});
    setPageErrors({});
    setOcrCompletedPageNumbers([]);

    try {
      const storedManga = await mangaLibraryService.getManga(mangaId);
      if (!storedManga) {
        setLoadError("This manga is no longer available in your library.");
        setManga(null);
        return;
      }

      setManga(storedManga);
      setCurrentPage(normalizePage(storedManga.metadata.lastReadPage, storedManga.metadata.pageCount));
      await refreshOcrStatus(storedManga.metadata.id);
      revealChrome(2600);
    } catch (error) {
      console.error("Failed to open manga:", error);
      setLoadError("Could not open this manga right now.");
      setManga(null);
    } finally {
      setIsLoading(false);
    }
  }, [canAccessManga, mangaId, refreshOcrStatus, revealChrome]);

  useEffect(() => {
    reloadManga();
  }, [reloadManga]);

  useEffect(() => {
    void refreshJpdbKeyState();
  }, [refreshJpdbKeyState]);

  useEffect(() => {
    if (!lookupModalVisible) {
      return;
    }
    void refreshJpdbKeyState();
  }, [lookupModalVisible, refreshJpdbKeyState]);

  useEffect(() => {
    let didCancel = false;

    const preloadSubjects = async () => {
      try {
        const subjects = await getAllSubjects();
        if (!didCancel) {
          setAllSubjects(Array.isArray(subjects) ? subjects : []);
        }
      } catch (error) {
        console.error("Failed to preload subjects for manga reader:", error);
      }
    };

    void preloadSubjects();

    return () => {
      didCancel = true;
    };
  }, []);

  useEffect(() => {
    if (!manga || isLoading) {
      return;
    }

    queueProgressSave(currentPage);
  }, [currentPage, isLoading, manga, queueProgressSave]);

  useEffect(() => {
    if (!manga || isLoading || manga.metadata.sourceType === "pdf") {
      return;
    }

    const pagesToScan = visiblePages.filter(
      (page) =>
        !ocrCompletedPageSet.has(page) &&
        !pageLoading[page] &&
        !pageErrors[page]
    );

    if (pagesToScan.length === 0) {
      return;
    }

    pagesToScan.forEach((page) => {
      void ensurePageData(page, { forceRefresh: true });
    });
  }, [
    ensurePageData,
    isLoading,
    manga,
    ocrCompletedPageSet,
    pageErrors,
    pageLoading,
    visiblePages,
  ]);

  useEffect(() => {
    return () => {
      clearChromeTimer();
      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }
    };
  }, [clearChromeTimer]);

  useEffect(() => {
    if (lookupModalVisible) {
      clearChromeTimer();
      setChromeVisible(false);
      return;
    }

    revealChrome(2300);
  }, [clearChromeTimer, lookupModalVisible, revealChrome]);

  const vocabularyMatchesById = useMemo(
    () =>
      new Map(
        (sentenceAnalysis?.vocabularyMatches ?? []).map((match) => [match.id, match])
      ),
    [sentenceAnalysis?.vocabularyMatches]
  );

  const currentAnalysisHasMatches = useMemo(() => {
    if (!sentenceAnalysis || sentenceAnalysis.isLoading) {
      return false;
    }

    if (sentenceAnalysis.jpdbParsedTokens.length > 0) {
      return sentenceAnalysis.jpdbParsedTokens.some(
        (token) => token.end > token.start
      );
    }

    return (
      sentenceAnalysis.vocabularyMatches.length > 0 ||
      sentenceAnalysis.kanjiMatches.length > 0
    );
  }, [sentenceAnalysis]);

  const renderAnalyzedSentence = useCallback(
    (text: string) => {
      const baseTextStyle: StyleProp<TextStyle> = [
        styles.lookupSentenceText,
        fontStyles.japaneseText,
        { color: theme.textColor },
      ];

      if (!sentenceAnalysis) {
        return <Text style={baseTextStyle}>{text}</Text>;
      }

      if (sentenceAnalysis.jpdbParsedTokens.length === 0) {
        const allMatches = [
          ...sentenceAnalysis.vocabularyMatches,
          ...sentenceAnalysis.kanjiMatches,
        ];
        const segments = getHighlightSegments(text, allMatches);

        return (
          <View style={styles.lookupUnderlinedInlineContainer}>
            {segments.map((segment, index) => {
              if (!segment.match || !segment.text) {
                return (
                  <Text key={`plain-${index}`} style={baseTextStyle}>
                    {segment.text}
                  </Text>
                );
              }

              const tokenKey = `${segment.match.id}:${index}:${segment.text}`;
              const isSelectedToken =
                Boolean(selectedItem) && selectedTokenKey === tokenKey;

              return (
                <Pressable
                  key={`wk-${tokenKey}`}
                  style={styles.underlinedTokenPressable}
                  onPress={(event) =>
                    handleTokenPress(
                      segment.match as ReaderMatch,
                      segment.text,
                      event,
                      tokenKey
                    )
                  }
                >
                  <Text
                    style={[
                      baseTextStyle,
                      styles.lookupInlineToken,
                      isSelectedToken ? styles.lookupInlineTokenSelected : null,
                      {
                        borderBottomColor: withAlpha(
                          theme.primary,
                          theme.isDark ? 0.92 : 0.76
                        ),
                        ...(isSelectedToken
                          ? {
                              borderColor: withAlpha(
                                theme.textColor,
                                theme.isDark ? 0.58 : 0.34
                              ),
                              backgroundColor: withAlpha(
                                theme.primary,
                                theme.isDark ? 0.22 : 0.16
                              ),
                            }
                          : null),
                      },
                    ]}
                  >
                    {segment.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        );
      }

      type ParsedInlineSegment = {
        text: string;
        tokenType: "plain" | "grammar" | "verb" | "vocabulary";
        token?: JpdbParsedTokenAnnotation;
      };

      const inlineSegments: ParsedInlineSegment[] = [];
      const textEndOffset = text.length;
      const sentenceTokens = sentenceAnalysis.jpdbParsedTokens
        .filter((token) => token.start >= 0 && token.end <= textEndOffset && token.end > token.start)
        .sort((a, b) => {
          if (a.start !== b.start) {
            return a.start - b.start;
          }
          return b.end - b.start - (a.end - a.start);
        });

      let cursor = 0;
      for (const token of sentenceTokens) {
        const localStart = token.start;
        const localEnd = token.end;
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

      return (
        <View style={styles.lookupUnderlinedInlineContainer}>
          {inlineSegments.flatMap((segment, index) => {
            const renderedNodes: React.ReactElement[] = [];

            if (segment.tokenType === "plain" || !segment.token) {
              renderedNodes.push(
                <Text key={`plain-jpdb-${index}`} style={baseTextStyle}>
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
            const jpdbFallbackTooltipItem =
              !grammarTooltipItem && !mappedMatch
                ? buildJpdbFallbackTooltipItem(
                    segment.token,
                    segment.tokenType === "verb" ? "verb" : "vocabulary"
                  )
                : null;
            const tooltipItem =
              grammarTooltipItem ?? mappedMatch ?? jpdbFallbackTooltipItem ?? null;
            const tokenKey = `${segment.token.start}-${segment.token.end}-${segment.text}`;
            const isSelectedToken =
              Boolean(selectedItem) && selectedTokenKey === tokenKey;
            const underlineColor =
              segment.tokenType === "grammar"
                ? theme.isDark
                  ? "#fbbf24"
                  : "#b45309"
                : segment.tokenType === "verb"
                  ? theme.isDark
                    ? "#34d399"
                    : "#0f766e"
                  : theme.isDark
                    ? "#60a5fa"
                    : "#1d4ed8";
            const tokenUnderlineColor = withAlpha(
              underlineColor,
              theme.isDark ? 0.95 : 0.75
            );

            const tokenText = (
              <Text
                style={[
                  baseTextStyle,
                  styles.lookupInlineToken,
                  isSelectedToken ? styles.lookupInlineTokenSelected : null,
                  {
                    borderBottomColor: tokenUnderlineColor,
                    ...(isSelectedToken
                      ? {
                          borderColor: withAlpha(
                            theme.textColor,
                            theme.isDark ? 0.58 : 0.34
                          ),
                          backgroundColor: withAlpha(
                            underlineColor,
                            theme.isDark ? 0.24 : 0.18
                          ),
                        }
                      : null),
                  },
                ]}
              >
                {segment.text}
              </Text>
            );

            const tokenNodeKey = `jpdb-token-${index}-${tokenKey}`;
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
                    handleTokenPress(tooltipItem, segment.text, event, tokenKey)
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
                  key={`sep-${index}-${tokenKey}`}
                  style={[baseTextStyle, styles.lookupInlineSeparator]}
                >
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
      handleTokenPress,
      selectedItem,
      selectedTokenKey,
      sentenceAnalysis,
      theme.isDark,
      theme.primary,
      theme.textColor,
      vocabularyMatchesById,
    ]
  );

  const handlePageViewportLayout = useCallback((event: LayoutChangeEvent) => {
    const width = Math.max(1, Math.round(event.nativeEvent.layout.width));
    const height = Math.max(1, Math.round(event.nativeEvent.layout.height));

    setPageViewport((previous) => {
      if (previous.width === width && previous.height === height) {
        return previous;
      }
      return { width, height };
    });
  }, []);

  const handleReaderSurfacePress = useCallback(() => {
    if (lookupModalVisible) {
      return;
    }
    setChromeVisible((previous) => {
      const next = !previous;
      if (next) {
        scheduleChromeAutoHide(2200);
      } else {
        clearChromeTimer();
      }
      return next;
    });
  }, [clearChromeTimer, lookupModalVisible, scheduleChromeAutoHide]);

  const handlePageChange = useCallback((event: any) => {
    const offsetX = Number(event?.nativeEvent?.contentOffset?.x || 0);
    const pageWidth = Number(event?.nativeEvent?.layoutMeasurement?.width || pageViewport.width || SCREEN_WIDTH);
    const maxVisualIndex = Math.max(0, readerSpreads.length - 1);
    const visualIndex = clamp(Math.round(offsetX / Math.max(1, pageWidth)), 0, maxVisualIndex);
    const spread = readerSpreads[visualIndex];
    const fallbackPage = getPrimaryPageFromVisualIndex(visualIndex);

    if (!spread || spread.pages.length === 0) {
      setCurrentPage(fallbackPage);
      return;
    }

    setCurrentPage((previousPage) =>
      spread.pages.includes(previousPage) ? previousPage : spread.pages[0]
    );
  }, [getPrimaryPageFromVisualIndex, pageViewport.width, readerSpreads]);

  const goToPage = useCallback((page: number) => {
    const nextPage = clamp(page, 1, totalPages);
    listRef.current?.scrollToIndex({
      index: getVisualIndexFromPage(nextPage),
      animated: true,
    });
    setCurrentPage(nextPage);
  }, [getVisualIndexFromPage, totalPages]);

  useEffect(() => {
    if (!manga || isLoading) {
      return;
    }

    const nextIndex = getVisualIndexFromPage(currentPage);
    listRef.current?.scrollToIndex({
      index: nextIndex,
      animated: false,
    });
  }, [currentPage, getVisualIndexFromPage, isLoading, manga, useWideSpreadLayout]);

  const closeLookupModal = useCallback(() => {
    setLookupModalVisible(false);
    setSelectedRegion(null);
    setSentenceAnalysis(null);
    setTranslationErrorMessage(null);
    closeTooltip();
    sentenceJobIdRef.current += 1;
  }, [closeTooltip]);

  const triggerOcrForPage = useCallback(async (page: number) => {
    if (!manga) {
      return;
    }

    const normalizedPage = normalizePage(page, manga.metadata.pageCount);
    if (pageLoading[normalizedPage] || ocrCompletedPageSet.has(normalizedPage)) {
      return;
    }

    closeTooltip();
    await ensurePageData(normalizedPage, { forceRefresh: true });
    await refreshOcrStatus(manga.metadata.id);
    revealChrome(2200);
  }, [
    closeTooltip,
    ensurePageData,
    manga,
    ocrCompletedPageSet,
    pageLoading,
    refreshOcrStatus,
    revealChrome,
  ]);

  const renderSpread = useCallback(
    ({ item: spread }: { item: ReaderSpreadItem }) => {
      const isDoubleSpread = spread.pages.length === 2;
      const tileWidth = isDoubleSpread
        ? Math.max(
            1,
            Math.floor(
              (pageViewport.width - SPREAD_SIDE_PADDING * 2 - SPREAD_GUTTER) / 2
            )
          )
        : pageViewport.width;
      const tileHeight = pageViewport.height;
      const isPdfSource = manga?.metadata.sourceType === "pdf";
      const placeholderText =
        isPdfSource
          ? "PDF OCR is not supported in on-device mode. Please re-import this manga as CBZ or an image folder."
          : "Page image unavailable.";

      return (
        <View
          style={[
            styles.spreadWrap,
            {
              width: pageViewport.width,
              height: pageViewport.height,
              paddingHorizontal: isDoubleSpread ? SPREAD_SIDE_PADDING : 0,
            },
          ]}
        >
          <View
            style={[
              styles.spreadRow,
              isDoubleSpread ? styles.spreadRowDouble : styles.spreadRowSingle,
            ]}
          >
            {spread.pages.map((page) => {
              const pageData = pageDataByNumber[page];
              const pageError = pageErrors[page];
              const isPageLoading = pageLoading[page] === true;
              const imageUri =
                manga?.metadata.sourceType !== "pdf"
                  ? manga?.pageImageUris?.[page - 1] || pageData?.imageUri || null
                  : pageData?.imageUri || null;

              return (
                <View
                  key={`${spread.key}-${page}`}
                  style={[
                    styles.spreadTile,
                    isDoubleSpread && styles.spreadTileDouble,
                    {
                      width: tileWidth,
                    },
                  ]}
                >
                  <ZoomableReaderPageTile
                    page={page}
                    width={tileWidth}
                    height={tileHeight}
                    imageUri={imageUri}
                    pageData={pageData}
                    pageError={pageError}
                    isPageLoading={isPageLoading}
                    placeholderText={placeholderText}
                    textSecondary={theme.textSecondary}
                    lookupModalVisible={lookupModalVisible}
                    onToggleChrome={handleReaderSurfacePress}
                    onActivatePage={(activePage) => setCurrentPage(activePage)}
                    onRegionPress={handleRegionPress}
                    onRetry={(retryPage) => {
                      void ensurePageData(retryPage, { forceRefresh: true });
                    }}
                  />
                </View>
              );
            })}
          </View>
        </View>
      );
    },
    [
      ensurePageData,
      handleReaderSurfacePress,
      handleRegionPress,
      lookupModalVisible,
      manga?.metadata.sourceType,
      manga?.pageImageUris,
      pageDataByNumber,
      pageErrors,
      pageLoading,
      pageViewport.height,
      pageViewport.width,
      theme.textSecondary,
    ]
  );

  if (!canAccessManga) {
    return (
      <View style={[styles.centerState, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar style={theme.statusBarStyle} />
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="lock-closed-outline" size={62} color={theme.error} />
        <Text style={[styles.errorTitle, { color: theme.textColor }]}>Restricted</Text>
        <Text style={[styles.errorSubtitle, { color: theme.textSecondary }]}>
          This feature is only available to user Portego.
        </Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.primary }]}
          onPress={() => router.replace("/")}
        >
          <Text style={styles.backButtonText}>Go Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.centerState, { backgroundColor: theme.backgroundColor }]}> 
        <StatusBar style={theme.statusBarStyle} />
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.centerText, { color: theme.textSecondary }]}>Opening manga...</Text>
      </View>
    );
  }

  if (loadError || !manga) {
    return (
      <View style={[styles.centerState, { backgroundColor: theme.backgroundColor }]}> 
        <StatusBar style={theme.statusBarStyle} />
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="alert-circle-outline" size={62} color={theme.error} />
        <Text style={[styles.errorTitle, { color: theme.textColor }]}>Could not open manga</Text>
        <Text style={[styles.errorSubtitle, { color: theme.textSecondary }]}>{loadError || "Unknown reader error."}</Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.primary }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Back to Library</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const currentPageHasOcrResult = ocrCompletedPageSet.has(currentPage);
  const currentPageIsOcrLoading = pageLoading[currentPage] === true;
  const isPdfSource = manga.metadata.sourceType === "pdf";
  const canRunOcrForCurrentPage =
    !currentPageIsOcrLoading &&
    !currentPageHasOcrResult &&
    !isPdfSource;

  return (
    <View style={[styles.container, { backgroundColor: "#06070b" }]} onLayout={handlePageViewportLayout}>
      <StatusBar style="light" hidden={!chromeVisible} />
      <Stack.Screen options={{ headerShown: false }} />

      <FlatList
        ref={listRef}
        data={readerSpreads}
        key={useWideSpreadLayout ? "spread-layout" : "single-layout"}
        horizontal
        pagingEnabled
        scrollEnabled={!lookupModalVisible}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => `${manga.metadata.id}-${item.key}`}
        initialScrollIndex={getVisualIndexFromPage(currentPage)}
        getItemLayout={(_, index) => ({
          length: pageViewport.width,
          offset: pageViewport.width * index,
          index,
        })}
        onScrollToIndexFailed={(info) => {
          const clampedIndex = clamp(
            info.index,
            0,
            Math.max(0, readerSpreads.length - 1)
          );
          requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({ index: clampedIndex, animated: false });
          });
        }}
        onMomentumScrollEnd={handlePageChange}
        renderItem={renderSpread}
      />

      {chromeVisible ? (
        <LinearGradient
          colors={["rgba(0,0,0,0.78)", "rgba(0,0,0,0)"]}
          style={[
            styles.topChrome,
            {
              paddingTop: Math.max(insets.top + 6, 12),
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.topChromeRow}>
            <TouchableOpacity style={styles.iconButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={22} color="#ffffff" />
            </TouchableOpacity>

            <View style={styles.topTitleWrap}>
              <Text style={styles.topTitle} numberOfLines={1}>{manga.metadata.title}</Text>
              <Text style={styles.topSubtitle}>
                Page {currentPage} of {totalPages} · {useWideSpreadLayout ? "Spread" : "Single"} · OCR {ocrCompletedPageSet.size}/{totalPages}
              </Text>
            </View>

            <View style={styles.topActionButtons}>
              <TouchableOpacity
                style={[styles.iconButton, !canRunOcrForCurrentPage && styles.iconButtonDisabled]}
                onPress={() => {
                  void triggerOcrForPage(currentPage);
                }}
                disabled={!canRunOcrForCurrentPage}
              >
                {currentPageIsOcrLoading ? (
                  <ActivityIndicator size="small" color="#8bd4ff" />
                ) : (
                  <Ionicons
                    name={
                      isPdfSource
                        ? "document-text-outline"
                        : currentPageHasOcrResult
                          ? "checkmark-circle-outline"
                          : "scan-outline"
                    }
                    size={20}
                    color={
                      isPdfSource
                        ? "rgba(255,255,255,0.72)"
                        : currentPageHasOcrResult
                          ? "rgba(255,255,255,0.85)"
                          : "#8bd4ff"
                    }
                  />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      ) : null}

      {chromeVisible ? (
        <LinearGradient
          colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.84)"]}
          style={[
            styles.bottomChrome,
            {
              paddingBottom: Math.max(insets.bottom + 12, 18),
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.bottomControlsRow}>
            <TouchableOpacity
              style={[styles.navButton, currentPage >= totalPages && styles.navButtonDisabled]}
              onPress={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              <Ionicons name="chevron-back" size={18} color="#ffffff" />
              <Text style={styles.navButtonText}>Next</Text>
            </TouchableOpacity>

            <View style={styles.pageChip}>
              <Text style={styles.pageChipText}>{currentPage} / {totalPages}</Text>
            </View>

            <TouchableOpacity
              style={[styles.navButton, currentPage <= 1 && styles.navButtonDisabled]}
              onPress={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <Text style={styles.navButtonText}>Prev</Text>
              <Ionicons name="chevron-forward" size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>

        </LinearGradient>
      ) : null}

      <Modal
        visible={lookupModalVisible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeLookupModal}
      >
        <Pressable style={styles.lookupBackdrop} onPress={closeLookupModal} />
        <View
          style={[
            styles.lookupSheet,
            {
              backgroundColor: theme.cardBackground,
              borderColor: withAlpha(theme.border, 0.75),
              paddingBottom: Math.max(insets.bottom + 12, 18),
            },
          ]}
        >
          <View style={styles.lookupHandle} />

          <Text style={[styles.lookupTitle, { color: theme.textColor }]}>Sentence OCR</Text>
          <Text style={[styles.lookupMeta, { color: theme.textSecondary }]}> 
            Page {selectedRegion?.page ?? currentPage}
          </Text>

          <Text style={[styles.lookupModeHint, { color: theme.textSecondary }]}>
            {hasResolvedJpdbKeyState
              ? hasStoredJpdbApiKey
                ? "JPDB mode active: tap underlined grammar/vocabulary/verb tokens."
                : "WaniKani-only mode active. Save a JPDB API key in Settings for grammar parsing."
              : "Checking JPDB API key status..."}
          </Text>
          {!hasStoredJpdbApiKey ? (
            <TouchableOpacity
              style={styles.lookupSettingsLinkButton}
              onPress={() =>
                router.push({
                  pathname: "/settings",
                  params: { scrollTo: "jpdbApiKey" },
                })
              }
            >
              <Text style={[styles.lookupSettingsLinkText, { color: theme.primary }]}>
                Open Settings
              </Text>
            </TouchableOpacity>
          ) : null}

          <View style={[styles.lookupSentenceCard, { borderColor: withAlpha(theme.border, 0.5) }]}>
            {renderAnalyzedSentence(selectedRegion?.text || sentenceAnalysis?.text || "")}
          </View>

          {sentenceAnalysis?.isLoading ? (
            <View style={styles.lookupLoadingWrap}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.lookupLoadingText, { color: theme.textSecondary }]}>Analyzing words...</Text>
            </View>
          ) : sentenceAnalysis?.errorMessage ? (
            <Text style={[styles.lookupErrorText, { color: theme.error }]}>{sentenceAnalysis.errorMessage}</Text>
          ) : !currentAnalysisHasMatches ? (
            <Text style={[styles.noMatchesText, { color: theme.textSecondary }]}>
              No dictionary matches were found for this sentence.
            </Text>
          ) : null}

          <View style={styles.lookupTranslationSection}>
            <TouchableOpacity
              style={[
                styles.lookupTranslateButton,
                isTranslatingSelectedSentence && styles.navButtonDisabled,
              ]}
              onPress={() => {
                void handleTranslateSelectedSentence();
              }}
              disabled={isTranslatingSelectedSentence || !selectedRegion}
            >
              {isTranslatingSelectedSentence ? (
                <ActivityIndicator size="small" color="#8bd4ff" />
              ) : (
                <Ionicons name="language-outline" size={17} color="#8bd4ff" />
              )}
              <Text style={styles.lookupTranslateButtonText}>Translate with JPDB</Text>
            </TouchableOpacity>

            {translationErrorMessage ? (
              <Text style={[styles.lookupErrorText, { color: theme.error }]}>
                {translationErrorMessage}
              </Text>
            ) : null}

            {selectedRegionTranslation ? (
              <View
                style={[
                  styles.lookupTranslationCard,
                  { borderColor: withAlpha(theme.border, 0.5) },
                ]}
              >
                <Text style={[styles.lookupTranslationLabel, { color: theme.textSecondary }]}>
                  English
                </Text>
                <Text style={[styles.lookupTranslationText, { color: theme.textColor }]}>
                  {selectedRegionTranslation.text}
                </Text>
                {selectedRegionTranslation.isTruncated ? (
                  <Text style={[styles.lookupTranslationMeta, { color: theme.textSecondary }]}>
                    JPDB truncated this translation due length limits.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.closeLookupButton, { backgroundColor: withAlpha(theme.primary, 0.16) }]}
            onPress={closeLookupModal}
          >
            <Text style={[styles.closeLookupButtonText, { color: theme.primary }]}>Close</Text>
          </TouchableOpacity>
        </View>

        <VocabularyTooltip
          selectedItem={selectedItem}
          position={tooltipPosition}
          opacity={tooltipOpacity}
          selectedSurfaceText={selectedSurfaceText}
          headerColorOverride={
            selectedItem && selectedItem.id <= GRAMMAR_TOOLTIP_ID_MIN
              ? theme.isDark
                ? "#fbbf24"
                : "#b45309"
              : undefined
          }
          useModal={false}
          onTooltipLayout={handleTooltipLayout}
          onClose={closeTooltip}
          onViewDetails={() => {
            if (!selectedItem || !isWaniKaniBackedMatch(selectedItem)) {
              return;
            }
            closeTooltip();
            router.push({
              pathname: "/subject/[id]",
              params: { id: selectedItem.id.toString(), from: "manga-reader" },
            });
          }}
          onViewSubject={(subjectId) => {
            closeTooltip();
            router.push({
              pathname: "/subject/[id]",
              params: { id: subjectId.toString(), from: "manga-reader" },
            });
          }}
        />
      </Modal>
    </View>
  );
}

function normalizePage(page: number, pageCount: number): number {
  return Math.max(1, Math.min(Math.max(1, Math.floor(pageCount || 1)), Math.floor(page || 1)));
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 12,
  },
  centerText: {
    fontSize: 15,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  errorSubtitle: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  backButton: {
    marginTop: 10,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  backButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 14,
  },
  pageWrap: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#06070b",
    overflow: "hidden",
  },
  spreadWrap: {
    backgroundColor: "#06070b",
  },
  spreadRow: {
    flex: 1,
    alignItems: "center",
  },
  spreadRowSingle: {
    justifyContent: "center",
  },
  spreadRowDouble: {
    flexDirection: "row-reverse",
    justifyContent: "center",
  },
  spreadTile: {
    height: "100%",
  },
  spreadTileDouble: {
    marginHorizontal: SPREAD_GUTTER / 2,
  },
  pageZoomLayer: {
    width: "100%",
    height: "100%",
  },
  pageImage: {
    width: "100%",
    height: "100%",
  },
  pagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pagePlaceholderText: {
    fontSize: 14,
  },
  pageErrorBadge: {
    position: "absolute",
    bottom: 22,
    alignSelf: "center",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(20, 20, 20, 0.85)",
    alignItems: "center",
  },
  pageErrorText: {
    color: "#ffffff",
    fontSize: 13,
    marginBottom: 4,
  },
  pageRetryText: {
    color: "#8bd4ff",
    fontSize: 13,
    fontWeight: "700",
  },
  zoomResetButton: {
    position: "absolute",
    right: 12,
    bottom: 12,
    height: 32,
    borderRadius: 16,
    paddingHorizontal: 10,
    backgroundColor: "rgba(12,14,18,0.78)",
    borderWidth: 1,
    borderColor: "rgba(139,212,255,0.45)",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  zoomResetButtonText: {
    color: "#8bd4ff",
    fontWeight: "700",
    fontSize: 12,
  },
  ocrRegion: {
    position: "absolute",
    borderWidth: 0,
    borderRadius: 6,
  },
  topChrome: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  topChromeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  topActionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  iconButtonDisabled: {
    opacity: 0.45,
  },
  topTitleWrap: {
    flex: 1,
    paddingHorizontal: 12,
  },
  topTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  topSubtitle: {
    color: "rgba(255,255,255,0.72)",
    fontSize: 12,
    marginTop: 2,
  },
  bottomChrome: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 42,
  },
  bottomControlsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  navButton: {
    minWidth: 94,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  navButtonDisabled: {
    opacity: 0.45,
  },
  navButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  pageChip: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  pageChipText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.2,
  },
  lookupBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  lookupSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  lookupHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(120,120,120,0.55)",
    marginBottom: 14,
  },
  lookupTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  lookupMeta: {
    fontSize: 12,
    letterSpacing: 0.2,
    marginBottom: 6,
  },
  lookupModeHint: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  lookupSettingsLinkButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
    marginBottom: 10,
  },
  lookupSettingsLinkText: {
    fontSize: 12,
    fontWeight: "700",
  },
  lookupSentenceCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  lookupSentenceText: {
    fontSize: 20,
    lineHeight: 30,
  },
  lookupUnderlinedInlineContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
  },
  underlinedTokenPressable: {
    alignSelf: "flex-start",
  },
  lookupInlineToken: {
    borderBottomWidth: 2,
    borderRadius: 6,
    paddingHorizontal: 2,
    paddingVertical: 1,
    overflow: "hidden",
  },
  lookupInlineTokenSelected: {},
  lookupInlineSeparator: {
    marginHorizontal: 0,
    includeFontPadding: false,
  },
  lookupLoadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  lookupLoadingText: {
    fontSize: 14,
  },
  lookupErrorText: {
    fontSize: 14,
    marginBottom: 14,
  },
  noMatchesText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  lookupTranslationSection: {
    gap: 8,
    marginBottom: 14,
  },
  lookupTranslateButton: {
    height: 40,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  lookupTranslateButtonText: {
    color: "#8bd4ff",
    fontWeight: "700",
    fontSize: 13,
  },
  lookupTranslationCard: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  lookupTranslationLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  lookupTranslationText: {
    fontSize: 14,
    lineHeight: 20,
  },
  lookupTranslationMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  closeLookupButton: {
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  closeLookupButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
