"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { WebStudyPreferences } from "@/features/settings/settings";
import { safeAudio } from "./BunproDetails";

export function bunproAudioUrls(question: Record<string, unknown>, voice: WebStudyPreferences["vocabularyAudioVoice"]) {
  const female = safeAudio(question.female_audio_url);
  const male = safeAudio(question.male_audio_url);
  const all = [...new Set([female, male].filter((url): url is string => Boolean(url)))];
  if (voice === "both") return all;
  if (voice === "random") return all.length ? [all[Math.floor(Math.random() * all.length)]] : [];
  const preferred = voice === "male" ? male || female : female || male;
  return preferred ? [preferred] : [];
}

/** Own playback so leaving or advancing never leaves another sentence playing. */
export function useBunproAudio() {
  const active = useRef<{ audio: HTMLAudioElement; finish: () => void } | null>(null);
  const generation = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const stop = useCallback(() => {
    generation.current += 1;
    if (active.current) { active.current.audio.pause(); active.current.finish(); active.current = null; }
    setPlaying(false); setError("");
  }, []);
  useEffect(() => () => {
    generation.current += 1;
    if (active.current) { active.current.audio.pause(); active.current.finish(); active.current = null; }
  }, []);
  const play = useCallback(async (urls: string[]) => {
    stop();
    if (!urls.length) return;
    const run = generation.current;
    setError(""); setPlaying(true);
    for (const url of urls) {
      if (generation.current !== run) return;
      const audio = new Audio(url);
      const success = await new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (ok: boolean) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          audio.removeEventListener("ended", ended);
          audio.removeEventListener("error", failed);
          if (active.current?.audio === audio) active.current = null;
          resolve(ok);
        };
        const ended = () => finish(true);
        const failed = () => { audio.pause(); finish(false); };
        const timeout = window.setTimeout(failed, 30_000);
        active.current = { audio, finish: () => finish(true) };
        audio.addEventListener("ended", ended);
        audio.addEventListener("error", failed);
        try { void audio.play().catch(failed); } catch { failed(); }
      });
      if (generation.current !== run) return;
      if (!success) { setError("Audio could not play. Use Audio to try again."); break; }
    }
    if (generation.current === run) setPlaying(false);
  }, [stop]);
  return { playing, error, play, stop };
}
