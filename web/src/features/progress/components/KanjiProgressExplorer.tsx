"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Filter, Grid3X3 } from "lucide-react";
import { SrsStageIcon } from "@/components/SrsStageIcon";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState, Skeleton } from "@/components/ui/States";
import { JLPT_KANJI_LISTS } from "../catalogs/jlptKanji";
import { JOYO_KANJI_LISTS } from "../catalogs/joyoKanji";
import { FREQUENCY_KANJI_LISTS } from "../catalogs/frequencyKanji";
import { srsBucketForStage } from "../calculations";
import { useProgressData } from "../data";
import { useFirstProgressReveal } from "../useFirstProgressReveal";
import styles from "../progress.module.css";

type Catalog = "wanikani" | "jlpt" | "joyo" | "frequency";
const CATALOG_LABELS: Record<Catalog, string> = { wanikani: "WaniKani", jlpt: "JLPT", joyo: "Jōyō", frequency: "Frequency" };
const CATALOG_OPTIONS: Record<Exclude<Catalog, "wanikani">, readonly string[]> = {
  jlpt: ["N5", "N4", "N3", "N2", "N1"],
  joyo: ["1", "2", "3", "4", "5", "6", "9"],
  frequency: ["500", "1000", "1500", "2000", "2500"],
};

function catalogCharacters(catalog: Catalog, option: string): readonly string[] | null {
  if (catalog === "jlpt") return JLPT_KANJI_LISTS[option as keyof typeof JLPT_KANJI_LISTS] ?? [];
  if (catalog === "joyo") return JOYO_KANJI_LISTS[option as keyof typeof JOYO_KANJI_LISTS] ?? [];
  if (catalog === "frequency") return FREQUENCY_KANJI_LISTS[option as keyof typeof FREQUENCY_KANJI_LISTS] ?? [];
  return null;
}

export function KanjiProgressExplorer() {
  const { subjects, assignments, isLoading, isError, retry } = useProgressData();
  const firstReveal = useFirstProgressReveal();
  const [isRetrying, setIsRetrying] = useState(false);
  const [catalog, setCatalog] = useState<Catalog>("wanikani");
  const [catalogOption, setCatalogOption] = useState("N5");
  const [level, setLevel] = useState("all");
  const [srs, setSrs] = useState("all");

  const assignmentBySubject = useMemo(() => new Map(assignments.map((assignment) => [assignment.data.subject_id, assignment])), [assignments]);
  const rows = useMemo(() => {
    const allowedCharacters = catalogCharacters(catalog, catalogOption);
    const allowed = allowedCharacters ? new Set(allowedCharacters) : null;
    return subjects
      .filter((subject) => subject.object === "kanji" && subject.data.characters && !subject.data.hidden_at)
      .map((subject) => ({ subject, assignment: assignmentBySubject.get(subject.id), stage: assignmentBySubject.get(subject.id)?.data.srs_stage ?? 0 }))
      .filter(({ subject, stage }) => (!allowed || allowed.has(subject.data.characters ?? "")) && (level === "all" || subject.data.level === Number(level)) && (srs === "all" || srsBucketForStage(stage).toLowerCase() === srs))
      .sort((a, b) => a.subject.data.level - b.subject.data.level || a.subject.id - b.subject.id);
  }, [assignmentBySubject, catalog, catalogOption, level, srs, subjects]);

  const learned = rows.filter((row) => row.stage >= 5).length;

  if (isLoading) return <main className={`page ${styles.page}`} aria-busy="true"><Skeleton height="34rem" /></main>;
  if (isError) return <main className={`page ${styles.page}`}><EmptyState icon={<Grid3X3 />} title="Kanji progress is unavailable" description="WaniKani did not return the data needed for this catalog. Try the request again." action={<Button state={isRetrying ? "loading" : "idle"} onClick={async () => { setIsRetrying(true); try { await retry(); } finally { setIsRetrying(false); } }}>Try again</Button>} /></main>;

  return <main className={`page ${styles.page}`} {...firstReveal}>
    <header className="page-header"><div><Link href="/progress" className={styles.backLink}><ArrowLeft size={16} /> Level progress</Link><h1>Kanji progress</h1><p>Explore your stage across WaniKani, community-estimated JLPT, official Jōyō grade, and frequency catalogs.</p></div><Badge tone="kanji">{learned} of {rows.length} passed</Badge></header>

    <Card className={styles.filterPanel}>
      <div className={styles.sectionTitleRow}><Filter size={18} /><h2>Filters</h2></div>
      <div className={styles.filterGrid}>
        <label><span>Catalog</span><select value={catalog} onChange={(event) => { const next = event.target.value as Catalog; setCatalog(next); if (next !== "wanikani") setCatalogOption(CATALOG_OPTIONS[next][0]); }}><option value="wanikani">WaniKani</option><option value="jlpt">JLPT</option><option value="joyo">Jōyō grade</option><option value="frequency">Frequency</option></select></label>
        {catalog !== "wanikani" ? <label><span>{CATALOG_LABELS[catalog]} group</span><select value={catalogOption} onChange={(event) => setCatalogOption(event.target.value)}>{CATALOG_OPTIONS[catalog].map((option) => <option key={option}>{option}</option>)}</select></label> : null}
        <label><span>WaniKani level</span><select value={level} onChange={(event) => setLevel(event.target.value)}><option value="all">All levels</option>{Array.from({ length: 60 }, (_, index) => index + 1).map((value) => <option value={value} key={value}>Level {value}</option>)}</select></label>
        <label><span>SRS stage</span><select value={srs} onChange={(event) => setSrs(event.target.value)}><option value="all">All stages</option>{["locked", "apprentice", "guru", "master", "enlightened", "burned"].map((value) => <option value={value} key={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}</select></label>
      </div>
    </Card>

    {rows.length > 0 ? <section><div className={styles.gridHead}><div><h2>{CATALOG_LABELS[catalog]} kanji</h2><p>Each cell uses its live SRS stage. Open one for full notes, readings, and context.</p></div><div className={styles.gridLegend}>{["Locked", "Apprentice", "Guru", "Master", "Enlightened", "Burned"].map((value) => <span key={value}>{value === "Locked" ? <i data-srs="locked" /> : <SrsStageIcon level={value} size={18} />}{value}</span>)}</div></div><div className={styles.kanjiGrid}>{rows.map(({ subject, stage }) => <Link key={subject.id} href={`/subjects/${subject.id}`} className={styles.kanjiCell} data-srs={srsBucketForStage(stage).toLowerCase()} title={`${subject.data.characters}: ${subject.data.meanings.find((meaning) => meaning.primary)?.meaning ?? subject.data.slug}; Level ${subject.data.level}; ${srsBucketForStage(stage)}`}><span>{subject.data.characters}</span><small>{subject.data.level}</small></Link>)}</div></section> : <EmptyState icon={<Grid3X3 />} title="No kanji match" description="Broaden the catalog, level, or SRS filter." />}
  </main>;
}
