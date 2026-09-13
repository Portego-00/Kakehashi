import React from "react";
import { act, render } from "@testing-library/react-native";
import { AppState, type AppStateStatus } from "react-native";

import GlobalMiniPlayer from "../../components/GlobalMiniPlayer";
import {
  spotifyService,
  type SpotifyPlaybackSnapshot,
} from "../../services/spotifyService";
import { MusicPlayerProvider, useMusicPlayer } from "../MusicPlayerContext";

let mockPathname = "/song-lyrics";
const mockParams = {};
const mockRouter = { push: jest.fn() };

jest.mock("expo-router", () => ({
  usePathname: () => mockPathname,
  useGlobalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
}));

jest.mock("react-native-reanimated", () => ({
  useSharedValue: (value: number) => ({ value }),
  withSpring: (value: number) => value,
}));

jest.mock("@lomray/react-native-apple-music", () => ({
  MusicItem: { SONG: "song" },
  MusicKit: { setPlaybackQueue: jest.fn() },
  PlaybackStatus: { PLAYING: "playing" },
  Player: {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    getCurrentState: jest.fn(),
    pause: jest.fn(),
    play: jest.fn(),
  },
}));

// Leave routing, the shared provider, and Spotify's controller real; inspect
// the playback state delivered to the otherwise presentation-heavy mini-player.
jest.mock("../../components/MiniPlayer", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    __esModule: true,
    default: (props: object) =>
      React.createElement(View, { ...props, testID: "mini-player" }),
  };
});

jest.mock("../../services/spotifyService", () => ({
  SpotifyPlaybackError: class extends Error {},
  spotifyService: {
    getCurrentPlayback: jest.fn(),
    playTrack: jest.fn(),
    resumePlayback: jest.fn(),
    pausePlayback: jest.fn(),
    seekToPosition: jest.fn(),
  },
}));

const song = {
  albumArt: "",
  songTitle: "Test song",
  artist: "Test artist",
  youtubeVideoId: null,
  songId: "spotify-track",
  songUrl: "https://open.spotify.com/track/spotify-track",
  musicSource: "spotify" as const,
  durationMs: 180_000,
};
const lyrics = [
  { startTimeMs: 0, words: "First line" },
  { startTimeMs: 12_000, words: "Next line" },
];
const snapshot = (
  progressMs: number,
  isPlaying = true,
): SpotifyPlaybackSnapshot => ({
  isPlaying,
  progressMs,
  durationMs: song.durationMs,
  trackId: song.songId,
  deviceId: "spotify-phone",
});

let player: ReturnType<typeof useMusicPlayer>;
let onAppStateChange: (state: AppStateStatus) => void;

function PlayerProbe() {
  player = useMusicPlayer();
  return <GlobalMiniPlayer />;
}

function renderPlayer() {
  return render(
    <MusicPlayerProvider>
      <PlayerProbe />
    </MusicPlayerProvider>,
  );
}

async function advanceTime(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockPathname = "/song-lyrics";
  jest.spyOn(AppState, "addEventListener").mockImplementation((_, listener) => {
    onAppStateChange = listener;
    return { remove: jest.fn() };
  });
  jest.mocked(spotifyService.getCurrentPlayback).mockResolvedValue(snapshot(10_000));
  jest.mocked(spotifyService.pausePlayback).mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

it("preserves Spotify playback and lyric timing when leaving the lyrics screen and collapsing the player", async () => {
  const screen = renderPlayer();
  await act(async () => {
    player.setSongInfo(song);
    player.setTimedLyrics(lyrics);
    player.setIsPlayerExpanded(true);
  });
  expect(screen.getByTestId("mini-player").props.isPlaying).toBe(true);
  expect(screen.getByTestId("mini-player").props.currentTime).toBe(10);

  mockPathname = "/songs";
  await act(async () => {
    player.setIsPlayerExpanded(false);
  });
  jest.mocked(spotifyService.getCurrentPlayback).mockResolvedValue(snapshot(13_000));
  await advanceTime(1000);

  const miniPlayer = screen.getByTestId("mini-player");
  expect(miniPlayer.props.visible).toBe(true);
  expect(miniPlayer.props.isPlaying).toBe(true);
  expect(miniPlayer.props.currentTime).toBe(13);
  expect(miniPlayer.props.timedLyrics).toEqual(lyrics);
  expect(spotifyService.pausePlayback).not.toHaveBeenCalled();
});

it("recovers mini-player playback and lyric timing when Spotify resumes after returning to the app", async () => {
  const screen = renderPlayer();
  await act(async () => {
    player.setSongInfo(song);
    player.setTimedLyrics(lyrics);
  });
  expect(screen.getByTestId("mini-player").props.isPlaying).toBe(true);

  await act(async () => {
    onAppStateChange("background");
  });
  jest.mocked(spotifyService.getCurrentPlayback).mockResolvedValue(snapshot(11_000, false));
  await act(async () => {
    onAppStateChange("active");
  });
  expect(screen.getByTestId("mini-player").props.isPlaying).toBe(false);

  // Spotify can resume independently (including after an app-switch handoff).
  // No local play button or further foreground transition should be necessary.
  jest.mocked(spotifyService.getCurrentPlayback).mockResolvedValue(snapshot(14_000));
  await advanceTime(5000);

  const miniPlayer = screen.getByTestId("mini-player");
  expect(miniPlayer.props.isPlaying).toBe(true);
  expect(miniPlayer.props.currentTime).toBeGreaterThanOrEqual(14);
  expect(miniPlayer.props.timedLyrics).toEqual(lyrics);
});

it("ignores a Spotify response that arrives after the player is cleared", async () => {
  const screen = renderPlayer();
  await act(async () => {
    player.setSongInfo(song);
  });
  const pendingPlayback = deferred<SpotifyPlaybackSnapshot>();
  jest.mocked(spotifyService.getCurrentPlayback).mockReturnValue(pendingPlayback.promise);
  await advanceTime(1000);

  await act(async () => {
    player.clearPlayer();
  });
  expect(player.isPlaying).toBe(false);
  expect(player.currentTime).toBe(0);

  await act(async () => {
    pendingPlayback.resolve(snapshot(15_000));
  });

  expect(screen.getByTestId("mini-player").props.visible).toBe(false);
  expect(player.isPlaying).toBe(false);
  expect(player.currentTime).toBe(0);
});
