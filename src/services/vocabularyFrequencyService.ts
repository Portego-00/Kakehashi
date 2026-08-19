import * as SQLite from "expo-sqlite";
import {
  normalizeJLPTVocabularyExpression,
  normalizeJLPTVocabularyReading,
} from "../utils/jlptClassification";
import {
  type JitenDictionaryEntry,
  selectBestJitenFrequencyMatch,
} from "../utils/jitenFrequency";

const DATABASE_NAME = "vocabulary-frequency.db";
const JITEN_SEARCH_ENDPOINT = "https://api.jiten.moe/api/vocabulary/search";
const JITEN_SEARCH_PAGE_URL = "https://jiten.moe/search";
const FOUND_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const NOT_FOUND_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;

export interface VocabularyFrequencySubject {
  id: number;
  object: string;
  data: {
    characters?: string | null;
    readings?: {
      reading?: string | null;
      accepted_answer?: boolean;
    }[] | null;
  };
}

export interface VocabularyFrequencyResult {
  provider: "jiten";
  frequencyRank: number;
  wordId: number;
  readingIndex: number;
  matchedText: string;
  matchedReading: string | null;
  sourceUrl: string;
  fetchedAt: number;
  isStale: boolean;
}

export type VocabularyFrequencyCacheLookup =
  | {
      status: "found";
      result: VocabularyFrequencyResult;
    }
  | {
      status: "not_found";
      fetchedAt: number;
      isStale: boolean;
    }
  | {
      status: "missing";
    };

interface CachedFrequencyRow {
  cache_key: string;
  status: "found" | "not_found";
  frequency_rank: number | null;
  word_id: number | null;
  reading_index: number | null;
  matched_text: string | null;
  matched_reading: string | null;
  source_url: string;
  fetched_at: number;
}

interface JitenSearchResponse {
  results?: JitenDictionaryEntry[] | null;
  dictionaryResults?: JitenDictionaryEntry[] | null;
}

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  const openingPromise = (async () => {
    const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS vocabulary_frequency_cache (
        cache_key TEXT PRIMARY KEY NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('found', 'not_found')),
        frequency_rank INTEGER,
        word_id INTEGER,
        reading_index INTEGER,
        matched_text TEXT,
        matched_reading TEXT,
        source_url TEXT NOT NULL,
        fetched_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_vocabulary_frequency_fetched_at
        ON vocabulary_frequency_cache (fetched_at);
    `);
    return db;
  })();
  dbPromise = openingPromise;

  try {
    return await openingPromise;
  } catch (error) {
    if (dbPromise === openingPromise) {
      dbPromise = null;
    }
    throw error;
  }
}

function getSubjectReadings(subject: VocabularyFrequencySubject): string[] {
  if (!Array.isArray(subject.data.readings)) return [];

  return subject.data.readings
    .filter((reading) => reading.accepted_answer !== false)
    .map((reading) => reading.reading)
    .filter((reading): reading is string => typeof reading === "string")
    .map(normalizeJLPTVocabularyReading)
    .filter(Boolean);
}

function buildCacheKey(subject: VocabularyFrequencySubject): string | null {
  const expression = subject.data.characters;
  if (!expression) return null;

  const readings = [...new Set(getSubjectReadings(subject))].sort();
  return [
    subject.id,
    normalizeJLPTVocabularyExpression(expression),
    readings.join(","),
  ].join("|");
}

function rowToResult(row: CachedFrequencyRow, isStale: boolean): VocabularyFrequencyResult | null {
  if (
    row.status !== "found" ||
    !Number.isFinite(row.frequency_rank) ||
    !Number.isFinite(row.word_id) ||
    !Number.isFinite(row.reading_index) ||
    !row.matched_text
  ) {
    return null;
  }

  return {
    provider: "jiten",
    frequencyRank: Number(row.frequency_rank),
    wordId: Number(row.word_id),
    readingIndex: Number(row.reading_index),
    matchedText: row.matched_text,
    matchedReading: row.matched_reading,
    sourceUrl: row.source_url,
    fetchedAt: row.fetched_at,
    isStale,
  };
}

async function readCachedFrequency(cacheKey: string): Promise<CachedFrequencyRow | null> {
  const db = await getDatabase();
  return db.getFirstAsync<CachedFrequencyRow>(
    `SELECT cache_key, status, frequency_rank, word_id, reading_index,
            matched_text, matched_reading, source_url, fetched_at
       FROM vocabulary_frequency_cache
      WHERE cache_key = ?
      LIMIT 1`,
    cacheKey,
  );
}

export async function getCachedVocabularyFrequency(
  subject: VocabularyFrequencySubject,
): Promise<VocabularyFrequencyCacheLookup> {
  if (subject.object !== "vocabulary" && subject.object !== "kana_vocabulary") {
    return { status: "missing" };
  }

  const expression = subject.data.characters?.trim();
  const cacheKey = buildCacheKey(subject);
  if (!expression || !cacheKey) {
    return { status: "missing" };
  }

  const cachedRow = await readCachedFrequency(cacheKey);
  if (!cachedRow) {
    return { status: "missing" };
  }

  const cacheTtl =
    cachedRow.status === "found" ? FOUND_CACHE_TTL_MS : NOT_FOUND_CACHE_TTL_MS;
  const isStale = Date.now() - cachedRow.fetched_at > cacheTtl;

  if (cachedRow.status === "not_found") {
    return {
      status: "not_found",
      fetchedAt: cachedRow.fetched_at,
      isStale,
    };
  }

  const result = rowToResult(cachedRow, isStale);
  return result ? { status: "found", result } : { status: "missing" };
}

async function writeCachedFrequency(
  cacheKey: string,
  expression: string,
  match: ReturnType<typeof selectBestJitenFrequencyMatch>,
): Promise<void> {
  const db = await getDatabase();
  const sourceUrl = `${JITEN_SEARCH_PAGE_URL}?query=${encodeURIComponent(expression)}`;

  await db.runAsync(
    `INSERT INTO vocabulary_frequency_cache (
       cache_key, status, frequency_rank, word_id, reading_index,
       matched_text, matched_reading, source_url, fetched_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(cache_key) DO UPDATE SET
       status = excluded.status,
       frequency_rank = excluded.frequency_rank,
       word_id = excluded.word_id,
       reading_index = excluded.reading_index,
       matched_text = excluded.matched_text,
       matched_reading = excluded.matched_reading,
       source_url = excluded.source_url,
       fetched_at = excluded.fetched_at`,
    cacheKey,
    match ? "found" : "not_found",
    match?.frequencyRank ?? null,
    match?.wordId ?? null,
    match?.readingIndex ?? null,
    match?.text ?? null,
    match?.reading ?? null,
    sourceUrl,
    Date.now(),
  );
}

function createAbortError(): Error {
  const error = new Error("Vocabulary frequency request was cancelled");
  error.name = "AbortError";
  return error;
}

async function fetchJitenFrequency(
  expression: string,
  readings: readonly string[],
  externalSignal?: AbortSignal,
) {
  if (externalSignal?.aborted) throw createAbortError();

  const controller = new AbortController();
  const abortFromExternalSignal = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromExternalSignal, { once: true });
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const query = new URLSearchParams({
      query: expression,
      limit: "50",
      offset: "0",
    });
    const response = await fetch(`${JITEN_SEARCH_ENDPOINT}?${query.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Jiten frequency request failed with HTTP ${response.status}`);
    }

    const data = (await response.json()) as JitenSearchResponse;
    const entries = [
      ...(Array.isArray(data.results) ? data.results : []),
      ...(Array.isArray(data.dictionaryResults) ? data.dictionaryResults : []),
    ];
    return selectBestJitenFrequencyMatch(expression, readings, entries);
  } catch (error) {
    if (controller.signal.aborted) throw createAbortError();
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
  }
}

export async function getVocabularyFrequency(
  subject: VocabularyFrequencySubject,
  options: { signal?: AbortSignal; forceRefresh?: boolean } = {},
): Promise<VocabularyFrequencyResult | null> {
  if (subject.object !== "vocabulary" && subject.object !== "kana_vocabulary") {
    return null;
  }

  const expression = subject.data.characters?.trim();
  const cacheKey = buildCacheKey(subject);
  if (!expression || !cacheKey) return null;

  const cachedRow = await readCachedFrequency(cacheKey).catch(() => null);
  const cacheTtl =
    cachedRow?.status === "found" ? FOUND_CACHE_TTL_MS : NOT_FOUND_CACHE_TTL_MS;
  const isFresh =
    cachedRow !== null && Date.now() - cachedRow.fetched_at <= cacheTtl;

  if (!options.forceRefresh && cachedRow && isFresh) {
    return rowToResult(cachedRow, false);
  }

  try {
    const match = await fetchJitenFrequency(
      expression,
      getSubjectReadings(subject),
      options.signal,
    );
    await writeCachedFrequency(cacheKey, expression, match).catch((error) => {
      console.warn("[Vocabulary Frequency] Failed to update cache:", error);
    });

    if (!match) return null;

    return {
      provider: "jiten",
      frequencyRank: match.frequencyRank,
      wordId: match.wordId,
      readingIndex: match.readingIndex,
      matchedText: match.text,
      matchedReading: match.reading,
      sourceUrl: `${JITEN_SEARCH_PAGE_URL}?query=${encodeURIComponent(expression)}`,
      fetchedAt: Date.now(),
      isStale: false,
    };
  } catch (error) {
    const staleResult = cachedRow ? rowToResult(cachedRow, true) : null;
    if (staleResult) return staleResult;
    throw error;
  }
}
