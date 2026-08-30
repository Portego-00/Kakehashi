import * as ReactRuntime from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  JAPANESE_VOICE_ASSETS,
  JAPANESE_VOICE_DOWNLOAD_BYTES,
  JAPANESE_VOICE_MODEL_REVISION,
} from "./japanese-voice-assets";
import type { JapaneseVoiceWorkerRequest, JapaneseVoiceWorkerResponse } from "./japanese-voice-protocol";

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

  seedCompleteVoice() {
    for (const asset of JAPANESE_VOICE_ASSETS) {
      this.entries.set(assetUrl(asset.path), new Response(null, {
        headers: { [CACHE_SIZE_HEADER]: String(asset.bytes) },
      }));
    }
  }
}

class MemoryCacheStorage {
  readonly cache = new MemoryCache();
  readonly openedNames = new Set<string>();
  readonly open = vi.fn(async (name: string) => {
    this.openedNames.add(name);
    return this.cache;
  });
  readonly keys = vi.fn(async () => [...this.openedNames]);
  readonly delete = vi.fn(async (name: string) => this.openedNames.delete(name));
}

function streamedResponse(byteLength: number) {
  let sent = false;
  const reader = {
    read: vi.fn(async () => {
      if (sent) return { done: true, value: undefined } as const;
      sent = true;
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

function stalledResponse() {
  let readCount = 0;
  const reader = {
    read: vi.fn(() => readCount++ === 0
      ? Promise.resolve({ done: false, value: { byteLength: 1 } as Uint8Array } as const)
      : new Promise<never>(() => undefined)),
    cancel: vi.fn(async () => undefined),
  };
  return {
    reader,
    response: {
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/octet-stream" }),
      body: { getReader: () => reader },
    } as unknown as Response,
  };
}

function exactFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = cacheKey(input);
    const asset = JAPANESE_VOICE_ASSETS.find((candidate) => assetUrl(candidate.path) === url);
    if (!asset) throw new Error(`Unexpected Japanese voice URL: ${url}`);
    return streamedResponse(asset.bytes);
  });
}

const workers: FakeWorker[] = [];

class FakeWorker {
  onmessage: ((event: MessageEvent<JapaneseVoiceWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  readonly postMessage = vi.fn();
  readonly terminate = vi.fn();

  constructor() {
    workers.push(this);
  }

  emit(response: JapaneseVoiceWorkerResponse) {
    this.onmessage?.({ data: response } as MessageEvent<JapaneseVoiceWorkerResponse>);
  }

  fail() {
    this.onerror?.(new ErrorEvent("error"));
  }
}

const audioContexts: FakeAudioContext[] = [];
const audioSources: FakeAudioSource[] = [];

class FakeAudioSource {
  buffer: AudioBuffer | null = null;
  onended: ((event: Event) => void) | null = null;
  readonly connect = vi.fn();
  readonly disconnect = vi.fn();
  readonly start = vi.fn();
  readonly stop = vi.fn();

  finish() {
    this.onended?.(new Event("ended"));
  }
}

class FakeAudioContext {
  readonly state = "running" as AudioContextState;
  readonly destination = {} as AudioDestinationNode;
  readonly resume = vi.fn(async () => undefined);
  readonly createBuffer = vi.fn(() => ({
    copyToChannel: vi.fn(),
  }) as unknown as AudioBuffer);
  readonly createBufferSource = vi.fn(() => {
    const source = new FakeAudioSource();
    audioSources.push(source);
    return source as unknown as AudioBufferSourceNode;
  });

  constructor() {
    audioContexts.push(this);
  }
}

describe("Japanese voice lifecycle", () => {
  let storage: MemoryCacheStorage;
  let navigatorStorageDescriptor: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.resetModules();
    vi.doMock("react", () => ReactRuntime);
    storage = new MemoryCacheStorage();
    workers.length = 0;
    audioContexts.length = 0;
    audioSources.length = 0;
    navigatorStorageDescriptor = Object.getOwnPropertyDescriptor(window.navigator, "storage");
    Object.defineProperty(window.navigator, "storage", {
      configurable: true,
      value: {
        estimate: vi.fn(async () => ({
          quota: JAPANESE_VOICE_DOWNLOAD_BYTES + STORAGE_SAFETY_MARGIN + 1,
          usage: 0,
        })),
        persist: vi.fn(async () => true),
      },
    });
    vi.stubGlobal("caches", storage as unknown as CacheStorage);
    vi.stubGlobal("Worker", FakeWorker as unknown as typeof Worker);
    vi.stubGlobal("AudioContext", FakeAudioContext as unknown as typeof AudioContext);
  });

  afterEach(() => {
    cleanup();
    for (const worker of workers) worker.fail();
    if (navigatorStorageDescriptor) Object.defineProperty(window.navigator, "storage", navigatorStorageDescriptor);
    else Reflect.deleteProperty(window.navigator, "storage");
    vi.doUnmock("react");
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function renderVoice() {
    const voice = await import("./use-japanese-voice");
    const hook = renderHook(() => voice.useJapaneseVoice());
    await waitFor(() => expect(hook.result.current.checked).toBe(true));
    return { ...hook, voice };
  }

  it("downloads and verifies the voice without constructing the synthesis worker", async () => {
    const fetchMock = exactFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { result } = await renderVoice();

    expect(result.current.downloaded).toBe(false);
    await act(async () => result.current.download());

    expect(result.current.downloaded).toBe(true);
    expect(result.current.activity).toBe("idle");
    expect(result.current.message).toBe("Japanese voice saved in this browser.");
    expect(fetchMock).toHaveBeenCalledTimes(JAPANESE_VOICE_ASSETS.length);
    expect(storage.cache.entries).toHaveProperty("size", JAPANESE_VOICE_ASSETS.length);
    expect(workers).toHaveLength(0);
    expect(audioContexts).toHaveLength(0);
  });

  it("stops waiting when the initial saved-voice check becomes unresponsive", async () => {
    vi.useFakeTimers();
    storage.open.mockImplementation(() => new Promise<MemoryCache>(() => undefined));
    const voice = await import("./use-japanese-voice");
    const { result } = renderHook(() => voice.useJapaneseVoice());

    await act(async () => vi.advanceTimersByTimeAsync(10_001));

    expect(result.current.checked).toBe(true);
    expect(result.current.supported).toBe(true);
    expect(result.current.downloaded).toBe(false);
    expect(result.current.error).toMatch(/could not be checked/iu);
  });

  it("cancels a stalled download and immediately restores the retry state", async () => {
    const stalled = stalledResponse();
    vi.stubGlobal("fetch", vi.fn(async () => stalled.response));
    const { result } = await renderVoice();

    act(() => { void result.current.download(); });
    await waitFor(() => expect(result.current.message).toMatch(/Downloading Japanese voice/iu));

    act(() => result.current.cancelDownload());

    await waitFor(() => expect(result.current.activity).toBe("idle"));
    expect(result.current.downloaded).toBe(false);
    expect(result.current.error).toBeNull();
    expect(stalled.reader.cancel).toHaveBeenCalledOnce();

    const retryFetch = exactFetch();
    vi.stubGlobal("fetch", retryFetch);
    await act(async () => result.current.download());

    expect(result.current.downloaded).toBe(true);
    expect(retryFetch).toHaveBeenCalledTimes(JAPANESE_VOICE_ASSETS.length);
  });

  it("constructs the worker lazily and posts synthesis only when playback starts", async () => {
    storage.cache.seedCompleteVoice();
    const { result } = await renderVoice();
    let playPromise: Promise<boolean> | undefined;

    expect(result.current.downloaded).toBe(true);
    expect(workers).toHaveLength(0);
    act(() => {
      playPromise = result.current.play("猫です。", { speed: 0.82 });
    });

    await waitFor(() => expect(workers).toHaveLength(1));
    expect(workers[0].postMessage).toHaveBeenCalledOnce();
    expect(workers[0].postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: "synthesize",
      text: "猫です。",
      speed: 0.82,
    }));

    await act(async () => {
      result.current.stop();
      await playPromise;
    });
  });

  it("terminates in-flight synthesis and returns the UI state to idle when stopped", async () => {
    storage.cache.seedCompleteVoice();
    const { result } = await renderVoice();
    let playPromise: Promise<boolean> | undefined;
    act(() => {
      playPromise = result.current.play("学校へ行きます。");
    });
    await waitFor(() => expect(result.current.activity).toBe("synthesizing"));
    expect(result.current.activeSentence).toBe("学校へ行きます。");

    await act(async () => {
      result.current.stop();
      await playPromise;
    });

    expect(workers[0].terminate).toHaveBeenCalledOnce();
    expect(result.current.activity).toBe("idle");
    expect(result.current.activeSentence).toBeNull();
    expect(result.current.message).toBeNull();
  });

  it("recreates the worker after a synthesis error so retry does not reuse broken sessions", async () => {
    storage.cache.seedCompleteVoice();
    const { result } = await renderVoice();
    act(() => {
      void result.current.play("最初の文です。");
    });
    await waitFor(() => expect(workers[0]?.postMessage).toHaveBeenCalledOnce());
    const firstRequest = workers[0].postMessage.mock.calls[0][0] as JapaneseVoiceWorkerRequest;

    act(() => {
      workers[0].emit({ id: firstRequest.id, type: "error", message: "WebGPU device was lost." });
    });
    await waitFor(() => expect(result.current.activity).toBe("idle"));
    expect(workers[0].terminate).toHaveBeenCalledOnce();

    act(() => {
      void result.current.play("もう一度試します。");
    });
    await waitFor(() => expect(workers).toHaveLength(2));
    expect(workers[1].postMessage).toHaveBeenCalledWith(expect.objectContaining({
      type: "synthesize",
      text: "もう一度試します。",
    }));
    act(() => result.current.stop());
  });

  it("does not expose a redundant status message while audio is playing", async () => {
    storage.cache.seedCompleteVoice();
    const { result } = await renderVoice();
    let playPromise: Promise<boolean> | undefined;
    act(() => {
      playPromise = result.current.play("これはテストです。");
    });
    await waitFor(() => expect(workers[0]?.postMessage).toHaveBeenCalledOnce());
    const request = workers[0].postMessage.mock.calls[0][0] as JapaneseVoiceWorkerRequest;

    act(() => {
      workers[0].emit({
        id: request.id,
        type: "audio",
        samples: new Float32Array([0, 0.25, -0.25]).buffer,
        sampleRate: 22_050,
      });
    });

    await waitFor(() => expect(result.current.activity).toBe("playing"));
    expect(result.current.message).toBeNull();
    expect(result.current.message).not.toBe("Playing Japanese sentence…");
    expect(audioSources[0].start).toHaveBeenCalledOnce();

    await act(async () => {
      audioSources[0].finish();
      await playPromise;
    });
    expect(result.current.activity).toBe("idle");
  });
});
