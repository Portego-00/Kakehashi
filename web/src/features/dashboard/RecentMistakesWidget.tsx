"use client";

import { CheckCircle2, ChevronRight, List, Plus, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import { useSubjectLists } from "@/features/subjects/use-subject-lists";
import type { DashboardSubjectRow } from "./dashboard-data";
import styles from "./dashboard.module.css";

type RecentMistakePeriod = "hour" | "day" | "week";
type SubjectListsState = ReturnType<typeof useSubjectLists>;

const PERIODS: Array<{ id: RecentMistakePeriod; shortLabel: string; label: string; milliseconds: number }> = [
  { id: "hour", shortLabel: "1h", label: "Past hour", milliseconds: 60 * 60_000 },
  { id: "day", shortLabel: "24h", label: "Past 24 hours", milliseconds: 24 * 60 * 60_000 },
  { id: "week", shortLabel: "7d", label: "Past week", milliseconds: 7 * 24 * 60 * 60_000 },
];

function periodDefinition(period: RecentMistakePeriod) {
  return PERIODS.find((candidate) => candidate.id === period) ?? PERIODS[1];
}

export function filterRecentMistakes(items: DashboardSubjectRow[], period: RecentMistakePeriod, now: Date) {
  const cutoff = now.getTime() - periodDefinition(period).milliseconds;
  return items.filter((item) => {
    const updatedAt = Date.parse(item.date ?? "");
    return Number.isFinite(updatedAt) && updatedAt >= cutoff;
  });
}

function studyHref(mode: "custom-review" | "custom-lessons", items: DashboardSubjectRow[]) {
  return `/study/${mode}?subjectIds=${items.map((item) => item.id).join(",")}&start=1`;
}

function appendSubjectsToLists(
  repository: SubjectListsState["repository"],
  listIds: Set<string>,
  subjectIds: number[],
) {
  const updatedAt = new Date().toISOString();
  repository.replace(repository.load().map((list) => listIds.has(list.id) ? {
    ...list,
    subjectIds: [...new Set([...list.subjectIds, ...subjectIds])],
    updatedAt,
  } : list));
}

function AddMistakesToListsDialog({ subjectLists, items, periodLabel, onClose }: {
  subjectLists: SubjectListsState;
  items: DashboardSubjectRow[];
  periodLabel: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { repository, lists, syncing, syncError } = subjectLists;
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(() => new Set());
  const [newListName, setNewListName] = useState("");
  const [error, setError] = useState("");
  const subjectIds = useMemo(() => items.map((item) => item.id), [items]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    inputRef.current?.focus();
  }, []);

  const close = () => {
    const dialog = dialogRef.current;
    if (dialog?.open && typeof dialog.close === "function") dialog.close();
    else onClose();
  };
  const toggleList = (id: string) => {
    setError("");
    setSelectedListIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const createList = () => {
    const name = newListName.trim();
    if (!name) return;
    const created = repository.create(name);
    const selected = new Set([created.id]);
    appendSubjectsToLists(repository, selected, subjectIds);
    setSelectedListIds((current) => new Set([...current, created.id]));
    setNewListName("");
    setError("");
  };
  const addToSelectedLists = () => {
    if (!selectedListIds.size) {
      setError("Select at least one list.");
      return;
    }
    appendSubjectsToLists(repository, selectedListIds, subjectIds);
    close();
  };

  return <dialog
    ref={dialogRef}
    className={styles.recentMistakesListDialog}
    aria-labelledby="recent-mistakes-list-dialog-title"
    onCancel={(event) => { event.preventDefault(); close(); }}
    onClose={onClose}
    onClick={(event) => { if (event.target === event.currentTarget) close(); }}
  >
    <div className={styles.recentMistakesListDialogBody}>
      <header className={styles.recentMistakesListDialogHead}>
        <div><h2 id="recent-mistakes-list-dialog-title">Add to Lists</h2><p>{periodLabel} mistakes ({items.length})</p></div>
        <button type="button" aria-label="Close list picker" onClick={close}><X size={19} aria-hidden /></button>
      </header>

      <form className={styles.recentMistakesCreateList} onSubmit={(event) => { event.preventDefault(); createList(); }}>
        <label className="sr-only" htmlFor="recent-mistakes-list-name">Create new list</label>
        <input
          ref={inputRef}
          id="recent-mistakes-list-name"
          name="recent-mistakes-list-name"
          autoComplete="off"
          value={newListName}
          onChange={(event) => setNewListName(event.target.value)}
          placeholder="Create a new list…"
        />
        <button type="submit" disabled={!newListName.trim()} aria-label="Create list"><Plus size={18} aria-hidden /></button>
      </form>

      <div className={styles.recentMistakesListChoices}>
        {lists.length ? lists.map((list) => <label key={list.id} data-selected={selectedListIds.has(list.id) || undefined}>
          <span><strong>{list.name}</strong><small>{list.subjectIds.length} {list.subjectIds.length === 1 ? "item" : "items"}</small></span>
          <input type="checkbox" checked={selectedListIds.has(list.id)} onChange={() => toggleList(list.id)} />
        </label>) : <p>{syncing ? "Loading your lists…" : "No lists yet. Create your first one above."}</p>}
      </div>

      {syncError ? <p className={styles.recentMistakesListNotice} role="status">Cloud sync is unavailable. Your browser copy is still available.</p> : null}
      {error ? <p className={styles.recentMistakesListError} role="alert">{error}</p> : null}

      <footer className={styles.recentMistakesListDialogFooter}>
        <button type="button" onClick={close}>Cancel</button>
        <button type="button" data-primary="true" onClick={addToSelectedLists}>Add All</button>
      </footer>
    </div>
  </dialog>;
}

function AddMistakesToListsController({ open, username, items, periodLabel, onClose }: {
  open: boolean;
  username: string;
  items: DashboardSubjectRow[];
  periodLabel: string;
  onClose: () => void;
}) {
  const subjectLists = useSubjectLists(username);

  if (!open) return null;
  return <AddMistakesToListsDialog subjectLists={subjectLists} items={items} periodLabel={periodLabel} onClose={onClose} />;
}

function MistakeTile({ item, preview }: { item: DashboardSubjectRow; preview: boolean }) {
  const character = <SubjectCharacter
    subject={item.subject}
    fallbackText={item.characters}
    imageSize="1.5rem"
    imageTone="light"
    className={styles.recentMistakeGlyph}
    data-subject-type={item.type}
    title={item.characters}
  />;
  if (preview) return <span className={styles.recentMistakeTile} data-subject-type={item.type}>{character}</span>;
  return <Link className={styles.recentMistakeTile} data-subject-type={item.type} href={`/subjects/${item.id}`} aria-label={`${item.characters}, ${item.meaning}`}>{character}</Link>;
}

function DisabledAction({ children, full = false }: { children: React.ReactNode; full?: boolean }) {
  return <button type="button" className={styles.recentMistakeAction} data-full={full || undefined} disabled>{children}</button>;
}

export function RecentMistakesWidget({ items, username = "anonymous", now = new Date(), preview = false }: {
  items: DashboardSubjectRow[];
  username?: string;
  now?: Date;
  preview?: boolean;
}) {
  const [period, setPeriod] = useState<RecentMistakePeriod>("day");
  const [listDialogOpen, setListDialogOpen] = useState(false);
  const [listControllerMounted, setListControllerMounted] = useState(false);
  const nowTime = now.getTime();
  const filteredItems = useMemo(() => filterRecentMistakes(items, period, new Date(nowTime)), [items, nowTime, period]);
  const selectedPeriod = periodDefinition(period);
  const hasMistakes = filteredItems.length > 0;
  const actionContents = {
    extra: <><span>Extra Study</span>{hasMistakes ? <strong className={styles.recentMistakeActionBadge}>{filteredItems.length}</strong> : null}<ChevronRight size={16} aria-hidden /></>,
    lessons: <><span>Redo Lessons</span><RotateCcw size={14} aria-hidden /></>,
    lists: <><List size={16} aria-hidden /><span>Add to Subject List</span>{hasMistakes ? <strong className={styles.recentMistakeActionBadge}>{filteredItems.length}</strong> : null}</>,
  };

  return <section className={`${styles.section} ${styles.recentMistakesWidget}`}>
    <div className={styles.recentMistakesHead}>
      <h2>Recent Mistakes</h2>
      <div className={styles.recentMistakesPeriods} role="group" aria-label="Recent mistakes time period">
        {PERIODS.map((candidate) => <button
          type="button"
          key={candidate.id}
          aria-pressed={period === candidate.id}
          disabled={preview}
          onClick={() => setPeriod(candidate.id)}
        >{candidate.shortLabel}</button>)}
      </div>
    </div>

    <div className={styles.recentMistakesContent}>
      {hasMistakes ? <>
        <p className={styles.recentMistakesPeriodLabel}>{selectedPeriod.label}.</p>
        <div className={styles.recentMistakesRail} data-item-count={filteredItems.length} key={period}>
          {filteredItems.map((item) => <MistakeTile item={item} preview={preview} key={item.id} />)}
        </div>
      </> : <div className={styles.recentMistakesEmpty}>
        <CheckCircle2 size={32} aria-hidden />
        <p>No mistakes in the {selectedPeriod.label.toLocaleLowerCase()}</p>
      </div>}
    </div>

    <div className={styles.recentMistakesActions} data-disabled={!hasMistakes || undefined}>
      <div>
        {hasMistakes && !preview ? <Link className={styles.recentMistakeAction} href={studyHref("custom-review", filteredItems)}>{actionContents.extra}</Link> : <DisabledAction>{actionContents.extra}</DisabledAction>}
        {hasMistakes && !preview ? <Link className={styles.recentMistakeAction} href={studyHref("custom-lessons", filteredItems)}>{actionContents.lessons}</Link> : <DisabledAction>{actionContents.lessons}</DisabledAction>}
      </div>
      {hasMistakes && !preview ? <button type="button" className={styles.recentMistakeAction} data-full="true" onClick={() => { setListControllerMounted(true); setListDialogOpen(true); }}>{actionContents.lists}</button> : <DisabledAction full>{actionContents.lists}</DisabledAction>}
    </div>

    {listControllerMounted ? <AddMistakesToListsController open={listDialogOpen} username={username} items={filteredItems} periodLabel={selectedPeriod.label} onClose={() => setListDialogOpen(false)} /> : null}
  </section>;
}
