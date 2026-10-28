import type { PlayerNativeFrame } from "./music-player-geometry";
import type { ReactNode } from "react";
import type { LayoutChangeEvent } from "react-native";

export const supportsPlayerArrangement = false;

export interface MusicPlayerLayoutProps {
  video: ReactNode;
  lyrics: ReactNode;
  useArrangement: boolean;
  preferredVideoRatio: number;
  onVideoLayout: (event: LayoutChangeEvent) => void;
  onNativeGeometryChange?: (part: "primary" | "secondary", frame: PlayerNativeFrame) => void;
}

/** Non-iOS platforms keep the existing React Native flow without loading SwiftUI. */
export function MusicPlayerLayout({ video, lyrics }: MusicPlayerLayoutProps) {
  return <>{video}{lyrics}</>;
}
