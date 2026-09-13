import "server-only";
import { createHash } from "node:crypto";

type Bucket = { count: number; resetsAt: number };
type LimitStore = Map<string, Bucket>;
const shared = globalThis as typeof globalThis & { __kakehashiRateLimits?: LimitStore };
const buckets = shared.__kakehashiRateLimits ??= new Map();

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

export function opaqueRateLimitKey(scope: string, identity: string) {
  return `${scope}:${createHash("sha256").update(identity).digest("base64url")}`;
}

export function takeRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const current = buckets.get(key);
  const bucket = !current || current.resetsAt <= now ? { count: 0, resetsAt: now + windowMs } : current;
  bucket.count += 1;
  buckets.delete(key);
  buckets.set(key, bucket);

  while (buckets.size > 2_000) buckets.delete(buckets.keys().next().value as string);
  const remaining = Math.max(0, limit - bucket.count);
  return {
    allowed: bucket.count <= limit,
    limit,
    remaining,
    resetAt: bucket.resetsAt,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetsAt - now) / 1_000)),
  };
}

export function clearRateLimitsForTests() {
  buckets.clear();
}
