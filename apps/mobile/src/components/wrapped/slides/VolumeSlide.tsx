import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSubjectColors } from "../../../utils/subjectColors";
import { RadialGlow } from "../RadialGlow";

interface VolumeSlideProps {
  totalSubjects: number;
  radicalCount: number;
  kanjiCount: number;
  vocabCount: number;
  totalReviews: number;
}

/* ──── Animated proportional bar segment ──── */
function BarSegment({
  color,
  targetWidth,
  delay,
}: {
  color: string;
  targetWidth: number;
  delay: number;
}) {
  const animWidth = useSharedValue(0);

  useEffect(() => {
    animWidth.value = withDelay(
      delay,
      withTiming(targetWidth, {
        duration: 700,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [targetWidth]);

  const style = useAnimatedStyle(() => ({
    width: animWidth.value,
  }));

  return (
    <Animated.View
      style={[styles.barSegment, { backgroundColor: color }, style]}
    />
  );
}

/* ──── Breakdown legend item ──── */
function LegendItem({
  color,
  count,
  label,
  delay,
}: {
  color: string;
  count: number;
  label: string;
  delay: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) })
    );
    translateY.value = withDelay(
      delay,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.legendItem, style]}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={[styles.legendCount, { color }]}>{count}</Text>
      <Text style={styles.legendLabel}>{label}</Text>
    </Animated.View>
  );
}

/* ──────────────────────────────────────────────────────────── */

export function VolumeSlide({
  totalSubjects,
  radicalCount,
  kanjiCount,
  vocabCount,
  totalReviews,
}: VolumeSlideProps) {
  const subjectColors = useSubjectColors();
  /* Track measured bar width */
  const [barWidth, setBarWidth] = useState(0);

  const onBarLayout = (event: LayoutChangeEvent) => {
    setBarWidth(event.nativeEvent.layout.width);
  };

  /* Animations */
  const headerOpacity = useSharedValue(0);
  const headerTranslateY = useSharedValue(-12);

  const totalScale = useSharedValue(0.4);
  const totalOpacity = useSharedValue(0);

  const subtitleOpacity = useSharedValue(0);

  const reviewsOpacity = useSharedValue(0);
  const reviewsTranslateY = useSharedValue(14);

  /* Calculate target widths for each segment based on measured bar width */
  const segmentWidths = useMemo(() => {
    const sum = radicalCount + kanjiCount + vocabCount;
    if (sum === 0 || barWidth === 0) return { rad: 0, kan: 0, voc: 0 };

    // Calculate number of visible segments for gap calculation
    const visibleSegments = [radicalCount, kanjiCount, vocabCount].filter(c => c > 0).length;
    const totalGaps = (visibleSegments - 1) * 3; // 3px gap between segments
    const availableWidth = barWidth - totalGaps;

    // Calculate proportional widths
    return {
      rad: radicalCount > 0 ? (radicalCount / sum) * availableWidth : 0,
      kan: kanjiCount > 0 ? (kanjiCount / sum) * availableWidth : 0,
      voc: vocabCount > 0 ? (vocabCount / sum) * availableWidth : 0,
    };
  }, [radicalCount, kanjiCount, vocabCount, barWidth]);

  useEffect(() => {
    // Header: "You learned"
    headerOpacity.value = withDelay(
      200,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) })
    );
    headerTranslateY.value = withDelay(
      200,
      withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) })
    );

    // Big number
    totalOpacity.value = withDelay(
      500,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) })
    );
    totalScale.value = withDelay(
      500,
      withSequence(
        withTiming(1.06, {
          duration: 500,
          easing: Easing.out(Easing.cubic),
        }),
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.quad) })
      )
    );

    // "subjects to Guru"
    subtitleOpacity.value = withDelay(
      900,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) })
    );

    // Reviews footer
    reviewsOpacity.value = withDelay(
      2000,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) })
    );
    reviewsTranslateY.value = withDelay(
      2000,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const totalStyle = useAnimatedStyle(() => ({
    transform: [{ scale: totalScale.value }],
    opacity: totalOpacity.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const reviewsStyle = useAnimatedStyle(() => ({
    opacity: reviewsOpacity.value,
    transform: [{ translateY: reviewsTranslateY.value }],
  }));

  return (
    <LinearGradient
      colors={["#1a0a2e", "#3d1f6d", "#6b21a8"]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Header */}
        <Animated.Text style={[styles.headerText, headerStyle]}>
          You learned
        </Animated.Text>

        {/* Big number */}
        <Animated.View style={[styles.totalWrap, totalStyle]}>
          <View style={styles.totalGlowWrap}>
            <RadialGlow
              size={240}
              color={subjectColors.vocabulary}
              intensity={0.45}
            />
          </View>
          <Text style={styles.totalNumber}>{totalSubjects}</Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.Text style={[styles.subtitleText, subtitleStyle]}>
          subjects to Guru
        </Animated.Text>

        {/* Proportional breakdown bar */}
        <View style={styles.barContainer}>
          <View style={styles.barTrack} onLayout={onBarLayout}>
            {segmentWidths.rad > 0 && (
              <BarSegment
                color={subjectColors.radical}
                targetWidth={segmentWidths.rad}
                delay={1200}
              />
            )}
            {segmentWidths.kan > 0 && (
              <BarSegment
                color={subjectColors.kanji}
                targetWidth={segmentWidths.kan}
                delay={1350}
              />
            )}
            {segmentWidths.voc > 0 && (
              <BarSegment
                color={subjectColors.vocabulary}
                targetWidth={segmentWidths.voc}
                delay={1500}
              />
            )}
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          <LegendItem
            color={subjectColors.radical}
            count={radicalCount}
            label="Radicals"
            delay={1500}
          />
          <LegendItem
            color={subjectColors.kanji}
            count={kanjiCount}
            label="Kanji"
            delay={1600}
          />
          <LegendItem
            color={subjectColors.vocabulary}
            count={vocabCount}
            label="Vocab"
            delay={1700}
          />
        </View>

        {/* Reviews */}
        <Animated.View style={[styles.reviewsRow, reviewsStyle]}>
          <Text style={styles.reviewsNumber}>
            {totalReviews.toLocaleString()}
          </Text>
          <Text style={styles.reviewsLabel}>reviews along the way</Text>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

/* ──── Styles ──── */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 32,
    width: "100%",
    overflow: "visible",
  },

  /* Header */
  headerText: {
    fontSize: 20,
    fontWeight: "600",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 1,
    marginBottom: 8,
  },

  /* Hero number */
  totalWrap: {
    alignItems: "center",
    marginBottom: 4,
  },
  totalGlowWrap: {
    position: "absolute",
    top: -60,
    width: 240,
    height: 240,
  },
  totalNumber: {
    fontSize: 108,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    lineHeight: 118,
  },

  /* Subtitle */
  subtitleText: {
    fontSize: 18,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 4,
    textAlign: "center",
    marginBottom: 40,
  },

  /* Proportional bar */
  barContainer: {
    width: "100%",
    marginBottom: 16,
  },
  barTrack: {
    flexDirection: "row",
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.08)",
    gap: 3,
  },
  barSegment: {
    height: 10,
    borderRadius: 5,
  },

  /* Legend */
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginBottom: 40,
  },
  legendItem: {
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendCount: {
    fontSize: 22,
    fontWeight: "800",
  },
  legendLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  /* Reviews */
  reviewsRow: {
    alignItems: "center",
    gap: 4,
  },
  reviewsNumber: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
  },
  reviewsLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
    letterSpacing: 0.5,
  },
});
