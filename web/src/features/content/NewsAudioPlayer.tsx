"use client";

import {
  LoaderCircle,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { formatTime } from "./ui";
import styles from "./content.module.css";

const SKIP_SECONDS = 10;

function mediaTime(seconds: number) {
  return formatTime(Number.isFinite(seconds) ? seconds * 1_000 : 0);
}

export function NewsAudioPlayer({ src, title }: { src: string; title: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const player = audioRef.current;
    return () => {
      if (player && !player.paused) player.pause();
    };
  }, [src]);

  const boundedDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const boundedPosition = Math.max(0, Math.min(position, boundedDuration || position));
  const progress = boundedDuration ? boundedPosition / boundedDuration : 0;

  function syncMetadata() {
    const player = audioRef.current;
    if (!player) return;
    setDuration(Number.isFinite(player.duration) && player.duration > 0 ? player.duration : 0);
    setPosition(Number.isFinite(player.currentTime) ? player.currentTime : 0);
  }

  async function togglePlayback() {
    const player = audioRef.current;
    if (!player) return;
    setError(false);
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      await player.play();
      setIsPlaying(true);
      setIsLoading(false);
    } catch {
      setIsPlaying(false);
      setIsLoading(false);
      setError(true);
    }
  }

  function seek(nextPosition: number) {
    const player = audioRef.current;
    if (!player || !boundedDuration) return;
    const next = Math.max(0, Math.min(nextPosition, boundedDuration));
    player.currentTime = next;
    setPosition(next);
  }

  function skip(seconds: number) {
    const player = audioRef.current;
    if (!player || !boundedDuration) return;
    seek(player.currentTime + seconds);
  }

  function toggleMute() {
    const player = audioRef.current;
    if (!player) return;
    player.muted = !player.muted;
    setIsMuted(player.muted);
  }

  return (
    <aside className={styles.newsAudioPlayer} aria-label="Article audio player">
      <audio
        ref={audioRef}
        className={styles.newsAudioElement}
        src={src}
        preload="metadata"
        aria-hidden="true"
        onLoadedMetadata={syncMetadata}
        onDurationChange={syncMetadata}
        onTimeUpdate={() => {
          const player = audioRef.current;
          if (player) setPosition(Number.isFinite(player.currentTime) ? player.currentTime : 0);
        }}
        onPlay={() => setIsPlaying(true)}
        onPlaying={() => {
          setIsPlaying(true);
          setIsLoading(false);
        }}
        onPause={() => {
          setIsPlaying(false);
          setIsLoading(false);
        }}
        onWaiting={() => setIsLoading(true)}
        onCanPlay={() => setIsLoading(false)}
        onVolumeChange={() => setIsMuted(Boolean(audioRef.current?.muted))}
        onEnded={() => {
          const player = audioRef.current;
          if (player) player.currentTime = 0;
          setPosition(0);
          setIsPlaying(false);
          setIsLoading(false);
        }}
        onError={() => {
          setError(true);
          setIsPlaying(false);
          setIsLoading(false);
        }}
      />

      <div className={styles.newsAudioHeader}>
        <div className={styles.newsAudioCopy}>
          <strong>NHK Easy audio</strong>
          <p lang="ja" title={title}>{title}</p>
        </div>
        <button
          className={styles.newsAudioMute}
          type="button"
          aria-label={isMuted ? "Unmute article audio" : "Mute article audio"}
          onClick={toggleMute}
        >
          {isMuted ? <VolumeX size={18} aria-hidden="true" /> : <Volume2 size={18} aria-hidden="true" />}
        </button>
      </div>

      <div className={styles.newsAudioTimeline}>
        <div className={styles.newsAudioSeekWrap}>
          <span className={styles.newsAudioTrack} aria-hidden="true">
            <i style={{ "--audio-progress": progress } as CSSProperties} />
          </span>
          <input
            className={styles.newsAudioSeek}
            type="range"
            aria-label="Audio progress"
            aria-valuetext={`${mediaTime(boundedPosition)} of ${boundedDuration ? mediaTime(boundedDuration) : "unknown"}`}
            min={0}
            max={boundedDuration || 1}
            step={0.1}
            value={Math.min(boundedPosition, boundedDuration || 1)}
            disabled={!boundedDuration || error}
            onChange={(event) => seek(Number(event.currentTarget.value))}
          />
        </div>
        <span className={styles.newsAudioTime}>
          {mediaTime(boundedPosition)} / {boundedDuration ? mediaTime(boundedDuration) : "--:--"}
        </span>
      </div>

      <div className={styles.newsAudioControls}>
        <button
          className={styles.newsAudioControl}
          type="button"
          aria-label="Rewind 10 seconds"
          disabled={!boundedDuration || error}
          onClick={() => skip(-SKIP_SECONDS)}
        >
          <RotateCcw size={18} aria-hidden="true" /><span>10</span>
        </button>
        <button
          className={styles.newsAudioPlay}
          type="button"
          aria-label={isPlaying ? "Pause article audio" : "Play article audio"}
          aria-busy={isLoading}
          onClick={() => void togglePlayback()}
        >
          {isLoading
            ? <LoaderCircle className={styles.spin} size={20} aria-hidden="true" />
            : isPlaying
              ? <Pause size={20} aria-hidden="true" />
              : <Play size={20} aria-hidden="true" />}
        </button>
        <button
          className={styles.newsAudioControl}
          type="button"
          aria-label="Forward 10 seconds"
          disabled={!boundedDuration || error}
          onClick={() => skip(SKIP_SECONDS)}
        >
          <RotateCw size={18} aria-hidden="true" /><span>10</span>
        </button>
      </div>

      {error ? (
        <p className={styles.newsAudioError} role="alert">
          Audio could not be played. <a href={src} target="_blank" rel="noreferrer">Open audio</a>
        </p>
      ) : null}
    </aside>
  );
}
