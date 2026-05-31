import { Ionicons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useFocusEffect } from "expo-router/react-navigation";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlassButton } from "../../src/components/GlassButton";
import {
  DEFAULT_ANIME_TRANSCRIPT_VIEWER_SETTINGS,
  getAnimeTranscriptViewerSettings,
  updateAnimeTranscriptViewerSettings,
  type AnimeTranscriptSubtitleSizePreset,
  type AnimeTranscriptViewerSettings,
} from "../../src/utils/animeTranscriptViewerSettings";
import { withAlpha } from "../../src/utils/subjectColors";
import { useTheme } from "../../src/utils/theme";

const SUBTITLE_SIZE_PRESETS: AnimeTranscriptSubtitleSizePreset[] = [
  "small",
  "medium",
  "large",
];

const SUBTITLE_SIZE_LABELS: Record<AnimeTranscriptSubtitleSizePreset, string> = {
  small: "Small",
  medium: "Medium",
  large: "Large",
};

const SUBTITLE_TEXT_COLOR_OPTIONS = [
  "#ffffff",
  "#f8fafc",
  "#fde68a",
  "#93c5fd",
  "#bbf7d0",
  "#fca5a5",
] as const;

const SUBTITLE_OUTLINE_COLOR_OPTIONS = [
  "#000000",
  "#111827",
  "#ffffff",
  "#1f2937",
  "#7f1d1d",
] as const;

const MIN_OUTLINE_THICKNESS = 0;
const MAX_OUTLINE_THICKNESS = 6;

function roundToHalf(value: number): number {
  return Math.round(value * 2) / 2;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

export default function AnimeTranscriptDevSettingsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<AnimeTranscriptViewerSettings>(
    DEFAULT_ANIME_TRANSCRIPT_VIEWER_SETTINGS
  );

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    const loadedSettings = await getAnimeTranscriptViewerSettings();
    setSettings(loadedSettings);
    setIsLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSettings();
    }, [loadSettings])
  );

  const persistSettingsPatch = useCallback(
    async (patch: Partial<AnimeTranscriptViewerSettings>) => {
      setSettings((previous) => ({ ...previous, ...patch }));
      const updated = await updateAnimeTranscriptViewerSettings(patch);
      setSettings(updated);
    },
    []
  );

  const handleSubtitleSizeSelect = useCallback(
    (preset: AnimeTranscriptSubtitleSizePreset) => {
      void persistSettingsPatch({ subtitleSizePreset: preset });
    },
    [persistSettingsPatch]
  );

  const previewSubtitleStyle = useMemo(() => {
    const outlineThickness = settings.fullscreenSubtitleOutlineThickness;
    const subtitleShadowStyle =
      outlineThickness > 0
        ? {
            textShadowColor: settings.fullscreenSubtitleOutlineColor,
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: Math.max(0.8, outlineThickness * 1.4),
          }
        : null;

    return [
      styles.previewSubtitle,
      {
        color: settings.fullscreenSubtitleTextColor,
      },
      subtitleShadowStyle,
    ];
  }, [
    settings.fullscreenSubtitleOutlineColor,
    settings.fullscreenSubtitleOutlineThickness,
    settings.fullscreenSubtitleTextColor,
  ]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar style={theme.statusBarStyle} />
        <View
          style={[
            styles.header,
            {
              paddingTop: Math.max(insets.top + 8, 20),
            },
          ]}
        >
          <GlassButton
            iconName="arrow-back"
            iconSize={20}
            iconColor={theme.textColor}
            variant="light"
            style={styles.headerGlassButton}
            onPress={() => router.back()}
          />
          <Text style={[styles.headerTitle, { color: theme.textColor }]}>Viewer Settings</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
      <StatusBar style={theme.statusBarStyle} />

      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top + 8, 20),
          },
        ]}
      >
        <GlassButton
          iconName="arrow-back"
          iconSize={20}
          iconColor={theme.textColor}
          variant="light"
          style={styles.headerGlassButton}
          onPress={() => router.back()}
        />
        <Text style={[styles.headerTitle, { color: theme.textColor }]}>Viewer Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom + 24, 24) },
        ]}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            {
              borderColor: theme.border,
              backgroundColor: theme.cardBackground,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.textColor }]}>Playback</Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Control playback and orientation behavior.</Text>

          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: theme.textColor }]}>Pause on tooltip open</Text>
            <Switch
              value={settings.pausePlaybackOnTooltipOpen}
              onValueChange={(value) => {
                void persistSettingsPatch({ pausePlaybackOnTooltipOpen: value });
              }}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: theme.textColor }]}>
              Auto-rotate fullscreen with device sensor
            </Text>
            <Switch
              value={settings.autoRotateFullscreenWithDeviceMotion}
              onValueChange={(value) => {
                void persistSettingsPatch({
                  autoRotateFullscreenWithDeviceMotion: value,
                });
              }}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: theme.textColor }]}>
              Show translate caption button
            </Text>
            <Switch
              value={settings.showPauseAndTranslateCurrentCaptionButton}
              onValueChange={(value) => {
                void persistSettingsPatch({
                  showPauseAndTranslateCurrentCaptionButton: value,
                });
              }}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>

          <View style={styles.toggleRow}>
            <Text style={[styles.toggleLabel, { color: theme.textColor }]}>
              Show subtitle search button
            </Text>
            <Switch
              value={settings.showSubtitleSearchButton}
              onValueChange={(value) => {
                void persistSettingsPatch({
                  showSubtitleSearchButton: value,
                });
              }}
              trackColor={{ false: "#767577", true: theme.primary }}
              thumbColor="#f4f3f4"
            />
          </View>
        </View>

        <View
          style={[
            styles.card,
            {
              borderColor: theme.border,
              backgroundColor: theme.cardBackground,
            },
          ]}
        >
          <Text style={[styles.cardTitle, { color: theme.textColor }]}>Fullscreen Captions</Text>
          <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Adjust subtitle style while in fullscreen mode.</Text>

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Size</Text>
            <View style={styles.pillRow}>
              {SUBTITLE_SIZE_PRESETS.map((preset) => {
                const selected = settings.subtitleSizePreset === preset;
                return (
                  <TouchableOpacity
                    key={preset}
                    style={[
                      styles.optionPill,
                      {
                        borderColor: selected ? theme.primary : theme.border,
                        backgroundColor: selected
                          ? withAlpha(theme.primary, 0.14)
                          : withAlpha(theme.backgroundColor, 0.7),
                      },
                    ]}
                    onPress={() => handleSubtitleSizeSelect(preset)}
                    activeOpacity={0.82}
                  >
                    <Text
                      style={[
                        styles.optionPillText,
                        { color: selected ? theme.primary : theme.textSecondary },
                      ]}
                    >
                      {SUBTITLE_SIZE_LABELS[preset]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Text color</Text>
            <View style={styles.colorRow}>
              {SUBTITLE_TEXT_COLOR_OPTIONS.map((color) => {
                const selected = settings.fullscreenSubtitleTextColor.toLowerCase() === color;
                return (
                  <TouchableOpacity
                    key={`subtitle-text-color-${color}`}
                    style={[
                      styles.colorSwatch,
                      {
                        backgroundColor: color,
                        borderColor: selected ? theme.primary : withAlpha(theme.textColor, 0.3),
                      },
                    ]}
                    onPress={() => {
                      void persistSettingsPatch({ fullscreenSubtitleTextColor: color });
                    }}
                    activeOpacity={0.82}
                  >
                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={color === "#ffffff" ? "#111827" : "#ffffff"}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sliderHeaderRow}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Outline thickness</Text>
              <Text style={[styles.sliderValue, { color: theme.textColor }]}>
                {settings.fullscreenSubtitleOutlineThickness.toFixed(1)}
              </Text>
            </View>
            <Slider
              value={settings.fullscreenSubtitleOutlineThickness}
              minimumValue={MIN_OUTLINE_THICKNESS}
              maximumValue={MAX_OUTLINE_THICKNESS}
              step={0.5}
              minimumTrackTintColor={theme.primary}
              maximumTrackTintColor={withAlpha(theme.textSecondary, 0.4)}
              thumbTintColor={theme.primary}
              onValueChange={(value) => {
                setSettings((previous) => ({
                  ...previous,
                  fullscreenSubtitleOutlineThickness: roundToHalf(value),
                }));
              }}
              onSlidingComplete={(value) => {
                void persistSettingsPatch({
                  fullscreenSubtitleOutlineThickness: roundToHalf(value),
                });
              }}
            />
          </View>

          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Outline color</Text>
            <View style={styles.colorRow}>
              {SUBTITLE_OUTLINE_COLOR_OPTIONS.map((color) => {
                const selected = settings.fullscreenSubtitleOutlineColor.toLowerCase() === color;
                return (
                  <TouchableOpacity
                    key={`subtitle-outline-color-${color}`}
                    style={[
                      styles.colorSwatch,
                      {
                        backgroundColor: color,
                        borderColor: selected ? theme.primary : withAlpha(theme.textColor, 0.3),
                      },
                    ]}
                    onPress={() => {
                      void persistSettingsPatch({ fullscreenSubtitleOutlineColor: color });
                    }}
                    activeOpacity={0.82}
                  >
                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={color === "#ffffff" ? "#111827" : "#ffffff"}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionBlock}>
            <View style={styles.sliderHeaderRow}>
              <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>Background opacity</Text>
              <Text style={[styles.sliderValue, { color: theme.textColor }]}>
                {Math.round(settings.fullscreenSubtitleBackgroundOpacity * 100)}%
              </Text>
            </View>
            <Slider
              value={settings.fullscreenSubtitleBackgroundOpacity}
              minimumValue={0}
              maximumValue={1}
              step={0.01}
              minimumTrackTintColor={theme.primary}
              maximumTrackTintColor={withAlpha(theme.textSecondary, 0.4)}
              thumbTintColor={theme.primary}
              onValueChange={(value) => {
                setSettings((previous) => ({
                  ...previous,
                  fullscreenSubtitleBackgroundOpacity: roundToTwoDecimals(value),
                }));
              }}
              onSlidingComplete={(value) => {
                void persistSettingsPatch({
                  fullscreenSubtitleBackgroundOpacity: roundToTwoDecimals(value),
                });
              }}
            />
          </View>

          <View
            style={[
              styles.previewWrap,
              { borderColor: theme.border, backgroundColor: withAlpha(theme.backgroundColor, 0.7) },
            ]}
          >
            <View
              style={[
                styles.previewSubtitleContainer,
                { backgroundColor: withAlpha("#000000", settings.fullscreenSubtitleBackgroundOpacity) },
              ]}
            >
              <Text style={previewSubtitleStyle}>字幕プレビュー</Text>
            </View>
          </View>
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
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerGlassButton: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: "600",
  },
  content: {
    paddingHorizontal: 14,
    gap: 12,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  toggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
  },
  optionPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  optionPillText: {
    fontSize: 12,
    fontWeight: "700",
  },
  colorRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  sliderHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  sliderValue: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  previewWrap: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  previewSubtitleContainer: {
    maxWidth: "90%",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  previewSubtitle: {
    fontSize: 20,
    lineHeight: 30,
    fontWeight: "700",
  },
});
