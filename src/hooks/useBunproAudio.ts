import { useCallback, useEffect, useRef, useState } from "react";
import { Audio, type AudioSound } from "../utils/expoAvCompat";

/** Cancels pending loads as well as playback when a study question changes. */
export function useBunproAudio() {
  const soundRef = useRef<AudioSound | null>(null);
  const generationRef = useRef(0);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const stop = useCallback(async () => {
    generationRef.current += 1;
    const sound = soundRef.current;
    soundRef.current = null;
    setPlayingKey(null);
    setLoadingKey(null);
    if (sound) await sound.unloadAsync().catch(() => undefined);
  }, []);

  const play = useCallback(async (key: string, candidates: (string | null | undefined)[]) => {
    const urls = candidates.filter((url): url is string => Boolean(url?.trim()));
    const wasPlaying = playingKey === key || loadingKey === key;
    // stop invalidates the preceding load synchronously, before unloading the sound.
    const stopping = stop();
    const generation = generationRef.current;
    await stopping;
    if (wasPlaying || !urls.length || generation !== generationRef.current) return;
    setLoadingKey(key);
    for (const url of urls) {
      let sound: AudioSound;
      try {
        ({ sound } = await Audio.Sound.createAsync({ uri: url.trim() }, { shouldPlay: false }));
      } catch {
        if (generation !== generationRef.current) return;
        continue;
      }
      if (generation !== generationRef.current) {
        await sound.unloadAsync().catch(() => undefined);
        return;
      }
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (generation === generationRef.current && status.isLoaded && status.didJustFinish) {
          void stop();
        }
      });
      setLoadingKey(null);
      setPlayingKey(key);
      try {
        await sound.playAsync();
      } catch {
        if (generation === generationRef.current) await stop();
      }
      return;
    }
    if (generation === generationRef.current) setLoadingKey(null);
  }, [loadingKey, playingKey, stop]);

  useEffect(() => () => { void stop(); }, [stop]);
  return { play, stop, playingKey, loadingKey };
}
