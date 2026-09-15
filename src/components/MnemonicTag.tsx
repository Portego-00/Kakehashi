import React, { useState } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type TextLayoutEvent,
  type TextStyle,
  type ViewStyle,
} from "react-native";

interface MnemonicTagProps {
  children: string;
  style: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
}

/** A rounded mnemonic label whose text shares the surrounding paragraph baseline. */
export function MnemonicTag({ children, style, textStyle }: MnemonicTagProps) {
  const { fontScale, width } = useWindowDimensions();
  const labelStyle = {
    ...StyleSheet.flatten(textStyle),
    ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
  };
  const measurementKey = JSON.stringify([
    children, fontScale, width, labelStyle.fontSize, labelStyle.fontFamily,
    labelStyle.fontWeight, labelStyle.fontStyle, labelStyle.lineHeight,
    labelStyle.letterSpacing, labelStyle.includeFontPadding, labelStyle.textTransform,
  ]);
  const [measurement, setMeasurement] = useState<{
    key: string;
    baseline: number;
    height: number;
    lineCount: number;
  } | null>(null);

  if (Platform.OS !== "android") {
    return <View style={style}><Text style={textStyle}>{children}</Text></View>;
  }

  const badgeStyle = StyleSheet.flatten(style) ?? {};
  const paddingTop = badgeStyle.paddingTop ?? badgeStyle.paddingVertical ?? badgeStyle.padding ?? 0;
  const paddingBottom = badgeStyle.paddingBottom ?? badgeStyle.paddingVertical ?? badgeStyle.padding ?? 0;
  const metrics = measurement?.key === measurementKey ? measurement : null;
  const onTextLayout = ({ nativeEvent }: TextLayoutEvent) => {
    const line = nativeEvent.lines.at(-1);
    if (!line) return;
    // Android reports y and ascender in density-independent units, including
    // the user's font scale. Their sum is the last line's actual baseline.
    const baseline = line.y + line.ascender;
    const height = line.y + line.height;
    if (!Number.isFinite(baseline) || baseline <= 0 || !Number.isFinite(height)) return;
    const lineCount = nativeEvent.lines.length;
    setMeasurement(previous => previous?.key === measurementKey &&
      previous.baseline === baseline && previous.height === height && previous.lineCount === lineCount
      ? previous : { key: measurementKey, baseline, height, lineCount });
  };

  if (metrics && metrics.lineCount > 1) {
    // A multiline View attachment cannot fit a paragraph's single line box.
    // Native text spans wrap with the paragraph and reserve each required line.
    return <Text style={[labelStyle, { backgroundColor: badgeStyle.backgroundColor }]}>{children}</Text>;
  }

  // RN places an inline View's bottom on the paragraph baseline. Measure only
  // through the label baseline; its rounded background can extend into the
  // paragraph's normal descender space without moving the text with an offset.
  return (
    <View style={{
      height: metrics ? Number(paddingTop) + metrics.baseline : undefined,
      marginHorizontal: badgeStyle.marginHorizontal,
      overflow: "visible",
    }}>
      <View style={[style, {
        marginHorizontal: 0,
        height: metrics ? Number(paddingTop) + metrics.height + Number(paddingBottom) : undefined,
        overflow: "visible",
      }]}>
        <Text style={labelStyle} onTextLayout={onTextLayout}>{children}</Text>
      </View>
    </View>
  );
}
