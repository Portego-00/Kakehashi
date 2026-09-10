import "server-only";

import { randomUUID } from "node:crypto";
import { readBoundedJson } from "@/features/content/server-security";
import { isNotebookDrawingId, isNotebookDrawingSize, isNotebookInkFormat, isNotebookPreviewFormat, supportsNotebookStrokes, supportsNotebookAppearance, NOTEBOOK_DRAWING_MAX_INK_BYTES, NOTEBOOK_DRAWING_MAX_PREVIEW_BYTES, type NotebookDrawing, type NotebookDrawingReference, type NotebookInkFormat, type NotebookPreviewFormat } from "@/features/notebooks/handwriting";
import { decodeInlineInk, encodeInlineInk } from "@/features/notebooks/inline-ink";
import { NotebookError, notebookDrawingReferences, type NotebookState } from "@/features/notebooks/model";
import { notebookBackendConfigured, notebookBackendHeaders, notebookBackendUrl } from "./notebook-backend";

const bucket = "notebook-drawings";
type DrawingMetadata = { id: string; user_id: string; width: number; height: number; ink_bytes: number; preview_bytes: number; dark_preview_bytes: number; preview_format: NotebookPreviewFormat | null; ink_format: NotebookInkFormat; status: "pending" | "ready" };
function unavailable(): never { throw new Error("Handwriting storage is unavailable."); }
function invalid(message = "This handwriting upload is invalid."): never { throw new NotebookError(message, "invalid"); }
function owner(userId: string) {
  if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(userId) || userId === "demo-level-21") throw new NotebookError("A verified notebook account is required.", "invalid", 403);
  if (!notebookBackendConfigured()) unavailable();
}
function decodeBase64(value: unknown, maxBytes: number): Buffer {
  if (typeof value !== "string" || !value.length || value.length > 4 * Math.ceil(maxBytes / 3) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) invalid();
  const bytes = Buffer.from(value, "base64");
  if (!bytes.length || bytes.length > maxBytes || bytes.toString("base64") !== value) invalid();
  return bytes;
}
function pngCrc(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function validatePng(bytes: Buffer, width: number, height: number) {
  if (bytes.length < 45 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.readUInt32BE(8) !== 13 || bytes.toString("ascii", 12, 16) !== "IHDR" || bytes.readUInt32BE(16) !== width || bytes.readUInt32BE(20) !== height) invalid("The handwriting preview must be a PNG matching the canvas size.");
  // Bound every PNG chunk and require image data and an end marker. PNG bytes
  // are served only as image/png with nosniff, never interpreted as markup.
  let offset = 8;
  let imageData = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    if (length > bytes.length - offset - 12) invalid();
    if (pngCrc(bytes.subarray(offset + 4, offset + 8 + length)) !== bytes.readUInt32BE(offset + 8 + length)) invalid("The handwriting preview is corrupted.");
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT" && length) imageData = true;
    offset += length + 12;
    if (type === "IEND") { if (length !== 0 || !imageData || offset !== bytes.length) invalid(); return; }
  }
  invalid("The handwriting preview is incomplete.");
}
export function parseNotebookDrawingUpload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) invalid();
  const source = payload as Record<string, unknown>;
  const inkFormat = source.inkFormat === undefined ? "pencilkit-v1" : source.inkFormat;
  if (Object.keys(source).some((key) => !["inkBase64", "previewBase64", "darkPreviewBase64", "previewFormat", "width", "height", "inkFormat"].includes(key)) || !isNotebookDrawingSize(source.width, source.height) || !isNotebookInkFormat(inkFormat)) invalid();
  const previewFormat = source.previewFormat;
  if (previewFormat !== undefined && (!isNotebookPreviewFormat(previewFormat) || inkFormat !== "pencilkit-v1") || previewFormat === undefined && source.darkPreviewBase64 !== undefined) invalid();
  const width = source.width as number; const height = source.height as number;
  let ink = decodeBase64(source.inkBase64, NOTEBOOK_DRAWING_MAX_INK_BYTES);
  if (inkFormat === "strokes-v1") {
    try {
      const document = decodeInlineInk(source.inkBase64 as string);
      if (document.width !== width || document.height !== height) invalid();
      ink = Buffer.from(encodeInlineInk(document), "base64");
    } catch { invalid("This inline handwriting is invalid or too large."); }
  }
  const preview = decodeBase64(source.previewBase64, NOTEBOOK_DRAWING_MAX_PREVIEW_BYTES);
  validatePng(preview, width, height);
  const darkPreview = previewFormat === "themed-v1" ? decodeBase64(source.darkPreviewBase64, NOTEBOOK_DRAWING_MAX_PREVIEW_BYTES) : undefined;
  if (darkPreview) validatePng(darkPreview, width, height);
  return { ink, preview, darkPreview, width, height, inkFormat, previewFormat: previewFormat as NotebookPreviewFormat | undefined };
}
async function backend(path: string, init?: RequestInit) {
  return fetch(`${notebookBackendUrl()}${path}`, { ...init, headers: { ...notebookBackendHeaders(), ...init?.headers }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
}
async function rpc(name: string, payload: unknown): Promise<unknown> {
  const result = await backend(`/rest/v1/rpc/${name}`, { method: "POST", body: JSON.stringify(payload) });
  const body = await readBoundedJson(result, 16_384);
  if (!result.ok) unavailable();
  return body;
}
type DrawingObjectKind = "ink" | "preview" | "preview-dark";
function objectPath(userId: string, drawingId: string, kind: DrawingObjectKind) { return `${encodeURIComponent(userId)}/${drawingId}/${kind === "ink" ? "drawing.ink" : `${kind}.png`}`; }
async function upload(userId: string, drawingId: string, kind: DrawingObjectKind, bytes: Buffer) {
  const result = await backend(`/storage/v1/object/${bucket}/${objectPath(userId, drawingId, kind)}`, { method: "POST", headers: { "Content-Type": kind === "ink" ? "application/octet-stream" : "image/png", "x-upsert": "false" }, body: new Uint8Array(bytes) });
  if (!result.ok) unavailable();
  await result.body?.cancel();
}
async function discardFailedUpload(userId: string, drawingId: string) {
  // A failed cleanup retains its reservation so leaked objects still count
  // against the hard quota. Never remove objects after a ready commit attempt.
  try {
    const result = await backend(`/storage/v1/object/${bucket}`, { method: "DELETE", body: JSON.stringify({ prefixes: [objectPath(userId, drawingId, "ink"), objectPath(userId, drawingId, "preview"), objectPath(userId, drawingId, "preview-dark")].map(decodeURIComponent) }) });
    if (!result.ok) return;
    await result.body?.cancel();
    // Keep the reservation even after deletion: an upload that timed out may
    // still complete remotely. Reconciliation can release it after checking storage.
  } catch { /* Retain the reservation if cleanup cannot be confirmed. */ }
}
function assertDrawingFeatures(format: NotebookInkFormat, features: string | null | undefined, previewFormat?: NotebookPreviewFormat | null) {
  if (format === "strokes-v1" && !supportsNotebookStrokes(features)) throw new NotebookError("Update Kakehashi to open and edit inline handwriting.", "update_required");
  if (previewFormat && !supportsNotebookAppearance(features)) throw new NotebookError("Update Kakehashi to open and edit handwriting with paper colors.", "update_required");
}
export async function saveNotebookDrawing(userId: string, payload: unknown, features?: string | null): Promise<NotebookDrawingReference> {
  owner(userId);
  const { ink, preview, darkPreview, width, height, inkFormat, previewFormat } = parseNotebookDrawingUpload(payload);
  assertDrawingFeatures(inkFormat, features, previewFormat);
  const drawingId = randomUUID();
  const reserved = await rpc(previewFormat ? "reserve_notebook_drawing_v3" : inkFormat === "pencilkit-v1" ? "reserve_notebook_drawing" : "reserve_notebook_drawing_v2", { p_user_id: userId, p_id: drawingId, p_width: width, p_height: height, p_ink_bytes: ink.length, p_preview_bytes: preview.length, ...(inkFormat === "strokes-v1" || previewFormat ? { p_ink_format: inkFormat } : {}), ...(previewFormat ? { p_preview_format: previewFormat, p_dark_preview_bytes: darkPreview!.length } : {}) });
  if (reserved === false) throw new NotebookError("Your handwriting storage is full. This drawing has not been saved.", "limit");
  if (reserved !== true) unavailable();
  try {
    await upload(userId, drawingId, "ink", ink);
    await upload(userId, drawingId, "preview", preview);
    if (darkPreview) await upload(userId, drawingId, "preview-dark", darkPreview);
  } catch (cause) { await discardFailedUpload(userId, drawingId); throw cause; }
  if (await rpc("complete_notebook_drawing", { p_user_id: userId, p_id: drawingId }) !== true) unavailable();
  return { drawingId, width, height, inkFormat, ...(previewFormat ? { previewFormat } : {}) };
}
function metadata(value: unknown, userId: string): DrawingMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) unavailable();
  const row = value as DrawingMetadata;
  if (row.user_id !== userId || !isNotebookDrawingId(row.id) || !isNotebookDrawingSize(row.width, row.height) || row.status !== "ready" || !Number.isInteger(row.ink_bytes) || row.ink_bytes < 1 || row.ink_bytes > NOTEBOOK_DRAWING_MAX_INK_BYTES || !Number.isInteger(row.preview_bytes) || row.preview_bytes < 1 || row.preview_bytes > NOTEBOOK_DRAWING_MAX_PREVIEW_BYTES) unavailable();
  if (row.ink_format !== undefined && !isNotebookInkFormat(row.ink_format)) unavailable();
  const darkBytes = row.dark_preview_bytes ?? 0;
  const previewFormat = row.preview_format ?? null;
  if (!Number.isInteger(darkBytes) || darkBytes < 0 || darkBytes > NOTEBOOK_DRAWING_MAX_PREVIEW_BYTES || previewFormat !== null && !isNotebookPreviewFormat(previewFormat) || (previewFormat === "themed-v1" ? darkBytes === 0 || row.ink_format !== "pencilkit-v1" : darkBytes !== 0)) unavailable();
  return { ...row, ink_format: row.ink_format ?? "pencilkit-v1", dark_preview_bytes: darkBytes, preview_format: previewFormat };
}
async function findMetadata(userId: string, ids: string[]): Promise<DrawingMetadata[]> {
  const query = new URLSearchParams({ select: "id,user_id,width,height,ink_bytes,preview_bytes,dark_preview_bytes,preview_format,status,ink_format", user_id: `eq.${userId}`, status: "eq.ready", id: `in.(${ids.join(",")})`, limit: String(ids.length) });
  const result = await backend(`/rest/v1/notebook_drawings?${query}`);
  const body = await readBoundedJson(result, 32_768);
  if (!result.ok || !Array.isArray(body) || body.length > ids.length) unavailable();
  return body.map((value) => metadata(value, userId));
}
async function drawingMetadata(userId: string, drawingId: string) {
  owner(userId);
  if (!isNotebookDrawingId(drawingId)) throw new NotebookError("This handwriting could not be found.", "not_found");
  const [row] = await findMetadata(userId, [drawingId]);
  if (!row || row.id !== drawingId) throw new NotebookError("This handwriting could not be found.", "not_found");
  return row;
}
async function download(userId: string, row: DrawingMetadata, kind: DrawingObjectKind): Promise<Buffer> {
  const expected = kind === "ink" ? row.ink_bytes : kind === "preview-dark" ? row.dark_preview_bytes : row.preview_bytes;
  const result = await backend(`/storage/v1/object/authenticated/${bucket}/${objectPath(userId, row.id, kind)}`);
  if (!result.ok || !result.body || Number(result.headers.get("Content-Length") || 0) > expected) { await result.body?.cancel(); unavailable(); }
  const reader = result.body.getReader();
  const chunks: Uint8Array[] = []; let length = 0;
  while (true) {
    const next = await reader.read(); if (next.done) break;
    length += next.value.byteLength;
    if (length > expected) { await reader.cancel(); unavailable(); }
    chunks.push(next.value);
  }
  if (length !== expected) unavailable();
  return Buffer.concat(chunks);
}
export async function readNotebookDrawing(userId: string, drawingId: string, features?: string | null): Promise<NotebookDrawing> {
  const row = await drawingMetadata(userId, drawingId);
  assertDrawingFeatures(row.ink_format, features, row.preview_format);
  const [ink, preview, darkPreview] = await Promise.all([download(userId, row, "ink"), download(userId, row, "preview"), row.preview_format ? download(userId, row, "preview-dark") : undefined]);
  return { drawingId, width: row.width, height: row.height, inkFormat: row.ink_format, inkBase64: ink.toString("base64"), previewBase64: preview.toString("base64"), ...(row.preview_format && darkPreview ? { previewFormat: row.preview_format, darkPreviewBase64: darkPreview.toString("base64") } : {}) };
}
export async function readNotebookDrawingPreview(userId: string, drawingId: string, appearance: "light" | "dark" = "light") {
  const row = await drawingMetadata(userId, drawingId);
  return download(userId, row, appearance === "dark" && row.preview_format === "themed-v1" ? "preview-dark" : "preview");
}
export async function assertNotebookDrawingOwnership(userId: string, state: NotebookState) {
  const references = notebookDrawingReferences(state).filter((ref) => !(ref.drawingId === "" && ref.inkFormat === "strokes-v1"));
  const ids = [...new Set(references.map((ref) => ref.drawingId))];
  if (!ids.length) return;
  owner(userId);
  const rows = new Map<string, DrawingMetadata>();
  for (let offset = 0; offset < ids.length; offset += 50) {
    for (const row of await findMetadata(userId, ids.slice(offset, offset + 50))) rows.set(row.id, row);
  }
  for (const ref of references) {
    const row = rows.get(ref.drawingId);
    if (!row || row.width !== ref.width || row.height !== ref.height || row.ink_format !== (ref.inkFormat ?? "pencilkit-v1") || row.preview_format !== (ref.previewFormat ?? null)) throw new NotebookError("A handwriting reference is missing, has a different format, or belongs to another account.", "invalid");
  }
}
