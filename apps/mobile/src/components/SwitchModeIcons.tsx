import React from "react";
import Svg, { Circle, Path, Text as SvgText } from "react-native-svg";

type SwitchIconProps = {
  color: string;
  size?: number;
};

const BUNPRO_ICON_STROKE_WIDTH = 3;

export function BunproSwitchIcon({ color, size = 22 }: SwitchIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Circle
        cx="34.668"
        cy="14.001"
        r="3"
        stroke={color}
        strokeWidth={BUNPRO_ICON_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M24 14v-2m-8.194 8c1.375 3.625 3.571 7.522 6.63 10.904m4.445 4.03c1.64 1.202 3.13 2.245 4.72 3.067M33.166 17c-2.56 9.555-9.486 23-25.667 23h-2V8h37v32h-4m-.831-23H39.5m-31 0h26.167"
        stroke={color}
        strokeWidth={BUNPRO_ICON_STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function WanikaniSwitchIcon({ color, size = 22 }: SwitchIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <SvgText
        x="12"
        y="12"
        dy="0.35em"
        fill={color}
        fontSize={13.5}
        fontWeight="900"
        textAnchor="middle"
      >
        WK
      </SvgText>
    </Svg>
  );
}
