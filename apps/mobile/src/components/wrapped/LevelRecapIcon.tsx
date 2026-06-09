import React from "react";
import Svg, {
  Line,
  Path,
  Rect,
} from "react-native-svg";

interface LevelRecapIconProps {
  size?: number;
  color?: string;
}

/**
 * Custom SVG icon for the Level Recap feature.
 * Depicts a stylised card with a star (achievement) in the top half
 * and two summary lines in the bottom half.
 */
export function LevelRecapIcon({
  size = 24,
  color = "#7c3aed",
}: LevelRecapIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Card outline */}
      <Rect
        x={4}
        y={2}
        width={16}
        height={20}
        rx={3}
        stroke={color}
        strokeWidth={1.5}
      />

      {/* Star (centred in top half of card) */}
      <Path
        d="M12 5.5l1.1 2.3 2.5.4-1.8 1.7.4 2.5-2.2-1.2-2.2 1.2.4-2.5-1.8-1.7 2.5-.4L12 5.5z"
        fill={color}
      />

      {/* Summary line 1 */}
      <Line
        x1={7.5}
        y1={15.5}
        x2={16.5}
        y2={15.5}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.45}
      />

      {/* Summary line 2 (shorter) */}
      <Line
        x1={7.5}
        y1={18.5}
        x2={13}
        y2={18.5}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        opacity={0.45}
      />
    </Svg>
  );
}
