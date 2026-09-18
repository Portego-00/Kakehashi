"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { LayoutGrid, List } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { SubjectCharacter } from "@/features/subjects/components/SubjectCharacter";
import type { Subject } from "@/types/wanikani";
import styles from "./lesson-picker.module.css";

const types = ["radical", "kanji", "vocabulary"] as const;
const labels = { radical: "Radicals", kanji: "Kanji", vocabulary: "Vocabulary" };
function typeOf(subject: Subject) { return subject.object === "kana_vocabulary" ? "vocabulary" : subject.object; }
function meaningOf(subject: Subject) { return subject.data.meanings.find((meaning) => meaning.primary)?.meaning ?? subject.data.meanings[0]?.meaning ?? subject.data.slug; }

export function LessonPicker({ subjects, limit, batchSize = 5, onStart }: { subjects: Subject[]; limit: number; batchSize?: number; onStart: (ids: number[]) => void }) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [view, setView] = useState<"grid" | "list">("grid");
  const availableIds = useMemo(() => new Set(subjects.map((subject) => subject.id)), [subjects]);
  const selectedIds = [...selected].filter((id) => availableIds.has(id));
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return subjects.filter((subject) => (type === "all" || typeOf(subject) === type) && (!search || [subject.data.characters, ...subject.data.meanings.map((meaning) => meaning.meaning), ...(subject.data.readings ?? []).map((reading) => reading.reading)].some((value) => value?.toLocaleLowerCase().includes(search))));
  }, [subjects, query, type]);
  const levels = [...new Set(filtered.map((subject) => subject.data.level))].sort((a, b) => a - b);
  const toggleGroup = (items: Subject[]) => setSelected((previous) => {
    const next = new Set([...previous].filter((id) => availableIds.has(id)));
    if (items.every((item) => next.has(item.id))) items.forEach((item) => next.delete(item.id));
    else for (const item of items) { if (next.size >= limit) break; next.add(item.id); }
    return next;
  });
  const allSelected = filtered.length > 0 && filtered.every((subject) => selected.has(subject.id));

  return <div className={styles.picker}>
    <header className={styles.header}>
      <div className={styles.heading}><h1>Pick lessons</h1><ButtonLink href="/dashboard" tone="ghost">Cancel</ButtonLink></div>
      <div className={styles.toolbar}>
        <label className={styles.search}>Search lessons<input type="search" placeholder="Meaning, characters, or reading" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label>Subject type<select value={type} onChange={(event) => setType(event.target.value)}><option value="all">All types</option>{types.map((value) => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
        <div className={styles.views} aria-label="Lesson layout"><Button aria-label="Grid view" aria-pressed={view === "grid"} tone="ghost" onClick={() => setView("grid")}><LayoutGrid size={18} /></Button><Button aria-label="List view" aria-pressed={view === "list"} tone="ghost" onClick={() => setView("list")}><List size={18} /></Button></div>
      </div>
      <div className={styles.heading}><p aria-live="polite">{selectedIds.length} selected · {subjects.length} available</p><Button tone="ghost" disabled={!filtered.length || limit === 0} onClick={() => toggleGroup(filtered)}>{allSelected ? "Deselect all" : "Select all"}</Button></div>
    </header>
    {limit === 0 ? <p role="status">You have reached your daily lesson limit.</p> : null}
    {!subjects.length ? <p role="status">No lessons are available right now.</p> : !filtered.length ? <p role="status">No lessons match your search and filters.</p> : levels.map((level) => {
      const items = filtered.filter((subject) => subject.data.level === level);
      return <section key={level} className={styles.level} aria-labelledby={`lesson-level-${level}`}>
        <div className={styles.heading}><h2 id={`lesson-level-${level}`}>Level {level}</h2><Button tone="ghost" disabled={limit === 0} onClick={() => toggleGroup(items)}>{items.every((item) => selected.has(item.id)) ? "Deselect" : "Select"} level {level}</Button></div>
        {types.map((subjectType) => {
          const group = items.filter((subject) => typeOf(subject) === subjectType);
          if (!group.length) return null;
          return <div key={subjectType} className={styles.group}><h3>{labels[subjectType]} <span>{group.length}</span></h3><div className={styles.items} data-view={view}>{group.map((subject) => {
            const checked = selected.has(subject.id);
            const meaning = meaningOf(subject);
            const reading = subject.data.readings?.find((reading) => reading.primary)?.reading ?? subject.data.readings?.[0]?.reading;
            return <button key={subject.id} type="button" className={styles.item} style={{ "--lesson-color": `var(--color-${subjectType})` } as CSSProperties} aria-label={`${subject.data.characters ?? meaning}: ${meaning}`} aria-pressed={checked} disabled={!checked && selectedIds.length >= limit} onClick={() => toggleGroup([subject])}>
              <SubjectCharacter subject={subject} imageSize="2rem" imageTone="subject" className={styles.character} />
              <span className={styles.copy}><strong>{meaning}</strong>{reading ? <span lang="ja">{reading}</span> : null}</span>
              <span className={styles.check} aria-hidden>{checked ? "✓" : ""}</span>
            </button>;
          })}</div></div>;
        })}
      </section>;
    })}
    <footer className={styles.footer}><span aria-live="polite">{Number.isFinite(limit) ? `${Math.min(selectedIds.length, limit)} / ${limit} lessons remaining today selected` : `${selectedIds.length} lessons selected`}{selectedIds.length > batchSize ? ` · ${batchSize} per batch` : ""}</span><Button tone="primary" disabled={!selectedIds.length || selectedIds.length > limit} onClick={() => onStart(selectedIds)}>Start {selectedIds.length || ""} {selectedIds.length === 1 ? "lesson" : "lessons"}</Button></footer>
  </div>;
}
