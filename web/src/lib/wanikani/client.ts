import type { WKCollection } from "@/types/wanikani";
import { isDemoMode } from "@/features/demo/runtime";
import { captureReviewRecordingContext, recordCompletedWaniKaniReview } from "@/features/progress/analytics-review-ledger";

const API_ROOT = "/api/wanikani";

export class WaniKaniApiError extends Error {
  constructor(message: string, public status: number, public code?: number, public retryAfterMs?: number) { super(message); this.name = "WaniKaniApiError"; }
}

export interface RequestOptions extends Omit<RequestInit, "body"> { body?: unknown; fresh?: boolean }

export async function wkRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (isDemoMode()) {
    const { demoWaniKaniRequest } = await import("@/features/demo/wanikani");
    return demoWaniKaniRequest<T>(path, options);
  }
  const cleanPath = path.replace(/^https:\/\/api\.wanikani\.com\/v2\//, "").replace(/^\//, "");
  const recordingContext = cleanPath === "reviews" && options.method?.toUpperCase() === "POST" ? captureReviewRecordingContext() : null;
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.fresh) headers.set("X-Kakehashi-Cache", "bypass");
  const body = options.body;
  const requestOptions = { ...options };
  delete requestOptions.body;
  delete requestOptions.fresh;

  const response = await fetch(`${API_ROOT}/${cleanPath}`, {
    ...requestOptions,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const resetAt = Number(response.headers.get("ratelimit-reset"));
    const retryAfter = Number(response.headers.get("retry-after"));
    const retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Number.isFinite(resetAt) && resetAt > 0 ? Math.max(0, resetAt * 1000 - Date.now()) : undefined;
    throw new WaniKaniApiError(payload?.error || "WaniKani request failed.", response.status, payload?.code, retryAfterMs);
  }
  if (recordingContext) recordCompletedWaniKaniReview(recordingContext, payload);
  return payload as T;
}

export async function wkCollection<T>(path: string, maxPages = 30, options: RequestOptions = {}): Promise<T[]> {
  const records: T[] = [];
  let next: string | null = path;
  let pages = 0;
  const visited = new Set<string>();
  while (next && pages < maxPages) {
    if (visited.has(next)) throw new WaniKaniApiError("WaniKani returned a repeated collection page. Please try again.", 502);
    visited.add(next);
    const response: WKCollection<T> = await wkRequest<WKCollection<T>>(next, options);
    records.push(...response.data);
    next = response.pages.next_url;
    pages += 1;
  }
  if (next) throw new WaniKaniApiError("This WaniKani collection exceeded the page limit. Please retry with a narrower date range.", 422);
  return records;
}

export function commaList(values: Array<string | number>) { return values.join(","); }
