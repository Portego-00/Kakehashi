import { isNotebookDrawingSize, NOTEBOOK_DRAWING_MAX_INK_BYTES } from "./handwriting";

export type InlineInkStroke = {
  id: string;
  tool: "pen" | "marker";
  color: `#${string}`;
  width: number;
  points: [number, number, number][];
};
export type InlineInkDocument = { version: 1; width: number; height: number; strokes: InlineInkStroke[] };
export const INLINE_INK_MAX_STROKES = 2_048;
export const INLINE_INK_MAX_POINTS = 32_768;
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

function invalid(): never { throw new Error("This inline handwriting is invalid or too large."); }
function record(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some((key) => !keys.includes(key))) invalid();
  return value as Record<string, unknown>;
}
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }

/** Copies supported data only. Out-of-paper pointer positions are clipped to the paper. */
export function parseInlineInk(value: unknown): InlineInkDocument {
  const source = record(value, ["version", "width", "height", "strokes"]);
  if (source.version !== 1 || !isNotebookDrawingSize(source.width, source.height) || !Array.isArray(source.strokes) || source.strokes.length > INLINE_INK_MAX_STROKES) invalid();
  const width = source.width as number; const height = source.height as number;
  const ids = new Set<string>(); let totalPoints = 0;
  const strokes: InlineInkStroke[] = Array.from(source.strokes, (value) => {
    const stroke = record(value, ["id", "tool", "color", "width", "points"]);
    if (typeof stroke.id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,63}$/.test(stroke.id) || ids.has(stroke.id)
      || (stroke.tool !== "pen" && stroke.tool !== "marker") || typeof stroke.color !== "string" || !/^#[0-9a-f]{6}$/.test(stroke.color)
      || !finite(stroke.width) || stroke.width < 0.5 || stroke.width > 24 || !Array.isArray(stroke.points) || !stroke.points.length) invalid();
    ids.add(stroke.id); totalPoints += stroke.points.length;
    if (totalPoints > INLINE_INK_MAX_POINTS) invalid();
    const points = Array.from(stroke.points, (point): [number, number, number] => {
      if (!Array.isArray(point) || point.length !== 3 || !finite(point[0]) || !finite(point[1]) || !finite(point[2]) || point[2] < 0 || point[2] > 1) invalid();
      return [Math.max(0, Math.min(width, point[0])), Math.max(0, Math.min(height, point[1])), point[2]];
    });
    return { id: stroke.id, tool: stroke.tool as InlineInkStroke["tool"], color: stroke.color as InlineInkStroke["color"], width: stroke.width, points };
  });
  const document: InlineInkDocument = { version: 1, width, height, strokes };
  // Every allowed string is ASCII, so serialized length equals its byte length.
  if (JSON.stringify(document).length > NOTEBOOK_DRAWING_MAX_INK_BYTES) invalid();
  return document;
}

function encodeAscii(value: string) {
  let output = "";
  for (let index = 0; index < value.length; index += 3) {
    const a = value.charCodeAt(index); const b = value.charCodeAt(index + 1) || 0; const c = value.charCodeAt(index + 2) || 0;
    output += alphabet[a >>> 2] + alphabet[((a & 3) << 4) | (b >>> 4)]
      + (index + 1 < value.length ? alphabet[((b & 15) << 2) | (c >>> 6)] : "=")
      + (index + 2 < value.length ? alphabet[c & 63] : "=");
  }
  return output;
}
export function encodeInlineInk(document: InlineInkDocument): string {
  return encodeAscii(JSON.stringify(parseInlineInk(document)));
}
export function decodeInlineInk(value: string): InlineInkDocument {
  if (typeof value !== "string" || !value.length || value.length > 4 * Math.ceil(NOTEBOOK_DRAWING_MAX_INK_BYTES / 3)
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) invalid();
  let decoded = "";
  for (let index = 0; index < value.length; index += 4) {
    const a = alphabet.indexOf(value[index]); const b = alphabet.indexOf(value[index + 1]);
    const c = value[index + 2] === "=" ? 0 : alphabet.indexOf(value[index + 2]);
    const d = value[index + 3] === "=" ? 0 : alphabet.indexOf(value[index + 3]);
    const bytes = [(a << 2) | (b >>> 4)];
    if (value[index + 2] !== "=") bytes.push(((b & 15) << 4) | (c >>> 2));
    if (value[index + 3] !== "=") bytes.push(((c & 3) << 6) | d);
    if (bytes.some((byte) => byte > 127)) invalid();
    decoded += String.fromCharCode(...bytes);
  }
  if (decoded.length > NOTEBOOK_DRAWING_MAX_INK_BYTES || encodeAscii(decoded) !== value) invalid();
  try { return parseInlineInk(JSON.parse(decoded)); } catch { return invalid(); }
}
