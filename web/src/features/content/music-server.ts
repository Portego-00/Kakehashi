import "server-only";

import { Buffer } from "node:buffer";
import { readBoundedJson } from "./server-security";
import { parseIsoDuration, rankYouTubeVideos, type LyricsPayload, type MusicTrack, type YouTubeVideo } from "./music-providers";

const SPOTIFY_ACCOUNTS_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_API_ROOT = "https://api.spotify.com/v1";
const YOUTUBE_API_ROOT = "https://www.googleapis.com/youtube/v3";
const LRCLIB_API_ROOT = "https://lrclib.net/api";
const REQUEST_TIMEOUT_MS = 10_000;
const SPOTIFY_SEARCH_LIMIT = 10;
const SPOTIFY_DISCOVERY_LIMIT = 18;

interface SpotifyTokenResponse { access_token?: unknown; expires_in?: unknown }
interface SpotifySearchResponse { tracks?: { items?: unknown[] } }
interface YouTubeSearchResponse { items?: Array<{ id?: { videoId?: unknown } }> }
interface YouTubeVideosResponse { items?: unknown[] }

export interface SpotifyDiscoveryRequest {
  id: string;
  title: string;
  query: string;
}

type SpotifyTokenCache = { credentialKey: string; accessToken: string; expiresAt: number };
const shared = globalThis as typeof globalThis & { __kakehashiSpotifyToken?: SpotifyTokenCache };

export class MusicProviderError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryAfter?: string,
  ) {
    super(message);
    this.name = "MusicProviderError";
  }
}

function value(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function spotifyCredentials() {
  return {
    clientId: value(process.env.SPOTIFY_CLIENT_ID || process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID),
    clientSecret: value(process.env.SPOTIFY_CLIENT_SECRET || process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_KEY),
  };
}

function youtubeApiKey() {
  return value(process.env.YOUTUBE_API_KEY || process.env.EXPO_PUBLIC_YOUTUBE_API_KEY || process.env.NEXT_PUBLIC_YOUTUBE_API_KEY);
}

async function fetchJson(url: string, init: RequestInit, provider: string, maxBytes = 2_000_000) {
  let response: Response;
  try {
    response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch {
    throw new MusicProviderError(`${provider} could not be reached.`, 502);
  }
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after") || undefined;
    if (response.status === 429) throw new MusicProviderError(`${provider} is temporarily rate limited.`, 429, retryAfter);
    throw new MusicProviderError(`${provider} returned HTTP ${response.status}.`, 502);
  }
  try {
    return await readBoundedJson(response, maxBytes);
  } catch {
    throw new MusicProviderError(`${provider} returned an invalid response.`, 502);
  }
}

async function getSpotifyAccessToken(forceRefresh = false) {
  const { clientId, clientSecret } = spotifyCredentials();
  if (!clientId || !clientSecret) {
    throw new MusicProviderError("Spotify song search is not configured on this server.", 503);
  }
  const credentialKey = `${clientId}:${clientSecret}`;
  const cached = shared.__kakehashiSpotifyToken;
  if (!forceRefresh && cached?.credentialKey === credentialKey && Date.now() < cached.expiresAt) return cached.accessToken;

  const payload = await fetchJson(SPOTIFY_ACCOUNTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(credentialKey).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: "grant_type=client_credentials",
  }, "Spotify authentication", 64_000) as SpotifyTokenResponse;
  const accessToken = value(payload.access_token);
  const expiresIn = numberValue(payload.expires_in);
  if (!accessToken || expiresIn <= 0) throw new MusicProviderError("Spotify authentication returned an invalid token.", 502);
  shared.__kakehashiSpotifyToken = {
    credentialKey,
    accessToken,
    expiresAt: Date.now() + Math.max(30, expiresIn - 90) * 1_000,
  };
  return accessToken;
}

function mapSpotifyTrack(raw: unknown): MusicTrack | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const artists = Array.isArray(item.artists) ? item.artists.filter((artist): artist is Record<string, unknown> => Boolean(artist && typeof artist === "object")) : [];
  const album = item.album && typeof item.album === "object" ? item.album as Record<string, unknown> : {};
  const images = Array.isArray(album.images) ? album.images.filter((image): image is Record<string, unknown> => Boolean(image && typeof image === "object")) : [];
  const externalUrls = item.external_urls && typeof item.external_urls === "object" ? item.external_urls as Record<string, unknown> : {};
  const id = value(item.id);
  const title = value(item.name);
  const artistNames = artists.map((artist) => value(artist.name)).filter(Boolean);
  if (!id || !title || !artistNames.length) return null;
  const albumArt = [...images].sort((left, right) => numberValue(right.height) - numberValue(left.height)).map((image) => value(image.url)).find(Boolean) || "";
  return {
    id,
    title,
    artist: artistNames.join(", "),
    artistId: value(artists[0]?.id),
    albumArt,
    spotifyUrl: value(externalUrls.spotify),
    previewUrl: value(item.preview_url) || null,
    durationMs: Math.max(0, numberValue(item.duration_ms)),
    albumName: value(album.name),
    releaseDate: value(album.release_date),
  };
}

async function requestSpotifySearch(query: string, accessToken: string, limit = SPOTIFY_SEARCH_LIMIT) {
  const params = new URLSearchParams({ q: query, type: "track", market: "JP", limit: String(limit) });
  let response: Response;
  try {
    response = await fetch(`${SPOTIFY_API_ROOT}/search?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new MusicProviderError("Spotify could not be reached.", 502);
  }
  return response;
}

async function readSpotifyTracks(response: Response) {
  if (!response.ok) {
    const retryAfter = response.headers.get("retry-after") || undefined;
    if (response.status === 429) throw new MusicProviderError("Spotify is temporarily rate limited.", 429, retryAfter);
    throw new MusicProviderError(`Spotify returned HTTP ${response.status}.`, 502);
  }
  const payload = await readBoundedJson(response, 2_000_000) as SpotifySearchResponse;
  return (payload.tracks?.items || []).map(mapSpotifyTrack).filter((track): track is MusicTrack => track !== null);
}

export async function searchSpotifyTracks(query: string) {
  let accessToken = await getSpotifyAccessToken();
  let response = await requestSpotifySearch(query, accessToken);
  if (response.status === 401) {
    shared.__kakehashiSpotifyToken = undefined;
    accessToken = await getSpotifyAccessToken(true);
    response = await requestSpotifySearch(query, accessToken);
  }
  return readSpotifyTracks(response);
}

export async function discoverSpotifyTracks(sections: SpotifyDiscoveryRequest[]) {
  let accessToken = await getSpotifyAccessToken();
  let responses = await Promise.all(sections.map((section) => requestSpotifySearch(section.query, accessToken, SPOTIFY_DISCOVERY_LIMIT)));
  if (responses.some((response) => response.status === 401)) {
    shared.__kakehashiSpotifyToken = undefined;
    accessToken = await getSpotifyAccessToken(true);
    responses = await Promise.all(sections.map((section) => requestSpotifySearch(section.query, accessToken, SPOTIFY_DISCOVERY_LIMIT)));
  }
  const tracks = await Promise.all(responses.map(readSpotifyTracks));
  return sections.map((section, index) => ({ id: section.id, title: section.title, tracks: tracks[index] }));
}

function mapYouTubeVideo(raw: unknown): YouTubeVideo | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const snippet = item.snippet && typeof item.snippet === "object" ? item.snippet as Record<string, unknown> : {};
  const details = item.contentDetails && typeof item.contentDetails === "object" ? item.contentDetails as Record<string, unknown> : {};
  const status = item.status && typeof item.status === "object" ? item.status as Record<string, unknown> : {};
  const contentRating = details.contentRating && typeof details.contentRating === "object" ? details.contentRating as Record<string, unknown> : {};
  if (status.embeddable === false || status.privacyStatus === "private" || contentRating.ytRating === "ytAgeRestricted") return null;
  const thumbnails = snippet.thumbnails && typeof snippet.thumbnails === "object" ? snippet.thumbnails as Record<string, unknown> : {};
  const preferredThumbnail = ["high", "medium", "default"].map((key) => thumbnails[key]).find((thumbnail) => thumbnail && typeof thumbnail === "object") as Record<string, unknown> | undefined;
  const videoId = value(item.id);
  const title = value(snippet.title);
  if (!videoId || !title) return null;
  return {
    videoId,
    title,
    channelTitle: value(snippet.channelTitle),
    thumbnailUrl: value(preferredThumbnail?.url),
    duration: parseIsoDuration(value(details.duration)),
  };
}

export async function findYouTubeVideosByQuery(query: string, targetDuration: number) {
  const apiKey = youtubeApiKey();
  if (!apiKey) throw new MusicProviderError("YouTube song matching is not configured on this server.", 503);
  const searchParams = new URLSearchParams({
    part: "snippet",
    q: query.trim(),
    type: "video",
    videoCategoryId: "10",
    videoEmbeddable: "true",
    videoSyndicated: "true",
    maxResults: "10",
    regionCode: "JP",
    relevanceLanguage: "ja",
    key: apiKey,
  });
  const search = await fetchJson(`${YOUTUBE_API_ROOT}/search?${searchParams}`, { headers: { Accept: "application/json" } }, "YouTube") as YouTubeSearchResponse;
  const videoIds = (search.items || []).map((item) => value(item.id?.videoId)).filter(Boolean);
  if (!videoIds.length) return [];
  const detailsParams = new URLSearchParams({ part: "contentDetails,snippet,status", id: videoIds.join(","), key: apiKey });
  const details = await fetchJson(`${YOUTUBE_API_ROOT}/videos?${detailsParams}`, { headers: { Accept: "application/json" } }, "YouTube") as YouTubeVideosResponse;
  const videos = (details.items || []).map(mapYouTubeVideo).filter((video): video is YouTubeVideo => video !== null);
  return rankYouTubeVideos(videos, targetDuration);
}

export async function findYouTubeVideos(trackName: string, artistName: string, targetDuration: number) {
  return findYouTubeVideosByQuery(`${trackName} ${artistName}`.trim(), targetDuration);
}

function normalize(value: string) {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

function mapLyrics(raw: unknown): LyricsPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const plainLyrics = value(record.plainLyrics);
  const syncedLyrics = value(record.syncedLyrics) || null;
  if (!plainLyrics && !syncedLyrics) return null;
  return {
    id: numberValue(record.id) || null,
    trackName: value(record.trackName || record.name),
    artistName: value(record.artistName),
    albumName: value(record.albumName),
    plainLyrics,
    syncedLyrics,
    duration: Math.max(0, numberValue(record.duration)),
  };
}

function scoreLyrics(record: LyricsPayload, trackName: string, artistName: string, albumName: string, duration: number) {
  let score = record.syncedLyrics ? 1 : 0;
  const wantedTrack = normalize(trackName);
  const wantedArtist = normalize(artistName);
  const wantedAlbum = normalize(albumName);
  const recordTrack = normalize(record.trackName);
  const recordArtist = normalize(record.artistName);
  if (wantedTrack && recordTrack === wantedTrack) score += 8;
  else if (wantedTrack && (recordTrack.includes(wantedTrack) || wantedTrack.includes(recordTrack))) score += 3;
  if (wantedArtist && recordArtist === wantedArtist) score += 6;
  else if (wantedArtist && (recordArtist.includes(wantedArtist) || wantedArtist.includes(recordArtist))) score += 2;
  if (wantedAlbum && normalize(record.albumName) === wantedAlbum) score += 2;
  if (duration > 0 && record.duration > 0) score += Math.max(0, 4 - Math.abs(record.duration - duration));
  return score;
}

async function searchLrclibLyrics(trackName: string, artistName: string) {
  const searchParams = new URLSearchParams({
    ...(trackName ? { track_name: trackName } : {}),
    ...(artistName ? { artist_name: artistName } : {}),
    ...(!trackName && artistName ? { q: artistName } : {}),
  });
  const payload = await fetchJson(`${LRCLIB_API_ROOT}/search?${searchParams}`, { headers: { Accept: "application/json", "User-Agent": "KakehashiWeb/1.0" } }, "LRCLIB") as unknown;
  return Array.isArray(payload) ? payload.map(mapLyrics).filter((record): record is LyricsPayload => record !== null) : [];
}

function uniqueLyrics(records: LyricsPayload[]) {
  const seen = new Set<string>();
  return records.filter((record) => {
    const key = record.id === null
      ? `${normalize(record.trackName)}:${normalize(record.artistName)}:${Math.round(record.duration)}`
      : `id:${record.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function findLrclibLyricsCandidates(trackName: string, artistName: string, albumName = "", duration = 0) {
  if (!trackName && !artistName) return [];
  const exactPromise = trackName && artistName
    ? fetchJson(`${LRCLIB_API_ROOT}/get?${new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
      ...(albumName ? { album_name: albumName } : {}),
      ...(duration > 0 ? { duration: String(Math.round(duration)) } : {}),
    })}`, { headers: { Accept: "application/json", "User-Agent": "KakehashiWeb/1.0" } }, "LRCLIB").then(mapLyrics)
    : Promise.resolve(null);
  const [exactResult, searchResult] = await Promise.allSettled([
    exactPromise,
    searchLrclibLyrics(trackName, artistName),
  ]);
  const exact = exactResult.status === "fulfilled" ? exactResult.value : null;
  const searched = searchResult.status === "fulfilled" ? searchResult.value : [];
  if (!exact && searchResult.status === "rejected") throw searchResult.reason;
  return uniqueLyrics([...(exact ? [exact] : []), ...searched])
    .sort((left, right) => scoreLyrics(right, trackName, artistName, albumName, duration) - scoreLyrics(left, trackName, artistName, albumName, duration));
}

export async function findLrclibLyrics(trackName: string, artistName: string, albumName = "", duration = 0) {
  if (artistName) {
    const exactParams = new URLSearchParams({
      track_name: trackName,
      artist_name: artistName,
      ...(albumName ? { album_name: albumName } : {}),
      ...(duration > 0 ? { duration: String(Math.round(duration)) } : {}),
    });
    try {
      const exact = mapLyrics(await fetchJson(`${LRCLIB_API_ROOT}/get?${exactParams}`, { headers: { Accept: "application/json", "User-Agent": "KakehashiWeb/1.0" } }, "LRCLIB"));
      if (exact) return exact;
    } catch (error) {
      if (!(error instanceof MusicProviderError) || error.status === 429) throw error;
    }
  }

  const records = await searchLrclibLyrics(trackName, artistName);
  const best = [...records].sort((left, right) => scoreLyrics(right, trackName, artistName, albumName, duration) - scoreLyrics(left, trackName, artistName, albumName, duration))[0];
  if (!best) throw new MusicProviderError("No usable lyrics were found.", 404);
  return best;
}

export async function getLrclibLyricsById(id: string) {
  const lyrics = mapLyrics(await fetchJson(`${LRCLIB_API_ROOT}/get/${id}`, { headers: { Accept: "application/json", "User-Agent": "KakehashiWeb/1.0" } }, "LRCLIB"));
  if (!lyrics) throw new MusicProviderError("No usable lyrics were found.", 404);
  return lyrics;
}

export function resetMusicProviderCacheForTests() {
  shared.__kakehashiSpotifyToken = undefined;
}
