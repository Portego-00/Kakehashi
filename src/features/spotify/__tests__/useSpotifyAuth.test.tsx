import { act, renderHook, waitFor } from "@testing-library/react-native";

import { spotifyService } from "../../../services/spotifyService";
import { useSettingsStore } from "../../../utils/store";
import { useSpotifyAuth } from "../useSpotifyAuth";

const CLIENT_ID = "a".repeat(32);
const SECOND_CLIENT_ID = "b".repeat(32);
const mockPrompt = jest.fn();
const mockExchange = jest.fn();
let mockRequestClientId = CLIENT_ID;
const mockToken = { accessToken: "user-token", tokenType: "Bearer", issuedAt: 1 };
const mockProfile = { id: "listener", displayName: "Listener" };

jest.mock("expo-auth-session", () => ({
  ResponseType: { Code: "code" },
  useAuthRequest: () => [
    { clientId: mockRequestClientId, codeVerifier: "pkce-verifier" },
    { type: "success", params: { code: "auth-code" } },
    mockPrompt,
  ],
  exchangeCodeAsync: (...args: unknown[]) => mockExchange(...args),
}));
jest.mock("expo-web-browser", () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock("../../../utils/store", () => {
  const { create } = jest.requireActual("zustand");
  return {
    useSettingsStore: create((set: (state: object) => void) => ({
      spotifyClientId: "a".repeat(32),
      spotifyAuthStatus: "notConnected",
      spotifyDisplayName: null,
      setSpotifyAuthStatus: (spotifyAuthStatus: string) => set({ spotifyAuthStatus }),
      setSpotifyDisplayName: (spotifyDisplayName: string | null) => set({ spotifyDisplayName }),
    })),
  };
});
jest.mock("../../../services/spotifyService", () => ({
  SPOTIFY_DISCOVERY: { tokenEndpoint: "https://accounts.spotify.com/api/token" },
  isSpotifyClientIdValid: (value: string) => /^[a-f0-9]{32}$/i.test(value),
  spotifyService: {
    getClientId: () => jest.requireMock("../../../utils/store").useSettingsStore.getState().spotifyClientId,
    getRedirectUri: () => "kakehashi://spotify-auth",
    getScopes: () => ["user-read-playback-state"],
    isAuthConfigured: () => true,
    getUserProfile: jest.fn(),
    saveAuthTokenResponse: jest.fn(),
    clearUserToken: jest.fn(),
    setClientId: jest.fn(),
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  jest.clearAllMocks();
  useSettingsStore.setState({ spotifyClientId: CLIENT_ID, spotifyAuthStatus: "notConnected", spotifyDisplayName: null });
  mockRequestClientId = CLIENT_ID;
  mockPrompt.mockResolvedValue({ type: "success", params: { code: "auth-code" } });
  mockExchange.mockResolvedValue(mockToken);
  jest.mocked(spotifyService.getUserProfile).mockResolvedValue(mockProfile);
  jest.mocked(spotifyService.saveAuthTokenResponse).mockResolvedValue(undefined);
  jest.mocked(spotifyService.clearUserToken).mockResolvedValue(undefined);
});

it("exchanges each code once with the saved ID and PKCE, without a secret", async () => {
  const { result } = renderHook(() => useSpotifyAuth());
  await waitFor(() => expect(result.current.profile).toEqual(mockProfile));
  await act(async () => { await result.current.requestAuthorization(); });
  expect(mockExchange).toHaveBeenCalledTimes(1);
  expect(mockExchange.mock.calls[0][0]).toEqual({
    clientId: CLIENT_ID, code: "auth-code", redirectUri: "kakehashi://spotify-auth",
    extraParams: { code_verifier: "pkce-verifier" },
  });
  expect(spotifyService.saveAuthTokenResponse).toHaveBeenCalledWith(mockToken, CLIENT_ID);
  expect(useSettingsStore.getState().spotifyAuthStatus).toBe("authorized");
});

it("waits for a PKCE request matching a newly saved client ID", async () => {
  useSettingsStore.setState({ spotifyClientId: SECOND_CLIENT_ID });
  const { result } = renderHook(() => useSpotifyAuth());
  await act(async () => { await result.current.requestAuthorization(); });
  expect(mockPrompt).not.toHaveBeenCalled();
  expect(result.current.error?.message).toContain("still loading");
});

it("ignores a token exchange that finishes after disconnect", async () => {
  const pending = deferred<typeof mockToken>();
  mockExchange.mockReturnValue(pending.promise);
  const { result } = renderHook(() => useSpotifyAuth());
  await waitFor(() => expect(result.current.profile).toEqual(mockProfile));
  let authorization!: Promise<unknown>;
  await act(async () => { authorization = result.current.requestAuthorization(); });
  await act(async () => { await result.current.disconnect(); });
  await act(async () => { pending.resolve(mockToken); await authorization; });
  expect(spotifyService.saveAuthTokenResponse).not.toHaveBeenCalled();
  expect(useSettingsStore.getState().spotifyAuthStatus).toBe("notConnected");
  expect(result.current.isAuthenticating).toBe(false);
});

it("ignores an exchange if the saved client ID changes", async () => {
  const pending = deferred<typeof mockToken>();
  mockExchange.mockReturnValue(pending.promise);
  const { result } = renderHook(() => useSpotifyAuth());
  let authorization!: Promise<unknown>;
  await act(async () => { authorization = result.current.requestAuthorization(); });
  await act(async () => { useSettingsStore.setState({ spotifyClientId: SECOND_CLIENT_ID }); });
  await act(async () => { pending.resolve(mockToken); await authorization; });
  expect(spotifyService.saveAuthTokenResponse).not.toHaveBeenCalled();
});

it("shows actionable allowlist and Premium guidance if login succeeds but API access is forbidden", async () => {
  jest.mocked(spotifyService.getUserProfile).mockRejectedValue(new Error("Spotify API error: 403"));
  const { result } = renderHook(() => useSpotifyAuth());
  let authorization: unknown;
  await act(async () => { authorization = await result.current.requestAuthorization(); });
  expect(authorization).toBeNull();
  expect(result.current.error?.message).toContain("Users Management");
  expect(result.current.error?.message).toContain("Premium");
  expect(useSettingsStore.getState().spotifyAuthStatus).toBe("notConnected");
});

it("does not exchange cancelled or declined authorizations", async () => {
  mockPrompt.mockResolvedValue({ type: "cancel" });
  const { result } = renderHook(() => useSpotifyAuth());
  await act(async () => { await result.current.requestAuthorization(); });
  expect(result.current.isAuthenticating).toBe(false);
  expect(result.current.error).toBeNull();
  mockPrompt.mockResolvedValue({ type: "error", params: { error: "access_denied" } });
  await act(async () => { await result.current.requestAuthorization(); });
  expect(result.current.error?.message).toContain("declined");
  expect(mockExchange).not.toHaveBeenCalled();
});
