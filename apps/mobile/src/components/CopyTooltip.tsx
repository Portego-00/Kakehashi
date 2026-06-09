import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Clipboard, StyleSheet, Text, View } from "react-native";

const TOOLTIP_SHOW_DURATION_MS = 1000;
const TOOLTIP_ENTER_DURATION_MS = 150;
const TOOLTIP_EXIT_DURATION_MS = 140;
const TOOLTIP_ENTER_OFFSET = 10;
const TOOLTIP_EXIT_OFFSET = -10;

type AnchorRef = React.RefObject<View | null>;

interface TooltipPosition {
  x: number;
  y: number;
}

interface CopyTooltipProps {
  visible: boolean;
  position: TooltipPosition;
  opacity: Animated.Value;
  translateY: Animated.Value;
  label?: string;
}

export function useCopyTooltip(displayMs = TOOLTIP_SHOW_DURATION_MS) {
  const containerRef = useRef<View>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({
    x: 0,
    y: 0,
  });
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const tooltipTranslateY = useRef(
    new Animated.Value(TOOLTIP_ENTER_OFFSET)
  ).current;
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  const animateTooltipIn = useCallback(() => {
    tooltipOpacity.stopAnimation();
    tooltipTranslateY.stopAnimation();
    tooltipOpacity.setValue(0);
    tooltipTranslateY.setValue(TOOLTIP_ENTER_OFFSET);

    Animated.parallel([
      Animated.timing(tooltipOpacity, {
        toValue: 1,
        duration: TOOLTIP_ENTER_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(tooltipTranslateY, {
        toValue: 0,
        duration: TOOLTIP_ENTER_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start();
  }, [tooltipOpacity, tooltipTranslateY]);

  const animateTooltipOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(tooltipOpacity, {
        toValue: 0,
        duration: TOOLTIP_EXIT_DURATION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(tooltipTranslateY, {
        toValue: TOOLTIP_EXIT_OFFSET,
        duration: TOOLTIP_EXIT_DURATION_MS,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setTooltipVisible(false);
      }
    });
  }, [tooltipOpacity, tooltipTranslateY]);

  const showTooltip = useCallback(
    (anchorRef: AnchorRef) => {
      const container = containerRef.current;
      const anchor = anchorRef.current;
      if (!container || !anchor) {
        return;
      }

      anchor.measureInWindow((anchorX, anchorY, anchorWidth) => {
        container.measureInWindow((containerX, containerY) => {
          setTooltipPosition({
            x: anchorX - containerX + anchorWidth / 2,
            y: anchorY - containerY - 10,
          });
          setTooltipVisible(true);
          animateTooltipIn();
          clearHideTimer();
          hideTimeoutRef.current = setTimeout(() => {
            animateTooltipOut();
            hideTimeoutRef.current = null;
          }, displayMs);
        });
      });
    },
    [animateTooltipIn, animateTooltipOut, clearHideTimer, displayMs]
  );

  const copyText = useCallback(
    (value: string | null | undefined, anchorRef: AnchorRef) => {
      const text = value?.trim();
      if (!text) {
        return;
      }

      Clipboard.setString(text);
      showTooltip(anchorRef);
    },
    [showTooltip]
  );

  useEffect(() => {
    return () => {
      clearHideTimer();
    };
  }, [clearHideTimer]);

  return {
    containerRef,
    tooltipVisible,
    tooltipPosition,
    tooltipOpacity,
    tooltipTranslateY,
    copyText,
  };
}

export function CopyTooltip({
  visible,
  position,
  opacity,
  translateY,
  label = "Copied!",
}: CopyTooltipProps) {
  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.tooltip,
        {
          left: position.x,
          top: position.y,
          opacity,
          transform: [{ translateX: -40 }, { translateY }],
        },
      ]}
    >
      <Text style={styles.tooltipText}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  tooltip: {
    position: "absolute",
    zIndex: 1000,
    minWidth: 80,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.62)",
  },
  tooltipText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
