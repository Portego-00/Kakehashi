import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import {
  SpotifyApi,
  type AccessToken,
  type Device,
  type PlaylistedTrack,
  type SimplifiedPlaylist,
  type Track,
} from "@spotify/web-api-ts-sdk";

const SPOTIFY_API_BASE_URL =
  process.env.EXPO_PUBLIC_SPOTIFY_API_BASE_URL?.trim() ||
  "https://api.spotify.com/v1";
const SPOTIFY_ACCOUNTS_URL =
  process.env.EXPO_PUBLIC_SPOTIFY_ACCOUNTS_URL?.trim() ||
  "https://accounts.spotify.com/api/token";
const SPOTIFY_AUTHORIZATION_URL =
  process.env.EXPO_PUBLIC_SPOTIFY_AUTHORIZATION_URL?.trim() ||
  "https://accounts.spotify.com/authorize";
const SPOTIFY_CLIENT_ID =
  process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID?.trim() ?? "";
const SPOTIFY_CLIENT_KEY =
  process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_KEY?.trim() ?? "";
const SPOTIFY_NATIVE_REDIRECT_URI = "kakehashi://spotify-auth";
const SPOTIFY_REDIRECT_URI =
  process.env.EXPO_PUBLIC_SPOTIFY_REDIRECT_URI?.trim() ||
  SPOTIFY_NATIVE_REDIRECT_URI;

const SPOTIFY_AUTH_TOKEN_KEY = "kakehashi.spotify.authToken.v1";
const TOKEN_REFRESH_MARGIN_SECONDS = 90;
const DEFAULT_MARKET = "JP";

export const SPOTIFY_DISCOVERY = {
  authorizationEndpoint: SPOTIFY_AUTHORIZATION_URL,
  tokenEndpoint: SPOTIFY_ACCOUNTS_URL,
};

export const SPOTIFY_AUTH_SCOPES = [
  "user-read-private",
  "user-read-playback-state",
  "user-modify-playback-state",
  "user-read-currently-playing",
  "playlist-read-private",
  "playlist-read-collaborative",
] as const;

export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  source?: "spotify" | "apple";
  albumArt: string;
  url: string;
  previewUrl: string | null;
  duration: number; // in milliseconds
  albumName: string;
  releaseDate: string;
}

export interface MusicPlaylist {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  trackCount: number;
  source: "spotify" | "apple";
  ownerName?: string;
  url?: string;
}

export interface SpotifyUserProfile {
  id: string;
  displayName: string;
  product: string;
  country?: string;
}

export interface SpotifyPlaybackSnapshot {
  isPlaying: boolean;
  progressMs: number;
  durationMs: number;
  trackId: string | null;
  deviceId: string | null;
}

export type SpotifyPlaybackErrorCode =
  | "NOT_CONFIGURED"
  | "NOT_AUTHORIZED"
  | "NO_ACTIVE_DEVICE"
  | "PREMIUM_REQUIRED"
  | "PLAYBACK_FAILED";

export class SpotifyPlaybackError extends Error {
  code: SpotifyPlaybackErrorCode;

  constructor(code: SpotifyPlaybackErrorCode, message: string) {
    super(message);
    this.name = "SpotifyPlaybackError";
    this.code = code;
  }
}

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface StoredSpotifyToken {
  accessToken: string;
  tokenType: string;
  expiresIn?: number;
  issuedAt: number;
  refreshToken?: string;
  scope?: string;
}

interface SpotifySearchResponse {
  tracks: {
    items: {
      id: string;
      name: string;
      artists: {
        id: string;
        name: string;
      }[];
      album: {
        name: string;
        images: {
          url: string;
          height: number;
          width: number;
        }[];
        release_date: string;
      };
      external_urls: {
        spotify: string;
      };
      preview_url: string | null;
      duration_ms: number;
    }[];
  };
}

interface SpotifyRawPlaybackState {
  is_playing?: boolean;
  progress_ms?: number | null;
  device?: {
    id?: string | null;
    is_restricted?: boolean;
  } | null;
  item?: {
    type?: string;
    id?: string | null;
    duration_ms?: number;
  } | null;
}

interface SpotifyPlayerRequestOptions {
  method: "GET" | "POST" | "PUT";
  query?: Record<string, string | number | undefined>;
  body?: Record<string, unknown>;
  expectsJson?: boolean;
}

class SpotifyService {
  private clientId: string;
  private clientSecret: string;
  private clientCredentialsToken: string | null = null;
  private clientCredentialsTokenExpiresAt = 0;
  private storedToken: StoredSpotifyToken | null = null;

  constructor() {
    this.clientId = SPOTIFY_CLIENT_ID;
    this.clientSecret = SPOTIFY_CLIENT_KEY;
  }

  getClientId(): string {
    return this.clientId;
  }

  getRedirectUri(): string {
    return SPOTIFY_REDIRECT_URI;
  }

  getScopes(): string[] {
    return [...SPOTIFY_AUTH_SCOPES];
  }

  isAuthConfigured(): boolean {
    return this.clientId.length > 0;
  }

  isConfigured(): boolean {
    return this.isAuthConfigured() || this.hasClientCredentials();
  }

  hasClientCredentials(): boolean {
    return this.clientId.length > 0 && this.clientSecret.length > 0;
  }

  async saveAuthTokenResponse(
    response: AuthSession.TokenResponse
  ): Promise<void> {
    const previousToken = await this.getStoredUserToken();
    const token: StoredSpotifyToken = {
      accessToken: response.accessToken,
      tokenType: response.tokenType,
      expiresIn: response.expiresIn,
      issuedAt: response.issuedAt,
      refreshToken: response.refreshToken || previousToken?.refreshToken,
      scope: response.scope,
    };

    await this.saveStoredUserToken(token);
  }

  async clearUserToken(): Promise<void> {
    this.storedToken = null;
    await SecureStore.deleteItemAsync(SPOTIFY_AUTH_TOKEN_KEY);
  }

  async isUserAuthorized(): Promise<boolean> {
    try {
      await this.getValidUserToken();
      return true;
    } catch {
      return false;
    }
  }

  async getUserProfile(): Promise<SpotifyUserProfile | null> {
    const sdk = await this.getUserSdk();
    const profile = await sdk.currentUser.profile();

    return {
      id: profile.id,
      displayName: profile.display_name || profile.id,
      product: profile.product,
      country: profile.country,
    };
  }

  async searchTracks(query: string, limit: number = 50): Promise<SpotifyTrack[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    try {
      const sdk = await this.getOptionalUserSdk();
      if (sdk) {
        const data = await sdk.search(
          trimmedQuery,
          ["track"],
          DEFAULT_MARKET,
          Math.min(limit, 50) as never
        );

        return (data.tracks?.items || []).map((track) =>
          this.mapSdkTrack(track)
        );
      }
    } catch (error) {
      console.warn("Spotify user search failed, falling back if possible:", error);
    }

    return this.searchTracksWithClientCredentials(trimmedQuery, limit);
  }

  async getTrackById(trackId: string): Promise<SpotifyTrack | null> {
    const trimmedTrackId = trackId.trim();
    if (!trimmedTrackId) {
      return null;
    }

    const sdk = await this.getOptionalUserSdk();
    if (sdk) {
      const track = await sdk.tracks.get(trimmedTrackId, DEFAULT_MARKET);
      return this.mapSdkTrack(track);
    }

    const accessToken = await this.getClientCredentialsAccessToken();
    const response = await fetch(`${SPOTIFY_API_BASE_URL}/tracks/${trackId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    return this.mapRawTrack(await response.json());
  }

  async getUserPlaylists(limit: number = 20): Promise<MusicPlaylist[]> {
    const sdk = await this.getUserSdk();
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 50));
    const page = await sdk.currentUser.playlists.playlists(
      safeLimit as never,
      0
    );

    return (page.items || []).map((playlist) =>
      this.mapPlaylist(playlist)
    );
  }

  async getPlaylistTracks(
    playlistId: string,
    limit: number = Number.POSITIVE_INFINITY
  ): Promise<SpotifyTrack[]> {
    const sdk = await this.getUserSdk();
    const hasFiniteLimit = Number.isFinite(limit);
    const safeLimit = hasFiniteLimit
      ? Math.max(1, Math.floor(limit))
      : Number.POSITIVE_INFINITY;
    const tracks: SpotifyTrack[] = [];
    let offset = 0;

    while (tracks.length < safeLimit) {
      const remaining = safeLimit - tracks.length;
      const pageLimit = Math.min(50, remaining);
      const page = await sdk.playlists.getPlaylistItems(
        playlistId,
        DEFAULT_MARKET,
        undefined,
        pageLimit as never,
        offset
      );

      const pageTracks = (page.items || [])
        .map((item) => this.mapPlaylistTrack(item))
        .filter((track): track is SpotifyTrack => track !== null);

      tracks.push(...pageTracks);

      if (!page.next || page.items.length === 0) {
        break;
      }
      offset += page.items.length;
    }

    return hasFiniteLimit ? tracks.slice(0, safeLimit) : tracks;
  }

  async getCurrentPlayback(): Promise<SpotifyPlaybackSnapshot | null> {
    const state = await this.sendPlayerRequest<SpotifyRawPlaybackState>(
      "/me/player",
      {
        method: "GET",
        query: { market: DEFAULT_MARKET },
        expectsJson: true,
      }
    );

    return state ? this.mapRawPlaybackState(state) : null;
  }

  async playTrack(trackId: string, positionMs: number = 0): Promise<void> {
    try {
      await this.sendPlayerRequest("/me/player/play", {
        method: "PUT",
        body: {
          uris: [`spotify:track:${trackId}`],
          position_ms: Math.max(0, Math.round(positionMs)),
        },
      });
    } catch (error) {
      const playbackError = this.toPlaybackError(error);
      if (playbackError.code !== "NO_ACTIVE_DEVICE") {
        throw playbackError;
      }

      const device = await this.resolvePlaybackDevice();
      if (!device?.id) {
        throw playbackError;
      }

      try {
        await this.sendPlayerRequest("/me/player/play", {
          method: "PUT",
          query: { device_id: device.id },
          body: {
            uris: [`spotify:track:${trackId}`],
            position_ms: Math.max(0, Math.round(positionMs)),
          },
        });
      } catch (fallbackError) {
        throw this.toPlaybackError(fallbackError);
      }
    }
  }

  async resumePlayback(): Promise<void> {
    try {
      await this.sendPlayerRequest("/me/player/play", {
        method: "PUT",
      });
    } catch (error) {
      const playbackError = this.toPlaybackError(error);
      if (playbackError.code !== "NO_ACTIVE_DEVICE") {
        throw playbackError;
      }

      const device = await this.resolvePlaybackDevice();
      if (!device?.id) {
        throw playbackError;
      }

      try {
        await this.sendPlayerRequest("/me/player/play", {
          method: "PUT",
          query: { device_id: device.id },
        });
      } catch (fallbackError) {
        throw this.toPlaybackError(fallbackError);
      }
    }
  }

  async pausePlayback(): Promise<void> {
    try {
      await this.sendPlayerRequest("/me/player/pause", {
        method: "PUT",
      });
    } catch (error) {
      const playbackError = this.toPlaybackError(error);
      if (playbackError.code !== "NO_ACTIVE_DEVICE") {
        throw playbackError;
      }
    }
  }

  async seekToPosition(positionMs: number): Promise<void> {
    try {
      await this.sendPlayerRequest("/me/player/seek", {
        method: "PUT",
        query: { position_ms: String(Math.max(0, Math.round(positionMs))) },
      });
    } catch (error) {
      const playbackError = this.toPlaybackError(error);
      if (playbackError.code !== "NO_ACTIVE_DEVICE") {
        throw playbackError;
      }

      const device = await this.resolvePlaybackDevice();
      if (!device?.id) {
        throw playbackError;
      }

      try {
        await this.sendPlayerRequest("/me/player/seek", {
          method: "PUT",
          query: {
            device_id: device.id,
            position_ms: String(Math.max(0, Math.round(positionMs))),
          },
        });
      } catch (fallbackError) {
        throw this.toPlaybackError(fallbackError);
      }
    }
  }

  async getNewJapaneseReleases(limit: number = 20): Promise<SpotifyTrack[]> {
    try {
      const results = await this.searchTracks(
        "YOASOBI OR Kenshi Yonezu OR Ado OR Official髭男dism OR あいみょん",
        limit
      );
      return results;
    } catch (error) {
      console.error("Error fetching new Japanese releases:", error);
      return [];
    }
  }

  async getPopularJapaneseSongs(limit: number = 20): Promise<SpotifyTrack[]> {
    try {
      const results = await this.searchTracks(
        "米津玄師 OR YOASOBI OR LiSA OR あいみょん",
        limit
      );
      return results;
    } catch (error) {
      console.error("Error fetching popular Japanese songs:", error);
      return [];
    }
  }

  async getAnimeSongs(limit: number = 20): Promise<SpotifyTrack[]> {
    try {
      const results = await this.searchTracks(
        "LiSA OR Aimer OR RADWIMPS OR ONE OK ROCK OR BUMP OF CHICKEN",
        limit
      );
      return results;
    } catch (error) {
      console.error("Error fetching anime songs:", error);
      return [];
    }
  }

  async getTrendingJapaneseSongs(limit: number = 20): Promise<SpotifyTrack[]> {
    try {
      const results = await this.searchTracks("Ado OR 藤井風 OR back number", limit);
      return results;
    } catch (error) {
      console.error("Error fetching trending Japanese songs:", error);
      return [];
    }
  }

  private async searchTracksWithClientCredentials(
    query: string,
    limit: number
  ): Promise<SpotifyTrack[]> {
    const accessToken = await this.getClientCredentialsAccessToken();
    const params = new URLSearchParams({
      q: query,
      type: "track",
      market: DEFAULT_MARKET,
      limit: Math.min(limit, 50).toString(),
    });

    const response = await fetch(
      `${SPOTIFY_API_BASE_URL}/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }

    const data: SpotifySearchResponse = await response.json();
    return (data.tracks?.items || []).map((track) => this.mapRawTrack(track));
  }

  private async getClientCredentialsAccessToken(): Promise<string> {
    if (!this.hasClientCredentials()) {
      throw new Error(
        "Missing Spotify credentials. Set EXPO_PUBLIC_SPOTIFY_CLIENT_ID for user auth, or add EXPO_PUBLIC_SPOTIFY_CLIENT_KEY for anonymous catalog search."
      );
    }

    if (
      this.clientCredentialsToken &&
      Date.now() < this.clientCredentialsTokenExpiresAt
    ) {
      return this.clientCredentialsToken;
    }

    const credentials = `${this.clientId}:${this.clientSecret}`;
    const encodedCredentials = btoa(credentials);

    const response = await fetch(SPOTIFY_ACCOUNTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${encodedCredentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (!response.ok) {
      throw new Error(`Spotify auth error: ${response.status}`);
    }

    const data: SpotifyTokenResponse = await response.json();
    this.clientCredentialsToken = data.access_token;
    this.clientCredentialsTokenExpiresAt =
      Date.now() + (data.expires_in - TOKEN_REFRESH_MARGIN_SECONDS) * 1000;

    return this.clientCredentialsToken;
  }

  private async getUserSdk(): Promise<SpotifyApi> {
    if (!this.isAuthConfigured()) {
      throw new SpotifyPlaybackError(
        "NOT_CONFIGURED",
        "Spotify client ID is not configured."
      );
    }

    const token = await this.getValidUserToken();
    return SpotifyApi.withAccessToken(this.clientId, this.toSdkAccessToken(token));
  }

  private async getOptionalUserSdk(): Promise<SpotifyApi | null> {
    if (!this.isAuthConfigured()) {
      return null;
    }

    try {
      return await this.getUserSdk();
    } catch {
      return null;
    }
  }

  private async getValidUserToken(): Promise<StoredSpotifyToken> {
    const token = await this.getStoredUserToken();

    if (!token?.accessToken) {
      throw new SpotifyPlaybackError(
        "NOT_AUTHORIZED",
        "Spotify account is not connected."
      );
    }

    if (this.isTokenFresh(token)) {
      return token;
    }

    if (!token.refreshToken) {
      throw new SpotifyPlaybackError(
        "NOT_AUTHORIZED",
        "Spotify authorization expired. Connect Spotify again."
      );
    }

    const refreshed = await AuthSession.refreshAsync(
      {
        clientId: this.clientId,
        refreshToken: token.refreshToken,
      },
      SPOTIFY_DISCOVERY
    );

    const nextToken: StoredSpotifyToken = {
      accessToken: refreshed.accessToken,
      tokenType: refreshed.tokenType,
      expiresIn: refreshed.expiresIn,
      issuedAt: refreshed.issuedAt,
      refreshToken: refreshed.refreshToken || token.refreshToken,
      scope: refreshed.scope || token.scope,
    };

    await this.saveStoredUserToken(nextToken);
    return nextToken;
  }

  private isTokenFresh(token: StoredSpotifyToken): boolean {
    if (!token.expiresIn) {
      return true;
    }

    const expiresAtMs = (token.issuedAt + token.expiresIn) * 1000;
    const refreshAtMs = expiresAtMs - TOKEN_REFRESH_MARGIN_SECONDS * 1000;
    return Date.now() < refreshAtMs;
  }

  private async getStoredUserToken(): Promise<StoredSpotifyToken | null> {
    if (this.storedToken) {
      return this.storedToken;
    }

    const rawToken = await SecureStore.getItemAsync(SPOTIFY_AUTH_TOKEN_KEY);
    if (!rawToken) {
      return null;
    }

    try {
      const parsedToken = JSON.parse(rawToken) as StoredSpotifyToken;
      if (!parsedToken.accessToken) {
        return null;
      }

      this.storedToken = parsedToken;
      return parsedToken;
    } catch {
      await SecureStore.deleteItemAsync(SPOTIFY_AUTH_TOKEN_KEY);
      return null;
    }
  }

  private async saveStoredUserToken(token: StoredSpotifyToken): Promise<void> {
    this.storedToken = token;
    await SecureStore.setItemAsync(
      SPOTIFY_AUTH_TOKEN_KEY,
      JSON.stringify(token)
    );
  }

  private toSdkAccessToken(token: StoredSpotifyToken): AccessToken {
    return {
      access_token: token.accessToken,
      token_type: token.tokenType,
      expires_in: token.expiresIn ?? 0,
      refresh_token: token.refreshToken ?? "",
      expires: token.expiresIn
        ? (token.issuedAt + token.expiresIn) * 1000
        : -1,
    };
  }

  private async sendPlayerRequest<T = null>(
    path: string,
    options: SpotifyPlayerRequestOptions
  ): Promise<T | null> {
    const token = await this.getValidUserToken();
    const url = new URL(`${SPOTIFY_API_BASE_URL}${path}`);

    for (const [key, value] of Object.entries(options.query || {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url.toString(), {
      method: options.method,
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 204) {
      return null;
    }

    const bodyText = await response.text().catch(() => "");

    if (!response.ok) {
      const spotifyMessage = this.extractSpotifyErrorMessage(bodyText);
      throw new Error(
        spotifyMessage
          ? `Spotify API error: ${response.status} ${spotifyMessage}`
          : `Spotify API error: ${response.status}`
      );
    }

    if (!options.expectsJson || !bodyText.trim()) {
      return null;
    }

    try {
      return JSON.parse(bodyText) as T;
    } catch {
      throw new Error(
        `Spotify API returned a non-JSON playback response: ${bodyText.slice(
          0,
          80
        )}`
      );
    }
  }

  private extractSpotifyErrorMessage(bodyText: string): string {
    const trimmedBody = bodyText.trim();
    if (!trimmedBody) {
      return "";
    }

    try {
      const parsed = JSON.parse(trimmedBody) as {
        error?: { message?: string; status?: number };
      };
      return parsed.error?.message || trimmedBody;
    } catch {
      return trimmedBody;
    }
  }

  private async resolvePlaybackDevice(): Promise<Device | null> {
    const sdk = await this.getUserSdk();
    const response = await sdk.player.getAvailableDevices();
    const devices = response.devices || [];

    return (
      devices.find((device) => device.is_active && !device.is_restricted && device.id) ||
      devices.find((device) => !device.is_restricted && device.id) ||
      null
    );
  }

  private mapRawPlaybackState(
    state: SpotifyRawPlaybackState
  ): SpotifyPlaybackSnapshot {
    const track = state.item?.type === "track" ? state.item : null;
    return {
      isPlaying: Boolean(state.is_playing),
      progressMs: Math.max(0, state.progress_ms || 0),
      durationMs: Math.max(0, track?.duration_ms || 0),
      trackId: track?.id ?? null,
      deviceId: state.device?.id ?? null,
    };
  }

  private mapPlaylist(playlist: SimplifiedPlaylist): MusicPlaylist {
    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description || "",
      imageUrl: this.getBestImageUrl(playlist.images),
      trackCount: playlist.tracks?.total ?? 0,
      source: "spotify",
      ownerName: playlist.owner?.display_name || undefined,
      url: playlist.external_urls?.spotify,
    };
  }

  private mapPlaylistTrack(
    item: PlaylistedTrack
  ): SpotifyTrack | null {
    const track = item.track;
    if (
      !track ||
      track.type !== "track" ||
      !("is_local" in track) ||
      track.is_local
    ) {
      return null;
    }

    return this.mapSdkTrack(track as Track);
  }

  private mapSdkTrack(track: Track): SpotifyTrack {
    return {
      id: track.id,
      title: track.name,
      artist: track.artists.map((artist) => artist.name).join(", "),
      artistId: track.artists[0]?.id || "",
      source: "spotify",
      albumArt: this.getBestImageUrl(track.album.images),
      url: track.external_urls.spotify,
      previewUrl: track.preview_url,
      duration: track.duration_ms,
      albumName: track.album.name,
      releaseDate: track.album.release_date,
    };
  }

  private mapRawTrack(track: SpotifySearchResponse["tracks"]["items"][number]): SpotifyTrack {
    return {
      id: track.id,
      title: track.name,
      artist: track.artists.map((artist) => artist.name).join(", "),
      artistId: track.artists[0]?.id || "",
      source: "spotify",
      albumArt: this.getBestImageUrl(track.album.images),
      url: track.external_urls.spotify,
      previewUrl: track.preview_url,
      duration: track.duration_ms,
      albumName: track.album.name,
      releaseDate: track.album.release_date,
    };
  }

  private getBestImageUrl(images: { url: string; height?: number | null }[]): string {
    return [...images].sort(
      (a, b) => (b.height || 0) - (a.height || 0)
    )[0]?.url || "";
  }

  private toPlaybackError(error: unknown): SpotifyPlaybackError {
    if (error instanceof SpotifyPlaybackError) {
      return error;
    }

    const message = error instanceof Error ? error.message : String(error);
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes("premium")) {
      return new SpotifyPlaybackError(
        "PREMIUM_REQUIRED",
        "Spotify playback control requires a Spotify Premium account."
      );
    }

    if (
      lowerMessage.includes("no active device") ||
      lowerMessage.includes("device not found") ||
      lowerMessage.includes("404")
    ) {
      return new SpotifyPlaybackError(
        "NO_ACTIVE_DEVICE",
        "No active Spotify device found. Open Spotify once, then try again."
      );
    }

    return new SpotifyPlaybackError("PLAYBACK_FAILED", message);
  }
}

export const spotifyService = new SpotifyService();
