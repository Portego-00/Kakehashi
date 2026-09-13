import { toHiragana } from "wanakana";
import type { Subject } from "@/types/wanikani";
import type { CrosswordEntry, CrosswordPuzzle, WordleTile, WordSearchCell, WordSearchDirection, WordSearchEntry, WordSearchPuzzle } from "./types";
import type { CrosswordClueMode, JlptLevel } from "./types";
import { KANJI_TO_JLPT } from "@/features/progress/catalogs/jlptKanji";
import type { StudyTokenDetail } from "./types";
import { shuffle } from "./engine";

export function splitKana(value: string): string[] {
  return Array.from(toHiragana(value.normalize("NFKC")).trim());
}

export function evaluateWordleGuess(target: string, guess: string): WordleTile[] {
  const targetKana = splitKana(target);
  const guessKana = splitKana(guess);
  const states: WordleTile[] = guessKana.map((character) => ({ character, state: "absent" }));
  const remaining = new Map<string, number>();
  targetKana.forEach((character, index) => {
    if (guessKana[index] !== character) remaining.set(character, (remaining.get(character) ?? 0) + 1);
  });
  states.forEach((tile, index) => {
    if (targetKana[index] === tile.character) tile.state = "correct";
  });
  states.forEach((tile) => {
    if (tile.state === "correct") return;
    const count = remaining.get(tile.character) ?? 0;
    if (count > 0) {
      tile.state = "present";
      remaining.set(tile.character, count - 1);
    }
  });
  return states;
}

export function wordleCandidates(subjects: Subject[], length: number): Array<{ subject: Subject; reading: string }> {
  return subjects.flatMap((subject) => {
    if (subject.object !== "vocabulary" && subject.object !== "kana_vocabulary") return [];
    const reading = subject.data.readings?.find((item) => item.primary)?.reading ?? subject.data.readings?.[0]?.reading;
    if (!reading || splitKana(reading).length !== length) return [];
    return [{ subject, reading }];
  });
}

export function chooseWordleCandidate<T>(candidates: T[], random: () => number = Math.random): T | null {
  if (!candidates.length) return null;
  return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))] ?? null;
}

export function isValidWordleGuess(guess: string, candidates: Array<{ reading: string }>): boolean {
  const normalized = toHiragana(guess.normalize("NFKC")).trim();
  return candidates.some((candidate) => toHiragana(candidate.reading.normalize("NFKC")).trim() === normalized);
}

interface CrosswordCandidate { subjectId: number; answer: string; clue: string; characters: string; meaning: string; audioUrl?: string }
interface Placement { row: number; col: number; direction: "across" | "down"; crossings: number }

export interface CrosswordGenerationOptions {
  clueMode?: CrosswordClueMode;
  hiraganaOnly?: boolean;
  jlptLevels?: JlptLevel[];
}

const HIRAGANA_WORD = /^[\p{Script=Hiragana}ー〜～]+$/u;
const KANJI_CHARACTER = /\p{Script=Han}/u;
const JAPANESE_WORD = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ヶー〜～]+$/u;
const WORD_SEARCH_DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
] as const;
const HIRAGANA_FILLERS = splitKana("あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをんがぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽゃゅょっ");
const KANJI_FILLERS = Array.from("日本人大小中上下左右前後時分学校生年月火水木金土語見行来食飲読書話聞買");

interface WordSearchCandidate {
  subjectId: number;
  prompt: string;
  answer: string;
  characters: string;
  reading: string;
  meaning: string;
}

interface WordSearchPlacement {
  row: number;
  col: number;
  rowStep: number;
  colStep: number;
  overlaps: number;
}

function wordSearchAnswerCharacters(answer: string, direction: WordSearchDirection) {
  return direction === "kanji-to-kana" ? splitKana(answer) : Array.from(answer.normalize("NFKC").trim());
}

function wordSearchCandidates(subjects: Subject[], direction: WordSearchDirection, size: number): WordSearchCandidate[] {
  const seenAnswers = new Set<string>();
  return subjects.flatMap((subject) => {
    if (subject.object !== "vocabulary") return [];
    const reading = subject.data.readings?.find((item) => item.primary)?.reading ?? subject.data.readings?.[0]?.reading;
    const characters = subject.data.characters?.normalize("NFKC").trim() ?? "";
    const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.meanings[0]?.meaning;
    if (!reading || !characters || !meaning || !HIRAGANA_WORD.test(reading) || !JAPANESE_WORD.test(characters) || !KANJI_CHARACTER.test(characters)) return [];
    const answer = direction === "kanji-to-kana" ? toHiragana(reading) : characters;
    const answerLength = wordSearchAnswerCharacters(answer, direction).length;
    if (answerLength < 2 || answerLength > size || seenAnswers.has(answer)) return [];
    seenAnswers.add(answer);
    return [{
      subjectId: subject.id,
      prompt: direction === "kanji-to-kana" ? characters : toHiragana(reading),
      answer,
      characters,
      reading: toHiragana(reading),
      meaning,
    }];
  });
}

function availableWordSearchPlacements(grid: Array<Array<string | null>>, characters: string[]): WordSearchPlacement[] {
  const placements: WordSearchPlacement[] = [];
  const size = grid.length;
  for (const [rowStep, colStep] of WORD_SEARCH_DIRECTIONS) {
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const endRow = row + rowStep * (characters.length - 1);
        const endCol = col + colStep * (characters.length - 1);
        if (endRow < 0 || endRow >= size || endCol < 0 || endCol >= size) continue;
        let overlaps = 0;
        let valid = true;
        for (let index = 0; index < characters.length; index += 1) {
          const current = grid[row + rowStep * index][col + colStep * index];
          if (current && current !== characters[index]) {
            valid = false;
            break;
          }
          if (current === characters[index]) overlaps += 1;
        }
        if (valid) placements.push({ row, col, rowStep, colStep, overlaps });
      }
    }
  }
  return placements;
}

export function generateWordSearch(subjects: Subject[], direction: WordSearchDirection = "kanji-to-kana", size = 10, maxWords = 10, random: () => number = Math.random): WordSearchPuzzle | null {
  const boardSize = Math.min(13, Math.max(7, Math.round(size)));
  const targetWords = Math.min(15, Math.max(3, Math.round(maxWords)));
  const candidates = shuffle(wordSearchCandidates(subjects, direction, boardSize), random)
    .toSorted((left, right) => wordSearchAnswerCharacters(right.answer, direction).length - wordSearchAnswerCharacters(left.answer, direction).length);
  if (candidates.length < 2) return null;

  const grid = Array.from({ length: boardSize }, () => Array<string | null>(boardSize).fill(null));
  const entries: WordSearchEntry[] = [];
  for (const candidate of candidates) {
    if (entries.length >= targetWords) break;
    const characters = wordSearchAnswerCharacters(candidate.answer, direction);
    const placements = availableWordSearchPlacements(grid, characters);
    if (!placements.length) continue;
    const highestOverlap = Math.max(...placements.map((placement) => placement.overlaps));
    const preferred = placements.filter((placement) => placement.overlaps === highestOverlap);
    const placement = preferred[Math.min(preferred.length - 1, Math.floor(random() * preferred.length))];
    const path = characters.map((character, index) => {
      const row = placement.row + placement.rowStep * index;
      const col = placement.col + placement.colStep * index;
      grid[row][col] = character;
      return { row, col };
    });
    entries.push({ id: `word-search-${candidate.subjectId}`, ...candidate, path });
  }
  if (entries.length < 2) return null;

  const answerFillers = entries.flatMap((entry) => wordSearchAnswerCharacters(entry.answer, direction));
  const fillers = [...new Set([...answerFillers, ...(direction === "kanji-to-kana" ? HIRAGANA_FILLERS : KANJI_FILLERS)])];
  const filledGrid = grid.map((row) => row.map((character) => character ?? fillers[Math.min(fillers.length - 1, Math.floor(random() * fillers.length))]));
  return { size: boardSize, direction, grid: filledGrid, entries: shuffle(entries, random) };
}

export function wordSearchSelectionPath(start: WordSearchCell, end: WordSearchCell): WordSearchCell[] {
  const rowDistance = end.row - start.row;
  const colDistance = end.col - start.col;
  const aligned = rowDistance === 0 || colDistance === 0 || Math.abs(rowDistance) === Math.abs(colDistance);
  if (!aligned) return [];
  const length = Math.max(Math.abs(rowDistance), Math.abs(colDistance)) + 1;
  const rowStep = Math.sign(rowDistance);
  const colStep = Math.sign(colDistance);
  return Array.from({ length }, (_, index) => ({ row: start.row + rowStep * index, col: start.col + colStep * index }));
}

function wordSearchPathKey(path: WordSearchCell[]) {
  return path.map(({ row, col }) => `${row}:${col}`).join("|");
}

export function findWordSearchEntry(puzzle: WordSearchPuzzle, path: WordSearchCell[], excludedEntryIds: Iterable<string> = []): WordSearchEntry | null {
  if (path.length < 2) return null;
  const excluded = new Set(excludedEntryIds);
  const selected = wordSearchPathKey(path);
  const reversed = wordSearchPathKey([...path].reverse());
  return puzzle.entries.find((entry) => !excluded.has(entry.id) && (wordSearchPathKey(entry.path) === selected || wordSearchPathKey(entry.path) === reversed)) ?? null;
}

function estimatedJlptLevel(subject: Subject): JlptLevel | null {
  const characters = subject.data.characters ?? "";
  const levels = [...characters]
    .map((character) => KANJI_TO_JLPT[character] as JlptLevel | undefined)
    .filter((level): level is JlptLevel => Boolean(level));
  if (!levels.length) return null;
  return levels.toSorted((left, right) => Number(right.slice(1)) - Number(left.slice(1)))[0] ?? null;
}

function crosswordCandidates(subjects: Subject[], options: CrosswordGenerationOptions): CrosswordCandidate[] {
  const selectedJlptLevels = new Set(options.jlptLevels ?? []);
  return subjects.flatMap((subject) => {
    if (subject.object !== "vocabulary" && subject.object !== "kana_vocabulary") return [];
    const reading = subject.data.readings?.find((item) => item.primary)?.reading ?? subject.data.readings?.[0]?.reading;
    const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.meanings[0]?.meaning;
    const characters = subject.data.characters ?? reading ?? "";
    if (!reading || !meaning || !HIRAGANA_WORD.test(reading) || splitKana(reading).length < 2 || splitKana(reading).length > 15) return [];
    if (options.hiraganaOnly && (KANJI_CHARACTER.test(characters) || !HIRAGANA_WORD.test(characters))) return [];
    if (selectedJlptLevels.size && !selectedJlptLevels.has(estimatedJlptLevel(subject) ?? "" as JlptLevel)) return [];
    const clue = options.clueMode === "kanji"
      ? (KANJI_CHARACTER.test(characters) ? characters : reading)
      : options.clueMode === "english_kanji" && KANJI_CHARACTER.test(characters)
        ? `${meaning} • ${characters}`
        : meaning;
    const audio = subject.data.pronunciation_audios?.find((item) => item.content_type.includes("mpeg")) ?? subject.data.pronunciation_audios?.[0];
    return [{ subjectId: subject.id, answer: toHiragana(reading), clue, characters, meaning, audioUrl: audio?.url }];
  });
}

function entryOccupiesCell(entry: CrosswordCandidate & Placement, row: number, col: number) {
  return splitKana(entry.answer).some((_, index) => (
    entry.row + (entry.direction === "down" ? index : 0) === row
    && entry.col + (entry.direction === "across" ? index : 0) === col
  ));
}

function findPlacement(grid: Array<Array<string | null>>, answer: string, placed: Array<CrosswordCandidate & Placement>): Placement | null {
  const chars = splitKana(answer);
  let best: Placement | null = null;
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid[row].length; col += 1) {
      for (const direction of ["across", "down"] as const) {
        const endRow = row + (direction === "down" ? chars.length - 1 : 0);
        const endCol = col + (direction === "across" ? chars.length - 1 : 0);
        if (endRow >= grid.length || endCol >= grid[row].length) continue;
        const beforeRow = row - (direction === "down" ? 1 : 0);
        const beforeCol = col - (direction === "across" ? 1 : 0);
        const afterRow = endRow + (direction === "down" ? 1 : 0);
        const afterCol = endCol + (direction === "across" ? 1 : 0);
        const before = grid[beforeRow]?.[beforeCol] ?? null;
        const after = grid[afterRow]?.[afterCol] ?? null;
        if (before || after) continue;
        let crossings = 0;
        let valid = true;
        chars.forEach((character, index) => {
          const r = row + (direction === "down" ? index : 0);
          const c = col + (direction === "across" ? index : 0);
          const current = grid[r][c];
          if (current && current !== character) valid = false;
          if (current === character) {
            const overlapsSameDirection = placed.some((entry) => entry.direction === direction && entryOccupiesCell(entry, r, c));
            if (overlapsSameDirection) valid = false;
            else crossings += 1;
          }
          if (!current) {
            const neighbors = direction === "across" ? [[r - 1, c], [r + 1, c]] : [[r, c - 1], [r, c + 1]];
            if (neighbors.some(([nr, nc]) => nr >= 0 && nr < grid.length && nc >= 0 && nc < grid.length && grid[nr][nc])) valid = false;
          }
        });
        if (valid && crossings > 0 && (!best || crossings > best.crossings)) best = { row, col, direction, crossings };
      }
    }
  }
  return best;
}

export function generateCrossword(subjects: Subject[], size = 13, maxWords = 10, random: () => number = Math.random, options: CrosswordGenerationOptions = {}): CrosswordPuzzle | null {
  const maxWordLength = Math.max(3, size - 2);
  const presetMaxWords = size <= 9 ? 10 : size <= 13 ? 16 : 24;
  const targetWords = Math.min(presetMaxWords, Math.max(2, Math.round(maxWords)));
  const candidates = shuffle(crosswordCandidates(subjects, options).filter((candidate) => splitKana(candidate.answer).length <= maxWordLength), random);
  if (!candidates.length) return null;
  const grid = Array.from({ length: size }, () => Array<string | null>(size).fill(null));
  const placed: Array<CrosswordCandidate & Placement> = [];
  const first = candidates.shift()!;
  const firstChars = splitKana(first.answer);
  const firstRow = Math.floor(size / 2);
  const firstCol = Math.max(0, Math.floor((size - firstChars.length) / 2));
  firstChars.forEach((character, index) => { grid[firstRow][firstCol + index] = character; });
  placed.push({ ...first, row: firstRow, col: firstCol, direction: "across", crossings: 0 });
  for (const candidate of candidates) {
    if (placed.length >= targetWords) break;
    const placement = findPlacement(grid, candidate.answer, placed);
    if (!placement) continue;
    splitKana(candidate.answer).forEach((character, index) => {
      grid[placement.row + (placement.direction === "down" ? index : 0)][placement.col + (placement.direction === "across" ? index : 0)] = character;
    });
    placed.push({ ...candidate, ...placement });
  }
  if (placed.length < 2) return null;

  const occupied = placed.flatMap((entry) => splitKana(entry.answer).map((_, index) => ({ row: entry.row + (entry.direction === "down" ? index : 0), col: entry.col + (entry.direction === "across" ? index : 0) })));
  const minRow = Math.min(...occupied.map((cell) => cell.row));
  const maxRow = Math.max(...occupied.map((cell) => cell.row));
  const minCol = Math.min(...occupied.map((cell) => cell.col));
  const maxCol = Math.max(...occupied.map((cell) => cell.col));
  const starts = new Map<string, number>();
  let nextNumber = 1;
  const entries: CrosswordEntry[] = placed
    .toSorted((a, b) => a.row - b.row || a.col - b.col)
    .map((entry, index) => {
      const key = `${entry.row}:${entry.col}`;
      if (!starts.has(key)) starts.set(key, nextNumber++);
      return { id: `entry-${index}`, subjectId: entry.subjectId, answer: entry.answer, clue: entry.clue, characters: entry.characters, meaning: entry.meaning, audioUrl: entry.audioUrl, row: entry.row - minRow, col: entry.col - minCol, direction: entry.direction, number: starts.get(key)! };
    });
  const cells: CrosswordPuzzle["cells"] = Array.from({ length: maxRow - minRow + 1 }, () => Array(maxCol - minCol + 1).fill(null));
  entries.forEach((entry) => {
    splitKana(entry.answer).forEach((answer, index) => {
      const row = entry.row + (entry.direction === "down" ? index : 0);
      const col = entry.col + (entry.direction === "across" ? index : 0);
      const current = cells[row][col];
      cells[row][col] = { answer, number: index === 0 ? entry.number : current?.number, entryIds: [...(current?.entryIds ?? []), entry.id] };
    });
  });
  return { rows: cells.length, cols: cells[0].length, cells, entries };
}

const GRAMMAR_POINTS = ["ている", "でした", "ません", "ます", "です", "から", "ので", "こと", "よう", "だけ", "まで", "より", "は", "が", "を", "に", "で", "と", "も", "へ", "の", "か", "ね", "よ"];

export function tokenizeJapaneseText(text: string, subjects: Subject[]): StudyTokenDetail[] {
  const normalized = text.normalize("NFKC");
  const matches = subjects.filter((subject) => subject.data.characters).toSorted((a, b) => (b.data.characters?.length ?? 0) - (a.data.characters?.length ?? 0));
  const tokens: StudyTokenDetail[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    const subject = matches.find((candidate) => candidate.data.characters && normalized.startsWith(candidate.data.characters, cursor));
    if (subject?.data.characters) {
      const reading = subject.data.readings?.find((item) => item.primary)?.reading ?? subject.data.readings?.[0]?.reading;
      const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.meanings[0]?.meaning;
      const isVerb = subject.data.parts_of_speech?.some((part) => part.includes("verb"));
      tokens.push({ text: subject.data.characters, type: isVerb ? "verb" : subject.object === "kanji" ? "kanji" : "vocabulary", meaning, reading, partsOfSpeech: subject.data.parts_of_speech });
      cursor += subject.data.characters.length;
      continue;
    }
    const grammar = GRAMMAR_POINTS.find((point) => normalized.startsWith(point, cursor));
    if (grammar) {
      tokens.push({ text: grammar, type: "grammar", meaning: "Common Japanese grammar marker" });
      cursor += grammar.length;
      continue;
    }
    const character = normalized[cursor];
    const type: StudyTokenDetail["type"] = /[\p{Script=Han}]/u.test(character) ? "kanji" : "plain";
    const previous = tokens.at(-1);
    if (previous?.type === "plain" && type === "plain") previous.text += character;
    else tokens.push({ text: character, type });
    cursor += 1;
  }
  return tokens;
}

export function analyzeJapaneseText(text: string, subjects: Subject[]) {
  const normalized = text.normalize("NFKC");
  const matches = subjects
    .filter((subject) => subject.data.characters && normalized.includes(subject.data.characters))
    .toSorted((a, b) => (b.data.characters?.length ?? 0) - (a.data.characters?.length ?? 0) || a.data.level - b.data.level);
  const unique = new Map(matches.map((subject) => [subject.id, subject]));
  const kanji = [...normalized].filter((character, index, all) => /[\p{Script=Han}]/u.test(character) && all.indexOf(character) === index);
  return { matches: [...unique.values()], kanji, characters: Array.from(normalized).length, tokens: tokenizeJapaneseText(normalized, subjects) };
}
