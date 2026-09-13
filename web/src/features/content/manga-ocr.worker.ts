import * as ort from "onnxruntime-web/wasm";
import { MANGA_OCR_MODEL_CACHE, MANGA_OCR_MODEL_URLS } from "./manga-ocr-assets";
import type { MangaOcrWorkerRequest, MangaOcrWorkerResponse } from "./manga-ocr-protocol";

const MODEL_PATHS = {
  vision: MANGA_OCR_MODEL_URLS.vision,
  prefill: MANGA_OCR_MODEL_URLS.prefill,
  step: MANGA_OCR_MODEL_URLS.step,
  vocabulary: MANGA_OCR_MODEL_URLS.vocabulary,
} as const;
const VOCABULARY_SIZE = 14_630;
const BOS_TOKEN = 1;
const EOS_TOKEN = 2;
const MAX_OUTPUT_TOKENS = 128;
const REPETITION_PENALTY = 1.2;
const CONTENT_RUN_LIMIT = 12;

type DecoderResult = ort.InferenceSession.ReturnType;

interface BaberuEngine {
  vision: ort.InferenceSession;
  prefill: ort.InferenceSession;
  step: ort.InferenceSession;
  idToCharacter: string[];
  contentTokenIds: Set<number>;
}

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<MangaOcrWorkerRequest>) => void) | null;
  postMessage(message: MangaOcrWorkerResponse): void;
};

ort.env.wasm.numThreads = 1;

const sessionOptions: ort.InferenceSession.SessionOptions = {
  executionProviders: ["wasm"],
  graphOptimizationLevel: "all",
};

let enginePromise: Promise<BaberuEngine> | null = null;
let recognitionQueue = Promise.resolve();
const cancelledRequests = new Set<string>();
const scheduledRequests = new Set<string>();

function post(message: MangaOcrWorkerResponse) {
  workerScope.postMessage(message);
}

async function cachedResponse(url: string) {
  if (typeof caches === "undefined") return fetch(url, { cache: "force-cache" });
  const cache = await caches.open(MANGA_OCR_MODEL_CACHE);
  const cached = await cache.match(url);
  if (cached) return cached;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`OCR asset download failed (${response.status}).`);
  try {
    await cache.put(url, response.clone());
  } catch {
    // Cache Storage can be unavailable or full. Inference still works without persistence.
  }
  return response;
}

async function loadVocabulary() {
  const response = await cachedResponse(MODEL_PATHS.vocabulary);
  if (!response.ok) throw new Error(`Vocabulary download failed (${response.status}).`);
  const value: unknown = await response.json();
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === "string")) {
    throw new Error("The Baberu vocabulary is not in the expected format.");
  }
  const idToCharacter = ["", "", "", "", ...value];
  if (idToCharacter.length !== VOCABULARY_SIZE) {
    throw new Error("The Baberu vocabulary does not match the pinned OCR model.");
  }
  return idToCharacter;
}

async function createSession(url: string) {
  if (typeof caches === "undefined") return ort.InferenceSession.create(url, sessionOptions);
  try {
    const response = await cachedResponse(url);
    if (!response.ok) throw new Error(`Model download failed (${response.status}).`);
    const objectUrl = URL.createObjectURL(await response.blob());
    try {
      return await ort.InferenceSession.create(objectUrl, sessionOptions);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  } catch (error) {
    if (error instanceof Error && /download failed/iu.test(error.message)) throw error;
    return ort.InferenceSession.create(url, sessionOptions);
  }
}

async function loadEngine(id: string) {
  post({ type: "progress", id, stage: "preparing-model" });
  if (!enginePromise) {
    enginePromise = (async () => {
      const idToCharacter = await loadVocabulary();
      const contentTokenIds = new Set(idToCharacter.flatMap((character, tokenId) => {
        if (["ー", "ｰ", "〜", "~"].includes(character)) return [];
        return [...character].length === 1 && /[\p{L}\p{N}]/u.test(character) ? [tokenId] : [];
      }));
      let vision: ort.InferenceSession | undefined;
      let prefill: ort.InferenceSession | undefined;
      let step: ort.InferenceSession | undefined;
      try {
        vision = await createSession(MODEL_PATHS.vision);
        prefill = await createSession(MODEL_PATHS.prefill);
        step = await createSession(MODEL_PATHS.step);
        return { vision, prefill, step, idToCharacter, contentTokenIds };
      } catch (error) {
        await Promise.allSettled([vision?.release(), prefill?.release(), step?.release()].filter(Boolean));
        throw error;
      }
    })().catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

function repeatedContentRun(generated: number[], candidate: number, contentTokenIds: Set<number>) {
  if (!contentTokenIds.has(candidate)) return 0;
  let run = 0;
  for (let index = generated.length - 1; index >= 0 && generated[index] === candidate; index -= 1) run += 1;
  return run;
}

function selectNextToken(logits: Float32Array, sequence: number[], generated: number[], contentTokenIds: Set<number>) {
  const offset = logits.length - VOCABULARY_SIZE;
  if (offset < 0) throw new Error("The Baberu decoder returned an unexpected logits shape.");
  const seen = new Set(sequence);
  let selected = EOS_TOKEN;
  let selectedScore = Number.NEGATIVE_INFINITY;

  for (let id = 0; id < VOCABULARY_SIZE; id += 1) {
    let score = logits[offset + id];
    if (seen.has(id)) score = score < 0 ? score * REPETITION_PENALTY : score / REPETITION_PENALTY;
    if (repeatedContentRun(generated, id, contentTokenIds) >= CONTENT_RUN_LIMIT) score = Number.NEGATIVE_INFINITY;
    if (score > selectedScore) {
      selected = id;
      selectedScore = score;
    }
  }
  return selected;
}

function disposeResult(result: DecoderResult | undefined) {
  if (!result) return;
  for (const value of Object.values(result)) value.dispose();
}

function decoderFeeds(result: DecoderResult, token: number, position: number) {
  const inputIds = new ort.Tensor("int64", BigInt64Array.of(BigInt(token)), [1, 1]);
  const positionIds = new ort.Tensor("int64", BigInt64Array.of(BigInt(position)), [1, 1]);
  const feeds: Record<string, ort.Tensor> = { input_ids: inputIds, position_ids: positionIds };
  for (let layer = 0; layer < 6; layer += 1) {
    feeds[`past_k${layer}`] = result[`present_k${layer}`] as ort.Tensor;
    feeds[`past_v${layer}`] = result[`present_v${layer}`] as ort.Tensor;
  }
  return { feeds, inputIds, positionIds };
}

async function recognize(request: MangaOcrWorkerRequest) {
  if (request.type !== "recognize") return "";
  const engine = await loadEngine(request.id);
  if (cancelledRequests.has(request.id)) return "";
  post({ type: "progress", id: request.id, stage: "recognizing" });

  const pixelValues = new ort.Tensor("float32", request.pixels, [1, 3, 224, 224]);
  let decoderResult: DecoderResult | undefined;
  try {
    const visionResult = await engine.vision.run({ pixel_values: pixelValues });
    const visionEmbeds = visionResult.vision_embeds as ort.Tensor;
    if (cancelledRequests.has(request.id)) {
      visionEmbeds.dispose();
      return "";
    }
    const bos = new ort.Tensor("int64", BigInt64Array.of(BigInt(BOS_TOKEN)), [1, 1]);
    try {
      decoderResult = await engine.prefill.run({ vision_embeds: visionEmbeds, input_ids: bos });
    } finally {
      bos.dispose();
      visionEmbeds.dispose();
    }

    const generated: number[] = [];
    const sequence = [BOS_TOKEN];
    for (let iteration = 0; iteration < MAX_OUTPUT_TOKENS; iteration += 1) {
      if (cancelledRequests.has(request.id)) return "";
      const logits = decoderResult.logits.data as Float32Array;
      const nextToken = selectNextToken(logits, sequence, generated, engine.contentTokenIds);
      if (nextToken === EOS_TOKEN) break;
      generated.push(nextToken);
      sequence.push(nextToken);
      if (generated.length >= MAX_OUTPUT_TOKENS) break;

      const { feeds, inputIds, positionIds } = decoderFeeds(decoderResult, nextToken, 257 + iteration);
      let following: DecoderResult;
      try {
        following = await engine.step.run(feeds);
      } finally {
        inputIds.dispose();
        positionIds.dispose();
      }
      disposeResult(decoderResult);
      decoderResult = following;
    }

    return generated.map((id) => engine.idToCharacter[id] ?? "").join("");
  } finally {
    pixelValues.dispose();
    disposeResult(decoderResult);
  }
}

async function handle(request: MangaOcrWorkerRequest) {
  if (request.type !== "recognize") return;
  try {
    const text = await recognize(request);
    if (!cancelledRequests.has(request.id)) post({ type: "result", id: request.id, text });
  } catch (error) {
    if (!cancelledRequests.has(request.id)) post({
      type: "error",
      id: request.id,
      message: error instanceof Error
        ? `Local manga OCR failed: ${error.message}`
        : "Local manga OCR failed unexpectedly.",
    });
  } finally {
    cancelledRequests.delete(request.id);
    scheduledRequests.delete(request.id);
  }
}

workerScope.onmessage = (event) => {
  if (event.data.type === "cancel") {
    if (scheduledRequests.has(event.data.id)) cancelledRequests.add(event.data.id);
    return;
  }
  scheduledRequests.add(event.data.id);
  recognitionQueue = recognitionQueue.then(() => handle(event.data));
};
