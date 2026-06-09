import React, { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { useTheme } from "../utils/theme";

interface LoadingProgressBarProps {
  isLoading: boolean;
  progress?: number; // 0-1 value, if provided will show actual progress
  color?: string;
  height?: number;
  absolute?: boolean; // Whether to position the bar absolutely or relatively
  style?: any; // Additional style props
}

export default function LoadingProgressBar({
  isLoading,
  progress,
  color,
  height = 3,
  absolute = false,
  style
}: LoadingProgressBarProps) {
  const { theme } = useTheme();
  const barColor = color || theme.secondary;
  
  const loadingAnimation = useRef(new Animated.Value(0)).current;
  const widthAnimation = useRef(new Animated.Value(0)).current;
  const [isVisible, setIsVisible] = useState(false);
  const lastProgressRef = useRef(0);
  const currentLoadingValueRef = useRef(0);
  const currentWidthValueRef = useRef(0);
  
  // Add listeners to track current values
  useEffect(() => {
    const loadingListener = loadingAnimation.addListener(({ value }) => {
      currentLoadingValueRef.current = value;
    });
    const widthListener = widthAnimation.addListener(({ value }) => {
      currentWidthValueRef.current = value;
    });
    
    return () => {
      loadingAnimation.removeListener(loadingListener);
      widthAnimation.removeListener(widthListener);
    };
  }, [loadingAnimation, widthAnimation]);
  
  // Manage visibility based on loading state
  useEffect(() => {
    if (isLoading) {
      setIsVisible(true);
    } else {
      // When loading finishes, we'll keep it visible until the progress animation completes
      const timer = setTimeout(() => {
        setIsVisible(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Handle progress animation
  useEffect(() => {
    if (!isVisible && isLoading) {
      setIsVisible(true);
    }
    
    if (isLoading) {
      // If we have actual progress, animate to it
      if (progress !== undefined) {
        // Only animate if progress increases or we're resetting after completion
        if (progress > lastProgressRef.current || (progress === 0 && lastProgressRef.current > 0)) {
          Animated.timing(widthAnimation, {
            toValue: progress,
            duration: progress === 0 ? 0 : 300, // Instant reset, smooth progress
            useNativeDriver: false,
          }).start();
          lastProgressRef.current = progress;
        }
      } else {
        // No explicit progress provided - use the mock loading animation
        // This should only start if we don't already have an animation running
        if (currentLoadingValueRef.current === 0) {
          // Create the mock loading animation sequence
          const mockLoadingSequence = [
            // Move to 60% quickly to show initial loading
            Animated.timing(loadingAnimation, {
              toValue: 0.6,
              duration: 700,
              useNativeDriver: false,
            }),
            // Then slowly progress to 80%
            Animated.timing(loadingAnimation, {
              toValue: 0.8,
              duration: 2000,
              useNativeDriver: false,
            }),
            // Finally, creep up to 95% (saving the last 5% for completion)
            Animated.timing(loadingAnimation, {
              toValue: 0.95,
              duration: 3000,
              useNativeDriver: false,
            }),
          ];

          // Run the sequence
          Animated.sequence(mockLoadingSequence).start();
        }
      }
    } else if (isVisible) {
      // Animate to 100% when loading finishes, but only if not already there
      if (progress !== undefined) {
        if (currentWidthValueRef.current < 1) {
          Animated.timing(widthAnimation, {
            toValue: 1,
            duration: 300,
            useNativeDriver: false,
          }).start(() => {
            // After completion, reset but don't immediately hide
            setTimeout(() => {
              lastProgressRef.current = 0;
              widthAnimation.setValue(0);
            }, 200);
          });
        }
      } else if (currentLoadingValueRef.current < 1) {
        Animated.timing(loadingAnimation, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }).start(() => {
          // Reset after completion
          loadingAnimation.setValue(0);
        });
      }
    }
  }, [isLoading, loadingAnimation, progress, widthAnimation, isVisible]);

  // Don't render anything if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <View 
      style={[
        absolute ? styles.absoluteContainer : styles.container, 
        { height }, 
        style
      ]}
    >
      <Animated.View
        style={[
          styles.progressBar,
          {
            backgroundColor: barColor,
            width: progress !== undefined
              ? widthAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                })
              : loadingAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
            height,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: "transparent",
  },
  absoluteContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    backgroundColor: "transparent",
  },
  progressBar: {
    height: 3,
  },
}); 