"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { toHiragana } from "wanakana";
import { ArrowLeft, ArrowRight, Check, Eye, Keyboard, Library, Lightbulb, RotateCcw, Trash2, Undo2, X } from "lucide-react";
import { createListRepository, subscribeSubjectLists, type ListStorage } from "@/features/subjects/lists";
import type { Subject } from "@/types/wanikani";
import { analyzeJapaneseText, chooseWordleCandidate, evaluateWordleGuess, generateCrossword, isValidWordleGuess, splitKana, wordleCandidates } from "../games";
import { filterStudySubjects, shuffle } from "../engine";
import { composeKanaInput } from "../kana-composition";
import { clearModeState, loadModeState, loadSubjectLists, saveModeState } from "../storage";
import type { CrosswordPuzzle, StudyDataset, StudyFilters, SubjectList } from "../types";
import type { StudyStorageScope } from "../storage";
import { buildSimilarKanjiBoards } from "../similar-kanji";
import { CROSSWORD_SIZE_PRESETS } from "../mode-config";
import { loadKanjiStrokeData, medianPoint, validateStroke, type KanjiStrokeData } from "../stroke-data";
import styles from "../study.module.css";

const subjectListStorage: ListStorage = {
  getItem: (key) => typeof window === "undefined" ? null : window.localStorage.getItem(key),
  setItem: (key, value) => { if (typeof window !== "undefined") window.localStorage.setItem(key, value); },
};

function primaryMeaning(subject: Subject) {
  return subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.meanings[0]?.meaning ?? "Unknown";
}

function primaryReading(subject: Subject) {
  return subject.data.readings?.find((item) => item.primary)?.reading ?? subject.data.readings?.[0]?.reading ?? "";
}

function plainMnemonic(value?: string) {
  return value?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() ?? "";
}

export function TextAnalysis({ subjects, scope }: { subjects: Subject[]; scope: StudyStorageScope }) {
  const [text, setText] = useState(() => loadModeState<string>(scope, "text-analysis", "draft") ?? "");
  const [view, setView] = useState<"library" | "grammar">("library");
  const [selectedToken, setSelectedToken] = useState<number | null>(null);
  const [translation, setTranslation] = useState("");
  const [translationState, setTranslationState] = useState<"idle" | "loading" | "error">("idle");
  const analysis = useMemo(() => analyzeJapaneseText(text, subjects), [subjects, text]);
  const translate = async () => {
    if (!text.trim()) return;
    setTranslationState("loading");
    try {
      const response = await fetch("/translator/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, target: "en" }) });
      const payload = await response.json() as { translation?: string };
      if (!response.ok || !payload.translation) throw new Error("Translation unavailable");
      setTranslation(payload.translation); setTranslationState("idle");
    } catch { setTranslationState("error"); }
  };
  return (
    <div className={styles.toolLayout}>
      <section className={styles.toolPanel}>
        <label className={styles.largeField}><span>Japanese text</span><textarea value={text} onChange={(event) => { setText(event.target.value); saveModeState(scope, "text-analysis", "draft", event.target.value); setSelectedToken(null); }} placeholder="日本語の文章をここに貼り付けてください。" lang="ja" autoFocus /></label>
        <div className={styles.analysisStats}><span>{analysis.characters} characters</span><span>{analysis.kanji.length} unique kanji</span><span>{analysis.matches.length} matches</span></div>
        <div className={styles.analysisActions}><button className={styles.secondaryButton} type="button" onClick={() => void translate()} disabled={!text.trim() || translationState === "loading"}>{translationState === "loading" ? "Translating…" : "Translate to English"}</button>{translationState === "error" ? <span role="alert">Translation backend is unavailable.</span> : null}</div>
        {translation ? <div className={styles.translationPanel}><h2>Translation</h2><p>{translation}</p></div> : null}
      </section>
      <section className={styles.analysisResults} aria-live="polite">
        <div className={styles.analysisHeader}><h2>{view === "library" ? "WaniKani matches" : "Grammar and tokens"}</h2><div className={styles.lengthTabs} role="group" aria-label="Analysis view"><button data-active={view === "library"} onClick={() => setView("library")}>Library</button><button data-active={view === "grammar"} onClick={() => setView("grammar")}>Grammar</button></div></div>
        {!text.trim() ? <p>Paste Japanese to inspect vocabulary, kanji, verbs, and grammar markers.</p> : view === "library" ? analysis.matches.length ? <div className={styles.analysisList}>{analysis.matches.map((subject) => <article key={subject.id} data-type={subject.object}><strong lang="ja">{subject.data.characters}</strong><div><h3>{primaryMeaning(subject)}</h3><p lang="ja">{primaryReading(subject) || subject.object.replace("_", " ")}</p></div><span>Level {subject.data.level}</span></article>)}</div> : <p>No exact WaniKani subjects were found in this text.</p> : <><div className={styles.tokenizedText} lang="ja">{analysis.tokens.map((token, index) => token.type === "plain" ? <span key={index}>{token.text}</span> : <button type="button" key={index} data-token-type={token.type} data-active={selectedToken === index} onClick={() => setSelectedToken(index)}>{token.text}</button>)}</div>{selectedToken !== null && analysis.tokens[selectedToken] ? <article className={styles.tokenDetail}><h3>{analysis.tokens[selectedToken].text}</h3><p>{analysis.tokens[selectedToken].type}{analysis.tokens[selectedToken].partsOfSpeech?.length ? ` · ${analysis.tokens[selectedToken].partsOfSpeech!.join(", ")}` : ""}</p>{analysis.tokens[selectedToken].reading ? <p lang="ja">Reading: {analysis.tokens[selectedToken].reading}</p> : null}{analysis.tokens[selectedToken].meaning ? <strong>{analysis.tokens[selectedToken].meaning}</strong> : null}</article> : <p>Select an underlined token for details.</p>}</>}
      </section>
    </div>
  );
}

type Point = { x: number; y: number };
type Stroke = Point[];

export function WritingPractice({ dataset, filters, scope, onExit }: { dataset: StudyDataset; filters: StudyFilters; scope: StudyStorageScope; onExit: () => void }) {
  const [saved] = useState(() => loadModeState<{ index: number; correct: number; subjectIds: number[] }>(scope, "kanji-writing", "progress"));
  const eligible = useMemo(() => filterStudySubjects(dataset, { ...filters, subjectTypes: ["kanji"] }), [dataset, filters]);
  const kanji = useMemo(() => {
    const byId = new Map(eligible.map((subject) => [subject.id, subject]));
    const restored = saved?.subjectIds?.map((id) => byId.get(id)).filter((subject): subject is Subject => Boolean(subject));
    return restored?.length ? restored : shuffle(eligible).slice(0, filters.count);
  }, [eligible, filters.count, saved]);
  const [index, setIndex] = useState(() => Math.min(saved?.index ?? 0, kanji.length));
  const [correct, setCorrect] = useState(saved?.correct ?? 0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [strokeData, setStrokeData] = useState<KanjiStrokeData | null>(null);
  const [strokeIndex, setStrokeIndex] = useState(0);
  const [strokeMessage, setStrokeMessage] = useState(() => filters.writingMode === "guided" ? "Loading stroke order…" : "Draw the complete kanji, then grade your recall.");
  const drawing = useRef(false);
  const strokeBuffer = useRef<Stroke>([]);
  const subject = kanji[index];

  useEffect(() => {
    saveModeState(scope, "kanji-writing", "progress", { index, correct, subjectIds: kanji.map((item) => item.id) });
  }, [correct, index, kanji, scope]);
  useEffect(() => {
    if (!subject?.data.characters || filters.writingMode !== "guided") return;
    let cancelled = false;
    void loadKanjiStrokeData(subject.data.characters).then((data) => { if (!cancelled) { setStrokeData(data); setStrokeMessage("Draw stroke 1 in the highlighted direction."); } }).catch(() => { if (!cancelled) setStrokeMessage("Stroke data is unavailable; use freehand or the keyboard path."); });
    return () => { cancelled = true; };
  }, [filters.writingMode, subject?.data.characters]);

  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * 1024, y: ((event.clientY - rect.top) / rect.height) * 1024 };
  };
  const finish = (remembered: boolean) => {
    const nextIndex = index + 1;
    const nextCorrect = correct + Number(remembered);
    if (nextIndex >= kanji.length) {
      saveModeState(scope, "kanji-writing", "progress", { index: nextIndex, correct: nextCorrect, subjectIds: kanji.map((item) => item.id) });
      setIndex(nextIndex);
      setCorrect(nextCorrect);
      return;
    }
    setIndex(nextIndex); setCorrect(nextCorrect); setStrokes([]); setShowAnswer(false); setStrokeIndex(0); setStrokeData(null); setStrokeMessage(filters.writingMode === "guided" ? "Loading stroke order…" : "Draw the complete kanji, then grade your recall.");
    saveModeState(scope, "kanji-writing", "progress", { index: nextIndex, correct: nextCorrect, subjectIds: kanji.map((item) => item.id) });
  };
  if (!subject) {
    return <section className={styles.results}><div className={styles.resultMark}><Check size={34} /></div><h2>{kanji.length ? "Writing complete" : "No kanji available"}</h2>{kanji.length ? <><p>You recalled {correct} of {kanji.length} kanji.</p><dl className={styles.resultStats}><div><dt>Recall</dt><dd>{Math.round((correct / kanji.length) * 100)}%</dd></div><div><dt>Remembered</dt><dd>{correct}</dd></div><div><dt>Practiced</dt><dd>{kanji.length}</dd></div></dl></> : <p>Try widening the selected level, SRS range, or subject-list filter.</p>}<button className={styles.primaryButton} onClick={() => { clearModeState(scope, "kanji-writing", "progress"); onExit(); }}>Back to setup</button></section>;
  }
  return (
    <section className={styles.writingShell}>
      <div className={styles.quizTopbar}><span>{index + 1} / {kanji.length}</span><p>Write the kanji for <strong>{primaryMeaning(subject)}</strong></p><button className={styles.iconButton} onClick={onExit} aria-label="Pause writing practice"><X size={19} /></button></div>
      <div className={styles.writingStage}>
        <svg className={styles.writingCanvas} viewBox="0 0 1024 1024" role="img" aria-label={`Drawing area for ${primaryMeaning(subject)}. ${strokeMessage}`} onPointerDown={(event) => { drawing.current = true; event.currentTarget.setPointerCapture(event.pointerId); const first = point(event); strokeBuffer.current = [first]; setStrokes((value) => [...value, [first]]); }} onPointerMove={(event) => { if (!drawing.current) return; const next = point(event); strokeBuffer.current = [...strokeBuffer.current, next]; setStrokes((value) => value.map((stroke, itemIndex) => itemIndex === value.length - 1 ? [...stroke, next] : stroke)); }} onPointerUp={() => { drawing.current = false; if (filters.writingMode === "guided" && strokeData?.medians[strokeIndex]) { const result = validateStroke(strokeBuffer.current, strokeData.medians[strokeIndex]); setStrokeMessage(result.message); if (result.correct) setStrokeIndex((value) => value + 1); else setStrokes((value) => value.slice(0, -1)); } }} onPointerCancel={() => { drawing.current = false; }}>
          <path d="M512 0V1024M0 512H1024M0 0L1024 1024M1024 0L0 1024" className={styles.guideLines} />
          {filters.writingMode === "guided" && strokeData?.medians[strokeIndex] ? <polyline className={styles.expectedStroke} points={strokeData.medians[strokeIndex].map((item) => { const value = medianPoint(item); return `${value.x},${value.y}`; }).join(" ")} /> : null}
          {showAnswer ? <text x="512" y="720" textAnchor="middle" className={styles.answerGhost}>{subject.data.characters}</text> : null}
          {strokes.map((stroke, strokeIndex) => <polyline key={strokeIndex} points={stroke.map((item) => `${item.x},${item.y}`).join(" ")} className={styles.inkStroke} />)}
        </svg>
        <p className={styles.strokeStatus} role="status">{filters.writingMode === "guided" && strokeData ? `Stroke ${Math.min(strokeIndex + 1, strokeData.medians.length)} of ${strokeData.medians.length} · ${strokeMessage}` : strokeMessage}</p>
        <div className={styles.canvasTools}><button className={styles.secondaryButton} onClick={() => { setStrokes((value) => value.slice(0, -1)); if (filters.writingMode === "guided") setStrokeIndex((value) => Math.max(0, value - 1)); }} disabled={!strokes.length}><Undo2 size={16} /> Undo</button><button className={styles.secondaryButton} onClick={() => { setStrokes([]); setStrokeIndex(0); }} disabled={!strokes.length}><Trash2 size={16} /> Clear</button><button className={styles.secondaryButton} onClick={() => setShowAnswer((value) => !value)}><Eye size={16} /> {showAnswer ? "Hide" : "Show"} answer</button>{filters.writingMode === "guided" && strokeData && strokeIndex < strokeData.medians.length ? <button className={styles.secondaryButton} onClick={() => { setStrokeIndex((value) => value + 1); setStrokeMessage("Stroke practiced with keyboard guidance."); }}><Keyboard size={16} /> Practice next stroke</button> : null}</div>
      </div>
      <div className={styles.recallActions}><button className={styles.missButton} onClick={() => finish(false)}><X size={18} /> Needs work</button><button className={styles.primaryButton} disabled={filters.writingMode === "guided" && Boolean(strokeData) && strokeIndex < strokeData!.medians.length} onClick={() => finish(true)}><Check size={18} /> {filters.writingMode === "guided" ? "Stroke order complete" : "I remembered"}</button></div>
    </section>
  );
}

interface SavedCrossword { puzzle: CrosswordPuzzle | null; values: Record<string, string>; checked: boolean; signature: string }

function playAudio(url?: string) {
  if (!url || typeof Audio === "undefined") return;
  void new Audio(url).play();
}

const HIRAGANA_CELL = /^[\p{Script=Hiragana}ー〜～]$/u;

function CrosswordKanaInput({ label, value, onCommit }: { label: string; value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);

  return <input aria-label={label} lang="ja" value={draft} maxLength={4} onBlur={() => setDraft(value)} onChange={(event) => {
    const composed = composeKanaInput(event.target.value);
    setDraft(composed);
    const characters = splitKana(composed);
    if (!characters.length || !characters.every((character) => HIRAGANA_CELL.test(character))) return;
    onCommit(characters[0]);
    setDraft(characters[0]);
    const current = event.currentTarget;
    window.requestAnimationFrame(() => {
      const inputs = Array.from(current.closest('[aria-label="Crossword grid"]')?.querySelectorAll("input") ?? []);
      inputs[inputs.indexOf(current) + 1]?.focus();
    });
  }} />;
}

export function CrosswordGame({ dataset, filters, scope, onExit }: { dataset: StudyDataset; filters: StudyFilters; scope: StudyStorageScope; onExit: () => void }) {
  const subjects = useMemo(() => filterStudySubjects(dataset, { ...filters, subjectTypes: ["vocabulary", "kana_vocabulary"] }), [dataset, filters]);
  const stored = loadModeState<SavedCrossword>(scope, "crossword", "game");
  const preset = CROSSWORD_SIZE_PRESETS[filters.crosswordSize];
  const signature = JSON.stringify({ size: filters.crosswordSize, words: filters.crosswordMaxWords, srs: filters.srsGroups, levels: [filters.minLevel, filters.maxLevel], ids: filters.selectedSubjectIds, jlpt: filters.crosswordJlptLevels, hiragana: filters.crosswordHiraganaOnly, clues: filters.crosswordClueMode });
  const [game, setGame] = useState<SavedCrossword>(() => stored?.signature === signature ? stored : {
    puzzle: generateCrossword(subjects, preset.gridSize, filters.crosswordMaxWords, Math.random, { clueMode: filters.crosswordClueMode, hiraganaOnly: filters.crosswordHiraganaOnly, jlptLevels: filters.crosswordJlptLevels }),
    values: {},
    checked: false,
    signature,
  });
  const puzzle = game.puzzle;
  const allCorrect = puzzle ? puzzle.cells.every((row, rowIndex) => row.every((cell, colIndex) => !cell || game.values[`${rowIndex}:${colIndex}`] === cell.answer)) : false;
  const update = (key: string, value: string) => {
    if (!puzzle) return;
    const values = { ...game.values, [key]: splitKana(value).at(-1) ?? "" };
    if (filters.crosswordPlayAudioOnCorrect) {
      for (const entry of puzzle.entries) {
        const cells = splitKana(entry.answer).map((_, index) => `${entry.row + (entry.direction === "down" ? index : 0)}:${entry.col + (entry.direction === "across" ? index : 0)}`);
        const wasComplete = cells.every((cell, index) => game.values[cell] === splitKana(entry.answer)[index]);
        const isComplete = cells.every((cell, index) => values[cell] === splitKana(entry.answer)[index]);
        if (!wasComplete && isComplete) playAudio(entry.audioUrl);
      }
    }
    const next = { ...game, values, checked: false };
    setGame(next); saveModeState(scope, "crossword", "game", next);
  };
  if (!puzzle) return <section className={styles.emptyPanel}><h2>Couldn’t build a crossword</h2><p>Widen the level range so there are more intersecting vocabulary readings.</p><button className={styles.primaryButton} onClick={onExit}>Back to setup</button></section>;
  return (
    <section className={styles.gameShell}>
      <div className={styles.gameHeading}><div><h2>Hiragana crossword</h2><p>{puzzle.entries.length} clues · progress is saved in this browser</p></div><button className={styles.iconButton} onClick={onExit} aria-label="Pause crossword"><X size={19} /></button></div>
      <div className={styles.crosswordLayout}>
        <div className={styles.crosswordGrid} style={{ gridTemplateColumns: `repeat(${puzzle.cols}, minmax(2.75rem, 2.8rem))` }} aria-label="Crossword grid">{puzzle.cells.flatMap((row, rowIndex) => row.map((cell, colIndex) => {
          if (!cell) return <span key={`${rowIndex}:${colIndex}`} className={styles.blockedCell} aria-hidden="true" />;
          const key = `${rowIndex}:${colIndex}`; const value = game.values[key] ?? ""; const incorrect = game.checked && value !== cell.answer;
          return <label className={styles.crosswordCell} key={`${rowIndex}:${colIndex}`} data-incorrect={incorrect}><span>{cell.number}</span><CrosswordKanaInput key={value} label={`Row ${rowIndex + 1}, column ${colIndex + 1}`} value={value} onCommit={(nextValue) => update(key, nextValue)} /></label>;
        }))}</div>
        <div className={styles.clues}><div><h3>Across</h3>{puzzle.entries.filter((entry) => entry.direction === "across").map((entry) => <p key={entry.id}><b>{entry.number}</b> {entry.clue}</p>)}</div><div><h3>Down</h3>{puzzle.entries.filter((entry) => entry.direction === "down").map((entry) => <p key={entry.id}><b>{entry.number}</b> {entry.clue}</p>)}</div></div>
      </div>
      <div className={styles.gameActions}><button className={styles.secondaryButton} onClick={() => { const values: Record<string, string> = {}; puzzle.cells.forEach((row, rowIndex) => row.forEach((cell, colIndex) => { if (cell) values[`${rowIndex}:${colIndex}`] = cell.answer; })); const next = { ...game, values, checked: true }; setGame(next); saveModeState(scope, "crossword", "game", next); }}><Lightbulb size={17} /> Reveal</button><button className={styles.primaryButton} onClick={() => { const next = { ...game, checked: true }; setGame(next); saveModeState(scope, "crossword", "game", next); }}>{allCorrect ? <Check size={17} /> : null}{allCorrect ? "Solved" : "Check puzzle"}</button></div>
      {game.checked || allCorrect ? <div className={styles.clues} aria-label="Crossword solutions"><div><h3>Solutions</h3>{puzzle.entries.toSorted((left, right) => left.number - right.number).map((entry) => <p key={entry.id}><b>{entry.number}</b> {filters.crosswordShowKanjiSolutions && entry.characters !== entry.answer ? <><span lang="ja">{entry.characters}</span> · </> : null}<span lang="ja">{entry.answer}</span> · {entry.meaning}</p>)}</div></div> : null}
    </section>
  );
}

interface SavedWordle { targetId: number; target: string; guesses: string[]; maxAttempts: number; length: number; validWords: string[]; signature: string }

export function KanaWordle({ dataset, filters, scope, onExit }: { dataset: StudyDataset; filters: StudyFilters; scope: StudyStorageScope; onExit: () => void }) {
  const stored = loadModeState<SavedWordle>(scope, "kana-wordle", "game");
  const [length, setLength] = useState(filters.wordLength);
  const signature = JSON.stringify({ length, attempts: filters.wordleMaxAttempts, srs: filters.srsGroups, levels: [filters.minLevel, filters.maxLevel], types: filters.subjectTypes, ids: filters.selectedSubjectIds });
  const candidates = useMemo(() => wordleCandidates(filterStudySubjects(dataset, filters), length), [dataset, filters, length]);
  const [game, setGame] = useState<SavedWordle | null>(() => {
    if (stored?.signature === signature && stored.validWords?.length && candidates.some((candidate) => candidate.subject.id === stored.targetId && candidate.reading === stored.target)) return stored;
    const pick = chooseWordleCandidate(candidates);
    return pick ? { targetId: pick.subject.id, target: pick.reading, guesses: [], maxAttempts: filters.wordleMaxAttempts, length, validWords: candidates.map((item) => item.reading), signature } : null;
  });
  const [guess, setGuess] = useState("");
  const [guessError, setGuessError] = useState("");
  const targetSubject = dataset.subjects.find((subject) => subject.id === game?.targetId);
  const won = Boolean(game?.guesses.some((item) => toHiragana(item) === toHiragana(game.target)));
  const lost = Boolean(game && game.guesses.length >= game.maxAttempts && !won);
  const submit = () => {
    if (!game) return;
    const normalized = toHiragana(guess);
    if (splitKana(normalized).length !== splitKana(game.target).length) return;
    if (!isValidWordleGuess(normalized, game.validWords.map((reading) => ({ reading })))) { setGuessError("Enter a vocabulary reading from the selected study pool."); return; }
    const next = { ...game, guesses: [...game.guesses, normalized] };
    setGame(next); setGuess(""); setGuessError(""); saveModeState(scope, "kana-wordle", "game", next);
  };
  const newGame = () => {
    const pool = wordleCandidates(filterStudySubjects(dataset, filters), length);
    const pick = chooseWordleCandidate(pool);
    if (!pick) { setGame(null); return; }
    const next = { targetId: pick.subject.id, target: pick.reading, guesses: [], maxAttempts: filters.wordleMaxAttempts, length, validWords: pool.map((item) => item.reading), signature };
    setGame(next); setGuess(""); setGuessError(""); saveModeState(scope, "kana-wordle", "game", next);
  };
  return (
    <section className={styles.wordleShell}>
      <div className={styles.gameHeading}><div><h2>Kana Wordle</h2><p>Small kana count as their own tile.</p></div><button className={styles.iconButton} onClick={onExit} aria-label="Pause Kana Wordle"><X size={19} /></button></div>
      <div className={styles.lengthTabs} role="group" aria-label="Word length">{[3, 4, 5, 6, 7].map((item) => <button key={item} data-active={length === item} onClick={() => { setLength(item); clearModeState(scope, "kana-wordle", "game"); setGame(null); setGuessError(""); }}>{item} kana</button>)}</div>
      {!game ? <div className={styles.emptyPanel}><p>No {length}-kana vocabulary was found in this range.</p><button className={styles.primaryButton} onClick={newGame}>Try another</button></div> : <>
        <div className={styles.wordleBoard} aria-label="Guesses">{Array.from({ length: game.maxAttempts }, (_, row) => {
          const previous = game.guesses[row]; const tiles = previous ? evaluateWordleGuess(game.target, previous) : Array.from({ length: splitKana(game.target).length }, () => ({ character: "", state: "absent" as const }));
          return <div className={styles.wordleRow} key={row}>{tiles.map((tile, index) => <span key={index} data-state={previous ? tile.state : "empty"} lang="ja">{tile.character}</span>)}</div>;
        })}</div>
        {won || lost ? <div className={styles.wordleResult} role="status"><strong>{won ? "You found it" : "The answer was"}</strong><p lang="ja">{targetSubject?.data.characters} · {game.target}</p><span>{targetSubject ? primaryMeaning(targetSubject) : ""}</span><button className={styles.primaryButton} onClick={newGame}><RotateCcw size={17} /> New word</button></div> : <form className={styles.wordleForm} onSubmit={(event) => { event.preventDefault(); submit(); }}><label htmlFor="wordle-guess">Guess in kana or romaji</label><div><input id="wordle-guess" lang="ja" value={guess} onChange={(event) => { setGuess(composeKanaInput(event.target.value)); setGuessError(""); }} autoComplete="off" autoFocus aria-invalid={Boolean(guessError)} aria-describedby="wordle-error" /><button className={styles.primaryButton} disabled={splitKana(guess).length !== splitKana(game.target).length}>Guess</button></div><p>{splitKana(guess).length} / {splitKana(game.target).length} kana · romaji converts as you type</p><span id="wordle-error" className={styles.formMessage} role="alert">{guessError}</span></form>}
      </>}
    </section>
  );
}

export function SimilarKanjiMatching({ dataset, filters, scope, onExit }: { dataset: StudyDataset; filters: StudyFilters; scope: StudyStorageScope; onExit: () => void }) {
  const rounds = useMemo(() => buildSimilarKanjiBoards(dataset, filters), [dataset, filters]);
  const signature = JSON.stringify({ count: filters.count, source: filters.similarKanjiSource, learned: filters.similarKanjiOnlyLearned, size: filters.similarKanjiGroupSize, srs: filters.srsGroups, levels: [filters.minLevel, filters.maxLevel], ids: filters.selectedSubjectIds });
  const saved = loadModeState<{ roundIndex: number; correct: number; mistakes: number; signature: string }>(scope, "similar-kanji", "matching");
  const resumable = saved?.signature === signature ? saved : null;
  const [roundIndex, setRoundIndex] = useState(() => Math.min(resumable?.roundIndex ?? 0, rounds.length));
  const [correct, setCorrect] = useState(resumable?.correct ?? 0);
  const [mistakes, setMistakes] = useState(resumable?.mistakes ?? 0);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [matched, setMatched] = useState<Set<number>>(() => new Set());
  const [message, setMessage] = useState("Choose a kanji, then choose its meaning.");
  const round = rounds[roundIndex];
  const meanings = useMemo(() => round ? shuffle(round.items) : [], [round]);
  const persist = (nextRound: number, nextCorrect: number, nextMistakes: number) => saveModeState(scope, "similar-kanji", "matching", { roundIndex: nextRound, correct: nextCorrect, mistakes: nextMistakes, signature });
  const chooseMeaning = (subjectId: number) => {
    if (selectedSubjectId === null || matched.has(subjectId)) return;
    if (selectedSubjectId === subjectId) {
      const nextMatched = new Set(matched).add(subjectId);
      const nextCorrect = correct + 1;
      setMatched(nextMatched); setCorrect(nextCorrect); setSelectedSubjectId(null); setMessage("Match accepted.");
      persist(roundIndex, nextCorrect, mistakes);
    } else {
      const nextMistakes = mistakes + 1;
      setMistakes(nextMistakes); setMessage("Those do not match. Try the same kanji again.");
      persist(roundIndex, correct, nextMistakes);
    }
  };
  if (!round) return <section className={styles.results}><div className={styles.resultMark}><Check size={34} /></div><h2>{rounds.length ? "Matching complete" : "No similar groups found"}</h2><p>{rounds.length ? `${correct} matches with ${mistakes} incorrect attempts.` : "Try WaniKani as the source, include unlearned similar kanji, or widen the level range."}</p><button className={styles.primaryButton} onClick={() => { clearModeState(scope, "similar-kanji", "matching"); onExit(); }}>Back to setup</button></section>;
  const complete = matched.size === round.items.length;
  return <section className={styles.gameShell}><div className={styles.gameHeading}><div><h2>Match kanji to meanings</h2><p>Round {roundIndex + 1} of {rounds.length} · {filters.similarKanjiSource === "niai" ? "Niai" : "WaniKani"} similarity</p></div><button className={styles.iconButton} onClick={onExit} aria-label="Pause similar kanji matching"><X size={19} /></button></div><div className={styles.matchingBoard}><div aria-label="Kanji choices">{round.items.map((item) => <button type="button" key={item.subjectId} className={styles.matchingKanji} data-active={selectedSubjectId === item.subjectId} data-matched={matched.has(item.subjectId)} disabled={matched.has(item.subjectId)} onClick={() => { setSelectedSubjectId(item.subjectId); setMessage(`Now choose the meaning for ${item.characters}.`); }} lang="ja">{item.characters}</button>)}</div><div aria-label="Meaning choices">{meanings.map((item) => <button type="button" key={item.subjectId} className={styles.matchingMeaning} data-matched={matched.has(item.subjectId)} disabled={matched.has(item.subjectId) || selectedSubjectId === null} onClick={() => chooseMeaning(item.subjectId)}>{item.meaning}</button>)}</div></div><p className={styles.matchingStatus} role="status">{message}</p>{complete ? <div className={styles.gameActions}><button className={styles.primaryButton} onClick={() => { const next = roundIndex + 1; setRoundIndex(next); setMatched(new Set()); setSelectedSubjectId(null); setMessage("Choose a kanji, then choose its meaning."); persist(next, correct, mistakes); }}>{roundIndex + 1 >= rounds.length ? "Finish" : "Next round"} <ArrowRight size={17} /></button></div> : null}</section>;
}

export function CustomLessons({ dataset, filters, scope, onExit }: { dataset: StudyDataset; filters: StudyFilters; scope: StudyStorageScope; onExit: () => void }) {
  const subjects = useMemo(() => dataset.subjects.filter((subject) => filters.selectedSubjectIds.includes(subject.id) && !subject.data.hidden_at), [dataset.subjects, filters.selectedSubjectIds]);
  const saved = loadModeState<{ index: number }>(scope, "custom-lessons", "progress");
  const [index, setIndex] = useState(() => Math.min(saved?.index ?? 0, Math.max(subjects.length - 1, 0)));
  const subject = subjects[index];
  const move = (next: number) => { setIndex(next); saveModeState(scope, "custom-lessons", "progress", { index: next }); };
  if (!subject) return <section className={styles.emptyPanel}><h2>No subjects selected</h2><p>Return to setup and choose at least one unlocked subject.</p><button className={styles.primaryButton} onClick={onExit}>Back to setup</button></section>;
  const meaning = primaryMeaning(subject); const reading = primaryReading(subject);
  return <section className={styles.lessonShell}><div className={styles.quizTopbar}><span>{index + 1} / {subjects.length}</span><div className={styles.progressTrack}><span style={{ transform: `scaleX(${(index + 1) / subjects.length})` }} /></div><button className={styles.iconButton} onClick={onExit} aria-label="Pause lessons"><X size={19} /></button></div><article className={styles.lessonCard} data-type={subject.object}><p>{subject.object.replace("_", " ")} · Level {subject.data.level}</p><h2 lang="ja">{subject.data.characters ?? meaning}</h2><div className={styles.lessonFacts}><div><h3>Meaning</h3><strong>{meaning}</strong><p>{subject.data.meanings.map((item) => item.meaning).join(" · ")}</p></div>{reading ? <div><h3>Reading</h3><strong lang="ja">{reading}</strong><p lang="ja">{subject.data.readings?.map((item) => item.reading).join(" · ")}</p></div> : null}</div>{subject.data.meaning_mnemonic ? <div className={styles.lessonNote}><h3>Meaning mnemonic</h3><p>{plainMnemonic(subject.data.meaning_mnemonic)}</p></div> : null}{subject.data.reading_mnemonic ? <div className={styles.lessonNote}><h3>Reading mnemonic</h3><p>{plainMnemonic(subject.data.reading_mnemonic)}</p></div> : null}{subject.data.context_sentences?.[0] ? <div className={styles.contextExample}><p lang="ja">{subject.data.context_sentences[0].ja}</p><span>{subject.data.context_sentences[0].en}</span></div> : null}</article><div className={styles.lessonNav}><button className={styles.secondaryButton} disabled={index === 0} onClick={() => move(index - 1)}><ArrowLeft size={17} /> Previous</button>{index < subjects.length - 1 ? <button className={styles.primaryButton} onClick={() => move(index + 1)}>Next <ArrowRight size={17} /></button> : <button className={styles.primaryButton} onClick={() => { clearModeState(scope, "custom-lessons", "progress"); onExit(); }}><Check size={17} /> Finish</button>}</div></section>;
}

export function SubjectLists({ subjects, scope, username }: { subjects: Subject[]; scope: StudyStorageScope; username: string }) {
  const repository = useMemo(() => createListRepository(subjectListStorage, username), [username]);
  const subscribe = useCallback((onChange: () => void) => subscribeSubjectLists(username, onChange), [username]);
  const getSnapshot = useCallback(() => repository.snapshot(), [repository]);
  const rawLists = useSyncExternalStore(subscribe, getSnapshot, () => "");
  const lists = useMemo(() => {
    void rawLists;
    return repository.load();
  }, [rawLists, repository]);
  const [name, setName] = useState("");
  const [activeId, setActiveId] = useState<string | null>(() => lists[0]?.id ?? null);
  const [query, setQuery] = useState("");
  const [deletedList, setDeletedList] = useState<{ list: SubjectList; index: number } | null>(null);
  const resolvedActiveId = activeId && lists.some((list) => list.id === activeId) ? activeId : lists[0]?.id ?? null;
  const active = lists.find((list) => list.id === resolvedActiveId);
  const shown = useMemo(() => subjects.filter((subject) => !query.trim() || subject.data.characters?.includes(query) || subject.data.meanings.some((item) => item.meaning.toLocaleLowerCase().includes(query.toLocaleLowerCase()))).slice(0, 100), [query, subjects]);
  useEffect(() => {
    const canonical = repository.load();
    if (!canonical.length) {
      loadSubjectLists(scope).forEach((list, index) => repository.restore(list, index));
    }
  }, [repository, scope]);
  const commit = (next: SubjectList[]) => { repository.replace(next); };
  const create = () => { const trimmed = name.trim(); if (!trimmed) return; const now = new Date().toISOString(); const list = { id: `list-${Date.now()}`, name: trimmed, subjectIds: [], createdAt: now, updatedAt: now }; commit([...lists, list]); setActiveId(list.id); setName(""); };
  const toggle = (subjectId: number) => { if (!active) return; const ids = active.subjectIds.includes(subjectId) ? active.subjectIds.filter((id) => id !== subjectId) : [...active.subjectIds, subjectId]; commit(lists.map((list) => list.id === active.id ? { ...list, subjectIds: ids, updatedAt: new Date().toISOString() } : list)); };
  return <div className={styles.listsLayout}><aside className={styles.listsSidebar}><form onSubmit={(event) => { event.preventDefault(); create(); }}><label htmlFor="new-list">New list</label><div><input id="new-list" value={name} onChange={(event) => setName(event.target.value)} placeholder="JLPT refresh" /><button className={styles.primaryButton} disabled={!name.trim()}>Create</button></div></form><nav aria-label="Saved subject lists">{lists.map((list) => <button key={list.id} data-active={list.id === resolvedActiveId} onClick={() => setActiveId(list.id)}><span>{list.name}</span><small>{list.subjectIds.length}</small></button>)}</nav>{deletedList ? <div className={styles.undoNotice} role="status"><span>List deleted</span><button className={styles.textButton} onClick={() => { const next = [...lists]; next.splice(deletedList.index, 0, deletedList.list); commit(next); setActiveId(deletedList.list.id); setDeletedList(null); }}>Undo</button></div> : null}{active ? <button className={styles.dangerButton} onClick={() => { const index = lists.findIndex((list) => list.id === active.id); const next = lists.filter((list) => list.id !== active.id); setDeletedList({ list: active, index }); commit(next); setActiveId(next[0]?.id ?? null); }}><Trash2 size={16} /> Delete list</button> : null}</aside><section className={styles.listEditor}>{active ? <><div className={styles.configTitleRow}><div><h2>{active.name}</h2><p>{active.subjectIds.length} subjects. Lists are stored in this browser.</p></div></div><label className={styles.largeSearch}>Find subjects<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search characters or meanings" /></label><div className={styles.subjectPickerGrid}>{shown.map((subject) => { const selected = active.subjectIds.includes(subject.id); return <button type="button" key={subject.id} className={styles.subjectPick} data-active={selected} data-type={subject.object} onClick={() => toggle(subject.id)} aria-pressed={selected}><strong lang="ja">{subject.data.characters ?? "◈"}</strong><span>{primaryMeaning(subject)}</span><small>{selected ? "Added" : `Level ${subject.data.level}`}</small></button>; })}</div></> : <div className={styles.emptyPanel}><Library size={24} aria-hidden="true" /><h2>Create your first list</h2><p>Lists can feed custom reviews, lessons, writing practice, and both games.</p></div>}</section></div>;
}
