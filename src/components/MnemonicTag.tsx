import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

interface MnemonicTagProps {
  children: string;
  style: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
}

/** Highlight a mnemonic term without interrupting Android paragraph layout. */
export function MnemonicTag({ children, style, textStyle }: MnemonicTagProps) {
  if (Platform.OS !== "android") {
    return <View style={style}><Text style={textStyle}>{children}</Text></View>;
  }

  // Inline View attachments have their own layout and measured height. On
  // Android they can wrap separately from adjacent text or obscure a line.
  // A native text span shares the paragraph's wrapping and baseline from the
  // first render, including after font-scale and available-width changes.
  const badgeStyle = StyleSheet.flatten(style);
  return (
    <Text style={[textStyle, { backgroundColor: badgeStyle?.backgroundColor }]}>
      {children}
    </Text>
  );
}
