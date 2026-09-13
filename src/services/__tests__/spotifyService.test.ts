import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import fetchMock from "jest-fetch-mock";

jest.mock("expo-auth-session", () => ({ refreshAsync: jest.fn() }));
jest.mock("@spotify/web-api-ts-sdk", () => ({
  SpotifyApi: { withAccessToken: jest.fn() },
}));
jest.mock("../../utils/store", () => ({
  useSettingsStore: { getState: () => mockSettings },
}));

const PERSONAL_ID = "a".repeat(32);
const OTHER_ID = "b".repeat(32);
const CATALOG_ID = "c".repeat(32);
const TOKEN_KEY = "kakehashi.spotify.authToken.v1";
const mockSettings = {
  spotifyClientId: "",
  spotifyAuthStatus: "notConnected",
  spotifyDisplayName: null as string | null,
  songsPlaybackSource: "youtube",
  setSpotifyClientId: jest.fn((value: string) => { mockSettings.spotifyClientId = value; }),
  setSpotifyAuthStatus: jest.fn((value: string) => { mockSettings.spotifyAuthStatus = value; }),
  setSpotifyDisplayName: jest.fn((value: string | null) => { mockSettings.spotifyDisplayName = value; }),
  setSongsPlaybackSource: jest.fn((value: string) => { mockSettings.songsPlaybackSource = value; }),
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((fulfill) => { resolve = fulfill; });
  return { promise, resolve };
}

function authResponse(overrides: Partial<AuthSession.TokenResponse> = {}) {
  return {
    accessToken: "personal-access",
    tokenType: "Bearer",
    issuedAt: Math.floor(Date.now() / 1000),
    expiresIn: 3600,
    refreshToken: "personal-refresh",
    scope: "user-read-private",
    ...overrides,
  } as AuthSession.TokenResponse;
}

const rawTrack = {
  id: "track-id",
  name: "Song",
  type: "track",
  is_local: false,
  artists: [{ id: "artist-id", name: "Artist" }],
  album: { name: "Album", images: [], release_date: "2026-09-01" },
  external_urls: { spotify: "https://open.spotify.com/track/track-id" },
  preview_url: null,
  duration_ms: 120000,
};

describe("Spotify personal client configuration", () => {
  const originalClientId = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
  const originalClientKey = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_KEY;
  let service: typeof import("../spotifyService")["spotifyService"];
  let validate: typeof import("../spotifyService")["isSpotifyClientIdValid"];
  let secureToken: string | null;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.resetMocks();
    secureToken = null;
    mockSettings.spotifyClientId = "";
    mockSettings.spotifyAuthStatus = "notConnected";
    mockSettings.spotifyDisplayName = null;
    mockSettings.songsPlaybackSource = "youtube";
    process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID = CATALOG_ID;
    process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_KEY = "catalog-secret";
    jest.mocked(SecureStore.getItemAsync).mockImplementation(async () => secureToken);
    jest.mocked(SecureStore.setItemAsync).mockImplementation(async (_key, value) => {
      secureToken = value;
    });
    jest.mocked(SecureStore.deleteItemAsync).mockImplementation(async () => {
      secureToken = null;
    });
    jest.mocked(AuthSession.refreshAsync).mockReset();
    jest.mocked(SpotifyApi.withAccessToken).mockReset();
    jest.isolateModules(() => {
      // Reload the singleton after setting each test's build credentials.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const module = require("../spotifyService");
      service = module.spotifyService;
      validate = module.isSpotifyClientIdValid;
    });
  });

  afterAll(() => {
    if (originalClientId === undefined) delete process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID;
    else process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID = originalClientId;
    if (originalClientKey === undefined) delete process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_KEY;
    else process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_KEY = originalClientKey;
  });

  it("requires a personal ID for linking, while catalog search works without one", async () => {
    expect(service.getClientId()).toBe("");
    expect(service.isAuthConfigured()).toBe(false);
    expect(service.hasClientCredentials()).toBe(true);
    expect(await service.isUserAuthorized()).toBe(false);
    fetchMock.mockResponses(
      JSON.stringify({ access_token: "catalog-access", expires_in: 3600 }),
      JSON.stringify({ tracks: { items: [rawTrack] } })
    );
    expect(await service.searchTracks(" Song ")).toEqual([
      expect.objectContaining({ id: "track-id", title: "Song" }),
    ]);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: `Basic ${btoa(`${CATALOG_ID}:catalog-secret`)}`,
    });
    expect(fetchMock.mock.calls[1][1]?.headers).toMatchObject({
      Authorization: "Bearer catalog-access",
    });
    expect(SpotifyApi.withAccessToken).not.toHaveBeenCalled();
  });

  it("keeps searches and track lookups on catalog credentials after linking", async () => {
    await service.setClientId(PERSONAL_ID);
    await service.saveAuthTokenResponse(authResponse(), PERSONAL_ID);
    fetchMock.mockResponses(
      JSON.stringify({ access_token: "catalog-access", expires_in: 3600 }),
      JSON.stringify({ tracks: { items: [rawTrack] } }),
      JSON.stringify(rawTrack)
    );
    await service.searchTracks("Song");
    await service.getTrackById(" track-id ");
    expect(fetchMock.mock.calls[2][0]).toBe("https://api.spotify.com/v1/tracks/track-id");
    expect(fetchMock.mock.calls.slice(1).every(([, init]) =>
      (init?.headers as Record<string, string>).Authorization === "Bearer catalog-access"
    )).toBe(true);
    expect(SpotifyApi.withAccessToken).not.toHaveBeenCalled();
    expect(AuthSession.refreshAsync).not.toHaveBeenCalled();
  });

  it("validates and trims IDs, preserving an existing connection for invalid input", async () => {
    expect(validate(` ${PERSONAL_ID.toUpperCase()} `)).toBe(true);
    expect(validate("")).toBe(false);
    expect(validate("g".repeat(32))).toBe(false);
    expect(validate("a".repeat(31))).toBe(false);
    await service.setClientId(` ${PERSONAL_ID} `);
    await service.saveAuthTokenResponse(authResponse(), PERSONAL_ID);
    await expect(service.setClientId("not-a-client-id")).rejects.toThrow("32-character");
    expect(service.getClientId()).toBe(PERSONAL_ID);
    expect(await service.isUserAuthorized()).toBe(true);
    await service.setClientId(` ${PERSONAL_ID} `);
    expect(await service.isUserAuthorized()).toBe(true);
  });

  it("clears tokens, connection details and Spotify playback before changing the ID", async () => {
    await service.setClientId(PERSONAL_ID);
    await service.saveAuthTokenResponse(authResponse(), PERSONAL_ID);
    mockSettings.spotifyAuthStatus = "authorized";
    mockSettings.spotifyDisplayName = "Listener";
    mockSettings.songsPlaybackSource = "spotify";
    const deletion = deferred<void>();
    jest.mocked(SecureStore.deleteItemAsync).mockImplementationOnce(async () => {
      await deletion.promise;
      secureToken = null;
    });
    const changing = service.setClientId(OTHER_ID);
    expect(service.getClientId()).toBe(PERSONAL_ID);
    expect(mockSettings.spotifyAuthStatus).toBe("notConnected");
    expect(mockSettings.spotifyDisplayName).toBeNull();
    expect(mockSettings.songsPlaybackSource).toBe("youtube");
    expect(await service.isUserAuthorized()).toBe(false);
    deletion.resolve();
    await changing;
    expect(service.getClientId()).toBe(OTHER_ID);
    expect(secureToken).toBeNull();
    await service.setClientId("");
    expect(mockSettings.spotifyAuthStatus).toBe("notConfigured");
  });

  it.each([undefined, OTHER_ID])("rejects persisted tokens bound to %s", async (clientId) => {
    mockSettings.spotifyClientId = PERSONAL_ID;
    secureToken = JSON.stringify({ ...authResponse(), clientId });
    expect(await service.isUserAuthorized()).toBe(false);
    expect(AuthSession.refreshAsync).not.toHaveBeenCalled();
  });

  it("binds login tokens to the captured personal ID and rejects a stale login", async () => {
    await service.setClientId(PERSONAL_ID);
    await service.saveAuthTokenResponse(authResponse(), PERSONAL_ID);
    expect(JSON.parse(secureToken!)).toMatchObject({ clientId: PERSONAL_ID });
    await service.setClientId(OTHER_ID);
    await expect(service.saveAuthTokenResponse(authResponse(), PERSONAL_ID))
      .rejects.toThrow("connection changed");
    expect(secureToken).toBeNull();
  });

  it("uses the personal ID for profiles and accepts Spotify omitting product", async () => {
    await service.setClientId(PERSONAL_ID);
    await service.saveAuthTokenResponse(authResponse(), PERSONAL_ID);
    const profile = jest.fn().mockResolvedValue({ id: "listener", display_name: "Listener" });
    jest.mocked(SpotifyApi.withAccessToken).mockReturnValue({
      currentUser: { profile },
    } as unknown as SpotifyApi);
    expect(await service.getUserProfile()).toMatchObject({
      id: "listener", displayName: "Listener", product: undefined,
    });
    expect(SpotifyApi.withAccessToken).toHaveBeenCalledWith(
      PERSONAL_ID, expect.objectContaining({ access_token: "personal-access" })
    );
  });

  it("refreshes concurrently requested tokens once with the bound ID and retains a missing refresh token", async () => {
    await service.setClientId(PERSONAL_ID);
    await service.saveAuthTokenResponse(authResponse({ issuedAt: 0 }), PERSONAL_ID);
    const refreshing = deferred<AuthSession.TokenResponse>();
    const started = deferred<void>();
    jest.mocked(AuthSession.refreshAsync).mockImplementationOnce(() => {
      started.resolve();
      return refreshing.promise;
    });
    const first = service.isUserAuthorized();
    const second = service.isUserAuthorized();
    await started.promise;
    expect(AuthSession.refreshAsync).toHaveBeenCalledTimes(1);
    expect(AuthSession.refreshAsync).toHaveBeenCalledWith(
      { clientId: PERSONAL_ID, refreshToken: "personal-refresh" }, expect.anything()
    );
    refreshing.resolve(authResponse({ accessToken: "refreshed", refreshToken: undefined }));
    expect(await Promise.all([first, second])).toEqual([true, true]);
    expect(JSON.parse(secureToken!)).toMatchObject({
      clientId: PERSONAL_ID, accessToken: "refreshed", refreshToken: "personal-refresh",
    });
  });

  it.each(["disconnect", "replace"])("does not restore tokens when a refresh finishes after %s", async (operation) => {
    await service.setClientId(PERSONAL_ID);
    await service.saveAuthTokenResponse(authResponse({ issuedAt: 0 }), PERSONAL_ID);
    const refreshing = deferred<AuthSession.TokenResponse>();
    const started = deferred<void>();
    jest.mocked(AuthSession.refreshAsync).mockImplementationOnce(() => {
      started.resolve();
      return refreshing.promise;
    });
    const authorization = service.isUserAuthorized();
    await started.promise;
    if (operation === "disconnect") await service.clearUserToken();
    else await service.setClientId(OTHER_ID);
    refreshing.resolve(authResponse({ accessToken: "stale-refresh" }));
    expect(await authorization).toBe(false);
    expect(secureToken).toBeNull();
    expect(await service.isUserAuthorized()).toBe(false);
  });

  it("does not overwrite a new login with an older same-client refresh", async () => {
    await service.setClientId(PERSONAL_ID);
    await service.saveAuthTokenResponse(authResponse({ issuedAt: 0 }), PERSONAL_ID);
    const refreshing = deferred<AuthSession.TokenResponse>();
    const started = deferred<void>();
    jest.mocked(AuthSession.refreshAsync).mockImplementationOnce(() => {
      started.resolve();
      return refreshing.promise;
    });
    const authorization = service.isUserAuthorized();
    await started.promise;
    await service.saveAuthTokenResponse(authResponse({ accessToken: "new-login" }), PERSONAL_ID);
    refreshing.resolve(authResponse({ accessToken: "old-refresh" }));
    expect(await authorization).toBe(false);
    expect(JSON.parse(secureToken!)).toMatchObject({ accessToken: "new-login" });
  });

  it("finishes a pending secure save before deleting it on disconnect", async () => {
    await service.setClientId(PERSONAL_ID);
    const saving = deferred<void>();
    const started = deferred<void>();
    jest.mocked(SecureStore.setItemAsync).mockImplementationOnce(async (_key, value) => {
      started.resolve();
      await saving.promise;
      secureToken = value;
    });
    const login = service.saveAuthTokenResponse(authResponse(), PERSONAL_ID);
    const rejectedLogin = expect(login).rejects.toThrow("connection changed");
    await started.promise;
    const disconnecting = service.clearUserToken();
    saving.resolve();
    await rejectedLogin;
    await disconnecting;
    expect(secureToken).toBeNull();
    expect(await service.isUserAuthorized()).toBe(false);
  });

  it("cannot reload old credentials after a secure deletion failure", async () => {
    await service.setClientId(PERSONAL_ID);
    await service.saveAuthTokenResponse(authResponse(), PERSONAL_ID);
    jest.mocked(SecureStore.deleteItemAsync).mockRejectedValueOnce(new Error("Secure storage failed"));
    await expect(service.clearUserToken()).rejects.toThrow("Secure storage failed");
    expect(await service.isUserAuthorized()).toBe(false);
  });

  it("rejects a secure read that completes after disconnect", async () => {
    mockSettings.spotifyClientId = PERSONAL_ID;
    const reading = deferred<string | null>();
    const started = deferred<void>();
    jest.mocked(SecureStore.getItemAsync).mockImplementationOnce(() => {
      started.resolve();
      return reading.promise;
    });
    const authorization = service.isUserAuthorized();
    await started.promise;
    await service.clearUserToken();
    reading.resolve(JSON.stringify({ ...authResponse(), clientId: PERSONAL_ID }));
    expect(await authorization).toBe(false);
    expect(await service.isUserAuthorized()).toBe(false);
  });

  it("imports current development-app playlist items and counts", async () => {
    await service.setClientId(PERSONAL_ID);
    await service.saveAuthTokenResponse(authResponse(), PERSONAL_ID);
    const makeRequest = jest.fn().mockResolvedValue({ items: [{ item: rawTrack }], next: null });
    const playlists = jest.fn().mockResolvedValue({ items: [{
      id: "playlist-id", name: "Study", images: [], items: { total: 1 },
    }] });
    jest.mocked(SpotifyApi.withAccessToken).mockReturnValue({
      makeRequest, currentUser: { playlists: { playlists } },
    } as unknown as SpotifyApi);
    expect(await service.getUserPlaylists()).toEqual([
      expect.objectContaining({ trackCount: 1 }),
    ]);
    expect(await service.getPlaylistTracks("playlist-id")).toEqual([
      expect.objectContaining({ id: "track-id" }),
    ]);
    expect(makeRequest).toHaveBeenCalledWith(
      "GET", "playlists/playlist-id/items?market=JP&limit=50&offset=0"
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(TOKEN_KEY, expect.any(String));
  });
});
