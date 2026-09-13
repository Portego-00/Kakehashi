import { SupertonicJapaneseEngine } from "./supertonic-engine";
import type { JapaneseVoiceWorkerRequest, JapaneseVoiceWorkerResponse } from "./japanese-voice-protocol";

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<JapaneseVoiceWorkerRequest>) => void) | null;
  postMessage(message: JapaneseVoiceWorkerResponse, transfer?: Transferable[]): void;
};

let enginePromise: Promise<SupertonicJapaneseEngine> | null = null;
let workQueue = Promise.resolve();

function post(message: JapaneseVoiceWorkerResponse, transfer?: Transferable[]) {
  workerScope.postMessage(message, transfer);
}

function loadEngine(id: string) {
  if (!enginePromise) {
    enginePromise = SupertonicJapaneseEngine.load((progress, message) => post({
      id,
      type: "progress",
      progress,
      message,
    })).catch((error) => {
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
    const samples = await engine.synthesize(request.text, (progress, message) => post({
      id: request.id,
      type: "progress",
      progress,
      message,
    }), request.speed);
    const audioBuffer = new ArrayBuffer(samples.byteLength);
    new Float32Array(audioBuffer).set(samples);
    post({ id: request.id, type: "audio", samples: audioBuffer, sampleRate: engine.sampleRate }, [audioBuffer]);
  } catch (error) {
    post({ id: request.id, type: "error", message: errorMessage(error) });
  }
}

workerScope.onmessage = (event) => {
  workQueue = workQueue.then(() => handleRequest(event.data)).catch(() => undefined);
};
