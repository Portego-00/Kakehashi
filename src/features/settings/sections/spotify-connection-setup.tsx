import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { isSpotifyClientIdValid } from "../../../services/spotifyService";
import { useSettingsControllerContext } from "../SettingsControllerContext";

const SPOTIFY_DASHBOARD_URL = "https://developer.spotify.com/dashboard";
const SPOTIFY_DEVELOPMENT_MODE_URL =
  "https://developer.spotify.com/documentation/web-api/concepts/quota-modes";
const SPOTIFY_REDIRECT_URI_URL =
  "https://developer.spotify.com/documentation/web-api/concepts/redirect_uri";

export function SpotifyConnectionSetup({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const {
    getSpotifyStatusLabel,
    handleSpotifyLogin,
    handleSpotifyLogout,
    isSpotifyAuthenticating,
    isSpotifyAuthAvailable,
    isSpotifyConfiguring,
    saveSpotifyClientId,
    spotifyAuthStatus,
    spotifyClientId,
    spotifyRedirectUri,
    theme,
  } = useSettingsControllerContext();
  const [clientIdDraft, setClientIdDraft] = useState(spotifyClientId);
  const [showGuide, setShowGuide] = useState(!spotifyClientId);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setClientIdDraft(spotifyClientId);
  }, [spotifyClientId]);

  const isConnected = spotifyAuthStatus === "authorized";
  const isBusy = isSaving || isSpotifyConfiguring || isSpotifyAuthenticating;
  const hasUnsavedChanges = clientIdDraft.trim() !== spotifyClientId;
  const bodyStyle = [setupStyles.body, { color: theme.textSecondary }];
  const headingStyle = [setupStyles.heading, { color: theme.textColor }];
  const linkStyle = [setupStyles.link, { color: theme.primary }];

  const openLink = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      setError("Could not open the browser. Please try again.");
    }
  };

  const saveClientId = async (remove = false) => {
    if (isBusy) return;
    setError("");
    setNotice("");
    const nextClientId = remove ? "" : clientIdDraft.trim();
    if (!remove && !isSpotifyClientIdValid(nextClientId)) {
      setError(
        "Enter the 32-character Client ID from your Spotify app’s Settings. Do not paste the Client Secret.",
      );
      return;
    }
    setIsSaving(true);
    try {
      await saveSpotifyClientId(nextClientId);
      setClientIdDraft(nextClientId);
      setNotice(
        remove
          ? "Client ID removed and Spotify disconnected."
          : "Client ID saved. You can now connect Spotify.",
      );
      if (remove) setShowGuide(true);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Could not save your Spotify Client ID. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const disconnect = async () => {
    setError("");
    setNotice("");
    try {
      await handleSpotifyLogout();
    } catch {
      setError("Could not disconnect Spotify. Please try again.");
    }
  };

  return (
    <View style={[setupStyles.container, { borderTopColor: theme.border }]}>
      <TouchableOpacity
        style={setupStyles.disclosure}
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityLabel="Spotify connection settings"
        accessibilityState={{ expanded }}
      >
        <View style={setupStyles.disclosureText}>
          <Text style={headingStyle}>Spotify connection</Text>
          <Text style={bodyStyle}>
            {spotifyClientId
              ? getSpotifyStatusLabel()
              : "Set up your personal Spotify app to connect."}
          </Text>
        </View>
        <Text style={linkStyle}>
          {expanded ? "Hide" : spotifyClientId ? "Manage" : "Set up"}
        </Text>
      </TouchableOpacity>

      {expanded && (
        <View style={setupStyles.content}>
          <Text style={bodyStyle}>
            Your personal Client ID connects playlists and playback. Song search
            continues to work without this setup.
          </Text>

          <TouchableOpacity
            onPress={() => setShowGuide((visible) => !visible)}
            style={setupStyles.textButton}
            accessibilityRole="button"
            accessibilityState={{ expanded: showGuide }}
          >
            <Text style={linkStyle}>
              {showGuide ? "Hide setup guide" : "Show setup guide"}
            </Text>
          </TouchableOpacity>

          {showGuide && (
            <View style={setupStyles.guide}>
              <View style={setupStyles.step}>
                <Text style={headingStyle}>Before you start</Text>
                <Text style={bodyStyle}>
                  You need Spotify Premium on the account that owns the developer
                  app. Premium must stay active for development mode and is also
                  required for playback control.
                </Text>
                <Text style={bodyStyle}>
                  Install Spotify and sign in with that same account. Open Spotify
                  and play a track before using playback in Kakehashi.
                </Text>
                <Text style={bodyStyle}>
                  Spotify development apps allow up to 5 authorized users. This
                  guide sets up an app for your own account.
                </Text>
              </View>

              <View style={setupStyles.step}>
                <Text style={headingStyle}>1. Open the developer dashboard</Text>
                <Text style={bodyStyle}>
                  Sign in with your Premium Spotify account and accept Spotify’s
                  developer terms if prompted.
                </Text>
                <TouchableOpacity
                  accessibilityRole="link"
                  style={setupStyles.textButton}
                  onPress={() => void openLink(SPOTIFY_DASHBOARD_URL)}
                >
                  <Text style={linkStyle}>Open Spotify Developer Dashboard</Text>
                </TouchableOpacity>
              </View>

              <View style={setupStyles.step}>
                <Text style={headingStyle}>2. Create your Spotify app</Text>
                <Text style={bodyStyle}>
                  Choose Create app. Use “Kakehashi personal” as the app name and
                  “Personal playlist access and playback” as the description.
                  Select Web API when asked which API you will use.
                </Text>
                <Text style={bodyStyle}>
                  Add this exact value under Redirect URIs, choose Add, then save
                  the app. Long-press the address below to copy it. Every character
                  must match, including the slashes.
                </Text>
                <Text
                  selectable
                  accessibilityLabel={`Spotify redirect URI: ${spotifyRedirectUri}`}
                  style={[
                    setupStyles.redirectUri,
                    {
                      color: theme.textColor,
                      borderColor: theme.border,
                      backgroundColor: theme.backgroundColor,
                    },
                  ]}
                >
                  {spotifyRedirectUri}
                </Text>
              </View>

              <View style={setupStyles.step}>
                <Text style={headingStyle}>3. Copy your Client ID</Text>
                <Text style={bodyStyle}>
                  Open your new app’s Settings and copy the Client ID. In Users
                  Management, add your own Spotify account’s name and email if it
                  is not already listed.
                </Text>
                <Text style={bodyStyle}>
                  Kakehashi only needs the Client ID. The Client Secret is never
                  needed; keep it private.
                </Text>
              </View>

              <View style={setupStyles.step}>
                <Text style={headingStyle}>4. Save and connect</Text>
                <Text style={bodyStyle}>
                  Paste your Client ID below and tap Save Client ID. Then tap
                  Connect Spotify, sign in with the same account, and approve the
                  requested access.
                </Text>
              </View>
            </View>
          )}

          <View style={setupStyles.step}>
            <Text style={headingStyle}>Client ID</Text>
            <TextInput
              accessibilityLabel="Spotify Client ID"
              placeholder="Paste your 32-character Client ID"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              autoComplete="off"
              editable={!isBusy}
              value={clientIdDraft}
              onChangeText={(value) => {
                setClientIdDraft(value);
                setError("");
                setNotice("");
              }}
              style={[
                setupStyles.input,
                {
                  color: theme.textColor,
                  borderColor: error ? theme.error : theme.border,
                  backgroundColor: theme.backgroundColor,
                },
              ]}
            />
            <Text style={bodyStyle}>
              Use the Client ID, not the Client Secret. It is saved on this device.
              {spotifyClientId
                ? " Replacing or removing it disconnects Spotify."
                : ""}
            </Text>
          </View>

          {!!error && (
            <Text
              selectable
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              style={[setupStyles.body, { color: theme.error }]}
            >
              {error}
            </Text>
          )}
          {!!notice && (
            <Text accessibilityLiveRegion="polite" style={bodyStyle}>
              {notice}
            </Text>
          )}

          <View style={setupStyles.actions}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: isBusy || !hasUnsavedChanges }}
              disabled={isBusy || !hasUnsavedChanges}
              onPress={() => void saveClientId()}
              style={[
                setupStyles.button,
                { borderColor: theme.border },
                (isBusy || !hasUnsavedChanges) && setupStyles.disabled,
              ]}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <Text style={[setupStyles.buttonText, { color: theme.primary }]}>
                  Save Client ID
                </Text>
              )}
            </TouchableOpacity>
            {!isConnected && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{
                  disabled: isBusy || !isSpotifyAuthAvailable || hasUnsavedChanges,
                }}
                disabled={isBusy || !isSpotifyAuthAvailable || hasUnsavedChanges}
                onPress={() => void handleSpotifyLogin()}
                style={[
                  setupStyles.button,
                  { borderColor: theme.primary, backgroundColor: theme.primary },
                  (isBusy || !isSpotifyAuthAvailable || hasUnsavedChanges) &&
                    setupStyles.disabled,
                ]}
              >
                {isSpotifyAuthenticating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[setupStyles.buttonText, { color: "#fff" }]}>
                    Connect Spotify
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>

          {hasUnsavedChanges && (
            <Text style={bodyStyle}>Save your Client ID before connecting.</Text>
          )}
          {!!spotifyClientId && (
            <View style={setupStyles.actions}>
              {isConnected && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isBusy }}
                  disabled={isBusy}
                  style={setupStyles.textButton}
                  onPress={() => void disconnect()}
                >
                  <Text style={linkStyle}>Disconnect Spotify</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ disabled: isBusy }}
                disabled={isBusy}
                style={setupStyles.textButton}
                onPress={() => void saveClientId(true)}
              >
                <Text style={[setupStyles.link, { color: theme.error }]}>
                  Remove Client ID
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={{ expanded: showTroubleshooting }}
            style={setupStyles.textButton}
            onPress={() => setShowTroubleshooting((visible) => !visible)}
          >
            <Text style={linkStyle}>
              {showTroubleshooting ? "Hide troubleshooting" : "Troubleshooting"}
            </Text>
          </TouchableOpacity>
          {showTroubleshooting && (
            <View style={setupStyles.guide}>
              <Text style={bodyStyle}>
                Invalid redirect URI: check that your app’s saved Redirect URIs
                includes the exact address shown in step 2.
              </Text>
              <Text style={bodyStyle}>
                Access denied: check the saved Client ID, sign in with the account
                listed in Users Management, and approve all requested permissions.
              </Text>
              <Text style={bodyStyle}>
                Premium required: check that the developer app owner’s Premium
                subscription is active and that you connect that same account.
              </Text>
              <Text style={bodyStyle}>
                Playlist will not import: Spotify development apps can only read
                tracks from playlists you own or collaborate on.
              </Text>
              <Text style={bodyStyle}>
                No active device: open Spotify, play a track, then return to
                Kakehashi and try again. Keep Spotify signed in to the connected
                account.
              </Text>
              <TouchableOpacity
                accessibilityRole="link"
                style={setupStyles.textButton}
                onPress={() => void openLink(SPOTIFY_DEVELOPMENT_MODE_URL)}
              >
                <Text style={linkStyle}>Spotify development mode requirements</Text>
              </TouchableOpacity>
              <TouchableOpacity
                accessibilityRole="link"
                style={setupStyles.textButton}
                onPress={() => void openLink(SPOTIFY_REDIRECT_URI_URL)}
              >
                <Text style={linkStyle}>Spotify redirect URI help</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const setupStyles = StyleSheet.create({
  container: { borderTopWidth: StyleSheet.hairlineWidth },
  disclosure: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  disclosureText: { flex: 1, gap: 4 },
  content: { paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  heading: { fontSize: 15, fontWeight: "600" },
  body: { fontSize: 14, lineHeight: 21 },
  link: { fontSize: 14, fontWeight: "600" },
  guide: { gap: 16 },
  step: { gap: 8 },
  textButton: { minHeight: 44, justifyContent: "center", alignSelf: "flex-start" },
  redirectUri: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "monospace",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  button: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  buttonText: { fontSize: 14, fontWeight: "600" },
  disabled: { opacity: 0.5 },
});
