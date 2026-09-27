export type BunproReviewSaveFailure = { pause: boolean; message: string };
export type BunproReviewSavePolicy = {
  succeeded(): void;
  failed(cause: unknown): BunproReviewSaveFailure;
};

/** Shared by Bunpro lanes in one session; only confirmed writes reset failures. */
export function createBunproReviewSavePolicy(): BunproReviewSavePolicy {
  let consecutiveFailures = 0;
  let pauseMessage: string | undefined;
  return {
    succeeded() {
      consecutiveFailures = 0;
      pauseMessage = undefined;
    },
    failed(cause) {
      consecutiveFailures += 1;
      const status = cause && typeof cause === "object" && "status" in cause ? cause.status : undefined;
      if (status === 401 || status === 403) {
        pauseMessage = "Bunpro reviews are paused because your API key was rejected. Check your Bunpro API key in Settings, then try saving again.";
      } else if (!pauseMessage && consecutiveFailures >= 3) {
        pauseMessage = "Bunpro reviews are paused after 3 consecutive save failures. Bunpro may be unavailable. Try saving again in a moment.";
      }
      return { pause: pauseMessage !== undefined, message: pauseMessage ?? "Your answer is kept. Retry saving or continue without saving this answer." };
    },
  };
}
