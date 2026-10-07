import React, { useState } from "react";
import { Pressable, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";

type Props = {
  base: string;
  reading: string;
  hidden: boolean;
  containerStyle: StyleProp<ViewStyle>;
  baseStyle: StyleProp<TextStyle>;
  readingStyle: StyleProp<TextStyle>;
};

export function BunproRubyWord({ base, reading, hidden, containerStyle, baseStyle, readingStyle }: Props) {
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const visible = !hidden || pinned || hovered;
  const contents = <>
    <Text accessibilityElementsHidden={!visible} importantForAccessibility={visible ? "auto" : "no-hide-descendants"} style={[readingStyle, !visible && { opacity: 0 }]}>{reading}</Text>
    <Text style={baseStyle}>{base}</Text>
  </>;
  return hidden ? <Pressable accessibilityRole="button" accessibilityLabel={`Furigana for ${base}`} accessibilityHint="Tap to keep the reading visible. Tap again to hide it."
    accessibilityState={{ selected: pinned }} accessibilityValue={{ text: visible ? reading : "Reading hidden" }}
    onHoverIn={() => setHovered(true)} onHoverOut={() => setHovered(false)} onPress={() => setPinned(value => !value)} style={containerStyle}>
    {contents}
  </Pressable> : <View style={containerStyle}>{contents}</View>;
}
