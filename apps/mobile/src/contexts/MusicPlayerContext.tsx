import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  MusicItem,
  MusicKit,
  Player,
  PlaybackStatus,
} from "@lomray/react-native-apple-music";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { EmitterSubscription } from "react-native";
import { Platform } from "react-native";
import { useSpotifyPlayerController } from "../features/spotify/useSpotifyPlayerController";
import { TimedLyricsLine } from "../services/lyricsService";

type MusicSource = "youtube" | "spotify" | "apple";

interface MusicPlayerContextType {
  // Song info
  albumArt: string;
  songTitle: string;
  artist: string;
  youtubeVideoId: string | null;
  songId: string | null;
  songUrl: string | null;
  musicSource: MusicSource;
  appleTrackId: string | null;
  spotifyTrackId: string | null;

  // Lyrics
  timedLyrics: TimedLyricsLine[];
  lyricsTimingOffsetMs: number;

  // Player state
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isPlayerExpanded: boolean;

  // Player ref
  playerRef: React.MutableRefObject<any>;

  // Actions
  setSongInfo: (info: {
    albumArt: string;
    songTitle: string;
    artist: string;
    youtubeVideoId: string | null;
    songId?: string;
    songUrl?: string;
    musicSource?: MusicSource;
    durationMs?: number;
    lyricsTimingOffsetMs?: number;
  }) => void;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlayerExpanded: (expanded: boolean) => void;
  togglePlayPause: () => void;
  skipForward: () => Promise<void>;
  skipBackward: () => Promise<void>;
  onStateChange: (state: string) => void;
  clearPlayer: () => void;
  setTimedLyrics: (lyrics: TimedLyricsLine[]) => void;
  setLyricsTimingOffsetMs: React.Dispatch<React.SetStateAction<number>>;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(
  undefined,
);

const isIOS = Platform.OS === "ios";

const normalizeDurationSeconds = (value: unknown): number => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return 0;
};

const isPlayingStatus = (status: unknown) =>
  status === PlaybackStatus.PLAYING || status === "playing";

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  // Song info
  const [albumArt, setAlbumArt] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [youtubeVideoId, setYoutubeVideoId] = useState<string | null>(null);
  const [songId, setSongId] = useState<string | null>(null);
  const [songUrl, setSongUrl] = useState<string | null>(null);
  const [musicSource, setMusicSource] = useState<MusicSource>("youtube");
  const [appleTrackId, setAppleTrackId] = useState<string | null>(null);
  const [spotifyTrackId, setSpotifyTrackId] = useState<string | null>(null);

  // Lyrics
  const [timedLyrics, setTimedLyrics] = useState<TimedLyricsLine[]>([]);
  const [lyricsTimingOffsetMs, setLyricsTimingOffsetMs] = useState(0);

  // Player state
  const [isPlayingState, setIsPlayingState] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);

  // Player refs
  const playerRef = useRef<any>(null);
  const appleListenersRef = useRef<EmitterSubscription[]>([]);
  const musicSourceRef = useRef<MusicSource>("youtube");
  const spotifyTrackIdRef = useRef<string | null>(null);
  const appleTrackIdRef = useRef<string | null>(null);
  const youtubeVideoIdRef = useRef<string | null>(null);
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const isPlayingRef = useRef(false);
  const lyricsTimingSongKeyRef = useRef<string | null>(null);

  useEffect(() => {
    musicSourceRef.current = musicSource;
    spotifyTrackIdRef.current = spotifyTrackId;
    appleTrackIdRef.current = appleTrackId;
    youtubeVideoIdRef.current = youtubeVideoId;
    currentTimeRef.current = currentTime;
    durationRef.current = duration;
    isPlayingRef.current = isPlayingState;
  }, [
    appleTrackId,
    currentTime,
    duration,
    isPlayingState,
    musicSource,
    spotifyTrackId,
    youtubeVideoId,
  ]);

  const clearAppleListeners = useCallback(() => {
    for (const listener of appleListenersRef.current) {
      try {
        listener.remove();
      } catch {
        // no-op: listener may already be removed
      }
    }
    appleListenersRef.current = [];
  }, []);

  const setPlaybackPlayingState = useCallback((playing: boolean) => {
    setIsPlayingState(playing);
    isPlayingRef.current = playing;
  }, []);

  const spotifyPlayer = useSpotifyPlayerController({
    trackId: spotifyTrackId,
    trackUrl: spotifyTrackId ? songUrl : null,
    currentTime,
    duration,
    isPlaying: isPlayingState,
    setIsPlaying: setPlaybackPlayingState,
    setCurrentTime,
    setDuration,
  });

  const updateAppleStateFromNative = useCallback(async () => {
    if (!isIOS) return;

    try {
      const state = await Player.getCurrentState();
      setCurrentTime(state?.playbackTime ?? 0);
      setPlaybackPlayingState(isPlayingStatus(state?.playbackStatus));

      const nextDuration = normalizeDurationSeconds(
        state?.currentSong?.duration,
      );
      if (nextDuration > 0) {
        setDuration(nextDuration);
      }
    } catch (error) {
      console.error("Error reading Apple Music playback state:", error);
    }
  }, [setPlaybackPlayingState]);

  const setupAppleListeners = useCallback(() => {
    if (!isIOS) return;

    clearAppleListeners();

    const playbackStateListener = Player.addListener(
      "onPlaybackStateChange",
      (state: any) => {
        if (typeof state?.playbackTime === "number") {
          setCurrentTime(state.playbackTime);
        }

        setPlaybackPlayingState(isPlayingStatus(state?.playbackStatus));

        const nextDuration = normalizeDurationSeconds(
          state?.currentSong?.duration,
        );
        if (nextDuration > 0) {
          setDuration(nextDuration);
        }
      },
    );

    const playbackTimeListener = Player.addListener(
      "onPlaybackTimeUpdate",
      (state: any) => {
        if (typeof state?.playbackTime === "number") {
          setCurrentTime(state.playbackTime);
        }
      },
    );

    const currentSongListener = Player.addListener(
      "onCurrentSongChange",
      (song: any) => {
        const nextDuration = normalizeDurationSeconds(song?.duration);
        if (nextDuration > 0) {
          setDuration(nextDuration);
        }
      },
    );

    appleListenersRef.current = [
      playbackStateListener,
      playbackTimeListener,
      currentSongListener,
    ];
  }, [clearAppleListeners, setPlaybackPlayingState]);

  const loadAppleTrack = useCallback(
    async (trackId: string) => {
      if (!isIOS) return;

      try {
        await MusicKit.setPlaybackQueue(trackId, MusicItem.SONG);

        setupAppleListeners();
        await updateAppleStateFromNative();

        playerRef.current = {
          seekTo: async (seconds: number) => {
            Player.seekToTime(Math.max(seconds, 0));
          },
          getCurrentTime: async () => {
            try {
              const state = await Player.getCurrentState();
              return state?.playbackTime ?? 0;
            } catch {
              return 0;
            }
          },
          getDuration: async () => {
            try {
              const state = await Player.getCurrentState();
              return normalizeDurationSeconds(state?.currentSong?.duration);
            } catch {
              return 0;
            }
          },
        };
      } catch (error) {
        console.error("Error loading Apple Music queue:", error);
        clearAppleListeners();
        playerRef.current = null;
      }
    },
    [clearAppleListeners, setupAppleListeners, updateAppleStateFromNative],
  );

  const setSongInfo = useCallback(
    (info: {
      albumArt: string;
      songTitle: string;
      artist: string;
      youtubeVideoId: string | null;
      songId?: string;
      songUrl?: string;
      musicSource?: MusicSource;
      durationMs?: number;
      lyricsTimingOffsetMs?: number;
    }) => {
      const source = info.musicSource || "youtube";
      const nextAppleTrackId = source === "apple" ? info.songId || null : null;
      const nextSpotifyTrackId =
        source === "spotify" ? info.songId || null : null;
      const nextYoutubeVideoId =
        source === "youtube" ? info.youtubeVideoId : null;
      const nextSongId = info.songId || null;
      const nextSongUrl = info.songUrl || null;
      const isSameLoadedMedia =
        source === musicSourceRef.current &&
        (source === "spotify"
          ? nextSpotifyTrackId === spotifyTrackIdRef.current
          : source === "apple"
            ? nextAppleTrackId === appleTrackIdRef.current
            : nextYoutubeVideoId === youtubeVideoIdRef.current);
      const nextDuration = info.durationMs
        ? info.durationMs / 1000
        : isSameLoadedMedia
          ? durationRef.current
          : 0;
      const nextLyricsTimingSongKey = [
        source,
        info.songId || "",
        info.songTitle,
        info.artist,
      ].join("|");

      if (
        typeof info.lyricsTimingOffsetMs === "number" &&
        Number.isFinite(info.lyricsTimingOffsetMs)
      ) {
        setLyricsTimingOffsetMs(info.lyricsTimingOffsetMs);
      } else if (lyricsTimingSongKeyRef.current !== nextLyricsTimingSongKey) {
        setLyricsTimingOffsetMs(0);
      }
      lyricsTimingSongKeyRef.current = nextLyricsTimingSongKey;

      setAlbumArt(info.albumArt);
      setSongTitle(info.songTitle);
      setArtist(info.artist);
      setSongId(nextSongId);
      setSongUrl(nextSongUrl);
      setMusicSource(source);
      setAppleTrackId(nextAppleTrackId);
      setSpotifyTrackId(nextSpotifyTrackId);
      setYoutubeVideoId(nextYoutubeVideoId);

      musicSourceRef.current = source;
      appleTrackIdRef.current = nextAppleTrackId;
      spotifyTrackIdRef.current = nextSpotifyTrackId;
      youtubeVideoIdRef.current = nextYoutubeVideoId;
      durationRef.current = nextDuration;
      setDuration(nextDuration);

      if (!isSameLoadedMedia) {
        setTimedLyrics([]);
        setPlaybackPlayingState(false);
        setCurrentTime(0);
        currentTimeRef.current = 0;
      }

      spotifyPlayer.configureTrack({
        trackId: nextSpotifyTrackId,
        trackUrl: nextSongUrl,
        currentTime: isSameLoadedMedia ? currentTimeRef.current : 0,
        duration: nextDuration,
        resetPlaybackState: !isSameLoadedMedia,
      });

      if (source === "apple") {
        if (nextAppleTrackId) {
          void loadAppleTrack(nextAppleTrackId);
        } else {
          clearAppleListeners();
          playerRef.current = null;
        }
        return;
      }

      clearAppleListeners();
      if (source === "spotify") {
        playerRef.current = spotifyPlayer.playerHandle;
        return;
      }

      playerRef.current = null;

      // Try to load video and lyrics from cache if not provided
      if (info.songTitle && info.artist) {
        const cacheKeyBase = `wanikani_lyrics_v1_${info.songTitle.replace(
          /\s+/g,
          "",
        )}_${info.artist.replace(/\s+/g, "")}`;

        // Load Video from cache
        if (!info.youtubeVideoId) {
          const videoCacheKey = `${cacheKeyBase}_video`;
          AsyncStorage.getItem(videoCacheKey)
            .then((cachedId: string | null) => {
              if (cachedId) {
                console.log("Global Context: Found cached video", cachedId);
                setYoutubeVideoId(cachedId);
              }
            })
            .catch((err: any) =>
              console.error("Error loading cached video in context", err),
            );
        }

        // Load Lyrics from cache
        const lyricsCacheKey = `${cacheKeyBase}_lyrics`;
        AsyncStorage.getItem(lyricsCacheKey)
          .then((cachedLyricsJson: string | null) => {
            if (cachedLyricsJson) {
              const cachedLyrics = JSON.parse(cachedLyricsJson);
              if (
                cachedLyrics.timedLyrics &&
                cachedLyrics.timedLyrics.length > 0
              ) {
                console.log(
                  "Global Context: Found cached lyrics",
                  cachedLyrics.timedLyrics.length,
                  "lines",
                );
                setTimedLyrics(cachedLyrics.timedLyrics);
              }
            }
          })
          .catch((err: any) =>
            console.error("Error loading cached lyrics in context", err),
          );
      }
    },
    [
      clearAppleListeners,
      loadAppleTrack,
      setPlaybackPlayingState,
      spotifyPlayer,
    ],
  );

  const setIsPlaying = useCallback(
    (playing: boolean) => {
      const source = musicSourceRef.current;

      if (source === "apple") {
        if (!isIOS) return;

        try {
          if (playing) {
            Player.play();
          } else {
            Player.pause();
          }
          setPlaybackPlayingState(playing);
        } catch (error) {
          console.error("Error controlling Apple Music playback:", error);
        }
        return;
      }

      if (source === "spotify") {
        void spotifyPlayer.setPlaying(playing);
        return;
      }

      setPlaybackPlayingState(playing);
    },
    [setPlaybackPlayingState, spotifyPlayer],
  );

  const togglePlayPause = useCallback(() => {
    setIsPlaying(!isPlayingRef.current);
  }, [setIsPlaying]);

  const skipForward = useCallback(async () => {
    if (musicSource === "apple") {
      if (!isIOS) return;

      try {
        const state = await Player.getCurrentState();
        const current = state?.playbackTime ?? 0;
        const max = normalizeDurationSeconds(state?.currentSong?.duration);
        const next = max > 0 ? Math.min(current + 10, max) : current + 10;
        Player.seekToTime(next);
        setCurrentTime(next);
        currentTimeRef.current = next;
      } catch (error) {
        console.error("Error skipping Apple Music forward:", error);
      }
      return;
    }

    if (musicSource === "spotify") {
      await spotifyPlayer.skipForward();
      return;
    }

    if (!playerRef.current) return;

    try {
      const current = await playerRef.current.getCurrentTime();
      const newTime = current + 10;
      await playerRef.current.seekTo(newTime);
    } catch (error) {
      console.error("Error skipping forward:", error);
    }
  }, [musicSource, spotifyPlayer]);

  const skipBackward = useCallback(async () => {
    if (musicSource === "apple") {
      if (!isIOS) return;

      try {
        const state = await Player.getCurrentState();
        const current = state?.playbackTime ?? 0;
        const next = Math.max(current - 10, 0);
        Player.seekToTime(next);
        setCurrentTime(next);
        currentTimeRef.current = next;
      } catch (error) {
        console.error("Error skipping Apple Music backward:", error);
      }
      return;
    }

    if (musicSource === "spotify") {
      await spotifyPlayer.skipBackward();
      return;
    }

    if (!playerRef.current) return;

    try {
      const current = await playerRef.current.getCurrentTime();
      const newTime = Math.max(current - 10, 0);
      await playerRef.current.seekTo(newTime);
    } catch (error) {
      console.error("Error skipping backward:", error);
    }
  }, [musicSource, spotifyPlayer]);

  const onStateChange = useCallback(
    (state: string) => {
      if (musicSource === "apple" || musicSource === "spotify") return;

      console.log("YouTube player state changed to:", state);
      if (state === "ended" || state === "paused") {
        setPlaybackPlayingState(false);
      } else if (state === "playing") {
        setPlaybackPlayingState(true);

        if (playerRef.current) {
          Promise.all([
            playerRef.current.getDuration(),
            playerRef.current.getCurrentTime(),
          ])
            .then(([dur, time]) => {
              if (dur > 0) {
                setDuration(dur);
                console.log("Duration fetched on play:", dur);
              }
              setCurrentTime(time);
              console.log("Current time initialized:", time);
            })
            .catch((error: Error) => {
              console.error("Error fetching duration/time on play:", error);
            });
        }
      }
    },
    [musicSource, setPlaybackPlayingState],
  );

  const clearPlayer = useCallback(() => {
    if (isIOS && musicSource === "apple") {
      try {
        Player.pause();
      } catch {
        // no-op: safe best-effort pause
      }
    }

    if (musicSource === "spotify") {
      spotifyPlayer.pauseSilently();
    }

    clearAppleListeners();
    playerRef.current = null;
    setAlbumArt("");
    setSongTitle("");
    setArtist("");
    setYoutubeVideoId(null);
    setSongId(null);
    setSongUrl(null);
    setMusicSource("youtube");
    setAppleTrackId(null);
    setSpotifyTrackId(null);
    setTimedLyrics([]);
    setPlaybackPlayingState(false);
    setLyricsTimingOffsetMs(0);
    lyricsTimingSongKeyRef.current = null;
    setCurrentTime(0);
    setDuration(0);
    setIsPlayerExpanded(false);
    musicSourceRef.current = "youtube";
    appleTrackIdRef.current = null;
    spotifyTrackIdRef.current = null;
    youtubeVideoIdRef.current = null;
    currentTimeRef.current = 0;
    durationRef.current = 0;
    isPlayingRef.current = false;
    spotifyPlayer.clear();
  }, [
    clearAppleListeners,
    musicSource,
    setPlaybackPlayingState,
    spotifyPlayer,
  ]);

  useEffect(() => {
    return () => {
      clearAppleListeners();
    };
  }, [clearAppleListeners]);

  const value: MusicPlayerContextType = {
    albumArt,
    songTitle,
    artist,
    youtubeVideoId,
    songId,
    songUrl,
    musicSource,
    appleTrackId,
    spotifyTrackId,
    timedLyrics,
    lyricsTimingOffsetMs,
    isPlaying: isPlayingState,
    currentTime,
    duration,
    isPlayerExpanded,
    playerRef,
    setSongInfo,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setIsPlayerExpanded,
    togglePlayPause,
    skipForward,
    skipBackward,
    onStateChange,
    clearPlayer,
    setTimedLyrics,
    setLyricsTimingOffsetMs,
  };

  return (
    <MusicPlayerContext.Provider value={value}>
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const context = useContext(MusicPlayerContext);
  if (context === undefined) {
    throw new Error("useMusicPlayer must be used within a MusicPlayerProvider");
  }
  return context;
}
