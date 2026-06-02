import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  SPOTIFY_DISCOVERY,
  spotifyService,
  type SpotifyUserProfile,
} from "../../services/spotifyService";
import { useSettingsStore } from "../../utils/store";

WebBrowser.maybeCompleteAuthSession();

type SpotifyAuthError = Error | null;

function getSpotifyAuthorizationError(
  result: AuthSession.AuthSessionResult
): Error {
  if (result.type !== "error") {
    return new Error("Spotify authorization failed.");
  }

  const errorCode =
    result.error?.code ||
    result.errorCode ||
    result.params?.error;
  const providerMessage = result.params?.error_description;

  if (errorCode === "server_error") {
    return new Error(
      providerMessage ||
        "Spotify returned a server error during authorization. Confirm this Spotify app has Web API enabled and this Spotify account is added in Users Management, then try again."
    );
  }

  return new Error(
    providerMessage ||
      result.error?.message ||
      (errorCode
        ? `Spotify authorization failed (${errorCode}).`
        : "Spotify authorization failed.")
  );
}

export function useSpotifyAuth() {
  const {
    setSpotifyAuthStatus,
    setSpotifyDisplayName,
  } = useSettingsStore();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState<SpotifyAuthError>(null);
  const [profile, setProfile] = useState<SpotifyUserProfile | null>(null);
  const lastHandledCodeRef = useRef<string | null>(null);

  const redirectUri = spotifyService.getRedirectUri();
  const available = spotifyService.isAuthConfigured();

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    available
      ? {
          clientId: spotifyService.getClientId(),
          scopes: spotifyService.getScopes(),
          redirectUri,
          responseType: AuthSession.ResponseType.Code,
          usePKCE: true,
        }
      : {
          clientId: "spotify-client-id-missing",
          redirectUri,
          responseType: AuthSession.ResponseType.Code,
          usePKCE: true,
        },
    SPOTIFY_DISCOVERY
  );

  const refreshStatus = useCallback(async () => {
    if (!available) {
      setProfile(null);
      setSpotifyDisplayName(null);
      setSpotifyAuthStatus("notConfigured");
      return null;
    }

    try {
      const nextProfile = await spotifyService.getUserProfile();
      setProfile(nextProfile);
      setSpotifyDisplayName(nextProfile?.displayName ?? null);
      setSpotifyAuthStatus(nextProfile ? "authorized" : "notConnected");
      return nextProfile;
    } catch {
      setProfile(null);
      setSpotifyDisplayName(null);
      setSpotifyAuthStatus("notConnected");
      return null;
    }
  }, [available, setSpotifyAuthStatus, setSpotifyDisplayName]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    const completeAuthorization = async () => {
      if (response?.type !== "success") {
        if (response?.type === "error") {
          const nextError = getSpotifyAuthorizationError(response);
          setError(nextError);
          setIsAuthenticating(false);
        }
        return;
      }

      const code = response.params?.code;
      if (!code || !request?.codeVerifier || lastHandledCodeRef.current === code) {
        return;
      }

      lastHandledCodeRef.current = code;
      setIsAuthenticating(true);
      setError(null);

      try {
        const tokenResponse = await AuthSession.exchangeCodeAsync(
          {
            clientId: spotifyService.getClientId(),
            code,
            redirectUri,
            extraParams: {
              code_verifier: request.codeVerifier,
            },
          },
          SPOTIFY_DISCOVERY
        );

        await spotifyService.saveAuthTokenResponse(tokenResponse);
        await refreshStatus();
      } catch (authorizationError) {
        const nextError =
          authorizationError instanceof Error
            ? authorizationError
            : new Error("Spotify authorization failed.");
        setError(nextError);
        setSpotifyAuthStatus("notConnected");
        setSpotifyDisplayName(null);
      } finally {
        setIsAuthenticating(false);
      }
    };

    void completeAuthorization();
  }, [
    redirectUri,
    refreshStatus,
    request?.codeVerifier,
    response,
    setSpotifyAuthStatus,
    setSpotifyDisplayName,
  ]);

  const requestAuthorization = useCallback(async () => {
    if (!available) {
      const nextError = new Error(
        "Spotify client ID is not configured. Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID."
      );
      setError(nextError);
      setSpotifyAuthStatus("notConfigured");
      return null;
    }

    if (!request) {
      const nextError = new Error("Spotify authorization is still loading.");
      setError(nextError);
      return null;
    }

    setIsAuthenticating(true);
    setError(null);

    try {
      const result = await promptAsync();
      if (result.type !== "success") {
        setIsAuthenticating(false);
        if (result.type === "error") {
          const nextError = getSpotifyAuthorizationError(result);
          setError(nextError);
        }
        return result;
      }

      const code = result.params?.code;
      if (!code || !request.codeVerifier) {
        const nextError = new Error("Spotify authorization response was incomplete.");
        setError(nextError);
        setIsAuthenticating(false);
        return result;
      }

      lastHandledCodeRef.current = code;
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: spotifyService.getClientId(),
          code,
          redirectUri,
          extraParams: {
            code_verifier: request.codeVerifier,
          },
        },
        SPOTIFY_DISCOVERY
      );

      await spotifyService.saveAuthTokenResponse(tokenResponse);
      await refreshStatus();
      setIsAuthenticating(false);
      return result;
    } catch (authError) {
      const nextError =
        authError instanceof Error
          ? authError
          : new Error("Spotify authorization failed.");
      setError(nextError);
      setIsAuthenticating(false);
      return null;
    }
  }, [
    available,
    promptAsync,
    redirectUri,
    refreshStatus,
    request,
    setSpotifyAuthStatus,
  ]);

  const disconnect = useCallback(async () => {
    await spotifyService.clearUserToken();
    setProfile(null);
    setError(null);
    setSpotifyDisplayName(null);
    setSpotifyAuthStatus(available ? "notConnected" : "notConfigured");
  }, [available, setSpotifyAuthStatus, setSpotifyDisplayName]);

  return {
    available,
    disconnect,
    error,
    isAuthenticating,
    profile,
    redirectUri,
    refreshStatus,
    requestAuthorization,
  };
}
