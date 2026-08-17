import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTheme } from "../utils/theme";

const RESULTS_REVEAL_DELAY_MS = 700;

export function useExtraStudyResultsReveal(isComplete: boolean): boolean {
  const [resultsReady, setResultsReady] = useState(false);

  useEffect(() => {
    if (!isComplete) {
      setResultsReady(false);
      return;
    }

    const timer = setTimeout(() => {
      setResultsReady(true);
    }, RESULTS_REVEAL_DELAY_MS);

    return () => clearTimeout(timer);
  }, [isComplete]);

  return isComplete && resultsReady;
}

export default function ExtraStudyCompletionTransition() {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.82)).current;
  const translateY = useRef(new Animated.Value(12)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        damping: 12,
        stiffness: 170,
        mass: 0.7,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale, translateY]);

  return (
    <View
      accessible
      accessibilityLabel="Session complete. Preparing your results."
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <Animated.View
        style={[
          styles.content,
          {
            opacity,
            transform: [{ scale }, { translateY }],
          },
        ]}
      >
        <View style={[styles.checkCircle, { backgroundColor: theme.primary }]}>
          <Ionicons name="checkmark" size={48} color="#ffffff" />
        </View>
        <Text style={[styles.title, { color: theme.textColor }]}>Complete!</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Preparing your results…
        </Text>
        <ActivityIndicator
          accessibilityElementsHidden
          color={theme.primary}
          size="small"
          style={styles.spinner}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  content: {
    alignItems: "center",
  },
  checkCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 6,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 23,
    marginTop: 8,
    textAlign: "center",
  },
  spinner: {
    marginTop: 22,
  },
});
