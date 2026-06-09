import { supabase } from "../lib/supabase";

export interface MuxVideo {
  id: string;
  playbackId: string;
  title: string;
  description?: string;
  thumbnailUrl: string;
  duration?: number;
  trackId?: string;
  createdAt: string;
}

export interface CaptionCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

interface MuxVideoRow {
  id: string;
  playback_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  track_id: string | null;
  created_at: string;
  order: number | null;
}

function getMuxThumbnailUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/thumbnail.jpg?width=640&height=360&fit_mode=smartcrop`;
}

function getMuxStreamUrl(playbackId: string): string {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

function getMuxCaptionUrl(playbackId: string, trackId: string): string {
  return `https://stream.mux.com/${playbackId}/text/${trackId}.vtt`;
}

function mapRowToMuxVideo(row: MuxVideoRow): MuxVideo {
  return {
    id: row.id,
    playbackId: row.playback_id,
    title: row.title,
    description: row.description ?? undefined,
    thumbnailUrl: row.thumbnail_url || getMuxThumbnailUrl(row.playback_id),
    duration: row.duration ?? undefined,
    trackId: row.track_id ?? undefined,
    createdAt: row.created_at,
  };
}

// Parse timestamp in format "00:00:00.000" or "00:00.000" to seconds
function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(":");
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return (
      parseInt(hours, 10) * 3600 +
      parseInt(minutes, 10) * 60 +
      parseFloat(seconds)
    );
  } else if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return parseInt(minutes, 10) * 60 + parseFloat(seconds);
  }
  return 0;
}

// Parse VTT content into cues
function parseVTT(vttContent: string): CaptionCue[] {
  const cues: CaptionCue[] = [];
  const lines = vttContent.split("\n");

  let i = 0;
  let cueIndex = 0;

  // Skip WEBVTT header and any metadata
  while (i < lines.length && !lines[i].includes("-->")) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();

    // Look for timestamp line (contains "-->")
    if (line.includes("-->")) {
      const [startStr, endStr] = line.split("-->").map((s) => s.trim());
      const startTime = parseTimestamp(startStr);
      const endTime = parseTimestamp(endStr.split(" ")[0]); // Remove any positioning info

      // Collect text lines until empty line or end
      const textLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "") {
        textLines.push(lines[i].trim());
        i++;
      }

      if (textLines.length > 0) {
        cues.push({
          id: `cue-${cueIndex++}`,
          startTime,
          endTime,
          text: textLines.join("\n"),
        });
      }
    } else {
      i++;
    }
  }

  return cues;
}

// Find current cue based on playback position
function findCurrentCue(
  cues: CaptionCue[],
  positionSeconds: number
): CaptionCue | null {
  for (const cue of cues) {
    if (positionSeconds >= cue.startTime && positionSeconds < cue.endTime) {
      return cue;
    }
  }
  return null;
}

export const muxService = {
  async getVideos(): Promise<MuxVideo[]> {
    const { data, error } = await supabase
      .from("mux_videos")
      .select("*")
      .order("order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching MUX videos:", error);
      throw new Error("Failed to fetch videos");
    }

    return (data as MuxVideoRow[]).map(mapRowToMuxVideo);
  },

  async getVideoById(id: string): Promise<MuxVideo | null> {
    const { data, error } = await supabase
      .from("mux_videos")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return null;
      }
      console.error("Error fetching MUX video:", error);
      throw new Error("Failed to fetch video");
    }

    return mapRowToMuxVideo(data as MuxVideoRow);
  },

  async getCaptions(
    playbackId: string,
    trackId: string
  ): Promise<CaptionCue[]> {
    try {
      const url = getMuxCaptionUrl(playbackId, trackId);
      const response = await fetch(url);

      if (!response.ok) {
        console.error("Failed to fetch captions:", response.status);
        return [];
      }

      const vttContent = await response.text();
      return parseVTT(vttContent);
    } catch (error) {
      console.error("Error fetching captions:", error);
      return [];
    }
  },

  getStreamUrl: getMuxStreamUrl,
  getThumbnailUrl: getMuxThumbnailUrl,
  getCaptionUrl: getMuxCaptionUrl,
  findCurrentCue,
};
