"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, BookOpenText, Captions, Film, Link2, Trash2, Upload } from "lucide-react";
import { JapaneseReader, type JapaneseReaderAnalysisContext } from "./JapaneseReader";
import { YouTubePlayer, type YouTubePlayerHandle } from "./YouTubePlayer";
import { transcodeMpegToMp4 } from "./mpeg-converter";
import { findCueAt, parseSrt } from "./parsers";
import { ContentPage, EmptyState, Progress, UndoNotice, formatTime } from "./ui";
import { createLocalId, deleteRecord, loadAsset, loadLibrary, upsertRecord } from "./storage";
import type { ContentRecord, SubtitleCue } from "./types";
import { useDelayedDeletion } from "./useDelayedDeletion";
import { useFirstContentReveal } from "./useFirstContentReveal";
import styles from "./content.module.css";

type ResolvedVideoSource =
  | { kind: "native"; url: string }
  | { kind: "youtube"; videoId: string };

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"]);
const MPEG_FILE_PATTERN = /\.(?:mpe?g|mpg)$/i;
const JPDB_SUBTITLE_CHUNK_LIMIT = 30_000;

function buildSubtitleAnalysisContexts(cues: readonly SubtitleCue[]) {
  const contexts = new Map<string, JapaneseReaderAnalysisContext>();
  let chunkText = "";
  let chunkCues: Array<{ id: string; start: number }> = [];

  function commitChunk() {
    for (const cue of chunkCues) contexts.set(cue.id, { text: chunkText, start: cue.start });
    chunkText = "";
    chunkCues = [];
  }

  for (const cue of cues) {
    if (cue.text.length > JPDB_SUBTITLE_CHUNK_LIMIT) {
      commitChunk();
      contexts.set(cue.id, { text: cue.text.slice(0, JPDB_SUBTITLE_CHUNK_LIMIT), start: 0 });
      continue;
    }
    const separator = chunkText ? "\n\n" : "";
    if (chunkText && chunkText.length + separator.length + cue.text.length > JPDB_SUBTITLE_CHUNK_LIMIT) {
      commitChunk();
    }
    const nextSeparator = chunkText ? "\n\n" : "";
    const start = chunkText.length + nextSeparator.length;
    chunkText += `${nextSeparator}${cue.text}`;
    chunkCues.push({ id: cue.id, start });
  }
  commitChunk();
  return contexts;
}

function metadataText(record: ContentRecord, key: string) {
  const value = record.metadata?.[key];
  return typeof value === "string" ? value : "";
}

function videoSourceType(record: ContentRecord) {
  const sourceType = metadataText(record, "sourceType");
  if (sourceType === "url" || sourceType === "youtube" || sourceType === "local") return sourceType;
  if (metadataText(record, "youtubeId")) return "youtube";
  if (metadataText(record, "videoUrl")) return "url";
  return "local";
}

function youtubeIdFromUrl(url: URL) {
  if (!YOUTUBE_HOSTS.has(url.hostname.toLocaleLowerCase())) return null;
  const host = url.hostname.toLocaleLowerCase();
  const pathParts = url.pathname.split("/").filter(Boolean);
  const candidate = host.endsWith("youtu.be")
    ? pathParts[0]
    : url.searchParams.get("v") || (["embed", "shorts", "live"].includes(pathParts[0] || "") ? pathParts[1] : null);
  return candidate && /^[A-Za-z0-9_-]{6,20}$/.test(candidate) ? candidate : null;
}

function titleFromVideoUrl(url: URL) {
  const fileName = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) || "");
  const withoutExtension = fileName.replace(/\.[a-z0-9]{2,5}$/i, "").trim();
  return withoutExtension || url.hostname.replace(/^www\./, "") || "Video";
}

function formatSource(record: ContentRecord) {
  const sourceType = videoSourceType(record);
  if (sourceType === "youtube") return "YouTube";
  if (sourceType === "url") {
    try { return new URL(metadataText(record, "videoUrl")).hostname.replace(/^www\./, ""); }
    catch { return "Video URL"; }
  }
  return record.fileName || "Local file";
}

function isMpegMedia(record: ContentRecord, blob: Blob) {
  const blobName = "name" in blob && typeof blob.name === "string" ? blob.name : "";
  return MPEG_FILE_PATTERN.test(blobName || record.fileName || "")
    || /(?:^|\/)x?-?mpeg$/i.test(blob.type || record.mimeType || "");
}

export function VideoWorkspace() {
  const firstLibraryReveal = useFirstContentReveal();
  const [videos, setVideos] = useState<ContentRecord[]>(() => loadLibrary("video"));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localVideoUrls, setLocalVideoUrls] = useState<Record<string, string>>({});
  const [urlInput, setUrlInput] = useState("");
  const [legacySubtitleText, setLegacySubtitleText] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [message, setMessage] = useState("");
  const [mpegConversion, setMpegConversion] = useState<{ videoId: string; percent: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubeRef = useRef<YouTubePlayerHandle>(null);
  const localMedia = useRef(new Map<string, { blob: Blob; url: string }>());
  const convertingMpegIds = useRef(new Set<string>());
  const convertedMpegIds = useRef(new Set<string>());
  const cueRefs = useRef(new Map<string, HTMLElement>());
  const transcriptRef = useRef<HTMLDivElement>(null);
  const lastSavedSecond = useRef(-1);
  const activeVideo = videos.find((video) => video.id === activeId) ?? null;
  const activeSourceType = activeVideo ? videoSourceType(activeVideo) : null;
  const activeYoutubeId = activeVideo ? metadataText(activeVideo, "youtubeId") : "";
  const activeVideoUrl = activeVideo ? metadataText(activeVideo, "videoUrl") : "";
  const subtitleAssetId = activeVideo ? metadataText(activeVideo, "subtitleAssetId") : "";
  const legacyVideoAssetId = activeVideo?.assetIds.find((assetId) => assetId !== subtitleAssetId) ?? "";
  const localVideoUrl = activeId ? localVideoUrls[activeId] || "" : "";
  const resolvedSource = useMemo<ResolvedVideoSource | null>(() => {
    if (activeSourceType === "youtube") return activeYoutubeId ? { kind: "youtube", videoId: activeYoutubeId } : null;
    if (activeSourceType === "url") return activeVideoUrl ? { kind: "native", url: activeVideoUrl } : null;
    return localVideoUrl ? { kind: "native", url: localVideoUrl } : null;
  }, [activeSourceType, activeVideoUrl, activeYoutubeId, localVideoUrl]);
  const cues = useMemo(() => parseSrt(activeVideo?.text || legacySubtitleText), [activeVideo?.text, legacySubtitleText]);
  const sortedCues = useMemo(() => cues.toSorted((left, right) => left.startMs - right.startMs), [cues]);
  const subtitleAnalysisContexts = useMemo(() => buildSubtitleAnalysisContexts(sortedCues), [sortedCues]);
  const activeCue = useMemo(() => {
    const matched = findCueAt(sortedCues, elapsedMs);
    if (matched) return matched;
    return sortedCues.findLast((cue) => elapsedMs >= cue.startMs) ?? sortedCues[0] ?? null;
  }, [elapsedMs, sortedCues]);
  const activeSubtitleAnalysis = activeCue ? subtitleAnalysisContexts.get(activeCue.id) : undefined;

  const deletion = useDelayedDeletion<ContentRecord>({
    onCommit: async (record) => {
      await deleteRecord(record);
      const media = localMedia.current.get(record.id);
      if (media) URL.revokeObjectURL(media.url);
      localMedia.current.delete(record.id);
      convertingMpegIds.current.delete(record.id);
      convertedMpegIds.current.delete(record.id);
    },
    onError: () => {
      setVideos(loadLibrary("video"));
      setMessage("The video could not be removed from browser history, so it was restored.");
    },
  });

  useEffect(() => {
    if (!activeId || activeVideo?.text || !subtitleAssetId) return;
    let cancelled = false;
    void loadAsset(subtitleAssetId).then(async (subtitleAsset) => {
      if (!cancelled && subtitleAsset) setLegacySubtitleText(await subtitleAsset.text());
    }).catch(() => {
      if (!cancelled) setMessage("The saved subtitle file could not be opened. You can select the SRT again.");
    });
    return () => { cancelled = true; };
  }, [activeId, activeVideo?.text, subtitleAssetId]);

  useEffect(() => {
    if (!activeId || activeSourceType !== "local" || localMedia.current.has(activeId) || !legacyVideoAssetId) return;
    let cancelled = false;
    void loadAsset(legacyVideoAssetId).then((videoAsset) => {
      if (cancelled || !videoAsset) return;
      const url = URL.createObjectURL(videoAsset);
      localMedia.current.set(activeId, { blob: videoAsset, url });
      setLocalVideoUrls((current) => ({ ...current, [activeId]: url }));
    }).catch(() => {
      if (!cancelled) setMessage("The old saved copy could not be opened. Select the original video file to reconnect it.");
    });
    return () => { cancelled = true; };
  }, [activeId, activeSourceType, legacyVideoAssetId]);

  useEffect(() => {
    const media = localMedia.current;
    return () => media.forEach(({ url }) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    const viewport = transcriptRef.current;
    const node = activeCue ? cueRefs.current.get(activeCue.id) : null;
    if (!viewport || !node) return;
    const top = Math.max(0, node.offsetTop - Math.max(0, (viewport.clientHeight - node.clientHeight) / 2));
    if (typeof viewport.scrollTo === "function") viewport.scrollTo({ top, behavior: "smooth" });
    else viewport.scrollTop = top;
  }, [activeCue]);

  function activateVideo(record: ContentRecord) {
    const savedTime = Number(record.metadata?.currentTime || 0);
    const savedDuration = Number(record.metadata?.duration || 0);
    setMessage("");
    setLegacySubtitleText("");
    setElapsedMs(Number.isFinite(savedTime) ? savedTime * 1_000 : 0);
    setDurationMs(Number.isFinite(savedDuration) ? savedDuration * 1_000 : 0);
    setPlaying(false);
    setMpegConversion(null);
    lastSavedSecond.current = -1;
    setActiveId(record.id);
  }

  function importVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("");
    const now = new Date().toISOString();
    const record: ContentRecord = {
      id: createLocalId("video"),
      kind: "video",
      title: file.name.replace(/\.[^.]+$/, "") || file.name,
      fileName: file.name,
      mimeType: file.type,
      assetIds: [],
      createdAt: now,
      updatedAt: now,
      progress: 0,
      metadata: { sourceType: "local", fileSize: file.size, lastModified: file.lastModified },
    };
    const objectUrl = URL.createObjectURL(file);
    localMedia.current.set(record.id, { blob: file, url: objectUrl });
    try {
      setVideos(upsertRecord(record));
      setLocalVideoUrls((current) => ({ ...current, [record.id]: objectUrl }));
      activateVideo(record);
    } catch (error) {
      localMedia.current.delete(record.id);
      URL.revokeObjectURL(objectUrl);
      setMessage(error instanceof Error ? error.message : "The video could not be added to browser history.");
    } finally {
      event.target.value = "";
    }
  }

  function addVideoUrl(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlInput.trim());
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
    } catch {
      setMessage("Enter a complete http or https video URL.");
      return;
    }

    const normalizedUrl = parsedUrl.toString();
    const existing = videos.find((record) => metadataText(record, "videoUrl") === normalizedUrl);
    if (existing) {
      activateVideo(existing);
      setUrlInput("");
      return;
    }

    const youtubeId = youtubeIdFromUrl(parsedUrl);
    const now = new Date().toISOString();
    const record: ContentRecord = {
      id: createLocalId("video"),
      kind: "video",
      title: youtubeId ? "YouTube video" : titleFromVideoUrl(parsedUrl),
      fileName: normalizedUrl,
      mimeType: youtubeId ? "video/youtube" : "video/url",
      assetIds: [],
      createdAt: now,
      updatedAt: now,
      progress: 0,
      metadata: {
        sourceType: youtubeId ? "youtube" : "url",
        videoUrl: normalizedUrl,
        youtubeId: youtubeId || null,
      },
    };
    try {
      setVideos(upsertRecord(record));
      activateVideo(record);
      setUrlInput("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The video URL could not be added.");
    }
  }

  function reconnectVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !activeVideo) return;
    const previous = localMedia.current.get(activeVideo.id);
    if (previous) URL.revokeObjectURL(previous.url);
    const url = URL.createObjectURL(file);
    localMedia.current.set(activeVideo.id, { blob: file, url });
    convertedMpegIds.current.delete(activeVideo.id);
    setLocalVideoUrls((current) => ({ ...current, [activeVideo.id]: url }));
    setMessage("");
    event.target.value = "";
  }

  async function importSubtitles(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !activeVideo) return;
    setMessage("");
    try {
      const text = await file.text();
      const parsed = parseSrt(text);
      if (!parsed.length) throw new Error("No valid subtitle cues were found in that SRT file.");
      const oldSubtitleAssetId = metadataText(activeVideo, "subtitleAssetId");
      const updated: ContentRecord = {
        ...activeVideo,
        text,
        assetIds: activeVideo.assetIds.filter((id) => id !== oldSubtitleAssetId),
        metadata: { ...activeVideo.metadata, subtitleAssetId: null, subtitleFileName: file.name },
        updatedAt: new Date().toISOString(),
      };
      setVideos(upsertRecord(updated));
      setLegacySubtitleText("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Subtitles could not be imported.");
    } finally {
      event.target.value = "";
    }
  }

  const updatePlayback = useCallback((nextElapsedMs: number, nextDurationMs: number) => {
    setElapsedMs(nextElapsedMs);
    if (nextDurationMs > 0) setDurationMs(nextDurationMs);
    if (!activeId || nextDurationMs <= 0) return;
    const currentSecond = Math.floor(nextElapsedMs / 1_000);
    if (currentSecond % 5 !== 0 || currentSecond === lastSavedSecond.current) return;
    lastSavedSecond.current = currentSecond;
    const stored = loadLibrary("video").find((record) => record.id === activeId);
    if (!stored) return;
    const updated: ContentRecord = {
      ...stored,
      progress: Math.max(0, Math.min(1, nextElapsedMs / nextDurationMs)),
      metadata: { ...stored.metadata, currentTime: nextElapsedMs / 1_000, duration: nextDurationMs / 1_000 },
      updatedAt: new Date().toISOString(),
    };
    try { setVideos(upsertRecord(updated)); }
    catch { setMessage("Playback continues, but progress could not be saved in this browser."); }
  }, [activeId]);

  const handleYouTubeTime = useCallback((nextElapsedMs: number, nextDurationMs: number) => {
    updatePlayback(nextElapsedMs, nextDurationMs);
  }, [updatePlayback]);
  const handleYouTubePlaying = useCallback((nextPlaying: boolean) => setPlaying(nextPlaying), []);

  function handleNativeTime() {
    const player = videoRef.current;
    if (!player) return;
    updatePlayback(player.currentTime * 1_000, Number.isFinite(player.duration) ? player.duration * 1_000 : 0);
  }

  async function handleNativeError() {
    if (!activeVideo) return;
    if (videoSourceType(activeVideo) === "url") {
      setMessage("This address could not be played directly. Use a URL that points to a video file or a YouTube link.");
      return;
    }

    const videoId = activeVideo.id;
    const sourceMedia = localMedia.current.get(videoId);
    const canConvert = sourceMedia
      && isMpegMedia(activeVideo, sourceMedia.blob)
      && !convertedMpegIds.current.has(videoId);
    if (!canConvert) {
      setMessage("This browser could not play the selected video format.");
      return;
    }
    if (convertingMpegIds.current.has(videoId)) return;

    convertingMpegIds.current.add(videoId);
    setMessage("");
    setMpegConversion({ videoId, percent: 0 });
    try {
      const converted = await transcodeMpegToMp4(sourceMedia.blob, (progress) => {
        if (localMedia.current.get(videoId) !== sourceMedia) return;
        const percent = Math.round(progress * 100);
        setMpegConversion((current) => (
          current?.videoId === videoId && current.percent === percent
            ? current
            : { videoId, percent }
        ));
      });
      if (localMedia.current.get(videoId) !== sourceMedia) return;
      const convertedUrl = URL.createObjectURL(converted);
      URL.revokeObjectURL(sourceMedia.url);
      localMedia.current.set(videoId, { blob: sourceMedia.blob, url: convertedUrl });
      convertedMpegIds.current.add(videoId);
      setLocalVideoUrls((current) => ({ ...current, [videoId]: convertedUrl }));
    } catch (error) {
      console.error("Local MPEG conversion failed", error);
      if (localMedia.current.get(videoId) === sourceMedia) {
        setMessage("This MPEG could not be prepared for playback on this device. Try an MP4 or WebM version instead.");
      }
    } finally {
      convertingMpegIds.current.delete(videoId);
      setMpegConversion((current) => current?.videoId === videoId ? null : current);
    }
  }

  function seek(cue: SubtitleCue) {
    const targetMs = cue.startMs;
    setElapsedMs(targetMs);
    if (resolvedSource?.kind === "youtube") {
      youtubeRef.current?.seekTo(targetMs);
      youtubeRef.current?.play();
      return;
    }
    const player = videoRef.current;
    if (!player) return;
    player.currentTime = targetMs / 1_000;
    void player.play().catch(() => undefined);
  }

  function openVideo(record: ContentRecord) {
    activateVideo(record);
  }

  function returnHome() {
    if (resolvedSource?.kind === "youtube") youtubeRef.current?.pause();
    else videoRef.current?.pause();
    setMessage("");
    setLegacySubtitleText("");
    setElapsedMs(0);
    setDurationMs(0);
    setPlaying(false);
    setMpegConversion(null);
    setActiveId(null);
  }

  function removeVideo(record: ContentRecord) {
    deletion.requestDeletion(record);
    setVideos((current) => current.filter((item) => item.id !== record.id));
  }

  return (
    <ContentPage variant="media" className={styles.videoPage}>
      {activeVideo ? (
        <div className={styles.videoScreen}>
          <header className={styles.videoTopbar}>
            <button className={styles.backButton} type="button" onClick={returnHome}><ArrowLeft size={18} aria-hidden="true" />Back to videos</button>
            <div className={styles.videoIdentity}><h1>{activeVideo.title}</h1><p>{formatSource(activeVideo)}</p></div>
          </header>

          {mpegConversion?.videoId === activeVideo.id ? (
            <p className={styles.videoConversionNotice} role="status" aria-live="polite">
              Preparing MPEG for playback on this device — {mpegConversion.percent}%. The video stays on this device.
            </p>
          ) : message ? <p className={styles.notice} role="alert">{message}</p> : null}

          <div className={styles.videoStage}>
            <section className={styles.playerColumn} aria-label="Video player">
              {resolvedSource?.kind === "youtube" ? (
                <YouTubePlayer ref={youtubeRef} videoId={resolvedSource.videoId} title={`Playback for ${activeVideo.title}`} onPlayingChange={handleYouTubePlaying} onTimeChange={handleYouTubeTime} />
              ) : resolvedSource?.kind === "native" ? (
                <video
                  ref={videoRef}
                  className={styles.video}
                  src={resolvedSource.url}
                  aria-label={`Playback for ${activeVideo.title}`}
                  controls
                  preload="metadata"
                  onLoadedMetadata={() => {
                    const player = videoRef.current;
                    const saved = Number(activeVideo.metadata?.currentTime || 0);
                    if (!player) return;
                    if (saved > 0 && saved < player.duration) player.currentTime = saved;
                    setDurationMs(Number.isFinite(player.duration) ? player.duration * 1_000 : 0);
                  }}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={handleNativeTime}
                  onEnded={() => setPlaying(false)}
                  onError={() => void handleNativeError()}
                />
              ) : (
                <div className={styles.videoEmpty}>
                  <strong>Select the original video file</strong>
                  <p>For privacy, Kakehashi keeps only your watch history—not a copy of the video. Reconnect the file to continue.</p>
                  <label className={styles.secondaryButton}>Choose file<input className={styles.fileInput} type="file" accept="video/*,.mp4,.webm,.mov,.m4v,.mpeg,.mpg,.mpe" onChange={reconnectVideo} /></label>
                </div>
              )}
              <div className={styles.videoPlayerMeta}>
                <span>{playing ? "Playing" : "Paused"}</span>
                <span>{formatTime(elapsedMs)}{durationMs > 0 ? ` / ${formatTime(durationMs)}` : ""}</span>
                <Progress label="Watched" value={activeVideo.progress} />
              </div>
            </section>

            <section className={styles.lyricsPanel} aria-labelledby="video-transcript-title">
              <div className={styles.lyricsPanelHeader}>
                <div><h2 id="video-transcript-title">Transcript</h2><p>{cues.length ? `${cues.length} synchronized ${cues.length === 1 ? "cue" : "cues"}` : "Add an SRT subtitle file"}</p></div>
                <label className={styles.secondaryButton}><Captions size={16} aria-hidden="true" />{cues.length ? "Replace SRT" : "Add SRT"}<input className={styles.fileInput} type="file" accept=".srt,application/x-subrip,text/plain" onChange={(event) => void importSubtitles(event)} /></label>
              </div>
              <div ref={transcriptRef} className={styles.lyricsViewport} role="region" aria-label="Video subtitles">
                {!sortedCues.length ? <div className={styles.lyricsEmpty}><strong>No subtitles yet</strong><p>Select an SRT file for synchronized Japanese analysis.</p></div> : null}
                {sortedCues.map((cue) => {
                  const isCurrent = activeCue?.id === cue.id;
                  return (
                    <article
                      className={`${styles.lyricLine} ${isCurrent ? styles.lyricLineActive : ""}`}
                      key={cue.id}
                      ref={(node) => { if (node) cueRefs.current.set(cue.id, node); else cueRefs.current.delete(cue.id); }}
                      aria-current={isCurrent ? "true" : undefined}
                    >
                      <div className={styles.lyricLineMain}>
                        <button className={styles.lyricTimeButton} type="button" onClick={() => seek(cue)} aria-label={`Seek to ${formatTime(cue.startMs)}`}>{formatTime(cue.startMs)}</button>
                        {isCurrent ? (
                          <div className={styles.lyricStudyInline}>
                            <span className={styles.lyricStudyHeading}><BookOpenText size={14} aria-hidden="true" /><strong>Study current subtitle</strong><small>Hover or focus a highlighted word</small></span>
                            <JapaneseReader text={cue.text} analysisContext={activeSubtitleAnalysis} ariaLabel="Current subtitle" interaction="tooltip" />
                          </div>
                        ) : <p lang="ja">{cue.text}</p>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className={styles.videoHomeScreen}>
          <h1 className={styles.visuallyHidden}>Video immersion</h1>
          <div className={styles.videoImportBar}>
            <label className={styles.button}><Upload size={16} aria-hidden="true" />Choose local video<input className={styles.fileInput} type="file" accept="video/*,.mp4,.webm,.mov,.m4v,.mpeg,.mpg,.mpe" onChange={importVideo} /></label>
            <form className={styles.videoUrlForm} onSubmit={addVideoUrl}>
              <label className={styles.visuallyHidden} htmlFor="video-url">Video URL</label>
              <span className={styles.sourceSearchInput}><Link2 size={17} aria-hidden="true" /><input id="video-url" type="url" value={urlInput} onChange={(event) => setUrlInput(event.target.value)} placeholder="Direct video or YouTube URL" autoComplete="url" /></span>
              <button className={styles.sourceSearchButton} type="submit" disabled={!urlInput.trim()}>Add URL</button>
            </form>
          </div>
          <p className={styles.videoPrivacyNote}>Local videos play from the selected file and are never uploaded or copied into browser storage.</p>
          {message ? <p className={styles.notice} role="alert">{message}</p> : null}

          {videos.length ? (
            <section className={styles.discoverySection} aria-labelledby="saved-videos-title">
              <div className={styles.musicSectionHead}><h2 id="saved-videos-title">Jump back in</h2><span>{videos.length} in history</span></div>
              <div className={styles.savedVideosShelf} {...firstLibraryReveal}>
                {videos.map((record) => (
                  <article className={styles.savedVideo} key={record.id}>
                    <button className={styles.savedVideoMain} type="button" onClick={() => openVideo(record)} aria-label={`Open ${record.title}`}>
                      <span className={styles.savedVideoPreview}><Film size={28} aria-hidden="true" /></span>
                      <span className={styles.savedVideoCopy}><strong>{record.title}</strong><small>{formatSource(record)}</small><span>{Math.round(record.progress * 100)}% watched</span></span>
                      <span className={styles.savedVideoProgress} aria-hidden="true"><i style={{ "--progress": Math.max(0, Math.min(1, record.progress)) } as React.CSSProperties} /></span>
                    </button>
                    <button className={styles.savedVideoRemove} type="button" onClick={() => removeVideo(record)} aria-label={`Remove ${record.title}`}><Trash2 size={16} aria-hidden="true" /></button>
                  </article>
                ))}
              </div>
            </section>
          ) : <EmptyState title="No video history yet">Choose a local video or add a direct video or YouTube URL to begin.</EmptyState>}
        </div>
      )}
      {deletion.pending ? <UndoNotice message={`${deletion.pending.title} was removed.`} onUndo={() => { deletion.undoDeletion(); setVideos(loadLibrary("video")); }} /> : null}
    </ContentPage>
  );
}
