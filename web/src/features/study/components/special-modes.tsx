"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toHiragana } from "wanakana";
import { ArrowLeft, ArrowRight, Check, Eye, Grid3X3, Library, Lightbulb, Play, RotateCcw, Sparkles, Trash2, Undo2, Volume2, X } from "lucide-react";
import type { WebSettings } from "@/features/settings/settings";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import { useSubjectLists } from "@/features/subjects/use-subject-lists";
import type { Subject } from "@/types/wanikani";
import { analyzeJapaneseText, chooseWordleCandidate, evaluateWordleGuess, generateCrossword, isValidWordleGuess, splitKana, wordleCandidates } from "../games";
import { filterStudySubjects, shuffle } from "../engine";
import { composeKanaInput } from "../kana-composition";
import { clearModeState, loadModeState, loadSubjectLists, saveModeState } from "../storage";
import type { CrosswordPuzzle, StudyDataset, StudyFilters, SubjectList } from "../types";
import type { StudyStorageScope } from "../storage";
import { buildSimilarKanjiBoards } from "../similar-kanji";
import { CROSSWORD_SIZE_PRESETS } from "../mode-config";
import { evaluateFreehandDrawing, loadKanjiStrokeData, type KanjiStrokeData } from "../stroke-data";
import { GuidedWritingCanvas, MOBILE_GUIDED_STROKE_TRANSFORM, type GuidedWritingCanvasHandle } from "./guided-writing-canvas";
import styles from "../study.module.css";

const StudySubjectDetails = dynamic(
  () => import("./study-subject-details").then((module) => module.StudySubjectDetails),
  { loading: CustomLessonSubjectDetailsLoading },
);

function CustomLessonSubjectDetailsLoading() {
  return <section id="study-item-details" className={styles.itemDetails} aria-labelledby="study-item-details-title" aria-busy="true"><header className={styles.itemDetailsHeader}><div><h3 id="study-item-details-title">Subject details</h3><p>Loading subject sections…</p></div></header></section>;
}

function primaryMeaning(subject: Subject) {
  return subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.meanings[0]?.meaning ?? "Unknown";
}

function primaryReading(subject: Subject) {
  return subject.data.readings?.find((item) => item.primary)?.reading ?? subject.data.readings?.[0]?.reading ?? "";
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
        {!text.trim() ? <p>Paste Japanese to inspect vocabulary, kanji, verbs, and grammar markers.</p> : view === "library" ? analysis.matches.length ? <div className={styles.analysisList}>{analysis.matches.map((subject) => <article key={subject.id} data-type={subject.object}><strong><SubjectCharacter subject={subject} className={styles.surfaceSubjectCharacter} imageTone="subject" imageSize="2.25rem" /></strong><div><h3>{primaryMeaning(subject)}</h3><p lang="ja">{primaryReading(subject) || subject.object.replace("_", " ")}</p></div><span>Level {subject.data.level}</span></article>)}</div> : <p>No exact WaniKani subjects were found in this text.</p> : <><div className={styles.tokenizedText} lang="ja">{analysis.tokens.map((token, index) => token.type === "plain" ? <span key={index}>{token.text}</span> : <button type="button" key={index} data-token-type={token.type} data-active={selectedToken === index} onClick={() => setSelectedToken(index)}>{token.text}</button>)}</div>{selectedToken !== null && analysis.tokens[selectedToken] ? <article className={styles.tokenDetail}><h3>{analysis.tokens[selectedToken].text}</h3><p>{analysis.tokens[selectedToken].type}{analysis.tokens[selectedToken].partsOfSpeech?.length ? ` · ${analysis.tokens[selectedToken].partsOfSpeech!.join(", ")}` : ""}</p>{analysis.tokens[selectedToken].reading ? <p lang="ja">Reading: {analysis.tokens[selectedToken].reading}</p> : null}{analysis.tokens[selectedToken].meaning ? <strong>{analysis.tokens[selectedToken].meaning}</strong> : null}</article> : <p>Select an underlined token for details.</p>}</>}
      </section>
    </div>
  );
}

type Point = { x: number; y: number };
type Stroke = Point[];
const MIN_WRITING_STROKE_LENGTH = 8;

function appendStrokePoint(stroke: Stroke, next: Point): Stroke {
  const previous = stroke.at(-1);
  return previous && previous.x === next.x && previous.y === next.y ? stroke : [...stroke, next];
}

function writingStrokeLength(stroke: Stroke) {
  return stroke.slice(1).reduce((total, current, index) => {
    const previous = stroke[index];
    return total + Math.hypot(current.x - previous.x, current.y - previous.y);
  }, 0);
}

function initialWritingMessage(mode: StudyFilters["writingMode"]) {
  return mode === "guided" ? "Loading stroke order…" : "Loading handwriting reference…";
}

export function WritingPractice({ dataset, filters, scope, onExit }: { dataset: StudyDataset; filters: StudyFilters; scope: StudyStorageScope; onExit: () => void }) {
  const [saved] = useState(() => loadModeState<{ index: number; correct: number; subjectIds: number[] }>(scope, "kanji-writing", "progress"));
  const eligible = useMemo(() => filterStudySubjects(dataset, { ...filters, subjectTypes: ["kanji"] }), [dataset, filters]);
  const [kanji] = useState(() => {
    const byId = new Map(eligible.map((subject) => [subject.id, subject]));
    const restored = saved?.subjectIds?.map((id) => byId.get(id)).filter((subject): subject is Subject => Boolean(subject));
    return restored?.length ? restored : shuffle(eligible).slice(0, filters.count);
  });
  const [index, setIndex] = useState(() => Math.min(saved?.index ?? 0, kanji.length));
  const [correct, setCorrect] = useState(saved?.correct ?? 0);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [strokeData, setStrokeData] = useState<KanjiStrokeData | null>(null);
  const [strokeLoadState, setStrokeLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [strokeIndex, setStrokeIndex] = useState(0);
  const [strokeMessage, setStrokeMessage] = useState(() => initialWritingMessage(filters.writingMode));
  const [guidedMistakes, setGuidedMistakes] = useState(0);
  const [guidedWriterReady, setGuidedWriterReady] = useState(false);
  const [guidedReplaying, setGuidedReplaying] = useState(false);
  const [evaluation, setEvaluation] = useState<ReturnType<typeof evaluateFreehandDrawing> | null>(null);
  const [replayKey, setReplayKey] = useState(0);
  const guidedWriterRef = useRef<GuidedWritingCanvasHandle | null>(null);
  const drawing = useRef(false);
  const strokeBuffer = useRef<Stroke>([]);
  const activePointerId = useRef<number | null>(null);
  const subject = kanji[index];

  useEffect(() => {
    saveModeState(scope, "kanji-writing", "progress", { index, correct, subjectIds: kanji.map((item) => item.id) });
  }, [correct, index, kanji, scope]);
  useEffect(() => {
    if (!subject?.data.characters) return;
    let cancelled = false;
    void loadKanjiStrokeData(subject.data.characters).then((data) => {
      if (cancelled) return;
      setStrokeData(data);
      setStrokeLoadState("ready");
      setStrokeMessage(filters.writingMode === "guided" ? "Preparing guided writer…" : "Draw the complete kanji, then submit it for grading.");
    }).catch(() => {
      if (cancelled) return;
      setStrokeLoadState("error");
      setStrokeMessage("Handwriting data is unavailable for this kanji.");
    });
    return () => { cancelled = true; };
  }, [filters.writingMode, subject?.id, subject?.data.characters]);

  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return {
      x: Math.min(1024, Math.max(0, ((event.clientX - rect.left) / rect.width) * 1024)),
      y: Math.min(1024, Math.max(0, ((event.clientY - rect.top) / rect.height) * 1024)),
    };
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
    setIndex(nextIndex); setCorrect(nextCorrect); setStrokes([]); setShowAnswer(false); setStrokeIndex(0); setStrokeData(null); setStrokeLoadState("loading"); setStrokeMessage(initialWritingMessage(filters.writingMode)); setGuidedMistakes(0); setGuidedWriterReady(false); setGuidedReplaying(false); setEvaluation(null);
    saveModeState(scope, "kanji-writing", "progress", { index: nextIndex, correct: nextCorrect, subjectIds: kanji.map((item) => item.id) });
  };
  if (!subject) {
    return <section className={styles.results}><div className={styles.resultMark}><Check size={34} /></div><h2>{kanji.length ? "Writing complete" : "No kanji available"}</h2>{kanji.length ? <><p>You recalled {correct} of {kanji.length} kanji.</p><dl className={styles.resultStats}><div><dt>Recall</dt><dd>{Math.round((correct / kanji.length) * 100)}%</dd></div><div><dt>Remembered</dt><dd>{correct}</dd></div><div><dt>Practiced</dt><dd>{kanji.length}</dd></div></dl></> : <p>Try widening the selected level, SRS range, or subject-list filter.</p>}<button className={styles.primaryButton} onClick={() => { clearModeState(scope, "kanji-writing", "progress"); onExit(); }}>Back to setup</button></section>;
  }

  const guided = filters.writingMode === "guided";
  const guidedComplete = guided && Boolean(strokeData?.medians.length) && strokeIndex >= (strokeData?.medians.length ?? 0);
  const canDraw = !guided && strokeLoadState === "ready" && !evaluation;
  const statusText = evaluation
    ? `${evaluation.correct ? "Correct" : "Incorrect"} · Similarity ${evaluation.similarityPercent}%`
    : guidedComplete
      ? `Complete${guidedMistakes ? ` · ${guidedMistakes} mistake${guidedMistakes === 1 ? "" : "s"}` : " · no mistakes"}`
      : guided && strokeData
        ? `Stroke ${Math.min(strokeIndex + 1, strokeData.medians.length)} of ${strokeData.medians.length} · ${strokeMessage}`
        : strokeMessage;

  const resetAttempt = () => {
    drawing.current = false;
    activePointerId.current = null;
    strokeBuffer.current = [];
    setStrokes([]);
    setStrokeIndex(0);
    setGuidedMistakes(0);
    setGuidedReplaying(false);
    setShowAnswer(false);
    setEvaluation(null);
    setStrokeMessage(guided ? "Draw the first stroke." : "Draw the complete kanji, then submit it for grading.");
    if (guided) {
      setGuidedWriterReady(false);
      guidedWriterRef.current?.restart();
    }
  };

  const showCorrectWriting = () => {
    if (guided) {
      guidedWriterRef.current?.replay();
      return;
    }
    setShowAnswer(true);
    setReplayKey((value) => value + 1);
  };

  const completePointerStroke = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!drawing.current || activePointerId.current !== event.pointerId) return;
    const completedStroke = appendStrokePoint(strokeBuffer.current, point(event));
    drawing.current = false;
    activePointerId.current = null;
    strokeBuffer.current = completedStroke;
    if (completedStroke.length < 2 || writingStrokeLength(completedStroke) < MIN_WRITING_STROKE_LENGTH) {
      setStrokes((value) => value.slice(0, -1));
      setStrokeMessage("Draw the full stroke before releasing.");
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }
    setStrokes((value) => value.map((stroke, itemIndex) => itemIndex === value.length - 1 ? completedStroke : stroke));
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <section className={styles.writingShell} data-mode={filters.writingMode}>
      <div className={styles.quizTopbar}><span>{index + 1} / {kanji.length}</span><p>Write the kanji for <strong>{primaryMeaning(subject)}</strong>{primaryReading(subject) ? <small lang="ja">{primaryReading(subject)}</small> : null}</p><button type="button" className={styles.iconButton} onClick={onExit} aria-label="Pause writing practice"><X size={19} /></button></div>
      <div className={styles.writingStage}>
        {guided ? (
          <GuidedWritingCanvas
            ref={guidedWriterRef}
            character={subject.data.characters ?? ""}
            complete={guidedComplete}
            data={strokeData}
            label={`Drawing area for ${primaryMeaning(subject)}. ${statusText}`}
            leniency={filters.strokeLeniency}
            state={strokeLoadState}
            showGrid={showGrid}
            showOutline={showAnswer}
            onReady={() => {
              setGuidedWriterReady(true);
              setGuidedReplaying(false);
              setStrokeMessage("Draw the first stroke.");
            }}
            onError={() => {
              setGuidedWriterReady(false);
              setStrokeLoadState("error");
              setStrokeMessage("Guided handwriting could not be started for this kanji.");
            }}
            onMistake={(data) => {
              if (data.mistakesOnStroke === 2) setGuidedMistakes((value) => value + 1);
              setStrokeMessage(data.mistakesOnStroke >= 3
                ? "Try again. The next stroke is highlighted."
                : data.isBackwards
                  ? "Check the stroke direction."
                  : "Try that stroke again.");
            }}
            onReplayStateChange={setGuidedReplaying}
            onCorrectStroke={(data) => {
              const nextStroke = data.strokeNum + 1;
              setStrokeIndex(nextStroke);
              setStrokeMessage(data.strokesRemaining === 0
                ? "All strokes accepted."
                : `Stroke accepted. Draw stroke ${nextStroke + 1}.`);
            }}
            onComplete={() => {
              setStrokeIndex(strokeData?.medians.length ?? 0);
              setStrokeMessage("All strokes accepted.");
            }}
            ready={guidedWriterReady}
          />
        ) : (
          <svg className={styles.writingCanvas} data-disabled={!canDraw} data-state={evaluation ? evaluation.correct ? "correct" : "incorrect" : strokeLoadState} viewBox="0 0 1024 1024" role="img" aria-label={`Drawing area for ${primaryMeaning(subject)}. ${statusText}`} onPointerDown={(event) => { if (!canDraw || event.isPrimary === false) return; drawing.current = true; activePointerId.current = event.pointerId; event.currentTarget.setPointerCapture?.(event.pointerId); const first = point(event); strokeBuffer.current = [first]; setStrokes((value) => [...value, [first]]); }} onPointerMove={(event) => { if (!drawing.current || activePointerId.current !== event.pointerId) return; const nextStroke = appendStrokePoint(strokeBuffer.current, point(event)); if (nextStroke === strokeBuffer.current) return; strokeBuffer.current = nextStroke; setStrokes((value) => value.map((stroke, itemIndex) => itemIndex === value.length - 1 ? nextStroke : stroke)); }} onPointerUp={completePointerStroke} onPointerCancel={(event) => { if (!drawing.current || activePointerId.current !== event.pointerId) return; drawing.current = false; activePointerId.current = null; strokeBuffer.current = []; setStrokes((value) => value.slice(0, -1)); if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture?.(event.pointerId); }}>
            {showGrid ? <path d="M512 0V1024M0 512H1024M0 0L1024 1024M1024 0L0 1024" className={styles.guideLines} /> : null}
            {strokes.map((stroke, strokeIndex) => <polyline key={strokeIndex} points={stroke.map((item) => `${item.x},${item.y}`).join(" ")} className={styles.inkStroke} />)}
            {showAnswer && strokeData ? (
              <g key={replayKey} transform={MOBILE_GUIDED_STROKE_TRANSFORM} aria-hidden>
                {strokeData.strokes.map((stroke, itemIndex) => <path key={itemIndex} d={stroke} className={styles.answerSourceStroke} style={{ "--stroke-delay": `${itemIndex * 0.28}s` } as React.CSSProperties} />)}
              </g>
            ) : null}
          </svg>
        )}
        <p className={styles.strokeStatus} role="status">{statusText}</p>
        {evaluation ? <dl className={styles.writingDecision} aria-label="Handwriting evaluation"><div data-pass={evaluation.checks.similarity}><dt>Similarity</dt><dd>{evaluation.similarityPercent}%</dd></div><div data-pass={evaluation.checks.coverage}><dt>Coverage</dt><dd>{evaluation.coveragePercent}%</dd></div><div data-pass={evaluation.checks.strokeOrder}><dt>Stroke match</dt><dd>{evaluation.strokeMatchPercent}%</dd></div><div data-pass={evaluation.checks.strokeCount}><dt>Stroke count</dt><dd>{evaluation.drawnStrokeCount}/{evaluation.expectedStrokeCount}</dd></div></dl> : null}
        <div className={styles.canvasTools}><button type="button" className={styles.optionButton} data-active={showGrid} aria-pressed={showGrid} onClick={() => setShowGrid((value) => !value)}><Grid3X3 size={16} /> Grid</button>{!guided && !evaluation ? <button type="button" className={styles.secondaryButton} onClick={() => setStrokes((value) => value.slice(0, -1))} disabled={!strokes.length}><Undo2 size={16} /> Undo</button> : null}<button type="button" className={styles.secondaryButton} onClick={resetAttempt} disabled={guided ? strokeIndex === 0 && guidedMistakes === 0 : !strokes.length && !evaluation}><Trash2 size={16} /> {guided ? "Restart" : "Clear"}</button><button type="button" className={styles.optionButton} data-active={showAnswer} aria-pressed={showAnswer} onClick={() => setShowAnswer((value) => !value)} disabled={strokeLoadState !== "ready"}><Eye size={16} /> {showAnswer ? "Hide" : "Show"} outline</button>{guided && !guidedComplete && guidedWriterReady ? <button type="button" className={styles.secondaryButton} onClick={() => { guidedWriterRef.current?.highlight(strokeIndex); setStrokeMessage("The next stroke is highlighted."); }}><Lightbulb size={16} /> Hint</button> : null}</div>
      </div>
      {strokeLoadState === "error" ? <div className={styles.recallActions}><button type="button" className={styles.missButton} onClick={() => finish(false)}><ArrowRight size={18} /> Skip kanji</button></div> : guided ? guidedComplete ? <div className={styles.recallActions}><button type="button" className={styles.secondaryButton} disabled={guidedReplaying} onClick={showCorrectWriting}><Play size={18} /> {guidedReplaying ? "Replaying…" : "Replay"}</button><button type="button" className={styles.primaryButton} onClick={() => finish(guidedMistakes === 0)}><ArrowRight size={18} /> Next</button></div> : null : evaluation ? <div className={styles.recallActions}><button type="button" className={styles.secondaryButton} onClick={showCorrectWriting}><Play size={18} /> Replay correct</button><button type="button" className={styles.secondaryButton} onClick={resetAttempt}><RotateCcw size={18} /> {evaluation.correct ? "Redraw" : "Retry"}</button><button type="button" className={styles.primaryButton} onClick={() => finish(evaluation.correct)}><ArrowRight size={18} /> Next</button></div> : <div className={styles.recallActions}><button type="button" className={styles.primaryButton} disabled={strokeLoadState !== "ready" || !strokes.length} onClick={() => { if (!strokeData || !strokes.length) return; const result = evaluateFreehandDrawing(strokes, strokeData, filters.strokeLeniency); setEvaluation(result); setStrokeMessage(`${result.correct ? "Correct" : "Incorrect"} · Similarity ${result.similarityPercent}%`); }}><Check size={18} /> Submit</button></div>}
    </section>
  );
}

interface SavedCrossword { puzzle: CrosswordPuzzle | null; values: Record<string, string>; checked: boolean; signature: string }

function playAudio(url?: string) {
  if (!url || typeof Audio === "undefined") return;
  void new Audio(url).play();
}

const HIRAGANA_CELL = /^[\p{Script=Hiragana}ー〜～]$/u;
const CROSSWORD_TILE_REVEAL_MS = 70;
const CROSSWORD_WORD_SETTLE_MS = 120;
const CROSSWORD_ERROR_FEEDBACK_MS = 600;

interface CrosswordAttemptFeedback {
  entryId: string;
  kind: "correct" | "incorrect";
  revealedCount: number;
}

function waitForCrosswordFeedback(duration: number) {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

function crosswordEntryCells(entry: CrosswordPuzzle["entries"][number]) {
  return splitKana(entry.answer).map((_, index) => ({
    row: entry.row + (entry.direction === "down" ? index : 0),
    col: entry.col + (entry.direction === "across" ? index : 0),
  }));
}

function crosswordCellKey(row: number, col: number) {
  return `${row}:${col}`;
}

function crosswordIsComplete(puzzle: CrosswordPuzzle, values: Record<string, string>) {
  return puzzle.cells.every((row, rowIndex) => row.every((cell, colIndex) =>
    !cell || values[crosswordCellKey(rowIndex, colIndex)] === cell.answer
  ));
}

function crosswordEntryIsCorrect(entry: CrosswordPuzzle["entries"][number], values: Record<string, string>) {
  return crosswordEntryCells(entry).every(({ row, col }, index) => values[crosswordCellKey(row, col)] === splitKana(entry.answer)[index]);
}

function crosswordHint(entry: CrosswordPuzzle["entries"][number], clueMode: StudyFilters["crosswordClueMode"]) {
  if (clueMode === "kanji") return `Meaning: ${entry.meaning}`;
  if (clueMode === "english" && entry.characters !== entry.answer) return `Written as ${entry.characters}`;
  return `${splitKana(entry.answer).length} kana`;
}

export function CrosswordGame({ dataset, filters, scope, onExit }: { dataset: StudyDataset; filters: StudyFilters; scope: StudyStorageScope; onExit: () => void }) {
  const subjects = useMemo(() => filterStudySubjects(dataset, { ...filters, subjectTypes: ["vocabulary", "kana_vocabulary"] }), [dataset, filters]);
  const stored = loadModeState<SavedCrossword>(scope, "crossword", "game");
  const preset = CROSSWORD_SIZE_PRESETS[filters.crosswordSize];
  const signature = JSON.stringify({ size: filters.crosswordSize, words: filters.crosswordMaxWords, srs: filters.srsGroups, levels: [filters.minLevel, filters.maxLevel], ids: filters.selectedSubjectIds, jlpt: filters.crosswordJlptLevels, hiragana: filters.crosswordHiraganaOnly, clues: filters.crosswordClueMode });
  const buildPuzzle = () => generateCrossword(subjects, preset.gridSize, filters.crosswordMaxWords, Math.random, { clueMode: filters.crosswordClueMode, hiraganaOnly: filters.crosswordHiraganaOnly, jlptLevels: filters.crosswordJlptLevels });
  const storedIsComplete = Boolean(stored?.signature === signature && stored.puzzle && crosswordIsComplete(stored.puzzle, stored.values));
  const [game, setGame] = useState<SavedCrossword>(() => stored?.signature === signature && !storedIsComplete ? stored : {
    puzzle: buildPuzzle(),
    values: {},
    checked: false,
    signature,
  });
  const puzzle = game.puzzle;
  const orderedEntries = useMemo(() => puzzle?.entries.toSorted((left, right) => left.number - right.number || (left.direction === "across" ? -1 : 1)) ?? [], [puzzle]);
  const [activeEntryId, setActiveEntryId] = useState<string | null>(() => orderedEntries[0]?.id ?? null);
  const [hintedEntryIds, setHintedEntryIds] = useState<Set<string>>(() => new Set());
  const [wordInput, setWordInput] = useState("");
  const [wordFeedback, setWordFeedback] = useState<"idle" | "empty" | "correct" | "incorrect">("idle");
  const [attemptFeedback, setAttemptFeedback] = useState<CrosswordAttemptFeedback | null>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);
  const feedbackSequenceRef = useRef(0);
  const activeEntry = orderedEntries.find((entry) => entry.id === activeEntryId) ?? orderedEntries[0] ?? null;
  const activeCellKeys = useMemo(() => new Set(activeEntry ? crosswordEntryCells(activeEntry).map(({ row, col }) => crosswordCellKey(row, col)) : []), [activeEntry]);
  const wordPreviewByCell = useMemo(() => {
    const preview = new Map<string, string>();
    if (!activeEntry) return preview;
    const cells = crosswordEntryCells(activeEntry);
    for (const [index, character] of Array.from(wordInput).entries()) {
      if (!HIRAGANA_CELL.test(character) || !cells[index]) break;
      preview.set(crosswordCellKey(cells[index].row, cells[index].col), character);
    }
    return preview;
  }, [activeEntry, wordInput]);
  const allCorrect = puzzle ? crosswordIsComplete(puzzle, game.values) : false;
  const entryIsCorrect = (entry: CrosswordPuzzle["entries"][number]) => crosswordEntryIsCorrect(entry, game.values);
  const completedCellKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!puzzle) return keys;
    puzzle.entries.forEach((entry) => {
      if (!crosswordEntryIsCorrect(entry, game.values)) return;
      crosswordEntryCells(entry).forEach(({ row, col }) => keys.add(crosswordCellKey(row, col)));
    });
    return keys;
  }, [game.values, puzzle]);
  const attemptCellIndexByKey = useMemo(() => {
    const indexes = new Map<string, number>();
    const entry = attemptFeedback ? puzzle?.entries.find((item) => item.id === attemptFeedback.entryId) : null;
    if (!entry) return indexes;
    crosswordEntryCells(entry).forEach(({ row, col }, index) => indexes.set(crosswordCellKey(row, col), index));
    return indexes;
  }, [attemptFeedback, puzzle]);
  const answerIsAnimating = attemptFeedback?.kind === "correct";
  const solvedCount = puzzle?.entries.filter(entryIsCorrect).length ?? 0;
  const filledCount = puzzle?.cells.flat().filter((cell, index) => {
    if (!cell) return false;
    const row = Math.floor(index / puzzle.cols);
    const col = index % puzzle.cols;
    return Boolean(game.values[crosswordCellKey(row, col)]);
  }).length ?? 0;
  const totalCells = puzzle?.cells.flat().filter(Boolean).length ?? 0;

  useEffect(() => {
    if (storedIsComplete || allCorrect) clearModeState(scope, "crossword", "game");
  }, [allCorrect, scope, storedIsComplete]);
  useEffect(() => () => { feedbackSequenceRef.current += 1; }, []);

  const update = (updates: Array<{ key: string; value: string }>) => {
    if (!puzzle) return null;
    const values = { ...game.values };
    updates.forEach(({ key, value }) => { values[key] = value; });
    if (filters.crosswordPlayAudioOnCorrect) {
      for (const entry of puzzle.entries) {
        const cells = splitKana(entry.answer).map((_, index) => `${entry.row + (entry.direction === "down" ? index : 0)}:${entry.col + (entry.direction === "across" ? index : 0)}`);
        const wasComplete = cells.every((cell, index) => game.values[cell] === splitKana(entry.answer)[index]);
        const isComplete = cells.every((cell, index) => values[cell] === splitKana(entry.answer)[index]);
        if (!wasComplete && isComplete) playAudio(entry.audioUrl);
      }
    }
    const next = { ...game, values, checked: false };
    setGame(next);
    if (crosswordIsComplete(puzzle, values)) clearModeState(scope, "crossword", "game");
    else saveModeState(scope, "crossword", "game", next);
    return values;
  };

  const selectEntry = (entryId: string, focus = true) => {
    const entry = puzzle?.entries.find((item) => item.id === entryId);
    if (!entry) return;
    feedbackSequenceRef.current += 1;
    setActiveEntryId(entry.id);
    setWordInput("");
    setWordFeedback("idle");
    setAttemptFeedback(null);
    if (!focus) return;
    window.requestAnimationFrame(() => wordInputRef.current?.focus());
  };

  const selectNextEntry = (fromEntryId: string) => {
    if (!orderedEntries.length) return;
    const currentIndex = orderedEntries.findIndex((entry) => entry.id === fromEntryId);
    const nextEntry = orderedEntries.find((entry, index) => index > currentIndex && !entryIsCorrect(entry))
      ?? orderedEntries.find((entry) => !entryIsCorrect(entry))
      ?? orderedEntries[currentIndex >= 0 ? (currentIndex + 1) % orderedEntries.length : 0];
    if (nextEntry) selectEntry(nextEntry.id);
  };

  const selectCell = (row: number, col: number) => {
    if (answerIsAnimating) return;
    const ids = puzzle?.cells[row]?.[col]?.entryIds ?? [];
    if (!ids.length) return;
    const incompleteIds = ids.filter((id) => {
      const entry = puzzle?.entries.find((item) => item.id === id);
      return entry ? !entryIsCorrect(entry) : false;
    });
    const choices = incompleteIds.length ? incompleteIds : ids;
    const currentIndex = activeEntryId ? choices.indexOf(activeEntryId) : -1;
    const nextId = currentIndex >= 0 && choices.length > 1 ? choices[(currentIndex + 1) % choices.length] : choices[0];
    if (nextId) selectEntry(nextId);
  };

  const revealWord = () => {
    if (!activeEntry || answerIsAnimating) return;
    feedbackSequenceRef.current += 1;
    setWordInput("");
    setWordFeedback("idle");
    setAttemptFeedback(null);
    const answer = splitKana(activeEntry.answer);
    const cells = crosswordEntryCells(activeEntry);
    update(cells.map(({ row, col }, index) => ({
      key: crosswordCellKey(row, col),
      value: answer[index],
    })));
  };

  const checkActiveWord = async () => {
    if (!activeEntry || !puzzle || answerIsAnimating) return;
    const candidate = toHiragana(wordInput.trim());
    setWordInput(candidate);
    const candidateCharacters = Array.from(candidate);
    if (!candidateCharacters.length) {
      selectNextEntry(activeEntry.id);
      return;
    }
    const answer = splitKana(activeEntry.answer);
    const isCorrect = candidateCharacters.length === answer.length
      && candidateCharacters.every((character) => HIRAGANA_CELL.test(character))
      && candidateCharacters.every((character, index) => character === answer[index]);
    const sequence = feedbackSequenceRef.current + 1;
    feedbackSequenceRef.current = sequence;
    if (!isCorrect) {
      setWordFeedback("incorrect");
      setAttemptFeedback({ entryId: activeEntry.id, kind: "incorrect", revealedCount: 1 });
      wordInputRef.current?.focus();
      for (let count = 2; count <= answer.length; count += 1) {
        await waitForCrosswordFeedback(CROSSWORD_TILE_REVEAL_MS);
        if (feedbackSequenceRef.current !== sequence) return;
        setAttemptFeedback({ entryId: activeEntry.id, kind: "incorrect", revealedCount: count });
      }
      await waitForCrosswordFeedback(Math.max(CROSSWORD_TILE_REVEAL_MS, CROSSWORD_ERROR_FEEDBACK_MS - (answer.length - 1) * CROSSWORD_TILE_REVEAL_MS));
      if (feedbackSequenceRef.current !== sequence) return;
      setWordFeedback("idle");
      setAttemptFeedback(null);
      return;
    }
    setWordFeedback("correct");
    setAttemptFeedback({ entryId: activeEntry.id, kind: "correct", revealedCount: 1 });
    for (let count = 2; count <= answer.length; count += 1) {
      await waitForCrosswordFeedback(CROSSWORD_TILE_REVEAL_MS);
      if (feedbackSequenceRef.current !== sequence) return;
      setAttemptFeedback({ entryId: activeEntry.id, kind: "correct", revealedCount: count });
    }
    await waitForCrosswordFeedback(CROSSWORD_TILE_REVEAL_MS);
    if (feedbackSequenceRef.current !== sequence) return;
    const cells = crosswordEntryCells(activeEntry);
    const values = update(cells.map(({ row, col }, index) => ({
      key: crosswordCellKey(row, col),
      value: answer[index],
    })));
    setWordInput("");
    if (!values || crosswordIsComplete(puzzle, values)) return;
    await waitForCrosswordFeedback(CROSSWORD_WORD_SETTLE_MS);
    if (feedbackSequenceRef.current !== sequence) return;
    const nextEntry = orderedEntries.find((entry) => entry.id !== activeEntry.id && !crosswordEntryIsCorrect(entry, values));
    if (nextEntry) selectEntry(nextEntry.id);
  };

  const startNewCrossword = () => {
    const nextPuzzle = buildPuzzle();
    const next: SavedCrossword = { puzzle: nextPuzzle, values: {}, checked: false, signature };
    setGame(next);
    setActiveEntryId(nextPuzzle?.entries.toSorted((left, right) => left.number - right.number || (left.direction === "across" ? -1 : 1))[0]?.id ?? null);
    setHintedEntryIds(new Set());
    setWordInput("");
    setWordFeedback("idle");
    setAttemptFeedback(null);
    feedbackSequenceRef.current += 1;
    saveModeState(scope, "crossword", "game", next);
  };

  if (!puzzle) return <section className={styles.emptyPanel}><h2>Couldn’t build a crossword</h2><p>Widen the level range so there are more intersecting vocabulary readings.</p><button className={styles.primaryButton} onClick={onExit}>Back to setup</button></section>;
  if (allCorrect) return (
    <section className={styles.crosswordGameShell} data-complete="true">
      <header className={styles.crosswordHeader}>
        <div><h2>Hiragana crossword</h2><p>{puzzle.entries.length} clues · complete</p></div>
        <button type="button" className={styles.iconButton} onClick={onExit} aria-label="Close crossword results"><X size={19} /></button>
      </header>
      <section className={styles.crosswordResults} aria-labelledby="crossword-complete-title">
        <div className={styles.crosswordResultLead}>
          <div className={styles.resultMark}><Check size={26} /></div>
          <div><h2 id="crossword-complete-title">Crossword complete</h2><p>You solved all {puzzle.entries.length} clues across {totalCells} cells.</p></div>
        </div>
        <section className={styles.crosswordResultReview} aria-label="Crossword answers">
          <div className={styles.crosswordResultReviewHeader}><h3>Answers</h3><p>Review the readings before starting another puzzle.</p></div>
          <div className={styles.crosswordSolutionGroups}>
            {(["across", "down"] as const).map((direction) => <section className={styles.crosswordSolutionGroup} key={direction} aria-labelledby={`crossword-result-${direction}`}>
              <h4 id={`crossword-result-${direction}`}>{direction === "across" ? "Across" : "Down"}</h4>
              <ol>{orderedEntries.filter((entry) => entry.direction === direction).map((entry) => <li key={entry.id}><b>{entry.number}</b><span>{entry.clue}</span><strong lang="ja">{filters.crosswordShowKanjiSolutions && entry.characters !== entry.answer ? <>{entry.characters}<small>{entry.answer}</small></> : entry.answer}</strong></li>)}</ol>
            </section>)}
          </div>
        </section>
        <div className={styles.crosswordResultActions}>
          <button type="button" className={styles.secondaryButton} onClick={onExit}>Back to setup</button>
          <button type="button" className={styles.primaryButton} onClick={startNewCrossword}><RotateCcw size={17} /> New crossword</button>
        </div>
      </section>
    </section>
  );
  return (
    <section className={styles.crosswordGameShell}>
      <header className={styles.crosswordHeader}>
        <div><h2>Hiragana crossword</h2><p>{puzzle.entries.length} clues · progress is saved in this browser</p></div>
        <div className={styles.crosswordHeaderActions}><span className={styles.crosswordProgress} aria-live="polite"><b>{solvedCount}</b> / {puzzle.entries.length} solved</span><button className={styles.iconButton} onClick={onExit} aria-label="Pause crossword"><X size={19} /></button></div>
      </header>
      <div className={styles.crosswordWorkbench}>
        <nav className={styles.crosswordClueRail} aria-label="Crossword clues">
          <div className={styles.crosswordClueRailHeader}><h3>Clues</h3><span>{filledCount} / {totalCells} cells</span></div>
          {(["across", "down"] as const).map((direction) => <section className={styles.crosswordClueGroup} key={direction} aria-labelledby={`crossword-${direction}`}><h4 id={`crossword-${direction}`}>{direction === "across" ? "Across" : "Down"}</h4>{orderedEntries.filter((entry) => entry.direction === direction).map((entry) => {
            const selected = entry.id === activeEntry?.id;
            const solved = entryIsCorrect(entry);
            return <button type="button" className={styles.crosswordClueButton} key={entry.id} data-selected={selected} data-solved={solved} aria-current={selected ? "true" : undefined} aria-label={`${entry.number} ${direction === "across" ? "Across" : "Down"}: ${entry.clue}`} disabled={answerIsAnimating} onClick={() => selectEntry(entry.id)}><b>{entry.number}</b><span>{entry.clue}</span><small>{splitKana(entry.answer).length}</small>{solved ? <Check size={15} aria-label="Solved" /> : null}</button>;
          })}</section>)}
        </nav>
        <div className={styles.crosswordBoardPane}>
          <div className={styles.crosswordBoardViewport}>
            <div className={styles.crosswordGrid} data-feedback={wordFeedback} style={{ "--crossword-cols": puzzle.cols, "--crossword-rows": puzzle.rows } as React.CSSProperties} aria-label="Crossword grid">{puzzle.cells.flatMap((row, rowIndex) => row.map((cell, colIndex) => {
              const key = crosswordCellKey(rowIndex, colIndex);
              if (!cell) return <span key={key} className={styles.blockedCell} aria-hidden="true" />;
              const feedbackIndex = attemptCellIndexByKey.get(key);
              const feedback = feedbackIndex !== undefined && attemptFeedback && feedbackIndex < attemptFeedback.revealedCount ? attemptFeedback.kind : null;
              const completed = completedCellKeys.has(key);
              const value = completed ? cell.answer : wordPreviewByCell.get(key) ?? game.values[key] ?? "";
              const incorrect = game.checked && value !== cell.answer;
              return <button type="button" className={styles.crosswordCell} key={key} data-selected={activeCellKeys.has(key)} data-completed={completed} data-feedback={feedback ?? (incorrect ? "incorrect" : undefined)} aria-label={`Row ${rowIndex + 1}, column ${colIndex + 1}`} aria-pressed={activeCellKeys.has(key)} disabled={answerIsAnimating} onClick={() => selectCell(rowIndex, colIndex)}>{cell.number !== undefined ? <span className={styles.crosswordCellNumber}>{cell.number}</span> : null}<span className={styles.crosswordCellLetter} data-letter lang="ja">{value}</span></button>;
            }))}</div>
          </div>
          <section className={styles.crosswordActiveClue} aria-label="Selected clue">
            <div className={styles.crosswordActiveClueTop}>
              <div className={styles.crosswordActiveClueCopy}><span>{activeEntry ? `${activeEntry.number} ${activeEntry.direction === "across" ? "Across" : "Down"}` : "Select a clue"}</span><strong data-active-clue>{activeEntry?.clue ?? "Pick a clue or a cell"}</strong>{activeEntry && hintedEntryIds.has(activeEntry.id) ? <p>{crosswordHint(activeEntry, filters.crosswordClueMode)}</p> : null}</div>
              <div className={styles.crosswordHintActions}><button type="button" className={styles.crosswordHintButton} aria-label="Show hint" disabled={!activeEntry || hintedEntryIds.has(activeEntry.id)} onClick={() => activeEntry && setHintedEntryIds((current) => new Set(current).add(activeEntry.id))}><Sparkles size={16} /> Hint</button><button type="button" className={styles.crosswordHintButton} aria-label="Play pronunciation" disabled={!activeEntry?.audioUrl} onClick={() => playAudio(activeEntry?.audioUrl)}><Volume2 size={16} /> Audio</button><button type="button" className={styles.crosswordHintButton} aria-label="Reveal word" disabled={!activeEntry || entryIsCorrect(activeEntry)} onClick={revealWord}><Lightbulb size={16} /> Reveal word</button></div>
            </div>
            <form className={styles.crosswordWordForm} data-feedback={wordFeedback} onSubmit={(event) => { event.preventDefault(); void checkActiveWord(); }}>
              <label htmlFor="crossword-word-answer">Answer</label>
              <input ref={wordInputRef} id="crossword-word-answer" lang="ja" value={wordInput} placeholder={activeEntry ? `Type ${splitKana(activeEntry.answer).length} kana or romaji` : "Select a clue"} autoComplete="off" autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="go" disabled={answerIsAnimating} aria-invalid={wordFeedback === "empty" || wordFeedback === "incorrect" || undefined} aria-describedby="crossword-word-status" onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void checkActiveWord(); } }} onChange={(event) => { feedbackSequenceRef.current += 1; setWordInput(composeKanaInput(event.target.value)); setWordFeedback("idle"); setAttemptFeedback(null); }} />
              <button type="submit" className={styles.primaryButton} disabled={!activeEntry || answerIsAnimating}>Check word</button>
            </form>
          </section>
          <footer className={styles.crosswordFooter}>
            <p id="crossword-word-status" role="status">{wordFeedback === "empty" ? "Type the selected word before checking it." : wordFeedback === "correct" ? "Correct. Revealing the word…" : wordFeedback === "incorrect" ? "That answer does not match the selected clue. Try again." : game.checked && !allCorrect ? "Some letters need another look." : "Type below and press Return to check the selected word. Select tiles to change words."}</p>
            <div className={styles.gameActions}><button type="button" className={styles.primaryButton} disabled={answerIsAnimating} onClick={() => { const next = { ...game, checked: true }; setGame(next); saveModeState(scope, "crossword", "game", next); }}>Check puzzle</button></div>
          </footer>
        </div>
      </div>
    </section>
  );
}

interface SavedWordle { targetId: number; target: string; guesses: string[]; maxAttempts: number; length: number; validWords: string[]; signature: string }

export function KanaWordle({ dataset, filters, scope, onExit }: { dataset: StudyDataset; filters: StudyFilters; scope: StudyStorageScope; onExit: () => void }) {
  const stored = loadModeState<SavedWordle>(scope, "kana-wordle", "game");
  const [length, setLength] = useState(filters.wordLength);
  const signatureForLength = (wordLength: number) => JSON.stringify({ length: wordLength, attempts: filters.wordleMaxAttempts, srs: filters.srsGroups, levels: [filters.minLevel, filters.maxLevel], types: filters.subjectTypes, ids: filters.selectedSubjectIds });
  const signature = signatureForLength(length);
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
  const startNewGame = (wordLength: number) => {
    const pool = wordleCandidates(filterStudySubjects(dataset, filters), wordLength);
    const pick = chooseWordleCandidate(pool);
    if (!pick) { setGame(null); setGuess(""); setGuessError(""); return; }
    const next = { targetId: pick.subject.id, target: pick.reading, guesses: [], maxAttempts: filters.wordleMaxAttempts, length: wordLength, validWords: pool.map((item) => item.reading), signature: signatureForLength(wordLength) };
    setGame(next); setGuess(""); setGuessError(""); saveModeState(scope, "kana-wordle", "game", next);
  };
  const newGame = () => startNewGame(length);
  const changeLength = (wordLength: number) => {
    setLength(wordLength);
    clearModeState(scope, "kana-wordle", "game");
    startNewGame(wordLength);
  };
  return (
    <section className={styles.wordleShell}>
      <div className={styles.gameHeading}><div><h2>Kana Wordle</h2><p>Small kana count as their own tile.</p></div><button className={styles.iconButton} onClick={onExit} aria-label="Pause Kana Wordle"><X size={19} /></button></div>
      <div className={styles.lengthTabs} role="group" aria-label="Word length">{[3, 4, 5, 6, 7].map((item) => <button key={item} data-active={length === item} onClick={() => changeLength(item)}>{item} kana</button>)}</div>
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

export function CustomLessons({ dataset, filters, scope, subjectDetailSettings, immersionSources = [], onExit }: { dataset: StudyDataset; filters: StudyFilters; scope: StudyStorageScope; subjectDetailSettings?: WebSettings["subjectDetails"]; immersionSources?: string[]; onExit: () => void }) {
  const subjects = useMemo(() => dataset.subjects.filter((subject) => filters.selectedSubjectIds.includes(subject.id) && !subject.data.hidden_at), [dataset.subjects, filters.selectedSubjectIds]);
  const saved = loadModeState<{ index: number }>(scope, "custom-lessons", "progress");
  const [index, setIndex] = useState(() => Math.min(saved?.index ?? 0, Math.max(subjects.length - 1, 0)));
  const subject = subjects[index];
  const move = (next: number) => { setIndex(next); saveModeState(scope, "custom-lessons", "progress", { index: next }); };
  if (!subject) return <section className={styles.emptyPanel}><h2>No subjects selected</h2><p>Return to setup and choose at least one unlocked subject.</p><button className={styles.primaryButton} onClick={onExit}>Back to setup</button></section>;
  const meaning = primaryMeaning(subject); const reading = primaryReading(subject);
  const assignment = dataset.assignments.find((candidate) => candidate.data.subject_id === subject.id);
  return <section className={styles.lessonShell}><div className={styles.quizTopbar}><span>{index + 1} / {subjects.length}</span><div className={styles.progressTrack}><span style={{ transform: `scaleX(${(index + 1) / subjects.length})` }} /></div><button className={styles.iconButton} onClick={onExit} aria-label="Pause lessons"><X size={19} /></button></div><article className={styles.lessonCard} data-type={subject.object}><p>{subject.object.replace("_", " ")} · Level {subject.data.level}</p><h2><SubjectCharacter subject={subject} fallbackText={meaning} className={styles.surfaceSubjectCharacter} imageTone="subject" eager /></h2><div className={styles.lessonFacts}><div><h3>Meaning</h3><strong>{meaning}</strong><p>{subject.data.meanings.map((item) => item.meaning).join(" · ")}</p></div>{reading ? <div><h3>Reading</h3><strong lang="ja">{reading}</strong><p lang="ja">{subject.data.readings?.map((item) => item.reading).join(" · ")}</p></div> : null}</div><StudySubjectDetails key={subject.id} record={subject} subjects={dataset.subjects} assignment={assignment} settings={subjectDetailSettings} immersionSources={immersionSources} initialTab="meaning" idPrefix={`custom-lesson-${subject.id}`} returnTo="/study/custom-lessons" /></article><div className={styles.lessonNav}><button className={styles.secondaryButton} disabled={index === 0} onClick={() => move(index - 1)}><ArrowLeft size={17} /> Previous</button>{index < subjects.length - 1 ? <button className={styles.primaryButton} onClick={() => move(index + 1)}>Next <ArrowRight size={17} /></button> : <button className={styles.primaryButton} onClick={() => { clearModeState(scope, "custom-lessons", "progress"); onExit(); }}><Check size={17} /> Finish</button>}</div></section>;
}

export function SubjectLists({ subjects, scope, username }: { subjects: Subject[]; scope: StudyStorageScope; username: string }) {
  const { repository, lists } = useSubjectLists(username);
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
  return <div className={styles.listsLayout}><aside className={styles.listsSidebar}><form onSubmit={(event) => { event.preventDefault(); create(); }}><label htmlFor="new-list">New list</label><div><input id="new-list" value={name} onChange={(event) => setName(event.target.value)} placeholder="JLPT refresh" /><button className={styles.primaryButton} disabled={!name.trim()}>Create</button></div></form><nav aria-label="Saved subject lists">{lists.map((list) => <button key={list.id} data-active={list.id === resolvedActiveId} onClick={() => setActiveId(list.id)}><span>{list.name}</span><small>{list.subjectIds.length}</small></button>)}</nav>{deletedList ? <div className={styles.undoNotice} role="status"><span>List deleted</span><button className={styles.textButton} onClick={() => { const next = [...lists]; next.splice(deletedList.index, 0, deletedList.list); commit(next); setActiveId(deletedList.list.id); setDeletedList(null); }}>Undo</button></div> : null}{active ? <button className={styles.dangerButton} onClick={() => { const index = lists.findIndex((list) => list.id === active.id); const next = lists.filter((list) => list.id !== active.id); setDeletedList({ list: active, index }); commit(next); setActiveId(next[0]?.id ?? null); }}><Trash2 size={16} /> Delete list</button> : null}</aside><section className={styles.listEditor}>{active ? <><div className={styles.configTitleRow}><div><h2>{active.name}</h2><p>{active.subjectIds.length} subjects. Changes sync with your Kakehashi account.</p></div></div><label className={styles.largeSearch}>Find subjects<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search characters or meanings" /></label><div className={styles.subjectPickerGrid}>{shown.map((subject) => { const selected = active.subjectIds.includes(subject.id); return <button type="button" key={subject.id} className={styles.subjectPick} data-active={selected} data-type={subject.object} onClick={() => toggle(subject.id)} aria-pressed={selected}><strong><SubjectCharacter subject={subject} fallbackText="◈" className={styles.surfaceSubjectCharacter} imageTone="subject" /></strong><span>{primaryMeaning(subject)}</span><small>{selected ? "Added" : `Level ${subject.data.level}`}</small></button>; })}</div></> : <div className={styles.emptyPanel}><Library size={24} aria-hidden="true" /><h2>Create your first list</h2><p>Lists can feed custom reviews, lessons, writing practice, and both games.</p></div>}</section></div>;
}
