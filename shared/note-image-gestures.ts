export type NoteImageTransform = { scale: number; x: number; y: number };
export type NoteImagePoint = { x: number; y: number };
export type NoteImageBounds = { width: number; height: number; imageWidth: number; imageHeight: number };

export const INITIAL_NOTE_IMAGE_TRANSFORM: NoteImageTransform = { scale: 1, x: 0, y: 0 };

export function containNoteImageTransform(value: NoteImageTransform, bounds: NoteImageBounds): NoteImageTransform {
  const scale = Math.max(1, Math.min(5, value.scale));
  if (bounds.width <= 0 || bounds.height <= 0) return { scale, x: 0, y: 0 };
  const imageWidth = bounds.imageWidth || bounds.width;
  const imageHeight = bounds.imageHeight || bounds.height;
  const fit = Math.min(bounds.width / imageWidth, bounds.height / imageHeight);
  const maxX = Math.max(0, (imageWidth * fit * scale - bounds.width) / 2);
  const maxY = Math.max(0, (imageHeight * fit * scale - bounds.height) / 2);
  return { scale, x: Math.max(-maxX, Math.min(maxX, value.x)), y: Math.max(-maxY, Math.min(maxY, value.y)) };
}

/** Keep the image point beneath the fingers fixed while their midpoint moves. */
export function pinchNoteImage(origin: NoteImageTransform, scale: number, anchor: NoteImagePoint, movement: NoteImagePoint = { x: 0, y: 0 }): NoteImageTransform {
  const nextScale = Math.max(1, Math.min(5, scale));
  const ratio = nextScale / origin.scale;
  return {
    scale: nextScale,
    x: origin.x * ratio + anchor.x * (1 - ratio) + movement.x,
    y: origin.y * ratio + anchor.y * (1 - ratio) + movement.y,
  };
}

export function noteImageTouchGeometry(points: NoteImagePoint[]) {
  if (points.length >= 2) {
    const [first, second] = points;
    return { count: 2, x: (first.x + second.x) / 2, y: (first.y + second.y) / 2, distance: Math.hypot(first.x - second.x, first.y - second.y) };
  }
  return { count: points.length, x: points[0]?.x ?? 0, y: points[0]?.y ?? 0, distance: 0 };
}
