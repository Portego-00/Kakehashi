"use client";

import { BookOpen, CalendarCheck2, CalendarClock, CalendarDays, CheckCheck, Flame, Layers3, Snowflake } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { SrsStageIcon } from "@/components/SrsStageIcon";
import type { StudyModeDefinition } from "@/features/study/catalog";
import type { LevelWidgetSubject, SrsStageSpreadRow } from "./dashboard-data";
import type { UsageStreakDay } from "./usage-streak";
import styles from "./dashboard.module.css";

type LevelProgressSummary = Record<"radical" | "kanji" | "vocabulary", { passed: number; total: number }>;

const SRS_GROUPS = [
  { key: "apprentice", label: "Apprentice", stage: 1, stages: [1, 2, 3, 4] },
  { key: "guru", label: "Guru", stage: 5, stages: [5, 6] },
  { key: "master", label: "Master", stage: 7, stages: [7] },
  { key: "enlightened", label: "Enlightened", stage: 8, stages: [8] },
  { key: "burned", label: "Burned", stage: 9, stages: [9] },
] as const;

const PREVIEW_LEVEL_SUBJECTS: LevelWidgetSubject[] = [
  { id: -1, characters: "口", meaning: "Radical", type: "radical", stage: 5 },
  { id: -2, characters: "日", meaning: "Radical", type: "radical", stage: 4 },
  { id: -3, characters: "人", meaning: "Radical", type: "radical", stage: 3 },
  { id: -4, characters: "山", meaning: "Radical", type: "radical", stage: 2 },
  { id: -5, characters: "水", meaning: "Radical", type: "radical", stage: 1 },
  { id: -6, characters: "木", meaning: "Radical", type: "radical", stage: 0 },
  { id: -7, characters: "会", meaning: "Kanji", type: "kanji", stage: 5 },
  { id: -8, characters: "思", meaning: "Kanji", type: "kanji", stage: 4 },
  { id: -9, characters: "家", meaning: "Kanji", type: "kanji", stage: 4 },
  { id: -10, characters: "場", meaning: "Kanji", type: "kanji", stage: 3 },
  { id: -11, characters: "道", meaning: "Kanji", type: "kanji", stage: 3 },
  { id: -12, characters: "新", meaning: "Kanji", type: "kanji", stage: 2 },
  { id: -13, characters: "書", meaning: "Kanji", type: "kanji", stage: 2 },
  { id: -14, characters: "話", meaning: "Kanji", type: "kanji", stage: 1 },
  { id: -15, characters: "読", meaning: "Kanji", type: "kanji", stage: 1 },
  { id: -16, characters: "駅", meaning: "Kanji", type: "kanji", stage: 0 },
  { id: -17, characters: "国", meaning: "Kanji", type: "kanji", stage: 0 },
  { id: -18, characters: "学", meaning: "Kanji", type: "kanji", stage: 0 },
  { id: -19, characters: "校", meaning: "Kanji", type: "kanji", stage: 0 },
  { id: -20, characters: "生", meaning: "Kanji", type: "kanji", stage: 0 },
  { id: -21, characters: "先", meaning: "Kanji", type: "kanji", stage: 0 },
  { id: -22, characters: "年", meaning: "Kanji", type: "kanji", stage: 0 },
  { id: -23, characters: "時", meaning: "Kanji", type: "kanji", stage: 0 },
  { id: -24, characters: "間", meaning: "Kanji", type: "kanji", stage: 0 },
];

function WidgetTitle({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className={styles.nativeWidgetTitle}><div><h2>{title}</h2>{detail ? <p>{detail}</p> : null}</div>{action}</div>;
}

function niceAxisMaximum(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalized = value / magnitude;
  return (normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
}

function groupedSrsRows(rows: SrsStageSpreadRow[]): SrsStageSpreadRow[] {
  return SRS_GROUPS.map((group) => {
    const members = rows.filter((row) => (group.stages as readonly number[]).includes(row.stage));
    const radical = members.reduce((total, row) => total + row.radical, 0);
    const kanji = members.reduce((total, row) => total + row.kanji, 0);
    const vocabulary = members.reduce((total, row) => total + row.vocabulary, 0);
    return { stage: group.stage, label: group.label, roman: group.label, radical, kanji, vocabulary, total: radical + kanji + vocabulary };
  });
}

export function SrsSpreadWidget({ rows, preview = false }: { rows: SrsStageSpreadRow[]; preview?: boolean }) {
  const [grouped, setGrouped] = useState(false);
  const [activeStage, setActiveStage] = useState<number | null>(null);
  const chartRows = useMemo(() => grouped ? groupedSrsRows(rows) : rows, [grouped, rows]);
  const activeRow = chartRows.find((row) => row.stage === activeStage) ?? null;
  const maximum = niceAxisMaximum(Math.max(0, ...chartRows.map((row) => row.total)));
  const actionLabel = grouped ? "Show all nine SRS stages" : "Group the SRS stages";
  const action = preview
    ? <span className={styles.srsGroupControl} aria-hidden><Layers3 size={19} /></span>
    : <button type="button" className={styles.srsGroupControl} aria-label={actionLabel} title={actionLabel} aria-pressed={grouped} onClick={() => { setGrouped((value) => !value); setActiveStage(null); }}><Layers3 size={19} aria-hidden /></button>;
  const chartLabel = chartRows.map((row) => `${row.label}: ${row.total} items — ${row.radical} radicals, ${row.kanji} kanji, ${row.vocabulary} vocabulary`).join("; ");

  return <section className={styles.section}>
    <WidgetTitle title="Active Item Spread" detail="Radicals, kanji, and vocabulary across SRS stages" action={action} />
    <div className={styles.srsChart} aria-label={preview ? "Preview of the active item spread chart" : chartLabel}>
      <div className={styles.srsAxis} aria-hidden>{[maximum, maximum / 2, 0].map((value) => <span key={value}>{preview ? "—" : value.toLocaleString()}</span>)}</div>
      <div className={styles.srsPlot}>
        <div className={styles.srsGridlines}><span /><span /><span /></div>
        <div className={styles.srsBars} data-grouped={grouped || undefined}>
          {chartRows.map((row) => {
            const scale = maximum ? row.total / maximum : 0;
            const detail = `${row.label}: ${row.total} items — ${row.radical} radicals, ${row.kanji} kanji, ${row.vocabulary} vocabulary`;
            return <div className={styles.srsBarColumn} key={`${grouped ? "group" : "stage"}-${row.stage}`} style={{ "--bar-scale": scale } as CSSProperties} tabIndex={preview ? undefined : 0} aria-label={preview ? undefined : detail} title={preview ? undefined : detail} onPointerEnter={() => setActiveStage(row.stage)} onPointerLeave={() => setActiveStage(null)} onFocus={() => setActiveStage(row.stage)} onBlur={() => setActiveStage(null)}>
              <div className={styles.srsBarTrack}>
                <strong className={styles.srsBarValue}>{preview ? "—" : row.total.toLocaleString()}</strong>
                <span className={styles.srsBarStack} aria-hidden>
                  <i data-subject="vocabulary" style={{ flexGrow: row.vocabulary }} />
                  <i data-subject="kanji" style={{ flexGrow: row.kanji }} />
                  <i data-subject="radical" style={{ flexGrow: row.radical }} />
                </span>
              </div>
              <span className={styles.srsStageKey}><SrsStageIcon stage={row.stage} size={26} /><small>{row.roman}</small></span>
            </div>;
          })}
        </div>
      </div>
    </div>
    <p className={styles.srsHoverSummary} aria-live="polite" data-active={Boolean(activeRow) || undefined}>{activeRow && !preview ? <><strong>{activeRow.label}</strong><span>{activeRow.total.toLocaleString()} items · {activeRow.radical} radicals · {activeRow.kanji} kanji · {activeRow.vocabulary} vocabulary</span></> : <span>Hover or focus a bar for its subject breakdown.</span>}</p>
    <div className={styles.srsSubjectLegend} aria-hidden={preview || undefined}><span data-subject="radical">Radicals</span><span data-subject="kanji">Kanji</span><span data-subject="vocabulary">Vocabulary</span></div>
  </section>;
}

function SubjectStageMeter({ meaning, stage }: { meaning: string; stage: number }) {
  const progress = Math.max(0, Math.min(5, stage));
  if (progress >= 5) return <i className={styles.levelSubjectMeter} role="progressbar" aria-label={`${meaning}: Guru reached`} aria-valuemin={0} aria-valuemax={5} aria-valuenow={5}><b data-complete="true" /></i>;
  return <i className={styles.levelSubjectMeter} role="progressbar" aria-label={`${meaning}: ${progress} of 5 stages to Guru`} aria-valuemin={0} aria-valuemax={5} aria-valuenow={progress}>{[1, 2, 3, 4, 5].map((step) => <b key={step} data-filled={step <= progress || undefined} />)}</i>;
}

function LevelSubjectTile({ subject, preview }: { subject: LevelWidgetSubject; preview: boolean }) {
  const status = subject.stage >= 5 ? "passed" : subject.stage > 0 ? "started" : "unstarted";
  const content = <><span className={styles.levelSubjectBlock}><span lang="ja">{subject.characters}</span></span><SubjectStageMeter meaning={subject.meaning} stage={subject.stage} /></>;
  if (preview) return <span className={styles.levelSubjectTile} data-subject={subject.type} data-status={status}>{content}</span>;
  return <Link href={`/subjects/${subject.id}`} className={styles.levelSubjectTile} data-subject={subject.type} data-status={status} title={`${subject.characters} · ${subject.meaning}`}>{content}</Link>;
}

function LevelSubjectStrip({ title, type, subjects, preview }: { title: string; type: "radical" | "kanji"; subjects: LevelWidgetSubject[]; preview: boolean }) {
  const matching = subjects.filter((subject) => subject.type === type);
  if (!matching.length) return null;
  return <div className={styles.levelSubjectStrip}><div className={styles.levelSubjectStripHead}><h3>{title}</h3></div><div className={styles.levelSubjectGrid}>{matching.map((subject) => <LevelSubjectTile subject={subject} preview={preview} key={subject.id} />)}</div></div>;
}

export function DashboardLevelWidget({ currentLevel, progress, subjects, preview = false }: { currentLevel: number; progress: LevelProgressSummary; subjects: LevelWidgetSubject[]; preview?: boolean }) {
  const rows = preview ? PREVIEW_LEVEL_SUBJECTS : subjects;
  const passed = Object.values(progress).reduce((total, row) => total + row.passed, 0);
  const total = Object.values(progress).reduce((count, row) => count + row.total, 0);
  const kanji = progress.kanji;
  const target = Math.ceil(kanji.total * .9);
  const remaining = Math.max(0, target - kanji.passed);
  const segmentCount = preview ? 10 : Math.max(1, target);
  const segmentProgress = preview ? 6 : kanji.passed;

  return <section className={`${styles.section} ${styles.levelWidget}`}>
    <div className={styles.levelWidgetHead}><div><h2>Level {preview ? "—" : currentLevel} Progress</h2><p>{preview ? "Your current level, from lesson to Guru" : `${passed} of ${total} subjects have reached their passing stage.`}</p></div></div>
    <div className={styles.levelGuruBlock}>
      <p><strong>Guru</strong><span>{preview ? "Kanji needed to level up" : remaining === 0 ? "Level threshold reached" : `${remaining} more kanji to level up.`}</span></p>
      <div className={styles.levelGuruSegments} role="progressbar" aria-label={preview ? "Preview of the kanji Guru target" : `${kanji.passed} of ${target} kanji at the passing stage`} aria-valuemin={0} aria-valuemax={preview ? 10 : Math.max(1, target)} aria-valuenow={preview ? undefined : kanji.passed}>{Array.from({ length: segmentCount }, (_, index) => <span key={index} data-passed={index < segmentProgress || undefined} />)}</div>
    </div>
    <LevelSubjectStrip title="Radicals" type="radical" subjects={rows} preview={preview} />
    <LevelSubjectStrip title="Kanji" type="kanji" subjects={rows} preview={preview} />
  </section>;
}

export function AppStreakWidget({ current, longest, days, freezeAvailable = false, freezeDaysUntilReload = 7, loading = false, error = false, preview = false }: { current: number | null; longest: number | null; days: UsageStreakDay[]; freezeAvailable?: boolean; freezeDaysUntilReload?: number; loading?: boolean; error?: boolean; preview?: boolean }) {
  const displayDays = days.length ? days.slice(-7) : Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index - 6);
    return { dayKey: `empty-${index}`, date, label: date.toLocaleDateString(undefined, { weekday: "narrow" }), active: false, isToday: index === 6 };
  });
  const todayActive = Boolean(displayDays.at(-1)?.active);
  const StatusIcon = freezeAvailable ? Snowflake : todayActive ? CalendarCheck2 : CalendarClock;
  const status = loading ? "Loading app-session history" : error ? "App-session history is unavailable" : freezeAvailable ? "Freeze ready" : todayActive ? `Active today · freeze in ${freezeDaysUntilReload} active ${freezeDaysUntilReload === 1 ? "day" : "days"}` : (current ?? 0) > 0 ? "Study today to keep it going" : "Start a new streak today";
  return <section className={`${styles.section} ${styles.streakWidget}`}>
    <div className={styles.streakHead}><h2><Flame size={22} aria-hidden />App Streak</h2><span title="Best recorded app streak">Best {longest === null ? "—" : longest.toLocaleString()}</span></div>
    <div className={styles.streakSummary}><div className={styles.streakValue}><strong>{current === null ? "—" : current.toLocaleString()}</strong><span>日</span></div><p className={styles.streakStatus}><StatusIcon size={17} aria-hidden />{preview ? "Your latest app rhythm" : status}</p></div>
    <div className={styles.streakWeek} aria-label={preview ? "Preview of the seven-day activity row" : "App activity over the last seven days"}>{displayDays.map((day, index) => <span className={styles.streakDay} data-active={day.active || undefined} data-today={day.isToday || undefined} key={`${day.dayKey}-${index}`} title={preview ? undefined : `${day.date.toLocaleDateString()}: ${day.active ? "app opened" : "no app session"}`}><i>{day.active ? <Flame size={16} aria-hidden /> : null}</i><small>{day.label}</small></span>)}</div>
  </section>;
}

export function TodayStudyWidget({ date, lessons, reviews, preview = false }: { date: Date; lessons: number | null; reviews: number | null; preview?: boolean }) {
  const value = (count: number | null) => count === null ? "—" : count.toLocaleString();
  return <section className={`${styles.section} ${styles.todayStudyWidget}`}>
    <div className={styles.todayStudyHead}><span><CalendarDays size={20} aria-hidden /></span><div><h2>Today’s Study</h2><p>{preview ? "Today" : date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</p></div></div>
    <div className={styles.todayStudyMetrics}>
      <div><span><BookOpen size={18} aria-hidden />Lessons</span><strong>{value(lessons)}</strong></div>
      <div><span><CheckCheck size={18} aria-hidden />Reviews</span><strong>{value(reviews)}</strong></div>
    </div>
  </section>;
}

export function StudyModeCard({ mode, preview = false }: { mode: StudyModeDefinition; preview?: boolean }) {
  const Icon = mode.icon;
  const content = <><span className={styles.studyModeIcon} data-mode={mode.id}><Icon size={24} aria-hidden /></span><span className={styles.studyModeCopy}><strong>{mode.title}</strong><small>{mode.description}</small></span></>;
  if (preview) return <span className={styles.studyModeCard} data-accent={mode.accent}>{content}</span>;
  return <Link href={`/study/${mode.id}`} className={styles.studyModeCard} data-accent={mode.accent}>{content}</Link>;
}
