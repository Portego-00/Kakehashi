import { downloadMangaOcrModel } from "./manga-ocr-assets";
import type { MangaOcrProgress, MangaOcrWorkerRequest, MangaOcrWorkerResponse } from "./manga-ocr-protocol";

const MODEL_INPUT_SIZE = 224;

export interface MangaOcrSelection {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PendingRecognition {
  resolve: (text: string) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: MangaOcrProgress) => void;
}

let worker: Worker | null = null;
const pending = new Map<string, PendingRecognition>();

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function normalizeMangaOcrSelection(selection: MangaOcrSelection): MangaOcrSelection {
  const x = clamp(selection.x);
  const y = clamp(selection.y);
  return {
    x,
    y,
    width: Math.max(0, Math.min(1 - x, selection.width)),
    height: Math.max(0, Math.min(1 - y, selection.height)),
  };
}

export function normalizeMangaOcrText(value: string) {
  return value.replace(/\r\n?/gu, "\n").trim();
}

export function appendMangaOcrText(current: string, addition: string) {
  const normalizedAddition = normalizeMangaOcrText(addition);
  const normalizedCurrent = normalizeMangaOcrText(current);
  if (!normalizedAddition) return normalizedCurrent;
  const comparisonKey = (value: string) => value.normalize("NFKC").replace(/\s+/gu, "");
  const additionKey = comparisonKey(normalizedAddition);
  const existingBlocks = normalizedCurrent.split("\n").map((line) => line.trim()).filter(Boolean);
  if (existingBlocks.some((block) => comparisonKey(block) === additionKey)) return normalizedCurrent;
  return normalizedCurrent ? `${normalizedCurrent}\n${normalizedAddition}` : normalizedAddition;
}

function nextRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function failPending(message: string) {
  for (const request of pending.values()) request.reject(new Error(message));
  pending.clear();
}

export function disposeMangaOcr() {
  failPending("Local manga OCR was closed.");
  worker?.terminate();
  worker = null;
}

function getWorker() {
  if (worker) return worker;
  if (typeof Worker === "undefined") throw new Error("This browser cannot run local manga OCR.");
  worker = new Worker(new URL("./manga-ocr.worker.ts", import.meta.url), { name: "kakehashi-manga-ocr", type: "module" });
  worker.onmessage = (event: MessageEvent<MangaOcrWorkerResponse>) => {
    const request = pending.get(event.data.id);
    if (!request) return;
    if (event.data.type === "progress") {
      request.onProgress?.({ stage: event.data.stage });
      return;
    }
    pending.delete(event.data.id);
    if (event.data.type === "result") request.resolve(normalizeMangaOcrText(event.data.text));
    else request.reject(new Error(event.data.message));
  };
  worker.onerror = () => {
    failPending("The local manga OCR worker stopped unexpectedly.");
    worker?.terminate();
    worker = null;
  };
  return worker;
}

async function imageSource(blob: Blob) {
  if (typeof createImageBitmap === "function") return createImageBitmap(blob);
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function prepareModelPixels(blob: Blob, selection: MangaOcrSelection) {
  const source = await imageSource(blob);
  try {
    const sourceWidth = "naturalWidth" in source ? source.naturalWidth : source.width;
    const sourceHeight = "naturalHeight" in source ? source.naturalHeight : source.height;
    const crop = normalizeMangaOcrSelection(selection);
    const sx = Math.floor(crop.x * sourceWidth);
    const sy = Math.floor(crop.y * sourceHeight);
    const sw = Math.max(1, Math.ceil(crop.width * sourceWidth));
    const sh = Math.max(1, Math.ceil(crop.height * sourceHeight));
    if (sw < 8 || sh < 8) throw new Error("Select a larger speech-bubble area before running OCR.");

    const canvas = document.createElement("canvas");
    canvas.width = MODEL_INPUT_SIZE;
    canvas.height = MODEL_INPUT_SIZE;
    const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    if (!context) throw new Error("This browser cannot prepare the selected image for OCR.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(source, sx, sy, sw, sh, 0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE);
    const rgba = context.getImageData(0, 0, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE).data;
    const pixels = new Float32Array(3 * MODEL_INPUT_SIZE * MODEL_INPUT_SIZE);
    const channelSize = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE;
    const mean = [0.485, 0.456, 0.406];
    const standardDeviation = [0.229, 0.224, 0.225];
    for (let index = 0; index < channelSize; index += 1) {
      const rgbaIndex = index * 4;
      pixels[index] = (rgba[rgbaIndex] / 255 - mean[0]) / standardDeviation[0];
      pixels[channelSize + index] = (rgba[rgbaIndex + 1] / 255 - mean[1]) / standardDeviation[1];
      pixels[channelSize * 2 + index] = (rgba[rgbaIndex + 2] / 255 - mean[2]) / standardDeviation[2];
    }
    return pixels;
  } finally {
    if ("close" in source && typeof source.close === "function") source.close();
  }
}

export async function recognizeMangaSelection(
  blob: Blob,
  selection: MangaOcrSelection,
  options: { signal?: AbortSignal; onProgress?: (progress: MangaOcrProgress) => void } = {},
) {
  if (options.signal?.aborted) throw new DOMException("OCR was cancelled.", "AbortError");
  const pixelsPromise = prepareModelPixels(blob, selection);
  const downloadPromise = typeof caches === "undefined"
    ? Promise.resolve()
    : downloadMangaOcrModel({
      onProgress: (progress) => options.onProgress?.({
        stage: "downloading-model",
        loadedBytes: progress.loadedBytes,
        totalBytes: progress.totalBytes,
      }),
    });
  const [pixels] = await Promise.all([pixelsPromise, downloadPromise]);
  if (options.signal?.aborted) throw new DOMException("OCR was cancelled.", "AbortError");
  const id = nextRequestId();
  const ocrWorker = getWorker();

  return new Promise<string>((resolve, reject) => {
    let posted = false;
    const abort = () => {
      pending.delete(id);
      if (posted) ocrWorker.postMessage({ type: "cancel", id } satisfies MangaOcrWorkerRequest);
      reject(new DOMException("OCR was cancelled.", "AbortError"));
    };
    pending.set(id, {
      resolve: (text) => { options.signal?.removeEventListener("abort", abort); resolve(text); },
      reject: (error) => { options.signal?.removeEventListener("abort", abort); reject(error); },
      onProgress: options.onProgress,
    });
    options.signal?.addEventListener("abort", abort, { once: true });
    if (options.signal?.aborted) {
      abort();
      return;
    }
    const request: MangaOcrWorkerRequest = { type: "recognize", id, pixels };
    posted = true;
    ocrWorker.postMessage(request, [pixels.buffer]);
  });
}
