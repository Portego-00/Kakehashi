"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Filter, Search, X } from "lucide-react";
import { SrsStageIcon } from "@/components/SrsStageIcon";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/States";
import type { Assignment, ReviewStatistic, Subject, SubjectType } from "@/types/wanikani";
import { DEFAULT_SEARCH_FILTERS, searchSubjects } from "../search";
import { SubjectTile } from "./SubjectTile";
import styles from "../subjects.module.css";

const TYPES: Array<{ value: SubjectType; label: string }> = [
  { value: "radical", label: "Radicals" },
  { value: "kanji", label: "Kanji" },
  { value: "vocabulary", label: "Vocabulary" },
  { value: "kana_vocabulary", label: "Kana vocabulary" },
];
const SRS = ["apprentice", "guru", "master", "enlightened", "burned", "locked"];
const RESULT_LIMIT = 80;

export function AddSubjectsDialog({
  open,
  listName,
  subjectIds,
  subjects,
  assignments,
  statistics,
  onAdd,
  onClose,
}: {
  open: boolean;
  listName: string;
  subjectIds: number[];
  subjects: Subject[];
  assignments: Assignment[];
  statistics: ReviewStatistic[];
  onAdd: (subjectId: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [types, setTypes] = useState<SubjectType[]>([]);
  const [srs, setSrs] = useState<string[]>([]);
  const [minLevel, setMinLevel] = useState(1);
  const [maxLevel, setMaxLevel] = useState(60);
  const [showFilters, setShowFilters] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const savedSubjectIds = useMemo(() => new Set(subjectIds), [subjectIds]);
  const statisticBySubject = useMemo(() => new Map(statistics.map((statistic) => [statistic.data.subject_id, statistic])), [statistics]);
  const allResults = useMemo(() => open ? searchSubjects(subjects, assignments, {
    ...DEFAULT_SEARCH_FILTERS,
    query: deferredQuery,
    types,
    srs,
    minLevel,
    maxLevel,
  }) : [], [assignments, deferredQuery, maxLevel, minLevel, open, srs, subjects, types]);
  const results = allResults.slice(0, RESULT_LIMIT);
  const activeFilters = types.length + srs.length + (minLevel > 1 ? 1 : 0) + (maxLevel < 60 ? 1 : 0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      searchRef.current?.focus();
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  const toggle = <T,>(value: T, current: T[], setCurrent: (next: T[]) => void) => {
    setCurrent(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };
  const resetFilters = () => { setTypes([]); setSrs([]); setMinLevel(1); setMaxLevel(60); };

  return <dialog
    ref={dialogRef}
    className={styles.addSubjectsDialog}
    aria-labelledby="add-subjects-title"
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClose={onClose}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    <header className={styles.addDialogHeader}>
      <div><h2 id="add-subjects-title">Add subjects</h2><p>Choose subjects for “{listName}”.</p></div>
      <button type="button" aria-label="Close subject search" onClick={onClose}><X size={19} aria-hidden /></button>
    </header>

    <div className={styles.addDialogSearch}>
      <label className={styles.searchInput}><Search size={20} aria-hidden /><span className="sr-only">Search subjects to add</span><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try 日本, Japan, or nihon" autoComplete="off" />{query ? <button type="button" onClick={() => { setQuery(""); searchRef.current?.focus(); }} aria-label="Clear search"><X size={17} /></button> : null}</label>
      <Button className={styles.filterToggle} type="button" onClick={() => setShowFilters((value) => !value)} aria-expanded={showFilters} aria-controls="add-subjects-filters"><Filter size={17} aria-hidden /> Filters{activeFilters ? ` (${activeFilters})` : ""}</Button>
    </div>

    <div className={styles.addDialogBody}>
      {showFilters ? <div id="add-subjects-filters" className={styles.addDialogFilters}>
        {activeFilters ? <div className={styles.filterHead}><Button tone="ghost" size="small" onClick={resetFilters}>Clear filters</Button></div> : null}
        <div className={styles.filterGrid}>
          <div className={styles.filterGroup} role="group" aria-labelledby="add-subject-type-filter-title"><h3 id="add-subject-type-filter-title" className={styles.filterTitle}>Subject type</h3><div className={styles.checkGroup}>{TYPES.map((type) => <label key={type.value}><input type="checkbox" checked={types.includes(type.value)} onChange={() => toggle(type.value, types, setTypes)} /><span>{type.label}</span></label>)}</div></div>
          <div className={styles.filterGroup} role="group" aria-labelledby="add-subject-srs-filter-title"><h3 id="add-subject-srs-filter-title" className={styles.filterTitle}>SRS stage</h3><div className={styles.checkGroup}>{SRS.map((value) => <label key={value}><input type="checkbox" checked={srs.includes(value)} onChange={() => toggle(value, srs, setSrs)} />{value !== "locked" ? <SrsStageIcon level={value} size={18} /> : null}<span>{value[0].toUpperCase() + value.slice(1)}</span></label>)}</div></div>
          <div className={styles.filterGroup} role="group" aria-labelledby="add-subject-level-filter-title"><h3 id="add-subject-level-filter-title" className={styles.filterTitle}>WaniKani level</h3><div className={styles.levelInputs}><label>From <input type="number" min={1} max={maxLevel} value={minLevel} onChange={(event) => setMinLevel(Math.max(1, Math.min(maxLevel, Number(event.target.value))))} /></label><label>Through <input type="number" min={minLevel} max={60} value={maxLevel} onChange={(event) => setMaxLevel(Math.min(60, Math.max(minLevel, Number(event.target.value))))} /></label></div></div>
        </div>
      </div> : null}

      <div className={styles.addDialogResults}>
        <p className={styles.addDialogResultCount} aria-live="polite">{allResults.length > RESULT_LIMIT ? `First ${RESULT_LIMIT} of ${allResults.length} matches` : `${allResults.length} ${allResults.length === 1 ? "match" : "matches"}`}</p>
        {results.length ? <section aria-label="Subjects to add" className={styles.subjectList}>{results.map((result) => {
          const added = savedSubjectIds.has(result.subject.id);
          return <SubjectTile
            key={result.subject.id}
            subject={result.subject}
            assignment={result.assignment}
            statistic={statisticBySubject.get(result.subject.id)}
            action={<Button type="button" size="small" state={added ? "success" : "idle"} disabled={added} onClick={() => onAdd(result.subject.id)}>{added ? "Added" : "Add"}</Button>}
          />;
        })}</section> : <EmptyState title="No subjects found" description="Try a broader spelling, level range, subject type, or SRS stage." />}
      </div>
    </div>
  </dialog>;
}
