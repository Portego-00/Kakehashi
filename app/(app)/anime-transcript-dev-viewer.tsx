import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import Slider from "@react-native-community/slider";
import { useFocusEffect } from "expo-router/react-navigation";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { File, Paths } from "expo-file-system";
import { LinearGradient } from "expo-linear-gradient";
import { DeviceMotion } from "expo-sensors";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import type { VLCPlayerProps } from "react-native-vlc-media-player";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSharedValue, withTiming } from "react-native-reanimated";
import { VocabularyTooltip } from "../../src/components/VocabularyTooltip";
import { fontStyles } from "../../src/utils/fonts";
import {
  getAnimeTranscriptDevSession,
  type AnimeTranscriptSubtitleCue,
  type AnimeTranscriptVideoSourceType,
} from "../../src/utils/animeTranscriptDevSession";
import {
  updateAnimeTranscriptPlaybackDuration,
  updateAnimeTranscriptPlaybackProgress,
} from "../../src/utils/animeTranscriptPlaybackHistory";
import {
  DEFAULT_ANIME_TRANSCRIPT_VIEWER_SETTINGS,
  getAnimeTranscriptViewerSettings,
  type AnimeTranscriptSubtitleSizePreset,
} from "../../src/utils/animeTranscriptViewerSettings";
import {
  buildGrammarTooltipItem,
  buildJpdbFallbackTooltipItem,
  formatTimestamp,
  GRAMMAR_TOOLTIP_ID_MIN,
  inferTranscriptVideoSourceType,
  normalizeSubtitleCueTextForRendering,
  TOKEN_UNDERLINE_SEPARATOR,
} from "../../src/utils/animeTranscriptDevHelpers";
import {
  JpdbApiError,
  translateJapaneseToEnglish,
} from "../../src/utils/jpdbApi";
import { withAlpha } from "../../src/utils/subjectColors";
import { useTheme } from "../../src/utils/theme";
import {
  getHighlightSegments,
  isWaniKaniBackedMatch,
  type JpdbParsedTokenAnnotation,
  type KanjiMatch,
  type VocabularyMatch,
} from "../../src/utils/textHighlighting";

const INLINE_CONTROL_AUTO_HIDE_MS = 2200;
const FULLSCREEN_EXIT_AUTO_HIDE_MS = 2200;
const TOOLTIP_DEFAULT_HEIGHT = 180;
const VLC_DURATION_FORCE_MS_THRESHOLD = 30_000;
const EMPTY_VLC_SUBTITLE_FILE_NAME = "anime-transcript-vlc-empty-subtitle.srt";
const VLC_FULLSCREEN_SUBTITLE_LIFT = 58;
const PLAYBACK_FULLSCREEN_SKIP_SECONDS = 10;
const DEVICE_TILT_LANDSCAPE_ENTER_THRESHOLD = 0.74;
const DEVICE_TILT_PORTRAIT_RETURN_THRESHOLD = 0.45;
const DEVICE_TILT_TRANSITION_DEBOUNCE_MS = 320;
const VLC_RESUME_CORRECTION_DELAYS_MS = [45, 170];
const VLC_RESUME_CORRECTION_BACKSTEP_SECONDS = 0.18;
const PLAYBACK_PROGRESS_PERSIST_INTERVAL_MS = 3200;
const MIN_PLAYBACK_PROGRESS_PERSIST_DELTA_SECONDS = 1.6;
const TRANSCRIPT_SEARCH_RESULTS_LIMIT = 36;
const EMPTY_SUBTITLE_CUES: AnimeTranscriptSubtitleCue[] = [];
const EMPTY_VOCABULARY_MATCHES: VocabularyMatch[] = [];
const EMPTY_KANJI_MATCHES: KanjiMatch[] = [];
const EMPTY_JPDB_PARSED_TOKENS: JpdbParsedTokenAnnotation[] = [];

type SubtitleSizePreset = AnimeTranscriptSubtitleSizePreset;
type VlcTextTrack = {
  id?: number | string;
  name?: string;
};
type VlcProgressEvent = {
  currentTime?: number;
  duration?: number;
  position?: number;
};
type VlcLoadEvent = {
  duration?: number;
  textTracks?: VlcTextTrack[];
};

const SUBTITLE_SIZE_PRESET_METRICS: Record<
  SubtitleSizePreset,
  {
    panelFontSize: number;
    panelLineHeight: number;
    fullscreenFontSize: number;
    fullscreenLineHeight: number;
  }
> = {
  small: {
    panelFontSize: 18,
    panelLineHeight: 27,
    fullscreenFontSize: 15,
    fullscreenLineHeight: 22,
  },
  medium: {
    panelFontSize: 22,
    panelLineHeight: 34,
    fullscreenFontSize: 18,
    fullscreenLineHeight: 27,
  },
  large: {
    panelFontSize: 25,
    panelLineHeight: 38,
    fullscreenFontSize: 21,
    fullscreenLineHeight: 31,
  },
};

let VLCPlayerComponent: React.ComponentType<VLCPlayerProps> | null = null;
if (Platform.OS === "ios") {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    VLCPlayerComponent = require("react-native-vlc-media-player")
      .VLCPlayer as React.ComponentType<VLCPlayerProps>;
  } catch {
    VLCPlayerComponent = null;
  }
}

export default function AnimeTranscriptDevViewerScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = getAnimeTranscriptDevSession();
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState(0);
  const [isCustomFullscreen, setIsCustomFullscreen] = useState(false);
  const [fullscreenRotationDegrees, setFullscreenRotationDegrees] = useState<90 | -90>(
    90
  );
  const [showInlineFullscreenControl, setShowInlineFullscreenControl] = useState(true);
  const [showFullscreenExitControl, setShowFullscreenExitControl] = useState(true);
  const [viewerSettings, setViewerSettings] = useState(
    DEFAULT_ANIME_TRANSCRIPT_VIEWER_SETTINGS
  );
  const [shouldResumePlaybackAfterTooltipClose, setShouldResumePlaybackAfterTooltipClose] =
    useState(false);
  const [selectedItem, setSelectedItem] = useState<VocabularyMatch | KanjiMatch | null>(
    null
  );
  const [selectedSurfaceText, setSelectedSurfaceText] = useState<string | null>(null);
  const [selectedTokenKey, setSelectedTokenKey] = useState<string | null>(null);
  const [vlcPlaybackError, setVlcPlaybackError] = useState<string | null>(null);
  const [vlcDurationSeconds, setVlcDurationSeconds] = useState(0);
  const [vlcTextTrackId, setVlcTextTrackId] = useState(-1);
  const [vlcEmptySubtitleUri, setVlcEmptySubtitleUri] = useState<string | null>(null);
  const [isVlcPaused, setIsVlcPaused] = useState(false);
  const [isVlcSeeking, setIsVlcSeeking] = useState(false);
  const [vlcSeekPreviewRatio, setVlcSeekPreviewRatio] = useState(0);
  const [expoPlaybackError, setExpoPlaybackError] = useState<string | null>(null);
  const [expoDurationSeconds, setExpoDurationSeconds] = useState(0);
  const [isExpoPaused, setIsExpoPaused] = useState(false);
  const [isExpoSeeking, setIsExpoSeeking] = useState(false);
  const [expoSeekPreviewRatio, setExpoSeekPreviewRatio] = useState(0);
  const [subtitleSearchQuery, setSubtitleSearchQuery] = useState("");
  const [isSubtitleSearchVisible, setIsSubtitleSearchVisible] = useState(false);
  const [isTranslatingCurrentCue, setIsTranslatingCurrentCue] = useState(false);
  const [translationErrorMessage, setTranslationErrorMessage] = useState<string | null>(
    null
  );
  const [captionTranslationsByCueId, setCaptionTranslationsByCueId] = useState<
    Record<string, { text: string; isTruncated: boolean }>
  >({});
  const [tooltipInteractionMode, setTooltipInteractionMode] = useState<
    "press" | "hover" | null
  >(null);
  const [tooltipPosition, setTooltipPosition] = useState<{
    x: number;
    y: number;
    width: number;
  } | null>(null);
  const [tooltipAnchorRect, setTooltipAnchorRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [tooltipHeight, setTooltipHeight] = useState<number>(TOOLTIP_DEFAULT_HEIGHT);
  const tooltipOpacity = useSharedValue(0);
  const subtitleDragPosition = React.useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const subtitleAvoidanceTranslateY = React.useRef(new Animated.Value(0)).current;
  const subtitleDragOffset = React.useRef({ x: 0, y: 0 });
  const vlcPlayerRef = React.useRef<any>(null);
  const inlineControlHideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const fullscreenExitHideTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const vlcTextTrackRetryTimeoutsRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const vlcResumeCorrectionTimeoutsRef = React.useRef<ReturnType<typeof setTimeout>[]>(
    []
  );
  const isCustomFullscreenRef = React.useRef(isCustomFullscreen);
  const suppressFullscreenBackgroundTapUntilRef = React.useRef(0);
  const deviceTiltStateRef = React.useRef<
    "portrait" | "landscapeLeft" | "landscapeRight"
  >("portrait");
  const lastDeviceTiltChangeMsRef = React.useRef(0);
  const initialSeekSecondsRef = React.useRef(0);
  const hasAppliedInitialSeekRef = React.useRef(false);
  const currentTimeSecondsRef = React.useRef(0);
  const isSeekingRef = React.useRef(false);
  const isPlaybackPausedRef = React.useRef(false);
  const lastPersistedPositionSecondsRef = React.useRef(0);
  const lastPersistedDurationSecondsRef = React.useRef(0);

  const videoUri = session?.videoUri ?? null;
  const historyEntryId = session?.historyEntryId ?? null;
  const initialPlaybackPositionSeconds = Math.max(
    0,
    Number(
      session?.initialPlaybackPositionSeconds ?? session?.lastPlaybackPositionSeconds ?? 0
    ) || 0
  );
  const inferredVideoSourceType =
    inferTranscriptVideoSourceType(session?.videoFileName ?? null, null) ?? "mp4";
  const videoSourceType: AnimeTranscriptVideoSourceType =
    session?.videoSourceType ?? inferredVideoSourceType;
  const usesVlcPlayer = Platform.OS === "ios" && videoSourceType === "mkv";
  const subtitleCues = session?.subtitleCues ?? EMPTY_SUBTITLE_CUES;
  const vocabularyMatches =
    session?.vocabularyMatches ?? EMPTY_VOCABULARY_MATCHES;
  const kanjiMatches = session?.kanjiMatches ?? EMPTY_KANJI_MATCHES;
  const jpdbParsedTokens = session?.jpdbParsedTokens ?? EMPTY_JPDB_PARSED_TOKENS;
  const isFullscreen = isCustomFullscreen;
  const maxSubtitleCueEndSeconds = useMemo(() => {
    return subtitleCues.reduce((maximum, cue) => Math.max(maximum, cue.endTime), 0);
  }, [subtitleCues]);

  const player = useVideoPlayer(usesVlcPlayer ? null : videoUri, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.timeUpdateEventInterval = 0.2;
  });

  const applyInitialSeekForExpoIfNeeded = useCallback(
    (knownDurationSeconds?: number) => {
      if (usesVlcPlayer || hasAppliedInitialSeekRef.current) {
        return;
      }

      const targetSeconds = initialSeekSecondsRef.current;
      if (!Number.isFinite(targetSeconds) || targetSeconds <= 0) {
        hasAppliedInitialSeekRef.current = true;
        return;
      }

      const candidateDuration = Number(knownDurationSeconds ?? player.duration);
      const clampedTargetSeconds =
        Number.isFinite(candidateDuration) && candidateDuration > 0
          ? Math.min(candidateDuration, targetSeconds)
          : targetSeconds;

      player.currentTime = clampedTargetSeconds;
      setCurrentTimeSeconds(clampedTargetSeconds);
      setExpoSeekPreviewRatio(
        Number.isFinite(candidateDuration) && candidateDuration > 0
          ? clampedTargetSeconds / candidateDuration
          : 0
      );
      hasAppliedInitialSeekRef.current = true;
    },
    [player, usesVlcPlayer]
  );

  const refreshViewerSettings = useCallback(async () => {
    const nextSettings = await getAnimeTranscriptViewerSettings();
    setViewerSettings(nextSettings);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshViewerSettings();
    }, [refreshViewerSettings])
  );

  useEffect(() => {
    if (usesVlcPlayer) {
      return;
    }

    const timeSubscription = player.addListener("timeUpdate", ({ currentTime }) => {
      if (!isExpoSeeking) {
        setCurrentTimeSeconds(currentTime);
      }

      const playerDuration = Number(player.duration);
      if (Number.isFinite(playerDuration) && playerDuration > 0) {
        setExpoDurationSeconds(playerDuration);
      }
    });

    const sourceLoadSubscription = player.addListener("sourceLoad", ({ duration }) => {
      if (Number.isFinite(duration) && duration > 0) {
        setExpoDurationSeconds(duration);
      }
      applyInitialSeekForExpoIfNeeded(duration);
      setExpoPlaybackError(null);
    });

    const playingSubscription = player.addListener("playingChange", ({ isPlaying }) => {
      setIsExpoPaused(!isPlaying);
    });

    const statusSubscription = player.addListener("statusChange", ({ status, error }) => {
      if (status === "error") {
        setExpoPlaybackError(error?.message || "Could not load the selected video.");
        return;
      }
      if (status === "readyToPlay") {
        setExpoPlaybackError(null);
      }
    });

    return () => {
      timeSubscription.remove();
      sourceLoadSubscription.remove();
      playingSubscription.remove();
      statusSubscription.remove();
    };
  }, [applyInitialSeekForExpoIfNeeded, isExpoSeeking, player, usesVlcPlayer]);

  useEffect(() => {
    isCustomFullscreenRef.current = isCustomFullscreen;
  }, [isCustomFullscreen]);

  useEffect(() => {
    initialSeekSecondsRef.current = initialPlaybackPositionSeconds;
    hasAppliedInitialSeekRef.current = initialPlaybackPositionSeconds <= 0;
    lastPersistedPositionSecondsRef.current = Math.max(
      0,
      Number(session?.lastPlaybackPositionSeconds ?? initialPlaybackPositionSeconds ?? 0) || 0
    );
    lastPersistedDurationSecondsRef.current = Math.max(
      0,
      Number(session?.videoDurationSeconds ?? 0) || 0
    );
  }, [
    historyEntryId,
    initialPlaybackPositionSeconds,
    session?.lastPlaybackPositionSeconds,
    session?.videoDurationSeconds,
    videoUri,
  ]);

  const activeCues = useMemo(() => {
    return subtitleCues.filter(
      (cue) => currentTimeSeconds >= cue.startTime && currentTimeSeconds < cue.endTime
    );
  }, [currentTimeSeconds, subtitleCues]);
  const primaryActiveCue = activeCues[0] ?? null;
  const normalizedSubtitleSearchQuery = subtitleSearchQuery.trim().toLowerCase();
  const subtitleSearchResults = useMemo(() => {
    if (!normalizedSubtitleSearchQuery) {
      return [];
    }

    return subtitleCues
      .filter((cue) =>
        normalizeSubtitleCueTextForRendering(cue.text)
          .toLowerCase()
          .includes(normalizedSubtitleSearchQuery)
      )
      .slice(0, TRANSCRIPT_SEARCH_RESULTS_LIMIT);
  }, [normalizedSubtitleSearchQuery, subtitleCues]);
  useEffect(() => {
    if (viewerSettings.showSubtitleSearchButton) {
      return;
    }

    setIsSubtitleSearchVisible(false);
    setSubtitleSearchQuery("");
  }, [viewerSettings.showSubtitleSearchButton]);
  useEffect(() => {
    setTranslationErrorMessage(null);
  }, [primaryActiveCue?.id]);

  const vocabularyMatchesById = useMemo(
    () => new Map(vocabularyMatches.map((match) => [match.id, match])),
    [vocabularyMatches]
  );
  const allMatches = useMemo(
    () => [...vocabularyMatches, ...kanjiMatches],
    [vocabularyMatches, kanjiMatches]
  );
  const grammarUnderlineColor = theme.isDark ? "#fbbf24" : "#b45309";
  const verbUnderlineColor = theme.isDark ? "#34d399" : "#0f766e";
  const vocabUnderlineColor = theme.isDark ? "#60a5fa" : "#1d4ed8";
  const hoverPreviewEnabled =
    Platform.OS === "ios" ||
    Platform.OS === "web" ||
    (Platform.OS as string) === "macos";
  const subtitleSizePreset = viewerSettings.subtitleSizePreset;
  const subtitleSizeMetrics = SUBTITLE_SIZE_PRESET_METRICS[subtitleSizePreset];
  const { width: viewportWidth, height: viewportHeight } = useWindowDimensions();
  const isPortraitViewport = viewportHeight >= viewportWidth;
  const supportsFakeLandscapeFullscreen = Platform.OS === "ios" && !Platform.isPad;
  const shouldUseFakeLandscapeFullscreen =
    supportsFakeLandscapeFullscreen && !usesVlcPlayer && isPortraitViewport;
  const shouldUseVlcFakeLandscapeFullscreen =
    supportsFakeLandscapeFullscreen && usesVlcPlayer && isPortraitViewport;
  const expoDurationCandidate = Number(player.duration);
  const normalizedDurationForDisplay = Math.max(
    0,
    usesVlcPlayer
      ? vlcDurationSeconds
      : Number.isFinite(expoDurationCandidate) && expoDurationCandidate > 0
        ? expoDurationCandidate
        : expoDurationSeconds
  );
  const isSeeking = usesVlcPlayer ? isVlcSeeking : isExpoSeeking;
  const seekPreviewRatio = usesVlcPlayer ? vlcSeekPreviewRatio : expoSeekPreviewRatio;
  const isPlaybackPaused = usesVlcPlayer ? isVlcPaused : isExpoPaused;
  const playbackError = usesVlcPlayer ? vlcPlaybackError : expoPlaybackError;
  const currentProgressRatio =
    normalizedDurationForDisplay > 0
      ? Math.max(0, Math.min(1, currentTimeSeconds / normalizedDurationForDisplay))
      : 0;
  const visibleSeekRatio = isSeeking ? seekPreviewRatio : currentProgressRatio;
  const visibleCurrentTimeSeconds = isSeeking
    ? visibleSeekRatio * normalizedDurationForDisplay
    : currentTimeSeconds;
  const noSubtitleMessage = "No subtitle currently active at this timestamp.";
  const isVlcFullscreen = usesVlcPlayer && isCustomFullscreen;
  const isVlcFullscreenRotatedStage =
    isVlcFullscreen && shouldUseVlcFakeLandscapeFullscreen;
  const fullscreenSubtitleTransform = useMemo(
    () => [
      ...subtitleDragPosition.getTranslateTransform(),
      { translateY: subtitleAvoidanceTranslateY },
    ],
    [subtitleAvoidanceTranslateY, subtitleDragPosition]
  );
  useEffect(() => {
    currentTimeSecondsRef.current = currentTimeSeconds;
  }, [currentTimeSeconds]);

  useEffect(() => {
    isSeekingRef.current = isSeeking;
  }, [isSeeking]);

  useEffect(() => {
    isPlaybackPausedRef.current = isPlaybackPaused;
  }, [isPlaybackPaused]);
  const fullscreenSubtitleTextColor = viewerSettings.fullscreenSubtitleTextColor;
  const fullscreenSubtitleBackgroundColor = useMemo(
    () => withAlpha("#000000", viewerSettings.fullscreenSubtitleBackgroundOpacity),
    [viewerSettings.fullscreenSubtitleBackgroundOpacity]
  );
  const fullscreenSubtitleTextOutlineStyle = useMemo(() => {
    if (viewerSettings.fullscreenSubtitleOutlineThickness <= 0) {
      return null;
    }

    return {
      textShadowColor: viewerSettings.fullscreenSubtitleOutlineColor,
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: Math.max(
        0.8,
        viewerSettings.fullscreenSubtitleOutlineThickness * 1.4
      ),
    };
  }, [
    viewerSettings.fullscreenSubtitleOutlineColor,
    viewerSettings.fullscreenSubtitleOutlineThickness,
  ]);

  const normalizeVlcDurationSeconds = useCallback(
    (rawValue: number): number => {
      if (!Number.isFinite(rawValue) || rawValue <= 0) {
        return 0;
      }

      const secondsCandidate = rawValue;
      const millisecondsCandidate = rawValue / 1000;

      if (maxSubtitleCueEndSeconds > 0.5) {
        const secondsDistance = Math.abs(secondsCandidate - maxSubtitleCueEndSeconds);
        const millisecondsDistance = Math.abs(
          millisecondsCandidate - maxSubtitleCueEndSeconds
        );
        return millisecondsDistance < secondsDistance
          ? millisecondsCandidate
          : secondsCandidate;
      }

      if (rawValue > VLC_DURATION_FORCE_MS_THRESHOLD) {
        return millisecondsCandidate;
      }

      return secondsCandidate;
    },
    [maxSubtitleCueEndSeconds]
  );

  const normalizeVlcCurrentSeconds = useCallback(
    (
      rawCurrentTime: number,
      effectiveDurationSeconds: number,
      fallbackCurrentSeconds: number
    ): number => {
      const secondsCandidate = rawCurrentTime;
      const millisecondsCandidate = rawCurrentTime / 1000;

      if (effectiveDurationSeconds > 0) {
        const secondsOutOfRange = secondsCandidate > effectiveDurationSeconds + 5;
        const millisecondsOutOfRange = millisecondsCandidate > effectiveDurationSeconds + 5;

        if (secondsOutOfRange && !millisecondsOutOfRange) {
          return millisecondsCandidate;
        }

        if (millisecondsOutOfRange && !secondsOutOfRange) {
          return secondsCandidate;
        }

        const secondsDistance = Math.abs(secondsCandidate - fallbackCurrentSeconds);
        const millisecondsDistance = Math.abs(
          millisecondsCandidate - fallbackCurrentSeconds
        );
        return millisecondsDistance < secondsDistance
          ? millisecondsCandidate
          : secondsCandidate;
      }

      if (rawCurrentTime > VLC_DURATION_FORCE_MS_THRESHOLD) {
        return millisecondsCandidate;
      }

      return secondsCandidate;
    },
    []
  );

  const applyInitialSeekForVlcIfNeeded = useCallback(
    (durationSecondsCandidate: number) => {
      if (!usesVlcPlayer || hasAppliedInitialSeekRef.current) {
        return;
      }

      const targetSeconds = initialSeekSecondsRef.current;
      if (!Number.isFinite(targetSeconds) || targetSeconds <= 0) {
        hasAppliedInitialSeekRef.current = true;
        return;
      }

      const effectiveDurationSeconds =
        Number.isFinite(durationSecondsCandidate) && durationSecondsCandidate > 0
          ? durationSecondsCandidate
          : normalizedDurationForDisplay;
      if (!Number.isFinite(effectiveDurationSeconds) || effectiveDurationSeconds <= 0) {
        return;
      }

      const clampedTargetSeconds = Math.max(
        0,
        Math.min(effectiveDurationSeconds, targetSeconds)
      );
      const seekRatio = Math.max(
        0,
        Math.min(1, clampedTargetSeconds / effectiveDurationSeconds)
      );

      setCurrentTimeSeconds(clampedTargetSeconds);
      setVlcSeekPreviewRatio(seekRatio);
      if (vlcPlayerRef.current?.seek) {
        vlcPlayerRef.current.seek(seekRatio);
      } else if (vlcPlayerRef.current?.setNativeProps) {
        vlcPlayerRef.current.setNativeProps({ seek: seekRatio });
      }
      hasAppliedInitialSeekRef.current = true;
    },
    [normalizedDurationForDisplay, usesVlcPlayer]
  );

  const resolveDisabledVlcTextTrackId = useCallback((tracks: VlcTextTrack[] | undefined) => {
    if (!Array.isArray(tracks) || tracks.length === 0) {
      return -1;
    }

    const toNumericTrackId = (track: VlcTextTrack | undefined): number => {
      const rawId = track?.id;
      if (typeof rawId === "number" && Number.isFinite(rawId)) {
        return rawId;
      }
      if (typeof rawId === "string") {
        const parsed = Number(rawId);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
      }
      return Number.NaN;
    };

    const disabledTrackByName = tracks.find((track) =>
      /disable|none|off/i.test((track?.name || "").trim())
    );
    const disabledTrackByNameId = toNumericTrackId(disabledTrackByName);
    if (Number.isFinite(disabledTrackByNameId)) {
      return disabledTrackByNameId;
    }

    const disabledTrackById = tracks.find(
      (track) => Number.isFinite(toNumericTrackId(track)) && toNumericTrackId(track) < 0
    );
    const disabledTrackByIdValue = toNumericTrackId(disabledTrackById);
    if (Number.isFinite(disabledTrackByIdValue)) {
      return disabledTrackByIdValue;
    }

    return -1;
  }, []);

  const clearVlcTextTrackRetryTimers = useCallback(() => {
    vlcTextTrackRetryTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    vlcTextTrackRetryTimeoutsRef.current = [];
  }, []);

  const clearVlcResumeCorrectionTimers = useCallback(() => {
    vlcResumeCorrectionTimeoutsRef.current.forEach((timeoutId) =>
      clearTimeout(timeoutId)
    );
    vlcResumeCorrectionTimeoutsRef.current = [];
  }, []);

  const applyVlcResumeCorrection = useCallback(
    (resumeFromSeconds: number) => {
      if (!usesVlcPlayer) {
        return;
      }
      if (normalizedDurationForDisplay <= 0) {
        return;
      }

      const resumeTargetSeconds = Math.max(
        0,
        Math.min(
          normalizedDurationForDisplay,
          resumeFromSeconds - VLC_RESUME_CORRECTION_BACKSTEP_SECONDS
        )
      );
      const resumeTargetRatio = Math.max(
        0,
        Math.min(1, resumeTargetSeconds / normalizedDurationForDisplay)
      );

      setCurrentTimeSeconds(resumeTargetSeconds);
      if (vlcPlayerRef.current?.seek) {
        vlcPlayerRef.current.seek(resumeTargetRatio);
      } else if (vlcPlayerRef.current?.setNativeProps) {
        vlcPlayerRef.current.setNativeProps({ seek: resumeTargetRatio });
      }
    },
    [normalizedDurationForDisplay, usesVlcPlayer]
  );

  const scheduleVlcResumeCorrection = useCallback(
    (resumeFromSeconds: number) => {
      clearVlcResumeCorrectionTimers();
      VLC_RESUME_CORRECTION_DELAYS_MS.forEach((delayMs) => {
        const timeoutId = setTimeout(() => {
          applyVlcResumeCorrection(resumeFromSeconds);
        }, delayMs);
        vlcResumeCorrectionTimeoutsRef.current.push(timeoutId);
      });
    },
    [applyVlcResumeCorrection, clearVlcResumeCorrectionTimers]
  );

  const applyVlcTextTrack = useCallback(
    (trackId: number) => {
      if (!usesVlcPlayer) {
        return;
      }

      const applyTrackSelection = () => {
        if (vlcPlayerRef.current?.setNativeProps) {
          vlcPlayerRef.current.setNativeProps({ textTrack: trackId });
        }
      };

      clearVlcTextTrackRetryTimers();
      applyTrackSelection();

      // VLC can reset selected subtitle track shortly after metadata load.
      [80, 260, 700].forEach((delayMs) => {
        const timeoutId = setTimeout(applyTrackSelection, delayMs);
        vlcTextTrackRetryTimeoutsRef.current.push(timeoutId);
      });
    },
    [clearVlcTextTrackRetryTimers, usesVlcPlayer]
  );

  const handleVlcLoad = useCallback(
    (event: VlcLoadEvent) => {
      const rawDuration = typeof event.duration === "number" ? event.duration : 0;
      const normalizedDuration = normalizeVlcDurationSeconds(rawDuration);
      if (Number.isFinite(normalizedDuration) && normalizedDuration > 0) {
        setVlcDurationSeconds(normalizedDuration);
        applyInitialSeekForVlcIfNeeded(normalizedDuration);
      }
      const disabledTrackId = resolveDisabledVlcTextTrackId(event.textTracks);
      setVlcTextTrackId(disabledTrackId);
      applyVlcTextTrack(disabledTrackId);
      setVlcPlaybackError(null);
    },
    [
      applyInitialSeekForVlcIfNeeded,
      applyVlcTextTrack,
      normalizeVlcDurationSeconds,
      resolveDisabledVlcTextTrackId,
    ]
  );

  const handleVlcProgress = useCallback(
    (event: VlcProgressEvent) => {
      const rawDuration = typeof event.duration === "number" ? event.duration : 0;
      const normalizedDurationFromEvent = normalizeVlcDurationSeconds(rawDuration);
      if (normalizedDurationFromEvent > 0) {
        setVlcDurationSeconds(normalizedDurationFromEvent);
      }

      const effectiveDurationSeconds =
        normalizedDurationFromEvent > 0
          ? normalizedDurationFromEvent
          : normalizedDurationForDisplay;
      applyInitialSeekForVlcIfNeeded(effectiveDurationSeconds);
      const progressPosition =
        typeof event.position === "number" && Number.isFinite(event.position)
          ? Math.max(0, Math.min(1, event.position))
          : null;

      let normalizedCurrentTime = Number.NaN;
      if (progressPosition !== null && effectiveDurationSeconds > 0) {
        normalizedCurrentTime = progressPosition * effectiveDurationSeconds;
      } else if (
        typeof event.currentTime === "number" &&
        Number.isFinite(event.currentTime)
      ) {
        normalizedCurrentTime = normalizeVlcCurrentSeconds(
          event.currentTime,
          effectiveDurationSeconds,
          currentTimeSeconds
        );
      }

      if (!Number.isFinite(normalizedCurrentTime)) {
        return;
      }

      if (!isVlcSeeking) {
        setCurrentTimeSeconds(Math.max(0, normalizedCurrentTime));
      }
    },
    [
      currentTimeSeconds,
      applyInitialSeekForVlcIfNeeded,
      isVlcSeeking,
      normalizeVlcCurrentSeconds,
      normalizeVlcDurationSeconds,
      normalizedDurationForDisplay,
    ]
  );

  const handleVlcError = useCallback(() => {
    setVlcPlaybackError("Could not load the selected MKV. Try another file.");
  }, []);

  useEffect(() => {
    setVlcPlaybackError(null);
    setExpoPlaybackError(null);
    setCurrentTimeSeconds(0);
    setVlcDurationSeconds(0);
    setExpoDurationSeconds(0);
    setVlcTextTrackId(-1);
    setIsVlcPaused(false);
    setIsExpoPaused(false);
    setIsVlcSeeking(false);
    setIsExpoSeeking(false);
    setVlcSeekPreviewRatio(0);
    setExpoSeekPreviewRatio(0);
    setIsSubtitleSearchVisible(false);
    setSubtitleSearchQuery("");
    setTranslationErrorMessage(null);
    setCaptionTranslationsByCueId({});
    setShouldResumePlaybackAfterTooltipClose(false);
    clearVlcResumeCorrectionTimers();
    clearVlcTextTrackRetryTimers();
  }, [
    clearVlcResumeCorrectionTimers,
    clearVlcTextTrackRetryTimers,
    videoUri,
    usesVlcPlayer,
  ]);

  useEffect(() => {
    if (usesVlcPlayer || !videoUri) {
      return;
    }

    player.play();
    setIsExpoPaused(false);
    applyInitialSeekForExpoIfNeeded();
  }, [applyInitialSeekForExpoIfNeeded, player, usesVlcPlayer, videoUri]);

  useEffect(() => {
    if (!usesVlcPlayer) {
      setVlcEmptySubtitleUri(null);
      return;
    }

    try {
      const emptySubtitleFile = new File(Paths.cache, EMPTY_VLC_SUBTITLE_FILE_NAME);
      if (!emptySubtitleFile.exists) {
        emptySubtitleFile.write("1\n00:00:00,000 --> 00:00:00,001\n \n");
      }
      setVlcEmptySubtitleUri(emptySubtitleFile.uri);
    } catch {
      setVlcEmptySubtitleUri(null);
    }
  }, [usesVlcPlayer]);

  useEffect(() => {
    if (!usesVlcPlayer) {
      return;
    }

    applyVlcTextTrack(vlcTextTrackId);
  }, [applyVlcTextTrack, usesVlcPlayer, vlcTextTrackId]);

  useEffect(() => {
    return () => {
      clearVlcResumeCorrectionTimers();
      clearVlcTextTrackRetryTimers();
    };
  }, [clearVlcResumeCorrectionTimers, clearVlcTextTrackRetryTimers]);

  const commitPlaybackSeek = useCallback(
    (ratio: number) => {
      const clampedRatio = Math.max(0, Math.min(1, ratio));
      const targetSeconds =
        normalizedDurationForDisplay > 0
          ? clampedRatio * normalizedDurationForDisplay
          : 0;
      setCurrentTimeSeconds(targetSeconds);

      if (usesVlcPlayer) {
        clearVlcResumeCorrectionTimers();
        setVlcSeekPreviewRatio(clampedRatio);
        setIsVlcSeeking(false);
        if (vlcPlayerRef.current?.seek) {
          vlcPlayerRef.current.seek(clampedRatio);
        }
        return;
      }

      setExpoSeekPreviewRatio(clampedRatio);
      setIsExpoSeeking(false);
      player.currentTime = targetSeconds;
    },
    [
      clearVlcResumeCorrectionTimers,
      normalizedDurationForDisplay,
      player,
      usesVlcPlayer,
    ]
  );

  const seekToTimeSeconds = useCallback(
    (targetSeconds: number) => {
      const normalizedTargetSeconds = Math.max(0, targetSeconds);
      const clampedTargetSeconds =
        normalizedDurationForDisplay > 0
          ? Math.min(normalizedDurationForDisplay, normalizedTargetSeconds)
          : normalizedTargetSeconds;

      setCurrentTimeSeconds(clampedTargetSeconds);
      setShouldResumePlaybackAfterTooltipClose(false);

      if (usesVlcPlayer) {
        clearVlcResumeCorrectionTimers();
        setIsVlcSeeking(false);
        const seekRatio =
          normalizedDurationForDisplay > 0
            ? Math.max(0, Math.min(1, clampedTargetSeconds / normalizedDurationForDisplay))
            : 0;
        setVlcSeekPreviewRatio(seekRatio);
        if (vlcPlayerRef.current?.seek) {
          vlcPlayerRef.current.seek(seekRatio);
        } else if (vlcPlayerRef.current?.setNativeProps) {
          vlcPlayerRef.current.setNativeProps({ seek: seekRatio });
        }
      } else {
        setIsExpoSeeking(false);
        const seekRatio =
          normalizedDurationForDisplay > 0
            ? Math.max(0, Math.min(1, clampedTargetSeconds / normalizedDurationForDisplay))
            : 0;
        setExpoSeekPreviewRatio(seekRatio);
        player.currentTime = clampedTargetSeconds;
      }

      if (historyEntryId) {
        lastPersistedPositionSecondsRef.current = clampedTargetSeconds;
        void updateAnimeTranscriptPlaybackProgress(historyEntryId, clampedTargetSeconds);
      }
    },
    [
      clearVlcResumeCorrectionTimers,
      historyEntryId,
      normalizedDurationForDisplay,
      player,
      usesVlcPlayer,
    ]
  );

  const handlePauseAndTranslateCurrentCue = useCallback(async () => {
    if (!primaryActiveCue || isTranslatingCurrentCue) {
      return;
    }

    setShouldResumePlaybackAfterTooltipClose(false);
    if (usesVlcPlayer) {
      clearVlcResumeCorrectionTimers();
      setIsVlcPaused(true);
      if (vlcPlayerRef.current?.setNativeProps) {
        vlcPlayerRef.current.setNativeProps({ paused: true });
      }
    } else {
      player.pause();
      setIsExpoPaused(true);
    }

    const existingTranslation = captionTranslationsByCueId[primaryActiveCue.id];
    if (existingTranslation) {
      setTranslationErrorMessage(null);
      return;
    }

    setIsTranslatingCurrentCue(true);
    setTranslationErrorMessage(null);

    try {
      const cueIndex = subtitleCues.findIndex((cue) => cue.id === primaryActiveCue.id);
      const previousCue = cueIndex > 0 ? subtitleCues[cueIndex - 1] : null;
      const previousCueTranslation =
        previousCue && captionTranslationsByCueId[previousCue.id]
          ? captionTranslationsByCueId[previousCue.id].text
          : null;
      const context: [string, string] | null =
        previousCue && previousCueTranslation
          ? [
              normalizeSubtitleCueTextForRendering(previousCue.text),
              previousCueTranslation,
            ]
          : null;
      const translation = await translateJapaneseToEnglish(
        normalizeSubtitleCueTextForRendering(primaryActiveCue.text),
        { context }
      );

      setCaptionTranslationsByCueId((previous) => ({
        ...previous,
        [primaryActiveCue.id]: {
          text: translation.text.trim(),
          isTruncated: translation.isTruncated,
        },
      }));
    } catch (error) {
      if (error instanceof JpdbApiError) {
        if (error.code === "bad_key") {
          setTranslationErrorMessage("JPDB API key is missing or invalid in Settings.");
        } else if (error.code === "too_many_requests") {
          setTranslationErrorMessage("JPDB rate limit reached. Try again in a moment.");
        } else if (error.code === "api_unavailable") {
          setTranslationErrorMessage("JPDB translation is temporarily unavailable.");
        } else if (error.code === "text_too_long") {
          setTranslationErrorMessage("This subtitle line is too long for JPDB translation.");
        } else {
          setTranslationErrorMessage("Could not translate this subtitle line right now.");
        }
      } else {
        setTranslationErrorMessage("Could not translate this subtitle line right now.");
      }
    } finally {
      setIsTranslatingCurrentCue(false);
    }
  }, [
    captionTranslationsByCueId,
    clearVlcResumeCorrectionTimers,
    isTranslatingCurrentCue,
    player,
    primaryActiveCue,
    subtitleCues,
    usesVlcPlayer,
  ]);

  const persistPlaybackProgress = useCallback(
    (positionSeconds: number) => {
      if (!historyEntryId) {
        return;
      }

      const normalizedPositionSeconds = Math.max(0, positionSeconds);
      if (!Number.isFinite(normalizedPositionSeconds)) {
        return;
      }

      const positionDelta = Math.abs(
        normalizedPositionSeconds - lastPersistedPositionSecondsRef.current
      );
      if (positionDelta < MIN_PLAYBACK_PROGRESS_PERSIST_DELTA_SECONDS) {
        return;
      }

      lastPersistedPositionSecondsRef.current = normalizedPositionSeconds;
      void updateAnimeTranscriptPlaybackProgress(
        historyEntryId,
        normalizedPositionSeconds
      );
    },
    [historyEntryId]
  );

  useEffect(() => {
    if (!historyEntryId) {
      return;
    }

    if (!Number.isFinite(normalizedDurationForDisplay) || normalizedDurationForDisplay <= 0) {
      return;
    }

    const nextDurationSeconds = Math.max(0, normalizedDurationForDisplay);
    const durationDelta = Math.abs(
      nextDurationSeconds - lastPersistedDurationSecondsRef.current
    );
    if (durationDelta < 1) {
      return;
    }

    lastPersistedDurationSecondsRef.current = nextDurationSeconds;
    void updateAnimeTranscriptPlaybackDuration(historyEntryId, nextDurationSeconds);
  }, [historyEntryId, normalizedDurationForDisplay]);

  useEffect(() => {
    if (!historyEntryId) {
      return;
    }

    const intervalId = setInterval(() => {
      if (isSeekingRef.current || isPlaybackPausedRef.current) {
        return;
      }

      persistPlaybackProgress(currentTimeSecondsRef.current);
    }, PLAYBACK_PROGRESS_PERSIST_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [historyEntryId, persistPlaybackProgress]);

  useEffect(() => {
    return () => {
      if (!historyEntryId) {
        return;
      }
      void updateAnimeTranscriptPlaybackProgress(historyEntryId, currentTimeSecondsRef.current);
    };
  }, [historyEntryId]);

  const togglePlayback = useCallback(() => {
    setShouldResumePlaybackAfterTooltipClose(false);

    if (usesVlcPlayer) {
      if (isVlcPaused) {
        const resumeFromSeconds = Math.max(
          0,
          Math.min(normalizedDurationForDisplay, currentTimeSeconds)
        );
        setIsVlcPaused(false);
        if (vlcPlayerRef.current?.setNativeProps) {
          vlcPlayerRef.current.setNativeProps({ paused: false, rate: 1 });
        }
        scheduleVlcResumeCorrection(resumeFromSeconds);
        return;
      }

      clearVlcResumeCorrectionTimers();
      setIsVlcPaused(true);
      if (vlcPlayerRef.current?.setNativeProps) {
        vlcPlayerRef.current.setNativeProps({ paused: true });
      }
      return;
    }

    if (isExpoPaused) {
      player.play();
      setIsExpoPaused(false);
      return;
    }

    player.pause();
    setIsExpoPaused(true);
  }, [
    clearVlcResumeCorrectionTimers,
    currentTimeSeconds,
    isExpoPaused,
    isVlcPaused,
    normalizedDurationForDisplay,
    player,
    scheduleVlcResumeCorrection,
    usesVlcPlayer,
  ]);

  const pausePlaybackForTooltipIfEnabled = useCallback(() => {
    if (!viewerSettings.pausePlaybackOnTooltipOpen) {
      return;
    }
    if (shouldResumePlaybackAfterTooltipClose) {
      return;
    }

    if (usesVlcPlayer) {
      if (isVlcPaused) {
        return;
      }
      clearVlcResumeCorrectionTimers();
      setIsVlcPaused(true);
      setShouldResumePlaybackAfterTooltipClose(true);
      return;
    }

    if (isExpoPaused) {
      return;
    }

    player.pause();
    setIsExpoPaused(true);
    setShouldResumePlaybackAfterTooltipClose(true);
  }, [
    isExpoPaused,
    isVlcPaused,
    clearVlcResumeCorrectionTimers,
    player,
    shouldResumePlaybackAfterTooltipClose,
    usesVlcPlayer,
    viewerSettings.pausePlaybackOnTooltipOpen,
  ]);

  const resumePlaybackAfterTooltipIfNeeded = useCallback(() => {
    if (!shouldResumePlaybackAfterTooltipClose) {
      return;
    }

    setShouldResumePlaybackAfterTooltipClose(false);
    if (usesVlcPlayer) {
      const resumeFromSeconds = Math.max(
        0,
        Math.min(normalizedDurationForDisplay, currentTimeSeconds)
      );
      setIsVlcPaused(false);
      scheduleVlcResumeCorrection(resumeFromSeconds);
      return;
    }

    player.play();
    setIsExpoPaused(false);
  }, [
    currentTimeSeconds,
    normalizedDurationForDisplay,
    player,
    scheduleVlcResumeCorrection,
    shouldResumePlaybackAfterTooltipClose,
    usesVlcPlayer,
  ]);

  const closeCustomFullscreenFromControls = useCallback(() => {
    if (fullscreenExitHideTimeoutRef.current) {
      clearTimeout(fullscreenExitHideTimeoutRef.current);
      fullscreenExitHideTimeoutRef.current = null;
    }
    tooltipOpacity.value = 0;
    setSelectedItem(null);
    setSelectedSurfaceText(null);
    setSelectedTokenKey(null);
    setTooltipInteractionMode(null);
    setTooltipPosition(null);
    setTooltipAnchorRect(null);
    setShowFullscreenExitControl(true);
    setShowInlineFullscreenControl(true);
    setShouldResumePlaybackAfterTooltipClose(false);
    clearVlcResumeCorrectionTimers();
    setIsCustomFullscreen(false);
  }, [clearVlcResumeCorrectionTimers, tooltipOpacity]);

  const skipPlaybackBySeconds = useCallback(
    (deltaSeconds: number) => {
      if (normalizedDurationForDisplay <= 0) {
        return;
      }
      setShouldResumePlaybackAfterTooltipClose(false);

      const baseTime = isSeeking ? visibleCurrentTimeSeconds : currentTimeSeconds;
      const nextTime = Math.max(
        0,
        Math.min(normalizedDurationForDisplay, baseTime + deltaSeconds)
      );
      const nextRatio =
        normalizedDurationForDisplay > 0 ? nextTime / normalizedDurationForDisplay : 0;
      setCurrentTimeSeconds(nextTime);

      if (usesVlcPlayer) {
        clearVlcResumeCorrectionTimers();
        setIsVlcSeeking(false);
        setVlcSeekPreviewRatio(nextRatio);
        if (vlcPlayerRef.current?.seek) {
          vlcPlayerRef.current.seek(nextRatio);
        }
        return;
      }

      setIsExpoSeeking(false);
      setExpoSeekPreviewRatio(nextRatio);
      player.currentTime = nextTime;
    },
    [
      currentTimeSeconds,
      clearVlcResumeCorrectionTimers,
      isSeeking,
      normalizedDurationForDisplay,
      player,
      usesVlcPlayer,
      visibleCurrentTimeSeconds,
    ]
  );

  const renderPlaybackControls = useCallback(
    (isFullscreenSurface: boolean) => {
      if (isFullscreenSurface) {
        const isUsingRotatedFakeLandscapeFullscreen =
          (usesVlcPlayer && shouldUseVlcFakeLandscapeFullscreen) ||
          (!usesVlcPlayer && shouldUseFakeLandscapeFullscreen);
        const fullscreenCornerTopInset = isUsingRotatedFakeLandscapeFullscreen
          ? Math.max(Math.max(insets.left, insets.right) + 8, 14)
          : Math.max(insets.top + 8, 14);
        const fullscreenCornerSideInset = isUsingRotatedFakeLandscapeFullscreen
          ? Math.max(Math.max(insets.top, insets.bottom) + 12, 14)
          : Math.max(insets.left + 12, 14);
        const fullscreenCornerTrailingInset = isUsingRotatedFakeLandscapeFullscreen
          ? Math.max(Math.max(insets.top, insets.bottom) + 12, 14)
          : Math.max(insets.right + 12, 14);

        return (
          <View style={styles.fullscreenVlcControls} pointerEvents="box-none">
            <LinearGradient
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.86)"]}
              style={styles.fullscreenVlcBottomGradient}
              pointerEvents="none"
            />

            <TouchableOpacity
              style={[
                styles.fullscreenVlcExitButton,
                {
                  top: fullscreenCornerTopInset,
                  right: fullscreenCornerTrailingInset,
                },
              ]}
              onPress={closeCustomFullscreenFromControls}
              activeOpacity={0.85}
            >
              <Ionicons name="contract" size={22} color="#ffffff" />
            </TouchableOpacity>
            {viewerSettings.showPauseAndTranslateCurrentCaptionButton ? (
              <TouchableOpacity
                style={[
                  styles.fullscreenVlcTranslateButton,
                  {
                    top: fullscreenCornerTopInset,
                    left: fullscreenCornerSideInset,
                  },
                ]}
                onPress={() => {
                  void handlePauseAndTranslateCurrentCue();
                }}
                activeOpacity={0.85}
                disabled={!primaryActiveCue || isTranslatingCurrentCue}
              >
                {isTranslatingCurrentCue ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Ionicons name="language-outline" size={19} color="#ffffff" />
                )}
              </TouchableOpacity>
            ) : null}

            <View style={styles.fullscreenVlcCenterControls} pointerEvents="box-none">
              <TouchableOpacity
                onPress={() => skipPlaybackBySeconds(-PLAYBACK_FULLSCREEN_SKIP_SECONDS)}
                style={styles.fullscreenVlcSkipButton}
                activeOpacity={0.82}
              >
                <MaterialIcons
                  name="replay-10"
                  size={36}
                  color="#ffffff"
                  style={styles.playbackIconOutline}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={togglePlayback}
                style={styles.fullscreenVlcCenterPlayPauseButton}
                activeOpacity={0.82}
              >
                <Ionicons
                  name={isPlaybackPaused ? "play" : "pause"}
                  size={58}
                  color="#ffffff"
                  style={styles.playbackIconOutline}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => skipPlaybackBySeconds(PLAYBACK_FULLSCREEN_SKIP_SECONDS)}
                style={styles.fullscreenVlcSkipButton}
                activeOpacity={0.82}
              >
                <MaterialIcons
                  name="forward-10"
                  size={36}
                  color="#ffffff"
                  style={styles.playbackIconOutline}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.fullscreenVlcBottomControls}>
              <Slider
                style={styles.fullscreenVlcSlider}
                value={visibleSeekRatio}
                minimumValue={0}
                maximumValue={1}
                step={0}
                minimumTrackTintColor="#f97316"
                maximumTrackTintColor="rgba(255,255,255,0.28)"
                thumbTintColor="#f97316"
                onSlidingStart={() => {
                  if (usesVlcPlayer) {
                    setIsVlcSeeking(true);
                    setVlcSeekPreviewRatio(currentProgressRatio);
                  } else {
                    setIsExpoSeeking(true);
                    setExpoSeekPreviewRatio(currentProgressRatio);
                  }
                }}
                onValueChange={(value) => {
                  if (usesVlcPlayer) {
                    setVlcSeekPreviewRatio(value);
                  } else {
                    setExpoSeekPreviewRatio(value);
                  }
                }}
                onSlidingComplete={commitPlaybackSeek}
              />
              <Text style={styles.fullscreenVlcTimeText}>
                {formatTimestamp(visibleCurrentTimeSeconds)} /{" "}
                {formatTimestamp(normalizedDurationForDisplay)}
              </Text>
            </View>
          </View>
        );
      }

      const inlinePlayPauseColor = theme.isDark ? "#ffffff" : theme.textColor;

      return (
        <View
          style={[
            styles.vlcInlineControls,
            {
              borderColor: theme.border,
              backgroundColor: theme.cardBackground,
            },
          ]}
        >
          <View style={styles.vlcControlTopRow}>
            <TouchableOpacity
              onPress={togglePlayback}
              style={styles.vlcPlayPauseButton}
              activeOpacity={0.82}
            >
              <Ionicons
                name={isPlaybackPaused ? "play" : "pause"}
                size={16}
                color={inlinePlayPauseColor}
                style={theme.isDark ? styles.playbackIconOutlineInline : undefined}
              />
              <Text style={[styles.vlcPlayPauseButtonText, { color: inlinePlayPauseColor }]}>
                {isPlaybackPaused ? "Play" : "Pause"}
              </Text>
            </TouchableOpacity>
            <Text
              style={[
                styles.vlcTimeText,
                { color: theme.textColor },
              ]}
            >
              {formatTimestamp(visibleCurrentTimeSeconds)} /{" "}
              {formatTimestamp(normalizedDurationForDisplay)}
            </Text>
          </View>
          <Slider
            value={visibleSeekRatio}
            minimumValue={0}
            maximumValue={1}
            step={0}
            minimumTrackTintColor="#f97316"
            maximumTrackTintColor="#9ca3af"
            thumbTintColor="#f97316"
            onSlidingStart={() => {
              if (usesVlcPlayer) {
                setIsVlcSeeking(true);
                setVlcSeekPreviewRatio(currentProgressRatio);
              } else {
                setIsExpoSeeking(true);
                setExpoSeekPreviewRatio(currentProgressRatio);
              }
            }}
            onValueChange={(value) => {
              if (usesVlcPlayer) {
                setVlcSeekPreviewRatio(value);
              } else {
                setExpoSeekPreviewRatio(value);
              }
            }}
            onSlidingComplete={commitPlaybackSeek}
          />
        </View>
      );
    },
    [
      commitPlaybackSeek,
      currentProgressRatio,
      isPlaybackPaused,
      normalizedDurationForDisplay,
      theme.border,
      theme.cardBackground,
      theme.isDark,
      theme.textColor,
      togglePlayback,
      usesVlcPlayer,
      visibleCurrentTimeSeconds,
      visibleSeekRatio,
      closeCustomFullscreenFromControls,
      handlePauseAndTranslateCurrentCue,
      insets.bottom,
      insets.left,
      insets.right,
      insets.top,
      isTranslatingCurrentCue,
      primaryActiveCue,
      shouldUseFakeLandscapeFullscreen,
      shouldUseVlcFakeLandscapeFullscreen,
      skipPlaybackBySeconds,
      viewerSettings.showPauseAndTranslateCurrentCaptionButton,
    ]
  );

  const renderVideoSurface = useCallback(
    (style: any) => {
      if (usesVlcPlayer) {
        if (!VLCPlayerComponent || !videoUri) {
          return (
            <View style={[style, styles.vlcUnavailableSurface]}>
              <Text style={styles.vlcUnavailableText}>
                VLC playback is unavailable on this platform build.
              </Text>
            </View>
          );
        }

        const VlcPlayer = VLCPlayerComponent as any;
        return (
          <VlcPlayer
            ref={vlcPlayerRef}
            style={style}
            source={{ uri: videoUri, initType: 1 }}
            autoplay
            paused={isVlcPaused}
            repeat={false}
            resizeMode={isVlcFullscreen ? "cover" : "contain"}
            subtitleUri={vlcEmptySubtitleUri || undefined}
            textTrack={vlcTextTrackId}
            onLoad={handleVlcLoad}
            onProgress={handleVlcProgress}
            onError={handleVlcError}
          />
        );
      }

      return (
        <VideoView
          player={player}
          style={style}
          nativeControls={false}
          contentFit={isCustomFullscreen ? "cover" : "contain"}
          fullscreenOptions={{ enable: false }}
        />
      );
    },
    [
      handleVlcError,
      handleVlcLoad,
      handleVlcProgress,
      isVlcPaused,
      player,
      usesVlcPlayer,
      vlcEmptySubtitleUri,
      vlcTextTrackId,
      videoUri,
      isCustomFullscreen,
      isVlcFullscreen,
    ]
  );

  const getTooltipPositionFromAnchor = useCallback(
    (
      anchor: { x: number; y: number; width: number; height: number },
      measuredHeight: number,
      extraGap = 0
    ) => {
      const screenWidth = Dimensions.get("window").width;
      const screenHeight = Dimensions.get("window").height;
      const tooltipWidth = 280;
      const safeTop = isCustomFullscreen ? 8 : Math.max(insets.top + 8, 12);
      const safeBottom = 10;
      const normalizedExtraGap = Math.max(0, extraGap);
      const verticalGap = 8 + normalizedExtraGap;

      const clamp = (value: number, min: number, max: number) =>
        Math.max(min, Math.min(value, max));

      const isFakeRotatedFullscreen =
        isCustomFullscreen && supportsFakeLandscapeFullscreen;

      // In fake-rotated fullscreen, "above subtitles" maps to left/right depending
      // on the current rotation.
      if (isFakeRotatedFullscreen) {
        const visualWidth = measuredHeight;
        const visualHeight = tooltipWidth;
        const sideGap = 10 + normalizedExtraGap;
        const placeLeft = fullscreenRotationDegrees === 90;

        const minCenterX = 12 + visualWidth / 2;
        const maxCenterX = screenWidth - 12 - visualWidth / 2;
        const minCenterY = safeTop + visualHeight / 2;
        const maxCenterY = screenHeight - safeBottom - visualHeight / 2;

        const preferredCenterX = placeLeft
          ? anchor.x - sideGap - visualWidth / 2
          : anchor.x + anchor.width + sideGap + visualWidth / 2;
        const fallbackCenterX = placeLeft
          ? anchor.x + anchor.width + sideGap + visualWidth / 2
          : anchor.x - sideGap - visualWidth / 2;

        const preferredFits =
          preferredCenterX >= minCenterX && preferredCenterX <= maxCenterX;
        const chosenCenterX = preferredFits ? preferredCenterX : fallbackCenterX;
        const centerX = clamp(chosenCenterX, minCenterX, maxCenterX);
        const centerY = clamp(
          anchor.y + anchor.height / 2,
          minCenterY,
          maxCenterY
        );

        const left = centerX - tooltipWidth / 2;
        const top = centerY - measuredHeight / 2;
        return { x: left, y: top, width: anchor.width };
      }

      let left = anchor.x + anchor.width / 2 - tooltipWidth / 2;
      left = clamp(left, 10, screenWidth - tooltipWidth - 10);

      const maxTop = Math.max(safeTop, screenHeight - measuredHeight - safeBottom);
      const preferredTop = anchor.y - measuredHeight - verticalGap;
      const preferredBottom = anchor.y + anchor.height + verticalGap;
      const preferBelow = !isCustomFullscreen;

      let top = preferBelow ? preferredBottom : preferredTop;
      if (preferBelow && top > maxTop) {
        top = preferredTop;
      }
      if (!preferBelow && top < safeTop) {
        top = preferredBottom;
      }
      top = clamp(top, safeTop, maxTop);

      return { x: left, y: top, width: anchor.width };
    },
    [
      fullscreenRotationDegrees,
      insets.top,
      isCustomFullscreen,
      supportsFakeLandscapeFullscreen,
    ]
  );

  const clearInlineControlHideTimer = useCallback(() => {
    if (inlineControlHideTimeoutRef.current) {
      clearTimeout(inlineControlHideTimeoutRef.current);
      inlineControlHideTimeoutRef.current = null;
    }
  }, []);

  const clearFullscreenExitHideTimer = useCallback(() => {
    if (fullscreenExitHideTimeoutRef.current) {
      clearTimeout(fullscreenExitHideTimeoutRef.current);
      fullscreenExitHideTimeoutRef.current = null;
    }
  }, []);

  const scheduleInlineControlAutoHide = useCallback(() => {
    if (isCustomFullscreen) {
      return;
    }

    clearInlineControlHideTimer();
    inlineControlHideTimeoutRef.current = setTimeout(() => {
      setShowInlineFullscreenControl(false);
    }, INLINE_CONTROL_AUTO_HIDE_MS);
  }, [clearInlineControlHideTimer, isCustomFullscreen]);

  const revealInlineControl = useCallback(() => {
    if (isCustomFullscreen) {
      return;
    }

    setShowInlineFullscreenControl(true);
    scheduleInlineControlAutoHide();
  }, [isCustomFullscreen, scheduleInlineControlAutoHide]);

  const scheduleFullscreenExitAutoHide = useCallback(() => {
    if (!isCustomFullscreen) {
      return;
    }

    clearFullscreenExitHideTimer();
    fullscreenExitHideTimeoutRef.current = setTimeout(() => {
      setShowFullscreenExitControl(false);
    }, FULLSCREEN_EXIT_AUTO_HIDE_MS);
  }, [clearFullscreenExitHideTimer, isCustomFullscreen]);

  const toggleFullscreenExitControl = useCallback(() => {
    if (!isCustomFullscreen) {
      return;
    }

    setShowFullscreenExitControl((previous) => {
      const next = !previous;
      if (next) {
        scheduleFullscreenExitAutoHide();
      } else {
        clearFullscreenExitHideTimer();
      }
      return next;
    });
  }, [clearFullscreenExitHideTimer, isCustomFullscreen, scheduleFullscreenExitAutoHide]);

  useEffect(() => {
    if (isCustomFullscreen) {
      clearInlineControlHideTimer();
      setShowInlineFullscreenControl(false);
      return;
    }

    revealInlineControl();
  }, [clearInlineControlHideTimer, isCustomFullscreen, revealInlineControl]);

  useEffect(() => {
    if (isCustomFullscreen) {
      setShowFullscreenExitControl(true);
      scheduleFullscreenExitAutoHide();
      return;
    }

    clearFullscreenExitHideTimer();
    setShowFullscreenExitControl(true);
  }, [
    clearFullscreenExitHideTimer,
    isCustomFullscreen,
    scheduleFullscreenExitAutoHide,
  ]);

  useEffect(() => {
    const shouldLiftSubtitles = isCustomFullscreen && showFullscreenExitControl;
    Animated.timing(subtitleAvoidanceTranslateY, {
      toValue: shouldLiftSubtitles ? -VLC_FULLSCREEN_SUBTITLE_LIFT : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isCustomFullscreen, showFullscreenExitControl, subtitleAvoidanceTranslateY]);

  useEffect(() => {
    return () => {
      clearInlineControlHideTimer();
      clearFullscreenExitHideTimer();
    };
  }, [clearFullscreenExitHideTimer, clearInlineControlHideTimer]);

  const resetSubtitleDrag = useCallback(() => {
    subtitleDragOffset.current = { x: 0, y: 0 };
    subtitleDragPosition.setValue({ x: 0, y: 0 });
  }, [subtitleDragPosition]);

  const clampDrag = useCallback((value: number, min: number, max: number) => {
    return Math.max(min, Math.min(value, max));
  }, []);

  const mapScreenGestureToSubtitleDelta = useCallback(
    (dx: number, dy: number) => {
      if (!(isCustomFullscreen && supportsFakeLandscapeFullscreen)) {
        return { dx, dy };
      }

      if (fullscreenRotationDegrees === 90) {
        return {
          dx: dy,
          dy: -dx,
        };
      }

      return {
        dx: -dy,
        dy: dx,
      };
    },
    [
      fullscreenRotationDegrees,
      isCustomFullscreen,
      supportsFakeLandscapeFullscreen,
    ]
  );

  const subtitleDragPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 4 || Math.abs(gestureState.dy) > 4,
        onPanResponderMove: (_, gestureState) => {
          const { width, height } = Dimensions.get("window");
          const maxX = width * 0.38;
          const maxY = height * 0.34;
          const mappedDelta = mapScreenGestureToSubtitleDelta(
            gestureState.dx,
            gestureState.dy
          );
          const nextX = clampDrag(
            subtitleDragOffset.current.x + mappedDelta.dx,
            -maxX,
            maxX
          );
          const nextY = clampDrag(
            subtitleDragOffset.current.y + mappedDelta.dy,
            -maxY,
            maxY
          );
          subtitleDragPosition.setValue({ x: nextX, y: nextY });
        },
        onPanResponderRelease: (_, gestureState) => {
          const { width, height } = Dimensions.get("window");
          const maxX = width * 0.38;
          const maxY = height * 0.34;
          const mappedDelta = mapScreenGestureToSubtitleDelta(
            gestureState.dx,
            gestureState.dy
          );
          const nextX = clampDrag(
            subtitleDragOffset.current.x + mappedDelta.dx,
            -maxX,
            maxX
          );
          const nextY = clampDrag(
            subtitleDragOffset.current.y + mappedDelta.dy,
            -maxY,
            maxY
          );
          subtitleDragOffset.current = { x: nextX, y: nextY };
          subtitleDragPosition.setValue({ x: nextX, y: nextY });
        },
      }),
    [clampDrag, mapScreenGestureToSubtitleDelta, subtitleDragPosition]
  );

  const handleVocabularyPress = useCallback(
    (
      itemId: number,
      surfaceText: string,
      event: any,
      itemOverride?: VocabularyMatch | KanjiMatch,
      tokenKey?: string,
      interactionMode: "press" | "hover" = "press"
    ) => {
      const item =
        itemOverride ??
        [...vocabularyMatches, ...kanjiMatches].find((match) => match.id === itemId);
      if (!item) {
        return;
      }
      const tooltipExtraGap = isWaniKaniBackedMatch(item) ? 6 : 0;

      const openTooltipAtAnchor = (
        x: number,
        y: number,
        width: number,
        height: number,
        source: "measure" | "page" = "measure"
      ) => {
        const statusBarOffset =
          source === "measure" && Platform.OS === "android"
            ? (NativeStatusBar.currentHeight || 0)
            : 0;
        const adjustedY = y + statusBarOffset;
        const anchor = { x, y: adjustedY, width, height };
        const nextPosition = getTooltipPositionFromAnchor(
          anchor,
          tooltipHeight,
          tooltipExtraGap
        );
        setTooltipAnchorRect(anchor);
        setTooltipPosition(nextPosition);
        setSelectedItem(item);
        setSelectedSurfaceText(surfaceText);
        setSelectedTokenKey(tokenKey ?? null);
        setTooltipInteractionMode(interactionMode);
        tooltipOpacity.value = withTiming(1, {
          duration: interactionMode === "hover" ? 120 : 200,
        });
        pausePlaybackForTooltipIfEnabled();
      };

      const measureFromTarget = (x: number, y: number, width: number, height: number) => {
        if (
          Number.isFinite(x) &&
          Number.isFinite(y) &&
          Number.isFinite(width) &&
          Number.isFinite(height) &&
          width > 0 &&
          height > 0
        ) {
          openTooltipAtAnchor(x, y, width, height, "measure");
          return true;
        }
        return false;
      };

      const measurementTag =
        typeof event?.currentTarget === "number"
          ? event.currentTarget
          : typeof event?.target === "number"
            ? event.target
            : null;

      if (measurementTag !== null && typeof UIManager.measureInWindow === "function") {
        UIManager.measureInWindow(
          measurementTag,
          (x: number, y: number, width: number, height: number) => {
            if (measureFromTarget(x, y, width, height)) {
              return;
            }

            const pageX = Number(event?.nativeEvent?.pageX);
            const pageY = Number(event?.nativeEvent?.pageY);
            if (
              Number.isFinite(pageX) &&
              Number.isFinite(pageY) &&
              pageX > 1 &&
              pageY > 1
            ) {
              openTooltipAtAnchor(pageX - 12, pageY - 12, 24, 24, "page");
            }
          }
        );
        return;
      }

      const pageX = Number(event?.nativeEvent?.pageX);
      const pageY = Number(event?.nativeEvent?.pageY);
      if (
        Number.isFinite(pageX) &&
        Number.isFinite(pageY) &&
        pageX > 1 &&
        pageY > 1
      ) {
        openTooltipAtAnchor(pageX - 12, pageY - 12, 24, 24, "page");
      }
    },
    [
      getTooltipPositionFromAnchor,
      kanjiMatches,
      pausePlaybackForTooltipIfEnabled,
      tooltipHeight,
      tooltipOpacity,
      vocabularyMatches,
    ]
  );

  const closeTooltipState = useCallback(() => {
    tooltipOpacity.value = 0;
    setSelectedItem(null);
    setSelectedSurfaceText(null);
    setSelectedTokenKey(null);
    setTooltipInteractionMode(null);
    setTooltipPosition(null);
    setTooltipAnchorRect(null);
  }, [tooltipOpacity]);

  const handleCloseTooltip = useCallback(() => {
    closeTooltipState();
    resumePlaybackAfterTooltipIfNeeded();
  }, [closeTooltipState, resumePlaybackAfterTooltipIfNeeded]);

  const handleCloseTooltipFromBackdrop = useCallback(() => {
    suppressFullscreenBackgroundTapUntilRef.current = Date.now() + 220;
    handleCloseTooltip();
  }, [handleCloseTooltip]);

  const handleVlcFullscreenBackgroundPress = useCallback(() => {
    if (Date.now() < suppressFullscreenBackgroundTapUntilRef.current) {
      return;
    }
    if (selectedItem) {
      handleCloseTooltipFromBackdrop();
      return;
    }
    handleCloseTooltip();
    toggleFullscreenExitControl();
  }, [
    handleCloseTooltip,
    handleCloseTooltipFromBackdrop,
    selectedItem,
    toggleFullscreenExitControl,
  ]);

  const handleModalFullscreenBackgroundTouch = useCallback(() => {
    if (Date.now() < suppressFullscreenBackgroundTapUntilRef.current) {
      return;
    }
    if (selectedItem) {
      handleCloseTooltipFromBackdrop();
      return;
    }
    handleCloseTooltip();
    toggleFullscreenExitControl();
  }, [
    handleCloseTooltip,
    handleCloseTooltipFromBackdrop,
    selectedItem,
    toggleFullscreenExitControl,
  ]);

  const openCustomFullscreenWithRotation = useCallback(
    (rotation: 90 | -90) => {
      resetSubtitleDrag();
      setFullscreenRotationDegrees(rotation);
      setShowInlineFullscreenControl(false);
      setShowFullscreenExitControl(true);
      setIsCustomFullscreen(true);
    },
    [resetSubtitleDrag]
  );

  const handleOpenCustomFullscreen = useCallback(() => {
    handleCloseTooltip();
    clearInlineControlHideTimer();
    clearFullscreenExitHideTimer();
    openCustomFullscreenWithRotation(90);
  }, [
    clearFullscreenExitHideTimer,
    clearInlineControlHideTimer,
    handleCloseTooltip,
    openCustomFullscreenWithRotation,
  ]);

  const handleCloseCustomFullscreen = useCallback(() => {
    closeCustomFullscreenFromControls();
  }, [closeCustomFullscreenFromControls]);

  const handleOpenViewerSettings = useCallback(() => {
    handleCloseTooltip();
    router.push("/anime-transcript-dev-settings");
  }, [handleCloseTooltip, router]);

  useEffect(() => {
    if (
      Platform.OS === "web" ||
      (Platform.OS as string) === "macos" ||
      !viewerSettings.autoRotateFullscreenWithDeviceMotion
    ) {
      deviceTiltStateRef.current = "portrait";
      lastDeviceTiltChangeMsRef.current = 0;
      return;
    }

    let removed = false;
    let deviceMotionSubscription:
      | {
          remove: () => void;
        }
      | null = null;

    const transitionToTiltState = (
      nextState: "portrait" | "landscapeLeft" | "landscapeRight"
    ) => {
      const now = Date.now();
      if (nextState === deviceTiltStateRef.current) {
        return;
      }
      if (now - lastDeviceTiltChangeMsRef.current < DEVICE_TILT_TRANSITION_DEBOUNCE_MS) {
        return;
      }

      deviceTiltStateRef.current = nextState;
      lastDeviceTiltChangeMsRef.current = now;

      if (nextState === "portrait") {
        if (isCustomFullscreenRef.current) {
          closeCustomFullscreenFromControls();
        }
        return;
      }

      const desiredRotation: 90 | -90 =
        nextState === "landscapeLeft" ? 90 : -90;

      setFullscreenRotationDegrees((current) =>
        current === desiredRotation ? current : desiredRotation
      );
      if (!isCustomFullscreenRef.current) {
        handleCloseTooltip();
        clearInlineControlHideTimer();
        openCustomFullscreenWithRotation(desiredRotation);
      }
    };

    DeviceMotion.setUpdateInterval(180);
    DeviceMotion.isAvailableAsync()
      .then((isAvailable) => {
        if (!isAvailable || removed) {
          return;
        }

        deviceMotionSubscription = DeviceMotion.addListener((measurement) => {
          const xRaw = Number(measurement?.accelerationIncludingGravity?.x);
          const yRaw = Number(measurement?.accelerationIncludingGravity?.y);
          if (!Number.isFinite(xRaw) || !Number.isFinite(yRaw)) {
            return;
          }

          const magnitude = Math.sqrt(xRaw * xRaw + yRaw * yRaw);
          if (!Number.isFinite(magnitude) || magnitude < 0.3) {
            return;
          }

          const normalizedX = xRaw / magnitude;
          const normalizedY = yRaw / magnitude;
          const absX = Math.abs(normalizedX);
          const absY = Math.abs(normalizedY);

          if (
            absX >= DEVICE_TILT_LANDSCAPE_ENTER_THRESHOLD &&
            absX > absY + 0.12
          ) {
            transitionToTiltState(
              normalizedX > 0 ? "landscapeRight" : "landscapeLeft"
            );
            return;
          }

          if (
            absX <= DEVICE_TILT_PORTRAIT_RETURN_THRESHOLD &&
            absY >= 0.72
          ) {
            transitionToTiltState("portrait");
          }
        });
      })
      .catch(() => {
        // Ignore: sensor support varies by platform/device.
      });

    return () => {
      removed = true;
      if (deviceMotionSubscription) {
        deviceMotionSubscription.remove();
      }
    };
  }, [
    clearInlineControlHideTimer,
    closeCustomFullscreenFromControls,
    handleCloseTooltip,
    openCustomFullscreenWithRotation,
    viewerSettings.autoRotateFullscreenWithDeviceMotion,
  ]);

  const handleHoverTokenLeave = useCallback(
    (tokenKey: string) => {
      if (tooltipInteractionMode !== "hover") {
        return;
      }
      if (selectedTokenKey !== tokenKey) {
        return;
      }
      handleCloseTooltip();
    },
    [handleCloseTooltip, selectedTokenKey, tooltipInteractionMode]
  );

  const handleViewDetails = useCallback(() => {
    if (selectedItem && isWaniKaniBackedMatch(selectedItem)) {
      handleCloseTooltip();
      router.push({
        pathname: "/subject/[id]",
        params: { id: selectedItem.id.toString(), from: "anime-transcript-dev-viewer" },
      });
    }
  }, [handleCloseTooltip, router, selectedItem]);

  const handleViewSubject = useCallback(
    (subjectId: number) => {
      handleCloseTooltip();
      router.push({
        pathname: "/subject/[id]",
        params: { id: subjectId.toString(), from: "anime-transcript-dev-viewer" },
      });
    },
    [handleCloseTooltip, router]
  );

  const handleTooltipLayout = useCallback(
    (height: number) => {
      if (!Number.isFinite(height) || height <= 0) {
        return;
      }

      setTooltipHeight(height);
      if (!tooltipAnchorRect) {
        return;
      }

      const tooltipExtraGap =
        selectedItem && isWaniKaniBackedMatch(selectedItem) ? 6 : 0;
      const nextPosition = getTooltipPositionFromAnchor(
        tooltipAnchorRect,
        height,
        tooltipExtraGap
      );
      setTooltipPosition((current) => {
        if (
          current &&
          Math.abs(current.x - nextPosition.x) < 0.5 &&
          Math.abs(current.y - nextPosition.y) < 0.5
        ) {
          return current;
        }
        return nextPosition;
      });
    },
    [getTooltipPositionFromAnchor, selectedItem, tooltipAnchorRect]
  );

  const renderFallbackHighlightedText = useCallback(
    (
      text: string,
      baseTextStyle: any,
      cueStartOffset: number,
      textColor: string
    ): ReactElement => {
      const segments = getHighlightSegments(text, allMatches);
      return (
        <Text style={baseTextStyle}>
          {segments.map((segment, index) => {
            if (!segment.match) {
              return <Text key={`plain-${cueStartOffset}-${index}`}>{segment.text}</Text>;
            }

            return (
              <Text
                key={`fallback-${cueStartOffset}-${index}-${segment.match.id}`}
                style={[
                  styles.fallbackHighlightedText,
                  {
                    backgroundColor: withAlpha("#ffffff", 0.18),
                    color: textColor,
                  },
                ]}
                onPress={(event) =>
                  handleVocabularyPress(segment.match!.id, segment.text, event)
                }
              >
                {segment.text}
              </Text>
            );
          })}
        </Text>
      );
    },
    [allMatches, handleVocabularyPress]
  );

  const renderCueText = useCallback(
    (
      cue: AnimeTranscriptSubtitleCue,
      textColor: string,
      mode: "panel" | "fullscreen" = "panel"
    ): ReactElement => {
      const cueText = normalizeSubtitleCueTextForRendering(cue.text);
      const textMetrics =
        mode === "fullscreen"
          ? {
              fontSize: subtitleSizeMetrics.fullscreenFontSize,
              lineHeight: subtitleSizeMetrics.fullscreenLineHeight,
            }
          : {
              fontSize: subtitleSizeMetrics.panelFontSize,
              lineHeight: subtitleSizeMetrics.panelLineHeight,
            };
      const baseTextStyle = [
        styles.cueText,
        textMetrics,
        fontStyles.japaneseText,
        { color: textColor },
        mode === "fullscreen" ? fullscreenSubtitleTextOutlineStyle : null,
      ];

      if (jpdbParsedTokens.length === 0) {
        return renderFallbackHighlightedText(
          cueText,
          baseTextStyle,
          cue.startOffset,
          textColor
        );
      }

      type ParsedInlineSegment = {
        text: string;
        tokenType: "plain" | "grammar" | "verb" | "vocabulary";
        token?: JpdbParsedTokenAnnotation;
      };

      const cueEndOffset = cue.startOffset + cueText.length;
      const inlineSegments: ParsedInlineSegment[] = [];

      const cueTokens = jpdbParsedTokens
        .filter(
          (token) =>
            token.start >= cue.startOffset &&
            token.end <= cueEndOffset &&
            token.end > token.start
        )
        .sort((left, right) => {
          if (left.start !== right.start) {
            return left.start - right.start;
          }
          return right.end - right.start - (left.end - left.start);
        });

      let cursor = 0;
      for (const token of cueTokens) {
        const localStart = token.start - cue.startOffset;
        const localEnd = token.end - cue.startOffset;
        if (localStart < cursor || localStart < 0 || localEnd > cueText.length) {
          continue;
        }

        if (localStart > cursor) {
          inlineSegments.push({
            text: cueText.slice(cursor, localStart),
            tokenType: "plain",
          });
        }

        const tokenText = cueText.slice(localStart, localEnd);
        if (tokenText) {
          inlineSegments.push({
            text: tokenText,
            tokenType: token.tokenType,
            token,
          });
        }

        cursor = localEnd;
      }

      if (cursor < cueText.length) {
        inlineSegments.push({
          text: cueText.slice(cursor),
          tokenType: "plain",
        });
      }

      return (
        <View style={styles.underlinedInlineContainer}>
          {inlineSegments.flatMap((segment, index) => {
            const renderedNodes: ReactElement[] = [];

            if (segment.tokenType === "plain" || !segment.token) {
              renderedNodes.push(
                <Text key={`plain-${cue.id}-${index}`} style={baseTextStyle}>
                  {segment.text}
                </Text>
              );
              return renderedNodes;
            }

            const mappedMatch =
              typeof segment.token.mappedVocabularyId === "number"
                ? vocabularyMatchesById.get(segment.token.mappedVocabularyId)
                : undefined;
            const grammarTooltipItem =
              segment.tokenType === "grammar"
                ? buildGrammarTooltipItem(segment.token)
                : null;
            const jpdbFallbackTooltipItem =
              !grammarTooltipItem && !mappedMatch
                ? buildJpdbFallbackTooltipItem(
                    segment.token,
                    segment.tokenType === "verb" ? "verb" : "vocabulary"
                  )
                : null;
            const tooltipItem =
              grammarTooltipItem ?? mappedMatch ?? jpdbFallbackTooltipItem ?? null;
            const tokenKey = `${segment.token.start}-${segment.token.end}-${segment.text}`;
            const isSelectedToken =
              Boolean(selectedItem) && selectedTokenKey === tokenKey;

            const underlineColor =
              segment.tokenType === "grammar"
                ? grammarUnderlineColor
                : segment.tokenType === "verb"
                  ? verbUnderlineColor
                  : vocabUnderlineColor;
            const tokenUnderlineColor = withAlpha(
              underlineColor,
              theme.isDark ? 0.95 : 0.75
            );
            const selectedTokenBorderColor = withAlpha(
              textColor,
              theme.isDark ? 0.58 : 0.34
            );
            const selectedTokenBackground = withAlpha(
              underlineColor,
              theme.isDark ? 0.24 : 0.18
            );

            const tokenTextNode = (
              <Text
                style={[
                  baseTextStyle,
                  styles.inlineUnderlineToken,
                  isSelectedToken ? styles.inlineUnderlineTokenSelected : null,
                  {
                    borderBottomColor: tokenUnderlineColor,
                    ...(isSelectedToken
                      ? {
                          borderColor: selectedTokenBorderColor,
                          backgroundColor: selectedTokenBackground,
                        }
                      : null),
                  },
                ]}
              >
                {segment.text}
              </Text>
            );

            const tokenNodeKey = `token-${cue.id}-${index}-${segment.token.start}-${segment.token.end}`;
            if (!tooltipItem) {
              renderedNodes.push(
                <View key={tokenNodeKey} style={styles.underlinedTokenPressable}>
                  {tokenTextNode}
                </View>
              );
            } else {
              renderedNodes.push(
                <Pressable
                  key={tokenNodeKey}
                  style={styles.underlinedTokenPressable}
                  onPress={(event) =>
                    handleVocabularyPress(
                      tooltipItem.id,
                      segment.text,
                      event,
                      tooltipItem,
                      tokenKey,
                      "press"
                    )
                  }
                  onHoverIn={
                    hoverPreviewEnabled
                      ? (event) =>
                          handleVocabularyPress(
                            tooltipItem.id,
                            segment.text,
                            event,
                            tooltipItem,
                            tokenKey,
                            "hover"
                          )
                      : undefined
                  }
                  onHoverOut={
                    hoverPreviewEnabled ? () => handleHoverTokenLeave(tokenKey) : undefined
                  }
                >
                  {tokenTextNode}
                </Pressable>
              );
            }

            const nextSegment = inlineSegments[index + 1];
            const hasAdjacentHighlightedSegment =
              nextSegment &&
              nextSegment.tokenType !== "plain" &&
              Boolean(nextSegment.token);
            if (hasAdjacentHighlightedSegment) {
              renderedNodes.push(
                <Text
                  key={`sep-${cue.id}-${index}`}
                  style={[baseTextStyle, styles.inlineUnderlineSeparator]}
                >
                  {TOKEN_UNDERLINE_SEPARATOR}
                </Text>
              );
            }

            return renderedNodes;
          })}
        </View>
      );
    },
    [
      grammarUnderlineColor,
      handleHoverTokenLeave,
      handleVocabularyPress,
      hoverPreviewEnabled,
      jpdbParsedTokens,
      renderFallbackHighlightedText,
      selectedItem,
      selectedTokenKey,
      subtitleSizeMetrics,
      fullscreenSubtitleTextOutlineStyle,
      theme.isDark,
      verbUnderlineColor,
      vocabUnderlineColor,
      vocabularyMatchesById,
    ]
  );

  if (!session || !videoUri) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundColor }]}>
        <StatusBar style="light" />
        <TouchableOpacity
          onPress={() => router.back()}
          style={[
            styles.screenBackButton,
            {
              top: Math.max(insets.top + 10, 16),
            },
          ]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.emptyState}>
          <Text style={[styles.emptyStateTitle, { color: theme.textColor }]}>
            No processed session found
          </Text>
          <Text style={[styles.emptyStateSubtitle, { color: theme.textSecondary }]}>
            Go back, upload files, and process subtitles first.
          </Text>
          <TouchableOpacity
            style={[styles.goBackButton, { backgroundColor: theme.primary }]}
            onPress={() => router.back()}
            activeOpacity={0.82}
          >
            <Text style={styles.goBackButtonText}>Back to Upload</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundColor,
          paddingTop: isVlcFullscreen ? 0 : insets.top,
        },
      ]}
    >
      <StatusBar style="light" hidden={isVlcFullscreen} />
      {!isVlcFullscreen ? (
        <View
          pointerEvents="none"
          style={[styles.topSafeAreaOverlay, { height: insets.top }]}
        />
      ) : null}

      <View
        style={[
          styles.videoContainer,
          isVlcFullscreen ? styles.videoContainerFullscreen : null,
          isVlcFullscreen ? styles.vlcVideoContainerFullscreen : null,
        ]}
        onTouchStart={isVlcFullscreen ? undefined : revealInlineControl}
      >
        {usesVlcPlayer ? (
          <View style={styles.vlcSurfaceViewport} pointerEvents="box-none">
            <View
              style={[
                styles.vlcSurfaceStage,
                isVlcFullscreen && shouldUseVlcFakeLandscapeFullscreen
                  ? {
                      width: viewportHeight,
                      height: viewportWidth,
                      transform: [{ rotate: `${fullscreenRotationDegrees}deg` }],
                    }
                  : null,
              ]}
            >
              {renderVideoSurface(styles.fullscreenVideo)}

              {isVlcFullscreenRotatedStage ? (
                <>
                  <Pressable
                    style={styles.vlcFullscreenTapLayer}
                    onPress={handleVlcFullscreenBackgroundPress}
                  />
                  {activeCues.length > 0 ? (
                    <Animated.View
                      pointerEvents="box-none"
                      style={[
                        styles.fullscreenSubtitleOverlay,
                        { paddingBottom: Math.max(insets.bottom + 10, 16) },
                        { transform: fullscreenSubtitleTransform },
                      ]}
                      {...subtitleDragPanResponder.panHandlers}
                    >
                      <View style={styles.fullscreenSubtitleStack}>
                        {activeCues.map((cue) => {
                          const cueTranslation = captionTranslationsByCueId[cue.id] ?? null;
                          return (
                            <View
                              key={`vlc-inline-fullscreen-${cue.id}`}
                              style={[
                                styles.fullscreenCueContainer,
                                { backgroundColor: fullscreenSubtitleBackgroundColor },
                              ]}
                            >
                              <View style={styles.fullscreenCueTextWrap}>
                                {renderCueText(cue, fullscreenSubtitleTextColor, "fullscreen")}
                              </View>
                              {cueTranslation ? (
                                <Text
                                  style={[
                                    styles.fullscreenCueTranslationText,
                                    { color: withAlpha(fullscreenSubtitleTextColor, 0.84) },
                                  ]}
                                >
                                  {cueTranslation.text}
                                </Text>
                              ) : null}
                            </View>
                          );
                        })}
                      </View>
                    </Animated.View>
                  ) : null}
                  {showFullscreenExitControl ? renderPlaybackControls(true) : null}
                </>
              ) : null}
            </View>
          </View>
        ) : (
          renderVideoSurface(styles.video)
        )}

        {!isCustomFullscreen && showInlineFullscreenControl ? (
          <TouchableOpacity
            style={styles.fullscreenToggleButton}
            onPress={handleOpenCustomFullscreen}
            activeOpacity={0.85}
          >
            <Ionicons name="expand" size={16} color="#ffffff" />
            <Text style={styles.fullscreenToggleButtonText}>Fullscreen</Text>
          </TouchableOpacity>
        ) : null}

        {isVlcFullscreen && !isVlcFullscreenRotatedStage ? (
          <Pressable
            style={styles.vlcFullscreenTapLayer}
            onPress={handleVlcFullscreenBackgroundPress}
          />
        ) : null}

        {isVlcFullscreen && !isVlcFullscreenRotatedStage && activeCues.length > 0 ? (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.fullscreenSubtitleOverlay,
              { paddingBottom: Math.max(insets.bottom + 10, 16) },
              { transform: fullscreenSubtitleTransform },
            ]}
            {...subtitleDragPanResponder.panHandlers}
          >
            <View style={styles.fullscreenSubtitleStack}>
              {activeCues.map((cue) => {
                const cueTranslation = captionTranslationsByCueId[cue.id] ?? null;
                return (
                  <View
                    key={`vlc-inline-fullscreen-${cue.id}`}
                    style={[
                      styles.fullscreenCueContainer,
                      { backgroundColor: fullscreenSubtitleBackgroundColor },
                    ]}
                  >
                    <View style={styles.fullscreenCueTextWrap}>
                      {renderCueText(cue, fullscreenSubtitleTextColor, "fullscreen")}
                    </View>
                    {cueTranslation ? (
                      <Text
                        style={[
                          styles.fullscreenCueTranslationText,
                          { color: withAlpha(fullscreenSubtitleTextColor, 0.84) },
                        ]}
                      >
                        {cueTranslation.text}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </Animated.View>
        ) : null}

        {isVlcFullscreen && !isVlcFullscreenRotatedStage && showFullscreenExitControl ? (
          renderPlaybackControls(true)
        ) : null}

        {isVlcFullscreen ? (
          <VocabularyTooltip
            selectedItem={selectedItem}
            position={tooltipPosition}
            opacity={tooltipOpacity}
            selectedSurfaceText={selectedSurfaceText}
            interactionMode={tooltipInteractionMode ?? "press"}
            headerColorOverride={
              selectedItem && selectedItem.id <= GRAMMAR_TOOLTIP_ID_MIN
                ? grammarUnderlineColor
                : undefined
            }
            useModal={false}
            rotationDegrees={
              shouldUseVlcFakeLandscapeFullscreen ? fullscreenRotationDegrees : 0
            }
            onTooltipLayout={handleTooltipLayout}
            onClose={handleCloseTooltipFromBackdrop}
            onViewDetails={handleViewDetails}
            onViewSubject={handleViewSubject}
          />
        ) : null}
      </View>
      {!isCustomFullscreen ? renderPlaybackControls(false) : null}
      {!isCustomFullscreen && playbackError ? (
        <Text style={styles.vlcErrorText}>{playbackError}</Text>
      ) : null}

      {!isFullscreen ? (
        <View
          style={[
            styles.subtitlePanel,
            { backgroundColor: theme.backgroundColor, borderColor: theme.border },
          ]}
        >
          <View style={styles.subtitlePanelHeader}>
            <Text style={[styles.subtitlePanelTitle, { color: theme.textSecondary }]}>
              Live subtitles
            </Text>
            <View style={styles.subtitlePanelHeaderActions}>
              {viewerSettings.showPauseAndTranslateCurrentCaptionButton ? (
                <TouchableOpacity
                  style={[
                    styles.subtitlePanelTranslateButton,
                    {
                      borderColor: withAlpha(theme.primary, 0.45),
                      backgroundColor: withAlpha(theme.primary, 0.16),
                    },
                  ]}
                  onPress={() => {
                    void handlePauseAndTranslateCurrentCue();
                  }}
                  activeOpacity={0.82}
                  disabled={!primaryActiveCue || isTranslatingCurrentCue}
                >
                  {isTranslatingCurrentCue ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <Ionicons
                      name="language-outline"
                      size={15}
                      color={theme.primary}
                    />
                  )}
                </TouchableOpacity>
              ) : null}
              {viewerSettings.showSubtitleSearchButton ? (
                <TouchableOpacity
                  style={[
                    styles.subtitlePanelSearchToggleButton,
                    {
                      borderColor: theme.border,
                      backgroundColor: withAlpha(theme.cardBackground, 0.7),
                    },
                  ]}
                  onPress={() => {
                    if (isSubtitleSearchVisible) {
                      setIsSubtitleSearchVisible(false);
                      setSubtitleSearchQuery("");
                      return;
                    }
                    setIsSubtitleSearchVisible(true);
                  }}
                  activeOpacity={0.82}
                >
                  <Ionicons
                    name={isSubtitleSearchVisible ? "close" : "search"}
                    size={15}
                    color={theme.textSecondary}
                  />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={[
                  styles.subtitlePanelSettingsButton,
                  {
                    borderColor: theme.border,
                    backgroundColor: withAlpha(theme.cardBackground, 0.7),
                  },
                ]}
                onPress={handleOpenViewerSettings}
                activeOpacity={0.82}
              >
                <Ionicons name="settings-outline" size={15} color={theme.textSecondary} />
                <Text style={[styles.subtitlePanelSettingsButtonText, { color: theme.textSecondary }]}>
                  Settings
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          {viewerSettings.showSubtitleSearchButton && isSubtitleSearchVisible ? (
            <View
              style={[
                styles.subtitleSearchInputRow,
                {
                  borderColor: theme.border,
                  backgroundColor: withAlpha(theme.cardBackground, 0.6),
                },
              ]}
            >
              <Ionicons name="search" size={14} color={theme.textSecondary} />
              <TextInput
                value={subtitleSearchQuery}
                onChangeText={setSubtitleSearchQuery}
                placeholder="Search transcript..."
                placeholderTextColor={withAlpha(theme.textSecondary, 0.75)}
                style={[styles.subtitleSearchInput, { color: theme.textColor }]}
                returnKeyType="search"
              />
              {subtitleSearchQuery.trim().length > 0 ? (
                <TouchableOpacity
                  style={styles.subtitleSearchClearButton}
                  onPress={() => setSubtitleSearchQuery("")}
                  activeOpacity={0.75}
                >
                  <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}
          {translationErrorMessage ? (
            <Text style={[styles.translationErrorText, { color: theme.error }]}>
              {translationErrorMessage}
            </Text>
          ) : null}
          {viewerSettings.showSubtitleSearchButton &&
          isSubtitleSearchVisible &&
          normalizedSubtitleSearchQuery ? (
            <View style={styles.searchResultsBlock}>
              <Text style={[styles.searchResultsLabel, { color: theme.textSecondary }]}>
                Matches: {subtitleSearchResults.length}
              </Text>
              {subtitleSearchResults.length > 0 ? (
                <ScrollView
                  style={styles.searchResultsScroll}
                  contentContainerStyle={styles.searchResultsList}
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {subtitleSearchResults.map((cue) => (
                    <TouchableOpacity
                      key={`search-result-${cue.id}`}
                      style={[
                        styles.searchResultRow,
                        {
                          borderColor: theme.border,
                          backgroundColor: withAlpha(theme.cardBackground, 0.72),
                        },
                      ]}
                      onPress={() => seekToTimeSeconds(cue.startTime)}
                      activeOpacity={0.82}
                    >
                      <Text style={[styles.searchResultTime, { color: theme.primary }]}>
                        {formatTimestamp(cue.startTime)}
                      </Text>
                      <Text
                        style={[styles.searchResultText, { color: theme.textColor }]}
                        numberOfLines={2}
                      >
                        {normalizeSubtitleCueTextForRendering(cue.text)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Text style={[styles.searchNoResultsText, { color: theme.textSecondary }]}>
                  No matches found.
                </Text>
              )}
            </View>
          ) : null}
          <ScrollView
            contentContainerStyle={styles.subtitlePanelContent}
            showsVerticalScrollIndicator={false}
          >
            {activeCues.length > 0 ? (
              activeCues.map((cue) => {
                const cueTranslation = captionTranslationsByCueId[cue.id] ?? null;
                return (
                  <View
                    key={`active-${cue.id}`}
                    style={[
                      styles.subtitleCueRow,
                      {
                        borderColor: theme.border,
                        backgroundColor: withAlpha(theme.primary, 0.08),
                      },
                    ]}
                  >
                    <View style={styles.subtitleCueTextWrap}>
                      {renderCueText(cue, theme.textColor)}
                    </View>
                    {cueTranslation ? (
                      <Text
                        style={[
                          styles.subtitleCueTranslationText,
                          { color: theme.textSecondary },
                        ]}
                      >
                        {cueTranslation.text}
                      </Text>
                    ) : null}
                  </View>
                );
              })
            ) : (
              <Text style={[styles.noSubtitleText, { color: theme.textSecondary }]}>
                {noSubtitleMessage}
              </Text>
            )}
          </ScrollView>
        </View>
      ) : null}

      <Modal
        visible={isCustomFullscreen && !usesVlcPlayer}
        transparent={false}
        animationType="fade"
        onRequestClose={handleCloseCustomFullscreen}
      >
        <View style={styles.fullscreenModal}>
          <StatusBar hidden style="light" />
          {shouldUseFakeLandscapeFullscreen ? (
            <View style={styles.fullscreenRotatedViewport} pointerEvents="box-none">
              <View
                style={[
                  styles.fullscreenRotatedStage,
                  {
                    width: viewportHeight,
                    height: viewportWidth,
                    transform: [{ rotate: `${fullscreenRotationDegrees}deg` }],
                  },
                ]}
              >
                {renderVideoSurface(styles.fullscreenVideo)}
                <Pressable
                  style={styles.vlcFullscreenTapLayer}
                  onPress={handleModalFullscreenBackgroundTouch}
                />

                {activeCues.length > 0 ? (
                  <Animated.View
                    pointerEvents="box-none"
                    style={[
                      styles.fullscreenSubtitleOverlay,
                      { paddingBottom: Math.max(insets.bottom + 10, 16) },
                      { transform: fullscreenSubtitleTransform },
                    ]}
                    {...subtitleDragPanResponder.panHandlers}
                  >
                    <View style={styles.fullscreenSubtitleStack}>
                      {activeCues.map((cue) => {
                        const cueTranslation = captionTranslationsByCueId[cue.id] ?? null;
                        return (
                          <View
                            key={`modal-fullscreen-${cue.id}`}
                            style={[
                              styles.fullscreenCueContainer,
                              { backgroundColor: fullscreenSubtitleBackgroundColor },
                            ]}
                          >
                            <View style={styles.fullscreenCueTextWrap}>
                              {renderCueText(cue, fullscreenSubtitleTextColor, "fullscreen")}
                            </View>
                            {cueTranslation ? (
                              <Text
                                style={[
                                  styles.fullscreenCueTranslationText,
                                  { color: withAlpha(fullscreenSubtitleTextColor, 0.84) },
                                ]}
                              >
                                {cueTranslation.text}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  </Animated.View>
                ) : null}
                {showFullscreenExitControl ? renderPlaybackControls(true) : null}
              </View>
            </View>
          ) : (
            <>
              {renderVideoSurface(styles.fullscreenVideo)}
              <Pressable
                style={styles.vlcFullscreenTapLayer}
                onPress={handleModalFullscreenBackgroundTouch}
              />
              {activeCues.length > 0 ? (
                <Animated.View
                  pointerEvents="box-none"
                  style={[
                    styles.fullscreenSubtitleOverlay,
                    { paddingBottom: Math.max(insets.bottom + 10, 16) },
                    { transform: fullscreenSubtitleTransform },
                  ]}
                  {...subtitleDragPanResponder.panHandlers}
                >
                  <View style={styles.fullscreenSubtitleStack}>
                    {activeCues.map((cue) => {
                      const cueTranslation = captionTranslationsByCueId[cue.id] ?? null;
                      return (
                        <View
                          key={`modal-fullscreen-${cue.id}`}
                          style={[
                            styles.fullscreenCueContainer,
                            { backgroundColor: fullscreenSubtitleBackgroundColor },
                          ]}
                        >
                          <View style={styles.fullscreenCueTextWrap}>
                            {renderCueText(cue, fullscreenSubtitleTextColor, "fullscreen")}
                          </View>
                          {cueTranslation ? (
                            <Text
                              style={[
                                styles.fullscreenCueTranslationText,
                                { color: withAlpha(fullscreenSubtitleTextColor, 0.84) },
                              ]}
                            >
                              {cueTranslation.text}
                            </Text>
                          ) : null}
                        </View>
                      );
                    })}
                  </View>
                </Animated.View>
              ) : null}
            </>
          )}

          {!shouldUseFakeLandscapeFullscreen && showFullscreenExitControl
            ? renderPlaybackControls(true)
            : null}

          <VocabularyTooltip
            selectedItem={selectedItem}
            position={tooltipPosition}
            opacity={tooltipOpacity}
            selectedSurfaceText={selectedSurfaceText}
            interactionMode={tooltipInteractionMode ?? "press"}
            headerColorOverride={
              selectedItem && selectedItem.id <= GRAMMAR_TOOLTIP_ID_MIN
                ? grammarUnderlineColor
                : undefined
            }
            useModal={false}
            rotationDegrees={
              shouldUseFakeLandscapeFullscreen ? fullscreenRotationDegrees : 0
            }
            onTooltipLayout={handleTooltipLayout}
            onClose={handleCloseTooltipFromBackdrop}
            onViewDetails={handleViewDetails}
            onViewSubject={handleViewSubject}
          />
        </View>
      </Modal>

      {!isCustomFullscreen ? (
        <VocabularyTooltip
          selectedItem={selectedItem}
          position={tooltipPosition}
          opacity={tooltipOpacity}
          selectedSurfaceText={selectedSurfaceText}
          interactionMode={tooltipInteractionMode ?? "press"}
          headerColorOverride={
            selectedItem && selectedItem.id <= GRAMMAR_TOOLTIP_ID_MIN
              ? grammarUnderlineColor
              : undefined
          }
          onTooltipLayout={handleTooltipLayout}
          onClose={handleCloseTooltip}
          onViewDetails={handleViewDetails}
          onViewSubject={handleViewSubject}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topSafeAreaOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "#000000",
    zIndex: 3,
  },
  screenBackButton: {
    position: "absolute",
    left: 12,
    zIndex: 10,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  videoContainer: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#000",
  },
  videoContainerFullscreen: {
    height: "100%",
    aspectRatio: undefined,
  },
  vlcVideoContainerFullscreen: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
  vlcSurfaceViewport: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  vlcSurfaceStage: {
    width: "100%",
    height: "100%",
    backgroundColor: "#000000",
    overflow: "hidden",
  },
  vlcFullscreenTapLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2,
  },
  video: {
    width: "100%",
    height: "100%",
  },
  vlcUnavailableSurface: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000000",
    paddingHorizontal: 16,
  },
  vlcUnavailableText: {
    color: "#ffffff",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  vlcErrorText: {
    color: "#ef4444",
    fontSize: 12,
    textAlign: "center",
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  vlcInlineControls: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  vlcControlTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  vlcPlayPauseButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "transparent",
  },
  vlcPlayPauseButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  vlcTimeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
  fullscreenVlcControls: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 7,
    pointerEvents: "box-none",
  },
  fullscreenVlcBottomGradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 176,
  },
  fullscreenVlcBottomControls: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fullscreenVlcCenterControls: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    pointerEvents: "box-none",
  },
  fullscreenVlcCenterPlayPauseButton: {
    width: 98,
    height: 98,
    borderRadius: 49,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  fullscreenVlcSkipButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  playbackIconOutline: {
    textShadowColor: "rgba(2,6,23,0.95)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 3.2,
  },
  playbackIconOutlineInline: {
    textShadowColor: "rgba(2,6,23,0.9)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 1.4,
  },
  fullscreenVlcSlider: {
    flex: 1,
  },
  fullscreenVlcTimeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    minWidth: 88,
    textAlign: "right",
  },
  fullscreenVlcExitButton: {
    position: "absolute",
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.001)",
    zIndex: 9,
  },
  fullscreenVlcTranslateButton: {
    position: "absolute",
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.001)",
    zIndex: 9,
  },
  fullscreenToggleButton: {
    position: "absolute",
    right: 10,
    bottom: 10,
    zIndex: 3,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  fullscreenToggleButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  subtitlePanel: {
    flex: 1,
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  subtitlePanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  subtitlePanelHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  subtitlePanelTitle: {
    fontSize: 12,
    fontWeight: "700",
  },
  subtitlePanelTranslateButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitlePanelSearchToggleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitlePanelSettingsButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  subtitlePanelSettingsButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  subtitleSearchInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  subtitleSearchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 8,
    marginLeft: 6,
  },
  subtitleSearchClearButton: {
    marginLeft: 4,
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  translationErrorText: {
    fontSize: 12,
    marginBottom: 8,
  },
  searchResultsBlock: {
    marginBottom: 8,
    gap: 6,
  },
  searchResultsLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.2,
  },
  searchResultsScroll: {
    maxHeight: 228,
  },
  searchResultsList: {
    gap: 7,
  },
  searchResultRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 4,
  },
  searchResultTime: {
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  searchResultText: {
    fontSize: 12,
    lineHeight: 17,
  },
  searchNoResultsText: {
    fontSize: 12,
  },
  subtitlePanelContent: {
    gap: 8,
    paddingBottom: 20,
  },
  subtitleCueRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  subtitleCueTextWrap: {
    flex: 1,
    alignItems: "center",
  },
  subtitleCueTranslationText: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
  },
  cueText: {
    fontSize: 22,
    lineHeight: 34,
  },
  noSubtitleText: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 22,
  },
  fullscreenSubtitleOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 6,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingHorizontal: 10,
  },
  fullscreenModal: {
    flex: 1,
    backgroundColor: "#000000",
  },
  fullscreenRotatedViewport: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  fullscreenRotatedStage: {
    backgroundColor: "#000000",
    overflow: "hidden",
  },
  fullscreenVideo: {
    width: "100%",
    height: "100%",
  },
  fullscreenTopControls: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 8,
    pointerEvents: "box-none",
  },
  fullscreenSideControlsRail: {
    position: "absolute",
    zIndex: 8,
    gap: 2,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  fullscreenSideControlSlot: {
    width: 60,
    height: 108,
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenSideControlButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 11,
    minWidth: 88,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  fullscreenCloseButton: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 11,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.58)",
  },
  fullscreenCloseButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  fullscreenSubtitleStack: {
    width: "100%",
    alignItems: "center",
    gap: 6,
  },
  fullscreenCueContainer: {
    maxWidth: "92%",
    paddingTop: 0,
    paddingBottom: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.56)",
    alignItems: "center",
    justifyContent: "center",
  },
  fullscreenCueTextWrap: {
    alignItems: "center",
  },
  fullscreenCueTranslationText: {
    marginTop: 4,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  underlinedInlineContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "center",
  },
  underlinedTokenPressable: {
    marginVertical: 1,
  },
  inlineUnderlineToken: {
    borderBottomWidth: 2,
    borderRadius: 6,
    paddingHorizontal: 1,
    borderWidth: 1,
    borderColor: "transparent",
  },
  inlineUnderlineTokenSelected: {
    borderRadius: 7,
  },
  inlineUnderlineSeparator: {
    opacity: 0.01,
  },
  fallbackHighlightedText: {
    borderRadius: 4,
    paddingHorizontal: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyStateSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  goBackButton: {
    marginTop: 8,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  goBackButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
