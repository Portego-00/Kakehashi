"use client";
import { useId, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, X, ExternalLink, Volume2, RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import { BunproText, RubyText } from "@/features/bunpro/BunproText";
import { useBunproAudio } from "@/features/bunpro/use-bunpro-audio";
import type { SessionResult, SessionResultsData } from "./session-results";
import styles from "./session-results.module.css";

export function SessionResults({ items, durationMs, pendingCount = 0, error, title, mixed = false, onContinue, onRestart, progression }: SessionResultsData & { title: string; mixed?: boolean; onContinue?: () => void; onRestart?: () => void; progression?: ReactNode }) {
  const id = useId();
  const [filter, setFilter] = useState<"All" | "Correct" | "Missed">("All");
  const [source, setSource] = useState<"all" | "bunpro" | "wanikani">("all");
  const audio = useBunproAudio();
  const correct = items.filter(item => item.correct).length;
  const missed = items.length - correct;
  const percent = items.length ? Math.round(correct / items.length * 100) : 0;
  const visible = items.filter(item => (source === "all" || item.source === source) && (filter === "All" || (filter === "Correct" ? item.correct : !item.correct)));
  const seconds = Math.floor(Math.max(0, durationMs) / 1000);
  const time = seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
  return <section className={styles.results} aria-labelledby={id}>
    <header className={styles.header}><div><h1 id={id}>{title}</h1><p>{items.length ? `${items.length} subjects reviewed · ${time}` : "You're all caught up."}</p></div><ButtonLink href="/dashboard" tone="primary">Back to home</ButtonLink></header>
    {pendingCount > 0 ? <p role="status" className={styles.notice}>{pendingCount} WaniKani {pendingCount === 1 ? "submission is" : "submissions are"} saved on this device and waiting to sync.</p> : null}
    {error ? <p role="alert">{error}</p> : null}
    {progression}
    <div className={styles.layout}><aside className={styles.summary} aria-label="Session summary">
      <div className={styles.accuracy}><strong>{items.length ? `${percent}%` : "—"}</strong><span>First-try accuracy</span><small>Subjects correct without a missed answer</small></div>
      <div className={styles.counts}><div data-correct="true"><strong>{correct}</strong><span>Correct</span></div><div data-correct="false"><strong>{missed}</strong><span>Missed</span></div></div>
      <div className={styles.bar} role="img" aria-label={`${correct} correct and ${missed} missed`}><span style={{ width: `${percent}%` }} /></div>
      <dl className={styles.stats}><div><dt>Time studied</dt><dd>{time}</dd></div>{mixed ? <><div><dt>WaniKani</dt><dd>{items.filter(item => item.source === "wanikani").length}</dd></div><div><dt>Bunpro</dt><dd>{items.filter(item => item.source === "bunpro").length}</dd></div></> : <><div><dt>Grammar</dt><dd>{items.filter(item => item.kind === "grammar").length}</dd></div><div><dt>Vocabulary</dt><dd>{items.filter(item => item.kind === "vocab").length}</dd></div></>}</dl>
      {onContinue ? <Button onClick={onContinue} tone="primary">Continue lessons</Button> : onRestart ? <Button onClick={onRestart}><RotateCcw size={16} />Check for more</Button> : null}
    </aside><div className={styles.items}>
      <div className={styles.filters}>{mixed ? <label>Source <select value={source} onChange={event => setSource(event.target.value as typeof source)}><option value="all">All sources</option><option value="wanikani">WaniKani</option><option value="bunpro">Bunpro</option></select></label> : <h2>This session</h2>}<div className={styles.segmented} role="group" aria-label="Filter results">{(["All", "Correct", "Missed"] as const).map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}</div></div>
      {audio.error ? <p role="status">{audio.error}</p> : null}
      <ul className={styles.list}>{visible.map(item => <ResultRow key={item.id} item={item} play={() => void audio.play(item.audioUrls ?? [])} />)}</ul>
      {!visible.length ? <p className={styles.empty}>{items.length ? `No ${filter === "All" ? "results" : filter.toLowerCase() + " subjects"} for this selection.` : "No reviews in this session."}</p> : null}
    </div></div>
  </section>;
}
function ResultRow({ item, play }: { item: SessionResult; play: () => void }) {
  return <li className={styles.item} data-source={item.source}>
    <div className={styles.resultIcon} data-correct={item.correct} title={item.correct ? "Correct first try" : "Missed on first try"}>{item.correct ? <Check size={20} aria-label="Correct first try" /> : <X size={20} aria-label="Missed on first try" />}</div>
    {item.subject ? <div className={styles.subject} data-type={item.subject.object}><SubjectCharacter subject={item.subject} imageTone="light" imageSize="2rem" /></div> : null}
    <div className={styles.content}><div className={styles.title}>{item.href ? <Link href={item.href} target="_blank" rel="noopener noreferrer" lang="ja">{item.title}</Link> : <span lang="ja">{item.title}</span>}<span className={styles.kind}>{item.source === "wanikani" ? "WaniKani" : "Bunpro"} · {item.kind === "vocab" ? "vocabulary" : item.kind}</span></div>
      {item.sentence ? <p className={styles.sentence} lang="ja"><RubyText text={item.sentence.before} /><span data-correct={item.correct}><RubyText text={item.sentence.answer} /></span><RubyText text={item.sentence.after} /></p> : item.reading ? <p lang="ja">{item.reading}</p> : null}
      <div className={styles.meaning}><BunproText value={item.translation || item.meaning} /></div>
      {item.stage || item.previousStage ? <p className={styles.stage}>{item.previousStage && item.stage && item.previousStage !== item.stage ? `${item.previousStage} → ${item.stage}` : item.stage || item.previousStage}</p> : null}
    </div><div className={styles.rowActions}>{item.audioUrls?.length ? <button type="button" onClick={play} aria-label={`Play audio for ${item.title}`}><Volume2 size={19} /></button> : null}{item.href ? <Link href={item.href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.title} details`}><ExternalLink size={18} /></Link> : null}</div>
  </li>;
}
