export type WordSearchDirection = "kanji-to-kana" | "kana-to-kanji";

export type WordSearchCell = {
  row: number;
  col: number;
};

export type WordSearchCandidate = {
  subjectId: number;
  written: string;
  reading: string;
  meaning: string;
  level?: number;
};

export type WordSearchEntry = WordSearchCandidate & {
  id: string;
  clue: string;
  answer: string;
  path: WordSearchCell[];
};

export type WordSearchPuzzle = {
  size: number;
  direction: WordSearchDirection;
  grid: string[][];
  entries: WordSearchEntry[];
};

export type GenerateWordSearchOptions = {
  size: number;
  wordCount: number;
  direction: WordSearchDirection;
  seed?: number;
};

const HIRAGANA_RE = /^[ぁ-ゟー]+$/;
const JAPANESE_RE = /^[一-龯々〆ヶぁ-ゟァ-ヿー]+$/;
const KANJI_RE = /[一-龯々〆ヶ]/;

const KANA_FILLERS = Array.from(
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽっゃゅょー",
);
const WRITTEN_FILLERS = Array.from(
  "日月火水木金土山川田人大小上下中左右学校先生年時分本語国食見行来生前後東西南北電車会社友名気雨空海花魚犬猫",
);

const DIRECTIONS = [
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: -1 },
  { row: 0, col: -1 },
  { row: -1, col: 0 },
  { row: -1, col: -1 },
  { row: -1, col: 1 },
] as const;

type Placement = {
  path: WordSearchCell[];
  score: number;
};

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function normalizeWordSearchReading(value: string): string {
  let output = "";
  for (const character of value.trim()) {
    const codePoint = character.codePointAt(0);
    if (codePoint && codePoint >= 0x30a1 && codePoint <= 0x30f6) {
      output += String.fromCodePoint(codePoint - 0x60);
    } else {
      output += character;
    }
  }
  return output;
}

function sanitizeCandidates(
  candidates: WordSearchCandidate[],
  direction: WordSearchDirection,
  size: number,
): (WordSearchCandidate & { answer: string; clue: string })[] {
  const seenAnswers = new Set<string>();

  return candidates.flatMap((candidate) => {
    const written = candidate.written.trim();
    const reading = normalizeWordSearchReading(candidate.reading);
    const meaning = candidate.meaning.trim();
    const answer = direction === "kanji-to-kana" ? reading : written;
    const clue = direction === "kanji-to-kana" ? written : reading;
    const answerLength = Array.from(answer).length;

    if (
      !meaning ||
      !HIRAGANA_RE.test(reading) ||
      !JAPANESE_RE.test(written) ||
      !KANJI_RE.test(written) ||
      answerLength < 2 ||
      answerLength > size ||
      seenAnswers.has(answer)
    ) {
      return [];
    }

    seenAnswers.add(answer);
    return [{ ...candidate, written, reading, meaning, answer, clue }];
  });
}

function findPlacements(
  grid: (string | null)[][],
  characters: string[],
  random: () => number,
): Placement[] {
  const size = grid.length;
  const placements: Placement[] = [];

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      for (const direction of DIRECTIONS) {
        const endRow = row + direction.row * (characters.length - 1);
        const endCol = col + direction.col * (characters.length - 1);
        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) {
          continue;
        }

        const path: WordSearchCell[] = [];
        let overlapCount = 0;
        let canPlace = true;

        characters.forEach((character, index) => {
          const cell = {
            row: row + direction.row * index,
            col: col + direction.col * index,
          };
          const current = grid[cell.row][cell.col];
          if (current && current !== character) {
            canPlace = false;
            return;
          }
          if (current === character) {
            overlapCount += 1;
          }
          path.push(cell);
        });

        if (canPlace) {
          placements.push({
            path,
            score: overlapCount * 100 + random(),
          });
        }
      }
    }
  }

  return placements;
}

export function generateWordSearch(
  candidates: WordSearchCandidate[],
  options: GenerateWordSearchOptions,
): WordSearchPuzzle {
  const size = Math.max(6, Math.min(12, Math.round(options.size)));
  const wordCount = Math.max(1, Math.min(12, Math.round(options.wordCount)));
  const seed = options.seed ?? Date.now();
  const random = createRandom(seed);
  const grid: (string | null)[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => null),
  );
  const eligible = sanitizeCandidates(candidates, options.direction, size);
  const ordered = shuffled(eligible, random).sort(
    (left, right) =>
      Array.from(right.answer).length - Array.from(left.answer).length,
  );
  const entries: WordSearchEntry[] = [];

  for (const candidate of ordered) {
    if (entries.length >= wordCount) {
      break;
    }

    const characters = Array.from(candidate.answer);
    const placements = findPlacements(grid, characters, random).sort(
      (left, right) => right.score - left.score,
    );
    const placement = placements[0];
    if (!placement) {
      continue;
    }

    placement.path.forEach((cell, index) => {
      grid[cell.row][cell.col] = characters[index];
    });

    entries.push({
      id: `word-search-${candidate.subjectId}-${entries.length}`,
      subjectId: candidate.subjectId,
      written: candidate.written,
      reading: candidate.reading,
      meaning: candidate.meaning,
      level: candidate.level,
      clue: candidate.clue,
      answer: candidate.answer,
      path: placement.path,
    });
  }

  const candidateFillers = eligible.flatMap((candidate) =>
    Array.from(candidate.answer),
  );
  const fallbackFillers =
    options.direction === "kanji-to-kana" ? KANA_FILLERS : WRITTEN_FILLERS;
  const fillers =
    candidateFillers.length > 0 ? candidateFillers : fallbackFillers;

  const completedGrid = grid.map((row) =>
    row.map(
      (character) =>
        character ?? fillers[Math.floor(random() * fillers.length)] ?? "あ",
    ),
  );

  return {
    size,
    direction: options.direction,
    grid: completedGrid,
    entries,
  };
}

export function wordSearchSelectionPath(
  start: WordSearchCell,
  end: WordSearchCell,
  size: number,
): WordSearchCell[] | null {
  const inBounds = (cell: WordSearchCell) =>
    cell.row >= 0 && cell.row < size && cell.col >= 0 && cell.col < size;
  if (!inBounds(start) || !inBounds(end)) {
    return null;
  }

  const rowDelta = end.row - start.row;
  const colDelta = end.col - start.col;
  const isStraight =
    rowDelta === 0 ||
    colDelta === 0 ||
    Math.abs(rowDelta) === Math.abs(colDelta);
  if (!isStraight) {
    return null;
  }

  const length = Math.max(Math.abs(rowDelta), Math.abs(colDelta)) + 1;
  const rowStep = Math.sign(rowDelta);
  const colStep = Math.sign(colDelta);
  return Array.from({ length }, (_, index) => ({
    row: start.row + rowStep * index,
    col: start.col + colStep * index,
  }));
}

export function getWordSearchCellAtPoint(
  point: { x: number; y: number },
  boardSize: number,
  puzzleSize: number,
): WordSearchCell | null {
  if (
    boardSize <= 0 ||
    puzzleSize <= 0 ||
    point.x < 0 ||
    point.y < 0 ||
    point.x >= boardSize ||
    point.y >= boardSize
  ) {
    return null;
  }

  const cellSize = boardSize / puzzleSize;
  return {
    row: Math.min(puzzleSize - 1, Math.floor(point.y / cellSize)),
    col: Math.min(puzzleSize - 1, Math.floor(point.x / cellSize)),
  };
}

export function getWordSearchDragEndCell(
  start: WordSearchCell,
  movement: { dx: number; dy: number },
  cellSize: number,
  puzzleSize: number,
): WordSearchCell {
  if (cellSize <= 0 || puzzleSize <= 0) {
    return start;
  }

  const rowDistance = movement.dy / cellSize;
  const colDistance = movement.dx / cellSize;
  const absoluteRowDistance = Math.abs(rowDistance);
  const absoluteColDistance = Math.abs(colDistance);
  let rowDirection = 0;
  let colDirection = 0;
  let stepCount = 0;

  if (absoluteColDistance >= absoluteRowDistance * 2) {
    colDirection = Math.sign(colDistance);
    stepCount = Math.round(absoluteColDistance);
  } else if (absoluteRowDistance >= absoluteColDistance * 2) {
    rowDirection = Math.sign(rowDistance);
    stepCount = Math.round(absoluteRowDistance);
  } else {
    rowDirection = Math.sign(rowDistance);
    colDirection = Math.sign(colDistance);
    stepCount = Math.round(Math.max(absoluteRowDistance, absoluteColDistance));
  }

  const availableRows =
    rowDirection > 0
      ? puzzleSize - 1 - start.row
      : rowDirection < 0
        ? start.row
        : Number.POSITIVE_INFINITY;
  const availableColumns =
    colDirection > 0
      ? puzzleSize - 1 - start.col
      : colDirection < 0
        ? start.col
        : Number.POSITIVE_INFINITY;
  const boundedStepCount = Math.max(
    0,
    Math.min(stepCount, availableRows, availableColumns),
  );

  return {
    row: start.row + rowDirection * boundedStepCount,
    col: start.col + colDirection * boundedStepCount,
  };
}

export function getWordSearchPathText(
  puzzle: WordSearchPuzzle,
  path: WordSearchCell[],
): string {
  return path.map((cell) => puzzle.grid[cell.row]?.[cell.col] ?? "").join("");
}

export function findWordSearchEntry(
  puzzle: WordSearchPuzzle,
  path: WordSearchCell[],
  excludedEntryIds: ReadonlySet<string> = new Set(),
): WordSearchEntry | null {
  if (path.length < 2) {
    return null;
  }

  const selection = getWordSearchPathText(puzzle, path);
  const reversed = Array.from(selection).reverse().join("");
  return (
    puzzle.entries.find(
      (entry) =>
        !excludedEntryIds.has(entry.id) &&
        (entry.answer === selection || entry.answer === reversed),
    ) ?? null
  );
}

export function wordSearchCellKey(cell: WordSearchCell): string {
  return `${cell.row}:${cell.col}`;
}
