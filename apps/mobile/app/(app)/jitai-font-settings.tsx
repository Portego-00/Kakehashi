import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  downloadJitaiFont,
  formatJitaiFontSize,
  getDefaultJitaiSelectedFontIds,
  getInstalledJitaiFonts,
  JITAI_DOWNLOADABLE_FONTS,
  loadDownloadedJitaiFonts,
  removeDownloadedJitaiFont,
  sanitizeJitaiSelectedFontIds,
  type DownloadedJitaiFont,
} from "../../src/utils/jitaiFonts";
import { useSettingsStore } from "../../src/utils/store";
import { useTheme } from "../../src/utils/theme";

const FONT_PREVIEW_TEXT = "日本語の読み練習 こんにちは 漢字 カタカナ";

export default function JitaiFontSettingsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { jitaiSelectedFontIds, setJitaiSelectedFontIds } = useSettingsStore();

  const [downloadedJitaiFonts, setDownloadedJitaiFonts] = useState<
    DownloadedJitaiFont[]
  >([]);
  const [isLoadingJitaiFonts, setIsLoadingJitaiFonts] = useState(false);
  const [hasInitializedJitaiFonts, setHasInitializedJitaiFonts] =
    useState(false);
  const [jitaiFontActionId, setJitaiFontActionId] = useState<string | null>(
    null,
  );

  const refreshJitaiFonts = useCallback(async (showLoader = false) => {
    try {
      if (showLoader) {
        setIsLoadingJitaiFonts(true);
      }
      const installedFonts = await loadDownloadedJitaiFonts();
      setDownloadedJitaiFonts(installedFonts);
    } catch (error) {
      console.error("Failed to refresh Jitai fonts:", error);
    } finally {
      setHasInitializedJitaiFonts(true);
      if (showLoader) {
        setIsLoadingJitaiFonts(false);
      }
    }
  }, []);

  const installedJitaiFonts = useMemo(
    () => getInstalledJitaiFonts(downloadedJitaiFonts),
    [downloadedJitaiFonts],
  );

  const downloadableJitaiFonts = useMemo(() => {
    const downloadedIds = new Set(downloadedJitaiFonts.map((font) => font.id));
    return JITAI_DOWNLOADABLE_FONTS.filter((font) => !downloadedIds.has(font.id));
  }, [downloadedJitaiFonts]);

  useEffect(() => {
    refreshJitaiFonts(true);
  }, [refreshJitaiFonts]);

  useEffect(() => {
    if (!hasInitializedJitaiFonts) {
      return;
    }

    const sanitized = sanitizeJitaiSelectedFontIds(
      jitaiSelectedFontIds,
      downloadedJitaiFonts,
    );
    const hasSameSelection =
      sanitized.length === jitaiSelectedFontIds.length &&
      sanitized.every((value, index) => value === jitaiSelectedFontIds[index]);

    if (!hasSameSelection) {
      setJitaiSelectedFontIds(sanitized);
    }
  }, [
    hasInitializedJitaiFonts,
    downloadedJitaiFonts,
    jitaiSelectedFontIds,
    setJitaiSelectedFontIds,
  ]);

  const toggleJitaiFontSelection = (fontId: string) => {
    if (jitaiSelectedFontIds.includes(fontId)) {
      if (jitaiSelectedFontIds.length === 1) {
        Alert.alert(
          "At least one font is required",
          "Keep at least one font selected for Jitai.",
        );
        return;
      }
      setJitaiSelectedFontIds(
        jitaiSelectedFontIds.filter((selectedId) => selectedId !== fontId),
      );
      return;
    }

    setJitaiSelectedFontIds([...jitaiSelectedFontIds, fontId]);
  };

  const handleDownloadJitaiFont = async (fontId: string) => {
    try {
      setJitaiFontActionId(fontId);
      const downloadedFont = await downloadJitaiFont(fontId);

      // Update locally first to keep list mounted and avoid UI flicker.
      setDownloadedJitaiFonts((previous) => {
        const withoutExisting = previous.filter((font) => font.id !== downloadedFont.id);
        return [...withoutExisting, downloadedFont];
      });

      const currentSelection = useSettingsStore.getState().jitaiSelectedFontIds;
      if (!currentSelection.includes(downloadedFont.id)) {
        setJitaiSelectedFontIds([...currentSelection, downloadedFont.id]);
      }
    } catch (error) {
      console.error("Failed to download Jitai font:", error);
      Alert.alert(
        "Download failed",
        "Could not download this font. Please check your connection and try again.",
      );
    } finally {
      setJitaiFontActionId(null);
    }
  };

  const handleRemoveDownloadedJitaiFont = (
    fontId: string,
    displayName: string,
  ) => {
    Alert.alert(
      "Remove downloaded font",
      `Remove ${displayName} from local storage?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              setJitaiFontActionId(fontId);
              await removeDownloadedJitaiFont(fontId);

              // Remove locally first to keep list mounted and avoid UI flicker.
              setDownloadedJitaiFonts((previous) =>
                previous.filter((font) => font.id !== fontId),
              );

              const currentSelection = useSettingsStore.getState().jitaiSelectedFontIds;
              const nextSelection = currentSelection.filter(
                (selectedId) => selectedId !== fontId,
              );
              setJitaiSelectedFontIds(
                nextSelection.length > 0
                  ? nextSelection
                  : getDefaultJitaiSelectedFontIds(),
              );
            } catch (error) {
              console.error("Failed to remove Jitai font:", error);
              Alert.alert("Error", "Could not remove this font.");
            } finally {
              setJitaiFontActionId(null);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />

      <View
        style={[
          styles.header,
          {
            backgroundColor: theme.headerBackground,
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={theme.headerText} />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.title, { color: theme.headerText }]}>
            Jitai Fonts
          </Text>
          <Text style={[styles.subtitle, { color: theme.headerText }]}>
            {`${jitaiSelectedFontIds.length} selected for random mode`}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Installed Fonts
          </Text>
          <Text style={[styles.sectionSubtext, { color: theme.textSecondary }]}>
            Select the fonts to include in Jitai randomization. Each row includes
            a live preview.
          </Text>

          {isLoadingJitaiFonts ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
                Loading fonts...
              </Text>
            </View>
          ) : (
            <View style={styles.fontList}>
              {installedJitaiFonts.map((font) => {
                const isSelected = jitaiSelectedFontIds.includes(font.id);
                const isBusy = jitaiFontActionId === font.id;
                return (
                  <View
                    key={font.id}
                    style={[
                      styles.fontCard,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.cardBackground,
                      },
                    ]}
                  >
                    <View style={styles.fontRowTop}>
                      <TouchableOpacity
                        style={styles.fontSelectArea}
                        onPress={() => toggleJitaiFontSelection(font.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons
                          name={isSelected ? "checkbox" : "square-outline"}
                          size={20}
                          color={isSelected ? theme.primary : theme.textSecondary}
                        />
                        <View style={styles.fontInfo}>
                          <Text style={[styles.fontName, { color: theme.textColor }]}>
                            {font.displayName}
                          </Text>
                          <Text style={[styles.fontMeta, { color: theme.textSecondary }]}>
                            {font.source === "bundled"
                              ? "Included with app"
                              : "Downloaded"}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      {font.source === "downloaded" && (
                        <TouchableOpacity
                          style={styles.actionIconButton}
                          onPress={() =>
                            handleRemoveDownloadedJitaiFont(font.id, font.displayName)
                          }
                          disabled={Boolean(jitaiFontActionId)}
                          activeOpacity={0.7}
                        >
                          {isBusy ? (
                            <ActivityIndicator size="small" color={theme.primary} />
                          ) : (
                            <Ionicons
                              name="trash-outline"
                              size={18}
                              color={theme.textSecondary}
                            />
                          )}
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text
                      style={[
                        styles.previewText,
                        { color: theme.textColor, fontFamily: font.family },
                      ]}
                    >
                      {FONT_PREVIEW_TEXT}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        <View
          style={[
            styles.section,
            {
              backgroundColor: theme.cardBackground,
              borderColor: theme.border,
            },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            More Fonts
          </Text>
          <Text style={[styles.sectionSubtext, { color: theme.textSecondary }]}>
            Download extra fonts on demand. They are stored locally and not bundled
            with the app.
          </Text>

          {downloadableJitaiFonts.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              All available fonts are already downloaded.
            </Text>
          ) : (
            <View style={styles.fontList}>
              {downloadableJitaiFonts.map((font) => {
                const isBusy = jitaiFontActionId === font.id;
                return (
                  <View
                    key={font.id}
                    style={[
                      styles.downloadRow,
                      {
                        borderColor: theme.border,
                        backgroundColor: theme.cardBackground,
                      },
                    ]}
                  >
                    <View style={styles.downloadInfo}>
                      <Text style={[styles.fontName, { color: theme.textColor }]}>
                        {font.displayName}
                      </Text>
                      <Text style={[styles.fontMeta, { color: theme.textSecondary }]}>
                        {`${formatJitaiFontSize(font.sizeBytes)} download`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.downloadButton,
                        {
                          backgroundColor: theme.primary,
                          opacity: jitaiFontActionId ? 0.7 : 1,
                        },
                      ]}
                      onPress={() => handleDownloadJitaiFont(font.id)}
                      disabled={Boolean(jitaiFontActionId)}
                      activeOpacity={0.8}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.downloadButtonText}>Download</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  headerTextContainer: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    opacity: 0.8,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  section: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  sectionSubtext: {
    fontSize: 13,
    marginTop: 4,
    marginBottom: 12,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  loadingText: {
    fontSize: 13,
  },
  fontList: {
    gap: 8,
  },
  fontCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  fontRowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  fontSelectArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  fontInfo: {
    marginLeft: 10,
    flex: 1,
  },
  fontName: {
    fontSize: 14,
    fontWeight: "600",
  },
  fontMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  actionIconButton: {
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  previewText: {
    fontSize: 22,
    marginTop: 8,
    lineHeight: 34,
  },
  downloadRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  downloadInfo: {
    flex: 1,
    marginRight: 12,
  },
  downloadButton: {
    minWidth: 96,
    height: 34,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  downloadButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 13,
  },
});
