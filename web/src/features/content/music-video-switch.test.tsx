import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const shellBack = vi.hoisted(() => ({ current: null as { label: string; onBack: () => void } | null }));
const routerMocks = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock("@/features/settings/settings", () => ({
  saveWebSettings: vi.fn(),
}));

vi.mock("@/features/settings/use-workspace-preferences", () => ({
  useWebSettings: () => ({
    integrations: { jpdbApiKey: "" },
    study: { songsLyricsLineTranslationsEnabled: false },
  }),
}));

vi.mock("@/lib/session", () => ({
  useSession: () => ({ user: { data: { username: "music-video-switch-test" } } }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerMocks,
}));

vi.mock("@/components/shell/app-shell-back-action", () => ({
  useAppShellBackAction: (action: { label: string; onBack: () => void } | null) => { shellBack.current = action; },
}));

vi.mock("./JapaneseReader", () => ({
  useJapaneseReaderAnalysisContexts: (sources: Array<{ id: string; text: string }>) => new Map(
    sources.map((source) => [source.id, { text: source.text, start: 0 }]),
  ),
  JapaneseReader: ({ text }: { text: string }) => <span>{text}</span>,
}));

import { MusicWorkspace } from "./music";
import { saveLibrary } from "./storage";
import type { ContentRecord } from "./types";

class MockYouTubePlayer {
  iframe: HTMLIFrameElement;

  constructor(element: HTMLElement, options: { videoId: string; events: { onReady: () => void } }) {
    this.iframe = document.createElement("iframe");
    this.iframe.dataset.videoId = options.videoId;
    element.replaceWith(this.iframe);
    window.setTimeout(() => {
      this.iframe.dataset.ready = "true";
      options.events.onReady();
    }, 0);
  }

  destroy() { this.iframe.remove(); }
  getCurrentTime() { return 0; }
  getDuration() { return 180; }
  pauseVideo() {}
  playVideo() {}
  seekTo() {}
}

const tracks = {
  "spotify-song-a": {
    id: "spotify-song-a",
    title: "Song A",
    artist: "Artist A",
    artistId: "artist-a",
    albumArt: "",
    spotifyUrl: "https://open.spotify.com/track/spotify-song-a",
    previewUrl: null,
    durationMs: 180_000,
    albumName: "Album A",
    releaseDate: "2026-01-01",
  },
  "spotify-song-b": {
    id: "spotify-song-b",
    title: "Song B",
    artist: "Artist B",
    artistId: "artist-b",
    albumArt: "",
    spotifyUrl: "https://open.spotify.com/track/spotify-song-b",
    previewUrl: null,
    durationMs: 180_000,
    albumName: "Album B",
    releaseDate: "2026-02-01",
  },
} as const;

function savedSong(id: "a" | "b"): ContentRecord {
  const suffix = id.toUpperCase();
  return {
    id: `saved-song-${id}`,
    kind: "song",
    title: `Song ${suffix}`,
    text: `[00:01.00]Lyrics ${suffix}`,
    assetIds: [],
    createdAt: `2026-0${id === "a" ? "1" : "2"}-01T00:00:00.000Z`,
    updatedAt: `2026-0${id === "a" ? "1" : "2"}-01T00:00:00.000Z`,
    progress: 0,
    metadata: {
      artist: `Artist ${suffix}`,
      spotifyId: `spotify-song-${id}`,
      youtubeId: `video-${id}`,
      durationMs: 180_000,
    },
  };
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
}

describe("music video switching", () => {
  beforeEach(() => {
    window.localStorage.clear();
    shellBack.current = null;
    routerMocks.push.mockReset();
    routerMocks.replace.mockReset();
    vi.stubGlobal("scrollTo", vi.fn());
    Object.defineProperty(window, "YT", {
      configurable: true,
      writable: true,
      value: { Player: MockYouTubePlayer },
    });
    saveLibrary("song", [savedSong("a"), savedSong("b")]);
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (input, init) => {
      if (String(input) === "/music/discover") return jsonResponse({ sections: [] });
      if (String(input) === "/music/import") {
        const request = JSON.parse(String(init?.body)) as { track: { id: keyof typeof tracks } };
        return jsonResponse({
          track: tracks[request.track.id],
          lyrics: null,
          lyricsResults: [],
          lyricsWarning: null,
          video: null,
          videos: [],
          videoWarning: null,
        });
      }
      throw new Error(`Unexpected request: ${String(input)}`);
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(window, "YT");
  });

  it("loads the next song's embedded video without a page refresh", async () => {
    render(<MusicWorkspace />);

    fireEvent.click(screen.getByRole("button", { name: "Open Song A by Artist A" }));
    const firstPlayer = screen.getByLabelText("Song A on YouTube");
    await waitFor(() => expect(firstPlayer.querySelector("iframe")).toHaveAttribute("data-ready", "true"));
    expect(firstPlayer.querySelector("iframe")).toHaveAttribute("data-video-id", "video-a");

    act(() => shellBack.current?.onBack());
    fireEvent.click(screen.getByRole("button", { name: "Open Song B by Artist B" }));

    const nextPlayer = screen.getByLabelText("Song B on YouTube");
    await waitFor(() => expect(nextPlayer.querySelector("iframe")).toHaveAttribute("data-ready", "true"));
    expect(nextPlayer.querySelector("iframe")).toHaveAttribute("data-video-id", "video-b");
    expect(nextPlayer.querySelector("iframe")?.isConnected).toBe(true);
  });

  it("loads the song requested by a client-side lyrics route change", async () => {
    const { rerender } = render(<MusicWorkspace initialSongId="saved-song-a" />);
    const firstPlayer = screen.getByLabelText("Song A on YouTube");
    await waitFor(() => expect(firstPlayer.querySelector("iframe")).toHaveAttribute("data-ready", "true"));

    rerender(<MusicWorkspace initialSongId="saved-song-b" />);

    const nextPlayer = await screen.findByLabelText("Song B on YouTube");
    await waitFor(() => expect(nextPlayer.querySelector("iframe")).toHaveAttribute("data-ready", "true"));
    expect(nextPlayer.querySelector("iframe")).toHaveAttribute("data-video-id", "video-b");

    rerender(<MusicWorkspace />);

    expect(await screen.findByRole("textbox", { name: "Search songs" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Song B on YouTube")).not.toBeInTheDocument();
  });
});
