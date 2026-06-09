import AsyncStorage from "@react-native-async-storage/async-storage";

export type AnimeTranscriptSubtitleSizePreset = "small" | "medium" | "large";

export type AnimeTranscriptViewerSettings = {
  pausePlaybackOnTooltipOpen: boolean;
  autoRotateFullscreenWithDeviceMotion: boolean;
  showPauseAndTranslateCurrentCaptionButton: boolean;
  showSubtitleSearchButton: boolean;
  subtitleSizePreset: AnimeTranscriptSubtitleSizePreset;
  fullscreenSubtitleTextColor: string;
  fullscreenSubtitleOutlineColor: string;
  fullscreenSubtitleOutlineThickness: number;
  fullscreenSubtitleBackgroundOpacity: number;
};

const ANIME_TRANSCRIPT_VIEWER_SETTINGS_KEY =
  "@wanikani_anime_transcript_viewer_settings_v1";

export const DEFAULT_ANIME_TRANSCRIPT_VIEWER_SETTINGS: AnimeTranscriptViewerSettings = {
  pausePlaybackOnTooltipOpen: false,
  autoRotateFullscreenWithDeviceMotion: true,
  showPauseAndTranslateCurrentCaptionButton: false,
  showSubtitleSearchButton: true,
  subtitleSizePreset: "medium",
  fullscreenSubtitleTextColor: "#ffffff",
  fullscreenSubtitleOutlineColor: "#000000",
  fullscreenSubtitleOutlineThickness: 0,
  fullscreenSubtitleBackgroundOpacity: 0.56,
};

const VALID_SUBTITLE_SIZE_PRESETS: AnimeTranscriptSubtitleSizePreset[] = [
  "small",
  "medium",
  "large",
];

function clampNumber(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function normalizeHexLikeColor(
  value: unknown,
  fallback: string
): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  if (trimmed.startsWith("#")) {
    return trimmed;
  }

  if (/^[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    return `#${trimmed}`;
  }

  return trimmed;
}

function normalizeSettings(
  value: Partial<AnimeTranscriptViewerSettings> | null | undefined
): AnimeTranscriptViewerSettings {
  const subtitleSizePreset = VALID_SUBTITLE_SIZE_PRESETS.includes(
    value?.subtitleSizePreset as AnimeTranscriptSubtitleSizePreset
  )
    ? (value?.subtitleSizePreset as AnimeTranscriptSubtitleSizePreset)
    : DEFAULT_ANIME_TRANSCRIPT_VIEWER_SETTINGS.subtitleSizePreset;

  const outlineThicknessRaw = Number(value?.fullscreenSubtitleOutlineThickness);
  const outlineThickness = Number.isFinite(outlineThicknessRaw)
    ? clampNumber(Math.round(outlineThicknessRaw * 2) / 2, 0, 6)
    : DEFAULT_ANIME_TRANSCRIPT_VIEWER_SETTINGS.fullscreenSubtitleOutlineThickness;

  const backgroundOpacityRaw = Number(value?.fullscreenSubtitleBackgroundOpacity);
  const backgroundOpacity = Number.isFinite(backgroundOpacityRaw)
    ? clampNumber(Math.round(backgroundOpacityRaw * 100) / 100, 0, 1)
    : DEFAULT_ANIME_TRANSCRIPT_VIEWER_SETTINGS.fullscreenSubtitleBackgroundOpacity;

  return {
    pausePlaybackOnTooltipOpen:
      typeof value?.pausePlaybackOnTooltipOpen === "boolean"
        ? value.pausePlaybackOnTooltipOpen
        : DEFAULT_ANIME_TRANSCRIPT_VIEWER_SETTINGS.pausePlaybackOnTooltipOpen,
    autoRotateFullscreenWithDeviceMotion:
      typeof value?.autoRotateFullscreenWithDeviceMotion === "boolean"
        ? value.autoRotateFullscreenWithDeviceMotion
        : DEFAULT_ANIME_TRANSCRIPT_VIEWER_SETTINGS.autoRotateFullscreenWithDeviceMotion,
    showPauseAndTranslateCurrentCaptionButton:
      typeof value?.showPauseAndTranslateCurrentCaptionButton === "boolean"
        ? value.showPauseAndTranslateCurrentCaptionButton
        : DEFAULT_ANIME_TRANSCRIPT_VIEWER_SETTINGS.showPauseAndTranslateCurrentCaptionButton,
    showSubtitleSearchButton:
      typeof value?.showSubtitleSearchButton === "boolean"
        ? value.showSubtitleSearchButton
        : DEFAULT_ANIME_TRANSCRIPT_VIEWER_SETTINGS.showSubtitleSearchButton,
    subtitleSizePreset,
    fullscreenSubtitleTextColor: normalizeHexLikeColor(
      value?.fullscreenSubtitleTextColor,
      DEFAULT_ANIME_TRANSCRIPT_VIEWER_SETTINGS.fullscreenSubtitleTextColor
    ),
    fullscreenSubtitleOutlineColor: normalizeHexLikeColor(
      value?.fullscreenSubtitleOutlineColor,
      DEFAULT_ANIME_TRANSCRIPT_VIEWER_SETTINGS.fullscreenSubtitleOutlineColor
    ),
    fullscreenSubtitleOutlineThickness: outlineThickness,
    fullscreenSubtitleBackgroundOpacity: backgroundOpacity,
  };
}

export async function getAnimeTranscriptViewerSettings(): Promise<AnimeTranscriptViewerSettings> {
  try {
    const raw = await AsyncStorage.getItem(ANIME_TRANSCRIPT_VIEWER_SETTINGS_KEY);
    if (!raw) {
      return DEFAULT_ANIME_TRANSCRIPT_VIEWER_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<AnimeTranscriptViewerSettings>;
    return normalizeSettings(parsed);
  } catch {
    return DEFAULT_ANIME_TRANSCRIPT_VIEWER_SETTINGS;
  }
}

export async function setAnimeTranscriptViewerSettings(
  nextSettings: AnimeTranscriptViewerSettings
): Promise<AnimeTranscriptViewerSettings> {
  const normalized = normalizeSettings(nextSettings);

  try {
    await AsyncStorage.setItem(
      ANIME_TRANSCRIPT_VIEWER_SETTINGS_KEY,
      JSON.stringify(normalized)
    );
  } catch {
    // Best-effort persistence.
  }

  return normalized;
}

export async function updateAnimeTranscriptViewerSettings(
  patch: Partial<AnimeTranscriptViewerSettings>
): Promise<AnimeTranscriptViewerSettings> {
  const current = await getAnimeTranscriptViewerSettings();
  return setAnimeTranscriptViewerSettings({
    ...current,
    ...patch,
  });
}
