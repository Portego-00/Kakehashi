import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  downloadJapaneseVoiceAssets,
  hasSavedJapaneseVoice,
  JAPANESE_VOICE_ASSETS,
  JAPANESE_VOICE_DOWNLOAD_BYTES,
  JAPANESE_VOICE_MODEL_REVISION,
  JAPANESE_VOICE_NAME,
  supportsJapaneseVoice,
} from "./japanese-voice-assets";

const CACHE_SIZE_HEADER = "x-kakehashi-asset-bytes";
const STORAGE_SAFETY_MARGIN = 32 * 1024 * 1024;

function assetUrl(path: string) {
  return `https://huggingface.co/Supertone/supertonic-3/resolve/${JAPANESE_VOICE_MODEL_REVISION}/${path}`;
}

function cacheKey(input: RequestInfo | URL) {
  return input instanceof Request ? input.url : String(input);
}

async function drain(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) return;
  }
}

class MemoryCache {
  readonly entries = new Map<string, Response>();
  readonly match = vi.fn(async (input: RequestInfo | URL) => this.entries.get(cacheKey(input)));
  readonly put = vi.fn(async (input: RequestInfo | URL, response: Response) => {
    await drain(response);
    this.entries.set(cacheKey(input), new Response(null, { status: response.status, headers: response.headers }));
  });

  seed(path: string, storedBytes?: number) {
    const headers = new Headers();
    if (storedBytes !== undefined) headers.set(CACHE_SIZE_HEADER, String(storedBytes));
    this.entries.set(assetUrl(path), new Response(null, { headers }));
  }
}

class MemoryCacheStorage {
  readonly stores = new Map<string, MemoryCache>();
  readonly open = vi.fn(async (name: string) => {
    const current = this.stores.get(name);
    if (current) return current;
    const cache = new MemoryCache();
    this.stores.set(name, cache);
    return cache;
  });
  readonly keys = vi.fn(async () => [...this.stores.keys()]);
  readonly delete = vi.fn(async (name: string) => this.stores.delete(name));

  voiceCache() {
    const cache = [...this.stores.values()][0];
    if (!cache) throw new Error("The Japanese voice cache has not been opened yet.");
    return cache;
  }
}

function streamedResponse(chunkSizes: number[]) {
  let chunkIndex = 0;
  const reader = {
    read: vi.fn(async () => {
      if (chunkIndex >= chunkSizes.length) return { done: true, value: undefined } as const;
      const byteLength = chunkSizes[chunkIndex++];
      return { done: false, value: { byteLength } as Uint8Array } as const;
    }),
    cancel: vi.fn(async () => undefined),
  };
  return {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/octet-stream" }),
    body: { getReader: () => reader },
  } as unknown as Response;
}

function stalledResponse(firstChunkBytes: number) {
  let readCount = 0;
  const reader = {
    read: vi.fn(() => {
      if (readCount++ === 0) {
        return Promise.resolve({ done: false, value: { byteLength: firstChunkBytes } as Uint8Array } as const);
      }
      return new Promise<never>(() => undefined);
    }),
    cancel: vi.fn(async () => undefined),
  };
  const response = {
    ok: true,
    status: 200,
    headers: new Headers({ "content-type": "application/octet-stream" }),
    body: { getReader: () => reader },
  } as unknown as Response;
  return { reader, response };
}

function exactFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = cacheKey(input);
    const asset = JAPANESE_VOICE_ASSETS.find((candidate) => assetUrl(candidate.path) === url);
    if (!asset) throw new Error(`Unexpected Japanese voice URL: ${url}`);
    return streamedResponse([asset.bytes]);
  });
}

describe("Japanese voice asset download", () => {
  let storage: MemoryCacheStorage;
  let navigatorStorageDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    storage = new MemoryCacheStorage();
    navigatorStorageDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "storage");
    vi.stubGlobal("caches", storage as unknown as CacheStorage);
    vi.stubGlobal("Worker", class TestWorker {});
    vi.stubGlobal("AudioContext", class TestAudioContext {});
  });

  afterEach(() => {
    if (navigatorStorageDescriptor) Object.defineProperty(window.navigator, "storage", navigatorStorageDescriptor);
    else Reflect.deleteProperty(window.navigator, "storage");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  function setAvailableStorage(bytes: number) {
    Object.defineProperty(window.navigator, "storage", {
      configurable: true,
      value: { estimate: vi.fn(async () => ({ quota: bytes, usage: 0 })) },
    });
  }

  it("pins the clearer F3 preset for context sentences", () => {
    expect(JAPANESE_VOICE_NAME).toBe("Supertonic 3 · F3");
    expect(JAPANESE_VOICE_ASSETS).toContainEqual({ path: "voice_styles/F3.json", bytes: 290_794 });
    expect(JAPANESE_VOICE_ASSETS.map((asset) => String(asset.path))).not.toContain("voice_styles/F1.json");
  });

  it("reports the voice as unsupported without the required browser capabilities", async () => {
    vi.stubGlobal("Worker", undefined);

    expect(supportsJapaneseVoice()).toBe(false);
    await expect(hasSavedJapaneseVoice()).resolves.toBe(false);
    expect(storage.open).not.toHaveBeenCalled();
  });

  it("requires every cached asset to have its exact declared byte header", async () => {
    expect(supportsJapaneseVoice()).toBe(true);
    await hasSavedJapaneseVoice();
    const cache = storage.voiceCache();
    for (const asset of JAPANESE_VOICE_ASSETS) cache.seed(asset.path, asset.bytes);

    await expect(hasSavedJapaneseVoice()).resolves.toBe(true);

    const mismatched = JAPANESE_VOICE_ASSETS[2];
    cache.seed(mismatched.path, mismatched.bytes - 1);
    await expect(hasSavedJapaneseVoice()).resolves.toBe(false);

    cache.seed(mismatched.path);
    await expect(hasSavedJapaneseVoice()).resolves.toBe(false);
  });

  it("streams every pinned asset with monotonic progress and exact saved byte headers", async () => {
    setAvailableStorage(JAPANESE_VOICE_DOWNLOAD_BYTES + STORAGE_SAFETY_MARGIN + 1);
    const fetchMock = exactFetch();
    vi.stubGlobal("fetch", fetchMock);
    const progress: Array<{ value: number; message: string }> = [];

    await downloadJapaneseVoiceAssets((value, message) => progress.push({ value, message }));

    const cache = storage.voiceCache();
    expect(fetchMock).toHaveBeenCalledTimes(JAPANESE_VOICE_ASSETS.length);
    expect(cache.put).toHaveBeenCalledTimes(JAPANESE_VOICE_ASSETS.length);
    expect([...cache.entries.keys()]).toEqual(JAPANESE_VOICE_ASSETS.map((asset) => assetUrl(asset.path)));
    for (const asset of JAPANESE_VOICE_ASSETS) {
      expect(cache.entries.get(assetUrl(asset.path))?.headers.get(CACHE_SIZE_HEADER)).toBe(String(asset.bytes));
    }
    expect(progress.every((event, index) => index === 0 || event.value >= progress[index - 1].value)).toBe(true);
    expect(progress.every((event, index) => index === 0 || event.value !== progress[index - 1].value || event.message !== progress[index - 1].message)).toBe(true);
    expect(progress.every((event) => event.value >= 0 && event.value <= 100)).toBe(true);
    expect(progress.at(-1)).toEqual({ value: 100, message: "Higher-quality Japanese voice saved." });
    await expect(hasSavedJapaneseVoice()).resolves.toBe(true);
  });

  it("fails a stalled transfer instead of remaining at zero percent indefinitely", async () => {
    vi.useFakeTimers();
    setAvailableStorage(JAPANESE_VOICE_DOWNLOAD_BYTES + STORAGE_SAFETY_MARGIN + 1);
    const stalled = stalledResponse(1);
    stalled.reader.cancel.mockImplementation(() => new Promise<undefined>(() => undefined));
    vi.stubGlobal("fetch", vi.fn(async () => stalled.response));
    const progress: Array<{ value: number; message: string }> = [];
    const result: { outcome: "pending" | "resolved" | Error } = { outcome: "pending" };

    void downloadJapaneseVoiceAssets((value, message) => progress.push({ value, message }))
      .then(() => { result.outcome = "resolved"; }, (error: unknown) => { result.outcome = error instanceof Error ? error : new Error(String(error)); });

    await vi.advanceTimersByTimeAsync(90_001);

    expect(progress.at(-1)).toEqual({ value: 0, message: "Downloading Japanese voice… <1 of 399 MB · file 1 of 8" });
    expect(result.outcome).toBeInstanceOf(Error);
    if (!(result.outcome instanceof Error)) throw new Error("Expected the stalled download to fail.");
    expect(result.outcome.message).toMatch(/timed out/iu);
    expect(stalled.reader.cancel).toHaveBeenCalledOnce();
    expect(storage.voiceCache().entries).toHaveProperty("size", 0);
  });

  it("times out when the voice server never answers", async () => {
    vi.useFakeTimers();
    setAvailableStorage(JAPANESE_VOICE_DOWNLOAD_BYTES + STORAGE_SAFETY_MARGIN + 1);
    const fetchMock = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);
    const download = downloadJapaneseVoiceAssets(vi.fn());
    const failure = expect(download).rejects.toThrow(/timed out/iu);

    await vi.advanceTimersByTimeAsync(90_001);

    await failure;
    expect((fetchMock.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
    expect(storage.voiceCache().put).not.toHaveBeenCalled();
  });

  it("times out when browser storage stops saving a complete response", async () => {
    vi.useFakeTimers();
    setAvailableStorage(JAPANESE_VOICE_DOWNLOAD_BYTES + STORAGE_SAFETY_MARGIN + 1);
    await hasSavedJapaneseVoice();
    const cache = storage.voiceCache();
    cache.put.mockImplementation(async (_input: RequestInfo | URL, response: Response) => {
      await drain(response);
      return new Promise<never>(() => undefined);
    });
    const fetchMock = exactFetch();
    vi.stubGlobal("fetch", fetchMock);
    const download = downloadJapaneseVoiceAssets(vi.fn());
    const failure = expect(download).rejects.toThrow(/timed out/iu);

    await vi.advanceTimersByTimeAsync(90_001);

    await failure;
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(cache.put).toHaveBeenCalledOnce();
    expect(cache.entries).toHaveProperty("size", 0);
  });

  it("cancels immediately while the browser cache is still opening", async () => {
    storage.open.mockImplementationOnce(() => new Promise<MemoryCache>(() => undefined));
    const controller = new AbortController();
    const download = downloadJapaneseVoiceAssets(vi.fn(), { signal: controller.signal });
    const cancellation = expect(download).rejects.toMatchObject({ name: "AbortError" });

    controller.abort(new DOMException("Cancelled by test.", "AbortError"));

    await cancellation;
  });

  it("aborts and safely cancels an active transfer when browser saving fails", async () => {
    setAvailableStorage(JAPANESE_VOICE_DOWNLOAD_BYTES + STORAGE_SAFETY_MARGIN + 1);
    await hasSavedJapaneseVoice();
    const cache = storage.voiceCache();
    cache.put.mockRejectedValue(new Error("Browser cache write failed."));
    const reader = {
      read: vi.fn(() => new Promise<never>(() => undefined)),
      cancel: vi.fn(async () => { throw new Error("Reader cancel failed."); }),
    };
    const response = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/octet-stream" }),
      body: { getReader: () => reader },
    } as unknown as Response;
    const request: { signal: AbortSignal | null } = { signal: null };
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      request.signal = init?.signal ?? null;
      return response;
    }));

    await expect(downloadJapaneseVoiceAssets(vi.fn())).rejects.toThrow("Browser cache write failed.");

    expect(request.signal).not.toBeNull();
    expect(request.signal?.aborted).toBe(true);
    expect(reader.cancel).toHaveBeenCalledOnce();
  });

  it("allows a slow download to continue while data is still arriving", async () => {
    vi.useFakeTimers();
    setAvailableStorage(JAPANESE_VOICE_DOWNLOAD_BYTES + STORAGE_SAFETY_MARGIN + 1);
    const firstAsset = JAPANESE_VOICE_ASSETS[0];
    let firstChunkSent = false;
    const slowReader = {
      read: vi.fn(() => {
        if (firstChunkSent) return Promise.resolve({ done: true, value: undefined } as const);
        firstChunkSent = true;
        return new Promise<ReadableStreamReadResult<Uint8Array>>((resolve) => {
          setTimeout(() => resolve({ done: false, value: { byteLength: firstAsset.bytes } as Uint8Array }), 80_000);
        });
      }),
      cancel: vi.fn(async () => undefined),
    };
    const slowResponse = {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/octet-stream" }),
      body: { getReader: () => slowReader },
    } as unknown as Response;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      const url = cacheKey(input);
      const asset = JAPANESE_VOICE_ASSETS.find((candidate) => assetUrl(candidate.path) === url);
      if (!asset) return Promise.reject(new Error(`Unexpected Japanese voice URL: ${url}`));
      if (asset === firstAsset) return new Promise<Response>((resolve) => setTimeout(() => resolve(slowResponse), 80_000));
      return Promise.resolve(streamedResponse([asset.bytes]));
    });
    vi.stubGlobal("fetch", fetchMock);
    let outcome: "pending" | "resolved" | Error = "pending";

    void downloadJapaneseVoiceAssets(vi.fn())
      .then(() => { outcome = "resolved"; }, (error: unknown) => { outcome = error instanceof Error ? error : new Error(String(error)); });

    await vi.advanceTimersByTimeAsync(80_000);
    expect(outcome).toBe("pending");
    await vi.advanceTimersByTimeAsync(80_001);

    expect(outcome).toBe("resolved");
    expect(slowReader.cancel).not.toHaveBeenCalled();
    await expect(hasSavedJapaneseVoice()).resolves.toBe(true);
  });

  it("resumes a partial download without fetching an exactly saved asset again", async () => {
    await hasSavedJapaneseVoice();
    const cache = storage.voiceCache();
    const savedAsset = JAPANESE_VOICE_ASSETS[3];
    cache.seed(savedAsset.path, savedAsset.bytes);
    setAvailableStorage(JAPANESE_VOICE_DOWNLOAD_BYTES + STORAGE_SAFETY_MARGIN + 1);
    const fetchMock = exactFetch();
    vi.stubGlobal("fetch", fetchMock);
    const progress: number[] = [];

    await downloadJapaneseVoiceAssets((value) => progress.push(value));

    expect(fetchMock).toHaveBeenCalledTimes(JAPANESE_VOICE_ASSETS.length - 1);
    expect(fetchMock.mock.calls.map(([input]) => cacheKey(input))).not.toContain(assetUrl(savedAsset.path));
    expect(progress[0]).toBe(Math.floor((savedAsset.bytes / JAPANESE_VOICE_DOWNLOAD_BYTES) * 100));
    await expect(hasSavedJapaneseVoice()).resolves.toBe(true);
  });

  it("preserves completed files when an interrupted download is retried", async () => {
    setAvailableStorage(JAPANESE_VOICE_DOWNLOAD_BYTES + STORAGE_SAFETY_MARGIN + 1);
    const controller = new AbortController();
    const stalled = stalledResponse(1);
    let signalSecondAssetReading!: () => void;
    const secondAssetReading = new Promise<void>((resolve) => { signalSecondAssetReading = resolve; });
    const firstFetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = cacheKey(input);
      const assetIndex = JAPANESE_VOICE_ASSETS.findIndex((candidate) => assetUrl(candidate.path) === url);
      if (assetIndex < 0) throw new Error(`Unexpected Japanese voice URL: ${url}`);
      if (assetIndex === 1) return stalled.response;
      return streamedResponse([JAPANESE_VOICE_ASSETS[assetIndex].bytes]);
    });
    vi.stubGlobal("fetch", firstFetch);
    const interrupted = downloadJapaneseVoiceAssets((_value, message) => {
      if (message.startsWith("Downloading Japanese voice") && message.endsWith("file 2 of 8")) signalSecondAssetReading();
    }, { signal: controller.signal });
    const cancellation = expect(interrupted).rejects.toMatchObject({ name: "AbortError" });

    await secondAssetReading;
    controller.abort(new DOMException("Cancelled by test.", "AbortError"));
    await cancellation;

    const firstAsset = JAPANESE_VOICE_ASSETS[0];
    expect(storage.voiceCache().entries.has(assetUrl(firstAsset.path))).toBe(true);
    expect(stalled.reader.cancel).toHaveBeenCalledOnce();

    const retryFetch = exactFetch();
    vi.stubGlobal("fetch", retryFetch);
    await downloadJapaneseVoiceAssets(vi.fn());

    expect(retryFetch).toHaveBeenCalledTimes(JAPANESE_VOICE_ASSETS.length - 1);
    expect(retryFetch.mock.calls.map(([input]) => cacheKey(input))).not.toContain(assetUrl(firstAsset.path));
    await expect(hasSavedJapaneseVoice()).resolves.toBe(true);
  });

  it("honors cancellation after the final file is saved but before completion is reported", async () => {
    setAvailableStorage(JAPANESE_VOICE_DOWNLOAD_BYTES + STORAGE_SAFETY_MARGIN + 1);
    const controller = new AbortController();
    await hasSavedJapaneseVoice();
    const cache = storage.voiceCache();
    cache.put.mockImplementation(async (input: RequestInfo | URL, response: Response) => {
      await drain(response);
      cache.entries.set(cacheKey(input), new Response(null, { status: response.status, headers: response.headers }));
      if (cache.entries.size === JAPANESE_VOICE_ASSETS.length) {
        controller.abort(new DOMException("Cancelled by test.", "AbortError"));
      }
    });
    vi.stubGlobal("fetch", exactFetch());
    const progress: Array<{ value: number; message: string }> = [];

    await expect(downloadJapaneseVoiceAssets((value, message) => progress.push({ value, message }), { signal: controller.signal }))
      .rejects.toMatchObject({ name: "AbortError" });

    expect(progress.at(-1)).not.toEqual({ value: 100, message: "Higher-quality Japanese voice saved." });
  });

  it("rejects a size mismatch without saving or reporting a complete voice", async () => {
    setAvailableStorage(JAPANESE_VOICE_DOWNLOAD_BYTES + STORAGE_SAFETY_MARGIN + 1);
    const firstAsset = JAPANESE_VOICE_ASSETS[0];
    vi.stubGlobal("fetch", vi.fn(async () => streamedResponse([firstAsset.bytes - 1])));
    const progress: Array<{ value: number; message: string }> = [];

    await expect(downloadJapaneseVoiceAssets((value, message) => progress.push({ value, message })))
      .rejects.toThrow(`Japanese voice asset ${firstAsset.path} had an unexpected size.`);

    const cache = storage.voiceCache();
    expect(cache.entries).toHaveProperty("size", 0);
    expect(progress.at(-1)?.message).not.toBe("Higher-quality Japanese voice saved.");
    await expect(hasSavedJapaneseVoice()).resolves.toBe(false);
  });

  it("rejects insufficient storage before starting any network transfer", async () => {
    setAvailableStorage(JAPANESE_VOICE_DOWNLOAD_BYTES + STORAGE_SAFETY_MARGIN - 1);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(downloadJapaneseVoiceAssets(vi.fn()))
      .rejects.toThrow("There is not enough browser storage for the higher-quality Japanese voice.");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(storage.voiceCache().put).not.toHaveBeenCalled();
  });
});
