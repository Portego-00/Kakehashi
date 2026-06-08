import { Ionicons } from "@expo/vector-icons";
import {
  AnsweredItemCharacterDisplay,
  RadicalCharacterDisplay,
} from "../features/review-question/components/CharacterDisplays";
import {
  ANDROID_AUTOFOCUS_DELAY_MS,
  BUTTONLESS_SWIPE_TRIGGER_PX,
  BUTTONLESS_TAP_MOVE_TOLERANCE_PX,
  BUTTONLESS_VERTICAL_DOMINANCE_RATIO,
  DARK_MODE_MEANING_BANNER_BG,
  DARK_MODE_MEANING_BANNER_TEXT,
  DARK_MODE_READING_BANNER_BG,
  FLOATING_REVIEW_TOOL_BUTTON_GAP,
  FLOATING_REVIEW_TOOL_BUTTON_RIGHT,
  FLOATING_REVIEW_TOOL_BUTTON_SIZE,
  FLOATING_REVIEW_TOOL_BUTTON_TOP_WITHOUT_WRAP_UP,
  FLOATING_REVIEW_TOOL_BUTTON_TOP_WITH_WRAP_UP,
  IOS_SUSPICIOUS_KEYBOARD_HEIGHT_RATIO,
  KANJI_CHARACTER_REGEX,
  PAUSED_SHORTCUT_GUARD_MS,
  RETRYABLE_ANSWER_RESULTS,
  SKIP_CUE_VISIBLE_MS,
  SRS_CARD_SIDE_OFFSET,
  SRS_CARD_WIDTH,
  VOCABULARY_AUDIO_MAX_PLAYBACK_MS,
  VOICE_READING_SCRIPT_MISMATCH_ERROR,
  height,
  width,
} from "../features/review-question/constants";
import { styles } from "../features/review-question/styles";
import type {
  ReviewDetailProgressionStatus,
  ReviewDetailRelatedSubjects,
  ReviewQuestionProps,
  PreviousAnswerItem,
  VoiceReadingLookup,
} from "../features/review-question/types";
import { EMPTY_REVIEW_DETAIL_RELATED_SUBJECTS } from "../features/review-question/types";
import {
  compactJapaneseText,
  ensureSubjectPartsOfSpeechLookup,
  ensureVoiceReadingLookup,
  extractAnkiPartOfSpeechValues,
  getSubjectDataRecord,
  getSubjectIdList,
  getSubjectMeanings,
  getSubjectReadings,
  getSrsStageDisplayInfo,
  isSingleKanjiVocabularySubject,
  loadCachedSubjectsByIds,
  mapSubjectForDetailGrid,
  matchesJapaneseAnswer,
  normalizeAnswerKey,
  normalizeCachedSubject,
  normalizeJapaneseReading,
  replaceArabicNumbersWithKanji,
  resolveExpectedReadingFromKanji,
  uniqueNonEmptyAnswers,
  voiceReadingLookupCache,
} from "../features/review-question/utils";
import { Audio, type AudioSound } from "@/src/utils/expoAvCompat";
import { BlurView } from "expo-blur";
import * as Haptics from "@/src/utils/haptics";
import { router, useFocusEffect } from "expo-router";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type GestureResponderEvent,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  type KeyboardEvent,
  type LayoutChangeEvent,
  Platform,
  Text,
  TextInput,
  type TextInputKeyPressEvent,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  Easing,
  LinearTransition,
  SlideInDown,
  SlideOutDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";
import AudioSessionManager from "../modules/AudioSessionManager";
import { Subject as WKSubject } from "../types/wanikani";
import {
  AnswerCheckerResult,
  checkAnswerWithDetails,
  getAnswerFeedback,
} from "../utils/answerChecker";
import { getSubjectTypeColor } from "../utils/subjectColors";
import { resolveReadingModeResult } from "../utils/readingAnswerMode";
import {
  createStudyMaterial,
  updateStudyMaterial,
  getStudyMaterials,
} from "../utils/api";
import { fontStyles } from "../utils/fonts";
import { pickPreferredPronunciationAudios } from "../utils/pronunciationAudio";
import { getNiaiSimilarKanjiSubjects } from "../utils/niaiSimilarKanji";
import { getCachedOrDownloadVocabularyAudioUri } from "../services/offlineVocabularyAudioService";
import {
  doesReviewShortcutMatchKey,
  resolveReviewCorrectKeyboardShortcuts,
  resolveReviewIncorrectKeyboardShortcuts,
} from "../utils/reviewKeyboardShortcuts";
import { useAuthStore, useSettingsStore } from "../utils/store";
import { useTheme } from "../utils/theme";
import KanjiDetails from "./KanjiDetails";
import RadicalDetails from "./RadicalDetails";
import SrsLevelIcon from "./SrsLevelIcon";
import KanaInput, { type KanaInputHandle } from "./TextToKanaInput";
import VocabularyDetails from "./VocabularyDetails";

// Custom hook for animating percentage values (used for progress bar) - Reanimated version
const useAnimatedPercentage = (
  total: number,
  current: number,
  duration = 300,
) => {
  const percentage = total > 0 ? (current / total) * 100 : 0;
  const animatedValue = useSharedValue(percentage);

  // Update the animated value when the input values change
  useEffect(() => {
    const newPercentage = total > 0 ? (current / total) * 100 : 0;
    animatedValue.value = withTiming(newPercentage, {
      duration,
      easing: Easing.out(Easing.ease),
    });
  }, [total, current, duration, animatedValue]);

  return animatedValue;
};

export default function ReviewQuestionScreen({
  item,
  questionType,
  onAnswer,
  onAskAgain,
  onSkip,
  onExit,
  showHeader = true,
  showBackgroundColor = true,
  totalItems = 0,
  currentItem = 0,
  completedCount = 0,
  correctAnswersCount = 0,
  srsProgression,
  onSRSCardDismiss,
  forceDisableAnkiGrouping = false,
  isLessonFlow = false,
  overridePromptText,
  overridePromptSubtext,
  overridePromptUsesJapaneseFont = false,
  overridePausedCorrectAnswerText,
  isWrapUpAvailable = false,
  isWrapUpMode = false,
  wrapUpTargetSubjects = 10,
  remainingSubjectsCount = 0,
  onWrapUp,
  studyMaterials,
  onSynonymAdded,
  contextSentencesHint,
  contextHintMaxItems = 3,
  acceptCharactersAsCorrectForReading = false,
  requireSubjectCharactersForReading = false,
  showCharactersAndReadingForReadingQuestion = false,
  reviewPermissionWarning,
  onDismissReviewPermissionWarning,
}: ReviewQuestionProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const { apiToken, userData } = useAuthStore();
  const {
    ankiCardMode,
    ankiGroupQuestions,
    ankiCardModeScope,
    ankiHideAnswerCompletely,
    ankiButtonlessMode,
    ankiShowReplayAudioButton,
    ankiShowOtherAcceptedAnswersAndUserSynonyms,
    ankiShowWaniKaniGrammarTags,
    autoplayVocabularyAudio,
    vocabularyAudioVoice,
    allowSkippingReviews,
    disableAutoProgressOnWrong,
    disableAutoProgressOnCloseAnswer,
    disableAutoProgressOnCorrect,
    acceptUserSynonymsAsAnswers,
    showAddSynonymButton,
    acceptAnyKanjiOnyomiReading,
    jitaiEnabled,
    autoSwitchKeyboard,
    voiceReviewAnswersEnabled,
    reviewIncorrectKeyboardShortcuts,
    reviewCorrectKeyboardShortcuts,
    showAnswerStopSubjectDetails,
    showReviewItemLevelAndSrsStage,
    reviewAnimatePreviousQuestion,
    reviewSearchButtonEnabled,
    reviewCharacterFontScale,
    srsProgressionCardDisplayMode,
    visuallySimilarKanjiSource,
  } = useSettingsStore();
  const { theme } = useTheme();
  const reviewPromptCharacterSize = useMemo(
    () => Math.min(windowWidth * 0.25, 120) * reviewCharacterFontScale,
    [reviewCharacterFontScale, windowWidth],
  );
  const effectiveShowAnswerStopSubjectDetails = showAnswerStopSubjectDetails;
  const isVoiceReviewEnabled =
    Platform.OS === "ios" && voiceReviewAnswersEnabled;
  const resolvedReviewIncorrectKeyboardShortcuts = useMemo(
    () =>
      resolveReviewIncorrectKeyboardShortcuts(reviewIncorrectKeyboardShortcuts),
    [reviewIncorrectKeyboardShortcuts],
  );
  const resolvedReviewCorrectKeyboardShortcuts = useMemo(
    () => resolveReviewCorrectKeyboardShortcuts(reviewCorrectKeyboardShortcuts),
    [reviewCorrectKeyboardShortcuts],
  );

  const ankiModeMatchesQuestionType =
    ankiCardModeScope === "both" || ankiCardModeScope === questionType;

  // Override Anki mode settings if forced to disable grouping
  const effectiveAnkiCardMode = ankiCardMode && ankiModeMatchesQuestionType;
  const effectiveAnkiGroupQuestions = forceDisableAnkiGrouping
    ? false
    : effectiveAnkiCardMode &&
      ankiCardModeScope === "both" &&
      ankiGroupQuestions;
  const effectiveAnkiButtonlessMode =
    effectiveAnkiCardMode && ankiButtonlessMode;
  const [userAnswer, setUserAnswer] = useState("");
  const [answered, setAnswered] = useState(false);
  const [answerResult, setAnswerResult] = useState<AnswerCheckerResult | null>(
    null,
  );
  const [retryCount, setRetryCount] = useState(0);
  const [navigatingToDetail, setNavigatingToDetail] = useState(false);
  const kanaInputRef = useRef<KanaInputHandle | null>(null);
  const pausedShortcutInputRef = useRef<TextInput | null>(null);
  const [showRetryFeedback, setShowRetryFeedback] = useState(false);
  const [answerFeedback, setAnswerFeedback] = useState<
    "correct" | "incorrect" | "close" | null
  >(null);
  const [ankiAnswerRevealed, setAnkiAnswerRevealed] = useState(false);
  const [ankiRevealQuestionKey, setAnkiRevealQuestionKey] = useState<
    string | null
  >(null);
  const [isPausedOnWrong, setIsPausedOnWrong] = useState(false);
  const [isPausedOnCloseAnswer, setIsPausedOnCloseAnswer] = useState(false);
  const [isPausedOnCorrect, setIsPausedOnCorrect] = useState(false);
  const [pausedDetailsSheetVisible, setPausedDetailsSheetVisible] =
    useState(false);
  const [wrongAnswerText, setWrongAnswerText] = useState<string | null>(null);
  const [closeAnswerText, setCloseAnswerText] = useState<string | null>(null);
  const [correctAnswerText, setCorrectAnswerText] = useState<string | null>(
    null,
  );
  const [reviewDetailRelatedSubjects, setReviewDetailRelatedSubjects] =
    useState<ReviewDetailRelatedSubjects>(EMPTY_REVIEW_DETAIL_RELATED_SUBJECTS);
  const [isAddingSynonym, setIsAddingSynonym] = useState(false);
  const [isReplayingAudio, setIsReplayingAudio] = useState(false);
  const [inputResetNonce, setInputResetNonce] = useState(0);
  const [showContextHint, setShowContextHint] = useState(false);
  const [isUsingDefaultJitaiFont, setIsUsingDefaultJitaiFont] = useState(false);
  const [isVoiceRecognizing, setIsVoiceRecognizing] = useState(false);
  const [voiceInterimTranscript, setVoiceInterimTranscript] = useState("");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [skipCueText, setSkipCueText] = useState<string | null>(null);
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  const [iosKeyboardVisible, setIosKeyboardVisible] = useState(false);
  const [iosKeyboardAvoidingEnabled, setIosKeyboardAvoidingEnabled] =
    useState(true);
  const [androidQuestionLayoutHeight, setAndroidQuestionLayoutHeight] =
    useState(0);
  const [ankiButtonlessOverlayWidth, setAnkiButtonlessOverlayWidth] =
    useState(0);
  const androidBaselineQuestionHeightRef = useRef(0);
  const interfaceIdiom = (
    Platform.constants as { interfaceIdiom?: string } | undefined
  )?.interfaceIdiom;
  const isIpadOrMacFormFactor =
    Platform.OS === "ios" &&
    ((Platform as any).isPad === true ||
      interfaceIdiom === "pad" ||
      interfaceIdiom === "mac");
  const latestVoiceResultsRef = useRef<
    { transcript: string; confidence: number }[]
  >([]);
  const voiceReadingLookupRef = useRef<VoiceReadingLookup | null>(
    voiceReadingLookupCache,
  );
  const isVoiceSubmittingRef = useRef(false);
  const isVoiceRetryPendingRef = useRef(false);
  const skipCueHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const pendingAnkiSubmitCallbackRef = useRef<(() => void) | null>(null);
  const pausedDetailsRevealTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const buttonlessGestureStartRef = useRef({ x: 0, y: 0 });
  const buttonlessGestureDeltaRef = useRef({ dx: 0, dy: 0 });
  const mountedRef = useRef(true);
  const suppressSubmitUntilRef = useRef(0);
  const vocabularyAudioSoundRef = useRef<AudioSound | null>(null);
  const vocabularyAudioRequestIdRef = useRef(0);
  const vocabularyAudioFinalizeRef = useRef<(() => void) | null>(null);

  // Maintain input focus across question changes to avoid keyboard flicker
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      vocabularyAudioRequestIdRef.current += 1;
      if (vocabularyAudioFinalizeRef.current) {
        vocabularyAudioFinalizeRef.current();
      } else if (vocabularyAudioSoundRef.current) {
        const sound = vocabularyAudioSoundRef.current;
        vocabularyAudioSoundRef.current = null;
        sound.setOnPlaybackStatusUpdate(null);
        void sound.unloadAsync();
      }
      pendingAnkiSubmitCallbackRef.current = null;
      if (skipCueHideTimerRef.current) {
        clearTimeout(skipCueHideTimerRef.current);
      }
      if (pausedDetailsRevealTimerRef.current) {
        clearTimeout(pausedDetailsRevealTimerRef.current);
        pausedDetailsRevealTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setReviewDetailRelatedSubjects(EMPTY_REVIEW_DETAIL_RELATED_SUBJECTS);

    if (!effectiveShowAnswerStopSubjectDetails) {
      return () => {
        cancelled = true;
      };
    }

    const loadReviewDetailRelatedSubjects = async () => {
      const subjectData = getSubjectDataRecord(item.subject);
      const componentIds = getSubjectIdList(subjectData.component_subject_ids);
      const amalgamationIds = getSubjectIdList(
        subjectData.amalgamation_subject_ids,
      );
      const visuallySimilarIds = getSubjectIdList(
        subjectData.visually_similar_subject_ids,
      );

      const [componentSubjects, amalgamationSubjects] = await Promise.all([
        loadCachedSubjectsByIds(componentIds),
        loadCachedSubjectsByIds(amalgamationIds),
      ]);

      let visuallySimilarSubjects: WKSubject[] = [];
      if (item.subject.object === "kanji") {
        if (visuallySimilarKanjiSource === "niai") {
          const kanjiCharacter = subjectData.characters;
          if (typeof kanjiCharacter === "string" && kanjiCharacter.length > 0) {
            visuallySimilarSubjects = (
              await getNiaiSimilarKanjiSubjects(kanjiCharacter)
            )
              .map(normalizeCachedSubject)
              .filter((subject): subject is WKSubject => Boolean(subject));
          }
        } else {
          visuallySimilarSubjects =
            await loadCachedSubjectsByIds(visuallySimilarIds);
        }
      }

      if (!cancelled) {
        setReviewDetailRelatedSubjects({
          componentSubjects,
          amalgamationSubjects,
          visuallySimilarSubjects,
        });
      }
    };

    void loadReviewDetailRelatedSubjects().catch(() => {
      if (!cancelled) {
        setReviewDetailRelatedSubjects(EMPTY_REVIEW_DETAIL_RELATED_SUBJECTS);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    item.subject,
    item.subject.id,
    effectiveShowAnswerStopSubjectDetails,
    visuallySimilarKanjiSource,
  ]);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const handleKeyboardDidShow = (event: KeyboardEvent) => {
      const endCoordinates = event.endCoordinates;
      const boundedWindowHeight = Math.max(1, Math.round(windowHeight));
      const reportedHeight = Math.max(
        0,
        Math.round(endCoordinates?.height ?? 0),
      );
      const reportedScreenY = Number.isFinite(endCoordinates?.screenY)
        ? Math.round(endCoordinates.screenY)
        : boundedWindowHeight - reportedHeight;
      const inferredHeight = Math.max(0, boundedWindowHeight - reportedScreenY);
      const effectiveHeight = Math.max(reportedHeight, inferredHeight);
      const isSuspiciousKeyboardFrame =
        (reportedHeight > 0 && reportedScreenY <= 1) ||
        effectiveHeight >=
          Math.round(
            boundedWindowHeight * IOS_SUSPICIOUS_KEYBOARD_HEIGHT_RATIO,
          );

      if (isSuspiciousKeyboardFrame) {
        // Some iOS + external keyboard combinations report a full-screen frame.
        // Disable keyboard avoidance so content doesn't collapse to the top.
        setIosKeyboardVisible(false);
        setIosKeyboardAvoidingEnabled(false);
        return;
      }

      setIosKeyboardVisible(true);
      setIosKeyboardAvoidingEnabled(true);
    };

    const handleKeyboardDidHide = () => {
      setIosKeyboardVisible(false);
      setIosKeyboardAvoidingEnabled(true);
    };

    const showSubscription = Keyboard.addListener(
      "keyboardDidShow",
      handleKeyboardDidShow,
    );
    const frameSubscription = Keyboard.addListener(
      "keyboardDidChangeFrame",
      handleKeyboardDidShow,
    );
    const hideSubscription = Keyboard.addListener(
      "keyboardDidHide",
      handleKeyboardDidHide,
    );

    return () => {
      showSubscription.remove();
      frameSubscription.remove();
      hideSubscription.remove();
    };
  }, [windowHeight]);

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const handleKeyboardDidShow = (event: KeyboardEvent) => {
      const nextHeight = Math.max(
        0,
        Math.round(event.endCoordinates?.height ?? 0),
      );
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
    if (androidKeyboardHeight > 0 || androidQuestionLayoutHeight <= 0) return;
    androidBaselineQuestionHeightRef.current = Math.max(
      androidBaselineQuestionHeightRef.current,
      androidQuestionLayoutHeight,
    );
  }, [androidKeyboardHeight, androidQuestionLayoutHeight]);

  const handleQuestionContainerLayout = (event: LayoutChangeEvent) => {
    if (Platform.OS !== "android") return;
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    setAndroidQuestionLayoutHeight((currentHeight) =>
      currentHeight === nextHeight ? currentHeight : nextHeight,
    );
  };

  const syncAndroidKeyboardMetrics = () => {
    if (Platform.OS !== "android") return;

    const syncMetrics = () => {
      if (!mountedRef.current) return;
      const keyboardMetrics = Keyboard.metrics();
      const measuredHeight = Math.max(
        0,
        Math.round(keyboardMetrics?.height ?? 0),
      );
      if (measuredHeight > 0) {
        setAndroidKeyboardHeight(measuredHeight);
      }
    };

    requestAnimationFrame(syncMetrics);
    setTimeout(syncMetrics, 120);
  };

  // Previous answered item tracking
  const [previousAnswerItem, setPreviousAnswerItem] =
    useState<PreviousAnswerItem | null>(null);

  // Animation values - migrated to Reanimated useSharedValue
  const boxPositionX = useSharedValue(0);
  const boxPositionY = useSharedValue(0);
  const boxScale = useSharedValue(1);
  const boxOpacity = useSharedValue(0);
  const shakeAnimation = useSharedValue(0);
  const feedbackOpacity = useSharedValue(0);
  const skipCueOpacity = useSharedValue(0);
  const skipCueTranslateY = useSharedValue(14);

  // SRS progression card animation
  const srsCardOpacity = useSharedValue(0);
  const srsCardTranslateY = useSharedValue(50);

  // Anki mode container animation
  const ankiContainerHeight = useSharedValue(0);

  // Paused-state Skip should not alter accuracy on its own.
  const answeredCountForAccuracy = currentItem;
  const accuracyPercent =
    answeredCountForAccuracy > 0
      ? Math.round((correctAnswersCount / answeredCountForAccuracy) * 100)
      : 0;
  // Keep only the progress bar animation
  const animatedProgressWidth = useAnimatedPercentage(
    totalItems,
    completedCount,
  );
  const subject = item.subject;
  const currentQuestionKey = `${item.id}:${questionType}:${currentItem}`;
  const isCurrentQuestionAnkiRevealed =
    ankiAnswerRevealed && ankiRevealQuestionKey === currentQuestionKey;
  const reviewSubjectLevel =
    typeof subject.data.level === "number" ? subject.data.level : null;
  const reviewSrsStage =
    typeof item.srsStage === "number" ? item.srsStage : null;
  const reviewSrsStageInfo =
    reviewSrsStage !== null ? getSrsStageDisplayInfo(reviewSrsStage) : null;
  const shouldShowReviewItemMetadata =
    showReviewItemLevelAndSrsStage &&
    !isLessonFlow &&
    reviewSubjectLevel !== null &&
    reviewSrsStageInfo !== null;

  const normalizedVoiceReadingHints = useMemo(() => {
    if (questionType !== "reading") {
      return [];
    }

    const acceptedReadings =
      subject.data.readings
        ?.filter((reading: any) => reading.accepted_answer)
        ?.map((reading: any) => normalizeJapaneseReading(reading.reading))
        .filter((reading: string) => reading.length > 0) || [];

    if (acceptedReadings.length > 0) {
      return Array.from(new Set(acceptedReadings));
    }

    const fallbackReadings =
      subject.data.readings
        ?.map((reading: any) => normalizeJapaneseReading(reading.reading))
        .filter((reading: string) => reading.length > 0) || [];

    return Array.from(new Set(fallbackReadings));
  }, [questionType, subject.data.readings]);

  const normalizedVoiceReadingHintSet = useMemo(
    () => new Set(normalizedVoiceReadingHints),
    [normalizedVoiceReadingHints],
  );

  const ensureVoiceReadingLookupLoaded = useCallback(async () => {
    if (questionType !== "reading" || voiceReadingLookupRef.current) {
      return;
    }

    try {
      voiceReadingLookupRef.current = await ensureVoiceReadingLookup();
    } catch (error) {
      console.error("Error loading voice reading lookup:", error);
    }
  }, [questionType]);

  const normalizeVoiceTranscript = (transcript: string): string => {
    const normalizedWidth = transcript.normalize("NFKC").trim();
    if (!normalizedWidth) {
      return "";
    }

    if (questionType === "meaning") {
      return normalizedWidth.replace(/\s+/g, " ");
    }

    const compactTranscript = compactJapaneseText(normalizedWidth);
    if (!compactTranscript) {
      return "";
    }

    const numericKanjiTranscript =
      replaceArabicNumbersWithKanji(compactTranscript);

    const subjectCharacters = compactJapaneseText(subject.data.characters);
    if (
      subjectCharacters &&
      (matchesJapaneseAnswer(compactTranscript, subjectCharacters) ||
        matchesJapaneseAnswer(numericKanjiTranscript, subjectCharacters))
    ) {
      const hintedReading = normalizedVoiceReadingHints[0];
      if (hintedReading) {
        return hintedReading;
      }
    }

    const hiraganaCandidate = normalizeJapaneseReading(compactTranscript);

    if (KANJI_CHARACTER_REGEX.test(numericKanjiTranscript)) {
      const lookup = voiceReadingLookupRef.current;
      if (lookup && normalizedVoiceReadingHints.length > 0) {
        const matchedReading = resolveExpectedReadingFromKanji(
          numericKanjiTranscript,
          normalizedVoiceReadingHints,
          lookup,
        );
        if (matchedReading) {
          return matchedReading;
        }
      }
    }

    return hiraganaCandidate;
  };

  const scoreVoiceCandidate = (candidateAnswer: string): number => {
    if (!candidateAnswer) {
      return -1;
    }

    const result = resolveReadingModeResult({
      result: checkAnswerWithDetails(
        candidateAnswer,
        subject,
        questionType,
        studyMaterials,
        questionType === "reading"
          ? {
              singleKanjiReadings:
                voiceReadingLookupRef.current?.singleKanjiReadings,
              acceptAnyKanjiOnyomiReading,
            }
          : undefined,
      ),
      answer: candidateAnswer,
      questionType,
      acceptCharactersAsCorrectForReading,
      requireSubjectCharactersForReading,
      subjectCharacters: subject.data.characters,
    });

    if (
      result === AnswerCheckerResult.Precise ||
      result === AnswerCheckerResult.Imprecise
    ) {
      return 3;
    }

    if (RETRYABLE_ANSWER_RESULTS.has(result)) {
      return 2;
    }

    if (result === AnswerCheckerResult.Incorrect) {
      return 1;
    }

    return 0;
  };

  const selectBestVoiceCandidate = (
    results: { transcript: string; confidence: number }[],
  ): { answer: string; score: number } => {
    let selectedTranscript = "";
    let selectedScore = -1;
    let selectedConfidence = -1;

    for (const result of results) {
      const candidate = normalizeVoiceTranscript(result.transcript);
      if (!candidate) {
        continue;
      }

      const candidateScore = scoreVoiceCandidate(candidate);
      const candidateConfidence = result.confidence ?? -1;

      if (
        candidateScore > selectedScore ||
        (candidateScore === selectedScore &&
          candidateConfidence > selectedConfidence)
      ) {
        selectedTranscript = candidate;
        selectedScore = candidateScore;
        selectedConfidence = candidateConfidence;
      }
    }

    return {
      answer: selectedTranscript,
      score: selectedScore,
    };
  };

  const selectMostProbableVoiceKana = (
    results: { transcript: string; confidence: number }[],
  ): string => {
    if (questionType !== "reading") {
      return normalizeVoiceTranscript(results[0]?.transcript || "");
    }

    const kanaScores = new Map<string, number>();

    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      const candidate = normalizeVoiceTranscript(result.transcript);
      if (!candidate || KANJI_CHARACTER_REGEX.test(candidate)) {
        continue;
      }

      const confidenceWeight =
        result.confidence >= 0
          ? result.confidence
          : Math.max(0.1, 0.35 - index * 0.05);
      const expectedBoost = normalizedVoiceReadingHintSet.has(candidate)
        ? 0.75
        : 0;
      const finalScore = confidenceWeight + expectedBoost;

      kanaScores.set(candidate, (kanaScores.get(candidate) ?? 0) + finalScore);
    }

    let bestKanaCandidate = "";
    let bestScore = -1;
    kanaScores.forEach((score, kana) => {
      if (score > bestScore) {
        bestScore = score;
        bestKanaCandidate = kana;
      }
    });

    return bestKanaCandidate;
  };

  const pickHigherScoringVoiceCandidate = (
    primary: { answer: string; score: number },
    fallbackTranscript?: string,
  ): { answer: string; score: number } => {
    const fallbackAnswer = normalizeVoiceTranscript(fallbackTranscript || "");
    if (!fallbackAnswer) {
      return primary;
    }

    const fallbackScore = scoreVoiceCandidate(fallbackAnswer);
    if (fallbackScore > primary.score) {
      return {
        answer: fallbackAnswer,
        score: fallbackScore,
      };
    }

    return primary;
  };

  const shouldRetryVoiceReadingFromScriptMismatch = (candidate: {
    answer: string;
    score: number;
  }): boolean => {
    if (questionType !== "reading" || candidate.score !== 2) {
      return false;
    }

    return KANJI_CHARACTER_REGEX.test(candidate.answer);
  };

  const getVoiceContextualStrings = () => {
    if (questionType === "reading") {
      return normalizedVoiceReadingHints.slice(0, 100);
    }

    const meanings = subject.data.meanings
      .map((meaning: any) => meaning.meaning?.trim())
      .filter((meaning: string | undefined): meaning is string =>
        Boolean(meaning),
      );
    const synonyms =
      studyMaterials?.meaning_synonyms?.map((synonym) => synonym.trim()) || [];
    return Array.from(new Set([...meanings, ...synonyms])).slice(0, 20);
  };

  const shouldUseOnDeviceVoiceRecognition = useCallback((): boolean => {
    if (questionType !== "reading") {
      return false;
    }

    try {
      return ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
    } catch (error) {
      console.error("Error checking on-device speech support:", error);
      return false;
    }
  }, [questionType]);

  const checkVoicePermissions = useCallback(async () => {
    try {
      const available =
        await ExpoSpeechRecognitionModule.isRecognitionAvailable();
      if (!available) {
        setVoiceError("Speech recognition is not available on this device.");
        return false;
      }

      const useOnDeviceRecognition = shouldUseOnDeviceVoiceRecognition();
      const result = useOnDeviceRecognition
        ? await ExpoSpeechRecognitionModule.getMicrophonePermissionsAsync()
        : await ExpoSpeechRecognitionModule.getPermissionsAsync();
      if (!result.granted) {
        return false;
      }

      setVoiceError(null);
      return true;
    } catch (error) {
      console.error("Error checking speech permissions:", error);
      setVoiceError("Unable to check speech permissions.");
      return false;
    }
  }, [shouldUseOnDeviceVoiceRecognition]);

  const requestVoicePermissions = useCallback(async () => {
    try {
      const useOnDeviceRecognition = shouldUseOnDeviceVoiceRecognition();
      const result = useOnDeviceRecognition
        ? await ExpoSpeechRecognitionModule.requestMicrophonePermissionsAsync()
        : await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        setVoiceError("Microphone permission is required for voice answers.");
      } else {
        setVoiceError(null);
      }
      return result.granted;
    } catch (error) {
      console.error("Error requesting speech permissions:", error);
      setVoiceError("Unable to request speech permissions.");
      return false;
    }
  }, [shouldUseOnDeviceVoiceRecognition]);

  const startVoiceRecognition = async () => {
    if (
      !isVoiceReviewEnabled ||
      answered ||
      isPausedOnWrong ||
      isPausedOnCloseAnswer ||
      isPausedOnCorrect ||
      navigatingToDetail
    ) {
      return;
    }

    const isPermissionAlreadyGranted = await checkVoicePermissions();
    if (!isPermissionAlreadyGranted) {
      const granted = await requestVoicePermissions();
      if (!granted) {
        return;
      }
    }

    if (questionType === "reading") {
      await ensureVoiceReadingLookupLoaded();
    }

    try {
      setVoiceError(null);
      setVoiceInterimTranscript("");
      isVoiceSubmittingRef.current = false;
      isVoiceRetryPendingRef.current = false;
      latestVoiceResultsRef.current = [];
      const useOnDeviceRecognition = shouldUseOnDeviceVoiceRecognition();
      await ExpoSpeechRecognitionModule.start({
        lang: questionType === "reading" ? "ja-JP" : "en-US",
        interimResults: true,
        continuous: false,
        maxAlternatives: 5,
        contextualStrings: getVoiceContextualStrings(),
        addsPunctuation: false,
        iosTaskHint: questionType === "reading" ? "confirmation" : "search",
        requiresOnDeviceRecognition: useOnDeviceRecognition,
      });
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      setVoiceError("Failed to start voice recognition.");
    }
  };

  const stopVoiceRecognition = async () => {
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch (error) {
      console.error("Error stopping speech recognition:", error);
    } finally {
      setVoiceInterimTranscript("");
    }
  };

  const clearVoiceCapturedInput = () => {
    setUserAnswer("");
    setVoiceInterimTranscript("");
    setVoiceError(null);
    latestVoiceResultsRef.current = [];
    if (kanaInputRef.current?.clearInput) {
      kanaInputRef.current.clearInput();
    }
  };

  const submitDetectedVoiceAnswer = async (
    detectedAnswer: string,
    shouldStopRecognition: boolean,
    submissionDelayMs = 0,
  ) => {
    if (
      !detectedAnswer ||
      !mountedRef.current ||
      isVoiceSubmittingRef.current
    ) {
      return;
    }

    isVoiceSubmittingRef.current = true;
    isVoiceRetryPendingRef.current = false;
    setVoiceError(null);
    setVoiceInterimTranscript(submissionDelayMs > 0 ? detectedAnswer : "");
    latestVoiceResultsRef.current = [];
    setUserAnswer(detectedAnswer);
    kanaInputRef.current?.setInputText?.(detectedAnswer);

    if (shouldStopRecognition) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (error) {
        console.error(
          "Error stopping speech recognition before submit:",
          error,
        );
      }
    }

    if (submissionDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, submissionDelayMs));
      if (!mountedRef.current) {
        isVoiceSubmittingRef.current = false;
        return;
      }
    }

    setVoiceInterimTranscript("");
    await handleSubmitAnswer(detectedAnswer);

    setTimeout(() => {
      isVoiceSubmittingRef.current = false;
    }, 200);
  };

  const handleRetryVoiceRecognition = () => {
    if (!isVoiceReviewEnabled || !isVoiceRecognizing) {
      return;
    }

    clearVoiceCapturedInput();
    isVoiceSubmittingRef.current = false;
    isVoiceRetryPendingRef.current = true;

    try {
      ExpoSpeechRecognitionModule.abort();
    } catch (abortError) {
      console.error("Error aborting speech recognition:", abortError);
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch (stopError) {
        console.error("Error stopping speech recognition:", stopError);
      }
    }
  };

  const handleStopAndSubmitVoice = () => {
    const selected = selectBestVoiceCandidate(latestVoiceResultsRef.current);
    const bestCandidate = pickHigherScoringVoiceCandidate(
      selected,
      voiceInterimTranscript,
    );
    const answerToSubmit = bestCandidate.answer;

    if (!answerToSubmit) {
      void stopVoiceRecognition();
      setVoiceError("No speech detected. Please try again.");
      return;
    }

    if (shouldRetryVoiceReadingFromScriptMismatch(bestCandidate)) {
      void stopVoiceRecognition();
      setVoiceInterimTranscript("");
      setVoiceError(VOICE_READING_SCRIPT_MISMATCH_ERROR);
      return;
    }

    void submitDetectedVoiceAnswer(answerToSubmit, true);
  };

  useEffect(() => {
    if (!isVoiceReviewEnabled) {
      void stopVoiceRecognition();
      setVoiceError(null);
      return;
    }

    void checkVoicePermissions();
  }, [isVoiceReviewEnabled, checkVoicePermissions]);

  useEffect(() => {
    if (!isVoiceReviewEnabled || questionType !== "reading") {
      return;
    }

    void ensureVoiceReadingLookupLoaded();
  }, [ensureVoiceReadingLookupLoaded, isVoiceReviewEnabled, questionType]);

  useEffect(() => {
    return () => {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // no-op
      }
    };
  }, []);

  useEffect(() => {
    // Reset state when item or question type changes
    if (!mountedRef.current) return;
    isVoiceSubmittingRef.current = false;
    isVoiceRetryPendingRef.current = false;
    latestVoiceResultsRef.current = [];
    if (effectiveAnkiCardMode) {
      // When transitioning from keyboard mode -> Anki mode, explicitly dismiss
      // any focused text input so the first Anki tap is not consumed by blur.
      pausedShortcutInputRef.current?.blur();
      Keyboard.dismiss();
    }
    if (isVoiceReviewEnabled) {
      try {
        ExpoSpeechRecognitionModule.stop();
      } catch {
        // no-op
      }
    }
    const wasFocused = Boolean(
      kanaInputRef.current && (kanaInputRef.current as any).focus,
    );

    // Defer state updates to avoid useInsertionEffect warning
    setTimeout(() => {
      if (!mountedRef.current) return;
      setUserAnswer("");
      setAnswered(false);
      setAnswerResult(null);
      setRetryCount(0);
      setNavigatingToDetail(false);
      setShowRetryFeedback(false);
      setAnkiAnswerRevealed(false);
      setAnkiRevealQuestionKey(null);
      setIsPausedOnWrong(false);
      setIsPausedOnCloseAnswer(false);
      setIsPausedOnCorrect(false);
      setPausedDetailsSheetVisible(false);
      setWrongAnswerText(null);
      setCloseAnswerText(null);
      setCorrectAnswerText(null);
      setIsReplayingAudio(false);
      setAnswerFeedback(null);
      setShowContextHint(false);
      setIsUsingDefaultJitaiFont(false);
      setVoiceInterimTranscript("");
      setVoiceError(null);
      isVoiceSubmittingRef.current = false;
      isVoiceRetryPendingRef.current = false;
      latestVoiceResultsRef.current = [];
      shakeAnimation.value = 0;
      feedbackOpacity.value = 0;
      // Note: Do NOT reset SRS card animation here - let it auto-dismiss via its own timer
      // The SRS card shows for the PREVIOUS completed item and should stay visible
      // Reset anki container animation
      ankiContainerHeight.value = 0;
      // Ensure input is visually cleared with uncontrolled TextInput
      if (kanaInputRef.current?.clearInput) {
        kanaInputRef.current.clearInput();
      }
      // Restore focus to avoid keyboard flicker
      if (wasFocused && !effectiveAnkiCardMode) {
        const focusDelay =
          Platform.OS === "android" ? ANDROID_AUTOFOCUS_DELAY_MS : 0;
        if (focusDelay > 0) {
          setTimeout(() => {
            if (mountedRef.current) {
              kanaInputRef.current?.focus?.();
            }
          }, focusDelay);
        } else {
          requestAnimationFrame(() => {
            if (mountedRef.current) {
              kanaInputRef.current?.focus?.();
            }
          });
        }
      }
    }, 0);
  }, [
    item.id,
    questionType,
    currentItem,
    isVoiceReviewEnabled,
    effectiveAnkiCardMode,
    shakeAnimation,
    feedbackOpacity,
    ankiContainerHeight,
  ]);

  // Animate SRS progression card when it should show
  useEffect(() => {
    if (
      srsProgression &&
      (srsProgression.show || !srsProgression.hasOwnProperty("show"))
    ) {
      // Show card with slide up animation using Reanimated
      srsCardOpacity.value = withTiming(1, { duration: 300 });
      srsCardTranslateY.value = withTiming(0, { duration: 300 });

      // Auto-dismiss after 3 seconds
      const dismissTimer = setTimeout(() => {
        if (onSRSCardDismiss) {
          onSRSCardDismiss();
        }
      }, 3000);

      return () => clearTimeout(dismissTimer);
    } else {
      // Hide card using Reanimated
      srsCardOpacity.value = withTiming(0, { duration: 200 });
      srsCardTranslateY.value = withTiming(50, { duration: 200 });
    }
  }, [srsProgression, srsCardOpacity, srsCardTranslateY, onSRSCardDismiss]);

  // Restore the useFocusEffect to reset state when returning to the screen
  useFocusEffect(
    React.useCallback(() => {
      // Always reset navigatingToDetail when screen is focused
      if (mountedRef.current) {
        setNavigatingToDetail(false);

        // Note: Do NOT clear SRS progression here - let it auto-dismiss via its own timer

        // Force focus input when screen is focused
        // Run after navigation interactions to avoid race conditions on iPad/macOS
        // when returning with a programmatic back action.
        const focusInput = () => {
          if (kanaInputRef.current?.focus && mountedRef.current) {
            kanaInputRef.current.focus();
          }
        };

        const primaryDelay = Platform.select({
          android: ANDROID_AUTOFOCUS_DELAY_MS,
          ios: isIpadOrMacFormFactor ? 220 : 100,
          default: 100,
        });
        const fallbackDelay = Platform.select({
          android: null,
          ios: isIpadOrMacFormFactor ? 700 : 500,
          default: 500,
        });
        let t1: ReturnType<typeof setTimeout> | null = null;
        let t2: ReturnType<typeof setTimeout> | null = null;
        const interactionTask = InteractionManager.runAfterInteractions(() => {
          t1 = setTimeout(focusInput, primaryDelay ?? 100);
          if (fallbackDelay !== null) {
            t2 = setTimeout(focusInput, fallbackDelay);
          }
        });

        return () => {
          if (t1) {
            clearTimeout(t1);
          }
          if (t2) {
            clearTimeout(t2);
          }
          interactionTask.cancel();
        };
      }
    }, [isIpadOrMacFormFactor]),
  );

  useEffect(() => {
    if (navigatingToDetail) {
      pausedShortcutInputRef.current?.blur();
      return;
    }

    if (!isPausedOnWrong && !isPausedOnCloseAnswer && !isPausedOnCorrect) {
      pausedShortcutInputRef.current?.blur();
      return;
    }

    // Keep shortcut capture on a hidden input so the visible answer input
    // is not left in a stale focused state on iPad when progressing.
    Keyboard.dismiss();

    const focusTimer = setTimeout(
      () => {
        if (mountedRef.current) {
          pausedShortcutInputRef.current?.focus();
        }
      },
      Platform.OS === "android" ? 140 : 90,
    );

    return () => clearTimeout(focusTimer);
  }, [
    isPausedOnWrong,
    isPausedOnCloseAnswer,
    isPausedOnCorrect,
    navigatingToDetail,
  ]);

  const completeAnswer = (feedbackType: "correct" | "incorrect" | "close") => {
    // Set answered state but don't animate the feedback overlay
    if (!mountedRef.current) return Promise.resolve();

    // Defer state updates to avoid useInsertionEffect warning
    setTimeout(() => {
      if (!mountedRef.current) return;
      setAnswered(true);

      // Haptic feedback
      if (feedbackType === "correct") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAnswerFeedback("correct");
      } else if (feedbackType === "close") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setAnswerFeedback("close");
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setAnswerFeedback("incorrect");
      }
    }, 0);

    // Show feedback briefly using Reanimated
    feedbackOpacity.value = withSequence(
      withTiming(0.7, { duration: 100 }),
      withDelay(
        200,
        withTiming(0, { duration: 300 }, (finished) => {
          if (finished && mountedRef.current) {
            scheduleOnRN(setAnswerFeedback, null);
          }
        }),
      ),
    );

    // Return a promise to maintain compatibility with existing code
    return Promise.resolve();
  };

  const resetInputFeedback = () => {
    setAnswerFeedback(null);
    feedbackOpacity.value = 0;
  };

  const animateShake = () => {
    // Reset shake animation
    shakeAnimation.value = 0;

    // Create a sequence of small movements to create a shake effect using Reanimated
    shakeAnimation.value = withSequence(
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(5, { duration: 50 }),
      withTiming(-5, { duration: 50 }),
      withTiming(0, { duration: 50 }, (finished) => {
        if (finished && mountedRef.current) {
          scheduleOnRN(setShowRetryFeedback, true);
        }
      }),
    );

    return new Promise<void>((resolve) => {
      setTimeout(resolve, 350);
    });
  };

  const animateAnsweredItemBox = () => {
    const topMargin = 140; // Distance from top edge of screen
    const targetX = -(width / 2); // Move left
    const targetY = -(height / 2) + topMargin; // Move up
    const targetScale = 0.6;

    // Reset animation values to starting position (center of screen)
    boxPositionX.value = 0;
    boxPositionY.value = 0;
    boxScale.value = 1;
    boxOpacity.value = 1;

    if (!reviewAnimatePreviousQuestion) {
      boxPositionX.value = targetX;
      boxPositionY.value = targetY;
      boxScale.value = targetScale;
      return;
    }

    // Animate the box from center to top left using Reanimated (runs in parallel by default)
    boxPositionX.value = withTiming(targetX, { duration: 600 });
    boxPositionY.value = withTiming(targetY, { duration: 600 });
    boxScale.value = withTiming(targetScale, { duration: 600 });
  };

  const handleAnswerChange = (text: string) => {
    if (mountedRef.current) {
      if (isPausedOnWrong || isPausedOnCloseAnswer || isPausedOnCorrect) {
        return;
      }
      // If the previous question left us in an answered state (e.g., same id/type back-to-back),
      // reset so the user can answer again
      if (answered) {
        setAnswered(false);
        setAnswerResult(null);
      }
      setUserAnswer(text);
      // Hide retry feedback when user starts typing again
      if (showRetryFeedback) {
        setShowRetryFeedback(false);
      }
    }
  };

  const getItemColor = (itemType: string) => {
    return getSubjectTypeColor(itemType as any);
  };

  const finalizeCurrentVocabularyAudio = () => {
    const finalize = vocabularyAudioFinalizeRef.current;
    if (finalize) {
      finalize();
      return;
    }

    const currentSound = vocabularyAudioSoundRef.current;
    if (!currentSound) {
      return;
    }

    vocabularyAudioSoundRef.current = null;
    currentSound.setOnPlaybackStatusUpdate(null);
    void currentSound.stopAsync().catch(() => {});
    void currentSound.unloadAsync().catch(() => {});
  };

  const waitForVocabularySoundToFinish = (
    sound: AudioSound,
    requestId: number,
  ): Promise<void> =>
    new Promise((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const finalize = () => {
        if (settled) {
          return;
        }
        settled = true;

        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        if (vocabularyAudioFinalizeRef.current === finalize) {
          vocabularyAudioFinalizeRef.current = null;
        }
        if (vocabularyAudioSoundRef.current === sound) {
          vocabularyAudioSoundRef.current = null;
        }

        sound.setOnPlaybackStatusUpdate(null);
        void sound.unloadAsync().finally(resolve);
      };

      vocabularyAudioFinalizeRef.current = finalize;
      timeout = setTimeout(finalize, VOCABULARY_AUDIO_MAX_PLAYBACK_MS);

      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (requestId !== vocabularyAudioRequestIdRef.current) {
          finalize();
          return;
        }

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

  const playVocabularyAudio = async (options?: {
    force?: boolean;
    showReplayLoading?: boolean;
  }) => {
    const shouldForcePlayback = options?.force ?? false;
    const showReplayLoading = options?.showReplayLoading ?? false;
    const isVocabularySubject =
      item.subject.object === "vocabulary" ||
      item.subject.object === "kana_vocabulary";

    if (!isVocabularySubject) {
      return;
    }

    if (!shouldForcePlayback && !autoplayVocabularyAudio) {
      return;
    }

    const pronunciation_audios = (item.subject.data as any)
      .pronunciation_audios;
    if (!pronunciation_audios || pronunciation_audios.length === 0) {
      return;
    }

    const audioFiles = pickPreferredPronunciationAudios(
      pronunciation_audios,
      item.subject.data.readings ?? null,
      vocabularyAudioVoice || "female",
      { preferredContentType: "audio/mpeg" },
    );
    if (audioFiles.length === 0) return;

    const requestId = ++vocabularyAudioRequestIdRef.current;
    finalizeCurrentVocabularyAudio();

    if (showReplayLoading && mountedRef.current) {
      setIsReplayingAudio(true);
    }

    for (const audioFile of audioFiles) {
      try {
        if (requestId !== vocabularyAudioRequestIdRef.current) {
          return;
        }

        // Set up audio session for playback through speaker (iOS only)
        if (Platform.OS === "ios") {
          try {
            await AudioSessionManager.overrideSpeaker();
          } catch {
            // Silent failure for audio session override
          }
        }

        const cachedAudioUri = await getCachedOrDownloadVocabularyAudioUri(
          item.subject.id,
          audioFile,
        );

        if (requestId !== vocabularyAudioRequestIdRef.current) {
          return;
        }

        const { sound } = await Audio.Sound.createAsync(
          { uri: cachedAudioUri ?? audioFile.url },
          {
            shouldPlay: true,
            volume: 1.0,
          },
        );

        if (requestId !== vocabularyAudioRequestIdRef.current) {
          sound.setOnPlaybackStatusUpdate(null);
          await sound.unloadAsync();
          return;
        }

        vocabularyAudioSoundRef.current = sound;
        if (showReplayLoading && mountedRef.current) {
          setIsReplayingAudio(false);
        }

        await waitForVocabularySoundToFinish(sound, requestId);
      } catch (error) {
        if (requestId !== vocabularyAudioRequestIdRef.current) {
          return;
        }
        console.error("Failed to play vocabulary audio clip:", error);
      }
    }

    if (showReplayLoading && mountedRef.current) {
      setIsReplayingAudio(false);
    }
  };

  const handleReplayAudio = () => {
    if (isReplayingAudio) {
      return;
    }

    void playVocabularyAudio({ force: true, showReplayLoading: true });
  };

  const showSkipCue = useCallback(() => {
    if (skipCueHideTimerRef.current) {
      clearTimeout(skipCueHideTimerRef.current);
      skipCueHideTimerRef.current = null;
    }

    setSkipCueText("Skipped");

    skipCueOpacity.value = 0;
    skipCueTranslateY.value = 14;
    skipCueOpacity.value = withTiming(1, { duration: 170 });
    skipCueTranslateY.value = withTiming(0, {
      duration: 170,
      easing: Easing.out(Easing.cubic),
    });

    skipCueHideTimerRef.current = setTimeout(() => {
      skipCueOpacity.value = withTiming(0, { duration: 240 }, (finished) => {
        if (finished && mountedRef.current) {
          scheduleOnRN(setSkipCueText, null);
        }
      });
      skipCueTranslateY.value = withTiming(-10, {
        duration: 240,
        easing: Easing.in(Easing.cubic),
      });
      skipCueHideTimerRef.current = null;
    }, SKIP_CUE_VISIBLE_MS);
  }, [skipCueOpacity, skipCueTranslateY]);

  const releasePausedShortcutFocus = useCallback(() => {
    pausedShortcutInputRef.current?.blur();
  }, []);

  const handleSubmitAnswer = async (providedAnswer?: string) => {
    if (answered || !mountedRef.current) return;
    const isVoiceSubmission = typeof providedAnswer === "string";
    let shouldRefocusInput = !isVoiceSubmission;

    // Ensure kana input is properly flushed (e.g., きぶn → きぶん)
    let answer = (providedAnswer ?? userAnswer).trim();
    if (
      !isVoiceSubmission &&
      questionType === "reading" &&
      kanaInputRef.current?.flushKana
    ) {
      answer = kanaInputRef.current.flushKana();
    }

    if (!answer) {
      // When skipping is enabled, an empty submit asks this item again later
      // instead of validating an answer.
      if (!isVoiceSubmission && allowSkippingReviews && onSkip) {
        showSkipCue();
        onSkip(item, questionType);
      }
      return;
    }

    // Reset temporary default-font override after submitting this question.
    if (isUsingDefaultJitaiFont) {
      setIsUsingDefaultJitaiFont(false);
    }

    // Needed for the single-kanji vocabulary warning when users input a kanji reading.
    if (
      questionType === "reading" &&
      isSingleKanjiVocabularySubject(item.subject)
    ) {
      await ensureVoiceReadingLookupLoaded();
    }

    // Check answer using the answer checker
    let result = checkAnswerWithDetails(
      answer,
      item.subject,
      questionType,
      studyMaterials,
      questionType === "reading"
        ? {
            singleKanjiReadings:
              voiceReadingLookupRef.current?.singleKanjiReadings,
            acceptAnyKanjiOnyomiReading,
          }
        : undefined,
    );

    result = resolveReadingModeResult({
      result,
      answer,
      questionType,
      acceptCharactersAsCorrectForReading,
      requireSubjectCharactersForReading,
      subjectCharacters: item.subject.data.characters,
    });

    // Remove legacy override that was incorrectly marking vocabulary readings as correct for kanji

    if (!mountedRef.current) return;
    setAnswerResult(result);

    // Handle different answer results
    switch (result) {
      case AnswerCheckerResult.Precise:
      case AnswerCheckerResult.Imprecise: {
        const shouldPauseOnCloseAnswer =
          result === AnswerCheckerResult.Imprecise &&
          disableAutoProgressOnCloseAnswer;
        // Correct answer
        setAnswered(true);
        // Complete answer with animation and haptic feedback
        await completeAnswer(shouldPauseOnCloseAnswer ? "close" : "correct");

        if (!mountedRef.current) return;

        if (shouldPauseOnCloseAnswer) {
          setIsPausedOnCloseAnswer(true);
          setIsPausedOnWrong(false);
          setIsPausedOnCorrect(false);
          suppressSubmitUntilRef.current =
            Date.now() + PAUSED_SHORTCUT_GUARD_MS;
          setCloseAnswerText(answer);
          setWrongAnswerText(null);
          setCorrectAnswerText(null);
          shouldRefocusInput = false;
          Keyboard.dismiss();
          // Keep behavior consistent with paused-wrong flow: clear the live input while paused.
          setUserAnswer("");
          if (kanaInputRef.current?.clearInput) {
            kanaInputRef.current.clearInput();
          }
          if (questionType === "reading") {
            playVocabularyAudio();
          }
          break;
        }

        // If pause on correct is enabled, show accepted answers and wait for user action
        if (disableAutoProgressOnCorrect) {
          setIsPausedOnCloseAnswer(false);
          setIsPausedOnWrong(false);
          setIsPausedOnCorrect(true);
          suppressSubmitUntilRef.current =
            Date.now() + PAUSED_SHORTCUT_GUARD_MS;
          setCorrectAnswerText(answer);
          setCloseAnswerText(null);
          setWrongAnswerText(null);
          shouldRefocusInput = false;
          Keyboard.dismiss();
          // Keep behavior consistent with paused-wrong flow: clear the live input while paused.
          setUserAnswer("");
          if (kanaInputRef.current?.clearInput) {
            kanaInputRef.current.clearInput();
          }
          if (questionType === "reading") {
            playVocabularyAudio();
          }
          break;
        }

        // Store this item for the animation
        const characters =
          subject.data.characters ||
          (subject.data.character_images
            ? subject.data.meanings[0].meaning
            : "");
        setPreviousAnswerItem({
          id: item.subject.id,
          subject: item.subject,
          characters: characters,
          meaning: subject.data.meanings[0].meaning,
          backgroundColor: getItemColor(item.subject.object),
          isCorrect: true,
          questionType: questionType,
        });

        // Animate the item to the top left
        animateAnsweredItemBox();

        // Clear the input synchronously so the next question starts empty,
        // regardless of whether resetSignal changes (e.g. reading → meaning
        // for the same item) or races with pending IME/state updates.
        setUserAnswer("");
        if (kanaInputRef.current?.clearInput) {
          kanaInputRef.current.clearInput();
        }
        setInputResetNonce((nonce) => nonce + 1);

        // Play vocabulary audio if this is a reading question
        if (questionType === "reading") {
          playVocabularyAudio();
        }

        onAnswer(item, questionType, true, retryCount > 0, false);
        break;
      }

      case AnswerCheckerResult.OtherKanjiReading:
      case AnswerCheckerResult.WrongReadingType:
      case AnswerCheckerResult.MismatchingOkurigana:
      case AnswerCheckerResult.ContainsInvalidCharacters:
      case AnswerCheckerResult.IsKanjiButWantReading:
      case AnswerCheckerResult.IsReadingButWantMeaning:
      case AnswerCheckerResult.IsMeaningButWantReading:
      case AnswerCheckerResult.IncorrectNConversion:
        // Not correct, but we allow retrying
        if (!mountedRef.current) return;
        setRetryCount((prevCount) => prevCount + 1);
        // Show shake animation and feedback
        await animateShake();
        // Only clear input after animation
        if (!mountedRef.current) return;
        setUserAnswer("");
        if (kanaInputRef.current?.clearInput) {
          kanaInputRef.current.clearInput();
        }
        break;

      case AnswerCheckerResult.Incorrect:
        // Definitely incorrect
        if (!mountedRef.current) return;
        setAnswered(true);
        // Complete answer with animation and haptic feedback
        await completeAnswer("incorrect");

        if (!mountedRef.current) return;

        // If pause on wrong is enabled, show the correct answer and wait for user action
        if (disableAutoProgressOnWrong) {
          setIsPausedOnWrong(true);
          setIsPausedOnCloseAnswer(false);
          setIsPausedOnCorrect(false);
          suppressSubmitUntilRef.current =
            Date.now() + PAUSED_SHORTCUT_GUARD_MS;
          // Store the wrong answer to display it
          setWrongAnswerText(answer);
          setCloseAnswerText(null);
          setCorrectAnswerText(null);
          if (questionType === "reading") {
            playVocabularyAudio();
          }
          shouldRefocusInput = false;
          Keyboard.dismiss();
          // Don't call onAnswer yet - wait for user to choose action
          break;
        }

        // Store this item for the animation
        const incorrectCharacters =
          subject.data.characters ||
          (subject.data.character_images
            ? subject.data.meanings[0].meaning
            : "");
        setPreviousAnswerItem({
          id: item.subject.id,
          subject: item.subject,
          characters: incorrectCharacters,
          meaning: subject.data.meanings[0].meaning,
          backgroundColor: getItemColor(item.subject.object),
          isCorrect: false,
          questionType: questionType,
        });

        // Animate the item to the top left
        animateAnsweredItemBox();

        // Clear the input synchronously (see matching note in the correct branch).
        setUserAnswer("");
        if (kanaInputRef.current?.clearInput) {
          kanaInputRef.current.clearInput();
        }
        setInputResetNonce((nonce) => nonce + 1);

        onAnswer(item, questionType, false, true, false);
        break;
    }

    // Re-focus the keyboard after answer is processed
    if (!navigatingToDetail && mountedRef.current && shouldRefocusInput) {
      // If not navigating away, keep the keyboard focused
      setTimeout(() => {
        if (kanaInputRef.current?.focus && mountedRef.current) {
          kanaInputRef.current.focus();
        }
      }, 100);
    }
  };

  const handleVoiceAnswerButton = () => {
    if (isVoiceRecognizing) {
      handleStopAndSubmitVoice();
      return;
    }

    void startVoiceRecognition();
  };

  useSpeechRecognitionEvent("start", () => {
    if (!isVoiceReviewEnabled) {
      return;
    }

    setIsVoiceRecognizing(true);
    setVoiceInterimTranscript("");
    setVoiceError(null);
    latestVoiceResultsRef.current = [];
  });

  useSpeechRecognitionEvent("end", () => {
    if (!isVoiceReviewEnabled) {
      return;
    }

    setIsVoiceRecognizing(false);
    if (!isVoiceSubmittingRef.current) {
      setVoiceInterimTranscript("");
    }

    if (isVoiceRetryPendingRef.current) {
      isVoiceRetryPendingRef.current = false;
      void startVoiceRecognition();
    }
  });

  useSpeechRecognitionEvent("result", (event) => {
    if (!isVoiceReviewEnabled || !event.results?.length) {
      return;
    }

    if (isVoiceRetryPendingRef.current || isVoiceSubmittingRef.current) {
      return;
    }

    if (
      answered ||
      isPausedOnWrong ||
      isPausedOnCloseAnswer ||
      isPausedOnCorrect ||
      navigatingToDetail
    ) {
      return;
    }

    latestVoiceResultsRef.current = event.results.map((result) => ({
      transcript: result.transcript,
      confidence: result.confidence ?? -1,
    }));
    const selected = selectBestVoiceCandidate(latestVoiceResultsRef.current);

    if (selected.answer && selected.score >= 3) {
      void submitDetectedVoiceAnswer(selected.answer, true, 750);
      return;
    }

    if (!event.isFinal) {
      const interimKana = selectMostProbableVoiceKana(
        latestVoiceResultsRef.current,
      );
      const interim =
        interimKana ||
        (selected.answer && !KANJI_CHARACTER_REGEX.test(selected.answer)
          ? selected.answer
          : "");
      setVoiceInterimTranscript(interim);
      return;
    }

    const bestCandidate = pickHigherScoringVoiceCandidate(
      selected,
      voiceInterimTranscript,
    );

    if (shouldRetryVoiceReadingFromScriptMismatch(bestCandidate)) {
      setVoiceError(VOICE_READING_SCRIPT_MISMATCH_ERROR);
      setVoiceInterimTranscript("");
      return;
    }

    if (!bestCandidate.answer) {
      setVoiceError("No speech detected. Please try again.");
      setVoiceInterimTranscript("");
      return;
    }

    void submitDetectedVoiceAnswer(bestCandidate.answer, false);
  });

  useSpeechRecognitionEvent("error", (event) => {
    if (!isVoiceReviewEnabled) {
      return;
    }

    if (isVoiceRetryPendingRef.current && event.error === "aborted") {
      isVoiceRetryPendingRef.current = false;
      void startVoiceRecognition();
      return;
    }

    setIsVoiceRecognizing(false);
    setVoiceInterimTranscript("");

    let message = "Speech recognition failed. Please try again.";
    if (event.error === "not-allowed") {
      message = "Microphone permission denied. Enable it in Settings.";
    } else if (
      event.error === "no-speech" ||
      event.error === "speech-timeout"
    ) {
      message = "No speech detected. Please try again.";
    } else if (event.message) {
      message = event.message;
    }

    setVoiceError(message);
  });

  // Improve the navigateToPreviousItemDetail function to handle repeated navigation properly
  const navigateToPreviousItemDetail = () => {
    if (!previousAnswerItem || navigatingToDetail) {
      return;
    }

    setNavigatingToDetail(true);
    Keyboard.dismiss();

    // Navigate to the subject details page of the previous item
    setTimeout(() => {
      router.push({
        pathname: "/subject/[id]",
        params: {
          id: previousAnswerItem.id.toString(),
          returnToReview: "true",
          initialTab: previousAnswerItem.questionType,
        },
      });
    }, 300);
  };

  // Improve the handleNextQuestion function to maintain focus
  const handleNextQuestion = () => {
    releasePausedShortcutFocus();

    if (retryCount > 0 && !answered) {
      // If they've been retrying but decide to move on, mark it as incorrect
      onAnswer(item, questionType, false, true, false);
    }

    // Reset the state for the next question
    setUserAnswer("");
    setAnswered(false);
    setAnswerResult(null);
    setRetryCount(0);
    setShowRetryFeedback(false);
    setAnkiAnswerRevealed(false);
    setAnkiRevealQuestionKey(null);
    setIsPausedOnWrong(false);
    setIsPausedOnCloseAnswer(false);
    setIsPausedOnCorrect(false);
    setWrongAnswerText(null);
    setCloseAnswerText(null);
    setCorrectAnswerText(null);
    resetInputFeedback();
    // Clear the input's native text for uncontrolled TextInput
    if (kanaInputRef.current?.clearInput) {
      kanaInputRef.current.clearInput();
    }

    // Ensure focus is maintained after animation
    setTimeout(() => {
      if (kanaInputRef.current?.focus) {
        kanaInputRef.current.focus();
      }
    }, 350);
  };

  const handleProgressAsCorrect = () => {
    releasePausedShortcutFocus();

    // Store this item for the animation
    const characters =
      subject.data.characters ||
      (subject.data.character_images ? subject.data.meanings[0].meaning : "");
    setPreviousAnswerItem({
      id: item.subject.id,
      subject: item.subject,
      characters: characters,
      meaning: subject.data.meanings[0].meaning,
      backgroundColor: getItemColor(item.subject.object),
      isCorrect: true,
      questionType: questionType,
    });

    // Animate the item to the top left
    animateAnsweredItemBox();

    // Clear input and paused state
    setUserAnswer("");
    setWrongAnswerText(null);
    setCloseAnswerText(null);
    setCorrectAnswerText(null);
    setAnswered(false);
    setAnswerResult(null);
    setRetryCount(0);
    setShowRetryFeedback(false);
    resetInputFeedback();
    if (kanaInputRef.current?.clearInput) {
      kanaInputRef.current.clearInput();
    }

    setIsPausedOnWrong(false);
    setIsPausedOnCloseAnswer(false);
    setIsPausedOnCorrect(false);
    // Mark as correct and progress
    onAnswer(item, questionType, true, retryCount > 0, false);

    // Re-focus input for next question
    setTimeout(() => {
      kanaInputRef.current?.focus?.();
    }, 100);
  };

  // Handler for marking a paused non-correct answer as correct (user override)
  const handleMarkCorrect = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    releasePausedShortcutFocus();

    // Store this item for the animation
    const characters =
      subject.data.characters ||
      (subject.data.character_images ? subject.data.meanings[0].meaning : "");
    setPreviousAnswerItem({
      id: item.subject.id,
      subject: item.subject,
      characters: characters,
      meaning: subject.data.meanings[0].meaning,
      backgroundColor: getItemColor(item.subject.object),
      isCorrect: true,
      questionType: questionType,
    });

    // Animate the item to the top left
    animateAnsweredItemBox();

    // Clear input and paused-answer state
    setUserAnswer("");
    setWrongAnswerText(null);
    setCloseAnswerText(null);
    setCorrectAnswerText(null);
    setAnswered(false);
    setAnswerResult(null);
    setRetryCount(0);
    setShowRetryFeedback(false);
    resetInputFeedback();
    if (kanaInputRef.current?.clearInput) {
      kanaInputRef.current.clearInput();
    }

    setIsPausedOnWrong(false);
    setIsPausedOnCloseAnswer(false);
    setIsPausedOnCorrect(false);
    // Mark as correct (override the wrong answer)
    onAnswer(item, questionType, true, false, false);

    // Re-focus input for next question
    setTimeout(() => {
      kanaInputRef.current?.focus?.();
    }, 100);
  };

  // Handler for skipping from paused-wrong state (re-queue when supported).
  const handlePausedSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    releasePausedShortcutFocus();

    // Clear input and wrong answer state
    setUserAnswer("");
    setWrongAnswerText(null);
    setCloseAnswerText(null);
    setRetryCount(0);
    setShowRetryFeedback(false);
    resetInputFeedback();
    if (kanaInputRef.current?.clearInput) {
      kanaInputRef.current.clearInput();
    }
    // Force a deterministic input reset even if the next question is the
    // same item/type and retryCount doesn't change.
    setInputResetNonce((nonce) => nonce + 1);

    // Reset local state
    setAnswered(false);
    setAnswerResult(null);
    setIsPausedOnWrong(false);
    setIsPausedOnCloseAnswer(false);

    // Prefer explicit skip behavior; fallback to legacy ask-again callback.
    if (onSkip) {
      showSkipCue();
      onSkip(item, questionType);
    } else if (onAskAgain) {
      onAskAgain(item, questionType);
    }

    // Re-focus input for next question
    setTimeout(() => {
      kanaInputRef.current?.focus?.();
    }, 100);
  };

  const handleViewDetails = () => {
    setNavigatingToDetail(true);
    Keyboard.dismiss();
    router.push({
      pathname: "/subject/[id]",
      params: {
        id: item.subject.id.toString(),
        returnToReview: "true",
        initialTab: questionType,
      },
    });
  };

  const handleEmbeddedSubjectPress = useCallback(
    (subjectId: number) => {
      setNavigatingToDetail(true);
      Keyboard.dismiss();
      router.push({
        pathname: "/subject/[id]",
        params: {
          id: subjectId.toString(),
          returnToReview: "true",
          initialTab: questionType,
        },
      });
    },
    [questionType],
  );

  const handleReviewDetailSynonymsChange = useCallback(
    async (synonyms: string[]) => {
      if (!apiToken) {
        throw new Error("Missing API token");
      }

      const subjectId = item.subject.id;
      const studyMaterialsResponse = await getStudyMaterials(
        apiToken,
        { subject_ids: [subjectId] },
        { skipCache: true },
      );
      const existingMaterial = studyMaterialsResponse?.data?.[0];

      if (existingMaterial) {
        await updateStudyMaterial(apiToken, existingMaterial.id, {
          meaning_synonyms: synonyms,
        });
      } else {
        await createStudyMaterial(apiToken, {
          subject_id: subjectId,
          meaning_synonyms: synonyms,
        });
      }

      onSynonymAdded?.(subjectId, synonyms);
    },
    [apiToken, item.subject.id, onSynonymAdded],
  );

  const renderPausedSubjectDetails = () => {
    const subject = item.subject;
    const data = getSubjectDataRecord(subject);
    const meanings = getSubjectMeanings(subject);
    const readings = getSubjectReadings(subject);
    const userSynonyms = studyMaterials?.meaning_synonyms || [];
    const srsStage =
      typeof item.srsStage === "number" ? item.srsStage : undefined;
    const progressionStatus: ReviewDetailProgressionStatus = "success";
    const relatedComponents = reviewDetailRelatedSubjects.componentSubjects.map(
      mapSubjectForDetailGrid,
    );
    const relatedAmalgamations =
      reviewDetailRelatedSubjects.amalgamationSubjects.map(
        mapSubjectForDetailGrid,
      );
    const visuallySimilarSubjects =
      reviewDetailRelatedSubjects.visuallySimilarSubjects.map(
        mapSubjectForDetailGrid,
      );

    if (subject.object === "radical") {
      const characterImages = Array.isArray(data.character_images)
        ? data.character_images
        : [];

      return (
        <RadicalDetails
          embedded
          radical={{
            id: subject.id,
            object: subject.object,
            level: Number(data.level ?? 0),
            characters:
              typeof data.characters === "string" ? data.characters : null,
            meanings,
            mnemonic:
              typeof data.meaning_mnemonic === "string"
                ? data.meaning_mnemonic
                : "",
            characterImages,
            imageUrl: characterImages[0]?.url || null,
            documentUrl:
              typeof data.document_url === "string" ? data.document_url : null,
            amalgamationSubjects: relatedAmalgamations.map(
              (relatedSubject) => ({
                id: relatedSubject.id,
                characters: relatedSubject.characters || "",
                meanings: relatedSubject.meanings,
                level: relatedSubject.level,
              }),
            ),
            userSynonyms,
            srsStage,
          }}
          progressionStatus={progressionStatus}
          onSubjectPress={handleEmbeddedSubjectPress}
          userLevel={userData?.level}
          onSynonymsChange={handleReviewDetailSynonymsChange}
        />
      );
    }

    if (subject.object === "kanji") {
      return (
        <KanjiDetails
          embedded
          kanji={{
            id: subject.id,
            object: subject.object,
            level: Number(data.level ?? 0),
            characters:
              typeof data.characters === "string" ? data.characters : "",
            meanings,
            readings,
            meaningMnemonic:
              typeof data.meaning_mnemonic === "string"
                ? data.meaning_mnemonic
                : "",
            readingMnemonic:
              typeof data.reading_mnemonic === "string"
                ? data.reading_mnemonic
                : "",
            meaningHint:
              typeof data.meaning_hint === "string" ? data.meaning_hint : null,
            readingHint:
              typeof data.reading_hint === "string" ? data.reading_hint : null,
            componentSubjects: relatedComponents,
            amalgamationSubjects: relatedAmalgamations.map(
              (relatedSubject) => ({
                id: relatedSubject.id,
                characters: relatedSubject.characters || "",
                meanings: relatedSubject.meanings,
                level: relatedSubject.level,
              }),
            ),
            visuallySimilarSubjects: visuallySimilarSubjects.map(
              (relatedSubject) => ({
                id: relatedSubject.id,
                characters: relatedSubject.characters || "",
                meanings: relatedSubject.meanings,
                level: relatedSubject.level,
              }),
            ),
            userSynonyms,
            srsStage,
          }}
          progressionStatus={progressionStatus}
          onSubjectPress={handleEmbeddedSubjectPress}
          initialTab={questionType}
          userLevel={userData?.level}
          onSynonymsChange={handleReviewDetailSynonymsChange}
        />
      );
    }

    return (
      <VocabularyDetails
        embedded
        vocabulary={{
          id: subject.id,
          object: subject.object,
          level: Number(data.level ?? 0),
          characters:
            typeof data.characters === "string" ? data.characters : "",
          meanings,
          readings,
          partsOfSpeech: Array.isArray(data.parts_of_speech)
            ? data.parts_of_speech
            : [],
          meaningMnemonic:
            typeof data.meaning_mnemonic === "string"
              ? data.meaning_mnemonic
              : "",
          readingMnemonic:
            typeof data.reading_mnemonic === "string"
              ? data.reading_mnemonic
              : "",
          meaningHint:
            typeof data.meaning_hint === "string" ? data.meaning_hint : null,
          readingHint:
            typeof data.reading_hint === "string" ? data.reading_hint : null,
          componentSubjects: relatedComponents.map((relatedSubject) => ({
            id: relatedSubject.id,
            characters: relatedSubject.characters || "",
            meanings: relatedSubject.meanings,
            level: relatedSubject.level,
          })),
          contextSentences: Array.isArray(data.context_sentences)
            ? data.context_sentences.map((sentence: any) => ({
                ja: sentence?.ja || sentence?.japanese || "",
                en: sentence?.en || sentence?.english || "",
              }))
            : [],
          audioFiles: Array.isArray(data.pronunciation_audios)
            ? data.pronunciation_audios
            : [],
          userSynonyms,
          srsStage,
        }}
        progressionStatus={progressionStatus}
        onSubjectPress={handleEmbeddedSubjectPress}
        initialTab={questionType}
        userLevel={userData?.level}
        onSynonymsChange={handleReviewDetailSynonymsChange}
      />
    );
  };

  const renderPausedDetailsActionButton = ({
    label,
    iconName,
    color,
    onPress,
    disabled = false,
  }: {
    label: string;
    iconName: React.ComponentProps<typeof Ionicons>["name"];
    color: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <TouchableOpacity
      key={label}
      style={[
        styles.pausedDetailsActionButton,
        { borderColor: `${color}55`, backgroundColor: `${color}22` },
        disabled && styles.pausedActionDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.78}
    >
      <Ionicons name={iconName} size={16} color={color} />
      <Text style={[styles.pausedDetailsActionButtonText, { color }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderPausedDetailsActions = () => {
    if (!effectiveShowAnswerStopSubjectDetails) {
      return null;
    }

    const buttons: React.ReactNode[] = [];

    if (isPausedOnWrong) {
      buttons.push(
        renderPausedDetailsActionButton({
          label: "Mark Wrong",
          iconName: "close",
          color: "#f44336",
          onPress: handleProgressAsWrong,
        }),
        renderPausedDetailsActionButton({
          label: "Skip",
          iconName: "play-skip-forward",
          color: "#2196F3",
          onPress: handlePausedSkip,
        }),
        renderPausedDetailsActionButton({
          label: "Mark Correct",
          iconName: "checkmark",
          color: "#4caf50",
          onPress: handleMarkCorrect,
        }),
      );
    } else if (isPausedOnCloseAnswer) {
      buttons.push(
        renderPausedDetailsActionButton({
          label: "Mark Wrong",
          iconName: "close",
          color: "#f44336",
          onPress: handleProgressAsWrong,
        }),
        renderPausedDetailsActionButton({
          label: "Mark Correct",
          iconName: "checkmark",
          color: "#4caf50",
          onPress: handleProgressAsCorrect,
        }),
      );
    } else if (isPausedOnCorrect) {
      buttons.push(
        renderPausedDetailsActionButton({
          label: "Continue",
          iconName: "chevron-forward",
          color: "#4caf50",
          onPress: handleProgressAsCorrect,
        }),
      );
    }

    if (canReplayPausedAudio) {
      buttons.push(
        renderPausedDetailsActionButton({
          label: isReplayingAudio ? "Replaying" : "Replay",
          iconName: isReplayingAudio ? "sync" : "volume-high",
          color: "#9575cd",
          onPress: () => {
            void handleReplayAudio();
          },
          disabled: isReplayingAudio,
        }),
      );
    }

    if (showAddSynonymButton && isPausedOnWrong && questionType === "meaning") {
      buttons.push(
        renderPausedDetailsActionButton({
          label: isAddingSynonym ? "Adding" : "Synonym",
          iconName: "add-circle",
          color: "#ff9800",
          onPress: () => {
            void handleAddAsSynonym();
          },
          disabled: isAddingSynonym,
        }),
      );
    }

    return <View style={styles.pausedDetailsActions}>{buttons}</View>;
  };

  const renderPausedDetailsCorrectAnswer = () => {
    if (!isPausedOnWrong && !isPausedOnCloseAnswer) {
      return null;
    }

    const isCloseAnswer = isPausedOnCloseAnswer;
    const accentColor = isCloseAnswer ? "#ff9800" : "#f44336";
    const label = isCloseAnswer ? "Accepted" : "Correct";
    const iconName: React.ComponentProps<typeof Ionicons>["name"] =
      isCloseAnswer ? "warning" : "close-circle";

    return (
      <View
        style={[
          styles.pausedDetailsCorrectAnswer,
          {
            borderColor: `${accentColor}66`,
            backgroundColor: `${accentColor}16`,
          },
        ]}
      >
        <View
          style={[
            styles.pausedDetailsCorrectAnswerBadge,
            { backgroundColor: `${accentColor}22` },
          ]}
        >
          <Ionicons name={iconName} size={12} color={accentColor} />
          <Text
            style={[
              styles.pausedDetailsCorrectAnswerLabel,
              { color: accentColor },
            ]}
          >
            {label}
          </Text>
        </View>
        <Text
          selectable
          numberOfLines={2}
          style={[
            styles.pausedDetailsCorrectAnswerText,
            { color: theme.textColor },
            questionType === "reading" && fontStyles.japaneseText,
          ]}
        >
          {pausedCorrectAnswerText}
        </Text>
      </View>
    );
  };

  const handleOpenReviewSearch = () => {
    Keyboard.dismiss();
    router.push("/review-search");
  };

  // Handler for progressing with a paused incorrect/close answer as wrong.
  const handleProgressAsWrong = () => {
    releasePausedShortcutFocus();

    // Store this item for the animation
    const incorrectCharacters =
      subject.data.characters ||
      (subject.data.character_images ? subject.data.meanings[0].meaning : "");
    setPreviousAnswerItem({
      id: item.subject.id,
      subject: item.subject,
      characters: incorrectCharacters,
      meaning: subject.data.meanings[0].meaning,
      backgroundColor: getItemColor(item.subject.object),
      isCorrect: false,
      questionType: questionType,
    });

    // Animate the item to the top left
    animateAnsweredItemBox();

    // Clear input and paused-answer state
    setUserAnswer("");
    setWrongAnswerText(null);
    setCloseAnswerText(null);
    setCorrectAnswerText(null);
    setAnswered(false);
    setAnswerResult(null);
    setRetryCount(0);
    setShowRetryFeedback(false);
    resetInputFeedback();
    if (kanaInputRef.current?.clearInput) {
      kanaInputRef.current.clearInput();
    }

    setIsPausedOnWrong(false);
    setIsPausedOnCloseAnswer(false);
    setIsPausedOnCorrect(false);
    // Mark as wrong and progress
    onAnswer(item, questionType, false, true, false);

    // Re-focus input for next question
    setTimeout(() => {
      kanaInputRef.current?.focus?.();
    }, 100);
  };

  const handleSubmitOrAdvance = () => {
    if (Date.now() < suppressSubmitUntilRef.current) {
      return;
    }

    if (isPausedOnWrong) {
      handleProgressAsWrong();
      return;
    }

    if (isPausedOnCloseAnswer) {
      handleProgressAsCorrect();
      return;
    }

    if (isPausedOnCorrect) {
      handleProgressAsCorrect();
      return;
    }

    if (answered) {
      handleNextQuestion();
      return;
    }

    void handleSubmitAnswer();
  };

  // Handler for adding wrong answer as a synonym and marking correct
  const handleAddAsSynonym = async () => {
    if (!apiToken || !wrongAnswerText || isAddingSynonym) return;

    setIsAddingSynonym(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const subjectId = item.subject.id;
      const newSynonym = wrongAnswerText.trim().toLowerCase();

      // Get existing synonyms
      const existingSynonyms = studyMaterials?.meaning_synonyms || [];

      // Check if synonym already exists (shouldn't happen but be safe)
      if (existingSynonyms.some((s) => s.toLowerCase() === newSynonym)) {
        // Already exists, just mark as correct
        handleMarkCorrect();
        return;
      }

      const updatedSynonyms = [...existingSynonyms, newSynonym];

      // Check if study material exists for this subject
      const studyMaterialsResponse = await getStudyMaterials(
        apiToken,
        {
          subject_ids: [subjectId],
        },
        { skipCache: true },
      );

      const existingMaterial = studyMaterialsResponse?.data?.[0];

      if (existingMaterial) {
        // Update existing study material
        await updateStudyMaterial(apiToken, existingMaterial.id, {
          meaning_synonyms: updatedSynonyms,
        });
      } else {
        // Create new study material
        await createStudyMaterial(apiToken, {
          subject_id: subjectId,
          meaning_synonyms: updatedSynonyms,
        });
      }

      // Notify parent to update its studyMaterialsMap
      if (onSynonymAdded) {
        onSynonymAdded(subjectId, updatedSynonyms);
      }

      // Mark as correct after successfully adding synonym
      handleMarkCorrect();
    } catch {
      // Show error feedback
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsAddingSynonym(false);
    }
  };

  const pronunciationAudios = (item.subject.data as any)?.pronunciation_audios;
  const hasReplayableVocabularyAudio =
    (item.subject.object === "vocabulary" ||
      item.subject.object === "kana_vocabulary") &&
    Array.isArray(pronunciationAudios) &&
    pronunciationAudios.length > 0;
  const canReplayPausedAudio =
    questionType === "reading" && hasReplayableVocabularyAudio;
  const canReplayAnkiAudio =
    hasReplayableVocabularyAudio &&
    (questionType === "reading" || effectiveAnkiGroupQuestions);

  const handlePausedShortcutKeyPress = (event: TextInputKeyPressEvent) => {
    const pressedKey = event.nativeEvent.key;
    if (!pressedKey) {
      return;
    }

    tryHandlePausedShortcutKey(pressedKey);
  };

  const tryHandlePausedShortcutKey = (pressedKey: string): boolean => {
    if (
      (!isPausedOnWrong && !isPausedOnCloseAnswer && !isPausedOnCorrect) ||
      navigatingToDetail
    ) {
      return false;
    }

    if (Date.now() < suppressSubmitUntilRef.current) {
      return true;
    }

    if (!pressedKey) {
      return false;
    }

    const suppressSubmitTemporarily = () => {
      suppressSubmitUntilRef.current = Date.now() + 220;
    };

    if (isPausedOnCorrect) {
      if (
        canReplayPausedAudio &&
        doesReviewShortcutMatchKey(
          pressedKey,
          resolvedReviewCorrectKeyboardShortcuts.replayAudio,
        )
      ) {
        suppressSubmitTemporarily();
        void handleReplayAudio();
        return true;
      }

      if (
        doesReviewShortcutMatchKey(
          pressedKey,
          resolvedReviewCorrectKeyboardShortcuts.advanceOnCorrect,
        )
      ) {
        suppressSubmitTemporarily();
        handleProgressAsCorrect();
        return true;
      }

      if (
        doesReviewShortcutMatchKey(
          pressedKey,
          resolvedReviewIncorrectKeyboardShortcuts.openDetails,
        )
      ) {
        suppressSubmitTemporarily();
        handleViewDetails();
        return true;
      }

      return false;
    }

    if (
      canReplayPausedAudio &&
      doesReviewShortcutMatchKey(
        pressedKey,
        resolvedReviewIncorrectKeyboardShortcuts.replayAudio,
      )
    ) {
      suppressSubmitTemporarily();
      void handleReplayAudio();
      return true;
    }

    if (
      doesReviewShortcutMatchKey(
        pressedKey,
        resolvedReviewIncorrectKeyboardShortcuts.markIncorrect,
      )
    ) {
      suppressSubmitTemporarily();
      handleProgressAsWrong();
      return true;
    }

    if (
      doesReviewShortcutMatchKey(
        pressedKey,
        resolvedReviewIncorrectKeyboardShortcuts.markCorrect,
      )
    ) {
      suppressSubmitTemporarily();
      if (isPausedOnCloseAnswer) {
        handleProgressAsCorrect();
      } else {
        handleMarkCorrect();
      }
      return true;
    }

    if (
      !isPausedOnCloseAnswer &&
      doesReviewShortcutMatchKey(
        pressedKey,
        resolvedReviewIncorrectKeyboardShortcuts.askAgain,
      )
    ) {
      suppressSubmitTemporarily();
      handlePausedSkip();
      return true;
    }

    if (
      !isPausedOnCloseAnswer &&
      showAddSynonymButton &&
      questionType === "meaning" &&
      doesReviewShortcutMatchKey(
        pressedKey,
        resolvedReviewIncorrectKeyboardShortcuts.addSynonym,
      ) &&
      !isAddingSynonym
    ) {
      suppressSubmitTemporarily();
      void handleAddAsSynonym();
      return true;
    }

    if (
      doesReviewShortcutMatchKey(
        pressedKey,
        resolvedReviewIncorrectKeyboardShortcuts.openDetails,
      )
    ) {
      suppressSubmitTemporarily();
      handleViewDetails();
      return true;
    }

    return false;
  };

  const handleInputSubmitEditing = () => {
    if (Date.now() < suppressSubmitUntilRef.current) {
      return;
    }

    if (isPausedOnWrong || isPausedOnCloseAnswer || isPausedOnCorrect) {
      tryHandlePausedShortcutKey("Enter");
      return;
    }

    handleSubmitOrAdvance();
  };

  // Get the background color based on question type
  const getBackgroundColor = () => {
    if (!showBackgroundColor) return "#f6f6f6"; // Default background if not showing colors

    // Return color based on item type instead of question type
    return getItemColor(item.subject.object);
  };

  // Helper to check if the answer is correct or only needs a retry
  const isAnswerCorrect = () => {
    return (
      answerResult === AnswerCheckerResult.Precise ||
      answerResult === AnswerCheckerResult.Imprecise
    );
  };

  // Anki mode handlers
  const handleAnkiRevealAnswer = () => {
    setAnkiRevealQuestionKey(currentQuestionKey);
    setAnkiAnswerRevealed(true);

    // In Anki mode, autoplay vocabulary audio when the answer is revealed.
    if (questionType === "reading" || effectiveAnkiGroupQuestions) {
      void playVocabularyAudio();
    }

    // Animate container height expansion using Reanimated with timing for less bounce
    ankiContainerHeight.value = withTiming(1, {
      duration: 250,
      easing: Easing.out(Easing.ease),
    });
  };

  const runAnkiPostCollapseTransition = () => {
    const callback = pendingAnkiSubmitCallbackRef.current;
    pendingAnkiSubmitCallbackRef.current = null;
    if (!callback || !mountedRef.current) {
      return;
    }
    setAnkiAnswerRevealed(false);
    setAnkiRevealQuestionKey(null);
    callback();
  };

  // Helper function to submit answer after animation
  const submitAnkiAnswer = (callback: () => void) => {
    pendingAnkiSubmitCallbackRef.current = callback;
    ankiContainerHeight.value = withTiming(
      0,
      {
        duration: 200,
        easing: Easing.in(Easing.ease),
      },
      (finished) => {
        if (finished) {
          scheduleOnRN(runAnkiPostCollapseTransition);
        }
      },
    );
  };

  const handleAnkiAnswerButton = (isCorrect: boolean) => {
    // Reset temporary default-font override once an answer is submitted.
    if (isUsingDefaultJitaiFont) {
      setIsUsingDefaultJitaiFont(false);
    }

    const characters =
      subject.data.characters ||
      (subject.data.character_images ? subject.data.meanings[0].meaning : "");

    if (isCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const submit = () => {
        setPreviousAnswerItem({
          id: item.subject.id,
          subject: item.subject,
          characters,
          meaning: subject.data.meanings[0].meaning,
          backgroundColor: getItemColor(item.subject.object),
          isCorrect: true,
          questionType: questionType,
        });
        animateAnsweredItemBox();

        if (
          effectiveAnkiGroupQuestions &&
          (item.subject.data.readings?.length ?? 0) > 0
        ) {
          onAnswer(item, "meaning", true, false, true);
          onAnswer(item, "reading", true, false, true);
        } else {
          onAnswer(item, questionType, true, false, false);
        }
      };

      // Animate collapse then submit
      submitAnkiAnswer(submit);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);

      // Animate collapse then submit both as incorrect
      submitAnkiAnswer(() => {
        setPreviousAnswerItem({
          id: item.subject.id,
          subject: item.subject,
          characters,
          meaning: subject.data.meanings[0].meaning,
          backgroundColor: getItemColor(item.subject.object),
          isCorrect: false,
          questionType: questionType,
        });
        animateAnsweredItemBox();

        if (
          effectiveAnkiGroupQuestions &&
          (item.subject.data.readings?.length ?? 0) > 0
        ) {
          // Mark both meaning and reading as incorrect
          onAnswer(item, "meaning", false, true, true);
          onAnswer(item, "reading", false, true, true);
        } else {
          // Single question type
          onAnswer(item, questionType, false, false, false);
        }
      });
    }
  };

  const handleAnkiDetailsButton = () => {
    setNavigatingToDetail(true);
    Keyboard.dismiss();
    setTimeout(() => {
      router.push({
        pathname: "/subject/[id]",
        params: {
          id: item.subject.id.toString(),
          returnToReview: "true",
          initialTab: questionType,
        },
      });
    }, 300);
  };

  const handleAnkiSkipButton = () => {
    if (!onSkip) {
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    submitAnkiAnswer(() => {
      showSkipCue();
      onSkip(item, questionType);
    });
  };

  const beginButtonlessAnkiGesture = (event: GestureResponderEvent) => {
    buttonlessGestureStartRef.current = {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    };
    buttonlessGestureDeltaRef.current = { dx: 0, dy: 0 };
  };

  const trackButtonlessAnkiGesture = (event: GestureResponderEvent) => {
    const start = buttonlessGestureStartRef.current;
    buttonlessGestureDeltaRef.current = {
      dx: event.nativeEvent.pageX - start.x,
      dy: event.nativeEvent.pageY - start.y,
    };
  };

  const releaseButtonlessAnkiGesture = (event: GestureResponderEvent) => {
    if (
      !isCurrentQuestionAnkiRevealed ||
      !effectiveAnkiButtonlessMode ||
      navigatingToDetail ||
      pendingAnkiSubmitCallbackRef.current
    ) {
      return;
    }

    const { dx, dy } = buttonlessGestureDeltaRef.current;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    const isVerticalSwipe =
      absDy >= BUTTONLESS_SWIPE_TRIGGER_PX &&
      absDy > absDx * BUTTONLESS_VERTICAL_DOMINANCE_RATIO;

    if (isVerticalSwipe) {
      if (dy < 0) {
        handleAnkiDetailsButton();
      } else {
        handleAnkiSkipButton();
      }
      return;
    }

    const isTapGesture =
      absDx <= BUTTONLESS_TAP_MOVE_TOLERANCE_PX &&
      absDy <= BUTTONLESS_TAP_MOVE_TOLERANCE_PX;

    if (!isTapGesture) {
      return;
    }

    const hitAreaWidth =
      ankiButtonlessOverlayWidth > 0
        ? ankiButtonlessOverlayWidth
        : Math.max(windowWidth, 1);
    const isLeftHalfTap = event.nativeEvent.locationX < hitAreaWidth / 2;
    handleAnkiAnswerButton(!isLeftHalfTap);
  };

  const canToggleJitaiFont =
    jitaiEnabled && !overridePromptText && Boolean(subject.data.characters);
  const showReviewSearchButton = reviewSearchButtonEnabled && !isLessonFlow;
  const showWrapUpButton = isWrapUpAvailable && !isLessonFlow && !isWrapUpMode;
  const showWrapUpIndicator = isWrapUpMode;
  const hasFloatingWrapUpPill = showWrapUpButton || showWrapUpIndicator;
  const floatingToolButtonsTop = hasFloatingWrapUpPill
    ? FLOATING_REVIEW_TOOL_BUTTON_TOP_WITH_WRAP_UP
    : FLOATING_REVIEW_TOOL_BUTTON_TOP_WITHOUT_WRAP_UP;
  const floatingSearchButtonTop = floatingToolButtonsTop;
  const floatingSearchButtonRight = FLOATING_REVIEW_TOOL_BUTTON_RIGHT;
  const floatingJitaiButtonTop = floatingToolButtonsTop;
  const floatingJitaiButtonRight =
    FLOATING_REVIEW_TOOL_BUTTON_RIGHT +
    (showReviewSearchButton
      ? FLOATING_REVIEW_TOOL_BUTTON_SIZE + FLOATING_REVIEW_TOOL_BUTTON_GAP
      : 0);
  const directAnkiPartOfSpeechValues = useMemo(() => {
    const partsOfSpeech = (
      subject.data as {
        parts_of_speech?: (string | null | undefined)[] | null;
      }
    ).parts_of_speech;
    return extractAnkiPartOfSpeechValues(partsOfSpeech);
  }, [subject.data]);
  const [ankiPartOfSpeechValues, setAnkiPartOfSpeechValues] = useState<
    string[]
  >(directAnkiPartOfSpeechValues);

  useEffect(() => {
    setAnkiPartOfSpeechValues(directAnkiPartOfSpeechValues);
  }, [directAnkiPartOfSpeechValues, item.id]);

  useEffect(() => {
    if (!ankiShowWaniKaniGrammarTags) {
      return;
    }

    if (directAnkiPartOfSpeechValues.length > 0) {
      return;
    }

    let cancelled = false;

    ensureSubjectPartsOfSpeechLookup()
      .then((lookup) => {
        if (cancelled || !mountedRef.current) {
          return;
        }

        const fallbackPartOfSpeechValues = lookup.byId[subject.id] ?? [];
        if (fallbackPartOfSpeechValues.length > 0) {
          setAnkiPartOfSpeechValues(fallbackPartOfSpeechValues);
        }
      })
      .catch((error) => {
        console.error("Error loading part-of-speech fallback data:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [ankiShowWaniKaniGrammarTags, directAnkiPartOfSpeechValues, subject.id]);
  const acceptedMeaningAnswerOptions = useMemo(
    () =>
      uniqueNonEmptyAnswers(
        (item.subject.data.meanings ?? [])
          .filter((meaning: any) => meaning.accepted_answer)
          .map((meaning: any) => meaning.meaning),
      ),
    [item.subject.data.meanings],
  );
  const acceptedReadingAnswerOptions = useMemo(
    () =>
      uniqueNonEmptyAnswers(
        (item.subject.data.readings ?? [])
          .filter((reading: any) => reading.accepted_answer)
          .map((reading: any) => reading.reading),
      ),
    [item.subject.data.readings],
  );
  const userSynonymAnswerOptions = useMemo(
    () => uniqueNonEmptyAnswers(studyMaterials?.meaning_synonyms ?? []),
    [studyMaterials?.meaning_synonyms],
  );

  const primaryMeaningAnswer = useMemo(() => {
    const primaryMeaning = (item.subject.data.meanings ?? []).find(
      (meaning: any) => meaning.primary,
    )?.meaning;
    const fallbackMeaning = item.subject.data.meanings?.[0]?.meaning;
    return (
      uniqueNonEmptyAnswers([
        primaryMeaning,
        acceptedMeaningAnswerOptions[0],
        fallbackMeaning,
      ])[0] ?? ""
    );
  }, [acceptedMeaningAnswerOptions, item.subject.data.meanings]);

  const primaryReadingAnswer = useMemo(() => {
    const primaryReading = (item.subject.data.readings ?? []).find(
      (reading: any) => reading.primary,
    )?.reading;
    const fallbackReading = item.subject.data.readings?.[0]?.reading;
    return (
      uniqueNonEmptyAnswers([
        primaryReading,
        acceptedReadingAnswerOptions[0],
        fallbackReading,
      ])[0] ?? ""
    );
  }, [acceptedReadingAnswerOptions, item.subject.data.readings]);

  const otherAcceptedMeaningAnswers = useMemo(() => {
    const primaryMeaningKey = normalizeAnswerKey(primaryMeaningAnswer);
    return acceptedMeaningAnswerOptions.filter(
      (answer) => normalizeAnswerKey(answer) !== primaryMeaningKey,
    );
  }, [acceptedMeaningAnswerOptions, primaryMeaningAnswer]);

  const otherAcceptedReadingAnswers = useMemo(() => {
    const primaryReadingKey = normalizeAnswerKey(primaryReadingAnswer);
    return acceptedReadingAnswerOptions.filter(
      (answer) => normalizeAnswerKey(answer) !== primaryReadingKey,
    );
  }, [acceptedReadingAnswerOptions, primaryReadingAnswer]);

  const acceptedMeaningAnswerKeySet = useMemo(
    () => new Set(acceptedMeaningAnswerOptions.map(normalizeAnswerKey)),
    [acceptedMeaningAnswerOptions],
  );

  const userSynonymsForAnki = useMemo(
    () =>
      userSynonymAnswerOptions.filter(
        (answer) =>
          !acceptedMeaningAnswerKeySet.has(normalizeAnswerKey(answer)),
      ),
    [acceptedMeaningAnswerKeySet, userSynonymAnswerOptions],
  );

  const acceptedMeaningAnswers = useMemo(() => {
    if (!acceptUserSynonymsAsAnswers || userSynonymAnswerOptions.length === 0) {
      return acceptedMeaningAnswerOptions;
    }

    return uniqueNonEmptyAnswers([
      ...acceptedMeaningAnswerOptions,
      ...userSynonymAnswerOptions,
    ]);
  }, [
    acceptUserSynonymsAsAnswers,
    acceptedMeaningAnswerOptions,
    userSynonymAnswerOptions,
  ]);

  const buildCharactersAndReadingAnswerText = useCallback(
    (readingText: string) => {
      const subjectCharacters = item.subject.data.characters?.trim() ?? "";
      const compactReading = readingText.trim();

      if (!subjectCharacters) {
        return compactReading;
      }
      if (!compactReading) {
        return subjectCharacters;
      }

      const normalizedCharacters = normalizeJapaneseReading(subjectCharacters);
      const normalizedReading = normalizeJapaneseReading(compactReading);
      if (
        normalizedCharacters.length > 0 &&
        normalizedCharacters === normalizedReading
      ) {
        return subjectCharacters;
      }

      return `${subjectCharacters}\n${compactReading}`;
    },
    [item.subject.data.characters],
  );

  // Get the correct answer for Anki mode
  const getCorrectAnswer = () => {
    if (effectiveAnkiGroupQuestions) {
      if (item.subject.object === "radical" || !primaryReadingAnswer) {
        // Radicals don't have readings
        return primaryMeaningAnswer;
      }

      return {
        meaning: primaryMeaningAnswer,
        reading: primaryReadingAnswer,
        isGrouped: true,
      };
    }

    if (questionType === "meaning") {
      return primaryMeaningAnswer;
    }

    if (
      questionType === "reading" &&
      showCharactersAndReadingForReadingQuestion
    ) {
      return buildCharactersAndReadingAnswerText(primaryReadingAnswer);
    }

    if (requireSubjectCharactersForReading) {
      const subjectCharacters = item.subject.data.characters?.trim();
      if (subjectCharacters) {
        return subjectCharacters;
      }
    }

    return primaryReadingAnswer;
  };

  const ankiSupplementaryAnswerRows = useMemo<
    {
      key: string;
      label: string;
      values: string[];
      japanese?: boolean;
    }[]
  >(() => {
    const rows: {
      key: string;
      label: string;
      values: string[];
      japanese?: boolean;
    }[] = [];

    const shouldShowAcceptedAnswersAndSynonyms =
      ankiShowOtherAcceptedAnswersAndUserSynonyms;
    const shouldShowPartOfSpeech =
      ankiShowWaniKaniGrammarTags && ankiPartOfSpeechValues.length > 0;

    if (!shouldShowAcceptedAnswersAndSynonyms && !shouldShowPartOfSpeech) {
      return rows;
    }

    if (effectiveAnkiGroupQuestions) {
      if (
        shouldShowAcceptedAnswersAndSynonyms &&
        otherAcceptedMeaningAnswers.length > 0
      ) {
        rows.push({
          key: "other-accepted-meanings",
          label: "Other meaning answers",
          values: otherAcceptedMeaningAnswers,
        });
      }
      if (
        shouldShowAcceptedAnswersAndSynonyms &&
        otherAcceptedReadingAnswers.length > 0
      ) {
        rows.push({
          key: "other-accepted-readings",
          label: "Other reading answers",
          values: otherAcceptedReadingAnswers,
          japanese: true,
        });
      }
      if (shouldShowPartOfSpeech) {
        rows.push({
          key: "wanikani-part-of-speech",
          label: "Part of speech",
          values: ankiPartOfSpeechValues,
        });
      }
      if (
        shouldShowAcceptedAnswersAndSynonyms &&
        userSynonymsForAnki.length > 0
      ) {
        rows.push({
          key: "user-synonyms",
          label: "User synonyms",
          values: userSynonymsForAnki,
        });
      }
      return rows;
    }

    if (questionType === "meaning") {
      if (
        shouldShowAcceptedAnswersAndSynonyms &&
        otherAcceptedMeaningAnswers.length > 0
      ) {
        rows.push({
          key: "other-accepted-meanings",
          label: "Other accepted answers",
          values: otherAcceptedMeaningAnswers,
        });
      }
      if (shouldShowPartOfSpeech) {
        rows.push({
          key: "wanikani-part-of-speech",
          label: "Part of speech",
          values: ankiPartOfSpeechValues,
        });
      }
      if (
        shouldShowAcceptedAnswersAndSynonyms &&
        userSynonymsForAnki.length > 0
      ) {
        rows.push({
          key: "user-synonyms",
          label: "User synonyms",
          values: userSynonymsForAnki,
        });
      }
      return rows;
    }

    if (
      shouldShowAcceptedAnswersAndSynonyms &&
      otherAcceptedReadingAnswers.length > 0
    ) {
      rows.push({
        key: "other-accepted-readings",
        label: "Other accepted answers",
        values: otherAcceptedReadingAnswers,
        japanese: true,
      });
    }
    if (shouldShowPartOfSpeech) {
      rows.push({
        key: "wanikani-part-of-speech",
        label: "Part of speech",
        values: ankiPartOfSpeechValues,
      });
    }

    return rows;
  }, [
    ankiShowOtherAcceptedAnswersAndUserSynonyms,
    ankiShowWaniKaniGrammarTags,
    ankiPartOfSpeechValues,
    effectiveAnkiGroupQuestions,
    otherAcceptedMeaningAnswers,
    otherAcceptedReadingAnswers,
    questionType,
    userSynonymsForAnki,
  ]);

  const pausedCorrectAnswerText =
    overridePausedCorrectAnswerText ??
    (questionType === "meaning"
      ? acceptedMeaningAnswers.join(", ")
      : showCharactersAndReadingForReadingQuestion
        ? buildCharactersAndReadingAnswerText(
            acceptedReadingAnswerOptions.join(", "),
          )
        : acceptedReadingAnswerOptions.join(", "));
  const answerInputPlaceholder =
    questionType === "reading" ? "答え" : "Your Response";

  // Get the display label for the subject type
  const getSubjectTypeLabel = () => {
    const objectType = subject.object as string;
    if (objectType === "radical") return "Radical";
    if (objectType === "kanji") return "Kanji";
    if (objectType === "vocabulary" || objectType === "kana_vocabulary")
      return "Vocabulary";
    return "";
  };

  // Animation styles using useAnimatedStyle for better performance
  const shakeStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: shakeAnimation.value }],
    };
  });

  // Animation style for the answered item box
  const answeredItemBoxStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: boxPositionX.value },
        { translateY: boxPositionY.value },
        { scale: boxScale.value },
      ],
      opacity: boxOpacity.value,
    };
  });

  // Animation style for progress bar
  const progressBarStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      width: `${interpolate(animatedProgressWidth.value, [0, 100], [0, 100])}%`,
    };
  });

  // Animation style for SRS card
  const srsCardStyle = useAnimatedStyle(() => {
    return {
      opacity: srsCardOpacity.value,
      transform: [{ translateY: srsCardTranslateY.value }],
    };
  });

  const skipCueStyle = useAnimatedStyle(() => {
    return {
      opacity: skipCueOpacity.value,
      transform: [{ translateY: skipCueTranslateY.value }],
    };
  });

  // Animation style for Anki container
  const ankiContainerStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      minHeight: interpolate(ankiContainerHeight.value, [0, 1], [80, 130]),
    };
  });

  // Animation style for input glow (feedback)
  const inputGlowStyle = useAnimatedStyle(() => {
    "worklet";
    if (
      effectiveShowAnswerStopSubjectDetails &&
      !effectiveAnkiCardMode &&
      (isPausedOnCorrect || isPausedOnCloseAnswer || isPausedOnWrong)
    ) {
      return {
        shadowColor: "#000000",
        shadowOpacity: 0,
      };
    }
    if (isPausedOnCorrect) {
      return {
        shadowColor: "#4caf50",
        shadowOpacity: 0.9,
      };
    }
    if (isPausedOnCloseAnswer) {
      return {
        shadowColor: "#ff9800",
        shadowOpacity: 0.9,
      };
    }
    if (isPausedOnWrong) {
      return {
        shadowColor: "#f44336",
        shadowOpacity: 0.9,
      };
    }
    if (!answerFeedback) {
      return {
        shadowColor: "#000000",
        shadowOpacity: 0,
      };
    }
    return {
      shadowColor:
        answerFeedback === "correct"
          ? "#4caf50"
          : answerFeedback === "close"
            ? "#ff9800"
            : "#f44336",
      shadowOpacity: interpolate(feedbackOpacity.value, [0, 0.7], [0, 0.9]),
    };
  });

  const isPausedOnAnswer =
    isPausedOnWrong || isPausedOnCloseAnswer || isPausedOnCorrect;
  const shouldUsePausedSubjectDetailsMode =
    effectiveShowAnswerStopSubjectDetails &&
    isPausedOnAnswer &&
    !effectiveAnkiCardMode;
  const shouldShowPausedSubjectDetails =
    shouldUsePausedSubjectDetailsMode && pausedDetailsSheetVisible;
  const pausedSubjectDetailsPanelHeight = Math.round(
    Math.max(
      240,
      Math.min(windowHeight * (windowWidth > windowHeight ? 0.5 : 0.48), 430),
    ),
  );
  const pausedDetailsLayoutTransition = LinearTransition.duration(260).easing(
    Easing.out(Easing.cubic),
  );
  const pausedDetailsEntering = SlideInDown.duration(320).easing(
    Easing.out(Easing.cubic),
  );
  const pausedDetailsExiting = SlideOutDown.duration(240).easing(
    Easing.in(Easing.cubic),
  );

  useEffect(() => {
    if (!shouldUsePausedSubjectDetailsMode) {
      if (pausedDetailsRevealTimerRef.current) {
        clearTimeout(pausedDetailsRevealTimerRef.current);
        pausedDetailsRevealTimerRef.current = null;
      }
      if (pausedDetailsSheetVisible) {
        setPausedDetailsSheetVisible(false);
      }
      return;
    }

    if (pausedDetailsSheetVisible) {
      return;
    }

    if (pausedDetailsRevealTimerRef.current) {
      clearTimeout(pausedDetailsRevealTimerRef.current);
    }

    const revealDelayMs =
      Platform.OS === "ios" && iosKeyboardVisible
        ? 320
        : Platform.OS === "android" && androidKeyboardHeight > 0
          ? 240
          : 90;

    pausedDetailsRevealTimerRef.current = setTimeout(() => {
      pausedDetailsRevealTimerRef.current = null;
      if (mountedRef.current) {
        setPausedDetailsSheetVisible(true);
      }
    }, revealDelayMs);

    return () => {
      if (pausedDetailsRevealTimerRef.current) {
        clearTimeout(pausedDetailsRevealTimerRef.current);
        pausedDetailsRevealTimerRef.current = null;
      }
    };
  }, [
    androidKeyboardHeight,
    iosKeyboardVisible,
    pausedDetailsSheetVisible,
    shouldUsePausedSubjectDetailsMode,
  ]);

  const isCurrentAnswerCorrect = isAnswerCorrect();
  const hasCloseAccent = isPausedOnCloseAnswer;
  const hasCorrectAccent =
    isPausedOnCorrect ||
    (answered && isCurrentAnswerCorrect && !isPausedOnCloseAnswer);
  const hasIncorrectAccent =
    isPausedOnWrong ||
    (answered &&
      !isCurrentAnswerCorrect &&
      !isPausedOnCloseAnswer &&
      !isPausedOnCorrect);
  const pausedAnswerText = isPausedOnCorrect
    ? correctAnswerText
    : isPausedOnCloseAnswer
      ? closeAnswerText
      : wrongAnswerText;
  const submitIconName =
    answered || isPausedOnAnswer ? "chevron-forward" : "arrow-forward";
  const androidAppliedKeyboardResize =
    Platform.OS === "android" &&
    androidKeyboardHeight > 0 &&
    androidBaselineQuestionHeightRef.current > 0
      ? Math.max(
          0,
          androidBaselineQuestionHeightRef.current -
            androidQuestionLayoutHeight,
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
  const isLandscape = windowWidth > windowHeight;
  const isLargeIPadLandscape =
    Platform.OS === "ios" &&
    Platform.isPad &&
    isLandscape &&
    Math.min(windowWidth, windowHeight) >= 800;
  const shouldOffsetSrsCardToSide = isLargeIPadLandscape && iosKeyboardVisible;
  const centeredSrsCardLeft = Math.max(
    0,
    Math.round((windowWidth - SRS_CARD_WIDTH) / 2 - 16),
  );
  const srsCardPositionStyle = shouldOffsetSrsCardToSide
    ? { right: SRS_CARD_SIDE_OFFSET }
    : { left: centeredSrsCardLeft };
  const shouldShowSrsProgressionCard =
    !!srsProgression && srsProgressionCardDisplayMode !== "hidden";
  const shouldUseCompactSrsProgressionCard =
    shouldShowSrsProgressionCard && srsProgressionCardDisplayMode === "compact";
  const shouldFullyHideAnkiAnswer =
    ankiHideAnswerCompletely && !isCurrentQuestionAnkiRevealed;
  const showAnkiSkipChip =
    allowSkippingReviews && onSkip && !isCurrentQuestionAnkiRevealed;
  const showAnkiReplayButton =
    ankiShowReplayAudioButton &&
    canReplayAnkiAudio &&
    isCurrentQuestionAnkiRevealed &&
    !effectiveAnkiButtonlessMode;
  const ankiPreCardOverlayJustification =
    shouldShowReviewItemMetadata && showAnkiSkipChip
      ? "space-between"
      : showAnkiSkipChip
        ? "flex-end"
        : "flex-start";

  const renderReviewMetadata = (inRow = false) => {
    if (!shouldShowReviewItemMetadata || !reviewSrsStageInfo) {
      return null;
    }

    return (
      <View
        style={[
          styles.reviewMetadataStack,
          inRow && styles.reviewMetadataStackInRow,
        ]}
        pointerEvents="none"
      >
        <View style={styles.reviewMetadataPill}>
          <Ionicons name="school-outline" size={13} color="white" />
          <Text
            style={styles.reviewMetadataText}
          >{`Level ${reviewSubjectLevel}`}</Text>
        </View>
        <View style={styles.reviewMetadataPill}>
          <View style={styles.reviewMetadataSrsIcon}>
            <SrsLevelIcon
              level={reviewSrsStageInfo.iconLevel}
              size={14}
              color="white"
            />
          </View>
          <Text style={styles.reviewMetadataText}>
            {reviewSrsStageInfo.label}
          </Text>
        </View>
      </View>
    );
  };

  // Animation style for Anki button section
  const ankiButtonSectionStyle = useAnimatedStyle(() => {
    "worklet";
    return {
      opacity: interpolate(ankiContainerHeight.value, [0, 0.5, 1], [0, 0, 1]),
      transform: [
        {
          translateY: interpolate(ankiContainerHeight.value, [0, 1], [20, 0]),
        },
      ],
    };
  });

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: getBackgroundColor() }]}
      edges={
        shouldShowPausedSubjectDetails
          ? ["left", "right"]
          : ["left", "right", "bottom"]
      }
    >
      {/* Stats Header */}
      <View
        style={[
          styles.statsHeader,
          {
            paddingTop: 60,
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={onExit}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        {!isLessonFlow && (
          <View
            style={styles.statItem}
            accessibilityLabel={`${accuracyPercent}% answer accuracy`}
          >
            <Ionicons name="pie-chart" size={24} color="white" />
            <Text style={styles.statText}>{accuracyPercent}%</Text>
          </View>
        )}

        <View
          style={[styles.statItem, { marginHorizontal: 20 }]}
          accessibilityLabel={`${completedCount} items completed`}
        >
          <Ionicons name="checkmark-done" size={24} color="white" />
          <Text style={styles.statText}>{completedCount}</Text>
        </View>

        <View
          style={styles.statItem}
          accessibilityLabel={`${totalItems} total items`}
        >
          <Ionicons name="folder-open" size={24} color="white" />
          <Text style={styles.statText}>{totalItems - completedCount}</Text>
        </View>
      </View>

      {/* Animated Progress bar */}
      <View style={styles.progressBarContainer}>
        <Animated.View style={[styles.progressBar, progressBarStyle]} />
      </View>

      {reviewPermissionWarning && (
        <View
          style={[
            styles.permissionWarningBanner,
            {
              backgroundColor: theme.isDark
                ? "rgba(255, 193, 7, 0.2)"
                : "rgba(255, 193, 7, 0.9)",
              borderColor: theme.isDark
                ? "rgba(255, 224, 130, 0.55)"
                : "rgba(95, 67, 0, 0.35)",
            },
          ]}
        >
          <Ionicons
            name="warning-outline"
            size={18}
            color={theme.isDark ? "#FFE082" : "#5F4300"}
          />
          <Text
            style={[
              styles.permissionWarningText,
              { color: theme.isDark ? "#FFF8E1" : "#5F4300" },
            ]}
          >
            {reviewPermissionWarning}
          </Text>
          {onDismissReviewPermissionWarning && (
            <TouchableOpacity
              onPress={onDismissReviewPermissionWarning}
              style={styles.permissionWarningDismiss}
              accessibilityLabel="Dismiss permission warning"
            >
              <Ionicons
                name="close"
                size={16}
                color={theme.isDark ? "#FFE082" : "#5F4300"}
              />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Floating Wrap Up Button - positioned below header */}
      {showWrapUpButton && (
        <TouchableOpacity
          style={styles.floatingWrapUpButton}
          onPress={onWrapUp}
          accessibilityLabel={`Wrap up after ${wrapUpTargetSubjects} more subjects. ${remainingSubjectsCount} subjects remaining.`}
        >
          <View style={styles.floatingWrapUpButtonInner} />
          <Ionicons name="flag" size={18} color="white" />
          <Text style={styles.floatingWrapUpButtonText}>Wrap Up</Text>
        </TouchableOpacity>
      )}

      {showReviewSearchButton && (
        <TouchableOpacity
          style={[
            styles.floatingReviewToolButton,
            { top: floatingSearchButtonTop, right: floatingSearchButtonRight },
          ]}
          onPress={handleOpenReviewSearch}
          accessibilityLabel="Open search"
        >
          <View style={styles.floatingReviewToolButtonInner} />
          <Ionicons name="search" size={18} color="white" />
        </TouchableOpacity>
      )}

      {/* Floating Wrap Up Mode Indicator */}
      {showWrapUpIndicator && (
        <View style={styles.floatingWrapUpIndicator}>
          <View style={styles.floatingWrapUpIndicatorInner} />
          <Ionicons name="flag" size={18} color="#ffd700" />
          <Text style={styles.floatingWrapUpIndicatorText}>
            Wrapping Up ({remainingSubjectsCount} left)
          </Text>
        </View>
      )}

      {skipCueText && (
        <Animated.View
          pointerEvents="none"
          style={[styles.skipCueContainer, skipCueStyle]}
        >
          <View
            style={[
              styles.skipCuePill,
              {
                backgroundColor: theme.isDark
                  ? "rgba(15, 15, 15, 0.94)"
                  : "rgba(255, 255, 255, 0.96)",
                borderColor: theme.isDark
                  ? "rgba(255, 255, 255, 0.18)"
                  : "rgba(0, 0, 0, 0.1)",
              },
            ]}
          >
            <Ionicons
              name="play-skip-forward"
              size={16}
              color={theme.isDark ? "#9bd7ff" : "#1565c0"}
            />
            <Text
              style={[
                styles.skipCueText,
                { color: theme.isDark ? "#ffffff" : "#121212" },
              ]}
            >
              {skipCueText}
            </Text>
          </View>
        </Animated.View>
      )}

      {shouldUseCompactSrsProgressionCard && srsProgression && (
        <Animated.View
          style={[styles.srsTopPopupContainer, srsCardStyle]}
          pointerEvents="box-none"
        >
          <TouchableOpacity
            style={[
              styles.srsProgressionCardInline,
              styles.srsProgressionCardCompact,
              {
                backgroundColor: srsProgression.isCorrect
                  ? "#4caf50"
                  : "#f44336",
              },
            ]}
            onPress={onSRSCardDismiss}
            activeOpacity={0.8}
          >
            <View style={[styles.srsCardContent, styles.srsCardContentCompact]}>
              <View
                style={[
                  styles.srsIconContainer,
                  styles.srsIconContainerCompact,
                ]}
              >
                <SrsLevelIcon
                  level={srsProgression.newLevel}
                  size={18}
                  color="white"
                />
              </View>
              <View style={styles.srsTextContainer}>
                <View style={styles.srsArrowAndLevel}>
                  <Ionicons
                    name={srsProgression.isCorrect ? "arrow-up" : "arrow-down"}
                    size={11}
                    color="white"
                  />
                  <Text
                    style={[styles.srsCardLevel, styles.srsCardLevelCompact]}
                  >
                    {srsProgression.newLevel}
                  </Text>
                </View>
                <Text
                  style={[styles.srsNextReview, styles.srsNextReviewCompact]}
                  numberOfLines={1}
                >
                  {srsProgression.newStage >= 9
                    ? "🔥 Burned!"
                    : srsProgression.nextReviewInterval}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        </Animated.View>
      )}

      {canToggleJitaiFont && (
        <TouchableOpacity
          style={[
            styles.floatingReviewToolButton,
            { top: floatingJitaiButtonTop, right: floatingJitaiButtonRight },
          ]}
          onPress={() => setIsUsingDefaultJitaiFont((current) => !current)}
          activeOpacity={0.8}
          accessibilityLabel={
            isUsingDefaultJitaiFont
              ? "Switch to random font for this question"
              : "Switch to default font for this question"
          }
        >
          <View style={styles.floatingReviewToolButtonInner} />
          <Ionicons
            name={isUsingDefaultJitaiFont ? "shuffle" : "text"}
            size={18}
            color="white"
          />
        </TouchableOpacity>
      )}

      {/* Previous Answered Item Box */}
      {previousAnswerItem && (
        <Animated.View style={[styles.answeredItemBox, answeredItemBoxStyle]}>
          <TouchableOpacity
            style={[
              styles.answeredItemBoxTouchable,
              { backgroundColor: previousAnswerItem.backgroundColor },
              navigatingToDetail && styles.disabledTouchable,
            ]}
            onPress={navigateToPreviousItemDetail}
            activeOpacity={0.7}
            disabled={navigatingToDetail}
          >
            <AnsweredItemCharacterDisplay
              subject={previousAnswerItem.subject}
              fallbackText={previousAnswerItem.characters}
            />
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

      <KeyboardAvoidingView
        style={styles.questionContainer}
        behavior={
          Platform.OS === "ios" && iosKeyboardAvoidingEnabled
            ? "padding"
            : Platform.OS === "android"
              ? "height"
              : undefined
        }
        enabled={Platform.OS !== "ios" || iosKeyboardAvoidingEnabled}
        keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
        onLayout={handleQuestionContainerLayout}
      >
        <Animated.View
          layout={
            effectiveShowAnswerStopSubjectDetails
              ? pausedDetailsLayoutTransition
              : undefined
          }
          style={[
            styles.reviewInteractionPane,
            shouldShowPausedSubjectDetails &&
              styles.reviewInteractionPaneWithDetails,
          ]}
        >
          {/* Character display (or overridden prompt) */}
          <View
            style={[
              styles.characterWrapper,
              shouldShowPausedSubjectDetails &&
                styles.characterWrapperWithDetails,
            ]}
          >
            <View style={styles.characterContainer}>
              {overridePromptText ? (
                <>
                  <Text
                    style={[
                      styles.placeholderText,
                      overridePromptUsesJapaneseFont && fontStyles.japaneseText,
                    ]}
                    numberOfLines={2}
                    adjustsFontSizeToFit
                  >
                    {overridePromptText}
                  </Text>
                  {!!overridePromptSubtext && (
                    <Text
                      style={styles.placeholderSubtext}
                      numberOfLines={3}
                      adjustsFontSizeToFit
                    >
                      {overridePromptSubtext}
                    </Text>
                  )}
                </>
              ) : (
                <RadicalCharacterDisplay
                  subject={subject}
                  size={reviewPromptCharacterSize}
                  forceDefaultFont={isUsingDefaultJitaiFont}
                />
              )}
            </View>

            {/* Context Hint Button - only show when context sentences are available */}
            {contextSentencesHint && contextSentencesHint.length > 0 && (
              <View style={styles.contextHintContainer}>
                <TouchableOpacity
                  style={styles.contextHintButton}
                  onPress={() => setShowContextHint(!showContextHint)}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={
                      showContextHint ? "chevron-up" : "help-circle-outline"
                    }
                    size={18}
                    color="rgba(255, 255, 255, 0.8)"
                  />
                  <Text style={styles.contextHintButtonText}>
                    {showContextHint ? "Hide Hint" : "Show Context Hint"}
                  </Text>
                </TouchableOpacity>

                {showContextHint && (
                  <View style={styles.contextHintContent}>
                    {contextSentencesHint
                      .slice(0, contextHintMaxItems)
                      .map((sentence, index) => (
                        <View
                          key={`${index}-${sentence.ja ?? ""}-${sentence.en ?? ""}`}
                          style={styles.contextHintSentenceGroup}
                        >
                          {!!sentence.ja && (
                            <Text
                              style={[
                                styles.contextHintSentence,
                                styles.contextHintSentenceJapanese,
                                fontStyles.japaneseText,
                              ]}
                              numberOfLines={3}
                            >
                              • {sentence.ja}
                            </Text>
                          )}
                          {!!sentence.en && (
                            <Text
                              style={styles.contextHintSentence}
                              numberOfLines={3}
                            >
                              • {sentence.en}
                            </Text>
                          )}
                        </View>
                      ))}
                  </View>
                )}
              </View>
            )}
          </View>

          {effectiveAnkiCardMode ? (
            /* Anki Card Mode */
            <View style={styles.ankiCardContainer}>
              <TouchableOpacity
                style={styles.ankiAnswerContainer}
                onPress={
                  !isCurrentQuestionAnkiRevealed
                    ? handleAnkiRevealAnswer
                    : undefined
                }
                activeOpacity={1}
                disabled={isCurrentQuestionAnkiRevealed}
              >
                {((shouldShowSrsProgressionCard &&
                  !shouldUseCompactSrsProgressionCard) ||
                  showAnkiSkipChip ||
                  shouldShowReviewItemMetadata) && (
                  <View
                    style={[
                      styles.ankiPreCardOverlayRow,
                      { justifyContent: ankiPreCardOverlayJustification },
                    ]}
                  >
                    {shouldShowReviewItemMetadata && renderReviewMetadata(true)}
                    {showAnkiSkipChip && (
                      <TouchableOpacity
                        style={[
                          styles.ankiPreRevealSkipChip,
                          theme.isDark
                            ? styles.ankiPreRevealSkipChipDark
                            : styles.ankiPreRevealSkipChipLight,
                        ]}
                        onPress={handleAnkiSkipButton}
                        activeOpacity={0.85}
                        accessibilityLabel="Skip this card"
                      >
                        <Ionicons
                          name="play-skip-forward"
                          size={16}
                          color={theme.isDark ? "#D1D5DB" : "#334155"}
                        />
                        <Text
                          style={[
                            styles.ankiPreRevealSkipChipText,
                            { color: theme.isDark ? "#D1D5DB" : "#334155" },
                          ]}
                        >
                          Skip
                        </Text>
                      </TouchableOpacity>
                    )}
                    {shouldShowSrsProgressionCard &&
                      !shouldUseCompactSrsProgressionCard &&
                      srsProgression && (
                        <Animated.View
                          style={[
                            styles.ankiSrsProgressionOverlay,
                            shouldOffsetSrsCardToSide
                              ? styles.ankiSrsProgressionOverlaySide
                              : styles.ankiSrsProgressionOverlayCentered,
                            srsCardStyle,
                          ]}
                          pointerEvents="box-none"
                        >
                          <TouchableOpacity
                            style={[
                              styles.srsProgressionCardInline,
                              {
                                backgroundColor: srsProgression.isCorrect
                                  ? "#4caf50"
                                  : "#f44336",
                              },
                            ]}
                            onPress={onSRSCardDismiss}
                            activeOpacity={0.8}
                          >
                            <View style={styles.srsCardContent}>
                              <View style={styles.srsIconContainer}>
                                <SrsLevelIcon
                                  level={srsProgression.newLevel}
                                  size={22}
                                  color="white"
                                />
                              </View>
                              <View style={styles.srsTextContainer}>
                                <View style={styles.srsArrowAndLevel}>
                                  <Ionicons
                                    name={
                                      srsProgression.isCorrect
                                        ? "arrow-up"
                                        : "arrow-down"
                                    }
                                    size={12}
                                    color="white"
                                  />
                                  <Text style={styles.srsCardLevel}>
                                    {srsProgression.newLevel}
                                  </Text>
                                </View>
                                <Text style={styles.srsNextReview}>
                                  {srsProgression.newStage >= 9
                                    ? "🔥 Burned!"
                                    : `Next: ${srsProgression.nextReviewInterval}`}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        </Animated.View>
                      )}
                  </View>
                )}

                <View
                  style={[
                    styles.banner,
                    effectiveAnkiGroupQuestions
                      ? styles.bannerGrouped
                      : questionType === "meaning"
                        ? styles.bannerMeaning
                        : styles.bannerReading,
                    !effectiveAnkiGroupQuestions &&
                      questionType === "meaning" &&
                      theme.isDark && {
                        backgroundColor: DARK_MODE_MEANING_BANNER_BG,
                      },
                    !effectiveAnkiGroupQuestions &&
                      questionType === "reading" &&
                      theme.isDark && {
                        backgroundColor: DARK_MODE_READING_BANNER_BG,
                      },
                  ]}
                >
                  <Text
                    style={[
                      styles.bannerText,
                      effectiveAnkiGroupQuestions
                        ? styles.bannerTextGrouped
                        : questionType === "meaning"
                          ? styles.bannerTextMeaning
                          : styles.bannerTextReading,
                      !effectiveAnkiGroupQuestions &&
                        questionType === "meaning" &&
                        theme.isDark && {
                          color: DARK_MODE_MEANING_BANNER_TEXT,
                        },
                    ]}
                  >
                    {getSubjectTypeLabel()}{" "}
                    <Text style={styles.bannerTextBold}>
                      {effectiveAnkiGroupQuestions
                        ? "Meaning & Reading"
                        : questionType === "meaning"
                          ? "Meaning"
                          : "Reading"}
                    </Text>
                  </Text>
                </View>

                <Animated.View
                  style={[
                    styles.ankiContentContainer,
                    ankiContainerStyle,
                    theme.isDark && { backgroundColor: "#000000" },
                  ]}
                >
                  {/* Answer display area */}
                  <View style={styles.ankiAnswerSection}>
                    <View style={styles.ankiBlurContainer}>
                      {!shouldFullyHideAnkiAnswer && (
                        <>
                          {(() => {
                            const answer = getCorrectAnswer();
                            if (
                              typeof answer === "object" &&
                              answer.isGrouped
                            ) {
                              return (
                                <>
                                  <Text
                                    style={[
                                      styles.ankiAnswerText,
                                      theme.isDark && { color: "#ffffff" },
                                    ]}
                                  >
                                    {answer.meaning}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.ankiAnswerText,
                                      fontStyles.japaneseText,
                                      { marginTop: 8 },
                                      theme.isDark && { color: "#ffffff" },
                                    ]}
                                  >
                                    {answer.reading}
                                  </Text>
                                </>
                              );
                            }
                            return (
                              <Text
                                style={[
                                  styles.ankiAnswerText,
                                  questionType === "reading"
                                    ? fontStyles.japaneseText
                                    : null,
                                  theme.isDark && { color: "#ffffff" },
                                ]}
                              >
                                {typeof answer === "string" ? answer : ""}
                              </Text>
                            );
                          })()}
                          {isCurrentQuestionAnkiRevealed &&
                            ankiSupplementaryAnswerRows.length > 0 && (
                              <View
                                style={styles.ankiSupplementaryAnswersContainer}
                              >
                                {ankiSupplementaryAnswerRows.map((row) => (
                                  <View
                                    key={row.key}
                                    style={styles.ankiSupplementaryAnswerRow}
                                  >
                                    <Text
                                      style={[
                                        styles.ankiSupplementaryAnswerLabel,
                                        theme.isDark && {
                                          color: "rgba(255, 255, 255, 0.62)",
                                        },
                                      ]}
                                    >
                                      {row.label}
                                    </Text>
                                    <Text
                                      style={[
                                        styles.ankiSupplementaryAnswerValue,
                                        row.japanese && fontStyles.japaneseText,
                                        theme.isDark && { color: "#F4F4F5" },
                                      ]}
                                    >
                                      {row.values.join(", ")}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            )}
                          {!isCurrentQuestionAnkiRevealed &&
                            (Platform.OS === "ios" ? (
                              <BlurView
                                intensity={80}
                                style={styles.ankiBlurOverlay}
                                tint={theme.isDark ? "dark" : "light"}
                              />
                            ) : (
                              // Android: BlurView doesn't work well, use opaque overlay instead
                              <View
                                style={[
                                  styles.ankiBlurOverlay,
                                  {
                                    backgroundColor: theme.isDark
                                      ? "#000000"
                                      : "#ffffff",
                                  },
                                ]}
                              />
                            ))}
                        </>
                      )}
                    </View>
                    {!isCurrentQuestionAnkiRevealed && (
                      <View style={styles.ankiTapHint}>
                        <Ionicons
                          name="finger-print-outline"
                          size={18}
                          color={
                            theme.isDark
                              ? "rgba(255,255,255,0.6)"
                              : "rgba(0,0,0,0.6)"
                          }
                        />
                        <Text
                          style={[
                            styles.ankiTapToReveal,
                            theme.isDark && { color: "rgba(255,255,255,0.6)" },
                          ]}
                        >
                          Tap anywhere to see the answer
                        </Text>
                      </View>
                    )}
                  </View>

                  {showAnkiReplayButton && (
                    <View style={styles.ankiReplaySection}>
                      <TouchableOpacity
                        style={[
                          styles.ankiReplayButton,
                          theme.isDark && styles.ankiReplayButtonDark,
                          isReplayingAudio && styles.ankiReplayButtonDisabled,
                        ]}
                        onPress={() => {
                          void handleReplayAudio();
                        }}
                        activeOpacity={0.75}
                        disabled={isReplayingAudio}
                        accessibilityLabel="Replay vocabulary audio"
                      >
                        <Ionicons
                          name={isReplayingAudio ? "sync" : "volume-high"}
                          size={16}
                          color={theme.isDark ? "#DDD6FE" : "#6D28D9"}
                        />
                        <Text
                          style={[
                            styles.ankiReplayButtonText,
                            { color: theme.isDark ? "#DDD6FE" : "#6D28D9" },
                          ]}
                        >
                          {isReplayingAudio ? "Replaying..." : "Replay"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Buttons (animated in when revealed) */}
                  {isCurrentQuestionAnkiRevealed &&
                    !effectiveAnkiButtonlessMode && (
                      <Animated.View
                        style={[
                          styles.ankiButtonSection,
                          ankiButtonSectionStyle,
                        ]}
                      >
                        <TouchableOpacity
                          style={[
                            styles.ankiButton,
                            styles.ankiButtonWrong,
                            theme.isDark && {
                              backgroundColor: "#3D1F1F",
                              borderColor: "#5C2B2B",
                            },
                          ]}
                          onPress={() => handleAnkiAnswerButton(false)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.ankiButtonIconContainer}>
                            <Ionicons name="close" size={24} color="#D92C2C" />
                          </View>
                          <Text
                            style={[
                              styles.ankiButtonText,
                              { color: "#D92C2C" },
                            ]}
                          >
                            Wrong
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.ankiButton,
                            styles.ankiButtonDetails,
                            theme.isDark && {
                              backgroundColor: "#1A2F3D",
                              borderColor: "#254559",
                            },
                          ]}
                          onPress={handleAnkiDetailsButton}
                          activeOpacity={0.7}
                        >
                          <View style={styles.ankiButtonIconContainer}>
                            <Ionicons
                              name="information-circle"
                              size={24}
                              color="#0096FF"
                            />
                          </View>
                          <Text
                            style={[
                              styles.ankiButtonText,
                              { color: "#0096FF" },
                            ]}
                          >
                            Details
                          </Text>
                        </TouchableOpacity>

                        {allowSkippingReviews && onSkip && (
                          <TouchableOpacity
                            style={[
                              styles.ankiButton,
                              styles.ankiButtonSkip,
                              theme.isDark && {
                                backgroundColor: "#2A2E35",
                                borderColor: "#3A4250",
                              },
                            ]}
                            onPress={handleAnkiSkipButton}
                            activeOpacity={0.7}
                          >
                            <View style={styles.ankiButtonIconContainer}>
                              <Ionicons
                                name="play-skip-forward"
                                size={24}
                                color={theme.isDark ? "#CBD5E1" : "#4A5568"}
                              />
                            </View>
                            <Text
                              style={[
                                styles.ankiButtonText,
                                { color: theme.isDark ? "#CBD5E1" : "#4A5568" },
                              ]}
                            >
                              Skip
                            </Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          style={[
                            styles.ankiButton,
                            styles.ankiButtonCorrect,
                            theme.isDark && {
                              backgroundColor: "#1F3D1F",
                              borderColor: "#2B5C2B",
                            },
                          ]}
                          onPress={() => handleAnkiAnswerButton(true)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.ankiButtonIconContainer}>
                            <Ionicons
                              name="checkmark"
                              size={24}
                              color="#00B300"
                            />
                          </View>
                          <Text
                            style={[
                              styles.ankiButtonText,
                              { color: "#00B300" },
                            ]}
                          >
                            Correct
                          </Text>
                        </TouchableOpacity>
                      </Animated.View>
                    )}
                </Animated.View>
              </TouchableOpacity>
            </View>
          ) : (
            /* Traditional WaniKani Mode */
            <Animated.View
              layout={
                effectiveShowAnswerStopSubjectDetails
                  ? pausedDetailsLayoutTransition
                  : undefined
              }
              style={[
                styles.answerContainer,
                Platform.OS === "android" &&
                  androidKeyboardLift > 0 && {
                    paddingBottom: androidKeyboardLift,
                  },
                shouldShowPausedSubjectDetails && [
                  styles.pausedUnifiedDetailsSheet,
                  {
                    backgroundColor: theme.backgroundColor,
                    borderColor: theme.border,
                  },
                ],
              ]}
            >
              {/* SRS Progression Card - above input field */}
              {shouldShowSrsProgressionCard &&
                !shouldUseCompactSrsProgressionCard &&
                srsProgression && (
                  <Animated.View
                    style={[
                      styles.srsProgressionCard,
                      {
                        backgroundColor: srsProgression.isCorrect
                          ? "#4caf50"
                          : "#f44336",
                      },
                      srsCardPositionStyle,
                      srsCardStyle,
                    ]}
                    pointerEvents="box-none"
                  >
                    <TouchableOpacity
                      style={styles.srsCardContent}
                      onPress={onSRSCardDismiss}
                      activeOpacity={0.8}
                    >
                      <View style={styles.srsIconContainer}>
                        <SrsLevelIcon
                          level={srsProgression.newLevel}
                          size={22}
                          color="white"
                        />
                      </View>
                      <View style={styles.srsTextContainer}>
                        <View style={styles.srsArrowAndLevel}>
                          <Ionicons
                            name={
                              srsProgression.isCorrect
                                ? "arrow-up"
                                : "arrow-down"
                            }
                            size={12}
                            color="white"
                          />
                          <Text style={styles.srsCardLevel}>
                            {srsProgression.newLevel}
                          </Text>
                        </View>
                        <Text style={styles.srsNextReview}>
                          {srsProgression.newStage >= 9
                            ? "🔥 Burned!"
                            : `Next: ${srsProgression.nextReviewInterval}`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                )}

              {!shouldUsePausedSubjectDetailsMode && renderReviewMetadata()}

              {/* Paused on wrong answer - show correct answer and actions */}
              {isPausedOnWrong && !shouldUsePausedSubjectDetailsMode && (
                <View style={styles.pausedCard}>
                  <View style={styles.pausedCardHeader}>
                    <View style={styles.pausedCardIconContainer}>
                      <Ionicons name="close-circle" size={24} color="#f44336" />
                    </View>
                    <Text style={styles.pausedCardTitle}>Incorrect</Text>
                  </View>

                  <View style={styles.correctAnswerSection}>
                    <Text style={styles.correctAnswerLabel}>
                      Correct answer:
                    </Text>
                    <Text
                      style={[
                        styles.correctAnswerText,
                        questionType === "reading" && fontStyles.japaneseText,
                      ]}
                    >
                      {pausedCorrectAnswerText}
                    </Text>
                  </View>

                  <View style={styles.pausedPrimaryActions}>
                    <TouchableOpacity
                      style={[
                        styles.pausedActionButton,
                        styles.pausedButtonIncorrect,
                      ]}
                      onPress={handleProgressAsWrong}
                    >
                      <Ionicons name="close" size={18} color="#f44336" />
                      <Text
                        style={[
                          styles.pausedActionButtonText,
                          { color: "#f44336" },
                        ]}
                      >
                        Mark Incorrect
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.pausedActionButton,
                        styles.pausedButtonSkip,
                      ]}
                      onPress={handlePausedSkip}
                    >
                      <Ionicons
                        name="play-skip-forward"
                        size={18}
                        color="#2196F3"
                      />
                      <Text
                        style={[
                          styles.pausedActionButtonText,
                          { color: "#2196F3" },
                        ]}
                      >
                        Skip
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.pausedActionButton,
                        styles.pausedButtonCorrect,
                      ]}
                      onPress={handleMarkCorrect}
                    >
                      <Ionicons name="checkmark" size={18} color="#4caf50" />
                      <Text
                        style={[
                          styles.pausedActionButtonText,
                          { color: "#4caf50" },
                        ]}
                      >
                        Mark Correct
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.pausedSecondaryActions}>
                    {canReplayPausedAudio && (
                      <TouchableOpacity
                        style={[
                          styles.pausedSecondaryAction,
                          styles.pausedButtonReplay,
                          isReplayingAudio && styles.pausedActionDisabled,
                        ]}
                        onPress={() => {
                          void handleReplayAudio();
                        }}
                        disabled={isReplayingAudio}
                      >
                        <Ionicons
                          name={isReplayingAudio ? "sync" : "volume-high"}
                          size={16}
                          color="#9575cd"
                        />
                        <Text
                          style={[
                            styles.pausedSecondaryActionText,
                            { color: "#9575cd" },
                          ]}
                        >
                          {isReplayingAudio ? "Replaying..." : `Replay`}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.pausedSecondaryAction,
                        styles.pausedButtonDetails,
                      ]}
                      onPress={handleViewDetails}
                    >
                      <Ionicons
                        name="information-circle"
                        size={16}
                        color="#9E9E9E"
                      />
                      <Text
                        style={[
                          styles.pausedSecondaryActionText,
                          { color: "#9E9E9E" },
                        ]}
                      >
                        Details
                      </Text>
                    </TouchableOpacity>

                    {showAddSynonymButton && questionType === "meaning" && (
                      <TouchableOpacity
                        style={[
                          styles.pausedSecondaryAction,
                          styles.pausedButtonSynonym,
                        ]}
                        onPress={handleAddAsSynonym}
                        disabled={isAddingSynonym}
                      >
                        <Ionicons name="add-circle" size={16} color="#ff9800" />
                        <Text
                          style={[
                            styles.pausedSecondaryActionText,
                            { color: "#ff9800" },
                          ]}
                        >
                          {isAddingSynonym ? "Adding..." : "Synonym"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {isPausedOnCloseAnswer && !shouldUsePausedSubjectDetailsMode && (
                <View style={styles.pausedCard}>
                  <View style={styles.pausedCardHeader}>
                    <View
                      style={[
                        styles.pausedCardIconContainer,
                        styles.pausedCardIconContainerClose,
                      ]}
                    >
                      <Ionicons name="warning" size={22} color="#ff9800" />
                    </View>
                    <Text
                      style={[
                        styles.pausedCardTitle,
                        styles.pausedCardTitleClose,
                      ]}
                    >
                      Close Match
                    </Text>
                  </View>

                  <View style={styles.correctAnswerSection}>
                    <Text style={styles.correctAnswerLabel}>
                      Accepted answers:
                    </Text>
                    <Text
                      style={[
                        styles.correctAnswerText,
                        styles.correctAnswerTextClose,
                        questionType === "reading" && fontStyles.japaneseText,
                      ]}
                    >
                      {pausedCorrectAnswerText}
                    </Text>
                  </View>

                  <View style={styles.pausedPrimaryActions}>
                    <TouchableOpacity
                      style={[
                        styles.pausedActionButton,
                        styles.pausedButtonIncorrect,
                      ]}
                      onPress={handleProgressAsWrong}
                    >
                      <Ionicons name="close" size={18} color="#f44336" />
                      <Text
                        style={[
                          styles.pausedActionButtonText,
                          { color: "#f44336" },
                        ]}
                      >
                        Mark Incorrect
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.pausedActionButton,
                        styles.pausedButtonCorrect,
                      ]}
                      onPress={handleProgressAsCorrect}
                    >
                      <Ionicons name="checkmark" size={18} color="#4caf50" />
                      <Text
                        style={[
                          styles.pausedActionButtonText,
                          { color: "#4caf50" },
                        ]}
                      >
                        Mark Correct
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.pausedSecondaryActions}>
                    {canReplayPausedAudio && (
                      <TouchableOpacity
                        style={[
                          styles.pausedSecondaryAction,
                          styles.pausedButtonReplay,
                          isReplayingAudio && styles.pausedActionDisabled,
                        ]}
                        onPress={() => {
                          void handleReplayAudio();
                        }}
                        disabled={isReplayingAudio}
                      >
                        <Ionicons
                          name={isReplayingAudio ? "sync" : "volume-high"}
                          size={16}
                          color="#9575cd"
                        />
                        <Text
                          style={[
                            styles.pausedSecondaryActionText,
                            { color: "#9575cd" },
                          ]}
                        >
                          {isReplayingAudio ? "Replaying..." : `Replay`}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.pausedSecondaryAction,
                        styles.pausedButtonDetails,
                      ]}
                      onPress={handleViewDetails}
                    >
                      <Ionicons
                        name="information-circle"
                        size={16}
                        color="#9E9E9E"
                      />
                      <Text
                        style={[
                          styles.pausedSecondaryActionText,
                          { color: "#9E9E9E" },
                        ]}
                      >
                        Details
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {isPausedOnCorrect && !shouldUsePausedSubjectDetailsMode && (
                <View style={styles.pausedCard}>
                  <View style={styles.pausedCardHeader}>
                    <View
                      style={[
                        styles.pausedCardIconContainer,
                        styles.pausedCardIconContainerCorrect,
                      ]}
                    >
                      <Ionicons
                        name="checkmark-circle"
                        size={24}
                        color="#4caf50"
                      />
                    </View>
                    <Text
                      style={[
                        styles.pausedCardTitle,
                        styles.pausedCardTitleCorrect,
                      ]}
                    >
                      Correct
                    </Text>
                  </View>

                  <View style={styles.correctAnswerSection}>
                    <Text style={styles.correctAnswerLabel}>
                      Accepted answers:
                    </Text>
                    <Text
                      style={[
                        styles.correctAnswerText,
                        questionType === "reading" && fontStyles.japaneseText,
                      ]}
                    >
                      {pausedCorrectAnswerText}
                    </Text>
                  </View>

                  <View style={styles.pausedSecondaryActions}>
                    {canReplayPausedAudio && (
                      <TouchableOpacity
                        style={[
                          styles.pausedSecondaryAction,
                          styles.pausedButtonReplay,
                          isReplayingAudio && styles.pausedActionDisabled,
                        ]}
                        onPress={() => {
                          void handleReplayAudio();
                        }}
                        disabled={isReplayingAudio}
                      >
                        <Ionicons
                          name={isReplayingAudio ? "sync" : "volume-high"}
                          size={16}
                          color="#9575cd"
                        />
                        <Text
                          style={[
                            styles.pausedSecondaryActionText,
                            { color: "#9575cd" },
                          ]}
                        >
                          {isReplayingAudio ? "Replaying..." : `Replay`}
                        </Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.pausedSecondaryAction,
                        styles.pausedButtonDetails,
                      ]}
                      onPress={handleViewDetails}
                    >
                      <Ionicons
                        name="information-circle"
                        size={16}
                        color="#9E9E9E"
                      />
                      <Text
                        style={[
                          styles.pausedSecondaryActionText,
                          { color: "#9E9E9E" },
                        ]}
                      >
                        Details
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <Animated.View
                style={[
                  styles.inputContainer,
                  shakeStyle,
                  shouldShowPausedSubjectDetails &&
                    styles.pausedAnswerControlArea,
                ]}
              >
                <Animated.View
                  style={[styles.inputGlowContainer, inputGlowStyle]}
                >
                  <View
                    style={[
                      styles.banner,
                      questionType === "meaning"
                        ? styles.bannerMeaning
                        : styles.bannerReading,
                      questionType === "meaning" &&
                        theme.isDark && {
                          backgroundColor: DARK_MODE_MEANING_BANNER_BG,
                        },
                      questionType === "reading" &&
                        theme.isDark && {
                          backgroundColor: DARK_MODE_READING_BANNER_BG,
                        },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bannerText,
                        questionType === "meaning"
                          ? styles.bannerTextMeaning
                          : styles.bannerTextReading,
                        questionType === "meaning" &&
                          theme.isDark && {
                            color: DARK_MODE_MEANING_BANNER_TEXT,
                          },
                      ]}
                    >
                      {getSubjectTypeLabel()}{" "}
                      <Text style={styles.bannerTextBold}>
                        {questionType === "meaning" ? "Meaning" : "Reading"}
                      </Text>
                    </Text>
                  </View>

                  <View style={styles.inputWrapper}>
                    <KanaInput
                      ref={kanaInputRef}
                      style={[
                        styles.answerInput,
                        questionType === "reading" && styles.answerInputReading,
                        isVoiceReviewEnabled &&
                          (isVoiceRecognizing
                            ? styles.answerInputVoiceModeDual
                            : styles.answerInputVoiceMode),
                        {
                          backgroundColor: theme.isDark ? "#000000" : "white",
                          color: theme.isDark ? "#ffffff" : "#000000",
                        },
                        isPausedOnAnswer ? styles.pausedInputTextHidden : null,
                      ]}
                      onKanaChange={handleAnswerChange}
                      onKeyPress={handlePausedShortcutKeyPress}
                      onFocus={syncAndroidKeyboardMetrics}
                      placeholder={
                        isPausedOnAnswer ? undefined : answerInputPlaceholder
                      }
                      editable={!navigatingToDetail}
                      showSoftInputOnFocus={!isPausedOnAnswer}
                      caretHidden={isPausedOnAnswer}
                      returnKeyType="done"
                      onSubmitEditing={handleInputSubmitEditing}
                      enableKanaConversion={questionType === "reading"}
                      useJapaneseKeyboard={
                        autoSwitchKeyboard && questionType === "reading"
                      }
                      resetSignal={`${
                        item.subject.id
                      }-${questionType}-${retryCount}-${inputResetNonce}`}
                      submitBehavior="submit"
                    />

                    {isPausedOnAnswer && (
                      <View
                        pointerEvents="none"
                        style={[styles.pausedAnswerOverlay]}
                      >
                        <TextInput
                          value={pausedAnswerText || ""}
                          editable={false}
                          caretHidden
                          showSoftInputOnFocus={false}
                          selectTextOnFocus={false}
                          underlineColorAndroid="transparent"
                          style={[
                            styles.answerInput,
                            questionType === "reading" &&
                              styles.answerInputReading,
                            isVoiceReviewEnabled &&
                              (isVoiceRecognizing
                                ? styles.answerInputVoiceModeDual
                                : styles.answerInputVoiceMode),
                            {
                              backgroundColor: theme.isDark
                                ? "#000000"
                                : "white",
                            },
                            hasCorrectAccent
                              ? styles.correctPausedAnswerInput
                              : hasCloseAccent
                                ? styles.closePausedAnswerInput
                                : styles.wrongAnswerInput,
                            questionType === "reading" &&
                              fontStyles.japaneseText,
                          ]}
                        />
                      </View>
                    )}

                    {isVoiceReviewEnabled && (
                      <>
                        <TouchableOpacity
                          style={[
                            styles.voiceButtonInside,
                            isVoiceRecognizing
                              ? styles.voiceButtonActive
                              : null,
                          ]}
                          onPress={handleVoiceAnswerButton}
                          disabled={
                            navigatingToDetail || isPausedOnAnswer || answered
                          }
                        >
                          <Ionicons
                            name={isVoiceRecognizing ? "stop" : "mic"}
                            size={20}
                            color="#fff"
                          />
                        </TouchableOpacity>

                        {isVoiceRecognizing && (
                          <TouchableOpacity
                            style={styles.voiceRetryButtonInside}
                            onPress={handleRetryVoiceRecognition}
                            disabled={
                              navigatingToDetail || isPausedOnAnswer || answered
                            }
                          >
                            <Ionicons name="refresh" size={18} color="#fff" />
                          </TouchableOpacity>
                        )}
                      </>
                    )}

                    <TouchableOpacity
                      style={[
                        styles.submitButtonInside,
                        hasCorrectAccent
                          ? styles.correctButton
                          : hasCloseAccent
                            ? styles.closeButton
                            : hasIncorrectAccent
                              ? styles.incorrectButton
                              : null,
                      ]}
                      onPress={handleSubmitOrAdvance}
                    >
                      <Ionicons name={submitIconName} size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </Animated.View>

                {shouldShowPausedSubjectDetails &&
                  renderPausedDetailsCorrectAnswer()}

                {shouldShowPausedSubjectDetails && renderPausedDetailsActions()}

                {isPausedOnAnswer && (
                  <TextInput
                    ref={pausedShortcutInputRef}
                    value=""
                    onChangeText={() => {}}
                    onKeyPress={handlePausedShortcutKeyPress}
                    onSubmitEditing={handleInputSubmitEditing}
                    style={styles.hiddenPausedShortcutInput}
                    autoCorrect={false}
                    autoCapitalize="none"
                    blurOnSubmit={false}
                    showSoftInputOnFocus={false}
                    caretHidden
                  />
                )}

                {isVoiceReviewEnabled &&
                  (isVoiceRecognizing ||
                    voiceError ||
                    voiceInterimTranscript) && (
                    <View
                      style={[
                        styles.voiceStatusContainer,
                        isVoiceRecognizing ||
                        (!voiceError && !!voiceInterimTranscript)
                          ? styles.voiceStatusListening
                          : styles.voiceStatusError,
                      ]}
                    >
                      <Ionicons
                        name={
                          isVoiceRecognizing ||
                          (!voiceError && !!voiceInterimTranscript)
                            ? "radio"
                            : "warning-outline"
                        }
                        size={14}
                        color="white"
                      />
                      <Text style={styles.voiceStatusText} numberOfLines={2}>
                        {isVoiceRecognizing
                          ? voiceInterimTranscript || "Listening..."
                          : voiceError ||
                            voiceInterimTranscript ||
                            "Voice recognition stopped."}
                      </Text>
                    </View>
                  )}
              </Animated.View>

              {/* Retry feedback shown when user submits a retryable answer */}
              {showRetryFeedback && answerResult && (
                <View style={styles.retryFeedback}>
                  <Text style={styles.retryFeedbackText}>
                    {getAnswerFeedback(answerResult, questionType)}
                  </Text>
                </View>
              )}

              {shouldShowPausedSubjectDetails && (
                <Animated.View
                  entering={pausedDetailsEntering}
                  exiting={pausedDetailsExiting}
                  layout={pausedDetailsLayoutTransition}
                  style={[
                    styles.pausedSubjectDetailsPanel,
                    {
                      height: pausedSubjectDetailsPanelHeight,
                      backgroundColor: theme.backgroundColor,
                    },
                  ]}
                >
                  {renderPausedSubjectDetails()}
                </Animated.View>
              )}
            </Animated.View>
          )}
        </Animated.View>

        {effectiveAnkiCardMode &&
          isCurrentQuestionAnkiRevealed &&
          effectiveAnkiButtonlessMode && (
            <View
              style={styles.ankiButtonlessOverlay}
              onLayout={(event) =>
                setAnkiButtonlessOverlayWidth(event.nativeEvent.layout.width)
              }
              onStartShouldSetResponder={() =>
                !navigatingToDetail && !pendingAnkiSubmitCallbackRef.current
              }
              onMoveShouldSetResponder={() =>
                !navigatingToDetail && !pendingAnkiSubmitCallbackRef.current
              }
              onResponderGrant={beginButtonlessAnkiGesture}
              onResponderMove={trackButtonlessAnkiGesture}
              onResponderRelease={releaseButtonlessAnkiGesture}
              onResponderTerminate={() => {
                buttonlessGestureDeltaRef.current = { dx: 0, dy: 0 };
              }}
              onResponderTerminationRequest={() => false}
              accessibilityLabel="Buttonless anki controls"
              accessibilityHint="Tap left for wrong, tap right for correct, swipe up for details, swipe down to skip"
            />
          )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
