import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

export interface StrokeFrame {
  strokeIndex: number;
  progress: number;
}

interface PlaybackRun {
  id: number;
  strokeDuration: number;
  delayBetweenStrokes: number;
}

/** One clock and one visible stroke, independent of native animation settings. */
export function useStrokePlayback(strokeCount: number) {
  const [frame, setFrame] = useState<StrokeFrame | null>(null);
  const [run, setRun] = useState<PlaybackRun | null>(null);
  const generation = useRef(0);

  const stop = useCallback(() => {
    generation.current += 1;
    setRun(null);
    setFrame(null);
  }, []);

  const play = useCallback((strokeDuration: number, delayBetweenStrokes: number) => {
    if (strokeCount === 0) return;
    setFrame({ strokeIndex: 0, progress: 0 });
    setRun({ id: ++generation.current, strokeDuration, delayBetweenStrokes });
  }, [strokeCount]);

  useEffect(() => {
    if (!run) return;
    let active = true;
    let request: number | undefined;
    let lastTimestamp: number | null = null;
    let strokeIndex = 0;
    let elapsed = 0;
    let foreground = !AppState.currentState || AppState.currentState === "active";

    const tick = (timestamp: number) => {
      if (!active || !foreground || generation.current !== run.id) return;
      // A slow frame must slow the lesson down, never skip the teaching steps.
      if (lastTimestamp !== null) {
        elapsed += Math.min(50, Math.max(0, timestamp - lastTimestamp));
      }
      lastTimestamp = timestamp;

      if (elapsed >= run.strokeDuration) {
        if (strokeIndex === strokeCount - 1) {
          setFrame(null);
          setRun(null);
          return;
        }
        if (elapsed >= run.strokeDuration + run.delayBetweenStrokes) {
          strokeIndex += 1;
          elapsed = 0;
        }
      }
      const nextFrame = { strokeIndex, progress: Math.min(1, elapsed / run.strokeDuration) };
      setFrame((previous) =>
        previous?.strokeIndex === nextFrame.strokeIndex && previous.progress === nextFrame.progress
          ? previous
          : nextFrame
      );
      request = requestAnimationFrame(tick);
    };

    const resume = () => {
      lastTimestamp = null;
      request = requestAnimationFrame(tick);
    };
    const pause = () => {
      if (request !== undefined) cancelAnimationFrame(request);
      request = undefined;
      lastTimestamp = null;
    };
    const subscription = AppState.addEventListener("change", (state) => {
      pause();
      foreground = state === "active";
      if (foreground) resume();
    });
    if (foreground) resume();

    return () => {
      active = false;
      pause();
      subscription.remove();
    };
  }, [run, strokeCount]);

  return { frame, isPlaying: run !== null, play, stop };
}
