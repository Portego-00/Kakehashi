"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { ArrowDown, ArrowUp, BookOpenCheck, GripVertical, ListPlus, Pencil, Play, Search, Trash2, Undo2, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { useSession } from "@/lib/session";
import type { Subject } from "@/types/wanikani";
import { useSubjectCatalog } from "../data";
import type { SubjectList } from "../lists";
import { useSubjectLists } from "../use-subject-lists";
import { useFirstSubjectReveal } from "../useFirstSubjectReveal";
import { AddSubjectsDialog } from "./AddSubjectsDialog";
import { ListStudyDialog } from "./ListStudyDialog";
import { SubjectCharacter } from "./SubjectCharacter";
import styles from "../subjects.module.css";

type SortMode = "manual" | "level" | "type" | "meaning";
type SubjectDropTarget = { subjectId: number; edge: "before" | "after" };

const SUBJECT_DRAG_TYPE = "application/x-kakehashi-subject-id";

function subjectDropEdge(element: HTMLElement, clientY: number): SubjectDropTarget["edge"] {
  const bounds = element.getBoundingClientRect();
  return clientY < bounds.top + bounds.height / 2 ? "before" : "after";
}

export function ListsWorkspace() {
  const { user } = useSession();
  const { subjects, assignments, statistics, isLoading } = useSubjectCatalog();
  const username = user?.data.username ?? "anonymous";
  const { repository, lists, syncing, syncError } = useSubjectLists(username);
  const savedListsReveal = useFirstSubjectReveal();
  const listSubjectsReveal = useFirstSubjectReveal();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [filter, setFilter] = useState("");
  const [addSubjectsOpen, setAddSubjectsOpen] = useState(false);
  const [studyDialogOpen, setStudyDialogOpen] = useState(false);
  const [sort, setSort] = useState<SortMode>("manual");
  const [deleted, setDeleted] = useState<{ list: SubjectList; index: number } | null>(null);
  const [draggedSubjectId, setDraggedSubjectId] = useState<number | null>(null);
  const [subjectDropTarget, setSubjectDropTarget] = useState<SubjectDropTarget | null>(null);
  const [reorderAnnouncement, setReorderAnnouncement] = useState("");
  const draggedSubjectIdRef = useRef<number | null>(null);

  const resolvedActiveId = activeId && lists.some((list) => list.id === activeId) ? activeId : lists[0]?.id ?? null;
  const refresh = (preferred?: string | null) => {
    const next = repository.load();
    setActiveId(preferred && next.some((list) => list.id === preferred) ? preferred : (activeId && next.some((list) => list.id === activeId) ? activeId : next[0]?.id ?? null));
  };
  const active = lists.find((list) => list.id === resolvedActiveId);
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
  const create = () => {
    if (!newName.trim()) return;
    const created = repository.create(newName);
    setNewName("");
    refresh(created.id);
  };
  const remove = (list: SubjectList, index: number) => {
    repository.remove(list.id);
    setDeleted({ list, index });
    refresh(list.id === resolvedActiveId ? null : resolvedActiveId);
  };
  const undo = () => {
    if (!deleted) return;
    repository.restore(deleted.list, deleted.index);
    refresh(deleted.list.id);
    setDeleted(null);
  };
  const finishSubjectDrag = () => {
    draggedSubjectIdRef.current = null;
    setDraggedSubjectId(null);
    setSubjectDropTarget(null);
  };
  const startSubjectDrag = (event: DragEvent<HTMLSpanElement>, subjectId: number) => {
    draggedSubjectIdRef.current = subjectId;
    setDraggedSubjectId(subjectId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(SUBJECT_DRAG_TYPE, String(subjectId));
    event.dataTransfer.setData("text/plain", String(subjectId));
    const row = event.currentTarget.closest("li");
    if (row) event.dataTransfer.setDragImage?.(row, 24, row.getBoundingClientRect().height / 2);
  };
  const dragOverSubject = (event: DragEvent<HTMLLIElement>, subjectId: number) => {
    if (sort !== "manual" || draggedSubjectIdRef.current === null) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setSubjectDropTarget({ subjectId, edge: subjectDropEdge(event.currentTarget, event.clientY) });
  };
  const dropSubject = (event: DragEvent<HTMLLIElement>, targetSubjectId: number) => {
    event.preventDefault();
    if (!active || sort !== "manual") return finishSubjectDrag();
    const transferredValue = event.dataTransfer.getData(SUBJECT_DRAG_TYPE) || event.dataTransfer.getData("text/plain");
    const transferredId = Number(transferredValue);
    const subjectId = transferredValue && Number.isInteger(transferredId) ? transferredId : draggedSubjectIdRef.current;
    const fromIndex = subjectId === null ? -1 : active.subjectIds.indexOf(subjectId);
    const targetIndex = active.subjectIds.indexOf(targetSubjectId);
    if (subjectId === null || fromIndex < 0 || targetIndex < 0) return finishSubjectDrag();

    const edge = subjectDropEdge(event.currentTarget, event.clientY);
    let toIndex = targetIndex + (edge === "after" ? 1 : 0);
    if (fromIndex < toIndex) toIndex -= 1;
    if (toIndex !== fromIndex) {
      repository.reorderSubject(active.id, subjectId, toIndex);
      refresh(active.id);
      const moved = subjectById.get(subjectId);
      const meaning = moved?.data.meanings.find((item) => item.primary)?.meaning ?? moved?.data.slug ?? "Subject";
      setReorderAnnouncement(`${meaning} moved to position ${toIndex + 1}.`);
    }
    finishSubjectDrag();
  };

  return <main className={`page ${styles.page}`}>
    <header className="page-header"><div><h1>Subject lists</h1><p>Build reusable, account-specific collections that stay in sync with the mobile app.</p></div>{lists.length ? <Badge>{lists.length} {lists.length === 1 ? "list" : "lists"}</Badge> : null}</header>
    {syncError ? <p className={styles.listSyncNotice} role="alert">{syncError} Your browser copy is still available.</p> : null}

    <div className={styles.listsLayout}>
      <aside className={styles.listSidebar}>
        <form className={styles.newListForm} onSubmit={(event) => { event.preventDefault(); create(); }}><label><span>New list</span><span className={styles.newListInput}><input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="e.g. Leech rescue" /><Button type="submit" size="small" tone="primary" disabled={!newName.trim()}><ListPlus size={16} /> Create</Button></span></label></form>
        <nav aria-label="Your subject lists" className={styles.savedLists} {...savedListsReveal}>{lists.map((list, index) => <div key={list.id} data-active={list.id === resolvedActiveId}>
          {renameId === list.id ? <form onSubmit={(event) => { event.preventDefault(); repository.rename(list.id, renameValue); setRenameId(null); refresh(list.id); }} className={styles.renameForm}><input autoFocus value={renameValue} onChange={(event) => setRenameValue(event.target.value)} aria-label={`Rename ${list.name}`} /><Button size="small" type="submit">Save</Button></form> : <button type="button" className={styles.listSelect} onClick={() => setActiveId(list.id)}><span><strong>{list.name}</strong><small>{list.subjectIds.length} {list.subjectIds.length === 1 ? "subject" : "subjects"}</small></span></button>}
          <div className={styles.listActions}><button type="button" aria-label={`Move ${list.name} up`} disabled={index === 0} onClick={() => { repository.reorder(list.id, index - 1); refresh(list.id); }}><ArrowUp size={15} /></button><button type="button" aria-label={`Move ${list.name} down`} disabled={index === lists.length - 1} onClick={() => { repository.reorder(list.id, index + 1); refresh(list.id); }}><ArrowDown size={15} /></button><button type="button" aria-label={`Rename ${list.name}`} onClick={() => { setRenameId(list.id); setRenameValue(list.name); }}><Pencil size={15} /></button><button type="button" aria-label={`Delete ${list.name}`} onClick={() => remove(list, index)}><Trash2 size={15} /></button></div>
        </div>)}</nav>
        {deleted ? <div className={styles.undoNotice} role="status"><span>Deleted “{deleted.list.name}”</span><button type="button" onClick={undo}><Undo2 size={15} /> Undo</button></div> : null}
      </aside>

      <section className={styles.listDetail}>
        {!active ? syncing ? <Skeleton height="12rem" /> : <EmptyState icon={<BookOpenCheck />} title="Create your first list" description="Lists sync to your Kakehashi account and remain available in this browser." /> : <>
          <div className={styles.listDetailHead}><div><h2>{active.name}</h2><p>{active.subjectIds.length} saved {active.subjectIds.length === 1 ? "subject" : "subjects"}</p></div><div className={styles.listDetailActions}><Button type="button" tone="primary" onClick={() => setAddSubjectsOpen(true)}><ListPlus size={16} /> Add subjects</Button><button className={styles.studyLink} type="button" disabled={active.subjectIds.length === 0} onClick={() => setStudyDialogOpen(true)}><Play size={16} /> Study this list</button></div></div>
          <div className={styles.listTools}>
            <label className={styles.compactSearch}><Search size={17} /><span className="sr-only">Filter list</span><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter this list" /></label>
            <label><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}><option value="manual">Manual order</option><option value="level">Level</option><option value="type">Subject type</option><option value="meaning">Meaning</option></select></label>
          </div>
          {isLoading ? <Skeleton height="16rem" /> : visibleSubjects.length ? <ol className={styles.listSubjects} {...listSubjectsReveal}>{visibleSubjects.map((subject) => { const manualIndex = active.subjectIds.indexOf(subject.id); const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.slug; const characters = subject.data.characters ?? meaning; const dropEdge = subjectDropTarget?.subjectId === subject.id ? subjectDropTarget.edge : undefined; return <li key={subject.id} data-subject-id={subject.id} data-dragging={draggedSubjectId === subject.id || undefined} data-drop-edge={dropEdge} onDragOver={(event) => dragOverSubject(event, subject.id)} onDrop={(event) => dropSubject(event, subject.id)}><Link href={`/subjects/${subject.id}`}><SubjectCharacter subject={subject} imageSize="2rem" data-type={subject.object === "kana_vocabulary" ? "vocabulary" : subject.object} data-character-count={Math.min(12, Array.from(characters).length)} /><span><strong>{meaning}</strong><small>{subject.object.replace("_", " ")} · Level {subject.data.level}</small></span></Link><div>{sort === "manual" ? <><span className={styles.subjectDragHandle} draggable aria-hidden title={`Drag ${meaning} to reorder`} onDragStart={(event) => startSubjectDrag(event, subject.id)} onDragEnd={finishSubjectDrag}><GripVertical size={17} aria-hidden /></span><button type="button" disabled={manualIndex === 0} aria-label={`Move ${meaning} up`} onClick={() => { repository.reorderSubject(active.id, subject.id, manualIndex - 1); refresh(active.id); }}><ArrowUp size={15} /></button><button type="button" disabled={manualIndex === active.subjectIds.length - 1} aria-label={`Move ${meaning} down`} onClick={() => { repository.reorderSubject(active.id, subject.id, manualIndex + 1); refresh(active.id); }}><ArrowDown size={15} /></button></> : null}<button type="button" aria-label={`Remove ${meaning}`} onClick={() => { repository.removeSubject(active.id, subject.id); refresh(active.id); }}><X size={15} /></button></div></li>; })}</ol> : <EmptyState title={filter ? "No subjects match" : "This list is empty"} description={filter ? "Clear the filter to see the whole list." : "Choose Add subjects to search the catalog."} />}
          <p className="sr-only" aria-live="polite">{reorderAnnouncement}</p>
          <AddSubjectsDialog open={addSubjectsOpen} listName={active.name} subjectIds={active.subjectIds} subjects={subjects} assignments={assignments} statistics={statistics} onClose={() => setAddSubjectsOpen(false)} onAdd={(subjectId) => { repository.addSubject(active.id, subjectId); refresh(active.id); }} />
          <ListStudyDialog open={studyDialogOpen} listName={active.name} subjectIds={active.subjectIds} subjects={subjects} onClose={() => setStudyDialogOpen(false)} />
        </>}
      </section>
    </div>
  </main>;
}
