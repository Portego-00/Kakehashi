"use client";

import { Activity, CalendarDays, Check, ChevronDown, ChevronUp, CircleAlert, Flame, Gauge, GripVertical, Maximize2, Minimize2, RotateCcw, SlidersHorizontal, TimerReset } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ReviewActivityHeatmap } from "@/components/ReviewActivityHeatmap";
import { Skeleton } from "@/components/ui/States";
import { SrsStageIcon } from "@/components/SrsStageIcon";
import { useProgressData } from "../data";
import {
  calculateAccuracy,
  calculateApproximateActivity,
  calculateForecast,
  calculateLevelTimings,
  calculateSrsBreakdown,
  summarizeLevelTimings,
  type ActivityDay,
  type LevelTiming,
} from "../calculations";
import { useFirstProgressReveal } from "../useFirstProgressReveal";
import { DEFAULT_ANALYTICS_LAYOUT, moveAnalyticsCard, moveAnalyticsCardBy, normalizeAnalyticsLayout, toggleAnalyticsCardSize, type AnalyticsCardId, type AnalyticsCardLayout } from "../analytics-layout";
import { ProgressTabs } from "./ProgressTabs";
import styles from "../progress.module.css";

const SRS_ORDER = ["Apprentice", "Guru", "Master", "Enlightened", "Burned"] as const;
const LAYOUT_STORAGE_KEY = "kakehashi:analytics-layout:v1";
const CARD_LABELS: Record<AnalyticsCardId, string> = { accuracy: "Review accuracy", srs: "SRS distribution", forecast: "Seven-day forecast", activity: "Recent activity", timing: "Level timing" };

function percent(correct: number, incorrect: number) {
  const total = correct + incorrect;
  return total > 0 ? Math.round((correct / total) * 1000) / 10 : null;
}

export function AnalyticsOverview() {
  const { assignments, statistics, progressions, resets, isLoading, isError, retry } = useProgressData();
  const firstReveal = useFirstProgressReveal();
  const [layout, setLayout] = useState<AnalyticsCardLayout[]>(DEFAULT_ANALYTICS_LAYOUT);
  const [layoutReady, setLayoutReady] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [draggedCard, setDraggedCard] = useState<AnalyticsCardId | null>(null);
  const [dragTarget, setDragTarget] = useState<AnalyticsCardId | null>(null);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
        if (saved) setLayout(normalizeAnalyticsLayout(JSON.parse(saved)));
      } catch {
        setLayout(DEFAULT_ANALYTICS_LAYOUT);
      }
      setLayoutReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!layoutReady) return;
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // The dashboard remains usable when browser storage is unavailable.
    }
  }, [layout, layoutReady]);

  if (isLoading) return <AnalyticsSkeleton />;
  if (isError) return <AnalyticsError retry={retry} />;

  const accuracy = calculateAccuracy(statistics);
  const meaningAccuracy = percent(accuracy.meaningCorrect, accuracy.meaningIncorrect);
  const readingAccuracy = percent(accuracy.readingCorrect, accuracy.readingIncorrect);
  const srs = calculateSrsBreakdown(assignments);
  const srsTotal = SRS_ORDER.reduce((sum, key) => sum + srs[key], 0);
  const forecast = calculateForecast(assignments);
  const forecastMax = Math.max(1, ...forecast.map((bucket) => bucket.count));
  const activity = calculateApproximateActivity(assignments);
  const activityHistory = calculateApproximateActivity(assignments, new Date(), "all");
  const timings = calculateLevelTimings(progressions);
  const timingSummary = summarizeLevelTimings(timings);
  const forecastTotal = forecast.reduce((sum, day) => sum + day.count, 0);
  const activeDays = activity.filter((day) => day.count > 0).length;
  const activitySignals = activity.reduce((sum, day) => sum + day.count, 0);
  const cards: Record<AnalyticsCardId, { summary: string; content: ReactNode }> = {
    accuracy: {
      summary: accuracy.percentage === null ? "No attempts" : `${accuracy.percentage}% overall`,
      content: <section className={styles.accuracySection}><div className={styles.accuracyLead}><strong className={styles.heroMetric}>{accuracy.percentage === null ? "—" : `${accuracy.percentage}%`}</strong><p>{accuracy.correct.toLocaleString()} correct answers across {(accuracy.correct + accuracy.incorrect).toLocaleString()} recorded attempts.</p></div><div className={styles.accuracyDetails}><AccuracyRow label="Meaning" value={meaningAccuracy} correct={accuracy.meaningCorrect} total={accuracy.meaningCorrect + accuracy.meaningIncorrect} /><AccuracyRow label="Reading" value={readingAccuracy} correct={accuracy.readingCorrect} total={accuracy.readingCorrect + accuracy.readingIncorrect} /></div></section>,
    },
    srs: {
      summary: `${srsTotal.toLocaleString()} subjects`,
      content: <><div className={styles.segmentBar} aria-label="SRS stage distribution">{SRS_ORDER.map((key) => <span key={key} data-srs={key.toLowerCase()} style={{ width: `${srsTotal ? (srs[key] / srsTotal) * 100 : 0}%` }} />)}</div><dl className={styles.breakdownList}>{SRS_ORDER.map((key) => <div key={key}><dt><SrsStageIcon level={key} size={22} />{key}</dt><dd>{srs[key].toLocaleString()}</dd></div>)}</dl></>,
    },
    forecast: {
      summary: `${forecastTotal.toLocaleString()} scheduled`,
      content: <div className={styles.forecast} role="img" aria-label={forecast.map((day) => `${day.label}: ${day.count} reviews`).join(", ")}>{forecast.map((day) => <div key={day.key} className={styles.forecastColumn}><div className={styles.forecastTrack}><span style={{ transform: `scaleY(${day.count / forecastMax})` }} /></div><strong>{day.count}</strong><span>{day.label}</span></div>)}</div>,
    },
    activity: {
      summary: `${activitySignals.toLocaleString()} signals · ${activeDays} active days`,
      content: <ActivityHeatmap activity={activityHistory} />,
    },
    timing: {
      summary: timingSummary.average === null ? "No completed levels" : `${formatDuration(timingSummary.average)} average`,
      content: <LevelTimingChart timings={timings} resetCount={resets.length} />,
    },
  };

  const announcePosition = (id: AnalyticsCardId, next: AnalyticsCardLayout[]) => {
    const position = next.findIndex((card) => card.id === id) + 1;
    setAnnouncement(`${CARD_LABELS[id]} moved to position ${position} of ${next.length}.`);
  };

  const moveCard = (source: AnalyticsCardId, target: AnalyticsCardId) => {
    setLayout((current) => {
      const next = moveAnalyticsCard(current, source, target);
      announcePosition(source, next);
      return next;
    });
  };

  const moveCardBy = (id: AnalyticsCardId, offset: -1 | 1) => {
    setLayout((current) => {
      const next = moveAnalyticsCardBy(current, id, offset);
      announcePosition(id, next);
      return next;
    });
  };

  return (
    <main className={`page ${styles.page}`} data-compact-workspace {...firstReveal}>
      <ProgressTabs active="analytics" action={<Button tone={editMode ? "primary" : "ghost"} size="small" onClick={() => { setEditMode((value) => !value); setDraggedCard(null); setDragTarget(null); }}>{editMode ? <Check size={15} aria-hidden /> : <SlidersHorizontal size={15} aria-hidden />}{editMode ? "Done" : "Edit dashboard"}</Button>} />

      {editMode ? <div className={styles.analyticsEditBar}><p><strong>Edit dashboard</strong><span>Drag cards to reorder them, or use the arrow buttons. Expanded cards span the full dashboard.</span></p><Button tone="ghost" size="small" onClick={() => { setLayout(DEFAULT_ANALYTICS_LAYOUT.map((card) => ({ ...card }))); setAnnouncement("Dashboard layout reset."); }}><RotateCcw size={16} aria-hidden />Reset layout</Button></div> : null}

      <div className={styles.analyticsDashboard} data-editing={editMode ? "true" : undefined}>
        {layout.map((card, index) => {
          const icon = card.id === "accuracy" ? <Gauge size={19} aria-hidden /> : card.id === "srs" ? <Flame size={19} aria-hidden /> : card.id === "forecast" ? <CalendarDays size={19} aria-hidden /> : card.id === "activity" ? <Activity size={19} aria-hidden /> : <TimerReset size={19} aria-hidden />;
          return <AnalyticsCard key={card.id} card={card} index={index} total={layout.length} icon={icon} summary={cards[card.id].summary} editMode={editMode} dragTarget={dragTarget === card.id} onDragStart={() => setDraggedCard(card.id)} onDragEnter={() => setDragTarget(card.id)} onDrop={() => { if (draggedCard) moveCard(draggedCard, card.id); setDraggedCard(null); setDragTarget(null); }} onDragEnd={() => { setDraggedCard(null); setDragTarget(null); }} onMove={(offset) => moveCardBy(card.id, offset)} onToggleSize={() => { setLayout((current) => toggleAnalyticsCardSize(current, card.id)); setAnnouncement(`${CARD_LABELS[card.id]} ${card.size === "wide" ? "collapsed" : "expanded"}.`); }}>{cards[card.id].content}</AnalyticsCard>;
        })}
      </div>
      <p className="sr-only" aria-live="polite">{announcement}</p>
    </main>
  );
}

function AnalyticsCard({ card, index, total, icon, summary, editMode, dragTarget, onDragStart, onDragEnter, onDrop, onDragEnd, onMove, onToggleSize, children }: { card: AnalyticsCardLayout; index: number; total: number; icon: ReactNode; summary: string; editMode: boolean; dragTarget: boolean; onDragStart: () => void; onDragEnter: () => void; onDrop: () => void; onDragEnd: () => void; onMove: (offset: -1 | 1) => void; onToggleSize: () => void; children: ReactNode }) {
  const titleId = `analytics-card-${card.id}`;
  return <Card padding="none" className={styles.analyticsCard} data-size={card.size} data-drag-target={dragTarget ? "true" : undefined} role="region" aria-labelledby={titleId} onDragOver={(event) => { if (editMode) event.preventDefault(); }} onDragEnter={onDragEnter} onDrop={(event) => { event.preventDefault(); onDrop(); }}><header className={styles.analyticsCardHead}><div>{icon}<span><h2 id={titleId}>{CARD_LABELS[card.id]}</h2><small>{summary}</small></span></div>{editMode ? <div className={styles.analyticsCardControls}><span className={styles.layoutIconButton} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", card.id); onDragStart(); }} onDragEnd={onDragEnd} aria-hidden title="Drag to reorder"><GripVertical size={18} aria-hidden /></span><button type="button" className={styles.layoutIconButton} onClick={() => onMove(-1)} disabled={index === 0} aria-label={`Move ${CARD_LABELS[card.id]} earlier`}><ChevronUp size={17} aria-hidden /></button><button type="button" className={styles.layoutIconButton} onClick={() => onMove(1)} disabled={index === total - 1} aria-label={`Move ${CARD_LABELS[card.id]} later`}><ChevronDown size={17} aria-hidden /></button><button type="button" className={styles.layoutIconButton} onClick={onToggleSize} aria-label={`${card.size === "wide" ? "Collapse" : "Expand"} ${CARD_LABELS[card.id]}`} title={card.size === "wide" ? "Collapse card" : "Expand card"}>{card.size === "wide" ? <Minimize2 size={17} aria-hidden /> : <Maximize2 size={17} aria-hidden />}</button></div> : null}</header><div className={styles.analyticsCardBody}>{children}</div></Card>;
}

function ActivityHeatmap({ activity }: { activity: ActivityDay[] }) {
  return <section className={styles.activityHeatmap}><div className={styles.activityHeatmapHead}><p>Assignment updates plus lesson, Guru, and burn milestones.</p></div><ReviewActivityHeatmap days={activity} label="Past year of approximate learning activity" /></section>;
}

function formatDuration(value: number) {
  const rounded = value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return `${rounded} ${value === 1 ? "day" : "days"}`;
}

function formatCompactDuration(value: number) {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}d`;
}

export function LevelTimingChart({ timings, resetCount, density = "default" }: { timings: LevelTiming[]; resetCount: number | null; density?: "default" | "dashboard" }) {
  const [excludedLevels, setExcludedLevels] = useState<Set<number>>(() => new Set());
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const completedCount = timings.filter((timing) => timing.daysToPass !== null).length;
  const summary = summarizeLevelTimings(timings, excludedLevels);
  const displayedValues = timings.map((timing) => timing.daysToPass ?? timing.activeDays);
  const rawMax = Math.max(1, ...displayedValues);
  const typicalCeiling = summary.median === null ? rawMax : Math.max(7, summary.median * 2);
  const plotMax = Math.max(1, Math.ceil(Math.min(rawMax, typicalCeiling)));
  const ticks = [plotMax, Math.round(plotMax * 2 / 3), Math.round(plotMax / 3), 0];
  const medianPosition = summary.median === null ? null : Math.max(9, Math.min(87, 9 + (summary.median / plotMax) * 78));
  const highestLevel = timings.reduce((highest, timing) => Math.max(highest, timing.level), 0);
  const levelDensity = highestLevel > 30 ? "dense" : highestLevel > 12 ? "compact" : "roomy";
  const hasExclusions = excludedLevels.size > 0;

  useEffect(() => {
    const scrollingPlot = chartScrollRef.current;
    if (scrollingPlot) scrollingPlot.scrollLeft = scrollingPlot.scrollWidth;
  }, [highestLevel, timings.length]);

  const toggleLevel = (level: number) => {
    setExcludedLevels((current) => {
      const next = new Set(current);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });
  };

  if (timings.length === 0) return <p className={styles.analyticsEmpty}>Level timing appears after your first level progression is available.</p>;

  return (
    <section className={styles.timingSection} data-density={density} data-level-density={levelDensity}>
      <div className={styles.timingSummary}>
        <div><small>Average</small><strong data-testid="timing-average">{summary.average === null ? "—" : formatDuration(summary.average)}</strong></div>
        <div><small>Median</small><strong data-testid="timing-median">{summary.median === null ? "—" : formatDuration(summary.median)}</strong></div>
        <div><small>Included</small><strong>{summary.count} / {completedCount}</strong></div>
        {resetCount === null ? null : <p>{resetCount ? `${resetCount} reset ${resetCount === 1 ? "attempt" : "attempts"} omitted.` : "Reset attempts are omitted automatically."}</p>}
        {hasExclusions ? <button type="button" className={styles.timingReset} onClick={() => setExcludedLevels(new Set())}><RotateCcw size={14} aria-hidden />Include all levels</button> : null}
      </div>
      <div className={styles.timingChartViewport}>
        <div ref={chartScrollRef} className={styles.timingChartScroll} data-testid="timing-chart-scroll">
          <div className={styles.timingChart} style={{ "--timing-columns": Math.max(timings.length, 1) } as React.CSSProperties}>
            <div className={styles.timingGridLines} aria-hidden>{ticks.map((tick, index) => <i key={`${tick}-${index}`} />)}</div>
            {medianPosition !== null ? <div className={styles.timingMedianLine} aria-hidden style={{ bottom: `${medianPosition}%` }} /> : null}
            <div className={styles.timingBars}>
              {timings.map((timing) => {
                const value = timing.daysToPass ?? timing.activeDays;
                const inProgress = timing.daysToPass === null;
                const isExcluded = excludedLevels.has(timing.level);
                const isTruncated = value > plotMax;
                const tone = isExcluded ? "excluded" : inProgress ? "progress" : value === summary.fastest ? "fastest" : value === summary.slowest ? "slowest" : summary.median !== null && value > summary.median ? "above" : "typical";
                const actionLabel = inProgress ? `Level ${timing.level} in progress, ${formatDuration(value)}` : `${isExcluded ? "Include" : "Exclude"} level ${timing.level}, ${formatDuration(value)}`;
                return <button type="button" key={timing.level} className={styles.timingBarButton} data-tone={tone} aria-label={actionLabel} aria-pressed={isExcluded} disabled={inProgress} onClick={() => toggleLevel(timing.level)}><span className={styles.timingColumn} data-truncated={isTruncated ? "true" : undefined} style={{ "--timing-height": Math.min(value, plotMax) / plotMax } as React.CSSProperties}><b>{formatCompactDuration(value)}</b>{isTruncated ? <i className={styles.timingBreak} aria-hidden /> : null}</span><span className={styles.timingLabel}>L{timing.level}</span></button>;
              })}
            </div>
          </div>
        </div>
        <div className={styles.timingStickyGutter} aria-hidden>
          <div className={styles.timingStickyScale}>{ticks.map((tick, index) => <i key={`${tick}-${index}`}><span>{tick}d</span></i>)}</div>
          {medianPosition !== null ? <span className={styles.timingMedianSticky} data-testid="timing-median-sticky" style={{ top: `${100 - medianPosition}%` }}>median {formatCompactDuration(summary.median as number)}</span> : null}
        </div>
      </div>
      <div className={styles.timingLegend} aria-label="Level timing legend"><span data-tone="fastest"><i />Quickest level</span><span data-tone="typical"><i />Median or faster</span><span data-tone="above"><i />Slower than median</span><span data-tone="slowest"><i />Longest level</span><span data-tone="progress"><i />Current level</span>{hasExclusions ? <span data-tone="excluded"><i />Excluded</span> : null}</div>
    </section>
  );
}

function AccuracyRow({ label, value, correct, total }: { label: string; value: number | null; correct: number; total: number }) {
  return <div className={styles.accuracyRow}><div><strong>{label}</strong><span>{correct.toLocaleString()} of {total.toLocaleString()}</span></div><strong>{value === null ? "—" : `${value}%`}</strong><div className={styles.accuracyTrack} role="progressbar" aria-label={`${label} accuracy`} aria-valuenow={value ?? 0} aria-valuemin={0} aria-valuemax={100}><span style={{ transform: `scaleX(${(value ?? 0) / 100})` }} /></div></div>;
}

function AnalyticsSkeleton() {
  return <main className={`page ${styles.page}`} data-compact-workspace aria-busy="true"><ProgressTabs active="analytics" /><div className={styles.analyticsSkeletonGrid}><Skeleton height="14rem" /><Skeleton height="14rem" /><Skeleton height="17rem" /><Skeleton height="17rem" /></div></main>;
}

function AnalyticsError({ retry }: { retry: () => Promise<void> }) {
  const [isRetrying, setIsRetrying] = useState(false);
  return <main className={`page ${styles.page}`} data-compact-workspace><ProgressTabs active="analytics" /><div className={styles.errorState}><CircleAlert size={28} aria-hidden /><h1>Analytics are unavailable</h1><p>WaniKani did not return all of the data needed for this view. Try the request again here.</p><Button state={isRetrying ? "loading" : "idle"} onClick={async () => { setIsRetrying(true); try { await retry(); } finally { setIsRetrying(false); } }}>Try again</Button></div></main>;
}
