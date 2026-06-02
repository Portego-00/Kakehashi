import React from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

const YOUTUBE_RED = "#FF0000";
const SPOTIFY_GREEN = "#1DB954";
const SPOTIFY_BLACK = "#191414";
const APPLE_MUSIC_PINK = "#FA2D48";

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
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Circle cx={16} cy={16} r={14} fill={SPOTIFY_GREEN} />
      <Path
        d="M9.5 12.4c4.9-1.5 10.9-.9 15 2"
        stroke={SPOTIFY_BLACK}
        strokeWidth={2.1}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M10.8 16.1c3.9-1.1 8.2-.6 11.4 1.4"
        stroke={SPOTIFY_BLACK}
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M12 19.6c2.9-.7 5.5-.4 7.9 1.1"
        stroke={SPOTIFY_BLACK}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

function AppleMusicBrandIcon({ size = 28 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Rect x={3} y={3} width={26} height={26} rx={7} fill={APPLE_MUSIC_PINK} />
      <Path
        d="M21.4 8.2v12.1c0 2.1-1.7 3.6-4 3.6-2 0-3.4-1.1-3.4-2.7 0-1.8 1.7-3 4-3 .6 0 1.1.1 1.5.3v-7.2l-7.7 1.5v9.8c0 2.1-1.7 3.6-4 3.6-2 0-3.4-1.1-3.4-2.7 0-1.8 1.7-3 4-3 .6 0 1.1.1 1.5.3V10.4c0-.6.4-1.1 1-1.2l9.6-1.9c.5-.1.9.2.9.7z"
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
