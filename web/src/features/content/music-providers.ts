export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  albumArt: string;
  spotifyUrl: string;
  previewUrl: string | null;
  durationMs: number;
  albumName: string;
  releaseDate: string;
}

export interface LyricsPayload {
  id: number | null;
  trackName: string;
  artistName: string;
  albumName: string;
  plainLyrics: string;
  syncedLyrics: string | null;
  duration: number;
}

export interface YouTubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: number;
}

const UNWANTED_VIDEO_TERMS = [
  "cover",
  "instrumental",
  "remix",
  "karaoke",
  "live",
  "acoustic",
  "slowed",
  "sped up",
  "reverb",
  "nightcore",
  "reaction",
] as const;

export function parseIsoDuration(value: string) {
  const match = value.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3_600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

export function rankYouTubeVideos(videos: YouTubeVideo[], targetDuration: number) {
  const clean = videos.filter((video) => {
    const title = video.title.toLocaleLowerCase();
    return !UNWANTED_VIDEO_TERMS.some((term) => title.includes(term));
  });
  const candidates = clean.length ? clean : videos;
  return [...candidates].sort((left, right) => {
    if (targetDuration > 0) {
      const durationOrder = Math.abs(left.duration - targetDuration) - Math.abs(right.duration - targetDuration);
      if (durationOrder !== 0) return durationOrder;
    }
    return left.title.localeCompare(right.title);
  });
}

export function formatTrackDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.round(durationMs / 1_000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
