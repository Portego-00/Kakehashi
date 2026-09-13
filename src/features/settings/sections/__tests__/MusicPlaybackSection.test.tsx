import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import React from "react";
import { Linking } from "react-native";

import { MusicPlaybackSection } from "../MusicPlaybackSection";

jest.mock("react-native/Libraries/Linking/Linking", () => ({
  __esModule: true,
  default: { openURL: jest.fn(async () => {}) },
}));

jest.mock("../../SettingsControllerContext", () => ({
  useSettingsControllerContext: () => mockController,
}));

jest.mock("../../useSettingsController", () => ({
  STOP_DETAILS_PREVIEW_ASPECT_RATIO: 1,
}));

jest.mock("../../../../services/spotifyService", () => ({
  isSpotifyClientIdValid: (value: string) => /^[a-f0-9]{32}$/i.test(value.trim()),
}));

const SAVED_CLIENT_ID = "0123456789abcdef0123456789abcdef";
const REPLACEMENT_CLIENT_ID = "abcdef0123456789abcdef0123456789";

const makeController = () => ({
  appleMusicAuthError: null,
  appleMusicAuthStatus: "notDetermined",
  appleMusicPlaybackAccessStatus: "unknown",
  getSpotifyStatusLabel: jest.fn(() => "Not connected"),
  handlePlaybackSourceChange: jest.fn(async () => {}),
  handleSpotifyLogin: jest.fn(async () => {}),
  handleSpotifyLogout: jest.fn(async () => {}),
  isAppleMusicAuthAvailable: true,
  isAppleMusicAuthenticating: false,
  isSpotifyAuthAvailable: false,
  isSpotifyAuthenticating: false,
  isSpotifyConfiguring: false,
  Platform: { OS: "ios" },
  saveSpotifyClientId: jest.fn(async (_value: string) => {}),
  showMusicPlaybackSection: true,
  songsPlaybackSource: "youtube",
  spotifyAuthError: null,
  spotifyAuthStatus: "notConfigured",
  spotifyClientId: "",
  spotifyRedirectUri: "kakehashi://spotify-auth",
  theme: {
    backgroundColor: "#f6f6f6",
    cardBackground: "#ffffff",
    textColor: "#222222",
    textSecondary: "#666666",
    primary: "#326ac0",
    border: "#dddddd",
    error: "#cc3333",
  },
  updateSectionOffset: jest.fn(),
});

let mockController = makeController();

describe("MusicPlaybackSection Spotify setup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockController = makeController();
  });

  it("opens the guide from the unconfigured provider without starting authorization", () => {
    mockController.spotifyRedirectUri = "kakehashi-test://spotify-auth";
    const screen = render(<MusicPlaybackSection />);

    expect(screen.queryByLabelText("Spotify Client ID")).toBeNull();
    fireEvent.press(screen.getByLabelText("Spotify, Setup needed"));

    expect(screen.getByText("1. Open the developer dashboard")).toBeTruthy();
    expect(screen.getByText(/You need Spotify Premium/)).toBeTruthy();
    expect(screen.getByText(/up to 5 authorized users/)).toBeTruthy();
    expect(screen.getByText(/Client Secret is never needed/)).toBeTruthy();
    expect(screen.getByText("kakehashi-test://spotify-auth").props.selectable).toBe(
      true,
    );
    expect(mockController.handlePlaybackSourceChange).not.toHaveBeenCalled();
    expect(mockController.handleSpotifyLogin).not.toHaveBeenCalled();
  });

  it("opens Spotify’s dashboard and exposes troubleshooting separately", async () => {
    const screen = render(<MusicPlaybackSection />);
    fireEvent.press(screen.getByLabelText("Spotify connection settings"));
    fireEvent.press(screen.getByText("Open Spotify Developer Dashboard"));

    await waitFor(() =>
      expect(Linking.openURL).toHaveBeenCalledWith(
        "https://developer.spotify.com/dashboard",
      ),
    );
    expect(screen.queryByText(/Invalid redirect URI:/)).toBeNull();
    fireEvent.press(screen.getByText("Troubleshooting"));
    expect(screen.getByText(/Invalid redirect URI:/)).toBeTruthy();
    expect(screen.getByText(/No active device:/)).toBeTruthy();
  });

  it("opens saved connection settings from the provider so unsaved edits cannot bypass Save", () => {
    mockController.spotifyClientId = SAVED_CLIENT_ID;
    mockController.isSpotifyAuthAvailable = true;
    mockController.spotifyAuthStatus = "notConnected";
    const screen = render(<MusicPlaybackSection />);

    fireEvent.press(screen.getByLabelText("Spotify, Connect"));
    expect(screen.getByLabelText("Spotify Client ID").props.value).toBe(
      SAVED_CLIENT_ID,
    );
    fireEvent.changeText(
      screen.getByLabelText("Spotify Client ID"),
      REPLACEMENT_CLIENT_ID,
    );
    fireEvent.press(screen.getByLabelText("Spotify, Connect"));

    expect(mockController.handlePlaybackSourceChange).not.toHaveBeenCalled();
    expect(mockController.handleSpotifyLogin).not.toHaveBeenCalled();
    expect(screen.getByText("Save your Client ID before connecting.")).toBeTruthy();
  });

  it("selects Spotify directly from the provider when it is already connected", () => {
    mockController.spotifyClientId = SAVED_CLIENT_ID;
    mockController.isSpotifyAuthAvailable = true;
    mockController.spotifyAuthStatus = "authorized";
    const screen = render(<MusicPlaybackSection />);

    fireEvent.press(screen.getByLabelText("Spotify, Connected"));

    expect(mockController.handlePlaybackSourceChange).toHaveBeenCalledWith(
      "spotify",
    );
    expect(screen.queryByLabelText("Spotify Client ID")).toBeNull();
  });

  it("validates the ID and surfaces a storage failure without connecting", async () => {
    const screen = render(<MusicPlaybackSection />);
    fireEvent.press(screen.getByLabelText("Spotify connection settings"));
    fireEvent.changeText(screen.getByLabelText("Spotify Client ID"), "wrong-id");
    fireEvent.press(screen.getByText("Save Client ID"));

    expect(screen.getByText(/Enter the 32-character Client ID/)).toBeTruthy();
    expect(mockController.saveSpotifyClientId).not.toHaveBeenCalled();

    mockController.saveSpotifyClientId.mockRejectedValueOnce(
      new Error("Could not store this Client ID."),
    );
    fireEvent.changeText(
      screen.getByLabelText("Spotify Client ID"),
      SAVED_CLIENT_ID,
    );
    fireEvent.press(screen.getByText("Save Client ID"));

    expect(await screen.findByText("Could not store this Client ID.")).toBeTruthy();
    expect(mockController.handleSpotifyLogin).not.toHaveBeenCalled();
  });

  it("saves a trimmed ID and requires a separate connect after the saved ID is ready", async () => {
    const screen = render(<MusicPlaybackSection />);
    fireEvent.press(screen.getByLabelText("Spotify connection settings"));
    fireEvent.changeText(
      screen.getByLabelText("Spotify Client ID"),
      `  ${SAVED_CLIENT_ID}  `,
    );
    fireEvent.press(screen.getByText("Connect Spotify"));
    expect(mockController.handleSpotifyLogin).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByText("Save Client ID"));
    });
    expect(mockController.saveSpotifyClientId).toHaveBeenCalledWith(SAVED_CLIENT_ID);
    expect(mockController.handleSpotifyLogin).not.toHaveBeenCalled();

    mockController.spotifyClientId = SAVED_CLIENT_ID;
    mockController.isSpotifyAuthAvailable = true;
    screen.rerender(<MusicPlaybackSection />);
    fireEvent.press(screen.getByText("Connect Spotify"));
    expect(mockController.handleSpotifyLogin).toHaveBeenCalledTimes(1);
  });

  it("prevents connecting with unsaved changes to an existing ID", () => {
    mockController.spotifyClientId = SAVED_CLIENT_ID;
    mockController.isSpotifyAuthAvailable = true;
    const screen = render(<MusicPlaybackSection />);
    fireEvent.press(screen.getByLabelText("Spotify connection settings"));
    fireEvent.changeText(
      screen.getByLabelText("Spotify Client ID"),
      REPLACEMENT_CLIENT_ID,
    );
    fireEvent.press(screen.getByText("Connect Spotify"));

    expect(screen.getByText("Save your Client ID before connecting.")).toBeTruthy();
    expect(mockController.handleSpotifyLogin).not.toHaveBeenCalled();
  });

  it("allows managing and removing the ID while connected", async () => {
    mockController.spotifyClientId = SAVED_CLIENT_ID;
    mockController.isSpotifyAuthAvailable = true;
    mockController.spotifyAuthStatus = "authorized";
    mockController.getSpotifyStatusLabel.mockReturnValue("Connected as Pedro");
    const screen = render(<MusicPlaybackSection />);

    expect(screen.getByText("Connected as Pedro")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Spotify connection settings"));
    expect(screen.getByText("Disconnect Spotify")).toBeTruthy();
    expect(screen.getByLabelText("Spotify Client ID").props.value).toBe(
      SAVED_CLIENT_ID,
    );
    expect(screen.queryByText("Connect Spotify")).toBeNull();
    fireEvent.press(screen.getByText("Remove Client ID"));

    await waitFor(() =>
      expect(mockController.saveSpotifyClientId).toHaveBeenCalledWith(""),
    );
    expect(
      await screen.findByText("Client ID removed and Spotify disconnected."),
    ).toBeTruthy();
  });
});
