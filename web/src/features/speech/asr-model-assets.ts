export const LOCAL_ASR_CHANGED = "kakehashi-japanese-asr-changed";
const sizeHeader = "x-kakehashi-asset-bytes";
const partBytes = 64 * 1024 * 1024;
type ModelAsset = { readonly path: string; readonly bytes: number };
export function supportsLocalAsr() {
  return typeof window !== "undefined" && window.isSecureContext
    && typeof caches !== "undefined" && typeof Worker !== "undefined"
    && typeof WebAssembly !== "undefined" && typeof MediaRecorder !== "undefined"
    && typeof AudioContext !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function createAsrModel(config: { root: string; cache: string; assets: readonly ModelAsset[]; label: string }) {
  const totalBytes = config.assets.reduce((sum, asset) => sum + asset.bytes, 0);
  function assetUrl(path: string) { return `${config.root}/${path}`; }
  // Smaller cache entries avoid Chromium's large streamed-entry limit and allow resume.
  function assetParts(asset: ModelAsset) {
    return Array.from({ length: Math.ceil(asset.bytes / partBytes) }, (_, index) => {
      const start = index * partBytes;
      const bytes = Math.min(partBytes, asset.bytes - start);
      return { asset, start, end: start + bytes - 1, bytes, key: asset.bytes > partBytes ? `${assetUrl(asset.path)}?kakehashi-part=${index}` : assetUrl(asset.path) };
    });
  }
  const parts = config.assets.flatMap(assetParts);
  async function hasModel() {
    if (typeof caches === "undefined") return false;
    const cache = await caches.open(config.cache);
    const found = await Promise.all(parts.map(async part => {
      const response = await cache.match(part.key);
      return Number(response?.headers.get(sizeHeader)) === part.bytes;
    }));
    return found.every(Boolean);
  }

  async function readAsset(path: string) {
    const asset = config.assets.find(asset => asset.path === path);
    if (!asset) throw new Error("Unknown speech recognition asset.");
    const cache = await caches.open(config.cache);
    const blobs: Blob[] = [];
    for (const part of assetParts(asset)) {
      const response = await cache.match(part.key);
      if (!response || Number(response.headers.get(sizeHeader)) !== part.bytes) {
        throw new Error(`Download the ${config.label} speech model in Settings → Reviews first.`);
      }
      const blob = await response.blob();
      if (blob.size !== part.bytes) throw new Error("The saved speech recognition model is incomplete. Remove it and download it again.");
      blobs.push(blob);
    }
    return new Response(new Blob(blobs));
  }

  let downloadActive = false;
  async function downloadModel(onProgress: (percent: number) => void, signal: AbortSignal) {
    if (downloadActive) throw new Error("A speech recognition download is already running in this tab.");
    if (!supportsLocalAsr()) throw new Error("This browser does not support local speech recognition.");
    downloadActive = true;
    try {
      signal.throwIfAborted();
      const cache = await caches.open(config.cache);
      const missingParts = await Promise.all(parts.map(async part => Number((await cache.match(part.key))?.headers.get(sizeHeader)) === part.bytes ? 0 : part.bytes));
      const missingBytes = missingParts.reduce((sum, bytes) => sum + bytes, 0);
      const estimate = await navigator.storage?.estimate?.();
      if (estimate?.quota && estimate.usage !== undefined && estimate.quota - estimate.usage < missingBytes + 32_000_000) {
        throw new Error("Free some browser storage before downloading the speech recognition model.");
      }
      let completed = 0;
      for (const part of parts) {
        signal.throwIfAborted();
        const url = assetUrl(part.asset.path);
        const saved = await cache.match(part.key);
        if (Number(saved?.headers.get(sizeHeader)) === part.bytes) { completed += part.bytes; continue; }
        const controller = new AbortController();
        const abort = () => controller.abort(signal.reason);
        signal.addEventListener("abort", abort, { once: true });
        let timer: ReturnType<typeof setTimeout> | undefined;
        const pulse = () => {
          clearTimeout(timer);
          timer = setTimeout(() => controller.abort(new Error("The speech recognition download stalled. Try again.")), 90_000);
        };
        let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
        try {
          signal.throwIfAborted();
          pulse();
          const ranged = part.asset.bytes > partBytes;
          const response = await fetch(url, { cache: "no-store", credentials: "omit", signal: controller.signal,
            headers: ranged ? { Range: `bytes=${part.start}-${part.end}` } : undefined,
          });
          if (!response.ok || !response.body) throw new Error(`Speech recognition download failed (HTTP ${response.status}).`);
          if (ranged && (response.status !== 206 || response.headers.get("content-range") !== `bytes ${part.start}-${part.end}/${part.asset.bytes}`)) {
            throw new Error("The model server did not provide the requested download part. Try again.");
          }
          reader = response.body.getReader();
          let received = 0;
          let transferError: unknown;
          const body = new ReadableStream<Uint8Array>({
            async pull(stream) {
              try {
                const chunk = await reader!.read();
                controller.signal.throwIfAborted();
                pulse();
                if (chunk.done) {
                  if (received !== part.bytes) throw new Error("The speech recognition download was incomplete. Try again.");
                  stream.close(); return;
                }
                received += chunk.value.byteLength;
                if (received > part.bytes) throw new Error("The speech recognition model had an unexpected size.");
                onProgress(Math.min(99, Math.floor((completed + received) / totalBytes * 100)));
                stream.enqueue(chunk.value);
              } catch (error) { transferError = error; stream.error(error); }
            },
            cancel(reason) { return reader!.cancel(reason); },
          });
          try {
            await cache.put(part.key, new Response(body, { headers: { [sizeHeader]: String(part.bytes) } }));
          } catch {
            if (transferError) throw transferError;
            controller.signal.throwIfAborted();
            throw new Error("The model could not be saved. Free some browser storage and try again.");
          }
          completed += part.bytes;
        } finally {
          clearTimeout(timer);
          signal.removeEventListener("abort", abort);
          controller.abort();
          await reader?.cancel().catch(() => undefined);
        }
      }
      signal.throwIfAborted();
      onProgress(100);
      window.dispatchEvent(new Event(LOCAL_ASR_CHANGED));
    } finally { downloadActive = false; }
  }

  async function removeModel() {
    if (downloadActive) throw new Error("Cancel the download before removing the model.");
    await caches.delete(config.cache);
    window.dispatchEvent(new Event(LOCAL_ASR_CHANGED));
  }
  return { hasModel, readAsset, downloadModel, removeModel, assetUrl, assetParts, totalBytes };
}
