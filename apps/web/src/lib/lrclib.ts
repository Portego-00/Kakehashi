export type TimedLyricsLine = {
  startTimeMs: number;
  words: string;
};

export type LyricsResult = {
  plainLyrics: string;
  timedLyrics: TimedLyricsLine[];
  duration: number;
};

export type LyricsSearchResult = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  hasSyncedLyrics: boolean;
  plainLyrics?: string;
};

type LrclibResponse = {
  id: number;
  trackName: string;
  artistName: string;
  albumName: string;
  duration: number;
  plainLyrics: string;
  syncedLyrics: string | null;
};

const LRCLIB_API_BASE_URL = "https://lrclib.net/api";

export async function searchLyrics(
  trackName: string,
  artistName: string
): Promise<LyricsSearchResult[]> {
  const params = new URLSearchParams();
  if (trackName.trim()) params.set("track_name", trackName.trim());
  if (artistName.trim()) params.set("artist_name", artistName.trim());
  if (!trackName.trim() && artistName.trim()) params.set("q", artistName.trim());

  const response = await fetch(`${LRCLIB_API_BASE_URL}/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`LRCLIB search failed: ${response.status}`);
  }

  const data = (await response.json()) as LrclibResponse[];
  return data.map((item) => ({
    id: item.id,
    trackName: item.trackName,
    artistName: item.artistName,
    albumName: item.albumName,
    duration: item.duration || 0,
    hasSyncedLyrics: Boolean(item.syncedLyrics),
    plainLyrics: item.plainLyrics,
  }));
}

export async function getLyricsById(id: number): Promise<LyricsResult> {
  const response = await fetch(`${LRCLIB_API_BASE_URL}/get/${id}`);
  if (!response.ok) {
    throw new Error(`LRCLIB lyrics failed: ${response.status}`);
  }

  const data = (await response.json()) as LrclibResponse;
  return {
    plainLyrics: data.plainLyrics || "",
    timedLyrics: data.syncedLyrics ? parseLrcLyrics(data.syncedLyrics) : [],
    duration: data.duration || 0,
  };
}

export function parseLrcLyrics(lrcText: string): TimedLyricsLine[] {
  const lines: TimedLyricsLine[] = [];

  for (const line of lrcText.split("\n")) {
    const match = line.match(/\[(\d+):(\d+)\.(\d+)\](.*)/);
    if (!match) continue;

    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const centiseconds = parseInt(match[3], 10);
    const words = match[4].trim();
    if (!words) continue;

    lines.push({
      startTimeMs: (minutes * 60 + seconds) * 1000 + centiseconds * 10,
      words,
    });
  }

  return lines.sort((left, right) => left.startTimeMs - right.startTimeMs);
}
