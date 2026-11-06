let playing = 0;
const listeners = new Set<() => void>();
export const reviewPlaybackSnapshot = () => playing > 0;
export const subscribeReviewPlayback = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export function beginReviewPlayback() {
  playing++;
  for (const listener of listeners) listener();
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    playing--;
    for (const listener of listeners) listener();
  };
}
/** Detached Audio objects do not send their playback events through document. */
export function watchReviewAudio(audio: HTMLAudioElement) {
  let finish: (() => void) | null = null;
  const start = () => {
    finish ??= beginReviewPlayback();
  };
  const stop = () => {
    finish?.();
    finish = null;
  };
  audio.addEventListener("playing", start);
  for (const event of ["pause", "ended", "error"])
    audio.addEventListener(event, stop);
}
