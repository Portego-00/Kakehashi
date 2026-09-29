import { useCallback, useEffect, useRef, useState } from "react";
import { Audio, type AudioSound } from "../utils/expoAvCompat";

export function bunproAudioUrls(question: { female_audio_url?: unknown; male_audio_url?: unknown }, voice: "female" | "male" | "random" | "both" = "female") {
  const female = typeof question.female_audio_url === "string" ? question.female_audio_url.trim() : "";
  const male = typeof question.male_audio_url === "string" ? question.male_audio_url.trim() : "";
  const maleFirst = voice === "male" || (voice === "random" && Math.random() >= 0.5);
  return [...new Set((maleFirst ? [male, female] : [female, male]).filter(Boolean))];
}

/** Cancels stale loads, bounds playback, and supports both voices in sequence. */
export function useBunproAudio() {
  const soundRef = useRef<AudioSound | null>(null);
  const generationRef = useRef(0);
  const activeKeyRef = useRef<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(async () => {
    generationRef.current += 1;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    activeKeyRef.current = null;
    const sound = soundRef.current;
    soundRef.current = null;
    setPlayingKey(null);
    setLoadingKey(null);
    setError(null);
    if (sound) await sound.unloadAsync().catch(() => undefined);
  }, []);

  const play = useCallback(async (key: string, candidates: (string | null | undefined)[], sequence = false) => {
    const urls = [...new Set(candidates.filter((url): url is string => Boolean(url?.trim())).map((url) => url.trim()))];
    const wasPlaying = activeKeyRef.current === key;
    const stopping = stop();
    const generation = generationRef.current;
    if (wasPlaying || !urls.length) { await stopping; return; }
    activeKeyRef.current = key;
    setLoadingKey(key);
    await stopping;
    if (generation !== generationRef.current) return;
    const startTimeout = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        if (generation === generationRef.current) { void stop(); setError("Audio timed out. Replay it or continue."); }
      }, 15000);
    };
    startTimeout();
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false, shouldDuckAndroid: true });
    } catch { /* Loading the clip can still succeed if audio mode is unavailable. */ }
    const playFrom = async (start: number): Promise<void> => {
      for (let index = start; index < urls.length; index += 1) {
        if (generation !== generationRef.current) return;
        let sound: AudioSound;
        try {
          ({ sound } = await Audio.Sound.createAsync({ uri: urls[index] }, { shouldPlay: false }));
        } catch { continue; }
        if (generation !== generationRef.current) { await sound.unloadAsync().catch(() => undefined); return; }
        soundRef.current = sound;
        let finished = false;
        sound.setOnPlaybackStatusUpdate((status) => {
          if (generation !== generationRef.current || finished) return;
          if (status.isLoaded && status.didJustFinish) {
            finished = true;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            soundRef.current = null;
            void sound.unloadAsync().catch(() => undefined);
            if (sequence && index + 1 < urls.length) {
              setPlayingKey(null); setLoadingKey(key);
              startTimeout();
              void playFrom(index + 1);
            } else { void stop(); }
          } else if (!status.isLoaded && status.error) {
            void stop(); setError("Audio could not be played. Replay it or continue.");
          }
        });
        setLoadingKey(null);
        setPlayingKey(key);
        try {
          startTimeout();
          await sound.playAsync();
          return;
        } catch {
          if (generation !== generationRef.current) return;
          finished = true;
          startTimeout();
          await sound.unloadAsync().catch(() => undefined);
          soundRef.current = null;
        }
      }
      if (generation === generationRef.current) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        activeKeyRef.current = null; setLoadingKey(null); setPlayingKey(null);
        setError("Audio could not be played. Replay it or continue.");
      }
    };
    await playFrom(0);
  }, [stop]);

  useEffect(() => () => { void stop(); }, [stop]);
  return { play, stop, playingKey, loadingKey, error };
}
