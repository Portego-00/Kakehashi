export function resampleVoice(samples: Float32Array, sampleRate: number) {
  if (sampleRate === 16_000) return samples;
  const output = new Float32Array(
    Math.floor((samples.length * 16_000) / sampleRate),
  );
  for (let i = 0; i < output.length; i++) {
    const position = (i * sampleRate) / 16_000;
    const index = Math.floor(position);
    const fraction = position - index;
    output[i] =
      samples[index] * (1 - fraction) +
      (samples[Math.min(index + 1, samples.length - 1)] ?? 0) * fraction;
  }
  return output;
}
