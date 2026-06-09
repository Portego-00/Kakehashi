import * as wanakana from "wanakana";

const CANDIDATE_EMPTY_SCORE = -1;

export interface SearchableSubjectLike {
  id: number;
  object: string;
  data: {
    level: number;
    characters: string | null;
    meanings: {
      meaning: string;
      primary?: boolean | null;
    }[];
    readings?:
      | {
          reading: string;
          primary?: boolean | null;
        }[]
      | null;
  };
}

export interface RankedSubject<T extends SearchableSubjectLike> {
  subject: T;
  score: number;
}

interface QueryVariant {
  raw: string;
  normalized: string;
}

interface SearchQueryVariants {
  primary: QueryVariant;
  kana: QueryVariant | null;
  romaji: QueryVariant | null;
  hasLatin: boolean;
}

export function getSubjectTypePriority(type: string): number {
  switch (type) {
    case "radical":
      return 0;
    case "kanji":
      return 1;
    case "vocabulary":
      return 2;
    case "kana_vocabulary":
      return 3;
    default:
      return 4;
  }
}

export function sortSubjectsByLevelAndType<T extends SearchableSubjectLike>(
  subjects: T[]
): T[] {
  return [...subjects].sort((a, b) => {
    if (a.data.level !== b.data.level) {
      return a.data.level - b.data.level;
    }

    const typeA = getSubjectTypePriority(a.object);
    const typeB = getSubjectTypePriority(b.object);
    if (typeA !== typeB) {
      return typeA - typeB;
    }

    return a.id - b.id;
  });
}

export function getDefaultSubjectSearchConfig(queryLength: number): {
  minScore: number;
  maxResults: number;
} {
  if (queryLength <= 2) {
    return { minScore: 980, maxResults: 40 };
  }

  if (queryLength <= 4) {
    return { minScore: 760, maxResults: 100 };
  }

  return { minScore: 620, maxResults: 200 };
}

function normalizeForFuzzyMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/gi, "");
}

function convertToKana(input: string): string {
  const converted = wanakana.toHiragana(input, { IMEMode: false });
  return converted.replace(/[^\u3040-\u309F\u30A0-\u30FF\u3000-\u303F]/g, "");
}

function createQueryVariant(value: string): QueryVariant | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return {
    raw: trimmed.toLowerCase(),
    normalized: normalizeForFuzzyMatch(trimmed),
  };
}

function isSubsequence(query: string, candidate: string): boolean {
  if (!query || query.length > candidate.length) {
    return false;
  }

  let queryIndex = 0;
  for (
    let candidateIndex = 0;
    candidateIndex < candidate.length && queryIndex < query.length;
    candidateIndex++
  ) {
    if (candidate[candidateIndex] === query[queryIndex]) {
      queryIndex += 1;
    }
  }

  return queryIndex === query.length;
}

function getMaxAllowedDistance(queryLength: number, candidateLength: number) {
  const maxLength = Math.max(queryLength, candidateLength);
  if (maxLength <= 4) {
    return 0;
  }
  if (maxLength <= 8) {
    return 1;
  }
  if (maxLength <= 12) {
    return 2;
  }
  return 3;
}

function boundedLevenshteinDistance(
  source: string,
  target: string,
  maxDistance: number
): number {
  if (Math.abs(source.length - target.length) > maxDistance) {
    return maxDistance + 1;
  }

  let previousRow = new Array<number>(target.length + 1);
  let currentRow = new Array<number>(target.length + 1);

  for (let column = 0; column <= target.length; column++) {
    previousRow[column] = column;
  }

  for (let row = 1; row <= source.length; row++) {
    currentRow[0] = row;
    let minInRow = currentRow[0];

    for (let column = 1; column <= target.length; column++) {
      const substitutionCost =
        source[row - 1] === target[column - 1] ? 0 : 1;
      currentRow[column] = Math.min(
        previousRow[column] + 1,
        currentRow[column - 1] + 1,
        previousRow[column - 1] + substitutionCost
      );

      if (currentRow[column] < minInRow) {
        minInRow = currentRow[column];
      }
    }

    if (minInRow > maxDistance) {
      return maxDistance + 1;
    }

    [previousRow, currentRow] = [currentRow, previousRow];
  }

  return previousRow[target.length];
}

function scoreVariantAgainstCandidate(
  candidate: string,
  variant: QueryVariant,
  allowTypos: boolean
): number {
  if (!candidate || (!variant.raw && !variant.normalized)) {
    return CANDIDATE_EMPTY_SCORE;
  }

  const candidateLower = candidate.toLowerCase();
  const candidateNormalized = normalizeForFuzzyMatch(candidate);
  let bestScore = CANDIDATE_EMPTY_SCORE;

  if (variant.raw.length > 0) {
    if (candidateLower === variant.raw) {
      bestScore = Math.max(bestScore, 1200);
    }

    if (candidateLower.startsWith(variant.raw)) {
      const extraCharacters = candidateLower.length - variant.raw.length;
      bestScore = Math.max(bestScore, 1060 - Math.min(120, extraCharacters));
    }

    const rawIndex = candidateLower.indexOf(variant.raw);
    if (rawIndex >= 0) {
      bestScore = Math.max(bestScore, 920 - Math.min(220, rawIndex * 12));
    }
  }

  if (variant.normalized.length > 0 && candidateNormalized.length > 0) {
    if (candidateNormalized === variant.normalized) {
      bestScore = Math.max(bestScore, 1180);
    }

    if (candidateNormalized.startsWith(variant.normalized)) {
      const extraCharacters =
        candidateNormalized.length - variant.normalized.length;
      bestScore = Math.max(bestScore, 1020 - Math.min(160, extraCharacters));
    }

    const normalizedIndex = candidateNormalized.indexOf(variant.normalized);
    if (normalizedIndex >= 0) {
      bestScore = Math.max(
        bestScore,
        880 - Math.min(220, normalizedIndex * 10)
      );
    }

    if (
      variant.normalized.length >= 3 &&
      isSubsequence(variant.normalized, candidateNormalized)
    ) {
      const extraCharacters =
        candidateNormalized.length - variant.normalized.length;
      bestScore = Math.max(
        bestScore,
        760 - Math.min(180, extraCharacters * 4)
      );
    }

    if (
      allowTypos &&
      variant.normalized.length >= 4 &&
      candidateNormalized.length >= 4
    ) {
      const maxDistance = getMaxAllowedDistance(
        variant.normalized.length,
        candidateNormalized.length
      );

      if (maxDistance > 0) {
        const distance = boundedLevenshteinDistance(
          variant.normalized,
          candidateNormalized,
          maxDistance
        );

        if (distance <= maxDistance) {
          const lengthPenalty =
            Math.abs(candidateNormalized.length - variant.normalized.length) *
            8;
          const typoScore =
            700 - distance * 90 - Math.min(160, lengthPenalty);
          bestScore = Math.max(bestScore, typoScore);
        }
      }
    }
  }

  return bestScore;
}

function scoreCandidateWithVariants(
  candidate: string,
  variants: (QueryVariant | null)[],
  allowTypos: boolean
): number {
  let bestScore = CANDIDATE_EMPTY_SCORE;

  for (const variant of variants) {
    if (!variant) continue;
    const score = scoreVariantAgainstCandidate(candidate, variant, allowTypos);
    if (score > bestScore) {
      bestScore = score;
    }
  }

  return bestScore;
}

function createSearchQueryVariants(query: string): SearchQueryVariants {
  const primary = createQueryVariant(query) ?? { raw: "", normalized: "" };
  const kanaQuery = convertToKana(query);
  const rawKanaVariant = createQueryVariant(kanaQuery);
  const romaji = createQueryVariant(wanakana.toRomaji(query));
  const queryHasKana = /[\u3040-\u30ff]/.test(query);
  const kanaRoundTripRomaji = normalizeForFuzzyMatch(
    wanakana.toRomaji(kanaQuery)
  );
  const looksLikeRomaji =
    primary.normalized.length > 0 &&
    primary.normalized === kanaRoundTripRomaji;

  return {
    primary,
    kana: queryHasKana || looksLikeRomaji ? rawKanaVariant : null,
    romaji,
    hasLatin: /[a-z]/i.test(query),
  };
}

function getSubjectMatchScore(
  subject: SearchableSubjectLike,
  queryVariants: SearchQueryVariants
): number {
  let bestScore = CANDIDATE_EMPTY_SCORE;

  if (subject.data.characters) {
    const charactersScore = scoreCandidateWithVariants(
      subject.data.characters,
      [queryVariants.primary, queryVariants.kana],
      false
    );

    if (charactersScore >= 0) {
      bestScore = Math.max(bestScore, charactersScore + 260);
    }
  }

  for (const meaning of subject.data.meanings) {
    const meaningScore = scoreCandidateWithVariants(
      meaning.meaning,
      [queryVariants.primary],
      true
    );

    if (meaningScore >= 0) {
      bestScore = Math.max(
        bestScore,
        meaningScore + 220 + (meaning.primary ? 35 : 0)
      );
    }
  }

  if (subject.data.readings) {
    for (const reading of subject.data.readings) {
      let readingScore = scoreCandidateWithVariants(
        reading.reading,
        [queryVariants.primary, queryVariants.kana],
        false
      );

      if (queryVariants.hasLatin) {
        const romajiReading = wanakana.toRomaji(reading.reading);
        const romajiReadingScore = scoreCandidateWithVariants(
          romajiReading,
          [queryVariants.primary, queryVariants.romaji],
          true
        );

        if (romajiReadingScore >= 0) {
          readingScore = Math.max(readingScore, romajiReadingScore - 30);
        }
      }

      if (readingScore >= 0) {
        bestScore = Math.max(
          bestScore,
          readingScore + 240 + (reading.primary ? 25 : 0)
        );
      }
    }
  }

  return bestScore;
}

export function rankSubjectsByQuery<T extends SearchableSubjectLike>(
  subjects: T[],
  query: string,
  options: { minScore?: number } = {}
): RankedSubject<T>[] {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return sortSubjectsByLevelAndType(subjects).map((subject) => ({
      subject,
      score: 0,
    }));
  }

  const queryVariants = createSearchQueryVariants(trimmedQuery);
  const minScore =
    options.minScore ??
    getDefaultSubjectSearchConfig(trimmedQuery.length).minScore;
  const scoredMatches: RankedSubject<T>[] = [];

  for (const subject of subjects) {
    const score = getSubjectMatchScore(subject, queryVariants);
    if (score >= minScore) {
      scoredMatches.push({ subject, score });
    }
  }

  scoredMatches.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }

    if (a.subject.data.level !== b.subject.data.level) {
      return a.subject.data.level - b.subject.data.level;
    }

    const typeA = getSubjectTypePriority(a.subject.object);
    const typeB = getSubjectTypePriority(b.subject.object);
    if (typeA !== typeB) {
      return typeA - typeB;
    }

    return a.subject.id - b.subject.id;
  });

  return scoredMatches;
}
