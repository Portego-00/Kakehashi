import { isNotebookDrawingId, isNotebookDrawingSize, isNotebookInkFormat, isNotebookPreviewFormat, NOTEBOOK_HANDWRITING_FEATURES, type NotebookDrawingReference, type NotebookDrawingPayload } from "../../../web/src/features/notebooks/handwriting";
import { decodeInlineInk } from "../../../web/src/features/notebooks/inline-ink";
import { NotebookApiError, notebookEndpoint } from "./api";

export type { NotebookDrawingReference, NotebookDrawingPayload } from "../../../web/src/features/notebooks/handwriting";

function reference(value: unknown): NotebookDrawingReference {
  const data = value as Partial<NotebookDrawingReference> | null;
  if (!data || !isNotebookDrawingId(data.drawingId) || !isNotebookDrawingSize(data.width, data.height) || (data.inkFormat !== undefined && !isNotebookInkFormat(data.inkFormat)) || (data.previewFormat !== undefined && !isNotebookPreviewFormat(data.previewFormat))) {
    throw new NotebookApiError("The server returned an invalid handwriting reference.", 502);
  }
  return { drawingId: data.drawingId!, width: data.width!, height: data.height!, ...(data.inkFormat ? { inkFormat: data.inkFormat } : {}), ...(data.previewFormat ? { previewFormat: data.previewFormat } : {}) };
}

function base64(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1_398_104 && value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

export function drawingPayload(value: unknown): NotebookDrawingPayload {
  const data = value as Partial<NotebookDrawingPayload> | null;
  if (!data || !isNotebookDrawingSize(data.width, data.height) || !base64(data.inkBase64) || !base64(data.previewBase64) || !data.previewBase64.startsWith("iVBORw0KGgo") || (data.inkFormat !== undefined && !isNotebookInkFormat(data.inkFormat)) || (data.previewFormat !== undefined && !isNotebookPreviewFormat(data.previewFormat))) {
    throw new NotebookApiError("This handwriting could not be read. The original drawing is retained.", 502);
  }
  if (data.previewFormat ? data.inkFormat !== "pencilkit-v1" || !base64(data.darkPreviewBase64) || !data.darkPreviewBase64.startsWith("iVBORw0KGgo") : data.darkPreviewBase64 !== undefined) {
    throw new NotebookApiError("This handwriting preview could not be read. The original drawing is retained.", 502);
  }
  if (data.inkFormat === "strokes-v1") {
    try {
      const ink = decodeInlineInk(data.inkBase64);
      if (ink.width !== data.width || ink.height !== data.height) throw new Error("Drawing size mismatch");
    } catch { throw new NotebookApiError("This handwriting could not be read. The original drawing is retained.", 502); }
  }
  return { inkBase64: data.inkBase64, previewBase64: data.previewBase64, width: data.width!, height: data.height!, ...(data.inkFormat ? { inkFormat: data.inkFormat } : {}), ...(data.previewFormat ? { previewFormat: data.previewFormat, darkPreviewBase64: data.darkPreviewBase64 } : {}) };
}

async function requestDrawing(token: string, accountId: string, drawingId?: string, payload?: NotebookDrawingPayload, signal?: AbortSignal) {
  if (drawingId !== undefined && !isNotebookDrawingId(drawingId)) throw new NotebookApiError("This handwriting reference is invalid.", 400);
  const url = new URL(notebookEndpoint());
  url.pathname = `${url.pathname.replace(/\/$/, "")}/drawings${drawingId ? `/${drawingId}` : ""}`;
  url.search = "";
  url.hash = "";
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = setTimeout(abort, 30_000);
  try {
    if (controller.signal.aborted) throw new Error("Cancelled");
    const response = await fetch(url.toString(), {
      method: payload ? "POST" : "GET", credentials: "omit", signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "X-Notebook-Account": accountId, "X-Notebook-Features": NOTEBOOK_HANDWRITING_FEATURES, ...(payload ? { "Content-Type": "application/json" } : {}) },
      ...(payload ? { body: JSON.stringify(drawingPayload(payload)) } : {}),
    });
    const data = await response.json().catch(() => null);
    if (controller.signal.aborted) throw new Error("Cancelled");
    if (!response.ok) throw new NotebookApiError(data?.error || "Handwriting could not be synced. Try again.", response.status, data?.code || "unavailable");
    if (data?.accountId !== accountId) throw new NotebookApiError("Your account changed. Reopen notebooks to continue.", 409, "account_changed");
    const saved = reference(data);
    if (payload && (saved.inkFormat || "pencilkit-v1") !== (payload.inkFormat || "pencilkit-v1")) throw new NotebookApiError("The server returned a different handwriting format. Your draft is retained.", 502);
    if (payload && saved.previewFormat !== payload.previewFormat) throw new NotebookApiError("The server returned a different handwriting preview. Your draft is retained.", 502);
    if (drawingId && saved.drawingId !== drawingId) throw new NotebookApiError("The server returned a different drawing.", 502);
    return { ...data, ...saved };
  } catch (error) {
    if (error instanceof NotebookApiError) throw error;
    throw new NotebookApiError(controller.signal.aborted ? "The handwriting request was cancelled or timed out." : "Could not connect to your handwriting. Try again when online.", 0, "offline");
  } finally { clearTimeout(timeout); signal?.removeEventListener("abort", abort); }
}

export async function loadNotebookDrawing(token: string, accountId: string, drawingId: string, signal?: AbortSignal) {
  const data = await requestDrawing(token, accountId, drawingId, undefined, signal);
  return { ...reference(data), ...drawingPayload(data) };
}

export async function saveNotebookDrawing(token: string, accountId: string, payload: NotebookDrawingPayload, signal?: AbortSignal): Promise<NotebookDrawingReference> {
  return reference(await requestDrawing(token, accountId, undefined, payload, signal));
}
