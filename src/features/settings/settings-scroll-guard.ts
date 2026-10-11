/** Distinguish navigation scroll events from the learner's own scrolling. */
export function createSettingsScrollGuard() {
  let navigating = false;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  const endNavigation = () => {
    navigating = false;
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    idleTimer = undefined;
  };
  const waitForIdle = (delay: number) => {
    if (idleTimer !== undefined) clearTimeout(idleTimer);
    idleTimer = setTimeout(endNavigation, delay);
  };
  return {
    beginNavigation() {
      navigating = true;
      // A same-position jump may produce no scroll events.
      waitForIdle(500);
    },
    shouldIgnoreScroll() {
      if (!navigating) return false;
      // Each frame extends the guard; long jumps are not limited by a fixed timeout.
      waitForIdle(160);
      return true;
    },
    endNavigation,
  };
}
