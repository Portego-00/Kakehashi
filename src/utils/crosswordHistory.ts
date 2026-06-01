import AsyncStorage from "@react-native-async-storage/async-storage";

export const CROSSWORD_WORD_HISTORY_STORAGE_KEY =
  "extra_study_crossword_word_history_v1";
export const CROSSWORD_HISTORY_PUZZLE_LIMIT = 5;
export const CROSSWORD_HARD_AVOID_PUZZLE_LIMIT = 1;
export const CROSSWORD_RECENT_CANDIDATE_PENALTY = 0.85;

export interface CrosswordWordHistoryEntry {
  generatedAt: number;
  subjectIds: number[];
}

interface CrosswordCandidateLike {
  subjectId: number;
}

function normalizeSubjectIds(values: unknown): number[] {
  if (!Array.isArray(values)) return [];

  const seen = new Set<number>();
  const out: number[] = [];
  for (const value of values) {
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const subjectId = Math.floor(value);
    if (subjectId <= 0 || seen.has(subjectId)) continue;
    seen.add(subjectId);
    out.push(subjectId);
  }
  return out;
}

export function sanitizeCrosswordWordHistory(
  value: unknown,
  limit = CROSSWORD_HISTORY_PUZZLE_LIMIT
): CrosswordWordHistoryEntry[] {
  if (!Array.isArray(value)) return [];

  const out: CrosswordWordHistoryEntry[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;

    const subjectIds = normalizeSubjectIds(
      (entry as Partial<CrosswordWordHistoryEntry>).subjectIds
    );
    if (subjectIds.length === 0) continue;

    const generatedAt = (entry as Partial<CrosswordWordHistoryEntry>).generatedAt;
    out.push({
      generatedAt:
        typeof generatedAt === "number" && Number.isFinite(generatedAt)
          ? generatedAt
          : 0,
      subjectIds,
    });

    if (out.length >= limit) break;
  }

  return out;
}

export async function loadCrosswordWordHistory(): Promise<
  CrosswordWordHistoryEntry[]
> {
  const rawValue = await AsyncStorage.getItem(CROSSWORD_WORD_HISTORY_STORAGE_KEY);
  if (!rawValue) return [];

  try {
    return sanitizeCrosswordWordHistory(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

export async function saveCrosswordWordHistoryEntry(
  subjectIds: number[],
  generatedAt = Date.now()
): Promise<void> {
  const normalizedSubjectIds = normalizeSubjectIds(subjectIds);
  if (normalizedSubjectIds.length === 0) return;

  const history = await loadCrosswordWordHistory();
  const nextHistory = sanitizeCrosswordWordHistory([
    { generatedAt, subjectIds: normalizedSubjectIds },
    ...history,
  ]);

  await AsyncStorage.setItem(
    CROSSWORD_WORD_HISTORY_STORAGE_KEY,
    JSON.stringify(nextHistory)
  );
}

export function getRecentCrosswordSubjectIds(
  history: CrosswordWordHistoryEntry[],
  puzzleLimit = CROSSWORD_HISTORY_PUZZLE_LIMIT
): number[] {
  const seen = new Set<number>();
  const out: number[] = [];

  for (const entry of history.slice(0, puzzleLimit)) {
    for (const subjectId of entry.subjectIds) {
      if (seen.has(subjectId)) continue;
      seen.add(subjectId);
      out.push(subjectId);
    }
  }

  return out;
}

export function getCrosswordHardAvoidSubjectIds(
  history: CrosswordWordHistoryEntry[],
  puzzleLimit = CROSSWORD_HARD_AVOID_PUZZLE_LIMIT
): Set<number> {
  return new Set(getRecentCrosswordSubjectIds(history, puzzleLimit));
}

export function buildCrosswordGenerationPool<T extends CrosswordCandidateLike>(
  candidates: T[],
  options: {
    poolSize: number;
    recentSubjectIds: number[];
    hardAvoidSubjectIds?: ReadonlySet<number>;
    minFreshCandidates?: number;
    randomFn?: () => number;
    recentCandidatePenalty?: number;
  }
): T[] {
  const poolSize = Math.max(0, Math.floor(options.poolSize));
  if (poolSize === 0 || candidates.length === 0) return [];

  const hardAvoidSubjectIds = options.hardAvoidSubjectIds ?? new Set<number>();
  const minFreshCandidates = Math.max(
    0,
    Math.floor(options.minFreshCandidates ?? poolSize)
  );
  const freshCandidates = candidates.filter(
    (candidate) => !hardAvoidSubjectIds.has(candidate.subjectId)
  );
  const source =
    freshCandidates.length >= minFreshCandidates ? freshCandidates : candidates;

  const randomFn = options.randomFn ?? Math.random;
  const recentSubjectIds = new Set(options.recentSubjectIds);
  const recentCandidatePenalty =
    typeof options.recentCandidatePenalty === "number" &&
    Number.isFinite(options.recentCandidatePenalty)
      ? Math.max(0, options.recentCandidatePenalty)
      : CROSSWORD_RECENT_CANDIDATE_PENALTY;

  return source
    .map((candidate, index) => ({
      candidate,
      index,
      rank:
        randomFn() +
        (recentSubjectIds.has(candidate.subjectId) ? recentCandidatePenalty : 0),
    }))
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.index - b.index;
    })
    .slice(0, poolSize)
    .map(({ candidate }) => candidate);
}
