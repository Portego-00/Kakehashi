/** Retry-After may be seconds or an HTTP date; WaniKani's reset is epoch seconds. */
export function rateLimitDelay(headers: Pick<Headers, "get">, fallback = 5_000, now = Date.now()) {
  const retryAfter = headers.get("retry-after");
  if (retryAfter !== null) {
    const seconds = Number(retryAfter);
    const delay = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(retryAfter) - now;
    if (Number.isFinite(delay) && delay >= 0) return Math.max(1_000, delay);
  }
  const reset = Number(headers.get("ratelimit-reset")) * 1_000;
  return reset > now ? reset - now : fallback;
}

export function waitForRetry(ms: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal?.reason ?? new DOMException("Aborted", "AbortError")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, Math.min(ms, 2_147_483_647));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}
