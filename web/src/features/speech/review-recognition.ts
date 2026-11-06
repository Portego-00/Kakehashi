import type { AsrLanguage } from "./japanese-asr-protocol";
import { readReviewVoiceAsset, readVoiceDetector } from "./review-voice-assets";
import { resampleVoice } from "./voice-pcm";
import {
  subscribeVoiceSession,
  voiceSessionSnapshot,
} from "./review-voice-session";
let worker: Worker | null = null;
let ready: Promise<Worker> | null = null;
let generation = 0;
let cancelLoad: (() => void) | undefined;
const captures = new Set<string>();
let releaseTimer: ReturnType<typeof setTimeout> | undefined;
function release() {
  captures.clear();
  generation++;
  cancelLoad?.();
  cancelLoad = undefined;
  clearTimeout(releaseTimer);
  worker?.terminate();
  worker = null;
  ready = null;
}
subscribeVoiceSession(() => {
  if (!voiceSessionSnapshot()) release();
});
async function prepare() {
  clearTimeout(releaseTimer);
  const version = generation;
  ready ??= (async () => {
    const assets = await Promise.all([
      readReviewVoiceAsset("model.int8.onnx"),
      readReviewVoiceAsset("tokens.txt"),
      readVoiceDetector(),
    ]);
    const [model, tokens, detector] = await Promise.all(
      assets.map((response) => response.arrayBuffer()),
    );
    if (version !== generation)
      throw new DOMException("Voice answers paused.", "AbortError");
    const current = new Worker("/speech/review-voice-worker.js");
    worker = current;
    await new Promise<void>((resolve, reject) => {
      cancelLoad = () => {
        clearTimeout(timeout);
        reject(new DOMException("Voice answers paused.", "AbortError"));
      };
      const timeout = setTimeout(() => {
        current.terminate();
        reject(
          new Error(
            "The speech model took too long to load. Start voice answers again.",
          ),
        );
      }, 90_000);
      current.onmessage = ({ data }) => {
        clearTimeout(timeout);
        if (data.type === "ready") resolve();
        else
          reject(new Error(data.error || "The speech model could not load."));
      };
      current.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("The speech model could not run in this browser."));
      };
      current.postMessage({ type: "prepare", model, tokens, detector }, [
        model,
        tokens,
        detector,
      ]);
    });
    cancelLoad = undefined;
    current.onmessage = null;
    current.onerror = null;
    return current;
  })().catch((error) => {
    if (version === generation) release();
    throw error;
  });
  return ready;
}
type Options = {
  language: AsrLanguage;
  signal: AbortSignal;
  onReady: () => void;
  onResult: (text: string, final: boolean, samples: Float32Array) => void;
};
export async function listenForReviewAnswer({
  language,
  signal,
  onReady,
  onResult,
}: Options) {
  signal.throwIfAborted();
  const current = await prepare();
  signal.throwIfAborted();
  const capture = crypto.randomUUID();
  captures.add(capture);
  let media: MediaStream | undefined;
  let context: AudioContext | undefined;
  let node: AudioWorkletNode | undefined;
  let removeListeners = () => {};
  try {
    media = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });
    signal.throwIfAborted();
    context = new AudioContext({ sampleRate: 16_000 });
    await context.resume();
    await context.audioWorklet.addModule("/speech/voice-capture.js");
    signal.throwIfAborted();
    node = new AudioWorkletNode(context, "review-voice-capture");
    const source = context.createMediaStreamSource(media);
    const mute = context.createGain();
    mute.gain.value = 0;
    source.connect(node);
    node.connect(mute);
    mute.connect(context.destination);
    current.postMessage({ type: "start", capture, language });
    await new Promise<void>((resolve, reject) => {
      const abort = () => resolve();
      signal.addEventListener("abort", abort, { once: true });
      const message = ({ data }: MessageEvent) => {
        if (signal.aborted || data.capture !== capture) return;
        if (data.type === "error") reject(new Error(data.error));
        else if (data.type === "result")
          onResult(data.text, data.final, data.samples);
      };
      const failed = () =>
        reject(
          new Error(
            "Speech recognition stopped unexpectedly. Start voice answers again.",
          ),
        );
      current.addEventListener("message", message);
      current.addEventListener("error", failed);
      node!.port.onmessage = ({ data }: MessageEvent<Float32Array>) => {
        if (signal.aborted) return;
        const samples = resampleVoice(data, context!.sampleRate);
        current.postMessage({ type: "audio", capture, samples }, [
          samples.buffer,
        ]);
      };
      const cleanup = () => {
        signal.removeEventListener("abort", abort);
        current.removeEventListener("message", message);
        current.removeEventListener("error", failed);
      };
      removeListeners = () => {
        cleanup();
        signal.removeEventListener("abort", cleanup);
      };
      signal.addEventListener("abort", cleanup, { once: true });
      onReady();
      if (signal.aborted) {
        cleanup();
        resolve();
      }
    });
  } finally {
    removeListeners();
    node?.disconnect();
    node?.port.close();
    media?.getTracks().forEach((track) => track.stop());
    await context?.close().catch(() => undefined);
    captures.delete(capture);
    if (worker === current) {
      current.postMessage({ type: "stop", capture });
      if (!captures.size) releaseTimer = setTimeout(release, 30_000);
    }
  }
}
