import React from "react";
import Svg, { Path } from "react-native-svg";
import { patreonMark } from "../ui/settings/brand-marks";

export function PatreonMark({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox={patreonMark.viewBox} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><Path d={patreonMark.path} fill={color} /></Svg>;
}
