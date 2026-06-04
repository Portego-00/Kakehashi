import { Ionicons } from "@expo/vector-icons";
import {
  HanziWriter,
  useHanziWriter,
} from "@jamsch/react-native-hanzi-writer";
import * as Haptics from "@/src/utils/haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Line } from "react-native-svg";
import { loadKanjiWriterData } from "../utils/kanjiWriterDataLoader";
import { useTheme } from "../utils/theme";

const LOADER_PENDING_TIMEOUT_MS = 12000;

export interface KanjiWriterQuizProps {
  character: string;
  onComplete?: (result: { totalMistakes: number; character: string }) => void;
  onMistake?: (strokeNum: number, totalMistakes: number) => void;
  onCorrectStroke?: (strokeNum: number, strokesRemaining: number) => void;
  leniency?: number;
  showHintAfterMisses?: number | false;
  onSkip?: () => void;
  onNext?: () => void;
  /** Called when stroke data is unavailable - allows replacing with another kanji */
  onUnavailable?: () => void;
}

// Custom grid overlay with diagonals
function GridOverlay({
  size,
  color,
}: {
  size: number;
  color: string;
}) {
  return (
    <Svg
      width={size}
      height={size}
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
    >
      {/* Diagonal top-left to bottom-right */}
      <Line
        x1={8}
        y1={8}
        x2={size - 8}
        y2={size - 8}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="6,6"
      />
      {/* Diagonal top-right to bottom-left */}
      <Line
        x1={size - 8}
        y1={8}
        x2={8}
        y2={size - 8}
        stroke={color}
        strokeWidth={1}
        strokeDasharray="6,6"
      />
    </Svg>
  );
}

export default function KanjiWriterQuiz({
  character,
  onComplete,
  onMistake,
  onCorrectStroke,
  leniency = 1.0,
  showHintAfterMisses = 2,
  onSkip,
  onNext,
  onUnavailable,
}: KanjiWriterQuizProps) {
  const { theme } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const isTablet = screenWidth >= 768;
  const canvasSize = isTablet
    ? Math.min(400, screenWidth * 0.5)
    : screenWidth - 64;

  const [strokeNum, setStrokeNum] = useState(0);
  const [totalStrokes, setTotalStrokes] = useState(0);
  const [totalMistakes, setTotalMistakes] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(true);

  // Use refs for state that should persist across character changes
  const showGridRef = useRef(true); // Grid ON by default
  const [showGrid, setShowGrid] = useState(true);

  const hasStartedQuiz = useRef(false);
  const completionDataRef = useRef<{
    totalMistakes: number;
    character: string;
  } | null>(null);

  // Track which strokes have been counted as mistakes (only count once per stroke on 2nd miss)
  const countedMistakeStrokesRef = useRef<Set<number>>(new Set());

  const writer = useHanziWriter({
    character,
    loader: loadKanjiWriterData,
  });

  // Track current stroke via quiz store
  const currentStrokeIndex = writer.quiz.useStore((state) => state.index);
  const quizActive = writer.quiz.useStore((state) => state.active);
  const quizMistakes = writer.quiz.useStore((state) => state.mistakes);
  const isResolvedCharacter =
    writer.characterState.status === "resolved" &&
    writer.characterState.data.symbol === character;

  // Handle character change - show transition state to clear canvas
  useEffect(() => {
    // Set transitioning to hide old content immediately
    setIsTransitioning(true);

    // Reset quiz state
    hasStartedQuiz.current = false;
    countedMistakeStrokesRef.current = new Set();
    setStrokeNum(0);
    setTotalStrokes(0);
    setTotalMistakes(0);
    setIsComplete(false);
    setShowOutline(false);
    setIsAnimating(false);
    completionDataRef.current = null;

    // Don't reset showGrid - use the ref value
    setShowGrid(showGridRef.current);
  }, [character]);

  // Update stroke number when quiz state changes
  useEffect(() => {
    if (quizActive) {
      setStrokeNum(currentStrokeIndex);
    }
  }, [currentStrokeIndex, quizActive]);

  // Start quiz when character loads
  useEffect(() => {
    if (
      writer.characterState.status !== "resolved" ||
      writer.characterState.data.symbol !== character ||
      hasStartedQuiz.current
    ) {
      return;
    }

    hasStartedQuiz.current = true;
    setIsTransitioning(false); // Clear transition state
    const charData = writer.characterState.data;
    setTotalStrokes(charData.strokes.length);

    // Start the quiz
    writer.quiz.start({
      leniency,
      showHintAfterMisses,
      acceptBackwardsStrokes: false,
      onCorrectStroke: (strokeData) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setStrokeNum(strokeData.strokeNum + 1);
        onCorrectStroke?.(strokeData.strokeNum, strokeData.strokesRemaining);
      },
      onMistake: (strokeData) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

        // Custom mistake counting logic:
        // - 1st mistake on stroke: nothing (mistakesOnStroke = 1)
        // - 2nd mistake on stroke: add 1 to total (mistakesOnStroke = 2)
        // - 3rd+ mistakes: don't add more (already counted)
        const strokeIndex = strokeData.strokeNum;
        const mistakesOnThisStroke = strokeData.mistakesOnStroke;

        if (
          mistakesOnThisStroke === 2 &&
          !countedMistakeStrokesRef.current.has(strokeIndex)
        ) {
          // This is the 2nd mistake on this stroke - count it
          countedMistakeStrokesRef.current.add(strokeIndex);
          const newTotal = countedMistakeStrokesRef.current.size;
          setTotalMistakes(newTotal);
          onMistake?.(strokeIndex, newTotal);
        }
        // 1st mistake or 3rd+: don't update the count
      },
      onComplete: (summary) => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setIsComplete(true);
        // Store completion data with our custom mistake count
        completionDataRef.current = {
          totalMistakes: countedMistakeStrokesRef.current.size,
          character: summary.character,
        };
      },
    });
  }, [
    character,
    writer.characterState.status,
    writer.characterState,
    writer.quiz,
    leniency,
    showHintAfterMisses,
    onCorrectStroke,
    onMistake,
  ]);

  // Auto-replace when stroke data is not available (404 error)
  useEffect(() => {
    if (writer.characterState.status === "rejected") {
      setIsTransitioning(false);
      const callback = onUnavailable || onSkip;
      if (callback) {
        // Show error briefly, then auto-replace/skip after 1 second
        const timer = setTimeout(() => {
          callback();
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [writer.characterState.status, onUnavailable, onSkip]);

  // If the library gets stuck in pending, move on instead of trapping the user.
  useEffect(() => {
    if (writer.characterState.status !== "pending") {
      return;
    }

    const callback = onUnavailable || onSkip;
    if (!callback) {
      return;
    }

    const timer = setTimeout(() => {
      callback();
    }, LOADER_PENDING_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [character, writer.characterState.status, onUnavailable, onSkip]);

  const handleShowHint = useCallback(() => {
    // To show a hint, we temporarily increase the mistake count for the current stroke
    // to trigger the QuizMistakeHighlighter, then it resets automatically
    if (isResolvedCharacter && quizActive) {
      const currentMistakes = quizMistakes[currentStrokeIndex] || 0;
      const hintThreshold =
        typeof showHintAfterMisses === "number" ? showHintAfterMisses : 3;

      // If we haven't reached the hint threshold yet, temporarily set it high
      if (currentMistakes < hintThreshold) {
        writer.quiz.store.setState({
          mistakes: {
            ...quizMistakes,
            [currentStrokeIndex]: hintThreshold,
          },
        });
        // Reset back after animation (about 500ms)
        setTimeout(() => {
          writer.quiz.store.setState({
            mistakes: {
              ...writer.quiz.store.getState().mistakes,
              [currentStrokeIndex]: currentMistakes,
            },
          });
        }, 500);
      }
      // If already at or above threshold, the hint will show automatically on next mistake
    }
  }, [
    isResolvedCharacter,
    writer.quiz,
    quizActive,
    quizMistakes,
    currentStrokeIndex,
    showHintAfterMisses,
  ]);

  const handleToggleOutline = useCallback(() => {
    setShowOutline((prev) => !prev);
  }, []);

  const handleToggleGrid = useCallback(() => {
    setShowGrid((prev) => {
      const newValue = !prev;
      showGridRef.current = newValue; // Persist across questions
      return newValue;
    });
  }, []);

  const handleReplayAnimation = useCallback(() => {
    if (isResolvedCharacter && !isAnimating) {
      setIsAnimating(true);
      writer.animator.animateCharacter({
        strokeDuration: 500,
        delayBetweenStrokes: 400,
        onComplete: () => {
          setIsAnimating(false);
        },
      });
    }
  }, [writer.animator, isResolvedCharacter, isAnimating]);

  const handleNext = useCallback(() => {
    // Call onComplete with stored data when user clicks Next
    if (completionDataRef.current && onComplete) {
      onComplete(completionDataRef.current);
    }
    // Also call onNext if provided
    onNext?.();
  }, [onComplete, onNext]);

  const gridColor = theme.isDark
    ? "rgba(255,255,255,0.15)"
    : "rgba(0,0,0,0.1)";

  // Show loading during transition or while character is pending
  if (
    isTransitioning ||
    writer.characterState.status === "idle" ||
    writer.characterState.status === "pending" ||
    (writer.characterState.status === "resolved" && !isResolvedCharacter)
  ) {
    return (
      <View style={styles.container}>
        <View
          style={[
            styles.canvasContainer,
            {
              width: canvasSize,
              height: canvasSize,
              backgroundColor: theme.isDark ? "#1a1a1a" : "#fafafa",
              shadowColor: theme.isDark ? "#000" : "#333",
            },
          ]}
        >
          {/* Show grid even during loading */}
          {showGrid && (
          <GridOverlay size={canvasSize} color={gridColor} />
          )}
          <View style={styles.loadingInner}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Loading...
            </Text>
          </View>
        </View>
        {/* Show progress badge placeholder */}
        <View
          style={[
            styles.progressBadge,
            { backgroundColor: theme.isDark ? "#333" : "#fff" },
          ]}
        >
          <Text style={[styles.progressText, { color: theme.textSecondary }]}>
            Loading...
          </Text>
        </View>
      </View>
    );
  }

  // Error state - auto-replaces/skips after 1 second
  if (writer.characterState.status === "rejected") {
    const errorCallback = onUnavailable || onSkip;
    const hasReplacement = !!onUnavailable;

    return (
      <View style={styles.container}>
        <View
          style={[
            styles.canvasContainer,
            {
              width: canvasSize,
              height: canvasSize,
              backgroundColor: theme.isDark ? "#1a1a1a" : "#fafafa",
              shadowColor: theme.isDark ? "#000" : "#333",
            },
          ]}
        >
          <View style={styles.errorInnerContainer}>
            <Ionicons
              name={hasReplacement ? "swap-horizontal" : "alert-circle"}
              size={48}
              color={hasReplacement ? theme.primary : theme.error}
            />
            <Text
              style={[
                styles.errorText,
                { color: hasReplacement ? theme.textColor : theme.error },
              ]}
            >
              {hasReplacement
                ? "Stroke data not available"
                : "Stroke data not available"}
            </Text>
            <Text style={[styles.errorSubtext, { color: theme.textSecondary }]}>
              {character}
            </Text>
            <Text style={[styles.autoSkipText, { color: theme.textSecondary }]}>
              {hasReplacement
                ? "Finding another kanji..."
                : "Skipping automatically..."}
            </Text>
          </View>
        </View>
        {errorCallback && (
          <TouchableOpacity
            style={[styles.skipNowButton, { backgroundColor: theme.primary }]}
            onPress={errorCallback}
          >
            <Ionicons name="arrow-forward" size={18} color="#fff" />
            <Text style={styles.skipButtonText}>
              {hasReplacement ? "Next" : "Skip Now"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const strokeColor = theme.isDark ? "#ffffff" : "#1a1a1a";
  const outlineColor = theme.isDark
    ? "rgba(255,255,255,0.2)"
    : "rgba(0,0,0,0.1)";
  // User drawing stroke should match theme and be visible
  const userStrokeColor = theme.isDark ? "#ffffff" : "#1a1a1a";

  // The library uses a fixed 300x300 canvas, so we scale it to fit our container
  const librarySize = 300;
  const scale = canvasSize / librarySize;

  return (
    <View style={styles.container}>
      {/* Canvas container */}
      <View
        style={[
          styles.canvasContainer,
          {
            width: canvasSize,
            height: canvasSize,
            backgroundColor: theme.isDark ? "#1a1a1a" : "#fafafa",
            shadowColor: theme.isDark ? "#000" : "#333",
            borderWidth: isComplete ? 3 : 0,
            borderColor: isComplete ? "#4caf50" : "transparent",
          },
        ]}
      >
        {/* Custom grid overlay (rendered on top via absolute positioning) */}
        {showGrid && (
          <GridOverlay size={canvasSize} color={gridColor} />
        )}

        {/* Completion overlay */}
        {isComplete && (
          <View style={styles.completionOverlay}>
            <View style={styles.completionBadge}>
              <Ionicons name="checkmark-circle" size={32} color="#4caf50" />
            </View>
          </View>
        )}

        {/* Scale the fixed 300x300 HanziWriter to fit our container */}
        <View
          style={{
            width: librarySize,
            height: librarySize,
            transform: [{ scale }],
            transformOrigin: "top left",
            overflow: "hidden",
            marginTop: -5,
          }}
        >
          <HanziWriter
            writer={writer}
            style={styles.writer}
            // Customize user stroke: thicker line, theme-aware color
            userStrokeProps={{
              stroke: userStrokeColor,
              strokeWidth: 8,
              strokeLinecap: "round",
              strokeLinejoin: "round",
            }}
            loading={
              <View style={styles.loadingInner}>
                <ActivityIndicator size="small" color={theme.primary} />
              </View>
            }
            error={
              <View style={styles.errorInner}>
                <Ionicons name="alert-circle" size={32} color={theme.error} />
              </View>
            }
          >
            <HanziWriter.Svg>
              {showOutline && <HanziWriter.Outline color={outlineColor} />}
              {/* Character component for replay animation (shows when quiz not active and animating) */}
              <HanziWriter.Character color={strokeColor} />
              <HanziWriter.QuizStrokes color={strokeColor} />
              <HanziWriter.QuizMistakeHighlighter
                color="#3b82f6"
                strokeDuration={400}
              />
            </HanziWriter.Svg>
          </HanziWriter>
        </View>
      </View>

      {/* Stroke progress indicator */}
      <View
        style={[
          styles.progressBadge,
          {
            backgroundColor: isComplete
              ? "#4caf50"
              : theme.isDark
                ? "#333"
                : "#fff",
          },
        ]}
      >
        {isComplete ? (
          <Text style={[styles.progressText, { color: "#fff" }]}>
            <Text style={{ fontWeight: "700" }}>Complete!</Text>
          </Text>
        ) : (
          <Text style={[styles.progressText, { color: theme.textColor }]}>
            Stroke{" "}
            <Text style={{ fontWeight: "700" }}>
              {Math.min(strokeNum + 1, totalStrokes)}
            </Text>
            <Text style={{ color: theme.textSecondary }}>/{totalStrokes}</Text>
          </Text>
        )}
        {totalMistakes > 0 && (
          <Text
            style={[
              styles.mistakesText,
              { color: isComplete ? "rgba(255,255,255,0.8)" : theme.error },
            ]}
          >
            {totalMistakes} mistake{totalMistakes !== 1 ? "s" : ""}
          </Text>
        )}
      </View>

      {/* Controls - different for complete vs in-progress */}
      {isComplete ? (
        <View style={styles.completionControls}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              {
                backgroundColor: theme.isDark ? "#2a2a2a" : "#f5f5f5",
                borderColor: theme.border,
              },
            ]}
            onPress={handleReplayAnimation}
            disabled={isAnimating}
          >
            <Ionicons
              name={isAnimating ? "hourglass" : "play"}
              size={20}
              color={isAnimating ? theme.textSecondary : theme.textColor}
            />
            <Text
              style={[
                styles.controlButtonText,
                {
                  color: isAnimating ? theme.textSecondary : theme.textColor,
                },
              ]}
            >
              {isAnimating ? "Playing..." : "Replay"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: "#4caf50" }]}
            onPress={handleNext}
          >
            <Text style={styles.nextButtonText}>Next</Text>
            <Ionicons name="arrow-forward" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.controls}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              {
                backgroundColor: showGrid
                  ? theme.primary
                  : theme.isDark
                    ? "#2a2a2a"
                    : "#f5f5f5",
                borderColor: showGrid ? theme.primary : theme.border,
              },
            ]}
            onPress={handleToggleGrid}
          >
            <Ionicons
              name="grid-outline"
              size={20}
              color={showGrid ? "#fff" : theme.textColor}
            />
            <Text
              style={[
                styles.controlButtonText,
                { color: showGrid ? "#fff" : theme.textColor },
              ]}
            >
              Grid
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              {
                backgroundColor: showOutline
                  ? theme.primary
                  : theme.isDark
                    ? "#2a2a2a"
                    : "#f5f5f5",
                borderColor: showOutline ? theme.primary : theme.border,
              },
            ]}
            onPress={handleToggleOutline}
          >
            <Ionicons
              name={showOutline ? "eye" : "eye-outline"}
              size={20}
              color={showOutline ? "#fff" : theme.textColor}
            />
            <Text
              style={[
                styles.controlButtonText,
                { color: showOutline ? "#fff" : theme.textColor },
              ]}
            >
              Outline
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              {
                backgroundColor: theme.isDark ? "#2a2a2a" : "#f5f5f5",
                borderColor: theme.border,
              },
            ]}
            onPress={handleShowHint}
          >
            <Ionicons name="bulb-outline" size={20} color={theme.textColor} />
            <Text
              style={[styles.controlButtonText, { color: theme.textColor }]}
            >
              Hint
            </Text>
          </TouchableOpacity>

          {onSkip && (
            <TouchableOpacity
              style={[
                styles.controlButton,
                {
                  backgroundColor: theme.isDark ? "#2a2a2a" : "#f5f5f5",
                  borderColor: theme.border,
                },
              ]}
              onPress={onSkip}
            >
              <Ionicons
                name="arrow-forward"
                size={20}
                color={theme.textColor}
              />
              <Text
                style={[styles.controlButtonText, { color: theme.textColor }]}
              >
                Skip
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
  },
  canvasContainer: {
    borderRadius: 16,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    position: "relative",
  },
  writer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
  },
  loadingInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 16,
    padding: 24,
  },
  errorInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: "600",
  },
  errorSubtext: {
    marginTop: 4,
    fontSize: 32,
    fontWeight: "bold",
  },
  errorInnerContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  autoSkipText: {
    marginTop: 16,
    fontSize: 14,
    fontStyle: "italic",
  },
  skipButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  skipNowButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 6,
  },
  skipButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  progressBadge: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressText: {
    fontSize: 14,
  },
  mistakesText: {
    fontSize: 12,
    fontWeight: "500",
  },
  controls: {
    flexDirection: "row",
    marginTop: 16,
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  controlButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  controlButtonText: {
    fontSize: 13,
    fontWeight: "600",
  },
  completionOverlay: {
    position: "absolute",
    top: 8,
    right: 8,
    zIndex: 10,
  },
  completionBadge: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    padding: 4,
  },
  completionControls: {
    flexDirection: "row",
    marginTop: 16,
    gap: 12,
    alignItems: "center",
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  nextButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
