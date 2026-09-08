"use client";

import Link from "next/link";
import { useId, useState, type FormEvent } from "react";
import { FileText, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { Subject } from "@/types/wanikani";
import type { NotebookSentence } from "./model";
import { NotebookCaptureButton } from "./NotebookCaptureDialog";
import { notebookPagesForSubject } from "./study-integration";
import { useNotebooks } from "./use-notebooks";
import styles from "./capture.module.css";

export function SubjectNotebookSection({ subject }: { subject: Subject }) {
  const notebook = useNotebooks();
  const headingId = useId();
  const sentences = notebook.state.sentences.filter((sentence) => sentence.subjectIds.includes(subject.id));
  const pages = notebookPagesForSubject(notebook.state.pages, sentences, subject.id);
  const [editingId, setEditingId] = useState<string | null>(null);
  if (!notebook.available && !notebook.isLoading) return null;

  return <section className={styles.section} aria-labelledby={headingId}>
    <div className={styles.sectionHeader}><h2 id={headingId}>Notebook</h2><NotebookCaptureButton subject={subject} /></div>
    <div className={styles.sectionBody}>
      {notebook.isLoading ? <p className={styles.hint} role="status">Loading notebook…</p> : pages.length ? <ul className={styles.backlinks} aria-label="Notebook pages mentioning this subject">
        {pages.map((page) => <li key={page.id}><Link className={styles.pageLink} href={`/notebooks/${encodeURIComponent(page.id)}`}><FileText size={16} aria-hidden />{page.title || "Untitled"}</Link></li>)}
      </ul> : <p className={styles.hint}>Add this subject to a notebook page to keep your study notes together.</p>}
      {notebook.error ? <p className={styles.error} role="alert">{notebook.error}</p> : null}
      {sentences.length ? <div className={styles.sentenceList}>
        <h3>Your sentences</h3>
        {sentences.map((sentence) => <div key={sentence.id} className={styles.sentence}>
          {editingId === sentence.id ? <SentenceEditor key={sentence.id} sentence={sentence} mutate={notebook.mutate} onClose={() => setEditingId(null)} /> : <>
            <div className={styles.sentenceHeader}><p lang="ja">{sentence.japanese}</p><button type="button" className={styles.iconButton} aria-label={`Edit sentence: ${sentence.japanese}`} onClick={() => setEditingId(sentence.id)}><Pencil size={16} aria-hidden /></button></div>
            {sentence.kana ? <p lang="ja" className={styles.hint}>{sentence.kana}</p> : null}
            <p>{sentence.english}</p>
            <SentenceActions subject={subject} sentence={sentence} mutate={notebook.mutate} />
          </>}
        </div>)}
        <Link className={styles.pageLink} href={`/study/context-sentences?subjectIds=${subject.id}`}>Practice context sentences</Link>
      </div> : null}
    </div>
  </section>;
}

function SentenceActions({ subject, sentence, mutate }: { subject: Subject; sentence: NotebookSentence; mutate: ReturnType<typeof useNotebooks>["mutate"] }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const remove = async () => {
    if (deleting) return;
    setDeleting(true);
    setError("");
    try {
      await mutate({ action: "delete_sentence", sentenceId: sentence.id, expectedRevision: sentence.revision });
      setConfirming(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The sentence could not be deleted. Try again.");
    } finally {
      setDeleting(false);
    }
  };

  return confirming ? <div className={styles.sentenceEditor} role="group" aria-label="Delete sentence confirmation">
    <p className={styles.hint}>Delete this shared sentence from all word cards? This cannot be undone.</p>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <div className={styles.actions}><Button type="button" size="small" disabled={deleting} onClick={() => { setConfirming(false); setError(""); }}>Cancel</Button><Button type="button" size="small" tone="danger" state={deleting ? "loading" : "idle"} onClick={() => void remove()}>Delete sentence permanently</Button></div>
  </div> : <div className={styles.actions}><NotebookCaptureButton subject={subject} sentence={sentence} /><Button type="button" tone="ghost" size="small" onClick={() => setConfirming(true)}><Trash2 size={15} aria-hidden />Delete sentence</Button></div>;
}

function SentenceEditor({ sentence, mutate, onClose }: { sentence: NotebookSentence; mutate: ReturnType<typeof useNotebooks>["mutate"]; onClose: () => void }) {
  const [original] = useState(sentence);
  const [japanese, setJapanese] = useState(sentence.japanese);
  const [kana, setKana] = useState(sentence.kana);
  const [english, setEnglish] = useState(sentence.english);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !japanese.trim()) return;
    setSaving(true);
    setError("");
    try {
      await mutate({ action: "upsert_sentence", sentence: { id: sentence.id, japanese: japanese.trim(), kana: kana.trim(), english: english.trim(), subjectIds: original.subjectIds }, expectedRevision: original.revision });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The sentence could not be saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return <form className={styles.sentenceEditor} onSubmit={(event) => void save(event)}>
    <label className={styles.field}><span>Japanese sentence</span><textarea value={japanese} onChange={(event) => setJapanese(event.target.value)} rows={2} maxLength={2000} lang="ja" required disabled={saving} /></label>
    <label className={styles.field}><span>Kana reading (optional)</span><input value={kana} onChange={(event) => setKana(event.target.value)} maxLength={2000} lang="ja" disabled={saving} /></label>
    <label className={styles.field}><span>English translation (optional)</span><textarea value={english} onChange={(event) => setEnglish(event.target.value)} rows={2} maxLength={4000} disabled={saving} /></label>
    <p className={styles.hint}>Saving updates every notebook page and word card using this sentence.</p>
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <div className={styles.actions}><Button type="button" size="small" disabled={saving} onClick={onClose}>Cancel</Button><Button type="submit" size="small" tone="primary" state={saving ? "loading" : "idle"} disabled={!japanese.trim()}>Save sentence</Button></div>
  </form>;
}
