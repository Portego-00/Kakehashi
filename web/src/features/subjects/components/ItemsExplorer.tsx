"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Flame, LockKeyhole, Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState, Skeleton } from "@/components/ui/States";
import type { Subject, SubjectType } from "@/types/wanikani";
import { useSubjectCatalog } from "../data";
import { useFirstSubjectReveal } from "../useFirstSubjectReveal";
import { SubjectTile } from "./SubjectTile";
import styles from "../subjects.module.css";

export type ItemView = "unlocks" | "critical" | "burned";
const VIEWS: Array<{ id: ItemView; label: string; icon: typeof LockKeyhole }> = [{ id: "unlocks", label: "Unlocks", icon: LockKeyhole }, { id: "critical", label: "Critical", icon: AlertTriangle }, { id: "burned", label: "Burned", icon: Flame }];

export function ItemsExplorer({ initialView = "unlocks" }: { initialView?: ItemView }) {
  const { subjects, assignments, statistics, isLoading, isError } = useSubjectCatalog();
  const firstResultsReveal = useFirstSubjectReveal();
  const [view, setView] = useState<ItemView>(initialView);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SubjectType | "all">("all");
  const [days, setDays] = useState(30);
  const [now] = useState(() => Date.now());
  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const assignmentBySubject = useMemo(() => new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment])), [assignments]);
  const statisticBySubject = useMemo(() => new Map(statistics.map((statistic) => [statistic.data.subject_id, statistic])), [statistics]);

  const rows = useMemo(() => {
    const cutoff = now - days * 86_400_000;
    let selected: Array<{ subject: Subject; sort: number }> = [];
    if (view === "critical") {
      selected = statistics.filter((statistic) => !statistic.data.hidden && statistic.data.percentage_correct < 75).map((statistic) => ({ subject: subjectById.get(statistic.data.subject_id), sort: statistic.data.percentage_correct })).filter((entry): entry is { subject: Subject; sort: number } => Boolean(entry.subject));
    } else {
      const field: "unlocked_at" | "burned_at" = view === "unlocks" ? "unlocked_at" : "burned_at";
      selected = assignments.filter((assignment) => {
        const date = assignment.data[field];
        return date && new Date(date).getTime() >= cutoff;
      }).map((assignment) => ({ subject: subjectById.get(assignment.data.subject_id), sort: -(new Date(assignment.data[field]!).getTime()) })).filter((entry): entry is { subject: Subject; sort: number } => Boolean(entry.subject));
    }
    const normalized = query.trim().toLocaleLowerCase();
    return selected.filter(({ subject }) => (type === "all" || subject.object === type) && (!normalized || subject.data.characters?.includes(normalized) || subject.data.meanings.some((meaning) => meaning.meaning.toLocaleLowerCase().includes(normalized)) || subject.data.readings?.some((reading) => reading.reading.includes(normalized)))).sort((a, b) => a.sort - b.sort).map((entry) => entry.subject);
  }, [assignments, days, now, query, statistics, subjectById, type, view]);

  return <main className={`page ${styles.page}`}>
    <header className="page-header"><div><h1>Items</h1><p>Inspect recent unlocks, troublesome subjects, and burned milestones from one place.</p></div>{!isLoading ? <Badge>{rows.length.toLocaleString()} {rows.length === 1 ? "item" : "items"}</Badge> : null}</header>

    <nav className={styles.tabs} aria-label="Item views">{VIEWS.map((item) => <button type="button" key={item.id} aria-current={view === item.id ? "page" : undefined} onClick={() => setView(item.id)}><item.icon size={17} />{item.label}</button>)}</nav>
    <section className={styles.itemToolbar} aria-label="Item filters">
      <label className={styles.compactSearch}><Search size={17} /><span className="sr-only">Filter visible items</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter visible items" /></label>
      <label><span>Type</span><select value={type} onChange={(event) => setType(event.target.value as SubjectType | "all")}><option value="all">All types</option><option value="radical">Radicals</option><option value="kanji">Kanji</option><option value="vocabulary">Vocabulary</option><option value="kana_vocabulary">Kana vocabulary</option></select></label>
      {view !== "critical" ? <label><span>Time range</span><select value={days} onChange={(event) => setDays(Number(event.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option><option value={3650}>All time</option></select></label> : null}
    </section>

    {view === "critical" ? <p className={styles.viewExplanation}>Critical items have aggregate review accuracy below 75%. Lowest accuracy appears first.</p> : null}
    {isLoading ? <div className={styles.subjectList} aria-busy="true">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} height="6rem" />)}</div> : isError ? <EmptyState title="Items are unavailable" description="Refresh to request your assignments and review statistics again." /> : rows.length === 0 ? <EmptyState title={`No ${view} match`} description={view === "critical" ? "Try another subject type or search term." : "Try another time range, subject type, or search term."} /> : <section className={styles.subjectList} aria-label={`${view} items`} {...firstResultsReveal}>{rows.map((subject) => <SubjectTile key={subject.id} subject={subject} assignment={assignmentBySubject.get(subject.id)} statistic={statisticBySubject.get(subject.id)} />)}</section>}
  </main>;
}
