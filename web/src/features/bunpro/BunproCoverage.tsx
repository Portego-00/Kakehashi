"use client";

import { useId, useRef, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Maximize2, Minimize2, ExternalLink, X, Check } from "lucide-react";
import type { BunproJsonApiResource } from "../../../../src/types/bunpro";
import { ReviewDetailsReveal } from "@/features/study/components/ReviewDetailsReveal";
import { BunproText } from "./BunproText";
import { bunpro } from "./client";
import { sanitizeText } from "./model";
import { coverageItems, coverageStage, coverageStages, type CoverageItem } from "./coverage";
import styles from "./coverage.module.css";

type Reviews = { data: BunproJsonApiResource[] };
const levels = [{ label: "Beginner", streak: 0 }, { label: "Adept", streak: 4 }, { label: "Expert", streak: 10 }, { label: "Master", streak: 12 }];

export function BunproCoverage({ vocabulary, deckId }: { vocabulary: BunproJsonApiResource[]; deckId?: number }) {
  const cache = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [checking, setChecking] = useState<CoverageItem[] | null>(null);
  const ids = vocabulary.map(item => Number(item.attributes.id ?? item.id)).filter(id => Number.isInteger(id) && id > 0);
  const query = useQuery({ queryKey: ["bunpro", "coverage", ids], queryFn: async ({ signal }) => { const result = await bunpro<Reviews>("", { method: "POST", signal, body: JSON.stringify({ action: "coverage", ids }) }); if (!Array.isArray(result?.data)) throw new Error("Vocabulary progress is unavailable."); return result; }, enabled: ids.length > 0, staleTime: 30_000 });
  const items = coverageItems(vocabulary, query.data?.data ?? []);
  const learned = items.filter(item => item.learned);
  const unlearned = items.filter(item => !item.learned);
  const ready = Boolean(query.data);
  const chosen = items.filter(item => selected.includes(item.id));
  const percent = items.length ? Math.round(learned.length / items.length * 100) : 0;
  function toggle(group: CoverageItem[]) {
    const allSelected = group.every(item => selected.includes(item.id));
    setSelected(current => allSelected ? current.filter(id => !group.some(item => item.id === id)) : [...new Set([...current, ...group.map(item => item.id)])]);
  }
  return <section className={styles.coverage} aria-label="Vocab Coverage">
    <header className={styles.header}><div><h3>Vocab Coverage</h3><p>{ready ? `You've covered ${percent}% of this item's Vocab` : query.isError ? "Couldn't load your vocabulary progress." : "Loading your vocabulary progress…"}</p></div>
      <div className={styles.actions}><button type="button" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={19} /> : <Maximize2 size={19} />}{expanded ? "Collapse List" : "Expand List"}</button><button type="button" className={styles.accent} disabled={!ready || !unlearned.length} onClick={() => setChecking(unlearned)}>Knowledge Check</button></div>
    </header>
    {query.isError ? <button type="button" onClick={() => query.refetch()}>Retry progress</button> : null}
    <ReviewDetailsReveal open={!expanded}>
      <div className={styles.progressRow}><div className={styles.progress} role="progressbar" aria-label="Vocabulary covered" aria-valuenow={ready ? learned.length : undefined} aria-valuemin={0} aria-valuemax={items.length} aria-valuetext={ready ? `${learned.length} of ${items.length} vocabulary items learned` : "Loading"} aria-busy={!ready}>
        {coverageStages.map(stage => { const count = learned.filter(item => coverageStage(item.streak).name === stage.name).length; return count ? <span key={stage.name} title={`${stage.name}: ${count}`} style={{ width: `${count / items.length * 100}%`, backgroundColor: stage.color }} /> : null; })}
      </div><span>{ready ? `${learned.length}/${items.length}` : "—"}</span></div>
    </ReviewDetailsReveal>
    <ReviewDetailsReveal open={expanded}>
      <div className={styles.groups}>
        {ready ? <><CoverageGroup title="New to you" items={unlearned} initiallyOpen selected={selected} toggle={toggle} /><CoverageGroup title="Learned items" items={learned} initiallyOpen={false} selected={selected} toggle={toggle} /></> : <p className={styles.loading}>{query.isError ? "Retry loading progress to see your groups." : "Loading vocabulary…"}</p>}
      </div>
      <ReviewDetailsReveal open={selected.length > 0}><div className={styles.selection}><button type="button" onClick={() => setSelected([])}><X size={18} />Stop Selecting</button><span>{selected.length} selected</span><button type="button" onClick={() => setChecking(chosen)}>Knowledge Check</button>{chosen.length === 1 && typeof chosen[0].resource.attributes.slug === "string" ? <a href={`https://bunpro.jp/vocabs/${encodeURIComponent(chosen[0].resource.attributes.slug)}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={17} />Open</a> : null}</div></ReviewDetailsReveal>
    </ReviewDetailsReveal>
    {checking ? <KnowledgeCheck items={checking} deckId={deckId} onClose={() => setChecking(null)} onSaved={() => { setSelected([]); void query.refetch(); for (const key of ["due", "forecast", "lesson-queue"]) void cache.invalidateQueries({ queryKey: ["bunpro", key] }); }} /> : null}
  </section>;
}

function CoverageGroup({ title, items, initiallyOpen, selected, toggle }: { title: string; items: CoverageItem[]; initiallyOpen: boolean; selected: number[]; toggle: (items: CoverageItem[]) => void }) {
  const [open, setOpen] = useState(initiallyOpen);
  const id = useId();
  const checkbox = useRef<HTMLInputElement>(null);
  const checkedCount = items.filter(item => selected.includes(item.id)).length;
  useEffect(() => { if (checkbox.current) checkbox.current.indeterminate = checkedCount > 0 && checkedCount < items.length; }, [checkedCount, items.length]);
  return <div className={styles.group}><div className={styles.groupHeader}><button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}><ChevronRight size={19} className={styles.chevron} data-open={open} /><span><strong>{title}</strong><small>{items.length} items</small></span></button><input ref={checkbox} type="checkbox" aria-label={`Select all ${title.toLowerCase()}`} disabled={!items.length} checked={items.length > 0 && checkedCount === items.length} onChange={() => toggle(items)} /></div>
    <ReviewDetailsReveal open={open}><div id={id} className={styles.grid}>{items.length ? items.map(item => <label key={item.id} className={styles.tile} data-selected={selected.includes(item.id)}><span><span className={styles.word} lang="ja"><strong><BunproText value={item.resource.attributes.kana ? item.resource.attributes.title : item.resource.attributes.furigana || item.resource.attributes.title} /></strong><span><BunproText value={item.resource.attributes.kana} /></span></span><span className={styles.meaning}><BunproText value={item.resource.attributes.meaning} /></span><span className={styles.tag}>{String(item.resource.attributes.level ?? item.resource.attributes.jlpt_level ?? "").replace(/JLPT\s*/i, "").replace(/^([1-5])$/, "N$1")} Vocab</span></span><input type="checkbox" aria-label={`Select ${sanitizeText(item.resource.attributes.title)}`} checked={selected.includes(item.id)} onChange={() => toggle([item])} /></label>) : <p>No items in this group.</p>}</div></ReviewDetailsReveal>
  </div>;
}

function KnowledgeCheck({ items, deckId, onClose, onSaved }: { items: CoverageItem[]; deckId?: number; onClose: () => void; onSaved: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [grades, setGrades] = useState<Record<number, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const item = items[index];
  useEffect(() => { const modal = dialog.current; modal?.showModal(); return () => modal?.close(); }, []);
  function grade(streak?: number) { if (streak !== undefined) setGrades(previous => ({ ...previous, [item.id]: streak })); setRevealed(false); setIndex(previous => previous + 1); }
  async function save() {
    setSaving(true); setError("");
    try {
      // Remove each saved group immediately so retrying a later failure cannot resubmit it.
      for (const level of levels) {
        const ids = Object.entries(grades).filter(([, streak]) => streak === level.streak).map(([id]) => Number(id));
        if (!ids.length) continue;
        await bunpro("", { method: "POST", body: JSON.stringify({ action: "coverage-save", ids, streak: level.streak, deckId }) });
        setGrades(previous => Object.fromEntries(Object.entries(previous).filter(([id]) => !ids.includes(Number(id)))));
      }
      onSaved(); onClose();
    } catch (error) { setError(error instanceof Error ? error.message : "Couldn't save your progress."); onSaved(); }
    finally { setSaving(false); }
  }
  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <header><h2 id={id}>Knowledge Check</h2><button type="button" aria-label="Close knowledge check" disabled={saving} onClick={onClose}><X size={20} /></button></header>
    {item ? <><p className={styles.checkCount}>{index + 1} / {items.length}</p><div className={styles.checkWord} lang="ja"><BunproText value={revealed ? item.resource.attributes.furigana || item.resource.attributes.title : item.resource.attributes.title} /></div><ReviewDetailsReveal open={revealed}><div className={styles.checkMeaning}><BunproText value={item.resource.attributes.meaning} /></div></ReviewDetailsReveal><div className={styles.checkActions}>{revealed ? <><p>How well do you know this word?</p>{levels.map(level => <button key={level.streak} type="button" style={{ background: coverageStage(level.streak).color, color: "white" }} onClick={() => grade(level.streak)}>{level.label}</button>)}</> : <button type="button" className={styles.accent} onClick={() => setRevealed(true)}>Show meaning</button>}<button type="button" onClick={() => grade()}>Skip</button></div></> : <><p>Choose where these words start in Bunpro. Skipped words stay unchanged.</p><div className={styles.results}>{levels.map(level => { const count = Object.values(grades).filter(streak => streak === level.streak).length; return count ? <div key={level.streak}><strong>{level.label}</strong><span>{count} {count === 1 ? "word" : "words"}</span></div> : null; })}</div>{error ? <p role="alert">{error}</p> : null}<div className={styles.actions}><button type="button" disabled={saving} onClick={onClose}>Cancel</button><button type="button" className={styles.accent} disabled={saving} onClick={save}><Check size={18} />{saving ? "Saving…" : "Save progress"}</button></div></>}
  </dialog>;
}
