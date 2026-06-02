import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from "react-native-svg";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

const YOUTUBE_RED = "#FF0000";
const SPOTIFY_GREEN = "#15C97F";
const APPLE_MUSIC_PINK = "#FA233B";
const APPLE_MUSIC_TOP = "#FB5C74";

type PlaybackProvider = "youtube" | "spotify" | "appleMusic";

function YouTubeBrandIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect x={2} y={7} width={28} height={18} rx={5} fill={YOUTUBE_RED} />
      <Path d="M13 11.5v9l8-4.5-8-4.5z" fill="#fff" />
    </Svg>
  );
}

function SpotifyBrandIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 236.05 225.25">
      <Path
        d="m122.37,3.31C61.99.91,11.1,47.91,8.71,108.29c-2.4,60.38,44.61,111.26,104.98,113.66,60.38,2.4,111.26-44.6,113.66-104.98C229.74,56.59,182.74,5.7,122.37,3.31Zm46.18,160.28c-1.36,2.4-4.01,3.6-6.59,3.24-.79-.11-1.58-.37-2.32-.79-14.46-8.23-30.22-13.59-46.84-15.93-16.62-2.34-33.25-1.53-49.42,2.4-3.51.85-7.04-1.3-7.89-4.81-.85-3.51,1.3-7.04,4.81-7.89,17.78-4.32,36.06-5.21,54.32-2.64,18.26,2.57,35.58,8.46,51.49,17.51,3.13,1.79,4.23,5.77,2.45,8.91Zm14.38-28.72c-2.23,4.12-7.39,5.66-11.51,3.43-16.92-9.15-35.24-15.16-54.45-17.86-19.21-2.7-38.47-1.97-57.26,2.16-1.02.22-2.03.26-3.01.12-3.41-.48-6.33-3.02-7.11-6.59-1.01-4.58,1.89-9.11,6.47-10.12,20.77-4.57,42.06-5.38,63.28-2.4,21.21,2.98,41.46,9.62,60.16,19.74,4.13,2.23,5.66,7.38,3.43,11.51Zm15.94-32.38c-2.1,4.04-6.47,6.13-10.73,5.53-1.15-.16-2.28-.52-3.37-1.08-19.7-10.25-40.92-17.02-63.07-20.13-22.15-3.11-44.42-2.45-66.18,1.97-5.66,1.15-11.17-2.51-12.32-8.16-1.15-5.66,2.51-11.17,8.16-12.32,24.1-4.89,48.74-5.62,73.25-2.18,24.51,3.44,47.99,10.94,69.81,22.29,5.12,2.66,7.11,8.97,4.45,14.09Z"
        fill={SPOTIFY_GREEN}
      />
    </Svg>
  );
}

function AppleMusicBrandIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Defs>
        <LinearGradient
          id="appleMusicGradient"
          x1="0.5"
          y1="0.99"
          x2="0.5"
          y2="0.02"
        >
          <Stop offset="0" stopColor={APPLE_MUSIC_PINK} />
          <Stop offset="1" stopColor={APPLE_MUSIC_TOP} />
        </LinearGradient>
      </Defs>
      <Rect
        width={512}
        height={512}
        rx={76.8}
        fill="url(#appleMusicGradient)"
      />
      <Path
        d="M199 359V199q0-9 10-11l138-28q11-2 12 10v122q0 15-45 20c-57 9-48 105 30 79 30-11 35-40 35-69V88s0-20-17-15l-170 35s-13 2-13 18v203q0 15-45 20c-57 9-48 105 30 79 30-11 35-40 35-69"
        fill="#fff"
      />
    </Svg>
  );
}

export function MusicPlaybackSection() {
  const {
    appleMusicAuthError,
    appleMusicAuthStatus,
    handlePlaybackSourceChange,
    isAppleMusicAuthAvailable,
    isAppleMusicAuthenticating,
    isSpotifyAuthAvailable,
    isSpotifyAuthenticating,
    appleMusicPlaybackAccessStatus,
    Platform,
    showMusicPlaybackSection,
    songsPlaybackSource,
    spotifyAuthError,
    spotifyAuthStatus,
    theme,
    updateSectionOffset,
  } = useSettingsControllerContext();

  const spotifyConnected = spotifyAuthStatus === "authorized";
  const appleMusicConnected = appleMusicAuthStatus === "authorized";

  const spotifyStatusLabel = spotifyConnected
    ? songsPlaybackSource === "spotify"
      ? "Selected"
      : "Connected"
    : isSpotifyAuthAvailable
      ? "Connect"
      : "Setup needed";

  const appleMusicStatusLabel = appleMusicConnected
    ? appleMusicPlaybackAccessStatus === "subscriptionRequired"
      ? "Needs subscription"
      : appleMusicPlaybackAccessStatus === "unavailable"
        ? "Unavailable"
        : songsPlaybackSource === "appleMusic"
          ? "Selected"
          : appleMusicPlaybackAccessStatus === "available"
            ? "Ready"
            : "Check access"
    : isAppleMusicAuthAvailable
      ? "Authorize"
      : "Setup needed";

  const renderProviderButton = ({
    source,
    label,
    statusLabel,
    brandColor,
    icon,
    isBusy = false,
  }: {
    source: PlaybackProvider;
    label: string;
    statusLabel: string;
    brandColor: string;
    icon: React.ReactNode;
    isBusy?: boolean;
  }) => {
    const isSelected = songsPlaybackSource === source;
    const isConnected =
      source === "youtube" ||
      (source === "spotify" && spotifyConnected) ||
      (source === "appleMusic" &&
        appleMusicConnected &&
        appleMusicPlaybackAccessStatus !== "subscriptionRequired" &&
        appleMusicPlaybackAccessStatus !== "unavailable");
    const isActive = isSelected && isConnected;

    return (
      <TouchableOpacity
        key={source}
        style={[
          styles.musicProviderButton,
          {
            borderColor: isActive ? brandColor : theme.border,
            backgroundColor: isActive
              ? `${brandColor}20`
              : theme.cardBackground,
          },
          isBusy && styles.syncButtonDisabled,
        ]}
        onPress={() => {
          void handlePlaybackSourceChange(source);
        }}
        activeOpacity={0.72}
        disabled={isBusy}
      >
        <View style={styles.musicProviderIconWrap}>
          {isBusy ? (
            <ActivityIndicator size="small" color={brandColor} />
          ) : (
            icon
          )}
        </View>
        <Text
          style={[styles.musicProviderLabel, { color: theme.textColor }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text
          style={[
            styles.musicProviderStatus,
            { color: isActive ? brandColor : theme.textSecondary },
          ]}
          numberOfLines={1}
        >
          {statusLabel}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      {showMusicPlaybackSection && (
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
          onLayout={(event) => {
            updateSectionOffset("musicPlayback", event.nativeEvent.layout.y);
          }}
        >
          <Text
            style={[
              styles.sectionTitle,
              { color: theme.textColor, borderBottomColor: theme.border },
            ]}
          >
            Music Playback
          </Text>

          <View
            style={[
              styles.musicProviderSelector,
              {
                borderBottomColor:
                  spotifyAuthError ||
                  (Platform.OS === "ios" && appleMusicAuthError)
                    ? theme.border
                    : "transparent",
              },
            ]}
          >
            <View style={styles.musicProviderGrid}>
              {renderProviderButton({
                source: "youtube",
                label: "YouTube",
                statusLabel:
                  songsPlaybackSource === "youtube" ? "Selected" : "Available",
                brandColor: YOUTUBE_RED,
                icon: <YouTubeBrandIcon />,
              })}
              {renderProviderButton({
                source: "spotify",
                label: "Spotify",
                statusLabel: spotifyStatusLabel,
                brandColor: SPOTIFY_GREEN,
                icon: <SpotifyBrandIcon />,
                isBusy: isSpotifyAuthenticating,
              })}
              {Platform.OS === "ios" &&
                renderProviderButton({
                  source: "appleMusic",
                  label: "Apple Music",
                  statusLabel: appleMusicStatusLabel,
                  brandColor: APPLE_MUSIC_PINK,
                  icon: <AppleMusicBrandIcon />,
                  isBusy: isAppleMusicAuthenticating,
                })}
            </View>
          </View>

          {(spotifyAuthError ||
            (Platform.OS === "ios" && appleMusicAuthError)) && (
            <View style={styles.musicProviderErrorBlock}>
              {spotifyAuthError && (
                <Text style={[styles.syncStatusText, { color: theme.error }]}>
                  {spotifyAuthError.message}
                </Text>
              )}
              {Platform.OS === "ios" && appleMusicAuthError && (
                <Text style={[styles.syncStatusText, { color: theme.error }]}>
                  {appleMusicAuthError.message}
                </Text>
              )}
            </View>
          )}
        </View>
      )}
    </>
  );
}
