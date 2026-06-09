export type YouTubeSearchResult = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: number;
};

type YouTubeSearchResponse = {
  items?: Array<{
    id: {
      videoId?: string;
    };
  }>;
};

type YouTubeVideosResponse = {
  items?: Array<{
    id: string;
    snippet: {
      title: string;
      channelTitle: string;
      thumbnails: {
        default?: { url: string };
        medium?: { url: string };
        high?: { url: string };
      };
    };
    contentDetails: {
      duration: string;
    };
  }>;
};

const YOUTUBE_API_BASE_URL =
  process.env.NEXT_PUBLIC_YOUTUBE_API_BASE_URL?.trim() ||
  process.env.EXPO_PUBLIC_YOUTUBE_API_BASE_URL?.trim() ||
  "https://www.googleapis.com/youtube/v3";

const unwantedVideoTerms = [
  "cover",
  "instrumental",
  "remix",
  "karaoke",
  "live",
  "acoustic",
  "slowed",
  "sped up",
  "reverb",
  "8d",
  "nightcore",
];

export function getYouTubeApiKey(): string {
  return (
    process.env.NEXT_PUBLIC_YOUTUBE_API_KEY?.trim() ||
    process.env.EXPO_PUBLIC_YOUTUBE_API_KEY?.trim() ||
    ""
  );
}

export async function searchYouTubeMusicVideos(
  query: string,
  apiKey: string,
  maxResults = 10
): Promise<YouTubeSearchResult[]> {
  if (!apiKey) {
    throw new Error("Missing YouTube API key. Set NEXT_PUBLIC_YOUTUBE_API_KEY.");
  }

  const searchParams = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    videoCategoryId: "10",
    maxResults: String(maxResults),
    key: apiKey,
  });
  const searchResponse = await fetch(`${YOUTUBE_API_BASE_URL}/search?${searchParams}`);
  if (!searchResponse.ok) {
    throw new Error(`YouTube search failed: ${searchResponse.status}`);
  }

  const searchData = (await searchResponse.json()) as YouTubeSearchResponse;
  const videoIds = (searchData.items ?? [])
    .map((item) => item.id.videoId)
    .filter((videoId): videoId is string => Boolean(videoId));

  if (videoIds.length === 0) {
    return [];
  }

  const detailParams = new URLSearchParams({
    part: "contentDetails,snippet",
    id: videoIds.join(","),
    key: apiKey,
  });
  const detailResponse = await fetch(`${YOUTUBE_API_BASE_URL}/videos?${detailParams}`);
  if (!detailResponse.ok) {
    throw new Error(`YouTube details failed: ${detailResponse.status}`);
  }

  const detailData = (await detailResponse.json()) as YouTubeVideosResponse;
  const results = (detailData.items ?? []).map((item) => ({
    videoId: item.id,
    title: item.snippet.title,
    channelTitle: item.snippet.channelTitle,
    thumbnailUrl:
      item.snippet.thumbnails.high?.url ||
      item.snippet.thumbnails.medium?.url ||
      item.snippet.thumbnails.default?.url ||
      "",
    duration: parseYouTubeDuration(item.contentDetails.duration),
  }));

  return filterUnwantedVideos(results);
}

function filterUnwantedVideos(videos: YouTubeSearchResult[]): YouTubeSearchResult[] {
  const filtered = videos.filter((video) => {
    const title = video.title.toLowerCase();
    return !unwantedVideoTerms.some((term) => title.includes(term));
  });

  return filtered.length > 0 ? filtered : videos;
}

function parseYouTubeDuration(isoDuration: string): number {
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);
  return hours * 3600 + minutes * 60 + seconds;
}
