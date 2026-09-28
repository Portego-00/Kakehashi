/** Positive offsets display subtitles later; all values are milliseconds. */
export const SUBTITLE_OFFSET_LIMIT_MS = 60_000;
export const SUBTITLE_OFFSET_STEP_MS = 100;
export function normalizeSubtitleOffset(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(-SUBTITLE_OFFSET_LIMIT_MS, Math.min(SUBTITLE_OFFSET_LIMIT_MS,
    Math.round(value / SUBTITLE_OFFSET_STEP_MS) * SUBTITLE_OFFSET_STEP_MS));
}
export function subtitlePlaybackTime(cueTimeMs: number, offsetMs: number, durationMs = Infinity): number {
  return Math.max(0, Math.min(durationMs > 0 ? durationMs : Infinity, cueTimeMs + offsetMs));
}
export function formatSubtitleOffset(offsetMs: number): string {
  if (offsetMs === 0) return "No adjustment";
  return `${(Math.abs(offsetMs) / 1000).toFixed(1)}s ${offsetMs > 0 ? "later" : "earlier"}`;
}
