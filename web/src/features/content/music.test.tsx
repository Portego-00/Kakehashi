import { forwardRef } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./JapaneseReader", () => ({ JapaneseReader: ({ text }: { text: string }) => <div data-testid="japanese-reader">{text}</div> }));
vi.mock("./YouTubePlayer", () => ({
  YouTubePlayer: forwardRef<HTMLDivElement, { videoId: string }>(function Player({ videoId }, ref) { return <div ref={ref} data-testid="youtube-player">{videoId}</div>; }),
}));

import { loadLibrary } from "./storage";
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

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("music workspace provider flow", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("searches Spotify, resolves LRCLIB and YouTube, then saves the song", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (input) => {
      if (String(input) === "/music/search") return response({ provider: "spotify", tracks: [track] });
      if (String(input) === "/music/import") return response({
        track,
        lyrics: { id: 42, trackName: "アイドル", artistName: "YOASOBI", albumName: "アイドル", plainLyrics: "無敵の笑顔で荒らすメディア", syncedLyrics: "[00:01.00]無敵の笑顔で荒らすメディア", duration: 213 },
        video: { videoId: "ZRtdQ81jPUQ", title: "YOASOBI アイドル Official Music Video", channelTitle: "Ayase / YOASOBI", thumbnailUrl: "https://example.com/thumb.jpg", duration: 213 },
        videos: [],
        videoWarning: null,
      });
      throw new Error(`Unexpected request: ${String(input)}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MusicWorkspace />);

    fireEvent.change(screen.getByRole("textbox", { name: "Search Spotify songs" }), { target: { value: "YOASOBI" } });
    fireEvent.click(screen.getByRole("button", { name: "Search songs" }));
    const result = await screen.findByRole("button", { name: /アイドル.*YOASOBI/i });
    fireEvent.click(result);

    expect(await screen.findByTestId("youtube-player")).toHaveTextContent("ZRtdQ81jPUQ");
    expect(screen.getByTestId("japanese-reader")).toHaveTextContent("無敵の笑顔で荒らすメディア");
    await waitFor(() => expect(loadLibrary("song")).toEqual([expect.objectContaining({
      title: "アイドル",
      metadata: expect.objectContaining({ spotifyId: "spotify-id", youtubeId: "ZRtdQ81jPUQ", lrclibId: 42 }),
    })]));
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({ query: "YOASOBI" });
    expect(JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body))).toEqual({ track });
  });

  it("shows a useful server-configuration error", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => response({ error: "Spotify song search is not configured on this server." }, 503)));
    render(<MusicWorkspace />);
    fireEvent.change(screen.getByRole("textbox", { name: "Search Spotify songs" }), { target: { value: "Eve" } });
    fireEvent.click(screen.getByRole("button", { name: "Search songs" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Spotify song search is not configured on this server.");
  });
});
