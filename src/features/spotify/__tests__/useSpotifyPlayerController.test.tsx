import { act, renderHook } from "@testing-library/react-native";
import { useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { spotifyService, type SpotifyPlaybackSnapshot } from "../../../services/spotifyService";
import { useSpotifyPlayerController } from "../useSpotifyPlayerController";

jest.mock("../../../services/spotifyService", () => ({
  SpotifyPlaybackError: class extends Error {},
  spotifyService: {
    getCurrentPlayback: jest.fn(),
    resumePlayback: jest.fn(),
    playTrack: jest.fn(),
    pausePlayback: jest.fn(),
    seekToPosition: jest.fn(),
  },
}));

const TRACK_ID = "current-track";
const snapshot = (isPlaying: boolean, progressMs: number): SpotifyPlaybackSnapshot => ({
  isPlaying, progressMs, durationMs: 180000, trackId: TRACK_ID, deviceId: "phone",
});
const originalAppState = AppState.currentState;
let changeAppState: (state: AppStateStatus) => void;

function usePlaybackHarness({ trackId = TRACK_ID }: { trackId?: string | null } = {}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(180);
  const player = useSpotifyPlayerController({
    trackId, trackUrl: null, isPlaying, currentTime, duration,
    setIsPlaying, setCurrentTime, setDuration,
  });
  return { player, isPlaying, currentTime, duration };
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  AppState.currentState = "active";
  jest.spyOn(AppState, "addEventListener").mockImplementation((event, listener) => {
    if (event === "change") changeAppState = listener;
    return { remove: jest.fn() };
  });
  jest.mocked(spotifyService.getCurrentPlayback).mockResolvedValue(snapshot(false, 5000));
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
  AppState.currentState = originalAppState;
});

it("resumes the miniplayer and lyric clock when Spotify starts playing outside Kakehashi", async () => {
  const { result } = renderHook(() => usePlaybackHarness());
  await act(async () => {});
  expect(result.current.isPlaying).toBe(false);
  jest.mocked(spotifyService.getCurrentPlayback).mockResolvedValue(snapshot(true, 12000));
  await act(async () => { await jest.advanceTimersByTimeAsync(3000); });
  expect(result.current.isPlaying).toBe(true);
  expect(result.current.currentTime).toBe(12);
});

it("recovers when the first playback read after returning from Spotify is temporarily empty", async () => {
  jest.mocked(spotifyService.getCurrentPlayback).mockResolvedValue(snapshot(true, 5000));
  const { result } = renderHook(() => usePlaybackHarness());
  await act(async () => {});
  expect(result.current.isPlaying).toBe(true);
  act(() => changeAppState("background"));
  jest.mocked(spotifyService.getCurrentPlayback).mockResolvedValue(null);
  await act(async () => changeAppState("active"));
  jest.mocked(spotifyService.getCurrentPlayback).mockResolvedValue(snapshot(true, 30000));
  await act(async () => { await jest.advanceTimersByTimeAsync(3000); });
  expect(result.current.isPlaying).toBe(true);
  expect(result.current.currentTime).toBe(30);
});

it("honors a genuine Spotify pause while continuing to watch for external resume", async () => {
  jest.mocked(spotifyService.getCurrentPlayback).mockResolvedValue(snapshot(true, 5000));
  const { result } = renderHook(() => usePlaybackHarness());
  await act(async () => {});
  jest.mocked(spotifyService.getCurrentPlayback).mockResolvedValue(snapshot(false, 8000));
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  expect(result.current.isPlaying).toBe(false);
  expect(result.current.currentTime).toBe(8);
  await act(async () => { await jest.advanceTimersByTimeAsync(3000); });
  expect(result.current.currentTime).toBe(8);
  jest.mocked(spotifyService.getCurrentPlayback).mockResolvedValue(snapshot(true, 12000));
  await act(async () => { await jest.advanceTimersByTimeAsync(1000); });
  expect(result.current.isPlaying).toBe(true);
  expect(result.current.currentTime).toBe(12);
  expect(spotifyService.resumePlayback).not.toHaveBeenCalled();
});

it("pauses network polling while Kakehashi is in the background and resyncs on return", async () => {
  const { result } = renderHook(() => usePlaybackHarness());
  await act(async () => {});
  act(() => changeAppState("background"));
  jest.mocked(spotifyService.getCurrentPlayback).mockClear();
  await act(async () => { await jest.advanceTimersByTimeAsync(10000); });
  expect(spotifyService.getCurrentPlayback).not.toHaveBeenCalled();
  jest.mocked(spotifyService.getCurrentPlayback).mockResolvedValue(snapshot(true, 45000));
  await act(async () => changeAppState("active"));
  expect(result.current.isPlaying).toBe(true);
  expect(result.current.currentTime).toBe(45);
});

it("does not poll Spotify when no Spotify track is loaded", async () => {
  renderHook(() => usePlaybackHarness({ trackId: null }));
  await act(async () => { await jest.advanceTimersByTimeAsync(3000); });
  expect(spotifyService.getCurrentPlayback).not.toHaveBeenCalled();
});
