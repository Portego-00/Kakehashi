export const JAPANESE_ASR_SAMPLE_RATE = 16_000;
export const JAPANESE_ASR_MAX_SECONDS = 6;

export function normalizeAsrAudio(samples: Float32Array) {
  if (samples.length < 1_600 || samples.length > JAPANESE_ASR_SAMPLE_RATE * JAPANESE_ASR_MAX_SECONDS) {
    throw new Error("Record a short answer of up to six seconds.");
  }
  let mean = 0;
  for (const sample of samples) {
    if (!Number.isFinite(sample)) throw new Error("The microphone returned invalid audio.");
    mean += sample;
  }
  mean /= samples.length;
  let variance = 0;
  for (const sample of samples) variance += (sample - mean) ** 2;
  variance /= samples.length;
  if (variance < 0.000001) throw new Error("No speech was heard. Try again closer to the microphone.");
  const scale = Math.sqrt(variance + 1e-7);
  return Float32Array.from(samples, sample => (sample - mean) / scale);
}

export function asrVocabulary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid speech recognition vocabulary.");
  const entries = Object.entries(value);
  if (entries.length !== 86 || new Set(entries.map(([, id]) => id)).size !== 86) throw new Error("Unexpected speech recognition vocabulary.");
  const tokens: string[] = [];
  for (const [token, id] of entries) {
    if (!Number.isInteger(id) || id < 0 || id > 85 || !(/^[\u3041-\u3096ー]$/u.test(token) || ["[PAD]", "[UNK]", "|"].includes(token))) {
      throw new Error("The speech recognition model must use a kana-only vocabulary.");
    }
    tokens[id] = token;
  }
  if (tokens[85] !== "[PAD]" || tokens[84] !== "[UNK]" || tokens[9] !== "|") throw new Error("Unexpected CTC blank token or separator.");
  return tokens;
}

/** Greedy CTC decoding preserves repeats separated by a blank, e.g. いい. */
export function decodeAsrLogits(logits: Float32Array, tokens: readonly string[]) {
  if (tokens.length !== 86 || logits.length % tokens.length || !logits.length) throw new Error("Unexpected speech recognition output.");
  let previous = -1;
  let text = "";
  for (let offset = 0; offset < logits.length; offset += tokens.length) {
    let best = 0;
    for (let id = 0; id < tokens.length; id++) {
      if (!Number.isFinite(logits[offset + id])) throw new Error("The speech model returned invalid scores. Try again or type the reading.");
      if (logits[offset + id] > logits[offset + best]) best = id;
    }
    if (best !== previous && best !== 85 && best !== 9) {
      if (best === 84) throw new Error("The reading was unclear. Try again or type it.");
      text += tokens[best];
    }
    previous = best;
  }
  if (!text || !/^[\u3041-\u3096ー]+$/u.test(text)) throw new Error("No Japanese reading was recognized. Try again or type it.");
  return text;
}
