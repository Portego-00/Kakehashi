import type { WKCollection } from "@/types/wanikani";

const API_ROOT = "/api/wanikani";

export class WaniKaniApiError extends Error {
  constructor(message: string, public status: number, public code?: number, public retryAfterMs?: number) { super(message); this.name = "WaniKaniApiError"; }
}

export interface RequestOptions extends Omit<RequestInit, "body"> { body?: unknown; fresh?: boolean }

export async function wkRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const cleanPath = path.replace(/^https:\/\/api\.wanikani\.com\/v2\//, "").replace(/^\//, "");
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
  return payload as T;
}

export async function wkCollection<T>(path: string, maxPages = 30): Promise<T[]> {
  const records: T[] = [];
  let next: string | null = path;
  let pages = 0;
  while (next && pages < maxPages) {
    const response: WKCollection<T> = await wkRequest<WKCollection<T>>(next);
    records.push(...response.data);
    next = response.pages.next_url;
    pages += 1;
  }
  return records;
}

export function commaList(values: Array<string | number>) { return values.join(","); }
