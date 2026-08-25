"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Captions, Film, Trash2, Upload } from "lucide-react";
import { JapaneseReader } from "./JapaneseReader";
import { findCueAt, parseSrt } from "./parsers";
import { ContentHeader, ContentPage, EmptyState, Panel, Progress, SectionHead, UndoNotice, formatTime } from "./ui";
import { createLocalId, deleteRecord, loadAsset, loadLibrary, saveAsset, upsertRecord } from "./storage";
import type { ContentRecord, SubtitleCue } from "./types";
import { useDelayedDeletion } from "./useDelayedDeletion";
import { useFirstContentReveal } from "./useFirstContentReveal";
import styles from "./content.module.css";

export function VideoWorkspace() {
  const firstLibraryReveal = useFirstContentReveal();
  const [videos, setVideos] = useState<ContentRecord[]>(() => loadLibrary("video"));
  const [activeId, setActiveId] = useState<string | null>(() => loadLibrary("video")[0]?.id ?? null);
  const [videoUrl, setVideoUrl] = useState("");
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [activeCue, setActiveCue] = useState<SubtitleCue | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedSecond = useRef(-1);
  const activeVideo = videos.find((video) => video.id === activeId) ?? null;
  const deletion = useDelayedDeletion<ContentRecord>({
    onCommit: deleteRecord,
    onError: () => { const restored = loadLibrary("video"); setVideos(restored); setActiveId((current) => current ?? restored[0]?.id ?? null); setMessage("The video could not be removed from browser storage, so it was restored."); },
  });

  useEffect(() => {
    let objectUrl = "";
    const record = loadLibrary("video").find((video) => video.id === activeId);
    if (!record) return;
    const videoAssetId = record.assetIds[0];
    const subtitleAssetId = typeof record.metadata?.subtitleAssetId === "string" ? record.metadata.subtitleAssetId : null;
    void Promise.all([loadAsset(videoAssetId), subtitleAssetId ? loadAsset(subtitleAssetId) : Promise.resolve(null)]).then(async ([videoAsset, subtitleAsset]) => {
      if (!videoAsset) throw new Error("The local video file is missing.");
      objectUrl = URL.createObjectURL(videoAsset);
      setVideoUrl(objectUrl);
      setCues(subtitleAsset ? parseSrt(await subtitleAsset.text()) : []);
      setActiveCue(null);
    }).catch((error) => setMessage(error instanceof Error ? error.message : "The video could not be opened."));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [activeId]);

  async function importVideo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      const assetId = createLocalId("video-asset");
      await saveAsset(assetId, file);
      const now = new Date().toISOString();
      const record: ContentRecord = { id: createLocalId("video"), kind: "video", title: file.name.replace(/\.[^.]+$/, ""), fileName: file.name, mimeType: file.type, assetIds: [assetId], createdAt: now, updatedAt: now, progress: 0 };
      const next = upsertRecord(record);
      setVideos(next); setActiveId(record.id);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The video could not be saved."); }
    finally { setBusy(false); event.target.value = ""; }
  }

  async function importSubtitles(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !activeVideo) return;
    setBusy(true); setMessage("");
    try {
      const text = await file.text();
      const parsed = parseSrt(text);
      if (!parsed.length) throw new Error("No valid subtitle cues were found in that SRT file.");
      const assetId = createLocalId("subtitle-asset");
      await saveAsset(assetId, new Blob([text], { type: "application/x-subrip" }));
      const updated: ContentRecord = { ...activeVideo, assetIds: [...activeVideo.assetIds.filter((id) => id !== activeVideo.metadata?.subtitleAssetId), assetId], metadata: { ...activeVideo.metadata, subtitleAssetId: assetId, subtitleFileName: file.name }, updatedAt: new Date().toISOString() };
      const next = upsertRecord(updated);
      setVideos(next); setCues(parsed);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Subtitles could not be imported."); }
    finally { setBusy(false); event.target.value = ""; }
  }

  function syncTime() {
    const player = videoRef.current;
    if (!player || !activeVideo) return;
    const timeMs = player.currentTime * 1000;
    setActiveCue(findCueAt(cues, timeMs));
    const currentSecond = Math.floor(player.currentTime);
    if (currentSecond % 5 === 0 && currentSecond !== lastSavedSecond.current && Number.isFinite(player.duration) && player.duration > 0) {
      lastSavedSecond.current = currentSecond;
      const updated = { ...activeVideo, progress: player.currentTime / player.duration, metadata: { ...activeVideo.metadata, currentTime: player.currentTime, duration: player.duration }, updatedAt: new Date().toISOString() };
      setVideos(upsertRecord(updated));
    }
  }

  function seek(cue: SubtitleCue) {
    if (!videoRef.current) return;
    videoRef.current.currentTime = cue.startMs / 1000;
    setActiveCue(cue);
    void videoRef.current.play();
  }

  function remove(video: ContentRecord) {
    const next = videos.filter((item) => item.id !== video.id);
    deletion.requestDeletion(video);
    setVideos(next); setActiveId(next[0]?.id ?? null);
  }

  const sortedCues = useMemo(() => cues.toSorted((left, right) => left.startMs - right.startMs), [cues]);

  return <ContentPage variant="media">
    <ContentHeader title="Video immersion" description="Study a local video with imported SRT subtitles, synchronized transcript navigation, and click-to-lookup Japanese." actions={<label className={styles.button}><Upload size={16} aria-hidden="true" />{busy ? "Working…" : "Import video"}<input className={styles.fileInput} type="file" accept="video/*,.mp4,.webm,.mov,.m4v" disabled={busy} onChange={(event) => void importVideo(event)} /></label>} />
    {message ? <div className={styles.notice} role="alert">{message}</div> : null}
    {activeVideo ? <>
      <div className={styles.mediaGrid}>
        <div className={styles.workspace}>
          <Panel><video ref={videoRef} className={styles.video} src={videoUrl || undefined} controls preload="metadata" onLoadedMetadata={() => { const player = videoRef.current; const saved = Number(activeVideo.metadata?.currentTime || 0); if (player && saved > 0) player.currentTime = saved; }} onTimeUpdate={syncTime}><track kind="captions" /></video><div className={styles.sectionHead}><div><h2>{activeVideo.title}</h2><p>{activeVideo.fileName}</p></div><Progress label="Watched" value={activeVideo.progress} /></div>{activeCue ? <div className={styles.panelInset} lang="ja">{activeCue.text}</div> : null}</Panel>
          {activeCue ? <JapaneseReader text={activeCue.text} ariaLabel="Current subtitle lookup" /> : null}
        </div>
        <Panel>
          <SectionHead title="Transcript" detail={`${cues.length} cues`} />
          <label className={styles.secondaryButton}><Captions size={16} aria-hidden="true" />{cues.length ? "Replace SRT" : "Add SRT"}<input className={styles.fileInput} type="file" accept=".srt,application/x-subrip,text/plain" onChange={(event) => void importSubtitles(event)} /></label>
          {sortedCues.length ? <div className={styles.cueList}>{sortedCues.map((cue) => <button key={cue.id} type="button" className={`${styles.cue} ${activeCue?.id === cue.id ? styles.cueActive : ""}`} onClick={() => seek(cue)}><span className={styles.cueTime}>{formatTime(cue.startMs)}</span><span lang="ja">{cue.text}</span></button>)}</div> : <EmptyState title="No subtitles yet">Import an SRT file to get a synchronized, searchable transcript.</EmptyState>}
        </Panel>
      </div>
      <section><SectionHead title="Local videos" detail={`${videos.length} saved`} /><div className={styles.libraryGrid} {...firstLibraryReveal}>{videos.map((video) => <article className={styles.libraryItem} key={video.id}><Film aria-hidden="true" /><h3>{video.title}</h3><Progress label="Progress" value={video.progress} /><div className={styles.libraryActions}><button className={styles.secondaryButton} type="button" onClick={() => setActiveId(video.id)}>Open</button><button className={styles.iconButton} type="button" onClick={() => remove(video)} aria-label={`Remove ${video.title}`}><Trash2 size={16} aria-hidden="true" /></button></div></article>)}</div></section>
    </> : <EmptyState title="Bring your own video">Choose a video from this device. It never leaves your browser. Add an SRT file after opening it.</EmptyState>}
    {deletion.pending ? <UndoNotice message={`“${deletion.pending.title}” removed`} onUndo={() => { deletion.undoDeletion(); const restored = loadLibrary("video"); setVideos(restored); setActiveId(deletion.pending?.id ?? restored[0]?.id ?? null); }} /> : null}
  </ContentPage>;
}
