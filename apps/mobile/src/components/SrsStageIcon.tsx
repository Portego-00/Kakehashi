import React from "react";
import SrsLevelIcon from "./SrsLevelIcon";

type SrsStageIconProps = {
  stage: number;
  size?: number;
  color?: string;
};

export default function SrsStageIcon({
  stage,
  size = 22,
  color = "#6f7681",
}: SrsStageIconProps) {
  if (stage === 1) {
    return <SrsLevelIcon level="Apprentice" size={size} color={color} />;
  }

  if (stage === 2) {
    return <SrsLevelIcon level="Apprentice II" size={size} color={color} />;
  }
  if (stage === 3) {
    return <SrsLevelIcon level="Apprentice III" size={size} color={color} />;
  }
  if (stage === 4) {
    return <SrsLevelIcon level="Apprentice IV" size={size} color={color} />;
  }
  if (stage === 5) {
    return <SrsLevelIcon level="Guru" size={size} color={color} />;
  }
  if (stage === 6) {
    return <SrsLevelIcon level="Guru II" size={size} color={color} />;
  }
  if (stage === 7) {
    return <SrsLevelIcon level="Master" size={size} color={color} />;
  }
  if (stage === 8) {
    return <SrsLevelIcon level="Enlightened" size={size} color={color} />;
  }
  if (stage === 9) {
    return <SrsLevelIcon level="Burned" size={size} color={color} />;
  }

  return <SrsLevelIcon level="Apprentice" size={size} color={color} />;
}
