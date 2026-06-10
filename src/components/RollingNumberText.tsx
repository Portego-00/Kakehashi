import React, { memo, useEffect } from "react";
import {
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

/**
 * Text whose digits roll vertically (iOS-style) when the value changes.
 * Non-digit characters (units like "h"/"m"/"s", separators) render as plain
 * text and crossfade when they appear or disappear.
 *
 * Implementation: each digit is a clipped column of 0-9 translated with a
 * spring. Characters are keyed by their position from the RIGHT so trailing
 * digits keep their identity while the number grows (e.g. "9m 59s" ->
 * "10m 00s" rolls instead of remounting).
 *
 * Pass only text styles in `style` (fontSize, color, weight...). Margins and
 * layout belong in `containerStyle`.
 */

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const HEIGHT_PER_FONT_SIZE = 1.25;

// Ease-out timing: settles cleanly without overshooting past the digit.
const DIGIT_TIMING = {
  duration: 280,
  easing: Easing.out(Easing.cubic),
  reduceMotion: ReduceMotion.System,
};

const charLayout = LinearTransition.easing(Easing.inOut(Easing.quad))
  .duration(200)
  .reduceMotion(ReduceMotion.System);

const charEntering = FadeIn.duration(160).reduceMotion(ReduceMotion.System);
const charExiting = FadeOut.duration(110).reduceMotion(ReduceMotion.System);

type RollingDigitProps = {
  digit: number;
  height: number;
  textStyle: StyleProp<TextStyle>;
};

const RollingDigit = memo(function RollingDigit({
  digit,
  height,
  textStyle,
}: RollingDigitProps) {
  const translateY = useSharedValue(-digit * height);

  useEffect(() => {
    translateY.value = withTiming(-digit * height, DIGIT_TIMING);
  }, [digit, height, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={{ height, overflow: "hidden" }}>
      <Animated.View style={animatedStyle}>
        {DIGITS.map((value) => (
          <Text
            key={value}
            style={[
              textStyle,
              {
                height,
                lineHeight: height,
                includeFontPadding: false,
                textAlign: "center",
              },
            ]}
          >
            {value}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
});

type RollingNumberTextProps = {
  text: string;
  /** Text styles only (fontSize, color, fontWeight, fontVariant...). */
  style?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

export default function RollingNumberText({
  text,
  style,
  containerStyle,
}: RollingNumberTextProps) {
  const flattened = StyleSheet.flatten(style) ?? {};
  const fontSize = typeof flattened.fontSize === "number" ? flattened.fontSize : 14;
  const height = Math.round(fontSize * HEIGHT_PER_FONT_SIZE);
  const chars = text.split("");

  return (
    <Animated.View
      style={[styles.row, containerStyle]}
      layout={charLayout}
      accessible
      accessibilityRole="text"
      accessibilityLabel={text}
    >
      {chars.map((char, index) => {
        const positionFromRight = chars.length - 1 - index;
        const isDigit = char >= "0" && char <= "9";

        if (isDigit) {
          return (
            <Animated.View
              key={`digit-${positionFromRight}`}
              entering={charEntering}
              exiting={charExiting}
              layout={charLayout}
            >
              <RollingDigit digit={Number(char)} height={height} textStyle={style} />
            </Animated.View>
          );
        }

        return (
          <Animated.View
            key={`char-${positionFromRight}-${char}`}
            entering={charEntering}
            exiting={charExiting}
            layout={charLayout}
          >
            <Text
              style={[
                style,
                { height, lineHeight: height, includeFontPadding: false },
              ]}
            >
              {char}
            </Text>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
});
