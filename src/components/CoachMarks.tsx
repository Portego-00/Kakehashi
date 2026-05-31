import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import {
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../utils/theme";

export interface CoachMarkStep {
  /** Unique identifier for the step */
  id: string;
  /** Target element measurement (x, y, width, height) */
  target: { x: number; y: number; width: number; height: number } | null;
  /** Title of the tooltip */
  title: string;
  /** Description text */
  description: string;
  /** Position of tooltip relative to target */
  position: "top" | "bottom" | "left" | "right";
  /** Optional icon name */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Whether this step is important (shows countdown timer before allowing advance) */
  important?: boolean;
  /** Position of the hand pointer relative to target (default: "right") */
  pointerPosition?: "left" | "right" | "top" | "bottom" | "none";
}

interface CoachMarksProps {
  /** Array of steps to show */
  steps: CoachMarkStep[];
  /** Whether the coach marks are visible */
  visible: boolean;
  /** Callback when tutorial is completed or dismissed */
  onComplete: () => void;
  /** Optional callback when step changes */
  onStepChange?: (stepIndex: number) => void;
  /** Whether to allow skipping the tutorial */
  allowSkip?: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const TOOLTIP_WIDTH = 280;
const SPOTLIGHT_PADDING = 8;
const TOOLTIP_MARGIN = 16;
const NEXT_BUTTON_WIDTH = 90; // Approximate width for fill animation

export function CoachMarks({
  steps,
  visible,
  onComplete,
  onStepChange,
  allowSkip = true,
}: CoachMarksProps) {
  const { theme } = useTheme();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const countdownIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const fillProgress = useSharedValue(0);

  // Animation values
  const overlayOpacity = useSharedValue(0);
  const tooltipOpacity = useSharedValue(0);
  const tooltipScale = useSharedValue(0.9);
  const pulseScale = useSharedValue(1);
  const handOpacity = useSharedValue(0);
  const handTranslateX = useSharedValue(0);
  const handTranslateY = useSharedValue(0);

  const currentStep = steps[currentStepIndex];

  // Reset state when visibility changes
  useEffect(() => {
    if (visible) {
      setCurrentStepIndex(0);
      setIsAnimatingOut(false);
      // Animate in
      overlayOpacity.value = withTiming(1, { duration: 300 });
      tooltipOpacity.value = withDelay(200, withTiming(1, { duration: 300 }));
      tooltipScale.value = withDelay(
        200,
        withTiming(1, { duration: 300, easing: Easing.out(Easing.back(1.5)) })
      );
      // Start pulse animation
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      // Hand animation - will be set per step in the step change effect
      handOpacity.value = withDelay(500, withTiming(1, { duration: 300 }));
    } else {
      overlayOpacity.value = 0;
      tooltipOpacity.value = 0;
      tooltipScale.value = 0.9;
      pulseScale.value = 1;
      handOpacity.value = 0;
      handTranslateX.value = 0;
      handTranslateY.value = 0;
    }
  }, [visible]);

  // Animate tooltip when step changes
  useEffect(() => {
    if (visible && !isAnimatingOut) {
      tooltipOpacity.value = 0;
      tooltipScale.value = 0.9;
      tooltipOpacity.value = withDelay(100, withTiming(1, { duration: 250 }));
      tooltipScale.value = withDelay(
        100,
        withTiming(1, { duration: 250, easing: Easing.out(Easing.back(1.5)) })
      );
      onStepChange?.(currentStepIndex);

      // Clear any existing timeout
      if (countdownIntervalRef.current) {
        clearTimeout(countdownIntervalRef.current as unknown as ReturnType<typeof setTimeout>);
        countdownIntervalRef.current = null;
      }

      // Handle countdown for important steps
      if (currentStep?.important) {
        setCountdown(3);
        fillProgress.value = 0;
        // Animate fill over 3 seconds
        fillProgress.value = withTiming(1, { duration: 3000, easing: Easing.linear });
        // Use setTimeout to clear countdown after 3 seconds
        countdownIntervalRef.current = setTimeout(() => {
          setCountdown(null);
        }, 3000) as unknown as ReturnType<typeof setInterval>;
      } else {
        setCountdown(null);
        fillProgress.value = 0;
      }

      // Set hand animation based on pointer position
      const pointerPos = currentStep?.pointerPosition ?? "right";
      handTranslateX.value = 0;
      handTranslateY.value = 0;

      if (pointerPos === "left" || pointerPos === "right") {
        // Horizontal animation
        const direction = pointerPos === "left" ? 1 : -1;
        handTranslateX.value = withDelay(
          500,
          withRepeat(
            withSequence(
              withTiming(8 * direction, { duration: 600, easing: Easing.inOut(Easing.ease) }),
              withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
          )
        );
      } else if (pointerPos === "top" || pointerPos === "bottom") {
        // Vertical animation
        const direction = pointerPos === "top" ? 1 : -1;
        handTranslateY.value = withDelay(
          500,
          withRepeat(
            withSequence(
              withTiming(8 * direction, { duration: 600, easing: Easing.inOut(Easing.ease) }),
              withTiming(0, { duration: 600, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            true
          )
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepIndex, visible, isAnimatingOut]);

  // Cleanup countdown timeout on unmount
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearTimeout(countdownIntervalRef.current as unknown as ReturnType<typeof setTimeout>);
      }
    };
  }, []);

  const handleNext = useCallback(() => {
    // Don't allow advancing if countdown is active
    if (countdown !== null) return;

    if (currentStepIndex < steps.length - 1) {
      // Animate out current tooltip
      tooltipOpacity.value = withTiming(0, { duration: 150 });
      tooltipScale.value = withTiming(0.9, { duration: 150 });
      setTimeout(() => {
        setCurrentStepIndex((prev) => prev + 1);
      }, 150);
    } else {
      handleComplete();
    }
  }, [currentStepIndex, steps.length, countdown]);

  const handleComplete = useCallback(() => {
    setIsAnimatingOut(true);
    tooltipOpacity.value = withTiming(0, { duration: 200 });
    tooltipScale.value = withTiming(0.9, { duration: 200 });
    handOpacity.value = withTiming(0, { duration: 200 });
    overlayOpacity.value = withTiming(0, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(onComplete)();
      }
    });
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  // Calculate tooltip position
  const getTooltipPosition = () => {
    if (!currentStep?.target) {
      // Center on screen if no target
      return {
        top: SCREEN_HEIGHT / 2 - 100,
        left: (SCREEN_WIDTH - TOOLTIP_WIDTH) / 2,
      };
    }

    const { x, y, width, height } = currentStep.target;
    const position = currentStep.position;

    let top = 0;
    let left = (SCREEN_WIDTH - TOOLTIP_WIDTH) / 2;

    switch (position) {
      case "top":
        top = y - TOOLTIP_MARGIN - 120; // Approximate tooltip height
        left = Math.max(
          TOOLTIP_MARGIN,
          Math.min(x + width / 2 - TOOLTIP_WIDTH / 2, SCREEN_WIDTH - TOOLTIP_WIDTH - TOOLTIP_MARGIN)
        );
        break;
      case "bottom":
        top = y + height + TOOLTIP_MARGIN;
        left = Math.max(
          TOOLTIP_MARGIN,
          Math.min(x + width / 2 - TOOLTIP_WIDTH / 2, SCREEN_WIDTH - TOOLTIP_WIDTH - TOOLTIP_MARGIN)
        );
        break;
      case "left":
        top = y + height / 2 - 60;
        left = Math.max(TOOLTIP_MARGIN, x - TOOLTIP_WIDTH - TOOLTIP_MARGIN);
        break;
      case "right":
        top = y + height / 2 - 60;
        left = Math.min(x + width + TOOLTIP_MARGIN, SCREEN_WIDTH - TOOLTIP_WIDTH - TOOLTIP_MARGIN);
        break;
    }

    // Ensure tooltip stays within screen bounds
    top = Math.max(60, Math.min(top, SCREEN_HEIGHT - 200));

    return { top, left };
  };

  // Calculate hand pointer position based on pointerPosition setting
  const getHandPosition = (): {
    top: number;
    left: number;
    icon: "hand-right" | "hand-left";
    rotation: number;
  } | null => {
    if (!currentStep?.target) return null;
    const pointerPos = currentStep.pointerPosition ?? "right";
    if (pointerPos === "none") return null;

    const { x, y, width, height } = currentStep.target;

    switch (pointerPos) {
      case "left":
        // Hand on left side, pointing right
        return {
          top: y + height / 2 - 15,
          left: x - 45,
          icon: "hand-right",
          rotation: 0,
        };
      case "right":
        // Hand on right side, pointing left
        return {
          top: y + height / 2 - 15,
          left: x + width + 15,
          icon: "hand-left",
          rotation: 0,
        };
      case "top":
        // Hand above, pointing down
        return {
          top: y - 45,
          left: x + width / 2 - 15,
          icon: "hand-left",
          rotation: -90,
        };
      case "bottom":
        // Hand below, pointing up
        return {
          top: y + height + 15,
          left: x + width / 2 - 15,
          icon: "hand-left",
          rotation: 90,
        };
      default:
        return {
          top: y + height / 2 - 15,
          left: x + width + 15,
          icon: "hand-left",
          rotation: 0,
        };
    }
  };

  // Animated styles
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const tooltipStyle = useAnimatedStyle(() => ({
    opacity: tooltipOpacity.value,
    transform: [{ scale: tooltipScale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const handStyle = useAnimatedStyle(() => ({
    opacity: handOpacity.value,
    transform: [
      { translateX: handTranslateX.value },
      { translateY: handTranslateY.value },
    ],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: interpolate(fillProgress.value, [0, 1], [0, NEXT_BUTTON_WIDTH]),
  }));

  if (!visible || !currentStep) return null;

  const tooltipPosition = getTooltipPosition();
  const handPosition = getHandPosition();
  const target = currentStep.target;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]} pointerEvents="box-none">
      {/* Overlay with spotlight cutout */}
      <TouchableWithoutFeedback onPress={handleNext}>
        <Animated.View style={[styles.overlay, overlayStyle]}>
          {/* Dark overlay with spotlight hole */}
          <View style={styles.overlayBackground}>
            {target && (
              <>
                {/* Top section */}
                <View
                  style={[
                    styles.overlaySection,
                    {
                      top: 0,
                      left: 0,
                      right: 0,
                      height: target.y - SPOTLIGHT_PADDING,
                    },
                  ]}
                />
                {/* Bottom section */}
                <View
                  style={[
                    styles.overlaySection,
                    {
                      top: target.y + target.height + SPOTLIGHT_PADDING,
                      left: 0,
                      right: 0,
                      bottom: 0,
                    },
                  ]}
                />
                {/* Left section */}
                <View
                  style={[
                    styles.overlaySection,
                    {
                      top: target.y - SPOTLIGHT_PADDING,
                      left: 0,
                      width: target.x - SPOTLIGHT_PADDING,
                      height: target.height + SPOTLIGHT_PADDING * 2,
                    },
                  ]}
                />
                {/* Right section */}
                <View
                  style={[
                    styles.overlaySection,
                    {
                      top: target.y - SPOTLIGHT_PADDING,
                      left: target.x + target.width + SPOTLIGHT_PADDING,
                      right: 0,
                      height: target.height + SPOTLIGHT_PADDING * 2,
                    },
                  ]}
                />
                {/* Pulse ring around spotlight */}
                <Animated.View
                  style={[
                    styles.pulseRing,
                    pulseStyle,
                    {
                      top: target.y - SPOTLIGHT_PADDING - 4,
                      left: target.x - SPOTLIGHT_PADDING - 4,
                      width: target.width + SPOTLIGHT_PADDING * 2 + 8,
                      height: target.height + SPOTLIGHT_PADDING * 2 + 8,
                      borderColor: theme.primary,
                    },
                  ]}
                />
              </>
            )}
            {!target && <View style={styles.fullOverlay} />}
          </View>

          {/* Animated hand pointer */}
          {handPosition && (
            <Animated.View
              style={[
                styles.handContainer,
                handStyle,
                {
                  top: handPosition.top,
                  left: handPosition.left,
                  transform: [{ rotate: `${handPosition.rotation}deg` }],
                },
              ]}
            >
              <Ionicons name={handPosition.icon} size={30} color="white" />
            </Animated.View>
          )}
        </Animated.View>
      </TouchableWithoutFeedback>

      {/* Tooltip */}
      <Animated.View
        style={[
          styles.tooltip,
          tooltipStyle,
          {
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            backgroundColor: theme.cardBackground,
            shadowColor: theme.isDark ? "#000" : "#333",
          },
        ]}
        pointerEvents="box-none"
      >
        {/* Icon */}
        {currentStep.icon && (
          <View style={[styles.iconContainer, { backgroundColor: theme.primary }]}>
            <Ionicons name={currentStep.icon} size={24} color="white" />
          </View>
        )}

        {/* Content */}
        <Text style={[styles.tooltipTitle, { color: theme.textColor }]}>
          {currentStep.title}
        </Text>
        <Text style={[styles.tooltipDescription, { color: theme.textSecondary }]}>
          {currentStep.description}
        </Text>

        {/* Progress dots */}
        <View style={styles.progressContainer}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                {
                  backgroundColor:
                    index === currentStepIndex ? theme.primary : theme.border,
                },
              ]}
            />
          ))}
        </View>

        {/* Buttons */}
        <View
          style={[
            styles.buttonContainer,
            !allowSkip && styles.buttonContainerCentered,
          ]}
        >
          {allowSkip && (
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={[styles.skipButtonText, { color: theme.textSecondary }]}>
                Skip
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={handleNext}
            style={[
              styles.nextButton,
              {
                backgroundColor: countdown !== null ? theme.border : theme.primary,
                overflow: "hidden",
              },
            ]}
            disabled={countdown !== null}
          >
            {/* Fill overlay for countdown */}
            {countdown !== null && (
              <Animated.View
                style={[
                  styles.nextButtonFill,
                  fillStyle,
                  { backgroundColor: theme.primary },
                ]}
              />
            )}
            <Text style={styles.nextButtonText}>
              {currentStepIndex < steps.length - 1 ? "Next" : "Got it!"}
            </Text>
            {currentStepIndex < steps.length - 1 && (
              <Ionicons name="arrow-forward" size={16} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
  },
  overlayBackground: {
    flex: 1,
  },
  overlaySection: {
    position: "absolute",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
  fullOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
  },
  pulseRing: {
    position: "absolute",
    borderWidth: 2,
    borderRadius: 12,
  },
  handContainer: {
    position: "absolute",
    zIndex: 10,
  },
  tooltip: {
    position: "absolute",
    width: TOOLTIP_WIDTH,
    borderRadius: 16,
    padding: 20,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    alignSelf: "center",
  },
  tooltipTitle: {
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  tooltipDescription: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 16,
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginBottom: 16,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  buttonContainerCentered: {
    justifyContent: "center",
  },
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  skipButtonText: {
    fontSize: 14,
    fontWeight: "500",
  },
  nextButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    gap: 6,
    position: "relative",
  },
  nextButtonFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 20,
  },
  nextButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});
