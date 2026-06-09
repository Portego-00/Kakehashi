/**
 * Service for fetching time-synced lyrics from LRCLIB API
 * API Documentation: https://lrclib.net/docs
 * Free, no authentication required
 */

export interface TimedLyricsLine {
  startTimeMs: number;
  words: string;
}

export interface LyricsResult {
  plainLyrics: string;
  timedLyrics: TimedLyricsLine[];
  duration: number; // Duration in seconds
}

export interface LyricsSearchResult {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  hasSyncedLyrics: boolean;
  plainLyrics?: string;
}

interface LRCLIBResponse {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  plainLyrics: string;
  syncedLyrics: string | null;
}

class LyricsService {
  private baseUrl = "https://lrclib.net/api";

  /**
   * Parse LRC format lyrics into timed lines
   * LRC format: [mm:ss.xx]lyric text
   */
  private parseLRCLyrics(lrcText: string): TimedLyricsLine[] {
    const lines: TimedLyricsLine[] = [];
    const lrcLines = lrcText.split("\n");

    for (const line of lrcLines) {
      // Match [mm:ss.xx] format
      const match = line.match(/\[(\d+):(\d+)\.(\d+)\](.*)/);
      if (match) {
        const minutes = parseInt(match[1]);
        const seconds = parseInt(match[2]);
        const centiseconds = parseInt(match[3]);
        const text = match[4].trim();

        if (text) {
          // Only include non-empty lines
          const startTimeMs =
            (minutes * 60 + seconds) * 1000 + centiseconds * 10;
          lines.push({
            startTimeMs,
            words: text,
          });
        }
      }
    }

    return lines.sort((a, b) => a.startTimeMs - b.startTimeMs);
  }

  /**
   * Fetch lyrics by track metadata
   * Sequential flow: exact match first, then search fallback
   */
  async getLyrics(
    trackName: string,
    artistName: string
  ): Promise<LyricsResult> {
    console.log("🔍 Fetching lyrics for:", { trackName, artistName });

    // Step 1: Try exact match with song + artist
    try {
      const params = new URLSearchParams({
        track_name: trackName,
        artist_name: artistName,
      });

      const url = `${this.baseUrl}/get?${params.toString()}`;
      const response = await fetch(url);

      if (response.ok) {
        const data: LRCLIBResponse = await response.json();
        if (data.plainLyrics) {
          console.log("✅ Found lyrics via exact match");
          return {
            plainLyrics: data.plainLyrics,
            timedLyrics: data.syncedLyrics
              ? this.parseLRCLyrics(data.syncedLyrics)
              : [],
            duration: data.duration || 0,
          };
        }
      }
    } catch {
      console.log("Exact match failed, trying search...");
    }

    // Step 2: Fallback to search
    try {
      const searchUrl = `${this.baseUrl}/search?q=${encodeURIComponent(
        `${trackName} ${artistName}`
      )}`;
      const response = await fetch(searchUrl);

      if (response.ok) {
        const results: LRCLIBResponse[] = await response.json();
        const match = results.find((r) => r.plainLyrics);

        if (match) {
          console.log("✅ Found lyrics via search");
          return {
            plainLyrics: match.plainLyrics,
            timedLyrics: match.syncedLyrics
              ? this.parseLRCLyrics(match.syncedLyrics)
              : [],
            duration: match.duration || 0,
          };
        }
      }
    } catch (error) {
      console.log("Search failed:", error);
    }

    console.log("❌ No lyrics found");
    throw new Error("LYRICS_NOT_FOUND");
  }

  /**
   * Fetch time-synced lyrics by track metadata
   */
  async getTimedLyrics(
    trackName: string,
    artistName: string
  ): Promise<TimedLyricsLine[]> {
    const result = await this.getLyrics(trackName, artistName);
    if (result.timedLyrics.length === 0) {
      throw new Error("LYRICS_NOT_SYNCED");
    }
    return result.timedLyrics;
  }

  /**
   * Search for lyrics by track and/or artist
   * Returns multiple results that can be selected from
   */
  async searchLyrics(
    trackName: string,
    artistName: string
  ): Promise<LyricsSearchResult[]> {
    try {
      const params = new URLSearchParams();
      if (trackName.trim()) params.append("track_name", trackName.trim());
      if (artistName.trim()) params.append("artist_name", artistName.trim());

      // API requires either 'q' or 'track_name' to be present
      // If we only have artist, we must use 'q' to satisfy this requirement
      if (!trackName.trim() && artistName.trim()) {
        params.append("q", artistName.trim());
      }

      const url = `${this.baseUrl}/search?${params.toString()}`;
      console.log("Searching LRCLIB for:", { trackName, artistName });

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`LRCLIB API error: ${response.status}`);
      }

      const data: LRCLIBResponse[] = await response.json();

      // Filter to only include results with synced lyrics
      const results: LyricsSearchResult[] = data
        .filter((item) => item.syncedLyrics !== null)
        .map((item) => ({
          id: item.id,
          trackName: item.trackName,
          artistName: item.artistName,
          albumName: item.albumName,
          duration: item.duration || 0,
          hasSyncedLyrics: item.syncedLyrics !== null,
          plainLyrics: item.plainLyrics,
        }));

      console.log("Found", results.length, "synced lyrics results");

      return results;
    } catch (error) {
      console.error("Error searching LRCLIB:", error);
      throw error;
    }
  }

  /**
   * Get lyrics by LRCLIB ID
   */
  async getLyricsById(id: number): Promise<LyricsResult> {
    try {
      const url = `${this.baseUrl}/get/${id}`;
      console.log("Fetching LRCLIB lyrics by ID:", id);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`LRCLIB API error: ${response.status}`);
      }

      const data: LRCLIBResponse = await response.json();

      const timedLines = data.syncedLyrics
        ? this.parseLRCLyrics(data.syncedLyrics)
        : [];

      return {
        plainLyrics: data.plainLyrics || "",
        timedLyrics: timedLines,
        duration: data.duration || 0,
      };
    } catch (error) {
      console.error("Error fetching LRCLIB lyrics by ID:", error);
      throw error;
    }
  }
}

export const lyricsService = new LyricsService();