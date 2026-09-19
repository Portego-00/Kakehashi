"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { canAccessBunpro } from "./access";
import { bunpro } from "./client";
import styles from "./bunpro.module.css";
export function BunproHomeButton() {
  const { user, isDemo } = useSession();
  return !isDemo && canAccessBunpro(user?.data.username) ? <BunproReviewCard /> : null;
}
function BunproReviewCard() {
  const [expanded, setExpanded] = useState(false);
  const connection = useQuery({ queryKey: ["bunpro", "connection"], queryFn: () => bunpro<{ connected: boolean }>("action=connection"), retry: false });
  const due = useQuery({ queryKey: ["bunpro", "due"], queryFn: ({ signal }) => bunpro<{ total_due_grammar: number; total_due_vocab: number }>("action=due", { signal }), enabled: connection.data?.connected === true, staleTime: 30_000, retry: false });
  const grammar = due.data?.total_due_grammar;
  const vocab = due.data?.total_due_vocab;
  const total = grammar === undefined || vocab === undefined ? undefined : grammar + vocab;
  const href = (mode: string) => connection.data?.connected ? `/bunpro-reviews?mode=${mode}` : "/settings#bunpro-api-key";
  return <section className={styles.homeCard} aria-label="Bunpro reviews">
    <h2>Bunpro</h2>
    <div className={styles.homeReviewPanel}>
      <div className={styles.homeReviewTop}>
        <Link className={styles.homeReviewAction} href={href("all")} aria-label="Bunpro reviews: grammar and vocabulary"><span><strong>Review</strong><span>{connection.data?.connected ? "Grammar & Vocab" : "Connect Bunpro"}</span></span><span className={styles.homeReviewCount} aria-label={total === undefined ? "Review count unavailable" : `${total} reviews due`}>{total?.toLocaleString() ?? "—"}</span></Link>
        <button type="button" className={styles.homeReviewExpand} aria-expanded={expanded} aria-controls="bunpro-review-breakdown" aria-label="Choose Bunpro review type" onClick={() => setExpanded(!expanded)}>{expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}</button>
      </div>
      {expanded ? <div id="bunpro-review-breakdown" className={styles.homeReviewBreakdown}>{[["grammar", "Grammar", grammar], ["vocab", "Vocab", vocab]].map(([mode, label, count]) => <Link key={mode} className={styles.homeReviewAction} href={href(String(mode))} aria-label={`Bunpro ${label} reviews`}><span><strong>Review</strong><span>{label}</span></span><span className={styles.homeReviewCount}>{typeof count === "number" ? count.toLocaleString() : "—"}</span></Link>)}</div> : null}
    </div>
    {due.error || connection.error ? <p role="status" className={styles.homeReviewError}>Review count unavailable. <button type="button" onClick={() => { void connection.refetch(); void due.refetch(); }}>Retry</button></p> : null}
  </section>;
}
