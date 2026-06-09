import { Auth } from "@lomray/react-native-apple-music";
import { useCallback, useState } from "react";
import type {
  AppleMusicAuthCompat,
  AppleMusicAuthStatus,
  AppleMusicSubscriptionStatus,
} from "./useAppleMusicAuthCompat.types";

const normalizeStatus = (status: string): AppleMusicAuthStatus => {
  if (
    status === "authorized" ||
    status === "denied" ||
    status === "notDetermined" ||
    status === "restricted" ||
    status === "unknown"
  ) {
    return status;
  }
  return "unknown";
};

const toError = (error: unknown) =>
  error instanceof Error ? error : new Error("Apple Music auth error");

export function useAppleMusicAuthCompat(): AppleMusicAuthCompat {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const requestAuthorization = useCallback(async () => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const status = await Auth.authorize();
      return normalizeStatus(status);
    } catch (authError) {
      const normalizedError = toError(authError);
      setError(normalizedError);
      return "unknown";
    } finally {
      setIsAuthenticating(false);
    }
  }, []);

  const checkSubscription = useCallback(async () => {
    try {
      const subscription = await Auth.checkSubscription();
      return subscription as AppleMusicSubscriptionStatus;
    } catch (subscriptionError) {
      const normalizedError = toError(subscriptionError);
      setError(normalizedError);
      throw normalizedError;
    }
  }, []);

  return {
    available: true,
    requestAuthorization,
    checkSubscription,
    isAuthenticating,
    error,
  };
}
