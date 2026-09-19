import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import type { Subject } from "@/types/wanikani";
import styles from "./lesson-batch-complete.module.css";

function BatchItems({ subjects }: { subjects: Subject[] }) {
  return <ul className={styles.items}>{subjects.map((subject) => {
    const meaning = subject.data.meanings.find((entry) => entry.primary)?.meaning ?? subject.data.slug;
    return <li key={subject.id}><Link href={`/subjects/${subject.id}`} target="_blank" rel="noopener noreferrer">
      <SubjectCharacter subject={subject} className={styles.character} imageSize="2rem" />
      <span>{meaning}<span className={styles.metadata}>{subject.object.replace("_", " ")} · Level {subject.data.level}</span></span>
    </Link></li>;
  })}</ul>;
}

export function LessonBatchComplete({ completed, upcoming, batchSize, dailyLimitReached, onNextBatch }: {
  completed: Subject[];
  upcoming: Subject[];
  batchSize: number;
  dailyLimitReached: boolean;
  onNextBatch: () => void;
}) {
  const batches = Array.from({ length: Math.ceil(upcoming.length / Math.max(1, batchSize)) }, (_, index) => upcoming.slice(index * Math.max(1, batchSize), (index + 1) * Math.max(1, batchSize)));
  return <section className={styles.page} aria-labelledby="lesson-complete-title">
    <header className={styles.header}><Check size={28} aria-hidden /><h1 id="lesson-complete-title">{upcoming.length ? "Batch Complete!" : "Lessons Complete!"}</h1><p>{completed.length} {completed.length === 1 ? "item" : "items"} learned{upcoming.length ? ` · ${upcoming.length} remaining in ${batches.length} upcoming ${batches.length === 1 ? "batch" : "batches"}` : " · All lessons in this session complete"}.</p></header>
    <section aria-labelledby="learned-title"><h2 id="learned-title">Items learned</h2><BatchItems subjects={completed} /></section>
    {batches.length ? <section aria-labelledby="upcoming-title"><h2 id="upcoming-title">Upcoming batches</h2>{batches.map((batch, index) => <details key={index} className={styles.batch} open={index === 0}><summary>{index === 0 ? "Next batch" : `Upcoming batch ${index + 1}`} · {batch.length} {batch.length === 1 ? "item" : "items"}</summary><BatchItems subjects={batch} /></details>)}</section> : null}
    {dailyLimitReached ? <p role="status">You’ve reached your daily lesson limit. Your remaining lessons will be available tomorrow.</p> : null}
    <footer className={styles.actions}><ButtonLink href="/dashboard" tone={upcoming.length ? "ghost" : "primary"}>{upcoming.length ? "Back to Dashboard" : "Finish"}</ButtonLink>{upcoming.length ? <Button tone="primary" onClick={onNextBatch}>Next batch<ArrowRight size={17} aria-hidden /></Button> : null}</footer>
  </section>;
}
