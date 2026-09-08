"use client";

import { useDeferredValue, useMemo, useState, type FormEvent } from "react";
import { Check, Search, X } from "lucide-react";
import type { Subject } from "@/types/wanikani";
import type { NotebookSentence } from "./model";
import { subjectLabel, subjectMeaning, subjectReading, type NotebookSentenceInput } from "./editor-schema";
import { findNotebookSubjects } from "./editor-utils";
import NotebookSubjectCatalogStatus, { type NotebookSubjectCatalogProps } from "./NotebookSubjectCatalogStatus";
import styles from "./editor.module.css";

export default function NotebookSentenceForm({ sentence, subjects, subjectsLoading = false, subjectsError, onRetrySubjects, onSave, onCancel, onSavingChange }: {
  sentence?: NotebookSentence;
  subjects: Subject[];
  onSave: (input: NotebookSentenceInput) => Promise<void>;
  onCancel: () => void;
  onSavingChange?: (saving: boolean) => void;
} & NotebookSubjectCatalogProps) {
  // The revision belongs to the text loaded into this form. A background refresh
  // must not silently authorize overwriting somebody else's newer sentence.
  const [originalSentence] = useState(sentence);
  const [japanese, setJapanese] = useState(sentence?.japanese || "");
  const [kana, setKana] = useState(sentence?.kana || "");
  const [english, setEnglish] = useState(sentence?.english || "");
  const [subjectIds, setSubjectIds] = useState(sentence?.subjectIds || []);
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const search = useDeferredValue(query);
  const results = useMemo(() => search.trim() ? findNotebookSubjects(subjects, search, 12, { types: ["kanji", "vocabulary", "kana_vocabulary"] }) : [], [subjects, search]);
  const subjectMap = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects]);

  const toggleSubject = (id: number) => setSubjectIds((current) => current.includes(id) ? current.filter((subjectId) => subjectId !== id) : [...current, id]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!japanese.trim() || saving) return;
    setSaving(true);
    onSavingChange?.(true);
    setError("");
    try {
      await onSave({ id: originalSentence?.id, revision: originalSentence?.revision, japanese: japanese.trim(), kana: kana.trim(), english: english.trim(), subjectIds });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This sentence could not be saved. Please try again.");
      setSaving(false);
      onSavingChange?.(false);
    }
  };

  return <form onSubmit={submit} className={styles.sentenceForm}>
    <fieldset disabled={saving} className={styles.sentenceFields}>
      <label>Japanese sentence<textarea autoFocus required lang="ja" value={japanese} onChange={(event) => setJapanese(event.target.value)} placeholder="今日はいい天気ですね。" rows={3} maxLength={2000} /></label>
      <label>Reading <span className={styles.optional}>Optional</span><input lang="ja" value={kana} onChange={(event) => setKana(event.target.value)} placeholder="きょうはいいてんきですね。" maxLength={2000} /></label>
      <label>Translation <span className={styles.optional}>Optional</span><textarea value={english} onChange={(event) => setEnglish(event.target.value)} placeholder="The weather is lovely today, isn't it?" rows={2} maxLength={4000} /></label>
      <div className={styles.wordAssignment}>
        <label htmlFor="notebook-sentence-word-search">Add to word cards</label>
        <p className={styles.fieldDescription}>Choose the words that will show this sentence in their context examples.</p>
        {subjectIds.length > 0 ? <div className={styles.selectedWords}>{subjectIds.map((id) => {
          const subject = subjectMap.get(id);
          return <button type="button" key={id} onClick={() => toggleSubject(id)} aria-label={`Remove ${subject ? subjectLabel(subject) : `linked word ${id}`}`}><span lang={subject ? "ja" : undefined}>{subject ? subjectLabel(subject) : subjectsLoading ? "Loading word…" : "Linked word"}</span><X size={13} aria-hidden /></button>;
        })}</div> : null}
        <div className={styles.searchField}><Search size={16} aria-hidden /><input id="notebook-sentence-word-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search Japanese, reading, or meaning…" autoComplete="off" /></div>
        {subjectsLoading || subjectsError ? <NotebookSubjectCatalogStatus subjectsLoading={subjectsLoading} subjectsError={subjectsError} onRetrySubjects={onRetrySubjects} rows={search.trim() && !results.length ? 2 : 0} compact /> : null}
        {search.trim() && (results.length || (!subjectsLoading && !subjectsError)) ? <div className={styles.assignmentResults} aria-busy={subjectsLoading || query !== search}>{results.length === 0 ? <p className={styles.emptyResults}>No vocabulary found.</p> : results.map((subject) => <button type="button" key={subject.id} onClick={() => toggleSubject(subject.id)} aria-pressed={subjectIds.includes(subject.id)} className={styles.resultRow}>
          <span className={styles.resultJapanese} lang="ja">{subjectLabel(subject)}</span>
          <span className={styles.resultCopy}><span>{subjectMeaning(subject)}</span><span lang="ja">{subjectReading(subject)}</span></span>
          {subjectIds.includes(subject.id) ? <Check size={16} aria-hidden /> : null}
        </button>)}</div> : null}
      </div>
    </fieldset>
    {sentence ? <p className={styles.sharedNotice}>Your changes update this sentence in every linked notebook page and word card.</p> : null}
    {error ? <p className={styles.error} role="alert">{error}</p> : null}
    <footer className={styles.dialogFooter}>
      <button type="button" className={styles.secondaryButton} onClick={onCancel} disabled={saving}>Cancel</button>
      <button type="submit" className={styles.primaryButton} disabled={saving || !japanese.trim()}>{saving ? "Saving…" : sentence ? "Save changes" : "Add sentence"}</button>
    </footer>
  </form>;
}
