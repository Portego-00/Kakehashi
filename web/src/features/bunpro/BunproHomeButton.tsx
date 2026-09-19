"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Settings } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { summarizeBunproQueue } from "../../../../src/utils/bunproQueue";
import type { BunproQueueResponse } from "../../../../src/types/bunpro";
import { canAccessBunpro } from "./access";
import { bunpro } from "./client";
import styles from "./bunpro.module.css";
export function BunproHomeButton() {
  const { user, isDemo } = useSession();
  return !isDemo && canAccessBunpro(user?.data.username) ? <BunproStudyCards /> : null;
}
function Goal({ done, goal, batch }: { done: number; goal: number; batch: number }) {
  const segments = Math.min(Math.max(goal, 1), 20);
  return <span className={styles.goalBars} role="progressbar" aria-label="Daily lesson goal" aria-valuenow={done} aria-valuemin={0} aria-valuemax={Math.max(goal, 1)}>{Array.from({ length: segments }, (_, i) => <span key={i} data-done={i < done / Math.max(goal, 1) * segments} data-next={goal > 0 && i * goal / segments >= done && i * goal / segments < done + batch} />)}</span>;
}
function GoalCount({ done, goal, batch }: { done: number; goal: number; batch: number }) {
  return <span className={styles.goalCount} aria-label={`${done} of ${goal} learned; next batch: ${batch}`}><span className={styles.goalCountIdle} aria-hidden="true">{done} / {goal}</span><span className={styles.goalCountHover} aria-hidden="true">+{batch}</span></span>;
}
function BunproStudyCards() {
  const [expanded, setExpanded] = useState<"learn" | "review" | null>(null);
  const connection = useQuery({ queryKey: ["bunpro", "connection"], queryFn: ({ signal }) => bunpro<{ connected: boolean }>("action=connection", { signal }), staleTime: 30_000, retry: false });
  const enabled = connection.data?.connected === true;
  const due = useQuery({ queryKey: ["bunpro", "due"], queryFn: ({ signal }) => bunpro<{ total_due_grammar: number; total_due_vocab: number }>("action=due", { signal }), enabled, staleTime: 30_000, retry: false });
  const queue = useQuery({ queryKey: ["bunpro", "lesson-queue"], queryFn: ({ signal }) => bunpro<BunproQueueResponse>("action=lesson-queue", { signal }), enabled, staleTime: 30_000, retry: false });
  if (!enabled) return null;
  const summary = summarizeBunproQueue(queue.data);
  const grammar = due.data?.total_due_grammar;
  const vocab = due.data?.total_due_vocab;
  const total = grammar === undefined || vocab === undefined ? undefined : grammar + vocab;
  return <section className={styles.homeCard} aria-label="Bunpro study">
    <h2>Bunpro</h2>
    <div className={styles.homeCards} onKeyDown={(event) => { if (event.key === "Escape") setExpanded(null); }} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(null); }}>
      <div className={`${styles.homeReviewPanel} ${styles.homeLearnPanel}`}>
        <div className={styles.homeReviewTop}>
          <Link className={`${styles.homeReviewAction} ${styles.homeLearnAction}`} href={summary.next?.deckId ? `/bunpro-lessons?deck=${summary.next.deckId}` : "/bunpro-lessons"}><span><strong>Learn</strong><span>{queue.data ? <GoalCount done={summary.overall.done} goal={summary.overall.dailyGoal} batch={summary.overall.nextBatch} /> : "—"}</span></span><Goal done={summary.overall.done} goal={summary.overall.dailyGoal} batch={summary.overall.nextBatch} /></Link>
          <button type="button" className={styles.homeReviewExpand} aria-label="Choose Bunpro lesson deck" aria-expanded={expanded === "learn"} aria-controls="bunpro-lesson-decks" onClick={() => setExpanded(expanded === "learn" ? null : "learn")}><ChevronDown size={20} /></button>
        </div>
        <div id="bunpro-lesson-decks" className={styles.homeReviewBreakdown} data-open={expanded === "learn"} aria-hidden={expanded !== "learn"} inert={expanded !== "learn"}><div className={styles.dropdownClip}><div>{summary.queue.map((deck) => <Link key={deck.key} href={`/bunpro-lessons?deck=${deck.deckId}`} className={`${styles.homeReviewAction} ${styles.homeLearnAction}`}><span><span>{deck.deckTitle}</span><span><GoalCount done={deck.done} goal={deck.dailyGoal} batch={Math.min(deck.remaining, deck.batchSize || deck.remaining)} /></span></span><Goal done={deck.done} goal={deck.dailyGoal} batch={Math.min(deck.remaining, deck.batchSize || deck.remaining)} /></Link>)}{queue.data && !summary.queue.length ? <p>No decks in your learn queue.</p> : null}<a className={styles.queueSettings} href="https://bunpro.jp/dashboard" target="_blank" rel="noreferrer">Learn Queue Settings on Bunpro <Settings size={18} /></a></div></div></div>
      </div>
      <div className={styles.homeReviewPanel}>
        <div className={styles.homeReviewTop}>
          <Link className={styles.homeReviewAction} href="/bunpro-reviews?mode=all" aria-label="Bunpro reviews: grammar and vocabulary"><span><strong>Review</strong><span>All Reviews</span></span><span className={styles.homeReviewCount} aria-label={total === undefined ? "Review count unavailable" : `${total} reviews due`}>{total ?? "—"}</span></Link>
          <button type="button" className={styles.homeReviewExpand} aria-expanded={expanded === "review"} aria-controls="bunpro-review-breakdown" aria-label="Choose Bunpro review type" onClick={() => setExpanded(expanded === "review" ? null : "review")}><ChevronDown size={20} /></button>
        </div>
        <div id="bunpro-review-breakdown" className={styles.homeReviewBreakdown} data-open={expanded === "review"} aria-hidden={expanded !== "review"} inert={expanded !== "review"}><div className={styles.dropdownClip}><div>{[["grammar", "Grammar Only", grammar], ["vocab", "Vocab Only", vocab]].map(([mode, label, count]) => <Link key={mode} className={styles.homeReviewAction} href={`/bunpro-reviews?mode=${mode}`} aria-label={`Bunpro ${label} reviews`}><span>{label}</span><span className={styles.homeReviewCount}>{count ?? "—"}</span></Link>)}</div></div></div>
      </div>
    </div>
    {due.error || queue.error ? <p role="status" className={styles.homeReviewError}>Bunpro counts unavailable. <button type="button" onClick={() => { void due.refetch(); void queue.refetch(); }}>Retry</button></p> : null}
  </section>;
}
