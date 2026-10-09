import {
  CatalogSearchType,
  MusicKit,
  type ISong,
} from "@lomray/react-native-apple-music";
import { Platform } from "react-native";
import type { MusicPlaylist, SpotifyTrack } from "./spotifyService";

const APPLE_CATALOG_MAX_LIMIT = 25;
const APPLE_RSS_MAX_LIMIT = 50;
const ITUNES_MAX_LIMIT = 200;
const ITUNES_COUNTRY = "jp";
const APPLE_RSS_BASE_URL = "https://rss.marketingtools.apple.com/api/v2";
const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";
const ITUNES_LOOKUP_URL = "https://itunes.apple.com/lookup";

const JAPANESE_RELEASE_ARTIST_IDS = [
  1490256993, // YOASOBI
  1492604670, // Ado
  962221033, // Mrs. GREEN APPLE
  530814268, // Kenshi Yonezu
  960568308, // Official HIGE DANDISM
  1487570516, // Vaundy
  1258439196, // King Gnu
  185088141, // BUMP OF CHICKEN
] as const;

const ANIME_ARTIST_IDS = [
  573943518, // LiSA
  569972619, // Aimer
  91160335, // RADWIMPS
  295201343, // ASIAN KUNG-FU GENERATION
  624956375, // FLOW
  308131412, // SPYAIR
  912316913, // SawanoHiroyuki[nZk]
  424817976, // MAN WITH A MISSION
  1492604670, // Ado
  185088141, // BUMP OF CHICKEN
] as const;

const KNOWN_ANIME_ARTIST_IDS = new Set<string>(
  ANIME_ARTIST_IDS.map(String)
);

const NON_OFFICIAL_PATTERN =
  /\b(cover|karaoke|instrumental|tribute|piano|nightcore|sped\s?up|music box)\b|カラオケ|オルゴール|歌ってみた|弾いてみた|作業用BGM/i;
const SUSPICIOUS_ARTIST_PATTERN =
  /\b(ring music|music box|karaoke|piano|cover|tribute|orgel)\b|カラオケ|オルゴール/i;
const ANIME_KEYWORD_PATTERN =
  /アニメ|主題歌|オープニング|エンディング|挿入歌|TVサイズ|TVアニメ|\bop\b|\bed\b|opening|ending|theme/i;

interface ItunesSongResult {
  trackId?: number;
  trackName?: string;
  artistName?: string;
  artistId?: number;
  artworkUrl100?: string;
  trackViewUrl?: string;
  previewUrl?: string;
  trackTimeMillis?: number;
  collectionName?: string;
  releaseDate?: string;
}

interface ItunesResponse {
  results?: ItunesSongResult[];
}

interface AppleRssSongResult {
  artistName?: string;
  id?: string;
  name?: string;
  artistId?: string;
  artworkUrl100?: string;
  url?: string;
  releaseDate?: string;
}

interface AppleRssResponse {
  feed?: {
    results?: AppleRssSongResult[];
  };
}

class AppleMusicService {
  private normalizeLimit(limit: number, max: number = APPLE_CATALOG_MAX_LIMIT): number {
    if (!Number.isFinite(limit)) {
      return max;
    }

    return Math.max(1, Math.min(Math.floor(limit), max));
  }

  private normalizeArtworkUrl(url: string): string {
    if (!url) {
      return "";
    }

    return url.replace(/\/\d+x\d+bb\./, "/512x512bb.");
  }

  private toDurationMs(duration: unknown): number {
    if (typeof duration === "number" && Number.isFinite(duration)) {
      return Math.max(0, Math.round(duration * 1000));
    }

    if (typeof duration === "string") {
      const parsed = Number.parseFloat(duration);
      if (Number.isFinite(parsed)) {
        return Math.max(0, Math.round(parsed * 1000));
      }
    }

    return 0;
  }

  private compareByReleaseDateDesc(a: SpotifyTrack, b: SpotifyTrack): number {
    const aTime = Date.parse(a.releaseDate || "");
    const bTime = Date.parse(b.releaseDate || "");

    const safeATime = Number.isFinite(aTime) ? aTime : 0;
    const safeBTime = Number.isFinite(bTime) ? bTime : 0;

    return safeBTime - safeATime;
  }

  private isLikelyNonOfficial(track: SpotifyTrack): boolean {
    const metadata = `${track.title} ${track.artist} ${track.albumName}`;
    if (NON_OFFICIAL_PATTERN.test(metadata)) {
      return true;
    }

    return SUSPICIOUS_ARTIST_PATTERN.test(track.artist);
  }

  private hasAnimeSignal(track: SpotifyTrack): boolean {
    const metadata = `${track.title} ${track.albumName}`;
    return ANIME_KEYWORD_PATTERN.test(metadata);
  }

  private getAnimeScore(track: SpotifyTrack): number {
    let score = 0;

    if (this.hasAnimeSignal(track)) {
      score += 4;
    }

    if (KNOWN_ANIME_ARTIST_IDS.has(track.artistId)) {
      score += 2;
    }

    return score;
  }

  private mapCatalogSong(song: ISong): SpotifyTrack | null {
    if (!song.id || !song.title || !song.artistName) {
      return null;
    }

    return {
      id: String(song.id),
      title: song.title,
      artist: song.artistName,
      artistId: "",
      source: "apple",
      albumArt: song.artworkUrl || "",
      url: "",
      previewUrl: null,
      duration: this.toDurationMs(song.duration),
      albumName: "",
      releaseDate: "",
    };
  }

  private mapItunesSong(song: ItunesSongResult): SpotifyTrack | null {
    if (!song.trackId || !song.trackName || !song.artistName) {
      return null;
    }

    return {
      id: String(song.trackId),
      title: song.trackName,
      artist: song.artistName,
      artistId: song.artistId ? String(song.artistId) : "",
      source: "apple",
      albumArt: this.normalizeArtworkUrl(song.artworkUrl100 || ""),
      url: song.trackViewUrl || "",
      previewUrl: song.previewUrl || null,
      duration: song.trackTimeMillis || 0,
      albumName: song.collectionName || "",
      releaseDate: song.releaseDate || "",
    };
  }

  private mapRssSong(song: AppleRssSongResult): SpotifyTrack | null {
    if (!song.id || !song.name || !song.artistName) {
      return null;
    }

    return {
      id: String(song.id),
      title: song.name,
      artist: song.artistName,
      artistId: song.artistId ? String(song.artistId) : "",
      source: "apple",
      albumArt: this.normalizeArtworkUrl(song.artworkUrl100 || ""),
      url: song.url || "",
      previewUrl: null,
      duration: 0,
      albumName: "",
      releaseDate: song.releaseDate || "",
    };
  }

  private dedupeTracks(tracks: SpotifyTrack[]): SpotifyTrack[] {
    const seen = new Set<string>();
    return tracks.filter((track) => {
      if (seen.has(track.id)) {
        return false;
      }

      seen.add(track.id);
      return true;
    });
  }

  private async fetchJson<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Apple Music data request failed (${response.status})`);
    }
    return (await response.json()) as T;
  }

  private async collectDiscoveryTracks(requests: Promise<SpotifyTrack[]>[]): Promise<SpotifyTrack[]> {
    const results = await Promise.allSettled(requests);
    const tracks = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const failure = results.find((result) => result.status === "rejected");
    if (tracks.length === 0 && failure?.status === "rejected") {
      throw failure.reason;
    }
    return this.dedupeTracks(tracks);
  }

  private async getMostPlayedSongs(limit: number): Promise<SpotifyTrack[]> {
    const safeLimit = this.normalizeLimit(limit, APPLE_RSS_MAX_LIMIT);
    const url = `${APPLE_RSS_BASE_URL}/${ITUNES_COUNTRY}/music/most-played/${safeLimit}/songs.json`;
    const data = await this.fetchJson<AppleRssResponse>(url);

    const tracks = (data?.feed?.results || [])
      .map((song) => this.mapRssSong(song))
      .filter((track): track is SpotifyTrack => track !== null);

    return this.dedupeTracks(tracks);
  }

  private async searchItunesSongs(
    query: string,
    limit: number,
  ): Promise<SpotifyTrack[]> {
    const safeLimit = this.normalizeLimit(limit, ITUNES_MAX_LIMIT);
    const params = new URLSearchParams({
      term: query,
      country: ITUNES_COUNTRY,
      media: "music",
      entity: "song",
      limit: String(safeLimit),
      lang: "ja_jp",
    });

    const data = await this.fetchJson<ItunesResponse>(
      `${ITUNES_SEARCH_URL}?${params.toString()}`
    );

    const tracks = (data?.results || [])
      .map((song) => this.mapItunesSong(song))
      .filter((track): track is SpotifyTrack => track !== null);

    return this.dedupeTracks(tracks);
  }

  private async lookupRecentSongsByArtist(
    artistId: number,
    limit: number,
  ): Promise<SpotifyTrack[]> {
    const safeLimit = this.normalizeLimit(limit, ITUNES_MAX_LIMIT);
    const params = new URLSearchParams({
      id: String(artistId),
      entity: "song",
      limit: String(safeLimit),
      sort: "recent",
      country: ITUNES_COUNTRY,
    });

    const data = await this.fetchJson<ItunesResponse>(
      `${ITUNES_LOOKUP_URL}?${params.toString()}`
    );

    const tracks = (data?.results || [])
      .map((song) => this.mapItunesSong(song))
      .filter((track): track is SpotifyTrack => track !== null);

    return this.dedupeTracks(tracks);
  }

  private async searchAcrossQueries(
    queries: string[],
    limit: number,
  ): Promise<SpotifyTrack[]> {
    const target = this.normalizeLimit(limit);
    const combined: SpotifyTrack[] = [];
    const seenIds = new Set<string>();
    const failures: unknown[] = [];

    for (const query of queries) {
      if (combined.length >= target) {
        break;
      }

      const remaining = target - combined.length;
      const queryLimit = Math.min(remaining, APPLE_CATALOG_MAX_LIMIT);

      try {
        const tracks = await this.searchTracks(query, queryLimit);
        for (const track of tracks) {
          if (seenIds.has(track.id)) {
            continue;
          }

          seenIds.add(track.id);
          combined.push(track);

          if (combined.length >= target) {
            break;
          }
        }
      } catch (error) {
        failures.push(error);
        console.warn(
          `Apple Music search fallback failed for query "${query}"`,
          error,
        );
      }
    }

    if (combined.length === 0 && failures.length > 0) {
      throw failures[0];
    }
    return combined;
  }

  async searchTracks(query: string, limit: number = 25): Promise<SpotifyTrack[]> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    if (Platform.OS !== "ios") {
      return [];
    }

    try {
      const safeLimit = this.normalizeLimit(limit, APPLE_CATALOG_MAX_LIMIT);
      const response = await MusicKit.catalogSearch(
        trimmedQuery,
        [CatalogSearchType.SONGS],
        {
          limit: safeLimit,
          offset: 0,
        },
      );

      const tracks = (response?.songs || [])
        .map((song) => this.mapCatalogSong(song))
        .filter((track): track is SpotifyTrack => track !== null);

      return this.dedupeTracks(tracks);
    } catch (error) {
      console.error("Error searching Apple Music tracks:", error);
      throw error;
    }
  }

  async getUserPlaylists(limit: number = 20): Promise<MusicPlaylist[]> {
    if (Platform.OS !== "ios") {
      return [];
    }

    const safeLimit = this.normalizeLimit(limit, APPLE_RSS_MAX_LIMIT);
    const response = await MusicKit.getUserPlaylists({
      limit: safeLimit,
      offset: 0,
    });

    return (response?.playlists || []).map((playlist) => ({
      id: String(playlist.id),
      name: playlist.name,
      description: playlist.description || "",
      imageUrl: this.normalizeArtworkUrl(playlist.artworkUrl || ""),
      trackCount: playlist.trackCount || 0,
      source: "apple",
    }));
  }

  async getPlaylistTracks(
    playlistId: string,
    limit: number = Number.POSITIVE_INFINITY,
  ): Promise<SpotifyTrack[]> {
    if (Platform.OS !== "ios") {
      return [];
    }

    const hasFiniteLimit = Number.isFinite(limit);
    const safeLimit = hasFiniteLimit
      ? Math.max(1, Math.floor(limit))
      : Number.POSITIVE_INFINITY;
    const tracks: SpotifyTrack[] = [];
    let offset = 0;

    while (tracks.length < safeLimit) {
      const pageLimit = Math.min(ITUNES_MAX_LIMIT, safeLimit - tracks.length);
      const response = await MusicKit.getPlaylistSongs(playlistId, {
        limit: pageLimit,
        offset,
      });
      const pageSongs = response?.songs || [];
      const pageTracks = pageSongs
        .map((song) => this.mapCatalogSong(song))
        .filter((track): track is SpotifyTrack => track !== null);

      tracks.push(...pageTracks);

      if (pageSongs.length < pageLimit) {
        break;
      }

      offset += pageSongs.length;
    }

    const dedupedTracks = this.dedupeTracks(tracks);
    return hasFiniteLimit ? dedupedTracks.slice(0, safeLimit) : dedupedTracks;
  }

  async getNewJapaneseReleases(limit: number = 20): Promise<SpotifyTrack[]> {
    const safeLimit = this.normalizeLimit(limit, APPLE_RSS_MAX_LIMIT);
    const perArtistLimit = Math.max(
      6,
      Math.ceil((safeLimit * 2) / JAPANESE_RELEASE_ARTIST_IDS.length),
    );

    let releaseFailure: { error: unknown } | null = null;
    let releases: SpotifyTrack[] = [];
    try {
      releases = await this.collectDiscoveryTracks(
        JAPANESE_RELEASE_ARTIST_IDS.map((artistId) =>
          this.lookupRecentSongsByArtist(artistId, perArtistLimit),
        ),
      );
    } catch (error) {
      releaseFailure = { error };
    }

    let tracks = releases
      .filter((track) => !this.isLikelyNonOfficial(track))
      .sort((a, b) => this.compareByReleaseDateDesc(a, b));

    if (tracks.length < safeLimit) {
      tracks = (await this.collectDiscoveryTracks([
        Promise.resolve(tracks), this.searchItunesSongs("J-Pop 新曲", 80),
      ]))
        .filter((track) => !this.isLikelyNonOfficial(track))
        .sort((a, b) => this.compareByReleaseDateDesc(a, b));
    }

    if (tracks.length === 0 && releaseFailure) {
      throw releaseFailure.error;
    }
    return tracks.slice(0, safeLimit);
  }

  async getPopularJapaneseSongs(limit: number = 20): Promise<SpotifyTrack[]> {
    const safeLimit = this.normalizeLimit(limit, APPLE_RSS_MAX_LIMIT);
    const feedLimit = this.normalizeLimit(
      Math.max(safeLimit * 2, 25),
      APPLE_RSS_MAX_LIMIT,
    );

    let feedFailure: { error: unknown } | null = null;
    let mostPlayedTracks: SpotifyTrack[] = [];
    try {
      mostPlayedTracks = await this.getMostPlayedSongs(feedLimit);
    } catch (error) {
      feedFailure = { error };
    }
    if (mostPlayedTracks.length >= safeLimit) {
      return mostPlayedTracks.slice(0, safeLimit);
    }

    const tracks = await this.collectDiscoveryTracks([
      Promise.resolve(mostPlayedTracks),
      this.searchAcrossQueries(
        [
          "popular j-pop",
          "japanese top hits",
          "YOASOBI Kenshi Yonezu Aimer",
          "Ado Fujii Kaze back number",
        ],
        safeLimit,
      ),
    ]);

    if (tracks.length === 0 && feedFailure) {
      throw feedFailure.error;
    }
    return tracks.slice(0, safeLimit);
  }

  async getAnimeSongs(limit: number = 20): Promise<SpotifyTrack[]> {
    const safeLimit = this.normalizeLimit(limit, APPLE_RSS_MAX_LIMIT);

    let searchFailure: { error: unknown } | null = null;
    let animeSearch: SpotifyTrack[] = [];
    try {
      animeSearch = await this.collectDiscoveryTracks([
        this.searchItunesSongs("アニメ 主題歌", 80),
        this.searchItunesSongs("アニメ オープニング エンディング", 80),
      ]);
    } catch (error) {
      searchFailure = { error };
    }

    let tracks = animeSearch
      .filter((track) => !this.isLikelyNonOfficial(track))
      .filter(
        (track) =>
          this.hasAnimeSignal(track) || KNOWN_ANIME_ARTIST_IDS.has(track.artistId),
      );

    if (tracks.length < safeLimit) {
      const perArtistLimit = Math.max(
        5,
        Math.ceil((safeLimit * 2) / ANIME_ARTIST_IDS.length),
      );
      tracks = (await this.collectDiscoveryTracks([
        Promise.resolve(tracks),
        ...ANIME_ARTIST_IDS.map((artistId) =>
          this.lookupRecentSongsByArtist(artistId, perArtistLimit),
        ),
      ]))
        .filter((track) => !this.isLikelyNonOfficial(track));
    }

    if (tracks.length === 0 && searchFailure) {
      throw searchFailure.error;
    }
    tracks.sort((a, b) => {
      const scoreDiff = this.getAnimeScore(b) - this.getAnimeScore(a);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return this.compareByReleaseDateDesc(a, b);
    });

    return tracks.slice(0, safeLimit);
  }
}

export const appleMusicService = new AppleMusicService();
