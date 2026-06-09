import type { AppleMusicAuthCompat } from "./useAppleMusicAuthCompat.types";

const notAvailableError = new Error(
  "Apple Music authentication is only available on iOS development builds."
);

export function useAppleMusicAuthCompat(): AppleMusicAuthCompat {
  return {
    available: false,
    requestAuthorization: async () => "unknown",
    checkSubscription: async () => {
      throw notAvailableError;
    },
    isAuthenticating: false,
    error: null,
  };
}
