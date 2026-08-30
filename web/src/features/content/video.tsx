"use client";

import Image from "next/image";
import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Captions, ClipboardPaste, Film, Languages, Link2, Pause, Play, RotateCcw, Trash2, Upload } from "lucide-react";
import { useWebSettings } from "@/features/settings/use-workspace-preferences";
import { useSession } from "@/lib/session";
import { FileDropOverlay } from "./FileDropOverlay";
import { JapaneseReader, type JapaneseReaderAnalysisContext } from "./JapaneseReader";
import { LocalFilePicker } from "./LocalFilePicker";
import { LyricsTextEditor } from "./LyricsTextEditor";
import {
  buildDisplayTranslationsForLines,
  lyricsTranslationFingerprint,
  sanitizeLyricLineTranslations,
  selectLyricLinesForTranslation,
  type LyricLineTranslations,
} from "./lyrics";
import { linkedFileIds, linkedMetadata, requestLinkedFilePermission, requestPersistentLocalStorage, resolveLinkedFile } from "./local-file-source";
import {
  MusicTranslationStreamError,
  readMusicTranslationResponse,
} from "./music-translation-stream";
import { YouTubePlayer, type YouTubePlayerHandle } from "./YouTubePlayer";
import { transcodeMpegToMp4 } from "./mpeg-converter";
import { findCueAt, parseLyricsText } from "./parsers";
import { ContentPage, EmptyState, UndoNotice, formatTime } from "./ui";
import { createLocalId, deleteRecord, loadAsset, loadLibrary, removeFileHandle, saveFileHandle, saveLibrary, upsertRecord } from "./storage";
import type { ContentRecord, SubtitleCue } from "./types";
import { useDelayedDeletion } from "./useDelayedDeletion";
import { useFirstContentReveal } from "./useFirstContentReveal";
import {
  loadVideoTranscriptTranslations,
  removeVideoTranscriptTranslations,
  saveVideoTranscriptTranslations,
} from "./video-translations";
import styles from "./content.module.css";

type ResolvedVideoSource =
  | { kind: "native"; url: string }
  | { kind: "youtube"; videoId: string };

type LocalVideoAccessState = {
  videoId: string;
  status: "loading" | "permission" | "missing" | "unavailable";
};

type YouTubeTranscriptRequestState = {
  videoId: string;
  status: "loading" | "error";
  message?: string;
};

type TranscriptTranslationState = {
  sourceKey: string;
  status: "idle" | "loading" | "ready" | "error";
  translations: LyricLineTranslations;
  message: string | null;
  code: string | null;
};

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtu.be"]);
const MPEG_FILE_PATTERN = /\.(?:mpe?g|mpg)$/i;
const LOCAL_VIDEO_FILE_PATTERN = /\.(?:m4v|mov|mp4|mpe|mpeg|mpg|webm)$/i;
const LOCAL_VIDEO_ACCEPT = { "video/*": [".mp4", ".webm", ".mov", ".m4v", ".mpeg", ".mpg", ".mpe"] } as const;
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

function metadataNumber(record: ContentRecord, key: string) {
  const value = record.metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

function youtubeIdForRecord(record: ContentRecord) {
  const storedId = metadataText(record, "youtubeId");
  if (/^[A-Za-z0-9_-]{6,20}$/.test(storedId)) return storedId;
  for (const value of [metadataText(record, "videoUrl"), record.fileName]) {
    if (!value) continue;
    try {
      const parsedId = youtubeIdFromUrl(new URL(value));
      if (parsedId) return parsedId;
    } catch { /* Ignore malformed legacy source metadata. */ }
  }
  return "";
}

function safeDirectVideoUrl(record: ContentRecord) {
  const value = metadataText(record, "videoUrl");
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch { return ""; }
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

function formatSavedVideoDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(total / 60);
  const remainingSeconds = String(total % 60).padStart(2, "0");
  if (total < 3600) return `${minutes}:${remainingSeconds}`;
  return `${Math.floor(total / 3600)}:${String(minutes % 60).padStart(2, "0")}:${remainingSeconds}`;
}

function isMpegMedia(record: ContentRecord, blob: Blob) {
  const blobName = "name" in blob && typeof blob.name === "string" ? blob.name : "";
  return MPEG_FILE_PATTERN.test(blobName || record.fileName || "")
    || /(?:^|\/)x?-?mpeg$/i.test(blob.type || record.mimeType || "");
}

function isSupportedLocalVideo(file: File) {
  return file.type.toLocaleLowerCase().startsWith("video/") || LOCAL_VIDEO_FILE_PATTERN.test(file.name);
}

function SavedVideoSourceIcon({ record }: { record: ContentRecord }) {
  const sourceType = videoSourceType(record);
  return (
    <span className={styles.savedVideoSourceIcon} data-video-source={sourceType} aria-hidden="true">
      {sourceType === "youtube" ? <Play size={17} fill="currentColor" /> : sourceType === "url" ? <Link2 size={17} /> : <Film size={18} />}
    </span>
  );
}

function SavedVideoThumbnail({ record, localVideoUrl }: { record: ContentRecord; localVideoUrl?: string }) {
  const sourceType = videoSourceType(record);
  const youtubeId = sourceType === "youtube" ? youtubeIdForRecord(record) : "";
  const preview = youtubeId
    ? { kind: "image" as const, url: `https://i.ytimg.com/vi/${youtubeId}/mqdefault.jpg` }
    : sourceType === "url"
      ? { kind: "video" as const, url: safeDirectVideoUrl(record) }
      : localVideoUrl?.startsWith("blob:")
        ? { kind: "video" as const, url: localVideoUrl }
        : null;
  const sourceKey = preview?.url ?? "";
  const [failedSource, setFailedSource] = useState("");
  const [readySource, setReadySource] = useState("");
  const visiblePreview = preview?.url && failedSource !== sourceKey ? preview : null;
  const ready = readySource === sourceKey;
  const progress = Number.isFinite(record.progress) ? Math.max(0, Math.min(1, record.progress)) : 0;
  const durationSeconds = metadataNumber(record, "duration");

  return (
    <span className={styles.savedVideoPreview} data-video-thumbnail>
      <Film size={28} aria-hidden="true" />
      {visiblePreview?.kind === "image" ? (
        <Image
          className={styles.savedVideoPreviewMedia}
          data-ready={ready || undefined}
          src={visiblePreview.url}
          alt=""
          width={320}
          height={180}
          sizes="(max-width: 40rem) 72vw, 288px"
          draggable={false}
          unoptimized
          onLoad={() => setReadySource(sourceKey)}
          onError={() => setFailedSource(sourceKey)}
        />
      ) : visiblePreview?.kind === "video" ? (
        <video
          className={styles.savedVideoPreviewMedia}
          data-ready={ready || undefined}
          src={visiblePreview.url}
          aria-hidden="true"
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          draggable={false}
          onLoadedMetadata={(event) => {
            const previewVideo = event.currentTarget;
            if (Number.isFinite(previewVideo.duration) && previewVideo.duration > 0) {
              try { previewVideo.currentTime = Math.min(1, previewVideo.duration * 0.05); }
              catch { /* Some live or non-seekable sources can still show their initial frame. */ }
            }
          }}
          onLoadedData={() => setReadySource(sourceKey)}
          onSeeked={() => setReadySource(sourceKey)}
          onError={() => setFailedSource(sourceKey)}
        />
      ) : null}
      {durationSeconds > 0 ? <span className={styles.savedVideoDuration} aria-hidden="true">{formatSavedVideoDuration(durationSeconds)}</span> : null}
      {progress > 0 ? (
        <span className={styles.savedVideoProgress} data-video-progress aria-hidden="true">
          <i style={{ "--progress": progress } as React.CSSProperties} />
        </span>
      ) : null}
    </span>
  );
}

export function VideoWorkspace() {
  const { user } = useSession();
  const settings = useWebSettings(user?.data.username ?? "anonymous");
  const jpdbApiKey = settings.integrations.jpdbApiKey;
  const firstLibraryReveal = useFirstContentReveal();
  const [videos, setVideos] = useState<ContentRecord[]>(() => loadLibrary("video"));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localVideoUrls, setLocalVideoUrls] = useState<Record<string, string>>({});
  const [urlInput, setUrlInput] = useState("");
  const [legacySubtitleText, setLegacySubtitleText] = useState("");
  const [transcriptEditorOpen, setTranscriptEditorOpen] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [inspectorCueId, setInspectorCueId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [youtubeTranscriptRequest, setYoutubeTranscriptRequest] = useState<YouTubeTranscriptRequestState | null>(null);
  const [transcriptTranslationsEnabled, setTranscriptTranslationsEnabled] = useState(false);
  const [translationRetryToken, setTranslationRetryToken] = useState(0);
  const [transcriptTranslation, setTranscriptTranslation] = useState<TranscriptTranslationState>({
    sourceKey: "",
    status: "idle",
    translations: {},
    message: null,
    code: null,
  });
  const [mpegConversion, setMpegConversion] = useState<{ videoId: string; percent: number } | null>(null);
  const [localVideoAccess, setLocalVideoAccess] = useState<LocalVideoAccessState | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubeRef = useRef<YouTubePlayerHandle>(null);
  const localMedia = useRef(new Map<string, { blob: Blob; url: string }>());
  const convertingMpegIds = useRef(new Set<string>());
  const convertedMpegIds = useRef(new Set<string>());
  const cueRefs = useRef(new Map<string, HTMLElement>());
  const transcriptRef = useRef<HTMLDivElement>(null);
  const transcriptFileInputRef = useRef<HTMLInputElement>(null);
  const translationAbortRef = useRef<AbortController | null>(null);
  const lastSavedSecond = useRef(-1);
  const linkedResolutionGeneration = useRef(0);
  const linkedPermissionHandle = useRef<{ videoId: string; handle: FileSystemFileHandle } | null>(null);
  const activeVideo = videos.find((video) => video.id === activeId) ?? null;
  const activeSourceType = activeVideo ? videoSourceType(activeVideo) : null;
  const activeYoutubeId = activeVideo ? youtubeIdForRecord(activeVideo) : "";
  const activeVideoUrl = activeVideo ? metadataText(activeVideo, "videoUrl") : "";
  const subtitleAssetId = activeVideo ? metadataText(activeVideo, "subtitleAssetId") : "";
  const legacyVideoAssetId = activeVideo?.assetIds.find((assetId) => assetId !== subtitleAssetId) ?? "";
  const activeLinkedFileId = activeVideo ? linkedFileIds(activeVideo)[0] ?? "" : "";
  const localVideoUrl = activeId ? localVideoUrls[activeId] || "" : "";
  const activeLocalVideoAccess = localVideoAccess?.videoId === activeId ? localVideoAccess : null;
  const activeYoutubeTranscriptRequest = youtubeTranscriptRequest?.videoId === activeId ? youtubeTranscriptRequest : null;
  const resolvedSource = useMemo<ResolvedVideoSource | null>(() => {
    if (activeSourceType === "youtube") return activeYoutubeId ? { kind: "youtube", videoId: activeYoutubeId } : null;
    if (activeSourceType === "url") return activeVideoUrl ? { kind: "native", url: activeVideoUrl } : null;
    return localVideoUrl ? { kind: "native", url: localVideoUrl } : null;
  }, [activeSourceType, activeVideoUrl, activeYoutubeId, localVideoUrl]);
  const transcriptSourceText = activeVideo?.text || legacySubtitleText;
  const transcript = useMemo(() => parseLyricsText(transcriptSourceText), [transcriptSourceText]);
  const cues = transcript.lines;
  const sortedCues = useMemo(() => cues.toSorted((left, right) => left.startMs - right.startMs), [cues]);
  const transcriptTranslationSelection = useMemo(
    () => selectLyricLinesForTranslation(sortedCues.map((cue) => cue.text)),
    [sortedCues],
  );
  const translatableTranscriptLines = transcriptTranslationSelection.lines;
  const transcriptTranslationSourceKey = activeId && transcriptSourceText
    ? `${activeId}:${lyricsTranslationFingerprint(transcriptSourceText)}`
    : "";
  const transcriptTranslationsAvailable = jpdbApiKey.length > 0;
  const transcriptTranslationsEligible = translatableTranscriptLines.length > 0;
  const transcriptTranslationStateMatches = transcriptTranslationsEnabled
    && transcriptTranslation.sourceKey === transcriptTranslationSourceKey;
  const transcriptDisplayTranslations = useMemo(() => buildDisplayTranslationsForLines(
    sortedCues.map((cue) => cue.text),
    transcriptTranslationStateMatches ? transcriptTranslation.translations : {},
  ), [sortedCues, transcriptTranslation.translations, transcriptTranslationStateMatches]);
  const transcriptTranslationHasMissingLines = translatableTranscriptLines.some(
    (line) => !transcriptTranslation.translations[line],
  );
  const transcriptTranslationCanRetry = transcriptTranslationStateMatches
    && transcriptTranslation.status !== "idle"
    && transcriptTranslation.status !== "loading"
    && transcriptTranslation.code !== "text_too_long"
    && transcriptTranslationHasMissingLines;
  const transcriptTranslationLimitMessage = transcriptTranslationsEnabled
    && transcriptTranslationSelection.skippedCount > 0
    ? `${transcriptTranslationSelection.skippedCount} ${transcriptTranslationSelection.skippedCount === 1 ? "transcript line remains" : "transcript lines remain"} in Japanese because this transcript exceeds the safe translation limits.`
    : null;
  const visibleTranscriptTranslationMessage = [
    transcriptTranslationStateMatches ? transcriptTranslation.message : null,
    transcriptTranslationLimitMessage,
  ].filter((value): value is string => Boolean(value)).join(" ") || null;
  const subtitleAnalysisContexts = useMemo(() => buildSubtitleAnalysisContexts(sortedCues), [sortedCues]);
  const activeCue = useMemo(() => {
    if (!transcript.timed) return null;
    const matched = findCueAt(sortedCues, elapsedMs);
    if (matched) return matched;
    return sortedCues.findLast((cue) => elapsedMs >= cue.startMs) ?? sortedCues[0] ?? null;
  }, [elapsedMs, sortedCues, transcript.timed]);
  const activeInspectorCueId = inspectorCueId && sortedCues.some((cue) => cue.id === inspectorCueId) ? inspectorCueId : null;
  const studyCueId = activeInspectorCueId ?? activeCue?.id ?? null;

  const deletion = useDelayedDeletion<ContentRecord>({
    onCommit: async (record) => {
      await deleteRecord(record);
      removeVideoTranscriptTranslations(record.id);
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

  const setLocalMediaSource = useCallback((videoId: string, file: File) => {
    const previous = localMedia.current.get(videoId);
    if (previous) URL.revokeObjectURL(previous.url);
    const url = URL.createObjectURL(file);
    localMedia.current.set(videoId, { blob: file, url });
    convertedMpegIds.current.delete(videoId);
    setLocalVideoUrls((current) => ({ ...current, [videoId]: url }));
    setLocalVideoAccess((current) => current?.videoId === videoId ? null : current);
  }, []);

  const restoreLinkedVideo = useCallback(async (videoId: string, fileId: string) => {
    const generation = ++linkedResolutionGeneration.current;
    setLocalVideoAccess({ videoId, status: "loading" });
    const resolution = await resolveLinkedFile(fileId);
    if (linkedResolutionGeneration.current !== generation) return;
    if (resolution.status === "ready") {
      if (linkedPermissionHandle.current?.videoId === videoId) linkedPermissionHandle.current = null;
      setLocalMediaSource(videoId, resolution.file);
      return;
    }
    linkedPermissionHandle.current = resolution.status === "permission"
      ? { videoId, handle: resolution.handle }
      : null;
    setLocalVideoAccess({ videoId, status: resolution.status });
  }, [setLocalMediaSource]);

  async function allowLinkedVideoAccess(videoId: string, fileId: string) {
    const pending = linkedPermissionHandle.current;
    if (!pending || pending.videoId !== videoId) return;
    const generation = ++linkedResolutionGeneration.current;
    const permissionRequest = requestLinkedFilePermission(pending.handle);
    setLocalVideoAccess({ videoId, status: "loading" });
    const permission = await permissionRequest;
    if (linkedResolutionGeneration.current !== generation) return;
    if (permission.status !== "granted") {
      setLocalVideoAccess({ videoId, status: permission.status === "permission" ? "permission" : "unavailable" });
      if (permission.status === "unavailable") setMessage(permission.error.message);
      return;
    }
    await restoreLinkedVideo(videoId, fileId);
  }

  useEffect(() => {
    if (!activeId || activeVideo?.text || !subtitleAssetId) return;
    let cancelled = false;
    void loadAsset(subtitleAssetId).then(async (subtitleAsset) => {
      if (!cancelled && subtitleAsset) setLegacySubtitleText(await subtitleAsset.text());
    }).catch(() => {
      if (!cancelled) setMessage("The saved subtitle file could not be opened. You can select it again.");
    });
    return () => { cancelled = true; };
  }, [activeId, activeVideo?.text, subtitleAssetId]);

  useEffect(() => {
    if (!activeId || activeSourceType !== "local" || localMedia.current.has(activeId) || !activeLinkedFileId) return;
    void restoreLinkedVideo(activeId, activeLinkedFileId);
    return () => { linkedResolutionGeneration.current += 1; };
  }, [activeId, activeLinkedFileId, activeSourceType, restoreLinkedVideo]);

  useEffect(() => {
    if (!activeId || activeSourceType !== "local" || localMedia.current.has(activeId) || activeLinkedFileId || !legacyVideoAssetId) return;
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
  }, [activeId, activeLinkedFileId, activeSourceType, legacyVideoAssetId]);

  useEffect(() => {
    const media = localMedia.current;
    return () => {
      translationAbortRef.current?.abort();
      media.forEach(({ url }) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    translationAbortRef.current?.abort();
    if (
      !activeId
      || !transcriptSourceText
      || !transcriptTranslationsEnabled
      || !transcriptTranslationsAvailable
      || translatableTranscriptLines.length === 0
    ) return;

    const cachedTranslations = loadVideoTranscriptTranslations(
      activeId,
      transcriptSourceText,
      translatableTranscriptLines,
    );
    const missingTranslations = translatableTranscriptLines.some((line) => !cachedTranslations[line]);
    if (!missingTranslations) {
      let current = true;
      void Promise.resolve().then(() => {
        if (!current) return;
        setTranscriptTranslation({
          sourceKey: transcriptTranslationSourceKey,
          status: "ready",
          translations: cachedTranslations,
          message: null,
          code: null,
        });
      });
      return () => { current = false; };
    }

    const controller = new AbortController();
    translationAbortRef.current = controller;
    let current = true;
    void (async () => {
      await Promise.resolve();
      if (!current || controller.signal.aborted) return;
      setTranscriptTranslation({
        sourceKey: transcriptTranslationSourceKey,
        status: "loading",
        translations: cachedTranslations,
        message: null,
        code: null,
      });
      try {
        const allowedLines = new Set(translatableTranscriptLines);
        let accumulatedTranslations = cachedTranslations;
        const completion = await readMusicTranslationResponse(await fetch("/video/translate", {
          method: "POST",
          headers: {
            Accept: "application/x-ndjson",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            lines: translatableTranscriptLines,
            cachedTranslations: Object.entries(cachedTranslations).map(([source, translation]) => ({ source, translation })),
            apiKey: jpdbApiKey,
          }),
          signal: controller.signal,
        }), ({ source, translation }) => {
          if (!current || controller.signal.aborted || !allowedLines.has(source)) return;
          const nextTranslations = sanitizeLyricLineTranslations({
            ...accumulatedTranslations,
            [source]: translation,
          }, allowedLines);
          if (!nextTranslations[source]) return;
          accumulatedTranslations = nextTranslations;
          saveVideoTranscriptTranslations(
            activeId,
            transcriptSourceText,
            translatableTranscriptLines,
            accumulatedTranslations,
          );
          setTranscriptTranslation((state) => state.sourceKey === transcriptTranslationSourceKey
            ? { ...state, status: "loading", translations: accumulatedTranslations }
            : state);
        });
        if (!current || controller.signal.aborted) return;
        saveVideoTranscriptTranslations(
          activeId,
          transcriptSourceText,
          translatableTranscriptLines,
          accumulatedTranslations,
        );
        setTranscriptTranslation({
          sourceKey: transcriptTranslationSourceKey,
          status: "ready",
          translations: accumulatedTranslations,
          message: completion.warning?.replaceAll("lyric", "transcript") ?? null,
          code: completion.code,
        });
      } catch (error) {
        if (!current || controller.signal.aborted) return;
        setTranscriptTranslation((state) => ({
          sourceKey: transcriptTranslationSourceKey,
          status: "error",
          translations: state.sourceKey === transcriptTranslationSourceKey
            ? state.translations
            : cachedTranslations,
          message: error instanceof Error
            ? error.message.replaceAll("lyric", "transcript")
            : "JPDB transcript translation is temporarily unavailable.",
          code: error instanceof MusicTranslationStreamError ? error.code : null,
        }));
      }
    })();

    return () => {
      current = false;
      controller.abort();
      if (translationAbortRef.current === controller) translationAbortRef.current = null;
    };
  }, [
    activeId,
    jpdbApiKey,
    transcriptSourceText,
    transcriptTranslationSourceKey,
    transcriptTranslationsAvailable,
    transcriptTranslationsEnabled,
    translatableTranscriptLines,
    translationRetryToken,
  ]);

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
    setTranscriptEditorOpen(false);
    setElapsedMs(Number.isFinite(savedTime) ? savedTime * 1_000 : 0);
    setDurationMs(Number.isFinite(savedDuration) ? savedDuration * 1_000 : 0);
    setPlaying(false);
    setInspectorCueId(null);
    setMpegConversion(null);
    setLocalVideoAccess(null);
    lastSavedSecond.current = -1;
    setActiveId(record.id);
  }

  async function importVideo(files: File[], handles: Array<FileSystemFileHandle | null> = []) {
    if (!files.length) return;
    setMessage("");
    if (files.some((file) => !isSupportedLocalVideo(file))) {
      setMessage("Choose a supported video file such as MP4, WebM, MOV, M4V, or MPEG.");
      return;
    }

    const imports: Array<{ file: File; handle: FileSystemFileHandle | null; linkedFileId: string; record: ContentRecord; url: string }> = [];
    try {
      for (const [index, file] of files.entries()) {
        const handle = handles[index] ?? null;
        const linkedFileId = handle ? createLocalId("linked-file") : "";
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
          metadata: {
            sourceType: "local",
            fileSize: file.size,
            lastModified: file.lastModified,
            ...(linkedFileId ? linkedMetadata([linkedFileId]) : {}),
          },
        };
        imports.push({ file, handle, linkedFileId, record, url: URL.createObjectURL(file) });
      }

      const linkedImports = imports.filter((item): item is typeof item & { handle: FileSystemFileHandle } => Boolean(item.handle));
      if (linkedImports.length) {
        await requestPersistentLocalStorage();
        const results = await Promise.allSettled(linkedImports.map((item) => saveFileHandle(item.linkedFileId, item.handle)));
        const failedFileIds: string[] = [];
        for (const [index, result] of results.entries()) {
          if (result.status === "fulfilled") continue;
          const failedImport = linkedImports[index];
          failedFileIds.push(failedImport.linkedFileId);
          failedImport.linkedFileId = "";
          const metadata = { ...failedImport.record.metadata };
          delete metadata.linkedFileIds;
          failedImport.record.metadata = metadata;
        }
        await Promise.all(failedFileIds.map((id) => removeFileHandle(id).catch(() => undefined)));
      }

      const next = [...imports.map(({ record }) => record), ...loadLibrary("video")];
      if (!saveLibrary("video", next)) throw new Error("Browser storage is full or unavailable.");

      const importedUrls: Record<string, string> = {};
      for (const { file, record, url } of imports) {
        localMedia.current.set(record.id, { blob: file, url });
        importedUrls[record.id] = url;
      }
      setVideos(next);
      setLocalVideoUrls((current) => ({ ...current, ...importedUrls }));
      activateVideo(imports[0].record);
    } catch (error) {
      for (const { record, url } of imports) {
        localMedia.current.delete(record.id);
        URL.revokeObjectURL(url);
      }
      await Promise.all(imports.flatMap(({ linkedFileId }) => linkedFileId
        ? [removeFileHandle(linkedFileId).catch(() => undefined)]
        : []));
      setMessage(error instanceof Error ? error.message : "The video could not be added to browser history.");
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
      const existingYoutubeId = youtubeIdForRecord(existing);
      if (existingYoutubeId && !existing.text && !metadataText(existing, "subtitleAssetId")) {
        void requestYoutubeTranscript(existing, existingYoutubeId);
      }
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
      if (youtubeId) void requestYoutubeTranscript(record, youtubeId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The video URL could not be added.");
    }
  }

  async function requestYoutubeTranscript(record: ContentRecord, youtubeId: string) {
    setYoutubeTranscriptRequest({ videoId: record.id, status: "loading" });
    setMessage("");
    try {
      const response = await fetch("/video/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: youtubeId, language: "ja" }),
      });
      const payload = await response.json().catch(() => null) as {
        title?: unknown;
        language?: unknown;
        transcript?: unknown;
        error?: unknown;
      } | null;
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "YouTube captions could not be imported.");
      }
      if (typeof payload?.transcript !== "string") throw new Error("The transcript service returned an unreadable response.");
      const parsed = parseLyricsText(payload.transcript);
      if (!parsed.lines.length || !parsed.timed) throw new Error("No usable timed captions were found for this YouTube video.");

      const stored = loadLibrary("video").find((item) => item.id === record.id) ?? record;
      const oldSubtitleAssetId = metadataText(stored, "subtitleAssetId");
      const updated: ContentRecord = {
        ...stored,
        title: typeof payload.title === "string" && payload.title.trim() ? payload.title.trim() : stored.title,
        text: payload.transcript,
        assetIds: stored.assetIds.filter((id) => id !== oldSubtitleAssetId),
        metadata: {
          ...stored.metadata,
          subtitleAssetId: null,
          subtitleFileName: null,
          transcriptFormat: parsed.format,
          transcriptSource: "youtube",
          transcriptLanguage: typeof payload.language === "string" ? payload.language : null,
        },
        updatedAt: new Date().toISOString(),
      };
      setVideos(upsertRecord(updated));
      setLegacySubtitleText("");
      setInspectorCueId(null);
      setYoutubeTranscriptRequest(null);
    } catch (error) {
      setYoutubeTranscriptRequest({
        videoId: record.id,
        status: "error",
        message: error instanceof Error ? error.message : "YouTube captions could not be imported.",
      });
    }
  }

  async function reconnectVideo(files: File[], handles: Array<FileSystemFileHandle | null> = []) {
    const file = files[0];
    if (!file || !activeVideo) return;
    if (!isSupportedLocalVideo(file)) {
      setMessage("Choose a supported video file such as MP4, WebM, MOV, M4V, or MPEG.");
      return;
    }

    const handle = handles[0] ?? null;
    const previousFileIds = linkedFileIds(activeVideo);
    const nextFileId = handle ? createLocalId("linked-file") : "";
    let updatedVideos: ContentRecord[];
    try {
      if (handle) {
        await requestPersistentLocalStorage();
        await saveFileHandle(nextFileId, handle);
      }
      const updated: ContentRecord = {
        ...activeVideo,
        fileName: file.name,
        mimeType: file.type,
        metadata: {
          ...activeVideo.metadata,
          fileSize: file.size,
          lastModified: file.lastModified,
          ...linkedMetadata(nextFileId ? [nextFileId] : []),
        },
        updatedAt: new Date().toISOString(),
      };
      updatedVideos = upsertRecord(updated);
    } catch (error) {
      if (nextFileId) await removeFileHandle(nextFileId).catch(() => undefined);
      setMessage(error instanceof Error ? error.message : "The video file could not be reconnected.");
      return;
    }

    setVideos(updatedVideos);
    void Promise.all(previousFileIds.map((id) => removeFileHandle(id).catch(() => undefined)));
    linkedResolutionGeneration.current += 1;
    setLocalMediaSource(activeVideo.id, file);
    setMessage("");
  }

  async function importSubtitles(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !activeVideo) return;
    setMessage("");
    try {
      const text = await file.text();
      const parsed = parseLyricsText(text);
      if (!parsed.lines.length) throw new Error("No readable lyrics or subtitle lines were found in that file.");
      const oldSubtitleAssetId = metadataText(activeVideo, "subtitleAssetId");
      const updated: ContentRecord = {
        ...activeVideo,
        text,
        assetIds: activeVideo.assetIds.filter((id) => id !== oldSubtitleAssetId),
        metadata: { ...activeVideo.metadata, subtitleAssetId: null, subtitleFileName: file.name, transcriptFormat: parsed.format, transcriptSource: "file" },
        updatedAt: new Date().toISOString(),
      };
      setVideos(upsertRecord(updated));
      setLegacySubtitleText("");
      setTranscriptEditorOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Subtitles could not be imported.");
    } finally {
      event.target.value = "";
    }
  }

  function saveCustomTranscript(text: string) {
    if (!activeVideo) return false;
    const parsed = parseLyricsText(text);
    if (!parsed.lines.length) return false;
    const oldSubtitleAssetId = metadataText(activeVideo, "subtitleAssetId");
    const updated: ContentRecord = {
      ...activeVideo,
      text,
      assetIds: activeVideo.assetIds.filter((id) => id !== oldSubtitleAssetId),
      metadata: {
        ...activeVideo.metadata,
        subtitleAssetId: null,
        subtitleFileName: null,
        transcriptFormat: parsed.format,
        transcriptSource: "custom",
      },
      updatedAt: new Date().toISOString(),
    };
    try {
      setVideos(upsertRecord(updated));
      setLegacySubtitleText("");
      setInspectorCueId(null);
      setMessage("");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The custom transcript could not be saved.");
      return false;
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

  function togglePlayback() {
    if (resolvedSource?.kind === "youtube") {
      if (playing) youtubeRef.current?.pause();
      else youtubeRef.current?.play();
      return;
    }
    const player = videoRef.current;
    if (!player) return;
    if (playing) player.pause();
    else void player.play().catch(() => undefined);
  }

  function restartPlayback() {
    setElapsedMs(0);
    if (resolvedSource?.kind === "youtube") {
      youtubeRef.current?.seekTo(0);
      return;
    }
    const player = videoRef.current;
    if (player) player.currentTime = 0;
  }

  function seekPlayback(targetMs: number) {
    const clampedTargetMs = Math.max(0, Math.min(durationMs, targetMs));
    setElapsedMs(clampedTargetMs);
    if (resolvedSource?.kind === "youtube") {
      youtubeRef.current?.seekTo(clampedTargetMs);
      return;
    }
    const player = videoRef.current;
    if (player) player.currentTime = clampedTargetMs / 1_000;
  }

  function openVideo(record: ContentRecord) {
    activateVideo(record);
  }

  function returnHome() {
    if (resolvedSource?.kind === "youtube") youtubeRef.current?.pause();
    else videoRef.current?.pause();
    setMessage("");
    setLegacySubtitleText("");
    setTranscriptEditorOpen(false);
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

  const playbackMax = Math.max(1, durationMs);
  const playbackValue = Math.min(playbackMax, Math.max(0, elapsedMs));
  const playbackAvailable = resolvedSource !== null;

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
              <div className={styles.playerMediaViewport}>
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
                    {activeLocalVideoAccess?.status === "loading" ? <>
                      <strong>Opening linked video…</strong>
                      <p role="status">Checking access to the original file on this device.</p>
                    </> : activeLocalVideoAccess?.status === "permission" ? <>
                      <strong>Allow access to this video</strong>
                      <p>Kakehashi remembers the file location, but the browser needs your permission before opening it.</p>
                      <button className={styles.secondaryButton} type="button" onClick={() => void allowLinkedVideoAccess(activeVideo.id, activeLinkedFileId)}>Allow access</button>
                    </> : activeLocalVideoAccess?.status === "missing" ? <>
                      <strong>Reconnect the original video</strong>
                      <p>The saved file link is no longer available. Your watch history and subtitles are still here.</p>
                    </> : activeLocalVideoAccess?.status === "unavailable" ? <>
                      <strong>This video is temporarily unavailable</strong>
                      <p>The saved file could not be opened right now. Your watch history has been kept.</p>
                      <button className={styles.secondaryButton} type="button" onClick={() => void restoreLinkedVideo(activeVideo.id, activeLinkedFileId)}>Try again</button>
                    </> : <>
                      <strong>Select the original video file</strong>
                      <p>For privacy, Kakehashi keeps only your watch history—not a copy of the video. Reconnect the file to continue.</p>
                    </>}
                    {activeLocalVideoAccess?.status !== "loading" ? <LocalFilePicker
                      className={styles.secondaryButton}
                      accept={LOCAL_VIDEO_ACCEPT}
                      description="Video files"
                      onFiles={reconnectVideo}
                      onPickerError={(error) => setMessage(error.message || "The video picker could not be opened.")}
                    >{activeLinkedFileId ? "Reconnect file" : "Choose file"}</LocalFilePicker> : null}
                  </div>
                )}
              </div>
              <div className={styles.playerControls} role="group" aria-label="Playback controls">
                <button className={`${styles.playerControlButton} ${styles.playerControlPrimary} ${styles.playerPlayControl}`} type="button" aria-label={playing ? "Pause video" : "Play video"} onClick={togglePlayback} disabled={!playbackAvailable}>{playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}</button>
                <button className={`${styles.playerControlButton} ${styles.playerRestartControl}`} type="button" aria-label="Restart video" onClick={restartPlayback} disabled={!playbackAvailable}><RotateCcw size={16} aria-hidden="true" /></button>
                <span className={`${styles.playerTime} ${styles.playerElapsed}`}>{formatTime(playbackValue)}</span>
                <span className={styles.playerSeek}>
                  <progress className={styles.playerSeekProgress} max={playbackMax} value={playbackValue} aria-hidden="true" />
                  <input type="range" min={0} max={playbackMax} step={1_000} value={playbackValue} aria-label="Seek video" aria-valuetext={`${formatTime(playbackValue)} of ${durationMs > 0 ? formatTime(durationMs) : "0:00"}`} disabled={!playbackAvailable || durationMs <= 0} onChange={(event) => seekPlayback(Number(event.currentTarget.value))} />
                </span>
                <span className={`${styles.playerTime} ${styles.playerDuration}`}>{durationMs > 0 ? formatTime(durationMs) : "0:00"}</span>
              </div>
            </section>

            <section className={styles.lyricsPanel} aria-labelledby="video-transcript-title">
              <div className={styles.lyricsPanelHeader}>
                <div>
                  <h2 id="video-transcript-title">Transcript</h2>
                  <p>{cues.length ? transcript.timed ? `${cues.length} synchronized ${cues.length === 1 ? "cue" : "cues"}` : `${cues.length} plain ${cues.length === 1 ? "line" : "lines"}` : activeYoutubeTranscriptRequest?.status === "loading" ? "Getting available YouTube captions…" : "Add plain or timed text"}</p>
                  {transcriptTranslationStateMatches && transcriptTranslation.status === "loading" ? <p className={styles.lyricsTranslationStatus} role="status">Translating transcript lines…</p> : null}
                  {transcriptTranslationStateMatches && transcriptTranslation.status !== "loading" && visibleTranscriptTranslationMessage ? <div className={styles.lyricsTranslationFeedback}>
                    <p className={transcriptTranslation.status === "error" ? styles.lyricsTranslationError : styles.lyricsTranslationStatus} role={transcriptTranslation.status === "error" ? "alert" : "status"}>{visibleTranscriptTranslationMessage}</p>
                    {transcriptTranslationCanRetry ? <button type="button" onClick={() => {
                      translationAbortRef.current?.abort();
                      setTranslationRetryToken((token) => token + 1);
                    }}>Retry translations</button> : null}
                  </div> : null}
                  {!transcriptTranslationsAvailable || (cues.length > 0 && !transcriptTranslationsEligible) ? <p id="transcript-translation-help" className={styles.lyricsTranslationHelp}>{!transcriptTranslationsAvailable
                    ? <><Link href="/settings#jpdb-api-key">Add a JPDB key in Settings</Link> to enable English transcript translations.</>
                    : "No Japanese transcript lines are eligible for translation."}</p> : null}
                </div>
                <div className={styles.lyricsPanelActions}>
                  {activeSourceType === "youtube" && !cues.length ? <button
                    className={styles.secondaryButton}
                    type="button"
                    disabled={activeYoutubeTranscriptRequest?.status === "loading"}
                    onClick={() => void requestYoutubeTranscript(activeVideo, activeYoutubeId)}
                  ><Captions size={16} aria-hidden="true" />{activeYoutubeTranscriptRequest?.status === "loading" ? "Getting captions…" : "Get YouTube captions"}</button> : null}
                  <button className={styles.iconButton} type="button" aria-label="Paste transcript" title="Paste transcript" aria-expanded={transcriptEditorOpen} onClick={() => setTranscriptEditorOpen((open) => !open)}><ClipboardPaste size={16} aria-hidden="true" /></button>
                  <button className={styles.iconButton} type="button" aria-label="Import transcript file" title="Import transcript file" onClick={() => transcriptFileInputRef.current?.click()}><Upload size={16} aria-hidden="true" /></button>
                  <input ref={transcriptFileInputRef} className={styles.fileInput} type="file" accept=".lrc,.srt,.txt,.vtt,application/x-subrip,text/plain,text/vtt" aria-label="Transcript file picker" onChange={(event) => void importSubtitles(event)} />
                  <button
                    className={styles.translationToggle}
                    type="button"
                    aria-label="English transcript translations"
                    title="English transcript translations"
                    aria-pressed={transcriptTranslationsEnabled}
                    aria-describedby={!transcriptTranslationsAvailable || (cues.length > 0 && !transcriptTranslationsEligible) ? "transcript-translation-help" : undefined}
                    disabled={!transcriptTranslationsAvailable || !transcriptTranslationsEligible}
                    onClick={() => setTranscriptTranslationsEnabled((enabled) => !enabled)}
                  ><Languages size={16} aria-hidden="true" /></button>
                </div>
                {activeYoutubeTranscriptRequest?.status === "error" ? <p className={styles.transcriptFetchError} role="alert">{activeYoutubeTranscriptRequest.message}</p> : null}
                {transcriptEditorOpen ? <LyricsTextEditor kind="transcript" initialValue={activeVideo.text || legacySubtitleText} onCancel={() => setTranscriptEditorOpen(false)} onSave={saveCustomTranscript} /> : null}
              </div>
              <div ref={transcriptRef} className={styles.lyricsViewport} role="region" aria-label="Video subtitles">
                {!sortedCues.length ? <div className={styles.lyricsEmpty}><strong>{activeYoutubeTranscriptRequest?.status === "loading" ? "Getting transcript…" : "No transcript yet"}</strong><p>{activeYoutubeTranscriptRequest?.status === "loading" ? "Checking the public captions available for this video." : "Get available YouTube captions, paste text, or import an LRC, SRT, WebVTT, or text file."}</p></div> : null}
                {sortedCues.map((cue, cueIndex) => {
                  const isCurrent = activeCue?.id === cue.id;
                  const isStudyCue = !transcript.timed || studyCueId === cue.id;
                  const translation = transcriptDisplayTranslations[cueIndex];
                  return (
                    <article
                      className={`${styles.lyricLine} ${isCurrent ? styles.lyricLineActive : ""}`}
                      key={cue.id}
                      ref={(node) => { if (node) cueRefs.current.set(cue.id, node); else cueRefs.current.delete(cue.id); }}
                      aria-current={isCurrent ? "true" : undefined}
                    >
                      <div className={styles.lyricLineMain}>
                        {transcript.timed ? <button className={styles.lyricTimeButton} type="button" onClick={() => seek(cue)} aria-label={`Seek to ${formatTime(cue.startMs)}`}>{formatTime(cue.startMs)}</button> : <span className={styles.lyricUntimedMarker} aria-hidden="true" />}
                        <div className={styles.lyricLineCopy}>
                          {isStudyCue ? (
                            <div className={styles.lyricStudyInline}>
                              <JapaneseReader
                                text={cue.text}
                                analysisContext={subtitleAnalysisContexts.get(cue.id)}
                                ariaLabel="Current subtitle"
                                inspectorMode="floating"
                                onSelectionChange={(open) => setInspectorCueId(open ? cue.id : null)}
                              />
                            </div>
                          ) : <p lang="ja">{cue.text}</p>}
                          {translation ? <p className={styles.lyricLineTranslation} lang="en">{translation}</p> : null}
                        </div>
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
          <FileDropOverlay
            hint="MP4 · WebM · MOV · M4V · MPEG"
            icon={<Upload size={32} aria-hidden="true" />}
            label="Drop to import videos"
            multiple
            onFiles={importVideo}
          />
          <div className={styles.videoImportBar}>
            <LocalFilePicker
              className={styles.button}
              accept={LOCAL_VIDEO_ACCEPT}
              description="Video files"
              multiple
              onFiles={importVideo}
              onPickerError={(error) => setMessage(error.message || "The video picker could not be opened.")}
            >
              <Upload size={16} aria-hidden="true" />
              Choose local video
            </LocalFilePicker>
            <form className={styles.videoUrlForm} onSubmit={addVideoUrl}>
              <label className={styles.visuallyHidden} htmlFor="video-url">Video URL</label>
              <span className={styles.sourceSearchInput}><Link2 size={17} aria-hidden="true" /><input id="video-url" type="url" value={urlInput} onChange={(event) => setUrlInput(event.target.value)} placeholder="Direct video or YouTube URL" autoComplete="url" /></span>
              <button className={styles.sourceSearchButton} type="submit" disabled={!urlInput.trim()}>Add URL</button>
            </form>
          </div>
          <p className={styles.videoPrivacyNote}>Local videos stay on this device. For YouTube links, Kakehashi requests available public captions from a fair-use transcript service.</p>
          {message ? <p className={styles.notice} role="alert">{message}</p> : null}

          {videos.length ? (
            <section className={styles.discoverySection} aria-labelledby="saved-videos-title">
              <div className={styles.musicSectionHead}><h2 id="saved-videos-title">Jump back in</h2><span>{videos.length} in history</span></div>
              <div className={styles.savedVideosShelf} {...firstLibraryReveal}>
                {videos.map((record) => (
                  <article className={styles.savedVideo} key={record.id}>
                    <button className={styles.savedVideoMain} type="button" onClick={() => openVideo(record)} aria-label={`Open ${record.title}`} aria-describedby={`saved-video-${record.id}-metadata`}>
                      <SavedVideoThumbnail record={record} localVideoUrl={localVideoUrls[record.id]} />
                      <span className={styles.savedVideoCopy}>
                        <SavedVideoSourceIcon record={record} />
                        <span className={styles.savedVideoText}>
                          <strong>{record.title}</strong>
                          <small id={`saved-video-${record.id}-metadata`}>{formatSource(record)} <span aria-hidden="true">·</span> {Math.round(record.progress * 100)}% watched</small>
                        </span>
                      </span>
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
