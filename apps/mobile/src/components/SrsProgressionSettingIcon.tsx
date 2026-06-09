import React from "react";
import Svg, { Defs, Mask, Rect, Path, Text as SvgText } from "react-native-svg";

interface SrsProgressionSettingIconProps {
  size?: number;
  color?: string;
}

export default function SrsProgressionSettingIcon({
  size = 24,
  color = "#AA38C2",
}: SrsProgressionSettingIconProps) {
  const width = size * 1.5;
  return (
    <Svg width={width} height={size} viewBox="0 0 36 24">
      <Defs>
        <Mask id="cutout">
          {/* White background - visible area */}
          <Rect x="1" y="6" width="34" height="12" rx="6" fill="white" />
          {/* Black elements create the cutout */}
          <Path
            d="M9 14L9 11M9 11L7 13M9 11L11 13"
            stroke="black"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <SvgText
            x="23"
            y="13.5"
            fontSize="6"
            fontWeight="bold"
            fill="black"
            textAnchor="middle"
          >
            Guru
          </SvgText>
        </Mask>
      </Defs>
      {/* Chip/pill with cutout mask applied */}
      <Rect x="1" y="6" width="34" height="12" rx="6" fill={color} mask="url(#cutout)" />
    </Svg>
  );
}
