/** Remove quiet capture boundaries while retaining 100 ms around the spoken word. */
export function trimEnglishAsrAudio(samples: Float32Array) {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  if (!Number.isFinite(peak) || peak < 0.001) return samples;
  const threshold = peak * 0.02;
  const start = samples.findIndex(sample => Math.abs(sample) > threshold);
  let end = samples.length - 1;
  while (end > start && Math.abs(samples[end]) <= threshold) end--;
  return samples.slice(Math.max(0, start - 1_600), Math.min(samples.length, end + 1_601));
}

export function englishAsrVocabulary(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid English speech vocabulary.");
  const tokens: string[] = [];
  const entries = Object.entries(value);
  if (entries.length !== 32 || new Set(entries.map(([, id]) => id)).size !== 32) throw new Error("Unexpected English speech vocabulary.");
  for (const [token, id] of entries) {
    if (!Number.isInteger(id) || id < 0 || id > 31 || !(/^[A-Z']$/.test(token) || ["<pad>", "<s>", "</s>", "<unk>", "|"].includes(token))) throw new Error("Unexpected English speech token.");
    tokens[id] = token;
  }
  if (tokens[0] !== "<pad>" || tokens[1] !== "<s>" || tokens[2] !== "</s>" || tokens[3] !== "<unk>" || tokens[4] !== "|") throw new Error("Unexpected English CTC tokens.");
  return tokens;
}

export function decodeEnglishAsrLogits(logits: Float32Array, tokens: readonly string[]) {
  if (tokens.length !== 32 || !logits.length || logits.length % tokens.length) throw new Error("Unexpected English speech output.");
  let previous = -1;
  let text = "";
  for (let offset = 0; offset < logits.length; offset += tokens.length) {
    let best = 0;
    for (let id = 0; id < tokens.length; id++) {
      if (!Number.isFinite(logits[offset + id])) throw new Error("The speech model returned invalid scores. Try again or type your answer.");
      if (logits[offset + id] > logits[offset + best]) best = id;
    }
    if (best !== previous && best >= 4) text += best === 4 ? " " : tokens[best];
    if (best === 3) throw new Error("The answer was unclear. Try again or type it.");
    previous = best;
  }
  text = text.trim().replace(/\s+/g, " ").toLowerCase();
  if (!text) throw new Error("No English answer was recognized. Try again or type it.");
  return text;
}
