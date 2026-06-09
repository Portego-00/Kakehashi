import React from "react";
import { ViewStyle } from "react-native";
import Svg, {
  Circle as SvgCircle,
  Defs,
  RadialGradient,
  Stop,
} from "react-native-svg";

interface RadialGlowProps {
  /** Diameter of the glow area */
  size: number;
  /** Glow color (hex) */
  color: string;
  /** Peak opacity at center (0-1) */
  intensity?: number;
  /** Additional styles on the wrapping Svg */
  style?: ViewStyle;
}

/**
 * Renders a soft radial glow using SVG RadialGradient.
 * This avoids the sharp square cutoff that iOS/Android textShadow
 * and View shadow produce.
 */
export function RadialGlow({
  size,
  color,
  intensity = 0.5,
  style,
}: RadialGlowProps) {
  const r = size / 2;
  return (
    <Svg
      width={size}
      height={size}
      style={[{ position: "absolute" }, style]}
    >
      <Defs>
        <RadialGradient id="rg" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop
            offset="0%"
            stopColor={color}
            stopOpacity={String(intensity)}
          />
          <Stop
            offset="55%"
            stopColor={color}
            stopOpacity={String(intensity * 0.3)}
          />
          <Stop offset="100%" stopColor={color} stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <SvgCircle cx={r} cy={r} r={r} fill="url(#rg)" />
    </Svg>
  );
}
