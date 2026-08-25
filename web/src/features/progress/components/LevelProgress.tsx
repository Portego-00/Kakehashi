"use client";

import Link from "next/link";
import { ArrowRight, Check, Flame, Grid3X3, LockKeyhole, Play } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { Skeleton } from "@/components/ui/States";
import { useSession } from "@/lib/session";
import { calculateLevelProgress, calculateLevelTimings } from "../calculations";
import { useProgressData } from "../data";
import { useFirstProgressReveal } from "../useFirstProgressReveal";
import styles from "../progress.module.css";

const TYPE_LABELS = { radical: "Radicals", kanji: "Kanji", vocabulary: "Vocabulary", kana_vocabulary: "Kana vocabulary" } as const;

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

  if (isLoading) return <main className={`page ${styles.page}`} aria-busy="true"><Skeleton height="30rem" /></main>;
  if (isError) return <main className={`page ${styles.page}`}><div className={styles.errorState}><h1>Progress is unavailable</h1><p>WaniKani did not return your levels. Try the request again here.</p><Button state={isRetrying ? "loading" : "idle"} onClick={async () => { setIsRetrying(true); try { await retry(); } finally { setIsRetrying(false); } }}>Try again</Button></div></main>;

  const currentKanji = current.find((progress) => progress.type === "kanji");
  const passTarget = currentKanji ? Math.ceil(currentKanji.total * 0.9) : 0;
  const remaining = Math.max(0, passTarget - (currentKanji?.passed ?? 0));

  return (
    <main className={`page ${styles.page}`} {...firstReveal}>
      <header className="page-header"><div><h1>Level progress</h1><p>See what is unlocked, in flight, passed, and burned across your current work.</p></div><Link href="/progress/kanji" className={styles.textLink}><Grid3X3 size={16} /> Kanji grid</Link></header>

      <section className={styles.levelLead} aria-labelledby="current-level-title">
        <div className={styles.levelNumber}><span>Level</span><strong>{currentLevel}</strong></div>
        <div className={styles.levelStatus}>
          <h2 id="current-level-title">{remaining === 0 ? "Level threshold reached" : `${remaining} kanji to the pass line`}</h2>
          <p>{currentTiming ? `${currentTiming.activeDays} days active on this level.` : "Timing begins once the level is unlocked."} WaniKani advances a level when 90% of its kanji reach the passing stage.</p>
          {currentKanji ? <Progress value={currentKanji.passed} max={passTarget || 1} label={`${currentKanji.passed} of ${passTarget} passing kanji`} /> : null}
        </div>
      </section>

      <LevelTable title={`Level ${currentLevel}`} rows={current} />

      {previous.length > 0 ? <section className={styles.previousLevel}><div className={styles.previousHead}><div className={styles.sectionTitleRow}><Check size={19} /><h2>Previous level</h2></div><Link href={`/progress/wrapped/${currentLevel - 1}`} className={styles.textLink}>Open level recap <ArrowRight size={16} /></Link></div><LevelTable title={`Level ${currentLevel - 1}`} rows={previous} compact /></section> : null}

      <nav className={styles.progressLinks} aria-label="Progress shortcuts">
        <Link href="/items?view=unlocks"><LockKeyhole aria-hidden /><span><strong>Recent unlocks</strong><small>Newly available subjects</small></span><ArrowRight aria-hidden /></Link>
        <Link href="/items?view=critical"><Play aria-hidden /><span><strong>Critical items</strong><small>Lowest review accuracy</small></span><ArrowRight aria-hidden /></Link>
        <Link href="/items?view=burned"><Flame aria-hidden /><span><strong>Burned items</strong><small>Completed subjects</small></span><ArrowRight aria-hidden /></Link>
      </nav>
    </main>
  );
}

function LevelTable({ title, rows, compact = false }: { title: string; rows: ReturnType<typeof calculateLevelProgress>; compact?: boolean }) {
  return <Card padding="none" className={styles.levelTable}><div className={styles.levelTableHead}><h2>{title}</h2>{compact ? <Badge tone="success">Complete history</Badge> : <Badge>Current</Badge>}</div><div className={styles.levelRows}>{rows.map((row) => <div className={styles.levelRow} key={row.type}><div className={styles.typeName}><Badge tone={row.type === "kana_vocabulary" ? "vocabulary" : row.type}>{TYPE_LABELS[row.type]}</Badge><strong>{row.passed} / {row.total} passed</strong></div><Progress value={row.passed} max={row.total || 1} ariaLabel={`${TYPE_LABELS[row.type]}: ${row.passed} of ${row.total} passed`} /><dl><div><dt>Unlocked</dt><dd>{row.unlocked}</dd></div><div><dt>Started</dt><dd>{row.started}</dd></div><div><dt>Burned</dt><dd>{row.burned}</dd></div></dl></div>)}</div></Card>;
}
