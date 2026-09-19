"use client";

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { summarizeLevelTimings, type LevelTiming } from "../calculations";
import styles from "../progress.module.css";

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
        {resetCount ? <p>{resetCount} reset {resetCount === 1 ? "attempt" : "attempts"} omitted.</p> : null}
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

