import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { resolveOfflineVocabularyAudioUri } from "../services/offlineVocabularyAudioService";
import type { Subject } from "../utils/api";
import {
  pickPreferredPronunciationAudios,
  type PronunciationAudioVoicePreference,
} from "../utils/pronunciationAudio";

/** One player for the list, created only on tap and cancelled on navigation. */
export function useSubjectListAudio(enabled: boolean) {
  const requestRef = useRef(0);
  const activeIdRef = useRef<number | null>(null);
  const releaseRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeSubjectId, setActiveSubjectId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const release = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    const dispose = releaseRef.current;
    releaseRef.current = null;
    dispose?.();
  }, []);

  const stop = useCallback(() => {
    requestRef.current += 1;
    activeIdRef.current = null;
    release();
    setActiveSubjectId(null);
    setLoading(false);
    setError(null);
  }, [release]);

  const play = useCallback(async (
    subject: Subject,
    voice: PronunciationAudioVoicePreference,
  ) => {
    const wasActive = activeIdRef.current === subject.id;
    stop();
    if (!enabled || wasActive) return;
    const clips = pickPreferredPronunciationAudios(
      subject.data.pronunciation_audios, subject.data.readings, voice,
      { preferredContentType: "audio/mpeg" },
    );
    if (clips.length === 0) return;
    const request = requestRef.current;
    const isCurrent = () => request === requestRef.current;
    const fail = () => {
      if (!isCurrent()) return;
      stop();
      setError("Audio couldn’t play. Check your connection and tap the speaker to retry.");
    };
    const startTimeout = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(fail, 15000);
    };
    activeIdRef.current = subject.id;
    setActiveSubjectId(subject.id);
    setLoading(true);
    startTimeout();

    const playClip = async (index: number) => {
      try {
        const clip = clips[index];
        let uri = clip.url;
        try {
          uri = (await resolveOfflineVocabularyAudioUri(subject.id, clip)) ?? uri;
        } catch {
          // Keep the online recording available if the offline cache fails.
        }
        if (!isCurrent()) return;
        const player = createAudioPlayer(uri, { updateInterval: 100 });
        releaseRef.current = () => player.remove();
        let finished = false;
        const subscription = player.addListener("playbackStatusUpdate", (status) => {
          if (!isCurrent() || finished) return;
          if (status.playbackState === "error" || status.playbackState === "failed") {
            finished = true;
            fail();
          } else if (status.didJustFinish) {
            finished = true;
            release();
            if (index + 1 < clips.length) {
              setLoading(true);
              startTimeout();
              void playClip(index + 1);
            } else stop();
          } else if (status.isLoaded) setLoading(false);
        });
        releaseRef.current = () => {
          subscription.remove();
          player.remove();
        };
        player.play();
      } catch {
        fail();
      }
    };

    try {
      await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
      if (isCurrent()) await playClip(0);
    } catch {
      fail();
    }
  }, [enabled, release, stop]);

  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") stop();
    });
    return () => {
      subscription.remove();
      stop();
    };
  }, [stop]);

  return { play, stop, activeSubjectId, loading, error };
}
