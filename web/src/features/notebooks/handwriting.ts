/** Portable metadata only. Original PencilKit data and previews remain private assets. */
export const NOTEBOOK_HANDWRITING_FEATURE = "handwriting-v1";
export const NOTEBOOK_STROKES_FEATURE = "handwriting-strokes-v1";
export const NOTEBOOK_APPEARANCE_FEATURE = "handwriting-appearance-v1";
export const NOTEBOOK_HANDWRITING_FEATURES = `${NOTEBOOK_HANDWRITING_FEATURE}, ${NOTEBOOK_STROKES_FEATURE}, ${NOTEBOOK_APPEARANCE_FEATURE}`;
export const NOTEBOOK_DRAWING_MAX_INK_BYTES = 1_048_576;
export const NOTEBOOK_DRAWING_MAX_PREVIEW_BYTES = 1_048_576;
export const NOTEBOOK_DRAWING_MAX_REQUEST_BYTES = 4_200_000;
export const NOTEBOOK_DRAWING_MAX_DIMENSION = 4_096;
export const NOTEBOOK_DRAWING_MAX_PIXELS = 16_000_000;
export type NotebookInkFormat = "pencilkit-v1" | "strokes-v1";
export type NotebookPreviewFormat = "themed-v1";
export type { NotebookPaperColor, NotebookPaperAppearance } from "./paper-appearance";
export type NotebookDrawingReference = { drawingId: string; width: number; height: number; inkFormat?: NotebookInkFormat; previewFormat?: NotebookPreviewFormat };
export type NotebookDrawingPayload = { inkBase64: string; previewBase64: string; darkPreviewBase64?: string; width: number; height: number; inkFormat?: NotebookInkFormat; previewFormat?: NotebookPreviewFormat };
export type NotebookDrawingUpload = NotebookDrawingPayload;
export type NotebookDrawing = NotebookDrawingReference & Pick<NotebookDrawingUpload, "inkBase64" | "previewBase64" | "darkPreviewBase64">;
export function isNotebookDrawingId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}
export function isNotebookDrawingSize(width: unknown, height: unknown): width is number {
  return typeof width === "number" && typeof height === "number" && Number.isInteger(width) && Number.isInteger(height)
    && width > 0 && height > 0 && width <= NOTEBOOK_DRAWING_MAX_DIMENSION && height <= NOTEBOOK_DRAWING_MAX_DIMENSION
    && width * height <= NOTEBOOK_DRAWING_MAX_PIXELS;
}
export function supportsNotebookHandwriting(features: string | null | undefined): boolean {
  return (features || "").split(",").some((value) => value.trim() === NOTEBOOK_HANDWRITING_FEATURE);
}
export function isNotebookInkFormat(value: unknown): value is NotebookInkFormat {
  return value === "pencilkit-v1" || value === "strokes-v1";
}
export function supportsNotebookStrokes(features: string | null | undefined): boolean {
  return (features || "").split(",").some((value) => value.trim() === NOTEBOOK_STROKES_FEATURE);
}
export function isNotebookPreviewFormat(value: unknown): value is NotebookPreviewFormat { return value === "themed-v1"; }
export function supportsNotebookAppearance(features: string | null | undefined): boolean {
  return (features || "").split(",").some((value) => value.trim() === NOTEBOOK_APPEARANCE_FEATURE);
}
