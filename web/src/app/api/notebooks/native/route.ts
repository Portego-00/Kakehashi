import { NextRequest, NextResponse } from "next/server";
import { readBoundedJson } from "@/features/content/server-security";
import { NotebookError, parseNotebookMutation, NOTEBOOK_HARD_MAX_BYTES } from "@/features/notebooks/model";
import { NativeNotebookAccessError, nativeNotebookIdentity, nativeNotebookToken } from "@/lib/server/native-notebook-access";
import { mutateRemoteNotebookState, notebookServerLimits, notebooksBackendConfigured, readRemoteNotebookState } from "@/lib/server/notebooks-server";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { clientAddress } from "@/lib/server/request-security";

export const runtime = "nodejs";

function privateResponse(body: unknown, status = 200, additional?: HeadersInit) {
  const headers = new Headers(additional);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("Vary", "Authorization");
  headers.set("X-Content-Type-Options", "nosniff");
  return NextResponse.json(body, { status, headers });
}

function limitedToken(request: NextRequest, action: "read" | "write") {
  // Bound token spraying before making a WaniKani request; tokens never appear in limiter keys.
  const addressLimit = takeRateLimit(opaqueRateLimitKey("notebooks-native-address", clientAddress(request)), 1_200, 10 * 60_000);
  if (!addressLimit.allowed) throw new NativeNotebookAccessError("Too many notebook requests.", "rate_limited", 429, String(addressLimit.retryAfterSeconds));
  const token = nativeNotebookToken(request);
  const limit = takeRateLimit(opaqueRateLimitKey(`notebooks-native-${action}`, token), action === "read" ? 240 : 600, 10 * 60_000);
  if (!limit.allowed) throw new NativeNotebookAccessError("Too many notebook requests. Please try again shortly.", "rate_limited", 429, String(limit.retryAfterSeconds));
  return token;
}

function failure(cause: unknown, action: "loaded" | "saved") {
  if (cause instanceof NativeNotebookAccessError) {
    const headers = new Headers();
    if (cause.status === 401) headers.set("WWW-Authenticate", 'Bearer realm="notebooks"');
    if (cause.retryAfter) headers.set("Retry-After", cause.retryAfter);
    return privateResponse({ error: cause.message, code: cause.code }, cause.status, headers);
  }
  if (cause instanceof NotebookError) return privateResponse({ error: cause.message, code: cause.code }, cause.status);
  return privateResponse({ error: `Your notebooks could not be ${action}. Please try again.`, code: "unavailable" }, 503);
}

export async function GET(request: NextRequest) {
  try {
    const user = await nativeNotebookIdentity(limitedToken(request, "read"), request.signal);
    if (!notebooksBackendConfigured()) return privateResponse({ available: false, accountId: user.id, state: null, revision: -1, limits: notebookServerLimits() });
    const stored = await readRemoteNotebookState(user.id);
    return privateResponse({ available: true, accountId: user.id, ...stored, limits: notebookServerLimits() });
  } catch (cause) { return failure(cause, "loaded"); }
}

export async function POST(request: NextRequest) {
  try {
    // Native requests authenticate explicitly with a bearer token; browser cookies are never read here.
    const user = await nativeNotebookIdentity(limitedToken(request, "write"), request.signal);
    if (request.headers.get("X-Notebook-Account") !== user.id) {
      return privateResponse({ error: "Your account changed. Reload the notebook before saving.", code: "account_changed" }, 409);
    }
    if (!request.headers.get("Content-Type")?.match(/^application\/json(?:\s*;|$)/i)) {
      return privateResponse({ error: "The notebook update must use JSON.", code: "invalid" }, 415);
    }
    let payload: unknown;
    try {
      const signal = AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]);
      const body = request.body?.pipeThrough(new TransformStream<Uint8Array<ArrayBuffer>, Uint8Array<ArrayBuffer>>(), { signal }) ?? null;
      payload = await readBoundedJson({ body, headers: request.headers }, Math.min(notebookServerLimits().maxBytes + 16_384, NOTEBOOK_HARD_MAX_BYTES));
    } catch {
      return privateResponse({ error: "The notebook update is invalid or too large.", code: "invalid" }, 400);
    }
    const mutation = parseNotebookMutation(payload);
    request.signal.throwIfAborted();
    if (!notebooksBackendConfigured()) return privateResponse({ available: false, accountId: user.id, state: null, revision: -1, limits: notebookServerLimits() }, 503);
    const stored = await mutateRemoteNotebookState(user.id, mutation);
    return privateResponse({ available: true, accountId: user.id, ...stored, limits: notebookServerLimits() });
  } catch (cause) { return failure(cause, "saved"); }
}
