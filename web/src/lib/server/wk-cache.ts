import "server-only";
import { createHash } from "node:crypto";

type CacheEntry = { expiresAt: number; value: unknown };
type CacheStore = Map<string, CacheEntry>;
type InFlightStore = Map<string, Promise<unknown>>;
type GenerationStore = Map<string, number>;

const shared = globalThis as typeof globalThis & { __kakehashiWkCache?: CacheStore; __kakehashiWkInFlight?: InFlightStore; __kakehashiWkGenerations?: GenerationStore };
const store = shared.__kakehashiWkCache ??= new Map();
const inFlight = shared.__kakehashiWkInFlight ??= new Map();
const generations = shared.__kakehashiWkGenerations ??= new Map();
export const WK_CACHE_MAX_ENTRIES = 500;

function tokenKey(token: string) {
  return createHash("sha256").update(token).digest("base64url");
}

export function wkCacheKey(token: string, resource: string) {
  return `${tokenKey(token)}:${resource}`;
}

export function wkCacheGeneration(token: string) {
  return generations.get(tokenKey(token)) ?? 0;
}

export function versionedWkCacheKey(key: string, generation: number) {
  return `${key}:generation:${generation}`;
}

export function isWkCacheBypass(headers: Pick<Headers, "get">) {
  return headers.get("x-kakehashi-cache") === "bypass";
}

export function readWkCache<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  store.delete(key);
  store.set(key, entry);
  return entry.value as T;
}

export function writeWkCache(key: string, value: unknown, ttlMs: number) {
  store.delete(key);
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
  const now = Date.now();
  for (const [candidate, entry] of store) if (entry.expiresAt <= now) store.delete(candidate);
  while (store.size > WK_CACHE_MAX_ENTRIES) store.delete(store.keys().next().value as string);
}

export function writeWkCacheIfCurrent(token: string, generation: number, key: string, value: unknown, ttlMs: number) {
  if (wkCacheGeneration(token) !== generation) return false;
  writeWkCache(key, value, ttlMs);
  return true;
}

export async function coalesceWkRequest<T>(key: string, load: () => Promise<T>): Promise<T> {
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;
  const next = load().finally(() => {
    if (inFlight.get(key) === next) inFlight.delete(key);
  });
  inFlight.set(key, next);
  return next;
}

export function clearWkCache(token: string) {
  const identity = tokenKey(token);
  const prefix = `${identity}:`;
  generations.set(identity, (generations.get(identity) ?? 0) + 1);
  for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
  for (const key of inFlight.keys()) if (key.startsWith(prefix)) inFlight.delete(key);
}

export function clearWkCacheForTests() {
  store.clear();
  inFlight.clear();
  generations.clear();
}
