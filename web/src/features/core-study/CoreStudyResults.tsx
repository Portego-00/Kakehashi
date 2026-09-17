"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, Check, ExternalLink, RotateCcw, X } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SrsStageIcon, srsStageLabel } from "@/components/SrsStageIcon";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import { kindsForSubject } from "./queue";
import { resultMistakes, resultPercentage, reviewResultsSummary, type ReviewResultItem } from "./review-results";
import styles from "./review-results.module.css";

function Accuracy({ correct, total, label, ring = false }: { correct: number; total: number; label: string; ring?: boolean }) {
  const reducedMotion = useReducedMotion();
  const percentage = resultPercentage(correct, total);
  return <div className={ring ? styles.accuracyRing : styles.accuracyBar} role="img" aria-label={`${label}: ${percentage === null ? "not applicable" : `${percentage}% (${correct} of ${total})`}`}>
    {ring ? <div className={styles.ring}>
      <svg viewBox="0 0 112 112" aria-hidden><circle className={styles.ringTrack} cx="56" cy="56" r="48" /><motion.circle className={styles.ringValue} cx="56" cy="56" r="48" pathLength="100" strokeDasharray="100" initial={{ strokeDashoffset: reducedMotion ? 100 - (percentage ?? 0) : 100 }} animate={{ strokeDashoffset: 100 - (percentage ?? 0) }} transition={{ duration: reducedMotion ? 0 : .65, ease: [.2, 0, 0, 1] }} /></svg>
      <strong>{percentage === null ? "—" : `${percentage}%`}</strong>
    </div> : <div className={styles.barLabel}><span>{label}</span><strong>{percentage === null ? "—" : `${percentage}%`}</strong></div>}
    {ring ? <span>{label}</span> : <div className={styles.barTrack} aria-hidden><motion.div className={styles.barValue} initial={{ scaleX: reducedMotion ? (percentage ?? 0) / 100 : 0 }} animate={{ scaleX: (percentage ?? 0) / 100 }} transition={{ duration: reducedMotion ? 0 : .55, ease: [.2, 0, 0, 1] }} /></div>}
    <span className={styles.accuracyDetail}>{total ? `${correct} / ${total} ${ring ? "answers correct first try" : "correct first try"}` : "No reading questions"}</span>
  </div>;
}

function ResultSubject({ item }: { item: ReviewResultItem }) {
  const subject = item.subject;
  const meaning = subject.data.meanings.find((entry) => entry.primary)?.meaning ?? subject.data.meanings[0]?.meaning ?? subject.data.slug;
  const readings = subject.data.readings ?? [];
  const reading = (readings.filter((entry) => entry.primary).length ? readings.filter((entry) => entry.primary) : readings.filter((entry) => entry.accepted_answer)).map((entry) => entry.reading).join("・");
  const hasReading = kindsForSubject(subject).includes("reading");
  const character = subject.data.characters ?? meaning;
  return <li>
    <Link className={styles.subject} href={`/subjects/${subject.id}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${character} (${meaning}) subject details`} data-type={subject.object}>
      <div className={styles.subjectTop}><SubjectCharacter subject={subject} className={styles.character} imageTone="subject" imageSize="2.5rem" /><ExternalLink size={16} aria-hidden /></div>
      <div className={styles.answer} data-missed={item.meaningMistakes > 0}><span className={styles.answerLabel}>{item.meaningMistakes > 0 ? <X size={15} aria-hidden /> : <Check size={15} aria-hidden />}{item.meaningMistakes > 0 ? "Meaning missed" : "Meaning correct"}</span><strong>{meaning}</strong></div>
      {hasReading ? <div className={styles.answer} data-missed={item.readingMistakes > 0}><span className={styles.answerLabel}>{item.readingMistakes > 0 ? <X size={15} aria-hidden /> : <Check size={15} aria-hidden />}{item.readingMistakes > 0 ? "Reading missed" : "Reading correct"}</span><span lang="ja">{reading}</span></div> : <div className={styles.notApplicable}>No reading question</div>}
      <div className={styles.subjectMeta}><span>Level {subject.data.level} · {subject.object.replace("_", " ")}</span>{item.endingStage !== undefined ? <span><SrsStageIcon stage={item.endingStage} size={17} />{srsStageLabel(item.endingStage)}</span> : null}</div>
    </Link>
  </li>;
}

export function CoreStudyResults({ items, mode, durationMs, pendingCount = 0, progression }: { items: ReviewResultItem[]; mode: "reviews" | "lessons"; durationMs: number; pendingCount?: number; progression?: ReactNode }) {
  const summary = reviewResultsSummary(items);
  const mistakes = items.filter((item) => resultMistakes(item) > 0);
  const [selectedTab, setSelectedTab] = useState<"mistakes" | "all">(mistakes.length ? "mistakes" : "all");
  const visible = selectedTab === "mistakes" ? mistakes : items;
  const minutes = Math.floor(Math.max(0, durationMs) / 60_000);
  const seconds = Math.floor(Math.max(0, durationMs) / 1_000) % 60;
  const practiceHref = `/study/custom-review?subjectIds=${Array.from(new Set(mistakes.map((item) => item.subject.id))).join(",")}&start=1`;
  return <section className={styles.results} aria-labelledby="review-results-title">
    <header className={styles.header}><div><h1 id="review-results-title">{mode === "reviews" ? "Reviews" : "Lessons"} Complete</h1><p>{items.length} {items.length === 1 ? "subject" : "subjects"} completed · {minutes ? `${minutes}m ${seconds}s` : `${seconds}s`}</p></div><ButtonLink href="/dashboard" tone="primary">Back to Dashboard<ArrowRight size={17} aria-hidden /></ButtonLink></header>
    {pendingCount ? <p className={styles.syncNotice} role="status">{pendingCount} completed {pendingCount === 1 ? "review is" : "reviews are"} saved on this device and waiting to sync with WaniKani.</p> : null}
    <div className={styles.summary}>
      <Accuracy {...summary.overall} label="First-try accuracy" ring />
      <div className={styles.answerAccuracy}><Accuracy {...summary.meanings} label="Meaning accuracy" /><Accuracy {...summary.readings} label="Reading accuracy" /></div>
      <div className={styles.categories}><h2>By subject type</h2>{summary.categories.map((category) => <div className={styles.category} data-type={category.type} key={category.type}><div className={styles.categoryLabel}><span>{category.type === "radical" ? "Radicals" : category.type === "kanji" ? "Kanji" : "Vocabulary"}</span><strong>{resultPercentage(category.correct, category.total)}%</strong></div><CategoryBar value={category.correct / category.total} /><span>{category.correct} / {category.total} without mistakes</span></div>)}</div>
    </div>
    {progression}
    <div className={styles.listHeader}><div role="tablist" aria-label="Reviewed subjects" className={styles.tabs}>{(["mistakes", "all"] as const).map((tab) => <button type="button" id={`results-tab-${tab}`} key={tab} role="tab" aria-selected={selectedTab === tab} aria-controls="results-subjects" tabIndex={selectedTab === tab ? 0 : -1} onClick={() => setSelectedTab(tab)} onKeyDown={(event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? "mistakes" : event.key === "End" ? "all" : tab === "all" ? "mistakes" : "all";
      setSelectedTab(next);
      document.getElementById(`results-tab-${next}`)?.focus();
    }}>{tab === "mistakes" ? `Mistakes (${mistakes.length})` : `All subjects (${items.length})`}</button>)}</div>{mistakes.length ? <ButtonLink href={practiceHref} tone="ghost"><RotateCcw size={16} aria-hidden />Practice mistakes</ButtonLink> : null}</div>
    <div id="results-subjects" role="tabpanel" aria-labelledby={`results-tab-${selectedTab}`} tabIndex={0}>
      {visible.length ? <ul className={styles.subjects}>{visible.map((item) => <ResultSubject key={item.assignmentId} item={item} />)}</ul> : <p className={styles.empty}>No mistakes in this session.</p>}
    </div>
    <footer className={styles.footer}><p>Subject links open in a new tab so you can keep this summary.</p><Button tone="ghost" onClick={() => window.location.reload()}><RotateCcw size={16} aria-hidden />Check for More</Button></footer>
  </section>;
}

function CategoryBar({ value }: { value: number }) {
  const reducedMotion = useReducedMotion();
  return <div className={styles.barTrack} aria-hidden><motion.div className={styles.barValue} initial={{ scaleX: reducedMotion ? value : 0 }} animate={{ scaleX: value }} transition={{ duration: reducedMotion ? 0 : .55, ease: [.2, 0, 0, 1] }} /></div>;
}
