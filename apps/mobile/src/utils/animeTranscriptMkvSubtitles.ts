import { Buffer } from "buffer";
import { File } from "expo-file-system";
import { getFileNameFromUri } from "./animeTranscriptDevHelpers";
import type { AnimeTranscriptSubtitleCue } from "./animeTranscriptDevSession";

type MkvSubtitleTrack = {
  number: number;
  language?: string;
  name?: string;
  type?: string;
};

type MkvSubtitlePacket = {
  text: string;
  time: number;
  duration: number;
};

type ExtractPreferredMkvSubtitleResult = {
  cues: AnimeTranscriptSubtitleCue[];
  subtitleFileName: string;
  selectedTrackLabel: string;
};

const JAPANESE_LANGUAGE_CODES = new Set([
  "ja",
  "jpn",
  "jp",
  "japanese",
]);
const JAPANESE_HINT_IN_TITLE_REGEX = /(japanese|nihongo|日本語|日本|jpn|ja)/i;
const JAPANESE_SCRIPT_REGEX = /[\u3040-\u30ff\u3400-\u9fff]/;
const JAPANESE_SCRIPT_GLOBAL_REGEX = /[\u3040-\u30ff\u3400-\u9fff]/g;
const LATIN_SCRIPT_GLOBAL_REGEX = /[A-Za-z]/g;
const NON_DIALOGUE_TRACK_HINT_REGEX = /(sign|song|lyrics|karaoke|commentary|forced|sdh)/i;
const MINIMUM_CUE_DURATION_SECONDS = 0.08;
const DEFAULT_INFERRED_CUE_DURATION_SECONDS = 2.2;
const MAX_INFERRED_CUE_DURATION_SECONDS = 8;
const INTER_CUE_GAP_SECONDS = 0.02;
const FILE_READ_CHUNK_BYTES = 256 * 1024;

function ensureNodeGlobalBuffer(): void {
  const globalWithBuffer = globalThis as typeof globalThis & {
    Buffer?: typeof Buffer;
  };

  if (!globalWithBuffer.Buffer) {
    globalWithBuffer.Buffer = Buffer;
  }
}

function ensureNodeGlobalProcess(): void {
  const globalWithProcess = globalThis as typeof globalThis & {
    process?: any;
  };

  if (typeof globalWithProcess.process?.nextTick === "function") {
    return;
  }

  let processPolyfill: any = globalWithProcess.process;
  if (!processPolyfill) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      processPolyfill = require("process/browser");
    } catch {
      processPolyfill = {};
    }
  }

  if (typeof processPolyfill.nextTick !== "function") {
    processPolyfill.nextTick = (callback: (...args: any[]) => void, ...args: any[]) => {
      if (typeof queueMicrotask === "function") {
        queueMicrotask(() => callback(...args));
        return;
      }

      Promise.resolve().then(() => callback(...args));
    };
  }

  if (!processPolyfill.env || typeof processPolyfill.env !== "object") {
    processPolyfill.env = {};
  }

  if (!Array.isArray(processPolyfill.argv)) {
    processPolyfill.argv = [];
  }

  globalWithProcess.process = processPolyfill;
}

function scoreSubtitleTrack(track: MkvSubtitleTrack, trackIndex: number): number {
  const normalizedLanguage = (track.language || "").trim().toLowerCase();
  const normalizedName = (track.name || "").trim().toLowerCase();
  const normalizedType = (track.type || "").trim().toLowerCase();
  let score = 0;

  if (JAPANESE_LANGUAGE_CODES.has(normalizedLanguage)) {
    score += 120;
  }

  if (
    normalizedName.length > 0 &&
    (JAPANESE_HINT_IN_TITLE_REGEX.test(normalizedName) ||
      JAPANESE_SCRIPT_REGEX.test(normalizedName))
  ) {
    score += 80;
  }

  if (normalizedType === "utf8" || normalizedType === "ass" || normalizedType === "ssa") {
    score += 10;
  }

  // Keep stable ordering for ties.
  score -= trackIndex * 0.01;
  return score;
}

function pickPreferredTrack(tracks: MkvSubtitleTrack[]): MkvSubtitleTrack | null {
  if (tracks.length === 0) {
    return null;
  }

  let bestTrack: MkvSubtitleTrack | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  tracks.forEach((track, index) => {
    const score = scoreSubtitleTrack(track, index);
    if (score > bestScore) {
      bestScore = score;
      bestTrack = track;
    }
  });

  return bestTrack;
}

function countRegexMatches(rawText: string, regex: RegExp): number {
  const matches = rawText.match(regex);
  return matches?.length ?? 0;
}

function scoreTrackByContent(
  track: MkvSubtitleTrack,
  packets: MkvSubtitlePacket[],
  trackIndex: number
): number {
  let score = scoreSubtitleTrack(track, trackIndex);

  const nonEmptyTexts = packets
    .map((packet) => normalizeSubtitleText(packet.text || ""))
    .filter((text) => text.length > 0);

  if (nonEmptyTexts.length === 0) {
    // Keep as fallback only.
    return score - 1000;
  }

  let japaneseCueCount = 0;
  let japaneseCharCount = 0;
  let latinCharCount = 0;
  let totalCharCount = 0;

  nonEmptyTexts.forEach((text) => {
    const japaneseChars = countRegexMatches(text, JAPANESE_SCRIPT_GLOBAL_REGEX);
    const latinChars = countRegexMatches(text, LATIN_SCRIPT_GLOBAL_REGEX);

    if (japaneseChars > 0) {
      japaneseCueCount += 1;
    }

    japaneseCharCount += japaneseChars;
    latinCharCount += latinChars;
    totalCharCount += text.length;
  });

  const japaneseCueRatio = japaneseCueCount / nonEmptyTexts.length;
  const japaneseCharRatio = japaneseCharCount / Math.max(totalCharCount, 1);

  if (japaneseCharCount > 0) {
    score += 120;
  }
  score += japaneseCueRatio * 260;
  score += japaneseCharRatio * 120;
  score += Math.min(40, Math.log2(nonEmptyTexts.length + 1) * 8);

  if (japaneseCharCount === 0 && latinCharCount > 0) {
    score -= 140;
  } else if (latinCharCount > japaneseCharCount * 2) {
    score -= 45;
  }

  if (NON_DIALOGUE_TRACK_HINT_REGEX.test(track.name || "")) {
    score -= 70;
  }

  return score;
}

function pickPreferredTrackFromPackets(
  tracks: MkvSubtitleTrack[],
  subtitlePacketsByTrack: Map<number, MkvSubtitlePacket[]>
): MkvSubtitleTrack | null {
  if (tracks.length === 0) {
    return null;
  }

  let bestTrack: MkvSubtitleTrack | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  tracks.forEach((track, index) => {
    const packets = subtitlePacketsByTrack.get(track.number) || [];
    const score = scoreTrackByContent(track, packets, index);
    if (score > bestScore) {
      bestScore = score;
      bestTrack = track;
    }
  });

  return bestTrack ?? pickPreferredTrack(tracks);
}

function normalizeSubtitleText(rawText: string): string {
  return rawText
    .replace(/\{\\[^}]*\}/g, " ")
    .replace(/\{[^}]*\}/g, " ")
    .replace(/\\N/g, " ")
    .replace(/\\n/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildCuesFromPackets(packets: MkvSubtitlePacket[]): AnimeTranscriptSubtitleCue[] {
  const sortedPackets = packets
    .map((packet) => ({
      text: normalizeSubtitleText(packet.text || ""),
      timeMs: Number(packet.time),
      durationMs: Number(packet.duration),
    }))
    .filter(
      (packet) =>
        packet.text.length > 0 &&
        Number.isFinite(packet.timeMs)
    )
    .sort((left, right) => left.timeMs - right.timeMs);

  let cursor = 0;

  return sortedPackets.map((packet, index) => {
    const nextPacket = sortedPackets[index + 1];
    const startTime = Math.max(0, packet.timeMs / 1000);
    const explicitDurationSeconds =
      Number.isFinite(packet.durationMs) && packet.durationMs > 0
        ? packet.durationMs / 1000
        : null;
    const nextStartTime =
      nextPacket && Number.isFinite(nextPacket.timeMs)
        ? Math.max(0, nextPacket.timeMs / 1000)
        : null;

    let endTime = startTime + MINIMUM_CUE_DURATION_SECONDS;
    if (explicitDurationSeconds !== null) {
      endTime = Math.max(
        startTime + MINIMUM_CUE_DURATION_SECONDS,
        startTime + explicitDurationSeconds
      );
    } else if (nextStartTime !== null && nextStartTime > startTime) {
      endTime = Math.max(
        startTime + MINIMUM_CUE_DURATION_SECONDS,
        nextStartTime - INTER_CUE_GAP_SECONDS
      );
    } else {
      endTime = startTime + DEFAULT_INFERRED_CUE_DURATION_SECONDS;
    }

    if (explicitDurationSeconds === null) {
      endTime = Math.min(endTime, startTime + MAX_INFERRED_CUE_DURATION_SECONDS);
    }

    if (nextStartTime !== null && nextStartTime > startTime) {
      endTime = Math.min(endTime, nextStartTime);
    }

    if (!Number.isFinite(endTime) || endTime <= startTime) {
      endTime = startTime + MINIMUM_CUE_DURATION_SECONDS;
    }

    const cue: AnimeTranscriptSubtitleCue = {
      id: `cue-${index}`,
      startTime,
      endTime,
      text: packet.text,
      startOffset: cursor,
    };
    cursor += packet.text.length + 1;
    return cue;
  });
}

function buildTrackLabel(track: MkvSubtitleTrack, fallbackOrder: number): string {
  const name = track.name?.trim();
  const language = track.language?.trim();
  if (name && language) {
    return `${name} (${language})`;
  }
  if (name) {
    return name;
  }
  if (language) {
    return language;
  }
  return `Track ${fallbackOrder + 1}`;
}

export async function extractPreferredMkvSubtitleCues({
  videoUri,
  sourceFileName,
}: {
  videoUri: string;
  sourceFileName?: string | null;
}): Promise<ExtractPreferredMkvSubtitleResult> {
  ensureNodeGlobalBuffer();
  ensureNodeGlobalProcess();

  if (!videoUri?.trim()) {
    throw new Error("No MKV URI was provided.");
  }

  const sourceFile = new File(videoUri);
  if (!sourceFile.exists) {
    throw new Error("Could not access the selected MKV file.");
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SubtitleParser } = require("matroska-subtitles") as {
    SubtitleParser: new () => any;
  };
  const parser = new SubtitleParser();
  let discoveredTracks: MkvSubtitleTrack[] = [];
  const subtitlePacketsByTrack = new Map<number, MkvSubtitlePacket[]>();

  parser.on("tracks", (tracks: MkvSubtitleTrack[]) => {
    if (Array.isArray(tracks)) {
      discoveredTracks = tracks.filter(
        (track) =>
          track &&
          typeof track.number === "number" &&
          Number.isFinite(track.number)
      );
    }
  });

  parser.on(
    "subtitle",
    (subtitle: MkvSubtitlePacket, trackNumber: number | string) => {
      const normalizedTrackNumber =
        typeof trackNumber === "number" ? trackNumber : Number(trackNumber);
      if (!Number.isFinite(normalizedTrackNumber) || !subtitle) {
        return;
      }

      const existing = subtitlePacketsByTrack.get(normalizedTrackNumber) || [];
      existing.push({
        text: subtitle.text || "",
        time: Number(subtitle.time),
        duration: Number(subtitle.duration),
      });
      subtitlePacketsByTrack.set(normalizedTrackNumber, existing);
    }
  );

  const parseFinishedPromise = new Promise<void>((resolve, reject) => {
    parser.once("finish", () => resolve());
    parser.once("error", (error: unknown) => reject(error));
  });

  const fileHandle = sourceFile.open();
  try {
    const totalBytes = Number(fileHandle.size ?? sourceFile.size);
    if (!Number.isFinite(totalBytes) || totalBytes <= 0) {
      throw new Error("Could not read MKV file bytes.");
    }

    fileHandle.offset = 0;
    while ((fileHandle.offset ?? 0) < totalBytes) {
      const remaining = totalBytes - (fileHandle.offset ?? 0);
      const readSize = Math.min(FILE_READ_CHUNK_BYTES, remaining);
      const chunk = fileHandle.readBytes(readSize);
      if (!chunk || chunk.length === 0) {
        break;
      }
      parser.write(Buffer.from(chunk));
    }

    parser.end();
    await parseFinishedPromise;
  } finally {
    fileHandle.close();
  }

  if (discoveredTracks.length === 0) {
    throw new Error("No subtitle tracks were found in this MKV file.");
  }

  const selectedTrack = pickPreferredTrackFromPackets(
    discoveredTracks,
    subtitlePacketsByTrack
  );
  if (!selectedTrack) {
    throw new Error("Could not select an embedded subtitle track.");
  }

  const selectedTrackPackets =
    subtitlePacketsByTrack.get(selectedTrack.number) || [];
  if (selectedTrackPackets.length === 0) {
    throw new Error("Selected subtitle track did not contain cue data.");
  }

  const cues = buildCuesFromPackets(selectedTrackPackets);
  if (cues.length === 0) {
    throw new Error("Embedded subtitle cues were empty after parsing.");
  }

  const trackOrder = discoveredTracks.findIndex(
    (track) => track.number === selectedTrack.number
  );
  const trackLabel = buildTrackLabel(selectedTrack, Math.max(trackOrder, 0));
  const baseFileName = sourceFileName?.trim() || getFileNameFromUri(videoUri);

  return {
    cues,
    subtitleFileName: `${baseFileName} [Embedded: ${trackLabel}]`,
    selectedTrackLabel: trackLabel,
  };
}
