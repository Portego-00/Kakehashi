import { NextRequest, NextResponse } from "next/server";
import { readBoundedRequestJson } from "@/features/content/server-security";
import { DEMO_SESSION_COOKIE } from "@/features/demo/constants";
import { NotebookError, parseNotebookMutation, NOTEBOOK_HARD_MAX_BYTES } from "@/features/notebooks/model";
import { analyticsIdentityFromSealedSession } from "@/lib/server/analytics-server";
import { mutateRemoteNotebookState, notebookServerLimits, notebooksBackendConfigured, readRemoteNotebookState } from "@/lib/server/notebooks-server";
import { opaqueRateLimitKey, takeRateLimit } from "@/lib/server/rate-limit";
import { isTrustedMutationOrigin } from "@/lib/server/request-security";
import { WANIKANI_SESSION_COOKIE } from "@/lib/server/wanikani-session";

export const runtime = "nodejs";
function privateResponse(body: unknown, status = 200, additional?: HeadersInit) {
  const headers = new Headers(additional); headers.set("Cache-Control", "private, no-store, max-age=0"); headers.set("Vary", "Cookie"); headers.set("X-Content-Type-Options", "nosniff");
  return NextResponse.json(body, { status, headers });
}
function session(request: NextRequest) {
  if (request.cookies.get(DEMO_SESSION_COOKIE)?.value === "1") return privateResponse({ error: "Demo notebooks are stored in this browser only.", code: "demo" }, 403);
  const sealed = request.cookies.get(WANIKANI_SESSION_COOKIE)?.value;
  return sealed || privateResponse({ error: "Sign in to access your notebooks." }, 401);
}
async function identity(sealed: string) {
  const user = await analyticsIdentityFromSealedSession(sealed);
  if ((!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(user.id) || user.id === "demo-level-21")) throw new NotebookError("A verified WaniKani account is required for cloud notebooks.", "invalid", 403);
  return user;
}
function failure(cause: unknown, action: "loaded" | "saved") {
  if (cause instanceof NotebookError) return privateResponse({ error: cause.message, code: cause.code }, cause.status);
  return privateResponse({ error: `Your notebooks could not be ${action}. Please try again.`, code: "unavailable" }, 503);
}
export async function GET(request: NextRequest) {
  const sealed = session(request); if (typeof sealed !== "string") return sealed;
  const limit = takeRateLimit(opaqueRateLimitKey("notebooks-read", sealed), 240, 10 * 60_000);
  if (!limit.allowed) return privateResponse({ error: "Too many notebook requests." }, 429, { "Retry-After": String(limit.retryAfterSeconds) });
  try {
    const user = await identity(sealed);
    if (!notebooksBackendConfigured()) return privateResponse({ available: false, state: null, revision: -1, limits: notebookServerLimits() });
    return privateResponse({ available: true, ...await readRemoteNotebookState(user.id), limits: notebookServerLimits() });
  } catch (cause) { return failure(cause, "loaded"); }
}
export async function POST(request: NextRequest) {
  if (!isTrustedMutationOrigin(request)) return privateResponse({ error: "This notebook request did not originate from Kakehashi." }, 403);
  const sealed = session(request); if (typeof sealed !== "string") return sealed;
  const limit = takeRateLimit(opaqueRateLimitKey("notebooks-write", sealed), 600, 10 * 60_000);
  if (!limit.allowed) return privateResponse({ error: "Too many notebook updates. Your draft has not been saved yet." }, 429, { "Retry-After": String(limit.retryAfterSeconds) });
  try {
    let payload: unknown;
    try { payload = await readBoundedRequestJson(request, Math.min(notebookServerLimits().maxBytes + 16_384, NOTEBOOK_HARD_MAX_BYTES)); }
    catch { return privateResponse({ error: "The notebook update is invalid or too large.", code: "invalid" }, 400); }
    const mutation = parseNotebookMutation(payload);
    const user = await identity(sealed);
    if (request.headers.get("X-Notebook-Account") !== user.id) return privateResponse({ error: "Your account changed. Reload the notebook before saving.", code: "account_changed" }, 409);
    if (!notebooksBackendConfigured()) return privateResponse({ available: false, state: null, revision: -1, limits: notebookServerLimits() }, 503);
    return privateResponse({ available: true, ...await mutateRemoteNotebookState(user.id, mutation), limits: notebookServerLimits() });
  } catch (cause) { return failure(cause, "saved"); }
}
