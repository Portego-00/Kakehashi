import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import type { Subject } from "@/types/wanikani";
import cards from "./review-results.module.css";
import styles from "./lesson-batch-complete.module.css";

function meaningFor(subject: Subject) {
  return subject.data.meanings.find((entry) => entry.primary)?.meaning ?? subject.data.slug;
}

export function LessonBatchComplete({ completed, upcoming, batchSize, dailyLimitReached, pendingCount = 0, syncError, onNextBatch }: {
  completed: Subject[];
  upcoming: Subject[];
  batchSize: number;
  dailyLimitReached: boolean;
  pendingCount?: number;
  syncError?: string;
  onNextBatch: () => void;
}) {
  const nextBatch = upcoming.slice(0, Math.max(1, batchSize));
  return <section className={styles.page} aria-labelledby="lesson-complete-title">
    <header className={styles.header}>
      <h1 id="lesson-complete-title">{upcoming.length ? "Batch Complete!" : "Lessons Complete!"}</h1>
      <p>{completed.length} {completed.length === 1 ? "item" : "items"} learned{upcoming.length ? ` · ${upcoming.length} remaining` : " · All done"}</p>
    </header>
    {syncError ? <p className={styles.notice} role="alert">{syncError}</p> : pendingCount > 0 ? <p className={styles.notice} role="status">Progress saved on this device · {pendingCount} waiting to sync</p> : null}
    <section aria-labelledby="learned-title">
      <h2 id="learned-title">Items learned</h2>
      <ul className={styles.items}>{completed.map((subject) => {
        const meaning = meaningFor(subject);
        const reading = subject.data.readings?.find((entry) => entry.primary)?.reading;
        return <li key={subject.id}><Link className={`${cards.subject} ${styles.card}`} href={`/subjects/${subject.id}`} target="_blank" rel="noopener noreferrer" data-type={subject.object} aria-label={`Open ${meaning} subject details`}>
          <div className={`${cards.subjectTop} ${styles.cardTop}`}><SubjectCharacter subject={subject} className={`${cards.character} ${styles.character}`} imageTone="light" imageSize="2rem" /></div>
          <div className={styles.cardCopy}><strong title={meaning}>{meaning}</strong>{reading ? <span lang="ja">{reading}</span> : null}</div>
        </Link></li>;
      })}</ul>
    </section>
    {nextBatch.length ? <section className={styles.next} aria-labelledby="next-batch-title">
      <div className={styles.nextHeading}><h2 id="next-batch-title">Next batch</h2><span>{nextBatch.length} {nextBatch.length === 1 ? "item" : "items"}</span></div>
      <ul className={styles.preview}>{nextBatch.map((subject) => <li key={subject.id}><Link href={`/subjects/${subject.id}`} target="_blank" rel="noopener noreferrer" title={meaningFor(subject)} aria-label={`Preview ${meaningFor(subject)}`} data-type={subject.object}><SubjectCharacter subject={subject} imageSize="1.5rem" /></Link></li>)}</ul>
    </section> : null}
    {dailyLimitReached ? <p className={styles.notice} role="status">You’ve reached your daily lesson limit. Your remaining lessons will be available tomorrow.</p> : null}
    <footer className={styles.actions}><ButtonLink href="/dashboard" tone={upcoming.length ? "ghost" : "primary"}>{upcoming.length ? "Finish for now" : "Finish"}</ButtonLink>{upcoming.length ? <Button tone="primary" onClick={onNextBatch}>Next batch<ArrowRight size={17} aria-hidden /></Button> : null}</footer>
  </section>;
}
