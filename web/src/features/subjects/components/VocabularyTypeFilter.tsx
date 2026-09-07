"use client";

import { ChevronDown, Search, X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Subject } from "@/types/wanikani";
import { formatVocabularyType, getVocabularyTypeOptions } from "../vocabulary-types";
import styles from "./VocabularyTypeFilter.module.css";

export function VocabularyTypeFilter({ subjects, selected, onChange }: {
  subjects: readonly Subject[];
  selected: readonly string[];
  onChange: (selected: string[]) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const titleId = useId();
  const descriptionId = useId();
  const options = useMemo(() => getVocabularyTypeOptions(subjects, selected), [subjects, selected]);
  const shown = options.filter((option) => option.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const close = () => {
    const dialog = dialogRef.current;
    if (dialog?.close) dialog.close();
    else dialog?.removeAttribute("open");
    triggerRef.current?.focus();
  };

  return <div className={styles.root}>
    <button
      ref={triggerRef}
      type="button"
      className={styles.trigger}
      data-active={selected.length > 0}
      aria-haspopup="dialog"
      aria-label={selected.length ? `Vocab type, ${selected.map(formatVocabularyType).join(", ")}` : "Vocab type"}
      onClick={() => {
        setQuery("");
        const dialog = dialogRef.current;
        if (dialog?.showModal) dialog.showModal();
        else dialog?.setAttribute("open", "");
        searchRef.current?.focus();
      }}
    >
      <span>Vocab type{selected.length ? ` (${selected.length})` : ""}</span>
      <ChevronDown size={15} aria-hidden />
    </button>
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => { event.preventDefault(); event.stopPropagation(); close(); }}
      onClose={(event) => event.stopPropagation()}
      onClick={(event) => { if (event.target === event.currentTarget) close(); }}
    >
      <header className={styles.header}>
        <div><h2 id={titleId}>Vocabulary type</h2><p id={descriptionId}>Match any selected part of speech. None selected shows all types.</p></div>
        <button type="button" aria-label="Close vocabulary types" onClick={close}><X size={18} aria-hidden /></button>
      </header>
      <label className={styles.search}><Search size={16} aria-hidden /><span className="sr-only">Find vocabulary types</span><input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a type…" autoComplete="off" /></label>
      <div className={styles.options} role="group" aria-label="Vocabulary types">
        {shown.map((option) => <label key={option.value} className={styles.option}>
          <input type="checkbox" checked={selected.includes(option.value)} onChange={() => onChange(selected.includes(option.value) ? selected.filter((value) => value !== option.value) : [...selected, option.value])} />
          <span>{option.label}</span>
        </label>)}
        {!shown.length ? <p className={styles.empty}>No matching types.</p> : null}
      </div>
      <footer className={styles.footer}>
        <Button type="button" tone="ghost" size="small" disabled={!selected.length} onClick={() => onChange([])}>Clear types</Button>
        <Button type="button" tone="primary" size="small" onClick={close}>Done</Button>
      </footer>
    </dialog>
  </div>;
}
