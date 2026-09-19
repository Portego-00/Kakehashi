"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, Award, BookOpen, CalendarDays, ChartNoAxesColumnIncreasing, CircleAlert, Clock3, Download, Flame, Gauge, Grid2X2, Info, RefreshCw, RotateCcw, Share2, SlidersHorizontal, Target, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/States";
import { useSession } from "@/lib/session";
import { useProgressData } from "../data";
import { useAnalyticsHistory } from "../analytics-history";
import { calculateAnalyticsInsights } from "../analytics-insights";
import { useSrsSnapshots } from "../analytics-snapshots";
import { ANALYTICS_PRESETS, ANALYTICS_WIDGET_CATALOG, createAnalyticsPreset, matchingAnalyticsPreset, normalizeAnalyticsDashboardConfig, type AnalyticsCardId, type AnalyticsDashboardConfig, type AnalyticsPresetId } from "../analytics-layout";
import { analyticsCsv, downloadAnalyticsFile } from "../analytics-export";
import { AnalyticsCustomizer } from "./AnalyticsCustomizer";
import { AnalyticsInfo, Metric, formatNumber, formatPercent } from "./AnalyticsPrimitives";
import { AccuracyWidget, ActivityWidget, AchievementsWidget, BurnsWidget, CurrentLevelWidget, RetentionWidget, SrsWidget, StudyTimeWidget, WorkloadWidget, type AnalyticsWidgetProps } from "./AnalyticsWidgets";
import { CoverageWidget, ReadingCoverageWidget } from "./AnalyticsCoverage";
import { FastestLevelRouteWidget, PromotionScheduleWidget } from "./AnalyticsPromotionSchedule";
import { ItemsWidget } from "./AnalyticsItems";
import { LeechesWidget } from "./AnalyticsLeeches";
import { PaceWidget, ForecastWidget } from "./AnalyticsPlanning";
import { ShareAnalytics } from "./AnalyticsShare";
import { LevelTimingChart } from "./LevelTimingChart";
import { SrsHistoryWidget } from "./AnalyticsSrsHistory";
import { AnalyticsPanel } from "./AnalyticsPanel";
import { AnalyticsGrid } from "./AnalyticsGrid";
import { ProgressTabs } from "./ProgressTabs";
import styles from "../analytics.module.css";
import progressStyles from "../progress.module.css";

const ICONS: Record<AnalyticsCardId, typeof Activity> = { summary: ChartNoAxesColumnIncreasing, pace: TrendingUp, levels: Target, accuracy: Gauge, srs: Flame, coverage: BookOpen, workload: Clock3, forecast: CalendarDays, burns: Flame, achievements: Award, activity: Activity, timing: Clock3, history: CalendarDays, items: Grid2X2, leeches: CircleAlert, retention: Gauge, studyTime: Clock3, reading: BookOpen };

export function AnalyticsDashboard() {
  const progress = useProgressData();
  const { user, isDemo } = useSession();
  const [retrying, setRetrying] = useState(false);
  if (progress.isLoading) return <main className={`page ${progressStyles.page}`} data-compact-workspace aria-busy="true"><ProgressTabs active="analytics" /><div className={styles.grid}>{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} height="18rem" />)}</div></main>;
  if (progress.isError) return <main className={`page ${progressStyles.page}`} data-compact-workspace><ProgressTabs active="analytics" /><div className={progressStyles.errorState}><CircleAlert size={28} aria-hidden /><h1>Analytics are unavailable</h1><p>WaniKani could not return your progress. Try loading it again.</p><Button state={retrying ? "loading" : "idle"} onClick={async () => { setRetrying(true); try { await progress.retry(); } catch { /* The error state remains visible until a successful retry. */ } finally { setRetrying(false); } }}>Try again</Button></div></main>;
  const userId = String(user?.data.id ?? user?.id ?? user?.data.username ?? "anonymous");
  const scope = `${isDemo ? "demo" : "account"}:${userId}`;
  return <AnalyticsDashboardBody key={scope} progress={progress} accountKey={scope} studyTimeKey={userId} username={user?.data.username ?? "Learner"} level={user?.data.level ?? 1} startedAt={user?.data.started_at ?? ""} vacation={Boolean(user?.data.current_vacation_started_at)} />;
}

function AnalyticsDashboardBody({ progress, accountKey, studyTimeKey, username, level, startedAt, vacation }: { progress: ReturnType<typeof useProgressData>; accountKey: string; studyTimeKey: string; username: string; level: number; startedAt: string; vacation: boolean }) {
  const [config, setConfig] = useState<AnalyticsDashboardConfig>(() => createAnalyticsPreset("overview"));
  const [previousConfig, setPreviousConfig] = useState<AnalyticsDashboardConfig | null>(null);
  const [ready, setReady] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [expanded, setExpanded] = useState<AnalyticsCardId | null>(null);
  const [period, setPeriod] = useState("365");
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(() => new Date());
  const [clockTime, setClockTime] = useState(() => new Date());
  const [notice, setNotice] = useState("");
  const [share, setShare] = useState(false);
  const storageKey = `kakehashi:analytics-dashboard:v2:${encodeURIComponent(accountKey)}`;
  const history = useAnalyticsHistory(accountKey, progress.statistics.some((item) => item.data.meaning_correct + item.data.reading_correct + item.data.meaning_incorrect + item.data.reading_incorrect > 0));
  const { assignments, subjects, statistics, progressions } = progress;
  useSrsSnapshots(accountKey, assignments);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = localStorage.getItem(storageKey) ?? localStorage.getItem("kakehashi:analytics-layout:v1");
        if (saved) setConfig(normalizeAnalyticsDashboardConfig(JSON.parse(saved)));
      } catch { setNotice("Browser storage is unavailable. Changes will last for this visit."); }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, [storageKey]);

  useEffect(() => {
    const tick = () => { if (!document.hidden) setClockTime(new Date()); };
    const interval = window.setInterval(tick, 60_000);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", tick); document.removeEventListener("visibilitychange", tick); };
  }, []);

  const saveConfig = (next: AnalyticsDashboardConfig) => {
    setPreviousConfig(config);
    setConfig(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setNotice("Dashboard saved."); }
    catch { setNotice("Layout applied for this visit. Browser storage is unavailable."); }
  };
  const reviewHistoryStartedAt = [history.recordingStartedAt, history.truncatedBefore].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
  const effectiveAsOf = useMemo(() => new Date(Math.max(updatedAt.getTime(), clockTime.getTime(), Date.parse(reviewHistoryStartedAt ?? "") || 0, Date.parse(history.reviews.at(-1)?.data.created_at ?? "") || 0)), [updatedAt, clockTime, reviewHistoryStartedAt, history.reviews]);
  const insights = useMemo(() => calculateAnalyticsInsights({ assignments, subjects, statistics, progressions, reviews: history.reviews, systems: history.systems, reviewHistoryAvailable: history.availability === "available", reviewHistoryStartedAt, currentLevel: level, now: effectiveAsOf, days: period === "all" ? "all" : Number(period) }), [assignments, subjects, statistics, progressions, history.reviews, history.systems, history.availability, reviewHistoryStartedAt, level, period, effectiveAsOf]);
  const props: AnalyticsWidgetProps = { insights, assignments, subjects, statistics, level, asOf: effectiveAsOf };
  const renderWidget = (id: AnalyticsCardId, expanded = false): ReactNode => {
    const full = { ...props, expanded };
    switch (id) {
      case "accuracy": return <AccuracyWidget {...full} />;
      case "srs": return <><SrsWidget {...full} />{expanded ? <SrsHistoryWidget accountKey={accountKey} assignments={assignments} /> : null}</>;
      case "levels": return <><CurrentLevelWidget {...full} />{expanded ? <FastestLevelRouteWidget {...full} systems={history.systems} /> : null}</>;
      case "workload": return <><WorkloadWidget {...full} />{expanded ? <PromotionScheduleWidget {...full} systems={history.systems} /> : null}</>;
      case "activity": return <ActivityWidget {...full} />;
      case "history": return <ActivityWidget {...full} historyOnly />;
      case "burns": return <BurnsWidget {...full} />;
      case "achievements": return <AchievementsWidget {...full} />;
      case "retention": return <RetentionWidget {...full} />;
      case "studyTime": return <StudyTimeWidget accountKey={studyTimeKey} />;
      case "coverage": return <CoverageWidget {...full} />;
      case "reading": return <ReadingCoverageWidget {...full} />;
      case "items": return <ItemsWidget {...full} />;
      case "leeches": return <LeechesWidget insights={insights} subjects={subjects} expanded={expanded} />;
      case "pace": return <PaceWidget {...full} accountKey={accountKey} progressions={progressions} resetCount={progress.resets.length} />;
      case "forecast": return <ForecastWidget {...full} systems={history.systems} systemsLoading={history.isLoading} />;
      case "timing": return <LevelTimingChart timings={insights.levelPace.timings} resetCount={progress.resets.length} />;
      case "summary": return <><dl className={styles.metrics}><Metric label="Lessons in period" value={formatNumber(insights.reviewSummary.lessons)} /><Metric label="Reviews in period" value={insights.reviewSummary.total == null ? "Unavailable" : formatNumber(insights.reviewSummary.total)} /><Metric label="Burns in period" value={formatNumber(insights.burns.inPeriod)} /><Metric label="Lifetime accuracy" value={formatPercent(insights.lifetimeAccuracy.percentage)} /></dl><p className={styles.note}>{history.source === "device" ? `Reviews completed in Kakehashi on this browser since ${new Date(reviewHistoryStartedAt!).toLocaleString()}. Earlier reviews and reviews completed elsewhere are not included.` : insights.reviewSummary.available ? "Review and lesson activity in the selected period." : "WaniKani does not provide past review records. Lesson and burn dates remain available."}</p></>;
    }
  };
  const title = (id: AnalyticsCardId) => ANALYTICS_WIDGET_CATALOG.find((widget) => widget.id === id)!.title;
  const preset = matchingAnalyticsPreset(config);

  return <main className={`page ${progressStyles.page} ${styles.workspace}`} data-compact-workspace>
    <ProgressTabs active="analytics" action={<div className={styles.headerActions}><Button tone="ghost" size="small" onClick={() => setShare(true)}><Share2 size={16} aria-hidden />Share</Button><Button tone="ghost" size="small" onClick={() => setCustomizing(true)}><SlidersHorizontal size={16} aria-hidden />Customize</Button></div>} />
    <section className={styles.overview} aria-label="Analytics overview">
    <div className={styles.toolbar}>
      <div className={`${styles.toolbarActions} ${styles.dashboardFilters}`}><label>Dashboard<select aria-label="Dashboard preset" value={preset ?? "custom"} onChange={(event) => saveConfig(createAnalyticsPreset(event.target.value as AnalyticsPresetId))}>{!preset ? <option value="custom">Custom</option> : null}{ANALYTICS_PRESETS.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label><label>Activity period<select value={period} onChange={(event) => setPeriod(event.target.value)}><option value="30">30 days</option><option value="90">90 days</option><option value="365">Past year</option><option value="all">All time</option></select></label></div>
      <div className={styles.toolbarActions}>{previousConfig ? <button className={styles.iconButton} title="Undo layout change" aria-label="Undo layout change" onClick={() => { const previous = previousConfig; saveConfig(previous); setPreviousConfig(null); }}><RotateCcw size={17} /></button> : null}<button type="button" className={styles.iconButton} aria-label="Export activity CSV" title="Export activity CSV" onClick={() => { downloadAnalyticsFile(analyticsCsv(insights), "kakehashi-activity.csv", "text/csv;charset=utf-8"); setNotice("Activity CSV exported."); }}><Download size={17} /></button><button type="button" className={styles.iconButton} aria-label="Refresh analytics" title="Refresh analytics" disabled={refreshing} onClick={async () => { setRefreshing(true); try { await Promise.all([progress.retry({ throwOnError: true }), history.retry()]); setUpdatedAt(new Date()); setNotice("Analytics refreshed."); } catch { setNotice("Refresh failed. Your last loaded data is still available."); } finally { setRefreshing(false); } }}><RefreshCw size={17} /></button></div>
    </div>
    {vacation ? <div className={styles.notice}><Info size={18} /><p>Vacation mode is active. Review dates and projections may shift when you resume studying.</p></div> : null}
    <dl className={styles.summaryStrip}><Metric label="Current level" value={`${level} / 60`} /><Metric label="Lifetime accuracy" value={formatPercent(insights.lifetimeAccuracy.percentage)} /><Metric label="Reviews due" value={formatNumber(insights.forecast.dueNow)} /><Metric label="Burned items" value={formatNumber(insights.burns.total)} /></dl>
    {history.source === "device" ? <AnalyticsInfo label={history.persistence === "memory" ? "Review history · This visit only" : "Review history · This browser"}><p>Recording began {new Date(reviewHistoryStartedAt!).toLocaleString()}. Earlier reviews and reviews completed elsewhere are not included.{history.persistence === "memory" ? " Browser storage is unavailable, so these records last only for this visit." : ""}{history.truncatedBefore ? " Older device records were removed at the storage limit." : ""}</p></AnalyticsInfo> : null}
    {history.isError ? <div className={styles.notice} role="status"><CircleAlert size={17} /><span>Some history or SRS timing data could not be loaded. Projections may be incomplete.</span><button className={styles.textButton} onClick={() => void history.retry().catch(() => setNotice("History could not be refreshed. Try again shortly."))}>Retry</button></div> : null}
    </section>
    {ready ? <AnalyticsGrid aria-label="Analytics dashboard">{config.cards.map((card) => <AnalyticsPanel key={card.id} card={card} title={title(card.id)} icon={ICONS[card.id]} expanded={expanded === card.id} onExpand={() => setExpanded(card.id)} onClose={() => setExpanded(null)}>{renderWidget(card.id, expanded === card.id)}</AnalyticsPanel>)}</AnalyticsGrid> : <div className={styles.grid} aria-busy="true"><Skeleton height="20rem" /><Skeleton height="20rem" /></div>}
    {ready && !config.cards.length ? <Button onClick={() => setCustomizing(true)}><SlidersHorizontal size={16} />Add widgets</Button> : null}
    <div className={styles.toolbar}><span className={styles.status}>{history.isLoading ? "Loading review history and timing data…" : `Updated ${updatedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`}</span><span className={styles.note}>{config.cards.length} widgets</span></div>
    <p className={`${styles.note} ${styles.announcement}`} role="status">{notice}</p>
    <AnalyticsCustomizer open={customizing} config={config} onApply={(next) => { saveConfig(next); setCustomizing(false); }} onClose={() => setCustomizing(false)} />
    {share ? <ShareAnalytics {...props} username={username} startedAt={startedAt} onClose={() => setShare(false)} /> : null}
  </main>;
}
