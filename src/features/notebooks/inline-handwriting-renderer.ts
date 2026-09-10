import type { InlineInkDocument, InlineInkStroke } from "../../../web/src/features/notebooks/inline-ink";

export function paintInlineInk(context: CanvasRenderingContext2D, document: InlineInkDocument) {
  context.save();
  context.globalAlpha = 1;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, document.width, document.height);
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const stroke of document.strokes) {
    if (!stroke.points.length) continue;
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    context.globalAlpha = stroke.tool === "marker" ? 0.28 : 1;
    if (stroke.tool === "marker" && stroke.points.length > 1) {
      context.lineWidth = stroke.width;
      context.beginPath();
      context.moveTo(stroke.points[0][0], stroke.points[0][1]);
      for (const [x, y] of stroke.points.slice(1)) context.lineTo(x, y);
      context.stroke();
      continue;
    }
    const [x, y, pressure] = stroke.points[0];
    context.beginPath();
    context.arc(x, y, stroke.width * (stroke.tool === "marker" ? 1 : 0.35 + pressure * 0.65) / 2, 0, Math.PI * 2);
    context.fill();
    for (let index = 1; index < stroke.points.length; index++) {
      const previous = stroke.points[index - 1];
      const point = stroke.points[index];
      context.lineWidth = stroke.width * (0.35 + (previous[2] + point[2]) * 0.325);
      context.beginPath(); context.moveTo(previous[0], previous[1]); context.lineTo(point[0], point[1]); context.stroke();
    }
  }
  context.restore();
}

/** Erase a complete stroke when any segment falls within the eraser radius. */
export function hitsInlineStroke(stroke: InlineInkStroke, x: number, y: number, radius: number) {
  const distance = radius + stroke.width / 2;
  return stroke.points.some((point, index) => {
    const previous = stroke.points[Math.max(0, index - 1)];
    const dx = point[0] - previous[0]; const dy = point[1] - previous[1];
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((x - previous[0]) * dx + (y - previous[1]) * dy) / length)) : 0;
    return Math.hypot(x - previous[0] - t * dx, y - previous[1] - t * dy) <= distance;
  });
}
