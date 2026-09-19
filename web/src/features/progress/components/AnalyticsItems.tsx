"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Download, List, RotateCcw } from "lucide-react";
import { DEFAULT_SEARCH_FILTERS } from "@/features/subjects/search";
import { VocabularyTypeFilter } from "@/features/subjects/components/VocabularyTypeFilter";
import { ButtonLink } from "@/components/ui/Button";
import { filterAnalyticsItems, type AnalyticsItemFilters } from "../analytics-items";
import { csvCell, downloadAnalyticsFile } from "../analytics-export";
import { KanjiWallWidget } from "./AnalyticsCoverage";
import { SubjectRows, type AnalyticsWidgetProps } from "./AnalyticsWidgets";
import { EmptyAnalytics, Segments, formatNumber } from "./AnalyticsPrimitives";
import styles from "../analytics.module.css";

const DEFAULT_FILTERS: AnalyticsItemFilters = { ...DEFAULT_SEARCH_FILTERS, substage: null, due: "all", reading: "", sort: "level" };
const STAGE_NAMES = ["Not started", "Apprentice I", "Apprentice II", "Apprentice III", "Apprentice IV", "Guru I", "Guru II", "Master", "Enlightened", "Burned"];

export function ItemsWidget(props: AnalyticsWidgetProps) {
  const [view, setView] = useState("kanji");
  const [catalogOpened, setCatalogOpened] = useState(false);
  return <><Segments label="Item explorer view" value={view} onChange={(value) => { setView(value); if (value === "all") setCatalogOpened(true); }} options={[{ value: "kanji", label: "Kanji wall" }, { value: "all", label: "All subjects" }]} /><div className={styles.catalog} hidden={view !== "kanji"}><KanjiWallWidget {...props} /></div>{catalogOpened ? <div hidden={view !== "all"}><AllSubjects {...props} /></div> : null}</>;
}

function AllSubjects({ subjects, assignments, expanded, asOf }: AnalyticsWidgetProps) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [practiceSize, setPracticeSize] = useState(25);
  const [mountedAt] = useState(() => new Date());
  const now = asOf ?? mountedAt;
  const deferred = useDeferredValue(filters);
  const rows = useMemo(() => filterAnalyticsItems(subjects, assignments, deferred, now), [subjects, assignments, deferred, now]);
  const change = (next: Partial<AnalyticsItemFilters>) => { setFilters((current) => ({ ...current, ...next })); setPage(0); };
  const pageSize = expanded ? 40 : 15;
  const activePage = Math.min(page, Math.max(0, Math.ceil(rows.length / pageSize) - 1));
  const visible = rows.slice(activePage * pageSize, (activePage + 1) * pageSize);
  const groups = new Map<string, typeof visible>();
  for (const row of visible) {
    const key = filters.sort === "stage" ? STAGE_NAMES[row.assignment?.data.srs_stage ?? 0] : `Level ${row.subject.data.level}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const studyIds = rows.slice(0, practiceSize).map((row) => row.subject.id);
  return <div className={styles.catalog}>
    <div className={styles.controls}><label>Search subjects<input className={styles.search} value={filters.query} onChange={(event) => change({ query: event.target.value })} placeholder="Character, meaning or romaji" /></label><label>Subject type<select value={filters.types[0] ?? "all"} onChange={(event) => change({ types: event.target.value === "all" ? [] : [event.target.value as (typeof filters.types)[number]] })}><option value="all">All types</option><option value="radical">Radicals</option><option value="kanji">Kanji</option><option value="vocabulary">Vocabulary</option><option value="kana_vocabulary">Kana vocabulary</option></select></label></div>
    <div className={styles.controls}><label>SRS substage<select value={filters.substage ?? "all"} onChange={(event) => change({ substage: event.target.value === "all" ? null : Number(event.target.value) })}><option value="all">All stages</option>{STAGE_NAMES.map((name, stage) => <option key={stage} value={stage}>{name}</option>)}</select></label><label>Review availability<select value={filters.due} onChange={(event) => change({ due: event.target.value as typeof filters.due })}><option value="all">Any time</option><option value="now">Due now</option><option value="today">Due by tonight</option></select></label><label>Group by<select value={filters.sort} onChange={(event) => change({ sort: event.target.value as typeof filters.sort })}><option value="level">Level</option><option value="stage">SRS substage</option></select></label></div>
    {expanded ? <><div className={styles.controls}><label>From level<input type="number" min={1} max={filters.maxLevel} value={filters.minLevel} onChange={(event) => change({ minLevel: Math.max(1, Math.min(filters.maxLevel, Number(event.target.value) || 1)) })} style={{ width: "4.5rem" }} /></label><label>To level<input type="number" min={filters.minLevel} max={60} value={filters.maxLevel} onChange={(event) => change({ maxLevel: Math.max(filters.minLevel, Math.min(60, Number(event.target.value) || 60)) })} style={{ width: "4.5rem" }} /></label><label>Reading<input value={filters.reading} onChange={(event) => change({ reading: event.target.value })} placeholder="Kana or romaji" /></label></div><VocabularyTypeFilter subjects={subjects} selected={filters.vocabularyTypes ?? []} onChange={(vocabularyTypes) => change({ vocabularyTypes })} /></> : null}
    <div className={styles.controls}><span className={styles.note} aria-live="polite">{formatNumber(rows.length)} subjects</span><button type="button" className={styles.textButton} onClick={() => { setFilters(DEFAULT_FILTERS); setPage(0); }}><RotateCcw size={14} />Reset filters</button><button type="button" className={styles.iconButton} title="Export filtered subjects CSV" aria-label="Export filtered subjects CSV" onClick={() => downloadAnalyticsFile([["ID", "Type", "Character", "Meaning", "Reading", "Level", "SRS stage", "Next review"], ...rows.map(({ subject, assignment }) => [subject.id, subject.object, subject.data.characters, subject.data.meanings.find((meaning) => meaning.primary)?.meaning, subject.data.readings?.map((reading) => reading.reading).join("; "), subject.data.level, assignment?.data.srs_stage ?? 0, assignment?.data.available_at ?? ""])].map((row) => row.map(csvCell).join(",")).join("\r\n"), "kakehashi-subjects.csv", "text/csv;charset=utf-8")}><Download size={16} /></button></div>
    {rows.length ? [...groups].map(([label, entries]) => <div key={label} className={styles.catalogGroup}><h3>{label}</h3><SubjectRows subjects={entries.map((row) => row.subject)} assignments={assignments} limit={pageSize} /></div>) : <EmptyAnalytics>No subjects match these filters.</EmptyAnalytics>}
    {rows.length > pageSize ? <div className={styles.pagination}><span>{activePage * pageSize + 1}–{Math.min(rows.length, (activePage + 1) * pageSize)} of {formatNumber(rows.length)}</span><button className={styles.iconButton} aria-label="Previous subject page" disabled={!activePage} onClick={() => setPage(activePage - 1)}><ChevronLeft size={16} /></button><button className={styles.iconButton} aria-label="Next subject page" disabled={(activePage + 1) * pageSize >= rows.length} onClick={() => setPage(activePage + 1)}><ChevronRight size={16} /></button></div> : null}
    <div className={styles.controls}><label>Practice size<select value={practiceSize} onChange={(event) => setPracticeSize(Number(event.target.value))}>{[10, 25, 50, 100].map((count) => <option key={count} value={count}>{count}</option>)}</select></label>{studyIds.length ? <ButtonLink size="small" href={`/study/custom-review?subjectIds=${studyIds.join(",")}&start=1`}>Practice {studyIds.length} items<ArrowRight size={15} /></ButtonLink> : null}<Link className={styles.textButton} href="/lists"><List size={15} />Saved decks</Link></div>
  </div>;
}
