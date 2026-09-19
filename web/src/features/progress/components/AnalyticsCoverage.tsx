"use client";

import Link from "next/link";
import { useDeferredValue, useId, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowRight, Search, X } from "lucide-react";
import { toHiragana } from "wanakana";
import type { Assignment, Subject } from "@/types/wanikani";
import { analyzeReading, buildCoverageGroups, coverageIndex, type CoverageCatalog, type CoverageEntry } from "../analytics-coverage";
import { downloadAnalyticsFile } from "../analytics-export";
import { srsBucketForStage } from "../calculations";
import { AnalyticsDialog, AnalyticsInfo, EmptyAnalytics, Meter, Metric, Segments, formatNumber, formatPercent } from "./AnalyticsPrimitives";
import shared from "../analytics.module.css";
import styles from "../analytics-coverage.module.css";

interface Props { assignments: Assignment[]; subjects: Subject[]; expanded?: boolean }
const catalogs = [{ value: "jlpt", label: "JLPT" }, { value: "joyo", label: "Joyo" }, { value: "frequency", label: "Frequency" }, { value: "vocabulary", label: "Vocabulary" }] as const;
const stages = ["Locked", "Apprentice", "Guru", "Master", "Enlightened", "Burned"] as const;
const samples = [
  { name: "At the library", text: "学校の近くに新しい図書館ができました。私は毎週土曜日に友達と行きます。日本の歴史の本を読んでから、駅の前で昼ご飯を食べます。今日は雨ですが、午後には晴れるでしょう。" },
  { name: "A weekend trip", text: "来月、友達と京都へ旅行します。朝早く電車に乗って、古いお寺を見に行く予定です。町を歩きながら写真を撮り、夜は小さな店で食事を楽しみたいです。" },
  { name: "A changing city", text: "市は来年、新しい公園を開く計画を発表しました。住民の意見を聞き、子供から高齢者まで利用できる場所を目指しています。自然を守りながら、地域の交流を増やすことが目的です。" },
] as const;
const meaning = (subject: Subject) => subject.data.meanings.find((item) => item.primary)?.meaning ?? subject.data.slug;
const title = (entry: CoverageEntry) => `${entry.character}: ${entry.subject ? `${meaning(entry.subject)}; level ${entry.subject.data.level}; ${srsBucketForStage(entry.stage)}` : "Outside the WaniKani catalog"}`;

function SubjectTiles({ entries, limit = 120 }: { entries: CoverageEntry[]; limit?: number }) {
  const [visible, setVisible] = useState(limit);
  if (entries.some((entry) => entry.subject?.object === "vocabulary" || entry.subject?.object === "kana_vocabulary")) {
    return <><div className={styles.readingList}>{entries.slice(0, visible).map((entry) => entry.subject ? <div className={styles.readingRow} key={entry.subject.id}><Link href={`/subjects/${entry.subject.id}`} className={shared.itemLink}><strong lang="ja">{entry.character}</strong><span>{meaning(entry.subject)}</span></Link><span>{srsBucketForStage(entry.stage)}</span></div> : null)}</div>{entries.length > visible ? <button type="button" className={shared.textButton} onClick={() => setVisible((count) => count + 120)}>Show {Math.min(120, entries.length - visible)} more <ArrowRight size={15} aria-hidden /></button> : null}</>;
  }
  return <><div className={styles.tiles}>{entries.slice(0, visible).map((entry) => entry.subject ? <Link key={entry.subject.id} href={`/subjects/${entry.subject.id}`} className={styles.tile} data-stage={srsBucketForStage(entry.stage).toLowerCase()} title={title(entry)} aria-label={title(entry)}><span lang="ja">{entry.character}</span><small>{entry.subject.data.level}</small></Link> : <span key={entry.character} className={styles.tile} data-stage="outside" title={title(entry)}><span lang="ja">{entry.character}</span><small>—</small></span>)}</div>{entries.length > visible ? <button type="button" className={shared.textButton} onClick={() => setVisible((count) => count + 120)}>Show {Math.min(120, entries.length - visible)} more <ArrowRight size={15} aria-hidden /></button> : null}</>;
}

function Legend() {
  return <ul className={styles.legend} aria-label="SRS stage colors">{stages.map((stage) => <li key={stage}><i data-stage={stage.toLowerCase()} aria-hidden />{stage === "Locked" ? "Not started" : stage}</li>)}</ul>;
}

export function CoverageWidget({ assignments, subjects, expanded = false }: Props) {
  const [catalog, setCatalog] = useState<CoverageCatalog>("jlpt");
  const [threshold, setThreshold] = useState("5");
  const [mode, setMode] = useState("current");
  const [level, setLevel] = useState(30);
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const groups = useMemo(() => buildCoverageGroups(catalog, assignments, subjects, Number(threshold), mode === "preview" ? level : null), [catalog, assignments, subjects, threshold, mode, level]);
  const active = groups.find((group) => group.key === selected);
  const uniqueEntries = useMemo(() => [...new Map(groups.flatMap((group) => group.entries).map((entry) => [entry.subject?.id ?? entry.character, entry])).values()], [groups]);
  const known = uniqueEntries.filter((entry) => mode === "preview" ? entry.subject && entry.subject.data.level <= level : entry.stage >= Number(threshold)).length;
  const filtered = active?.entries.filter((entry) => {
    const known = mode === "preview" ? Boolean(entry.subject && entry.subject.data.level <= level) : entry.stage >= Number(threshold);
    return filter === "all" || (filter === "outside" ? !entry.subject : filter === "known" ? known : !known);
  }) ?? [];
  return <>
    <div className={styles.coverageHeader}>
      <div className={shared.lead}><strong>{formatPercent(uniqueEntries.length ? known / uniqueEntries.length * 100 : null)}</strong><span>{formatNumber(known)} / {formatNumber(uniqueEntries.length)} {catalog === "vocabulary" ? "words" : "kanji"}</span>{catalog === "vocabulary" ? <span>{groups.length} levels</span> : null}</div>
      <Segments label="Coverage catalog" value={catalog} options={catalogs} onChange={(value) => { setCatalog(value); setSelected(null); }} />
    </div>
    <div className={shared.controls}>{mode === "current" ? <Segments label="Known threshold" value={threshold} options={[{ value: "5", label: "Guru+" }, { value: "9", label: "Burned" }]} onChange={setThreshold} /> : <span className={shared.note}>Passed through level {level}</span>}<Segments label="Coverage timeframe" value={mode} options={[{ value: "current", label: "Current" }, { value: "preview", label: "At level" }]} onChange={setMode} /></div>
    {mode === "preview" ? <label className={styles.rangeLabel}>After passing level <strong>{level}</strong><input type="range" min="1" max="60" value={level} onChange={(event) => setLevel(Number(event.target.value))} aria-label="Preview coverage at WaniKani level" /></label> : null}
    <div className={`${styles.coverageRows} ${expanded ? styles.expandedRows : ""}`}>{groups.map((group) => <button type="button" key={group.key} className={styles.coverageRow} onClick={() => { setSelected(group.key); setFilter("all"); }} aria-label={`Browse ${group.label}: ${group.known} of ${group.total}`}><span className={shared.rowHead}><strong>{group.label}</strong><span>{formatNumber(group.known)} / {formatNumber(group.total)} <b>{formatPercent(group.total ? group.known / group.total * 100 : null)}</b><ArrowRight size={14} aria-hidden /></span></span><Meter value={group.known} max={group.total} label={`${group.label} coverage`} tone={mode === "current" && Number(threshold) === 9 ? "burned" : "accent"} /></button>)}</div>
    <AnalyticsInfo label={mode === "preview" ? "Projected coverage" : "About this catalog"}><p>{mode === "preview" ? "Assumes every subject through the selected level is passed. Items outside WaniKani remain unlearned." : catalog === "jlpt" ? "Community JLPT lists; kanji coverage does not measure exam readiness." : catalog === "frequency" ? "Ranked kanji, grouped in bands of 500. These percentages count characters, not text frequency." : catalog === "joyo" ? "Joyo school-grade catalog, including characters outside WaniKani." : "All available WaniKani vocabulary and kana-only vocabulary, grouped by subject level."}</p></AnalyticsInfo>
    {active ? <AnalyticsDialog title={`${catalogs.find((item) => item.value === catalog)?.label} · ${active.label}`} onClose={() => setSelected(null)}><div className={shared.controls}><Segments label="Coverage item filter" value={filter} options={[{ value: "all", label: "All" }, { value: "known", label: "Known" }, { value: "remaining", label: "Remaining" }, { value: "outside", label: "Outside WK" }]} onChange={setFilter} /><span className={shared.note}>{formatNumber(filtered.length)} items · {mode === "preview" ? `after level ${level}; colors show current stages` : "current stages"}</span></div><Legend />{filtered.length ? <SubjectTiles key={`${active.key}-${filter}`} entries={filtered} /> : <EmptyAnalytics>No items in this selection.</EmptyAnalytics>}</AnalyticsDialog> : null}
  </>;
}

export function KanjiWallWidget({ assignments, subjects, expanded = false }: Props) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [level, setLevel] = useState("all");
  const [sort, setSort] = useState("level");
  const deferred = useDeferredValue(query.trim().toLowerCase());
  const index = useMemo(() => coverageIndex(assignments, subjects), [assignments, subjects]);
  const entries = useMemo(() => [...index.kanji].map(([character, subject]) => ({ character, subject, stage: index.stages.get(subject.id) ?? 0 })).filter((entry) => {
    const matchesSearch = !deferred || entry.character.includes(deferred) || entry.subject.data.meanings.some((item) => item.meaning.toLowerCase().includes(deferred)) || entry.subject.data.readings?.some((item) => toHiragana(item.reading).includes(toHiragana(deferred)));
    return matchesSearch && (level === "all" || entry.subject.data.level === Number(level)) && (stage === "all" || srsBucketForStage(entry.stage) === stage);
  }).sort((a, b) => sort === "stage" ? b.stage - a.stage || a.subject.data.level - b.subject.data.level : a.subject.data.level - b.subject.data.level || a.subject.id - b.subject.id), [index, deferred, level, stage, sort]);
  const searchId = useId();
  return <>
    <label className={styles.search} htmlFor={searchId}><Search size={16} aria-hidden /><input id={searchId} type="search" aria-label="Search kanji, meaning or reading" placeholder="Kanji, meaning or reading" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    <div className={shared.controls}><label>Stage<select value={stage} onChange={(event) => setStage(event.target.value)}><option value="all">All stages</option>{stages.map((value) => <option key={value} value={value}>{value === "Locked" ? "Not started" : value}</option>)}</select></label><label>Level<select value={level} onChange={(event) => setLevel(event.target.value)}><option value="all">All levels</option>{Array.from({ length: 60 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}</select></label><label>Sort<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="level">Level</option><option value="stage">SRS stage</option></select></label></div>
    <div className={shared.controls}><span className={shared.note} aria-live="polite">{formatNumber(entries.length)} kanji · {formatNumber(entries.filter((item) => item.stage >= 5).length)} Guru+</span>{query || level !== "all" || stage !== "all" ? <button type="button" className={shared.textButton} onClick={() => { setQuery(""); setLevel("all"); setStage("all"); }}>Reset filters</button> : null}</div>
    <Legend />
    {entries.length ? <SubjectTiles key={`${deferred}-${stage}-${level}-${sort}`} entries={entries} limit={expanded ? 240 : 80} /> : <EmptyAnalytics>No kanji match these filters.</EmptyAnalytics>}
    <Link href="/progress/kanji" className={shared.textButton}>Full catalog <ArrowRight size={15} aria-hidden /></Link>
  </>;
}

export function ReadingCoverageWidget({ assignments, subjects, expanded = false }: Props) {
  const [text, setText] = useState<string>(samples[0].text);
  const [threshold, setThreshold] = useState("5");
  const [preview, setPreview] = useState("current");
  const [level, setLevel] = useState(30);
  const [outside, setOutside] = useState("");
  const [view, setView] = useState("edit");
  const [showAll, setShowAll] = useState(false);
  const deferred = useDeferredValue(text);
  const result = useMemo(() => analyzeReading(deferred, assignments, subjects, Number(threshold), preview === "preview" ? level : null, outside), [deferred, assignments, subjects, threshold, preview, level, outside]);
  const byCharacter = useMemo(() => new Map(result.entries.map((entry) => [entry.character, entry])), [result.entries]);
  const textId = useId();
  const exportUnknown = () => {
    const csv = ["character,occurrences,meaning,wanikani_level", ...result.unknown.map((entry) => [entry.character, entry.count, entry.subject ? meaning(entry.subject) : "Outside WaniKani", entry.subject?.data.level ?? ""].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))].join("\n");
    downloadAnalyticsFile(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }), "kakehashi-reading-kanji.csv");
  };
  return <>
    {result.total > 0 ? <><dl className={styles.readingMetrics}><Metric primary label="Kanji occurrences known" value={formatPercent(result.occurrencePercent)} detail={`${result.known} of ${result.total} occurrences`} /><Metric label="Unique kanji known" value={formatPercent(result.uniquePercent)} detail={`${result.uniqueKnown} of ${result.uniqueTotal} characters`} /></dl><Meter label="Known kanji occurrences" value={result.known} max={result.total} /></> : null}
    <div className={shared.controls}><label>Passage<select aria-label="Reading sample" value={samples.find((sample) => sample.text === text)?.name ?? "custom"} onChange={(event) => { const sample = samples.find((item) => item.name === event.target.value); setText(sample?.text ?? ""); setView("edit"); }}><option value="custom">Your text</option>{samples.map((sample) => <option key={sample.name}>{sample.name}</option>)}</select></label><button type="button" className={shared.iconButton} aria-label="Clear reading text" title="Clear text" onClick={() => { setText(""); setView("edit"); }} disabled={!text}><X size={17} aria-hidden /></button></div>
    {view === "edit" ? <label className={styles.textLabel} htmlFor={textId}>Japanese text<textarea id={textId} lang="ja" value={text} maxLength={10000} rows={expanded ? 5 : 3} placeholder="日本語の文章" onChange={(event) => setText(event.target.value)} /></label> : null}
    <div className={shared.controls}><span className={shared.note}>{formatNumber(text.length)} / 10,000 · analyzed on this device</span>{preview === "current" ? <Segments label="Reading known threshold" value={threshold} options={[{ value: "1", label: "Started" }, { value: "5", label: "Guru+" }, { value: "9", label: "Burned" }]} onChange={setThreshold} /> : <span className={shared.note}>Passed through level {level}</span>}</div>
    <div className={shared.controls}><Segments label="Reading preview" value={preview} options={[{ value: "current", label: "Current" }, { value: "preview", label: "At level" }]} onChange={setPreview} />{preview === "preview" ? <label>Level<input type="number" aria-label="Reading preview level" min="1" max="60" value={level} onChange={(event) => setLevel(Math.min(60, Math.max(1, Number(event.target.value) || 1)))} /></label> : null}</div>
    {preview === "preview" ? <p className={shared.note}>Assumes every subject through level {level} is passed.</p> : null}
    {result.total || result.words.length ? <>
      {!result.total ? <EmptyAnalytics>This passage has no kanji. Kanji coverage is not applicable.</EmptyAnalytics> : null}
      <Segments label="Reading results" value={view} options={[{ value: "edit", label: "Passage" }, { value: "text", label: "Highlighted" }, { value: "unknown", label: `To learn (${result.unknown.length})` }, { value: "words", label: `WK words (${result.words.length})` }]} onChange={setView} />
      {view === "text" ? <><div className={styles.readingText} lang="ja">{[...deferred].map((character, index) => { const entry = byCharacter.get(character); return entry ? entry.subject ? <Link key={index} href={`/subjects/${entry.subject.id}`} data-known={entry.known} data-stage={srsBucketForStage(entry.stage).toLowerCase()} title={`${title(entry)}${entry.external ? "; marked known outside WaniKani" : ""}`}>{character}</Link> : <span key={index} data-known={entry.known} title={entry.external ? "Known outside WaniKani" : "Outside WaniKani"}>{character}</span> : <span key={index}>{character}</span>; })}</div><Legend /></> : null}
      {view === "unknown" ? <><div className={shared.controls}><span className={shared.note}>Most frequent first</span><button type="button" className={shared.textButton} onClick={exportUnknown} disabled={!result.unknown.length}><ArrowDownToLine size={16} aria-hidden />Export CSV</button></div><div className={styles.readingList}>{result.unknown.slice(0, showAll ? undefined : 12).map((entry) => <div className={styles.readingRow} key={entry.character}>{entry.subject ? <Link href={`/subjects/${entry.subject.id}`} className={shared.itemLink}><strong lang="ja">{entry.character}</strong><span>{meaning(entry.subject)}</span></Link> : <span className={shared.itemLink}><strong lang="ja">{entry.character}</strong><span>Outside WaniKani</span></span>}<span>{entry.count}×{entry.subject ? ` · Lv ${entry.subject.data.level}` : ""}</span></div>)}</div>{result.unknown.length > 12 && !showAll ? <button type="button" className={shared.textButton} onClick={() => setShowAll(true)}>Show all {result.unknown.length}</button> : null}{result.total > 0 && result.unknown.length === 0 ? <EmptyAnalytics>Every kanji in this passage meets your selected threshold.</EmptyAnalytics> : null}</> : null}
      {view === "words" ? <><p className={shared.note}>Exact WaniKani words found at Japanese word boundaries. Inflections and words outside the catalog are not counted.</p><div className={styles.readingList}>{result.words.map((entry) => <div className={styles.readingRow} key={entry.word}><Link href={`/subjects/${entry.subject.id}`} className={shared.itemLink}><strong lang="ja">{entry.word}</strong><span>{meaning(entry.subject)}</span></Link><span>{entry.known ? "Known" : "To learn"} · {entry.count}×</span></div>)}</div>{result.words.length === 0 ? <EmptyAnalytics>No exact WaniKani vocabulary matches in this passage.</EmptyAnalytics> : null}</> : null}
    </> : <EmptyAnalytics>{text.trim() ? "This passage has no kanji. Kanji coverage is not applicable." : "No passage selected."}</EmptyAnalytics>}
    <details className={styles.outside}><summary>Kanji learned outside WaniKani</summary><label className={styles.textLabel}>Known characters<input type="text" value={outside} placeholder="漢字" lang="ja" onChange={(event) => setOutside(event.target.value)} maxLength={3000} /></label><p className={shared.note}>Included in this passage analysis. Your WaniKani stages stay unchanged.</p></details>
    <Link href="/news" className={shared.textButton}>Read Japanese news <ArrowRight size={15} aria-hidden /></Link>
  </>;
}
