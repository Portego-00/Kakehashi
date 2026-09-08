"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { BookOpen, Check, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Subject } from "@/types/wanikani";
import type { NotebookBlock } from "./model";
import { useNotebooks } from "./use-notebooks";
import styles from "./capture.module.css";

export interface NotebookCaptureSentence {
  japanese: string;
  english: string;
  kana?: string;
  id?: string;
}

export interface NotebookCaptureDialogProps {
  subject: Subject;
  sentence?: NotebookCaptureSentence;
  open: boolean;
  onClose: () => void;
}

export function NotebookCaptureDialog({ open, onClose, ...props }: NotebookCaptureDialogProps) {
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

  return <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}
    onClose={() => { if (open) onClose(); }}
    onKeyDown={(event) => event.stopPropagation()}
    onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    {open ? <CaptureContent {...props} titleId={titleId} onClose={onClose} /> : null}
  </dialog>;
}

function CaptureContent({ subject, sentence, titleId, onClose }: Omit<NotebookCaptureDialogProps, "open"> & { titleId: string }) {
  const notebook = useNotebooks();
  const [selectedPageId, setSelectedPageId] = useState("");
  const [newPageTitle, setNewPageTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedPage, setSavedPage] = useState<{ id: string; title: string } | null>(null);
  // Keep IDs across a failed request so retry cannot append the same block twice.
  const operationIds = useRef<{ block: string; page: string; sentence: string } | null>(null);
  const savedSentenceId = useRef<string | undefined>(undefined);
  const pages = notebook.state.pages.filter((page) => !page.trashedAt);
  const pageId = selectedPageId || pages[0]?.id || "new";
  const meaning = subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.meanings[0]?.meaning ?? subject.data.slug;
  const label = subject.data.characters || meaning;

  const capture = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || savedPage || !notebook.available || (pageId === "new" && !newPageTitle.trim())) return;
    setSaving(true);
    setError("");
    const ids = operationIds.current ??= { block: crypto.randomUUID(), page: crypto.randomUUID(), sentence: crypto.randomUUID() };
    try {
      let block: NotebookBlock = { id: ids.block, type: "vocabulary", props: { subjectId: subject.id, label } };
      if (sentence) {
        let sentenceId = sentence.id ?? savedSentenceId.current;
        if (!sentenceId) {
          const result = await notebook.mutateResult({
            action: "upsert_sentence",
            sentence: { id: ids.sentence, japanese: sentence.japanese, english: sentence.english, kana: sentence.kana ?? "", subjectIds: [subject.id] },
            expectedRevision: -1,
          });
          sentenceId = result.sentenceId ?? ids.sentence;
          savedSentenceId.current = sentenceId;
        }
        block = { id: ids.block, type: "sentence", props: { sentenceId } };
      }

      const destination = pageId === "new" ? ids.page : pageId;
      const title = pageId === "new" ? newPageTitle.trim() : pages.find((page) => page.id === destination)?.title || "Untitled";
      if (pageId === "new") {
        await notebook.mutate({ action: "create_page", page: { id: destination, title, content: [block] } });
      } else {
        await notebook.mutate({ action: "append_blocks", pageId: destination, blocks: [block] });
      }
      setSavedPage({ id: destination, title });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This could not be added to your notebook. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <header className={styles.dialogHeader}>
      <h2 id={titleId}>{savedPage ? "Added to notebook" : "Add to notebook"}</h2>
      <button className={styles.iconButton} type="button" aria-label="Close notebook capture" onClick={onClose}><X size={19} aria-hidden /></button>
    </header>
    {savedPage ? <div className={styles.body}>
      <p className={styles.success} role="status"><Check size={18} aria-hidden /> Saved in {savedPage.title}.</p>
      <div className={styles.actions}><Button type="button" onClick={onClose}>Done</Button><Link className={styles.pageLink} href={`/notebooks/${encodeURIComponent(savedPage.id)}`} onClick={onClose}>Open page</Link></div>
    </div> : <form className={styles.body} onSubmit={(event) => void capture(event)}>
      <div className={styles.preview}>
        <p lang="ja">{sentence?.japanese ?? label}</p>
        <p>{sentence?.english ?? meaning}</p>
      </div>
      {sentence ? <p className={styles.hint}>This sentence stays connected to the word card and every notebook page that uses it.</p> : null}
      {notebook.isLoading ? <p role="status">Loading notebook…</p> : !notebook.available ? <p role="alert">{notebook.error || "Notebook storage is unavailable. Try again when your account is connected."}</p> : <>
        <label className={styles.field}><span>Page</span><select value={pageId} disabled={saving} onChange={(event) => { setSelectedPageId(event.target.value); operationIds.current = null; }}>
          {pages.map((page) => <option key={page.id} value={page.id}>{page.title || "Untitled"}</option>)}
          <option value="new">Create a new page</option>
        </select></label>
        {pageId === "new" ? <label className={styles.field}><span>Page title</span><input value={newPageTitle} onChange={(event) => setNewPageTitle(event.target.value)} maxLength={200} autoFocus disabled={saving} placeholder="Grammar, reading notes…" /></label> : null}
      </>}
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      <div className={styles.actions}><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" tone="primary" state={saving ? "loading" : "idle"} disabled={notebook.isLoading || !notebook.available || (pageId === "new" && !newPageTitle.trim())}><BookOpen size={16} aria-hidden /> Add to page</Button></div>
    </form>}
  </>;
}

export function NotebookCaptureButton({ subject, sentence, label = "Add to notebook" }: { subject: Subject; sentence?: NotebookCaptureSentence; label?: string }) {
  const [open, setOpen] = useState(false);
  return <><Button type="button" tone="ghost" size="small" onClick={() => setOpen(true)}><BookOpen size={16} aria-hidden />{label}</Button><NotebookCaptureDialog subject={subject} sentence={sentence} open={open} onClose={() => setOpen(false)} /></>;
}
