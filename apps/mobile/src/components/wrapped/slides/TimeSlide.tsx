import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/src/utils/haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { RadialGlow } from "../RadialGlow";

interface TimeSlideProps {
  timeDays: number;
  timeHours: number;
  comparedToAverageDays: number;
  isFasterThanAverage: boolean;
}

// Haptic for counter pop
const triggerCounterHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
};

function AnimatedCounter({ value, delay, suffix }: { value: number; delay: number; suffix: string }) {
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);
  const hasTriggered = useSharedValue(false);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    scale.value = withDelay(
      delay,
      withTiming(
        1,
        { duration: 600, easing: Easing.out(Easing.back(1.3)) },
        (finished) => {
          if (finished && !hasTriggered.value) {
            hasTriggered.value = true;
            runOnJS(triggerCounterHaptic)();
          }
        }
      )
    );
    translateY.value = withDelay(delay, withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.counterContainer, style]}>
      {/* SVG glow behind the number */}
      <View style={styles.counterGlowWrap}>
        <RadialGlow size={160} color="#3b82f6" intensity={0.4} />
      </View>
      <Text style={styles.counterValue}>{value}</Text>
      <Text style={styles.counterSuffix}>{suffix}</Text>
    </Animated.View>
  );
}

export function TimeSlide({
  timeDays,
  timeHours,
  comparedToAverageDays,
  isFasterThanAverage,
}: TimeSlideProps) {
  const comparisonOpacity = useSharedValue(0);
  const comparisonTranslateY = useSharedValue(16);

  useEffect(() => {
    comparisonOpacity.value = withDelay(
      1200,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) })
    );
    comparisonTranslateY.value = withDelay(
      1200,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const comparisonStyle = useAnimatedStyle(() => ({
    opacity: comparisonOpacity.value,
    transform: [{ translateY: comparisonTranslateY.value }],
  }));

  const comparisonText =
    comparedToAverageDays === 0
      ? "Right on your average pace!"
      : isFasterThanAverage
      ? `${comparedToAverageDays} day${comparedToAverageDays === 1 ? "" : "s"} faster than your average`
      : `${comparedToAverageDays} day${comparedToAverageDays === 1 ? "" : "s"} slower than your average`;

  const iconName: keyof typeof Ionicons.glyphMap =
    comparedToAverageDays === 0
      ? "timer-outline"
      : isFasterThanAverage
      ? "flash-outline"
      : "hourglass-outline";

  const iconColor =
    comparedToAverageDays === 0
      ? "rgba(255,255,255,0.7)"
      : isFasterThanAverage
      ? "#fbbf24"
      : "#f97316";

  return (
    <LinearGradient
      colors={["#0f172a", "#1e3a5f", "#0c4a6e"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.headerText}>It took you</Text>

        <View style={styles.timeRow}>
          <AnimatedCounter value={timeDays} delay={400} suffix="days" />
          <AnimatedCounter value={timeHours} delay={700} suffix="hours" />
        </View>

        <Text style={styles.toCompleteText}>to complete this level</Text>

        <Animated.View style={[styles.comparisonCard, comparisonStyle]}>
          <Ionicons name={iconName} size={28} color={iconColor} style={styles.comparisonIcon} />
          <Text style={styles.comparisonText}>{comparisonText}</Text>
        </Animated.View>
      </View>
    </LinearGradient>
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
    paddingHorizontal: 32,
  },
  headerText: {
    fontSize: 24,
    fontWeight: "600",
    color: "rgba(255,255,255,0.8)",
    marginBottom: 32,
    letterSpacing: 1,
  },
  timeRow: {
    flexDirection: "row",
    gap: 32,
    marginBottom: 24,
  },
  counterContainer: {
    alignItems: "center",
  },
  counterGlowWrap: {
    position: "absolute",
    top: -40,
    left: -40,
    width: 160,
    height: 160,
  },
  counterValue: {
    fontSize: 72,
    fontWeight: "900",
    color: "#fff",
  },
  counterSuffix: {
    fontSize: 16,
    fontWeight: "700",
    color: "rgba(255,255,255,0.6)",
    textTransform: "uppercase",
    letterSpacing: 3,
    marginTop: -4,
  },
  toCompleteText: {
    fontSize: 18,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
    marginBottom: 48,
  },
  comparisonCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  comparisonIcon: {
    marginBottom: 8,
  },
  comparisonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
  },
});
