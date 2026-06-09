import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import React, {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Pressable,
  Platform,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  UIManager,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { CoachMarks, CoachMarkStep } from "../../src/components/CoachMarks";
import { VocabularyTooltip } from "../../src/components/VocabularyTooltip";
import { azureSpeechService } from "../../src/utils/azureSpeech";
import { azureTranslatorService } from "../../src/utils/azureTranslator";
import { getAllSubjects } from "../../src/utils/cache";
import { fontStyles } from "../../src/utils/fonts";
import { getStoredJpdbApiKey } from "../../src/utils/jpdbApi";
import { saveTextHistory } from "../../src/utils/searchHistory";
import {
  findVocabularyMatchesWithJpdbFirstPass as findMatchesUtil,
  getHighlightSegments,
  getItemColor,
  isWaniKaniBackedMatch,
  JpdbParsedTokenAnnotation,
  KanjiMatch,
  VocabularyMatch,
} from "../../src/utils/textHighlighting";
import { withAlpha } from "../../src/utils/subjectColors";
import { useTheme } from "../../src/utils/theme";
import { useAuthStore } from "../../src/utils/store";
import {
  TRANSLATOR_TUTORIAL_STEPS,
  TUTORIAL_STORAGE_KEYS,
} from "../../src/utils/tutorialSteps";

type TranslationDirection = "en-ja" | "ja-en";
type StudyMode = "none" | "wk" | "full";
const GRAMMAR_TOOLTIP_ID_MIN = -9000000;
const TOKEN_UNDERLINE_SEPARATOR = "\u200A";
const FULLSCREEN_BUTTON_HIT_SLOP = { top: 16, bottom: 16, left: 16, right: 16 } as const;
const FULLSCREEN_BUTTON_PRESS_RETENTION = {
  top: 20,
  bottom: 20,
  left: 20,
  right: 20,
} as const;

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

export default function TranslatorScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const { userData } = useAuthStore();
  const userLevel = userData?.level || 0;
  const { historyItem } = useLocalSearchParams<{ historyItem?: string }>();

  // Parse history item if provided
  const parsedHistoryItem = historyItem ? JSON.parse(historyItem) : null;

  // Translation state
  const [sourceText, setSourceText] = useState(
    parsedHistoryItem
      ? parsedHistoryItem.isEnglishMode
        ? parsedHistoryItem.inputText
        : parsedHistoryItem.japaneseText
      : ""
  );
  const [targetText, setTargetText] = useState(
    parsedHistoryItem
      ? parsedHistoryItem.isEnglishMode
        ? parsedHistoryItem.japaneseText
        : parsedHistoryItem.translation || ""
      : ""
  );
  const [direction, setDirection] = useState<TranslationDirection>(
    parsedHistoryItem?.isEnglishMode ? "en-ja" : "ja-en"
  );
  const [isTranslating, setIsTranslating] = useState(false);
  const [hasTranslated, setHasTranslated] = useState(!!parsedHistoryItem);

  // WaniKani matches
  const [vocabularyMatches, setVocabularyMatches] = useState<VocabularyMatch[]>(
    parsedHistoryItem?.vocabularyMatches || []
  );
  const [kanjiMatches, setKanjiMatches] = useState<KanjiMatch[]>(
    parsedHistoryItem?.kanjiMatches || []
  );
  const [isFindingMatches, setIsFindingMatches] = useState(false);

  // Study mode toggle (No highlights / WK chips / JPDB underlines)
  const [studyMode, setStudyMode] = useState<StudyMode>("none");
  const [hasStoredJpdbApiKey, setHasStoredJpdbApiKey] = useState(false);
  const [jpdbParsedTokens, setJpdbParsedTokens] = useState<JpdbParsedTokenAnnotation[]>([]);

  // Speech recognition state
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [permissionsGranted, setPermissionsGranted] = useState(false);

  // TTS state
  const [isSpeakingSource, setIsSpeakingSource] = useState(false);
  const [isSpeakingTarget, setIsSpeakingTarget] = useState(false);

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

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<"source" | "target" | null>(null);
  const [tooltipReady, setTooltipReady] = useState(false);
  const sourceInputRef = useRef<TextInput>(null);
  const tooltipDismissedAtRef = useRef(0);

  // Tutorial state
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialSteps, setTutorialSteps] = useState<CoachMarkStep[]>([]);
  const [isFirstVisit, setIsFirstVisit] = useState<boolean | null>(null);
  const highlightButtonRef = useRef<View>(null);
  const sourceCardRef = useRef<View>(null);
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

  // Animation for recording indicator
  const pulseAnim = useSharedValue(1);

  // Fullscreen animation values
  const sourceCardFlex = useSharedValue(1);
  const targetCardFlex = useSharedValue(1);
  const sourceCardOpacity = useSharedValue(1);
  const targetCardOpacity = useSharedValue(1);

  // Animated styles for cards
  const sourceCardAnimatedStyle = useAnimatedStyle(() => ({
    flex: sourceCardFlex.value,
    opacity: sourceCardOpacity.value,
    display: sourceCardOpacity.value === 0 ? "none" : "flex",
  }));

  const targetCardAnimatedStyle = useAnimatedStyle(() => ({
    flex: targetCardFlex.value,
    opacity: targetCardOpacity.value,
    display: targetCardOpacity.value === 0 ? "none" : "flex",
  }));

  const toggleFullscreen = useCallback((card: "source" | "target") => {
    const springConfig = { damping: 20, stiffness: 120 };
    if (expandedCard === card) {
      // Collapse back to normal
      setExpandedCard(null);
      sourceCardFlex.value = withSpring(1, springConfig);
      targetCardFlex.value = withSpring(1, springConfig);
      sourceCardOpacity.value = withTiming(1, { duration: 200 });
      targetCardOpacity.value = withTiming(1, { duration: 200 });
    } else {
      // Expand the selected card - slower fade for smoother transition
      setExpandedCard(card);
      if (card === "source") {
        sourceCardFlex.value = withSpring(1, springConfig);
        targetCardFlex.value = withSpring(0, springConfig);
        sourceCardOpacity.value = withTiming(1, { duration: 200 });
        targetCardOpacity.value = withTiming(0, { duration: 300 });
      } else {
        sourceCardFlex.value = withSpring(0, springConfig);
        targetCardFlex.value = withSpring(1, springConfig);
        sourceCardOpacity.value = withTiming(0, { duration: 300 });
        targetCardOpacity.value = withTiming(1, { duration: 200 });
      }
    }
  }, [expandedCard]);

  // Speech recognition event listeners
  useSpeechRecognitionEvent("start", () => {
    setIsRecognizing(true);
    setError(null);
    setInterimTranscript("");
    pulseAnim.value = withRepeat(
      withSequence(
        withTiming(1.2, { duration: 600 }),
        withTiming(1, { duration: 600 })
      ),
      -1,
      true
    );
  });

  useSpeechRecognitionEvent("end", () => {
    setIsRecognizing(false);
    setInterimTranscript("");
    pulseAnim.value = 1;
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (event.results && event.results.length > 0) {
      const recognizedText = event.results[0]?.transcript || "";
      if (event.isFinal) {
        const processedText =
          direction === "ja-en"
            ? filterJapaneseText(recognizedText)
            : recognizedText;

        if (processedText.trim()) {
          setSourceText(processedText);
          setInterimTranscript("");
        }
        stopRecognition();
      } else {
        setInterimTranscript(recognizedText);
      }
    }
  });

  useSpeechRecognitionEvent("error", (event) => {
    setIsRecognizing(false);
    setInterimTranscript("");
    pulseAnim.value = 1;

    let errorMessage = "Speech recognition failed";
    switch (event.error) {
      case "not-allowed":
        errorMessage =
          "Microphone permission denied. Please enable it in Settings.";
        break;
      case "no-speech":
        errorMessage = "No speech detected. Please try again.";
        break;
      default:
        errorMessage = event.message || "Unknown error occurred";
    }
    setError(errorMessage);
  });

  useEffect(() => {
    checkPermissions();
  }, []);

  useEffect(() => {
    let didCancel = false;

    const loadJpdbApiKey = async () => {
      try {
        const storedKey = await getStoredJpdbApiKey();
        if (!didCancel) {
          setHasStoredJpdbApiKey(Boolean(storedKey));
        }
      } catch (error) {
        console.error("Failed to read JPDB API key in translator:", error);
        if (!didCancel) {
          setHasStoredJpdbApiKey(false);
        }
      }
    };

    void loadJpdbApiKey();

    return () => {
      didCancel = true;
    };
  }, []);

  // Reset source highlighting visibility when direction changes to en-ja
  useEffect(() => {
    if (direction === "en-ja") {
      if (studyMode === "full" && !hasStoredJpdbApiKey) {
        setStudyMode("wk");
      }
    }
  }, [direction, studyMode, hasStoredJpdbApiKey]);

  // Clear matches when source text changes significantly
  useEffect(() => {
    if (!sourceText) {
      setVocabularyMatches([]);
      setKanjiMatches([]);
      setJpdbParsedTokens([]);
      setStudyMode("none");
    }
  }, [sourceText]);

  // Demo Japanese text for tutorial
  const DEMO_JAPANESE_TEXT = "日本語を勉強しています。毎日漢字を練習します。";

  // Check tutorial status on mount
  useEffect(() => {
    const checkTutorialStatus = async () => {
      try {
        const completed = await AsyncStorage.getItem(
          TUTORIAL_STORAGE_KEYS.TRANSLATOR_COMPLETED
        );
        if (!completed && !parsedHistoryItem) {
          // First visit - set up demo Japanese text
          setIsFirstVisit(true);
          setDirection("ja-en");
          setSourceText(DEMO_JAPANESE_TEXT);
        } else {
          setIsFirstVisit(false);
        }
      } catch (error) {
        console.error("Error checking translator tutorial status:", error);
        setIsFirstVisit(false);
      }
    };

    checkTutorialStatus();
  }, []);

  // Show tutorial after first visit is determined
  useEffect(() => {
    if (isFirstVisit && sourceText === DEMO_JAPANESE_TEXT) {
      // Delay to let UI render first
      setTimeout(() => {
        measureElementsAndShowTutorial();
      }, 500);
    }
  }, [isFirstVisit, sourceText]);

  // Measure UI elements and build tutorial steps with targets
  const measureElementsAndShowTutorial = useCallback(() => {
    const steps: CoachMarkStep[] = [];
    // On Android, measureInWindow returns coordinates that don't account for
    // the status bar when used with statusBarTranslucent modals
    const statusBarOffset =
      Platform.OS === "android" ? (StatusBar.currentHeight || 0) : 0;

    // Step 1: Welcome (no target, centered)
    steps.push({
      ...TRANSLATOR_TUTORIAL_STEPS[0],
      target: null,
    });

    // Step 2: Source input card
    if (sourceCardRef.current) {
      sourceCardRef.current.measureInWindow((x, y, width, height) => {
        steps.push({
          ...TRANSLATOR_TUTORIAL_STEPS[1],
          target: {
            x,
            y: y + statusBarOffset,
            width,
            height: Math.min(height, 150),
          },
        });
        continueWithHighlightButton(steps, statusBarOffset);
      });
    } else {
      steps.push({
        ...TRANSLATOR_TUTORIAL_STEPS[1],
        target: null,
      });
      continueWithHighlightButton(steps, statusBarOffset);
    }
  }, []);

  const continueWithHighlightButton = useCallback((
    steps: CoachMarkStep[],
    statusBarOffset: number,
  ) => {
    // Step 3: WK Study Mode button
    if (highlightButtonRef.current) {
      highlightButtonRef.current.measureInWindow((x, y, width, height) => {
        steps.push({
          ...TRANSLATOR_TUTORIAL_STEPS[2],
          target: { x, y: y + statusBarOffset, width, height },
        });
        setTutorialSteps(steps);
        setShowTutorial(true);
      });
    } else {
      steps.push({
        ...TRANSLATOR_TUTORIAL_STEPS[2],
        target: null,
      });
      setTutorialSteps(steps);
      setShowTutorial(true);
    }
  }, []);

  // Handle tutorial completion
  const handleTutorialComplete = useCallback(async () => {
    setShowTutorial(false);
    setIsFirstVisit(false);
    try {
      await AsyncStorage.setItem(TUTORIAL_STORAGE_KEYS.TRANSLATOR_COMPLETED, "true");
    } catch (error) {
      console.error("Error saving translator tutorial completion:", error);
    }
  }, []);

  const checkPermissions = async () => {
    try {
      const available =
        await ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (!available) return;

      const result = await ExpoSpeechRecognitionModule.getPermissionsAsync();
      setPermissionsGranted(result.granted);
    } catch (err) {
      console.error("Error checking permissions:", err);
    }
  };

  const requestPermissions = async () => {
    try {
      const result =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      setPermissionsGranted(result.granted);
      return result.granted;
    } catch (err) {
      console.error("Error requesting permissions:", err);
      return false;
    }
  };

  const filterJapaneseText = (text: string): string => {
    const japaneseRegex =
      /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF\u3000-\u303F\uFF00-\uFFEF0-9\s\.,!\?\-]/g;
    const matches = text.match(japaneseRegex);
    return matches ? matches.join("").replace(/\s+/g, " ").trim() : "";
  };

  const startRecognition = async () => {
    if (!permissionsGranted) {
      const granted = await requestPermissions();
      if (!granted) {
        setError("Microphone permission is required for speech recognition");
        return;
      }
    }

    try {
      setError(null);
      const lang = direction === "ja-en" ? "ja-JP" : "en-US";
      await ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: true,
        continuous: false,
        requiresOnDeviceRecognition: false,
        addsPunctuation: true,
      });
    } catch (err) {
      console.error("Error starting speech recognition:", err);
      setError("Failed to start speech recognition");
    }
  };

  const stopRecognition = async () => {
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (err) {
      console.error("Error stopping speech recognition:", err);
    }
  };

  const handleSwapDirection = () => {
    setStudyMode("none");
    setDirection(direction === "en-ja" ? "ja-en" : "en-ja");
    const tempSource = sourceText;
    setSourceText(targetText);
    setTargetText(tempSource);
    setVocabularyMatches([]);
    setKanjiMatches([]);
    setHasTranslated(false);
  };

  const findMatches = async (text: string) => {
    if (!text.trim()) {
      setVocabularyMatches([]);
      setKanjiMatches([]);
      setJpdbParsedTokens([]);
      return { vocabMatches: [], kanjiMatchesFound: [] };
    }

    setIsFindingMatches(true);
    try {
      const allSubjects = await getAllSubjects();
      const {
        vocabularyMatches: vocabMatches,
        kanjiMatches: kanjiMatchesFound,
        jpdbParsedTokens: parsedTokens,
      } = await findMatchesUtil(text, allSubjects);

      setVocabularyMatches(vocabMatches);
      setKanjiMatches(kanjiMatchesFound);
      setJpdbParsedTokens(Array.isArray(parsedTokens) ? parsedTokens : []);

      return { vocabMatches, kanjiMatchesFound };
    } catch (err) {
      console.error("Error finding matches:", err);
      setJpdbParsedTokens([]);
      return { vocabMatches: [], kanjiMatchesFound: [] };
    } finally {
      setIsFindingMatches(false);
    }
  };

  const handleTranslate = async () => {
    if (!sourceText.trim()) return;

    Keyboard.dismiss();
    setIsTranslating(true);
    setError(null);

    try {
      const [fromLang, toLang] =
        direction === "en-ja" ? ["en", "ja"] : ["ja", "en"];
      const translated = await azureTranslatorService.translate(
        sourceText,
        fromLang,
        toLang
      );
      setTargetText(translated);
      setHasTranslated(true);

      // Find WaniKani matches in the Japanese text
      const japaneseText = direction === "en-ja" ? translated : sourceText;
      const { vocabMatches, kanjiMatchesFound } = await findMatches(japaneseText);

      // Save to history
      await saveTextHistory({
        inputText: sourceText,
        japaneseText,
        translation: direction === "en-ja" ? undefined : translated,
        vocabularyMatchCount: vocabMatches.length,
        kanjiMatchCount: kanjiMatchesFound.length,
        isEnglishMode: direction === "en-ja",
        vocabularyMatches: vocabMatches.map((m) => ({
          id: m.id,
          characters: m.characters,
          meaning: m.meaning,
          type: m.type,
          level: m.level,
          readings: m.readings,
          verbConjugationKind: m.verbConjugationKind,
          matchCandidates: m.matchCandidates,
        })),
        kanjiMatches: kanjiMatchesFound.map((m) => ({
          id: m.id,
          characters: m.characters,
          meaning: m.meaning,
          type: m.type,
          level: m.level,
          readings: m.readings,
        })),
      });
    } catch (err) {
      console.error("Translation error:", err);
      setError("Translation failed. Please try again.");
    } finally {
      setIsTranslating(false);
    }
  };

  const selectStudyMode = useCallback(
    async (mode: StudyMode) => {
      if (mode === "full" && !hasStoredJpdbApiKey) {
        router.push({
          pathname: "/settings",
          params: { scrollTo: "jpdbApiKey" },
        });
        return;
      }

      if (mode === "none") {
        setStudyMode(mode);
        return;
      }

      const japaneseTextForMode = direction === "ja-en" ? sourceText : targetText;
      if (!japaneseTextForMode.trim()) {
        setStudyMode(mode);
        return;
      }

      if (
        vocabularyMatches.length === 0 &&
        kanjiMatches.length === 0 &&
        jpdbParsedTokens.length === 0
      ) {
        await findMatches(japaneseTextForMode);
      }

      setStudyMode(mode);
    },
    [
      direction,
      hasStoredJpdbApiKey,
      jpdbParsedTokens.length,
      kanjiMatches.length,
      router,
      sourceText,
      targetText,
      vocabularyMatches.length,
    ]
  );

  const handleSpeakSource = async () => {
    if (direction !== "ja-en" || !sourceText.trim()) return;

    if (isSpeakingSource) {
      await azureSpeechService.stop();
      setIsSpeakingSource(false);
      return;
    }

    try {
      setIsSpeakingSource(true);
      await azureSpeechService.speak(
        sourceText,
        () => {},
        () => setIsSpeakingSource(false),
        () => setIsSpeakingSource(false)
      );
    } catch (error) {
      console.error("Error speaking:", error);
      setIsSpeakingSource(false);
    }
  };

  const handleSpeakTarget = async () => {
    if (direction !== "en-ja" || !targetText.trim()) return;

    if (isSpeakingTarget) {
      await azureSpeechService.stop();
      setIsSpeakingTarget(false);
      return;
    }

    try {
      setIsSpeakingTarget(true);
      await azureSpeechService.speak(
        targetText,
        () => {},
        () => setIsSpeakingTarget(false),
        () => setIsSpeakingTarget(false)
      );
    } catch (error) {
      console.error("Error speaking:", error);
      setIsSpeakingTarget(false);
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
      if (Date.now() - tooltipDismissedAtRef.current < 220) {
        return;
      }

      const item =
        itemOverride ??
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
        requestAnimationFrame(() => {
          setTooltipReady(true);
          tooltipOpacity.value = withTiming(1, {
            duration: interactionMode === "hover" ? 120 : 200,
          });
        });
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
            if (
              Number.isFinite(x) &&
              Number.isFinite(y) &&
              Number.isFinite(width) &&
              Number.isFinite(height) &&
              width > 0 &&
              height > 0
            ) {
              openTooltipAtAnchor(x, y, width, height, "measure");
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
        measurementTarget.measureInWindow((x: number, y: number, width: number, height: number) => {
          if (
            Number.isFinite(x) &&
            Number.isFinite(y) &&
            Number.isFinite(width) &&
            Number.isFinite(height) &&
            width > 0 &&
            height > 0
          ) {
            openTooltipAtAnchor(x, y, width, height, "measure");
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
    [kanjiMatches, tooltipOpacity, vocabularyMatches]
  );

  const handleCloseTooltip = useCallback(() => {
    tooltipDismissedAtRef.current = Date.now();
    tooltipOpacity.value = 0;
    setTooltipReady(false);
    setSelectedItem(null);
    setSelectedSurfaceText(null);
    setSelectedTokenKey(null);
    setTooltipInteractionMode(null);
    setTooltipPosition(null);
  }, []);

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
    [handleCloseTooltip, selectedTokenKey, tooltipInteractionMode]
  );

  const handleViewDetails = useCallback(() => {
    if (selectedItem && isWaniKaniBackedMatch(selectedItem)) {
      handleCloseTooltip();
      router.push(`/subject/${selectedItem.id}`);
    }
  }, [selectedItem, router, handleCloseTooltip]);

  const handleClose = () => router.back();

  const handleShowHistory = () => router.push("/text-history");

  // Highlight rendering - matching song-lyrics.tsx implementation
  const highlightMatchesInText = (text: string, textColor: string = "white"): ReactElement => {
    if (!text) {
      return (
        <Text style={[styles.outputText, { color: textColor }, fontStyles.japaneseText]}>
          {text}
        </Text>
      );
    }

    const allMatches = [...vocabularyMatches, ...kanjiMatches];

    if (allMatches.length === 0) {
      return (
        <Text style={[styles.outputText, { color: textColor }, fontStyles.japaneseText]}>
          {text}
        </Text>
      );
    }

    const segments = getHighlightSegments(text, allMatches);

    return (
      <Text style={[styles.highlightedTextWrapper, { color: textColor }, fontStyles.japaneseText]}>
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
              onPress={(e) =>
                handleVocabularyPress(highlight.id, segment.text, e)
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
                  <View style={[styles.levelBadgeChip, { backgroundColor: color }]}>
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

  const renderUnderlinedAnalyzedText = (
    text: string,
    textColor: string,
    baseTextStyle: any
  ): ReactElement => {
    if (!text) {
      return <Text style={[baseTextStyle, { color: textColor }]}>{text}</Text>;
    }

    type ParsedInlineSegment = {
      text: string;
      tokenType: "plain" | "grammar" | "verb" | "vocabulary";
      token?: JpdbParsedTokenAnnotation;
    };

    const textStartOffset = 0;
    const textEndOffset = text.length;
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

    const computedBaseTextStyle = [
      baseTextStyle,
      { color: textColor },
      fontStyles.japaneseText,
    ];

    return (
      <View style={styles.underlinedInlineContainer}>
        {inlineSegments.flatMap((segment, index) => {
          const renderedNodes: ReactElement[] = [];

          if (segment.tokenType === "plain" || !segment.token) {
            renderedNodes.push(
              <Text key={`plain-${index}`} style={computedBaseTextStyle}>
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
            textColor,
            theme.isDark ? 0.58 : 0.34
          );
          const selectedTokenBackground = withAlpha(
            underlineColor,
            theme.isDark ? 0.24 : 0.18
          );

          const tokenText = (
            <Text
              style={[
                computedBaseTextStyle,
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

          const nextSegment = inlineSegments[index + 1];
          const hasAdjacentHighlightedSegment =
            nextSegment &&
            nextSegment.tokenType !== "plain" &&
            Boolean(nextSegment.token);
          if (hasAdjacentHighlightedSegment) {
            renderedNodes.push(
              <Text
                key={`sep-${index}`}
                style={[computedBaseTextStyle, styles.inlineUnderlineSeparator]}
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

  const sourceIsJapanese = direction === "ja-en";
  const targetIsJapanese = direction === "en-ja";
  const fullModeEnabled = studyMode === "full" && hasStoredJpdbApiKey;
  const sourceHighlightEnabled =
    sourceIsJapanese && sourceText.trim().length > 0 && studyMode !== "none";
  const canShowModeSelector =
    (sourceIsJapanese && sourceText.trim().length > 0) ||
    (targetIsJapanese && targetText.trim().length > 0);

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: theme.backgroundColor }]}>
          <TouchableOpacity
            onPress={handleClose}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={theme.textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>
            Translate
          </Text>
          <TouchableOpacity
            onPress={handleShowHistory}
            style={styles.headerButton}
            activeOpacity={0.7}
          >
            <Ionicons name="time-outline" size={24} color={theme.textColor} />
          </TouchableOpacity>
        </View>

        {/* Language Selector */}
        <View style={styles.languageSelector}>
          <TouchableOpacity
            style={[styles.languageButton, { backgroundColor: theme.cardBackground }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.languageText, { color: theme.textColor }]}>
              {direction === "en-ja" ? "ENGLISH" : "JAPANESE"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.swapButton, { backgroundColor: theme.textSecondary }]}
            onPress={handleSwapDirection}
            activeOpacity={0.7}
          >
            <Ionicons name="swap-horizontal" size={20} color="white" />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.languageButton, { backgroundColor: theme.primary }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.languageText, { color: "white" }]}>
              {direction === "en-ja" ? "JAPANESE" : "ENGLISH"}
            </Text>
          </TouchableOpacity>
        </View>

        {canShowModeSelector ? (
          <View style={styles.studyModeSelectorRow}>
            <TouchableOpacity
              style={[
                styles.studyModeChip,
                { borderColor: theme.border, backgroundColor: theme.cardBackground },
                studyMode === "none" && { backgroundColor: theme.textSecondary },
              ]}
              onPress={() => void selectStudyMode("none")}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.studyModeChipText,
                  { color: studyMode === "none" ? "white" : theme.textColor },
                ]}
              >
                No Study
              </Text>
            </TouchableOpacity>

            <View ref={highlightButtonRef}>
              <TouchableOpacity
                style={[
                  styles.studyModeChip,
                  { borderColor: theme.border, backgroundColor: theme.cardBackground },
                  studyMode === "wk" && { backgroundColor: theme.primary },
                ]}
                onPress={() => void selectStudyMode("wk")}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.studyModeChipText,
                    { color: studyMode === "wk" ? "white" : theme.textColor },
                  ]}
                >
                  WK Study
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.studyModeChip,
                { borderColor: theme.border, backgroundColor: theme.cardBackground },
                studyMode === "full" && hasStoredJpdbApiKey
                  ? { backgroundColor: theme.primary }
                  : null,
              ]}
              onPress={() => void selectStudyMode("full")}
              activeOpacity={0.75}
            >
              <Text
                style={[
                  styles.studyModeChipText,
                  {
                    color:
                      studyMode === "full" && hasStoredJpdbApiKey
                        ? "white"
                        : hasStoredJpdbApiKey
                          ? theme.textColor
                          : theme.textSecondary,
                  },
                ]}
              >
                Full JPDB
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Main Content */}
        <View style={styles.cardsContainer}>
          {/* Source Card (Input) */}
          <Animated.View style={[styles.cardWrapper, sourceCardAnimatedStyle]}>
            {/* Fullscreen button - outside card for proper touch handling */}
            <TouchableOpacity
              style={[styles.fullscreenButton, { backgroundColor: theme.border }]}
              onPress={() => toggleFullscreen("source")}
              activeOpacity={0.7}
              hitSlop={FULLSCREEN_BUTTON_HIT_SLOP}
              pressRetentionOffset={FULLSCREEN_BUTTON_PRESS_RETENTION}
            >
              <Ionicons
                name={expandedCard === "source" ? "contract" : "expand"}
                size={16}
                color={theme.textSecondary}
              />
            </TouchableOpacity>
            <View ref={sourceCardRef} style={[styles.card, { backgroundColor: theme.cardBackground }]}>
              <ScrollView
              style={styles.cardScrollView}
              contentContainerStyle={styles.cardScrollContent}
              showsVerticalScrollIndicator={true}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              scrollEventThrottle={16}
              onScrollBeginDrag={Keyboard.dismiss}
            >
              {sourceHighlightEnabled ? (
                // Show highlighted text (non-editable) - using song-lyrics style
                <View
                  style={styles.highlightedContent}
                  onStartShouldSetResponder={() => false}
                  onMoveShouldSetResponder={() => false}
                >
                  {isFindingMatches ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={theme.primary} />
                      <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                        Finding matches...
                      </Text>
                    </View>
                  ) : (
                    fullModeEnabled
                      ? renderUnderlinedAnalyzedText(
                          sourceText,
                          theme.textColor,
                          styles.outputText
                        )
                      : highlightMatchesInText(sourceText, theme.textColor)
                  )}
                </View>
              ) : (
                <TextInput
                  ref={sourceInputRef}
                  style={[
                    styles.inputText,
                    { color: theme.textColor },
                    sourceIsJapanese && fontStyles.japaneseText,
                  ]}
                  value={isRecognizing ? interimTranscript || sourceText : sourceText}
                  onChangeText={(text) => {
                    setSourceText(text);
                    // Clear matches when text changes
                    if (vocabularyMatches.length > 0 || kanjiMatches.length > 0) {
                      setVocabularyMatches([]);
                      setKanjiMatches([]);
                    }
                    if (jpdbParsedTokens.length > 0) {
                      setJpdbParsedTokens([]);
                    }
                  }}
                  placeholder={sourceIsJapanese ? "日本語を入力..." : "Enter text..."}
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  textAlignVertical="top"
                  autoCorrect={false}
                  autoCapitalize="none"
                  maxLength={1000}
                />
              )}
            </ScrollView>
            <View style={styles.cardFooter}>
              <Text
                style={[
                  styles.charCount,
                  { color: sourceText.length >= 1000 ? theme.error : theme.textSecondary },
                ]}
              >
                {sourceText.length}/1000
              </Text>
              <View style={styles.cardActions}>
                {sourceText.length > 0 && !sourceHighlightEnabled && (
                  <TouchableOpacity
                    style={styles.cardActionButton}
                    onPress={() => {
                      setSourceText("");
                      setTargetText("");
                      setVocabularyMatches([]);
                      setKanjiMatches([]);
                      setJpdbParsedTokens([]);
                      setHasTranslated(false);
                      setStudyMode("none");
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="close" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
                {sourceIsJapanese && sourceText && (
                  <TouchableOpacity
                    style={[
                      styles.cardActionButton,
                      isSpeakingSource && { backgroundColor: theme.primary },
                    ]}
                    onPress={handleSpeakSource}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSpeakingSource ? "stop" : "volume-high"}
                      size={20}
                      color={isSpeakingSource ? "white" : theme.primary}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            </View>
          </Animated.View>

          {/* Action Buttons Row - hidden when a card is expanded */}
          {!expandedCard && (
            <View style={styles.actionButtonsRow}>
              <View style={[styles.actionButtonsContainer, { backgroundColor: theme.cardBackground }]}>
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    isRecognizing && { backgroundColor: theme.error },
                  ]}
                  onPress={isRecognizing ? stopRecognition : startRecognition}
                  activeOpacity={0.7}
                >
                  <Animated.View
                    style={isRecognizing ? { transform: [{ scale: pulseAnim }] } : undefined}
                  >
                    <Ionicons
                      name={isRecognizing ? "stop" : "mic"}
                      size={24}
                      color={isRecognizing ? "white" : theme.primary}
                    />
                  </Animated.View>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Target Card (Output) */}
          <Animated.View style={[styles.cardWrapper, targetCardAnimatedStyle]}>
            {/* Fullscreen button - outside card for proper touch handling */}
            <TouchableOpacity
              style={[styles.fullscreenButton, styles.fullscreenButtonTarget]}
              onPress={() => toggleFullscreen("target")}
              activeOpacity={0.7}
              hitSlop={FULLSCREEN_BUTTON_HIT_SLOP}
              pressRetentionOffset={FULLSCREEN_BUTTON_PRESS_RETENTION}
            >
              <Ionicons
                name={expandedCard === "target" ? "contract" : "expand"}
                size={16}
                color={theme.primary}
              />
            </TouchableOpacity>
            <View style={[styles.card, { backgroundColor: theme.primary }]}>
              <ScrollView
              style={styles.cardScrollView}
              contentContainerStyle={styles.cardScrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {isTranslating ? (
                <View style={styles.translatingContainer}>
                  <ActivityIndicator size="small" color="white" />
                  <Text style={styles.translatingText}>Translating...</Text>
                </View>
              ) : targetText ? (
                <View style={styles.highlightedContent}>
                  {targetIsJapanese && hasTranslated && studyMode !== "none"
                    ? fullModeEnabled
                      ? renderUnderlinedAnalyzedText(
                          targetText,
                          "white",
                          styles.outputText
                        )
                      : highlightMatchesInText(targetText, "white")
                    : <Text style={[styles.outputText, { color: "white" }]}>{targetText}</Text>
                  }
                </View>
              ) : (
                <Text style={[styles.placeholderText, { color: "rgba(255,255,255,0.6)" }]}>
                  Translation will appear here
                </Text>
              )}
            </ScrollView>
            <View style={[styles.cardFooter, { borderTopColor: "rgba(255,255,255,0.2)" }]}>
              <View />
              <View style={styles.cardActions}>
                {targetIsJapanese && targetText && (
                  <TouchableOpacity
                    style={[
                      styles.cardActionButton,
                      { backgroundColor: "rgba(255,255,255,0.2)" },
                      isSpeakingTarget && { backgroundColor: "white" },
                    ]}
                    onPress={handleSpeakTarget}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={isSpeakingTarget ? "stop" : "volume-high"}
                      size={20}
                      color={isSpeakingTarget ? theme.primary : "white"}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            </View>
          </Animated.View>
        </View>

        {/* Error Message */}
        {error && (
          <View style={[styles.errorContainer, { backgroundColor: theme.error + "20" }]}>
            <Ionicons name="alert-circle" size={20} color={theme.error} />
            <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
          </View>
        )}

        {/* Translate Button */}
        <View style={[styles.translateButtonContainer, { backgroundColor: theme.backgroundColor }]}>
          <TouchableOpacity
            style={[
              styles.translateButton,
              { backgroundColor: sourceText.trim() ? theme.primary : theme.textSecondary },
              !sourceText.trim() && { opacity: 0.5 },
            ]}
            onPress={handleTranslate}
            disabled={!sourceText.trim() || isTranslating}
            activeOpacity={0.8}
          >
            {isTranslating ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Ionicons name="language" size={22} color="white" />
                <Text style={styles.translateButtonText}>Translate</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Tooltip Modal - only render when position is ready */}
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
          />
        )}

        {/* Tutorial Coach Marks */}
        <CoachMarks
          steps={tutorialSteps}
          visible={showTutorial}
          onComplete={handleTutorialComplete}
          allowSkip={false}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  languageSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  languageButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    minWidth: 100,
    alignItems: "center",
  },
  languageText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  swapButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  studyModeSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  studyModeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  studyModeChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  cardsContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  cardWrapper: {
    flex: 1,
    position: "relative",
    paddingTop: 18, // Space for the button + larger hit area
    paddingRight: 10, // Space for the button + larger hit area
  },
  card: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    shadowColor: "rgba(0,0,0,0.1)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 2,
  },
  fullscreenButton: {
    position: "absolute",
    top: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 30,
    shadowColor: "rgba(0,0,0,0.2)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 3,
    elevation: 10,
  },
  fullscreenButtonTarget: {
    backgroundColor: "white",
  },
  cardScrollView: {
    flex: 1,
  },
  cardScrollContent: {
    flexGrow: 1,
  },
  highlightedContent: {
    flex: 1,
  },
  inputText: {
    fontSize: 18,
    lineHeight: 28,
    minHeight: 60,
  },
  outputText: {
    fontSize: 18,
    lineHeight: 36,
  },
  highlightedTextWrapper: {
    fontSize: 18,
    lineHeight: 52, // Increased for better chip spacing (matching song-lyrics)
  },
  placeholderText: {
    fontSize: 16,
    fontStyle: "italic",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(128,128,128,0.2)",
  },
  charCount: {
    fontSize: 12,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
  },
  cardActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonsRow: {
    alignItems: "center",
    marginVertical: -18,
    zIndex: 10,
  },
  actionButtonsContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "rgba(0,0,0,0.15)",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 4,
  },
  actionButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  translatingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  translatingText: {
    fontSize: 16,
    color: "white",
  },
  // Inline chip styles - matching song-lyrics.tsx
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
    opacity: 0,
  },
  translateButtonContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  translateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 28,
    gap: 8,
    shadowColor: "rgba(0,0,0,0.2)",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  translateButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "700",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    marginHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
  },
});
