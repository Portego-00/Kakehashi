// Lightweight fuzzy text matching utilities used by features that need to
// rank items in-memory based on a free-text query. The scoring rewards exact
// matches first, then prefixes, substrings, subsequences, and finally
// typo-tolerant matches via a bounded Levenshtein distance.

const CANDIDATE_EMPTY_SCORE = -1;

export interface FuzzyMatchOptions {
  /** Skip results whose best score is below this threshold. */
  minScore?: number;
  /** Allow Levenshtein-based typo tolerance for longer queries. */
  allowTypos?: boolean;
}

export interface FuzzyRanked<T> {
  item: T;
  score: number;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactNormalize(value: string): string {
  return normalize(value).replace(/[^a-z0-9]/g, "");
}

interface QueryVariant {
  raw: string;
  compact: string;
}

function buildVariant(query: string): QueryVariant {
  const raw = normalize(query);
  return {
    raw,
    compact: compactNormalize(raw),
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
  if (maxLength <= 4) return 0;
  if (maxLength <= 8) return 1;
  if (maxLength <= 12) return 2;
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

function scoreCandidate(
  candidate: string,
  variant: QueryVariant,
  allowTypos: boolean
): number {
  if (!candidate) return CANDIDATE_EMPTY_SCORE;

  const candidateNormalized = normalize(candidate);
  const candidateCompact = compactNormalize(candidate);
  let bestScore = CANDIDATE_EMPTY_SCORE;

  if (variant.raw.length > 0 && candidateNormalized.length > 0) {
    if (candidateNormalized === variant.raw) {
      bestScore = Math.max(bestScore, 1200);
    }

    if (candidateNormalized.startsWith(variant.raw)) {
      const extra = candidateNormalized.length - variant.raw.length;
      bestScore = Math.max(bestScore, 1060 - Math.min(120, extra));
    }

    const rawIndex = candidateNormalized.indexOf(variant.raw);
    if (rawIndex >= 0) {
      bestScore = Math.max(bestScore, 920 - Math.min(220, rawIndex * 8));
    }

    // Word-boundary token contains: bonus when query matches start of any word.
    const tokens = candidateNormalized.split(/[^a-z0-9]+/).filter(Boolean);
    for (const token of tokens) {
      if (token.startsWith(variant.raw)) {
        bestScore = Math.max(bestScore, 880);
        break;
      }
    }
  }

  if (variant.compact.length > 0 && candidateCompact.length > 0) {
    if (candidateCompact === variant.compact) {
      bestScore = Math.max(bestScore, 1180);
    }

    if (candidateCompact.startsWith(variant.compact)) {
      const extra = candidateCompact.length - variant.compact.length;
      bestScore = Math.max(bestScore, 1020 - Math.min(160, extra));
    }

    const compactIndex = candidateCompact.indexOf(variant.compact);
    if (compactIndex >= 0) {
      bestScore = Math.max(bestScore, 880 - Math.min(220, compactIndex * 6));
    }

    if (
      variant.compact.length >= 3 &&
      isSubsequence(variant.compact, candidateCompact)
    ) {
      const extra = candidateCompact.length - variant.compact.length;
      bestScore = Math.max(bestScore, 720 - Math.min(180, extra * 4));
    }

    if (
      allowTypos &&
      variant.compact.length >= 4 &&
      candidateCompact.length >= 4
    ) {
      const maxDistance = getMaxAllowedDistance(
        variant.compact.length,
        candidateCompact.length
      );
      if (maxDistance > 0) {
        const distance = boundedLevenshteinDistance(
          variant.compact,
          candidateCompact,
          maxDistance
        );
        if (distance <= maxDistance) {
          const lengthPenalty =
            Math.abs(candidateCompact.length - variant.compact.length) * 8;
          const typoScore =
            700 - distance * 90 - Math.min(160, lengthPenalty);
          bestScore = Math.max(bestScore, typoScore);
        }
      }
    }
  }

  return bestScore;
}

export interface CandidateField {
  text: string;
  /** Multiplicative-like additive bonus for matches within this field. */
  weight?: number;
}

function scoreItemFields(
  fields: CandidateField[],
  variant: QueryVariant,
  allowTypos: boolean
): number {
  let bestScore = CANDIDATE_EMPTY_SCORE;
  for (const field of fields) {
    if (!field || !field.text) continue;
    const score = scoreCandidate(field.text, variant, allowTypos);
    if (score < 0) continue;
    const weighted = score + (field.weight ?? 0);
    if (weighted > bestScore) {
      bestScore = weighted;
    }
  }
  return bestScore;
}

export function getDefaultMinScore(queryLength: number): number {
  if (queryLength <= 2) return 880;
  if (queryLength <= 4) return 700;
  return 560;
}

export function rankByFuzzyQuery<T>(
  items: T[],
  query: string,
  getFields: (item: T) => CandidateField[],
  options: FuzzyMatchOptions = {}
): FuzzyRanked<T>[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return items.map((item) => ({ item, score: 0 }));
  }

  const variant = buildVariant(trimmed);
  const allowTypos = options.allowTypos ?? true;
  const minScore = options.minScore ?? getDefaultMinScore(variant.raw.length);

  const matches: FuzzyRanked<T>[] = [];
  for (const item of items) {
    const fields = getFields(item);
    const score = scoreItemFields(fields, variant, allowTypos);
    if (score >= minScore) {
      matches.push({ item, score });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches;
}
