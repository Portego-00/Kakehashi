"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { ListPlus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { useSubjectLists } from "../use-subject-lists";
import styles from "../subjects.module.css";

export type SubjectListsState = Pick<
  ReturnType<typeof useSubjectLists>,
  "repository" | "lists" | "syncing" | "syncError"
>;

export interface AddToSubjectListsDialogProps {
  open: boolean;
  subjectId: number;
  subjectLabel: string;
  subjectType: string;
  subjectLists: SubjectListsState;
  onClose: () => void;
}

export function AddToSubjectListsDialog({
  open,
  subjectId,
  subjectLabel,
  subjectType,
  subjectLists,
  onClose,
}: AddToSubjectListsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  return <dialog
    ref={dialogRef}
    className={styles.addToListsDialog}
    aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); onClose(); }}
    onClose={() => { if (open) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
  >
    {open ? <AddToSubjectListsDialogContent
      titleId={titleId}
      subjectId={subjectId}
      subjectLabel={subjectLabel}
      subjectType={subjectType}
      subjectLists={subjectLists}
      onClose={onClose}
    /> : null}
  </dialog>;
}

function AddToSubjectListsDialogContent({
  titleId,
  subjectId,
  subjectLabel,
  subjectType,
  subjectLists,
  onClose,
}: Omit<AddToSubjectListsDialogProps, "open"> & { titleId: string }) {
  const [membershipOverrides, setMembershipOverrides] = useState<Map<string, boolean>>(() => new Map());
  const [pendingLists, setPendingLists] = useState<SubjectListsState["lists"]>([]);
  const [newListName, setNewListName] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  const lists = useMemo(() => {
    const receivedIds = new Set(subjectLists.lists.map((list) => list.id));
    return [...subjectLists.lists, ...pendingLists.filter((list) => !receivedIds.has(list.id))];
  }, [pendingLists, subjectLists.lists]);

  const isSelected = (listId: string, subjectIds: number[]) =>
    membershipOverrides.get(listId) ?? subjectIds.includes(subjectId);

  const toggleList = (listId: string, currentlySelected: boolean) => {
    setMembershipOverrides((current) => {
      const next = new Map(current);
      next.set(listId, !currentlySelected);
      return next;
    });
  };

  const createList = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newListName.trim();
    if (!name || creating || saving) return;

    setCreating(true);
    setActionError("");
    try {
      const created = subjectLists.repository.create(name);
      setPendingLists((current) => [...current, created]);
      setMembershipOverrides((current) => {
        const next = new Map(current);
        next.set(created.id, true);
        return next;
      });
      setNewListName("");
    } catch {
      setActionError("The list could not be created. Try again.");
    } finally {
      setCreating(false);
    }
  };

  const save = () => {
    if (saving) return;
    if (!Number.isInteger(subjectId) || subjectId <= 0) {
      setActionError("No subject was selected.");
      return;
    }

    setSaving(true);
    setActionError("");
    try {
      const timestamp = new Date().toISOString();
      let changed = false;
      const nextLists = subjectLists.repository.load().map((list) => {
        const included = list.subjectIds.includes(subjectId);
        const selected = membershipOverrides.get(list.id) ?? included;
        if (included === selected) return list;
        changed = true;
        return {
          ...list,
          subjectIds: selected
            ? [...list.subjectIds, subjectId]
            : list.subjectIds.filter((id) => id !== subjectId),
          updatedAt: timestamp,
        };
      });
      if (changed) subjectLists.repository.replace(nextLists);
      onClose();
    } catch {
      setActionError("List changes could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const subtitle = [subjectLabel, subjectType ? `(${subjectType})` : ""].filter(Boolean).join(" ") || `Subject #${subjectId}`;
  const loading = subjectLists.syncing && lists.length === 0;

  return <>
    <header className={styles.addDialogHeader}>
      <div><h2 id={titleId}>Add to Lists</h2><p>{subtitle}</p></div>
      <button type="button" aria-label="Close add to lists" disabled={saving} onClick={onClose}><X size={19} aria-hidden /></button>
    </header>

    <form className={styles.addToListsCreateForm} onSubmit={createList}>
      <label>
        <span>New list</span>
        <input
          value={newListName}
          onChange={(event) => setNewListName(event.target.value)}
          placeholder="Create new list"
          autoComplete="off"
          maxLength={60}
          disabled={creating || saving}
        />
      </label>
      <Button type="submit" size="small" disabled={!newListName.trim() || saving} state={creating ? "loading" : "idle"}>
        <ListPlus size={16} aria-hidden /> Create
      </Button>
    </form>

    <div className={styles.addToListsBody}>
      {subjectLists.syncing && lists.length > 0 ? <p className={styles.addToListsState} role="status">Syncing lists…</p> : null}
      {subjectLists.syncError ? <p className={styles.listSyncNotice} role="alert">{subjectLists.syncError} Your browser copy is still available.</p> : null}
      {loading ? <p className={styles.addToListsState} role="status">Loading lists…</p> : lists.length === 0 ? <p className={styles.addToListsState}>No lists yet. Create your first one above.</p> : <fieldset className={styles.addToListsOptions} disabled={saving}>
        <legend className="sr-only">Choose lists for {subjectLabel || `subject ${subjectId}`}</legend>
        {lists.map((list) => {
          const selected = isSelected(list.id, list.subjectIds);
          return <label className={styles.addToListsOption} key={list.id} data-selected={selected || undefined}>
            <span><strong>{list.name}</strong><small>{list.subjectIds.length} {list.subjectIds.length === 1 ? "subject" : "subjects"}</small></span>
            <input type="checkbox" checked={selected} onChange={() => toggleList(list.id, selected)} />
          </label>;
        })}
      </fieldset>}
      {actionError ? <p className={styles.addToListsError} role="alert">{actionError}</p> : null}
    </div>

    <footer className={styles.addToListsFooter}>
      <Button type="button" disabled={saving} onClick={onClose}>Cancel</Button>
      <Button type="button" tone="primary" state={saving ? "loading" : "idle"} onClick={save}>Save</Button>
    </footer>
  </>;
}
