"use client";

import { ArrowRight, ChevronLeft, ChevronRight, Clock3, Gauge } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { calculateAccuracy } from "@/features/progress/calculations";
import type { ReviewStatistic } from "@/types/wanikani";
import type { IncompleteLevelRow } from "./dashboard-data";
import {
  formatStudyTime,
  STUDY_TIME_CATEGORIES,
  STUDY_TIME_RANGES,
  useStudyTimeRange,
  type StudyTimeCategory,
  type StudyTimeRange,
  type StudyTimeRangeId,
} from "./study-time";
import styles from "./dashboard.module.css";

function WidgetHeader({ title, detail, href }: { title: string; detail: string; href?: string }) {
  return <div className={styles.widgetHeader}><div><h2>{title}</h2><p>{detail}</p></div>{href ? <Link className={styles.widgetTextLink} href={href}>Show more <ArrowRight size={15} aria-hidden /></Link> : null}</div>;
}

function percent(correct: number, incorrect: number) {
  const total = correct + incorrect;
  return total ? Math.round((correct / total) * 1_000) / 10 : null;
}

function AccuracyRow({ label, value, correct, total, preview }: { label: string; value: number | null; correct: number; total: number; preview: boolean }) {
  const scale = preview ? .76 : (value ?? 0) / 100;
  return <div className={styles.reviewAccuracyRow}>
    <div><strong>{label}</strong><span>{preview ? "Recorded answers" : `${correct.toLocaleString()} of ${total.toLocaleString()}`}</span></div>
    <strong>{preview || value === null ? "—" : `${value}%`}</strong>
    <div className={styles.reviewAccuracyTrack} role="progressbar" aria-label={`${label} accuracy`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={preview ? undefined : value ?? 0}><span style={{ "--accuracy-scale": scale } as CSSProperties} /></div>
  </div>;
}

export function ReviewStatsWidget({ statistics, preview = false }: { statistics: ReviewStatistic[]; preview?: boolean }) {
  const summary = calculateAccuracy(statistics);
  const attempts = summary.correct + summary.incorrect;
  const meaningTotal = summary.meaningCorrect + summary.meaningIncorrect;
  const readingTotal = summary.readingCorrect + summary.readingIncorrect;
  return <section className={`${styles.section} ${styles.reviewStatsWidget}`}>
    <WidgetHeader title="Review stats" detail="Accuracy across your complete review history" href={preview ? undefined : "/analytics"} />
    <div className={styles.reviewStatsBody}>
      <div className={styles.reviewStatsLead}><span className={styles.reviewGauge}><Gauge size={19} aria-hidden /></span><div><small>Overall</small><strong>{preview || summary.percentage === null ? "—" : `${summary.percentage}%`}</strong><span>{preview ? "Answer accuracy" : `${summary.correct.toLocaleString()} correct · ${attempts.toLocaleString()} attempts`}</span></div></div>
      <div className={styles.reviewStatsDetails}>
        <AccuracyRow label="Meaning" value={percent(summary.meaningCorrect, summary.meaningIncorrect)} correct={summary.meaningCorrect} total={meaningTotal} preview={preview} />
        <AccuracyRow label="Reading" value={percent(summary.readingCorrect, summary.readingIncorrect)} correct={summary.readingCorrect} total={readingTotal} preview={preview} />
      </div>
    </div>
  </section>;
}

const LEVEL_TYPES = [
  { id: "vocabulary", label: "Vocabulary", radius: 45 },
  { id: "kanji", label: "Kanji", radius: 33 },
  { id: "radical", label: "Radicals", radius: 21 },
] as const;

function completion(row: { passed: number; total: number }) {
  return row.total ? Math.round((row.passed / row.total) * 100) : 100;
}

const PREVIEW_LEVELS: IncompleteLevelRow[] = [{
  level: 12,
  passed: 72,
  total: 90,
  radical: { passed: 8, total: 8 },
  kanji: { passed: 24, total: 30 },
  vocabulary: { passed: 40, total: 52 },
}];

export function IncompleteLevelsWidget({ levels, preview = false }: { levels: IncompleteLevelRow[]; preview?: boolean }) {
  const rows = preview ? PREVIEW_LEVELS : levels;
  const [selectedLevel, setSelectedLevel] = useState(() => rows[0]?.level ?? null);
  const [activeType, setActiveType] = useState<(typeof LEVEL_TYPES)[number]["id"] | null>(null);
  const selectedIndex = Math.max(0, rows.findIndex((row) => row.level === selectedLevel));
  const selected = rows[selectedIndex];
  if (!selected) return <section className={styles.section}><WidgetHeader title="Incomplete levels" detail="Previous-level subjects still below Guru" /><p className={styles.emptyCopy}>Every previous level is complete at Guru or above.</p></section>;

  const move = (offset: number) => setSelectedLevel(rows[Math.max(0, Math.min(rows.length - 1, selectedIndex + offset))].level);
  const highlightedType = LEVEL_TYPES.find((type) => type.id === activeType);
  const highlightedCompletion = highlightedType ? completion(selected[highlightedType.id]) : completion({ passed: selected.passed, total: selected.total });
  return <section className={`${styles.section} ${styles.incompleteWidget}`}>
    <WidgetHeader title="Incomplete levels" detail="Passing-stage progress by subject type" />
    <div className={styles.incompleteBody}>
      <div className={styles.incompleteRingWrap}>
        <svg className={styles.incompleteRings} viewBox="0 0 112 112" role="img" aria-label={`Level ${selected.level} completion by subject type`}>
          {LEVEL_TYPES.map((type) => <circle key={`track-${type.id}`} className={styles.incompleteRingTrack} cx="56" cy="56" r={type.radius} />)}
          {LEVEL_TYPES.map((type) => {
            const value = completion(selected[type.id]);
            return <circle key={type.id} className={styles.incompleteRingProgress} data-type={type.id} cx="56" cy="56" r={type.radius} pathLength="100" style={{ "--ring-progress": value } as CSSProperties} tabIndex={preview ? -1 : 0} aria-label={`${type.label}: ${selected[type.id].passed} of ${selected[type.id].total}, ${value}%`} onPointerEnter={() => setActiveType(type.id)} onPointerLeave={() => setActiveType(null)} onFocus={() => setActiveType(type.id)} onBlur={() => setActiveType(null)}><title>{type.label}: {selected[type.id].passed} of {selected[type.id].total} at Guru or above</title></circle>;
          })}
        </svg>
        <span className={styles.incompleteRingCenter}><strong>{highlightedCompletion}%</strong><small>{highlightedType?.label ?? "complete"}</small></span>
      </div>
      <div className={styles.incompleteCopy}>
        <div className={styles.incompleteSwitcher}>
          <button type="button" onClick={() => move(1)} disabled={preview || selectedIndex === rows.length - 1} aria-label="Show lower incomplete level"><ChevronLeft size={18} aria-hidden /></button>
          <span><small>Level</small><strong>{preview ? "—" : selected.level}</strong></span>
          <button type="button" onClick={() => move(-1)} disabled={preview || selectedIndex === 0} aria-label="Show higher incomplete level"><ChevronRight size={18} aria-hidden /></button>
        </div>
        <dl className={styles.incompleteLegend}>{LEVEL_TYPES.map((type) => <div key={type.id} data-type={type.id}><dt>{type.label}</dt><dd>{preview ? "—" : `${selected[type.id].passed} / ${selected[type.id].total}`}<span>{preview ? "" : `${completion(selected[type.id])}%`}</span></dd></div>)}</dl>
        {!preview && rows.length > 1 ? <p>{selectedIndex + 1} of {rows.length} incomplete levels</p> : null}
      </div>
    </div>
  </section>;
}

const PREVIEW_STUDY_VALUES = [0, 0, 12, 54, 18, 3, 2, 8, 29, 26, 20, 3, 18, 4];

function previewStudyRange(): StudyTimeRange {
  const categories = Object.fromEntries(STUDY_TIME_CATEGORIES.map(({ id }) => [id, 0])) as Record<StudyTimeCategory, number>;
  categories["extra-study"] = 44;
  categories.news = 13;
  return {
    summary: { totalSeconds: 57, appTotalSeconds: 57, byCategory: categories },
    chartTitle: "Last 14 weeks",
    series: PREVIEW_STUDY_VALUES.map((totalSeconds, index) => ({
      id: `preview-${index}`,
      label: index === 0 ? "May" : index === PREVIEW_STUDY_VALUES.length - 1 ? "Aug" : "",
      accessibilityLabel: `Preview bucket ${index + 1}`,
      isCurrent: index === PREVIEW_STUDY_VALUES.length - 1,
      totalSeconds,
      appTotalSeconds: totalSeconds,
      byCategory: categories,
    })),
  };
}

export function StudyTimeWidget({ userId, preview = false }: { userId: string; preview?: boolean }) {
  const [range, setRange] = useState<StudyTimeRangeId>("week");
  const live = useStudyTimeRange(userId, range);
  const data = preview ? previewStudyRange() : live;
  const maximum = Math.max(1, ...data.series.map((bucket) => bucket.totalSeconds));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = data.series.find((bucket) => bucket.id === selectedId) ?? data.series.at(-1);
  const activeCategories = useMemo(() => STUDY_TIME_CATEGORIES.filter(({ id }) => data.summary.byCategory[id] > 0).sort((left, right) => data.summary.byCategory[right.id] - data.summary.byCategory[left.id]), [data.summary]);
  return <section className={`${styles.section} ${styles.studyTimeWidget}`}>
    <div className={styles.studyTimeHead}><span><Clock3 size={20} aria-hidden /></span><h2>Study time</h2><strong>{preview ? "—" : formatStudyTime(data.summary.totalSeconds)}</strong></div>
    <div className={styles.studyTimeTabs} role="tablist" aria-label="Study time range">{STUDY_TIME_RANGES.map((item) => <button type="button" role="tab" aria-selected={range === item.id} key={item.id} disabled={preview} onClick={() => { setRange(item.id); setSelectedId(null); }}>{item.label}</button>)}</div>
    <div className={styles.studyChartHead}><span>{data.chartTitle}{preview ? "" : " · All devices"}</span><strong>{selected && !preview ? `${selected.accessibilityLabel} · ${formatStudyTime(selected.totalSeconds)}` : "Hover a bar for details"}</strong></div>
    <div className={styles.studyChart}>{data.series.map((bucket) => <button type="button" key={bucket.id} className={styles.studyChartColumn} data-current={bucket.isCurrent || undefined} aria-label={`${bucket.accessibilityLabel}: ${formatStudyTime(bucket.totalSeconds)}`} disabled={preview} onPointerEnter={() => setSelectedId(bucket.id)} onPointerLeave={() => setSelectedId(null)} onFocus={() => setSelectedId(bucket.id)} onBlur={() => setSelectedId(null)}><span className={styles.studyChartSlot}><i data-empty={bucket.totalSeconds === 0 || undefined} style={{ "--study-scale": bucket.totalSeconds / maximum } as CSSProperties} /></span><small>{bucket.label}</small></button>)}</div>
    {activeCategories.length ? <><div className={styles.studyCategoryBar} aria-label="Study time by category">{activeCategories.map(({ id }) => <span key={id} data-category={id} style={{ flexGrow: data.summary.byCategory[id] }} title={`${STUDY_TIME_CATEGORIES.find((item) => item.id === id)?.label}: ${formatStudyTime(data.summary.byCategory[id])}`} />)}</div><dl className={styles.studyCategoryLegend}>{activeCategories.map(({ id, label }) => <div key={id} data-category={id}><dt>{label}</dt><dd>{preview ? "—" : formatStudyTime(data.summary.byCategory[id])}</dd></div>)}</dl></> : <p className={styles.emptyCopy}>Combined study activity from your synced devices will appear here as you use reviews, lessons, extra study, news, songs, reading, and video.</p>}
  </section>;
}
