import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "@/src/utils/haptics";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSettingsStore } from "../../utils/store";

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
  const appTextSizeScale = useSettingsStore((state) => state.appTextSizeScale);
  const { fontScale, width: screenWidth } = useWindowDimensions();
  const usesLargeText = appTextSizeScale > 1 || fontScale > 1;
  const totalSlides = children.length;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isInteractiveSlide =
    interactiveSlideIndex !== undefined &&
    currentIndex === interactiveSlideIndex;

  // Start / restart the timer for the current slide
  const startTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    // Larger text may need scrolling and more reading time, so it advances manually.
    if (isInteractiveSlide || usesLargeText) return;

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
  }, [totalSlides, onFinish, isInteractiveSlide, usesLargeText]);

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
    (x: number) => {
      if (x < screenWidth * 0.3) {
        goPrev();
      } else {
        goNext();
      }
    },
    [goPrev, goNext, screenWidth],
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(!isInteractiveSlide)
        .maxDuration(450)
        .maxDistance(12)
        .cancelsTouchesInView(false)
        .runOnJS(true)
        .onEnd((event, success) => {
          if (success) {
            handleTap(event.x);
          }
        }),
    [handleTap, isInteractiveSlide],
  );

  return (
    <View style={styles.container}>
      {/* Slide content */}
      <View style={styles.slideContainer}>
        <GestureDetector gesture={tapGesture}>
          <Animated.View
            key={currentIndex}
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(200)}
            style={styles.slide}
          >
            {children[currentIndex]}
          </Animated.View>
        </GestureDetector>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        {Array.from({ length: totalSlides }, (_, i) => (
          <ProgressSegment
            key={i}
            state={
              i < currentIndex
                ? "completed"
                : i === currentIndex
                  ? isInteractiveSlide || usesLargeText
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
  }, [state, duration, progress]);

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
