import React from "react";
import Svg, { Path } from "react-native-svg";
import { useSubjectColors } from "../../utils/subjectColors";
import {
  reviewModeSketches,
  reviewSketch,
  type ReviewModeSketchName,
} from "./review-mode-sketch";

export function ReviewModeSketch({
  name,
  width,
  theme,
}: {
  name: ReviewModeSketchName;
  width: number;
  theme: {
    primary: string;
    textSecondary: string;
    cardBackground: string;
    border: string;
  };
}) {
  const art = reviewModeSketches[name];
  const subjectColors = useSubjectColors();
  return (
    <Svg
      width={width}
      height={width * 0.7}
      viewBox={reviewSketch.viewBox}
      style={{ flexShrink: 0 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Path d={reviewSketch.frame} fill={theme.cardBackground} />
      <Path d={reviewSketch.prompt} fill={subjectColors.kanji} />
      <Path
        d={reviewSketch.progress}
        stroke="white"
        strokeWidth={1.5}
        opacity={0.55}
        strokeLinecap="round"
      />
      <Path
        d={reviewSketch.character}
        stroke="white"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
      <Path d={reviewSketch.strip} fill={theme.textSecondary} opacity={0.15} />
      <Path
        d={reviewSketch.question}
        stroke={theme.textSecondary}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path d={art.surface} fill={theme.primary} opacity={0.12} />
      <Path
        d={art.outline}
        fill="none"
        stroke={name === "type" ? theme.primary : theme.border}
        strokeWidth={2}
      />
      <Path
        d={art.marks}
        fill="none"
        stroke={theme.textSecondary}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d={art.correct}
        fill="none"
        stroke={theme.primary}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d={art.wrong}
        fill="none"
        stroke={theme.textSecondary}
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <Path
        d={reviewSketch.frame}
        fill="none"
        stroke={theme.border}
        strokeWidth={1}
      />
    </Svg>
  );
}
