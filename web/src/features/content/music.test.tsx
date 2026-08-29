import { forwardRef, useImperativeHandle } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shellBack = vi.hoisted(() => ({ current: null as { label: string; onBack: () => void } | null }));
const playerMocks = vi.hoisted(() => ({ pause: vi.fn(), play: vi.fn(), seekTo: vi.fn() }));
const routerMocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
const webSettingsMocks = vi.hoisted(() => ({
  jpdbApiKey: "",
  lyricTranslationsEnabled: false,
  saveWebSettings: vi.fn(),
}));

vi.mock("@/features/settings/settings", () => ({
  saveWebSettings: webSettingsMocks.saveWebSettings,
}));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => ({
    integrations: { jpdbApiKey: webSettingsMocks.jpdbApiKey },
    study: { songsLyricsLineTranslationsEnabled: webSettingsMocks.lyricTranslationsEnabled },
  }),
}));

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { data: { username: "music-test" } } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("@/components/shell/app-shell-back-action", () => ({
  useAppShellBackAction: (action: { label: string; onBack: () => void } | null) => { shellBack.current = action; },
}));

vi.mock("./JapaneseReader", () => ({
  useJapaneseReaderAnalysisContexts: (sources: Array<{ id: string; text: string }>) => {
    const sourceText = sources.map((source) => source.text).join("\n\n");
    let start = 0;
    return new Map(sources.map((source, index) => {
      const context = [source.id, { text: sourceText, start }] as const;
      start += source.text.length + (index < sources.length - 1 ? 2 : 0);
      return context;
    }));
  },
  JapaneseReader: ({ text, analysisContext, inspectorMode, onSelectionChange, subjectReturnTo }: { text: string; analysisContext?: { text: string; start: number }; inspectorMode?: string; onSelectionChange?: (open: boolean) => void; subjectReturnTo?: string }) => (
    <div data-testid="japanese-reader" data-analysis-source={analysisContext?.text} data-analysis-start={analysisContext?.start} data-inspector-mode={inspectorMode} data-subject-return-to={subjectReturnTo}>
      {text}
      <button type="button" onClick={() => onSelectionChange?.(true)}>Show word details</button>
      <button type="button" onClick={() => onSelectionChange?.(false)}>Close word details</button>
    </div>
  ),
}));
vi.mock("./YouTubePlayer", () => ({
  YouTubePlayer: forwardRef<{ pause(): void; play(): void; seekTo(milliseconds: number): void }, { videoId: string; onPlayingChange?: (playing: boolean) => void; onTimeChange?: (elapsedMs: number, durationMs: number) => void }>(function Player({ videoId, onPlayingChange, onTimeChange }, ref) {
    useImperativeHandle(ref, () => ({
      pause: () => { playerMocks.pause(); onPlayingChange?.(false); },
      play: () => { playerMocks.play(); onPlayingChange?.(true); },
      seekTo: playerMocks.seekTo,
    }), [onPlayingChange]);
    return <div data-testid="youtube-player">{videoId}<button type="button" onClick={() => onTimeChange?.(3_500, 213_000)}>Advance playback</button></div>;
  }),
}));

import { buildLyricsQuiz } from "./lyrics";
import { MusicWorkspace } from "./music";
import { saveSongLyricTranslations } from "./music-translations";
import { parseLrc } from "./parsers";
import { loadLibrary, saveLibrary } from "./storage";

const track = {
  id: "spotify-id",
  title: "アイドル",
  artist: "YOASOBI",
  artistId: "artist-id",
  albumArt: "https://i.scdn.co/image/album-art",
  spotifyUrl: "https://open.spotify.com/track/spotify-id",
  previewUrl: null,
  durationMs: 213_000,
  albumName: "アイドル",
  releaseDate: "2023-04-12",
};

const lyrics = {
  id: 42,
  trackName: "アイドル",
  artistName: "YOASOBI",
  albumName: "アイドル",
  plainLyrics: "猫と犬が空を見る\n山と川を歩く\n花と鳥が歌う\n月と星が光る",
  syncedLyrics: "[00:01.00]猫と犬が空を見る\n[00:03.00]山と川を歩く\n[00:05.00]花と鳥が歌う\n[00:07.00]月と星が光る",
  duration: 213,
};

const video = {
  videoId: "ZRtdQ81jPUQ",
  title: "YOASOBI アイドル Official Music Video",
  channelTitle: "Ayase / YOASOBI",
  thumbnailUrl: "https://i.ytimg.com/vi/ZRtdQ81jPUQ/hqdefault.jpg",
  duration: 213,
};

const repeatedLyricLines = [
  "猫と犬が空を見る",
  "山と川を歩く",
  "猫と犬が空を見る",
  "月と星が光る",
] as const;

const repeatedLyrics = {
  ...lyrics,
  plainLyrics: repeatedLyricLines.join("\n"),
  syncedLyrics: repeatedLyricLines.map((line, index) => `[00:0${index * 2 + 1}.00]${line}`).join("\n"),
};

const translatedLyricLines: Record<string, string> = {
  "猫と犬が空を見る": "Cats and dogs look at the sky.",
  "山と川を歩く": "We walk through mountains and rivers.",
  "花と鳥が歌う": "Flowers and birds sing.",
  "月と星が光る": "The moon and stars shine.",
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function translationStream() {
  const encoder = new TextEncoder();
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { streamController = controller; },
  });
  return {
    response: new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8" } }),
    send(event: unknown) { streamController?.enqueue(encoder.encode(`${JSON.stringify(event)}\n`)); },
    close() { streamController?.close(); },
  };
}

function saveSongFixture(text: string, id = "saved-song") {
  saveLibrary("song", [{
    id,
    kind: "song",
    title: track.title,
    text,
    assetIds: [],
    createdAt: "2026-08-25T19:00:00.000Z",
    updatedAt: "2026-08-25T19:00:00.000Z",
    progress: 0,
    metadata: {
      artist: track.artist,
      albumArt: track.albumArt,
      spotifyId: track.id,
      durationMs: track.durationMs,
    },
  }]);
}

function importResponse(selectedLyrics: typeof lyrics) {
  return response({
    track,
    lyrics: selectedLyrics,
    lyricsResults: [selectedLyrics],
    lyricsWarning: null,
    video,
    videos: [video],
    videoWarning: null,
  });
}

describe("music workspace provider flow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    shellBack.current = null;
    webSettingsMocks.jpdbApiKey = "";
    webSettingsMocks.lyricTranslationsEnabled = false;
    webSettingsMocks.saveWebSettings.mockReset();
    playerMocks.pause.mockClear();
    playerMocks.play.mockClear();
    playerMocks.seekTo.mockClear();
    routerMocks.push.mockReset();
    routerMocks.replace.mockReset();
    vi.stubGlobal("scrollTo", vi.fn());
  });
  afterEach(() => vi.unstubAllGlobals());

  it("uses the standard song card for history while keeping remove and undo actions", async () => {
    saveLibrary("song", [{
      id: "saved-song",
      kind: "song",
      title: track.title,
      text: lyrics.syncedLyrics,
      assetIds: [],
      createdAt: "2026-08-25T19:00:00.000Z",
      updatedAt: "2026-08-25T19:00:00.000Z",
      progress: 0,
      metadata: { artist: track.artist, albumArt: track.albumArt, spotifyId: track.id },
    }]);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => String(input) === "/music/discover"
      ? response({ sections: [{ id: "popular", title: "Popular J-pop", tracks: [track] }] })
      : (() => { throw new Error(`Unexpected request: ${String(input)}`); })()));

    render(<MusicWorkspace />);

    const historyCard = screen.getByRole("button", { name: "Open アイドル by YOASOBI" });
    const recommendationCard = await screen.findByRole("button", { name: "アイドル by YOASOBI" });
    expect(historyCard.className).toBe(recommendationCard.className);
    expect(historyCard.firstElementChild?.className).toBe(recommendationCard.firstElementChild?.className);

    fireEvent.click(screen.getByRole("button", { name: "Remove アイドル" }));
    expect(screen.queryByRole("button", { name: "Open アイドル by YOASOBI" })).not.toBeInTheDocument();
    expect(loadLibrary("song")).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByRole("button", { name: "Open アイドル by YOASOBI" })).toBeInTheDocument();
    expect(loadLibrary("song")).toHaveLength(1);
  });

  it("saves pasted plain or timed lyrics on a song", async () => {
    saveSongFixture(lyrics.syncedLyrics);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => String(input) === "/music/discover"
      ? response({ sections: [] })
      : (() => { throw new Error(`Unexpected request: ${String(input)}`); })()));

    render(<MusicWorkspace initialSongId="saved-song" />);

    fireEvent.click(screen.getByRole("button", { name: "Paste lyrics" }));
    const plainEditor = screen.getByRole("textbox", { name: "Custom lyrics" });
    expect(plainEditor).toHaveValue(lyrics.syncedLyrics);
    fireEvent.change(plainEditor, { target: { value: "一行目\n二行目" } });
    expect(screen.getByText("Detected: Plain text · 2 lines")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save lyrics" }));

    expect(screen.getByText("Plain lyrics")).toBeInTheDocument();
    expect(loadLibrary("song")[0]).toEqual(expect.objectContaining({
      text: "一行目\n二行目",
      metadata: expect.objectContaining({ lyricsSource: "custom", lrclibId: null }),
    }));

    fireEvent.click(screen.getByRole("button", { name: "Paste lyrics" }));
    const timedEditor = screen.getByRole("textbox", { name: "Custom lyrics" });
    fireEvent.change(timedEditor, { target: { value: "WEBVTT\n\n00:01.000 --> 00:03.000\n最初\n\n00:03.000 --> 00:05.000\n次" } });
    expect(screen.getByText("Detected: WebVTT · 2 timed lines")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save lyrics" }));

    expect(screen.getByText("Synced to playback")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seek to 0:01" })).toBeInTheDocument();
    expect(loadLibrary("song")[0].text).toContain("WEBVTT");
  });

  it("searches progressively, opens the song screen, and saves matched sources", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "/music/discover") return response({ sections: [] });
      if (String(input) === "/music/search") return response({ provider: "spotify", tracks: [track] });
      if (String(input) === "/music/import") return response({
        track,
        lyrics,
        lyricsResults: [lyrics],
        lyricsWarning: null,
        video,
        videos: [video],
        videoWarning: null,
      });
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MusicWorkspace />);
    expect(screen.queryByText("Use an LRCLIB link or paste lyrics")).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Search songs" }), { target: { value: "YOASOBI" } });
    const result = await screen.findByRole("button", { name: /アイドル.*YOASOBI/i });
    expect(screen.queryByRole("heading", { name: "Search results" })).not.toBeInTheDocument();
    expect(screen.queryByText("Spotify catalog")).not.toBeInTheDocument();
    fireEvent.click(result);

    expect(shellBack.current?.label).toBe("Back to search");
    expect(await screen.findByTestId("youtube-player")).toHaveTextContent("ZRtdQ81jPUQ");
    const seekSlider = screen.getByRole("slider", { name: "Seek song" });
    expect(seekSlider).toHaveAttribute("aria-valuetext", "0:00 of 3:33");
    fireEvent.change(seekSlider, { target: { value: "60000" } });
    expect(playerMocks.seekTo).toHaveBeenLastCalledWith(60_000);
    expect(seekSlider).toHaveAttribute("aria-valuetext", "1:00 of 3:33");
    fireEvent.click(screen.getByRole("button", { name: "Restart song" }));
    expect(playerMocks.seekTo).toHaveBeenLastCalledWith(0);
    fireEvent.click(screen.getByRole("button", { name: "Play song" }));
    expect(playerMocks.play).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Pause song" }));
    expect(playerMocks.pause).toHaveBeenCalledTimes(1);
    const lyricReaders = screen.getAllByTestId("japanese-reader");
    expect(lyricReaders).toHaveLength(4);
    expect(lyricReaders[0]).toHaveTextContent("猫と犬が空を見る");
    expect(lyricReaders.every((reader) => reader.getAttribute("data-inspector-mode") === "floating")).toBe(true);
    expect(lyricReaders[0].getAttribute("data-subject-return-to")).toMatch(/^\/music\?song=song-/);
    expect(screen.queryByText("Study current line")).not.toBeInTheDocument();
    expect(screen.queryByText("Select a highlighted word")).not.toBeInTheDocument();

    fireEvent.click(lyricReaders[0].querySelector("button")!);
    fireEvent.click(screen.getByRole("button", { name: "Advance playback" }));
    expect(screen.getAllByTestId("japanese-reader")[0]).toHaveTextContent("猫と犬が空を見る");
    expect(screen.getAllByText("山と川を歩く", { exact: true }).some((node) => node.closest("article")?.getAttribute("aria-current") === "true")).toBe(true);
    fireEvent.click(lyricReaders[0].querySelectorAll("button")[1]);
    expect(screen.getAllByTestId("japanese-reader")[1]).toHaveTextContent("山と川を歩く");
    expect(screen.getByRole("button", { name: /YOASOBI アイドル Official Music Video/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Use manual video or lyrics overrides")).not.toBeInTheDocument();
    const translationsButton = screen.getByRole("button", { name: "English lyric translations" });
    expect(translationsButton).toHaveAttribute("title", "English lyric translations");
    expect(translationsButton.textContent).toBe("");
    const focusButton = screen.getByRole("button", { name: "Focus lyrics" });
    expect(focusButton).toHaveAttribute("aria-pressed", "false");
    expect(focusButton).toHaveAttribute("title", "Focus lyrics");
    expect(focusButton.textContent).toBe("");
    fireEvent.click(focusButton);
    const balancedViewButton = screen.getByRole("button", { name: "Balanced view" });
    expect(balancedViewButton).toHaveAttribute("aria-pressed", "true");
    expect(balancedViewButton).toHaveAttribute("title", "Balanced view");
    expect(balancedViewButton.textContent).toBe("");
    const quizButton = screen.getByRole("button", { name: "Quiz mode" });
    expect(quizButton).toBeEnabled();
    expect(quizButton).toHaveAttribute("title", "Quiz mode");
    expect(quizButton.textContent).toBe("");
    fireEvent.click(quizButton);
    expect(screen.getByRole("button", { name: "Exit quiz" })).toHaveAttribute("title", "Exit quiz");
    expect(screen.getAllByText("山と川を歩く", { exact: true }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("月と星が光る", { exact: true })).toBeInTheDocument();
    await waitFor(() => expect(loadLibrary("song")).toEqual([expect.objectContaining({
      title: "アイドル",
      metadata: expect.objectContaining({ spotifyId: "spotify-id", youtubeId: "ZRtdQ81jPUQ", lrclibId: 42 }),
    })]));

    const videoSearch = screen.getByRole("textbox", { name: "Video search" });
    fireEvent.change(videoSearch, { target: { value: "YOASOBI アイドル live" } });
    fireEvent.submit(videoSearch.closest("form")!);
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => String(input) === "/music/import")).toHaveLength(2));
    expect(JSON.parse(String(fetchMock.mock.calls.filter(([input]) => String(input) === "/music/import").at(-1)?.[1]?.body))).toEqual({
      track: expect.objectContaining({ title: "アイドル", artist: "YOASOBI" }),
      source: "video",
      videoQuery: "YOASOBI アイドル live",
    });

    const lyricsTrackSearch = screen.getByRole("textbox", { name: "Lyrics song" });
    const lyricsArtistSearch = screen.getByRole("textbox", { name: "Lyrics artist" });
    fireEvent.change(lyricsTrackSearch, { target: { value: "アイドル live" } });
    fireEvent.change(lyricsArtistSearch, { target: { value: "YOASOBI" } });
    fireEvent.submit(lyricsTrackSearch.closest("form")!);
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => String(input) === "/music/import")).toHaveLength(3));
    expect(JSON.parse(String(fetchMock.mock.calls.filter(([input]) => String(input) === "/music/import").at(-1)?.[1]?.body))).toEqual({
      track: expect.objectContaining({ title: "アイドル", artist: "YOASOBI" }),
      source: "lyrics",
      lyricsTrack: "アイドル live",
      lyricsArtist: "YOASOBI",
    });

    const searchCall = fetchMock.mock.calls.find(([input]) => String(input) === "/music/search");
    const importCall = fetchMock.mock.calls.find(([input]) => String(input) === "/music/import");
    expect(JSON.parse(String(searchCall?.[1]?.body))).toEqual({ query: "YOASOBI" });
    expect(JSON.parse(String(importCall?.[1]?.body))).toEqual({ track });
  });

  it("moves source shortcuts to the matching picker and search field", async () => {
    saveSongFixture(lyrics.syncedLyrics);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "/music/discover") return response({ sections: [] });
      if (String(input) === "/music/import") return importResponse(lyrics);
      throw new Error(`Unexpected request: ${String(input)}`);
    }));
    const previousScrollIntoView = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });

    try {
      render(<MusicWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: "Open アイドル by YOASOBI" }));

      const videoSearch = screen.getByRole("textbox", { name: "Video search" });
      const changeVideoSource = screen.getByRole("link", { name: "Change video source" });
      vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
      expect(changeVideoSource).toHaveAttribute("href", "#video-matches");
      expect(changeVideoSource).toHaveAttribute("aria-controls", "video-matches");
      fireEvent.click(changeVideoSource);
      expect(videoSearch).toHaveFocus();
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(videoSearch.closest("section"));
      expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: "smooth", block: "start", inline: "nearest" });

      const lyricsSearch = screen.getByRole("textbox", { name: "Lyrics song" });
      const changeLyricsSource = screen.getByRole("link", { name: "Change lyrics source" });
      vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
      expect(changeLyricsSource).toHaveAttribute("href", "#lyrics-matches");
      expect(changeLyricsSource).toHaveAttribute("aria-controls", "lyrics-matches");
      fireEvent.click(changeLyricsSource);
      expect(lyricsSearch).toHaveFocus();
      expect(scrollIntoView.mock.contexts.at(-1)).toBe(lyricsSearch.closest("section"));
      expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: "auto", block: "start", inline: "nearest" });
    } finally {
      if (previousScrollIntoView) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", previousScrollIntoView);
      else delete (HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView;
    }
  });

  it("opens a selected song even when lyrics and video matches are unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "/music/discover") return response({ sections: [] });
      if (String(input) === "/music/search") return response({ provider: "spotify", tracks: [track] });
      if (String(input) === "/music/import") return response({
        track,
        lyrics: null,
        lyricsResults: [],
        lyricsWarning: "No usable lyrics were found.",
        video: null,
        videos: [],
        videoWarning: "No embeddable YouTube match was found.",
      });
      throw new Error(`Unexpected request: ${String(input)}`);
    }));
    render(<MusicWorkspace />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search songs" }), { target: { value: "YOASOBI" } });
    fireEvent.click(await screen.findByRole("button", { name: /アイドル.*YOASOBI/i }));

    expect(screen.getByRole("heading", { name: "アイドル" })).toBeInTheDocument();
    expect(await screen.findByText("Lyrics weren’t found")).toBeInTheDocument();
    expect(screen.getByText("No playable video selected")).toBeInTheDocument();
    act(() => shellBack.current?.onBack());
    expect(screen.getByRole("textbox", { name: "Search songs" })).toHaveValue("YOASOBI");
  });

  it("restores the exact lyrics screen from a song return URL", async () => {
    saveSongFixture(lyrics.syncedLyrics);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => String(input) === "/music/discover"
      ? response({ sections: [] })
      : (() => { throw new Error(`Unexpected request: ${String(input)}`); })()));

    render(<MusicWorkspace initialSongId="saved-song" />);

    expect(screen.getByRole("heading", { name: "アイドル" })).toBeInTheDocument();
    expect(screen.getAllByTestId("japanese-reader")[0]).toHaveTextContent("猫と犬が空を見る");
    expect(screen.getAllByTestId("japanese-reader").every((reader) => reader.getAttribute("data-subject-return-to") === "/music?song=saved-song")).toBe(true);
    expect(screen.queryByRole("textbox", { name: "Search songs" })).not.toBeInTheDocument();

    act(() => shellBack.current?.onBack());
    expect(routerMocks.replace).toHaveBeenCalledWith("/music", { scroll: false });
  });

  it("keeps every non-quiz lyric line available for word inspection, including inactive lines", () => {
    saveSongFixture(lyrics.syncedLyrics);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => String(input) === "/music/discover"
      ? response({ sections: [] })
      : (() => { throw new Error(`Unexpected request: ${String(input)}`); })()));

    render(<MusicWorkspace initialSongId="saved-song" />);

    const readers = screen.getAllByTestId("japanese-reader");
    expect(readers).toHaveLength(4);
    expect(readers[0]).toHaveTextContent("猫と犬が空を見る");
    expect(readers[1]).toHaveTextContent("山と川を歩く");
    expect(readers[1].closest("article")).not.toHaveAttribute("aria-current");
    expect(readers.every((reader) => reader.getAttribute("data-analysis-source") === lyrics.plainLyrics.replaceAll("\n", "\n\n"))).toBe(true);
    expect(readers.map((reader) => reader.getAttribute("data-analysis-start"))).toEqual(["0", "10", "18", "26"]);
  });

  it("resets the page scroll when opening a song", async () => {
    const scrollTo = vi.fn();
    vi.stubGlobal("scrollTo", scrollTo);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "/music/discover") return response({ sections: [] });
      if (String(input) === "/music/search") return response({ provider: "spotify", tracks: [track] });
      if (String(input) === "/music/import") return response({
        track,
        lyrics: null,
        lyricsResults: [],
        lyricsWarning: "No usable lyrics were found.",
        video: null,
        videos: [],
        videoWarning: "No embeddable YouTube match was found.",
      });
      throw new Error(`Unexpected request: ${String(input)}`);
    }));
    render(<MusicWorkspace />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search songs" }), { target: { value: "YOASOBI" } });
    expect(scrollTo).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: /アイドル.*YOASOBI/i }));

    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 })));
  });

  it("resets the page scroll when reopening a saved song", async () => {
    saveLibrary("song", [{
      id: "saved-song",
      kind: "song",
      title: track.title,
      text: lyrics.syncedLyrics,
      assetIds: [],
      createdAt: "2026-08-25T19:00:00.000Z",
      updatedAt: "2026-08-25T19:00:00.000Z",
      progress: 0,
      metadata: { artist: track.artist, albumArt: track.albumArt, spotifyId: track.id },
    }]);
    const scrollTo = vi.mocked(window.scrollTo);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "/music/discover") return response({ sections: [] });
      if (String(input) === "/music/import") return response({
        track,
        lyrics,
        lyricsResults: [lyrics],
        lyricsWarning: null,
        video,
        videos: [video],
        videoWarning: null,
      });
      throw new Error(`Unexpected request: ${String(input)}`);
    }));
    render(<MusicWorkspace />);

    expect(scrollTo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Open アイドル by YOASOBI" }));

    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 })));
  });

  it("keeps timed lyric scrolling from moving the whole page", async () => {
    const scrollIntoView = vi.fn();
    const pageScrollTo = vi.mocked(window.scrollTo);
    const lyricsScrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: lyricsScrollTo,
    });
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "/music/discover") return response({ sections: [] });
      if (String(input) === "/music/search") return response({ provider: "spotify", tracks: [track] });
      if (String(input) === "/music/import") return response({
        track,
        lyrics,
        lyricsResults: [lyrics],
        lyricsWarning: null,
        video,
        videos: [video],
        videoWarning: null,
      });
      throw new Error(`Unexpected request: ${String(input)}`);
    }));
    render(<MusicWorkspace />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search songs" }), { target: { value: "YOASOBI" } });
    fireEvent.click(await screen.findByRole("button", { name: /アイドル.*YOASOBI/i }));
    await screen.findAllByTestId("japanese-reader");

    await waitFor(() => expect(lyricsScrollTo).toHaveBeenCalled());
    expect(pageScrollTo).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).not.toHaveBeenCalled();
    pageScrollTo.mockClear();
    lyricsScrollTo.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Advance playback" }));

    await waitFor(() => expect(lyricsScrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: expect.any(Number), behavior: "smooth" })));
    expect(pageScrollTo).not.toHaveBeenCalled();
  });

  it("keeps English lyric translations unavailable without a JPDB key", async () => {
    saveSongFixture(lyrics.syncedLyrics);
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "/music/discover") return response({ sections: [] });
      if (String(input) === "/music/import") return importResponse(lyrics);
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MusicWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open アイドル by YOASOBI" }));

    const translationsButton = screen.getByRole("button", { name: "English lyric translations" });
    expect(translationsButton).toBeDisabled();
    expect(translationsButton).toHaveAttribute("aria-describedby", "lyrics-translation-help");
    expect(screen.getByRole("link", { name: "Add a JPDB key in Settings" })).toHaveAttribute("href", "/settings#jpdb-api-key");
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input) === "/music/import")).toBe(true));
    expect(fetchMock.mock.calls.some(([input]) => String(input) === "/music/translate")).toBe(false);
  });

  it.each([
    ["synced", repeatedLyrics],
    ["plain", { ...repeatedLyrics, syncedLyrics: "" }],
  ])("batches unique %s lyric lines and renders each English translation beneath its source", async (_mode, selectedLyrics) => {
    webSettingsMocks.jpdbApiKey = "configured-jpdb-key";
    webSettingsMocks.lyricTranslationsEnabled = true;
    const sourceText = selectedLyrics.syncedLyrics || selectedLyrics.plainLyrics;
    const uniqueLines = [repeatedLyricLines[0], repeatedLyricLines[1], repeatedLyricLines[3]];
    saveSongFixture(sourceText);
    saveSongLyricTranslations("saved-song", sourceText, uniqueLines, {
      [uniqueLines[0]]: translatedLyricLines[uniqueLines[0]],
    });
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "/music/discover") return response({ sections: [] });
      if (String(input) === "/music/import") return importResponse(selectedLyrics);
      if (String(input) === "/music/translate") return response({
        provider: "jpdb",
        translations: uniqueLines.slice(1).map((source) => ({
          source,
          translation: translatedLyricLines[source],
        })),
      });
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MusicWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open アイドル by YOASOBI" }));

    await screen.findByText(translatedLyricLines[uniqueLines[1]]);
    const translationCalls = fetchMock.mock.calls.filter(([input]) => String(input) === "/music/translate");
    expect(translationCalls).toHaveLength(1);
    expect(JSON.parse(String(translationCalls[0]?.[1]?.body))).toEqual({
      lines: uniqueLines,
      cachedTranslations: [{
        source: uniqueLines[0],
        translation: translatedLyricLines[uniqueLines[0]],
      }],
      apiKey: "configured-jpdb-key",
    });
    expect(screen.getByRole("button", { name: "English lyric translations" })).toHaveAttribute("aria-pressed", "true");

    for (const source of uniqueLines) {
      const renderedTranslations = screen.getAllByText(translatedLyricLines[source], { exact: true });
      expect(renderedTranslations).toHaveLength(source === repeatedLyricLines[0] ? 2 : 1);
      renderedTranslations.forEach((translation) => {
        expect(translation.closest("article")).toHaveTextContent(source);
      });
    }
  });

  it("renders each streamed lyric translation before the remaining lines finish", async () => {
    webSettingsMocks.jpdbApiKey = "configured-jpdb-key";
    webSettingsMocks.lyricTranslationsEnabled = true;
    saveSongFixture(lyrics.syncedLyrics);
    const translations = translationStream();
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "/music/discover") return response({ sections: [] });
      if (String(input) === "/music/translate") return translations.response;
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MusicWorkspace initialSongId="saved-song" />);
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => String(input) === "/music/translate")).toBe(true));

    act(() => translations.send({
      type: "translation",
      source: "猫と犬が空を見る",
      translation: translatedLyricLines["猫と犬が空を見る"],
    }));
    expect(await screen.findByText(translatedLyricLines["猫と犬が空を見る"])).toHaveAttribute("data-streaming-line", "true");
    expect(screen.queryByText(translatedLyricLines["山と川を歩く"])).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Translating lyric lines");

    act(() => {
      translations.send({
        type: "translation",
        source: "山と川を歩く",
        translation: translatedLyricLines["山と川を歩く"],
      });
      translations.send({ type: "complete" });
      translations.close();
    });

    expect(await screen.findByText(translatedLyricLines["山と川を歩く"])).toHaveAttribute("data-streaming-line", "true");
    await waitFor(() => expect(screen.queryByText("Translating lyric lines…")).not.toBeInTheDocument());
  });

  it("hides the active quiz-line translation until its correct answer is chosen", async () => {
    webSettingsMocks.jpdbApiKey = "configured-jpdb-key";
    webSettingsMocks.lyricTranslationsEnabled = true;
    saveSongFixture(lyrics.syncedLyrics);
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "/music/discover") return response({ sections: [] });
      if (String(input) === "/music/import") return importResponse(lyrics);
      if (String(input) === "/music/translate") return response({
        provider: "jpdb",
        translations: Object.entries(translatedLyricLines).map(([source, translation]) => ({ source, translation })),
      });
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const timedLines = parseLrc(lyrics.syncedLyrics);
    const activeQuestion = buildLyricsQuiz(timedLines)[0];
    expect(activeQuestion).toBeDefined();
    const sourceLine = timedLines[activeQuestion.lineIndex].text;
    const sourceTranslation = translatedLyricLines[sourceLine];

    render(<MusicWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open アイドル by YOASOBI" }));
    expect(await screen.findByText(sourceTranslation)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Quiz mode" }));
    expect(screen.queryByText(sourceTranslation)).not.toBeInTheDocument();
    expect(await screen.findByText(translatedLyricLines["山と川を歩く"])).toBeInTheDocument();

    const correctOptionIndex = activeQuestion.options.indexOf(activeQuestion.answer);
    const correctOptionText = `${String.fromCharCode(65 + correctOptionIndex)}${activeQuestion.answer}`;
    const correctOption = screen.getAllByRole("button").find((button) => button.textContent === correctOptionText);
    expect(correctOption).toBeDefined();
    fireEvent.click(correctOption!);

    expect(await screen.findByText(sourceTranslation)).toBeInTheDocument();
  });

  it("retries only the missing lines after JPDB returns a partial batch", async () => {
    webSettingsMocks.jpdbApiKey = "configured-jpdb-key";
    webSettingsMocks.lyricTranslationsEnabled = true;
    saveSongFixture(lyrics.syncedLyrics);
    let translationAttempt = 0;
    const sourceLines = lyrics.plainLyrics.split("\n");
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "/music/discover") return response({ sections: [] });
      if (String(input) === "/music/import") return importResponse(lyrics);
      if (String(input) === "/music/translate") {
        translationAttempt += 1;
        if (translationAttempt === 1) return response({
          provider: "jpdb",
          translations: [{ source: sourceLines[0], translation: translatedLyricLines[sourceLines[0]] }],
          warning: "JPDB's translation rate limit was reached. Try again shortly.",
          code: "too_many_requests",
        });
        return response({
          provider: "jpdb",
          translations: sourceLines.slice(1).map((source) => ({ source, translation: translatedLyricLines[source] })),
        });
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MusicWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open アイドル by YOASOBI" }));

    expect(await screen.findByText(translatedLyricLines[sourceLines[0]])).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry translations" }));
    expect(await screen.findByText(translatedLyricLines[sourceLines.at(-1)!])).toBeInTheDocument();

    const translationCalls = fetchMock.mock.calls.filter(([input]) => String(input) === "/music/translate");
    expect(translationCalls).toHaveLength(2);
    expect(JSON.parse(String(translationCalls[1]?.[1]?.body)).cachedTranslations).toEqual([{
      source: sourceLines[0],
      translation: translatedLyricLines[sourceLines[0]],
    }]);
    expect(screen.queryByRole("button", { name: "Retry translations" })).not.toBeInTheDocument();
  });

  it("aborts and ignores an in-flight lyric translation when returning to search", async () => {
    webSettingsMocks.jpdbApiKey = "configured-jpdb-key";
    webSettingsMocks.lyricTranslationsEnabled = true;
    saveSongFixture(lyrics.syncedLyrics);
    let resolveTranslation: ((value: Response) => void) | null = null;
    const pendingTranslation = new Promise<Response>((resolve) => { resolveTranslation = resolve; });
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "/music/discover") return response({ sections: [] });
      if (String(input) === "/music/import") return importResponse(lyrics);
      if (String(input) === "/music/translate") return pendingTranslation;
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MusicWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "Open アイドル by YOASOBI" }));
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => String(input) === "/music/translate")).toHaveLength(1));
    const translationCall = fetchMock.mock.calls.find(([input]) => String(input) === "/music/translate");
    const translationSignal = translationCall?.[1]?.signal as AbortSignal;
    expect(translationSignal.aborted).toBe(false);

    act(() => shellBack.current?.onBack());
    expect(translationSignal.aborted).toBe(true);
    expect(screen.getByRole("textbox", { name: "Search songs" })).toBeInTheDocument();

    await act(async () => {
      resolveTranslation?.(response({
        provider: "jpdb",
        translations: [{
          source: lyrics.plainLyrics.split("\n")[0],
          translation: translatedLyricLines["猫と犬が空を見る"],
        }],
      }));
      await Promise.resolve();
    });
    expect(screen.queryByText(translatedLyricLines["猫と犬が空を見る"])).not.toBeInTheDocument();
  });

  it("shows a useful server-configuration error", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input) => String(input) === "/music/discover"
      ? response({ sections: [] })
      : response({ error: "Spotify song search is not configured on this server." }, 503)));
    render(<MusicWorkspace />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search songs" }), { target: { value: "Eve" } });
    expect(await screen.findByRole("alert")).toHaveTextContent("Spotify song search is not configured on this server.");
  });
});
