import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { clearWkCache, clearWkCacheForTests, coalesceWkRequest, isWkCacheBypass, readWkCache, versionedWkCacheKey, wkCacheGeneration, wkCacheKey, WK_CACHE_MAX_ENTRIES, writeWkCache, writeWkCacheIfCurrent } from "./wk-cache";

describe("WaniKani server cache", () => {
  beforeEach(() => clearWkCacheForTests());

  it("evicts the least-recently-used entry at the hard limit", () => {
    for (let index = 0; index <= WK_CACHE_MAX_ENTRIES; index += 1) writeWkCache(`key-${index}`, index, 60_000);
    expect(readWkCache("key-0")).toBeUndefined();
    expect(readWkCache(`key-${WK_CACHE_MAX_ENTRIES}`)).toBe(WK_CACHE_MAX_ENTRIES);
  });

  it("coalesces concurrent upstream work", async () => {
    let resolve!: (value: number) => void;
    const load = vi.fn(() => new Promise<number>((done) => { resolve = done; }));
    const first = coalesceWkRequest("same", load);
    const second = coalesceWkRequest("same", load);
    resolve(7);
    await expect(Promise.all([first, second])).resolves.toEqual([7, 7]);
    expect(load).toHaveBeenCalledOnce();
  });

  it("does not let an in-flight pre-mutation response repopulate the cache", async () => {
    const token = "token-for-generation-test";
    const key = wkCacheKey(token, "assignments/9");
    const oldGeneration = wkCacheGeneration(token);
    let resolveOld!: (value: string) => void;
    const oldRequest = coalesceWkRequest(versionedWkCacheKey(key, oldGeneration), () => new Promise<string>((resolve) => { resolveOld = resolve; }));

    clearWkCache(token);
    const newGeneration = wkCacheGeneration(token);
    expect(newGeneration).toBe(oldGeneration + 1);
    expect(writeWkCacheIfCurrent(token, newGeneration, key, "fresh", 60_000)).toBe(true);

    resolveOld("stale");
    const stale = await oldRequest;
    expect(writeWkCacheIfCurrent(token, oldGeneration, key, stale, 60_000)).toBe(false);
    expect(readWkCache(key)).toBe("fresh");
  });

  it("recognizes only the explicit reconciliation cache bypass", () => {
    expect(isWkCacheBypass(new Headers({ "X-Kakehashi-Cache": "bypass" }))).toBe(true);
    expect(isWkCacheBypass(new Headers({ "X-Kakehashi-Cache": "refresh" }))).toBe(false);
  });
});
