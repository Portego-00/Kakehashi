"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { SrsStageIcon } from "@/components/SrsStageIcon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/States";
import type { SubjectType } from "@/types/wanikani";
import { useSubjectCatalog } from "../data";
import { DEFAULT_SEARCH_FILTERS, searchSubjects } from "../search";
import { useFirstSubjectReveal } from "../useFirstSubjectReveal";
import { SubjectTile } from "./SubjectTile";
import styles from "../subjects.module.css";

const TYPES: Array<{ value: SubjectType; label: string }> = [{ value: "radical", label: "Radicals" }, { value: "kanji", label: "Kanji" }, { value: "vocabulary", label: "Vocabulary" }, { value: "kana_vocabulary", label: "Kana vocabulary" }];
const SRS = ["apprentice", "guru", "master", "enlightened", "burned", "locked"];
const RESULTS_PER_PAGE = 40;

export function SearchWorkspace() {
  const { subjects, assignments, statistics, isLoading, isError } = useSubjectCatalog();
  const firstResultsReveal = useFirstSubjectReveal();
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<SubjectType[]>([]);
  const [srs, setSrs] = useState<string[]>([]);
  const [minLevel, setMinLevel] = useState(1);
  const [maxLevel, setMaxLevel] = useState(60);
  const [showFilters, setShowFilters] = useState(false);
  const [visiblePages, setVisiblePages] = useState(1);
  const deferredQuery = useDeferredValue(query);
  const statisticBySubject = useMemo(() => new Map(statistics.map((statistic) => [statistic.data.subject_id, statistic])), [statistics]);
  const results = useMemo(() => searchSubjects(subjects, assignments, { ...DEFAULT_SEARCH_FILTERS, query: deferredQuery, types, srs, minLevel, maxLevel }), [assignments, deferredQuery, maxLevel, minLevel, srs, subjects, types]);
  const visibleResults = results.slice(0, visiblePages * RESULTS_PER_PAGE);
  const activeFilters = types.length + srs.length + (minLevel > 1 ? 1 : 0) + (maxLevel < 60 ? 1 : 0);

  const resetVisiblePages = () => setVisiblePages(1);
  const toggle = <T,>(value: T, current: T[], setCurrent: (next: T[]) => void) => {
    setCurrent(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    resetVisiblePages();
  };
  const reset = () => { setTypes([]); setSrs([]); setMinLevel(1); setMaxLevel(60); resetVisiblePages(); };

  return <main className={`page ${styles.page}`}>
    <header className="page-header"><div><h1>Subject search</h1><p>Search characters, meanings, kana readings, or romaji across your available WaniKani catalog.</p></div>{results.length > 0 ? <Badge>{results.length.toLocaleString()} matches</Badge> : null}</header>

    <section className={styles.searchControls} aria-label="Search controls">
      <label className={styles.searchInput}><Search size={20} aria-hidden /><span className="sr-only">Search subjects</span><input value={query} onChange={(event) => { setQuery(event.target.value); resetVisiblePages(); }} placeholder="Try 日本, Japan, or nihon" autoComplete="off" />{query ? <button type="button" onClick={() => { setQuery(""); resetVisiblePages(); }} aria-label="Clear search"><X size={17} /></button> : null}</label>
      <Button type="button" onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters}><Filter size={17} /> Filters{activeFilters ? ` (${activeFilters})` : ""}</Button>
    </section>

    {showFilters ? <Card className={styles.filters}>
      <div className={styles.filterHead}><h2>Refine results</h2>{activeFilters ? <Button tone="ghost" size="small" onClick={reset}>Reset</Button> : null}</div>
      <fieldset><legend>Subject type</legend><div className={styles.checkGroup}>{TYPES.map((type) => <label key={type.value}><input type="checkbox" checked={types.includes(type.value)} onChange={() => toggle(type.value, types, setTypes)} /><span>{type.label}</span></label>)}</div></fieldset>
      <fieldset><legend>SRS stage</legend><div className={styles.checkGroup}>{SRS.map((value) => <label key={value}><input type="checkbox" checked={srs.includes(value)} onChange={() => toggle(value, srs, setSrs)} />{value !== "locked" ? <SrsStageIcon level={value} size={18} /> : null}<span>{value[0].toUpperCase() + value.slice(1)}</span></label>)}</div></fieldset>
      <fieldset><legend>WaniKani level</legend><div className={styles.levelInputs}><label>From <input type="number" min={1} max={maxLevel} value={minLevel} onChange={(event) => { setMinLevel(Math.max(1, Math.min(maxLevel, Number(event.target.value)))); resetVisiblePages(); }} /></label><label>Through <input type="number" min={minLevel} max={60} value={maxLevel} onChange={(event) => { setMaxLevel(Math.min(60, Math.max(minLevel, Number(event.target.value)))); resetVisiblePages(); }} /></label></div></fieldset>
    </Card> : null}

    {isLoading ? <div className={styles.subjectList} aria-busy="true">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} height="6rem" />)}</div> : isError ? <EmptyState title="Search is unavailable" description="WaniKani did not return your subject catalog. Refresh to try again." /> : results.length === 0 ? <EmptyState title="No subjects found" description="Try a broader spelling, level range, subject type, or SRS stage." /> : <section aria-label="Search results" className={styles.subjectList} {...firstResultsReveal}>{visibleResults.map((result) => <SubjectTile key={result.subject.id} subject={result.subject} assignment={result.assignment} statistic={statisticBySubject.get(result.subject.id)} />)}{visibleResults.length < results.length ? <div className={styles.resultPager}><p>Showing {visibleResults.length.toLocaleString()} of {results.length.toLocaleString()} matches</p><Button type="button" tone="ghost" onClick={() => setVisiblePages((pages) => pages + 1)}>Show {Math.min(RESULTS_PER_PAGE, results.length - visibleResults.length)} more</Button></div> : null}</section>}
  </main>;
}
