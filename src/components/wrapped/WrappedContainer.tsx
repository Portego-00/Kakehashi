import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/src/utils/haptics";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  GestureResponderEvent,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Auto-advance time per slide in ms
const SLIDE_DURATION = 8000;

interface WrappedContainerProps {
  children: React.ReactNode[];
  onClose: () => void;
  onFinish?: () => void;
  /** Index of the last slide where tap-to-advance is disabled and content is interactive (e.g. share button) */
  interactiveSlideIndex?: number;
}

export function WrappedContainer({
  children,
  onClose,
  onFinish,
  interactiveSlideIndex,
}: WrappedContainerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const totalSlides = children.length;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isInteractiveSlide = interactiveSlideIndex !== undefined && currentIndex === interactiveSlideIndex;

  // Start / restart the timer for the current slide
  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // Don't auto-advance on interactive slides
    if (isInteractiveSlide) return;

    timerRef.current = setTimeout(() => {
      setCurrentIndex((prev) => {
        if (prev >= totalSlides - 1) {
          onFinish?.();
          return prev;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        return prev + 1;
      });
    }, SLIDE_DURATION);
  }, [currentIndex, totalSlides, onFinish, isInteractiveSlide]);

  useEffect(() => {
    startTimer();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, startTimer]);

  const goNext = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentIndex((prev) => {
      if (prev >= totalSlides - 1) {
        onFinish?.();
        return prev;
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return prev + 1;
    });
  }, [totalSlides, onFinish]);

  const goPrev = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCurrentIndex((prev) => {
      if (prev <= 0) return 0;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return prev - 1;
    });
  }, []);

  const handleTap = useCallback(
    (e: GestureResponderEvent) => {
      const x = e.nativeEvent.locationX;
      if (x < SCREEN_WIDTH * 0.3) {
        goPrev();
      } else {
        goNext();
      }
    },
    [goPrev, goNext]
  );

  return (
    <View style={styles.container}>
      {/* Slide content */}
      <View style={styles.slideContainer}>
        <Animated.View
          key={currentIndex}
          entering={FadeIn.duration(400)}
          exiting={FadeOut.duration(200)}
          style={styles.slide}
        >
          {children[currentIndex]}
        </Animated.View>
      </View>

      {/* Touch zones — hidden on interactive slides so buttons are tappable */}
      {!isInteractiveSlide && (
        <View style={styles.touchLayer} onStartShouldSetResponder={() => true}>
          <View
            style={styles.touchZone}
            onStartShouldSetResponder={() => true}
            onResponderRelease={handleTap}
          />
        </View>
      )}

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        {Array.from({ length: totalSlides }, (_, i) => (
          <ProgressSegment
            key={i}
            state={
              i < currentIndex
                ? "completed"
                : i === currentIndex
                ? isInteractiveSlide
                  ? "completed"
                  : "active"
                : "inactive"
            }
            duration={SLIDE_DURATION}
          />
        ))}
      </View>

      {/* Close button */}
      <TouchableOpacity
        style={styles.closeButton}
        onPress={() => {
          if (timerRef.current) clearTimeout(timerRef.current);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          onClose();
        }}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons name="close" size={28} color="rgba(255,255,255,0.9)" />
      </TouchableOpacity>
    </View>
  );
}

/** A single segment of the progress bar */
function ProgressSegment({
  state,
  duration,
}: {
  state: "completed" | "active" | "inactive";
  duration: number;
}) {
  const progress = useSharedValue(state === "completed" ? 1 : 0);

  useEffect(() => {
    if (state === "completed") {
      progress.value = 1;
    } else if (state === "active") {
      progress.value = 0;
      progress.value = withTiming(1, { duration });
    } else {
      progress.value = 0;
    }
  }, [state, duration]);

  const animatedStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <View style={styles.progressSegmentTrack}>
      <Animated.View style={[styles.progressSegmentFill, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  slideContainer: {
    flex: 1,
  },
  slide: {
    flex: 1,
  },
  touchLayer: {
    ...StyleSheet.absoluteFill,
    zIndex: 10,
  },
  touchZone: {
    flex: 1,
  },
  progressBarContainer: {
    position: "absolute",
    top: 58,
    left: 16,
    right: 16,
    flexDirection: "row",
    gap: 4,
    zIndex: 20,
  },
  progressSegmentTrack: {
    flex: 1,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
  },
  progressSegmentFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 1.5,
  },
  closeButton: {
    position: "absolute",
    top: 70,
    right: 16,
    zIndex: 30,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
});
