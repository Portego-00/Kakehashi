"use client";

import {
  generateCrossword,
  getCellsForWord,
  getWaniKaniCrosswordWordInputs,
  type CrosswordPuzzle,
  type PlacedCrosswordWord,
} from "@kakehashi/core";
import { Grid3X3, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import {
  convertToHiragana,
  getCompleteHiraganaCharacters,
  getFinalHiraganaInput,
} from "@/lib/kana-input";
import { loadWaniKaniSession } from "@/lib/wanikani-session";
import { useWebSettings } from "@/lib/web-settings";

type CellAnswers = Record<string, string>;
type CrosswordDirection = "across" | "down";

const sizeConfig = {
  small: { gridSize: 9, defaultMaxWords: 6 },
  medium: { gridSize: 13, defaultMaxWords: 10 },
  large: { gridSize: 17, defaultMaxWords: 16 },
};

const allSrsStages = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function CrosswordPage() {
  const { settings, setSetting } = useWebSettings();
  const [puzzle, setPuzzle] = useState<CrosswordPuzzle | null>(null);
  const [answers, setAnswers] = useState<CellAnswers>({});
  const [cellDrafts, setCellDrafts] = useState<CellAnswers>({});
  const [activeCellKey, setActiveCellKey] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const cellRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const activeDirectionRef = useRef<CrosswordDirection>("across");

  const solvedWordIds = useMemo(() => {
    if (!puzzle) return new Set<string>();
    return new Set(
      puzzle.words
        .filter((word) => isWordSolved(puzzle, word, answers))
        .map((word) => word.id)
    );
  }, [answers, puzzle]);

  async function handleGenerate() {
    const session = loadWaniKaniSession();
    if (!session) {
      setMessage("Connect WaniKani before generating a crossword.");
      return;
    }

    setStatus("loading");
    setMessage("Loading your WaniKani vocabulary...");
    setRevealed(false);

    try {
      const wordInputs = await getWaniKaniCrosswordWordInputs(session.apiToken, {
        hiraganaOnly: settings.crosswordHiraganaOnly,
        maxLevel: session.user.level,
        minLevel: 1,
        srsStages: allSrsStages,
      });
      const selectedSize = sizeConfig[settings.crosswordSize];
      const nextPuzzle = generateCrossword(wordInputs, {
        attempts: 18,
        gridSize: selectedSize.gridSize,
        maxWords: settings.crosswordMaxWords || selectedSize.defaultMaxWords,
        seed: Date.now(),
      });

      if (nextPuzzle.words.length === 0) {
        setPuzzle(null);
        setAnswers({});
        setCellDrafts({});
        setActiveCellKey(null);
        setStatus("error");
        setMessage("Not enough vocabulary matched the crossword filters.");
        return;
      }

      setPuzzle(nextPuzzle);
      setAnswers({});
      setCellDrafts({});
      setActiveCellKey(null);
      setStatus("idle");
      setMessage(`Generated ${nextPuzzle.words.length} clues.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Could not generate crossword.");
    }
  }

  function handleCellFocus(row: number, col: number, input: HTMLInputElement) {
    setActiveCellKey(cellKey(row, col));
    setActiveDirection(resolveDirectionForCell(row, col));
    input.select();
  }

  function handleCellChange(row: number, col: number, rawValue: string) {
    const key = cellKey(row, col);
    if (!rawValue) {
      setAnswers((current) => omitKey(current, key));
      setCellDrafts((current) => omitKey(current, key));
      return;
    }

    const characters = getCompleteHiraganaCharacters(rawValue);
    if (characters.length === 0) {
      setAnswers((current) => omitKey(current, key));
      setCellDrafts((current) => ({
        ...current,
        [key]: convertToHiragana(rawValue, true),
      }));
      return;
    }

    fillCharactersFromCell(row, col, characters);
  }

  function handleCellKeyDown(row: number, col: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace") {
      const key = cellKey(row, col);
      if (cellDrafts[key] || answers[key]) {
        return;
      }

      const previousCell = getAdjacentCell(row, col, -1);
      if (!previousCell) return;

      event.preventDefault();
      const previousKey = cellKey(previousCell.row, previousCell.col);
      setAnswers((current) => omitKey(current, previousKey));
      setCellDrafts((current) => omitKey(current, previousKey));
      focusCell(previousCell.row, previousCell.col);
      return;
    }

    const arrowTarget =
      event.key === "ArrowRight"
        ? { row, col: col + 1 }
        : event.key === "ArrowLeft"
          ? { row, col: col - 1 }
          : event.key === "ArrowDown"
            ? { row: row + 1, col }
            : event.key === "ArrowUp"
              ? { row: row - 1, col }
              : null;

    if (arrowTarget && puzzle?.cells[arrowTarget.row]?.[arrowTarget.col]) {
      event.preventDefault();
      setActiveDirection(event.key === "ArrowUp" || event.key === "ArrowDown" ? "down" : "across");
      focusCell(arrowTarget.row, arrowTarget.col);
    }
  }

  function fillCharactersFromCell(row: number, col: number, rawCharacters: string[]) {
    if (!puzzle) return;

    const word = getWordForCell(row, col);
    const cells = word ? getCellsForWord(puzzle, word) : [{ row, col }];
    const startIndex = Math.max(
      0,
      cells.findIndex((cell) => cell.row === row && cell.col === col)
    );
    const characters = rawCharacters.map((value) => normalizeAnswer(value)).filter(Boolean);

    setAnswers((current) => {
      const next = { ...current };
      characters.forEach((character, index) => {
        const cell = cells[startIndex + index];
        if (cell) next[cellKey(cell.row, cell.col)] = character;
      });
      return next;
    });
    setCellDrafts((current) => {
      const next = { ...current };
      characters.forEach((character, index) => {
        const cell = cells[startIndex + index];
        if (cell) next[cellKey(cell.row, cell.col)] = character;
      });
      return next;
    });

    const nextCell = cells[startIndex + characters.length];
    if (nextCell) {
      focusCell(nextCell.row, nextCell.col);
    }
  }

  function getWordForCell(row: number, col: number): PlacedCrosswordWord | undefined {
    if (!puzzle) return undefined;
    const words = puzzle.words.filter((word) =>
      getCellsForWord(puzzle, word).some((cell) => cell.row === row && cell.col === col)
    );
    return words.find((word) => word.direction === activeDirectionRef.current) ?? words[0];
  }

  function resolveDirectionForCell(row: number, col: number): CrosswordDirection {
    const word = getWordForCell(row, col);
    return word?.direction ?? activeDirectionRef.current;
  }

  function getAdjacentCell(row: number, col: number, offset: -1 | 1) {
    if (!puzzle) return null;
    const word = getWordForCell(row, col);
    if (!word) return null;
    const cells = getCellsForWord(puzzle, word);
    const index = cells.findIndex((cell) => cell.row === row && cell.col === col);
    return index === -1 ? null : cells[index + offset] ?? null;
  }

  function focusCell(row: number, col: number) {
    const key = cellKey(row, col);
    setActiveCellKey(key);
    requestAnimationFrame(() => {
      const input = cellRefs.current[key];
      input?.focus();
      input?.select();
    });
  }

  function setActiveDirection(direction: CrosswordDirection) {
    activeDirectionRef.current = direction;
  }

  return (
    <section>
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-sakura-300">Crossword</p>
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">Hiragana crossword</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
            Generates a real crossword from your WaniKani vocabulary using the
            mobile generator now extracted into shared core.
          </p>
        </div>
        <button
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-sakura-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sakura-400 disabled:cursor-not-allowed disabled:bg-sakura-500/60"
          disabled={status === "loading"}
          onClick={handleGenerate}
          type="button"
        >
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Generate
        </button>
      </div>

      <div className="mt-8 grid gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-5 md:grid-cols-3">
        <label className="text-sm text-gray-300">
          Size
          <select
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-sakura-300"
            onChange={(event) =>
              setSetting("crosswordSize", event.target.value as "small" | "medium" | "large")
            }
            value={settings.crosswordSize}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </label>
        <label className="text-sm text-gray-300">
          Max words
          <input
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-sakura-300"
            max={24}
            min={4}
            onChange={(event) => setSetting("crosswordMaxWords", Number(event.target.value))}
            type="number"
            value={settings.crosswordMaxWords}
          />
        </label>
        <label className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/10 px-3 py-2 text-sm text-gray-300">
          <input
            checked={settings.crosswordHiraganaOnly}
            onChange={(event) => setSetting("crosswordHiraganaOnly", event.target.checked)}
            type="checkbox"
          />
          Hiragana-only vocabulary
        </label>
      </div>

      {message ? (
        <p className="mt-5 rounded-lg border border-white/10 bg-black/20 px-4 py-3 text-sm text-gray-200">
          {message}{" "}
          {message.includes("Connect") ? (
            <Link className="font-semibold text-sakura-300" href="/login">
              Connect WaniKani
            </Link>
          ) : null}
        </p>
      ) : null}

      {puzzle ? (
        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="overflow-auto rounded-lg border border-white/10 bg-white/[0.03] p-4">
            <div
              className="mx-auto grid w-max gap-1"
              style={{
                gridTemplateColumns: `repeat(${puzzle.cols}, minmax(0, 38px))`,
              }}
            >
              {puzzle.cells.map((row, rowIndex) =>
                row.map((cell, colIndex) =>
                  cell ? (
                    <label
                      className={[
                        "relative flex h-10 w-10 items-center justify-center rounded border bg-black/30",
                        activeCellKey === cellKey(rowIndex, colIndex)
                          ? "border-sakura-300 bg-sakura-300/10"
                          : "border-white/15",
                      ].join(" ")}
                      key={cellKey(rowIndex, colIndex)}
                    >
                      {cell.number ? (
                        <span className="absolute left-1 top-0.5 text-[10px] text-gray-500">
                          {cell.number}
                        </span>
                      ) : null}
                      <input
                        aria-label={`Row ${rowIndex + 1} column ${colIndex + 1}`}
                        className="h-full w-full rounded bg-transparent pt-2 text-center font-japanese text-lg text-white outline-none focus:bg-sakura-300/10"
                        maxLength={6}
                        onChange={(event) => handleCellChange(rowIndex, colIndex, event.target.value)}
                        onFocus={(event) => handleCellFocus(rowIndex, colIndex, event.currentTarget)}
                        onKeyDown={(event) => handleCellKeyDown(rowIndex, colIndex, event)}
                        ref={(node) => {
                          cellRefs.current[cellKey(rowIndex, colIndex)] = node;
                        }}
                        value={
                          revealed
                            ? cell.solution
                            : cellDrafts[cellKey(rowIndex, colIndex)] ??
                              answers[cellKey(rowIndex, colIndex)] ??
                              ""
                        }
                      />
                    </label>
                  ) : (
                    <div
                      className="h-10 w-10 rounded bg-white/[0.04]"
                      key={cellKey(rowIndex, colIndex)}
                    />
                  )
                )
              )}
            </div>
          </div>

          <aside className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Grid3X3 className="h-5 w-5 text-sakura-300" />
                Clues
              </h2>
              <button
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-sakura-300 hover:text-white"
                onClick={() => setRevealed((current) => !current)}
                type="button"
              >
                {revealed ? "Hide" : "Reveal"}
              </button>
            </div>
            <p className="mt-3 text-sm text-gray-400">
              Solved {solvedWordIds.size} of {puzzle.words.length}
            </p>
            <div className="mt-5 max-h-[620px] space-y-4 overflow-auto pr-2">
              {(["across", "down"] as const).map((direction) => (
                <div key={direction}>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    {direction}
                  </h3>
                  <ol className="mt-3 space-y-3">
                    {puzzle.words
                      .filter((word) => word.direction === direction)
                      .map((word) => (
                        <li key={word.id}>
                          <button
                            className={[
                              "w-full rounded-lg border p-3 text-left text-sm leading-6 transition-colors",
                              solvedWordIds.has(word.id)
                                ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                                : "border-white/10 bg-black/10 text-gray-300 hover:border-sakura-300/50",
                            ].join(" ")}
                            onClick={() => {
                              setActiveDirection(word.direction);
                              focusCell(word.row, word.col);
                            }}
                            type="button"
                          >
                            <span className="font-semibold text-white">{word.number}.</span>{" "}
                            {word.meaning}
                            {word.level ? (
                              <span className="ml-2 text-xs text-gray-500">Lv {word.level}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                  </ol>
                </div>
              ))}
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

function normalizeAnswer(value: string): string {
  return Array.from(getFinalHiraganaInput(value)).slice(-1)[0] ?? "";
}

function omitKey(record: CellAnswers, key: string): CellAnswers {
  if (!(key in record)) return record;
  const next = { ...record };
  delete next[key];
  return next;
}

function isWordSolved(
  puzzle: CrosswordPuzzle,
  word: PlacedCrosswordWord,
  answers: CellAnswers
): boolean {
  return getCellsForWord(puzzle, word).every(
    (cell) => answers[cellKey(cell.row, cell.col)] === cell.solution
  );
}
