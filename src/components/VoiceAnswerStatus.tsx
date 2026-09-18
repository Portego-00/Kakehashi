import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
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

export function VoiceAnswerStatus({ listening, finalizing, transcript, error, level }: {
  listening: boolean;
  finalizing: boolean;
  transcript: string;
  error: string | null;
  level: SharedValue<number>;
}) {
  const { theme } = useTheme();
  const reducedMotion = useReducedMotion();
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (listening && !finalizing && !error && !reducedMotion) {
      pulse.value = withRepeat(withSequence(
        withTiming(1, { duration: 700 }),
        withTiming(0, { duration: 700 }),
      ), -1);
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
    return () => cancelAnimation(pulse);
  }, [error, finalizing, listening, pulse, reducedMotion]);

  const status = error ? "Try again" : finalizing ? "Recognizing…" : listening ? "Listening…" : "Voice answer";
  return (
    <View style={[styles.container, { backgroundColor: theme.cardBackground, borderColor: theme.border }]}>
      <View style={styles.indicator} accessible={false} accessibilityElementsHidden>
        {error ? <Ionicons name="alert-circle-outline" size={20} color={theme.error} />
          : finalizing ? <ActivityIndicator size="small" color={theme.primary} />
            : [10, 17, 24, 17, 10].map((height, index) => (
              <VoiceBar key={index} height={height} color={theme.primary} level={level} pulse={pulse} reducedMotion={reducedMotion} />
            ))}
      </View>
      <View style={styles.content}>
        <Text style={[styles.status, { color: error ? theme.error : theme.textSecondary }]}>{status}</Text>
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
