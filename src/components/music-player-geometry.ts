export interface PlayerNativeFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type PlayerNativeFrames = Partial<Record<"primary" | "secondary", PlayerNativeFrame>>;

const FRAME_TOLERANCE = 1;

function isValidFrame(frame?: PlayerNativeFrame): frame is PlayerNativeFrame {
  return Boolean(
    frame &&
    Number.isFinite(frame.x) && Number.isFinite(frame.y) &&
    Number.isFinite(frame.width) && Number.isFinite(frame.height) &&
    frame.width > 0 && frame.height > 0,
  );
}

function containsFrame(container: PlayerNativeFrame, frame: PlayerNativeFrame) {
  return (
    frame.x >= container.x - FRAME_TOLERANCE &&
    frame.y >= container.y - FRAME_TOLERANCE &&
    frame.x + frame.width <= container.x + container.width + FRAME_TOLERANCE &&
    frame.y + frame.height <= container.y + container.height + FRAME_TOLERANCE
  );
}

/** Use complete native division measurements without moving the playing video between hosts. */
export function getFoldedPlayerFrames(
  frames: PlayerNativeFrames & { container?: PlayerNativeFrame },
) {
  const { container, primary, secondary } = frames;
  if (
    !isValidFrame(container) || !isValidFrame(primary) || !isValidFrame(secondary) ||
    !containsFrame(container, primary) || !containsFrame(container, secondary)
  ) {
    return null;
  }

  const verticalDivision =
    Math.abs(primary.x - secondary.x) <= FRAME_TOLERANCE &&
    Math.abs(primary.width - secondary.width) <= FRAME_TOLERANCE &&
    secondary.y - (primary.y + primary.height) > FRAME_TOLERANCE;
  const horizontalDivision =
    Math.abs(primary.y - secondary.y) <= FRAME_TOLERANCE &&
    Math.abs(primary.height - secondary.height) <= FRAME_TOLERANCE &&
    secondary.x - (primary.x + primary.width) > FRAME_TOLERANCE;
  if (!verticalDivision && !horizontalDivision) return null;

  const localFrame = (frame: PlayerNativeFrame): PlayerNativeFrame => ({
    ...frame,
    x: frame.x - container.x,
    y: frame.y - container.y,
  });
  return { primary: localFrame(primary), secondary: localFrame(secondary) };
}

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
