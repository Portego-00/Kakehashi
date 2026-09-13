import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { DEMO_SESSION_COOKIE } from "@/features/demo/constants";
import { canAccessNotebooks } from "@/features/notebooks/access";
import { NOTEBOOK_DRAWING_MAX_REQUEST_BYTES } from "@/features/notebooks/handwriting";
import { NotebookError } from "@/features/notebooks/model";
import { readBoundedJson } from "@/features/content/server-security";
import { analyticsIdentityFromSealedSession } from "./analytics-server";
import { NativeNotebookAccessError, nativeNotebookIdentity, nativeNotebookToken } from "./native-notebook-access";
import { opaqueRateLimitKey, takeRateLimit } from "./rate-limit";
import { clientAddress } from "./request-security";
import { WANIKANI_SESSION_COOKIE } from "./wanikani-session";

export function drawingResponseHeaders(native: boolean) {
  return { "Cache-Control": "private, no-store, max-age=0", Vary: native ? "Authorization, X-Notebook-Account" : "Cookie", "X-Content-Type-Options": "nosniff" };
}
export function drawingResponse(body: unknown, native = true, status = 200, additional?: HeadersInit) {
  const headers = new Headers(drawingResponseHeaders(native));
  new Headers(additional).forEach((value, key) => headers.set(key, value));
  return NextResponse.json(body, { status, headers });
}
export function drawingFailure(cause: unknown, native = true) {
  if (cause instanceof NativeNotebookAccessError) return drawingResponse({ error: cause.message, code: cause.code }, native, cause.status, {
    ...(cause.status === 401 ? { "WWW-Authenticate": 'Bearer realm="notebooks"' } : {}),
    ...(cause.retryAfter ? { "Retry-After": cause.retryAfter } : {}),
  });
  if (cause instanceof NotebookError) return drawingResponse({ error: cause.message, code: cause.code }, native, cause.status);
  return drawingResponse({ error: "This handwriting could not be loaded or saved. Please try again.", code: "unavailable" }, native, 503);
}
function limit(key: string, count: number) {
  const result = takeRateLimit(key, count, 10 * 60_000);
  if (!result.allowed) throw new NativeNotebookAccessError("Too many handwriting requests. Please try again shortly.", "rate_limited", 429, String(result.retryAfterSeconds));
}
export async function nativeDrawingIdentity(request: NextRequest, action: "read" | "write") {
  limit(opaqueRateLimitKey("notebooks-drawings-address", clientAddress(request)), 1_000);
  const token = nativeNotebookToken(request);
  limit(opaqueRateLimitKey(`notebooks-drawings-${action}`, token), action === "write" ? 60 : 240);
  const user = await nativeNotebookIdentity(token, request.signal);
  if (request.headers.get("X-Notebook-Account") !== user.id) throw new NotebookError("Your account changed. Reload the notebook before continuing.", "conflict");
  return user;
}
export async function webDrawingIdentity(request: NextRequest) {
  if (request.cookies.get(DEMO_SESSION_COOKIE)?.value === "1") throw new NativeNotebookAccessError("Notebooks are not available in demo mode.", "forbidden", 403);
  const sealed = request.cookies.get(WANIKANI_SESSION_COOKIE)?.value;
  if (!sealed) throw new NativeNotebookAccessError("Sign in to access your notebooks.", "unauthorized", 401);
  limit(opaqueRateLimitKey("notebooks-drawings-web", sealed), 240);
  const user = await analyticsIdentityFromSealedSession(sealed);
  if (user.id === "demo-level-21" || !/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(user.id) || !canAccessNotebooks(user.username)) throw new NativeNotebookAccessError("Notebooks are not available for this account.", "forbidden", 403);
  return user;
}
export async function readDrawingUploadBody(request: NextRequest) {
  if (!request.headers.get("Content-Type")?.match(/^application\/json(?:\s*;|$)/i)) throw new NotebookError("The handwriting upload must use JSON.", "invalid", 415);
  try {
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]);
    const body = request.body?.pipeThrough(new TransformStream<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>(), { signal }) ?? null;
    return await readBoundedJson({ body, headers: request.headers }, NOTEBOOK_DRAWING_MAX_REQUEST_BYTES);
  } catch { throw new NotebookError("The handwriting upload is invalid or too large.", "invalid"); }
}
