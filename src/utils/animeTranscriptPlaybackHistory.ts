import AsyncStorage from "@react-native-async-storage/async-storage";
import { Directory, File, Paths } from "expo-file-system";
import type {
  AnimeTranscriptDevSession,
  AnimeTranscriptSubtitleCue,
  AnimeTranscriptVideoSourceType,
} from "./animeTranscriptDevSession";
import { getFileNameFromUri } from "./animeTranscriptDevHelpers";

const ANIME_TRANSCRIPT_PLAYBACK_HISTORY_KEY =
  "@wanikani_anime_transcript_playback_history_v1";
const MAX_ANIME_TRANSCRIPT_PLAYBACK_HISTORY_ITEMS = 12;
const ANIME_TRANSCRIPT_HISTORY_VIDEO_CACHE_DIRECTORY_NAME =
  "anime-transcript-history-videos";
const FINISHED_PLAYBACK_PROGRESS_RATIO_THRESHOLD = 0.97;

export type AnimeTranscriptPlaybackHistoryEntry = {
  id: string;
  title: string;
  videoUri: string;
  videoFileName: string;
  videoSourceType: AnimeTranscriptVideoSourceType;
  subtitleFileName: string;
  subtitleCues: AnimeTranscriptSubtitleCue[];
  vocabularyMatches: AnimeTranscriptDevSession["vocabularyMatches"];
  kanjiMatches: AnimeTranscriptDevSession["kanjiMatches"];
  jpdbParsedTokens: AnimeTranscriptDevSession["jpdbParsedTokens"];
  durationSeconds: number;
  lastPlaybackPositionSeconds: number;
  savedAt: number;
  lastOpenedAt: number;
  updatedAt: number;
};

export type AnimeTranscriptPlaybackProgressStatus =
  | "notStarted"
  | "inProgress"
  | "finished";

function getDurationFromCues(cues: AnimeTranscriptSubtitleCue[]): number {
  const duration = cues.reduce((maximum, cue) => Math.max(maximum, cue.endTime), 0);
  if (!Number.isFinite(duration) || duration < 0) {
    return 0;
  }
  return duration;
}

function resolvePreferredDurationSeconds(options: {
  explicitDurationSeconds?: number | null;
  fallbackDurationSeconds?: number | null;
  cueDurationSeconds?: number | null;
}): number {
  const explicitDurationSeconds = Number(options.explicitDurationSeconds);
  if (Number.isFinite(explicitDurationSeconds) && explicitDurationSeconds > 0) {
    return explicitDurationSeconds;
  }

  const fallbackDurationSeconds = Number(options.fallbackDurationSeconds);
  if (Number.isFinite(fallbackDurationSeconds) && fallbackDurationSeconds > 0) {
    return fallbackDurationSeconds;
  }

  const cueDurationSeconds = Number(options.cueDurationSeconds);
  if (Number.isFinite(cueDurationSeconds) && cueDurationSeconds > 0) {
    return cueDurationSeconds;
  }

  return 0;
}

function clampPlaybackPosition(
  durationSeconds: number,
  requestedPositionSeconds: number
): number {
  const normalizedDuration = Number.isFinite(durationSeconds)
    ? Math.max(0, durationSeconds)
    : 0;
  const normalizedRequestedPosition = Number.isFinite(requestedPositionSeconds)
    ? Math.max(0, requestedPositionSeconds)
    : 0;

  if (normalizedDuration <= 0) {
    return normalizedRequestedPosition;
  }

  return Math.min(normalizedDuration, normalizedRequestedPosition);
}

function buildHistoryEntryId(): string {
  return `transcript-history-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getHistoryVideoCacheDirectory(): Directory {
  return new Directory(Paths.document, ANIME_TRANSCRIPT_HISTORY_VIDEO_CACHE_DIRECTORY_NAME);
}

function isFileUri(uri: string): boolean {
  return uri.startsWith("file://");
}

function isCachedHistoryVideoUri(uri: string): boolean {
  const cacheDirectory = getHistoryVideoCacheDirectory();
  return uri === cacheDirectory.uri || uri.startsWith(`${cacheDirectory.uri}/`);
}

function ensureHistoryVideoCacheDirectory(): Directory {
  const cacheDirectory = getHistoryVideoCacheDirectory();
  if (!cacheDirectory.exists) {
    cacheDirectory.create({ idempotent: true, intermediates: true });
  }
  return cacheDirectory;
}

function extractExtension(fileName: string): string {
  const extensionMatch = fileName.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return extensionMatch?.[1] ?? "";
}

function sanitizeFileNameForHistory(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[a-z0-9]+$/i, "");
  const sanitized = withoutExtension
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  if (sanitized.length > 0) {
    return sanitized.slice(0, 48);
  }

  return "video";
}

function deleteCachedHistoryVideoUri(videoUri: string): void {
  if (!isCachedHistoryVideoUri(videoUri)) {
    return;
  }

  try {
    const cachedVideoFile = new File(videoUri);
    if (cachedVideoFile.exists) {
      cachedVideoFile.delete();
    }
  } catch {
    // Best-effort cleanup.
  }
}

function persistVideoUriToHistoryCache(
  sourceVideoUri: string,
  sourceVideoFileName: string,
  preferredCachedVideoUri?: string
): string {
  if (typeof sourceVideoUri !== "string" || sourceVideoUri.length === 0) {
    return sourceVideoUri;
  }

  if (isCachedHistoryVideoUri(sourceVideoUri)) {
    const alreadyCachedFile = new File(sourceVideoUri);
    if (alreadyCachedFile.exists) {
      return sourceVideoUri;
    }
  }

  if (preferredCachedVideoUri && isCachedHistoryVideoUri(preferredCachedVideoUri)) {
    const preferredCachedFile = new File(preferredCachedVideoUri);
    if (preferredCachedFile.exists) {
      return preferredCachedVideoUri;
    }
  }

  if (!isFileUri(sourceVideoUri)) {
    return sourceVideoUri;
  }

  try {
    const sourceVideoFile = new File(sourceVideoUri);
    if (!sourceVideoFile.exists) {
      return sourceVideoUri;
    }

    const cacheDirectory = ensureHistoryVideoCacheDirectory();
    const fileNameCandidate =
      sourceVideoFileName.trim() || getFileNameFromUri(sourceVideoUri);
    const extension = extractExtension(fileNameCandidate);
    const sanitizedBaseName = sanitizeFileNameForHistory(fileNameCandidate);
    const destinationFileName = `${sanitizedBaseName}-${Date.now()}${extension}`;
    const destinationVideoFile = new File(cacheDirectory, destinationFileName);

    if (destinationVideoFile.exists) {
      destinationVideoFile.delete();
    }
    sourceVideoFile.copySync(destinationVideoFile);
    return destinationVideoFile.uri;
  } catch {
    return sourceVideoUri;
  }
}

function normalizeEntry(
  rawEntry: unknown
): AnimeTranscriptPlaybackHistoryEntry | null {
  if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
    return null;
  }

  const candidate = rawEntry as Partial<AnimeTranscriptPlaybackHistoryEntry>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.videoUri !== "string" ||
    typeof candidate.videoFileName !== "string" ||
    typeof candidate.subtitleFileName !== "string" ||
    !Array.isArray(candidate.subtitleCues) ||
    !Array.isArray(candidate.vocabularyMatches) ||
    !Array.isArray(candidate.kanjiMatches) ||
    !Array.isArray(candidate.jpdbParsedTokens)
  ) {
    return null;
  }

  const sourceType =
    candidate.videoSourceType === "mkv" ? "mkv" : "mp4";
  const savedAt = Number(candidate.savedAt);
  const updatedAt = Number(candidate.updatedAt);
  const lastOpenedAt = Number(candidate.lastOpenedAt);
  const normalizedDurationSeconds = resolvePreferredDurationSeconds({
    explicitDurationSeconds: Number(candidate.durationSeconds),
    cueDurationSeconds: getDurationFromCues(
      candidate.subtitleCues as AnimeTranscriptSubtitleCue[]
    ),
  });
  const lastPlaybackPositionSecondsRaw = Number(candidate.lastPlaybackPositionSeconds);
  const lastPlaybackPositionSeconds = clampPlaybackPosition(
    normalizedDurationSeconds,
    Number.isFinite(lastPlaybackPositionSecondsRaw)
      ? lastPlaybackPositionSecondsRaw
      : 0
  );

  return {
    id: candidate.id,
    title:
      typeof candidate.title === "string" && candidate.title.trim().length > 0
        ? candidate.title
        : candidate.videoFileName,
    videoUri: candidate.videoUri,
    videoFileName: candidate.videoFileName,
    videoSourceType: sourceType,
    subtitleFileName: candidate.subtitleFileName,
    subtitleCues: candidate.subtitleCues as AnimeTranscriptSubtitleCue[],
    vocabularyMatches:
      candidate.vocabularyMatches as AnimeTranscriptDevSession["vocabularyMatches"],
    kanjiMatches: candidate.kanjiMatches as AnimeTranscriptDevSession["kanjiMatches"],
    jpdbParsedTokens:
      candidate.jpdbParsedTokens as AnimeTranscriptDevSession["jpdbParsedTokens"],
    durationSeconds: normalizedDurationSeconds,
    lastPlaybackPositionSeconds,
    savedAt: Number.isFinite(savedAt) ? savedAt : Date.now(),
    lastOpenedAt: Number.isFinite(lastOpenedAt)
      ? lastOpenedAt
      : Number.isFinite(savedAt)
        ? savedAt
        : Date.now(),
    updatedAt: Number.isFinite(updatedAt)
      ? updatedAt
      : Number.isFinite(savedAt)
        ? savedAt
        : Date.now(),
  };
}

async function readRawHistoryEntries(): Promise<AnimeTranscriptPlaybackHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(ANIME_TRANSCRIPT_PLAYBACK_HISTORY_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(normalizeEntry)
      .filter(
        (entry): entry is AnimeTranscriptPlaybackHistoryEntry => entry !== null
      );
  } catch {
    return [];
  }
}

async function writeRawHistoryEntries(
  entries: AnimeTranscriptPlaybackHistoryEntry[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(
      ANIME_TRANSCRIPT_PLAYBACK_HISTORY_KEY,
      JSON.stringify(entries)
    );
  } catch {
    // Best-effort persistence.
  }
}

function sortEntriesDescendingByLastOpened(
  entries: AnimeTranscriptPlaybackHistoryEntry[]
): AnimeTranscriptPlaybackHistoryEntry[] {
  return [...entries].sort((left, right) => right.lastOpenedAt - left.lastOpenedAt);
}

export async function getAnimeTranscriptPlaybackHistory(): Promise<
  AnimeTranscriptPlaybackHistoryEntry[]
> {
  const entries = await readRawHistoryEntries();
  let hasChanges = false;

  const migratedEntries = entries.map((entry) => {
    const cachedVideoUri = persistVideoUriToHistoryCache(
      entry.videoUri,
      entry.videoFileName,
      entry.videoUri
    );
    if (cachedVideoUri === entry.videoUri) {
      return entry;
    }

    hasChanges = true;
    return {
      ...entry,
      videoUri: cachedVideoUri,
      updatedAt: Date.now(),
    };
  });
  const sortedEntries = sortEntriesDescendingByLastOpened(migratedEntries);

  if (hasChanges) {
    await writeRawHistoryEntries(sortedEntries);
  }

  return sortedEntries;
}

export async function saveAnimeTranscriptPlaybackHistoryEntry(
  session: AnimeTranscriptDevSession
): Promise<AnimeTranscriptPlaybackHistoryEntry> {
  const now = Date.now();
  const existingEntries = await readRawHistoryEntries();
  const dedupeIndex = existingEntries.findIndex(
    (entry) =>
      entry.videoUri === session.videoUri &&
      entry.videoFileName === session.videoFileName &&
      entry.subtitleFileName === session.subtitleFileName
  );
  const preferredCachedVideoUri =
    dedupeIndex >= 0 ? existingEntries[dedupeIndex].videoUri : undefined;
  const dedupedExistingEntry =
    dedupeIndex >= 0 ? existingEntries[dedupeIndex] : null;
  const persistedVideoUri = persistVideoUriToHistoryCache(
    session.videoUri,
    session.videoFileName,
    preferredCachedVideoUri
  );
  const durationSeconds = resolvePreferredDurationSeconds({
    explicitDurationSeconds: session.videoDurationSeconds,
    fallbackDurationSeconds: dedupedExistingEntry?.durationSeconds,
    cueDurationSeconds: getDurationFromCues(session.subtitleCues),
  });
  const requestedStartPosition =
    typeof session.lastPlaybackPositionSeconds === "number"
      ? session.lastPlaybackPositionSeconds
      : typeof session.initialPlaybackPositionSeconds === "number"
        ? session.initialPlaybackPositionSeconds
        : dedupedExistingEntry?.lastPlaybackPositionSeconds ?? 0;
  const lastPlaybackPositionSeconds = clampPlaybackPosition(
    durationSeconds,
    requestedStartPosition
  );

  const baseEntry: AnimeTranscriptPlaybackHistoryEntry = {
    id:
      dedupeIndex >= 0 ? existingEntries[dedupeIndex].id : buildHistoryEntryId(),
    title: session.videoFileName,
    videoUri: persistedVideoUri,
    videoFileName: session.videoFileName,
    videoSourceType: session.videoSourceType,
    subtitleFileName: session.subtitleFileName,
    subtitleCues: session.subtitleCues,
    vocabularyMatches: session.vocabularyMatches,
    kanjiMatches: session.kanjiMatches,
    jpdbParsedTokens: session.jpdbParsedTokens,
    durationSeconds,
    lastPlaybackPositionSeconds,
    savedAt:
      dedupeIndex >= 0 ? existingEntries[dedupeIndex].savedAt : now,
    lastOpenedAt: now,
    updatedAt: now,
  };

  const mergedEntries =
    dedupeIndex >= 0
      ? [
          baseEntry,
          ...existingEntries.filter((entry) => entry.id !== baseEntry.id),
        ]
      : [baseEntry, ...existingEntries];
  const nextEntries = sortEntriesDescendingByLastOpened(mergedEntries).slice(
    0,
    MAX_ANIME_TRANSCRIPT_PLAYBACK_HISTORY_ITEMS
  );
  const retainedVideoUris = new Set(nextEntries.map((entry) => entry.videoUri));

  mergedEntries.forEach((entry) => {
    if (retainedVideoUris.has(entry.videoUri)) {
      return;
    }
    deleteCachedHistoryVideoUri(entry.videoUri);
  });

  await writeRawHistoryEntries(nextEntries);
  return baseEntry;
}

export async function removeAnimeTranscriptPlaybackHistoryEntry(
  entryId: string
): Promise<void> {
  const existingEntries = await readRawHistoryEntries();
  const removedEntries = existingEntries.filter((entry) => entry.id === entryId);
  const nextEntries = existingEntries.filter((entry) => entry.id !== entryId);
  const retainedVideoUris = new Set(nextEntries.map((entry) => entry.videoUri));

  removedEntries.forEach((entry) => {
    if (retainedVideoUris.has(entry.videoUri)) {
      return;
    }
    deleteCachedHistoryVideoUri(entry.videoUri);
  });

  await writeRawHistoryEntries(nextEntries);
}

export async function touchAnimeTranscriptPlaybackHistoryEntry(
  entryId: string
): Promise<void> {
  const existingEntries = await readRawHistoryEntries();
  const nextEntries = existingEntries.map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          lastOpenedAt: Date.now(),
        }
      : entry
  );

  await writeRawHistoryEntries(sortEntriesDescendingByLastOpened(nextEntries));
}

function findHistoryEntryById(
  entries: AnimeTranscriptPlaybackHistoryEntry[],
  entryId: string
): AnimeTranscriptPlaybackHistoryEntry | null {
  return entries.find((entry) => entry.id === entryId) ?? null;
}

export function getAnimeTranscriptPlaybackProgressRatio(
  entry: AnimeTranscriptPlaybackHistoryEntry
): number {
  if (!Number.isFinite(entry.durationSeconds) || entry.durationSeconds <= 0) {
    return 0;
  }

  const ratio = entry.lastPlaybackPositionSeconds / entry.durationSeconds;
  return Math.max(0, Math.min(1, ratio));
}

export function getAnimeTranscriptPlaybackProgressStatus(
  entry: AnimeTranscriptPlaybackHistoryEntry
): AnimeTranscriptPlaybackProgressStatus {
  if (!Number.isFinite(entry.durationSeconds) || entry.durationSeconds <= 0) {
    return entry.lastPlaybackPositionSeconds > 2 ? "inProgress" : "notStarted";
  }

  const ratio = getAnimeTranscriptPlaybackProgressRatio(entry);

  if (ratio >= FINISHED_PLAYBACK_PROGRESS_RATIO_THRESHOLD) {
    return "finished";
  }

  if (ratio > 0.02) {
    return "inProgress";
  }

  return "notStarted";
}

export async function updateAnimeTranscriptPlaybackProgress(
  entryId: string,
  positionSeconds: number
): Promise<AnimeTranscriptPlaybackHistoryEntry | null> {
  const existingEntries = await readRawHistoryEntries();
  const existingEntry = findHistoryEntryById(existingEntries, entryId);
  if (!existingEntry) {
    return null;
  }

  const nextPositionSeconds = clampPlaybackPosition(
    existingEntry.durationSeconds,
    positionSeconds
  );

  const positionDelta = Math.abs(
    nextPositionSeconds - existingEntry.lastPlaybackPositionSeconds
  );
  const now = Date.now();
  const shouldSkipWrite = positionDelta < 0.01 && now - existingEntry.updatedAt < 5000;
  if (shouldSkipWrite) {
    return existingEntry;
  }

  const nextEntries = existingEntries.map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          lastPlaybackPositionSeconds: nextPositionSeconds,
          lastOpenedAt: now,
          updatedAt: now,
        }
      : entry
  );
  const sortedNextEntries = sortEntriesDescendingByLastOpened(nextEntries);
  await writeRawHistoryEntries(sortedNextEntries);
  return findHistoryEntryById(sortedNextEntries, entryId);
}

export async function updateAnimeTranscriptPlaybackDuration(
  entryId: string,
  durationSeconds: number
): Promise<AnimeTranscriptPlaybackHistoryEntry | null> {
  const nextDurationSeconds = Number(durationSeconds);
  if (!Number.isFinite(nextDurationSeconds) || nextDurationSeconds <= 0) {
    return null;
  }

  const existingEntries = await readRawHistoryEntries();
  const existingEntry = findHistoryEntryById(existingEntries, entryId);
  if (!existingEntry) {
    return null;
  }

  const normalizedDurationSeconds = Math.max(0, nextDurationSeconds);
  const durationDelta = Math.abs(normalizedDurationSeconds - existingEntry.durationSeconds);
  if (durationDelta < 1) {
    return existingEntry;
  }

  const now = Date.now();
  const nextEntries = existingEntries.map((entry) => {
    if (entry.id !== entryId) {
      return entry;
    }

    const clampedPlaybackPositionSeconds = clampPlaybackPosition(
      normalizedDurationSeconds,
      entry.lastPlaybackPositionSeconds
    );

    return {
      ...entry,
      durationSeconds: normalizedDurationSeconds,
      lastPlaybackPositionSeconds: clampedPlaybackPositionSeconds,
      updatedAt: now,
    };
  });

  const sortedNextEntries = sortEntriesDescendingByLastOpened(nextEntries);
  await writeRawHistoryEntries(sortedNextEntries);
  return findHistoryEntryById(sortedNextEntries, entryId);
}

export async function clearAnimeTranscriptPlaybackProgress(
  entryId: string
): Promise<AnimeTranscriptPlaybackHistoryEntry | null> {
  const existingEntries = await readRawHistoryEntries();
  const existingEntry = findHistoryEntryById(existingEntries, entryId);
  if (!existingEntry) {
    return null;
  }

  const now = Date.now();
  const nextEntries = existingEntries.map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          lastPlaybackPositionSeconds: 0,
          updatedAt: now,
        }
      : entry
  );
  const sortedNextEntries = sortEntriesDescendingByLastOpened(nextEntries);
  await writeRawHistoryEntries(sortedNextEntries);
  return findHistoryEntryById(sortedNextEntries, entryId);
}

export async function getMostRecentAnimeTranscriptPlaybackHistoryEntry(): Promise<AnimeTranscriptPlaybackHistoryEntry | null> {
  const entries = await getAnimeTranscriptPlaybackHistory();
  return entries[0] ?? null;
}

export function buildAnimeTranscriptSessionFromHistoryEntry(
  entry: AnimeTranscriptPlaybackHistoryEntry,
  options?: { startAtSeconds?: number | null }
): AnimeTranscriptDevSession {
  const preferredStartAtSeconds =
    typeof options?.startAtSeconds === "number"
      ? options.startAtSeconds
      : entry.lastPlaybackPositionSeconds;
  const initialPlaybackPositionSeconds = clampPlaybackPosition(
    entry.durationSeconds,
    preferredStartAtSeconds
  );

  return {
    videoUri: entry.videoUri,
    videoFileName: entry.videoFileName,
    videoSourceType: entry.videoSourceType,
    subtitleFileName: entry.subtitleFileName,
    subtitleCues: entry.subtitleCues,
    vocabularyMatches: entry.vocabularyMatches,
    kanjiMatches: entry.kanjiMatches,
    jpdbParsedTokens: entry.jpdbParsedTokens,
    videoDurationSeconds: entry.durationSeconds,
    historyEntryId: entry.id,
    lastPlaybackPositionSeconds: entry.lastPlaybackPositionSeconds,
    initialPlaybackPositionSeconds,
    updatedAt: entry.updatedAt,
  };
}

export function formatAnimeTranscriptPlaybackHistoryTimestamp(
  timestamp: number
): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMinutes < 1) {
    return "Just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString();
}
