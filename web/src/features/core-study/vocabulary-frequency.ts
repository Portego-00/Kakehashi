import {
  normalizeVocabularyExpression,
  normalizeVocabularyReading,
} from "./jiten-frequency";

export const VOCABULARY_FREQUENCY_API_PATH = "/api/study/vocabulary-frequency";
// Keep the mobile app's long-lived found-result behavior without exceeding the
// browser's signed 32-bit timer limit (about 24.85 days).
export const VOCABULARY_FREQUENCY_STALE_TIME_MS = 24 * 24 * 60 * 60 * 1_000;
export const VOCABULARY_FREQUENCY_FOUND_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
export const VOCABULARY_FREQUENCY_NOT_FOUND_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1_000;
const VOCABULARY_FREQUENCY_CACHE_PREFIX = "kakehashi-web:vocabulary-frequency:v1:";

export interface VocabularyFrequencySubject {
  id: number;
  object: string;
  data: {
    characters?: string | null;
    readings?: readonly {
      reading?: string | null;
      accepted_answer?: boolean;
    }[] | null;
  };
}

export interface VocabularyFrequencyRequest {
  expression: string;
  readings: string[];
}

export interface VocabularyFrequencyResult {
  provider: "jiten";
  frequencyRank: number;
  wordId: number;
  readingIndex: number;
  matchedText: string;
  matchedReading: string | null;
  sourceUrl: string;
}

interface VocabularyFrequencyCacheRow {
  fetchedAt: number;
  result: VocabularyFrequencyResult | null;
}

export class VocabularyFrequencyApiError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;

  constructor(message: string, status: number, retryAfterMs: number | null) {
    super(message);
    this.name = "VocabularyFrequencyApiError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export function vocabularyFrequencyRequestForSubject(
  subject: VocabularyFrequencySubject,
): VocabularyFrequencyRequest | null {
  if (subject.object !== "vocabulary" && subject.object !== "kana_vocabulary") return null;

  const expression = subject.data.characters?.trim();
  if (!expression) return null;

  const readings = Array.isArray(subject.data.readings)
    ? subject.data.readings
      .filter((reading) => reading.accepted_answer !== false)
      .map((reading) => typeof reading.reading === "string" ? normalizeVocabularyReading(reading.reading) : "")
      .filter(Boolean)
    : [];

  return {
    expression,
    readings: [...new Set(readings)].sort(),
  };
}

export function vocabularyFrequencyQueryKey(subject: VocabularyFrequencySubject) {
  const request = vocabularyFrequencyRequestForSubject(subject);
  return [
    "vocabulary-frequency",
    subject.id,
    request ? normalizeVocabularyExpression(request.expression) : "",
    request?.readings.join(",") ?? "",
  ] as const;
}

function parseRetryAfterMs(value: string | null) {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds * 1_000);
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVocabularyFrequencyResult(value: unknown): value is VocabularyFrequencyResult {
  if (!isRecord(value)) return false;
  return value.provider === "jiten"
    && Number.isInteger(value.frequencyRank)
    && Number(value.frequencyRank) > 0
    && Number.isInteger(value.wordId)
    && Number(value.wordId) > 0
    && Number.isInteger(value.readingIndex)
    && Number(value.readingIndex) >= 0
    && typeof value.matchedText === "string"
    && value.matchedText.length > 0
    && (value.matchedReading === null || typeof value.matchedReading === "string")
    && typeof value.sourceUrl === "string"
    && value.sourceUrl.startsWith("https://jiten.moe/");
}

function browserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function vocabularyFrequencyCacheKey(subject: VocabularyFrequencySubject, request: VocabularyFrequencyRequest) {
  return `${VOCABULARY_FREQUENCY_CACHE_PREFIX}${subject.id}:${encodeURIComponent(normalizeVocabularyExpression(request.expression))}:${encodeURIComponent(request.readings.join(","))}`;
}

function readCachedVocabularyFrequency(subject: VocabularyFrequencySubject, request: VocabularyFrequencyRequest): VocabularyFrequencyCacheRow | null {
  const storage = browserStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(vocabularyFrequencyCacheKey(subject, request));
    if (!raw) return null;
    const row = JSON.parse(raw) as Partial<VocabularyFrequencyCacheRow>;
    if (!Number.isFinite(row.fetchedAt) || Number(row.fetchedAt) <= 0 || (row.result !== null && !isVocabularyFrequencyResult(row.result))) {
      storage.removeItem(vocabularyFrequencyCacheKey(subject, request));
      return null;
    }
    return { fetchedAt: Number(row.fetchedAt), result: row.result ?? null };
  } catch {
    return null;
  }
}

function writeCachedVocabularyFrequency(subject: VocabularyFrequencySubject, request: VocabularyFrequencyRequest, result: VocabularyFrequencyResult | null) {
  const storage = browserStorage();
  if (!storage) return;
  try {
    storage.setItem(vocabularyFrequencyCacheKey(subject, request), JSON.stringify({ fetchedAt: Date.now(), result } satisfies VocabularyFrequencyCacheRow));
  } catch {
    // Frequency lookup still succeeds when browser storage is unavailable or full.
  }
}

async function readResponsePayload(response: Response) {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

export async function fetchVocabularyFrequency(
  subject: VocabularyFrequencySubject,
  signal?: AbortSignal,
): Promise<VocabularyFrequencyResult | null> {
  const request = vocabularyFrequencyRequestForSubject(subject);
  if (!request) return null;

  const cached = readCachedVocabularyFrequency(subject, request);
  const cacheTtl = cached?.result ? VOCABULARY_FREQUENCY_FOUND_CACHE_TTL_MS : VOCABULARY_FREQUENCY_NOT_FOUND_CACHE_TTL_MS;
  if (cached && Date.now() - cached.fetchedAt <= cacheTtl) return cached.result;

  try {
    const response = await fetch(VOCABULARY_FREQUENCY_API_PATH, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(request),
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    const payload = await readResponsePayload(response);

    if (!response.ok) {
      const message = isRecord(payload) && typeof payload.error === "string"
        ? payload.error
        : `Vocabulary frequency lookup failed with HTTP ${response.status}.`;
      throw new VocabularyFrequencyApiError(
        message,
        response.status,
        parseRetryAfterMs(response.headers.get("Retry-After")),
      );
    }

    if (!isRecord(payload) || !("result" in payload)) {
      throw new VocabularyFrequencyApiError("Vocabulary frequency lookup returned an unexpected response.", 502, null);
    }
    if (payload.result === null) {
      writeCachedVocabularyFrequency(subject, request, null);
      return null;
    }
    if (!isVocabularyFrequencyResult(payload.result)) {
      throw new VocabularyFrequencyApiError("Vocabulary frequency lookup returned an unexpected result.", 502, null);
    }
    writeCachedVocabularyFrequency(subject, request, payload.result);
    return payload.result;
  } catch (error) {
    if (cached) return cached.result;
    throw error;
  }
}
