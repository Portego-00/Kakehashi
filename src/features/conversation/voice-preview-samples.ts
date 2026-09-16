import type { LiveVoice } from './voices';

/** OTA assets are installed with the update; preview never generates or fetches provider audio. */
export const VOICE_PREVIEW_SAMPLES: Record<LiveVoice, number> = {
  alloy: require('./assets/voice-previews/alloy.wav'),
  ash: require('./assets/voice-previews/ash.wav'),
  ballad: require('./assets/voice-previews/ballad.wav'),
  beacon: require('./assets/voice-previews/beacon.wav'),
  bossa: require('./assets/voice-previews/bossa.wav'),
  cedar: require('./assets/voice-previews/cedar.m4a'),
  cinder: require('./assets/voice-previews/cinder.wav'),
  coral: require('./assets/voice-previews/coral.wav'),
  delta: require('./assets/voice-previews/delta.wav'),
  echo: require('./assets/voice-previews/echo.wav'),
  gleam: require('./assets/voice-previews/gleam.wav'),
  marin: require('./assets/voice-previews/marin.m4a'),
  meridian: require('./assets/voice-previews/meridian.wav'),
  quartz: require('./assets/voice-previews/quartz.wav'),
  ripple: require('./assets/voice-previews/ripple.wav'),
  sage: require('./assets/voice-previews/sage.wav'),
  shimmer: require('./assets/voice-previews/shimmer.wav'),
  stone: require('./assets/voice-previews/stone.wav'),
  tempo: require('./assets/voice-previews/tempo.wav'),
  verse: require('./assets/voice-previews/verse.wav'),
  vesper: require('./assets/voice-previews/vesper.wav'),
  willow: require('./assets/voice-previews/willow.wav'),
};

export function getBundledVoicePreview(voice: LiveVoice): number {
  return VOICE_PREVIEW_SAMPLES[voice];
}
