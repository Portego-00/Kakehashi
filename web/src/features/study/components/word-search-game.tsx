"use client";

import { Check, Lightbulb, RotateCcw, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import { filterStudySubjects } from "../engine";
import { findWordSearchEntry, generateWordSearch, wordSearchSelectionPath } from "../games";
import { loadModeState, saveModeState, type StudyStorageScope } from "../storage";
import type { StudyDataset, StudyFilters, WordSearchCell, WordSearchPuzzle } from "../types";
import styles from "../study.module.css";

interface SavedWordSearch {
  puzzle: WordSearchPuzzle;
  foundEntryIds: string[];
  mistakes: number;
  signature: string;
}

type SelectionFeedback = "idle" | "correct" | "incorrect";

function boardSizeForWordCount(wordCount: number) {
  if (wordCount <= 5) return 8;
  if (wordCount <= 10) return 10;
  return 12;
}

function cellKey(cell: WordSearchCell) {
  return `${cell.row}:${cell.col}`;
}

function createWordSearchGame(dataset: StudyDataset, filters: StudyFilters, signature: string): SavedWordSearch | null {
  const subjects = filterStudySubjects(dataset, filters);
  const puzzle = generateWordSearch(subjects, filters.wordSearchDirection, boardSizeForWordCount(filters.count), filters.count);
  return puzzle ? { puzzle, foundEntryIds: [], mistakes: 0, signature } : null;
}

export function WordSearchGame({ dataset, filters, scope, onExit }: { dataset: StudyDataset; filters: StudyFilters; scope: StudyStorageScope; onExit: () => void }) {
  const signature = JSON.stringify({
    direction: filters.wordSearchDirection,
    count: filters.count,
    srs: filters.srsGroups,
    levels: [filters.minLevel, filters.maxLevel],
    ids: filters.selectedSubjectIds,
  });
  const [game, setGame] = useState<SavedWordSearch | null>(() => {
    const stored = loadModeState<SavedWordSearch>(scope, "word-search", "game");
    if (stored?.signature === signature && stored.puzzle?.direction === filters.wordSearchDirection && stored.puzzle.entries?.length) return stored;
    return createWordSearchGame(dataset, filters, signature);
  });
  const [activeEntryId, setActiveEntryId] = useState<string | null>(() => game?.puzzle.entries.find((entry) => !game.foundEntryIds.includes(entry.id))?.id ?? null);
  const [selectionStart, setSelectionStart] = useState<WordSearchCell | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<WordSearchCell | null>(null);
  const [feedback, setFeedback] = useState<SelectionFeedback>("idle");
  const [hintedCell, setHintedCell] = useState<string | null>(null);
  const [message, setMessage] = useState("Drag across a word, or choose its first and last character.");
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; origin: WordSearchCell; current: WordSearchCell; moved: boolean } | null>(null);
  const ignoreClickRef = useRef(false);
  const feedbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (game) saveModeState(scope, "word-search", "game", game);
  }, [game, scope]);
  useEffect(() => () => {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
  }, []);

  const puzzle = game?.puzzle ?? null;
  const foundIds = useMemo(() => new Set(game?.foundEntryIds ?? []), [game?.foundEntryIds]);
  const activeEntry = puzzle?.entries.find((entry) => entry.id === activeEntryId && !foundIds.has(entry.id))
    ?? puzzle?.entries.find((entry) => !foundIds.has(entry.id))
    ?? null;
  const selectedPath = useMemo(() => selectionStart && selectionEnd ? wordSearchSelectionPath(selectionStart, selectionEnd) : [], [selectionEnd, selectionStart]);
  const selectedCellKeys = useMemo(() => new Set(selectedPath.map(cellKey)), [selectedPath]);
  const foundCellKeys = useMemo(() => {
    const keys = new Set<string>();
    puzzle?.entries.forEach((entry) => {
      if (foundIds.has(entry.id)) entry.path.forEach((cell) => keys.add(cellKey(cell)));
    });
    return keys;
  }, [foundIds, puzzle]);
  const complete = Boolean(puzzle?.entries.length && foundIds.size === puzzle.entries.length);

  const clearFeedbackSoon = () => {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback("idle");
      setSelectionStart(null);
      setSelectionEnd(null);
    }, 420);
  };

  const resolveSelection = (start: WordSearchCell, end: WordSearchCell) => {
    if (!game) return;
    const path = wordSearchSelectionPath(start, end);
    setSelectionStart(start);
    setSelectionEnd(end);
    if (path.length < 2) {
      setFeedback("incorrect");
      setMessage("Words run in a straight horizontal, vertical, or diagonal line.");
      clearFeedbackSoon();
      return;
    }
    const entry = findWordSearchEntry(game.puzzle, path, foundIds);
    if (!entry) {
      setGame({ ...game, mistakes: game.mistakes + 1 });
      setFeedback("incorrect");
      setMessage("That line is not one of the remaining words.");
      clearFeedbackSoon();
      return;
    }
    const nextFoundEntryIds = [...game.foundEntryIds, entry.id];
    const nextFoundIds = new Set(nextFoundEntryIds);
    const nextEntry = game.puzzle.entries.find((candidate) => !nextFoundIds.has(candidate.id));
    setGame({ ...game, foundEntryIds: nextFoundEntryIds });
    setActiveEntryId(nextEntry?.id ?? null);
    setHintedCell(null);
    setFeedback("correct");
    setMessage(nextEntry ? `${entry.prompt} found. Choose another clue or keep scanning.` : "Every word is found.");
    clearFeedbackSoon();
  };

  const chooseEndpoint = (cell: WordSearchCell) => {
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    setFeedback("idle");
    if (!selectionStart) {
      setSelectionStart(cell);
      setSelectionEnd(cell);
      setMessage("Start selected. Choose the last character in the word.");
      return;
    }
    resolveSelection(selectionStart, cell);
  };

  const cellFromPointer = (event: ReactPointerEvent<HTMLDivElement>): WordSearchCell | null => {
    if (!puzzle || !gridRef.current) return null;
    const rect = gridRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const x = Math.min(rect.width - 1, Math.max(0, event.clientX - rect.left));
    const y = Math.min(rect.height - 1, Math.max(0, event.clientY - rect.top));
    return {
      row: Math.min(puzzle.size - 1, Math.floor((y / rect.height) * puzzle.size)),
      col: Math.min(puzzle.size - 1, Math.floor((x / rect.width) * puzzle.size)),
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = cellFromPointer(event);
    if (!origin) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerId: event.pointerId, origin, current: origin, moved: false };
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const current = cellFromPointer(event);
    if (!current || cellKey(current) === cellKey(drag.current)) return;
    drag.current = current;
    drag.moved = drag.moved || cellKey(current) !== cellKey(drag.origin);
    if (drag.moved) {
      setSelectionStart(drag.origin);
      setSelectionEnd(current);
      setFeedback("idle");
    }
  };
  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    ignoreClickRef.current = true;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (drag.moved) resolveSelection(drag.origin, drag.current);
    else chooseEndpoint(drag.origin);
  };
  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setSelectionStart(null);
    setSelectionEnd(null);
  };
  const onCellClick = (event: ReactMouseEvent<HTMLButtonElement>, cell: WordSearchCell) => {
    if (ignoreClickRef.current) {
      ignoreClickRef.current = false;
      return;
    }
    chooseEndpoint(cell);
  };

  const startNewPuzzle = () => {
    const next = createWordSearchGame(dataset, filters, signature);
    setGame(next);
    setActiveEntryId(next?.puzzle.entries[0]?.id ?? null);
    setSelectionStart(null);
    setSelectionEnd(null);
    setFeedback("idle");
    setHintedCell(null);
    setMessage("Drag across a word, or choose its first and last character.");
  };

  if (!game || !puzzle) {
    return (
      <section className={styles.emptyPanel}>
        <h2>Couldn’t build a word search</h2>
        <p>Widen the level or SRS range so there are at least two learned vocabulary words with kanji.</p>
        <button className={styles.primaryButton} onClick={onExit}>Back to setup</button>
      </section>
    );
  }

  if (complete) {
    return (
      <section className={styles.wordSearchShell} data-complete="true">
        <header className={styles.wordSearchHeader}>
          <div><h2>Word search</h2><p>{puzzle.entries.length} words · complete</p></div>
          <button className={styles.iconButton} onClick={onExit} aria-label="Close word search results"><X size={19} /></button>
        </header>
        <div className={styles.wordSearchResults}>
          <div className={styles.wordSearchResultLead} role="status">
            <span className={styles.resultMark} aria-hidden="true"><Check size={27} /></span>
            <div><h2>All words found</h2><p>{game.mistakes ? `${game.mistakes} ${game.mistakes === 1 ? "line" : "lines"} didn’t match.` : "A clean board with no missed lines."}</p></div>
          </div>
          <ul className={styles.wordSearchReview} aria-label="Found vocabulary">
            {puzzle.entries.map((entry) => (
              <li key={entry.id}>
                <span lang="ja">{entry.prompt}</span>
                <span aria-hidden="true">→</span>
                <strong lang="ja">{entry.answer}</strong>
                <small>{entry.meaning}</small>
              </li>
            ))}
          </ul>
          <div className={styles.wordSearchResultActions}>
            <button className={styles.secondaryButton} onClick={onExit}>Back to setup</button>
            <button className={styles.primaryButton} onClick={startNewPuzzle}><RotateCcw size={17} /> New puzzle</button>
          </div>
        </div>
      </section>
    );
  }

  const directionLabel = puzzle.direction === "kanji-to-kana" ? "Find the kana reading" : "Find the written word";
  return (
    <section className={styles.wordSearchShell}>
      <header className={styles.wordSearchHeader}>
        <div><h2>Word search</h2><p>Words can run in any straight line, forwards or backwards.</p></div>
        <div className={styles.wordSearchHeaderActions}>
          <span><b>{foundIds.size}</b> / {puzzle.entries.length} found</span>
          <button className={styles.iconButton} onClick={onExit} aria-label="Pause word search"><X size={19} /></button>
        </div>
      </header>

      <div className={styles.wordSearchWorkbench}>
        <aside className={styles.wordSearchClues} aria-label="Vocabulary clues">
          <div className={styles.wordSearchClueHeader}><h3>Words</h3><span>{directionLabel}</span></div>
          <div className={styles.wordSearchClueList}>
            {puzzle.entries.map((entry) => {
              const found = foundIds.has(entry.id);
              const active = activeEntry?.id === entry.id;
              return (
                <button key={entry.id} type="button" data-active={active} data-found={found} aria-pressed={active} aria-label={`${entry.prompt}, ${entry.meaning}, ${found ? "found" : `${Array.from(entry.answer).length} characters`}`} disabled={found} onClick={() => { setActiveEntryId(entry.id); setHintedCell(null); setMessage(`${directionLabel}: ${entry.prompt}.`); }}>
                  <span lang="ja">{entry.prompt}</span>
                  <small>{entry.meaning}</small>
                  {found ? <Check size={16} aria-label="Found" /> : <span>{Array.from(entry.answer).length}</span>}
                </button>
              );
            })}
          </div>
        </aside>

        <div className={styles.wordSearchBoardPane}>
          <div className={styles.wordSearchPrompt}>
            <div>
              <span>{directionLabel}</span>
              <strong lang="ja">{activeEntry?.prompt}</strong>
              <small>{activeEntry?.meaning}</small>
            </div>
            <button type="button" className={styles.crosswordHintButton} disabled={!activeEntry || hintedCell === cellKey(activeEntry.path[0])} onClick={() => {
              if (!activeEntry) return;
              setHintedCell(cellKey(activeEntry.path[0]));
              setMessage(`Hint: ${activeEntry.prompt} starts at row ${activeEntry.path[0].row + 1}, column ${activeEntry.path[0].col + 1}.`);
            }}><Lightbulb size={16} /> Show first character</button>
          </div>
          <div className={styles.wordSearchBoardViewport}>
            <div
              ref={gridRef}
              className={styles.wordSearchGrid}
              data-feedback={feedback}
              style={{ "--word-search-size": puzzle.size } as React.CSSProperties}
              aria-label={`${puzzle.size} by ${puzzle.size} Japanese word search`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            >
              {puzzle.grid.map((row, rowIndex) => row.map((character, colIndex) => {
                const cell = { row: rowIndex, col: colIndex };
                const key = cellKey(cell);
                const selected = selectedCellKeys.has(key);
                const found = foundCellKeys.has(key);
                const hinted = hintedCell === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={styles.wordSearchCell}
                    data-word-search-cell={key}
                    data-selected={selected}
                    data-found={found}
                    data-hinted={hinted}
                    aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}: ${character}${found ? ", found" : selected ? ", selected" : ""}`}
                    onClick={(event) => onCellClick(event, cell)}
                    lang="ja"
                  >
                    {character}
                  </button>
                );
              }))}
            </div>
          </div>
          <footer className={styles.wordSearchStatus}>
            <p role="status" aria-live="polite">{message}</p>
            {selectionStart && feedback === "idle" ? <button type="button" className={styles.textButton} onClick={() => { setSelectionStart(null); setSelectionEnd(null); setMessage("Selection cleared."); }}>Clear selection</button> : null}
          </footer>
        </div>
      </div>
    </section>
  );
}
