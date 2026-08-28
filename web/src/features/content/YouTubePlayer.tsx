"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import styles from "./content.module.css";

interface YouTubePlayerApi {
  destroy(): void;
  getCurrentTime(): number;
  getDuration(): number;
  pauseVideo(): void;
  playVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
}

interface YouTubePlayerEvent { data: number }
interface YouTubeNamespace {
  Player: new (element: HTMLElement, options: {
    videoId: string;
    host?: string;
    playerVars: Record<string, string | number>;
    events: {
      onReady: () => void;
      onStateChange: (event: YouTubePlayerEvent) => void;
      onError: () => void;
    };
  }) => YouTubePlayerApi;
}

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export interface YouTubePlayerHandle {
  pause(): void;
  play(): void;
  seekTo(milliseconds: number): void;
}

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise<YouTubeNamespace>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT?.Player) resolve(window.YT);
      else reject(new Error("YouTube player API did not initialize."));
    };
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (existing) {
      existing.addEventListener("error", () => reject(new Error("YouTube player API could not be loaded.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("YouTube player API could not be loaded."));
    document.head.append(script);
  }).catch((error) => {
    youtubeApiPromise = null;
    throw error;
  });
  return youtubeApiPromise;
}

export const YouTubePlayer = forwardRef<YouTubePlayerHandle, {
  videoId: string;
  title: string;
  onPlayingChange: (playing: boolean) => void;
  onTimeChange: (elapsedMs: number, durationMs: number) => void;
}>(function YouTubePlayer({ videoId, title, onPlayingChange, onTimeChange }, ref) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerApi | null>(null);
  const [failed, setFailed] = useState(false);

  useImperativeHandle(ref, () => ({
    pause: () => playerRef.current?.pauseVideo(),
    play: () => playerRef.current?.playVideo(),
    seekTo: (milliseconds) => playerRef.current?.seekTo(Math.max(0, milliseconds) / 1_000, true),
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    let disposed = false;
    let timer: number | null = null;
    const fail = () => {
      if (disposed) return;
      if (timer !== null) {
        window.clearInterval(timer);
        timer = null;
      }
      try { playerRef.current?.destroy(); }
      catch { /* The iframe may already have torn itself down. */ }
      playerRef.current = null;
      onPlayingChange(false);
      setFailed(true);
    };
    setFailed(false);
    void loadYouTubeApi().then((youtube) => {
      if (disposed || !host) return;
      const mount = document.createElement("div");
      mount.style.width = "100%";
      mount.style.height = "100%";
      host.replaceChildren(mount);
      let ready = false;
      const player = new youtube.Player(mount, {
        videoId,
        host: "https://www.youtube-nocookie.com",
        playerVars: { playsinline: 1, rel: 0, origin: window.location.origin },
        events: {
          onReady: () => {
            if (disposed) return;
            ready = true;
            onTimeChange(player.getCurrentTime() * 1_000, player.getDuration() * 1_000);
          },
          onStateChange: (event) => {
            if (disposed) return;
            onPlayingChange(event.data === 1);
            if (event.data === 0) onTimeChange(player.getDuration() * 1_000, player.getDuration() * 1_000);
          },
          onError: fail,
        },
      });
      playerRef.current = player;
      timer = window.setInterval(() => {
        if (!ready || disposed) return;
        try { onTimeChange(player.getCurrentTime() * 1_000, player.getDuration() * 1_000); }
        catch { /* The player can briefly be unavailable while changing state. */ }
      }, 400);
    }).catch(fail);
    return () => {
      disposed = true;
      if (timer !== null) window.clearInterval(timer);
      playerRef.current?.destroy();
      playerRef.current = null;
      host?.replaceChildren();
      onPlayingChange(false);
    };
  }, [videoId, onPlayingChange, onTimeChange]);

  return (
    <div className={styles.videoShell} aria-label={title}>
      {failed ? (
        <iframe
          className={styles.video}
          src={`https://www.youtube-nocookie.com/embed/${videoId}`}
          title={title}
          allow="accelerometer; autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      ) : <div className={styles.videoPlayer} ref={hostRef} />}
    </div>
  );
});
