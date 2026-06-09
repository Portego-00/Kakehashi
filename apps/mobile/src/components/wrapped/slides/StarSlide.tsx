import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { WrappedSubjectStat } from "../../../hooks/useWrappedData";
import { getSubjectTypeColor } from "../../../utils/subjectColors";
import { RadialGlow } from "../RadialGlow";

interface StarSlideProps {
  starPerformer: WrappedSubjectStat | null;
  fastestToGuru: WrappedSubjectStat | null;
}

export function StarSlide({ starPerformer, fastestToGuru }: StarSlideProps) {
  const starScale = useSharedValue(0.4);
  const starOpacity = useSharedValue(0);
  const shimmer = useSharedValue(0);
  const fastestOpacity = useSharedValue(0);
  const fastestTranslateY = useSharedValue(16);

  const typeColor = starPerformer
    ? starPerformer.subjectType === "radical" ||
      starPerformer.subjectType === "kanji" ||
      starPerformer.subjectType === "vocabulary" ||
      starPerformer.subjectType === "kana_vocabulary"
      ? getSubjectTypeColor(starPerformer.subjectType)
      : getSubjectTypeColor("vocabulary")
    : "#fff";

  // Is star performer a vocab with long text?
  const isStarLong = starPerformer ? starPerformer.characters.length > 2 : false;

  useEffect(() => {
    // Star character scale in with gentle overshoot
    starOpacity.value = withDelay(300, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
    starScale.value = withDelay(
      300,
      withSequence(
        withTiming(1.06, { duration: 500, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.quad) })
      )
    );

    // Shimmer
    shimmer.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1500 }),
          withTiming(0, { duration: 1500 })
        ),
        -1,
        true
      )
    );

    // Fastest to guru — fade + slide
    fastestOpacity.value = withDelay(1400, withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }));
    fastestTranslateY.value = withDelay(1400, withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) }));
  }, []);

  const starStyle = useAnimatedStyle(() => ({
    transform: [{ scale: starScale.value }],
    opacity: starOpacity.value,
  }));

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: 0.2 + shimmer.value * 0.4,
  }));

  const fastestStyle = useAnimatedStyle(() => ({
    opacity: fastestOpacity.value,
    transform: [{ translateY: fastestTranslateY.value }],
  }));

  if (!starPerformer) {
    return (
      <LinearGradient
        colors={["#1a1a0a", "#4a4000", "#6b5b00"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.container}
      >
        <View style={styles.content}>
          <Ionicons name="star" size={40} color="#fbbf24" style={styles.headerIcon} />
          <Text style={styles.headerText}>Keep studying!</Text>
          <Text style={styles.noDataText}>
            Complete more reviews to see your star performers.
          </Text>
        </View>
      </LinearGradient>
    );
  }

  const formatGuruTime = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (days > 0) return `${days}d ${remainingHours}h`;
    return `${hours}h`;
  };

  // Is fastest to guru a vocab with long text?
  const isFastestLong = fastestToGuru ? fastestToGuru.characters.length > 2 : false;

  return (
    <LinearGradient
      colors={["#1a1a0a", "#4a3f00", "#78650c"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Shimmer glow — SVG-based so it doesn't clip */}
      <Animated.View style={[styles.glowOrb, shimmerStyle]}>
        <RadialGlow size={300} color="#fbbf24" intensity={0.55} />
      </Animated.View>

      <View style={styles.content}>
        <Ionicons name="star" size={36} color="#fbbf24" style={styles.headerIcon} />
        <Text style={styles.headerText}>Star performer</Text>

        <Animated.View style={starStyle}>
          <View style={[styles.starCard, { borderColor: typeColor }]}>
            <View
              style={[
                styles.starCharacterBg,
                { backgroundColor: typeColor },
                isStarLong && styles.starCharacterBgWide,
              ]}
            >
              <Text
                style={[
                  styles.starCharacter,
                  isStarLong && styles.starCharacterSmall,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.4}
              >
                {starPerformer.characters}
              </Text>
            </View>

            <Text style={styles.starMeaning}>
              {starPerformer.primaryMeaning}
            </Text>
            {starPerformer.primaryReading && (
              <Text style={styles.starReading}>
                {starPerformer.primaryReading}
              </Text>
            )}

            <View style={styles.streakBadge}>
              <Ionicons name="flame" size={16} color="#fbbf24" />
              <Text style={styles.streakText}>
                {starPerformer.maxStreak} streak
              </Text>
            </View>
          </View>
        </Animated.View>

        {fastestToGuru && fastestToGuru.timeToGuru && (
          <Animated.View style={[styles.fastestCard, fastestStyle]}>
            <Text style={styles.fastestLabel}>Fastest to Guru</Text>
            <View style={styles.fastestRow}>
              <View
                style={[
                  styles.fastestCharBadge,
                  {
                    backgroundColor:
                      fastestToGuru.subjectType === "radical" ||
                      fastestToGuru.subjectType === "kanji" ||
                      fastestToGuru.subjectType === "vocabulary" ||
                      fastestToGuru.subjectType === "kana_vocabulary"
                        ? getSubjectTypeColor(fastestToGuru.subjectType)
                        : getSubjectTypeColor("vocabulary"),
                  },
                  isFastestLong && styles.fastestCharBadgeWide,
                ]}
              >
                <Text
                  style={[
                    styles.fastestChar,
                    isFastestLong && styles.fastestCharSmall,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.4}
                >
                  {fastestToGuru.characters}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.fastestMeaning}>
                  {fastestToGuru.primaryMeaning}
                </Text>
                <View style={styles.fastestTimeRow}>
                  <Ionicons name="flash" size={14} color="rgba(255,255,255,0.6)" />
                  <Text style={styles.fastestTime}>
                    {formatGuruTime(fastestToGuru.timeToGuru)}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}
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
    paddingHorizontal: 24,
    zIndex: 2,
    width: "100%",
    overflow: "visible",
  },
  glowOrb: {
    position: "absolute",
    width: 300,
    height: 300,
    top: "25%",
    alignSelf: "center",
  },
  headerIcon: {
    marginBottom: 8,
  },
  headerText: {
    fontSize: 24,
    fontWeight: "700",
    color: "rgba(255,255,255,0.9)",
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  noDataText: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    marginTop: 16,
  },
  starCard: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 2,
    minWidth: 200,
    marginBottom: 32,
  },
  starCharacterBg: {
    minWidth: 80,
    height: 80,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  starCharacterBgWide: {
    paddingHorizontal: 20,
  },
  starCharacter: {
    fontSize: 40,
    fontWeight: "bold",
    color: "#fff",
  },
  starCharacterSmall: {
    fontSize: 26,
  },
  starMeaning: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 4,
  },
  starReading: {
    fontSize: 16,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
    marginBottom: 12,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(251,191,36,0.2)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 6,
  },
  streakText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fbbf24",
  },
  fastestCard: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    width: "100%",
  },
  fastestLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  fastestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  fastestCharBadge: {
    minWidth: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  fastestCharBadgeWide: {
    paddingHorizontal: 12,
  },
  fastestChar: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
  },
  fastestCharSmall: {
    fontSize: 15,
  },
  fastestMeaning: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
  fastestTimeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  fastestTime: {
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.6)",
  },
});
