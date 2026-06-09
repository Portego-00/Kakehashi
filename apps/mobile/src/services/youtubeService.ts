/**
 * YouTube Data API v3 Service
 * For searching videos and getting video details
 */

const YOUTUBE_API_KEY = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY?.trim() ?? "";
const YOUTUBE_API_BASE_URL =
  process.env.EXPO_PUBLIC_YOUTUBE_API_BASE_URL?.trim() ||
  'https://www.googleapis.com/youtube/v3';

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  duration: number; // Duration in seconds
}

// Terms to filter out from video titles (covers, remixes, etc.)
const UNWANTED_VIDEO_TERMS = [
  'cover',
  'instrumental',
  'remix',
  'karaoke',
  'live',
  'acoustic',
  'slowed',
  'sped up',
  'reverb',
  '8d',
  'nightcore',
];

class YouTubeService {
  private apiKey: string;

  constructor() {
    this.apiKey = YOUTUBE_API_KEY;
  }

  private getApiKey(): string {
    if (!this.apiKey) {
      throw new Error("Missing YouTube API key. Set EXPO_PUBLIC_YOUTUBE_API_KEY.");
    }

    return this.apiKey;
  }

  /**
   * Filter out videos with unwanted terms in the title (covers, remixes, etc.)
   */
  private filterUnwantedVideos(
    videos: YouTubeSearchResult[]
  ): YouTubeSearchResult[] {
    return videos.filter((video) => {
      const titleLower = video.title.toLowerCase();
      return !UNWANTED_VIDEO_TERMS.some((term) => titleLower.includes(term));
    });
  }

  /**
   * Convert ISO 8601 duration to seconds
   * Example: PT4M13S = 4 minutes 13 seconds = 253 seconds
   * Example: PT1H2M10S = 1 hour 2 minutes 10 seconds = 3730 seconds
   */
  private parseDuration(isoDuration: string): number {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Get video duration from video ID
   */
  async getVideoDuration(videoId: string): Promise<number | null> {
    try {
      const url = `${YOUTUBE_API_BASE_URL}/videos?part=contentDetails&id=${videoId}&key=${this.getApiKey()}`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`YouTube API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        console.error('No video found with ID:', videoId);
        return null;
      }

      const duration = data.items[0].contentDetails.duration;
      return this.parseDuration(duration);
    } catch (error) {
      console.error('Error fetching video duration:', error);
      return null;
    }
  }

  /**
   * Search for videos by query string (music search)
   * Returns videos sorted by relevance, filtered to music category
   */
  async searchVideos(query: string, maxResults: number = 20): Promise<YouTubeSearchResult[]> {
    try {
      // Step 1: Search for videos
      const searchUrl = `${YOUTUBE_API_BASE_URL}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=${maxResults}&key=${this.getApiKey()}`;

      console.log('Searching YouTube for:', query);

      const searchResponse = await fetch(searchUrl);
      if (!searchResponse.ok) {
        throw new Error(`YouTube API error: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();

      if (!searchData.items || searchData.items.length === 0) {
        console.log('No YouTube videos found');
        return [];
      }

      // Step 2: Get video details (including duration) for all results
      const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
      const detailsUrl = `${YOUTUBE_API_BASE_URL}/videos?part=contentDetails,snippet&id=${videoIds}&key=${this.getApiKey()}`;

      const detailsResponse = await fetch(detailsUrl);
      if (!detailsResponse.ok) {
        throw new Error(`YouTube API error: ${detailsResponse.status}`);
      }

      const detailsData = await detailsResponse.json();

      // Step 3: Parse results
      const results: YouTubeSearchResult[] = detailsData.items.map((item: any) => {
        const duration = this.parseDuration(item.contentDetails.duration);
        return {
          videoId: item.id,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
          thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
          duration,
        };
      });

      console.log('Found', results.length, 'YouTube videos');

      return results;
    } catch (error) {
      console.error('Error searching YouTube videos:', error);
      throw error;
    }
  }

  /**
   * General video search (all categories, no filtering)
   * Returns videos sorted by relevance
   */
  async searchAllVideos(query: string, maxResults: number = 20): Promise<YouTubeSearchResult[]> {
    try {
      // Search for videos without category filter
      const searchUrl = `${YOUTUBE_API_BASE_URL}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&maxResults=${maxResults}&key=${this.getApiKey()}`;

      console.log('Searching YouTube (all) for:', query);

      const searchResponse = await fetch(searchUrl);
      if (!searchResponse.ok) {
        throw new Error(`YouTube API error: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();

      if (!searchData.items || searchData.items.length === 0) {
        console.log('No YouTube videos found');
        return [];
      }

      // Get video details (including duration) for all results
      const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
      const detailsUrl = `${YOUTUBE_API_BASE_URL}/videos?part=contentDetails,snippet&id=${videoIds}&key=${this.getApiKey()}`;

      const detailsResponse = await fetch(detailsUrl);
      if (!detailsResponse.ok) {
        throw new Error(`YouTube API error: ${detailsResponse.status}`);
      }

      const detailsData = await detailsResponse.json();

      // Parse results
      const results: YouTubeSearchResult[] = detailsData.items.map((item: any) => {
        const duration = this.parseDuration(item.contentDetails.duration);
        return {
          videoId: item.id,
          title: item.snippet.title,
          channelTitle: item.snippet.channelTitle,
          thumbnail: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
          thumbnailUrl: item.snippet.thumbnails.high?.url || item.snippet.thumbnails.default.url,
          duration,
        };
      });

      console.log('Found', results.length, 'YouTube videos (all categories)');

      return results;
    } catch (error) {
      console.error('Error searching YouTube videos:', error);
      throw error;
    }
  }

  /**
   * Search for videos by song title and artist with target duration
   * Returns videos sorted by closest duration match to targetDuration
   * Filters out covers, instrumentals, remixes, etc.
   */
  async searchVideosByDuration(
    songTitle: string,
    artist: string,
    targetDuration: number,
    maxResults: number = 20
  ): Promise<YouTubeSearchResult[]> {
    try {
      // Build search query - just song title and artist, no extra terms
      const query = `${songTitle} ${artist}`;

      // Step 1: Search for videos
      const searchUrl = `${YOUTUBE_API_BASE_URL}/search?part=snippet&q=${encodeURIComponent(query)}&type=video&videoCategoryId=10&maxResults=${maxResults}&key=${this.getApiKey()}`;

      console.log('Searching YouTube for:', query);

      const searchResponse = await fetch(searchUrl);
      if (!searchResponse.ok) {
        throw new Error(`YouTube API error: ${searchResponse.status}`);
      }

      const searchData = await searchResponse.json();

      if (!searchData.items || searchData.items.length === 0) {
        console.log('No YouTube videos found');
        return [];
      }

      // Step 2: Get video details (including duration) for all results
      const videoIds = searchData.items
        .map((item: any) => item.id.videoId)
        .join(',');
      const detailsUrl = `${YOUTUBE_API_BASE_URL}/videos?part=contentDetails,snippet&id=${videoIds}&key=${this.getApiKey()}`;

      const detailsResponse = await fetch(detailsUrl);
      if (!detailsResponse.ok) {
        throw new Error(`YouTube API error: ${detailsResponse.status}`);
      }

      const detailsData = await detailsResponse.json();

      // Step 3: Parse results
      const allResults: YouTubeSearchResult[] = detailsData.items.map(
        (item: any) => {
          const duration = this.parseDuration(item.contentDetails.duration);
          return {
            videoId: item.id,
            title: item.snippet.title,
            channelTitle: item.snippet.channelTitle,
            thumbnailUrl:
              item.snippet.thumbnails.high?.url ||
              item.snippet.thumbnails.default.url,
            duration,
          };
        }
      );

      // Step 4: Filter out unwanted videos (covers, remixes, etc.)
      let filteredResults = this.filterUnwantedVideos(allResults);

      // If all results were filtered out, use the original results as fallback
      if (filteredResults.length === 0) {
        console.log(
          'All videos filtered out, using original results as fallback'
        );
        filteredResults = allResults;
      }

      // Step 5: Sort by closest duration match
      const resultsWithDiff = filteredResults.map((r) => ({
        ...r,
        durationDiff: Math.abs(r.duration - targetDuration),
      }));
      resultsWithDiff.sort((a, b) => a.durationDiff - b.durationDiff);

      // Remove the temporary durationDiff property
      const results: YouTubeSearchResult[] = resultsWithDiff.map(
        ({ durationDiff, ...rest }) => rest
      );

      console.log(
        `Found ${allResults.length} videos, ${filteredResults.length} after filtering`
      );
      console.log(
        'Best match:',
        results[0]?.title,
        'Duration:',
        results[0]?.duration,
        'vs target:',
        targetDuration
      );

      return results;
    } catch (error) {
      console.error('Error searching YouTube videos:', error);
      throw error;
    }
  }

  /**
   * Find the best matching video by duration
   * Returns the video with the closest duration to targetDuration
   */
  async findBestMatch(
    songTitle: string,
    artist: string,
    targetDuration: number
  ): Promise<YouTubeSearchResult | null> {
    const results = await this.searchVideosByDuration(songTitle, artist, targetDuration);

    if (results.length === 0) {
      return null;
    }

    // Results are already sorted by closest duration match
    return results[0];
  }
}

export const youtubeService = new YouTubeService();
