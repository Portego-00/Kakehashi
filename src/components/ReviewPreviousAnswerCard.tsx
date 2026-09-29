import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, useWindowDimensions } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import type { MixedReviewAnswer } from "../types/mixedReviews";
import { useSettingsStore } from "../utils/store";
import { getBestContrastTextColor, useSubjectColors } from "../utils/subjectColors";

/** One persistent preview for the session, independent of the active provider. */
export function ReviewPreviousAnswerCard({ answer }: { answer: MixedReviewAnswer | null }) {
  const router = useRouter();
  const colors = useSubjectColors();
  const animate = useSettingsStore((state) => state.reviewAnimatePreviousQuestion);
  const reducedMotion = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const progress = useSharedValue(1);
  useEffect(() => {
    if (!answer) return;
    progress.value = animate && !reducedMotion ? 0 : 1;
    if (animate && !reducedMotion) progress.value = withTiming(1, { duration: 600 });
  }, [answer, animate, reducedMotion, progress]);
  const animation = useAnimatedStyle(() => ({
    transform: [
      { translateX: (width / 2 - 100) * (1 - progress.value) },
      { translateY: (height / 2 - 150) * (1 - progress.value) },
      { scale: 1 - 0.4 * progress.value },
    ],
  }));
  if (!answer) return null;
  const backgroundColor = answer.source === "bunpro" ? "#cc5b5d"
    : answer.subjectType ? colors.getColorForType(answer.subjectType) : "#555555";
  const color = getBestContrastTextColor(backgroundColor, "#101217", "#ffffff");
  const canOpen = Boolean(answer.subjectId || answer.bunproSubject?.slug);
  return <Animated.View style={[styles.position, animation]}>
    <TouchableOpacity
      accessibilityRole={canOpen ? "button" : "text"}
      accessibilityLabel={`Previous ${answer.source === "bunpro" ? "Bunpro" : "WaniKani"} answer: ${answer.title}, ${answer.correct ? "correct" : "incorrect"}`}
      testID="previous-answer-card"
      disabled={!canOpen}
      style={[styles.card, { backgroundColor }]}
      onPress={() => {
        if (answer.subjectId) router.push({ pathname: "/subject/[id]", params: { id: String(answer.subjectId) } });
        else if (answer.bunproSubject) router.push({ pathname: "/bunpro-reviewable/[kind]/[slug]", params: { kind: answer.bunproSubject.kind, slug: encodeURIComponent(answer.bunproSubject.slug) } });
      }}
    >
      <Text numberOfLines={2} style={[styles.title, { color }]}>{answer.title}</Text>
      <Text style={[styles.verdict, { color }]}>
        <Ionicons name={answer.correct ? "checkmark" : "close"} size={18} /> {answer.correct ? "Correct" : "Incorrect"}
      </Text>
    </TouchableOpacity>
  </Animated.View>;
}
const styles = StyleSheet.create({
  position: { position: "absolute", top: 110, left: -20, width: 180, zIndex: 30 },
  card: { padding: 12, minHeight: 65, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontWeight: "600", textAlign: "center" },
  verdict: { fontSize: 16, fontWeight: "700", marginTop: 4 },
});
