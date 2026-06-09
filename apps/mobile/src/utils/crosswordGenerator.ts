/**
 * Generates a Japanese hiragana crossword puzzle from a list of vocabulary
 * words.
 *
 * Algorithm:
 *   1. Filter & normalize candidate words to clean hiragana strings.
 *   2. Build multiple candidate orders (balanced, short-friendly, mild long bias).
 *   3. Place the first word horizontally near the centre of the grid.
 *   4. For every remaining word, search for the highest-scoring legal
 *      placement that crosses an already placed letter at least once.
 *   5. Repeat the whole process several times with shuffled inputs and
 *      keep the best-balanced result.
 *   6. Trim the resulting grid to its bounding box and number the words.
 */

export type CrosswordDirection = "across" | "down";

export interface CrosswordWordInput {
  subjectId: number;
  hiragana: string;
  meaning: string;
  level?: number;
}

export interface PlacedCrosswordWord {
  id: string;
  subjectId: number;
  word: string;
  meaning: string;
  level?: number;
  row: number;
  col: number;
  direction: CrosswordDirection;
  number: number;
}

export interface CrosswordCellSolution {
  row: number;
  col: number;
  solution: string;
  number?: number;
  wordIds: string[];
}

export interface CrosswordPuzzle {
  rows: number;
  cols: number;
  /** rows x cols. null = blocked / outside the puzzle. */
  cells: (CrosswordCellSolution | null)[][];
  words: PlacedCrosswordWord[];
}

export interface CrosswordGeneratorOptions {
  /** Maximum width / height of the grid before trimming. */
  gridSize: number;
  /** Soft cap of words to place. */
  maxWords: number;
  /** Inclusive minimum length for candidate words (default 2). */
  minWordLength?: number;
  /** Inclusive maximum length for candidate words. */
  maxWordLength?: number;
  /** Number of randomized passes to try (default 8). */
  attempts?: number;
  /** Optional deterministic seed (string -> number). Useful for tests. */
  seed?: number;
  /**
   * Subject IDs used in recent crossword puzzles. These are still allowed, but
   * the generator will prefer similarly-good puzzles that use fresher words.
   */
  recentSubjectIds?: number[];
  /** Strength of the recent-word penalty (default 4). */
  recentWordPenalty?: number;
}

const HIRAGANA_REGEX = /^[぀-ゟー]+$/;
const SHORT_WORD_LENGTH = 3;
const DEFAULT_RECENT_WORD_PENALTY = 4;

function makeRng(seed?: number): () => number {
  if (seed === undefined || Number.isNaN(seed)) {
    return Math.random;
  }
  let state = Math.floor(seed) >>> 0;
  if (state === 0) state = 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 1_000_000) / 1_000_000;
  };
}

function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function normalizeHiragana(input: string): string | null {
  if (!input) return null;
  // Convert katakana to hiragana for safety (some readings come as katakana).
  let out = "";
  for (const ch of input) {
    const code = ch.codePointAt(0)!;
    if (code >= 0x30a1 && code <= 0x30f6) {
      out += String.fromCodePoint(code - 0x60);
    } else {
      out += ch;
    }
  }
  if (!HIRAGANA_REGEX.test(out)) return null;
  return out;
}

function buildEmptyGrid(size: number): (string | null)[][] {
  const grid: (string | null)[][] = [];
  for (let r = 0; r < size; r += 1) {
    grid.push(new Array<string | null>(size).fill(null));
  }
  return grid;
}

function letters(word: string): string[] {
  return Array.from(word);
}

function wordLength(word: CrosswordWordInput): number {
  return letters(word.hiragana).length;
}

function countShortWords(words: CrosswordWordInput[]): number {
  return words.reduce(
    (total, word) => total + (wordLength(word) <= SHORT_WORD_LENGTH ? 1 : 0),
    0
  );
}

function countWordsOfLength(words: CrosswordWordInput[], length: number): number {
  return words.reduce(
    (total, word) => total + (wordLength(word) === length ? 1 : 0),
    0
  );
}

function normalizeRecentSubjectIds(subjectIds?: number[]): Set<number> {
  const out = new Set<number>();
  if (!subjectIds) return out;
  for (const subjectId of subjectIds) {
    if (typeof subjectId !== "number" || !Number.isFinite(subjectId)) continue;
    out.add(subjectId);
  }
  return out;
}

function getRecentWordPenalty(
  subjectId: number,
  recentSubjectIds: ReadonlySet<number>,
  penalty: number
): number {
  return recentSubjectIds.has(subjectId) ? penalty : 0;
}

function countRecentWords(
  words: CrosswordWordInput[],
  recentSubjectIds: ReadonlySet<number>
): number {
  return words.reduce(
    (total, word) => total + (recentSubjectIds.has(word.subjectId) ? 1 : 0),
    0
  );
}

function pickStarterWordIndex(
  usable: CrosswordWordInput[],
  gridSize: number,
  rng: () => number,
  recentSubjectIds: ReadonlySet<number>,
  recentWordPenalty: number
): number {
  if (usable.length <= 1) return 0;

  // Medium-length anchor words usually create good crossing opportunities
  // while still leaving room for 2-3 character entries.
  const idealAnchorLength = Math.min(
    6,
    Math.max(SHORT_WORD_LENGTH, Math.floor(gridSize * 0.38))
  );

  let bestIndex = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let i = 0; i < usable.length; i += 1) {
    const len = wordLength(usable[i]);
    const lengthDistance = Math.abs(len - idealAnchorLength);
    const veryShortPenalty = len <= 2 ? 0.75 : 0;
    const score =
      lengthDistance +
      veryShortPenalty +
      getRecentWordPenalty(usable[i].subjectId, recentSubjectIds, recentWordPenalty) +
      rng() * 0.35;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = i;
    }
  }

  return bestIndex;
}

function buildAttemptOrdering(
  candidates: CrosswordWordInput[],
  attempt: number,
  rng: () => number,
  recentSubjectIds: ReadonlySet<number>,
  recentWordPenalty: number
): CrosswordWordInput[] {
  const shuffled = shuffleInPlace([...candidates], rng);
  const strategy = attempt % 3;

  if (strategy === 0) {
    // Balanced: prefer medium/long words, with randomness.
    const idealLength = 5;
    return shuffled.sort((a, b) => {
      const aScore =
        Math.abs(wordLength(a) - idealLength) +
        getRecentWordPenalty(a.subjectId, recentSubjectIds, recentWordPenalty) +
        rng() * 0.55;
      const bScore =
        Math.abs(wordLength(b) - idealLength) +
        getRecentWordPenalty(b.subjectId, recentSubjectIds, recentWordPenalty) +
        rng() * 0.55;
      return aScore - bScore;
    });
  }

  if (strategy === 1) {
    // Mild long-word preference for better anchoring.
    return shuffled.sort((a, b) => {
      const aLen =
        wordLength(a) -
        getRecentWordPenalty(a.subjectId, recentSubjectIds, recentWordPenalty) +
        rng() * 0.9;
      const bLen =
        wordLength(b) -
        getRecentWordPenalty(b.subjectId, recentSubjectIds, recentWordPenalty) +
        rng() * 0.9;
      if (aLen !== bLen) return bLen - aLen;
      return rng() - 0.5;
    });
  }

  // Stronger long-word ordering pass, still not deterministic.
  return shuffled.sort((a, b) => {
    const aScore =
      wordLength(a) -
      getRecentWordPenalty(a.subjectId, recentSubjectIds, recentWordPenalty);
    const bScore =
      wordLength(b) -
      getRecentWordPenalty(b.subjectId, recentSubjectIds, recentWordPenalty);
    if (aScore !== bScore) return bScore - aScore;
    return rng() - 0.5;
  });
}

function canPlace(
  grid: (string | null)[][],
  letterArray: string[],
  row: number,
  col: number,
  direction: CrosswordDirection
): { crossings: number } | null {
  const N = grid.length;
  const len = letterArray.length;

  if (row < 0 || col < 0) return null;

  if (direction === "across") {
    if (row >= N) return null;
    if (col + len > N) return null;
    if (col > 0 && grid[row][col - 1] !== null) return null;
    if (col + len < N && grid[row][col + len] !== null) return null;

    let crossings = 0;
    for (let i = 0; i < len; i += 1) {
      const r = row;
      const c = col + i;
      const cell = grid[r][c];
      if (cell !== null) {
        if (cell !== letterArray[i]) return null;
        crossings += 1;
      } else {
        if (r > 0 && grid[r - 1][c] !== null) return null;
        if (r < N - 1 && grid[r + 1][c] !== null) return null;
      }
    }
    return { crossings };
  }

  // down
  if (col >= N) return null;
  if (row + len > N) return null;
  if (row > 0 && grid[row - 1][col] !== null) return null;
  if (row + len < N && grid[row + len][col] !== null) return null;

  let crossings = 0;
  for (let i = 0; i < len; i += 1) {
    const r = row + i;
    const c = col;
    const cell = grid[r][c];
    if (cell !== null) {
      if (cell !== letterArray[i]) return null;
      crossings += 1;
    } else {
      if (c > 0 && grid[r][c - 1] !== null) return null;
      if (c < N - 1 && grid[r][c + 1] !== null) return null;
    }
  }
  return { crossings };
}

function placeOnGrid(
  grid: (string | null)[][],
  letterArray: string[],
  row: number,
  col: number,
  direction: CrosswordDirection
): void {
  for (let i = 0; i < letterArray.length; i += 1) {
    if (direction === "across") {
      grid[row][col + i] = letterArray[i];
    } else {
      grid[row + i][col] = letterArray[i];
    }
  }
}

interface InternalPlacement {
  word: CrosswordWordInput;
  letters: string[];
  row: number;
  col: number;
  direction: CrosswordDirection;
}

function tryGenerate(
  candidates: CrosswordWordInput[],
  options: Required<
    Pick<CrosswordGeneratorOptions, "gridSize" | "maxWords">
  > &
    Pick<CrosswordGeneratorOptions, "minWordLength" | "maxWordLength"> & {
      recentSubjectIds: ReadonlySet<number>;
      recentWordPenalty: number;
    },
  rng: () => number
): InternalPlacement[] {
  const grid = buildEmptyGrid(options.gridSize);
  const placed: InternalPlacement[] = [];

  if (candidates.length === 0) return placed;

  const minLen = options.minWordLength ?? 2;
  const maxLen = Math.min(
    options.maxWordLength ?? options.gridSize - 2,
    options.gridSize - 2
  );

  const usable = candidates.filter((w) => {
    const arr = letters(w.hiragana);
    return arr.length >= minLen && arr.length <= maxLen;
  });

  if (usable.length === 0) return placed;

  // Place the first word horizontally, centred.
  const starterIndex = pickStarterWordIndex(
    usable,
    options.gridSize,
    rng,
    options.recentSubjectIds,
    options.recentWordPenalty
  );
  const first = usable[starterIndex];
  const firstLetters = letters(first.hiragana);
  const startRow = Math.floor(options.gridSize / 2);
  const startCol = Math.max(
    0,
    Math.floor((options.gridSize - firstLetters.length) / 2)
  );
  placeOnGrid(grid, firstLetters, startRow, startCol, "across");
  placed.push({
    word: first,
    letters: firstLetters,
    row: startRow,
    col: startCol,
    direction: "across",
  });

  // Place subsequent words.
  const used = new Set<number>([first.subjectId]);
  for (let i = 0; i < usable.length && placed.length < options.maxWords; i += 1) {
    const candidate = usable[i];
    if (used.has(candidate.subjectId)) continue;

    const candidateLetters = letters(candidate.hiragana);
    let best: {
      row: number;
      col: number;
      direction: CrosswordDirection;
      score: number;
    } | null = null;

    // Try crossing the new word against every letter of every placed word.
    for (let p = 0; p < placed.length; p += 1) {
      const existing = placed[p];
      for (let pi = 0; pi < existing.letters.length; pi += 1) {
        for (let ci = 0; ci < candidateLetters.length; ci += 1) {
          if (existing.letters[pi] !== candidateLetters[ci]) continue;

          const newDirection: CrosswordDirection =
            existing.direction === "across" ? "down" : "across";

          let row: number;
          let col: number;
          if (newDirection === "across") {
            // existing.direction === "down": existing word goes down.
            row = existing.row + pi;
            col = existing.col - ci;
          } else {
            // existing.direction === "across".
            row = existing.row - ci;
            col = existing.col + pi;
          }

          const ok = canPlace(grid, candidateLetters, row, col, newDirection);
          if (!ok) continue;

          // Score: crossings and centre placement matter most.
          // 2-char words get a stronger penalty, 3-char words a mild penalty,
          // keeping them possible but less frequent.
          const centreR = options.gridSize / 2;
          const centreC = options.gridSize / 2;
          const middleR =
            newDirection === "across"
              ? row
              : row + (candidateLetters.length - 1) / 2;
          const middleC =
            newDirection === "across"
              ? col + (candidateLetters.length - 1) / 2
              : col;
          const distance =
            Math.abs(middleR - centreR) + Math.abs(middleC - centreC);
          const shortWordPenalty =
            candidateLetters.length === 2
              ? 6
              : candidateLetters.length === 3
                ? 2.5
                : 0;
          const score = ok.crossings * 52 - distance - shortWordPenalty + rng() * 0.2;

          if (!best || score > best.score) {
            best = { row, col, direction: newDirection, score };
          }
        }
      }
    }

    if (best) {
      placeOnGrid(grid, candidateLetters, best.row, best.col, best.direction);
      placed.push({
        word: candidate,
        letters: candidateLetters,
        row: best.row,
        col: best.col,
        direction: best.direction,
      });
      used.add(candidate.subjectId);
    }
  }

  return placed;
}

function finalize(placements: InternalPlacement[]): CrosswordPuzzle {
  if (placements.length === 0) {
    return { rows: 0, cols: 0, cells: [], words: [] };
  }

  let minRow = Infinity;
  let maxRow = -Infinity;
  let minCol = Infinity;
  let maxCol = -Infinity;

  for (const p of placements) {
    const lastRow =
      p.direction === "down" ? p.row + p.letters.length - 1 : p.row;
    const lastCol =
      p.direction === "across" ? p.col + p.letters.length - 1 : p.col;
    minRow = Math.min(minRow, p.row);
    minCol = Math.min(minCol, p.col);
    maxRow = Math.max(maxRow, lastRow);
    maxCol = Math.max(maxCol, lastCol);
  }

  const rows = maxRow - minRow + 1;
  const cols = maxCol - minCol + 1;
  const cells: (CrosswordCellSolution | null)[][] = [];
  for (let r = 0; r < rows; r += 1) {
    cells.push(new Array<CrosswordCellSolution | null>(cols).fill(null));
  }

  // Determine clue numbers in standard crossword reading order
  // (top-to-bottom, left-to-right).
  const sortedPlacements = [...placements].sort((a, b) => {
    const aRow = a.row - minRow;
    const bRow = b.row - minRow;
    if (aRow !== bRow) return aRow - bRow;
    return a.col - b.col;
  });

  type Key = string;
  const numberByCell = new Map<Key, number>();
  let nextNumber = 1;
  const placedWords: PlacedCrosswordWord[] = [];

  for (const placement of sortedPlacements) {
    const localRow = placement.row - minRow;
    const localCol = placement.col - minCol;
    const cellKey = `${localRow},${localCol}`;
    let number = numberByCell.get(cellKey);
    if (number === undefined) {
      number = nextNumber;
      nextNumber += 1;
      numberByCell.set(cellKey, number);
    }

    placedWords.push({
      id: `${placement.word.subjectId}-${placement.direction}-${localRow}-${localCol}`,
      subjectId: placement.word.subjectId,
      word: placement.word.hiragana,
      meaning: placement.word.meaning,
      level: placement.word.level,
      row: localRow,
      col: localCol,
      direction: placement.direction,
      number,
    });
  }

  // Fill cell solutions.
  for (const placement of placedWords) {
    const wordLetters = letters(placement.word);
    for (let i = 0; i < wordLetters.length; i += 1) {
      const r =
        placement.direction === "down" ? placement.row + i : placement.row;
      const c =
        placement.direction === "across" ? placement.col + i : placement.col;
      const existing = cells[r][c];
      if (existing) {
        existing.wordIds.push(placement.id);
      } else {
        cells[r][c] = {
          row: r,
          col: c,
          solution: wordLetters[i],
          wordIds: [placement.id],
        };
      }
    }
  }

  // Apply clue numbers to the starting cell of each word.
  for (const placement of placedWords) {
    const startCell = cells[placement.row]?.[placement.col];
    if (startCell && startCell.number === undefined) {
      startCell.number = placement.number;
    }
  }

  return {
    rows,
    cols,
    cells,
    words: placedWords,
  };
}

export function prepareCrosswordCandidates(
  inputs: CrosswordWordInput[]
): CrosswordWordInput[] {
  const out: CrosswordWordInput[] = [];
  const seenIds = new Set<number>();
  for (const item of inputs) {
    if (seenIds.has(item.subjectId)) continue;
    const normalized = normalizeHiragana(item.hiragana ?? "");
    if (!normalized) continue;
    if (!item.meaning) continue;
    seenIds.add(item.subjectId);
    out.push({
      subjectId: item.subjectId,
      hiragana: normalized,
      meaning: item.meaning,
      level: item.level,
    });
  }
  return out;
}

export function generateCrossword(
  inputs: CrosswordWordInput[],
  options: CrosswordGeneratorOptions
): CrosswordPuzzle {
  const candidates = prepareCrosswordCandidates(inputs);
  if (candidates.length === 0) {
    return { rows: 0, cols: 0, cells: [], words: [] };
  }

  const rng = makeRng(options.seed);
  const attempts = Math.max(options.attempts ?? 8, 10);
  const recentSubjectIds = normalizeRecentSubjectIds(options.recentSubjectIds);
  const recentWordPenalty =
    typeof options.recentWordPenalty === "number" &&
    Number.isFinite(options.recentWordPenalty)
      ? Math.max(0, options.recentWordPenalty)
      : DEFAULT_RECENT_WORD_PENALTY;

  let best: InternalPlacement[] = [];

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const orderedCandidates = buildAttemptOrdering(
      candidates,
      attempt,
      rng,
      recentSubjectIds,
      recentWordPenalty
    );
    const result = tryGenerate(
      orderedCandidates,
      {
        gridSize: options.gridSize,
        maxWords: options.maxWords,
        minWordLength: options.minWordLength,
        maxWordLength: options.maxWordLength,
        recentSubjectIds,
        recentWordPenalty,
      },
      rng
    );
    if (result.length > best.length) {
      best = result;
      continue;
    }

    if (result.length === best.length) {
      const bestWords = best.map((placement) => placement.word);
      const resultWords = result.map((placement) => placement.word);
      const bestRecent = countRecentWords(bestWords, recentSubjectIds);
      const resultRecent = countRecentWords(resultWords, recentSubjectIds);
      if (resultRecent < bestRecent) {
        best = result;
        continue;
      }
      if (resultRecent > bestRecent) {
        continue;
      }

      const bestTwoChar = countWordsOfLength(bestWords, 2);
      const resultTwoChar = countWordsOfLength(resultWords, 2);
      if (resultTwoChar < bestTwoChar) {
        best = result;
        continue;
      }
      if (resultTwoChar > bestTwoChar) {
        continue;
      }

      const targetThreeChar = Math.max(1, Math.floor(options.maxWords * 0.15));
      const bestThreeChar = countWordsOfLength(bestWords, 3);
      const resultThreeChar = countWordsOfLength(resultWords, 3);
      const bestThreeDistance = Math.abs(bestThreeChar - targetThreeChar);
      const resultThreeDistance = Math.abs(resultThreeChar - targetThreeChar);
      if (resultThreeDistance < bestThreeDistance) {
        best = result;
        continue;
      }
      if (resultThreeDistance > bestThreeDistance) {
        continue;
      }

      const bestShort = countShortWords(bestWords);
      const resultShort = countShortWords(resultWords);
      if (resultShort < bestShort) {
        best = result;
        continue;
      }
      if (resultShort > bestShort) {
        continue;
      }

      if (rng() > 0.5) {
        best = result;
      }
    }
  }

  return finalize(best);
}

export function getWordsContainingCell(
  puzzle: CrosswordPuzzle,
  row: number,
  col: number
): PlacedCrosswordWord[] {
  const cell = puzzle.cells[row]?.[col];
  if (!cell) return [];
  return cell.wordIds
    .map((id) => puzzle.words.find((w) => w.id === id))
    .filter((w): w is PlacedCrosswordWord => Boolean(w));
}

export function getWordById(
  puzzle: CrosswordPuzzle,
  id: string
): PlacedCrosswordWord | undefined {
  return puzzle.words.find((w) => w.id === id);
}

export function getCellsForWord(
  puzzle: CrosswordPuzzle,
  word: PlacedCrosswordWord
): CrosswordCellSolution[] {
  const out: CrosswordCellSolution[] = [];
  const wordLetters = letters(word.word);
  for (let i = 0; i < wordLetters.length; i += 1) {
    const r = word.direction === "down" ? word.row + i : word.row;
    const c = word.direction === "across" ? word.col + i : word.col;
    const cell = puzzle.cells[r]?.[c];
    if (cell) out.push(cell);
  }
  return out;
}
