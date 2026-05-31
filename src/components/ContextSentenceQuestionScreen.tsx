import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { BlurView } from "expo-blur";
import * as Haptics from "@/src/utils/haptics";
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  type KeyboardEvent,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSharedValue, withTiming } from "react-native-reanimated";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { ContextSentenceQuestion } from "../types/contextSentencePractice";
import type { ListeningSolutionMode } from "../types/listening";
import { azureSpeechService } from "../utils/azureSpeech";
import { getAllSubjects } from "../utils/cache";
import { fontStyles } from "../utils/fonts";
import {
  findVocabularyMatchesWithJpdbFirstPass,
  getHighlightSegments,
  isWaniKaniBackedMatch,
  type JpdbParsedTokenAnnotation,
  type KanjiMatch,
  type VocabularyMatch,
} from "../utils/textHighlighting";
import { useSubjectColors, withAlpha } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";
import { VocabularyTooltip } from "./VocabularyTooltip";
import KanaInput from "./TextToKanaInput";
import * as wanakana from "wanakana";

const { width } = Dimensions.get("window");
const { height } = Dimensions.get("window");
const BLANK_TOKEN = "＿＿＿";
const ANSWER_CARD_ANIMATION_MS = 430;
const NEXT_QUESTION_DELAY_MS = 460;
const ANDROID_AUTOFOCUS_DELAY_MS = 200;
const GRAMMAR_TOOLTIP_ID_MIN = -9000000;
const JPDB_FALLBACK_TOOLTIP_ID_MIN = -8000000;
const TOKEN_UNDERLINE_SEPARATOR = "\u200A";
const CONTEXT_AUDIO_SPEED_MIN = 0.5;
const CONTEXT_AUDIO_SPEED_MAX = 1.5;
const CONTEXT_AUDIO_SPEED_STEP = 0.05;
const DEFAULT_CONTEXT_AUDIO_SPEED = 1;
const LEADING_OR_TRAILING_TILDE_PATTERN = /^[〜～~]+|[〜～~]+$/g;
const ALL_TILDE_PATTERN = /[〜～~]/g;
const CONTEXT_AUDIO_SPEED_STEPS = Math.round(
  (CONTEXT_AUDIO_SPEED_MAX - CONTEXT_AUDIO_SPEED_MIN) / CONTEXT_AUDIO_SPEED_STEP,
);

function inferFallbackVerbConjugationKind(
  partsOfSpeech: string[],
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
  tokenType: "verb" | "vocabulary",
): VocabularyMatch {
  const meaningText = token.meaning?.trim() || "Detected by JPDB parser.";
  const partsOfSpeechSummary = token.partsOfSpeech.filter(Boolean).join(", ");
  const details = partsOfSpeechSummary
    ? `${meaningText}\nPart of Speech: ${partsOfSpeechSummary}`
    : meaningText;
  const displayText = token.spelling || token.surface || token.reading || "Vocabulary";
  const hasKanji = /[\u3400-\u9FFF々]/.test(displayText);
  const matchCandidates = Array.from(
    new Set([token.surface, token.spelling, token.reading].filter(Boolean)),
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

function getTildeInsensitiveVariants(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  const variants = new Set<string>([trimmed]);
  const withoutEdgeTildes = trimmed.replace(LEADING_OR_TRAILING_TILDE_PATTERN, "");
  if (withoutEdgeTildes) {
    variants.add(withoutEdgeTildes);
  }

  const withoutAnyTildes = trimmed.replace(ALL_TILDE_PATTERN, "");
  if (withoutAnyTildes) {
    variants.add(withoutAnyTildes);
  }

  return Array.from(variants);
}

type KanaInputHandle = {
  flushKana: () => string;
  clearInput: () => void;
  focus: () => void;
};

interface PreviousAnswerItem {
  id: number;
  characters: string;
  backgroundColor: string;
  isCorrect: boolean;
}

interface ContextSentenceQuestionScreenProps {
  question: ContextSentenceQuestion;
  solutionMode: ListeningSolutionMode;
  useJapaneseKeyboard?: boolean;
  enableSentenceAudio?: boolean;
  autoPlaySentenceAudio?: boolean;
  showSentenceAudioSpeedControl?: boolean;
  hideTranslationUntilTap?: boolean;
  enableJpdbSentenceBreakdown?: boolean;
  stopAfterAnswer?: boolean;
  onAnswer: (isCorrect: boolean, answer: string) => void;
  onExit: () => void;
  currentItem: number;
  totalItems: number;
  correctAnswersCount: number;
  accuracyPercent: number;
}

export default function ContextSentenceQuestionScreen({
  question,
  solutionMode,
  useJapaneseKeyboard = false,
  enableSentenceAudio = false,
  autoPlaySentenceAudio = false,
  showSentenceAudioSpeedControl = false,
  hideTranslationUntilTap = false,
  enableJpdbSentenceBreakdown = false,
  stopAfterAnswer = false,
  onAnswer,
  onExit,
  currentItem,
  totalItems,
  correctAnswersCount,
  accuracyPercent,
}: ContextSentenceQuestionScreenProps) {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const insets = useSafeAreaInsets();

  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(
    null,
  );
  const [typedAnswer, setTypedAnswer] = useState("");
  const [answerFeedback, setAnswerFeedback] = useState<
    "correct" | "incorrect" | null
  >(null);
  const [showVocabInSentence, setShowVocabInSentence] = useState(false);
  const [previousAnswerItem, setPreviousAnswerItem] =
    useState<PreviousAnswerItem | null>(null);
  const [navigatingToDetail, setNavigatingToDetail] = useState(false);
  const [isSentenceAudioPlaying, setIsSentenceAudioPlaying] = useState(false);
  const [isSentenceAudioLoading, setIsSentenceAudioLoading] = useState(false);
  const [sentenceAudioSpeed, setSentenceAudioSpeed] = useState(
    DEFAULT_CONTEXT_AUDIO_SPEED,
  );
  const [isSentenceSpeedExpanded, setIsSentenceSpeedExpanded] = useState(false);
  const [isTranslationRevealed, setIsTranslationRevealed] = useState(false);
  const [hasAutoplayedSentence, setHasAutoplayedSentence] = useState(false);
  const [pendingAnswer, setPendingAnswer] = useState<{
    isCorrect: boolean;
    submittedAnswer: string;
  } | null>(null);
  const [showExpectedAnswer, setShowExpectedAnswer] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [vocabularyMatches, setVocabularyMatches] = useState<VocabularyMatch[]>(
    [],
  );
  const [kanjiMatches, setKanjiMatches] = useState<KanjiMatch[]>([]);
  const [jpdbParsedTokens, setJpdbParsedTokens] = useState<
    JpdbParsedTokenAnnotation[]
  >([]);
  const [cachedSubjects, setCachedSubjects] = useState<any[] | null>(null);
  const [selectedItem, setSelectedItem] = useState<
    VocabularyMatch | KanjiMatch | null
  >(null);
  const [selectedSurfaceText, setSelectedSurfaceText] = useState<string | null>(
    null,
  );
  const [selectedTokenKey, setSelectedTokenKey] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const tooltipOpacity = useSharedValue(0);
  const { grammarUnderlineColor, verbUnderlineColor, vocabUnderlineColor } =
    useMemo(
      () => ({
        grammarUnderlineColor: theme.isDark ? "#fbbf24" : "#b45309",
        verbUnderlineColor: theme.isDark ? "#34d399" : "#0f766e",
        vocabUnderlineColor: theme.isDark ? "#60a5fa" : "#1d4ed8",
      }),
      [theme.isDark],
    );

  const isWritingMode = solutionMode === "writing";
  const shouldShowSentenceSpeedControl =
    enableSentenceAudio && showSentenceAudioSpeedControl;
  const analyzedSentenceText = showVocabInSentence
    ? question.sentence
    : question.sentenceWithBlank;
  const canonicalAnswerText = question.vocab.data.characters?.trim() || "";
  const allMatches = useMemo(
    () => [...vocabularyMatches, ...kanjiMatches],
    [kanjiMatches, vocabularyMatches],
  );
  const vocabularyMatchesById = useMemo(
    () => new Map(vocabularyMatches.map((match) => [match.id, match])),
    [vocabularyMatches],
  );

  const vocabInputRef = useRef<KanaInputHandle | null>(null);
  const progressWidth = useRef(new Animated.Value(0)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const boxPositionX = useRef(new Animated.Value(0)).current;
  const boxPositionY = useRef(new Animated.Value(0)).current;
  const boxScale = useRef(new Animated.Value(1)).current;
  const boxOpacity = useRef(new Animated.Value(0)).current;
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  const [androidScreenLayoutHeight, setAndroidScreenLayoutHeight] = useState(0);
  const mountedRef = useRef(true);
  const androidBaselineScreenHeightRef = useRef(0);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      void azureSpeechService.stop();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const handleKeyboardDidShow = (event: KeyboardEvent) => {
      const nextHeight = Math.max(0, Math.round(event.endCoordinates?.height ?? 0));
      setAndroidKeyboardHeight(nextHeight);
    };

    const handleKeyboardDidHide = () => {
      setAndroidKeyboardHeight(0);
    };

    const showSubscription = Keyboard.addListener(
      "keyboardDidShow",
      handleKeyboardDidShow,
    );
    const hideSubscription = Keyboard.addListener(
      "keyboardDidHide",
      handleKeyboardDidHide,
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    if (androidKeyboardHeight > 0 || androidScreenLayoutHeight <= 0) return;
    androidBaselineScreenHeightRef.current = Math.max(
      androidBaselineScreenHeightRef.current,
      androidScreenLayoutHeight,
    );
  }, [androidKeyboardHeight, androidScreenLayoutHeight]);

  const handleScreenLayout = (event: LayoutChangeEvent) => {
    if (Platform.OS !== "android") return;
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    setAndroidScreenLayoutHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight,
    );
  };

  const syncAndroidKeyboardMetrics = useCallback(() => {
    if (Platform.OS !== "android") return;

    const syncMetrics = () => {
      if (!mountedRef.current) return;
      const keyboardMetrics = Keyboard.metrics();
      const measuredHeight = Math.max(0, Math.round(keyboardMetrics?.height ?? 0));
      if (measuredHeight > 0) {
        setAndroidKeyboardHeight(measuredHeight);
      }
    };

    requestAnimationFrame(syncMetrics);
    setTimeout(syncMetrics, 120);
  }, []);

  const stopSentenceAudio = useCallback(async () => {
    try {
      await azureSpeechService.stop();
    } catch {
      // no-op
    } finally {
      setIsSentenceAudioPlaying(false);
      setIsSentenceAudioLoading(false);
    }
  }, []);

  const formatSentenceAudioSpeed = (speed: number) =>
    speed.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  const sliderIndexToSentenceSpeed = (index: number) =>
    Number((CONTEXT_AUDIO_SPEED_MIN + index * CONTEXT_AUDIO_SPEED_STEP).toFixed(2));
  const sentenceSpeedToSliderIndex = (speed: number) =>
    Math.max(
      0,
      Math.min(
        CONTEXT_AUDIO_SPEED_STEPS,
        Math.round((speed - CONTEXT_AUDIO_SPEED_MIN) / CONTEXT_AUDIO_SPEED_STEP),
      ),
    );

  const startSentenceAudio = useCallback(async () => {
    if (!enableSentenceAudio) {
      return;
    }

    setIsSentenceAudioLoading(true);
    setIsSentenceAudioPlaying(false);

    await azureSpeechService.speak(
      question.sentence,
      () => {
        setIsSentenceAudioLoading(false);
        setIsSentenceAudioPlaying(true);
      },
      () => {
        setIsSentenceAudioPlaying(false);
        setIsSentenceAudioLoading(false);
      },
      () => {
        setIsSentenceAudioPlaying(false);
        setIsSentenceAudioLoading(false);
      },
      {
        speedMultiplier: shouldShowSentenceSpeedControl
          ? sentenceAudioSpeed
          : DEFAULT_CONTEXT_AUDIO_SPEED,
      },
    );
  }, [
    enableSentenceAudio,
    question.sentence,
    sentenceAudioSpeed,
    shouldShowSentenceSpeedControl,
  ]);

  const handleSentenceAudioPress = useCallback(async () => {
    if (!enableSentenceAudio) {
      return;
    }

    if (isSentenceAudioPlaying || isSentenceAudioLoading) {
      await stopSentenceAudio();
      return;
    }

    await startSentenceAudio();
  }, [
    enableSentenceAudio,
    isSentenceAudioLoading,
    isSentenceAudioPlaying,
    startSentenceAudio,
    stopSentenceAudio,
  ]);

  const handleCloseTooltip = useCallback(() => {
    tooltipOpacity.value = 0;
    setSelectedItem(null);
    setSelectedSurfaceText(null);
    setSelectedTokenKey(null);
    setTooltipPosition(null);
  }, [tooltipOpacity]);

  const handleTokenPress = useCallback(
    (
      item: VocabularyMatch | KanjiMatch,
      surfaceText: string,
      event: any,
      tokenKey: string,
    ) => {
      const pageX = Number(event?.nativeEvent?.pageX);
      const pageY = Number(event?.nativeEvent?.pageY);
      if (!Number.isFinite(pageX) || !Number.isFinite(pageY)) {
        return;
      }

      const screenWidth = Dimensions.get("window").width;
      const screenHeight = Dimensions.get("window").height;
      const tooltipWidth = 280;
      const tooltipEstimatedHeight = 190;
      const anchorWidth = 24;
      const anchorHeight = 24;
      const anchorX = pageX - anchorWidth / 2;
      const anchorY = pageY - anchorHeight / 2;

      let left = anchorX + anchorWidth / 2 - tooltipWidth / 2;
      left = Math.max(16, Math.min(left, screenWidth - tooltipWidth - 16));

      const spaceBelow = screenHeight - (anchorY + anchorHeight);
      const spaceAbove = anchorY;
      const top =
        spaceBelow >= tooltipEstimatedHeight || spaceBelow > spaceAbove
          ? anchorY + anchorHeight + 8
          : anchorY - tooltipEstimatedHeight - 8;

      setTooltipPosition({ x: left, y: top, width: anchorWidth });
      setSelectedItem(item);
      setSelectedSurfaceText(surfaceText);
      setSelectedTokenKey(tokenKey);
      tooltipOpacity.value = withTiming(1, { duration: 180 });
    },
    [tooltipOpacity],
  );

  const handleViewDetails = useCallback(() => {
    if (!selectedItem || !isWaniKaniBackedMatch(selectedItem)) {
      return;
    }

    handleCloseTooltip();
    router.push({
      pathname: "/subject/[id]",
      params: {
        id: selectedItem.id.toString(),
        initialTab: "context",
      },
    });
  }, [handleCloseTooltip, selectedItem]);

  const handleViewSubject = useCallback(
    (subjectId: number) => {
      handleCloseTooltip();
      router.push({
        pathname: "/subject/[id]",
        params: {
          id: subjectId.toString(),
          initialTab: "context",
        },
      });
    },
    [handleCloseTooltip],
  );

  useEffect(() => {
    setSelectedChoiceIndex(null);
    setTypedAnswer("");
    setAnswerFeedback(null);
    setShowVocabInSentence(false);
    setNavigatingToDetail(false);
    setIsTranslationRevealed(false);
    setHasAutoplayedSentence(false);
    setPendingAnswer(null);
    setShowExpectedAnswer(false);
    setIsAdvancing(false);
    feedbackOpacity.setValue(0);

    vocabInputRef.current?.clearInput();
    void stopSentenceAudio();
    handleCloseTooltip();
  }, [question.id, feedbackOpacity, handleCloseTooltip, stopSentenceAudio]);

  useEffect(() => {
    if (!showSentenceAudioSpeedControl) {
      setIsSentenceSpeedExpanded(false);
    }
  }, [showSentenceAudioSpeedControl]);

  useEffect(() => {
    if (!enableSentenceAudio) {
      setIsSentenceSpeedExpanded(false);
      void stopSentenceAudio();
    }
  }, [enableSentenceAudio, stopSentenceAudio]);

  useEffect(() => {
    if (!enableSentenceAudio || !autoPlaySentenceAudio || hasAutoplayedSentence) {
      return;
    }

    setHasAutoplayedSentence(true);
    void startSentenceAudio();
  }, [
    autoPlaySentenceAudio,
    enableSentenceAudio,
    hasAutoplayedSentence,
    startSentenceAudio,
  ]);

  useEffect(() => {
    let didCancel = false;

    const analyzeSentence = async () => {
      if (!enableJpdbSentenceBreakdown) {
        setVocabularyMatches([]);
        setKanjiMatches([]);
        setJpdbParsedTokens([]);
        handleCloseTooltip();
        return;
      }

      try {
        const subjects = cachedSubjects ?? await getAllSubjects();
        const normalizedSubjects = Array.isArray(subjects) ? subjects : [];

        if (!didCancel && cachedSubjects === null) {
          setCachedSubjects(normalizedSubjects);
        }

        const {
          vocabularyMatches: resolvedVocabularyMatches,
          kanjiMatches: resolvedKanjiMatches,
          jpdbParsedTokens: parsedTokens,
        } = await findVocabularyMatchesWithJpdbFirstPass(
          analyzedSentenceText,
          normalizedSubjects,
        );

        if (didCancel) {
          return;
        }

        setVocabularyMatches(resolvedVocabularyMatches);
        setKanjiMatches(resolvedKanjiMatches);
        setJpdbParsedTokens(Array.isArray(parsedTokens) ? parsedTokens : []);
      } catch (error) {
        console.error(
          "[ContextSentenceQuestionScreen] Failed to parse sentence with JPDB:",
          error,
        );
        if (!didCancel) {
          setVocabularyMatches([]);
          setKanjiMatches([]);
          setJpdbParsedTokens([]);
        }
      }
    };

    void analyzeSentence();

    return () => {
      didCancel = true;
    };
  }, [
    analyzedSentenceText,
    cachedSubjects,
    enableJpdbSentenceBreakdown,
    handleCloseTooltip,
  ]);

  useEffect(() => {
    if (!isWritingMode || showVocabInSentence || (stopAfterAnswer && pendingAnswer)) {
      return;
    }

    const focusDelay = Platform.OS === "android" ? ANDROID_AUTOFOCUS_DELAY_MS : 0;
    const timeout = setTimeout(() => {
      vocabInputRef.current?.focus();
      syncAndroidKeyboardMetrics();
    }, focusDelay);

    return () => clearTimeout(timeout);
  }, [
    pendingAnswer,
    question.id,
    isWritingMode,
    showVocabInSentence,
    stopAfterAnswer,
    syncAndroidKeyboardMetrics,
  ]);

  useEffect(() => {
    const currentStepIndex = currentItem - 1;
    const targetProgress = (currentStepIndex / totalItems) * 100;

    Animated.timing(progressWidth, {
      toValue: targetProgress,
      duration: 240,
      useNativeDriver: false,
    }).start();
  }, [currentItem, totalItems, progressWidth]);

  const progressPercentage = useMemo(
    () =>
      progressWidth.interpolate({
        inputRange: [0, 100],
        outputRange: ["0%", "100%"],
        extrapolate: "clamp",
      }),
    [progressWidth],
  );
  const answeredCount = Math.max(0, currentItem - 1);
  const mistakesCount = Math.max(0, answeredCount - correctAnswersCount);
  const isPendingAnswer = pendingAnswer !== null;
  const pendingStatusColor = pendingAnswer?.isCorrect ? "#4caf50" : "#f44336";
  const displayedPendingAnswer =
    pendingAnswer && !pendingAnswer.isCorrect && showExpectedAnswer && canonicalAnswerText
      ? canonicalAnswerText
      : pendingAnswer?.submittedAnswer ?? "";
  const canToggleShowAnswer =
    Boolean(pendingAnswer) &&
    pendingAnswer?.isCorrect === false &&
    canonicalAnswerText.length > 0;
  const isShowingExpectedPendingAnswer =
    Boolean(pendingAnswer) &&
    pendingAnswer?.isCorrect === false &&
    showExpectedAnswer &&
    canonicalAnswerText.length > 0;
  const writingInlineDisplayText =
    typedAnswer.trim().length > 0 ? typedAnswer.trim() : "　　";
  const writingInlineUnderlineColor = theme.isDark ? "#ffffff" : theme.textColor;
  const writingInlineStatusColor = pendingAnswer
    ? pendingStatusColor || theme.primary
    : answerFeedback === "correct"
      ? "#4caf50"
      : answerFeedback === "incorrect"
        ? "#f44336"
        : theme.primary;
  const nextActionLabel =
    currentItem >= totalItems ? "See Results" : "Next Question";
  const choiceSubmitLabel = isPendingAnswer ? nextActionLabel : "Submit Answer";
  const choiceCanSubmit = isPendingAnswer || selectedChoiceIndex !== null;
  const writingCanSubmit = isPendingAnswer || Boolean(typedAnswer.trim());
  const androidAppliedKeyboardResize =
    Platform.OS === "android" &&
    androidKeyboardHeight > 0 &&
    androidBaselineScreenHeightRef.current > 0
      ? Math.max(
          0,
          androidBaselineScreenHeightRef.current - androidScreenLayoutHeight,
        )
      : 0;
  const androidKeyboardFallbackLift =
    Platform.OS === "android" && androidKeyboardHeight > 0
      ? Math.max(0, androidKeyboardHeight - androidAppliedKeyboardResize)
      : 0;
  const androidKeyboardLift = Math.min(
    androidKeyboardFallbackLift,
    Math.round(height * 0.6),
  );

  const showFeedbackAnimation = (isCorrect: boolean) => {
    setAnswerFeedback(isCorrect ? "correct" : "incorrect");

    Animated.sequence([
      Animated.timing(feedbackOpacity, {
        toValue: 0.3,
        duration: 110,
        useNativeDriver: true,
      }),
      Animated.timing(feedbackOpacity, {
        toValue: 0,
        duration: 220,
        delay: 120,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAnswerFeedback(null);
    });
  };

  const animateAnsweredItemBox = () => {
    boxPositionX.setValue(0);
    boxPositionY.setValue(0);
    boxScale.setValue(1);
    boxOpacity.setValue(1);

    // Match ReviewQuestionScreen positioning so it lands below the header.
    const targetTop = Math.max(140, insets.top + 96);
    const targetX = -(width / 2);
    const targetY = -(height / 2) + targetTop;

    Animated.parallel([
      Animated.timing(boxPositionX, {
        toValue: targetX,
        duration: ANSWER_CARD_ANIMATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(boxPositionY, {
        toValue: targetY,
        duration: ANSWER_CARD_ANIMATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(boxScale, {
        toValue: 0.6,
        duration: ANSWER_CARD_ANIMATION_MS,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const showPreviousAnswerChip = (isCorrect: boolean) => {
    const characters =
      question.vocab.data.characters || question.vocab.data.meanings[0]?.meaning;
    setPreviousAnswerItem({
      id: question.vocab.id,
      characters: characters || "",
      backgroundColor: subjectColors.vocabulary,
      isCorrect,
    });
    animateAnsweredItemBox();
  };

  const revealAnswerResult = (isCorrect: boolean) => {
    if (!stopAfterAnswer) {
      showPreviousAnswerChip(isCorrect);
    }

    Haptics.notificationAsync(
      isCorrect
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );

    showFeedbackAnimation(isCorrect);
    setShowVocabInSentence(!stopAfterAnswer);
    void stopSentenceAudio();
    handleCloseTooltip();
  };

  const completeAnswer = (isCorrect: boolean, submittedAnswer: string) => {
    revealAnswerResult(isCorrect);

    if (stopAfterAnswer) {
      setPendingAnswer({ isCorrect, submittedAnswer });
      return;
    }

    setTimeout(() => {
      onAnswer(isCorrect, submittedAnswer);
    }, NEXT_QUESTION_DELAY_MS);
  };

  const continueAfterPendingAnswer = () => {
    if (!pendingAnswer || isAdvancing) {
      return;
    }

    setIsAdvancing(true);
    showPreviousAnswerChip(pendingAnswer.isCorrect);
    onAnswer(pendingAnswer.isCorrect, pendingAnswer.submittedAnswer);
  };

  const navigateToCurrentSubjectDetail = () => {
    if (navigatingToDetail) {
      return;
    }

    setNavigatingToDetail(true);
    router.push({
      pathname: "/subject/[id]",
      params: {
        id: question.vocab.id.toString(),
        initialTab: "context",
      },
    });

    setTimeout(() => {
      setNavigatingToDetail(false);
    }, 350);
  };

  const navigateToPreviousItemDetail = () => {
    if (!previousAnswerItem || navigatingToDetail) {
      return;
    }

    setNavigatingToDetail(true);
    router.push({
      pathname: "/subject/[id]",
      params: {
        id: previousAnswerItem.id.toString(),
        initialTab: "context",
      },
    });

    setTimeout(() => {
      setNavigatingToDetail(false);
    }, 350);
  };

  const normalizeForAnswerComparison = (value: string) =>
    value
      .replace(/\u3000/g, " ")
      .replace(/\s/g, "")
      .replace(/[。．\.,、!！?？]/g, "")
      .trim()
      .toLowerCase();

  const resolveWritingSubmission = () => {
    let answer = typedAnswer.trim();
    if (vocabInputRef.current?.flushKana) {
      answer = vocabInputRef.current.flushKana();
    }

    const normalizedAnswerSurface = normalizeForAnswerComparison(answer);
    if (!normalizedAnswerSurface) {
      return null;
    }

    const expectedAnswer = canonicalAnswerText;
    const expectedAnswerCandidates = getTildeInsensitiveVariants(expectedAnswer);
    const readingCandidates = Array.isArray(question.vocab.data.readings)
      ? question.vocab.data.readings
          .map((readingEntry) =>
            typeof readingEntry?.reading === "string"
              ? readingEntry.reading
              : "",
          )
          .filter(Boolean)
      : [];
    const normalizedExpectedSurfaceCandidates = expectedAnswerCandidates
      .map((candidate) => normalizeForAnswerComparison(candidate))
      .filter(Boolean);
    const normalizedExpectedHiraganaCandidates = expectedAnswerCandidates
      .map((candidate) =>
        normalizeForAnswerComparison(
          wanakana.toHiragana(candidate, { IMEMode: false }),
        ),
      )
      .filter(Boolean);
    const acceptedSurfaceAnswers = new Set<string>([
      ...normalizedExpectedSurfaceCandidates,
      ...readingCandidates.map((reading) => normalizeForAnswerComparison(reading)),
    ]);
    const acceptedHiraganaAnswers = new Set<string>([
      ...normalizedExpectedHiraganaCandidates,
      ...readingCandidates.map((reading) =>
        normalizeForAnswerComparison(
          wanakana.toHiragana(reading, { IMEMode: false }),
        ),
      ),
    ]);
    const normalizedAnswerHiragana = normalizeForAnswerComparison(
      wanakana.toHiragana(answer, { IMEMode: false }),
    );
    const isCorrect =
      acceptedSurfaceAnswers.has(normalizedAnswerSurface) ||
      acceptedHiraganaAnswers.has(normalizedAnswerHiragana);

    return {
      isCorrect,
      submittedAnswer: answer.trim(),
    };
  };

  const handleWritingSubmit = () => {
    if (stopAfterAnswer && pendingAnswer) {
      continueAfterPendingAnswer();
      return;
    }

    const submission = resolveWritingSubmission();
    if (!submission) {
      return;
    }

    completeAnswer(submission.isCorrect, submission.submittedAnswer);
  };

  const resolveChoiceSubmission = () => {
    if (selectedChoiceIndex === null) {
      return null;
    }

    const selected = question.kanjiChoices[selectedChoiceIndex];
    return {
      isCorrect: selected.isCorrect,
      submittedAnswer: selected.kanji,
    };
  };

  const handleChoiceSubmit = () => {
    if (stopAfterAnswer && pendingAnswer) {
      continueAfterPendingAnswer();
      return;
    }

    const submission = resolveChoiceSubmission();
    if (!submission) {
      return;
    }

    completeAnswer(submission.isCorrect, submission.submittedAnswer);
  };

  const renderInlineChars = (text: string, keyPrefix: string) =>
    Array.from(text).map((char, index) => (
      <Text
        key={`${keyPrefix}-${index}`}
        style={[
          styles.sentenceText,
          styles.inlineSentenceChar,
          fontStyles.japaneseText,
          { color: theme.textColor },
        ]}
      >
        {char}
      </Text>
    ));

  const renderPendingAnswerToken = (key: string) => (
    <TouchableOpacity
      key={key}
      style={styles.inlineAnswerResult}
      onPress={navigateToCurrentSubjectDetail}
      activeOpacity={0.8}
      disabled={navigatingToDetail}
    >
      <Text
        style={[
          styles.inlineAnswerResultText,
          fontStyles.japaneseText,
          {
            color: isShowingExpectedPendingAnswer
              ? "#4caf50"
              : pendingStatusColor || theme.primary,
          },
        ]}
      >
        {displayedPendingAnswer || "—"}
      </Text>
    </TouchableOpacity>
  );

  const renderWritingDraftToken = (key: string) => (
    <View
      key={key}
      style={[
        styles.inlineWritingAnswerToken,
        { borderBottomColor: writingInlineUnderlineColor },
      ]}
    >
      <Text
        style={[
          styles.inlineWritingAnswerText,
          fontStyles.japaneseText,
          { color: theme.textColor },
        ]}
      >
        {writingInlineDisplayText}
      </Text>
    </View>
  );

  const renderUnderlinedAnalyzedText = (
    text: string,
    textStartOffset: number,
    keyPrefix: string,
  ) => {
    const baseTextStyle = [
      styles.sentenceText,
      styles.inlineSentenceTokenText,
      fontStyles.japaneseText,
      { color: theme.textColor },
    ];

    if (!text) {
      return <Text style={baseTextStyle}>{text}</Text>;
    }

    if (!enableJpdbSentenceBreakdown) {
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
      const segments = getHighlightSegments(text, allMatches);
      return (
        <View style={styles.underlinedInlineContainer}>
          {segments.map((segment, index) => {
            if (!segment.match || !segment.text) {
              return (
                <Text key={`${keyPrefix}-plain-${index}`} style={baseTextStyle}>
                  {segment.text}
                </Text>
              );
            }

            const tokenKey = `${keyPrefix}-${segment.match.id}-${index}-${segment.text}`;
            const isSelectedToken = selectedTokenKey === tokenKey;
            const tokenUnderlineColor = withAlpha(theme.primary, theme.isDark ? 0.95 : 0.75);
            const selectedTokenBorderColor = withAlpha(
              theme.textColor,
              theme.isDark ? 0.58 : 0.34,
            );
            const selectedTokenBackground = withAlpha(
              theme.primary,
              theme.isDark ? 0.24 : 0.18,
            );

            return (
              <Pressable
                key={`${keyPrefix}-match-${tokenKey}`}
                style={styles.underlinedTokenPressable}
                onPress={(event) =>
                  handleTokenPress(segment.match as VocabularyMatch | KanjiMatch, segment.text, event, tokenKey)
                }
              >
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
              </Pressable>
            );
          })}
        </View>
      );
    }

    const textTokens = jpdbParsedTokens
      .filter(
        (token) =>
          token.start >= textStartOffset &&
          token.end <= textEndOffset &&
          token.end > token.start,
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

    return (
      <View style={styles.underlinedInlineContainer}>
        {inlineSegments.flatMap((segment, index) => {
          const renderedNodes: React.ReactElement[] = [];

          if (segment.tokenType === "plain" || !segment.token) {
            renderedNodes.push(
              <Text key={`${keyPrefix}-plain-token-${index}`} style={baseTextStyle}>
                {segment.text}
              </Text>,
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
                  segment.tokenType === "verb" ? "verb" : "vocabulary",
                )
              : null;
          const tooltipItem =
            grammarTooltipItem ?? mappedMatch ?? jpdbFallbackTooltipItem ?? null;
          const tokenKey = `${keyPrefix}-${segment.token.start}-${segment.token.end}-${segment.text}`;
          const isSelectedToken = selectedTokenKey === tokenKey;
          const underlineColor =
            segment.tokenType === "grammar"
              ? grammarUnderlineColor
              : segment.tokenType === "verb"
                ? verbUnderlineColor
                : vocabUnderlineColor;
          const tokenUnderlineColor = withAlpha(
            underlineColor,
            theme.isDark ? 0.95 : 0.75,
          );
          const selectedTokenBorderColor = withAlpha(
            theme.textColor,
            theme.isDark ? 0.58 : 0.34,
          );
          const selectedTokenBackground = withAlpha(
            underlineColor,
            theme.isDark ? 0.24 : 0.18,
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

          const tokenNodeKey = `${keyPrefix}-token-${index}-${tokenKey}`;
          if (!tooltipItem) {
            renderedNodes.push(
              <View key={tokenNodeKey} style={styles.underlinedTokenPressable}>
                {tokenText}
              </View>,
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
              </Pressable>,
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
                key={`${keyPrefix}-separator-${index}-${tokenKey}`}
                style={[baseTextStyle, styles.inlineUnderlineSeparator]}
              >
                {TOKEN_UNDERLINE_SEPARATOR}
              </Text>,
            );
          }

          return renderedNodes;
        })}
      </View>
    );
  };

  const renderSentence = () => {
    if (stopAfterAnswer && pendingAnswer) {
      const [before, ...afterParts] = question.sentenceWithBlank.split(BLANK_TOKEN);
      const after = afterParts.join(BLANK_TOKEN);
      const hasBlank = question.sentenceWithBlank.includes(BLANK_TOKEN);

      if (!hasBlank) {
        return (
          <View style={styles.inlineSentenceRow}>
            {renderUnderlinedAnalyzedText(question.sentenceWithBlank, 0, "pending-full")}
          </View>
        );
      }

      return (
        <View style={styles.inlineSentenceRow}>
          {enableJpdbSentenceBreakdown
            ? renderUnderlinedAnalyzedText(before, 0, "pending-before")
            : renderInlineChars(before, "pending-before")}
          {renderPendingAnswerToken("pending-answer")}
          {enableJpdbSentenceBreakdown
            ? renderUnderlinedAnalyzedText(
                after,
                before.length + BLANK_TOKEN.length,
                "pending-after",
              )
            : renderInlineChars(after, "pending-after")}
        </View>
      );
    }

    if (showVocabInSentence) {
      return (
        <View style={styles.inlineSentenceRow}>
          {renderUnderlinedAnalyzedText(question.sentence, 0, "answered")}
        </View>
      );
    }

    if (!isWritingMode) {
      return (
        <View style={styles.inlineSentenceRow}>
          {renderUnderlinedAnalyzedText(question.sentenceWithBlank, 0, "choice")}
        </View>
      );
    }

    const [before, ...afterParts] = question.sentenceWithBlank.split(BLANK_TOKEN);
    const after = afterParts.join(BLANK_TOKEN);
    const hasBlank = question.sentenceWithBlank.includes(BLANK_TOKEN);

    if (!hasBlank) {
      return (
        <View style={styles.inlineSentenceRow}>
          {renderUnderlinedAnalyzedText(question.sentenceWithBlank, 0, "writing-full")}
        </View>
      );
    }

    return (
      <View style={styles.inlineSentenceRow}>
        {enableJpdbSentenceBreakdown
          ? renderUnderlinedAnalyzedText(before, 0, "before")
          : renderInlineChars(before, "before")}
        {renderWritingDraftToken("writing-live-answer")}
        {enableJpdbSentenceBreakdown
          ? renderUnderlinedAnalyzedText(
              after,
              before.length + BLANK_TOKEN.length,
              "after",
            )
          : renderInlineChars(after, "after")}
      </View>
    );
  };

  const renderTranslation = () => {
    if (!hideTranslationUntilTap || isTranslationRevealed) {
      return (
        <Text style={[styles.translationText, { color: theme.textColor }]}>
          {question.translation}
        </Text>
      );
    }

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={styles.translationRevealContainer}
        onPress={() => setIsTranslationRevealed(true)}
      >
        <Text
          style={[
            styles.translationText,
            styles.translationHiddenText,
            { color: theme.textColor },
          ]}
        >
          {question.translation}
        </Text>
        <BlurView
          tint={theme.isDark ? "dark" : "light"}
          intensity={24}
          style={styles.translationBlurOverlay}
        />
        <View style={styles.translationRevealHint}>
          <Ionicons name="eye-outline" size={14} color={theme.textSecondary} />
          <Text
            style={[
              styles.translationRevealHintText,
              { color: theme.textSecondary },
            ]}
          >
            Tap to reveal translation
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      edges={["left", "right", "bottom"]}
      onLayout={handleScreenLayout}
    >
      {answerFeedback && (
        <Animated.View
          style={[
            styles.feedbackOverlay,
            {
              backgroundColor:
                answerFeedback === "correct" ? "#4caf50" : "#f44336",
              opacity: feedbackOpacity,
            },
          ]}
          pointerEvents="none"
        />
      )}

      <View
        style={[
          styles.statsHeader,
          {
            paddingTop: Math.max(insets.top + 8, 20),
            backgroundColor: theme.backgroundColor,
            borderBottomColor: theme.border,
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={onExit}>
          <Ionicons name="arrow-back" size={22} color={theme.textColor} />
        </TouchableOpacity>
        <View style={styles.statItem}>
          <Ionicons name="pie-chart" size={20} color={theme.textSecondary} />
          <Text style={[styles.statText, { color: theme.textColor }]}>
            {accuracyPercent}%
          </Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons
            name="checkmark-done"
            size={20}
            color={theme.textSecondary}
          />
          <Text style={[styles.statText, { color: theme.textColor }]}>
            {correctAnswersCount}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
          <Text style={[styles.statText, { color: theme.textColor }]}>
            {mistakesCount}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="list" size={20} color={theme.textSecondary} />
          <Text style={[styles.statText, { color: theme.textColor }]}>
            {totalItems - currentItem + 1}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.progressBarContainer,
          { backgroundColor: theme.border, borderBottomColor: theme.border },
        ]}
      >
        <Animated.View
          style={[
            styles.progressBar,
            { width: progressPercentage, backgroundColor: theme.primary },
          ]}
        />
      </View>

      {enableSentenceAudio && (
        <View style={styles.sentenceAudioTopRightWrapper}>
          <View style={styles.sentenceAudioContainer}>
            <View style={styles.sentenceAudioActionsRow}>
              <TouchableOpacity
                style={[
                  styles.sentenceAudioButton,
                  {
                    borderColor: theme.border,
                    backgroundColor: isSentenceAudioPlaying
                      ? theme.primary
                      : theme.isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.04)",
                  },
                ]}
                onPress={() => {
                  void handleSentenceAudioPress();
                }}
                activeOpacity={0.82}
              >
                {isSentenceAudioLoading ? (
                  <ActivityIndicator size="small" color={theme.textSecondary} />
                ) : (
                  <Ionicons
                    name={isSentenceAudioPlaying ? "stop" : "play"}
                    size={15}
                    color={isSentenceAudioPlaying ? "white" : theme.textSecondary}
                  />
                )}
                <Text
                  style={[
                    styles.sentenceAudioButtonText,
                    {
                      color: isSentenceAudioPlaying ? "white" : theme.textSecondary,
                    },
                  ]}
                >
                  {isSentenceAudioPlaying ? "Stop audio" : "Play audio"}
                </Text>
              </TouchableOpacity>

              {shouldShowSentenceSpeedControl && (
                <TouchableOpacity
                  activeOpacity={0.82}
                  style={[
                    styles.sentenceSpeedToggle,
                    {
                      borderColor: theme.border,
                      backgroundColor: isSentenceSpeedExpanded
                        ? theme.primary
                        : theme.isDark
                          ? "rgba(255,255,255,0.06)"
                          : "rgba(0,0,0,0.04)",
                    },
                  ]}
                  onPress={() =>
                    setIsSentenceSpeedExpanded((previous) => !previous)
                  }
                >
                  <Ionicons
                    name="speedometer-outline"
                    size={14}
                    color={isSentenceSpeedExpanded ? "white" : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.sentenceSpeedToggleText,
                      {
                        color: isSentenceSpeedExpanded
                          ? "white"
                          : theme.textSecondary,
                      },
                    ]}
                  >
                    {formatSentenceAudioSpeed(sentenceAudioSpeed)}x
                  </Text>
                  <Ionicons
                    name={isSentenceSpeedExpanded ? "chevron-up" : "chevron-down"}
                    size={14}
                    color={isSentenceSpeedExpanded ? "white" : theme.textSecondary}
                  />
                </TouchableOpacity>
              )}
            </View>

            {shouldShowSentenceSpeedControl && isSentenceSpeedExpanded && (
              <View
                style={[
                  styles.sentenceSpeedSliderContainer,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.isDark
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(0,0,0,0.03)",
                  },
                ]}
              >
                <Slider
                  minimumValue={0}
                  maximumValue={CONTEXT_AUDIO_SPEED_STEPS}
                  step={1}
                  value={sentenceSpeedToSliderIndex(sentenceAudioSpeed)}
                  onValueChange={(value) =>
                    setSentenceAudioSpeed(
                      sliderIndexToSentenceSpeed(Math.round(value)),
                    )
                  }
                  minimumTrackTintColor={theme.primary}
                  maximumTrackTintColor={theme.border}
                  thumbTintColor={theme.primary}
                  style={styles.sentenceSpeedSlider}
                />
                <View style={styles.sentenceSpeedSliderFooter}>
                  <Text
                    style={[
                      styles.sentenceSpeedEdgeLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {CONTEXT_AUDIO_SPEED_MIN}x
                  </Text>
                  <TouchableOpacity
                    style={styles.sentenceSpeedResetButton}
                    onPress={() => setSentenceAudioSpeed(DEFAULT_CONTEXT_AUDIO_SPEED)}
                  >
                    <Text
                      style={[
                        styles.sentenceSpeedResetText,
                        { color: theme.primary },
                      ]}
                    >
                      Reset
                    </Text>
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.sentenceSpeedEdgeLabel,
                      { color: theme.textSecondary },
                    ]}
                  >
                    {CONTEXT_AUDIO_SPEED_MAX}x
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {previousAnswerItem && (
        <Animated.View
          style={[
            styles.answeredItemBox,
            {
              transform: [
                { translateX: boxPositionX },
                { translateY: boxPositionY },
                { scale: boxScale },
              ],
              opacity: boxOpacity,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.answeredItemBoxTouchable,
              { backgroundColor: previousAnswerItem.backgroundColor },
              navigatingToDetail && styles.disabledTouchable,
            ]}
            onPress={navigateToPreviousItemDetail}
            activeOpacity={0.75}
            disabled={navigatingToDetail}
          >
            <Text
              style={[
                styles.answeredItemCharacter,
                fontStyles.japaneseText,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {previousAnswerItem.characters}
            </Text>
            <View
              style={[
                styles.answeredItemStatusIndicator,
                {
                  backgroundColor: previousAnswerItem.isCorrect
                    ? "#4caf50"
                    : "#f44336",
                },
              ]}
            >
              <Ionicons
                name={previousAnswerItem.isCorrect ? "checkmark" : "close"}
                size={20}
                color="white"
              />
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={[
          styles.contentScrollContainer,
          previousAnswerItem && styles.contentScrollContainerWithChip,
          Platform.OS === "android" &&
            isWritingMode &&
            !showVocabInSentence &&
            !pendingAnswer &&
            androidKeyboardLift > 0 && {
              paddingBottom: 16 + androidKeyboardLift,
            },
        ]}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        automaticallyAdjustKeyboardInsets={isWritingMode}
        onTouchStart={() => {
          if (isWritingMode && !showVocabInSentence && !pendingAnswer) {
            const focusDelay =
              Platform.OS === "android" ? ANDROID_AUTOFOCUS_DELAY_MS : 0;
            setTimeout(() => {
              vocabInputRef.current?.focus();
              syncAndroidKeyboardMetrics();
            }, focusDelay);
          }
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.promptArea}>
          <View style={styles.sentenceCenterContainer}>{renderSentence()}</View>

          <View style={styles.translationCenterContainer}>
            <Text style={[styles.translationLabel, { color: theme.textSecondary }]}>
              Translation
            </Text>
            {renderTranslation()}
          </View>

          {stopAfterAnswer && pendingAnswer && (
            <View style={styles.resultActionsRow}>
              <TouchableOpacity
                activeOpacity={0.86}
                style={[
                  styles.resultActionButton,
                  { borderColor: theme.border },
                ]}
                onPress={navigateToCurrentSubjectDetail}
                disabled={navigatingToDetail}
              >
                <Ionicons name="information-circle-outline" size={17} color={theme.textColor} />
                <Text style={[styles.resultActionButtonText, { color: theme.textColor }]}>
                  Show Details
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.86}
                style={[
                  styles.resultActionButton,
                  { borderColor: theme.border },
                ]}
                onPress={() => setShowExpectedAnswer((previous) => !previous)}
                disabled={!canToggleShowAnswer}
              >
                <Ionicons
                  name="eye-outline"
                  size={17}
                  color={canToggleShowAnswer ? theme.textColor : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.resultActionButtonText,
                    {
                      color: canToggleShowAnswer ? theme.textColor : theme.textSecondary,
                    },
                  ]}
                >
                  {showExpectedAnswer ? "Hide Answer" : "Show Answer"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </ScrollView>

      {!isWritingMode && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={10}
          style={styles.questionWrapper}
        >
          <View style={styles.questionSection}>
            <Text style={[styles.questionPrompt, { color: theme.textColor }]}>
              Which word completes the sentence?
            </Text>
            <View style={styles.choicesGrid}>
              {question.kanjiChoices.map((choice, index) => {
                const selected = selectedChoiceIndex === index;
                const selectedResultColor =
                  stopAfterAnswer && pendingAnswer && selected
                    ? pendingStatusColor || theme.primary
                    : theme.primary;
                return (
                  <TouchableOpacity
                    key={choice.vocabId}
                    style={[
                      styles.choiceButton,
                      {
                        borderColor: selected ? selectedResultColor : theme.border,
                        backgroundColor: selected
                          ? withAlpha(selectedResultColor, theme.isDark ? 0.28 : 0.18)
                          : theme.cardBackground,
                      },
                      stopAfterAnswer && pendingAnswer && styles.choiceButtonDisabled,
                    ]}
                    onPress={() => {
                      if (stopAfterAnswer && pendingAnswer) {
                        return;
                      }
                      setSelectedChoiceIndex(index);
                    }}
                    disabled={stopAfterAnswer && pendingAnswer !== null}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        fontStyles.japaneseText,
                        { color: selected ? selectedResultColor : theme.textColor },
                      ]}
                    >
                      {choice.kanji}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TouchableOpacity
              style={[
                styles.submitButton,
                {
                  backgroundColor: choiceCanSubmit ? theme.primary : theme.border,
                  opacity: choiceCanSubmit ? 1 : 0.7,
                },
              ]}
              onPress={handleChoiceSubmit}
              disabled={!choiceCanSubmit || isAdvancing}
              activeOpacity={0.82}
            >
              <Text style={styles.submitButtonText}>{choiceSubmitLabel}</Text>
              <Ionicons name="arrow-forward" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {isWritingMode && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={10}
          style={styles.questionWrapper}
        >
          <View style={styles.questionSection}>
            <Animated.View
              style={[
                styles.writingInputRow,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.cardBackground,
                },
                answerFeedback && {
                  shadowColor: answerFeedback === "correct" ? "#4caf50" : "#f44336",
                  shadowOpacity: feedbackOpacity.interpolate({
                    inputRange: [0, 0.3],
                    outputRange: [0, 0.9],
                    extrapolate: "clamp",
                  }),
                },
              ]}
            >
              <KanaInput
                ref={vocabInputRef}
                onKanaChange={(nextKana) => {
                  setTypedAnswer(nextKana);

                  if (pendingAnswer) {
                    const shouldClearPending = nextKana.trim() !== pendingAnswer.submittedAnswer;
                    if (shouldClearPending) {
                      setPendingAnswer(null);
                      setShowExpectedAnswer(false);
                      setAnswerFeedback(null);
                    }
                  }
                }}
                initialValue=""
                enableKanaConversion
                useJapaneseKeyboard={useJapaneseKeyboard}
                resetSignal={`${question.id}-answer`}
                autoCorrect={false}
                autoCapitalize="none"
                placeholder="Type your answer..."
                placeholderTextColor={theme.textSecondary}
                style={[
                  styles.writingBottomInput,
                  fontStyles.japaneseText,
                  {
                    color: isPendingAnswer
                      ? writingInlineStatusColor
                      : theme.textColor,
                  },
                ]}
                returnKeyType="send"
                onSubmitEditing={handleWritingSubmit}
                onFocus={syncAndroidKeyboardMetrics}
                editable={!isAdvancing}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={styles.writingSubmitIconButton}
                activeOpacity={0.82}
                onPress={handleWritingSubmit}
                disabled={!writingCanSubmit || isAdvancing}
              >
                <Ionicons
                  name={isPendingAnswer ? "arrow-forward" : "paper-plane-outline"}
                  size={22}
                  color={writingCanSubmit ? theme.primary : theme.textSecondary}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      )}

      <VocabularyTooltip
        selectedItem={selectedItem}
        position={tooltipPosition}
        opacity={tooltipOpacity}
        selectedSurfaceText={selectedSurfaceText}
        headerColorOverride={
          selectedItem && selectedItem.id <= GRAMMAR_TOOLTIP_ID_MIN
            ? grammarUnderlineColor
            : undefined
        }
        onClose={handleCloseTooltip}
        onViewDetails={handleViewDetails}
        onViewSubject={handleViewSubject}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  feedbackOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
  },
  statsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  statText: {
    fontSize: 16,
    fontWeight: "700",
  },
  progressBarContainer: {
    height: 4,
    borderBottomWidth: 1,
  },
  progressBar: {
    height: "100%",
  },
  answeredItemBox: {
    position: "absolute",
    top: height / 2,
    left: width / 2,
    zIndex: 35,
    alignItems: "center",
    justifyContent: "center",
  },
  answeredItemBoxTouchable: {
    minWidth: 80,
    maxWidth: 200,
    height: 65,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  answeredItemCharacter: {
    color: "white",
    fontSize: Math.min(width * 0.07, 30),
    fontWeight: "400",
    flexShrink: 1,
    textAlign: "center",
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  answeredItemStatusIndicator: {
    position: "absolute",
    top: -10,
    right: -10,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  disabledTouchable: {
    opacity: 0.7,
  },
  contentScroll: {
    flex: 1,
  },
  contentScrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  contentScrollContainerWithChip: {
    paddingTop: 28,
  },
  promptArea: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 20,
    gap: 14,
  },
  sentenceCenterContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    minHeight: 84,
  },
  sentenceText: {
    fontSize: 22,
    lineHeight: 32,
  },
  inlineSentenceTokenText: {
    margin: 0,
    padding: 0,
  },
  underlinedInlineContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  underlinedTokenPressable: {
    alignSelf: "flex-start",
  },
  inlineUnderlineToken: {
    borderBottomWidth: 2,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    paddingHorizontal: 1,
  },
  inlineUnderlineTokenSelected: {
    borderWidth: 1,
    borderRadius: 5,
  },
  inlineUnderlineSeparator: {
    marginHorizontal: 1,
  },
  sentenceAudioContainer: {
    width: Math.min(width - 32, 320),
    maxWidth: "100%",
  },
  sentenceAudioTopRightWrapper: {
    alignItems: "flex-end",
    paddingHorizontal: 16,
    paddingTop: 8,
    zIndex: 6,
  },
  sentenceAudioActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    justifyContent: "flex-end",
  },
  sentenceAudioButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sentenceAudioButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sentenceSpeedToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sentenceSpeedToggleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sentenceSpeedSliderContainer: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 8,
  },
  sentenceSpeedSlider: {
    width: "100%",
    height: 30,
  },
  sentenceSpeedSliderFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  sentenceSpeedEdgeLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
  sentenceSpeedResetButton: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  sentenceSpeedResetText: {
    fontSize: 12,
    fontWeight: "600",
  },
  translationCenterContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    gap: 5,
  },
  translationLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  translationText: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  translationRevealContainer: {
    position: "relative",
    borderRadius: 8,
    overflow: "hidden",
    minHeight: 24,
    justifyContent: "center",
  },
  translationHiddenText: {
    opacity: 0.18,
  },
  translationBlurOverlay: {
    ...StyleSheet.absoluteFill,
  },
  translationRevealHint: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 8,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  translationRevealHintText: {
    fontSize: 12,
    fontWeight: "600",
  },
  inlineSentenceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  inlineSentenceChar: {
    margin: 0,
    padding: 0,
  },
  inlineInputGlow: {
    borderRadius: 6,
    marginHorizontal: 4,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  inlineVocabInput: {
    minWidth: 88,
    maxWidth: width * 0.45,
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 16,
    borderRadius: 6,
    borderWidth: 1,
    textAlign: "center",
  },
  inlineAnswerResult: {
    paddingHorizontal: 10,
    marginHorizontal: 4,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineAnswerResultText: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    textAlign: "center",
  },
  inlineWritingAnswerToken: {
    borderBottomWidth: 2,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginHorizontal: 4,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineWritingAnswerText: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    textAlign: "center",
  },
  resultActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    maxWidth: 560,
  },
  resultActionButton: {
    flex: 1,
    flexBasis: 0,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 14,
    height: 42,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  resultActionButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  questionWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  questionSection: {},
  questionPrompt: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
  },
  writingInputRow: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 52,
    paddingLeft: 12,
    paddingRight: 8,
    flexDirection: "row",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 10,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  writingBottomInput: {
    flex: 1,
    minHeight: 44,
    fontSize: 18,
    paddingVertical: 8,
    paddingHorizontal: 0,
  },
  writingSubmitIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  choicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 14,
  },
  choiceButton: {
    width: (width - 32 - 10) / 2,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
  },
  choiceButtonDisabled: {
    opacity: 0.7,
  },
  choiceText: {
    fontSize: 24,
    fontWeight: "600",
  },
  submitButton: {
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 14,
  },
  submitButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
});
