"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { LoaderCircle, Play, Square, VolumeX } from "lucide-react";
import styles from "../subjects.module.css";

type SubjectAudioStatus = "idle" | "loading" | "playing" | "error";

interface SubjectAudioState {
  key: string | null;
  status: SubjectAudioStatus;
}

interface SubjectAudioContextValue {
  playback: SubjectAudioState;
  toggle: (key: string, src: string) => void;
}

interface SubjectAudioButtonProps {
  audioKey: string;
  src?: string;
  label: string;
  variant: "pronunciation" | "scene";
  children?: ReactNode;
}

const IDLE_AUDIO_STATE: SubjectAudioState = { key: null, status: "idle" };
const SubjectAudioContext = createContext<SubjectAudioContextValue | null>(null);

export function SubjectAudioProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const requestIdRef = useRef(0);
  const playbackRef = useRef<SubjectAudioState>(IDLE_AUDIO_STATE);
  const [playback, setPlayback] = useState<SubjectAudioState>(IDLE_AUDIO_STATE);

  const updatePlayback = useCallback((next: SubjectAudioState) => {
    playbackRef.current = next;
    setPlayback(next);
  }, []);

  const clearPlayer = useCallback(() => {
    requestIdRef.current += 1;
    updatePlayback(IDLE_AUDIO_STATE);
    const player = audioRef.current;
    if (!player) return;
    player.pause();
    player.removeAttribute("src");
  }, [updatePlayback]);

  const toggle = useCallback((key: string, src: string) => {
    const current = playbackRef.current;
    if (current.key === key && (current.status === "loading" || current.status === "playing")) {
      clearPlayer();
      return;
    }

    const player = audioRef.current;
    if (!player) return;

    const requestId = ++requestIdRef.current;
    updatePlayback({ key, status: "loading" });
    if (current.key) player.pause();
    player.src = src;

    void player.play().then(() => {
      if (requestIdRef.current !== requestId || playbackRef.current.key !== key) return;
      updatePlayback({ key, status: "playing" });
    }).catch(() => {
      if (requestIdRef.current !== requestId || playbackRef.current.key !== key) return;
      updatePlayback({ key, status: "error" });
    });
  }, [clearPlayer, updatePlayback]);

  useEffect(() => () => {
    requestIdRef.current += 1;
    const current = playbackRef.current;
    playbackRef.current = IDLE_AUDIO_STATE;
    const player = audioRef.current;
    if (!player) return;
    if (current.key) player.pause();
    player.removeAttribute("src");
  }, []);

  return <SubjectAudioContext value={{ playback, toggle }}>
    {children}
    <audio
      ref={audioRef}
      className={styles.subjectAudioElement}
      preload="none"
      aria-hidden="true"
      data-subject-audio-player
      onPlaying={() => {
        const current = playbackRef.current;
        if (current.key) updatePlayback({ key: current.key, status: "playing" });
      }}
      onPause={() => {
        if (playbackRef.current.status !== "playing") return;
        requestIdRef.current += 1;
        updatePlayback(IDLE_AUDIO_STATE);
      }}
      onEnded={() => {
        requestIdRef.current += 1;
        audioRef.current?.removeAttribute("src");
        updatePlayback(IDLE_AUDIO_STATE);
      }}
      onError={() => {
        const current = playbackRef.current;
        if (!current.key) return;
        requestIdRef.current += 1;
        updatePlayback({ key: current.key, status: "error" });
      }}
    />
  </SubjectAudioContext>;
}

export function SubjectAudioButton({ audioKey, src, label, variant, children }: SubjectAudioButtonProps) {
  const player = useContext(SubjectAudioContext);
  if (!player) throw new Error("SubjectAudioButton must be rendered inside SubjectAudioProvider.");

  const status = player.playback.key === audioKey ? player.playback.status : "idle";
  const action = !src ? `Audio unavailable for ${label}` : status === "loading" ? `Loading ${label}` : status === "playing" ? `Stop ${label}` : status === "error" ? `Retry ${label}` : `Play ${label}`;
  const iconSize = variant === "scene" ? 16 : 20;

  return <button
    className={variant === "scene" ? styles.immersionPlayButton : styles.pronunciationAudioButton}
    type="button"
    aria-label={action}
    aria-busy={status === "loading"}
    aria-pressed={src ? status === "playing" : undefined}
    data-state={!src ? "unavailable" : status}
    disabled={!src || status === "loading"}
    title={status === "error" ? "Audio could not be played. Try again." : action}
    onClick={() => { if (src) player.toggle(audioKey, src); }}
  >
    {status === "loading" ? <LoaderCircle className={styles.subjectAudioSpinner} size={iconSize} aria-hidden /> : status === "playing" ? <Square size={iconSize - 2} fill="currentColor" aria-hidden /> : src ? <Play size={iconSize} fill="currentColor" aria-hidden /> : <VolumeX size={iconSize} aria-hidden />}
    {children}
  </button>;
}
