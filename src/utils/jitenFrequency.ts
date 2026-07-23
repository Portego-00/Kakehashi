import {
  normalizeJLPTVocabularyExpression,
  normalizeJLPTVocabularyReading,
} from "./jlptClassification";

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

export function extractJitenRubyReading(
  rubyText: string | null | undefined,
): string | null {
  if (!rubyText) return null;

  const reading = rubyText
    .replace(/([^\s\[]+)\[([^\]]+)\]/g, "$2")
    .replace(/\s+/g, "")
    .trim();

  return reading ? normalizeJLPTVocabularyReading(reading) : null;
}

export function selectBestJitenFrequencyMatch(
  expression: string,
  readings: readonly string[],
  entries: readonly JitenDictionaryEntry[],
): JitenFrequencyMatch | null {
  const normalizedExpression = normalizeJLPTVocabularyExpression(expression);
  const normalizedReadings = new Set(
    readings.map(normalizeJLPTVocabularyReading).filter(Boolean),
  );

  // Kana-only WaniKani subjects do not always carry a readings array.
  if (normalizedReadings.size === 0) {
    normalizedReadings.add(normalizeJLPTVocabularyReading(expression));
  }

  const candidates = entries
    .map((entry) => {
      const text = typeof entry.text === "string" ? entry.text : "";
      const primaryKanjiText =
        typeof entry.primaryKanjiText === "string" ? entry.primaryKanjiText : "";
      const normalizedText = normalizeJLPTVocabularyExpression(text);
      const normalizedPrimary = normalizeJLPTVocabularyExpression(primaryKanjiText);
      const frequencyRank = Number(entry.frequencyRank);
      const wordId = Number(entry.wordId);
      const readingIndex = Number(entry.readingIndex);

      if (
        (normalizedText !== normalizedExpression &&
          normalizedPrimary !== normalizedExpression) ||
        !Number.isInteger(wordId) ||
        wordId <= 0 ||
        !Number.isInteger(readingIndex) ||
        readingIndex < 0 ||
        !Number.isFinite(frequencyRank) ||
        frequencyRank <= 0
      ) {
        return null;
      }

      const reading = extractJitenRubyReading(entry.rubyText);
      const readingMatches = reading ? normalizedReadings.has(reading) : false;
      const score =
        (readingMatches ? 100 : 0) +
        (normalizedText === normalizedExpression ? 20 : 0) +
        (normalizedPrimary === normalizedExpression ? 10 : 0);

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
    (left, right) =>
      right.score - left.score ||
      left.match.frequencyRank - right.match.frequencyRank ||
      left.match.wordId - right.match.wordId,
  );

  return eligibleCandidates[0]?.match ?? null;
}
