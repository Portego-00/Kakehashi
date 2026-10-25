"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { readYouGlishMessage, youGlishPlayerDocument, youGlishSearchUrl } from "../../../../../src/features/youglish/player";
import { useTheme } from "@/lib/theme";
import styles from "../media-context.module.css";

export function YouGlishContextPlayer({ query, onPlaybackStart }: { query: string; onPlaybackStart?: () => void }) {
  const { resolvedTheme } = useTheme();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const visibilityChanged = () => setVisible(!document.hidden);
    visibilityChanged();
    document.addEventListener("visibilitychange", visibilityChanged);
    return () => document.removeEventListener("visibilitychange", visibilityChanged);
  }, []);
  return visible ? <Player key={`${query}:${resolvedTheme}`} query={query} dark={resolvedTheme === "dark"} onPlaybackStart={onPlaybackStart} /> : null;
}

function Player({ query, dark, onPlaybackStart }: { query: string; dark: boolean; onPlaybackStart?: () => void }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [height, setHeight] = useState(440);
  // A data URL keeps vendor scripts on an opaque origin, away from app state.
  // allow-same-origin lets the nested YouGlish/YouTube frames use their own origins.
  const html = useMemo(() => youGlishPlayerDocument(query, dark), [query, dark]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const message = readYouGlishMessage(event.data);
      if (message?.type === "results") setStatus(message.value === 0 ? "empty" : "ready");
      else if (message?.type === "error") setStatus("error");
      else if (message?.type === "height" && message.value) setHeight(Math.min(1000, Math.max(300, message.value)));
      else if (message?.type === "playing") onPlaybackStart?.();
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onPlaybackStart]);
  useEffect(() => {
    if (status !== "loading") return;
    const timer = window.setTimeout(() => setStatus("error"), 25_000);
    return () => window.clearTimeout(timer);
  }, [attempt, status]);

  return <div className={styles.player}>
    {status === "loading" ? <p role="status">Loading YouGlish examples…</p> : null}
    {status === "error" || status === "empty" ? <div className={styles.fallback}>
      <p>{status === "empty" ? `No YouGlish examples found for “${query}”.` : "YouGlish could not load. Check your connection or open it in your browser."}</p>
      <button type="button" onClick={() => { setStatus("loading"); setAttempt((value) => value + 1); }}>Retry YouGlish</button>
    </div> : <iframe ref={frame} key={`${query}:${dark}:${attempt}`} src={`data:text/html;charset=utf-8,${encodeURIComponent(html)}`} title={`YouGlish Japanese examples for ${query}`} style={{ height }} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation" referrerPolicy="strict-origin-when-cross-origin" onError={() => setStatus("error")} />}
    <a href={youGlishSearchUrl(query)} target="_blank" rel="noopener noreferrer">Open in YouGlish ↗</a>
  </div>;
}
