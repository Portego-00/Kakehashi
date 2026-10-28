export interface PlayerNativeFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PlayerNativeFrames = Partial<Record<"primary" | "secondary", PlayerNativeFrame>>;

/** Extend noninteractive media to the middle of the system's reserved division band. */
export function getFullBleedPlayerVideoGeometry(frames: PlayerNativeFrames) {
  const { primary, secondary } = frames;
  if (
    !primary || !secondary ||
    primary.width <= 0 || primary.height <= 0 ||
    Math.abs(primary.x - secondary.x) > 1 ||
    Math.abs(primary.width - secondary.width) > 1 ||
    secondary.y < primary.y + primary.height - 1
  ) {
    return null;
  }
  const stageHeight = (primary.y + primary.height + secondary.y) / 2 - primary.y;
  const videoWidth = Math.max(primary.width, stageHeight * 16 / 9);
  return { stageHeight, videoWidth, videoHeight: videoWidth * 9 / 16 };
}
