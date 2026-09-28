import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { normalizeSubtitleOffset } from "../../shared/subtitleTiming";

export function useSubtitleTiming(videoKey: string | null) {
  const key = videoKey ? `video-subtitle-offset:${videoKey}` : null;
  const [saved, setSaved] = useState<{ key: string | null; offset: number; ready: boolean }>({ key: null, offset: 0, ready: false });
  const [error, setError] = useState<string | null>(null);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    setError(null);
    void writes.current.then(() => key ? AsyncStorage.getItem(key) : null).then(value => {
      if (active) setSaved({ key, offset: normalizeSubtitleOffset(Number(value)), ready: true });
    }).catch(() => {
      if (active) {
        setSaved({ key, offset: 0, ready: true });
        setError("Saved subtitle timing could not be loaded.");
      }
    });
    return () => { active = false; };
  }, [key]);
  const ready = saved.key === key && saved.ready;
  const offsetMs = ready ? saved.offset : 0;
  function setOffsetMs(value: number) {
    if (!ready) return;
    const offset = normalizeSubtitleOffset(value);
    setSaved({ key, offset, ready: true });
    setError(null);
    if (key) writes.current = writes.current.then(() => AsyncStorage.setItem(key, String(offset))).catch(() => {
      setError("Timing changed, but could not be saved on this device.");
    });
  }
  return { offsetMs, setOffsetMs, ready, error };
}
