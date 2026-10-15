"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useSession } from "@/lib/session";
import { waniKaniUserId } from "@/lib/wanikani/user-identity";
import type { BunproLearnContentItem } from "../../../../src/types/bunpro";
import { bunpro } from "./client";
import { bunproStage } from "./progression";
import { BunproReviews } from "./BunproReviews";
import { BUNPRO_PRACTICE_MODES, DEFAULT_PRACTICE_FILTERS, PRACTICE_SRS_GROUPS, buildBunproPracticeQueue, canAccessBunproPractice, filterPracticeGrammar, shuffledPracticeGrammar, type BunproPracticeMode, type BunproPracticeSession, type PracticeFilters, type PracticeGrammar } from "./practice";
import styles from "./practice.module.css";
const noopSubscribe = () => () => {};

function loadFilters(key: string): PracticeFilters {
  try {
    const saved = JSON.parse(window.localStorage.getItem(key) ?? "null");
    if (saved && ["studied", "all", "new"].includes(saved.pool) && Array.isArray(saved.levels) && saved.levels.every((level: unknown) => DEFAULT_PRACTICE_FILTERS.levels.includes(String(level))) && Array.isArray(saved.stages) && saved.stages.every((stage: unknown) => typeof stage === "number" && Number.isInteger(stage) && stage >= 0 && stage <= 12) && typeof saved.query === "string" && saved.query.length <= 100 && [1, 5, 10, 20, 30].includes(saved.size) && [1, 3, 5, 10].includes(saved.sentences)) return saved;
  } catch { /* Use defaults when browser storage is unavailable. */ }
  return DEFAULT_PRACTICE_FILTERS;
}

export function BunproPractice({ mode }: { mode: BunproPracticeMode }) {
  const { user } = useSession();
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!hydrated || !canAccessBunproPractice(user?.data.username)) return null;
  const scope = waniKaniUserId(user) || user?.data.username || "anonymous";
  return <PracticeSetup key={`${scope}:${mode}`} mode={mode} scope={scope} />;
}

function PracticeSetup({ mode, scope }: { mode: BunproPracticeMode; scope: string }) {
  const storageKey = `kakehashi-web:bunpro-practice-filters:${scope}:v2`;
  const [filters, setFilters] = useState(() => loadFilters(storageKey));
  const [session, setSession] = useState<BunproPracticeSession | null>(null);
  const [round, setRound] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const queryClient = useQueryClient();
  const definition = BUNPRO_PRACTICE_MODES.find(item => item.id === mode)!;
  const connection = useQuery({ queryKey: ["bunpro", "connection"], queryFn: ({ signal }) => bunpro<{ connected: boolean }>("action=connection", { signal }), retry: false });
  const catalog = useQuery({ queryKey: ["bunpro", "practice-catalog", scope], queryFn: ({ signal }) => bunpro<{ grammar: PracticeGrammar[] }>("action=practice-catalog", { signal }), enabled: connection.data?.connected === true, retry: false, staleTime: 60_000 });
  const matching = filterPracticeGrammar(catalog.data?.grammar ?? [], filters);
  function updateFilters(update: Partial<PracticeFilters>) {
    const next = { ...filters, ...update };
    setFilters(next); setError("");
    try { window.localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Practice still works without browser storage. */ }
  }
  function toggleStages(stages: readonly number[]) {
    const allSelected = stages.every(stage => filters.stages.includes(stage));
    updateFilters({ stages: allSelected ? filters.stages.filter(stage => !stages.includes(stage)) : [...new Set([...filters.stages, ...stages])].sort((a, b) => a - b) });
  }
  async function start() {
    if (!matching.length || lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice(""); setSession(null);
    try {
      // Shuffle the entire filtered catalog, then refill from it when an item has no suitable sentences.
      const candidates = shuffledPracticeGrammar(matching);
      const contents: BunproLearnContentItem[] = [];
      const wanted = Math.min(filters.size, candidates.length);
      let checked = 0;
      while (contents.length < wanted && checked < Math.min(candidates.length, wanted + 20)) {
        const batch = candidates.slice(checked, checked + Math.min(3, wanted - contents.length));
        checked += batch.length;
        const loaded = await Promise.all(batch.map(item => queryClient.fetchQuery({
          queryKey: ["bunpro", "details", scope, "grammar", item.slug], staleTime: 300_000,
          queryFn: ({ signal }) => bunpro<BunproLearnContentItem>(new URLSearchParams({ action: "details", kind: "grammar", slug: item.slug }).toString(), { signal }),
        })));
        contents.push(...loaded.filter(content => buildBunproPracticeQueue([content], mode, 1).length > 0));
      }
      const items = buildBunproPracticeQueue(contents, mode, filters.sentences);
      if (!items.length) throw new Error(mode === "listening-cloze" ? "No fill-in-the-blank sentences with audio found in this sample. Try again, widen your filters, or try Sentence drill." : "No fill-in-the-blank sentences found in this sample. Try again or widen your filters.");
      if (contents.length < wanted) setNotice(`This round includes ${contents.length} grammar points with suitable sentences. Change your filters for a wider selection.`);
      setRound(value => value + 1); setSession({ mode, items });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not prepare practice. Try again."); }
    finally { lock.current = false; setBusy(false); }
  }
  if (session) return <BunproReviews key={round} practiceSession={session} practiceNotice={notice} onRestartPractice={() => setSession(null)} onPracticeAgain={start} />;
  return <main className={`page ${styles.page}`}>
    <header className={styles.header}><Link href="/study" className={styles.back}><ArrowLeft size={17} />Extra study</Link><h1>{definition.title}</h1><p>{definition.description}</p><p>Every round draws random grammar from your filters, whether it is due or not. Bunpro SRS is unchanged.</p></header>
    {connection.isPending ? <p role="status">Checking Bunpro connection…</p> : connection.error ? <div role="alert"><p>{connection.error.message}</p><Button onClick={() => connection.refetch()}>Retry connection</Button></div> : !connection.data?.connected ? <ButtonLink href="/settings#bunpro-api-key">Add Bunpro API key</ButtonLink> : <section className={styles.selection} aria-labelledby="practice-selection">
      <div className={styles.sectionHeading}><h2 id="practice-selection">Random practice</h2><Button tone="ghost" size="small" disabled={busy || catalog.isFetching} onClick={() => catalog.refetch()}>Refresh progress</Button></div>
      {catalog.isPending ? <p role="status">Loading your grammar and SRS stages…</p> : catalog.error ? <div role="alert"><p>{catalog.error.message}</p><Button onClick={() => catalog.refetch()}>Retry grammar list</Button></div> : <>
        <fieldset className={styles.filters} disabled={busy}>
          <legend className="sr-only">Practice filters</legend>
          <label className={styles.field}>Grammar pool<select value={filters.pool} onChange={event => updateFilters({ pool: event.target.value as PracticeFilters["pool"] })}><option value="studied">Studied grammar</option><option value="all">All grammar, including new</option><option value="new">Not studied yet</option></select></label>
          <fieldset className={styles.choices}><legend>JLPT level</legend><div>{DEFAULT_PRACTICE_FILTERS.levels.map(level => <label key={level}><input type="checkbox" checked={filters.levels.includes(level)} onChange={() => updateFilters({ levels: filters.levels.includes(level) ? filters.levels.filter(value => value !== level) : [...filters.levels, level] })} />{level}</label>)}</div></fieldset>
          {filters.pool !== "new" ? <fieldset className={styles.choices}><legend>SRS stage</legend><div>{PRACTICE_SRS_GROUPS.map(group => <label key={group.label}><input type="checkbox" checked={group.stages.every(stage => filters.stages.includes(stage))} ref={node => { if (node) node.indeterminate = group.stages.some(stage => filters.stages.includes(stage)) && !group.stages.every(stage => filters.stages.includes(stage)); }} onChange={() => toggleStages(group.stages)} />{group.label}</label>)}</div><details><summary>Individual SRS stages</summary><div>{DEFAULT_PRACTICE_FILTERS.stages.map(stage => <label key={stage}><input type="checkbox" checked={filters.stages.includes(stage)} onChange={() => toggleStages([stage])} />{bunproStage({ streak: stage }).label}</label>)}</div></details></fieldset> : null}
          <label className={styles.field}>Grammar or meaning (optional)<input type="search" maxLength={100} placeholder="e.g. ている, want to, because" value={filters.query} onChange={event => updateFilters({ query: event.target.value })} /></label>
          <div className={styles.startRow}><label>Grammar points per round<select value={filters.size} onChange={event => updateFilters({ size: Number(event.target.value) })}>{[1, 5, 10, 20, 30].map(value => <option key={value} value={value}>{value}</option>)}</select></label><label>Sentences per grammar point<select value={filters.sentences} onChange={event => updateFilters({ sentences: Number(event.target.value) })}>{[1, 3, 5, 10].map(value => <option key={value} value={value}>Up to {value}</option>)}</select></label></div>
        </fieldset>
        <div className={styles.startRow}><p role="status">{matching.length} matching grammar points{matching.length ? ` · Randomly pick up to ${Math.min(filters.size, matching.length)} per round` : ". Widen your filters to start."}</p><Button tone="primary" disabled={busy || !matching.length} onClick={start}>{busy ? "Preparing random sentences…" : "Start practice"}</Button><Button tone="ghost" disabled={busy} onClick={() => updateFilters(DEFAULT_PRACTICE_FILTERS)}>Reset filters</Button></div>
      </>}
      {error ? <p role="alert">{error}</p> : null}
    </section>}
  </main>;
}
