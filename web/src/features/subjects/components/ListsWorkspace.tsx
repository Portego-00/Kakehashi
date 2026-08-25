"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BookOpenCheck, ListPlus, Pencil, Play, Search, Trash2, Undo2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { useSession } from "@/lib/session";
import type { Subject } from "@/types/wanikani";
import { useSubjectCatalog } from "../data";
import { createListRepository, type ListStorage, type SubjectList } from "../lists";
import { DEFAULT_SEARCH_FILTERS, searchSubjects } from "../search";
import { bridgeListsToStudy } from "../study-list-bridge";
import { useFirstSubjectReveal } from "../useFirstSubjectReveal";
import styles from "../subjects.module.css";

const browserStorage: ListStorage = {
  getItem: (key) => typeof window === "undefined" ? null : window.localStorage.getItem(key),
  setItem: (key, value) => { if (typeof window !== "undefined") window.localStorage.setItem(key, value); },
};
type SortMode = "manual" | "level" | "type" | "meaning";

export function ListsWorkspace() {
  const { user } = useSession();
  const { subjects, assignments, isLoading } = useSubjectCatalog();
  const username = user?.data.username ?? "anonymous";
  const studyScope = user?.id;
  const repository = useMemo(() => createListRepository(browserStorage, username), [username]);
  const savedListsReveal = useFirstSubjectReveal();
  const listSubjectsReveal = useFirstSubjectReveal();
  const [lists, setLists] = useState<SubjectList[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [filter, setFilter] = useState("");
  const [addQuery, setAddQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("manual");
  const [deleted, setDeleted] = useState<{ list: SubjectList; index: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const loaded = repository.load();
      setLists(loaded);
      bridgeListsToStudy(studyScope, loaded);
      setActiveId((current) => current && loaded.some((list) => list.id === current) ? current : loaded[0]?.id ?? null);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [repository, studyScope]);

  const refresh = (preferred?: string | null) => {
    const next = repository.load();
    setLists(next);
    bridgeListsToStudy(studyScope, next);
    setActiveId(preferred && next.some((list) => list.id === preferred) ? preferred : (activeId && next.some((list) => list.id === activeId) ? activeId : next[0]?.id ?? null));
  };
  const active = lists.find((list) => list.id === activeId);
  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);
  const visibleSubjects = useMemo(() => {
    if (!active) return [];
    const normalized = filter.trim().toLocaleLowerCase();
    const items = active.subjectIds.map((id) => subjectById.get(id)).filter((subject): subject is Subject => Boolean(subject)).filter((subject) => !normalized || subject.data.characters?.includes(normalized) || subject.data.meanings.some((meaning) => meaning.meaning.toLocaleLowerCase().includes(normalized)));
    if (sort === "level") return [...items].sort((a, b) => a.data.level - b.data.level);
    if (sort === "type") return [...items].sort((a, b) => a.object.localeCompare(b.object) || a.data.level - b.data.level);
    if (sort === "meaning") return [...items].sort((a, b) => (a.data.meanings[0]?.meaning ?? "").localeCompare(b.data.meanings[0]?.meaning ?? ""));
    return items;
  }, [active, filter, sort, subjectById]);
  const addResults = useMemo(() => addQuery.trim() ? searchSubjects(subjects, assignments, { ...DEFAULT_SEARCH_FILTERS, query: addQuery }).filter((result) => !active?.subjectIds.includes(result.subject.id)).slice(0, 8) : [], [active?.subjectIds, addQuery, assignments, subjects]);

  const create = () => {
    if (!newName.trim()) return;
    const created = repository.create(newName);
    setNewName("");
    refresh(created.id);
  };
  const remove = (list: SubjectList, index: number) => {
    repository.remove(list.id);
    setDeleted({ list, index });
    refresh(list.id === activeId ? null : activeId);
  };
  const undo = () => {
    if (!deleted) return;
    repository.restore(deleted.list, deleted.index);
    refresh(deleted.list.id);
    setDeleted(null);
  };

  return <main className={`page ${styles.page}`}>
    <header className="page-header"><div><h1>Subject lists</h1><p>Build reusable, account-specific collections and launch them directly into a focused study session.</p></div>{lists.length ? <Badge>{lists.length} {lists.length === 1 ? "list" : "lists"}</Badge> : null}</header>

    <div className={styles.listsLayout}>
      <aside className={styles.listSidebar}>
        <form className={styles.newListForm} onSubmit={(event) => { event.preventDefault(); create(); }}><label><span>New list</span><span className={styles.newListInput}><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Leech rescue" /><Button type="submit" size="small" tone="primary" disabled={!newName.trim()}><ListPlus size={16} /> Create</Button></span></label></form>
        <nav aria-label="Your subject lists" className={styles.savedLists} {...savedListsReveal}>{lists.map((list, index) => <div key={list.id} data-active={list.id === activeId}>
          {renameId === list.id ? <form onSubmit={(event) => { event.preventDefault(); repository.rename(list.id, renameValue); setRenameId(null); refresh(list.id); }} className={styles.renameForm}><input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} aria-label={`Rename ${list.name}`} /><Button size="small" type="submit">Save</Button></form> : <button type="button" className={styles.listSelect} onClick={() => setActiveId(list.id)}><span><strong>{list.name}</strong><small>{list.subjectIds.length} {list.subjectIds.length === 1 ? "subject" : "subjects"}</small></span></button>}
          <div className={styles.listActions}><button type="button" aria-label={`Move ${list.name} up`} disabled={index === 0} onClick={() => { repository.reorder(list.id, index - 1); refresh(list.id); }}><ArrowUp size={15} /></button><button type="button" aria-label={`Move ${list.name} down`} disabled={index === lists.length - 1} onClick={() => { repository.reorder(list.id, index + 1); refresh(list.id); }}><ArrowDown size={15} /></button><button type="button" aria-label={`Rename ${list.name}`} onClick={() => { setRenameId(list.id); setRenameValue(list.name); }}><Pencil size={15} /></button><button type="button" aria-label={`Delete ${list.name}`} onClick={() => remove(list, index)}><Trash2 size={15} /></button></div>
        </div>)}</nav>
        {deleted ? <div className={styles.undoNotice} role="status"><span>Deleted “{deleted.list.name}”</span><button type="button" onClick={undo}><Undo2 size={15} /> Undo</button></div> : null}
      </aside>

      <section className={styles.listDetail}>
        {!active ? <EmptyState icon={<BookOpenCheck />} title="Create your first list" description="Lists stay in this browser and are namespaced to your WaniKani username." /> : <>
          <div className={styles.listDetailHead}><div><h2>{active.name}</h2><p>{active.subjectIds.length} saved {active.subjectIds.length === 1 ? "subject" : "subjects"}</p></div><Link className={styles.studyLink} aria-disabled={active.subjectIds.length === 0} href={active.subjectIds.length ? `/study/custom-review?subjectIds=${active.subjectIds.join(",")}` : "#"}><Play size={16} /> Study this list</Link></div>
          <div className={styles.listTools}>
            <label className={styles.compactSearch}><Search size={17} /><span className="sr-only">Filter list</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter this list" /></label>
            <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="manual">Manual order</option><option value="level">Level</option><option value="type">Subject type</option><option value="meaning">Meaning</option></select></label>
          </div>
          {isLoading ? <Skeleton height="16rem" /> : visibleSubjects.length ? <ol className={styles.listSubjects} {...listSubjectsReveal}>{visibleSubjects.map((subject) => { const manualIndex = active.subjectIds.indexOf(subject.id); const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.slug; return <li key={subject.id}><Link href={`/subjects/${subject.id}`}><span lang="ja" data-type={subject.object === "kana_vocabulary" ? "vocabulary" : subject.object}>{subject.data.characters ?? meaning}</span><span><strong>{meaning}</strong><small>{subject.object.replace("_", " ")} · Level {subject.data.level}</small></span></Link><div>{sort === "manual" ? <><button type="button" disabled={manualIndex === 0} aria-label={`Move ${meaning} up`} onClick={() => { repository.reorderSubject(active.id, subject.id, manualIndex - 1); refresh(active.id); }}><ArrowUp size={15} /></button><button type="button" disabled={manualIndex === active.subjectIds.length - 1} aria-label={`Move ${meaning} down`} onClick={() => { repository.reorderSubject(active.id, subject.id, manualIndex + 1); refresh(active.id); }}><ArrowDown size={15} /></button></> : null}<button type="button" aria-label={`Remove ${meaning}`} onClick={() => { repository.removeSubject(active.id, subject.id); refresh(active.id); }}><X size={15} /></button></div></li>; })}</ol> : <EmptyState title={filter ? "No subjects match" : "This list is empty"} description={filter ? "Clear the filter to see the whole list." : "Use the search below to add subjects."} />}
          <div className={styles.addSubjects}><h3>Add subjects</h3><label className={styles.compactSearch}><Search size={17} /><span className="sr-only">Find subjects to add</span><input value={addQuery} onChange={(event) => setAddQuery(event.target.value)} placeholder="Search characters, meanings, or readings" /></label>{addResults.length ? <ul>{addResults.map((result) => { const meaning = result.subject.data.meanings.find((item) => item.primary)?.meaning ?? result.subject.data.slug; return <li key={result.subject.id}><span lang="ja">{result.subject.data.characters ?? meaning}</span><span><strong>{meaning}</strong><small>Level {result.subject.data.level}</small></span><Button size="small" onClick={() => { repository.addSubject(active.id, result.subject.id); refresh(active.id); }}>Add</Button></li>; })}</ul> : addQuery.trim() ? <p>No additional subjects match.</p> : null}</div>
        </>}
      </section>
    </div>
  </main>;
}
