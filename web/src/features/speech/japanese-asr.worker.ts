import * as ort from "onnxruntime-web/wasm";
import { readEnglishAsrAsset } from "./english-asr-assets";
import { englishAsrVocabulary, decodeEnglishAsrLogits, trimEnglishAsrAudio } from "./english-asr-decode";
import { readJapaneseAsrAsset } from "./japanese-asr-assets";
import { asrVocabulary, decodeAsrLogits, normalizeAsrAudio } from "./japanese-asr-decode";
import type { AsrLanguage, JapaneseAsrRequest, JapaneseAsrResponse } from "./japanese-asr-protocol";

ort.env.wasm.numThreads = 1;
const scope = self as unknown as {
  onmessage: (event: MessageEvent<JapaneseAsrRequest>) => void;
  postMessage(message: JapaneseAsrResponse): void;
};
let engine: Promise<{ session: ort.InferenceSession; tokens: string[] }> | null = null;
let loadedLanguage: AsrLanguage | null = null;
async function prepare(language: AsrLanguage) {
  if (engine && loadedLanguage !== language) { await (await engine).session.release(); engine = null; }
  loadedLanguage = language;
  engine ??= (async () => {
    const readAsset = language === "en" ? readEnglishAsrAsset : readJapaneseAsrAsset;
    const vocabulary = await (await readAsset("vocab.json")).json();
    const tokens = language === "en" ? englishAsrVocabulary(vocabulary) : asrVocabulary(vocabulary);
    const response = await readAsset(language === "en" ? "onnx/model_quantized.onnx" : "onnx/model.onnx");
    const session = await ort.InferenceSession.create(await response.arrayBuffer(), { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
    return { session, tokens };
  })().catch(error => { engine = null; throw error; });
  return engine;
}
let queue = Promise.resolve();
scope.onmessage = ({ data }) => {
  queue = queue.then(async () => {
    try {
      const { session, tokens } = await prepare(data.language);
      if (data.type === "prepare") { scope.postMessage({ id: data.id }); return; }
      const samples = normalizeAsrAudio(data.language === "en" ? trimEnglishAsrAudio(data.samples) : data.samples);
      const input = new ort.Tensor("float32", samples, [1, samples.length]);
      let output: ort.InferenceSession.ReturnType | undefined;
      try {
        output = await session.run({ input_values: input });
        const logits = output.logits;
        if (!(logits?.data instanceof Float32Array) || logits.dims.length !== 3 || logits.dims[0] !== 1 || logits.dims[2] !== tokens.length) throw new Error("Unexpected speech recognition output shape.");
        scope.postMessage({ id: data.id, text: data.language === "en" ? decodeEnglishAsrLogits(logits.data, tokens) : decodeAsrLogits(logits.data, tokens) });
      } finally {
        input.dispose();
        for (const tensor of Object.values(output ?? {})) tensor.dispose();
      }
    } catch (error) {
      scope.postMessage({ id: data.id, error: error instanceof Error ? error.message : "Speech recognition failed. Try again or type your answer." });
    }
  });
};
