import * as ort from "onnxruntime-web/wasm";
import { PiperPlus } from "piper-plus";
import { JAPANESE_VOICE_MODEL_SHA256, JAPANESE_VOICE_MODEL_SIZE, JAPANESE_VOICE_MODEL_URL } from "./japanese-voice-assets";
import type { JapaneseVoiceWorkerRequest, JapaneseVoiceWorkerResponse } from "./japanese-voice-protocol";

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<JapaneseVoiceWorkerRequest>) => void) | null;
  postMessage(message: JapaneseVoiceWorkerResponse, transfer?: Transferable[]): void;
};

ort.env.wasm.numThreads = 1;

let enginePromise: ReturnType<typeof PiperPlus.initialize> | null = null;
let workQueue = Promise.resolve();

function post(message: JapaneseVoiceWorkerResponse, transfer?: Transferable[]) {
  workerScope.postMessage(message, transfer);
}

function overallProgress(stage: string, progress: number) {
  if (stage === "ready") return 100;
  if (stage === "phonemizer") return Math.round(75 + progress * 24);
  return Math.round(5 + progress * 75);
}

function friendlyProgress(stage: string, message: string) {
  if (message.startsWith("Downloading voice model")) return message;
  if (stage === "phonemizer") return "Loading Japanese pronunciation…";
  if (stage === "ready") return "Japanese voice ready.";
  return "Preparing Japanese voice…";
}

function loadEngine(id: string) {
  if (!enginePromise) {
    enginePromise = PiperPlus.initialize({
      model: JAPANESE_VOICE_MODEL_URL,
      modelSha256: JAPANESE_VOICE_MODEL_SHA256,
      modelByteLength: JAPANESE_VOICE_MODEL_SIZE,
      ort,
      onProgress: ({ stage, progress, message }) => post({
        id,
        type: "progress",
        progress: overallProgress(stage, progress),
        message: friendlyProgress(stage, message),
      }),
    }).catch((error) => {
      enginePromise = null;
      throw error;
    });
  }
  return enginePromise;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "The Japanese voice failed unexpectedly.";
}

async function handleRequest(request: JapaneseVoiceWorkerRequest) {
  try {
    const engine = await loadEngine(request.id);
    if (request.type === "prepare") {
      post({ id: request.id, type: "ready" });
      return;
    }

    const result = await engine.synthesize(request.text, { language: "ja", lengthScale: 1.25 });
    const samples = result.samples.slice();
    post({ id: request.id, type: "audio", samples: samples.buffer, sampleRate: result.sampleRate }, [samples.buffer]);
  } catch (error) {
    post({ id: request.id, type: "error", message: errorMessage(error) });
  }
}

workerScope.onmessage = (event) => {
  workQueue = workQueue.then(() => handleRequest(event.data)).catch(() => undefined);
};
