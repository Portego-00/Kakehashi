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
import { TimedLyricsLine } from "../services/lyricsService";

type MusicSource = "spotify" | "apple";

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
  undefined
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
  const [musicSource, setMusicSource] = useState<MusicSource>("spotify");
  const [appleTrackId, setAppleTrackId] = useState<string | null>(null);

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
  const lyricsTimingSongKeyRef = useRef<string | null>(null);

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

  const updateAppleStateFromNative = useCallback(async () => {
    if (!isIOS) return;

    try {
      const state = await Player.getCurrentState();
      setCurrentTime(state?.playbackTime ?? 0);
      setIsPlayingState(isPlayingStatus(state?.playbackStatus));

      const nextDuration = normalizeDurationSeconds(state?.currentSong?.duration);
      if (nextDuration > 0) {
        setDuration(nextDuration);
      }
    } catch (error) {
      console.error("Error reading Apple Music playback state:", error);
    }
  }, []);

  const setupAppleListeners = useCallback(() => {
    if (!isIOS) return;

    clearAppleListeners();

    const playbackStateListener = Player.addListener(
      "onPlaybackStateChange",
      (state: any) => {
        if (typeof state?.playbackTime === "number") {
          setCurrentTime(state.playbackTime);
        }

        setIsPlayingState(isPlayingStatus(state?.playbackStatus));

        const nextDuration = normalizeDurationSeconds(state?.currentSong?.duration);
        if (nextDuration > 0) {
          setDuration(nextDuration);
        }
      }
    );

    const playbackTimeListener = Player.addListener(
      "onPlaybackTimeUpdate",
      (state: any) => {
        if (typeof state?.playbackTime === "number") {
          setCurrentTime(state.playbackTime);
        }
      }
    );

    const currentSongListener = Player.addListener(
      "onCurrentSongChange",
      (song: any) => {
        const nextDuration = normalizeDurationSeconds(song?.duration);
        if (nextDuration > 0) {
          setDuration(nextDuration);
        }
      }
    );

    appleListenersRef.current = [
      playbackStateListener,
      playbackTimeListener,
      currentSongListener,
    ];
  }, [clearAppleListeners]);

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
    [clearAppleListeners, setupAppleListeners, updateAppleStateFromNative]
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
      lyricsTimingOffsetMs?: number;
    }) => {
      const source = info.musicSource || "spotify";
      const nextAppleTrackId = source === "apple" ? info.songId || null : null;
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
      setSongId(info.songId || null);
      setSongUrl(info.songUrl || null);
      setMusicSource(source);
      setAppleTrackId(nextAppleTrackId);
      setYoutubeVideoId(source === "apple" ? null : info.youtubeVideoId);
      setTimedLyrics([]);
      setIsPlayingState(false);
      setCurrentTime(0);
      setDuration(0);

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
      playerRef.current = null;

      // Try to load video and lyrics from cache if not provided
      if (info.songTitle && info.artist) {
        const cacheKeyBase = `wanikani_lyrics_v1_${info.songTitle.replace(
          /\s+/g,
          ""
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
              console.error("Error loading cached video in context", err)
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
                  "lines"
                );
                setTimedLyrics(cachedLyrics.timedLyrics);
              }
            }
          })
          .catch((err: any) =>
            console.error("Error loading cached lyrics in context", err)
          );
      }
    },
    [clearAppleListeners, loadAppleTrack]
  );

  const setIsPlaying = useCallback(
    (playing: boolean) => {
      if (musicSource === "apple") {
        if (!isIOS) return;

        try {
          if (playing) {
            Player.play();
          } else {
            Player.pause();
          }
          setIsPlayingState(playing);
        } catch (error) {
          console.error("Error controlling Apple Music playback:", error);
        }
        return;
      }

      setIsPlayingState(playing);
    },
    [musicSource]
  );

  const togglePlayPause = useCallback(() => {
    setIsPlaying(!isPlayingState);
  }, [isPlayingState, setIsPlaying]);

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
      } catch (error) {
        console.error("Error skipping Apple Music forward:", error);
      }
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
  }, [musicSource]);

  const skipBackward = useCallback(async () => {
    if (musicSource === "apple") {
      if (!isIOS) return;

      try {
        const state = await Player.getCurrentState();
        const current = state?.playbackTime ?? 0;
        const next = Math.max(current - 10, 0);
        Player.seekToTime(next);
        setCurrentTime(next);
      } catch (error) {
        console.error("Error skipping Apple Music backward:", error);
      }
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
  }, [musicSource]);

  const onStateChange = useCallback(
    (state: string) => {
      if (musicSource === "apple") return;

      console.log("YouTube player state changed to:", state);
      if (state === "ended" || state === "paused") {
        setIsPlayingState(false);
      } else if (state === "playing") {
        setIsPlayingState(true);

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
    [musicSource]
  );

  const clearPlayer = useCallback(() => {
    if (isIOS && musicSource === "apple") {
      try {
        Player.pause();
      } catch {
        // no-op: safe best-effort pause
      }
    }

    clearAppleListeners();
    playerRef.current = null;
    setAlbumArt("");
    setSongTitle("");
    setArtist("");
    setYoutubeVideoId(null);
    setSongId(null);
    setSongUrl(null);
    setMusicSource("spotify");
    setAppleTrackId(null);
    setTimedLyrics([]);
    setLyricsTimingOffsetMs(0);
    lyricsTimingSongKeyRef.current = null;
    setIsPlayingState(false);
    setCurrentTime(0);
    setDuration(0);
    setIsPlayerExpanded(false);
  }, [clearAppleListeners, musicSource]);

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
