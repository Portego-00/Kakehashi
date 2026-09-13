"use client";

import { useDeferredValue, useMemo, useRef, useState } from "react";
import { Plus, Search, X } from "lucide-react";
import type { Subject, SubjectType } from "@/types/wanikani";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import { findNotebookSubjects } from "./editor-utils";
import NotebookSubjectCatalogStatus, { type NotebookSubjectCatalogProps } from "./NotebookSubjectCatalogStatus";
import styles from "./subject-picker.module.css";

const FILTERS: { value: SubjectType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "radical", label: "Radicals" },
  { value: "kanji", label: "Kanji" },
  { value: "vocabulary", label: "Vocabulary" },
  { value: "kana_vocabulary", label: "Kana vocabulary" },
];
const TYPE_LABELS: Record<SubjectType, string> = { radical: "Radical", kanji: "Kanji", vocabulary: "Vocabulary", kana_vocabulary: "Kana vocabulary" };
const RESULT_LIMIT = 40;

/** The subject chooser content fits inside the editor's existing modal. */
export default function NotebookSubjectPicker({ subjects, subjectsLoading = false, subjectsError, onRetrySubjects, initialInline = false, onSelect }: {
  subjects: Subject[];
  initialInline?: boolean;
  onSelect: (subject: Subject, inline: boolean) => void;
} & NotebookSubjectCatalogProps) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [type, setType] = useState<SubjectType | "all">("all");
  const [inline, setInline] = useState(initialInline);
  const search = useDeferredValue(query);
  const results = useMemo(() => findNotebookSubjects(subjects, search, RESULT_LIMIT + 1, type === "all" ? undefined : { types: [type] }), [subjects, search, type]);
  const visible = results.slice(0, RESULT_LIMIT);

  return <div className={styles.picker}>
    <div className={styles.controls}>
      <label className={styles.search}>
        <Search size={18} aria-hidden />
        <span className="sr-only">Search subjects</span>
        <input ref={searchRef} autoFocus aria-label="Search subjects" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Japanese, reading, or meaning…" autoComplete="off" spellCheck={false} />
        {query ? <button type="button" aria-label="Clear subject search" onClick={() => { setQuery(""); searchRef.current?.focus(); }}><X size={16} aria-hidden /></button> : null}
      </label>
      <div className={styles.filters} role="group" aria-label="Subject type">
        {FILTERS.map((filter) => <button key={filter.value} type="button" data-type={filter.value} aria-pressed={type === filter.value} onClick={() => setType(filter.value)}>{filter.label}</button>)}
      </div>
      <label className={styles.inlineOption}><input type="checkbox" checked={inline} onChange={(event) => setInline(event.target.checked)} />Insert within the text</label>
    </div>
    {visible.length || (!subjectsLoading && !subjectsError) ? <p className={styles.resultCount} role="status">{results.length > RESULT_LIMIT ? `First ${RESULT_LIMIT} matches` : `${visible.length} ${visible.length === 1 ? "match" : "matches"}`}</p> : null}
    <div className={styles.results} aria-label="Matching subjects" aria-busy={subjectsLoading || query !== search}>
      <NotebookSubjectCatalogStatus subjectsLoading={subjectsLoading} subjectsError={subjectsError} onRetrySubjects={onRetrySubjects} rows={visible.length ? 0 : 4} loadingLabel={subjects.length ? "Updating subjects…" : "Loading subjects…"} />
      {visible.map((subject) => {
        const meaning = subject.data.meanings.find((entry) => entry.primary)?.meaning ?? subject.data.meanings[0]?.meaning ?? subject.data.slug;
        const label = subject.data.characters || meaning;
        const readings = subject.data.readings?.filter((entry) => entry.primary).map((entry) => entry.reading).join(" · ") || subject.data.readings?.slice(0, 2).map((entry) => entry.reading).join(" · ");
        return <button key={subject.id} className={styles.result} data-type={subject.object} type="button" aria-label={`Link ${TYPE_LABELS[subject.object].toLocaleLowerCase()}: ${label}, ${meaning}`} onClick={() => onSelect(subject, inline)}>
          <SubjectCharacter subject={subject} fallbackText={meaning.slice(0, 2)} imageSize="2rem" className={styles.character} data-length={Math.min(Array.from(label).length, 12)} title={label} aria-hidden />
          <span className={styles.copy}><span className={styles.meta}>{TYPE_LABELS[subject.object]}<span aria-hidden>·</span>Level {subject.data.level}</span><strong>{meaning}</strong>{readings ? <span className={styles.reading} lang="ja">{readings}</span> : null}</span>
          <Plus size={17} className={styles.add} aria-hidden />
        </button>;
      })}
      {!visible.length && !subjectsLoading && !subjectsError ? <div className={styles.empty}><p>No subjects found.</p><span>Try a Japanese character, reading, or English meaning.</span>{type !== "all" ? <button type="button" onClick={() => setType("all")}>Search all subject types</button> : null}</div> : null}
    </div>
  </div>;
}
