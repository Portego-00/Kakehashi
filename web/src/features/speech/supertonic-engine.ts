/*
 * Adapted from Supertone's MIT-licensed Supertonic browser example:
 * https://github.com/supertone-inc/supertonic/tree/main/web
 */

import * as ort from "onnxruntime-web/all";
import { readSavedJapaneseVoiceAsset, type JapaneseVoiceAssetPath } from "./japanese-voice-assets";

type ProgressCallback = (progress: number, message: string) => void;

interface SupertonicConfig {
  ttl: { latent_dim: number; chunk_compress_factor: number };
  ae: { sample_rate: number; base_chunk_size: number };
}

interface SerializedTensor {
  dims: number[];
  data: unknown[];
}

interface VoiceStyleJson {
  style_ttl: SerializedTensor;
  style_dp: SerializedTensor;
}

interface VoiceStyle {
  ttl: ort.Tensor;
  dp: ort.Tensor;
}

interface Sessions {
  durationPredictor: ort.InferenceSession;
  textEncoder: ort.InferenceSession;
  vectorEstimator: ort.InferenceSession;
  vocoder: ort.InferenceSession;
}

const MODEL_PATHS = [
  "onnx/duration_predictor.onnx",
  "onnx/text_encoder.onnx",
  "onnx/vector_estimator.onnx",
  "onnx/vocoder.onnx",
] as const satisfies readonly JapaneseVoiceAssetPath[];

const TOTAL_STEPS = 10;
const SPEECH_SPEED = 1.05;
const MAX_JAPANESE_CHARS = 120;
const SILENCE_SECONDS = 0.22;

const hardwareThreads = typeof navigator === "undefined" ? 1 : navigator.hardwareConcurrency || 1;
ort.env.wasm.numThreads = globalThis.crossOriginIsolated ? Math.min(4, hardwareThreads) : 1;

function flattenNumbers(value: unknown): number[] {
  if (typeof value === "number") return [value];
  if (!Array.isArray(value)) return [];
  return value.flatMap(flattenNumbers);
}

async function readJson<T>(path: JapaneseVoiceAssetPath) {
  const response = await readSavedJapaneseVoiceAsset(path);
  return response.json() as Promise<T>;
}

async function createSession(path: typeof MODEL_PATHS[number], provider: "webgpu" | "wasm") {
  const response = await readSavedJapaneseVoiceAsset(path);
  const model = await response.arrayBuffer();
  return ort.InferenceSession.create(model, {
    executionProviders: [provider],
    graphOptimizationLevel: "all",
  });
}

async function releaseSessions(sessions: ort.InferenceSession[]) {
  await Promise.all(sessions.map((session) => session.release().catch(() => undefined)));
}

async function loadSessions(provider: "webgpu" | "wasm", onProgress: ProgressCallback): Promise<Sessions> {
  const sessions: ort.InferenceSession[] = [];
  try {
    for (let index = 0; index < MODEL_PATHS.length; index += 1) {
      onProgress(94 + index, `Loading higher-quality Japanese voice… ${index + 1}/${MODEL_PATHS.length}`);
      sessions.push(await createSession(MODEL_PATHS[index], provider));
    }
  } catch (error) {
    await releaseSessions(sessions);
    throw error;
  }
  return {
    durationPredictor: sessions[0],
    textEncoder: sessions[1],
    vectorEstimator: sessions[2],
    vocoder: sessions[3],
  };
}

function supportsWebGpu() {
  return typeof navigator !== "undefined" && "gpu" in navigator;
}

async function loadBestSessions(onProgress: ProgressCallback) {
  if (supportsWebGpu()) {
    try {
      return await loadSessions("webgpu", onProgress);
    } catch {
      onProgress(94, "WebGPU unavailable; preparing the compatible voice engine…");
    }
  }
  return loadSessions("wasm", onProgress);
}

function loadVoiceStyle(style: VoiceStyleJson): VoiceStyle {
  const ttlData = new Float32Array(flattenNumbers(style.style_ttl.data));
  const dpData = new Float32Array(flattenNumbers(style.style_dp.data));
  return {
    ttl: new ort.Tensor("float32", ttlData, style.style_ttl.dims),
    dp: new ort.Tensor("float32", dpData, style.style_dp.dims),
  };
}

function normalizeJapaneseText(value: string) {
  let text = value
    .normalize("NFKD")
    .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
    .replace(/[–‑—]/gu, "-")
    .replace(/_/gu, " ")
    .replace(/[“”]/gu, "\"")
    .replace(/[‘’´`]/gu, "'")
    .replace(/[♥☆♡©\\]/gu, "")
    .replace(/[\[\]|/#→←]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (!/[.!?;:,'")\]}…。」』】〉》›»]$/u.test(text)) text += "。";
  return `<ja>${text}</ja>`;
}

function splitJapaneseText(text: string) {
  const chars = Array.from(text.trim());
  if (chars.length <= MAX_JAPANESE_CHARS) return [chars.join("")];
  const chunks: string[] = [];
  let current = "";
  for (const char of chars) {
    current += char;
    if (current.length >= MAX_JAPANESE_CHARS || (current.length >= 48 && /[。！？!?]/u.test(char))) {
      chunks.push(current.trim());
      current = "";
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

function encodeText(text: string, indexer: number[]) {
  const codePoints = Array.from(normalizeJapaneseText(text), (char) => char.codePointAt(0) ?? -1);
  const ids = new BigInt64Array(codePoints.length);
  for (let index = 0; index < codePoints.length; index += 1) {
    const codePoint = codePoints[index];
    ids[index] = BigInt(codePoint >= 0 && codePoint < indexer.length ? indexer[codePoint] : -1);
  }
  return {
    ids: new ort.Tensor("int64", ids, [1, ids.length]),
    mask: new ort.Tensor("float32", new Float32Array(ids.length).fill(1), [1, 1, ids.length]),
  };
}

function gaussianNoise(length: number) {
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 2) {
    const first = Math.max(Number.EPSILON, Math.random());
    const second = Math.random();
    const magnitude = Math.sqrt(-2 * Math.log(first));
    output[index] = magnitude * Math.cos(2 * Math.PI * second);
    if (index + 1 < length) output[index + 1] = magnitude * Math.sin(2 * Math.PI * second);
  }
  return output;
}

function tensorFloatData(tensor: ort.Tensor) {
  if (!(tensor.data instanceof Float32Array)) throw new Error("The Japanese voice returned an unexpected tensor type.");
  return tensor.data;
}

function concatenateAudio(parts: Float32Array[], sampleRate: number) {
  if (parts.length === 1) return parts[0];
  const silenceLength = Math.floor(sampleRate * SILENCE_SECONDS);
  const totalLength = parts.reduce((total, part) => total + part.length, 0) + silenceLength * (parts.length - 1);
  const output = new Float32Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length + silenceLength;
  }
  return output;
}

export class SupertonicJapaneseEngine {
  private constructor(
    private readonly config: SupertonicConfig,
    private readonly indexer: number[],
    private readonly style: VoiceStyle,
    private readonly sessions: Sessions,
  ) {}

  static async load(onProgress: ProgressCallback) {
    const [config, indexer, styleJson] = await Promise.all([
      readJson<SupertonicConfig>("onnx/tts.json"),
      readJson<number[]>("onnx/unicode_indexer.json"),
      readJson<VoiceStyleJson>("voice_styles/F3.json"),
    ]);
    const sessions = await loadBestSessions(onProgress);
    onProgress(100, "Higher-quality Japanese voice ready.");
    return new SupertonicJapaneseEngine(config, indexer, loadVoiceStyle(styleJson), sessions);
  }

  get sampleRate() {
    return this.config.ae.sample_rate;
  }

  async synthesize(text: string, onProgress: ProgressCallback, speed = 1) {
    const chunks = splitJapaneseText(text);
    const parts: Float32Array[] = [];
    for (let index = 0; index < chunks.length; index += 1) {
      parts.push(await this.synthesizeChunk(chunks[index], (step, message) => {
        const overall = Math.round(((index + step / 100) / chunks.length) * 100);
        onProgress(overall, message);
      }, speed));
    }
    return concatenateAudio(parts, this.sampleRate);
  }

  private async synthesizeChunk(text: string, onProgress: ProgressCallback, speed: number) {
    const { ids, mask } = encodeText(text, this.indexer);
    const durationOutput = await this.sessions.durationPredictor.run({
      text_ids: ids,
      style_dp: this.style.dp,
      text_mask: mask,
    });
    const duration = Number(tensorFloatData(durationOutput.duration)[0]) / (SPEECH_SPEED * speed);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("The Japanese voice could not determine the sentence length.");

    const textEncoderOutput = await this.sessions.textEncoder.run({
      text_ids: ids,
      style_ttl: this.style.ttl,
      text_mask: mask,
    });
    const chunkSize = this.config.ae.base_chunk_size * this.config.ttl.chunk_compress_factor;
    const latentLength = Math.ceil((duration * this.sampleRate) / chunkSize);
    const latentDimension = this.config.ttl.latent_dim * this.config.ttl.chunk_compress_factor;
    const latentMask = new ort.Tensor("float32", new Float32Array(latentLength).fill(1), [1, 1, latentLength]);
    const totalSteps = new ort.Tensor("float32", new Float32Array([TOTAL_STEPS]), [1]);
    let latent = gaussianNoise(latentDimension * latentLength);

    for (let step = 0; step < TOTAL_STEPS; step += 1) {
      onProgress(Math.round((step / TOTAL_STEPS) * 90), `Creating Japanese speech… ${step + 1}/${TOTAL_STEPS}`);
      const vectorOutput = await this.sessions.vectorEstimator.run({
        noisy_latent: new ort.Tensor("float32", latent, [1, latentDimension, latentLength]),
        text_emb: textEncoderOutput.text_emb,
        style_ttl: this.style.ttl,
        latent_mask: latentMask,
        text_mask: mask,
        current_step: new ort.Tensor("float32", new Float32Array([step]), [1]),
        total_step: totalSteps,
      });
      latent = tensorFloatData(vectorOutput.denoised_latent).slice();
    }

    onProgress(94, "Finishing Japanese speech…");
    const vocoderOutput = await this.sessions.vocoder.run({
      latent: new ort.Tensor("float32", latent, [1, latentDimension, latentLength]),
    });
    const waveform = tensorFloatData(vocoderOutput.wav_tts);
    const expectedLength = Math.min(waveform.length, Math.floor(duration * this.sampleRate));
    onProgress(100, "Japanese speech ready.");
    return waveform.slice(0, expectedLength);
  }
}
