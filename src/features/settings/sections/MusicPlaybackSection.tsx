import React from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";

import { useSettingsControllerContext } from "../SettingsControllerContext";
import { styles } from "../styles";

export function MusicPlaybackSection() {
  const {
    appleMusicAuthError,
    getAppleMusicStatusLabel,
    handleAppleMusicLogin,
    handlePlaybackSourceChange,
    isAppleMusicAuthenticating,
    Platform,
    showMusicPlaybackSection,
    songsPlaybackSource,
    theme,
    updateSectionOffset,
  } = useSettingsControllerContext();

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
            style={[styles.settingItem, { borderBottomColor: theme.border }]}
          >
            <Ionicons
              name="play-circle"
              size={24}
              color={theme.primary}
              style={styles.settingIcon}
            />
            <View style={styles.settingTextContainer}>
              <Text style={[styles.settingText, { color: theme.textColor }]}>
                Playback Source
              </Text>
              <Text
                style={[styles.settingSubtext, { color: theme.textSecondary }]}
              >
                Choose between YouTube video playback or Apple Music playback
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.settingItem,
              {
                borderBottomColor:
                  Platform.OS === "ios" ? theme.border : "transparent",
              },
            ]}
          >
            <View style={styles.playbackSelector}>
              <TouchableOpacity
                style={[
                  styles.playbackSourceButton,
                  {
                    borderColor: theme.border,
                    backgroundColor:
                      songsPlaybackSource === "youtube"
                        ? theme.primary
                        : "transparent",
                  },
                ]}
                onPress={() => {
                  void handlePlaybackSourceChange("youtube");
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.playbackSourceButtonText,
                    {
                      color:
                        songsPlaybackSource === "youtube"
                          ? "#fff"
                          : theme.textColor,
                    },
                  ]}
                >
                  YouTube
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.playbackSourceButton,
                  {
                    borderColor: theme.border,
                    backgroundColor:
                      songsPlaybackSource === "appleMusic"
                        ? theme.primary
                        : "transparent",
                  },
                ]}
                onPress={() => {
                  void handlePlaybackSourceChange("appleMusic");
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.playbackSourceButtonText,
                    {
                      color:
                        songsPlaybackSource === "appleMusic"
                          ? "#fff"
                          : theme.textColor,
                    },
                  ]}
                >
                  Apple Music
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View
            style={[
              styles.settingItemColumn,
              { borderBottomColor: "transparent" },
            ]}
          >
            <View style={styles.settingRow}>
              <Ionicons
                name="logo-apple"
                size={24}
                color={theme.primary}
                style={styles.settingIcon}
              />
              <View style={styles.settingTextContainer}>
                <Text style={[styles.settingText, { color: theme.textColor }]}>
                  Apple Music Login
                </Text>
                <Text
                  style={[
                    styles.settingSubtext,
                    { color: theme.textSecondary },
                  ]}
                >
                  Authorize Apple Music access for native catalog playback
                </Text>
              </View>
            </View>

            <View style={styles.musicLoginActions}>
              <TouchableOpacity
                style={[
                  styles.syncButton,
                  { backgroundColor: theme.primary },
                  isAppleMusicAuthenticating && styles.syncButtonDisabled,
                ]}
                onPress={handleAppleMusicLogin}
                activeOpacity={0.7}
                disabled={isAppleMusicAuthenticating}
              >
                {isAppleMusicAuthenticating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={[styles.syncButtonText, { color: "#fff" }]}>
                    Login / Refresh
                  </Text>
                )}
              </TouchableOpacity>
            </View>

            <Text
              style={[styles.syncStatusText, { color: theme.textSecondary }]}
            >
              Status: {getAppleMusicStatusLabel()}
            </Text>
            {appleMusicAuthError && (
              <Text style={[styles.syncStatusText, { color: theme.error }]}>
                {appleMusicAuthError.message}
              </Text>
            )}
          </View>
        </View>
      )}
    </>
  );
}
