import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSharedValue, withSpring } from "react-native-reanimated";
import { useMusicPlayer } from "../contexts/MusicPlayerContext";
import MiniPlayer from "./MiniPlayer";

export default function GlobalMiniPlayer() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useGlobalSearchParams();
  const {
    albumArt,
    songTitle,
    artist,
    youtubeVideoId,
    appleTrackId,
    musicSource,
    songId,
    songUrl,
    timedLyrics,
    lyricsTimingOffsetMs,
    isPlaying,
    currentTime,
    duration,
    playerRef,
    togglePlayPause,
    skipForward,
    skipBackward,
    onStateChange,
    setIsPlayerExpanded,
    isPlayerExpanded,
    setCurrentTime,
    setDuration,
    clearPlayer,
  } = useMusicPlayer();

  const previousPathnameRef = useRef<string>(pathname);
  const activeVideoIdRef = useRef<string | null>(youtubeVideoId ?? null);
  // Use translateY offset instead of bottom property (to work with native driver)
  // Negative values move up, positive move down
  const bottomOffsetAnim = useSharedValue(0);

  // Check if current path + params indicates we are in songs context
  const isCurrentInSongsContext = useMemo(() => {
    if (pathname.startsWith("/subject/")) {
      return params?.from === "song-lyrics" || params?.from === "mini-player";
    }
    return (
      pathname === "/songs" ||
      pathname === "/(tabs)/songs" ||
      pathname.startsWith("/song-lyrics")
    );
  }, [pathname, params]);

  // Track previous context state to handle transitions correctly
  const wasInSongsContextRef = useRef<boolean>(isCurrentInSongsContext);

  // Determine if we should show the player based on current route
  const shouldShowPlayer = useMemo(() => {
    // Show player if we have media loaded AND we're in the songs section
    if (!youtubeVideoId && !appleTrackId) return false;

    // console.log('Current pathname:', pathname, 'Has video:', !!youtubeVideoId, 'In context:', isCurrentInSongsContext);

    // Show in: songs tab, song-lyrics screen, or subject details (when navigated from songs context)
    return isCurrentInSongsContext;
  }, [youtubeVideoId, appleTrackId, isCurrentInSongsContext]);

  // Animate bottom offset based on current route
  // Negative values move the player UP (away from bottom)
  useEffect(() => {
    let targetOffset =
      pathname === "/songs" || pathname === "/(tabs)/songs" ? -60 : 0;

    // If expanded, always cover the bottom tab bar area (offset 0)
    if (isPlayerExpanded) {
      targetOffset = 0;
    }

    bottomOffsetAnim.value = withSpring(targetOffset, {
      stiffness: 100,
      damping: 18,
      mass: 1,
    });
  }, [pathname, isPlayerExpanded]);

  // Check if we're NOT on the lyrics screen (to show View Lyrics button)
  const showLyricsButton = useMemo(() => {
    return !pathname.startsWith("/song-lyrics");
  }, [pathname]);

  // Navigate to lyrics screen
  const handleNavigateToLyrics = useCallback(() => {
    if (!songId) return;

    router.push({
      pathname: "/song-lyrics",
      params: {
        songId,
        songTitle,
        artist,
        albumArt,
        songUrl: songUrl ?? "",
        musicSource,
      },
    });
  }, [
    router,
    songId,
    songUrl,
    songTitle,
    artist,
    albumArt,
    musicSource,
  ]);

  // Clear player when navigating to a different tab (not within songs context)
  useEffect(() => {
    const wasInSongsContext = wasInSongsContextRef.current;

    // If we were in songs context but navigated to a different tab, clear the player
    if (
      wasInSongsContext &&
      !isCurrentInSongsContext &&
      (youtubeVideoId || appleTrackId)
    ) {
      // Check if we're navigating to a different tab (tabs have /(tabs)/ in the path)
      const isTabChange =
        pathname.includes("/(tabs)/") &&
        previousPathnameRef.current.includes("/(tabs)/") &&
        pathname !== previousPathnameRef.current;

      if (isTabChange) {
        console.log("Navigated away from songs tab, clearing player");
        clearPlayer();
      }
    }

    previousPathnameRef.current = pathname;
    wasInSongsContextRef.current = isCurrentInSongsContext;
  }, [
    pathname,
    isCurrentInSongsContext,
    youtubeVideoId,
    appleTrackId,
    clearPlayer,
  ]);

  // Keep timing state deterministic when switching tracks/videos.
  useEffect(() => {
    activeVideoIdRef.current = youtubeVideoId ?? null;
    if (youtubeVideoId && musicSource !== "apple") {
      setCurrentTime(0);
      setDuration(0);
    }
  }, [youtubeVideoId, musicSource, setCurrentTime, setDuration]);

  // Fetch duration when video loads
  useEffect(() => {
    if (!youtubeVideoId || musicSource === "apple") {
      return;
    }

    let isCancelled = false;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;
    let attempts = 0;
    const maxAttempts = 24;

    const fetchDuration = async () => {
      if (isCancelled || activeVideoIdRef.current !== youtubeVideoId) return;
      if (!playerRef.current) {
        if (attempts >= maxAttempts) return;
        attempts += 1;
        retryTimeout = setTimeout(fetchDuration, 250);
        return;
      }

      try {
        const dur = await playerRef.current.getDuration();
        if (!isCancelled && activeVideoIdRef.current === youtubeVideoId && dur > 0) {
          setDuration(dur);
          console.log("Video duration loaded:", dur);
          return;
        }

        if (attempts >= maxAttempts) return;
        attempts += 1;
        retryTimeout = setTimeout(fetchDuration, 250);
      } catch {
        if (attempts >= maxAttempts) return;
        attempts += 1;
        retryTimeout = setTimeout(fetchDuration, 250);
      }
    };

    retryTimeout = setTimeout(fetchDuration, 350);

    return () => {
      isCancelled = true;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [youtubeVideoId, playerRef, setDuration, musicSource]);

  // Track video progress when playing
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let isMounted = true;

    const updateProgress = async () => {
      if (!isMounted || !youtubeVideoId || activeVideoIdRef.current !== youtubeVideoId) {
        return;
      }
      if (!playerRef.current) {
        return;
      }

      try {
        const [time, dur] = await Promise.all([
          playerRef.current.getCurrentTime(),
          playerRef.current.getDuration(),
        ]);
        if (isMounted && activeVideoIdRef.current === youtubeVideoId) {
          setCurrentTime(time);
          // Update duration if it changed or wasn't set
          if (dur > 0) {
            setDuration(dur);
          }
        }
      } catch {
        // Silently ignore errors, they happen when player isn't ready
      }
    };

    // Start tracking if we have a video and playback should be running.
    if (youtubeVideoId && isPlaying && musicSource !== "apple") {
      console.log("Starting progress tracking for video:", youtubeVideoId);

      // Immediate first update with small delay
      const initialTimeout = setTimeout(() => {
        updateProgress();
      }, 500);

      // Then update every 500ms for smoother updates
      interval = setInterval(updateProgress, 500);

      return () => {
        isMounted = false;
        clearTimeout(initialTimeout);
        if (interval) {
          clearInterval(interval);
        }
      };
    }

    return () => {
      isMounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [
    isPlaying,
    youtubeVideoId,
    playerRef,
    setCurrentTime,
    setDuration,
    musicSource,
  ]);

  return (
    <MiniPlayer
      visible={shouldShowPlayer}
      isPlaying={isPlaying}
      albumArt={albumArt}
      songTitle={songTitle}
      artist={artist}
      currentTime={currentTime}
      duration={duration}
      timedLyrics={timedLyrics}
      lyricsTimingOffsetMs={lyricsTimingOffsetMs}
      onPlayPause={togglePlayPause}
      onSkipBackward={skipBackward}
      onSkipForward={skipForward}
      onStateChange={onStateChange}
      playerRef={playerRef}
      videoId={youtubeVideoId || undefined}
      mediaSource={musicSource}
      trackUrl={songUrl || undefined}
      onExpandChange={setIsPlayerExpanded}
      bottomOffsetTransform={bottomOffsetAnim}
      onNavigateToLyrics={handleNavigateToLyrics}
      showLyricsButton={showLyricsButton}
    />
  );
}
