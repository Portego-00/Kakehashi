import { createAsrModel, LOCAL_ASR_CHANGED, supportsLocalAsr } from "./asr-model-assets";
export const JAPANESE_ASR_REVISION = "abf0bd2a4c52bfcb958f2200508100007712cc09";
export const JAPANESE_ASR_CACHE = `kakehashi-japanese-asr-${JAPANESE_ASR_REVISION}`;
export const JAPANESE_ASR_ASSETS = [
  { path: "onnx/model.onnx", bytes: 317_452_740 },
  { path: "vocab.json", bytes: 1_201 },
] as const;
export type JapaneseAsrAsset = typeof JAPANESE_ASR_ASSETS[number]["path"];
const model = createAsrModel({ root: `https://huggingface.co/juujika/wav2vec2-japanese-hiragana-onnx/resolve/${JAPANESE_ASR_REVISION}`, cache: JAPANESE_ASR_CACHE, assets: JAPANESE_ASR_ASSETS, label: "Japanese" });
export const JAPANESE_ASR_BYTES = model.totalBytes;
export const JAPANESE_ASR_CHANGED = LOCAL_ASR_CHANGED;
export const supportsJapaneseAsr = supportsLocalAsr;
export const japaneseAsrUrl = model.assetUrl;
export const japaneseAsrParts = model.assetParts;
export const hasJapaneseAsr = model.hasModel;
export const readJapaneseAsrAsset = model.readAsset;
export const downloadJapaneseAsr = model.downloadModel;
export const removeJapaneseAsr = model.removeModel;
