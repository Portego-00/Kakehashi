import type { BunproReviewSaveFailure, BunproReviewSavePolicy } from "./bunproReviewSavePolicy";

type SaveJob = { title: string; save(): Promise<void>; skip(message: string): void };
export type BunproOutboxState = { pending: number; saving: boolean; failure: BunproReviewSaveFailure | null; title: string };

/** Serial writes with explicit retry: a failed POST never retries itself. */
export function createBunproReviewOutbox(policy: BunproReviewSavePolicy, changed: (state: BunproOutboxState) => void) {
  let jobs: SaveJob[] = [];
  let saving = false;
  let failure: BunproReviewSaveFailure | null = null;
  let generation = 0;
  let waiters: ((saved: boolean) => void)[] = [];
  const snapshot = (): BunproOutboxState => ({ pending: jobs.length, saving, failure, title: jobs[0]?.title ?? "" });
  const publish = () => changed(snapshot());
  const settle = (saved: boolean) => { const current = waiters; waiters = []; current.forEach((resolve) => resolve(saved)); };
  const run = async () => {
    if (saving || failure || !jobs.length) return;
    const currentGeneration = generation;
    saving = true;
    publish();
    while (jobs.length) {
      try {
        await jobs[0].save();
      } catch (error) {
        if (currentGeneration !== generation) return;
        failure = policy.failed(error);
        saving = false;
        publish();
        settle(false);
        return;
      }
      if (currentGeneration !== generation) return;
      policy.succeeded();
      jobs.shift();
      publish();
    }
    saving = false;
    publish();
    settle(true);
  };
  return {
    snapshot,
    enqueue(job: SaveJob) { jobs.push(job); publish(); void run(); },
    drain(): Promise<boolean> {
      if (failure) return Promise.resolve(false);
      if (!jobs.length) return Promise.resolve(true);
      return new Promise((resolve) => waiters.push(resolve));
    },
    retry() { if (!failure || saving) return; failure = null; publish(); void run(); },
    skip() {
      if (!failure || failure.pause || saving) return;
      jobs.shift()?.skip(failure.message);
      failure = null;
      publish();
      if (jobs.length) void run(); else settle(true);
    },
    reset() { generation += 1; jobs = []; saving = false; failure = null; settle(false); publish(); },
  };
}
