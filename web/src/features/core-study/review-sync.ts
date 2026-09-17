import { enqueueReview, loadReviewOutbox, noteReviewFailure, removeReview, type ReviewOutboxEntry } from "./review-outbox";

type StorageAccess = Pick<Storage, "getItem" | "setItem">;
export const REVIEW_PERMISSION_MESSAGE = "Your API token cannot submit reviews. Enable reviews:create permission in WaniKani, then sign in again with the updated token. Your completed reviews are saved on this device.";

export function isReviewPermissionError(error: unknown) {
  const status = (error as { status?: number } | null)?.status;
  return status === 401 || status === 403;
}

// Match the counts sent to WaniKani, including both meaning and reading misses.
// https://knowledge.wanikani.com/wanikani/srs-stages/
export function predictedReviewStage(stage: number, meaning: number, reading: number) {
  const mistakes = meaning + reading;
  return mistakes === 0 ? Math.min(9, stage + 1) : Math.max(1, stage - Math.ceil(mistakes / 2) * (stage >= 5 ? 2 : 1));
}

/** A single delivery lane: local saves never wait for it, and retries cannot overlap. */
export function createReviewSync<T>({ storage, username, deliver, onConfirmed, onChange, onPermissionError, wait = (ms, signal) => new Promise<void>((resolve) => {
  const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
  const timer = setTimeout(done, ms);
  signal.addEventListener("abort", done, { once: true });
  if (signal.aborted) done();
}) }: {
  storage: StorageAccess;
  username: string;
  deliver: (entry: ReviewOutboxEntry, signal: AbortSignal) => Promise<T>;
  onConfirmed: (entry: ReviewOutboxEntry, result: T) => void;
  onChange: (pending: number) => void;
  onPermissionError: () => void;
  wait?: (ms: number, signal: AbortSignal) => Promise<void>;
}) {
  const controller = new AbortController();
  const queued = new Set<number>();
  let active: number | null = null;
  let running: Promise<void> | null = null;
  let finalRequested = false;
  let finalPassStarted = false;
  let permissionBlocked = false;
  let notBefore = 0;
  const pending = () => loadReviewOutbox(storage, username);
  const changed = () => { if (!controller.signal.aborted) onChange(pending().length); };

  async function send(entry: ReviewOutboxEntry) {
    for (let attempt = 0; attempt < 3 && !controller.signal.aborted; attempt++) {
      const delay = Math.max(notBefore - Date.now(), attempt ? 500 * 2 ** (attempt - 1) : 0);
      if (delay > 0) await wait(delay, controller.signal);
      if (controller.signal.aborted) return;
      try {
        const result = await deliver(entry, controller.signal);
        if (controller.signal.aborted) return;
        removeReview(storage, username, entry.assignmentId);
        onConfirmed(entry, result);
        changed();
        return;
      } catch (error) {
        if (controller.signal.aborted) return;
        noteReviewFailure(storage, username, entry.assignmentId, error instanceof Error ? error.message : "Review delivery is pending.");
        changed();
        if (isReviewPermissionError(error)) {
          permissionBlocked = true;
          onPermissionError();
          return;
        }
        const retryAfterMs = (error as { retryAfterMs?: number } | null)?.retryAfterMs;
        if (retryAfterMs && Number.isFinite(retryAfterMs)) notBefore = Math.max(notBefore, Date.now() + retryAfterMs);
      }
    }
  }

  function pump() {
    if (running || controller.signal.aborted || permissionBlocked) return;
    // Defer network work until after the caller has recorded local completion.
    running = Promise.resolve().then(async () => {
      while (!controller.signal.aborted && !permissionBlocked) {
        if (!queued.size && finalRequested && !finalPassStarted) {
          finalPassStarted = true;
          pending().forEach((entry) => queued.add(entry.assignmentId));
        }
        const id = queued.values().next().value as number | undefined;
        if (id === undefined) break;
        queued.delete(id);
        active = id;
        const entry = pending().find((row) => row.assignmentId === id);
        if (entry) await send(entry);
        active = null;
      }
    }).finally(() => {
      running = null;
      active = null;
      if (queued.size || (finalRequested && !finalPassStarted)) pump();
    });
    // Storage may become unavailable after the initial durable save. Preserve
    // the row and avoid an unhandled rejection; the next session can reconcile it.
    void running.catch(() => undefined);
  }

  return {
    enqueue(input: Omit<ReviewOutboxEntry, "attempts" | "lastError">) {
      // Let write failures reach the caller: never advance without a durable row.
      const entry = enqueueReview(storage, username, input);
      changed();
      if (active !== entry.assignmentId) queued.add(entry.assignmentId);
      pump();
    },
    retryPending() {
      pending().forEach((entry) => { if (active !== entry.assignmentId) queued.add(entry.assignmentId); });
      changed();
      pump();
    },
    finish() { finalRequested = true; pump(); },
    settled: () => running ?? Promise.resolve(),
    dispose() { controller.abort(); queued.clear(); },
  };
}
