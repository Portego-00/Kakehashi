export type BunproReviewSavePolicy = {
  succeeded(): void;
  failed(cause: unknown): { pause: boolean; message: string };
};

const authenticationMessage = "Bunpro reviews are paused because your API key was rejected. Check your Bunpro API key in Settings, then try saving again.";
const repeatedFailureMessage = "Bunpro reviews are paused after 3 consecutive save failures. Bunpro may be unavailable. Try saving again in a moment.";

function isAuthenticationFailure(cause: unknown): boolean {
  if (cause !== null && typeof cause === "object" && "status" in cause) {
    return cause.status === 401 || cause.status === 403;
  }
  return cause instanceof Error && (
    cause.message === "Bunpro request failed (401)." ||
    cause.message === "Bunpro request failed (403)."
  );
}

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
      if (isAuthenticationFailure(cause)) {
        pauseMessage = authenticationMessage;
      } else if (!pauseMessage && consecutiveFailures >= 3) {
        pauseMessage = repeatedFailureMessage;
      }

      return {
        pause: pauseMessage !== undefined,
        message: pauseMessage ?? (cause instanceof Error ? cause.message : "Bunpro review could not be saved."),
      };
    },
  };
}
