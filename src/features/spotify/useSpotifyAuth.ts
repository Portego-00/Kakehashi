import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  SPOTIFY_DISCOVERY,
  isSpotifyClientIdValid,
  spotifyService,
  type SpotifyUserProfile,
} from "../../services/spotifyService";
import { useSettingsStore } from "../../utils/store";

WebBrowser.maybeCompleteAuthSession();

function getSpotifyConnectionError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  if (/403|forbidden|server_error/i.test(message)) {
    return new Error(
      "Spotify could not grant access. In your developer app, enable Web API and check that your Spotify account is listed in Users Management. The app owner must have an active Spotify Premium subscription."
    );
  }
  if (/invalid_client/i.test(message)) {
    return new Error("Spotify did not recognize this Client ID. Copy the Client ID from your developer app's Settings, save it here, then connect again.");
  }
  if (/invalid_grant/i.test(message)) {
    return new Error("Your Spotify authorization expired. Connect Spotify again.");
  }
  return error instanceof Error ? error : new Error(message);
}

function getSpotifyAuthorizationError(result: AuthSession.AuthSessionResult): Error {
  if (result.type !== "error") return new Error("Spotify authorization failed.");
  const code = result.error?.code || result.errorCode || result.params?.error;
  if (code === "access_denied") {
    return new Error("Spotify access was declined. Connect again and allow access to link your account.");
  }
  return getSpotifyConnectionError(new Error(
    code === "server_error"
      ? code
      : result.params?.error_description || result.error?.message ||
        (code ? `Spotify authorization failed (${code}).` : "Spotify authorization failed.")
  ));
}

export function useSpotifyAuth() {
  const clientId = useSettingsStore((state) => state.spotifyClientId);
  const setSpotifyAuthStatus = useSettingsStore((state) => state.setSpotifyAuthStatus);
  const setSpotifyDisplayName = useSettingsStore((state) => state.setSpotifyDisplayName);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [profile, setProfile] = useState<SpotifyUserProfile | null>(null);
  const attemptRef = useRef(0);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const redirectUri = spotifyService.getRedirectUri();
  const available = isSpotifyClientIdValid(clientId);

  const [request, , promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: available ? clientId : "spotify-client-id-missing",
      scopes: spotifyService.getScopes(),
      redirectUri,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    SPOTIFY_DISCOVERY
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      attemptRef.current += 1;
    };
  }, []);

  const isCurrentAttempt = useCallback((attempt: number, expectedClientId: string) =>
    mountedRef.current && attemptRef.current === attempt &&
    spotifyService.getClientId() === expectedClientId, []);

  const refreshStatus = useCallback(async (reportError = false) => {
    const attempt = attemptRef.current;
    if (!available) {
      setProfile(null);
      setSpotifyDisplayName(null);
      setSpotifyAuthStatus("notConfigured");
      return null;
    }

    try {
      const nextProfile = await spotifyService.getUserProfile();
      if (!isCurrentAttempt(attempt, clientId)) return null;
      setProfile(nextProfile);
      setSpotifyDisplayName(nextProfile?.displayName ?? null);
      setSpotifyAuthStatus(nextProfile ? "authorized" : "notConnected");
      if (reportError && nextProfile) setError(null);
      return nextProfile;
    } catch (statusError) {
      if (!isCurrentAttempt(attempt, clientId)) return null;
      setProfile(null);
      setSpotifyDisplayName(null);
      setSpotifyAuthStatus("notConnected");
      if (reportError) setError(getSpotifyConnectionError(statusError));
      return null;
    }
  }, [available, clientId, isCurrentAttempt, setSpotifyAuthStatus, setSpotifyDisplayName]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const requestAuthorization = useCallback(async () => {
    if (busyRef.current) return null;
    if (!available) {
      setError(new Error("Add your personal Spotify Client ID in Music Playback settings, then connect Spotify."));
      setSpotifyAuthStatus("notConfigured");
      return null;
    }
    // Expo briefly retains the previous request while building a new PKCE request.
    if (!request || request.clientId !== clientId || !request.codeVerifier) {
      setError(new Error("Spotify authorization is still loading. Try Connect Spotify again in a moment."));
      return null;
    }

    const attempt = ++attemptRef.current;
    busyRef.current = true;
    setIsAuthenticating(true);
    setError(null);
    try {
      const result = await promptAsync();
      if (!isCurrentAttempt(attempt, clientId)) return null;
      if (result.type !== "success") {
        if (result.type === "error") setError(getSpotifyAuthorizationError(result));
        return result;
      }
      const code = result.params?.code;
      if (!code) throw new Error("Spotify authorization response was incomplete. Connect again.");

      // Handle the result in one place so a code is exchanged only once.
      const tokenResponse = await AuthSession.exchangeCodeAsync({
        clientId,
        code,
        redirectUri,
        extraParams: { code_verifier: request.codeVerifier },
      }, SPOTIFY_DISCOVERY);
      if (!isCurrentAttempt(attempt, clientId)) return null;
      await spotifyService.saveAuthTokenResponse(tokenResponse, clientId);
      if (!isCurrentAttempt(attempt, clientId)) return null;
      const nextProfile = await refreshStatus(true);
      return nextProfile ? result : null;
    } catch (authError) {
      if (isCurrentAttempt(attempt, clientId)) {
        setError(getSpotifyConnectionError(authError));
        setProfile(null);
        setSpotifyAuthStatus("notConnected");
        setSpotifyDisplayName(null);
      }
      return null;
    } finally {
      if (attemptRef.current === attempt) {
        busyRef.current = false;
        if (mountedRef.current) setIsAuthenticating(false);
      }
    }
  }, [available, clientId, isCurrentAttempt, promptAsync, redirectUri, refreshStatus,
    request, setSpotifyAuthStatus, setSpotifyDisplayName]);

  const saveClientId = useCallback(async (value: string) => {
    if (value.trim() === spotifyService.getClientId()) return;
    if (busyRef.current) throw new Error("Finish connecting Spotify before changing the Client ID.");
    busyRef.current = true;
    attemptRef.current += 1;
    setIsConfiguring(true);
    try {
      await spotifyService.setClientId(value);
      setProfile(null);
      setError(null);
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setIsConfiguring(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const attempt = ++attemptRef.current;
    busyRef.current = true;
    setIsAuthenticating(false);
    setIsConfiguring(true);
    try {
      await spotifyService.clearUserToken();
      if (!mountedRef.current || attemptRef.current !== attempt) return;
      setProfile(null);
      setError(null);
      setSpotifyDisplayName(null);
      setSpotifyAuthStatus(spotifyService.isAuthConfigured() ? "notConnected" : "notConfigured");
    } finally {
      if (attemptRef.current === attempt) {
        busyRef.current = false;
        if (mountedRef.current) setIsConfiguring(false);
      }
    }
  }, [setSpotifyAuthStatus, setSpotifyDisplayName]);

  return {
    available, clientId, disconnect, error, isAuthenticating, isConfiguring,
    profile, redirectUri, refreshStatus, requestAuthorization, saveClientId,
  };
}
