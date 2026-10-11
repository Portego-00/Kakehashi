import React from "react";
import Svg, { Path, Text } from "react-native-svg";
import { useSubjectColors } from "../../utils/subjectColors";
import { screenPreview, type ScreenPreviewName } from "./screen-previews";

export function SettingsScreenPreview({ name, width, theme }: {
  name: ScreenPreviewName; width: number;
  theme: { primary: string; textColor: string; textSecondary: string; cardBackground: string; border: string };
}) {
  const colors = useSubjectColors();
  const shapes = screenPreview(name, "native", {
    background: theme.cardBackground, surface: theme.cardBackground,
    text: theme.textColor, muted: theme.textSecondary, rule: theme.border,
    accent: theme.primary, kanji: colors.kanji, vocabulary: colors.vocabulary, radical: colors.radical,
  });
  return <Svg width={width} height={width * .7} viewBox="0 0 160 112" style={{ width, height: width * .7, flexShrink: 0 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    {shapes.map((shape, index) => "text" in shape
      ? <Text key={index} x={shape.x} y={shape.y} fill={shape.color} fontSize={shape.size} fontWeight={shape.weight}>{shape.text}</Text>
      : <Path key={index} d={shape.d} fill={shape.fill ?? "none"} stroke={shape.stroke} strokeWidth={shape.strokeWidth} opacity={shape.opacity} transform={shape.transform} strokeLinecap="round" strokeLinejoin="round" />)}
  </Svg>;
}
