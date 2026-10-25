import { createAsrModel } from "./asr-model-assets";
export const ENGLISH_ASR_REVISION = "a19f851b3d42865797e410752b4c570c871e4825";
export const ENGLISH_ASR_CACHE = `kakehashi-english-asr-${ENGLISH_ASR_REVISION}`;
export const ENGLISH_ASR_ASSETS = [
  { path: "onnx/model_quantized.onnx", bytes: 95_286_046 },
  { path: "vocab.json", bytes: 358 },
] as const;
const model = createAsrModel({ root: `https://huggingface.co/Xenova/wav2vec2-base-960h/resolve/${ENGLISH_ASR_REVISION}`, cache: ENGLISH_ASR_CACHE, assets: ENGLISH_ASR_ASSETS, label: "English" });
export const ENGLISH_ASR_BYTES = model.totalBytes;
export const hasEnglishAsr = model.hasModel;
export const readEnglishAsrAsset = model.readAsset;
export const downloadEnglishAsr = model.downloadModel;
export const removeEnglishAsr = model.removeModel;
