import { toHiragana } from "wanakana";

export const JITEN_VOCABULARY_SEARCH_ENDPOINT = "https://api.jiten.moe/api/vocabulary/search";
export const JITEN_SEARCH_PAGE_URL = "https://jiten.moe/search";

export interface JitenDictionaryEntry {
  wordId?: number | null;
  readingIndex?: number | null;
  text?: string | null;
  rubyText?: string | null;
  primaryKanjiText?: string | null;
  frequencyRank?: number | null;
}

export interface JitenFrequencyMatch {
  wordId: number;
  readingIndex: number;
  text: string;
  reading: string | null;
  frequencyRank: number;
}

function normalizeMarkerCharacters(value: string) {
  return value.replace(/[~〜～]/g, "");
}

export function normalizeVocabularyExpression(value: string) {
  return normalizeMarkerCharacters(value.normalize("NFKC"))
    .replace(/\s+/g, "")
    .trim();
}

export function normalizeVocabularyReading(value: string) {
  const normalized = normalizeMarkerCharacters(value.normalize("NFKC"))
    .replace(/\s+/g, "")
    .trim();
  return toHiragana(normalized);
}

export function extractJitenRubyReading(rubyText: string | null | undefined): string | null {
  if (!rubyText) return null;

  const reading = rubyText
    .replace(/([^\s\[]+)\[([^\]]+)\]/g, "$2")
    .replace(/\s+/g, "")
    .trim();

  return reading ? normalizeVocabularyReading(reading) : null;
}

export function selectBestJitenFrequencyMatch(
  expression: string,
  readings: readonly string[],
  entries: readonly JitenDictionaryEntry[],
): JitenFrequencyMatch | null {
  const normalizedExpression = normalizeVocabularyExpression(expression);
  if (!normalizedExpression) return null;

  const normalizedReadings = new Set(
    readings.map(normalizeVocabularyReading).filter(Boolean),
  );

  // Kana-only WaniKani subjects do not always carry a readings array.
  if (normalizedReadings.size === 0) {
    normalizedReadings.add(normalizeVocabularyReading(expression));
  }

  const candidates = entries
    .map((entry) => {
      const text = typeof entry.text === "string" ? entry.text : "";
      const primaryKanjiText = typeof entry.primaryKanjiText === "string" ? entry.primaryKanjiText : "";
      const normalizedText = normalizeVocabularyExpression(text);
      const normalizedPrimary = normalizeVocabularyExpression(primaryKanjiText);
      const frequencyRank = Number(entry.frequencyRank);
      const wordId = Number(entry.wordId);
      const readingIndex = Number(entry.readingIndex);

      if (
        (normalizedText !== normalizedExpression && normalizedPrimary !== normalizedExpression)
        || !Number.isInteger(wordId)
        || wordId <= 0
        || !Number.isInteger(readingIndex)
        || readingIndex < 0
        || !Number.isFinite(frequencyRank)
        || frequencyRank <= 0
      ) {
        return null;
      }

      const reading = extractJitenRubyReading(entry.rubyText);
      const readingMatches = reading ? normalizedReadings.has(reading) : false;
      const score = (readingMatches ? 100 : 0)
        + (normalizedText === normalizedExpression ? 20 : 0)
        + (normalizedPrimary === normalizedExpression ? 10 : 0);

      return {
        match: {
          wordId,
          readingIndex,
          text: text || primaryKanjiText || expression,
          reading,
          frequencyRank: Math.trunc(frequencyRank),
        } satisfies JitenFrequencyMatch,
        score,
        readingMatches,
      };
    })
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

  if (candidates.length === 0) return null;

  const hasReadingMatch = candidates.some((candidate) => candidate.readingMatches);
  const eligibleCandidates = hasReadingMatch
    ? candidates.filter((candidate) => candidate.readingMatches)
    : candidates;

  eligibleCandidates.sort(
    (left, right) => right.score - left.score
      || left.match.frequencyRank - right.match.frequencyRank
      || left.match.wordId - right.match.wordId,
  );

  return eligibleCandidates[0]?.match ?? null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJitenSearchEntries(payload: unknown): JitenDictionaryEntry[] | null {
  if (!isRecord(payload)) return null;

  const hasResults = Object.prototype.hasOwnProperty.call(payload, "results");
  const hasDictionaryResults = Object.prototype.hasOwnProperty.call(payload, "dictionaryResults");
  if (!hasResults && !hasDictionaryResults) return null;

  if (hasResults && payload.results !== null && !Array.isArray(payload.results)) return null;
  if (hasDictionaryResults && payload.dictionaryResults !== null && !Array.isArray(payload.dictionaryResults)) return null;

  return [
    ...(Array.isArray(payload.results) ? payload.results : []),
    ...(Array.isArray(payload.dictionaryResults) ? payload.dictionaryResults : []),
  ].filter(isRecord) as JitenDictionaryEntry[];
}

export function createJitenVocabularySearchUrl(expression: string) {
  const url = new URL(JITEN_VOCABULARY_SEARCH_ENDPOINT);
  url.searchParams.set("query", expression);
  url.searchParams.set("limit", "50");
  url.searchParams.set("offset", "0");
  return url.toString();
}
