export const JAPANESE_VOICE_MODEL_REVISION = "3cadd1ee6394adea1bd021217a0e650ede09a323";
export const JAPANESE_VOICE_DOWNLOAD_LABEL = "about 400 MB";
export const JAPANESE_VOICE_NAME = "Supertonic 3 · F3";

const MODEL_REPOSITORY = "Supertone/supertonic-3";
const CACHE_PREFIX = "kakehashi-japanese-voice-";
const CACHE_NAME = `${CACHE_PREFIX}supertonic-3-${JAPANESE_VOICE_MODEL_REVISION}`;
const CACHE_SIZE_HEADER = "x-kakehashi-asset-bytes";
const LEGACY_PIPER_DATABASE = "piper-plus-models";

export const JAPANESE_VOICE_ASSETS = [
  { path: "LICENSE", bytes: 15_007 },
  { path: "onnx/duration_predictor.onnx", bytes: 3_700_147 },
  { path: "onnx/text_encoder.onnx", bytes: 36_416_150 },
  { path: "onnx/vector_estimator.onnx", bytes: 256_534_781 },
  { path: "onnx/vocoder.onnx", bytes: 101_424_195 },
  { path: "onnx/tts.json", bytes: 8_253 },
  { path: "onnx/unicode_indexer.json", bytes: 277_676 },
  { path: "voice_styles/F3.json", bytes: 290_794 },
] as const;

export type JapaneseVoiceAssetPath = typeof JAPANESE_VOICE_ASSETS[number]["path"];

export const JAPANESE_VOICE_DOWNLOAD_BYTES = JAPANESE_VOICE_ASSETS.reduce((total, asset) => total + asset.bytes, 0);
const JAPANESE_VOICE_DOWNLOAD_MB = Math.ceil(JAPANESE_VOICE_DOWNLOAD_BYTES / 1_000_000);
const JAPANESE_VOICE_STALL_TIMEOUT_MS = 90_000;

function downloadAbortReason(signal: AbortSignal) {
  return signal.reason instanceof Error
    ? signal.reason
    : new DOMException("Japanese voice download cancelled.", "AbortError");
}

function throwIfDownloadAborted(signal?: AbortSignal) {
  if (!signal?.aborted) return;
  throw downloadAbortReason(signal);
}

function abortable<T>(operation: Promise<T>, signal?: AbortSignal) {
  if (!signal) return operation;
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (complete: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", onAbort);
      complete();
    };
    const onAbort = () => finish(() => reject(downloadAbortReason(signal)));
    operation.then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error)),
    );
    if (signal.aborted) onAbort();
    else signal.addEventListener("abort", onAbort, { once: true });
  });
}

function assetUrl(path: JapaneseVoiceAssetPath) {
  return `https://huggingface.co/${MODEL_REPOSITORY}/resolve/${JAPANESE_VOICE_MODEL_REVISION}/${path}`;
}

function storedByteLength(response: Response | undefined) {
  return response ? Number(response.headers.get(CACHE_SIZE_HEADER)) : Number.NaN;
}

async function hasExactAsset(cache: Cache, asset: typeof JAPANESE_VOICE_ASSETS[number]) {
  const response = await cache.match(assetUrl(asset.path));
  return storedByteLength(response) === asset.bytes;
}

export function supportsJapaneseVoice() {
  return typeof window !== "undefined"
    && typeof caches !== "undefined"
    && typeof Worker !== "undefined"
    && typeof WebAssembly !== "undefined"
    && Boolean(window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
}

export async function hasSavedJapaneseVoice(options: { signal?: AbortSignal } = {}) {
  if (!supportsJapaneseVoice()) return false;
  throwIfDownloadAborted(options.signal);
  const cache = await abortable(caches.open(CACHE_NAME), options.signal);
  const statuses = await abortable(Promise.all(JAPANESE_VOICE_ASSETS.map((asset) => hasExactAsset(cache, asset))), options.signal);
  return statuses.every(Boolean);
}

export async function readSavedJapaneseVoiceAsset(path: JapaneseVoiceAssetPath) {
  const asset = JAPANESE_VOICE_ASSETS.find((candidate) => candidate.path === path);
  if (!asset) throw new Error(`Unknown Japanese voice asset: ${path}`);
  const cache = await caches.open(CACHE_NAME);
  const response = await cache.match(assetUrl(path));
  if (!response || storedByteLength(response) !== asset.bytes) {
    throw new Error("The saved Japanese voice is incomplete. Download it again.");
  }
  return response;
}

function clearLegacyPiperCache() {
  if (typeof indexedDB === "undefined") return;
  const request = indexedDB.deleteDatabase(LEGACY_PIPER_DATABASE);
  request.onerror = () => undefined;
  request.onblocked = () => undefined;
}

async function removeStaleVoiceCaches() {
  const names = await caches.keys();
  await Promise.all(names
    .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
    .map((name) => caches.delete(name)));
}

async function ensureStorageCapacity(missingBytes: number) {
  const estimate = await navigator.storage?.estimate?.();
  if (!estimate?.quota || estimate.usage === undefined) return;
  const available = estimate.quota - estimate.usage;
  const safetyMargin = 32 * 1024 * 1024;
  if (available < missingBytes + safetyMargin) {
    throw new Error("There is not enough browser storage for the higher-quality Japanese voice.");
  }
}

async function saveAsset(
  cache: Cache,
  asset: typeof JAPANESE_VOICE_ASSETS[number],
  assetIndex: number,
  completedBytes: number,
  onProgress: (progress: number, message: string) => void,
  externalSignal?: AbortSignal,
) {
  throwIfDownloadAborted(externalSignal);

  const url = assetUrl(asset.path);
  const requestController = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let readerCancellation: Promise<void> | null = null;
  let stallTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let saved = false;
  let rejectStalled!: (reason?: unknown) => void;
  const stalled = new Promise<never>((_resolve, reject) => { rejectStalled = reject; });
  const cancelReader = (reason?: unknown) => {
    if (!reader) return Promise.resolve();
    readerCancellation ??= reader.cancel(reason).catch(() => undefined);
    return readerCancellation;
  };
  const stop = (error: Error) => {
    if (stopped) return;
    stopped = true;
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = null;
    if (!requestController.signal.aborted) requestController.abort(error);
    void cancelReader(error);
    rejectStalled(error);
  };
  const pulse = () => {
    if (stopped) return;
    if (stallTimer) clearTimeout(stallTimer);
    stallTimer = setTimeout(() => stop(new Error(`Japanese voice download timed out while receiving ${asset.path}.`)), JAPANESE_VOICE_STALL_TIMEOUT_MS);
  };
  const abortFromCaller = () => stop(externalSignal
    ? downloadAbortReason(externalSignal)
    : new DOMException("Japanese voice download cancelled.", "AbortError"));
  const fileLabel = `file ${assetIndex + 1} of ${JAPANESE_VOICE_ASSETS.length}`;
  const initialProgress = Math.floor((completedBytes / JAPANESE_VOICE_DOWNLOAD_BYTES) * 100);

  try {
    externalSignal?.addEventListener("abort", abortFromCaller, { once: true });
    throwIfDownloadAborted(externalSignal);
    onProgress(initialProgress, `Connecting to voice server… ${fileLabel}`);
    pulse();
    const response = await Promise.race([
      fetch(url, { cache: "no-store", signal: requestController.signal }),
      stalled,
    ]);
    pulse();
    if (!response.ok || !response.body) throw new Error(`Japanese voice download failed for ${asset.path} (HTTP ${response.status}).`);

    reader = response.body.getReader();
    let received = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        try {
          const chunk = await Promise.race([reader!.read(), stalled]);
          if (chunk.done) {
            if (received !== asset.bytes) {
              controller.error(new Error(`Japanese voice asset ${asset.path} had an unexpected size.`));
              return;
            }
            pulse();
            const progress = Math.min(99, Math.floor(((completedBytes + received) / JAPANESE_VOICE_DOWNLOAD_BYTES) * 100));
            onProgress(progress, `Saving Japanese voice… ${fileLabel}`);
            controller.close();
            return;
          }
          received += chunk.value.byteLength;
          pulse();
          if (received > asset.bytes) {
            const error = new Error(`Japanese voice asset ${asset.path} was larger than expected.`);
            controller.error(error);
            void cancelReader(error);
            return;
          }
          const transferredBytes = completedBytes + received;
          const progress = Math.min(99, Math.floor((transferredBytes / JAPANESE_VOICE_DOWNLOAD_BYTES) * 100));
          const transferredMb = Math.floor(transferredBytes / 1_000_000);
          const transferredLabel = transferredMb > 0 ? String(transferredMb) : "<1";
          onProgress(progress, `Downloading Japanese voice… ${transferredLabel} of ${JAPANESE_VOICE_DOWNLOAD_MB} MB · ${fileLabel}`);
          controller.enqueue(chunk.value);
        } catch (error) {
          controller.error(error);
        }
      },
      cancel(reason) {
        return cancelReader(reason);
      },
    });

    const headers = new Headers(response.headers);
    headers.set(CACHE_SIZE_HEADER, String(asset.bytes));
    await Promise.race([
      cache.put(url, new Response(body, { status: 200, headers })),
      stalled,
    ]);
    saved = true;
  } finally {
    stopped = true;
    if (stallTimer) clearTimeout(stallTimer);
    externalSignal?.removeEventListener("abort", abortFromCaller);
    if (!saved) {
      const cleanupReason = new DOMException("Japanese voice transfer ended before it was saved.", "AbortError");
      if (!requestController.signal.aborted) requestController.abort(cleanupReason);
      void cancelReader(cleanupReason);
    }
  }
}

export async function downloadJapaneseVoiceAssets(
  onProgress: (progress: number, message: string) => void,
  options: { signal?: AbortSignal } = {},
) {
  let lastProgress = -1;
  let lastMessage = "";
  const reportProgress = (progress: number, message: string) => {
    if (progress === lastProgress && message === lastMessage) return;
    lastProgress = progress;
    lastMessage = message;
    onProgress(progress, message);
  };
  throwIfDownloadAborted(options.signal);
  const cache = await abortable(caches.open(CACHE_NAME), options.signal);
  const savedStatuses = await abortable(Promise.all(JAPANESE_VOICE_ASSETS.map((asset) => hasExactAsset(cache, asset))), options.signal);
  const missingBytes = JAPANESE_VOICE_ASSETS.reduce((total, asset, index) => total + (savedStatuses[index] ? 0 : asset.bytes), 0);
  await abortable(ensureStorageCapacity(missingBytes), options.signal);
  throwIfDownloadAborted(options.signal);

  let completedBytes = JAPANESE_VOICE_DOWNLOAD_BYTES - missingBytes;
  reportProgress(Math.floor((completedBytes / JAPANESE_VOICE_DOWNLOAD_BYTES) * 100), "Starting higher-quality Japanese voice download…");
  for (let index = 0; index < JAPANESE_VOICE_ASSETS.length; index += 1) {
    const asset = JAPANESE_VOICE_ASSETS[index];
    throwIfDownloadAborted(options.signal);
    if (!savedStatuses[index]) await saveAsset(cache, asset, index, completedBytes, reportProgress, options.signal);
    completedBytes += savedStatuses[index] ? 0 : asset.bytes;
  }

  throwIfDownloadAborted(options.signal);
  const finalStatuses = await abortable(Promise.all(JAPANESE_VOICE_ASSETS.map((asset) => hasExactAsset(cache, asset))), options.signal);
  if (!finalStatuses.every(Boolean)) throw new Error("The Japanese voice was not saved by this browser.");
  throwIfDownloadAborted(options.signal);
  await abortable(removeStaleVoiceCaches(), options.signal);
  throwIfDownloadAborted(options.signal);
  clearLegacyPiperCache();
  reportProgress(100, "Higher-quality Japanese voice saved.");
}
