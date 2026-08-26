"use client";

import Image from "next/image";
import {
  type FormEvent,
  type MutableRefObject,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  BookOpenText,
  Check,
  Clock3,
  ListMusic,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Music2,
  Pause,
  Play,
  RefreshCw,
  Search,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { JapaneseReader } from "./JapaneseReader";
import { buildLyricsQuiz } from "./lyrics";
import { formatTrackDuration, type LyricsPayload, type MusicTrack, type YouTubeVideo } from "./music-providers";
import { parseLrc, plainLyricsToLines } from "./parsers";
import { ContentPage, Progress, UndoNotice, formatTime } from "./ui";
import { createLocalId, loadLibrary, saveLibrary, upsertRecord } from "./storage";
import type { ContentRecord, TimedLyricLine } from "./types";
import { YouTubePlayer, type YouTubePlayerHandle } from "./YouTubePlayer";
import styles from "./content.module.css";

interface SearchPayload { provider: "spotify"; tracks: MusicTrack[]; error?: string }
interface DiscoverySection { id: string; title: string; tracks: MusicTrack[] }
interface DiscoveryPayload { sections: DiscoverySection[]; error?: string }
interface ImportPayload {
  track: MusicTrack;
  lyrics: LyricsPayload | null;
  lyricsResults: LyricsPayload[];
  lyricsWarning: string | null;
  video: YouTubeVideo | null;
  videos: YouTubeVideo[];
  videoWarning: string | null;
  error?: string;
}
type Feedback = { tone: "error" | "notice"; text: string } | null;
type ResolutionState = "idle" | "loading" | "ready" | "error";
type MatchSource = "all" | "lyrics" | "video";

function lyricsForRecord(record: ContentRecord | null) {
  if (!record?.text) return { lines: [] as TimedLyricLine[], timed: false };
  const timed = parseLrc(record.text);
  return timed.length
    ? { lines: timed, timed: true }
    : { lines: plainLyricsToLines(record.text), timed: false };
}

function safeAlbumArt(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "i.scdn.co" ? url.toString() : null;
  } catch { return null; }
}

function safeYouTubeThumbnail(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "i.ytimg.com" && url.pathname.startsWith("/vi/") ? url.toString() : null;
  } catch { return null; }
}

async function readPayload<T extends { error?: string }>(response: Response) {
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) throw new Error(payload.error || `Request failed with HTTP ${response.status}.`);
  return payload;
}

function trackForRecord(record: ContentRecord): MusicTrack {
  const metadata = record.metadata ?? {};
  return {
    id: typeof metadata.spotifyId === "string" ? metadata.spotifyId : record.id,
    title: record.title,
    artist: typeof metadata.artist === "string" ? metadata.artist : "",
    artistId: "",
    albumArt: typeof metadata.albumArt === "string" ? metadata.albumArt : "",
    spotifyUrl: typeof metadata.spotifyUrl === "string" ? metadata.spotifyUrl : "",
    previewUrl: null,
    durationMs: typeof metadata.durationMs === "number" ? metadata.durationMs : 0,
    albumName: typeof metadata.albumName === "string" ? metadata.albumName : "",
    releaseDate: typeof metadata.releaseDate === "string" ? metadata.releaseDate : "",
  };
}

function recordForTrack(track: MusicTrack, options: { lyrics?: LyricsPayload | null; youtubeId?: string | null } = {}): ContentRecord {
  const now = new Date().toISOString();
  const lyrics = options.lyrics;
  return {
    id: createLocalId("song"),
    kind: "song" as const,
    title: lyrics?.trackName || track.title || "Untitled song",
    text: lyrics?.syncedLyrics || lyrics?.plainLyrics || "",
    assetIds: [],
    createdAt: now,
    updatedAt: now,
    progress: 0,
    metadata: {
      artist: lyrics?.artistName || track.artist,
      youtubeId: options.youtubeId ?? null,
      durationMs: track.durationMs || (lyrics?.duration ?? 0) * 1_000,
      spotifyId: track.id || null,
      spotifyUrl: track.spotifyUrl || null,
      albumArt: track.albumArt || null,
      albumName: track.albumName || lyrics?.albumName || "",
      releaseDate: track.releaseDate || "",
      lrclibId: lyrics?.id ?? null,
      resolutionStatus: lyrics || options.youtubeId ? "ready" : "loading",
    },
  } satisfies ContentRecord;
}

function resetPlaybackState(
  setElapsedMs: (value: number) => void,
  setPlaying: (value: boolean) => void,
  setLyricsOffsetMs: (value: number) => void,
  setQuizMode: (value: boolean) => void,
  setQuestionIndex: (value: number) => void,
  setAnswer: (value: string | null) => void,
) {
  setElapsedMs(0);
  setPlaying(false);
  setLyricsOffsetMs(0);
  setQuizMode(false);
  setQuestionIndex(0);
  setAnswer(null);
}

export function MusicWorkspace() {
  const [songs, setSongs] = useState<ContentRecord[]>(() => loadLibrary("song"));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchedQuery, setSearchedQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MusicTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [discovery, setDiscovery] = useState<DiscoverySection[]>([]);
  const [discovering, setDiscovering] = useState(true);
  const [discoveryError, setDiscoveryError] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [lyricsOffsetMs, setLyricsOffsetMs] = useState(0);
  const [lyricsFocus, setLyricsFocus] = useState(false);
  const [quizMode, setQuizMode] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const [resolutionState, setResolutionState] = useState<ResolutionState>("idle");
  const [matchingSource, setMatchingSource] = useState<MatchSource | null>(null);
  const [videoCandidates, setVideoCandidates] = useState<YouTubeVideo[]>([]);
  const [lyricsCandidates, setLyricsCandidates] = useState<LyricsPayload[]>([]);
  const [videoSearchQuery, setVideoSearchQuery] = useState("");
  const [lyricsSearchTrack, setLyricsSearchTrack] = useState("");
  const [lyricsSearchArtist, setLyricsSearchArtist] = useState("");
  const [removedSong, setRemovedSong] = useState<ContentRecord | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const answerTimerRef = useRef<number | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const lyricLineRefs = useRef(new Map<string, HTMLElement>());
  const lyricsViewportRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayerHandle>(null);

  const activeSong = songs.find((song) => song.id === activeId) ?? null;
  const lyricsView = useMemo(() => lyricsForRecord(activeSong), [activeSong]);
  const questions = useMemo(() => buildLyricsQuiz(lyricsView.lines), [lyricsView.lines]);
  const question = questions[questionIndex] ?? null;
  const lyricTimeMs = Math.max(0, elapsedMs - lyricsOffsetMs);
  const currentLine = lyricsView.timed
    ? lyricsView.lines.find((line) => lyricTimeMs >= line.startMs && lyricTimeMs < line.endMs)
      ?? (lyricTimeMs >= (lyricsView.lines.at(-1)?.startMs ?? 0) ? lyricsView.lines.at(-1) : lyricsView.lines[0])
      ?? null
    : lyricsView.lines[0] ?? null;
  const youtubeId = typeof activeSong?.metadata?.youtubeId === "string" ? activeSong.metadata.youtubeId : null;
  const visibleSearchResults = searchedQuery === searchQuery.trim() ? searchResults : [];

  useEffect(() => () => {
    searchAbortRef.current?.abort();
    importAbortRef.current?.abort();
    if (answerTimerRef.current !== null) window.clearTimeout(answerTimerRef.current);
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/music/discover", { signal: controller.signal })
      .then((response) => readPayload<DiscoveryPayload>(response))
      .then((payload) => setDiscovery(payload.sections.filter((section) => section.tracks.length > 0)))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setDiscoveryError(error instanceof Error ? error.message : "Music recommendations are unavailable.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setDiscovering(false);
      });
    return () => controller.abort();
  }, []);

  const runSearch = useCallback(async (query: string) => {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 2) return;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearching(true);
    setFeedback(null);
    try {
      const response = await fetch("/music/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: normalizedQuery }),
        signal: controller.signal,
      });
      const payload = await readPayload<SearchPayload>(response);
      setSearchResults(payload.tracks);
      setSearchedQuery(normalizedQuery);
      if (!payload.tracks.length) setFeedback({ tone: "notice", text: `No Spotify tracks matched “${normalizedQuery}”. Try an artist or album name.` });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setSearchResults([]);
      setSearchedQuery(normalizedQuery);
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Spotify song search is unavailable." });
    } finally {
      if (searchAbortRef.current === controller) setSearching(false);
    }
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (query.length < 2) return;
    const timer = window.setTimeout(() => void runSearch(query), 250);
    return () => window.clearTimeout(timer);
  }, [runSearch, searchQuery]);

  useEffect(() => {
    if (!lyricsView.timed || !currentLine) return;
    const viewport = lyricsViewportRef.current;
    const node = lyricLineRefs.current.get(currentLine.id);
    if (!viewport || !node) return;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const viewportRect = viewport.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    const top = viewport.scrollTop
      + nodeRect.top
      - viewportRect.top
      - Math.max(0, (viewport.clientHeight - nodeRect.height) / 2);
    const nextTop = Math.max(0, top);
    if (typeof viewport.scrollTo === "function") {
      viewport.scrollTo({ top: nextTop, behavior: reducedMotion ? "auto" : "smooth" });
    } else {
      viewport.scrollTop = nextTop;
    }
  }, [currentLine, lyricsView.timed]);

  const updateSong = useCallback((songId: string, update: (song: ContentRecord) => ContentRecord) => {
    const stored = loadLibrary("song").find((song) => song.id === songId);
    if (!stored) return null;
    const nextRecord = { ...update(stored), updatedAt: new Date().toISOString() };
    const next = upsertRecord(nextRecord);
    setSongs(next);
    return nextRecord;
  }, []);

  const resolveSong = useCallback(async (
    selectedTrack: MusicTrack,
    songId: string,
    options: {
      applyBest: boolean;
      youtubeOverride?: string | null;
      source?: MatchSource;
      lyricsTrack?: string;
      lyricsArtist?: string;
      videoQuery?: string;
    },
  ) => {
    importAbortRef.current?.abort();
    const controller = new AbortController();
    const source = options.source ?? "all";
    importAbortRef.current = controller;
    setResolutionState("loading");
    setMatchingSource(source);
    setFeedback(null);
    try {
      const body = {
        track: selectedTrack,
        ...(source !== "all" ? { source } : {}),
        ...(options.lyricsTrack !== undefined ? { lyricsTrack: options.lyricsTrack } : {}),
        ...(options.lyricsArtist !== undefined ? { lyricsArtist: options.lyricsArtist } : {}),
        ...(options.videoQuery !== undefined ? { videoQuery: options.videoQuery } : {}),
      };
      const payload = await readPayload<ImportPayload>(await fetch("/music/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      }));
      const lyricMatches = payload.lyricsResults?.length ? payload.lyricsResults : payload.lyrics ? [payload.lyrics] : [];
      if (source !== "video") setLyricsCandidates(lyricMatches);
      if (source !== "lyrics") setVideoCandidates(payload.videos ?? []);
      updateSong(songId, (stored) => {
        const currentVideoId = typeof stored.metadata?.youtubeId === "string" ? stored.metadata.youtubeId : null;
        const bestLyrics = lyricMatches[0] ?? null;
        const shouldApplyLyrics = source !== "video" && (options.applyBest || !stored.text);
        const shouldApplyVideo = source !== "lyrics" && (options.applyBest || !currentVideoId);
        const nextLyrics = shouldApplyLyrics ? bestLyrics : null;
        return {
          ...stored,
          title: nextLyrics?.trackName || stored.title,
          text: nextLyrics ? nextLyrics.syncedLyrics || nextLyrics.plainLyrics : stored.text,
          metadata: {
            ...stored.metadata,
            artist: nextLyrics?.artistName || stored.metadata?.artist || selectedTrack.artist,
            youtubeId: options.youtubeOverride ?? (shouldApplyVideo ? payload.video?.videoId ?? null : currentVideoId),
            durationMs: selectedTrack.durationMs || (nextLyrics?.duration ?? 0) * 1_000 || stored.metadata?.durationMs || 0,
            lrclibId: nextLyrics?.id ?? stored.metadata?.lrclibId ?? null,
            albumName: selectedTrack.albumName || nextLyrics?.albumName || stored.metadata?.albumName || "",
            resolutionStatus: "ready",
            lyricsWarning: source !== "video" ? payload.lyricsWarning : stored.metadata?.lyricsWarning ?? null,
            videoWarning: source !== "lyrics" ? payload.videoWarning : stored.metadata?.videoWarning ?? null,
          },
        };
      });
      const warnings = [payload.lyricsWarning, payload.videoWarning].filter((warning): warning is string => Boolean(warning));
      setFeedback(warnings.length ? { tone: "notice", text: warnings.join(" ") } : null);
      setResolutionState("ready");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      updateSong(songId, (stored) => ({ ...stored, metadata: { ...stored.metadata, resolutionStatus: "error" } }));
      setResolutionState("error");
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Song sources could not be matched." });
    } finally {
      if (importAbortRef.current === controller) setMatchingSource(null);
    }
  }, [updateSong]);

  const openTrack = useCallback((selectedTrack: MusicTrack) => {
    const existing = songs.find((song) => song.metadata?.spotifyId === selectedTrack.id);
    const record = existing ?? recordForTrack(selectedTrack);
    if (!existing) setSongs(upsertRecord(record));
    setActiveId(record.id);
    setDurationMs(selectedTrack.durationMs);
    setVideoSearchQuery(`${selectedTrack.title} ${selectedTrack.artist}`.trim());
    setLyricsSearchTrack(selectedTrack.title);
    setLyricsSearchArtist(selectedTrack.artist);
    setVideoCandidates([]);
    setLyricsCandidates([]);
    setLyricsFocus(false);
    resetPlaybackState(setElapsedMs, setPlaying, setLyricsOffsetMs, setQuizMode, setQuestionIndex, setAnswer);
    void resolveSong(selectedTrack, record.id, { applyBest: !existing });
  }, [resolveSong, songs]);

  function openSavedSong(song: ContentRecord) {
    const selectedTrack = trackForRecord(song);
    setActiveId(song.id);
    setDurationMs(selectedTrack.durationMs);
    setVideoSearchQuery(`${selectedTrack.title} ${selectedTrack.artist}`.trim());
    setLyricsSearchTrack(selectedTrack.title);
    setLyricsSearchArtist(selectedTrack.artist);
    setVideoCandidates([]);
    setLyricsCandidates([]);
    setLyricsFocus(false);
    resetPlaybackState(setElapsedMs, setPlaying, setLyricsOffsetMs, setQuizMode, setQuestionIndex, setAnswer);
    void resolveSong(selectedTrack, song.id, { applyBest: false });
  }

  function returnToSearch() {
    importAbortRef.current?.abort();
    setActiveId(null);
    setResolutionState("idle");
    setMatchingSource(null);
    setFeedback(null);
    setPlaying(false);
    setLyricsFocus(false);
  }

  const handlePlayerTime = useCallback((nextElapsedMs: number, nextDurationMs: number) => {
    setElapsedMs(nextElapsedMs);
    if (nextDurationMs > 0) setDurationMs(nextDurationMs);
  }, []);
  const handlePlaying = useCallback((nextPlaying: boolean) => setPlaying(nextPlaying), []);

  function removeSong(song: ContentRecord) {
    const next = songs.filter((item) => item.id !== song.id);
    saveLibrary("song", next);
    setSongs(next);
    setRemovedSong(song);
    if (activeId === song.id) setActiveId(null);
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => setRemovedSong(null), 8_000);
  }

  function undoRemoveSong() {
    if (!removedSong) return;
    setSongs(upsertRecord(removedSong));
    setRemovedSong(null);
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
  }

  function chooseAnswer(option: string) {
    setAnswer(option);
    if (option !== question?.answer || questionIndex >= questions.length - 1) return;
    if (answerTimerRef.current !== null) window.clearTimeout(answerTimerRef.current);
    answerTimerRef.current = window.setTimeout(() => {
      setQuestionIndex((index) => Math.min(questions.length - 1, index + 1));
      setAnswer(null);
    }, 500);
  }

  function seekToLyric(startMs: number) {
    const target = Math.max(0, startMs + lyricsOffsetMs);
    setElapsedMs(target);
    playerRef.current?.seekTo(target);
  }

  function selectVideo(video: YouTubeVideo) {
    if (!activeSong) return;
    updateSong(activeSong.id, (stored) => ({ ...stored, metadata: { ...stored.metadata, youtubeId: video.videoId, videoWarning: null } }));
    setElapsedMs(0);
    setPlaying(false);
    setFeedback(null);
  }

  function selectLyrics(lyrics: LyricsPayload) {
    if (!activeSong) return;
    updateSong(activeSong.id, (stored) => ({
      ...stored,
      title: lyrics.trackName || stored.title,
      text: lyrics.syncedLyrics || lyrics.plainLyrics,
      metadata: {
        ...stored.metadata,
        artist: lyrics.artistName || stored.metadata?.artist || "",
        albumName: lyrics.albumName || stored.metadata?.albumName || "",
        lrclibId: lyrics.id,
        lyricsWarning: null,
      },
    }));
    setLyricsOffsetMs(0);
    setQuestionIndex(0);
    setAnswer(null);
    setFeedback(null);
  }

  function refreshMatches() {
    if (!activeSong) return;
    void resolveSong(trackForRecord(activeSong), activeSong.id, {
      applyBest: false,
      lyricsTrack: lyricsSearchTrack.trim(),
      lyricsArtist: lyricsSearchArtist.trim(),
      videoQuery: videoSearchQuery.trim(),
    });
  }

  function searchVideoMatches(event: FormEvent) {
    event.preventDefault();
    if (!activeSong || !videoSearchQuery.trim()) return;
    void resolveSong(trackForRecord(activeSong), activeSong.id, {
      applyBest: false,
      source: "video",
      videoQuery: videoSearchQuery.trim(),
    });
  }

  function searchLyricsMatches(event: FormEvent) {
    event.preventDefault();
    if (!activeSong || (!lyricsSearchTrack.trim() && !lyricsSearchArtist.trim())) return;
    void resolveSong(trackForRecord(activeSong), activeSong.id, {
      applyBest: false,
      source: "lyrics",
      lyricsTrack: lyricsSearchTrack.trim(),
      lyricsArtist: lyricsSearchArtist.trim(),
    });
  }

  function changeSearchQuery(value: string) {
    setSearchQuery(value);
    if (value.trim().length >= 2) return;
    searchAbortRef.current?.abort();
    setSearching(false);
    setSearchResults([]);
    setSearchedQuery("");
    setFeedback(null);
  }

  return (
    <ContentPage variant="media" className={styles.musicPage}>
      {activeSong ? (
        <SongScreen
          song={activeSong}
          youtubeId={youtubeId}
          videoCandidates={videoCandidates}
          lyricsCandidates={lyricsCandidates}
          resolutionState={resolutionState}
          matchingSource={matchingSource}
          feedback={feedback}
          elapsedMs={elapsedMs}
          durationMs={durationMs}
          playing={playing}
          playerRef={playerRef}
          onPlayingChange={handlePlaying}
          onTimeChange={handlePlayerTime}
          onTogglePlayback={() => { if (playing) playerRef.current?.pause(); else playerRef.current?.play(); }}
          onRestart={() => { playerRef.current?.seekTo(0); setElapsedMs(0); }}
          onBack={returnToSearch}
          onRefresh={refreshMatches}
          onSelectVideo={selectVideo}
          onSelectLyrics={selectLyrics}
          videoSearchQuery={videoSearchQuery}
          onVideoSearchQueryChange={setVideoSearchQuery}
          onVideoSearch={searchVideoMatches}
          lyricsSearchTrack={lyricsSearchTrack}
          lyricsSearchArtist={lyricsSearchArtist}
          onLyricsSearchTrackChange={setLyricsSearchTrack}
          onLyricsSearchArtistChange={setLyricsSearchArtist}
          onLyricsSearch={searchLyricsMatches}
          lines={lyricsView.lines}
          timed={lyricsView.timed}
          currentLine={currentLine}
          lyricLineRefs={lyricLineRefs}
          lyricsViewportRef={lyricsViewportRef}
          onSeek={seekToLyric}
          lyricsOffsetMs={lyricsOffsetMs}
          onOffsetChange={setLyricsOffsetMs}
          lyricsFocus={lyricsFocus}
          onLyricsFocusChange={setLyricsFocus}
          quizMode={quizMode}
          onQuizModeChange={setQuizMode}
          questions={questions}
          questionIndex={questionIndex}
          answer={answer}
          onAnswer={chooseAnswer}
        />
      ) : (
        <SearchScreen
          query={searchQuery}
          onQueryChange={changeSearchQuery}
          onSubmit={() => void runSearch(searchQuery)}
          onClear={() => changeSearchQuery("")}
          searching={searching}
          results={visibleSearchResults}
          searchedQuery={searchedQuery}
          feedback={feedback}
          discovery={discovery}
          discovering={discovering}
          discoveryError={discoveryError}
          savedSongs={songs}
          onTrackSelect={openTrack}
          onSavedSongSelect={openSavedSong}
          onRemoveSong={removeSong}
        />
      )}
      {removedSong ? <UndoNotice message={`${removedSong.title} was removed.`} onUndo={undoRemoveSong} /> : null}
    </ContentPage>
  );
}

function SearchScreen({ query, onQueryChange, onSubmit, onClear, searching, results, searchedQuery, feedback, discovery, discovering, discoveryError, savedSongs, onTrackSelect, onSavedSongSelect, onRemoveSong }: {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  searching: boolean;
  results: MusicTrack[];
  searchedQuery: string;
  feedback: Feedback;
  discovery: DiscoverySection[];
  discovering: boolean;
  discoveryError: string;
  savedSongs: ContentRecord[];
  onTrackSelect: (track: MusicTrack) => void;
  onSavedSongSelect: (song: ContentRecord) => void;
  onRemoveSong: (song: ContentRecord) => void;
}) {
  const hasQuery = query.trim().length > 0;
  const status = searching
    ? `Searching for ${query.trim()}`
    : searchedQuery && searchedQuery === query.trim()
      ? `${results.length} ${results.length === 1 ? "song" : "songs"} found`
      : query.trim().length === 1 ? "Type one more character to search" : "";
  return (
    <div className={styles.musicSearchScreen}>
      <h1 className={styles.visuallyHidden}>Songs &amp; lyrics</h1>
      <form className={styles.songSearchForm} role="search" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}>
        <label className={styles.visuallyHidden} htmlFor="song-search">Search songs</label>
        <Search size={18} aria-hidden="true" />
        <input
          id="song-search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Song, artist, or album"
          aria-describedby="song-search-status"
          autoComplete="off"
        />
        <span className={styles.searchEndSlot}>
          {searching ? <LoaderCircle className={styles.spin} size={17} aria-label="Searching" /> : hasQuery ? <button type="button" onClick={onClear} aria-label="Clear song search"><X size={17} aria-hidden="true" /></button> : null}
        </span>
      </form>
      <p id="song-search-status" className={styles.searchStatus} aria-live="polite">{status}</p>
      {feedback ? <p className={feedback.tone === "error" ? styles.errorNotice : styles.notice} role={feedback.tone === "error" ? "alert" : "status"}>{feedback.text}</p> : null}

      {query.trim().length >= 2 ? (
        <section className={styles.searchResultSection} aria-label="Search results">
          {searching && results.length === 0 ? <TrackResultSkeleton /> : null}
          {!searching && searchedQuery === query.trim() && results.length === 0 && !feedback ? <p className={styles.sourceEmpty}>No songs matched this search. Try the artist name or album title.</p> : null}
          {results.length ? <div className={styles.trackResults}>{results.map((result) => <TrackResult key={result.id} track={result} onSelect={onTrackSelect} />)}</div> : null}
        </section>
      ) : (
        <div className={styles.musicDiscovery}>
          {savedSongs.length ? <SavedSongsShelf songs={savedSongs} onSelect={onSavedSongSelect} onRemove={onRemoveSong} /> : null}
          {discovering ? <RecommendationSkeleton /> : null}
          {discovery.map((section) => <TrackShelf key={section.id} section={section} onSelect={onTrackSelect} />)}
          {!discovering && discovery.length === 0 && discoveryError ? <p className={styles.discoveryError}>{discoveryError} Search is still available above.</p> : null}
        </div>
      )}
    </div>
  );
}

function TrackResult({ track, onSelect }: { track: MusicTrack; onSelect: (track: MusicTrack) => void }) {
  const albumArt = safeAlbumArt(track.albumArt);
  return (
    <button className={styles.trackCard} type="button" onClick={() => onSelect(track)} aria-label={`${track.title} by ${track.artist}`}>
      <span className={styles.trackArt}>{albumArt ? <Image src={albumArt} alt="" width={72} height={72} sizes="72px" unoptimized /> : <Music2 size={22} aria-hidden="true" />}</span>
      <span className={styles.trackCopy}><strong>{track.title}</strong><span>{track.artist}</span><small>{track.albumName}</small></span>
      <span className={styles.trackDuration}>{formatTrackDuration(track.durationMs)}</span>
    </button>
  );
}

function TrackShelf({ section, onSelect }: { section: DiscoverySection; onSelect: (track: MusicTrack) => void }) {
  return (
    <section className={styles.discoverySection} aria-labelledby={`${section.id}-title`}>
      <div className={styles.musicSectionHead}><h2 id={`${section.id}-title`}>{section.title}</h2><span>Spotify</span></div>
      <div className={styles.musicShelf}>
        {section.tracks.map((track) => {
          const albumArt = safeAlbumArt(track.albumArt);
          return <button className={styles.shelfTrack} key={track.id} type="button" onClick={() => onSelect(track)} aria-label={`${track.title} by ${track.artist}`}>
            <span className={styles.shelfArt}>{albumArt ? <Image src={albumArt} alt="" width={180} height={180} sizes="(max-width: 40rem) 152px, 180px" unoptimized /> : <Music2 size={28} aria-hidden="true" />}</span>
            <strong>{track.title}</strong><span>{track.artist}</span>
          </button>;
        })}
      </div>
    </section>
  );
}

function SavedSongsShelf({ songs, onSelect, onRemove }: { songs: ContentRecord[]; onSelect: (song: ContentRecord) => void; onRemove: (song: ContentRecord) => void }) {
  return (
    <section className={styles.discoverySection} aria-labelledby="saved-songs-title">
      <div className={styles.musicSectionHead}><h2 id="saved-songs-title">Jump back in</h2><span>{songs.length} saved locally</span></div>
      <div className={styles.musicShelf}>
        {songs.map((song) => {
          const albumArt = safeAlbumArt(song.metadata?.albumArt);
          const artist = String(song.metadata?.artist || "Unknown artist");
          return <article className={styles.savedSong} key={song.id}>
            <button className={styles.shelfTrack} type="button" onClick={() => onSelect(song)} aria-label={`Open ${song.title} by ${artist}`}>
              <span className={styles.shelfArt}>{albumArt ? <Image src={albumArt} alt="" width={180} height={180} sizes="(max-width: 40rem) 152px, 180px" unoptimized /> : <ListMusic size={28} aria-hidden="true" />}</span>
              <strong>{song.title}</strong>
              <span>{artist}</span>
            </button>
            <button className={styles.savedSongRemove} type="button" onClick={() => onRemove(song)} aria-label={`Remove ${song.title}`}><Trash2 size={16} aria-hidden="true" /></button>
          </article>;
        })}
      </div>
    </section>
  );
}

function TrackResultSkeleton() {
  return <div className={styles.trackResults} aria-label="Searching Spotify">{[0, 1, 2, 3].map((item) => <div className={styles.trackSkeleton} key={item}><span /><div><i /><i /></div></div>)}</div>;
}

function RecommendationSkeleton() {
  return <section className={styles.discoverySection} aria-label="Loading music recommendations"><div className={styles.musicSectionHead}><span className={styles.skeletonHeading} /></div><div className={styles.musicShelf}>{Array.from({ length: 9 }, (_, item) => <div className={styles.shelfSkeleton} key={item}><span /><i /><i /></div>)}</div></section>;
}

function SongScreen({ song, youtubeId, videoCandidates, lyricsCandidates, resolutionState, matchingSource, feedback, elapsedMs, durationMs, playing, playerRef, onPlayingChange, onTimeChange, onTogglePlayback, onRestart, onBack, onRefresh, onSelectVideo, onSelectLyrics, videoSearchQuery, onVideoSearchQueryChange, onVideoSearch, lyricsSearchTrack, lyricsSearchArtist, onLyricsSearchTrackChange, onLyricsSearchArtistChange, onLyricsSearch, lines, timed, currentLine, lyricLineRefs, lyricsViewportRef, onSeek, lyricsOffsetMs, onOffsetChange, lyricsFocus, onLyricsFocusChange, quizMode, onQuizModeChange, questions, questionIndex, answer, onAnswer }: {
  song: ContentRecord;
  youtubeId: string | null;
  videoCandidates: YouTubeVideo[];
  lyricsCandidates: LyricsPayload[];
  resolutionState: ResolutionState;
  matchingSource: MatchSource | null;
  feedback: Feedback;
  elapsedMs: number;
  durationMs: number;
  playing: boolean;
  playerRef: RefObject<YouTubePlayerHandle | null>;
  onPlayingChange: (playing: boolean) => void;
  onTimeChange: (elapsedMs: number, durationMs: number) => void;
  onTogglePlayback: () => void;
  onRestart: () => void;
  onBack: () => void;
  onRefresh: () => void;
  onSelectVideo: (video: YouTubeVideo) => void;
  onSelectLyrics: (lyrics: LyricsPayload) => void;
  videoSearchQuery: string;
  onVideoSearchQueryChange: (value: string) => void;
  onVideoSearch: (event: FormEvent) => void;
  lyricsSearchTrack: string;
  lyricsSearchArtist: string;
  onLyricsSearchTrackChange: (value: string) => void;
  onLyricsSearchArtistChange: (value: string) => void;
  onLyricsSearch: (event: FormEvent) => void;
  lines: TimedLyricLine[];
  timed: boolean;
  currentLine: TimedLyricLine | null;
  lyricLineRefs: MutableRefObject<Map<string, HTMLElement>>;
  lyricsViewportRef: RefObject<HTMLDivElement | null>;
  onSeek: (startMs: number) => void;
  lyricsOffsetMs: number;
  onOffsetChange: (offset: number) => void;
  lyricsFocus: boolean;
  onLyricsFocusChange: (enabled: boolean) => void;
  quizMode: boolean;
  onQuizModeChange: (enabled: boolean) => void;
  questions: ReturnType<typeof buildLyricsQuiz>;
  questionIndex: number;
  answer: string | null;
  onAnswer: (option: string) => void;
}) {
  const albumArt = safeAlbumArt(song.metadata?.albumArt);
  const artist = String(song.metadata?.artist || "Unknown artist");
  return (
    <div className={styles.songScreen}>
      <header className={styles.songTopbar}>
        <button className={styles.backButton} type="button" onClick={onBack}><ArrowLeft size={18} aria-hidden="true" />Back to search</button>
        <div className={styles.songIdentity}>
          <span className={styles.songIdentityArt}>{albumArt ? <Image src={albumArt} alt="" width={56} height={56} sizes="56px" unoptimized /> : <Music2 size={22} aria-hidden="true" />}</span>
          <span><h1>{song.title}</h1><p>{artist}</p></span>
        </div>
        <button className={styles.refreshButton} type="button" onClick={onRefresh} disabled={resolutionState === "loading"}>{resolutionState === "loading" ? <LoaderCircle className={styles.spin} size={17} aria-hidden="true" /> : <RefreshCw size={17} aria-hidden="true" />}{resolutionState === "loading" ? "Matching…" : "Refresh matches"}</button>
      </header>
      {feedback ? <p className={feedback.tone === "error" ? styles.errorNotice : styles.notice} role={feedback.tone === "error" ? "alert" : "status"}>{feedback.text}</p> : null}

      <div className={styles.songStage} data-lyrics-focus={lyricsFocus || undefined}>
        <section className={styles.playerColumn} aria-label="Song video">
          {youtubeId ? <YouTubePlayer ref={playerRef} videoId={youtubeId} title={`${song.title} on YouTube`} onPlayingChange={onPlayingChange} onTimeChange={onTimeChange} /> : <div className={styles.videoEmpty}><Video size={30} aria-hidden="true" /><strong>No playable video selected</strong><p>The song workspace remains available. Adjust the video search or choose a match below.</p></div>}
          <div className={styles.playerControls}>
            <button className={styles.playButton} type="button" onClick={onTogglePlayback} disabled={!youtubeId}>{playing ? <Pause size={17} aria-hidden="true" /> : <Play size={17} aria-hidden="true" />}{playing ? "Pause" : "Play"}</button>
            <button className={styles.controlButton} type="button" onClick={onRestart} disabled={!youtubeId}>Restart</button>
            <span className={styles.playerTime}><Clock3 size={14} aria-hidden="true" />{formatTime(elapsedMs)}{durationMs > 0 ? ` / ${formatTime(durationMs)}` : ""}</span>
          </div>
        </section>

        <LyricsPanel
          lines={lines}
          timed={timed}
          currentLine={currentLine}
          lineRefs={lyricLineRefs}
          viewportRef={lyricsViewportRef}
          onSeek={onSeek}
          lyricsOffsetMs={lyricsOffsetMs}
          onOffsetChange={onOffsetChange}
          lyricsFocus={lyricsFocus}
          onLyricsFocusChange={onLyricsFocusChange}
          quizMode={quizMode}
          onQuizModeChange={onQuizModeChange}
          questions={questions}
          questionIndex={questionIndex}
          answer={answer}
          onAnswer={onAnswer}
          loading={resolutionState === "loading" && lines.length === 0}
        />
      </div>

      <div className={styles.sourcePickerGrid}>
        <VideoMatches
          videos={videoCandidates}
          selectedId={youtubeId}
          loading={resolutionState === "loading" && matchingSource !== "lyrics"}
          query={videoSearchQuery}
          onQueryChange={onVideoSearchQueryChange}
          onSearch={onVideoSearch}
          onSelect={onSelectVideo}
        />
        <LyricsMatches
          lyrics={lyricsCandidates}
          selectedId={typeof song.metadata?.lrclibId === "number" ? song.metadata.lrclibId : null}
          loading={resolutionState === "loading" && matchingSource !== "video"}
          trackQuery={lyricsSearchTrack}
          artistQuery={lyricsSearchArtist}
          onTrackQueryChange={onLyricsSearchTrackChange}
          onArtistQueryChange={onLyricsSearchArtistChange}
          onSearch={onLyricsSearch}
          onSelect={onSelectLyrics}
        />
      </div>

    </div>
  );
}

function LyricsPanel({ lines, timed, currentLine, lineRefs, viewportRef, onSeek, lyricsOffsetMs, onOffsetChange, lyricsFocus, onLyricsFocusChange, quizMode, onQuizModeChange, questions, questionIndex, answer, onAnswer, loading }: {
  lines: TimedLyricLine[];
  timed: boolean;
  currentLine: TimedLyricLine | null;
  lineRefs: MutableRefObject<Map<string, HTMLElement>>;
  viewportRef: RefObject<HTMLDivElement | null>;
  onSeek: (startMs: number) => void;
  lyricsOffsetMs: number;
  onOffsetChange: (offset: number) => void;
  lyricsFocus: boolean;
  onLyricsFocusChange: (enabled: boolean) => void;
  quizMode: boolean;
  onQuizModeChange: (enabled: boolean) => void;
  questions: ReturnType<typeof buildLyricsQuiz>;
  questionIndex: number;
  answer: string | null;
  onAnswer: (option: string) => void;
  loading: boolean;
}) {
  const activeQuestion = questions[questionIndex] ?? null;
  return (
    <section className={styles.lyricsPanel} aria-labelledby="lyrics-panel-title">
      <div className={styles.lyricsPanelHeader}>
        <div><h2 id="lyrics-panel-title">Lyrics</h2><p>{timed ? "Synced to playback" : lines.length ? "Plain lyrics" : "No lyrics selected"}</p></div>
        <div className={styles.lyricsPanelActions}>
          <button className={styles.lyricsFocusToggle} type="button" aria-pressed={lyricsFocus} onClick={() => onLyricsFocusChange(!lyricsFocus)}>
            {lyricsFocus ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}
            {lyricsFocus ? "Balanced view" : "Focus lyrics"}
          </button>
          <button className={styles.quizToggle} type="button" disabled={!questions.length} aria-pressed={quizMode} onClick={() => onQuizModeChange(!quizMode)}>{quizMode ? "Exit quiz" : "Quiz mode"}</button>
        </div>
      </div>
      {timed ? <div className={styles.offsetControl} aria-label="Lyrics timing offset"><span>Offset</span><button type="button" onClick={() => onOffsetChange(lyricsOffsetMs - 500)}>−0.5s</button><strong>{lyricsOffsetMs > 0 ? "+" : ""}{(lyricsOffsetMs / 1_000).toFixed(1)}s</strong><button type="button" onClick={() => onOffsetChange(lyricsOffsetMs + 500)}>+0.5s</button><button type="button" onClick={() => onOffsetChange(0)} disabled={lyricsOffsetMs === 0}>Reset</button></div> : null}
      {quizMode && questions.length ? <Progress label={`Question ${questionIndex + 1} of ${questions.length}`} value={(questionIndex + 1) / questions.length} /> : null}
      <div ref={viewportRef} className={styles.lyricsViewport} role="region" aria-label="Song lyrics" aria-live={loading ? "polite" : "off"}>
        {loading ? <div className={styles.lyricsSkeleton} aria-label="Matching lyrics">{[0, 1, 2, 3, 4, 5].map((item) => <span key={item} />)}</div> : null}
        {!loading && !lines.length ? <div className={styles.lyricsEmpty}><Music2 size={28} aria-hidden="true" /><strong>Lyrics weren’t found</strong><p>You can still play the video or adjust the lyrics search below.</p></div> : null}
        {lines.map((line, lineIndex) => {
          const isCurrent = timed && currentLine?.id === line.id;
          const isQuizLine = quizMode && activeQuestion?.lineIndex === lineIndex;
          const correct = isQuizLine && answer === activeQuestion?.answer;
          return <article
            className={`${styles.lyricLine} ${isCurrent ? styles.lyricLineActive : ""} ${isQuizLine ? styles.lyricLineQuestion : ""}`}
            key={line.id}
            ref={(node) => { if (node) lineRefs.current.set(line.id, node); else lineRefs.current.delete(line.id); }}
            aria-current={isCurrent ? "true" : undefined}
          >
            <div className={styles.lyricLineMain}>
              {timed ? <button className={styles.lyricTimeButton} type="button" onClick={() => onSeek(line.startMs)} aria-label={`Seek to ${formatTime(line.startMs)}`}>{formatTime(line.startMs)}</button> : <span className={styles.lyricUntimedMarker} aria-hidden="true" />}
              {isCurrent && !isQuizLine ? <div className={styles.lyricStudyInline}>
                <span className={styles.lyricStudyHeading}><BookOpenText size={14} aria-hidden="true" /><strong>Study current line</strong><small>Hover or focus a highlighted word</small></span>
                <JapaneseReader text={line.text} ariaLabel="Current lyric line" interaction="tooltip" />
              </div> : <p lang="ja">{isQuizLine && activeQuestion ? <>{activeQuestion.before}<span className={`${styles.blank} ${correct ? styles.blankRevealed : ""}`}>{correct ? activeQuestion.answer : "＿".repeat(Math.max(2, activeQuestion.answer.length))}</span>{activeQuestion.after}</> : line.text}</p>}
            </div>
            {isQuizLine && activeQuestion && !correct ? <div className={styles.answerGrid}>{activeQuestion.options.map((option, index) => <button key={option} className={`${styles.answer} ${answer === option ? styles.answerWrong : ""}`} type="button" onClick={() => onAnswer(option)}><span>{String.fromCharCode(65 + index)}</span>{option}</button>)}</div> : null}
          </article>;
        })}
      </div>
    </section>
  );
}

function VideoMatches({ videos, selectedId, loading, query, onQueryChange, onSearch, onSelect }: {
  videos: YouTubeVideo[];
  selectedId: string | null;
  loading: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onSearch: (event: FormEvent) => void;
  onSelect: (video: YouTubeVideo) => void;
}) {
  return (
    <section className={styles.sourcePicker} aria-labelledby="video-matches-title">
      <div className={styles.musicSectionHead}><h2 id="video-matches-title">Video matches</h2><span>YouTube</span></div>
      <form className={styles.sourceSearchForm} role="search" onSubmit={onSearch}>
        <label htmlFor="video-match-search">Video search</label>
        <div className={styles.sourceSearchRow}>
          <span className={styles.sourceSearchInput}><Search size={17} aria-hidden="true" /><input id="video-match-search" value={query} onChange={(event) => onQueryChange(event.target.value)} autoComplete="off" /></span>
          <button className={styles.sourceSearchButton} type="submit" disabled={loading || !query.trim()}>{loading ? <LoaderCircle className={styles.spin} size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}{loading ? "Searching…" : "Search"}</button>
        </div>
      </form>
      {loading && !videos.length ? <SourceSkeleton /> : null}
      {!loading && !videos.length ? <p className={styles.sourceEmpty}>No videos matched. Adjust the search above and try again.</p> : null}
      <div className={styles.sourceResults}>{videos.map((video) => {
        const thumbnail = safeYouTubeThumbnail(video.thumbnailUrl);
        const selected = selectedId === video.videoId;
        return <button className={styles.sourceResult} type="button" key={video.videoId} data-selected={selected || undefined} aria-pressed={selected} onClick={() => onSelect(video)}>
          <span className={styles.videoThumbnail}>{thumbnail ? <Image src={thumbnail} alt="" width={160} height={90} sizes="112px" unoptimized /> : <Video size={22} aria-hidden="true" />}</span>
          <span className={styles.sourceResultCopy}><strong>{video.title}</strong><small>{video.channelTitle}</small><span>{formatTrackDuration(video.duration * 1_000)}</span></span>
          {selected ? <Check size={17} aria-label="Selected video" /> : null}
        </button>;
      })}</div>
    </section>
  );
}

function lyricsPreviewLines(result: LyricsPayload) {
  const plainLines = result.plainLyrics.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (plainLines.length) return plainLines.slice(0, 2);
  return result.syncedLyrics ? parseLrc(result.syncedLyrics).map((line) => line.text.trim()).filter(Boolean).slice(0, 2) : [];
}

function LyricsMatches({ lyrics, selectedId, loading, trackQuery, artistQuery, onTrackQueryChange, onArtistQueryChange, onSearch, onSelect }: {
  lyrics: LyricsPayload[];
  selectedId: number | null;
  loading: boolean;
  trackQuery: string;
  artistQuery: string;
  onTrackQueryChange: (value: string) => void;
  onArtistQueryChange: (value: string) => void;
  onSearch: (event: FormEvent) => void;
  onSelect: (lyrics: LyricsPayload) => void;
}) {
  return (
    <section className={styles.sourcePicker} aria-labelledby="lyrics-matches-title">
      <div className={styles.musicSectionHead}><h2 id="lyrics-matches-title">Lyrics matches</h2><span>LRCLIB</span></div>
      <form className={styles.sourceSearchForm} role="search" onSubmit={onSearch}>
        <div className={styles.sourceSearchFields}>
          <label htmlFor="lyrics-track-search">Song<input id="lyrics-track-search" aria-label="Lyrics song" value={trackQuery} onChange={(event) => onTrackQueryChange(event.target.value)} autoComplete="off" /></label>
          <label htmlFor="lyrics-artist-search">Artist<input id="lyrics-artist-search" aria-label="Lyrics artist" value={artistQuery} onChange={(event) => onArtistQueryChange(event.target.value)} autoComplete="off" /></label>
        </div>
        <button className={styles.sourceSearchButton} type="submit" disabled={loading || (!trackQuery.trim() && !artistQuery.trim())}>{loading ? <LoaderCircle className={styles.spin} size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}{loading ? "Searching…" : "Search lyrics"}</button>
      </form>
      {loading && !lyrics.length ? <SourceSkeleton /> : null}
      {!loading && !lyrics.length ? <p className={styles.sourceEmpty}>No lyrics matched. Adjust the song or artist above and try again.</p> : null}
      <div className={styles.sourceResults}>{lyrics.map((result, index) => {
        const selected = result.id !== null ? selectedId === result.id : index === 0 && selectedId === null;
        const preview = lyricsPreviewLines(result);
        return <button className={styles.sourceResult} type="button" key={result.id ?? `${result.trackName}-${result.artistName}-${index}`} data-selected={selected || undefined} aria-pressed={selected} onClick={() => onSelect(result)}>
          <span className={styles.lyricsSourceIcon}><ListMusic size={20} aria-hidden="true" /></span>
          <span className={styles.sourceResultCopy}>
            <strong>{result.trackName || "Untitled lyrics"}</strong>
            <small>{result.artistName || "Unknown artist"}</small>
            {preview.length ? <span className={styles.lyricsResultPreview} lang="ja">{preview.map((line, lineIndex) => <span key={`${line}-${lineIndex}`}>{line}</span>)}</span> : null}
            <span className={styles.sourceResultMeta}>{result.syncedLyrics ? "Timed lyrics" : "Plain lyrics"}{result.albumName ? ` · ${result.albumName}` : ""}</span>
          </span>
          {selected ? <Check size={17} aria-label="Selected lyrics" /> : null}
        </button>;
      })}</div>
    </section>
  );
}

function SourceSkeleton() {
  return <div className={styles.sourceSkeleton} aria-label="Matching sources">{[0, 1, 2].map((item) => <div key={item}><span /><i /><i /></div>)}</div>;
}
