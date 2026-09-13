import "server-only";

import { getWaniKaniSessionUser, SessionUpstreamError } from "@/lib/server/wanikani-session";
import { waniKaniUserId } from "@/lib/wanikani/user-identity";

export class NativeNotebookAccessError extends Error {
  constructor(
    message: string,
    public code: "unauthorized" | "forbidden" | "unavailable" | "rate_limited",
    public status: number,
    public retryAfter?: string,
  ) {
    super(message);
    this.name = "NativeNotebookAccessError";
  }
}

export function nativeNotebookToken(request: Pick<Request, "headers">): string {
  const authorization = request.headers.get("Authorization") || "";
  const token = authorization.match(/^Bearer ([A-Za-z0-9._~+/-]{20,256}={0,2})$/i)?.[1];
  if (!token) throw new NativeNotebookAccessError("Sign in to access your notebooks.", "unauthorized", 401);
  return token;
}

/** Uses the same verified opaque account ID as the browser notebook endpoint. */
export async function nativeNotebookIdentity(token: string, signal?: AbortSignal): Promise<{ id: string }> {
  signal?.throwIfAborted();
  let payload: unknown;
  try {
    // The shared verifier coalesces requests, caches for five minutes, and has a ten-second timeout.
    payload = await getWaniKaniSessionUser(token);
  } catch (cause) {
    if (cause instanceof SessionUpstreamError && [401, 403].includes(cause.status)) {
      throw new NativeNotebookAccessError("Your WaniKani token is no longer authorized. Sign in again.", "unauthorized", 401);
    }
    if (cause instanceof SessionUpstreamError && cause.status === 429) {
      const seconds = Number(cause.retryAfter);
      const retryAfter = Number.isSafeInteger(seconds) && seconds > 0 ? String(Math.min(seconds, 3_600)) : "60";
      throw new NativeNotebookAccessError("WaniKani is busy. Try loading your notebooks again shortly.", "rate_limited", 429, retryAfter);
    }
    throw new NativeNotebookAccessError("WaniKani could not verify your account. Please try again.", "unavailable", 503);
  }
  signal?.throwIfAborted();
  const id = waniKaniUserId(payload);
  const user = payload as { data?: { username?: unknown } } | null;
  const username = typeof user?.data?.username === "string" ? user.data.username.trim() : "";
  if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(id) || id === "demo-level-21" || !username) {
    throw new NativeNotebookAccessError("WaniKani could not verify your account. Please try again.", "unavailable", 503);
  }
  if (username.toLowerCase() !== "portego") {
    throw new NativeNotebookAccessError("Mobile notebooks are not available for this account.", "forbidden", 403);
  }
  return { id };
}
