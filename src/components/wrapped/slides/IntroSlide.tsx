import * as Haptics from "@/src/utils/haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { RadialGlow } from "../RadialGlow";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Confetti particle component
function ConfettiParticle({ delay, color, startX }: { delay: number; color: string; startX: number }) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(startX);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 200 }));
    translateY.value = withDelay(
      delay,
      withTiming(SCREEN_HEIGHT + 50, {
        duration: 3000 + Math.random() * 2000,
        easing: Easing.out(Easing.quad),
      })
    );
    translateX.value = withDelay(
      delay,
      withTiming(startX + (Math.random() - 0.5) * 120, {
        duration: 3000 + Math.random() * 2000,
      })
    );
    rotate.value = withDelay(
      delay,
      withTiming(360 * (Math.random() > 0.5 ? 1 : -1), { duration: 3000 })
    );
    scale.value = withDelay(
      delay,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.5)) })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: 8,
          height: 8,
          borderRadius: 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

interface IntroSlideProps {
  /** The level the user just completed */
  completedLevel: number;
  /** The new level the user reached */
  newLevel: number;
}

const CONFETTI_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8",
  "#FFD93D", "#C9B1FF", "#FF9FF3", "#54A0FF", "#5F27CD",
];

// Haptic for level knock-in impact
const triggerKnockHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
};

export function IntroSlide({ completedLevel, newLevel }: IntroSlideProps) {
  // --- Old level (visible first, then knocked away) ---
  const oldOpacity = useSharedValue(0);
  const oldScale = useSharedValue(0.5);
  const oldTranslateX = useSharedValue(0);
  const oldRotate = useSharedValue(0);

  // --- New level (slides in from right) ---
  const newOpacity = useSharedValue(0);
  const newScale = useSharedValue(0.6);
  const newTranslateX = useSharedValue(SCREEN_WIDTH * 0.6);
  const hasTriggeredKnock = useSharedValue(false);

  // --- "You reached" header ---
  const headerOpacity = useSharedValue(0);
  const headerTranslateY = useSharedValue(-16);

  // --- Glow ---
  const glowOpacity = useSharedValue(0);

  // --- "Let's see how level X went" ---
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(14);

  useEffect(() => {
    // ─── Phase 1: Old level appears at center (0 – 1.6s) ─────────
    oldOpacity.value = withDelay(
      200,
      withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) })
    );
    oldScale.value = withDelay(
      200,
      withSequence(
        withTiming(1.06, { duration: 500, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 300, easing: Easing.inOut(Easing.quad) })
      )
    );

    // ─── Phase 2: New level knocks old one away (1.6s) ────────────
    // Old level gets knocked to the left with rotation
    oldTranslateX.value = withDelay(
      1600,
      withTiming(-SCREEN_WIDTH * 0.9, {
        duration: 500,
        easing: Easing.in(Easing.cubic),
      })
    );
    oldRotate.value = withDelay(
      1600,
      withTiming(-30, { duration: 500, easing: Easing.in(Easing.cubic) })
    );
    oldOpacity.value = withDelay(
      1900,
      withTiming(0, { duration: 200 })
    );

    // New level swoops in from the right with haptic on impact
    newOpacity.value = withDelay(
      1600,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) })
    );
    newTranslateX.value = withDelay(
      1600,
      withSequence(
        withTiming(
          -8,
          { duration: 450, easing: Easing.out(Easing.cubic) },
          (finished) => {
            // Trigger haptic when new level "lands"
            if (finished && !hasTriggeredKnock.value) {
              hasTriggeredKnock.value = true;
              runOnJS(triggerKnockHaptic)();
            }
          }
        ),
        withTiming(0, { duration: 250, easing: Easing.inOut(Easing.quad) })
      )
    );
    newScale.value = withDelay(
      1600,
      withSequence(
        withTiming(1.1, { duration: 450, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 250, easing: Easing.inOut(Easing.quad) })
      )
    );

    // "You reached" header
    headerOpacity.value = withDelay(
      1800,
      withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) })
    );
    headerTranslateY.value = withDelay(
      1800,
      withTiming(0, { duration: 500, easing: Easing.out(Easing.cubic) })
    );

    // Glow pulses when new level arrives
    glowOpacity.value = withDelay(
      1700,
      withSequence(
        withTiming(1, { duration: 600 }),
        withTiming(0.5, { duration: 800 }),
        withTiming(0.8, { duration: 800 }),
        withTiming(0.5, { duration: 800 })
      )
    );

    // ─── Phase 3: Subtitle (3.8s) ───────────────────────────────
    subtitleOpacity.value = withDelay(
      3800,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) })
    );
    subtitleTranslateY.value = withDelay(
      3800,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  // ── Animated styles ─────────────────────────────────────────────
  const oldLevelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: oldTranslateX.value },
      { rotate: `${oldRotate.value}deg` },
      { scale: oldScale.value },
    ],
    opacity: oldOpacity.value,
  }));

  const newLevelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: newTranslateX.value },
      { scale: newScale.value },
    ],
    opacity: newOpacity.value,
  }));

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));

  // Confetti starts when new level appears
  const confettiParticles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    delay: 1600 + Math.random() * 1000,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    startX: Math.random() * SCREEN_WIDTH,
  }));

  return (
    <LinearGradient
      colors={["#1a0533", "#2d1b69", "#1a0533"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Confetti */}
      <View style={styles.confettiContainer}>
        {confettiParticles.map((p) => (
          <ConfettiParticle key={p.id} delay={p.delay} color={p.color} startX={p.startX} />
        ))}
      </View>

      {/* SVG radial glow behind the number */}
      <Animated.View style={[styles.glowWrap, glowStyle]}>
        <RadialGlow size={360} color="#7c3aed" intensity={0.55} />
      </Animated.View>

      {/* Content */}
      <View style={styles.content}>
        <Animated.Text style={[styles.headerText, headerStyle]}>
          You reached
        </Animated.Text>

        {/* Level number area */}
        <View style={styles.levelArea}>
          {/* Old level (gets knocked off) */}
          <Animated.View style={[styles.levelCenter, oldLevelStyle]}>
            <Text style={styles.levelLabel}>LEVEL</Text>
            <Text style={styles.oldLevelNumber}>{completedLevel}</Text>
          </Animated.View>

          {/* New level (slides in) */}
          <Animated.View style={[styles.levelCenter, styles.levelAbsolute, newLevelStyle]}>
            <Text style={styles.levelLabel}>LEVEL</Text>
            <Text style={styles.newLevelNumber}>{newLevel}</Text>
          </Animated.View>
        </View>

        <Animated.Text style={[styles.subtitleText, subtitleStyle]}>
          {"But first, let's see how Level "}
          {completedLevel}
          {" went"}
        </Animated.Text>
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
  confettiContainer: {
    ...StyleSheet.absoluteFill,
    overflow: "hidden",
  },
  glowWrap: {
    position: "absolute",
    width: 360,
    height: 360,
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    alignItems: "center",
    zIndex: 5,
    paddingHorizontal: 24,
  },
  headerText: {
    fontSize: 22,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 16,
  },
  levelArea: {
    width: 220,
    height: 160,
    justifyContent: "center",
    alignItems: "center",
  },
  levelCenter: {
    alignItems: "center",
  },
  levelAbsolute: {
    position: "absolute",
  },
  levelLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 8,
    textAlign: "center",
    marginBottom: 4,
  },
  oldLevelNumber: {
    fontSize: 120,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    lineHeight: 130,
  },
  newLevelNumber: {
    fontSize: 120,
    fontWeight: "900",
    color: "#fff",
    textAlign: "center",
    lineHeight: 130,
  },
  subtitleText: {
    fontSize: 17,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    marginTop: 24,
    letterSpacing: 0.5,
    textAlign: "center",
  },
});
