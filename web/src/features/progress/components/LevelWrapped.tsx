"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState } from "react";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import { Button } from "@/components/ui/Button";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import type { Subject, SubjectType } from "@/types/wanikani";
import { calculateAccuracy, calculateLevelTimings, srsBucketForStage } from "../calculations";
import { useProgressData } from "../data";
import styles from "../progress.module.css";

type LevelItem = {
  subject: Subject;
  stage: number;
  meaning: string;
  reading: string | null;
};

const SUBJECT_GROUPS = [
  { id: "radical", label: "Radicals", types: ["radical"] },
  { id: "kanji", label: "Kanji", types: ["kanji"] },
  { id: "vocabulary", label: "Vocabulary", types: ["vocabulary", "kana_vocabulary"] },
] as const satisfies ReadonlyArray<{ id: string; label: string; types: readonly SubjectType[] }>;

const SRS_BUCKETS = [
  { id: "locked", label: "Lesson", bucket: "Locked" },
  { id: "apprentice", label: "Apprentice", bucket: "Apprentice" },
  { id: "guru", label: "Guru", bucket: "Guru" },
  { id: "master", label: "Master", bucket: "Master" },
  { id: "enlightened", label: "Enlightened", bucket: "Enlightened" },
  { id: "burned", label: "Burned", bucket: "Burned" },
] as const;

export function LevelWrapped({ level }: { level: number }) {
  const { subjects, assignments, statistics, progressions, isLoading, isError, retry } = useProgressData();
  const [isRetrying, setIsRetrying] = useState(false);
  if (isLoading) return <main className={`page ${styles.page}`} aria-busy="true"><Skeleton height="34rem" /></main>;
  if (isError) return <main className={`page ${styles.page}`}><EmptyState title="Level recap is unavailable" description="WaniKani did not return this level." action={<Button state={isRetrying ? "loading" : "idle"} onClick={async () => { setIsRetrying(true); try { await retry(); } finally { setIsRetrying(false); } }}>Try again</Button>} /></main>;

  const levelSubjects = subjects.filter((subject) => subject.data.level === level && !subject.data.hidden_at);
  if (levelSubjects.length === 0) return <main className={`page ${styles.page}`}><EmptyState title="Level not found" description="Choose a WaniKani level available to this account." /></main>;

  const assignmentBySubject = new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment]));
  const levelItems = levelSubjects.map((subject): LevelItem => {
    const assignment = assignmentBySubject.get(subject.id);
    const meaning = subject.data.meanings.find((entry) => entry.primary)?.meaning ?? subject.data.meanings[0]?.meaning ?? subject.data.slug;
    const reading = subject.data.readings?.find((entry) => entry.primary)?.reading ?? subject.data.readings?.[0]?.reading ?? null;
    return { subject, stage: assignment && !assignment.data.hidden ? assignment.data.srs_stage : 0, meaning, reading };
  }).sort((left, right) => left.stage - right.stage || (left.subject.data.lesson_position ?? Number.MAX_SAFE_INTEGER) - (right.subject.data.lesson_position ?? Number.MAX_SAFE_INTEGER) || left.subject.id - right.subject.id);

  const ids = new Set(levelSubjects.map((subject) => subject.id));
  const levelStats = statistics.filter((statistic) => ids.has(statistic.data.subject_id));
  const accuracy = calculateAccuracy(levelStats);
  const timing = calculateLevelTimings(progressions).find((entry) => entry.level === level);
  const attempts = accuracy.correct + accuracy.incorrect;
  const guruCount = levelItems.filter((item) => item.stage >= 5).length;
  const completion = Math.round((guruCount / levelItems.length) * 100);
  const burned = levelItems.filter((item) => item.stage >= 9).length;
  const srsCounts = SRS_BUCKETS.map((entry) => ({ ...entry, count: levelItems.filter((item) => srsBucketForStage(item.stage) === entry.bucket).length }));
  const srsLabel = srsCounts.map((entry) => `${entry.label} ${entry.count}`).join(", ");

  return <main className={`page ${styles.page} ${styles.levelRecapPage}`}>
    <Link href="/progress" className={styles.backLink}><ArrowLeft size={16} /> Level progress</Link>

    <header className={styles.levelRecapHeader}>
      <div><span>Level recap</span><h1>Level {level}</h1><p>Every subject in this level, grouped by type and ordered from the lowest SRS stage upward.</p></div>
      <strong>{completion}%<span>{guruCount} of {levelItems.length} at Guru or higher</span></strong>
    </header>

    <section className={styles.levelRecapSummary} aria-label={`Level ${level} summary`}>
      <dl className={styles.levelRecapStats}>
        <div><dt>Time to pass</dt><dd>{timing?.daysToPass === null || timing?.daysToPass === undefined ? "—" : `${timing.daysToPass} days`}</dd></div>
        <div><dt>Overall accuracy</dt><dd>{accuracy.percentage === null ? "—" : `${accuracy.percentage}%`}</dd></div>
        <div><dt>Recorded answers</dt><dd>{attempts.toLocaleString()}</dd></div>
        <div><dt>Burned</dt><dd>{burned}</dd></div>
      </dl>

      <div className={styles.levelSrsOverview}>
        <div><h2>SRS distribution</h2><p>Current stage across all {levelItems.length} subjects.</p></div>
        <div className={styles.levelSrsBar} role="img" aria-label={srsLabel}>
          {srsCounts.map((entry) => entry.count ? <span key={entry.id} data-srs={entry.id} style={{ flexGrow: entry.count }} /> : null)}
        </div>
        <dl className={styles.levelSrsLegend}>
          {srsCounts.map((entry) => <div key={entry.id}><dt><i data-srs={entry.id} />{entry.label}</dt><dd>{entry.count}</dd></div>)}
        </dl>
      </div>
    </section>

    <section className={styles.levelInventory} aria-labelledby="level-items-title">
      <div className={styles.levelInventoryHead}><div><h2 id="level-items-title">Level items</h2><p>Lowest SRS stage first within each subject type.</p></div><span>{levelItems.length} subjects</span></div>
      {SUBJECT_GROUPS.map((group) => {
        const items = levelItems.filter((item) => group.types.some((type) => type === item.subject.object));
        return items.length ? <LevelItemGroup key={group.id} id={group.id} label={group.label} items={items} /> : null;
      })}
    </section>
  </main>;
}

function LevelItemGroup({ id, label, items }: { id: string; label: string; items: LevelItem[] }) {
  const guruCount = items.filter((item) => item.stage >= 5).length;
  const burnedCount = items.filter((item) => item.stage >= 9).length;
  return <section className={styles.levelItemGroup} data-level-subject-type={id} aria-labelledby={`level-${id}-title`}>
    <header><h3 id={`level-${id}-title`}>{label}</h3><p><strong>{guruCount}/{items.length}</strong> Guru+<span aria-hidden>·</span><strong>{burnedCount}</strong> burned</p></header>
    <ul>{items.map((item) => <LevelItemRow key={item.subject.id} item={item} />)}</ul>
  </section>;
}

function LevelItemRow({ item }: { item: LevelItem }) {
  const { subject, stage, meaning, reading } = item;
  const characters = subject.data.characters ?? meaning.slice(0, 2);
  return <li><Link href={`/subjects/${subject.id}`} className={styles.levelItemRow} data-type={subject.object}>
    <SubjectCharacter subject={subject} fallbackText={characters} imageSize="70%" className={styles.levelItemGlyph} data-character-count={Math.min(12, Array.from(characters).length)} />
    <span className={styles.levelItemIdentity}><strong>{meaning}</strong>{reading ? <span lang="ja">{reading}</span> : <span>{subject.object === "radical" ? "Radical" : "No reading"}</span>}</span>
    <span className={styles.levelItemStage}>{stage > 0 ? <SrsStageIcon stage={stage} size={18} /> : <i aria-hidden />}<span>{srsStageLabel(stage)}</span></span>
    <SubjectGuruProgress meaning={meaning} stage={stage} />
    <ArrowRight size={17} aria-hidden />
  </Link></li>;
}

function SubjectGuruProgress({ meaning, stage }: { meaning: string; stage: number }) {
  const progress = Math.max(0, Math.min(5, stage));
  if (progress >= 5) return <i className={styles.levelItemGuruProgress} role="progressbar" aria-label={`${meaning}: Guru reached`} aria-valuemin={0} aria-valuemax={5} aria-valuenow={5}><b role="presentation" data-complete="true" /></i>;
  return <i className={styles.levelItemGuruProgress} role="progressbar" aria-label={`${meaning}: ${progress} of 5 stages to Guru`} aria-valuemin={0} aria-valuemax={5} aria-valuenow={progress}>{[1, 2, 3, 4, 5].map((step) => <b role="presentation" key={step} data-filled={step <= progress ? "true" : undefined} />)}</i>;
}
