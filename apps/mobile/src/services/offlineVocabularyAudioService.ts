import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import * as SQLite from "expo-sqlite";
import { getAllSubjects } from "../utils/cache";
import { getSubjectsMetadata } from "../utils/permanentStorage";
import type {
  PronunciationAudio,
  PronunciationAudioVoicePreference,
} from "../utils/pronunciationAudio";

const DATABASE_NAME = "offline-vocabulary-audio.db";
const INDEX_METADATA_KEY = "subjects_data_updated_at";
const DEFAULT_MAX_CONCURRENT_DOWNLOADS = 6;
const CACHE_STATS_BATCH_SIZE = 40;
const OFFLINE_DOWNLOAD_VOICE_SCOPE: PronunciationAudioVoicePreference = "both";
const AUDIO_CACHE_DIRECTORY = FileSystem.documentDirectory
  ? `${FileSystem.documentDirectory}offline-vocabulary-audio`
  : null;

type QueueCandidate = {
  subject_id: number;
  level: number;
  url: string;
  cache_filename: string;
};

type IndexedAudioRow = {
  subjectId: number;
  level: number;
  url: string;
  contentType: string;
  voiceActorId: number | null;
  voiceActorName: string | null;
  gender: string | null;
  cacheFilename: string;
};

export type OfflineVocabularyAudioProgress = {
  inProgress: boolean;
  total: number;
  completed: number;
  updatedAt: number | null;
  lastStartedAt: number | null;
  lastFinishedAt: number | null;
  lastError: string | null;
};

export type QueueOfflineVocabularyAudioOptions = {
  enabled: boolean;
  currentLevel: number;
  voicePreference: PronunciationAudioVoicePreference;
  forceReindex?: boolean;
};

export type OfflineVocabularyAudioCacheStats = {
  totalBytes: number;
  fileCount: number;
};

type ProgressListener = (progress: OfflineVocabularyAudioProgress) => void;

const progressListeners = new Set<ProgressListener>();

let downloadRunId = 0;
let activeQueuePromise: Promise<OfflineVocabularyAudioProgress> | null = null;
let activeQueueKey: string | null = null;
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
const onDemandAudioCachePromises = new Map<string, Promise<string | null>>();
let progressState: OfflineVocabularyAudioProgress = {
  inProgress: false,
  total: 0,
  completed: 0,
  updatedAt: null,
  lastStartedAt: null,
  lastFinishedAt: null,
  lastError: null,
};

function canUseOfflineAudioCaching(): boolean {
  return Platform.OS !== "web" && Boolean(AUDIO_CACHE_DIRECTORY);
}

function emitProgressUpdate(
  patch: Partial<OfflineVocabularyAudioProgress>
): OfflineVocabularyAudioProgress {
  progressState = {
    ...progressState,
    ...patch,
    updatedAt: Date.now(),
  };
  progressListeners.forEach((listener) => listener(progressState));
  return progressState;
}

function normalizeMaybeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeMaybeNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Math.trunc(value);
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function cacheFilenameForAudio(subjectId: number, audioUrl: string): string {
  return `a${subjectId}-${hashString(audioUrl)}.mp3`;
}

function cacheUriForFilename(cacheFilename: string): string | null {
  if (!AUDIO_CACHE_DIRECTORY) {
    return null;
  }
  return `${AUDIO_CACHE_DIRECTORY}/${cacheFilename}`;
}

function buildQueueKey(options: QueueOfflineVocabularyAudioOptions): string {
  const level = Math.max(1, Math.floor(options.currentLevel || 1));
  const dataUpdatedAt = getSubjectsMetadata()?.dataUpdatedAt ?? "__unknown__";
  return `${level}|${OFFLINE_DOWNLOAD_VOICE_SCOPE}|${dataUpdatedAt}`;
}

function getLevelPriorityOrder(currentLevel: number): number[] {
  const normalizedCurrentLevel = Math.max(1, Math.floor(currentLevel || 1));
  const levels: number[] = [normalizedCurrentLevel];

  for (let level = normalizedCurrentLevel - 1; level >= 1; level -= 1) {
    levels.push(level);
  }

  levels.push(normalizedCurrentLevel + 1);
  return levels;
}

function voicePreferenceSqlFilter(
  voicePreference: PronunciationAudioVoicePreference
): { clause: string; params: (string | number)[] } | null {
  switch (voicePreference) {
    case "female":
      return {
        clause:
          "(LOWER(COALESCE(gender, '')) = ? OR LOWER(COALESCE(voice_actor_name, '')) = ?)",
        params: ["female", "kyoko"],
      };
    case "male":
      return {
        clause:
          "(LOWER(COALESCE(gender, '')) = ? OR LOWER(COALESCE(voice_actor_name, '')) = ?)",
        params: ["male", "kenichi"],
      };
    case "both":
    case "random":
    default:
      return null;
  }
}

async function ensureCacheDirectory(): Promise<void> {
  if (!AUDIO_CACHE_DIRECTORY) {
    return;
  }
  const info = await FileSystem.getInfoAsync(AUDIO_CACHE_DIRECTORY);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(AUDIO_CACHE_DIRECTORY, {
      intermediates: true,
    });
  }
}

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS audio_urls (
          subject_id INTEGER NOT NULL,
          level INTEGER NOT NULL,
          url TEXT NOT NULL,
          content_type TEXT,
          voice_actor_id INTEGER,
          voice_actor_name TEXT,
          gender TEXT,
          cache_filename TEXT NOT NULL,
          PRIMARY KEY (subject_id, cache_filename)
        );
        CREATE INDEX IF NOT EXISTS idx_audio_urls_level ON audio_urls (level);
        CREATE INDEX IF NOT EXISTS idx_audio_urls_voice ON audio_urls (voice_actor_name, gender);
        CREATE TABLE IF NOT EXISTS index_metadata (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT
        );
      `);
      return db;
    })();
  }

  return dbPromise;
}

function extractIndexedAudioRows(subjects: any[]): IndexedAudioRow[] {
  const rows: IndexedAudioRow[] = [];

  for (const subject of subjects) {
    const subjectId = Number(subject?.id);
    const objectType = subject?.object;
    const level = Number(subject?.data?.level);
    const pronunciationAudios = Array.isArray(subject?.data?.pronunciation_audios)
      ? subject.data.pronunciation_audios
      : [];

    if (
      !Number.isFinite(subjectId) ||
      !Number.isFinite(level) ||
      (objectType !== "vocabulary" && objectType !== "kana_vocabulary") ||
      pronunciationAudios.length === 0
    ) {
      continue;
    }

    const seenFilenames = new Set<string>();
    for (const audio of pronunciationAudios) {
      const url = normalizeMaybeString(audio?.url);
      const contentType = normalizeMaybeString(audio?.content_type);
      if (!url || contentType !== "audio/mpeg") {
        continue;
      }

      const cacheFilename = cacheFilenameForAudio(subjectId, url);
      if (seenFilenames.has(cacheFilename)) {
        continue;
      }
      seenFilenames.add(cacheFilename);

      rows.push({
        subjectId,
        level,
        url,
        contentType,
        voiceActorId: normalizeMaybeNumber(audio?.metadata?.voice_actor_id),
        voiceActorName:
          normalizeMaybeString(audio?.metadata?.voice_actor_name)?.toLowerCase() ??
          null,
        gender: normalizeMaybeString(audio?.metadata?.gender)?.toLowerCase() ?? null,
        cacheFilename,
      });
    }
  }

  return rows;
}

async function refreshAudioUrlIndexIfNeeded(
  db: SQLite.SQLiteDatabase,
  options: { force?: boolean } = {}
): Promise<void> {
  const metadata = getSubjectsMetadata();
  const cacheDataUpdatedAt =
    metadata?.dataUpdatedAt ?? "__no_subjects_data_updated_at__";
  const markerRow = await db.getFirstAsync<{ value: string | null }>(
    "SELECT value FROM index_metadata WHERE key = ?",
    INDEX_METADATA_KEY
  );
  const indexedDataUpdatedAt = markerRow?.value ?? "";

  const shouldRefresh = options.force || cacheDataUpdatedAt !== indexedDataUpdatedAt;
  if (!shouldRefresh) {
    return;
  }

  const allSubjects = await getAllSubjects();
  if (!Array.isArray(allSubjects) || allSubjects.length === 0) {
    return;
  }

  const indexedRows = extractIndexedAudioRows(allSubjects);

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync("DELETE FROM audio_urls");

    for (const row of indexedRows) {
      await txn.runAsync(
        `INSERT OR REPLACE INTO audio_urls (
          subject_id,
          level,
          url,
          content_type,
          voice_actor_id,
          voice_actor_name,
          gender,
          cache_filename
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        row.subjectId,
        row.level,
        row.url,
        row.contentType,
        row.voiceActorId,
        row.voiceActorName,
        row.gender,
        row.cacheFilename
      );
    }

    await txn.runAsync(
      "INSERT OR REPLACE INTO index_metadata (key, value) VALUES (?, ?)",
      INDEX_METADATA_KEY,
      cacheDataUpdatedAt
    );
  });
}

async function buildDownloadQueue(
  db: SQLite.SQLiteDatabase,
  currentLevel: number,
  voicePreference: PronunciationAudioVoicePreference
): Promise<QueueCandidate[]> {
  const levels = getLevelPriorityOrder(currentLevel);
  const levelPlaceholders = levels.map(() => "?").join(", ");
  const levelOrderCase = levels
    .map((level, index) => `WHEN ${level} THEN ${index}`)
    .join(" ");

  let sql = `
    SELECT subject_id, level, url, cache_filename
    FROM audio_urls
    WHERE level IN (${levelPlaceholders})
  `;
  const params: (string | number)[] = [...levels];

  const voiceFilter = voicePreferenceSqlFilter(voicePreference);
  if (voiceFilter) {
    sql += ` AND ${voiceFilter.clause}`;
    params.push(...voiceFilter.params);
  }

  sql += ` ORDER BY CASE level ${levelOrderCase} ELSE 9999 END ASC, subject_id ASC`;
  return db.getAllAsync<QueueCandidate>(sql, ...(params as any[]));
}

async function fileExists(uri: string): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(uri);
  return Boolean(info.exists);
}

async function getCachedFilenameSet(): Promise<Set<string>> {
  if (!AUDIO_CACHE_DIRECTORY) {
    return new Set<string>();
  }

  try {
    const fileNames = await FileSystem.readDirectoryAsync(AUDIO_CACHE_DIRECTORY);
    return new Set(fileNames);
  } catch {
    return new Set<string>();
  }
}

export function getOfflineVocabularyAudioProgress(): OfflineVocabularyAudioProgress {
  return progressState;
}

export function subscribeOfflineVocabularyAudioProgress(
  listener: ProgressListener
): () => void {
  progressListeners.add(listener);
  listener(progressState);
  return () => {
    progressListeners.delete(listener);
  };
}

export function cancelOfflineVocabularyAudioDownloads(): void {
  downloadRunId += 1;
  activeQueuePromise = null;
  activeQueueKey = null;
  emitProgressUpdate({
    inProgress: false,
  });
}

export async function queueOfflineVocabularyAudioDownloads(
  options: QueueOfflineVocabularyAudioOptions
): Promise<OfflineVocabularyAudioProgress> {
  if (!canUseOfflineAudioCaching()) {
    return emitProgressUpdate({
      inProgress: false,
      total: 0,
      completed: 0,
      lastError: null,
    });
  }

  if (!options.enabled) {
    cancelOfflineVocabularyAudioDownloads();
    return emitProgressUpdate({
      inProgress: false,
      total: 0,
      completed: 0,
      lastError: null,
    });
  }

  const queueKey = buildQueueKey(options);
  if (
    !options.forceReindex &&
    progressState.inProgress &&
    activeQueuePromise &&
    activeQueueKey === queueKey
  ) {
    return activeQueuePromise;
  }

  const operationPromise = (async () => {
    let runId = 0;
    try {
      await ensureCacheDirectory();

      const db = await getDatabase();
      await refreshAudioUrlIndexIfNeeded(db, { force: options.forceReindex });

      const queueCandidates = await buildDownloadQueue(
        db,
        options.currentLevel,
        OFFLINE_DOWNLOAD_VOICE_SCOPE
      );

      const cachedFileNames = await getCachedFilenameSet();
      const pendingQueueCandidates = queueCandidates.filter(
        (candidate) => !cachedFileNames.has(candidate.cache_filename)
      );

      if (pendingQueueCandidates.length === 0) {
        return emitProgressUpdate({
          inProgress: false,
          total: 0,
          completed: 0,
          lastFinishedAt: Date.now(),
          lastError: null,
        });
      }

      runId = ++downloadRunId;
      emitProgressUpdate({
        inProgress: true,
        total: pendingQueueCandidates.length,
        completed: 0,
        lastStartedAt: Date.now(),
        lastError: null,
      });

      let completed = 0;
      let lastError: string | null = null;
      let nextIndex = 0;
      const workerCount = Math.min(
        Math.max(1, pendingQueueCandidates.length),
        DEFAULT_MAX_CONCURRENT_DOWNLOADS
      );

      const processCandidate = async (candidate: QueueCandidate): Promise<void> => {
        if (runId !== downloadRunId) {
          return;
        }

        const targetUri = cacheUriForFilename(candidate.cache_filename);
        if (!targetUri) {
          completed += 1;
          emitProgressUpdate({
            completed,
            lastError,
          });
          return;
        }

        try {
          const alreadyCached = await fileExists(targetUri);
          if (!alreadyCached) {
            await FileSystem.downloadAsync(candidate.url, targetUri);
          }
        } catch (error) {
          lastError = toErrorMessage(error);
        }

        if (runId !== downloadRunId) {
          return;
        }

        completed += 1;
        emitProgressUpdate({
          completed,
          lastError,
        });
      };

      const runWorker = async (): Promise<void> => {
        while (runId === downloadRunId) {
          const index = nextIndex;
          nextIndex += 1;
          if (index >= pendingQueueCandidates.length) {
            return;
          }
          await processCandidate(pendingQueueCandidates[index]);
        }
      };

      await Promise.all(
        Array.from({ length: workerCount }, () => runWorker())
      );

      if (runId !== downloadRunId) {
        return progressState;
      }

      return emitProgressUpdate({
        inProgress: false,
        completed,
        lastFinishedAt: Date.now(),
        lastError,
      });
    } catch (error) {
      if (runId !== 0 && runId !== downloadRunId) {
        return progressState;
      }
      return emitProgressUpdate({
        inProgress: false,
        total: 0,
        completed: 0,
        lastFinishedAt: Date.now(),
        lastError: toErrorMessage(error),
      });
    }
  })();

  activeQueuePromise = operationPromise;
  activeQueueKey = queueKey;

  try {
    return await operationPromise;
  } finally {
    if (activeQueuePromise === operationPromise) {
      activeQueuePromise = null;
      activeQueueKey = null;
    }
  }
}

export async function getOfflineVocabularyAudioCacheStats(): Promise<OfflineVocabularyAudioCacheStats> {
  const cacheDirectory = AUDIO_CACHE_DIRECTORY;
  if (!cacheDirectory) {
    return {
      totalBytes: 0,
      fileCount: 0,
    };
  }

  const dirInfo = await FileSystem.getInfoAsync(cacheDirectory);
  if (!dirInfo.exists) {
    return {
      totalBytes: 0,
      fileCount: 0,
    };
  }

  const fileNames = await FileSystem.readDirectoryAsync(cacheDirectory);
  let totalBytes = 0;
  let fileCount = 0;

  for (let index = 0; index < fileNames.length; index += CACHE_STATS_BATCH_SIZE) {
    const batch = fileNames.slice(index, index + CACHE_STATS_BATCH_SIZE);
    const batchFileInfos = await Promise.all(
      batch.map((fileName) =>
        FileSystem.getInfoAsync(`${cacheDirectory}/${fileName}`)
      )
    );

    for (const fileInfo of batchFileInfos) {
      if (
        fileInfo.exists &&
        !fileInfo.isDirectory &&
        typeof fileInfo.size === "number"
      ) {
        totalBytes += fileInfo.size;
        fileCount += 1;
      }
    }

    // Yield back to the JS event loop between batches to keep large scans responsive.
    if (index + CACHE_STATS_BATCH_SIZE < fileNames.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  return {
    totalBytes,
    fileCount,
  };
}

export async function getOfflineVocabularyAudioCacheSizeBytes(): Promise<number> {
  const stats = await getOfflineVocabularyAudioCacheStats();
  return stats.totalBytes;
}

export async function clearOfflineVocabularyAudioCache(): Promise<void> {
  cancelOfflineVocabularyAudioDownloads();

  if (AUDIO_CACHE_DIRECTORY) {
    const directoryInfo = await FileSystem.getInfoAsync(AUDIO_CACHE_DIRECTORY);
    if (directoryInfo.exists) {
      const fileNames = await FileSystem.readDirectoryAsync(AUDIO_CACHE_DIRECTORY);
      await Promise.all(
        fileNames.map((fileName) =>
          FileSystem.deleteAsync(`${AUDIO_CACHE_DIRECTORY}/${fileName}`, {
            idempotent: true,
          })
        )
      );
    }
  }

  if (canUseOfflineAudioCaching()) {
    try {
      const db = await getDatabase();
      await db.execAsync(`
        DELETE FROM audio_urls;
        DELETE FROM index_metadata;
      `);
    } catch {
      // Ignore database cleanup errors and still clear progress state.
    }
  }

  emitProgressUpdate({
    inProgress: false,
    total: 0,
    completed: 0,
    lastError: null,
  });
}

export async function resolveOfflineVocabularyAudioUri(
  subjectId: number,
  audio: Pick<PronunciationAudio, "url"> | null | undefined
): Promise<string | null> {
  if (!canUseOfflineAudioCaching()) {
    return null;
  }

  const audioUrl = normalizeMaybeString(audio?.url);
  if (!audioUrl || !Number.isFinite(subjectId)) {
    return null;
  }

  const cacheFilename = cacheFilenameForAudio(subjectId, audioUrl);
  const cacheUri = cacheUriForFilename(cacheFilename);
  if (!cacheUri) {
    return null;
  }

  const exists = await fileExists(cacheUri);
  return exists ? cacheUri : null;
}

export async function getCachedOrDownloadVocabularyAudioUri(
  subjectId: number,
  audio: Pick<PronunciationAudio, "url"> | null | undefined
): Promise<string | null> {
  if (!canUseOfflineAudioCaching()) {
    return null;
  }

  const audioUrl = normalizeMaybeString(audio?.url);
  if (!audioUrl || !Number.isFinite(subjectId)) {
    return null;
  }

  const cacheFilename = cacheFilenameForAudio(subjectId, audioUrl);
  const cacheUri = cacheUriForFilename(cacheFilename);
  if (!cacheUri) {
    return null;
  }

  const cachedUri = await resolveOfflineVocabularyAudioUri(subjectId, audio);
  if (cachedUri) {
    return cachedUri;
  }

  const existingPromise = onDemandAudioCachePromises.get(cacheFilename);
  if (existingPromise) {
    return existingPromise;
  }

  const cachePromise = (async () => {
    try {
      await ensureCacheDirectory();

      const alreadyCached = await fileExists(cacheUri);
      if (alreadyCached) {
        return cacheUri;
      }

      await FileSystem.downloadAsync(audioUrl, cacheUri);
      return (await fileExists(cacheUri)) ? cacheUri : null;
    } catch {
      await FileSystem.deleteAsync(cacheUri, { idempotent: true }).catch(
        () => {}
      );
      return null;
    }
  })();

  onDemandAudioCachePromises.set(cacheFilename, cachePromise);

  try {
    return await cachePromise;
  } finally {
    if (onDemandAudioCachePromises.get(cacheFilename) === cachePromise) {
      onDemandAudioCachePromises.delete(cacheFilename);
    }
  }
}
