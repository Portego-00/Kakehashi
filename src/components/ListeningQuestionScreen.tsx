import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { Audio, type AudioSound } from "@/src/utils/expoAvCompat";
import { useIsFocused } from "expo-router/react-navigation";
import * as Haptics from "@/src/utils/haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  type KeyboardEvent,
  type LayoutChangeEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AudioSessionManager from "../modules/AudioSessionManager";
import type { ListeningQuestion, ListeningSolutionMode } from "../types/listening";
import {
  AnswerCheckerResult,
  checkAnswerWithDetails,
} from "../utils/answerChecker";
import { fontStyles } from "../utils/fonts";
import useBluetoothAudioKeepAlive from "../hooks/useBluetoothAudioKeepAlive";
import { useSubjectColors } from "../utils/subjectColors";
import { useSettingsStore } from "../utils/store";
import KanaInput from "./TextToKanaInput";

const { width, height } = Dimensions.get("window");
const ANDROID_AUTOFOCUS_DELAY_MS = 200;
const CONTEXT_AUDIO_SPEED_MIN = 0.5;
const CONTEXT_AUDIO_SPEED_MAX = 1.5;
const CONTEXT_AUDIO_SPEED_STEP = 0.05;
const DEFAULT_CONTEXT_AUDIO_SPEED = 1;
const CONTEXT_AUDIO_SPEED_STEPS = Math.round(
  (CONTEXT_AUDIO_SPEED_MAX - CONTEXT_AUDIO_SPEED_MIN) / CONTEXT_AUDIO_SPEED_STEP,
);
const AUDIO_SPEED_INLINE_SLIDER_WIDTH = Math.max(
  96,
  Math.min(140, width * 0.32),
);

interface ListeningQuestionScreenProps {
  question: ListeningQuestion;
  questionPhase: "kanji" | "meaning";
  solutionMode: ListeningSolutionMode;
  useJapaneseKeyboard?: boolean;
  onKanjiAnswer: (isCorrect: boolean, answer: string) => void;
  onMeaningAnswer: (isCorrect: boolean, answer: string) => void;
  onExit: () => void;
  currentItem: number;
  totalItems: number;
  correctAnswersCount: number;
  accuracyPercent: number;
  lastCompletedItem: {
    id: number;
    characters: string;
    meaning: string;
    isCorrect: boolean;
  } | null;
  isLoadingMore?: boolean;
  expectedTotalQuestions?: number;
  autoPlayAudio?: boolean;
  studyMaterials?: { meaning_synonyms?: string[] };
}

export default function ListeningQuestionScreen({
  question,
  questionPhase,
  solutionMode,
  useJapaneseKeyboard = false,
  onKanjiAnswer,
  onMeaningAnswer,
  onExit,
  currentItem,
  totalItems,
  correctAnswersCount,
  accuracyPercent,
  lastCompletedItem,
  isLoadingMore = false,
  expectedTotalQuestions = 0,
  autoPlayAudio = true,
  studyMaterials,
}: ListeningQuestionScreenProps) {
  const subjectColors = useSubjectColors();
  const isFocused = useIsFocused();
  const { showContextSentenceSpeedControl } = useSettingsStore();
  const [selectedChoiceIndex, setSelectedChoiceIndex] = useState<number | null>(
    null
  );
  const [vocabAnswer, setVocabAnswer] = useState("");
  const [meaningAnswer, setMeaningAnswer] = useState("");
  const [hasPlayedAudio, setHasPlayedAudio] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioPlaybackSpeed, setAudioPlaybackSpeed] = useState(
    DEFAULT_CONTEXT_AUDIO_SPEED,
  );
  const [isSpeedControlExpanded, setIsSpeedControlExpanded] = useState(false);
  const soundRef = useRef<AudioSound | null>(null);
  const vocabInputRef = useRef<any>(null);
  const meaningInputRef = useRef<any>(null);
  const [androidKeyboardHeight, setAndroidKeyboardHeight] = useState(0);
  const [androidScreenLayoutHeight, setAndroidScreenLayoutHeight] = useState(0);
  const mountedRef = useRef(true);
  const androidBaselineScreenHeightRef = useRef(0);
  const shouldKeepListeningAudioWarm =
    Boolean(question.example.audio) && isFocused;
  useBluetoothAudioKeepAlive(shouldKeepListeningAudioWarm, "ListeningQuestion");

  // Animation values
  const progressWidth = useRef(new Animated.Value(0)).current;
  const feedbackOpacity = useRef(new Animated.Value(0)).current;
  const [answerFeedback, setAnswerFeedback] = useState<
    "correct" | "incorrect" | null
  >(null);
  const [showVocabInSentence, setShowVocabInSentence] = useState(false);
  const [wasKanjiCorrect, setWasKanjiCorrect] = useState(false);
  const imageOpacity = useRef(new Animated.Value(1)).current;
  const sentenceTranslateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    return () => {
      mountedRef.current = false;
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

  const unloadCurrentSound = useCallback(async () => {
    const currentSound = soundRef.current;
    if (!currentSound) {
      return;
    }

    soundRef.current = null;

    try {
      currentSound.setOnPlaybackStatusUpdate(null);
      try {
        await currentSound.stopAsync();
      } catch {
        // Ignore stop errors for already-stopped sounds
      }
      await currentSound.unloadAsync();
    } catch {
      // Ignore unload errors to avoid blocking next playback attempts
    }
  }, []);

  // Reset state when question changes
  useEffect(() => {
    setSelectedChoiceIndex(null);
    setVocabAnswer("");
    setMeaningAnswer("");
    setHasPlayedAudio(false);
    setIsPlayingAudio(false);
    setIsLoadingAudio(false);
    setAnswerFeedback(null);
    setShowVocabInSentence(false);
    setWasKanjiCorrect(false);
    feedbackOpacity.setValue(0);
    imageOpacity.setValue(1);
    sentenceTranslateY.setValue(0);

    // Clear the KanaInputs when question changes
    if (vocabInputRef.current?.clearInput) {
      vocabInputRef.current.clearInput();
    }
    if (meaningInputRef.current?.clearInput) {
      meaningInputRef.current.clearInput();
    }

    // Cleanup sound
    return () => {
      void unloadCurrentSound();
    };
  }, [question.id, feedbackOpacity, imageOpacity, sentenceTranslateY, unloadCurrentSound]);

  // Auto-play audio on mount (only for kanji phase, if enabled)
  useEffect(() => {
    if (autoPlayAudio && questionPhase === "kanji" && !hasPlayedAudio) {
      playAudio();
    }
  }, [questionPhase, hasPlayedAudio, autoPlayAudio]);

  // Animate progress bar (2 steps per item)
  useEffect(() => {
    // Current step index (0-based): (itemIndex * 2) + (1 if meaning phase)
    const currentStepIndex =
      (currentItem - 1) * 2 + (questionPhase === "meaning" ? 1 : 0);
    const totalSteps = totalItems * 2;
    const targetProgress = (currentStepIndex / totalSteps) * 100;

    Animated.timing(progressWidth, {
      toValue: targetProgress,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [currentItem, totalItems, progressWidth, questionPhase]);

  // Focus active text input for writing mode
  useEffect(() => {
    const focusDelay = Platform.OS === "android" ? ANDROID_AUTOFOCUS_DELAY_MS : 0;

    if (questionPhase === "kanji" && solutionMode === "writing") {
      const timeout = setTimeout(() => {
        vocabInputRef.current?.focus();
        syncAndroidKeyboardMetrics();
      }, focusDelay);
      return () => clearTimeout(timeout);
    }

    if (questionPhase === "meaning") {
      const timeout = setTimeout(() => {
        meaningInputRef.current?.focus();
        syncAndroidKeyboardMetrics();
      }, focusDelay);
      return () => clearTimeout(timeout);
    }
  }, [question.id, questionPhase, solutionMode, syncAndroidKeyboardMetrics]);

  const playAudio = async () => {
    if (isPlayingAudio || isLoadingAudio || !question.example.audio) return;

    try {
      setIsLoadingAudio(true);

      // Set up audio session for playback through speaker (iOS only)
      if (Platform.OS === "ios") {
        try {
          await AudioSessionManager.overrideSpeaker();
          console.log(
            "[ListeningQuestion] Audio session overridden to use speaker"
          );
        } catch (error) {
          console.warn(
            "[ListeningQuestion] Failed to override audio session:",
            error
          );
        }
      }

      await unloadCurrentSound();

      const playbackRate = showContextSentenceSpeedControl
        ? audioPlaybackSpeed
        : DEFAULT_CONTEXT_AUDIO_SPEED;

      const { sound } = await Audio.Sound.createAsync(
        { uri: question.example.audio },
        {
          shouldPlay: true,
          volume: 1.0,
          rate: playbackRate,
          shouldCorrectPitch: true,
        },
      );

      setIsLoadingAudio(false);
      setIsPlayingAudio(true);
      soundRef.current = sound;
      setHasPlayedAudio(true);

      // Cleanup after playback
      sound.setOnPlaybackStatusUpdate((status: any) => {
        if (soundRef.current !== sound) {
          return;
        }

        if (!status.isLoaded) {
          if (status.error) {
            setIsPlayingAudio(false);
            setIsLoadingAudio(false);
            soundRef.current = null;
          }
          return;
        }

        if (status.didJustFinish) {
          setIsPlayingAudio(false);
          soundRef.current = null;
          void sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error("[ListeningQuestion] Failed to play audio:", error);
      setIsLoadingAudio(false);
      setIsPlayingAudio(false);
      await unloadCurrentSound();
    }
  };

  const handleChoiceSelect = (index: number) => {
    setSelectedChoiceIndex(index);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const showFeedbackAnimation = (isCorrect: boolean) => {
    setAnswerFeedback(isCorrect ? "correct" : "incorrect");

    Animated.sequence([
      Animated.timing(feedbackOpacity, {
        toValue: 0.7,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(feedbackOpacity, {
        toValue: 0,
        duration: 300,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setAnswerFeedback(null);
    });
  };

  const handleKanjiSubmit = () => {
    let submittedAnswer = "";
    let isCorrect = false;

    if (solutionMode === "writing") {
      let answer = vocabAnswer.trim();
      if (vocabInputRef.current?.flushKana) {
        answer = vocabInputRef.current.flushKana();
      }

      const normalize = (value: string) =>
        value.replace(/\u3000/g, " ").replace(/\s/g, "").trim();
      const normalizedAnswer = normalize(answer);
      if (!normalizedAnswer) return;

      const expectedAnswer = question.vocab.data.characters || "";
      const normalizedExpectedAnswer = normalize(expectedAnswer);

      submittedAnswer = answer.trim();
      isCorrect =
        normalizedExpectedAnswer.length > 0 &&
        normalizedAnswer === normalizedExpectedAnswer;
    } else {
      if (selectedChoiceIndex === null) return;
      const selectedChoice = question.kanjiChoices[selectedChoiceIndex];
      submittedAnswer = selectedChoice.kanji;
      isCorrect = selectedChoice.isCorrect;
    }

    Haptics.notificationAsync(
      isCorrect
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error
    );

    showFeedbackAnimation(isCorrect);
    setWasKanjiCorrect(isCorrect);

    // After kanji answer, show vocabulary in sentence and fade out image, move sentence up
    setTimeout(() => {
      setShowVocabInSentence(true);

      // Fade out image and move sentence to where image was
      Animated.parallel([
        Animated.timing(imageOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(sentenceTranslateY, {
          toValue: -(height * 0.25 + 16), // Move up by image height + margin
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }, 100);

    setTimeout(() => {
      onKanjiAnswer(isCorrect, submittedAnswer);
    }, 300);
  };

  const handleMeaningSubmit = () => {
    // Flush any remaining kana conversion
    let answer = meaningAnswer.trim();
    if (meaningInputRef.current?.flushKana) {
      answer = meaningInputRef.current.flushKana();
    }

    if (!answer) return;

    // Check answer using the answer checker
    const result = checkAnswerWithDetails(
      answer,
      question.vocab,
      "meaning",
      studyMaterials,
    );

    const isCorrect =
      result === AnswerCheckerResult.Precise ||
      result === AnswerCheckerResult.Imprecise;

    Haptics.notificationAsync(
      isCorrect
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error
    );

    showFeedbackAnimation(isCorrect);
    setTimeout(() => {
      onMeaningAnswer(isCorrect, answer);
    }, 300);
  };

  const handleVocabAnswerChange = (text: string) => {
    setVocabAnswer(text);
  };

  const handleMeaningAnswerChange = (text: string) => {
    setMeaningAnswer(text);
  };

  const formatAudioSpeed = (speed: number) =>
    speed.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  const sliderIndexToSpeed = (index: number) =>
    Number((CONTEXT_AUDIO_SPEED_MIN + index * CONTEXT_AUDIO_SPEED_STEP).toFixed(2));
  const speedToSliderIndex = (speed: number) =>
    Math.max(
      0,
      Math.min(
        CONTEXT_AUDIO_SPEED_STEPS,
        Math.round((speed - CONTEXT_AUDIO_SPEED_MIN) / CONTEXT_AUDIO_SPEED_STEP),
      ),
    );
  const shouldShowAudioSpeedControl =
    showContextSentenceSpeedControl &&
    questionPhase === "kanji" &&
    Boolean(question.example.audio);

  useEffect(() => {
    if (!shouldShowAudioSpeedControl) {
      setIsSpeedControlExpanded(false);
    }
  }, [shouldShowAudioSpeedControl]);

  const canSubmitVocabAnswer =
    solutionMode === "writing"
      ? Boolean(vocabAnswer.trim())
      : selectedChoiceIndex !== null;

  const renderInlineChars = (text: string, keyPrefix: string) =>
    Array.from(text).map((char, index) => (
      <Text
        key={`${keyPrefix}-${index}`}
        style={[styles.sentence, styles.inlineSentenceChar, fontStyles.japaneseText]}
      >
        {char}
      </Text>
    ));

  const progressPercentage = progressWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });
  const isKanjiWritingPhase =
    questionPhase === "kanji" && solutionMode === "writing";
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

  // Render the sentence with highlighted vocabulary if revealed
  const renderSentence = () => {
    if (!showVocabInSentence) {
      if (questionPhase === "kanji" && solutionMode === "writing") {
        const blank = "＿＿＿";
        const sentenceWithBlank = question.sentenceWithBlank;
        const [before, ...afterParts] = sentenceWithBlank.split(blank);
        const after = afterParts.join(blank);
        const hasBlank = sentenceWithBlank.includes(blank);

        return (
          <View style={styles.inlineSentenceRow}>
            {hasBlank ? renderInlineChars(before, "before") : null}
            <Animated.View
              style={[
                styles.inlineInputGlow,
                answerFeedback && {
                  shadowColor: answerFeedback === "correct" ? "#4caf50" : "#f44336",
                  shadowOpacity: feedbackOpacity.interpolate({
                    inputRange: [0, 0.7],
                    outputRange: [0, 0.9],
                    extrapolate: "clamp",
                  }),
                },
              ]}
            >
              <KanaInput
                ref={vocabInputRef}
                style={[styles.inlineVocabInput, fontStyles.japaneseText]}
                onKanaChange={handleVocabAnswerChange}
                placeholder="答え"
                placeholderTextColor="#999"
                returnKeyType="done"
                onSubmitEditing={handleKanjiSubmit}
                onFocus={syncAndroidKeyboardMetrics}
                enableKanaConversion={false}
                useJapaneseKeyboard={useJapaneseKeyboard}
                resetSignal={`${question.id}-vocab`}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </Animated.View>
            {hasBlank ? renderInlineChars(after, "after") : null}
            {!hasBlank ? (
              <Text style={[styles.sentence, fontStyles.japaneseText]}>
                {question.sentenceWithBlank}
              </Text>
            ) : null}
          </View>
        );
      }

      // Show sentence with blank
      return (
        <Text style={[styles.sentence, fontStyles.japaneseText]}>
          {question.sentenceWithBlank}
        </Text>
      );
    }

    // Show sentence with vocabulary highlighted
    const vocabText = question.vocab.data.characters || "";
    const parts = question.example.sentence.split(vocabText);

    if (parts.length === 1) {
      // Vocabulary not found in sentence, just show full sentence
      return (
        <Text style={[styles.sentence, fontStyles.japaneseText]}>
          {question.example.sentence}
        </Text>
      );
    }

    // Render with highlighted vocabulary
    return (
      <Text style={[styles.sentence, fontStyles.japaneseText]}>
        {parts[0]}
        <Text
          style={[
            styles.highlightedVocab,
            wasKanjiCorrect ? styles.vocabCorrect : styles.vocabIncorrect,
          ]}
        >
          {vocabText}
        </Text>
        {parts.slice(1).join(vocabText)}
      </Text>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: subjectColors.vocabulary }]}
      edges={["left", "right", "bottom"]}
      onLayout={handleScreenLayout}
    >
      {/* Feedback Overlay */}
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

        <View style={styles.statItem}>
          <Ionicons name="pie-chart" size={24} color="white" />
          <Text style={styles.statText}>{accuracyPercent}%</Text>
        </View>

        <View style={[styles.statItem, { marginHorizontal: 20 }]}>
          <Ionicons name="checkmark-done" size={24} color="white" />
          <Text style={styles.statText}>{correctAnswersCount}</Text>
        </View>

        <View style={styles.statItem}>
          <Ionicons name="folder-open" size={24} color="white" />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={styles.statText}>
              {isLoadingMore && expectedTotalQuestions > 0
                ? `${totalItems}/${expectedTotalQuestions}`
                : totalItems - currentItem + 1}
            </Text>
            {isLoadingMore && (
              <ActivityIndicator size="small" color="white" />
            )}
          </View>
        </View>
      </View>
      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <Animated.View
          style={[styles.progressBar, { width: progressPercentage }]}
        />
      </View>
      {/* Content - scrollable for long media/sentences */}
      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={[
          styles.scrollContentContainer,
          Platform.OS === "android" &&
            isKanjiWritingPhase &&
            androidKeyboardLift > 0 && {
              paddingBottom: 16 + androidKeyboardLift,
            },
        ]}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="none"
        automaticallyAdjustKeyboardInsets={isKanjiWritingPhase}
        showsVerticalScrollIndicator={false}
      >
        {/* Image Display with Audio Button - Animated */}
        {question.example.imageUrl && (
          <Animated.View
            style={[
              styles.imageContainer,
              {
                opacity: imageOpacity,
              },
            ]}
          >
            <Image
              source={{ uri: question.example.imageUrl }}
              style={styles.contextImage}
              resizeMode="cover"
            />

            {/* Previous Item Indicator */}
            {lastCompletedItem && (
              <TouchableOpacity
                style={[
                  styles.previousItemContainer,
                  // Use vocab color (purple) for background always, as requested
                  { backgroundColor: subjectColors.vocabulary },
                ]}
                onPress={() => {
                  const { router } = require("expo-router");
                  router.push({
                    pathname: "/subject/[id]",
                    params: { id: lastCompletedItem.id },
                  });
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[styles.previousItemText, fontStyles.japaneseText]}
                >
                  {lastCompletedItem.characters}
                </Text>
                <View
                  style={[
                    styles.previousItemIconContainer,
                    {
                      backgroundColor: lastCompletedItem.isCorrect
                        ? "#4caf50"
                        : "#f44336",
                    },
                  ]}
                >
                  <Ionicons
                    name={lastCompletedItem.isCorrect ? "checkmark" : "close"}
                    size={14}
                    color="white"
                  />
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.audioControlsOverlay}>
              {shouldShowAudioSpeedControl && isSpeedControlExpanded && (
                <View style={styles.audioSpeedInlineControl}>
                  <Slider
                    minimumValue={0}
                    maximumValue={CONTEXT_AUDIO_SPEED_STEPS}
                    step={1}
                    value={speedToSliderIndex(audioPlaybackSpeed)}
                    onValueChange={(value) =>
                      setAudioPlaybackSpeed(sliderIndexToSpeed(Math.round(value)))
                    }
                    minimumTrackTintColor="white"
                    maximumTrackTintColor="rgba(255,255,255,0.35)"
                    thumbTintColor="white"
                    style={styles.audioSpeedInlineSlider}
                  />
                  <Text style={styles.audioSpeedInlineLabel}>
                    {formatAudioSpeed(audioPlaybackSpeed)}x
                  </Text>
                </View>
              )}

              {shouldShowAudioSpeedControl && (
                <TouchableOpacity
                  style={[
                    styles.audioSpeedToggleButton,
                    isSpeedControlExpanded && {
                      backgroundColor: subjectColors.vocabulary,
                    },
                  ]}
                  onPress={() =>
                    setIsSpeedControlExpanded((previous) => !previous)
                  }
                  activeOpacity={0.82}
                >
                  <Ionicons
                    name="speedometer-outline"
                    size={16}
                    color={isSpeedControlExpanded ? "white" : "#ffffff"}
                  />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={playAudio}
                style={[
                  styles.audioButtonOverlay,
                  isPlayingAudio && { backgroundColor: subjectColors.vocabulary },
                ]}
                disabled={isPlayingAudio || isLoadingAudio}
              >
                {isLoadingAudio ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Ionicons
                    name={isPlayingAudio ? "volume-high" : "play"}
                    size={20}
                    color="white"
                  />
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* Sentence with Blank - Animated */}
        <Animated.View
          style={[
            styles.sentenceCard,
            {
              transform: [{ translateY: sentenceTranslateY }],
            },
          ]}
        >
          {renderSentence()}
        </Animated.View>

      </ScrollView>
      {/* Bottom question area (hidden in kanji writing mode) */}
      {!isKanjiWritingPhase && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
          style={[
            styles.questionWrapper,
            Platform.OS === "android" &&
              questionPhase === "meaning" &&
              androidKeyboardLift > 0 && {
                paddingBottom: 16 + androidKeyboardLift,
              },
          ]}
        >
          {questionPhase === "kanji" ? (
            /* Vocabulary Multiple Choice Phase */
            (<View style={styles.questionSection}>
              <View style={styles.questionPromptContainer}>
                <Ionicons name="ear" size={24} color="white" />
                <Text style={styles.questionPrompt}>
                  Which word did you hear?
                </Text>
              </View>
              <View style={styles.choicesGrid}>
                {question.kanjiChoices.map((choice, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.choiceButton,
                      selectedChoiceIndex === index && styles.choiceSelected,
                    ]}
                    onPress={() => handleChoiceSelect(index)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.choiceText,
                        fontStyles.japaneseText,
                        selectedChoiceIndex === index &&
                          styles.choiceTextSelected,
                      ]}
                    >
                      {choice.kanji}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  !canSubmitVocabAnswer && styles.submitButtonDisabled,
                ]}
                onPress={handleKanjiSubmit}
                disabled={!canSubmitVocabAnswer}
                activeOpacity={0.8}
              >
                <Text style={styles.submitButtonText}>Submit Answer</Text>
                <Ionicons name="arrow-forward" size={24} color="white" />
              </TouchableOpacity>
            </View>)
          ) : (
            /* Meaning Input Phase */
            (<View style={styles.questionSection}>
              <View style={styles.banner}>
                <Text style={styles.bannerText}>Meaning Question</Text>
              </View>
              <View style={styles.inputWrapper}>
                <Animated.View
                  style={[
                    styles.inputGlowContainer,
                    answerFeedback && {
                      shadowColor:
                        answerFeedback === "correct" ? "#4caf50" : "#f44336",
                      shadowOpacity: feedbackOpacity.interpolate({
                        inputRange: [0, 0.7],
                        outputRange: [0, 0.9],
                        extrapolate: "clamp",
                      }),
                    },
                  ]}
                >
                  <KanaInput
                    ref={meaningInputRef}
                    style={styles.meaningInput}
                    onKanaChange={handleMeaningAnswerChange}
                    placeholder="Enter meaning..."
                    placeholderTextColor="#999"
                    returnKeyType="done"
                    onSubmitEditing={handleMeaningSubmit}
                    onFocus={syncAndroidKeyboardMetrics}
                    enableKanaConversion={false}
                    resetSignal={question.id}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </Animated.View>

                <TouchableOpacity
                  style={[
                    styles.submitButtonInside,
                    !meaningAnswer.trim() && styles.submitButtonInsideDisabled,
                  ]}
                  onPress={handleMeaningSubmit}
                  disabled={!meaningAnswer.trim()}
                >
                  <Ionicons name="arrow-forward" size={20} color="white" />
                </TouchableOpacity>
              </View>
            </View>)
          )}
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "transparent",
  },
  feedbackOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    marginRight: "auto",
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 70,
  },
  statText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 5,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    width: "100%",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "white",
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
  },
  questionWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  imageContainer: {
    width: "100%",
    height: height * 0.25,
    overflow: "visible",
    marginBottom: 16,
    position: "relative",
    zIndex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
  },
  contextImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  audioButtonOverlay: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#333333", // Solid dark color
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20, // High zIndex to be clickable outside image bounds
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  audioControlsOverlay: {
    position: "absolute",
    top: -12,
    right: -6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 20,
  },
  audioButtonPlaying: {
    backgroundColor: "transparent",
  },
  sentenceCard: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  audioSpeedInlineControl: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
    backgroundColor: "rgba(0, 0, 0, 0.32)",
    paddingLeft: 8,
    paddingRight: 6,
    height: 36,
  },
  audioSpeedToggleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#333333",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  audioSpeedToggleButtonActive: {
    backgroundColor: "transparent",
  },
  audioSpeedInlineLabel: {
    minWidth: 34,
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
  audioSpeedInlineSlider: {
    width: AUDIO_SPEED_INLINE_SLIDER_WIDTH,
    height: 28,
  },
  sentence: {
    fontSize: 18,
    color: "white",
    lineHeight: 28,
  },
  inlineSentenceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
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
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  inlineVocabInput: {
    minWidth: 96,
    maxWidth: width * 0.4,
    backgroundColor: "white",
    color: "#000000",
    paddingVertical: 4,
    paddingHorizontal: 8,
    fontSize: 16,
    borderRadius: 6,
    textAlign: "center",
  },
  highlightedVocab: {
    fontWeight: "700",
  },
  vocabCorrect: {
    backgroundColor: "rgba(76, 175, 80, 0.3)",
  },
  vocabIncorrect: {
    backgroundColor: "rgba(244, 67, 54, 0.3)",
  },
  translation: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
    lineHeight: 20,
  },
  questionSection: {
    // No flex or positioning - let KeyboardAvoidingView handle it
  },
  questionPromptContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    gap: 8,
  },
  questionPrompt: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
    textAlign: "center",
  },
  banner: {
    padding: 12,
    alignSelf: "stretch",
    alignItems: "center",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
  },
  bannerText: {
    fontWeight: "bold",
    fontSize: 16,
    color: "#333",
  },
  choicesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 12,
  },
  choiceButton: {
    width: (width - 32 - 12) / 2, // Two columns with gap
    paddingVertical: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  choiceSelected: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderColor: "white",
  },
  choiceText: {
    fontSize: 28,
    color: "white",
    fontWeight: "500",
  },
  choiceTextSelected: {
    fontWeight: "700",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.3)",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonDisabled: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    opacity: 0.5,
  },
  submitButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  inputWrapper: {
    position: "relative",
    alignSelf: "stretch",
  },
  inputGlowContainer: {
    borderRadius: 8,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 0 },
        shadowRadius: 25,
      },
      android: {
        elevation: 15,
      },
    }),
  },
  meaningInput: {
    alignSelf: "stretch",
    backgroundColor: "white",
    color: "#000000",
    padding: 16,
    paddingRight: 56,
    fontSize: Math.min(width * 0.045, 18),
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  submitButtonInside: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#333",
    elevation: 2,
  },
  submitButtonInsideDisabled: {
    backgroundColor: "#999",
    opacity: 0.5,
  },
  previousItemContainer: {
    position: "absolute",
    top: -8,
    left: -8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    zIndex: 20, // High zIndex
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  previousItemText: {
    color: "white",
    fontSize: 18, // Slightly larger
    fontWeight: "bold",
  },
  previousItemIconContainer: {
    position: "absolute",
    top: -10,
    right: -10,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
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
});
