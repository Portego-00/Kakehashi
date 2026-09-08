import { createNotebookState, DEFAULT_NOTEBOOK_LIMITS, NOTEBOOK_HARD_MAX_BYTES, validateNotebookState, type NotebookLimits, type NotebookMutation, type NotebookState } from "./model";

export interface NotebookResponse {
  available: boolean;
  accountId: string;
  state: NotebookState;
  revision: number;
  limits: NotebookLimits;
  sentenceId?: string;
}

export class NotebookApiError extends Error {
  constructor(message: string, public status: number, public code = "unavailable") {
    super(message);
    this.name = "NotebookApiError";
  }
}

export function parseNotebookResponse(input: unknown): NotebookResponse {
  if (!input || typeof input !== "object") throw new NotebookApiError("The notebook server returned an incomplete response.", 502);
  const value = input as Record<string, unknown>;
  if (typeof value.available !== "boolean" || typeof value.accountId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(value.accountId) || !Number.isSafeInteger(value.revision) || Number(value.revision) < -1) {
    throw new NotebookApiError("The notebook server returned an incomplete response.", 502);
  }
  const rawLimits = value.limits as Partial<NotebookLimits> | undefined;
  const limits = { ...DEFAULT_NOTEBOOK_LIMITS };
  for (const key of Object.keys(limits) as (keyof NotebookLimits)[]) {
    if (rawLimits && Number.isSafeInteger(rawLimits[key]) && Number(rawLimits[key]) > 0) limits[key] = Number(rawLimits[key]);
  }
  limits.maxBytes = Math.min(limits.maxBytes, NOTEBOOK_HARD_MAX_BYTES);
  if (value.available && !value.state) throw new NotebookApiError("The notebook server did not return your pages.", 502);
  let state: NotebookState;
  try { state = value.state ? validateNotebookState(value.state, { ...limits, maxBytes: NOTEBOOK_HARD_MAX_BYTES }) : createNotebookState(); }
  catch { throw new NotebookApiError("The notebook server returned invalid page data. Your local draft is retained.", 502); }
  return {
    available: value.available,
    accountId: value.accountId,
    state,
    revision: Number(value.revision),
    limits,
    ...(typeof value.sentenceId === "string" ? { sentenceId: value.sentenceId } : {}),
  };
}

export function notebookEndpoint(configured = process.env.EXPO_PUBLIC_NOTEBOOKS_API_URL?.trim()): string {
  if (!configured) throw new NotebookApiError("Notebooks are not connected in this version of the app yet.", 503, "not_configured");
  let url: URL;
  try { url = new URL(configured); }
  catch { throw new NotebookApiError("The notebook connection is not configured correctly.", 503, "not_configured"); }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "10.0.2.2";
  if (url.username || url.password || (url.protocol !== "https:" && !(typeof __DEV__ !== "undefined" && __DEV__ && local && url.protocol === "http:"))) {
    throw new NotebookApiError("The notebook connection must use HTTPS.", 503, "not_configured");
  }
  return url.toString();
}

export async function requestNotebookCloud(token: string, accountId: string, mutation?: NotebookMutation, signal?: AbortSignal): Promise<NotebookResponse> {
  const url = notebookEndpoint();
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  const timeout = setTimeout(abort, 25_000);
  try {
    if (controller.signal.aborted) throw new Error("Request cancelled.");
    const response = await fetch(url, {
      method: mutation ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json", ...(mutation ? { "Content-Type": "application/json", "X-Notebook-Account": accountId } : {}) },
      ...(mutation ? { body: JSON.stringify(mutation) } : {}),
      signal: controller.signal,
      credentials: "omit",
    });
    const data = await response.json().catch(() => null);
    if (controller.signal.aborted) throw new Error("Request cancelled.");
    if (!response.ok) throw new NotebookApiError(typeof data?.error === "string" ? data.error : "Your notebooks could not be reached. Try again.", response.status, typeof data?.code === "string" ? data.code : "unavailable");
    const parsed = parseNotebookResponse(data);
    if (parsed.accountId !== accountId) throw new NotebookApiError("Your account changed. Reopen notebooks to continue.", 409, "account_changed");
    return parsed;
  } catch (cause) {
    if (cause instanceof NotebookApiError) throw cause;
    const message = signal?.aborted ? "The notebook request was cancelled. Your draft is still on this device."
      : controller.signal.aborted ? "The notebook connection timed out. Your draft is still on this device."
      : "Could not connect. Your draft is still on this device.";
    throw new NotebookApiError(message, 0, "offline");
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
