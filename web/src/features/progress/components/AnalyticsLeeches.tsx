"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Eye, Play, RotateCcw, Search, Shuffle, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import { SubjectAudioButton, SubjectAudioProvider } from "@/features/subjects/components/SubjectAudioControls";
import { checkAnswer, type AnswerResult, type QuestionKind } from "@/features/core-study/answer-checker";
import { kindsForSubject } from "@/features/core-study/queue";
import { composeKanaInput } from "@/lib/kana";
import type { Subject, SubjectType } from "@/types/wanikani";
import { srsBucketForStage } from "../calculations";
import type { AnalyticsInsights, DifficultItem } from "../analytics-insights";
import { csvCell, downloadAnalyticsFile } from "../analytics-export";
import { shuffleArray } from "../../../../../src/utils/reviewUtils";
import { Segments } from "./AnalyticsPrimitives";
import styles from "../analytics-leeches.module.css";

type PracticeMode = "flashcards" | "typed";
type PracticeQuestionMode = "both" | "meaning" | "reading";
type DifficultyScoring = "weighted" | "recent";
type PracticePrompt = { key: string; subject: Subject; kind: QuestionKind | "flashcard" };
const SUBJECT_TYPES: { value: SubjectType; label: string }[] = [
  { value: "radical", label: "Radicals" }, { value: "kanji", label: "Kanji" },
  { value: "vocabulary", label: "Vocabulary" }, { value: "kana_vocabulary", label: "Kana vocabulary" },
];
const SRS_STAGES = ["Apprentice", "Guru", "Master", "Enlightened", "Burned"] as const;

const SCORE_DESCRIPTIONS: Record<DifficultyScoring, string> = {
  weighted: "Highest meaning or reading error count divided by its current correct streak to the power of 1.5",
  recent: "Highest meaning or reading lifetime error percentage divided by one plus its current correct streak",
};

function meaningOf(subject: Subject) {
  return subject.data.meanings.find((meaning) => meaning.primary)?.meaning ?? subject.data.meanings[0]?.meaning ?? subject.data.slug;
}

export function scoreDifficultItem(item: DifficultItem, scoring: DifficultyScoring): DifficultItem {
  if (scoring === "weighted") return item;
  const meaning = item.meaningAccuracy === null ? 0 : (100 - item.meaningAccuracy) / (1 + Math.max(0, item.meaningStreak));
  const reading = item.readingAccuracy === null || item.readingStreak === null ? 0 : (100 - item.readingAccuracy) / (1 + Math.max(0, item.readingStreak));
  return { ...item, score: Math.round(Math.max(meaning, reading) * 10) / 10, weakest: reading > meaning ? "reading" : "meaning" };
}

function lessonTimestamp(item: DifficultItem) {
  const timestamp = Date.parse(item.assignment?.data.started_at ?? "");
  return Number.isFinite(timestamp) ? timestamp : Infinity;
}

function neverPassedGuru(item: DifficultItem) {
  const assignment = item.assignment?.data;
  return Boolean(assignment && !assignment.hidden && assignment.srs_stage >= 1 && assignment.srs_stage <= 4 && !assignment.passed_at && Number.isFinite(lessonTimestamp(item)));
}

export function difficultItemsCsv(items: DifficultItem[], scoring: DifficultyScoring = "weighted", now = Date.now()) {
  return [
    ["Subject ID", "Characters", "Meaning", "Reading", "Type", "Level", "SRS", "Difficulty score", "Accuracy (%)", "Meaning accuracy (%)", "Reading accuracy (%)", "Mistakes", "Weakest answer", "Scoring method", "Lesson date", "First passed Guru", "Days since lesson"],
    ...items.map((item) => [item.subject.id, item.subject.data.characters, meaningOf(item.subject), (item.subject.data.readings ?? []).filter((reading) => reading.primary).map((reading) => reading.reading).join(", "), item.subject.object, item.subject.data.level, srsBucketForStage(item.assignment?.data.srs_stage ?? 0), item.score, item.accuracy, item.meaningAccuracy, item.readingAccuracy, item.errors, item.weakest, scoring, item.assignment?.data.started_at, item.assignment?.data.passed_at, Number.isFinite(lessonTimestamp(item)) ? Math.max(0, Math.floor((now - lessonTimestamp(item)) / 86_400_000)) : null]),
  ].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function LeechesWidget({ insights, subjects = [], expanded = false }: { insights: AnalyticsInsights; subjects?: Subject[]; expanded?: boolean }) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [stage, setStage] = useState("all");
  const [sort, setSort] = useState("score");
  const [scoring, setScoring] = useState<DifficultyScoring>("weighted");
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState("10");
  const [mode, setMode] = useState<PracticeMode>("flashcards");
  const [practice, setPractice] = useState<{ items: Subject[]; mode: PracticeMode } | null>(null);
  const [minimumErrors, setMinimumErrors] = useState(1);
  const [weakest, setWeakest] = useState("all");
  const [hideBurned, setHideBurned] = useState(true);
  const [excludeNew, setExcludeNew] = useState(false);
  const [neverPassed, setNeverPassed] = useState(false);
  const [shuffled, setShuffled] = useState(false);
  const [showAllPairs, setShowAllPairs] = useState(false);
  const [notice, setNotice] = useState("");
  const [now] = useState(() => Date.now());
  const countId = useId();
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    const newLessonCutoff = now - 7 * 86_400_000;
    return insights.difficultItems.map((item) => scoreDifficultItem(item, scoring)).filter((item) => {
      if (type !== "all" && item.subject.object !== type) return false;
      if (stage !== "all" && srsBucketForStage(item.assignment?.data.srs_stage ?? 0) !== stage) return false;
      if (hideBurned && (item.assignment?.data.srs_stage ?? 0) >= 9) return false;
      if (item.errors < minimumErrors || (weakest !== "all" && item.weakest !== weakest)) return false;
      if (excludeNew && (!item.assignment?.data.started_at || Date.parse(item.assignment.data.started_at) >= newLessonCutoff)) return false;
      if (neverPassed && !neverPassedGuru(item)) return false;
      return !needle || [item.subject.data.characters, item.subject.data.slug, ...item.subject.data.meanings.map((meaning) => meaning.meaning), ...(item.subject.data.readings ?? []).map((reading) => reading.reading)].some((value) => value?.toLocaleLowerCase().includes(needle));
    }).sort((a, b) => {
      const difference = sort === "accuracy" ? (a.accuracy ?? 101) - (b.accuracy ?? 101)
        : sort === "errors" ? b.errors - a.errors
          : sort === "level" ? a.subject.data.level - b.subject.data.level
            : sort === "stuck" ? Number(neverPassedGuru(b)) - Number(neverPassedGuru(a)) || lessonTimestamp(a) - lessonTimestamp(b)
            : b.score - a.score;
      return difference || b.score - a.score || a.subject.id - b.subject.id;
    });
  }, [excludeNew, hideBurned, insights.difficultItems, minimumErrors, neverPassed, now, query, scoring, sort, stage, type, weakest]);
  const pageSize = expanded ? 25 : 5;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const selected = filtered.slice(0, limit === "all" ? filtered.length : Number(limit));
  const filteredActive = Boolean(query || type !== "all" || stage !== "all" || minimumErrors > 1 || weakest !== "all" || excludeNew || !hideBurned || neverPassed || scoring !== "weighted");
  const similarPairs = useMemo(() => {
    const byId = new Map([...subjects, ...insights.difficultItems.map((item) => item.subject)].map((subject) => [subject.id, subject]));
    const seen = new Set<string>();
    return filtered.flatMap(({ subject }) => (subject.data.visually_similar_subject_ids ?? []).flatMap((id) => {
      const other = byId.get(id);
      const key = [subject.id, id].sort((a, b) => a - b).join("-");
      if (!other || other.data.hidden_at || subject.id === id || seen.has(key)) return [];
      seen.add(key);
      return [{ key, subjects: [subject, other] }];
    }));
  }, [filtered, insights.difficultItems, subjects]);

  function clearFilters() {
    setQuery(""); setType("all"); setStage("all"); setPage(0); setMinimumErrors(1); setWeakest("all"); setHideBurned(true); setExcludeNew(false); setNeverPassed(false); setScoring("weighted"); setSort("score");
  }

  function startPractice(items: Subject[]) {
    setPractice({ items: shuffled ? shuffleArray(items) : items, mode });
  }

  return <div className={styles.widget} data-expanded={expanded || undefined}>
    <div className={styles.filterBar}>
      <label className={styles.search}><span className="sr-only">Search difficult items</span><Search size={16} aria-hidden /><input type="search" value={query} onChange={(event) => { setQuery(event.target.value); setPage(0); }} placeholder="Search items" aria-describedby={countId} /></label>
      <details className={styles.filterSettings} open={expanded || undefined}>
        <summary><SlidersHorizontal size={15} aria-hidden /><span>Filters</span><ChevronDown size={14} aria-hidden /></summary>
        <div className={styles.filters}>
      <label className={styles.filter}><span className="sr-only">Subject type</span><select value={type} onChange={(event) => { setType(event.target.value); setPage(0); }}><option value="all">All types</option>{SUBJECT_TYPES.map((entry) => <option value={entry.value} key={entry.value}>{entry.label}</option>)}</select></label>
      <label className={styles.filter}><span className="sr-only">SRS stage</span><select value={stage} onChange={(event) => { setStage(event.target.value); setPage(0); }}><option value="all">All stages</option>{SRS_STAGES.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
      <label className={styles.filter}><span className="sr-only">Sort difficult items</span><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(0); }}><option value="score">Highest difficulty</option><option value="accuracy">Lowest accuracy</option><option value="errors">Most mistakes</option><option value="level">Level</option><option value="stuck">Longest in Apprentice</option></select></label>
        </div>

    <details className={styles.advanced} open={expanded || undefined}>
      <summary><SlidersHorizontal size={16} aria-hidden />More filters</summary>
      <div className={styles.advancedControls}>
        <label className={styles.labeledFilter}><span>Scoring method</span><select value={scoring} onChange={(event) => { setScoring(event.target.value as DifficultyScoring); setPage(0); }}><option value="weighted">Weighted mistakes</option><option value="recent">Recent struggle</option></select></label>
        <label className={styles.numberFilter}><span>Minimum mistakes</span><input type="number" min={1} max={100000} value={minimumErrors} onChange={(event) => { setMinimumErrors(Math.max(1, Math.min(100000, Number(event.target.value) || 1))); setPage(0); }} /></label>
        <label className={styles.labeledFilter}><span>Weakest answer</span><select value={weakest} onChange={(event) => { setWeakest(event.target.value); setPage(0); }}><option value="all">Meaning and reading</option><option value="meaning">Meaning</option><option value="reading">Reading</option></select></label>
        <label className={styles.checkOption}><input type="checkbox" checked={hideBurned} onChange={(event) => { setHideBurned(event.target.checked); setPage(0); }} />Hide burned items</label>
        <label className={styles.checkOption}><input type="checkbox" checked={excludeNew} onChange={(event) => { setExcludeNew(event.target.checked); setPage(0); }} />Exclude new lessons (7 days)</label>
        <label className={styles.checkOption}><input type="checkbox" checked={neverPassed} onChange={(event) => { setNeverPassed(event.target.checked); setPage(0); }} />Never passed Guru</label>
        <Button type="button" tone="ghost" size="small" title="Apprentice items that have never passed Guru, oldest lessons first" onClick={() => { setStage("Apprentice"); setMinimumErrors(1); setExcludeNew(false); setNeverPassed(true); setSort("stuck"); setPage(0); }}>Stuck in Apprentice</Button>
        {filteredActive ? <Button type="button" tone="ghost" size="small" onClick={clearFilters}>Clear filters</Button> : null}
      </div>
    </details>
    {scoring === "recent" ? <p className={styles.scoringNote}>Recent struggle uses current answer streaks, not dated review history.</p> : null}
      </details>
    </div>

    <div className={styles.tableScroll}>
      <table className={styles.table}>
        <caption className="sr-only">Difficult items ranked by {sort === "accuracy" ? "lowest accuracy" : sort === "errors" ? "most mistakes" : sort === "level" ? "level" : sort === "stuck" ? "longest time since the first lesson for items never passed to Guru" : "highest difficulty score"}</caption>
        <thead><tr><th scope="col">Item</th><th scope="col" className={styles.detailColumn}>SRS</th><th scope="col"><abbr title={SCORE_DESCRIPTIONS[scoring]}>Score</abbr></th><th scope="col">Accuracy</th><th scope="col" className={styles.detailColumn}>Mistakes</th><th scope="col"><span className="sr-only">Practice</span></th></tr></thead>
        <tbody>{visible.map((item) => <tr key={item.subject.id}>
          <th scope="row"><Link href={`/subjects/${item.subject.id}?returnTo=${encodeURIComponent("/analytics")}`} className={styles.subject}>
            <SubjectCharacter subject={item.subject} className={styles.character} imageSize="2rem" data-type={item.subject.object} />
            <span><strong>{meaningOf(item.subject)}</strong><span title={`${item.weakest === "reading" ? "Reading" : "Meaning"} difficulty`}>Level {item.subject.data.level}{expanded ? ` · ${item.weakest === "reading" ? "Reading" : "Meaning"}` : ""}</span>{sort === "stuck" && neverPassedGuru(item) ? <span>{Math.max(0, Math.floor((now - lessonTimestamp(item)) / 86_400_000))} days since lesson</span> : null}</span>
          </Link></th>
          <td className={styles.detailColumn}>{srsBucketForStage(item.assignment?.data.srs_stage ?? 0)}</td>
          <td className={styles.numeric}>{item.score.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
          <td className={styles.numeric}>{item.accuracy === null ? "-" : `${item.accuracy.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`}</td>
          <td className={`${styles.numeric} ${styles.detailColumn}`}>{item.errors.toLocaleString()}</td>
          <td><button type="button" className={styles.iconButton} aria-label={`Practice ${meaningOf(item.subject)}`} title={`Practice ${meaningOf(item.subject)}`} onClick={() => startPractice([item.subject])}><Play size={16} aria-hidden /></button></td>
        </tr>)}</tbody>
      </table>
      {filtered.length === 0 ? <div className={styles.empty}><p>{filteredActive ? "No items match these filters." : "No difficult items in your review statistics."}</p>{filteredActive ? <Button type="button" tone="ghost" size="small" onClick={clearFilters}>Reset filters</Button> : null}</div> : null}
    </div>

    <div className={styles.pagination}>
      <span id={countId} role="status">{filtered.length ? `${currentPage * pageSize + 1}-${Math.min((currentPage + 1) * pageSize, filtered.length)} of ${filtered.length.toLocaleString()} ${filtered.length === 1 ? "item" : "items"}` : "0 items"}</span>
      <div><button type="button" className={styles.iconButton} aria-label="Export difficult items CSV" title="Export filtered items as CSV" disabled={!filtered.length} onClick={() => { downloadAnalyticsFile(`\ufeff${difficultItemsCsv(filtered, scoring, now)}`, "kakehashi-difficult-items.csv", "text/csv;charset=utf-8"); setNotice(`${filtered.length} items exported.`); }}><Download size={16} aria-hidden /></button>{pageCount > 1 ? <><button type="button" className={styles.iconButton} aria-label="Previous difficult items" title="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={18} aria-hidden /></button><button type="button" className={styles.iconButton} aria-label="Next difficult items" title="Next page" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={18} aria-hidden /></button></> : null}</div>
    </div>

    <div className={styles.practiceControls}>
      <Button type="button" tone="primary" disabled={!selected.length} onClick={() => startPractice(selected.map((item) => item.subject))}><Play size={16} aria-hidden />Practice {selected.length}</Button>
      <details className={styles.practiceSettings} open={expanded || undefined}>
        <summary><span>Practice options</span><ChevronDown size={14} aria-hidden /></summary>
        <div className={styles.practiceOptions}>
      <div className={styles.modeOptions} role="group" aria-label="Practice mode">
        <button type="button" aria-pressed={mode === "flashcards"} onClick={() => setMode("flashcards")}>Flashcards</button>
        <button type="button" aria-pressed={mode === "typed"} onClick={() => setMode("typed")}>Type answers</button>
      </div>
      <label className={styles.filter}><span className="sr-only">Practice item count</span><select value={limit} onChange={(event) => setLimit(event.target.value)}><option value="10">Top 10</option><option value="25">Top 25</option><option value="all">All filtered</option></select></label>
      <button type="button" className={styles.iconButton} aria-label="Shuffle practice order" aria-pressed={shuffled} title="Shuffle practice order" onClick={() => setShuffled((value) => !value)}><Shuffle size={17} aria-hidden /></button>
        </div>
      </details>
    </div>
    {similarPairs.length > 0 ? <details className={styles.similar}><summary>Similar-looking kanji <span>{similarPairs.length} pairs</span></summary><ul>{(showAllPairs ? similarPairs : similarPairs.slice(0, 6)).map((pair) => <li key={pair.key}><div>{pair.subjects.map((subject) => <Link key={subject.id} href={`/subjects/${subject.id}?returnTo=${encodeURIComponent("/analytics")}`} title={meaningOf(subject)}><span lang="ja">{subject.data.characters}</span><span>{meaningOf(subject)}</span></Link>)}</div><button type="button" className={styles.iconButton} title="Practice this pair" aria-label={`Practice ${pair.subjects.map(meaningOf).join(" and ")}`} onClick={() => startPractice(pair.subjects)}><Play size={16} aria-hidden /></button></li>)}</ul>{similarPairs.length > 6 ? <Button type="button" tone="ghost" size="small" onClick={() => setShowAllPairs((value) => !value)}>{showAllPairs ? "Show fewer pairs" : `Show all ${similarPairs.length} pairs`}</Button> : null}</details> : null}
    <p className="sr-only" role="status" aria-live="polite">{notice}</p>
    {practice ? <LeechPracticeDialog items={practice.items} mode={practice.mode} onClose={() => setPractice(null)} /> : null}
  </div>;
}

function practicePrompts(items: Subject[], mode: PracticeMode, questions: PracticeQuestionMode = "both"): PracticePrompt[] {
  return items.flatMap<PracticePrompt>((subject) => mode === "flashcards"
    ? [{ key: `${subject.id}-flashcard`, subject, kind: "flashcard" as const }]
    : kindsForSubject(subject).filter((kind) => (questions === "both" || kind === questions) && (kind === "meaning" || subject.data.readings?.some((reading) => reading.accepted_answer))).map((kind) => ({ key: `${subject.id}-${kind}`, subject, kind })));
}

function LeechPracticeDialog({ items, mode, onClose }: { items: Subject[]; mode: PracticeMode; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [questions, setQuestions] = useState<PracticeQuestionMode>("both");
  const [sessionVersion, setSessionVersion] = useState(0);
  const [queue, setQueue] = useState(() => practicePrompts(items, mode));
  const [attempts, setAttempts] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [total, setTotal] = useState(queue.length);
  const [itemCount, setItemCount] = useState(() => new Set(queue.map((prompt) => prompt.subject.id)).size);
  const [missed, setMissed] = useState(() => new Set<number>());
  const current = queue[0];

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    dialog.querySelector<HTMLElement>("[data-practice-focus]")?.focus({ preventScroll: true });
    return () => {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
      previous?.focus();
    };
  }, []);

  function grade(correct: boolean) {
    if (!current) return;
    setAttempts((value) => value + 1);
    if (!correct) { setMistakes((value) => value + 1); setMissed((value) => new Set([...value, current.subject.id])); }
    setQueue((value) => correct ? value.slice(1) : [...value.slice(1), value[0]]);
  }

  function restartPractice(nextItems: Subject[], nextQuestions: PracticeQuestionMode) {
    const prompts = practicePrompts(nextItems, mode, nextQuestions);
    setQueue(prompts);
    setTotal(prompts.length);
    setItemCount(new Set(prompts.map((prompt) => prompt.subject.id)).size);
    setAttempts(0);
    setMistakes(0);
    setMissed(new Set());
    setSessionVersion((value) => value + 1);
  }

  function changeQuestions(nextQuestions: PracticeQuestionMode) {
    if (nextQuestions === questions) return;
    setQuestions(nextQuestions);
    restartPractice(items, nextQuestions);
  }

  return <dialog
    ref={dialogRef}
    className={styles.dialog}
    aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onKeyDown={(event) => event.stopPropagation()}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    <header className={styles.dialogHeader}><div><h2 id={titleId}>Difficult item practice</h2><p>{mode === "flashcards" ? "Flashcards" : questions === "meaning" ? "Meaning only" : questions === "reading" ? "Reading only" : "Meaning and reading"} · {itemCount} {itemCount === 1 ? "item" : "items"} · Practice only</p></div><button type="button" className={styles.iconButton} aria-label="Close practice" title="Close practice" onClick={onClose}><X size={19} aria-hidden /></button></header>
    {mode === "typed" ? <div className={styles.sessionProgress}><Segments label="Practice questions" value={questions} onChange={changeQuestions} options={[{ value: "both", label: "Both" }, { value: "meaning", label: "Meaning" }, { value: "reading", label: "Reading" }]} /></div> : null}
    {current ? <>
      <div className={styles.sessionProgress}><progress max={total} value={total - queue.length} aria-label="Practice progress" /><span>{total - queue.length} / {total}</span></div>
      <PracticeCard key={`${sessionVersion}-${current.key}-${attempts}`} prompt={current} remaining={queue.length} onGrade={grade} />
    </> : total === 0 ? <div className={styles.complete}>
      <h3>No reading prompts</h3>
      <p>These items do not have a reading question.</p>
      <Button type="button" onClick={() => changeQuestions("meaning")}>Practice meanings</Button>
    </div> : <div className={styles.complete}>
      <Check size={32} aria-hidden />
      <h3>Practice complete</h3>
      <dl><div><dt>Items practiced</dt><dd>{itemCount}</dd></div><div><dt>Accuracy</dt><dd>{attempts ? Math.round((attempts - mistakes) / attempts * 100) : 0}%</dd></div><div><dt>Attempts</dt><dd>{attempts}</dd></div></dl>
      <div className={styles.completionActions}>
        {missed.size ? <Button type="button" onClick={() => restartPractice(items.filter((item) => missed.has(item.id)), questions)}><RotateCcw size={16} aria-hidden />Practice missed items</Button> : null}
        <Button type="button" tone="primary" onClick={onClose}><Check size={16} aria-hidden />Done</Button>
      </div>
    </div>}
  </dialog>;
}

function PracticeCard({ prompt, remaining, onGrade }: { prompt: PracticePrompt; remaining: number; onGrade: (correct: boolean) => void }) {
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<AnswerResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const revealRef = useRef<HTMLButtonElement>(null);
  const gradeRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { subject, kind } = prompt;
  const checked = feedback !== null && feedback.status !== "blocked";
  const meanings = subject.data.meanings.filter((meaning) => meaning.accepted_answer).map((meaning) => meaning.meaning).join(", ");
  const readings = (subject.data.readings ?? []).filter((reading) => reading.accepted_answer).map((reading) => reading.reading).join(", ");
  const characterCount = Array.from(subject.data.characters ?? "").length;

  useEffect(() => {
    if (kind === "flashcard") revealRef.current?.focus({ preventScroll: true });
    else inputRef.current?.focus({ preventScroll: true });
  }, [kind]);

  useEffect(() => {
    if (revealed) gradeRef.current?.querySelector("button")?.focus({ preventScroll: true });
  }, [revealed]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (kind === "flashcard") return;
    if (checked) { onGrade(feedback.status === "correct" || feedback.status === "close"); return; }
    setFeedback(checkAnswer(subject, kind, answer));
  }

  return <SubjectAudioProvider><div className={styles.practiceCard}>
    <div className={styles.prompt} data-type={subject.object} data-long={characterCount > 6 ? "true" : undefined}>
      <SubjectCharacter subject={subject} imageSize="4rem" imageTone="subject" fallbackText="Radical" lang="ja" />
      <span>Level {subject.data.level}</span>
    </div>
    <h3 className={styles.questionKind} id={titleId}>{kind === "flashcard" ? "Meaning and reading" : kind === "reading" ? "Reading" : "Meaning"}</h3>

    {kind === "flashcard" ? <div className={styles.answerArea}>
      {revealed ? <>
        <div className={styles.revealed} role="status"><strong>{meanings || meaningOf(subject)}</strong>{readings ? <p lang="ja">{readings}</p> : null}{subject.data.pronunciation_audios?.[0] ? <SubjectAudioButton audioKey={`leech-${subject.id}`} src={subject.data.pronunciation_audios[0].url} label="pronunciation" variant="pronunciation" /> : null}<Link href={`/subjects/${subject.id}?returnTo=${encodeURIComponent("/analytics")}`} onClick={(event) => event.stopPropagation()}>Subject details</Link></div>
        <div className={styles.gradeButtons} ref={gradeRef}><Button type="button" onClick={() => onGrade(false)}><RotateCcw size={16} aria-hidden />Again</Button><Button type="button" tone="primary" onClick={() => onGrade(true)}><Check size={16} aria-hidden />Know</Button></div>
      </> : <Button type="button" className={styles.revealButton} data-practice-focus onClick={() => setRevealed(true)} aria-label="Reveal answer"><Eye size={17} aria-hidden /><span ref={(node) => { revealRef.current = node?.closest("button") ?? null; }}>Reveal answer</span></Button>}
    </div> : <form className={styles.answerArea} onSubmit={submit}>
      <div className={styles.answerEntry}><input
        ref={inputRef}
        data-practice-focus
        value={answer}
        onChange={(event) => { setAnswer(kind === "reading" ? composeKanaInput(event.target.value) : event.target.value); setFeedback(null); }}
        onKeyDown={(event) => { if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault(); }}
        aria-labelledby={titleId}
        aria-describedby={feedback ? `${titleId}-feedback` : undefined}
        aria-invalid={feedback?.status === "incorrect" || feedback?.status === "blocked" || undefined}
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        readOnly={checked}
        lang={kind === "reading" ? "ja" : "en"}
        placeholder={kind === "reading" ? "Reading" : "Meaning"}
      /><Button type="submit" tone="primary" disabled={!answer.trim()}>{checked ? <ArrowRight size={17} aria-hidden /> : <Check size={17} aria-hidden />}{checked ? "Next" : "Check"}</Button></div>
      {feedback ? <div id={`${titleId}-feedback`} className={styles.feedback} data-result={feedback.status} role="status">
        <strong>{feedback.status === "blocked" ? "Try another answer" : feedback.status === "incorrect" ? "Incorrect" : feedback.status === "close" ? "Accepted with a typo" : "Correct"}</strong>
        {feedback.status === "blocked" ? <p>{feedback.message}</p> : null}
        {checked ? <p lang={kind === "reading" ? "ja" : "en"}>{kind === "reading" ? readings : meanings || meaningOf(subject)}</p> : null}
        {checked && kind === "reading" && subject.data.pronunciation_audios?.[0] ? <SubjectAudioButton audioKey={`leech-${subject.id}`} src={subject.data.pronunciation_audios[0].url} label="pronunciation" variant="pronunciation" /> : null}
      </div> : null}
    </form>}
    <p className={styles.remaining}>{remaining} {remaining === 1 ? "prompt" : "prompts"} remaining</p>
  </div></SubjectAudioProvider>;
}
