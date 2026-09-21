"use client";

import { useState, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { ArrowRight, RefreshCw, Flame, Check } from 'lucide-react';
import { bunpro } from './client';
import { BUNPRO_STAGES, bunproForecast, bunproJlptRows, bunproSeries, bunproTotal, type BunproAnalytics as AnalyticsData, type BunproAnalyticsMode } from './analytics';
import { AnalyticsCartesianChart } from '@/features/progress/components/AnalyticsCharts';
import { BunproStageIcon } from './BunproStageIcon';
import { KnowledgeHoneycomb, ForecastBars, ReviewCalendar } from './BunproCharts';
import { Metric } from '@/features/progress/components/AnalyticsPrimitives';
import { ProgressTabs } from '@/features/progress/components/ProgressTabs';
import { Skeleton } from '@/components/ui/States';
import shared from '@/features/progress/analytics.module.css';
import progress from '@/features/progress/progress.module.css';
import styles from './analytics.module.css';

const SERIES = [
  { key: 'grammar', label: 'Grammar', color: 'var(--color-bunpro)' },
  { key: 'vocab', label: 'Vocabulary', color: 'var(--color-vocabulary)' },
];
const number = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString();

/** Mounted only for the account allowed by the existing Bunpro rollout. */
export function BunproAnalyticsSource({ accountKey, children }: { accountKey: string; children: (navigation: ReactNode) => ReactNode }) {
  const [source, setSource] = useState<'wanikani' | 'bunpro'>('wanikani');
  const connection = useQuery({ queryKey: ['bunpro', 'connection'], queryFn: ({ signal }) => bunpro<{ connected: boolean }>('action=connection', { signal }), staleTime: 30_000, retry: false });
  const connected = connection.data?.connected === true;
  const navigation = connected ? <div className={styles.sources} role="group" aria-label="Analytics source">
    <button type="button" aria-label="WaniKani" aria-pressed={source === 'wanikani'} onClick={() => setSource('wanikani')}>WaniKani<span>Kanji & vocabulary</span></button>
    <button type="button" aria-label="Bunpro" aria-pressed={source === 'bunpro'} onClick={() => setSource('bunpro')}>Bunpro<span>Grammar & vocabulary</span></button>
  </div> : connection.isError ? <p className={shared.notice} role="status">Bunpro connection could not be checked. <button className={shared.textButton} onClick={() => void connection.refetch()}>Retry</button></p> : null;
  const active = connected && source === 'bunpro';
  return <><div className={styles.sourceContent} hidden={active}>{children(navigation)}</div>{active ? <main className={`page ${progress.page} ${shared.workspace} ${styles.sourceEnter}`} data-compact-workspace><ProgressTabs active="analytics" />{navigation}<BunproAnalytics accountKey={accountKey} /></main> : null}</>;
}

function Panel({ title, note, children, wide = false }: { title: string; note?: string; children: ReactNode; wide?: boolean }) {
  const reduced = useReducedMotion();
  return <motion.section layout={reduced ? false : 'position'} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .22, ease: [.2, 0, 0, 1] }} className={`${styles.panel} ${wide ? styles.wide : ''}`} aria-label={title}><header><h2>{title}</h2>{note ? <span>{note}</span> : null}</header>{children}</motion.section>;
}
function StudyTrack({ data, kind }: { data: AnalyticsData; kind: 'grammar' | 'vocab' }) {
  const reduced = useReducedMotion();
  const label = kind === 'grammar' ? 'Grammar' : 'Vocabulary';
  const studied = data.facts?.[kind === 'grammar' ? 'grammar_studied' : 'vocab_studied'];
  const stages = data.srs ? BUNPRO_STAGES.map(stage => ({ ...stage, value: data.srs![kind][stage.key] })) : [];
  const total = stages.reduce((sum, stage) => sum + stage.value, 0);
  const reviews = data.reviewTotals ? Object.values(data.reviewTotals[kind]).reduce((sum, level) => ({ total: sum.total + level.total, correct: sum.correct + level.correct }), { total: 0, correct: 0 }) : null;
  const due = data.due?.[kind === 'grammar' ? 'total_due_grammar' : 'total_due_vocab'];
  if (!data.facts && !data.srs && !data.due) return null;
  return <motion.section layout={reduced ? false : 'position'} initial={reduced ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : .22, ease: [.2, 0, 0, 1] }} className={styles.knowledge} aria-label={`${label} knowledge`} data-kind={kind}>
    <header className={styles.trackHeader}><div><span className={styles.eyebrow}>{kind === 'grammar' ? '文法 · GRAMMAR' : '単語 · VOCABULARY'}</span>{studied != null || data.srs ? <div className={styles.studyCount}><strong>{number(studied ?? total)}</strong><span>{kind === 'grammar' ? 'grammar points studied' : 'words studied'}</span></div> : null}</div>{due != null ? <Link className={styles.dueLink} href={`/bunpro-reviews?mode=${kind}`}><strong>{number(due)}</strong><span>due <ArrowRight size={12} aria-hidden /></span></Link> : null}</header>
    {reviews && reviews.total > 0 ? <div className={styles.retention}><strong>{(reviews.correct / reviews.total * 100).toFixed(1)}<small>%</small></strong><span>review accuracy<br /><small>{number(reviews.correct)} correct / {number(reviews.total)} answers</small></span></div> : null}
    {data.srs ? <><KnowledgeHoneycomb stages={stages} label={`${label} SRS composition`} /><div className={styles.stageRows}>{stages.map(stage => <div key={stage.key}><BunproStageIcon color={stage.color} /><span>{stage.label}</span><span className={styles.stagePercent}>{total ? Math.round(stage.value / total * 100) : 0}%</span><strong>{number(stage.value)}</strong></div>)}</div><div className={styles.footnote}><span>Ghosts <strong>{number(data.srs[kind].ghost)}</strong></span><span>Self-study <strong>{number(data.srs[kind].self_study)}</strong></span></div></> : null}
  </motion.section>;
}
function JlptTrack({ data, kind }: { data: NonNullable<AnalyticsData['jlpt']>; kind: 'grammar' | 'vocab' }) {
  const rows = bunproJlptRows(data, kind).filter(row => row.total > 0);
  if (!rows.length) return null;
  return <Panel title={`${kind === 'grammar' ? 'Grammar' : 'Vocabulary'} · JLPT`} note="Studied / available">
    <div className={styles.jlpt}>{rows.map(row => <div className={styles.jlptRow} key={row.level}><strong>N{row.level}</strong><div><div className={styles.jlptLabel}><span>{number(row.studied)} <span>/ {number(row.total)}</span></span><strong>{row.percent}%</strong></div><div className={styles.track} role="img" aria-label={`N${row.level}: ${row.studied} of ${row.total} studied. ${row.stages.map(stage => `${stage.label}: ${stage.value}`).join(', ')}`}>{row.stages.map(stage => <span key={stage.key} style={{ width: `${stage.value / Math.max(row.total, row.studied) * 100}%`, background: stage.color }} />)}</div></div></div>)}</div>
  </Panel>;
}

export function BunproAnalytics({ accountKey }: { accountKey: string }) {
  const [mode, setMode] = useState<BunproAnalyticsMode>('all');
  const query = useQuery({ queryKey: ['bunpro', 'analytics', accountKey], queryFn: ({ signal }) => bunpro<AnalyticsData>('action=analytics', { signal }), staleTime: 60_000, retry: false });
  if (query.isPending) return <section aria-label="Loading Bunpro analytics" aria-busy="true" className={styles.grid}><Skeleton height="8rem" /><Skeleton height="8rem" /><Skeleton height="20rem" /><Skeleton height="20rem" /></section>;
  if (!query.data) return <section className={styles.empty} role="alert"><h2>Bunpro analytics are unavailable</h2><p>{query.error?.message}</p><button className={shared.textButton} onClick={() => void query.refetch()}>Try again</button> · <Link href="/settings#bunpro-api-key">Bunpro settings</Link></section>;
  const data = query.data;
  const { facts } = data;
  const series = SERIES.filter(item => mode === 'all' || item.key === mode);
  const activity = bunproSeries(data.activity);
  const forecast = bunproForecast(data.forecast);
  const activityTotal = activity.reduce<number | null>((sum, row) => {
    const value = bunproTotal(row.grammar ?? undefined, row.vocab ?? undefined, mode);
    return sum == null || value == null ? null : sum + value;
  }, activity.length ? 0 : null);
  const kinds = (mode === 'all' ? ['grammar', 'vocab'] : [mode]) as ('grammar' | 'vocab')[];
  const studied = facts ? bunproTotal(facts.grammar_studied, facts.vocab_studied, mode) : null;
  const due = data.due ? bunproTotal(data.due.total_due_grammar, data.due.total_due_vocab, mode) : null;
  return <section className={styles.dashboard} aria-label="Bunpro analytics">
    <div className={shared.toolbar}>
      <div className={shared.segments} role="group" aria-label="Bunpro study type">{([['all', 'All study'], ['grammar', 'Grammar'], ['vocab', 'Vocabulary']] as const).map(([key, label]) => <button type="button" key={key} aria-pressed={mode === key} onClick={() => setMode(key)}>{label}</button>)}</div>
      <div className={shared.toolbarActions}><span className={shared.status}>Updated {new Date(query.dataUpdatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span><button type="button" className={shared.iconButton} aria-label="Refresh Bunpro analytics" disabled={query.isFetching} onClick={() => void query.refetch()}><RefreshCw size={17} aria-hidden /></button></div>
    </div>
    {query.isError || data.unavailable.length ? <p className={shared.notice} role="status">{query.isError ? 'Refresh failed. Showing your last loaded statistics.' : 'Some Bunpro statistics are unavailable. The other panels are up to date.'} <button className={shared.textButton} disabled={query.isFetching} onClick={() => void query.refetch()}>Retry</button></p> : null}
    <div className={styles.pulse}>
      {studied != null ? <dl><Metric label="Total studied" value={number(studied)} detail={mode === 'all' ? 'Across both study tracks' : mode === 'grammar' ? 'Grammar points' : 'Vocabulary words'} /></dl> : null}
      {due != null ? <div><dl><Metric label="Ready to review" value={number(due)} /></dl><Link href={`/bunpro-reviews?mode=${mode}`} className={styles.reviewLink}>Review<ArrowRight size={14} aria-hidden /></Link></div> : null}
      {facts ? <section className={styles.streak} aria-label="Study streak"><div><span className={styles.eyebrow}><Flame size={14} aria-hidden /> STUDY STREAK</span><p><strong>{number(facts.streak)}</strong> <span>{facts.streak === 1 ? 'day' : 'days'}</span></p><small>{number(facts.days_studied)} days studied in total</small></div><div className={styles.week} aria-label="Bunpro weekly study activity">{facts.weekly_streak.map((day, index) => {
        const date = new Date(`${day.day}T12:00:00`);
        const valid = Number.isFinite(date.getTime());
        return <div key={`${day.day}-${index}`} data-active={day.val} title={`${day.day}: ${day.val ? 'Studied' : 'Not studied'}`} aria-label={`${day.day}: ${day.val ? 'Studied' : 'Not studied'}`}><span>{valid ? date.toLocaleDateString(undefined, { weekday: 'short' }) : day.day}</span><i>{day.val ? <Check size={16} aria-hidden /> : <span />}</i><b>{valid ? date.getDate() : ''}</b></div>;
      })}</div></section> : null}
    </div>
    <div className={styles.grid}>{kinds.map(kind => <StudyTrack key={kind} data={data} kind={kind} />)}
      {data.jlpt ? kinds.map(kind => <JlptTrack key={kind} data={data.jlpt!} kind={kind} />) : null}
      {data.heatmap && Object.keys(data.heatmap.grammar).length + Object.keys(data.heatmap.vocab).length > 0 ? <Panel title="Review calendar" note="Recorded review activity"><ReviewCalendar data={data.heatmap} mode={mode} endDate={facts?.weekly_streak.at(-1)?.day} />{data.cram && data.cram.sessions.session_count > 0 ? <div className={styles.footnote}><span>Extra practice <strong>{number(data.cram.sessions.session_count)} cram sessions</strong></span><span><strong>{number(data.cram.items.total)}</strong> questions · {data.cram.items.accuracy}% correct</span></div> : null}</Panel> : null}
      {forecast.length > 0 ? <Panel title="Upcoming reviews" note="Scheduled by day"><ForecastBars data={forecast} kinds={kinds} /><p className={shared.note}>New lessons and review results can change this schedule.</p></Panel> : null}
      {activity.length > 0 ? <Panel wide title="Review activity" note={`${activity[0].label} – ${activity.at(-1)!.label}`}><div className={styles.headline}>{activityTotal != null ? <><strong>{number(activityTotal)}</strong><span>reviews in this period</span></> : null}</div><AnalyticsCartesianChart kind="area" label="Bunpro daily review activity" data={activity} series={series} minHeight={190} /></Panel> : null}
    </div>
  </section>;
}
