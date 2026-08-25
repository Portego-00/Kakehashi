"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, ListMusic, LoaderCircle, Music2, Pause, Play, Plus, Search, Trash2 } from "lucide-react";
import { JapaneseReader } from "./JapaneseReader";
import { buildLyricsQuiz, parseYouTubeId } from "./lyrics";
import { formatTrackDuration, type LyricsPayload, type MusicTrack, type YouTubeVideo } from "./music-providers";
import { parseLrc, plainLyricsToLines } from "./parsers";
import { ContentHeader, ContentPage, EmptyState, Panel, Progress, SectionHead, formatTime } from "./ui";
import { createLocalId, loadLibrary, saveLibrary, upsertRecord } from "./storage";
import type { ContentRecord } from "./types";
import { useFirstContentReveal } from "./useFirstContentReveal";
import { YouTubePlayer, type YouTubePlayerHandle } from "./YouTubePlayer";
import styles from "./content.module.css";

interface SearchPayload { provider: "spotify"; tracks: MusicTrack[]; error?: string }
interface ImportPayload { track: MusicTrack; lyrics: LyricsPayload; video: YouTubeVideo | null; videos: YouTubeVideo[]; videoWarning: string | null; error?: string }
type Feedback = { tone: "error" | "notice"; text: string } | null;

function linesForRecord(record: ContentRecord | null) {
  if (!record?.text) return [];
  const timed = parseLrc(record.text);
  return timed.length ? timed : plainLyricsToLines(record.text);
}

function safeAlbumArt(value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "i.scdn.co" ? url.toString() : null;
  } catch { return null; }
}

async function readPayload<T extends { error?: string }>(response: Response) {
  const payload = await response.json().catch(() => ({})) as T;
  if (!response.ok) throw new Error(payload.error || `Request failed with HTTP ${response.status}.`);
  return payload;
}

export function MusicWorkspace() {
  const firstLibraryReveal = useFirstContentReveal();
  const [songs, setSongs] = useState<ContentRecord[]>(() => loadLibrary("song"));
  const [activeId, setActiveId] = useState<string | null>(() => loadLibrary("song")[0]?.id ?? null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MusicTrack[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [track, setTrack] = useState("");
  const [artist, setArtist] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [manualLyrics, setManualLyrics] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [lyricsOffsetMs, setLyricsOffsetMs] = useState(0);
  const [quizMode, setQuizMode] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answer, setAnswer] = useState<string | null>(null);
  const searchAbortRef = useRef<AbortController | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);
  const playerRef = useRef<YouTubePlayerHandle>(null);

  const activeSong = songs.find((song) => song.id === activeId) ?? null;
  const lines = useMemo(() => linesForRecord(activeSong), [activeSong]);
  const questions = useMemo(() => buildLyricsQuiz(lines), [lines]);
  const lyricTimeMs = Math.max(0, elapsedMs - lyricsOffsetMs);
  const currentLine = lines.find((line) => lyricTimeMs >= line.startMs && lyricTimeMs < line.endMs) ?? lines[0] ?? null;
  const youtubeId = typeof activeSong?.metadata?.youtubeId === "string" ? activeSong.metadata.youtubeId : null;

  useEffect(() => () => {
    searchAbortRef.current?.abort();
    importAbortRef.current?.abort();
  }, []);

  const handlePlayerTime = useCallback((nextElapsedMs: number, nextDurationMs: number) => {
    setElapsedMs(nextElapsedMs);
    if (nextDurationMs > 0) setDurationMs(nextDurationMs);
  }, []);
  const handlePlaying = useCallback((nextPlaying: boolean) => setPlaying(nextPlaying), []);

  function saveSong(payload: {
    title: string;
    artist: string;
    lyrics: string;
    youtubeId?: string | null;
    durationMs?: number;
    spotify?: MusicTrack | null;
    lrclib?: LyricsPayload | null;
  }) {
    const now = new Date().toISOString();
    const record: ContentRecord = {
      id: createLocalId("song"),
      kind: "song",
      title: payload.title || "Untitled song",
      text: payload.lyrics,
      assetIds: [],
      createdAt: now,
      updatedAt: now,
      progress: 0,
      metadata: {
        artist: payload.artist,
        youtubeId: payload.youtubeId ?? null,
        durationMs: payload.durationMs ?? 0,
        spotifyId: payload.spotify?.id ?? null,
        spotifyUrl: payload.spotify?.spotifyUrl ?? null,
        albumArt: payload.spotify?.albumArt ?? null,
        albumName: payload.spotify?.albumName ?? payload.lrclib?.albumName ?? "",
        releaseDate: payload.spotify?.releaseDate ?? "",
        lrclibId: payload.lrclib?.id ?? null,
      },
    };
    const next = upsertRecord(record);
    setSongs(next);
    setActiveId(record.id);
    setElapsedMs(0);
    setDurationMs(payload.durationMs ?? 0);
    setPlaying(false);
    setLyricsOffsetMs(0);
    setQuizMode(false);
    setQuestionIndex(0);
  }

  async function searchSongs(event: FormEvent) {
    event.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    searchAbortRef.current?.abort();
    const controller = new AbortController();
    searchAbortRef.current = controller;
    setSearching(true);
    setFeedback(null);
    try {
      const response = await fetch("/music/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });
      const payload = await readPayload<SearchPayload>(response);
      setSearchResults(payload.tracks);
      if (!payload.tracks.length) setFeedback({ tone: "notice", text: "Spotify did not return any matching tracks." });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setSearchResults([]);
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Spotify song search is unavailable." });
    } finally {
      if (searchAbortRef.current === controller) setSearching(false);
    }
  }

  async function importSong(selectedTrack: MusicTrack, youtubeOverride?: string | null) {
    importAbortRef.current?.abort();
    const controller = new AbortController();
    importAbortRef.current = controller;
    setImportingId(selectedTrack.id || "manual");
    setFeedback(null);
    try {
      const response = await fetch("/music/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ track: selectedTrack }),
        signal: controller.signal,
      });
      const payload = await readPayload<ImportPayload>(response);
      saveSong({
        title: payload.lyrics.trackName || selectedTrack.title,
        artist: payload.lyrics.artistName || selectedTrack.artist,
        lyrics: payload.lyrics.syncedLyrics || payload.lyrics.plainLyrics,
        youtubeId: youtubeOverride || payload.video?.videoId || null,
        durationMs: selectedTrack.durationMs || payload.lyrics.duration * 1_000,
        spotify: selectedTrack.id ? selectedTrack : null,
        lrclib: payload.lyrics,
      });
      if (payload.videoWarning && !youtubeOverride) setFeedback({ tone: "notice", text: `${payload.videoWarning} The lyrics are ready without video.` });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "This song could not be imported." });
    } finally {
      if (importAbortRef.current === controller) setImportingId(null);
    }
  }

  async function searchLyrics(event: FormEvent) {
    event.preventDefault();
    const title = track.trim();
    const performer = artist.trim();
    if (!title && !sourceUrl.trim()) {
      setFeedback({ tone: "error", text: "Enter a track title or LRCLIB URL." });
      return;
    }
    setManualLoading(true);
    setFeedback(null);
    try {
      if (!sourceUrl.trim()) {
        await importSong({ id: "", title, artist: performer, artistId: "", albumArt: "", spotifyUrl: "", previewUrl: null, durationMs: 0, albumName: "", releaseDate: "" }, parseYouTubeId(youtubeUrl));
        return;
      }
      const query = new URLSearchParams({ url: sourceUrl.trim() });
      const payload = await readPayload<LyricsPayload & { error?: string }>(await fetch(`/music/lrclib?${query}`));
      saveSong({
        title: payload.trackName || title,
        artist: payload.artistName || performer,
        lyrics: payload.syncedLyrics || payload.plainLyrics,
        youtubeId: parseYouTubeId(youtubeUrl),
        durationMs: payload.duration * 1_000,
        lrclib: payload,
      });
    } catch (error) {
      setFeedback({ tone: "error", text: error instanceof Error ? error.message : "Lyrics were not found." });
    } finally { setManualLoading(false); }
  }

  function saveManual(event: FormEvent) {
    event.preventDefault();
    if (!manualLyrics.trim()) {
      setFeedback({ tone: "error", text: "Paste plain lyrics or LRC-formatted lyrics first." });
      return;
    }
    saveSong({ title: track.trim() || "Manual lyrics", artist: artist.trim(), lyrics: manualLyrics.trim(), youtubeId: parseYouTubeId(youtubeUrl) });
    setFeedback(null);
  }

  function removeSong(song: ContentRecord) {
    const next = songs.filter((item) => item.id !== song.id);
    saveLibrary("song", next);
    setSongs(next);
    if (activeId === song.id) setActiveId(next[0]?.id ?? null);
  }

  function chooseAnswer(option: string) {
    setAnswer(option);
    if (option === questions[questionIndex]?.answer) {
      const next = Math.min(questions.length - 1, questionIndex + 1);
      window.setTimeout(() => { setQuestionIndex(next); setAnswer(null); }, 500);
    }
  }

  function seekToLyric(startMs: number) {
    const target = Math.max(0, startMs + lyricsOffsetMs);
    setElapsedMs(target);
    playerRef.current?.seekTo(target);
    setPlaying(false);
  }

  const question = questions[questionIndex];
  const searchPanel = (
    <Panel className={styles.musicSearchPanel}>
      <SectionHead title="Find a song" detail={<a href="https://open.spotify.com" target="_blank" rel="noreferrer">Spotify catalog <ExternalLink size={13} aria-hidden="true" /></a>} />
      <form className={styles.musicSearchForm} onSubmit={(event) => void searchSongs(event)}>
        <div className={styles.searchInputWrap}>
          <Search size={18} aria-hidden="true" />
          <input className={styles.input} value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Song, artist, or album" aria-label="Search Spotify songs" />
        </div>
        <button className={styles.button} type="submit" disabled={searching || !searchQuery.trim()}>{searching ? <><LoaderCircle className={styles.spin} size={17} aria-hidden="true" />Searching…</> : "Search songs"}</button>
      </form>
      {searching ? <div className={styles.trackResults} aria-label="Searching Spotify">{[0, 1, 2].map((item) => <div className={styles.trackSkeleton} key={item}><span /><div><i /><i /></div></div>)}</div> : null}
      {!searching && searchResults.length ? <div className={styles.trackResults} aria-label="Spotify search results">{searchResults.map((result) => <button className={styles.trackCard} type="button" key={result.id} onClick={() => void importSong(result)} disabled={importingId !== null}>
        <span className={styles.trackArt}>{result.albumArt ? <Image src={result.albumArt} alt="" width={72} height={72} sizes="72px" unoptimized /> : <Music2 size={22} aria-hidden="true" />}</span>
        <span className={styles.trackCopy}><strong>{result.title}</strong><span>{result.artist}</span><small>{result.albumName}</small></span>
        <span className={styles.trackDuration}>{importingId === result.id ? <LoaderCircle className={styles.spin} size={18} aria-label="Importing song" /> : formatTrackDuration(result.durationMs)}</span>
      </button>)}</div> : null}
    </Panel>
  );

  return <ContentPage variant="media">
    <ContentHeader title="Songs & lyrics" description="Search Spotify, match an embeddable YouTube video, and practice time-synced Japanese lyrics from LRCLIB." />
    {feedback ? <p className={feedback.tone === "error" ? styles.errorNotice : styles.notice} role={feedback.tone === "error" ? "alert" : "status"}>{feedback.text}</p> : null}
    {activeSong ? <div className={styles.mediaGrid}>
      <div className={styles.workspace}>
        {youtubeId ? <YouTubePlayer ref={playerRef} videoId={youtubeId} title={`${activeSong.title} on YouTube`} onPlayingChange={handlePlaying} onTimeChange={handlePlayerTime} /> : <Panel><EmptyState title="No YouTube match">The lyrics and quiz remain available. Import another version with a YouTube link if you want playback.</EmptyState></Panel>}
        <Panel>
          <SectionHead title={activeSong.title} detail={String(activeSong.metadata?.artist || "")} />
          <div className={styles.toolbar}>
            {youtubeId ? <button className={styles.button} type="button" onClick={() => { if (playing) playerRef.current?.pause(); else playerRef.current?.play(); }}>{playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}{playing ? "Pause" : "Play"}</button> : null}
            {youtubeId ? <button className={styles.secondaryButton} type="button" onClick={() => { playerRef.current?.seekTo(0); setElapsedMs(0); }}>Restart</button> : null}
            <span className={styles.meta}>{formatTime(elapsedMs)}{durationMs > 0 ? ` / ${formatTime(durationMs)}` : ""}</span>
            <button className={styles.secondaryButton} type="button" disabled={!questions.length} onClick={() => setQuizMode((value) => !value)}>{quizMode ? "Show lyrics" : "Quiz mode"}</button>
          </div>
          {youtubeId && lines.some((line) => line.startMs > 0) ? <div className={styles.offsetControl} aria-label="Lyrics timing offset"><span>Lyrics offset</span><button type="button" onClick={() => setLyricsOffsetMs((value) => value - 500)}>−0.5s</button><strong>{lyricsOffsetMs > 0 ? "+" : ""}{(lyricsOffsetMs / 1_000).toFixed(1)}s</strong><button type="button" onClick={() => setLyricsOffsetMs((value) => value + 500)}>+0.5s</button><button type="button" onClick={() => setLyricsOffsetMs(0)} disabled={lyricsOffsetMs === 0}>Reset</button></div> : null}
          {quizMode && question ? <div className={styles.workspace}><p className={styles.quizPrompt} lang="ja">{question.before}<span className={styles.blank}>{question.answer}</span>{question.after}</p><div className={styles.answerGrid}>{question.options.map((option) => <button key={option} className={`${styles.answer} ${answer === option ? option === question.answer ? styles.answerCorrect : styles.answerWrong : ""}`} type="button" onClick={() => chooseAnswer(option)} disabled={answer === question.answer}>{option}</button>)}</div><Progress label={`Question ${questionIndex + 1} of ${questions.length}`} value={(questionIndex + 1) / questions.length} /></div> : <div className={styles.cueList}>{lines.map((line) => <button key={line.id} type="button" className={`${styles.cue} ${currentLine?.id === line.id ? styles.cueActive : ""}`} onClick={() => seekToLyric(line.startMs)}><span className={styles.cueTime}>{formatTime(line.startMs)}</span><span lang="ja">{line.text}</span></button>)}</div>}
        </Panel>
        {currentLine ? <JapaneseReader text={currentLine.text} ariaLabel="Current lyric line" /> : null}
      </div>
      <div className={styles.workspace}>{searchPanel}<ManualImport track={track} artist={artist} sourceUrl={sourceUrl} youtubeUrl={youtubeUrl} manualLyrics={manualLyrics} loading={manualLoading || importingId === "manual"} setTrack={setTrack} setArtist={setArtist} setSourceUrl={setSourceUrl} setYoutubeUrl={setYoutubeUrl} setManualLyrics={setManualLyrics} searchLyrics={searchLyrics} saveManual={saveManual} /></div>
    </div> : <div className={styles.musicLanding}>
      <div className={styles.musicLead}><Music2 size={28} aria-hidden="true" /><div><h2>Start with the song, not the metadata</h2><p>Pick a Spotify result and Kakehashi will resolve the lyrics and closest playable video automatically.</p></div></div>
      {searchPanel}
      <details className={styles.manualDetails}><summary>Use an LRCLIB link or paste lyrics manually</summary><ManualImport track={track} artist={artist} sourceUrl={sourceUrl} youtubeUrl={youtubeUrl} manualLyrics={manualLyrics} loading={manualLoading || importingId === "manual"} setTrack={setTrack} setArtist={setArtist} setSourceUrl={setSourceUrl} setYoutubeUrl={setYoutubeUrl} setManualLyrics={setManualLyrics} searchLyrics={searchLyrics} saveManual={saveManual} /></details>
    </div>}
    {songs.length ? <section><SectionHead title="Recent songs" detail={`${songs.length} saved locally`} /><div className={styles.libraryGrid} {...firstLibraryReveal}>{songs.map((song) => {
      const albumArt = safeAlbumArt(song.metadata?.albumArt);
      return <article className={styles.libraryItem} key={song.id}>{albumArt ? <Image className={styles.libraryAlbumArt} src={albumArt} alt="" width={52} height={52} unoptimized /> : <ListMusic aria-hidden="true" />}<h3>{song.title}</h3><p>{String(song.metadata?.artist || "Unknown artist")}</p><div className={styles.libraryActions}><button className={styles.secondaryButton} type="button" onClick={() => { setActiveId(song.id); setElapsedMs(0); setPlaying(false); }}>Practice</button><button className={styles.iconButton} type="button" onClick={() => removeSong(song)} aria-label={`Remove ${song.title}`}><Trash2 size={16} aria-hidden="true" /></button></div></article>;
    })}</div></section> : null}
  </ContentPage>;
}

function ManualImport({ track, artist, sourceUrl, youtubeUrl, manualLyrics, loading, setTrack, setArtist, setSourceUrl, setYoutubeUrl, setManualLyrics, searchLyrics, saveManual }: {
  track: string;
  artist: string;
  sourceUrl: string;
  youtubeUrl: string;
  manualLyrics: string;
  loading: boolean;
  setTrack: (value: string) => void;
  setArtist: (value: string) => void;
  setSourceUrl: (value: string) => void;
  setYoutubeUrl: (value: string) => void;
  setManualLyrics: (value: string) => void;
  searchLyrics: (event: FormEvent) => Promise<void>;
  saveManual: (event: FormEvent) => void;
}) {
  return <div className={styles.manualGrid}>
    <Panel><SectionHead title="LRCLIB override" detail={<a href="https://lrclib.net" target="_blank" rel="noreferrer">Open LRCLIB <ExternalLink size={13} aria-hidden="true" /></a>} /><form className={styles.workspace} onSubmit={(event) => void searchLyrics(event)}><div className={styles.field}><label htmlFor="manual-track">Track</label><input id="manual-track" className={styles.input} value={track} onChange={(event) => setTrack(event.target.value)} /></div><div className={styles.field}><label htmlFor="manual-artist">Artist</label><input id="manual-artist" className={styles.input} value={artist} onChange={(event) => setArtist(event.target.value)} /></div><div className={styles.field}><label htmlFor="lrclib-url">Or LRCLIB get URL</label><input id="lrclib-url" className={styles.input} type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://lrclib.net/api/get/…" /></div><div className={styles.field}><label htmlFor="youtube-url">Optional YouTube override</label><input id="youtube-url" className={styles.input} type="url" value={youtubeUrl} onChange={(event) => setYoutubeUrl(event.target.value)} placeholder="Automatic when left blank" /></div><button className={styles.button} type="submit" disabled={loading}>{loading ? <><LoaderCircle className={styles.spin} size={17} aria-hidden="true" />Resolving…</> : "Resolve song"}</button></form></Panel>
    <Panel><SectionHead title="Manual lyrics" detail="Plain text or LRC" /><form className={styles.workspace} onSubmit={saveManual}><textarea className={styles.textarea} aria-label="Manual lyrics" lang="ja" value={manualLyrics} onChange={(event) => setManualLyrics(event.target.value)} placeholder="[00:12.50] 歌詞…" /><button className={styles.secondaryButton} type="submit"><Plus size={16} aria-hidden="true" />Save manual song</button></form></Panel>
  </div>;
}
