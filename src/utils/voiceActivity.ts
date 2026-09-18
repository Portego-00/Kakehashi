/** expo-speech-recognition reports iOS microphone power on a -2..10 scale.
 * This is an energy heuristic, not linguistic voice detection. Two samples
 * reject isolated clicks; no deadline starts until audible input is observed.
 */
export function createVoiceActivityDetector() {
  let noiseFloor = -2;
  let audibleSamples = 0;
  let speechDetected = false;
  return {
    record(value: number): boolean {
      if (!Number.isFinite(value)) return false;
      const threshold = Math.max(0, noiseFloor + 2);
      if (value > threshold) {
        audibleSamples += 1;
        if (audibleSamples >= 2) speechDetected = true;
        return speechDetected;
      }
      audibleSamples = 0;
      if (!speechDetected) noiseFloor = noiseFloor * 0.9 + Math.min(value, threshold) * 0.1;
      return false;
    },
  };
}

export const VOICE_UTTERANCE_SILENCE_MS = 900;
