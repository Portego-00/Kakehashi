export const MANGA_OCR_MODEL_REVISION = "d9cc13153e9a1cd8fdfa3b7b1cc329da2020aeae";
export const MANGA_OCR_MODEL_CACHE = `kakehashi-baberu-ocr-${MANGA_OCR_MODEL_REVISION}`;

const MODEL_ROOT = `https://huggingface.co/genshiai-daichi/baberu-ocr/resolve/${MANGA_OCR_MODEL_REVISION}`;

export const MANGA_OCR_MODEL_ASSETS = [
  { id: "vision", label: "Vision model", path: "onnx/vision_int4.onnx", size: 52_293_486 },
  { id: "prefill", label: "Text decoder", path: "onnx/decoder_prefill_int8.onnx", size: 35_133_596 },
  { id: "step", label: "Text generation model", path: "onnx/decoder_step_int8.onnx", size: 33_929_034 },
  { id: "vocabulary", label: "Japanese vocabulary", path: "tokenizer/vocab.json", size: 130_761 },
] as const;

export type MangaOcrModelAssetId = typeof MANGA_OCR_MODEL_ASSETS[number]["id"];

export const MANGA_OCR_MODEL_URLS = Object.fromEntries(
  MANGA_OCR_MODEL_ASSETS.map((asset) => [asset.id, `${MODEL_ROOT}/${asset.path}`]),
) as Record<MangaOcrModelAssetId, string>;

export const MANGA_OCR_MODEL_TOTAL_BYTES = MANGA_OCR_MODEL_ASSETS.reduce((total, asset) => total + asset.size, 0);

export interface MangaOcrModelDownloadProgress {
  asset: MangaOcrModelAssetId;
  assetLabel: string;
  loadedBytes: number;
  totalBytes: number;
}

export interface MangaOcrModelStatus {
  downloadedBytes: number;
  ready: boolean;
  totalBytes: number;
}

let activeDownload: Promise<void> | null = null;
let latestProgress: MangaOcrModelDownloadProgress | null = null;
const progressListeners = new Set<(progress: MangaOcrModelDownloadProgress) => void>();

function cacheApi() {
  return typeof caches === "undefined" ? null : caches;
}

function emitProgress(progress: MangaOcrModelDownloadProgress) {
  latestProgress = progress;
  for (const listener of progressListeners) listener(progress);
}

async function cachedAssets() {
  const api = cacheApi();
  if (!api) return { api: null, cache: null, downloadedBytes: 0 };
  const cache = await api.open(MANGA_OCR_MODEL_CACHE);
  const matches = await Promise.all(MANGA_OCR_MODEL_ASSETS.map((asset) => cache.match(MANGA_OCR_MODEL_URLS[asset.id])));
  const downloadedBytes = matches.reduce((total, response, index) => total + (response ? MANGA_OCR_MODEL_ASSETS[index].size : 0), 0);
  return { api, cache, downloadedBytes };
}

export async function getMangaOcrModelStatus(): Promise<MangaOcrModelStatus> {
  const { downloadedBytes } = await cachedAssets();
  return {
    downloadedBytes,
    ready: downloadedBytes === MANGA_OCR_MODEL_TOTAL_BYTES,
    totalBytes: MANGA_OCR_MODEL_TOTAL_BYTES,
  };
}

async function downloadModelAssets() {
  const { api, cache } = await cachedAssets();
  if (!api || !cache) throw new Error("This browser cannot save the OCR model for offline use.");

  let completedBytes = 0;
  for (const asset of MANGA_OCR_MODEL_ASSETS) {
    const url = MANGA_OCR_MODEL_URLS[asset.id];
    const cached = await cache.match(url);
    if (cached) {
      completedBytes += asset.size;
      emitProgress({ asset: asset.id, assetLabel: asset.label, loadedBytes: completedBytes, totalBytes: MANGA_OCR_MODEL_TOTAL_BYTES });
      continue;
    }

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`OCR model download failed (${response.status}).`);
    if (!response.body) throw new Error("This browser cannot stream the OCR model download.");

    const reader = response.body.getReader();
    const chunks: BlobPart[] = [];
    let assetBytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      assetBytes += value.byteLength;
      chunks.push(value);
      emitProgress({
        asset: asset.id,
        assetLabel: asset.label,
        loadedBytes: completedBytes + Math.min(assetBytes, asset.size),
        totalBytes: MANGA_OCR_MODEL_TOTAL_BYTES,
      });
    }
    if (assetBytes !== asset.size) throw new Error(`The downloaded ${asset.label.toLocaleLowerCase()} did not match the pinned OCR model.`);

    const headers = new Headers(response.headers);
    headers.set("x-kakehashi-model-bytes", String(asset.size));
    try {
      await cache.put(url, new Response(new Blob(chunks, { type: response.headers.get("content-type") ?? "application/octet-stream" }), { headers }));
    } catch {
      throw new Error("The OCR model downloaded, but browser storage could not save it. Free some site storage and try again.");
    }
    completedBytes += asset.size;
    emitProgress({ asset: asset.id, assetLabel: asset.label, loadedBytes: completedBytes, totalBytes: MANGA_OCR_MODEL_TOTAL_BYTES });
  }

  const cacheNames = await api.keys();
  await Promise.all(cacheNames
    .filter((name) => name.startsWith("kakehashi-baberu-ocr-") && name !== MANGA_OCR_MODEL_CACHE)
    .map((name) => api.delete(name)));
}

export function downloadMangaOcrModel(options: { onProgress?: (progress: MangaOcrModelDownloadProgress) => void } = {}) {
  if (options.onProgress) {
    progressListeners.add(options.onProgress);
    if (latestProgress) options.onProgress(latestProgress);
  }
  if (!activeDownload) {
    activeDownload = downloadModelAssets().finally(() => {
      activeDownload = null;
      latestProgress = null;
    });
  }
  const currentDownload = activeDownload;
  return currentDownload.finally(() => {
    if (options.onProgress) progressListeners.delete(options.onProgress);
  });
}
