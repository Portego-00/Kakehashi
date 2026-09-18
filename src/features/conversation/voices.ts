/** Built-in GPT-Live voices. Voice is selected when a Live session starts. */
export const LIVE_VOICES = [
  'alloy', 'ash', 'ballad', 'beacon', 'bossa', 'cedar', 'cinder', 'coral',
  'delta', 'echo', 'gleam', 'marin', 'meridian', 'quartz', 'ripple', 'sage',
  'shimmer', 'stone', 'tempo', 'verse', 'vesper', 'willow',
] as const;

export type LiveVoice = typeof LIVE_VOICES[number];
export const DEFAULT_LIVE_VOICE: LiveVoice = 'marin';

export function normalizeLiveVoice(value: unknown): LiveVoice {
  return typeof value === 'string' && (LIVE_VOICES as readonly string[]).includes(value)
    ? value as LiveVoice
    : DEFAULT_LIVE_VOICE;
}
