"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Award, CalendarClock, Gauge, Sparkles, Target, Trophy } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { calculateAccuracy, calculateLevelProgress, calculateLevelTimings } from "../calculations";
import { useProgressData } from "../data";
import { useFirstProgressReveal } from "../useFirstProgressReveal";
import styles from "../progress.module.css";

export function LevelWrapped({ level }: { level: number }) {
  const { subjects, assignments, statistics, progressions, isLoading, isError, retry } = useProgressData();
  const firstReveal = useFirstProgressReveal();
  const [isRetrying, setIsRetrying] = useState(false);
  if (isLoading) return <main className={`page ${styles.page}`} aria-busy="true"><Skeleton height="34rem" /></main>;
  if (isError) return <main className={`page ${styles.page}`}><EmptyState title="Level recap is unavailable" description="WaniKani did not return this level." action={<Button state={isRetrying ? "loading" : "idle"} onClick={async () => { setIsRetrying(true); try { await retry(); } finally { setIsRetrying(false); } }}>Try again</Button>} /></main>;

  const levelSubjects = subjects.filter((subject) => subject.data.level === level && !subject.data.hidden_at);
  if (levelSubjects.length === 0) return <main className={`page ${styles.page}`}><EmptyState title="Level not found" description="Choose a WaniKani level available to this account." /></main>;
  const ids = new Set(levelSubjects.map((subject) => subject.id));
  const levelStats = statistics.filter((statistic) => ids.has(statistic.data.subject_id));
  const accuracy = calculateAccuracy(levelStats);
  const timing = calculateLevelTimings(progressions).find((entry) => entry.level === level);
  const progress = calculateLevelProgress(subjects, assignments, level);
  const attempts = accuracy.correct + accuracy.incorrect;
  const subjectById = new Map(levelSubjects.map((subject) => [subject.id, subject]));
  const ranked = levelStats.filter((statistic) => statistic.data.meaning_correct + statistic.data.meaning_incorrect + statistic.data.reading_correct + statistic.data.reading_incorrect > 0).sort((a, b) => b.data.percentage_correct - a.data.percentage_correct);
  const star = ranked[0] ? subjectById.get(ranked[0].data.subject_id) : undefined;
  const trouble = ranked.length > 1 ? subjectById.get(ranked[ranked.length - 1].data.subject_id) : undefined;
  const troubleAccuracy = ranked.length > 1 ? ranked[ranked.length - 1].data.percentage_correct : null;
  const burned = progress.reduce((sum, row) => sum + row.burned, 0);
  const subjectLabel = (subject: typeof star) => subject ? `${subject.data.characters ?? subject.data.meanings[0]?.meaning} · ${subject.data.meanings.find((meaning) => meaning.primary)?.meaning ?? subject.data.slug}` : "Not enough review data";

  return <main className={`page ${styles.page}`} {...firstReveal}>
    <Link href="/progress" className={styles.backLink}><ArrowLeft size={16} /> Level progress</Link>
    <header className={styles.wrappedHero}>
      <div><Badge tone="kanji"><Sparkles size={13} /> Level recap</Badge><h1>Level {level}, wrapped</h1><p>A compact look at the time, volume, accuracy, and subjects that defined this level.</p></div>
      <strong>{accuracy.percentage === null ? "—" : `${accuracy.percentage}%`}<span>overall accuracy</span></strong>
    </header>

    <section className={styles.wrappedStats} aria-label={`Level ${level} summary`}>
      <Card><CalendarClock size={20} /><strong>{timing?.daysToPass === null || timing?.daysToPass === undefined ? "—" : `${timing.daysToPass} days`}</strong><span>Time to pass</span></Card>
      <Card><Target size={20} /><strong>{attempts.toLocaleString()}</strong><span>Recorded answers</span></Card>
      <Card><Award size={20} /><strong>{burned}</strong><span>Subjects burned</span></Card>
    </section>

    <section className={styles.wrappedHighlights}>
      <Card className={styles.highlightCard}><Trophy size={22} /><div><h2>Accuracy star</h2><strong>{subjectLabel(star)}</strong><p>{ranked[0] ? `${ranked[0].data.percentage_correct}% aggregate accuracy` : "Complete reviews to reveal a standout."}</p></div>{star ? <Link href={`/subjects/${star.id}`}>Open <ArrowRight size={15} /></Link> : null}</Card>
      <Card className={styles.highlightCard}><Gauge size={22} /><div><h2>{troubleAccuracy !== null && troubleAccuracy < 75 ? "Needs another look" : "Lowest recorded accuracy"}</h2><strong>{subjectLabel(trouble)}</strong><p>{troubleAccuracy !== null ? `${troubleAccuracy}% aggregate accuracy` : "Complete reviews to reveal a comparison."}</p></div>{trouble ? <Link href={`/subjects/${trouble.id}`}>Review <ArrowRight size={15} /></Link> : null}</Card>
    </section>

    <Card padding="none" className={styles.wrappedBreakdown}><div><h2>Subject progress</h2><span>{levelSubjects.length} subjects on level {level}</span></div><dl>{progress.map((row) => <div key={row.type}><dt>{row.type.replace("_", " ")}</dt><dd><strong>{row.passed}</strong> passed · {row.burned} burned · {row.total} total</dd></div>)}</dl></Card>
  </main>;
}
