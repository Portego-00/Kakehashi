import "server-only";

import {
  coalesceWkRequest,
  readWkCache,
  versionedWkCacheKey,
  wkCacheGeneration,
  wkCacheKey,
  writeWkCacheIfCurrent,
} from "@/lib/server/wk-cache";

export const WANIKANI_SESSION_COOKIE = "kakehashi_wk_session";

export class SessionUpstreamError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter?: string,
    public resetAt?: string,
  ) {
    super(message);
  }
}

export async function getWaniKaniSessionUser(token: string) {
  const cacheKey = wkCacheKey(token, "session:user");
  const cached = readWkCache<unknown>(cacheKey);
  if (cached !== undefined) return cached;

  const generation = wkCacheGeneration(token);
  return coalesceWkRequest(versionedWkCacheKey(cacheKey, generation), async () => {
    let response: Response;
    try {
      response = await fetch("https://api.wanikani.com/v2/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Wanikani-Revision": "20170710",
          Accept: "application/json",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new SessionUpstreamError("WaniKani could not be reached. Your session is still active.", 502);
    }

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = response.status === 401 || response.status === 403
        ? "That WaniKani API token is not valid."
        : payload?.error || "WaniKani could not verify this token right now.";
      throw new SessionUpstreamError(
        message,
        response.status,
        response.headers.get("retry-after") || undefined,
        response.headers.get("ratelimit-reset") || undefined,
      );
    }

    writeWkCacheIfCurrent(token, generation, cacheKey, payload, 5 * 60_000);
    return payload;
  });
}
