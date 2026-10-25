/* sherpa-onnx and Silero run entirely in this local worker. No audio requests. */
importScripts(
  "/api/review-speech/sherpa-1.13.8.js",
  "/api/review-speech/asr-1.13.8.js",
  "/api/review-speech/vad-1.13.8.js",
);
let runtime,
  recognizer,
  vad,
  capture,
  language,
  chunks = [],
  preRoll = [],
  partialSamples = 0;
function config(lang) {
  return {
    modelConfig: {
      senseVoice: {
        model: "/model.onnx",
        language: lang,
        useInverseTextNormalization: 0,
      },
      tokens: "/tokens.txt",
      numThreads: 1,
    },
  };
}
function concatenate(parts) {
  const output = new Float32Array(
    parts.reduce((sum, part) => sum + part.length, 0),
  );
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}
function decode(samples, final) {
  if (samples.length < 1_536 || samples.length > 16_000 * 13) return;
  const stream = recognizer.createStream();
  try {
    stream.acceptWaveform(16_000, samples);
    recognizer.decode(stream);
    const result = recognizer.getResult(stream);
    self.postMessage(
      { type: "result", capture, text: result.text || "", final, samples },
      [samples.buffer],
    );
  } finally {
    stream.free();
  }
}
self.onmessage = async ({ data }) => {
  try {
    if (data.type === "prepare") {
      runtime = await Module({
        wasmBinary: new Uint8Array(
          await (
            await fetch("/api/review-speech/sherpa-1.13.8.wasm")
          ).arrayBuffer(),
        ),
      });
      runtime.FS.writeFile("/model.onnx", new Uint8Array(data.model));
      runtime.FS.writeFile("/tokens.txt", new Uint8Array(data.tokens));
      runtime.FS.writeFile("/silero.onnx", new Uint8Array(data.detector));
      recognizer = new self.ReviewRecognizer(config("ja"), runtime);
      vad = new self.ReviewVad(
        {
          sileroVad: {
            model: "/silero.onnx",
            threshold: 0.5,
            minSilenceDuration: 0.7,
            minSpeechDuration: 0.096,
            windowSize: 512,
            maxSpeechDuration: 12,
          },
          sampleRate: 16_000,
          numThreads: 1,
          bufferSizeInSeconds: 30,
        },
        runtime,
      );
      self.postMessage({ type: "ready" });
      return;
    }
    if (data.type === "start") {
      capture = data.capture;
      language = data.language;
      recognizer.setConfig(config(language));
      vad.reset();
      chunks = [];
      preRoll = [];
      partialSamples = 0;
      return;
    }
    if (data.capture !== capture) return;
    if (data.type === "stop") {
      capture = null;
      vad.reset();
      chunks = [];
      preRoll = [];
      return;
    }
    if (data.type !== "audio") return;
    const samples = data.samples;
    vad.acceptWaveform(samples);
    if (!vad.isEmpty()) {
      const segment = vad.front();
      vad.pop();
      decode(segment.samples, true);
      chunks = [];
      preRoll = [];
      partialSamples = 0;
      vad.reset();
      return;
    }
    if (vad.isDetected()) {
      if (!chunks.length) {
        chunks = preRoll;
        preRoll = [];
      }
      chunks.push(samples);
      partialSamples += samples.length;
      if (partialSamples >= 9_600) {
        partialSamples = 0;
        decode(concatenate(chunks), false);
      }
    } else if (!chunks.length) {
      preRoll.push(samples);
      while (preRoll.reduce((sum, chunk) => sum + chunk.length, 0) > 4_800)
        preRoll.shift();
    } else chunks.push(samples);
  } catch (error) {
    self.postMessage({ type: "error", capture, error: String(error) });
  }
};
