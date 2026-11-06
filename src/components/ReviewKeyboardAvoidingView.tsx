import React, { useRef } from "react";
import {
  KeyboardAvoidingView,
  type LayoutChangeEvent,
  Platform,
  type ViewInstance,
} from "react-native";
import Animated, {
  measure,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useReviewKeyboard } from "../contexts/ReviewKeyboardContext";

export const IOS_SUSPICIOUS_KEYBOARD_HEIGHT_RATIO = 0.9;

type ReviewKeyboardAvoidingViewProps = React.ComponentProps<typeof KeyboardAvoidingView> & {
  bottomInset: number;
  windowHeight: number;
};

function IosReviewKeyboardAvoidingView({
  children,
  enabled = true,
  keyboardVerticalOffset = 0,
  onLayout,
  style,
  testID,
  bottomInset,
  windowHeight,
}: ReviewKeyboardAvoidingViewProps) {
  // The root observer is already running before the first quiz opens. Consume
  // its movement frames instead of starting a private keyboard observer here.
  const keyboard = useReviewKeyboard();
  const viewRef = useAnimatedRef<ViewInstance>();
  const layoutVersion = useSharedValue(0);
  const lastLayoutRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const keyboardStyle = useAnimatedStyle(() => {
    // A first layout must remeasure even when the keyboard was already visible
    // and its native observer has no new height/state event to publish.
    layoutVersion.get();
    const height = keyboard.height.value;
    if (!enabled || height <= 0 || height >= windowHeight * IOS_SUSPICIOUS_KEYBOARD_HEIGHT_RATIO) {
      return { paddingBottom: 0 };
    }

    // The safe-area fallback is available before the first native layout. Once
    // mounted, measure the actual screen bottom to support embedded review panes.
    const frame = measure(viewRef);
    const viewBottom = frame && frame.height > 0
      ? Math.min(windowHeight, frame.pageY + frame.height)
      : windowHeight - bottomInset;
    return {
      paddingBottom: Math.max(
        0,
        height - (windowHeight - viewBottom) + keyboardVerticalOffset,
      ),
    };
  });
  const handleLayout = (event: LayoutChangeEvent) => {
    const layout = event.nativeEvent.layout;
    const previous = lastLayoutRef.current;
    if (!previous || previous.x !== layout.x || previous.y !== layout.y ||
      previous.width !== layout.width || previous.height !== layout.height) {
      lastLayoutRef.current = layout;
      layoutVersion.value += 1;
    }
    onLayout?.(event);
  };

  return (
    <Animated.View ref={viewRef} testID={testID} style={[style, keyboardStyle]} onLayout={handleLayout}>
      {children}
    </Animated.View>
  );
}

export default function ReviewKeyboardAvoidingView({ bottomInset, windowHeight, ...props }: ReviewKeyboardAvoidingViewProps) {
  if (Platform.OS === "ios") {
    return <IosReviewKeyboardAvoidingView {...props} bottomInset={bottomInset} windowHeight={windowHeight} />;
  }
  return <KeyboardAvoidingView {...props} />;
}
