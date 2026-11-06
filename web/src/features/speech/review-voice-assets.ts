import { createAsrModel } from "./asr-model-assets";
export const REVIEW_VOICE_REVISION = "2365baeacb507f821a0c8120fcee3d484dba7a07";
export const REVIEW_VOICE_CACHE = `kakehashi-sensevoice-${REVIEW_VOICE_REVISION}`;
export const REVIEW_VOICE_ASSETS = [
  { path: "model.int8.onnx", bytes: 239_233_841 },
  { path: "tokens.txt", bytes: 315_894 },
] as const;
const model = createAsrModel({
  root: `https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17/resolve/${REVIEW_VOICE_REVISION}`,
  cache: REVIEW_VOICE_CACHE,
  assets: REVIEW_VOICE_ASSETS,
  label: "Japanese and English",
});
export const REVIEW_VOICE_BYTES = model.totalBytes;
const detector = createAsrModel({
  root: "/api/review-speech",
  cache: "kakehashi-review-vad-v5",
  assets: [{ path: "silero-v5.onnx", bytes: 643_854 }],
  label: "speech detection",
});
export async function hasReviewVoiceModel() {
  return (await model.hasModel()) && (await detector.hasModel());
}
export const readReviewVoiceAsset = model.readAsset;
export async function downloadReviewVoiceModel(
  progress: (value: number) => void,
  signal: AbortSignal,
) {
  await model.downloadModel(
    (value) => progress(Math.floor(value * 0.99)),
    signal,
  );
  await detector.downloadModel(() => {}, signal);
  progress(100);
}
export async function removeReviewVoiceModel() {
  await model.removeModel();
  await detector.removeModel();
}
export const readVoiceDetector = () => detector.readAsset("silero-v5.onnx");
