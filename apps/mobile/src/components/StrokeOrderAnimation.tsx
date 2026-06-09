import { Ionicons } from "@expo/vector-icons";
import {
  HanziWriter,
  useHanziWriter,
} from "@jamsch/react-native-hanzi-writer";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Svg, { Line } from "react-native-svg";
import { loadKanjiWriterData } from "../utils/kanjiWriterDataLoader";
import { useSubjectColors, withAlpha } from "../utils/subjectColors";
import { useTheme } from "../utils/theme";

interface StrokeOrderAnimationProps {
  character: string;
  /** Called when user wants to practice writing this kanji */
  onPractice?: () => void;
}

// Speed options with different durations
const SPEED_OPTIONS = [
  { label: "0.5x", strokeDuration: 1000, delayBetweenStrokes: 800 },
  { label: "1x", strokeDuration: 500, delayBetweenStrokes: 400 },
  { label: "2x", strokeDuration: 250, delayBetweenStrokes: 200 },
] as const;

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

export default function StrokeOrderAnimation({
  character,
  onPractice,
}: StrokeOrderAnimationProps) {
  const { theme } = useTheme();
  const subjectColors = useSubjectColors();
  const { width: screenWidth } = useWindowDimensions();
  const svgSize = Math.min(screenWidth - 64, 320);

  const [speedIndex, setSpeedIndex] = useState(1); // Default to 1x speed
  const [totalStrokes, setTotalStrokes] = useState(0);

  const writer = useHanziWriter({
    character,
    loader: loadKanjiWriterData,
  });

  // Track animation state from the writer
  const animatorState = writer.animator.useStore((s) => s.state);
  const isPlaying = animatorState === "playing";

  // Get total strokes when character loads
  useEffect(() => {
    if (writer.characterState.status === "resolved") {
      const charData = writer.characterState.data;
      setTotalStrokes(charData.strokes.length);
    }
  }, [writer.characterState.status, writer.characterState]);

  const handlePlay = useCallback(() => {
    if (writer.characterState.status !== "resolved") return;

    const speed = SPEED_OPTIONS[speedIndex];
    writer.animator.animateCharacter({
      strokeDuration: speed.strokeDuration,
      delayBetweenStrokes: speed.delayBetweenStrokes,
    });
  }, [writer.characterState.status, writer.animator, speedIndex]);

  const handleStop = useCallback(() => {
    writer.animator.cancelAnimation();
  }, [writer.animator]);

  const cycleSpeed = useCallback(() => {
    setSpeedIndex((prev) => (prev + 1) % SPEED_OPTIONS.length);
  }, []);

  const gridColor = theme.isDark
    ? "rgba(255,255,255,0.15)"
    : "rgba(0,0,0,0.1)";

  // Loading state
  if (writer.characterState.status === "pending") {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading stroke order...
        </Text>
      </View>
    );
  }

  // Error state
  if (writer.characterState.status === "rejected") {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="alert-circle" size={48} color={theme.textSecondary} />
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>
          Stroke order data not available for this kanji
        </Text>
      </View>
    );
  }

  const strokeColor = theme.isDark ? "#ffffff" : "#1a1a1a";
  const outlineColor = theme.isDark
    ? "rgba(255,255,255,0.2)"
    : "rgba(0,0,0,0.1)";

  // The library uses a fixed 300x300 canvas, so we scale it to fit our container
  const librarySize = 300;
  const scale = svgSize / librarySize;

  return (
    <View style={styles.container}>
      {/* SVG Display */}
      <View
        style={[
          styles.svgWrapper,
          {
            width: svgSize,
            height: svgSize,
          },
        ]}
      >
        <View
          style={[
            styles.svgContainer,
            {
              backgroundColor: theme.isDark ? "#1a1a1a" : "#fafafa",
              shadowColor: theme.isDark ? "#000" : "#333",
            },
          ]}
        >
          {/* Custom grid overlay */}
          <GridOverlay size={svgSize} color={gridColor} />

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
                <HanziWriter.Outline color={outlineColor} />
                <HanziWriter.Character color={strokeColor} />
              </HanziWriter.Svg>
            </HanziWriter>
          </View>
        </View>

        {/* Stroke counter badge */}
        <View
          style={[
            styles.strokeBadge,
            { backgroundColor: theme.isDark ? "#333" : "#fff" },
          ]}
        >
          <Text style={[styles.strokeBadgeText, { color: theme.textColor }]}>
            {totalStrokes}
            <Text style={{ color: theme.textSecondary }}> strokes</Text>
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsWrapper}>
        {/* Main playback controls */}
        <View style={styles.mainControls}>
          <TouchableOpacity
            style={[
              styles.speedButton,
              {
                backgroundColor: theme.isDark ? "#2a2a2a" : "#ffffff",
                borderColor: theme.isDark ? "#444" : "#ddd",
              },
            ]}
            onPress={cycleSpeed}
            activeOpacity={0.7}
          >
            <Ionicons name="speedometer" size={18} color={theme.primary} />
            <Text
              style={[styles.speedButtonText, { color: theme.textColor }]}
            >
              {SPEED_OPTIONS[speedIndex].label}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.playButton,
              {
                backgroundColor: subjectColors.kanji,
                shadowColor: subjectColors.kanji,
                borderColor: withAlpha(subjectColors.kanji, 0.3),
              },
            ]}
            onPress={isPlaying ? handleStop : handlePlay}
            activeOpacity={0.8}
          >
            <Ionicons
              name={isPlaying ? "stop" : "play"}
              size={32}
              color="#ffffff"
              style={!isPlaying ? { marginLeft: 4 } : undefined}
            />
          </TouchableOpacity>

          <View style={styles.spacer} />
        </View>

        {/* Practice Writing Button */}
        {onPractice && (
          <TouchableOpacity
            style={[
              styles.practiceButton,
              {
                backgroundColor: theme.isDark ? "#2a2a2a" : "#ffffff",
                borderColor: theme.isDark ? "#444" : "#ddd",
              },
            ]}
            onPress={onPractice}
            activeOpacity={0.7}
          >
            <Ionicons name="brush-outline" size={18} color={theme.primary} />
            <Text style={[styles.practiceButtonText, { color: theme.textColor }]}>
              Practice Writing
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 8,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 60,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    justifyContent: "center",
    alignItems: "center",
    padding: 60,
  },
  errorText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: "center",
  },
  svgWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  svgContainer: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    // Use border on Android instead of elevation to avoid jarring shadow during tab animations
    ...Platform.select({
      ios: { elevation: 8 },
      android: { borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
    }),
  },
  writer: {
    flex: 1,
  },
  loadingInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  errorInner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  strokeBadge: {
    position: "absolute",
    bottom: -12,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    ...Platform.select({
      ios: { elevation: 4 },
      android: { borderWidth: 1, borderColor: "rgba(0,0,0,0.1)" },
    }),
  },
  strokeBadgeText: {
    fontSize: 16,
    fontWeight: "700",
  },
  controlsWrapper: {
    marginTop: 28,
    alignItems: "center",
    width: "100%",
  },
  mainControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "transparent",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    ...Platform.select({
      ios: { elevation: 6 },
      android: { borderWidth: 1, borderColor: "transparent" },
    }),
  },
  speedButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    minWidth: 90,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    ...Platform.select({
      ios: { elevation: 2 },
      android: {},
    }),
  },
  speedButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
  spacer: {
    width: 90,
  },
  practiceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    ...Platform.select({
      ios: { elevation: 2 },
      android: {},
    }),
  },
  practiceButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
