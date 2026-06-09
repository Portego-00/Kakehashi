import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING_SIZE = 180;
const STROKE_WIDTH = 14;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface AccuracySlideProps {
  overallAccuracy: number;
  meaningAccuracy: number;
  readingAccuracy: number;
}

function AccuracyRing({ percentage }: { percentage: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      500,
      withTiming(percentage / 100, {
        duration: 1500,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, []);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  return (
    <Svg width={RING_SIZE} height={RING_SIZE}>
      {/* Background circle */}
      <Circle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RADIUS}
        stroke="rgba(255,255,255,0.12)"
        strokeWidth={STROKE_WIDTH}
        fill="none"
      />
      {/* Animated progress circle */}
      <AnimatedCircle
        cx={RING_SIZE / 2}
        cy={RING_SIZE / 2}
        r={RADIUS}
        stroke="#10b981"
        strokeWidth={STROKE_WIDTH}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        animatedProps={animatedProps}
        rotation="-90"
        origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
      />
    </Svg>
  );
}

function AccuracyBar({
  label,
  percentage,
  color,
  delay,
}: {
  label: string;
  percentage: number;
  color: string;
  delay: number;
}) {
  const width = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }));
    width.value = withDelay(
      delay,
      withTiming(percentage, {
        duration: 1200,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, []);

  const barStyle = useAnimatedStyle(() => ({
    width: `${width.value}%`,
  }));

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.barContainer, containerStyle]}>
      <View style={styles.barLabelRow}>
        <Text style={styles.barLabel}>{label}</Text>
        <Text style={styles.barValue}>{percentage}%</Text>
      </View>
      <View style={styles.barTrack}>
        <Animated.View
          style={[styles.barFill, { backgroundColor: color }, barStyle]}
        />
      </View>
    </Animated.View>
  );
}

export function AccuracySlide({
  overallAccuracy,
  meaningAccuracy,
  readingAccuracy,
}: AccuracySlideProps) {
  const percentageScale = useSharedValue(0.5);
  const percentageOpacity = useSharedValue(0);

  useEffect(() => {
    percentageOpacity.value = withDelay(800, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    percentageScale.value = withDelay(
      800,
      withSequence(
        withTiming(1.05, { duration: 400, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 250, easing: Easing.inOut(Easing.quad) })
      )
    );
  }, []);

  const percentageStyle = useAnimatedStyle(() => ({
    transform: [{ scale: percentageScale.value }],
    opacity: percentageOpacity.value,
  }));

  return (
    <LinearGradient
      colors={["#064e3b", "#065f46", "#047857"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.headerText}>Your accuracy</Text>

        <View style={styles.ringContainer}>
          <AccuracyRing percentage={overallAccuracy} />
          <Animated.View style={[styles.ringCenter, percentageStyle]}>
            <Text style={styles.ringPercentage}>{overallAccuracy}%</Text>
          </Animated.View>
        </View>

        <View style={styles.barsContainer}>
          <AccuracyBar
            label="Meaning"
            percentage={meaningAccuracy}
            color="#34d399"
            delay={1200}
          />
          <AccuracyBar
            label="Reading"
            percentage={readingAccuracy}
            color="#6ee7b7"
            delay={1500}
          />
        </View>

        {overallAccuracy >= 90 && (
          <AnimatedBadge delay={2000} text="Outstanding!" />
        )}
        {overallAccuracy >= 80 && overallAccuracy < 90 && (
          <AnimatedBadge delay={2000} text="Great work!" />
        )}
        {overallAccuracy < 80 && (
          <AnimatedBadge delay={2000} text="Keep going!" />
        )}
      </View>
    </LinearGradient>
  );
}

function AnimatedBadge({ delay, text }: { delay: number; text: string }) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.badge, style]}>
      <Text style={styles.badgeText}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    paddingHorizontal: 28,
    width: "100%",
    overflow: "visible",
  },
  headerText: {
    fontSize: 24,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
    marginBottom: 32,
    letterSpacing: 1,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },
  ringCenter: {
    position: "absolute",
    justifyContent: "center",
    alignItems: "center",
  },
  ringPercentage: {
    fontSize: 48,
    fontWeight: "900",
    color: "#fff",
    overflow: "visible",
  },
  barsContainer: {
    width: "100%",
    gap: 24,
    marginBottom: 36,
  },
  barContainer: {
    width: "100%",
  },
  barLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  barLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
  },
  barValue: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  barTrack: {
    height: 16,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 8,
  },
  badge: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  badgeText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 1,
  },
});
