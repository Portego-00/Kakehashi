import { forwardRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./JapaneseReader", () => ({ JapaneseReader: ({ text }: { text: string }) => <div data-testid="japanese-reader">{text}</div> }));
vi.mock("./YouTubePlayer", () => ({
  YouTubePlayer: forwardRef<HTMLDivElement, { videoId: string }>(function Player({ videoId }, ref) { return <div ref={ref} data-testid="youtube-player">{videoId}</div>; }),
}));

import { loadLibrary, saveLibrary } from "./storage";
import { MusicWorkspace } from "./music";

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

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("music workspace provider flow", () => {
  beforeEach(() => window.localStorage.clear());
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

    expect(screen.getByRole("button", { name: "Back to search" })).toBeInTheDocument();
    expect(await screen.findByTestId("youtube-player")).toHaveTextContent("ZRtdQ81jPUQ");
    expect(screen.getByTestId("japanese-reader")).toHaveTextContent("猫と犬が空を見る");
    expect(screen.getByText("Study current line")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /YOASOBI アイドル Official Music Video/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByText("Use manual video or lyrics overrides")).not.toBeInTheDocument();
    const focusButton = screen.getByRole("button", { name: "Focus lyrics" });
    expect(focusButton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(focusButton);
    expect(screen.getByRole("button", { name: "Balanced view" })).toHaveAttribute("aria-pressed", "true");
    const quizButton = screen.getByRole("button", { name: "Quiz mode" });
    expect(quizButton).toBeEnabled();
    fireEvent.click(quizButton);
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
    fireEvent.click(screen.getByRole("button", { name: "Back to search" }));
    expect(screen.getByRole("textbox", { name: "Search songs" })).toHaveValue("YOASOBI");
  });

  it("keeps timed lyric scrolling from moving the whole page", async () => {
    const scrollIntoView = vi.fn();
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
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
    await screen.findByTestId("japanese-reader");

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: expect.any(Number), behavior: "smooth" }));
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
