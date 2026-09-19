"use client";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, LogOut } from "lucide-react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/Button";
import { summarizeBunproQueue } from "../../../../src/utils/bunproQueue";
import type { BunproLearnContentItem, BunproLearnIndexResponse, BunproLearnReviewableTuple, BunproQueueResponse, BunproReviewQuizIndexResponse } from "../../../../src/types/bunpro";
import { bunpro } from "./client";
import { buildReviewQueue, sanitizeText } from "./model";
import { BunproLoading } from "./BunproLoading";
import { BunproDetails } from "./BunproDetails";
import { BunproReviews } from "./BunproReviews";
import styles from "./bunpro.module.css";

export function lessonTuple(item: BunproLearnContentItem): BunproLearnReviewableTuple {
  return [item.data.type === "vocab" ? "Vocab" : "GrammarPoint", Number(item.data.attributes.id || item.data.id)];
}
export function BunproLessons({ initialDeck }: { initialDeck?: number }) {
  const [index, setIndex] = useState(0);
  const [batch, setBatch] = useState(0);
  const [quiz, setQuiz] = useState<BunproReviewQuizIndexResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const lesson = useQuery({ queryKey: ["bunpro", "lesson-batch", initialDeck, batch], retry: false, staleTime: Infinity, gcTime: 0, queryFn: async ({ signal }) => {
    const summary = summarizeBunproQueue(await bunpro<BunproQueueResponse>("action=lesson-queue", { signal }));
    const selected = summary.queue.find((deck) => deck.deckId === initialDeck && deck.remaining > 0 && !deck.isFinished) ?? summary.next;
    if (!selected?.deckId) return null;
    const response = await bunpro<BunproLearnIndexResponse>(`action=learn&deck=${selected.deckId}`, { signal });
    const size = Math.min(selected.remaining, selected.batchSize || selected.remaining);
    const items = response.content.filter((item) => ["grammar_point", "vocab"].includes(item.data.type) && Number.isInteger(lessonTuple(item)[1]) && lessonTuple(item)[1] > 0).slice(0, size);
    return { deck: selected, items };
  } });
  function navigate(next: number) { setIndex(next); window.scrollTo({ top: 0, behavior: "instant" }); }
  async function startQuiz() {
    if (!lesson.data?.items.length || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const response = await bunpro<BunproReviewQuizIndexResponse>("", { method: "POST", body: JSON.stringify({ action: "lesson-quiz", deckId: lesson.data.deck.deckId, reviewables: lesson.data.items.map(lessonTuple) }) });
      if (!Number.isInteger(response.review_session_id) || response.review_session_id <= 0 || !buildReviewQueue(response).length) throw new Error("Bunpro did not return a lesson quiz. Please try again.");
      setQuiz(response);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not start the lesson quiz."); }
    finally { lock.current = false; setBusy(false); }
  }
  if (quiz) return <BunproReviews key={quiz.review_session_id} lessonSession={quiz} onContinueLessons={() => { setQuiz(null); setIndex(0); setBatch(batch + 1); }} />;
  if (lesson.isPending) return <BunproLoading kind="lessons" />;
  if (lesson.error) return <main className={styles.chooser}><h1>Bunpro lessons</h1><p role="alert">{lesson.error.message}</p><Button onClick={() => lesson.refetch()}>Retry lessons</Button><ButtonLink href="/dashboard">Back to home</ButtonLink></main>;
  const current = lesson.data?.items[index];
  if (!current || !lesson.data) return <main className={styles.chooser}><h1>Lessons complete</h1><p>No more lessons are queued for your daily goal.</p><ButtonLink href="/dashboard">Back to home</ButtonLink></main>;
  const { items, deck } = lesson.data;
  const attributes = current.data.attributes;
  const kind = current.data.type === "vocab" ? "vocab" : "grammar";
  return <main className={styles.lessonPage}>
    <header className={styles.lessonHeader}><Link href="/dashboard" aria-label="Return to dashboard"><LogOut size={24} /></Link><div><p>{sanitizeText(attributes.level || attributes.jlpt_level)} {attributes.lesson_id ? `Lesson ${attributes.lesson_id}` : ""} · {index + 1}/{items.length}</p><span>{deck.deckTitle}</span></div></header>
    <BunproDetails key={`${current.data.type}:${current.data.id}`} kind={kind} slug={sanitizeText(attributes.slug)} content={current} />
    <footer className={styles.lessonFooter}><button type="button" disabled={index === 0 || busy} onClick={() => navigate(index - 1)}><ArrowLeft size={20} /> Previous</button><nav aria-label="Lesson batch">{items.map((item, i) => <button type="button" key={item.data.id} disabled={busy} aria-label={`Lesson ${i + 1}: ${sanitizeText(item.data.attributes.title)}`} aria-current={i === index ? "step" : undefined} onClick={() => navigate(i)} />)}</nav><button type="button" className={styles.lessonNext} disabled={busy} onClick={() => index + 1 < items.length ? navigate(index + 1) : void startQuiz()}><ArrowRight size={20} />{busy ? "Preparing quiz…" : index + 1 < items.length ? "Next" : "Start Quiz"}</button>{error ? <p role="alert">{error}</p> : null}</footer>
  </main>;
}
