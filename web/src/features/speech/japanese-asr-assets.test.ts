import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Blob as NodeBlob } from "node:buffer";
import { downloadJapaneseAsr, hasJapaneseAsr, JAPANESE_ASR_ASSETS, JAPANESE_ASR_CACHE, japaneseAsrUrl, japaneseAsrParts, readJapaneseAsrAsset, removeJapaneseAsr } from "./japanese-asr-assets";

const saved = new Map<string, Response>();
const cache = { match: vi.fn(async (url: string) => saved.get(url)?.clone()), put: vi.fn(), delete: vi.fn() };
beforeEach(() => {
  saved.clear(); vi.clearAllMocks();
  vi.stubGlobal("caches", { open: vi.fn(async () => cache), delete: vi.fn(async () => { saved.clear(); return true; }) });
  vi.stubGlobal("isSecureContext", true); vi.stubGlobal("Worker", class {}); vi.stubGlobal("AudioWorkletNode", class {});
  vi.stubGlobal("MediaRecorder", class {}); vi.stubGlobal("AudioContext", class {});
  vi.stubGlobal("Blob", NodeBlob);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: vi.fn() } });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("error", { status: 503 })));
});
afterEach(() => vi.unstubAllGlobals());
it("requires every exact cached asset and never downloads on a status check", async () => {
  expect(await hasJapaneseAsr()).toBe(false);
  for (const part of JAPANESE_ASR_ASSETS.flatMap(japaneseAsrParts)) saved.set(part.key, new Response(new Uint8Array(part.bytes < 2000 ? part.bytes : 1), { headers: { "x-kakehashi-asset-bytes": String(part.bytes) } }));
  expect(await hasJapaneseAsr()).toBe(true);
  expect((await (await readJapaneseAsrAsset("vocab.json")).arrayBuffer()).byteLength).toBe(1201);
  saved.set(japaneseAsrUrl("vocab.json"), new Response("incomplete"));
  expect(await hasJapaneseAsr()).toBe(false);
  await expect(readJapaneseAsrAsset("vocab.json")).rejects.toThrow("Download");
  expect(fetch).not.toHaveBeenCalled();
});
it("keeps failed downloads out of the ready cache and can retry", async () => {
  await expect(downloadJapaneseAsr(vi.fn(), new AbortController().signal)).rejects.toThrow("503");
  expect(cache.put).not.toHaveBeenCalled();
  await expect(downloadJapaneseAsr(vi.fn(), new AbortController().signal)).rejects.toThrow("503");
  expect(await hasJapaneseAsr()).toBe(false);
});
it("keeps cache entries below the browser's large-file limit and covers the entire model", () => {
  const parts = japaneseAsrParts(JAPANESE_ASR_ASSETS[0]);
  expect(parts.every(part => part.bytes <= 64 * 1024 * 1024)).toBe(true);
  expect(parts.reduce((sum, part) => sum + part.bytes, 0)).toBe(317_452_740);
  expect(parts[0].start).toBe(0);
  expect(parts.at(-1)?.end).toBe(317_452_739);
  parts.slice(1).forEach((part, index) => expect(part.start).toBe(parts[index].end + 1));
});
it("rejects a truncated range instead of marking it downloaded", async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response("truncated", { status: 206, headers: { "content-range": "bytes 0-67108863/317452740" } }));
  cache.put.mockImplementationOnce(async (_url: string, response: Response) => { await response.arrayBuffer(); });
  await expect(downloadJapaneseAsr(vi.fn(), new AbortController().signal)).rejects.toThrow("incomplete");
  expect(await hasJapaneseAsr()).toBe(false);
});
it("does not start an aborted download or touch other model caches on removal", async () => {
  const controller = new AbortController(); controller.abort();
  await expect(downloadJapaneseAsr(vi.fn(), controller.signal)).rejects.toMatchObject({ name: "AbortError" });
  expect(fetch).not.toHaveBeenCalled();
  await removeJapaneseAsr();
  expect(caches.delete).toHaveBeenCalledExactlyOnceWith(JAPANESE_ASR_CACHE);
});
