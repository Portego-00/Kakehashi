import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  cancelAnimation,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../utils/theme";

function VoiceBar({ level, pulse, height, color, reducedMotion }: {
  level: SharedValue<number>;
  pulse: SharedValue<number>;
  height: number;
  color: string;
  reducedMotion: boolean;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: reducedMotion ? 0.65 : 0.25 + level.value * 0.65 + pulse.value * 0.1 }],
    opacity: reducedMotion ? 1 : 0.6 + level.value * 0.3 + pulse.value * 0.1,
  }));
  return <Animated.View style={[styles.bar, { height, backgroundColor: color }, animatedStyle]} />;
}

export function VoiceAnswerStatus({ listening, paused, transcript, error, level }: {
  listening: boolean;
  paused: boolean;
  transcript: string;
  error: string | null;
  level: SharedValue<number>;
}) {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (listening && !error && !reducedMotion) {
      pulse.value = withRepeat(withSequence(
        withTiming(1, { duration: 700 }),
        withTiming(0, { duration: 700 }),
      ), -1);
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
  }, [error, listening, pulse, reducedMotion]);

  return (
    <View style={[styles.container, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
      <View style={styles.indicator} accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {error ? <Ionicons name="alert-circle-outline" size={20} color={theme.error} />
          : paused ? <Ionicons name="mic-off-outline" size={20} color={theme.textSecondary} />
          : [10, 17, 24, 17, 10].map((height, index) => (
            <VoiceBar key={index} height={height} color={theme.primary} level={level} pulse={pulse} reducedMotion={reducedMotion} />
          ))}
      </View>
      <View style={styles.content}>
        <Text style={[styles.status, { color: error ? theme.error : theme.textSecondary }]}>
          {error ? "Try again" : paused ? "Mic paused" : listening ? "Listening…" : "Mic on"}
        </Text>
        {!!(transcript || error) && (
          <Text style={[styles.transcript, { color: theme.textColor }]} numberOfLines={3}>
            {[transcript, error].filter(Boolean).join(" — ")}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 8, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth },
  indicator: { width: 32, height: 28, flexDirection: "row", gap: 3, alignItems: "center", justifyContent: "center" },
  bar: { width: 3, borderRadius: 2 },
  content: { flex: 1, gap: 3 },
  status: { fontSize: 12, fontWeight: "500" },
  transcript: { fontSize: 16, lineHeight: 22 },
});
