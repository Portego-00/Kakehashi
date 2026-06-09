"use client";

import {
  getJpdbTokensForSlice,
  HighlightedJapaneseText,
  JapaneseStudyToolbar,
  useJapaneseStudyText,
  VocabularyTooltip,
} from "@/components/JapaneseStudyText";
import { getLyricsById, searchLyrics, type LyricsResult, type LyricsSearchResult } from "@/lib/lrclib";
import {
  getYouTubeApiKey,
  searchYouTubeMusicVideos,
  type YouTubeSearchResult,
} from "@/lib/youtube";
import { ExternalLink, Loader2, Music2, Play, Search } from "lucide-react";
import { type FormEvent, useMemo, useState } from "react";

type LyricsBlock = {
  key: string;
  prefix?: string;
  text: string;
};

export default function SongsPage() {
  const [trackName, setTrackName] = useState("");
  const [artistName, setArtistName] = useState("");
  const [lyricsResults, setLyricsResults] = useState<LyricsSearchResult[]>([]);
  const [youtubeResults, setYoutubeResults] = useState<YouTubeSearchResult[]>([]);
  const [selectedLyrics, setSelectedLyrics] = useState<LyricsResult | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<YouTubeSearchResult | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const lyricsBlocks = useMemo(() => buildLyricsBlocks(selectedLyrics), [selectedLyrics]);
  const lyricsText = useMemo(
    () => lyricsBlocks.map((block) => block.text).join("\n"),
    [lyricsBlocks]
  );
  const lyricsOffsets = useMemo(() => {
    let cursor = 0;
    return lyricsBlocks.map((block) => {
      const start = cursor;
      cursor += block.text.length + 1;
      return start;
    });
  }, [lyricsBlocks]);
  const study = useJapaneseStudyText(lyricsText, {
    enabled: Boolean(lyricsText.trim()),
  });

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = `${trackName} ${artistName}`.trim();
    if (!query) {
      setMessage("Enter a song title, artist, or both.");
      return;
    }

    setStatus("loading");
    setMessage(null);
    setSelectedLyrics(null);
    setSelectedVideo(null);

    try {
      const apiKey = getYouTubeApiKey();
      const [nextLyrics, nextVideos] = await Promise.all([
        searchLyrics(trackName, artistName),
        apiKey ? searchYouTubeMusicVideos(query, apiKey, 8) : Promise.resolve([]),
      ]);

      setLyricsResults(nextLyrics);
      setYoutubeResults(nextVideos);
      setSelectedVideo(nextVideos[0] ?? null);
      setStatus("idle");

      if (!apiKey) {
        setMessage("Set NEXT_PUBLIC_YOUTUBE_API_KEY to enable YouTube search.");
      } else if (nextLyrics.length === 0 && nextVideos.length === 0) {
        setMessage("No lyrics or YouTube videos found.");
      }
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Song search failed.");
    }
  }

  async function handleLyricsPick(result: LyricsSearchResult) {
    setMessage(null);
    setSelectedLyrics(null);
    try {
      setSelectedLyrics(await getLyricsById(result.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load lyrics.");
    }
  }

  return (
    <section>
      <div>
        <p className="text-sm font-medium text-sakura-300">Songs</p>
        <h1 className="mt-2 text-3xl font-bold md:text-4xl">YouTube + LRCLIB</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
          Search a song, pick a YouTube video, and load synced lyrics from
          LRCLIB. Apple Music and Spotify stay out of the web port for now.
        </p>
      </div>

      <form
        className="mt-8 grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-5 md:grid-cols-[1fr_1fr_auto]"
        onSubmit={handleSearch}
      >
        <input
          className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-sakura-300"
          onChange={(event) => setTrackName(event.target.value)}
          placeholder="Song title"
          value={trackName}
        />
        <input
          className="rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-sakura-300"
          onChange={(event) => setArtistName(event.target.value)}
          placeholder="Artist"
          value={artistName}
        />
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-sakura-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-sakura-400 disabled:cursor-not-allowed disabled:bg-sakura-500/60"
          disabled={status === "loading"}
          type="submit"
        >
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </form>

      {message ? (
        <p className="mt-5 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          {message}
        </p>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Play className="h-5 w-5 text-sakura-300" />
            YouTube
          </h2>
          {selectedVideo ? (
            <div className="mt-5 overflow-hidden rounded-lg border border-white/10 bg-black">
              <iframe
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                className="aspect-video w-full"
                src={`https://www.youtube.com/embed/${selectedVideo.videoId}`}
                title={selectedVideo.title}
              />
            </div>
          ) : null}
          <div className="mt-5 grid gap-3">
            {youtubeResults.map((video) => (
              <button
                className={[
                  "grid gap-3 rounded-lg border p-3 text-left transition-colors md:grid-cols-[96px_1fr]",
                  selectedVideo?.videoId === video.videoId
                    ? "border-sakura-300/60 bg-sakura-300/10"
                    : "border-white/10 bg-black/10 hover:border-white/20",
                ].join(" ")}
                key={video.videoId}
                onClick={() => setSelectedVideo(video)}
                type="button"
              >
                {video.thumbnailUrl ? (
                  <img alt="" className="aspect-video w-full rounded object-cover" src={video.thumbnailUrl} />
                ) : null}
                <span>
                  <span className="block text-sm font-semibold text-white">{video.title}</span>
                  <span className="mt-1 block text-xs text-gray-500">
                    {video.channelTitle} · {formatDuration(video.duration)}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Music2 className="h-5 w-5 text-sakura-300" />
            Lyrics
          </h2>
          <div className="mt-5 grid gap-3">
            {lyricsResults.slice(0, 6).map((result) => (
              <button
                className="rounded-lg border border-white/10 bg-black/10 p-3 text-left transition-colors hover:border-sakura-300/60"
                key={result.id}
                onClick={() => handleLyricsPick(result)}
                type="button"
              >
                <span className="block text-sm font-semibold text-white">{result.trackName}</span>
                <span className="mt-1 block text-xs text-gray-500">
                  {result.artistName} · {result.albumName || "Unknown album"} ·{" "}
                  {result.hasSyncedLyrics ? "Synced" : "Plain"}
                </span>
              </button>
            ))}
          </div>

          {selectedLyrics ? (
            <div className="mt-5">
              <JapaneseStudyToolbar
                onStudyModeChange={study.setStudyMode}
                status={study.status}
                studyMode={study.studyMode}
                variant="plain"
              />
              {study.message ? (
                <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                  {study.message}
                </p>
              ) : null}
              <div className="mt-5 max-h-[520px] overflow-auto rounded-lg border border-white/10 bg-black/20 p-4">
                <div className="space-y-3">
                  {lyricsBlocks.map((line, index) =>
                    line.text.trim() ? (
                      <HighlightedJapaneseText
                        className="font-japanese text-sm leading-7 text-gray-200"
                        jpdbTokens={getJpdbTokensForSlice(
                          study.jpdbTokens,
                          lyricsOffsets[index] ?? 0,
                          line.text.length
                        )}
                        key={line.key}
                        onSelectSegment={study.selectSegment}
                        prefix={line.prefix}
                        prefixClassName="mr-3 inline-block w-12 text-xs text-gray-500"
                        studyMode={study.studyMode}
                        subjects={study.subjects}
                        text={line.text}
                        userLevel={study.userLevel}
                      />
                    ) : (
                      <p aria-hidden="true" className="h-3" key={line.key} />
                    )
                  )}
                </div>
              </div>
              <VocabularyTooltip
                match={study.selectedMatch}
                onClose={study.clearSelectedMatch}
                position={study.tooltipPosition}
              />
            </div>
          ) : null}

          <a
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-sakura-300 hover:text-sakura-200"
            href="https://lrclib.net"
            rel="noopener noreferrer"
            target="_blank"
          >
            LRCLIB
            <ExternalLink className="h-4 w-4" />
          </a>
        </section>
      </div>
    </section>
  );
}

function buildLyricsBlocks(selectedLyrics: LyricsResult | null): LyricsBlock[] {
  if (!selectedLyrics) return [];

  if (selectedLyrics.timedLyrics.length > 0) {
    return selectedLyrics.timedLyrics.map((line, index) => ({
      key: `timed-${line.startTimeMs}-${index}`,
      prefix: formatTimestamp(line.startTimeMs),
      text: line.words,
    }));
  }

  return selectedLyrics.plainLyrics.split(/\r?\n/).map((text, index) => ({
    key: `plain-${index}`,
    text,
  }));
}

function formatDuration(seconds: number): string {
  if (!seconds) return "Unknown length";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function formatTimestamp(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}
