export type IdleTask = {
  cancel: () => void;
};

/** Defer non-urgent work without depending on removed InteractionManager APIs. */
export function scheduleIdleTask(task: () => void, timeoutMs = 1000): IdleTask {
  let pending = true;
  let idleCallbackId: number | undefined;
  let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

  const run = () => {
    if (!pending) return;
    pending = false;
    task();
  };

  if (typeof requestIdleCallback === "function") {
    idleCallbackId = requestIdleCallback(run, { timeout: timeoutMs });
  } else {
    // Some web browsers do not implement idle callbacks.
    fallbackTimer = setTimeout(run, 0);
  }

  return {
    cancel: () => {
      if (!pending) return;
      pending = false;
      if (idleCallbackId !== undefined && typeof cancelIdleCallback === "function") {
        cancelIdleCallback(idleCallbackId);
      }
      if (fallbackTimer !== undefined) {
        clearTimeout(fallbackTimer);
      }
    },
  };
}
