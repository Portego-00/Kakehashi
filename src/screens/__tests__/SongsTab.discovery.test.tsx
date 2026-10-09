import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React from "react";

import SongsTab from "../../../app/(app)/(tabs)/songs";
import type { SpotifyTrack } from "../../services/spotifyService";
import { errorService } from "../../services/errorService";

const mockSettings = {
  songsPlaybackSource: "youtube",
  appleMusicAuthStatus: "notDetermined",
  spotifyAuthStatus: "notConnected",
};
const mockSpotifyService = {
  hasClientCredentials: jest.fn(() => true),
  getNewJapaneseReleases: jest.fn(),
  getPopularJapaneseSongs: jest.fn(),
  getAnimeSongs: jest.fn(),
  getUserPlaylists: jest.fn(),
  searchTracks: jest.fn(),
};
const mockAppleMusicService = {
  getNewJapaneseReleases: jest.fn(),
  getPopularJapaneseSongs: jest.fn(),
  getAnimeSongs: jest.fn(),
  getUserPlaylists: jest.fn(),
};
const track: SpotifyTrack = {
  id: "recovered-song", title: "Recovered song", artist: "Artist", artistId: "artist",
  albumArt: "https://example.com/cover.jpg", url: "https://open.spotify.com/track/recovered-song",
  previewUrl: null, duration: 120000, albumName: "Album", releaseDate: "2026-10-01",
};

jest.mock("../../utils/store", () => ({
  useSettingsStore: (selector: (settings: typeof mockSettings) => unknown) =>
    selector(mockSettings),
}));
jest.mock("../../services/spotifyService", () => ({
  get spotifyService() { return mockSpotifyService; },
}));
jest.mock("../../services/appleMusicService", () => ({
  get appleMusicService() { return mockAppleMusicService; },
}));
jest.mock("../../services/errorService", () => ({
  errorService: { logError: jest.fn(async () => {}) },
}));
jest.mock("../../hooks/useActivityTracking", () => ({ useActivityTracking: jest.fn() }));
jest.mock("../../utils/nativeTabs", () => ({ supportsNativeTabs: () => false }));
jest.mock("../../components/CoachMarks", () => ({ CoachMarks: () => null }));
jest.mock("expo-router", () => ({ router: { push: jest.fn() } }));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));
jest.mock("@shopify/flash-list", () => ({ FlashList: () => null }));
jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  Directory: class {
    uri = "file:///cache/songs";
    create() {}
  },
  File: class {
    exists = false;
  },
}));
jest.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
jest.mock("../../utils/theme", () => ({
  useTheme: () => ({
    theme: {
      primary: "#6d28d9", textColor: "#111111", textSecondary: "#666666",
      textLight: "#888888", border: "#dddddd", cardBackground: "#ffffff",
      backgroundColor: "#f5f5f5", error: "#dc2626",
    },
  }),
}));

describe("Music discovery connection messages", () => {
  let consoleError: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    mockSettings.songsPlaybackSource = "youtube";
    mockSettings.appleMusicAuthStatus = "notDetermined";
    mockSettings.spotifyAuthStatus = "notConnected";
    mockSpotifyService.hasClientCredentials.mockReturnValue(true);
    jest.mocked(AsyncStorage.getItem).mockResolvedValue("true");
    mockSpotifyService.getNewJapaneseReleases.mockResolvedValue([]);
    mockSpotifyService.getPopularJapaneseSongs.mockResolvedValue([]);
    mockSpotifyService.getAnimeSongs.mockResolvedValue([]);
    mockSpotifyService.getUserPlaylists.mockResolvedValue([]);
    mockSpotifyService.searchTracks.mockResolvedValue([]);
    jest.mocked(errorService.logError).mockResolvedValue(undefined);
    mockAppleMusicService.getNewJapaneseReleases.mockResolvedValue([]);
    mockAppleMusicService.getPopularJapaneseSongs.mockResolvedValue([]);
    mockAppleMusicService.getAnimeSongs.mockResolvedValue([]);
    mockAppleMusicService.getUserPlaylists.mockResolvedValue([]);
  });

  afterEach(() => consoleError.mockRestore());

  it("does not call an empty successful catalog response a WiFi problem", async () => {
    const screen = render(<SongsTab />);

    await waitFor(() => expect(mockSpotifyService.getAnimeSongs).toHaveBeenCalled());
    await waitFor(() => {
      expect(screen.queryAllByText(/Connect to WiFi/)).toHaveLength(0);
      expect(screen.getAllByText("No songs found. Try searching for an artist or song.")).toHaveLength(3);
    });
    expect(errorService.logError).not.toHaveBeenCalled();
  });

  it("shows request failures and lets a failed section recover without reloading the others", async () => {
    mockSpotifyService.getPopularJapaneseSongs.mockRejectedValue(new TypeError("Network request failed"));
    const screen = render(<SongsTab />);

    await waitFor(() => expect(screen.getByText("Could not load songs from Spotify. Please try again.")).toBeTruthy());
    expect(screen.queryAllByText(/Connect to WiFi/)).toHaveLength(0);
    expect(screen.getAllByText("No songs found. Try searching for an artist or song.")).toHaveLength(2);

    mockSpotifyService.getPopularJapaneseSongs.mockResolvedValue([track]);
    fireEvent.press(screen.getByLabelText("Retry Popular J-Pop"));

    await waitFor(() => expect(screen.getByText("Recovered song")).toBeTruthy());
    expect(screen.queryByText(/Could not load songs/)).toBeNull();
    expect(mockSpotifyService.getPopularJapaneseSongs).toHaveBeenCalledTimes(2);
    expect(mockSpotifyService.getNewJapaneseReleases).toHaveBeenCalledTimes(1);
    expect(mockSpotifyService.getAnimeSongs).toHaveBeenCalledTimes(1);
  });

  it("keeps missing build configuration separate from request failures", async () => {
    mockSpotifyService.hasClientCredentials.mockReturnValue(false);
    const screen = render(<SongsTab />);

    await waitFor(() => expect(screen.getAllByText("Spotify song search is unavailable in this build")).toHaveLength(3));
    expect(mockSpotifyService.getNewJapaneseReleases).not.toHaveBeenCalled();
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("offers the same recovery for Apple Music even without Spotify catalog credentials", async () => {
    mockSettings.songsPlaybackSource = "appleMusic";
    mockSettings.appleMusicAuthStatus = "authorized";
    mockSpotifyService.hasClientCredentials.mockReturnValue(false);
    mockAppleMusicService.getAnimeSongs.mockRejectedValue(new Error("Apple feed unavailable"));
    const screen = render(<SongsTab />);

    await waitFor(() => expect(screen.getByText("Could not load songs from Apple Music. Please try again.")).toBeTruthy());
    expect(errorService.logError).toHaveBeenCalledWith(expect.any(Error), {
      extra: { context: "music", provider: "apple", operation: "discovery", section: "anime", statusCode: null, errorName: "Error" },
    });
    mockAppleMusicService.getAnimeSongs.mockResolvedValue([track]);
    fireEvent.press(screen.getByLabelText("Retry Anime Openings & Endings"));

    await waitFor(() => expect(screen.getByText("Recovered song")).toBeTruthy());
    expect(mockSpotifyService.getAnimeSongs).not.toHaveBeenCalled();
  });

  it("asks for Apple Music authorization without attempting catalog requests", async () => {
    mockSettings.songsPlaybackSource = "appleMusic";
    const screen = render(<SongsTab />);

    await waitFor(() => expect(screen.getAllByText("Authorize Apple Music in Settings to load songs")).toHaveLength(3));
    expect(mockAppleMusicService.getNewJapaneseReleases).not.toHaveBeenCalled();
    expect(screen.queryByText("Try again")).toBeNull();
  });

  it("ignores late discovery responses after switching music providers", async () => {
    let resolve!: (songs: SpotifyTrack[]) => void;
    mockSpotifyService.getNewJapaneseReleases.mockReturnValue(new Promise<SpotifyTrack[]>((fulfill) => { resolve = fulfill; }));
    const screen = render(<SongsTab />);
    await waitFor(() => expect(mockSpotifyService.getNewJapaneseReleases).toHaveBeenCalled());

    mockSettings.songsPlaybackSource = "appleMusic";
    mockSettings.appleMusicAuthStatus = "authorized";
    mockAppleMusicService.getNewJapaneseReleases.mockResolvedValue([track]);
    screen.rerender(<SongsTab />);
    await waitFor(() => expect(screen.getByText("Recovered song")).toBeTruthy());

    await act(async () => resolve([{ ...track, title: "Stale Spotify song" }]));
    expect(screen.queryByText("Stale Spotify song")).toBeNull();
    expect(screen.getByText("Recovered song")).toBeTruthy();
  });

  it("reports all failed discovery sections with provider and HTTP status", async () => {
    const failure = new Error("Spotify API error: 403");
    mockSpotifyService.getNewJapaneseReleases.mockRejectedValue(failure);
    mockSpotifyService.getPopularJapaneseSongs.mockRejectedValue(failure);
    mockSpotifyService.getAnimeSongs.mockRejectedValue(failure);
    render(<SongsTab />);

    await waitFor(() => expect(errorService.logError).toHaveBeenCalledTimes(3));
    for (const section of ["releases", "popular", "anime"]) {
      expect(errorService.logError).toHaveBeenCalledWith(failure, {
        extra: { context: "music", provider: "spotify", operation: "discovery", section, statusCode: 403, errorName: "Error" },
      });
    }
  });

  it("reports search failures without recording the user's search text", async () => {
    const failure = new TypeError("Network request failed");
    mockSpotifyService.searchTracks.mockRejectedValue(failure);
    const screen = render(<SongsTab />);
    fireEvent.changeText(screen.getByPlaceholderText("Search Spotify songs..."), "private search text");

    await waitFor(() => expect(errorService.logError).toHaveBeenCalledWith(failure, {
      extra: { context: "music", provider: "spotify", operation: "search", statusCode: null, errorName: "TypeError" },
    }));
  });

  it("reports playlist failures while letting the screen finish loading", async () => {
    mockSettings.songsPlaybackSource = "spotify";
    mockSettings.spotifyAuthStatus = "authorized";
    const failure = new Error("Spotify API error: 429");
    mockSpotifyService.getUserPlaylists.mockRejectedValue(failure);
    const screen = render(<SongsTab />);

    await waitFor(() => expect(errorService.logError).toHaveBeenCalledWith(failure, {
      extra: { context: "music", provider: "spotify", operation: "playlists", statusCode: 429, errorName: "Error" },
    }));
    expect(screen.queryByText(/Playlists/)).toBeNull();
    expect(screen.getAllByText("No songs found. Try searching for an artist or song.")).toHaveLength(3);
  });

  it("keeps the retry available when Supabase logging fails", async () => {
    jest.mocked(errorService.logError).mockRejectedValue(new Error("Supabase unavailable"));
    mockSpotifyService.getAnimeSongs.mockRejectedValue("Spotify auth error: 401");
    const screen = render(<SongsTab />);

    await waitFor(() => expect(screen.getByLabelText("Retry Anime Openings & Endings")).toBeTruthy());
    expect(errorService.logError).toHaveBeenCalledWith(expect.objectContaining({ message: "Spotify auth error: 401" }), {
      extra: { context: "music", provider: "spotify", operation: "discovery", section: "anime", statusCode: 401, errorName: "Error" },
    });
  });
});
