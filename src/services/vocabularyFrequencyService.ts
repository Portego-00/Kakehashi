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
const DEFAULT_RATE_LIMIT_RETRY_MS = 60_000;
const JITEN_MAX_IN_FLIGHT_REQUESTS = 2;
const JITEN_REQUEST_START_INTERVAL_MS = 250;

export class VocabularyFrequencyRequestError extends Error {
  readonly kind: "http" | "invalid_response" | "rate_limit" | "timeout";
  readonly status: number | null;
  readonly retryAfterMs: number | null;

  constructor(
    kind: "http" | "invalid_response" | "rate_limit" | "timeout",
    status: number | null,
    retryAfterMs: number | null,
  ) {
    super(
      kind === "invalid_response"
        ? "Jiten frequency request returned an unexpected response"
        : status === null
          ? "Jiten frequency request timed out"
          : `Jiten frequency request failed with HTTP ${status}`,
    );
    this.name = "VocabularyFrequencyRequestError";
    this.kind = kind;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export interface VocabularyFrequencySubject {
  id: number;
  object: string;
  data: {
    characters?: string | null;
    readings?:
      | {
          reading?: string | null;
          accepted_answer?: boolean;
        }[]
      | null;
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
let jitenRequestsBlockedUntil = 0;
let jitenRequestsInFlight = 0;
let lastJitenRequestStartedAt = 0;
let jitenQueueTimer: ReturnType<typeof setTimeout> | null = null;

interface QueuedJitenRequest {
  signal?: AbortSignal;
  resolve: (release: () => void) => void;
  reject: (error: Error) => void;
  handleAbort: () => void;
}

const queuedJitenRequests: QueuedJitenRequest[] = [];

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

function rowToResult(
  row: CachedFrequencyRow,
  isStale: boolean,
): VocabularyFrequencyResult | null {
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

async function readCachedFrequency(
  cacheKey: string,
): Promise<CachedFrequencyRow | null> {
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

export function getJitenRequestBlockDeadline(): number {
  return jitenRequestsBlockedUntil > Date.now()
    ? jitenRequestsBlockedUntil
    : 0;
}

function drainJitenRequestQueue(): void {
  if (jitenQueueTimer !== null) {
    clearTimeout(jitenQueueTimer);
    jitenQueueTimer = null;
  }

  while (queuedJitenRequests[0]?.signal?.aborted) {
    const abortedRequest = queuedJitenRequests.shift();
    if (!abortedRequest) break;
    abortedRequest.signal?.removeEventListener(
      "abort",
      abortedRequest.handleAbort,
    );
    abortedRequest.reject(createAbortError());
  }

  if (
    queuedJitenRequests.length === 0 ||
    jitenRequestsInFlight >= JITEN_MAX_IN_FLIGHT_REQUESTS
  ) {
    return;
  }

  const now = Date.now();
  const nextRequestStartAt = Math.max(
    jitenRequestsBlockedUntil,
    lastJitenRequestStartedAt + JITEN_REQUEST_START_INTERVAL_MS,
  );
  const waitMs = nextRequestStartAt - now;
  if (waitMs > 0) {
    jitenQueueTimer = setTimeout(() => {
      jitenQueueTimer = null;
      drainJitenRequestQueue();
    }, waitMs);
    return;
  }

  const queuedRequest = queuedJitenRequests.shift();
  if (!queuedRequest) return;

  queuedRequest.signal?.removeEventListener(
    "abort",
    queuedRequest.handleAbort,
  );
  jitenRequestsInFlight += 1;
  lastJitenRequestStartedAt = now;

  let didRelease = false;
  queuedRequest.resolve(() => {
    if (didRelease) return;
    didRelease = true;
    jitenRequestsInFlight = Math.max(0, jitenRequestsInFlight - 1);
    drainJitenRequestQueue();
  });

  drainJitenRequestQueue();
}

function acquireJitenRequestSlot(signal?: AbortSignal): Promise<() => void> {
  if (signal?.aborted) {
    return Promise.reject(createAbortError());
  }

  return new Promise((resolve, reject) => {
    let queuedRequest: QueuedJitenRequest;
    const handleAbort = () => {
      const requestIndex = queuedJitenRequests.indexOf(queuedRequest);
      if (requestIndex < 0) return;

      queuedJitenRequests.splice(requestIndex, 1);
      signal?.removeEventListener("abort", handleAbort);
      reject(createAbortError());
      drainJitenRequestQueue();
    };
    queuedRequest = {
      signal,
      resolve,
      reject,
      handleAbort,
    };

    queuedJitenRequests.push(queuedRequest);
    signal?.addEventListener("abort", handleAbort, { once: true });

    if (signal?.aborted) {
      handleAbort();
      return;
    }
    drainJitenRequestQueue();
  });
}

function blockJitenRequestsFor(retryAfterMs: number): void {
  jitenRequestsBlockedUntil = Math.max(
    jitenRequestsBlockedUntil,
    Date.now() + Math.max(0, retryAfterMs),
  );
  drainJitenRequestQueue();
}

function parseRetryAfterMs(value: string | null): number | null {
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1_000);
  }

  const retryAt = Date.parse(value);
  if (!Number.isFinite(retryAt)) return null;

  return Math.max(0, retryAt - Date.now());
}

async function fetchJitenFrequency(
  expression: string,
  readings: readonly string[],
  externalSignal?: AbortSignal,
) {
  if (externalSignal?.aborted) throw createAbortError();
  const releaseRequestSlot = await acquireJitenRequestSlot(externalSignal);
  if (externalSignal?.aborted) {
    releaseRequestSlot();
    throw createAbortError();
  }

  const controller = new AbortController();
  let didTimeout = false;
  const abortFromExternalSignal = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromExternalSignal, {
    once: true,
  });
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const query = new URLSearchParams({
      query: expression,
      limit: "50",
      offset: "0",
    });
    const response = await fetch(
      `${JITEN_SEARCH_ENDPOINT}?${query.toString()}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      const parsedRetryAfter = parseRetryAfterMs(
        response.headers.get("Retry-After"),
      );
      const retryAfterMs =
        response.status === 429
          ? (parsedRetryAfter ?? DEFAULT_RATE_LIMIT_RETRY_MS)
          : parsedRetryAfter;
      if (retryAfterMs !== null) {
        blockJitenRequestsFor(retryAfterMs);
      }
      throw new VocabularyFrequencyRequestError(
        response.status === 429 ? "rate_limit" : "http",
        response.status,
        retryAfterMs,
      );
    }

    const rawData = (await response.json()) as unknown;
    const isResponseObject =
      typeof rawData === "object" && rawData !== null;
    const hasResults =
      isResponseObject &&
      Object.prototype.hasOwnProperty.call(rawData, "results");
    const hasDictionaryResults =
      isResponseObject &&
      Object.prototype.hasOwnProperty.call(rawData, "dictionaryResults");
    const data = rawData as JitenSearchResponse;
    if (
      (!hasResults && !hasDictionaryResults) ||
      (hasResults && data.results !== null && !Array.isArray(data.results)) ||
      (hasDictionaryResults &&
        data.dictionaryResults !== null &&
        !Array.isArray(data.dictionaryResults))
    ) {
      throw new VocabularyFrequencyRequestError(
        "invalid_response",
        response.status,
        null,
      );
    }
    const entries = [
      ...(Array.isArray(data.results) ? data.results : []),
      ...(Array.isArray(data.dictionaryResults) ? data.dictionaryResults : []),
    ];
    return selectBestJitenFrequencyMatch(expression, readings, entries);
  } catch (error) {
    if (externalSignal?.aborted) throw createAbortError();
    if (didTimeout) {
      blockJitenRequestsFor(DEFAULT_RATE_LIMIT_RETRY_MS);
      throw new VocabularyFrequencyRequestError(
        "timeout",
        null,
        DEFAULT_RATE_LIMIT_RETRY_MS,
      );
    }
    if (controller.signal.aborted) throw createAbortError();
    throw error;
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", abortFromExternalSignal);
    releaseRequestSlot();
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
