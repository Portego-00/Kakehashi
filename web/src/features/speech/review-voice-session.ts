let active = false;
const listeners = new Set<() => void>();
export const voiceSessionSnapshot = () => active;
export const voiceSessionServerSnapshot = () => false;
export function subscribeVoiceSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
/** One choice follows the learner across both queues in a mixed review session. */
export function setVoiceSessionActive(value: boolean) {
  if (active === value) return;
  active = value;
  for (const listener of listeners) listener();
}
