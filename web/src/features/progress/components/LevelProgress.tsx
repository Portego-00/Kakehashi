"use client";

import Link from "next/link";
import { ArrowRight, Clock3, Flame, Grid3X3, LockKeyhole, Play } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/States";
import { useSession } from "@/lib/session";
import type { Assignment, Subject, SubjectType } from "@/types/wanikani";
import { calculateLevelProgress, calculateLevelTimings, srsBucketForStage } from "../calculations";
import { useProgressData } from "../data";
import { useFirstProgressReveal } from "../useFirstProgressReveal";
import { ProgressTabs } from "./ProgressTabs";
import styles from "../progress.module.css";

export function LevelProgress() {
  const { user } = useSession();
  const { subjects, assignments, progressions, isLoading, isError, retry } = useProgressData();
  const firstReveal = useFirstProgressReveal();
  const [isRetrying, setIsRetrying] = useState(false);
  const currentLevel = user?.data.level ?? 1;
  const current = calculateLevelProgress(subjects, assignments, currentLevel);
  const previous = currentLevel > 1 ? calculateLevelProgress(subjects, assignments, currentLevel - 1) : [];
  const timings = calculateLevelTimings(progressions);
  const currentTiming = timings.find((timing) => timing.level === currentLevel);

  if (isLoading) return <LevelProgressSkeleton />;
  if (isError) return <main className={`page ${styles.page}`}><div className={styles.errorState}><h1>Progress is unavailable</h1><p>WaniKani did not return your levels. Try the request again here.</p><Button state={isRetrying ? "loading" : "idle"} onClick={async () => { setIsRetrying(true); try { await retry(); } finally { setIsRetrying(false); } }}>Try again</Button></div></main>;

  const currentKanji = current.find((progress) => progress.type === "kanji");
  const passTarget = currentKanji ? Math.ceil(currentKanji.total * 0.9) : 0;
  const remaining = Math.max(0, passTarget - (currentKanji?.passed ?? 0));
  const passedSubjects = current.reduce((sum, row) => sum + row.passed, 0);
  const totalSubjects = current.reduce((sum, row) => sum + row.total, 0);
  const currentSubjects = subjects.filter((subject) => subject.data.level === currentLevel && !subject.data.hidden_at);
  const radicals = currentSubjects.filter((subject) => subject.object === "radical");
  const kanji = currentSubjects.filter((subject) => subject.object === "kanji");
  const assignmentBySubject = new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment]));
  const previousLevels = Array.from({ length: Math.max(0, currentLevel - 1) }, (_, index) => currentLevel - index - 1).map((level) => ({ level, rows: calculateLevelProgress(subjects, assignments, level) }));

  return (
    <main className={`page ${styles.page}`} data-compact-workspace {...firstReveal}>
      <ProgressTabs active="level" action={<Link href="/progress/kanji" className={styles.textLink}><Grid3X3 size={15} /> Kanji grid</Link>} />

      <section className={styles.levelOverview} aria-labelledby="current-level-title">
        <div className={styles.levelOverviewHead}><div><h2 id="current-level-title">Level {currentLevel} progress</h2><p>{passedSubjects} of {totalSubjects} subjects have reached their passing stage.</p></div></div>

        <div className={styles.guruProgress}>
          <p><strong>Guru</strong> {remaining === 0 ? "Level threshold reached" : <>{remaining} more kanji to level up.</>}</p>
          <div className={styles.guruSegments} role="progressbar" aria-label={`${currentKanji?.passed ?? 0} of ${passTarget} kanji at the passing stage`} aria-valuenow={currentKanji?.passed ?? 0} aria-valuemin={0} aria-valuemax={passTarget || 1}>{Array.from({ length: passTarget }, (_, index) => <span key={index} data-state={index < (currentKanji?.passed ?? 0) ? "passed" : "idle"} />)}</div>
        </div>

        <div className={styles.levelTiming}><Clock3 size={19} aria-hidden /><span><small>Active on level</small><strong>{currentTiming ? formatDays(currentTiming.activeDays) : "Not started"}</strong></span></div>

        <LevelSubjectGrid title="Radicals" subjects={radicals} assignments={assignmentBySubject} />
        <LevelSubjectGrid title="Kanji" subjects={kanji} assignments={assignmentBySubject} />
      </section>

      <section className={styles.levelSummarySection}><h2>Current level</h2><LevelSummaryRow level={currentLevel} rows={current} current /></section>

      {previous.length > 0 ? <section className={styles.levelHistory}><h2>Previous levels</h2><div>{previousLevels.map((entry) => <LevelSummaryRow key={entry.level} level={entry.level} rows={entry.rows} />)}</div></section> : null}

      <nav className={styles.progressLinks} aria-label="Progress shortcuts">
        <Link href="/items?view=unlocks"><LockKeyhole aria-hidden /><span><strong>Recent unlocks</strong><small>Newly available subjects</small></span><ArrowRight aria-hidden /></Link>
        <Link href="/items?view=critical"><Play aria-hidden /><span><strong>Critical items</strong><small>Lowest review accuracy</small></span><ArrowRight aria-hidden /></Link>
        <Link href="/items?view=burned"><Flame aria-hidden /><span><strong>Burned items</strong><small>Completed subjects</small></span><ArrowRight aria-hidden /></Link>
      </nav>
    </main>
  );
}

function formatDays(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} ${value === 1 ? "day" : "days"}`;
}

function LevelSubjectGrid({ title, subjects, assignments }: { title: string; subjects: Subject[]; assignments: Map<number, Assignment> }) {
  if (!subjects.length) return null;
  const ordered = [...subjects].sort((left, right) => (assignments.get(right.id)?.data.srs_stage ?? 0) - (assignments.get(left.id)?.data.srs_stage ?? 0) || left.id - right.id);
  return <section className={styles.levelSubjectSection}><h3>{title}</h3><div className={styles.levelSubjectGrid}>{ordered.map((subject) => { const assignment = assignments.get(subject.id); const stage = assignment?.data.srs_stage ?? 0; const status = stage >= 5 ? "passed" : stage > 0 ? "started" : assignment?.data.unlocked_at ? "unlocked" : "locked"; const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.slug; return <Link href={`/subjects/${subject.id}`} key={subject.id} data-type={subject.object} data-status={status} title={`${subject.data.characters ?? meaning} · ${meaning} · ${assignment ? srsBucketForStage(stage) : "Locked"}`}><span lang={subject.data.characters ? "ja" : undefined}>{subject.data.characters ?? meaning.slice(0, 2)}</span><SubjectStageProgress meaning={meaning} stage={stage} /></Link>; })}</div></section>;
}

function SubjectStageProgress({ meaning, stage }: { meaning: string; stage: number }) {
  const guruStage = Math.max(0, Math.min(5, stage));
  if (guruStage >= 5) return <i className={styles.subjectStageProgress} role="progressbar" aria-label={`${meaning}: Guru reached`} aria-valuemin={0} aria-valuemax={5} aria-valuenow={5}><b role="presentation" data-complete="true" /></i>;
  return <i className={styles.subjectStageProgress} role="progressbar" aria-label={`${meaning}: ${guruStage} of 5 stages to Guru`} aria-valuemin={0} aria-valuemax={5} aria-valuenow={guruStage}>{[1, 2, 3, 4, 5].map((step) => <b role="presentation" key={step} data-filled={step <= guruStage ? "true" : undefined} />)}</i>;
}

function typeSummary(rows: ReturnType<typeof calculateLevelProgress>, type: Exclude<SubjectType, "kana_vocabulary">) {
  const matching = rows.filter((row) => row.type === type || (type === "vocabulary" && row.type === "kana_vocabulary"));
  return matching.reduce((summary, row) => ({ total: summary.total + row.total, passed: summary.passed + row.passed }), { total: 0, passed: 0 });
}

const LEVEL_SUMMARY_TYPES = [
  { id: "radical", label: "Radicals", radius: 21 },
  { id: "kanji", label: "Kanji", radius: 33 },
  { id: "vocabulary", label: "Vocabulary", radius: 45 },
] as const;

function LevelSummaryRow({ level, rows, current = false }: { level: number; rows: ReturnType<typeof calculateLevelProgress>; current?: boolean }) {
  const summaries = LEVEL_SUMMARY_TYPES.map((type) => ({ ...type, ...typeSummary(rows, type.id) }));
  const passed = summaries.reduce((sum, summary) => sum + summary.passed, 0);
  const total = summaries.reduce((sum, summary) => sum + summary.total, 0);
  const completion = total ? Math.round((passed / total) * 100) : 0;
  const ringLabel = summaries.map((summary) => `${summary.label} ${summary.passed} of ${summary.total}`).join(", ");

  return <Link href={`/progress/wrapped/${level}`} className={styles.levelSummaryRow} data-current={current ? "true" : undefined} aria-label={`Open level ${level} recap`}>
    <span className={styles.levelSummaryLabel}><span>Level {level}</span><strong>{completion}%</strong></span>
    <span className={styles.levelSummaryRingWrap}>
      <svg className={styles.levelSummaryRings} viewBox="0 0 112 112" role="img" aria-label={`Level ${level} progress by subject type`}>
        <title>{`Level ${level}: ${ringLabel} at Guru or above`}</title>
        {summaries.map((summary) => <circle key={`track-${summary.id}`} className={styles.levelSummaryRingTrack} cx="56" cy="56" r={summary.radius} />)}
        {summaries.map((summary, index) => <circle key={summary.id} className={styles.levelSummaryRingProgress} data-type={summary.id} cx="56" cy="56" r={summary.radius} pathLength="100" style={{ "--ring-progress": summary.total ? (summary.passed / summary.total) * 100 : 0, "--ring-delay": `${index * 45}ms` } as React.CSSProperties} />)}
      </svg>
    </span>
    <dl className={styles.levelSummaryLegend}>
      {summaries.map((summary) => <div data-type={summary.id} key={summary.id}><dt>{summary.label}</dt><dd>{summary.passed}/{summary.total}</dd></div>)}
    </dl>
    <ArrowRight size={19} aria-hidden />
  </Link>;
}

function LevelProgressSkeleton() {
  return <main className={`page ${styles.page}`} data-compact-workspace aria-busy="true"><ProgressTabs active="level" /><div className={styles.levelOverviewSkeleton}><Skeleton height="1.5rem" width="14rem" /><Skeleton height="0.5rem" /><div>{Array.from({ length: 18 }, (_, index) => <Skeleton key={index} height="3.25rem" />)}</div></div><Skeleton height="5rem" /><Skeleton height="12rem" /></main>;
}
