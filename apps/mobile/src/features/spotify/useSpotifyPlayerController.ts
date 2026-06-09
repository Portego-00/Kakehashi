import { useCallback, useEffect, useMemo, useRef } from "react";
import { Alert, AppState, Linking } from "react-native";
import {
  SpotifyPlaybackError,
  type SpotifyPlaybackSnapshot,
  spotifyService,
} from "../../services/spotifyService";

const SPOTIFY_COMMAND_SETTLE_MS = 1800;
const SPOTIFY_REMOTE_SYNC_DELAY_MS = SPOTIFY_COMMAND_SETTLE_MS + 200;

export interface SpotifyPlayerHandle {
  seekTo: (seconds: number) => Promise<void>;
  getCurrentTime: () => Promise<number>;
  getDuration: () => Promise<number>;
}

interface SpotifyPlayerControllerOptions {
  trackId: string | null;
  trackUrl: string | null;
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
}

interface SpotifyTrackConfig {
  trackId: string | null;
  trackUrl: string | null;
  currentTime?: number;
  duration?: number;
  resetPlaybackState?: boolean;
}

export function useSpotifyPlayerController({
  trackId,
  trackUrl,
  currentTime,
  duration,
  isPlaying,
  setIsPlaying,
  setCurrentTime,
  setDuration,
}: SpotifyPlayerControllerOptions) {
  const trackIdRef = useRef<string | null>(trackId);
  const trackUrlRef = useRef<string | null>(trackUrl);
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const isPlayingRef = useRef(isPlaying);
  const startedTrackIdRef = useRef<string | null>(null);
  const commandInFlightRef = useRef(false);
  const queuedPlayingRef = useRef<boolean | null>(null);
  const desiredPlayingRef = useRef<boolean | null>(null);
  const commandSettleUntilRef = useRef(0);
  const desiredPositionSecondsRef = useRef<number | null>(null);
  const positionSettleUntilRef = useRef(0);
  const remoteSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    trackIdRef.current = trackId;
    trackUrlRef.current = trackUrl;
    currentTimeRef.current = currentTime;
    durationRef.current = duration;
    isPlayingRef.current = isPlaying;
  }, [currentTime, duration, isPlaying, trackId, trackUrl]);

  const setPlaybackPlayingState = useCallback(
    (playing: boolean) => {
      setIsPlaying(playing);
      isPlayingRef.current = playing;
    },
    [setIsPlaying],
  );

  const setPlaybackCurrentTime = useCallback(
    (time: number) => {
      setCurrentTime(time);
      currentTimeRef.current = time;
    },
    [setCurrentTime],
  );

  const setPlaybackDuration = useCallback(
    (nextDuration: number) => {
      setDuration(nextDuration);
      durationRef.current = nextDuration;
    },
    [setDuration],
  );

  const clearPendingRemoteSync = useCallback(() => {
    if (remoteSyncTimeoutRef.current) {
      clearTimeout(remoteSyncTimeoutRef.current);
      remoteSyncTimeoutRef.current = null;
    }
  }, []);

  const clearCommandSettle = useCallback(() => {
    desiredPlayingRef.current = null;
    commandSettleUntilRef.current = 0;
  }, []);

  const clearPositionSettle = useCallback(() => {
    desiredPositionSecondsRef.current = null;
    positionSettleUntilRef.current = 0;
  }, []);

  const clearCommandState = useCallback(() => {
    queuedPlayingRef.current = null;
    startedTrackIdRef.current = null;
    clearCommandSettle();
    clearPositionSettle();
    clearPendingRemoteSync();
  }, [clearCommandSettle, clearPendingRemoteSync, clearPositionSettle]);

  const getSettlingDesiredPlaying = useCallback(() => {
    const desiredPlaying = desiredPlayingRef.current;
    if (desiredPlaying === null) {
      return null;
    }

    if (Date.now() > commandSettleUntilRef.current) {
      clearCommandSettle();
      return null;
    }

    return desiredPlaying;
  }, [clearCommandSettle]);

  const setOptimisticPlaying = useCallback(
    (playing: boolean) => {
      desiredPlayingRef.current = playing;
      commandSettleUntilRef.current = Date.now() + SPOTIFY_COMMAND_SETTLE_MS;
      setPlaybackPlayingState(playing);
    },
    [setPlaybackPlayingState],
  );

  const getSettlingDesiredPosition = useCallback(() => {
    const desiredPositionSeconds = desiredPositionSecondsRef.current;
    if (desiredPositionSeconds === null) {
      return null;
    }

    if (Date.now() > positionSettleUntilRef.current) {
      clearPositionSettle();
      return null;
    }

    return desiredPositionSeconds;
  }, [clearPositionSettle]);

  const setOptimisticPosition = useCallback(
    (seconds: number) => {
      const nextPositionSeconds =
        durationRef.current > 0
          ? Math.min(Math.max(seconds, 0), durationRef.current)
          : Math.max(seconds, 0);

      desiredPositionSecondsRef.current = nextPositionSeconds;
      positionSettleUntilRef.current = Date.now() + SPOTIFY_COMMAND_SETTLE_MS;
      setPlaybackCurrentTime(nextPositionSeconds);
    },
    [setPlaybackCurrentTime],
  );

  const applyPlaybackSnapshot = useCallback(
    (snapshot: SpotifyPlaybackSnapshot | null) => {
      const settlingDesiredPlaying = getSettlingDesiredPlaying();
      const settlingDesiredPosition = getSettlingDesiredPosition();

      if (!snapshot) {
        setPlaybackPlayingState(settlingDesiredPlaying ?? false);
        return;
      }

      const expectedTrackId = trackIdRef.current;
      if (
        expectedTrackId &&
        snapshot.trackId &&
        snapshot.trackId !== expectedTrackId
      ) {
        setPlaybackPlayingState(settlingDesiredPlaying ?? false);
        return;
      }

      if (expectedTrackId && snapshot.trackId === expectedTrackId) {
        startedTrackIdRef.current = expectedTrackId;
      }

      const shouldKeepOptimisticState =
        settlingDesiredPlaying !== null &&
        snapshot.isPlaying !== settlingDesiredPlaying;
      const nextIsPlaying = shouldKeepOptimisticState
        ? settlingDesiredPlaying
        : snapshot.isPlaying;

      if (
        settlingDesiredPlaying !== null &&
        snapshot.isPlaying === settlingDesiredPlaying
      ) {
        clearCommandSettle();
      }

      setPlaybackPlayingState(nextIsPlaying);

      const snapshotPositionSeconds = snapshot.progressMs / 1000;
      const shouldKeepOptimisticPosition =
        settlingDesiredPosition !== null &&
        Math.abs(snapshotPositionSeconds - settlingDesiredPosition) > 1.25;

      if (settlingDesiredPosition !== null && !shouldKeepOptimisticPosition) {
        clearPositionSettle();
      }

      setPlaybackCurrentTime(
        shouldKeepOptimisticPosition
          ? settlingDesiredPosition
          : snapshotPositionSeconds,
      );

      if (snapshot.durationMs > 0) {
        setPlaybackDuration(snapshot.durationMs / 1000);
      }
    },
    [
      clearCommandSettle,
      clearPositionSettle,
      getSettlingDesiredPosition,
      getSettlingDesiredPlaying,
      setPlaybackCurrentTime,
      setPlaybackDuration,
      setPlaybackPlayingState,
    ],
  );

  const syncFromRemote = useCallback(async () => {
    try {
      const snapshot = await spotifyService.getCurrentPlayback();
      applyPlaybackSnapshot(snapshot);
    } catch (error) {
      console.error("Error reading Spotify playback state:", error);
    }
  }, [applyPlaybackSnapshot]);

  const scheduleRemoteSync = useCallback(
    (delayMs: number = SPOTIFY_REMOTE_SYNC_DELAY_MS) => {
      clearPendingRemoteSync();
      remoteSyncTimeoutRef.current = setTimeout(() => {
        remoteSyncTimeoutRef.current = null;
        void syncFromRemote();
      }, delayMs);
    },
    [clearPendingRemoteSync, syncFromRemote],
  );

  const showPlaybackError = useCallback(
    (error: unknown) => {
      const playbackError =
        error instanceof SpotifyPlaybackError
          ? error
          : new SpotifyPlaybackError(
              "PLAYBACK_FAILED",
              error instanceof Error ? error.message : String(error),
            );

      if (playbackError.code === "NO_ACTIVE_DEVICE") {
        Alert.alert(
          "Open Spotify",
          "Spotify needs an active player before Kakehashi can control playback. Open Spotify, let the song start playing, then come back to Kakehashi.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Spotify",
              onPress: () => {
                const spotifyTrackUri = trackIdRef.current
                  ? `spotify:track:${trackIdRef.current}`
                  : trackUrlRef.current;
                if (spotifyTrackUri) {
                  setOptimisticPlaying(true);
                  scheduleRemoteSync(2500);
                  Linking.openURL(spotifyTrackUri).catch((linkError) => {
                    console.error("Failed to open Spotify:", linkError);
                  });
                }
              },
            },
          ],
        );
        return;
      }

      Alert.alert("Spotify Playback", playbackError.message);
    },
    [scheduleRemoteSync, setOptimisticPlaying],
  );

  const syncExpectedPlayback = useCallback(async () => {
    const expectedTrackId = trackIdRef.current;
    if (!expectedTrackId) {
      return null;
    }

    try {
      const snapshot = await spotifyService.getCurrentPlayback();
      if (!snapshot || snapshot.trackId !== expectedTrackId) {
        return null;
      }

      applyPlaybackSnapshot(snapshot);
      return snapshot;
    } catch (remoteError) {
      console.error("Error checking Spotify playback state:", remoteError);
      return null;
    }
  }, [applyPlaybackSnapshot]);

  const showPlaybackErrorIfNeeded = useCallback(
    async (error: unknown) => {
      const expectedSnapshot = await syncExpectedPlayback();
      if (expectedSnapshot) {
        return;
      }

      showPlaybackError(error);
    },
    [showPlaybackError, syncExpectedPlayback],
  );

  const configureTrack = useCallback(
    ({
      trackId: nextTrackId,
      trackUrl: nextTrackUrl,
      currentTime: nextCurrentTime,
      duration: nextDuration,
      resetPlaybackState,
    }: SpotifyTrackConfig) => {
      trackIdRef.current = nextTrackId;
      trackUrlRef.current = nextTrackUrl;

      if (typeof nextCurrentTime === "number") {
        currentTimeRef.current = nextCurrentTime;
      }

      if (typeof nextDuration === "number") {
        durationRef.current = nextDuration;
      }

      if (resetPlaybackState) {
        clearCommandState();
        isPlayingRef.current = false;
      }
    },
    [clearCommandState],
  );

  const setPlaying = useCallback(
    async (playing: boolean) => {
      const expectedTrackId = trackIdRef.current;
      if (!expectedTrackId) {
        return;
      }

      setOptimisticPlaying(playing);

      if (commandInFlightRef.current) {
        queuedPlayingRef.current = playing;
        return;
      }

      commandInFlightRef.current = true;

      try {
        if (playing) {
          const snapshot = await spotifyService
            .getCurrentPlayback()
            .catch(() => null);
          const isRemoteOnExpectedTrack = snapshot?.trackId === expectedTrackId;
          const hasStartedExpectedTrack =
            startedTrackIdRef.current === expectedTrackId;

          if (isRemoteOnExpectedTrack && hasStartedExpectedTrack) {
            await spotifyService.resumePlayback();
          } else if (isRemoteOnExpectedTrack && snapshot?.isPlaying) {
            startedTrackIdRef.current = expectedTrackId;
          } else {
            const startPositionMs = Math.round(currentTimeRef.current * 1000);
            await spotifyService.playTrack(expectedTrackId, startPositionMs);
            startedTrackIdRef.current = expectedTrackId;
          }
        } else {
          await spotifyService.pausePlayback();
        }

        scheduleRemoteSync();
      } catch (error) {
        const expectedSnapshot = await syncExpectedPlayback();
        if (expectedSnapshot?.isPlaying === playing) {
          return;
        }

        if (playing) {
          clearCommandSettle();
          setPlaybackPlayingState(false);
        }
        console.error("Error controlling Spotify playback:", error);
        showPlaybackError(error);
      } finally {
        commandInFlightRef.current = false;
        const queuedPlaying = queuedPlayingRef.current;
        queuedPlayingRef.current = null;
        if (queuedPlaying !== null && queuedPlaying !== playing) {
          void setPlaying(queuedPlaying);
        }
      }
    },
    [
      clearCommandSettle,
      scheduleRemoteSync,
      setOptimisticPlaying,
      setPlaybackPlayingState,
      showPlaybackError,
      syncExpectedPlayback,
    ],
  );

  const skipForward = useCallback(async () => {
    const next =
      durationRef.current > 0
        ? Math.min(currentTimeRef.current + 10, durationRef.current)
        : currentTimeRef.current + 10;

    try {
      await spotifyService.seekToPosition(next * 1000);
      setOptimisticPosition(next);
      scheduleRemoteSync();
    } catch (error) {
      console.error("Error skipping Spotify forward:", error);
      await showPlaybackErrorIfNeeded(error);
    }
  }, [scheduleRemoteSync, setOptimisticPosition, showPlaybackErrorIfNeeded]);

  const skipBackward = useCallback(async () => {
    const next = Math.max(currentTimeRef.current - 10, 0);

    try {
      await spotifyService.seekToPosition(next * 1000);
      setOptimisticPosition(next);
      scheduleRemoteSync();
    } catch (error) {
      console.error("Error skipping Spotify backward:", error);
      await showPlaybackErrorIfNeeded(error);
    }
  }, [scheduleRemoteSync, setOptimisticPosition, showPlaybackErrorIfNeeded]);

  const pauseSilently = useCallback(() => {
    spotifyService.pausePlayback().catch(() => {});
  }, []);

  const clear = useCallback(() => {
    trackIdRef.current = null;
    trackUrlRef.current = null;
    currentTimeRef.current = 0;
    durationRef.current = 0;
    isPlayingRef.current = false;
    clearCommandState();
  }, [clearCommandState]);

  const playerHandle = useMemo<SpotifyPlayerHandle>(
    () => ({
      seekTo: async (seconds: number) => {
        const nextCurrentTime = Math.max(seconds, 0);
        await spotifyService.seekToPosition(nextCurrentTime * 1000);
        setOptimisticPosition(nextCurrentTime);
        scheduleRemoteSync();
      },
      getCurrentTime: async () => {
        const snapshot = await spotifyService.getCurrentPlayback();
        return snapshot?.progressMs ? snapshot.progressMs / 1000 : 0;
      },
      getDuration: async () => {
        const snapshot = await spotifyService.getCurrentPlayback();
        return snapshot?.durationMs ? snapshot.durationMs / 1000 : 0;
      },
    }),
    [scheduleRemoteSync, setOptimisticPosition],
  );

  useEffect(() => {
    if (!trackId) {
      return;
    }

    void syncFromRemote();

    if (!isPlaying) {
      return;
    }

    const interval = setInterval(() => {
      void syncFromRemote();
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isPlaying, syncFromRemote, trackId]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasAway =
        appStateRef.current === "inactive" ||
        appStateRef.current === "background";
      appStateRef.current = nextState;

      if (nextState === "active" && wasAway && trackIdRef.current) {
        void syncFromRemote();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [syncFromRemote]);

  useEffect(() => clear, [clear]);

  return useMemo(
    () => ({
      clear,
      configureTrack,
      pauseSilently,
      playerHandle,
      setPlaying,
      skipBackward,
      skipForward,
      syncFromRemote,
    }),
    [
      clear,
      configureTrack,
      pauseSilently,
      playerHandle,
      setPlaying,
      skipBackward,
      skipForward,
      syncFromRemote,
    ],
  );
}
