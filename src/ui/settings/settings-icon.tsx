import React from "react";
import { type StyleProp, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import { settingsArtwork, settingsArtworkName, type SettingsArtwork } from "./artwork";

export function SettingsIcon({
  name,
  size = 24,
  color = "currentColor",
  style,
}: {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const art: SettingsArtwork = settingsArtwork[settingsArtworkName(name)];
  return (
    <Svg
      width={size}
      height={size}
      viewBox={art.viewBox ?? "0 0 24 24"}
      style={[style, { width: size, height: size, flexShrink: 0, flexGrow: 0 }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {art.fill ? <Path d={art.fill} fillRule={art.fillRule} fill={color} opacity={art.solid ? 1 : 0.16} /> : null}
      {(art.paths ?? [art.line]).map((d, index) => <Path
        key={index}
        d={d}
        stroke={color}
        fill="none"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />)}
    </Svg>
  );
}
