import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  downloadMangaOcrModel,
  getMangaOcrModelStatus,
  MANGA_OCR_MODEL_ASSETS,
  MANGA_OCR_MODEL_CACHE,
  MANGA_OCR_MODEL_TOTAL_BYTES,
  MANGA_OCR_MODEL_URLS,
  type MangaOcrModelDownloadProgress,
} from "../manga-ocr-assets";

function cacheKey(input: RequestInfo | URL) {
  return input instanceof Request ? input.url : String(input);
}

class MemoryCache {
  readonly entries = new Map<string, Response>();
  readonly match = vi.fn(async (input: RequestInfo | URL) => this.entries.get(cacheKey(input))?.clone());
  readonly put = vi.fn(async (input: RequestInfo | URL, response: Response) => {
    this.entries.set(cacheKey(input), response.clone());
  });

  seed(url: string) {
    this.entries.set(url, new Response("cached"));
  }
}

class MemoryCacheStorage {
  readonly stores = new Map<string, MemoryCache>();
  readonly open = vi.fn(async (name: string) => {
    const existing = this.stores.get(name);
    if (existing) return existing;
    const cache = new MemoryCache();
    this.stores.set(name, cache);
    return cache;
  });
  readonly keys = vi.fn(async () => [...this.stores.keys()]);
  readonly delete = vi.fn(async (name: string) => this.stores.delete(name));

  modelCache() {
    const existing = this.stores.get(MANGA_OCR_MODEL_CACHE);
    if (existing) return existing;
    const cache = new MemoryCache();
    this.stores.set(MANGA_OCR_MODEL_CACHE, cache);
    return cache;
  }
}

function streamedResponse(chunkSizes: number[], options: { ok?: boolean; status?: number } = {}) {
  let chunkIndex = 0;
  const reader = {
    read: vi.fn(async () => {
      if (chunkIndex >= chunkSizes.length) return { done: true, value: undefined } as const;
      const byteLength = chunkSizes[chunkIndex++];
      return { done: false, value: { byteLength } as Uint8Array } as const;
    }),
  };
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: new Headers({ "content-type": "application/octet-stream" }),
    body: { getReader: () => reader },
  } as unknown as Response;
}

function exactFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = cacheKey(input);
    const asset = MANGA_OCR_MODEL_ASSETS.find((candidate) => MANGA_OCR_MODEL_URLS[candidate.id] === url);
    if (!asset) throw new Error(`Unexpected model URL: ${url}`);
    const firstChunk = Math.floor(asset.size / 2);
    return streamedResponse([firstChunk, asset.size - firstChunk]);
  });
}

describe("manga OCR model asset cache", () => {
  let storage: MemoryCacheStorage;

  beforeEach(() => {
    storage = new MemoryCacheStorage();
    vi.stubGlobal("caches", storage as unknown as CacheStorage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses a complete cache without fetching the model again", async () => {
    const cache = storage.modelCache();
    for (const asset of MANGA_OCR_MODEL_ASSETS) cache.seed(MANGA_OCR_MODEL_URLS[asset.id]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const progress: MangaOcrModelDownloadProgress[] = [];

    await downloadMangaOcrModel({ onProgress: (event) => progress.push(event) });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
    expect(progress.map((event) => event.loadedBytes)).toEqual(MANGA_OCR_MODEL_ASSETS.map((_, index) => (
      MANGA_OCR_MODEL_ASSETS.slice(0, index + 1).reduce((total, asset) => total + asset.size, 0)
    )));
    await expect(getMangaOcrModelStatus()).resolves.toEqual({
      downloadedBytes: MANGA_OCR_MODEL_TOTAL_BYTES,
      ready: true,
      totalBytes: MANGA_OCR_MODEL_TOTAL_BYTES,
    });
  });

  it("reports exact monotonic byte progress across every streamed asset", async () => {
    vi.stubGlobal("fetch", exactFetch());
    const progress: MangaOcrModelDownloadProgress[] = [];

    await downloadMangaOcrModel({ onProgress: (event) => progress.push(event) });

    const expectedLoadedBytes: number[] = [];
    let completedBytes = 0;
    for (const asset of MANGA_OCR_MODEL_ASSETS) {
      const firstChunk = Math.floor(asset.size / 2);
      expectedLoadedBytes.push(completedBytes + firstChunk, completedBytes + asset.size, completedBytes + asset.size);
      completedBytes += asset.size;
    }
    expect(progress.map((event) => event.loadedBytes)).toEqual(expectedLoadedBytes);
    expect(progress.every((event) => event.totalBytes === MANGA_OCR_MODEL_TOTAL_BYTES)).toBe(true);
    expect(progress.every((event, index) => index === 0 || event.loadedBytes >= progress[index - 1].loadedBytes)).toBe(true);
    expect(progress.at(-1)?.loadedBytes).toBe(MANGA_OCR_MODEL_TOTAL_BYTES);
  });

  it("writes every completed asset and reports full readiness", async () => {
    const cache = storage.modelCache();
    const fetchMock = exactFetch();
    vi.stubGlobal("fetch", fetchMock);

    await downloadMangaOcrModel();

    expect(fetchMock).toHaveBeenCalledTimes(MANGA_OCR_MODEL_ASSETS.length);
    expect(cache.put).toHaveBeenCalledTimes(MANGA_OCR_MODEL_ASSETS.length);
    expect([...cache.entries.keys()]).toEqual(MANGA_OCR_MODEL_ASSETS.map((asset) => MANGA_OCR_MODEL_URLS[asset.id]));
    for (const asset of MANGA_OCR_MODEL_ASSETS) {
      expect(cache.entries.get(MANGA_OCR_MODEL_URLS[asset.id])?.headers.get("x-kakehashi-model-bytes")).toBe(String(asset.size));
    }
    await expect(getMangaOcrModelStatus()).resolves.toEqual({
      downloadedBytes: MANGA_OCR_MODEL_TOTAL_BYTES,
      ready: true,
      totalBytes: MANGA_OCR_MODEL_TOTAL_BYTES,
    });
  });

  it("does not cache a short model response", async () => {
    const cache = storage.modelCache();
    const firstAsset = MANGA_OCR_MODEL_ASSETS[0];
    vi.stubGlobal("fetch", vi.fn(async () => streamedResponse([firstAsset.size - 1])));

    await expect(downloadMangaOcrModel()).rejects.toThrow(/did not match the pinned OCR model/iu);

    expect(cache.put).not.toHaveBeenCalled();
    expect(cache.entries).toHaveProperty("size", 0);
    await expect(getMangaOcrModelStatus()).resolves.toMatchObject({ downloadedBytes: 0, ready: false });
  });

  it("does not cache a failed model response", async () => {
    const cache = storage.modelCache();
    vi.stubGlobal("fetch", vi.fn(async () => streamedResponse([], { ok: false, status: 503 })));

    await expect(downloadMangaOcrModel()).rejects.toThrow("OCR model download failed (503).");

    expect(cache.put).not.toHaveBeenCalled();
    expect(cache.entries).toHaveProperty("size", 0);
  });

  it("shares one transfer and its progress between concurrent callers", async () => {
    const fetchMock = exactFetch();
    vi.stubGlobal("fetch", fetchMock);
    const firstProgress: MangaOcrModelDownloadProgress[] = [];
    const secondProgress: MangaOcrModelDownloadProgress[] = [];

    const first = downloadMangaOcrModel({ onProgress: (event) => firstProgress.push(event) });
    const second = downloadMangaOcrModel({ onProgress: (event) => secondProgress.push(event) });
    await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(MANGA_OCR_MODEL_ASSETS.length);
    expect(secondProgress).toEqual(firstProgress);
    expect(firstProgress.at(-1)?.loadedBytes).toBe(MANGA_OCR_MODEL_TOTAL_BYTES);
  });
});
