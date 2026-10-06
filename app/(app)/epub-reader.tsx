import { Ionicons } from "@expo/vector-icons";
import { useActivityTracking } from "../../src/hooks/useActivityTracking";
import { router, Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  type AppStateStatus,
  type LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { type WebViewMessageEvent } from "react-native-webview";
import { epubLibraryService, type EpubStoredBook } from "../../src/services/epubLibraryService";
import { readingGoalsService } from "../../src/services/readingGoalsService";
import { withAlpha } from "../../src/utils/subjectColors";
import { getAllSubjects } from "../../src/utils/cache";
import { fontStyles } from "../../src/utils/fonts";
import {
  AnyMatch,
  findVocabularyMatchesWithJpdbFirstPass as findMatches,
  getHighlightSegments,
  getItemColor,
  getVerbInflectionLabelsForMatch,
  isWaniKaniBackedMatch,
  KanjiMatch,
  VocabularyMatch,
} from "../../src/utils/textHighlighting";
import { useTheme } from "../../src/utils/theme";
import { EpubSavedPassagesSheet } from "../../src/components/epub-saved-passages-sheet";
import { epubAnnotations, type EpubAnnotation, type EpubPassage, type EpubSelection } from "../../src/services/epub/annotations";
import { createReadingProgressSaver } from "../../src/services/epub/reading-progress";

type ReaderBridgeMessage = {
  type?: "ready" | "page" | "error" | "toggleChrome" | "wordTap" | "bookmark" | "selection";
  payload?: {
    page?: number;
    totalPages?: number;
    message?: string;
    text?: string;
    index?: number;
    character?: string;
    passage?: EpubPassage;
  };
};

type ReaderLookupMatch = VocabularyMatch | KanjiMatch;
type ReaderLookupSelection = {
  match: ReaderLookupMatch;
  surfaceText: string;
};

const TAP_OFFSET_SCAN_ORDER = [0, -1, 1, -2, 2];

const clampLookupIndex = (index: number, textLength: number) => {
  if (textLength <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(Math.floor(index), textLength - 1));
};

const findLookupMatchAtOffset = (
  text: string,
  offset: number,
  matches: AnyMatch[]
): ReaderLookupSelection | null => {
  if (!text || matches.length === 0) {
    return null;
  }

  const segments = getHighlightSegments(text, matches);
  const candidateOffsets = TAP_OFFSET_SCAN_ORDER.map((delta) =>
    clampLookupIndex(offset + delta, text.length)
  );

  for (const candidateOffset of candidateOffsets) {
    let cursor = 0;

    for (const segment of segments) {
      const segmentStart = cursor;
      const segmentEnd = segmentStart + segment.text.length;
      cursor = segmentEnd;

      if (candidateOffset < segmentStart || candidateOffset >= segmentEnd) {
        continue;
      }

      if (segment.match) {
        return {
          match: segment.match as ReaderLookupMatch,
          surfaceText: segment.text,
        };
      }

      break;
    }
  }

  return null;
};

export default function EpubReaderScreen() {
  useActivityTracking("epub", { mode: "focus" });
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ bookId?: string }>();
  const bookId = typeof params.bookId === "string" ? params.bookId : "";

  const [book, setBook] = useState<EpubStoredBook | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [topBarHeight, setTopBarHeight] = useState(0);
  const [isTopBarVisible, setIsTopBarVisible] = useState(true);
  const [isReaderPositioning, setIsReaderPositioning] = useState(true);
  const [allSubjects, setAllSubjects] = useState<any[]>([]);
  const [selectedLookupItem, setSelectedLookupItem] = useState<ReaderLookupMatch | null>(null);
  const [selectedLookupSurfaceText, setSelectedLookupSurfaceText] = useState<string | null>(
    null
  );
  const [isLookupModalVisible, setIsLookupModalVisible] = useState(false);
  const [annotations, setAnnotations] = useState<EpubAnnotation[]>([]);
  const [selection, setSelection] = useState<EpubSelection | null>(null);
  const [isSavedPassagesVisible, setIsSavedPassagesVisible] = useState(false);
  const [isSavingAnnotation, setIsSavingAnnotation] = useState(false);
  const [annotationError, setAnnotationError] = useState<string | null>(null);
  const annotationSaveInFlightRef = useRef(false);
  const annotationsLoadedRef = useRef(false);
  const readerReadyRef = useRef(false);
  const restoringPageRef = useRef<number | null>(null);

  const [progressSaver] = useState(() => createReadingProgressSaver(
    ({ bookId: id, page, totalPages: pages }) => epubLibraryService.updateReadingProgress(id, page, pages),
    (error) => console.error("Failed to update EPUB reading progress:", error),
  ));
  const chromeHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealReaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const readingFlushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const pendingReadingSecondsRef = useRef(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lookupRequestIdRef = useRef(0);
  const webViewRef = useRef<WebView>(null);
  const lookupSheetTranslateY = useRef(new Animated.Value(56)).current;
  const lookupSheetOpacity = useRef(new Animated.Value(0)).current;
  const isClosingLookupSheetRef = useRef(false);

  const themePayload = useMemo(
    () => ({
      backgroundColor: theme.backgroundColor,
      textColor: theme.textColor,
      linkColor: theme.primary,
      chipBackground: theme.isDark ? "rgba(5, 6, 10, 0.72)" : "rgba(255, 255, 255, 0.85)",
      chipTextColor: theme.textColor,
      lookupHighlightBackground: withAlpha(theme.primary, theme.isDark ? 0.34 : 0.24),
      lookupHighlightBorder: withAlpha(theme.primary, theme.isDark ? 0.7 : 0.5),
      lookupHighlightText: theme.textColor,
      savedHighlightBackground: theme.isDark ? "rgba(230,178,50,0.28)" : "rgba(230,178,50,0.32)",
    }),
    [theme]
  );

  const applyThemeToReader = useCallback(() => {
    if (!webViewRef.current) {
      return;
    }

    const payload = JSON.stringify(themePayload);
    webViewRef.current.injectJavaScript(
      `window.__WK_EPUB__?.setTheme?.(${payload}); true;`
    );
  }, [themePayload]);

  const queueProgressSave = useCallback(
    (page: number, pages: number) => {
      if (!bookId) {
        return;
      }

      progressSaver.queue({ bookId, page, totalPages: pages });
    },
    [bookId, progressSaver]
  );

  const runReaderCommand = useCallback((command: string) => {
    webViewRef.current?.injectJavaScript(`${command}; true;`);
  }, []);

  const commitAnnotations = useCallback(async (next: EpubAnnotation[]) => {
    if (!annotationsLoadedRef.current) return false;
    setIsSavingAnnotation(true);
    annotationSaveInFlightRef.current = true;
    setAnnotationError(null);
    try {
      await epubAnnotations.save(bookId, next);
      setAnnotations(next);
      return true;
    } catch (error) {
      console.error("Failed to save EPUB annotation:", error);
      setAnnotationError("Could not save this change. Please try again.");
      return false;
    } finally {
      annotationSaveInFlightRef.current = false;
      setIsSavingAnnotation(false);
    }
  }, [bookId]);

  const handleBookmark = useCallback(async (payload: ReaderBridgeMessage["payload"]) => {
    if (!payload?.page) {
      annotationSaveInFlightRef.current = false;
      setIsSavingAnnotation(false);
      return;
    }
    const existing = annotations.find((item) => item.kind === "bookmark" && item.page === payload.page);
    const next = existing ? annotations.filter((item) => item.id !== existing.id) : [...annotations, {
      id: `bookmark-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "bookmark" as const,
      page: payload.page,
      text: payload.text || "",
      passage: payload.passage,
      createdAt: Date.now(),
    }];
    await commitAnnotations(next);
  }, [annotations, commitAnnotations]);

  const saveHighlight = useCallback(async () => {
    if (!selection || annotationSaveInFlightRef.current) return;
    const duplicate = annotations.some((item) => item.kind === "highlight" && JSON.stringify(item.passage) === JSON.stringify(selection.passage));
    const didSave = duplicate || await commitAnnotations([...annotations, {
      ...selection,
      id: `highlight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: "highlight",
      createdAt: Date.now(),
    }]);
    if (didSave) {
      setSelection(null);
      runReaderCommand("window.__WK_EPUB__?.clearSelection?.()");
    }
  }, [annotations, commitAnnotations, runReaderCommand, selection]);

  useFocusEffect(useCallback(() => () => { void progressSaver.flush(); }, [progressSaver]));

  const stopReadingClock = useCallback(() => {
    const startedAt = sessionStartedAtRef.current;
    if (startedAt === null) {
      return;
    }

    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
    sessionStartedAtRef.current = null;
    if (elapsedSeconds > 0) {
      pendingReadingSecondsRef.current += elapsedSeconds;
    }
  }, []);

  const startReadingClock = useCallback(() => {
    if (sessionStartedAtRef.current !== null) {
      return;
    }
    sessionStartedAtRef.current = Date.now();
  }, []);

  const flushReadingClock = useCallback(async () => {
    if (sessionStartedAtRef.current !== null) {
      const now = Date.now();
      const elapsedSeconds = Math.max(
        0,
        Math.floor((now - sessionStartedAtRef.current) / 1000)
      );
      sessionStartedAtRef.current = now;

      if (elapsedSeconds > 0) {
        pendingReadingSecondsRef.current += elapsedSeconds;
      }
    }

    const secondsToPersist = Math.max(0, Math.floor(pendingReadingSecondsRef.current));
    if (secondsToPersist <= 0) {
      return;
    }

    pendingReadingSecondsRef.current = 0;

    try {
      await readingGoalsService.addReadingSeconds(secondsToPersist);
    } catch (error) {
      console.error("Failed to persist reading goals progress:", error);
      pendingReadingSecondsRef.current += secondsToPersist;
    }
  }, []);

  const clearChromeHideTimer = useCallback(() => {
    if (!chromeHideTimerRef.current) {
      return;
    }
    clearTimeout(chromeHideTimerRef.current);
    chromeHideTimerRef.current = null;
  }, []);

  const scheduleReaderReveal = useCallback((delayMs = 320) => {
    if (revealReaderTimerRef.current) {
      clearTimeout(revealReaderTimerRef.current);
    }

    revealReaderTimerRef.current = setTimeout(() => {
      setIsReaderPositioning(false);
      revealReaderTimerRef.current = null;
    }, delayMs);
  }, []);

  const scheduleChromeAutoHide = useCallback((delayMs = 1500) => {
    clearChromeHideTimer();
    chromeHideTimerRef.current = setTimeout(() => {
      setIsTopBarVisible(false);
    }, delayMs);
  }, [clearChromeHideTimer]);

  const revealChrome = useCallback(
    (delayMs = 2200) => {
      setIsTopBarVisible(true);
      scheduleChromeAutoHide(delayMs);
    },
    [scheduleChromeAutoHide]
  );

  const closeLookupSheet = useCallback(() => {
    if (!isLookupModalVisible || isClosingLookupSheetRef.current) {
      return;
    }

    isClosingLookupSheetRef.current = true;
    lookupSheetTranslateY.stopAnimation();
    lookupSheetOpacity.stopAnimation();

    Animated.parallel([
      Animated.timing(lookupSheetTranslateY, {
        toValue: 56,
        duration: 170,
        useNativeDriver: true,
      }),
      Animated.timing(lookupSheetOpacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
    ]).start(() => {
      isClosingLookupSheetRef.current = false;
      setIsLookupModalVisible(false);
      setSelectedLookupItem(null);
      setSelectedLookupSurfaceText(null);
      lookupSheetTranslateY.setValue(56);
      lookupSheetOpacity.setValue(0);
    });
  }, [isLookupModalVisible, lookupSheetOpacity, lookupSheetTranslateY]);

  const openLookupDetails = useCallback(() => {
    if (!selectedLookupItem || !isWaniKaniBackedMatch(selectedLookupItem)) {
      return;
    }

    const subjectId = selectedLookupItem.id;
    closeLookupSheet();
    requestAnimationFrame(() => {
      router.push({
        pathname: "/subject/[id]",
        params: {
          id: subjectId.toString(),
          from: "epub-reader",
        },
      });
    });
  }, [closeLookupSheet, selectedLookupItem]);

  const openLookupSubject = useCallback((subjectId: number) => {
    closeLookupSheet();
    requestAnimationFrame(() => {
      router.push({
        pathname: "/subject/[id]",
        params: {
          id: subjectId.toString(),
          from: "epub-reader",
        },
      });
    });
  }, [closeLookupSheet]);

  useEffect(() => {
    if (!isLookupModalVisible) {
      return;
    }

    isClosingLookupSheetRef.current = false;
    lookupSheetTranslateY.stopAnimation();
    lookupSheetOpacity.stopAnimation();
    lookupSheetTranslateY.setValue(56);
    lookupSheetOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(lookupSheetTranslateY, {
        toValue: 0,
        damping: 16,
        stiffness: 210,
        mass: 0.9,
        useNativeDriver: true,
      }),
      Animated.timing(lookupSheetOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isLookupModalVisible, lookupSheetOpacity, lookupSheetTranslateY]);

  const handleWordTap = useCallback(
    async (payload: ReaderBridgeMessage["payload"]) => {
      const tappedText = typeof payload?.text === "string" ? payload.text : "";
      const tappedIndex = Number(payload?.index ?? NaN);

      if (!tappedText || !Number.isFinite(tappedIndex) || allSubjects.length === 0) {
        return;
      }

      const requestId = ++lookupRequestIdRef.current;

      try {
        const safeOffset = clampLookupIndex(tappedIndex, tappedText.length);
        const { vocabularyMatches, kanjiMatches } = await findMatches(
          tappedText,
          allSubjects
        );

        if (requestId !== lookupRequestIdRef.current) {
          return;
        }

        const selectedMatch =
          findLookupMatchAtOffset(tappedText, safeOffset, vocabularyMatches) ??
          findLookupMatchAtOffset(tappedText, safeOffset, kanjiMatches);

        if (!selectedMatch) {
          return;
        }

        setSelectedLookupItem(selectedMatch.match);
        setSelectedLookupSurfaceText(selectedMatch.surfaceText);
        setIsLookupModalVisible(true);
        setIsTopBarVisible(false);
        clearChromeHideTimer();
      } catch (error) {
        console.error("Failed to resolve EPUB lookup match:", error);
      }
    },
    [allSubjects, clearChromeHideTimer]
  );

  const handleTopBarLayout = useCallback((event: LayoutChangeEvent) => {
    const measuredHeight = Math.round(event.nativeEvent.layout.height);
    setTopBarHeight((previousHeight) =>
      previousHeight === measuredHeight ? previousHeight : measuredHeight
    );
  }, []);

  const handleBridgeMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let parsedMessage: ReaderBridgeMessage | null = null;

      try {
        parsedMessage = JSON.parse(event.nativeEvent.data) as ReaderBridgeMessage;
      } catch {
        return;
      }

      if (!parsedMessage?.type) {
        return;
      }

      if (parsedMessage.type === "error") {
        const message = parsedMessage.payload?.message || "Reader failed to initialize.";
        setLoadError(message);
        return;
      }

      if (parsedMessage.type === "toggleChrome") {
        setIsTopBarVisible((previousVisible) => {
          const nextVisible = !previousVisible;
          if (nextVisible) {
            scheduleChromeAutoHide(2400);
          } else {
            clearChromeHideTimer();
          }
          return nextVisible;
        });
        return;
      }

      if (parsedMessage.type === "wordTap") {
        void handleWordTap(parsedMessage.payload);
        return;
      }

      if (parsedMessage.type === "selection") {
        const payload = parsedMessage.payload;
        setSelection(payload?.text && payload.passage && payload.page
          ? { text: payload.text, passage: payload.passage, page: payload.page }
          : null);
        if (annotationsLoadedRef.current) setAnnotationError(null);
        return;
      }

      if (parsedMessage.type === "bookmark") {
        if (annotationSaveInFlightRef.current) void handleBookmark(parsedMessage.payload);
        return;
      }

      if (parsedMessage.type === "ready") {
        readerReadyRef.current = true;
        applyThemeToReader();
        runReaderCommand(`window.__WK_EPUB__?.setAnnotations?.(${JSON.stringify(annotations)})`);
        const pages = Math.max(1, Math.floor(parsedMessage.payload?.totalPages || 1));
        const targetPage = Math.min(pages, Math.max(1, book?.metadata.lastReadPage ?? 1));
        if (parsedMessage.payload?.page !== targetPage) {
          // Android may deliver the before-load injection too late. Restore over the
          // ready bridge as well, without saving the temporary opening page.
          restoringPageRef.current = targetPage;
          runReaderCommand(`window.__WK_EPUB__?.goTo?.(${targetPage}, false)`);
          return;
        }
      }

      if (parsedMessage.type === "ready" || (parsedMessage.type === "page" && readerReadyRef.current)) {
        const page = Math.max(1, Math.floor(parsedMessage.payload?.page || 1));
        const pages = Math.max(1, Math.floor(parsedMessage.payload?.totalPages || 1));
        if (restoringPageRef.current !== null && page !== restoringPageRef.current) return;
        restoringPageRef.current = null;
        setCurrentPage(page);
        setTotalPages(pages);
        queueProgressSave(page, pages);
        scheduleReaderReveal(220);
        scheduleChromeAutoHide();
      }
    },
    [
      annotations,
      book?.metadata.lastReadPage,
      applyThemeToReader,
      handleBookmark,
      clearChromeHideTimer,
      handleWordTap,
      queueProgressSave,
      runReaderCommand,
      scheduleReaderReveal,
      scheduleChromeAutoHide,
    ]
  );

  const reloadBook = useCallback(async () => {
    if (!bookId) {
      setLoadError("No EPUB selected.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError(null);
    setIsTopBarVisible(true);
    setIsReaderPositioning(true);
    setSelectedLookupItem(null);
    setSelectedLookupSurfaceText(null);
    readerReadyRef.current = false;
    restoringPageRef.current = null;
    annotationsLoadedRef.current = false;
    setAnnotations([]);
    setSelection(null);
    setAnnotationError(null);
    setIsSavedPassagesVisible(false);
    if (revealReaderTimerRef.current) {
      clearTimeout(revealReaderTimerRef.current);
      revealReaderTimerRef.current = null;
    }

    try {
      await progressSaver.flush();
      await epubLibraryService.flushReadingProgress();
      const storedBook = await epubLibraryService.getBook(bookId);
      try {
        setAnnotations(await epubAnnotations.load(bookId));
        annotationsLoadedRef.current = true;
      } catch (error) {
        console.error("Failed to load EPUB annotations:", error);
        setAnnotationError("Could not load saved passages. Reopen the book to try again.");
      }

      if (!storedBook) {
        setLoadError("This EPUB is no longer available in your library.");
        setBook(null);
      } else {
        setBook(storedBook);
        setCurrentPage(Math.max(1, storedBook.metadata.lastReadPage || 1));
        setTotalPages(Math.max(1, storedBook.metadata.estimatedPages || 1));
      }
    } catch (error) {
      console.error("Failed to load EPUB book:", error);
      setLoadError("Could not open this EPUB right now.");
      setBook(null);
    } finally {
      setIsLoading(false);
    }
  }, [bookId, progressSaver]);

  useEffect(() => {
    reloadBook();
  }, [reloadBook]);

  useEffect(() => {
    let didCancel = false;

    const preloadSubjectLookup = async () => {
      try {
        const subjects = await getAllSubjects();
        if (!didCancel) {
          setAllSubjects(Array.isArray(subjects) ? subjects : []);
        }
      } catch (error) {
        console.error("Failed to preload subject lookup data for EPUB reader:", error);
      }
    };

    preloadSubjectLookup();

    return () => {
      didCancel = true;
    };
  }, []);

  useEffect(() => {
    applyThemeToReader();
  }, [applyThemeToReader]);

  useEffect(() => {
    if (readerReadyRef.current) {
      runReaderCommand(`window.__WK_EPUB__?.setAnnotations?.(${JSON.stringify(annotations)})`);
    }
  }, [annotations, runReaderCommand]);

  useEffect(() => {
    if (
      isLookupModalVisible &&
      (selectedLookupSurfaceText || selectedLookupItem?.characters)
    ) {
      const payload = JSON.stringify({
        text: selectedLookupSurfaceText || selectedLookupItem?.characters,
      });
      runReaderCommand(`window.__WK_EPUB__?.setLookupSelection?.(${payload})`);
      return;
    }

    runReaderCommand("window.__WK_EPUB__?.clearLookupSelection?.()");
  }, [
    isLookupModalVisible,
    runReaderCommand,
    selectedLookupItem?.characters,
    selectedLookupSurfaceText,
  ]);

  useEffect(() => {
    const chipOpacity = isTopBarVisible ? "1" : "0";
    const chipVisibility = isTopBarVisible ? "visible" : "hidden";
    runReaderCommand(
      `window.__WK_EPUB__?.setChromeVisible?.(${isTopBarVisible});
      (function () {
        const chip = document.getElementById("wk-page-chip");
        if (!chip) {
          return;
        }
        chip.style.opacity = "${chipOpacity}";
        chip.style.visibility = "${chipVisibility}";
      })();`
    );
  }, [isTopBarVisible, runReaderCommand]);

  useEffect(() => {
    if (topBarHeight <= 0) {
      return;
    }

    const recalculateTimer = setTimeout(() => {
      runReaderCommand("window.__WK_EPUB__?.recalc?.()");
    }, 80);

    return () => {
      clearTimeout(recalculateTimer);
    };
  }, [runReaderCommand, topBarHeight]);

  useEffect(() => {
    if (!book || isLoading || isReaderPositioning) {
      stopReadingClock();
      void flushReadingClock();
      return;
    }

    if (appStateRef.current === "active") {
      startReadingClock();
    }
  }, [
    book,
    flushReadingClock,
    isLoading,
    isReaderPositioning,
    startReadingClock,
    stopReadingClock,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasActive = appStateRef.current === "active";
      const isActive = nextState === "active";
      appStateRef.current = nextState;

      if (wasActive && !isActive) {
        void progressSaver.flush();
        stopReadingClock();
        void flushReadingClock();
        return;
      }

      if (
        isActive &&
        book &&
        !isLoading &&
        !isReaderPositioning &&
        sessionStartedAtRef.current === null
      ) {
        startReadingClock();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [
    book,
    flushReadingClock,
    isLoading,
    isReaderPositioning,
    progressSaver,
    startReadingClock,
    stopReadingClock,
  ]);

  useEffect(() => {
    if (readingFlushTimerRef.current) {
      clearInterval(readingFlushTimerRef.current);
    }

    readingFlushTimerRef.current = setInterval(() => {
      void flushReadingClock();
    }, 20000);

    return () => {
      if (readingFlushTimerRef.current) {
        clearInterval(readingFlushTimerRef.current);
        readingFlushTimerRef.current = null;
      }
    };
  }, [flushReadingClock]);

  useEffect(() => {
    return () => {
      stopReadingClock();
      void flushReadingClock();
      void progressSaver.flush();
      if (revealReaderTimerRef.current) {
        clearTimeout(revealReaderTimerRef.current);
      }
      if (readingFlushTimerRef.current) {
        clearInterval(readingFlushTimerRef.current);
      }
      clearChromeHideTimer();
    };
  }, [clearChromeHideTimer, flushReadingClock, progressSaver, stopReadingClock]);

  if (isLoading) {
    return (
      <View style={[styles.centerState, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar style={theme.statusBarStyle} />
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.centerStateText, { color: theme.textSecondary }]}>Opening EPUB...</Text>
      </View>
    );
  }

  if (loadError || !book) {
    return (
      <View style={[styles.centerState, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar style={theme.statusBarStyle} />
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="alert-circle-outline" size={64} color={theme.error} />
        <Text style={[styles.errorTitle, { color: theme.textColor }]}>Could not open EPUB</Text>
        <Text style={[styles.errorSubtitle, { color: theme.textSecondary }]}>
          {loadError || "Unknown reader error"}
        </Text>
        <TouchableOpacity
          style={[styles.errorButton, { backgroundColor: theme.primary }]}
          onPress={() => router.back()}
          activeOpacity={0.8}
        >
          <Text style={styles.errorButtonText}>Back to Library</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const initialPageForWebView = Math.max(1, Math.floor(book.metadata.lastReadPage || 1));
  const isCurrentPageBookmarked = annotations.some((item) => item.kind === "bookmark" && item.page === currentPage);
  const readerTopInset = Math.max(topBarHeight, insets.top + 6);
  const readerBottomInset = Math.max(insets.bottom, 10);
  const topEdgeRevealHeight = Math.max(readerTopInset, insets.top + 20);
  const bottomEdgeRevealHeight = Math.max(readerBottomInset, insets.bottom + 20);
  const selectedLookupColor = selectedLookupItem ? getItemColor(selectedLookupItem.type) : theme.primary;
  const selectedLookupReading =
    selectedLookupItem?.readings?.find((reading) => reading.primary)?.reading ||
    selectedLookupItem?.readings?.[0]?.reading ||
    "";
  const selectedLookupInflectionLabels =
    selectedLookupItem && selectedLookupSurfaceText
      ? getVerbInflectionLabelsForMatch(
          selectedLookupItem,
          selectedLookupSurfaceText
        )
      : [];
  const isSelectedLookupWaniKaniBacked = isWaniKaniBackedMatch(selectedLookupItem);
  const selectedLookupJpdbKanjiComposition =
    selectedLookupItem &&
    !isSelectedLookupWaniKaniBacked &&
    (selectedLookupItem.type === "vocabulary" ||
      selectedLookupItem.type === "kana_vocabulary")
      ? (selectedLookupItem as VocabularyMatch).jpdbKanjiComposition ?? []
      : [];
  const selectedLookupTypeLabel =
    selectedLookupItem?.type === "kana_vocabulary"
      ? "Kana vocabulary"
      : selectedLookupItem?.type === "vocabulary"
        ? "Vocabulary"
        : "Kanji";
  const webViewSource = book.htmlUri
    ? { uri: book.htmlUri }
    : { html: book.html || "<!doctype html><html><body></body></html>" };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />
      <Stack.Screen options={{ headerShown: false }} />

      <WebView
        ref={webViewRef}
        source={webViewSource}
        originWhitelist={["*"]}
        injectedJavaScriptBeforeContentLoaded={`window.__WK_EPUB_INITIAL_PAGE__ = ${initialPageForWebView}; true;`}
        onMessage={handleBridgeMessage}
        onLoadEnd={() => {
          applyThemeToReader();
          scheduleChromeAutoHide(1600);
        }}
        javaScriptEnabled
        domStorageEnabled
        bounces={false}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        setSupportMultipleWindows={false}
        allowsInlineMediaPlayback
        style={[
          styles.webView,
          {
            marginTop: readerTopInset,
            marginBottom: readerBottomInset,
            opacity: isReaderPositioning ? 0 : 1,
          },
        ]}
      />

      {!isTopBarVisible && !isLookupModalVisible ? (
        <>
          <TouchableOpacity
            style={[styles.chromeRevealEdgeTop, { height: topEdgeRevealHeight }]}
            activeOpacity={1}
            onPress={() => revealChrome(2400)}
          />
          <TouchableOpacity
            style={[styles.chromeRevealEdgeBottom, { height: bottomEdgeRevealHeight }]}
            activeOpacity={1}
            onPress={() => revealChrome(2400)}
          />
        </>
      ) : null}

      {isReaderPositioning ? (
        <View style={[styles.positioningOverlay, { backgroundColor: theme.backgroundColor }]}>
          <View
            style={[
              styles.positioningCard,
              {
                backgroundColor: theme.cardBackground,
                borderColor: theme.border,
              },
            ]}
          >
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.positioningTitle, { color: theme.textColor }]}>
              Opening your page
            </Text>
            <Text style={[styles.positioningSubtitle, { color: theme.textSecondary }]}>
              Jumping to page {initialPageForWebView}
            </Text>
          </View>
        </View>
      ) : null}

      {isTopBarVisible ? (
        <View
          style={[
            styles.topBar,
            {
              paddingTop: insets.top + 6,
              backgroundColor: theme.isDark ? "rgba(0, 0, 0, 0.38)" : "rgba(255, 255, 255, 0.66)",
              borderBottomColor: theme.border,
            },
          ]}
          onLayout={handleTopBarLayout}
        >
          <TouchableOpacity
            style={[styles.iconButton, { borderColor: theme.border, backgroundColor: theme.cardBackground }]}
            onPress={() => router.back()}
            activeOpacity={0.8}
          >
            <Ionicons name="arrow-back" size={20} color={theme.textColor} />
          </TouchableOpacity>

          <View style={styles.titleWrap}>
            <Text style={[styles.title, { color: theme.textColor }]} numberOfLines={1}>
              {book.metadata.title}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Page {currentPage} / {totalPages}
            </Text>
          </View>
          <Pressable
            style={[styles.annotationButton, { opacity: isSavingAnnotation || isReaderPositioning || !annotationsLoadedRef.current ? 0.45 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={isCurrentPageBookmarked ? "Remove bookmark from this page" : "Bookmark this page"}
            accessibilityState={{ selected: isCurrentPageBookmarked, disabled: isSavingAnnotation || isReaderPositioning || !annotationsLoadedRef.current }}
            disabled={isSavingAnnotation || isReaderPositioning || !annotationsLoadedRef.current}
            onPress={() => {
              if (annotationSaveInFlightRef.current) return;
              annotationSaveInFlightRef.current = true;
              setIsSavingAnnotation(true);
              runReaderCommand("window.__WK_EPUB__?.captureBookmark?.()");
            }}
          >
            <Ionicons name={isCurrentPageBookmarked ? "bookmark" : "bookmark-outline"} size={20} color={isCurrentPageBookmarked ? theme.primary : theme.textSecondary} />
          </Pressable>
          <Pressable
            style={styles.annotationButton}
            accessibilityRole="button"
            accessibilityLabel="Open bookmarks and highlights"
            onPress={() => {
              clearChromeHideTimer();
              setIsSavedPassagesVisible(true);
            }}
          >
            <Ionicons name="list-outline" size={22} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : null}

      {selection && !isLookupModalVisible && !isSavedPassagesVisible ? (
        <View style={[styles.selectionActions, { bottom: readerBottomInset + 12, backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
          {annotationError ? <Text style={{ color: theme.error, flexShrink: 1 }}>{annotationError}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Highlight selected passage" disabled={isSavingAnnotation || !annotationsLoadedRef.current} onPress={saveHighlight} style={styles.highlightAction}>
            <Ionicons name="pencil-outline" size={18} color={theme.primary} />
            <Text style={{ color: theme.primary, fontSize: 15, fontWeight: "600" }}>{isSavingAnnotation ? "Saving…" : "Highlight"}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel text selection" style={styles.annotationButton} onPress={() => {
            setSelection(null);
            runReaderCommand("window.__WK_EPUB__?.clearSelection?.()");
          }}>
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>
      ) : null}

      {annotationError && !selection && !isSavedPassagesVisible && isTopBarVisible ? (
        <Pressable onPress={() => setIsSavedPassagesVisible(true)} style={[styles.annotationError, { top: readerTopInset, backgroundColor: theme.cardBackground }]}>
          <Text style={{ color: theme.error, fontSize: 13 }}>{annotationError}</Text>
        </Pressable>
      ) : null}

      <EpubSavedPassagesSheet
        visible={isSavedPassagesVisible}
        annotations={annotations}
        isSaving={isSavingAnnotation}
        error={annotationError}
        onClose={() => { setIsSavedPassagesVisible(false); scheduleChromeAutoHide(2400); }}
        onOpen={(annotation) => {
          setIsSavedPassagesVisible(false);
          setSelection(null);
          runReaderCommand("window.__WK_EPUB__?.clearSelection?.()");
          runReaderCommand(`window.__WK_EPUB__?.goToAnnotation?.(${JSON.stringify(annotation)})`);
          scheduleChromeAutoHide(2400);
        }}
        onDelete={(annotation) => {
          if (!annotationSaveInFlightRef.current) void commitAnnotations(annotations.filter((item) => item.id !== annotation.id));
        }}
      />

      <Modal
        visible={isLookupModalVisible}
        transparent
        animationType="none"
        onRequestClose={closeLookupSheet}
        statusBarTranslucent
      >
        <View style={styles.lookupModalRoot}>
          <TouchableWithoutFeedback onPress={closeLookupSheet}>
            <View style={styles.lookupBackdrop} />
          </TouchableWithoutFeedback>

          <Animated.View
            style={[
              styles.lookupSheetWrap,
              {
                opacity: lookupSheetOpacity,
                transform: [{ translateY: lookupSheetTranslateY }],
              },
            ]}
          >
            <View
              style={[
                styles.lookupSheet,
                {
                  backgroundColor: theme.cardBackground,
                },
              ]}
            >
              {selectedLookupItem ? (
                <>
                  <View style={[styles.lookupHeader, { backgroundColor: selectedLookupColor }]}>
                    <Text style={[styles.lookupCharacters, fontStyles.japaneseText]}>
                      {selectedLookupItem.characters}
                    </Text>
                    <View style={styles.lookupLevelBadge}>
                      <Text style={styles.lookupLevelBadgeText}>
                        {isSelectedLookupWaniKaniBacked
                          ? `Lv ${selectedLookupItem.level}`
                          : "JPDB"}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={[
                      styles.lookupContent,
                      { paddingBottom: 16 + Math.max(insets.bottom, 8) },
                    ]}
                  >
                    <View style={styles.lookupRow}>
                      <Text style={[styles.lookupLabel, { color: theme.textSecondary }]}>Type</Text>
                      <Text style={[styles.lookupValue, { color: theme.textColor }]}>
                        {selectedLookupTypeLabel}
                      </Text>
                    </View>

                    {selectedLookupReading ? (
                      <View style={styles.lookupRow}>
                        <Text style={[styles.lookupLabel, { color: theme.textSecondary }]}>
                          Reading
                        </Text>
                        <Text
                          style={[styles.lookupValue, { color: theme.textColor }, fontStyles.japaneseText]}
                        >
                          {selectedLookupReading}
                        </Text>
                      </View>
                    ) : null}

                    <View style={styles.lookupRow}>
                      <Text style={[styles.lookupLabel, { color: theme.textSecondary }]}>Meaning</Text>
                      <Text style={[styles.lookupValue, { color: theme.textColor }]}>
                        {selectedLookupItem.meaning}
                      </Text>
                    </View>

                    {selectedLookupJpdbKanjiComposition.length > 0 ? (
                      <View style={styles.lookupRow}>
                        <Text style={[styles.lookupLabel, { color: theme.textSecondary }]}>
                          Kanji
                        </Text>
                        <View style={styles.lookupKanjiCompositionWrap}>
                          {selectedLookupJpdbKanjiComposition.map((kanjiEntry) => (
                            <TouchableOpacity
                              key={`epub-jpdb-kanji-${kanjiEntry.id}`}
                              style={[
                                styles.lookupKanjiChip,
                                { borderColor: theme.border },
                              ]}
                              onPress={() => openLookupSubject(kanjiEntry.id)}
                              activeOpacity={0.75}
                            >
                              <Text
                                style={[
                                  styles.lookupKanjiChipText,
                                  { color: theme.textColor },
                                ]}
                              >
                                {kanjiEntry.characters}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {selectedLookupInflectionLabels.length > 0 ? (
                      <View style={styles.lookupRow}>
                        <Text style={[styles.lookupLabel, { color: theme.textSecondary }]}>
                          Form:
                        </Text>
                        <Text style={[styles.lookupValue, { color: theme.textColor }]}>
                          {selectedLookupInflectionLabels.join(", ")}
                        </Text>
                      </View>
                    ) : null}

                    {isSelectedLookupWaniKaniBacked ? (
                      <TouchableOpacity
                        style={[styles.lookupButton, { backgroundColor: selectedLookupColor }]}
                        onPress={openLookupDetails}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.lookupButtonText}>View details</Text>
                        <Ionicons name="arrow-forward" size={16} color="#fff" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </>
              ) : null}
            </View>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
  positioningOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  positioningCard: {
    minWidth: 220,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    alignItems: "center",
    gap: 8,
  },
  positioningTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  positioningSubtitle: {
    fontSize: 13,
  },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 2,
    fontSize: 12,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  annotationButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  selectionActions: { position: "absolute", alignSelf: "center", flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 8, paddingLeft: 12, maxWidth: "90%" },
  highlightAction: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingRight: 8 },
  annotationError: { position: "absolute", left: 0, right: 0, padding: 12 },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  centerStateText: {
    marginTop: 14,
    fontSize: 14,
  },
  errorTitle: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: "700",
  },
  errorSubtitle: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
  errorButton: {
    marginTop: 16,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  errorButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  lookupModalRoot: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  lookupBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  lookupSheetWrap: {
    paddingTop: 48,
  },
  lookupSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: "hidden",
    width: "100%",
    shadowColor: "rgba(0,0,0,0.35)",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  lookupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  lookupCharacters: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "800",
    color: "#fff",
    flexShrink: 1,
  },
  lookupLevelBadge: {
    marginLeft: 10,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.24)",
  },
  lookupLevelBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  lookupContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
    gap: 10,
  },
  lookupRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  lookupLabel: {
    fontSize: 13,
    minWidth: 62,
    fontWeight: "600",
  },
  lookupValue: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "500",
  },
  lookupKanjiCompositionWrap: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  lookupKanjiChip: {
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lookupKanjiChipText: {
    ...fontStyles.japaneseChip,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  lookupInflectionNote: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: -4,
  },
  lookupButton: {
    marginTop: 4,
    borderRadius: 10,
    height: 42,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  lookupButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  chromeRevealEdgeTop: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 8,
  },
  chromeRevealEdgeBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 8,
  },
});
