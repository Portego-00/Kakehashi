"use client";

import { ChartColumn, ChartColumnStacked, ChevronDown, Layers, List } from "lucide-react";
import { useId, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { SrsStageIcon } from "@/components/SrsStageIcon";
import {
  getDailyReviewForecast,
  getHourlyReviewForecast,
  type ForecastCounts,
  type ForecastSrsBreakdown,
  type ForecastSubjectBreakdown,
  type ReviewForecast as ReviewForecastData,
  type ReviewForecastDay,
  type ReviewForecastPoint,
} from "./review-forecast";
import { useReviewForecastMotion } from "./use-review-forecast-motion";
import styles from "./review-forecast.module.css";

type Breakdown = "off" | "subject" | "srs";

type ReviewForecastProps = {
  forecast: ReviewForecastData;
  viewMode: "chart" | "list";
  chartMode: "hourly" | "daily";
  breakdown: Breakdown;
  onViewModeChange: (value: "chart" | "list") => void;
  onChartModeChange: (value: "hourly" | "daily") => void;
  onBreakdownChange: (value: Breakdown) => void;
  title?: string;
  embedded?: boolean;
  loading?: boolean;
  unavailable?: ReactNode;
};

const BREAKDOWN_LABELS = { off: "Off", subject: "Type", srs: "SRS" } as const;
const NEXT_BREAKDOWN = { off: "subject", subject: "srs", srs: "off" } as const;
const SRS_GROUPS = ["apprentice", "guru", "master", "enlightened"] as const;
const SUBJECT_GROUPS = [
  { key: "radical", label: "Radicals", glyph: "幺" },
  { key: "kanji", label: "Kanji", glyph: "字" },
  { key: "vocabulary", label: "Vocabulary", glyph: "語" },
] as const;

function subscribeToScreenSize(onChange: () => void) {
  const query = window.matchMedia?.("(min-width: 769px)");
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
}

function isWideScreen() {
  return window.matchMedia?.("(min-width: 769px)").matches ?? false;
}

function narrowServerSnapshot() { return false; }

function segments(subjects: ForecastSubjectBreakdown, srs: ForecastSrsBreakdown, breakdown: Breakdown) {
  if (breakdown === "srs") return SRS_GROUPS.map((key) => ({ key, count: srs[key] }));
  return SUBJECT_GROUPS.map(({ key }) => ({ key, count: subjects[key] + (key === "vocabulary" ? subjects.kana_vocabulary : 0) }));
}

function BreakdownBar({ count, subjects, srs, breakdown, critical, horizontal = false, style }: {
  count: number;
  subjects: ForecastSubjectBreakdown;
  srs: ForecastSrsBreakdown;
  breakdown: Breakdown;
  critical: boolean;
  horizontal?: boolean;
  style?: CSSProperties;
}) {
  return <span className={styles.bar} data-forecast-bar data-breakdown={breakdown} data-critical={critical || undefined} data-empty={count === 0 || undefined} data-horizontal={horizontal || undefined} style={style}>
    {breakdown !== "off" && count > 0 ? segments(subjects, srs, breakdown).filter((segment) => segment.count > 0).map((segment) => (
      <span key={segment.key} className={styles.segment} data-group={segment.key} style={{ flexGrow: segment.count }} />
    )) : null}
  </span>;
}

function BreakdownLegend({ breakdown }: { breakdown: Breakdown }) {
  if (breakdown === "off") return null;
  return <div className={styles.legend} aria-label={breakdown === "subject" ? "Subject type legend" : "SRS stage legend"}>
    <span className={styles.legendTitle}>{breakdown === "subject" ? "Type" : "SRS"}</span>
    {breakdown === "subject" ? SUBJECT_GROUPS.map(({ key, label, glyph }) => (
      <span key={key} className={styles.legendItem} title={label}>
        <span className={styles.subjectGlyph} data-group={key} aria-hidden="true">{glyph}</span>
        <span className={styles.visuallyHidden}>{label}</span>
      </span>
    )) : SRS_GROUPS.map((group) => (
      <span key={group} className={styles.legendItem} data-group={group} title={`${group[0].toUpperCase()}${group.slice(1)}`}>
        <SrsStageIcon level={group} size={20} />
        <span className={styles.visuallyHidden}>{`${group[0].toUpperCase()}${group.slice(1)}`}</span>
      </span>
    ))}
  </div>;
}

function pointDescription(point: ReviewForecastPoint, daily: boolean) {
  const label = daily ? point.label : point.key === "now" ? "Now" : `${point.end.toLocaleDateString([], { weekday: "long" })} ${point.label}`;
  return `${label}: ${point.cumulativeCount} total reviews, ${point.count} new reviews`;
}

function breakdownDescription(point: ReviewForecastPoint, breakdown: Breakdown) {
  if (breakdown === "off") return "";
  return segments(point.cumulativeSubjectBreakdown, point.cumulativeSrsBreakdown, breakdown)
    .filter(({ count }) => count > 0)
    .map(({ key, count }) => `${key[0].toUpperCase()}${key.slice(1)}: ${count.toLocaleString()}`)
    .join(" · ");
}

function ForecastChart({ points, daily, breakdown }: { points: ReviewForecastPoint[]; daily: boolean; breakdown: Breakdown }) {
  const max = Math.max(1, ...points.map((point) => point.cumulativeCount));
  return <div className={styles.chartScroll} tabIndex={0} role="region" aria-label={daily ? "Seven-day forecast chart" : "Scrollable hourly forecast chart"}>
    <ol className={styles.chart} data-daily={daily || undefined} aria-label={daily ? "Daily review forecast" : "Hourly review forecast"}>
      {points.map((point, index) => {
        const description = pointDescription(point, daily);
        const label = daily && index > 1 ? point.start.toLocaleDateString([], { weekday: "short" }) : point.label;
        const showValue = point.cumulativeCount > 0 && (index === 0 || point.cumulativeCount !== points[index - 1].cumulativeCount);
        return <li key={point.key} className={styles.chartPoint} data-future-day={!point.isToday || undefined} aria-label={description} title={[description, breakdownDescription(point, breakdown), point.critical ? "Includes current-level apprentice radicals or kanji" : ""].filter(Boolean).join("\n")}>
          <div className={styles.column} aria-hidden="true">
            <span className={styles.value}>{showValue ? point.cumulativeCount.toLocaleString() : ""}</span>
            <BreakdownBar count={point.cumulativeCount} subjects={point.cumulativeSubjectBreakdown} srs={point.cumulativeSrsBreakdown} breakdown={breakdown} critical={point.critical} style={{ height: `${point.cumulativeCount / max * (daily ? 6.25 : 7.5)}rem` }} />
          </div>
          <span className={styles.pointLabel} aria-hidden="true">{label}{!daily && point.dayLabel ? <small>{point.dayLabel}</small> : null}</span>
        </li>;
      })}
    </ol>
  </div>;
}

function HourRow({ label, counts, cumulativeCount, maximum, breakdown, now = false }: {
  label: string;
  counts: ForecastCounts;
  cumulativeCount: number;
  maximum: number;
  breakdown: Breakdown;
  now?: boolean;
}) {
  const count = now ? 0 : counts.count;
  return <li className={styles.hourRow} data-critical={counts.critical || undefined} aria-label={`${label}: ${count} new reviews, ${cumulativeCount} total reviews`}>
    <span className={styles.hourLabel}>{label}</span>
    <span className={styles.hourTrack} aria-hidden="true">
      <BreakdownBar count={counts.count} subjects={counts.subjectBreakdown} srs={counts.srsBreakdown} breakdown={breakdown} critical={counts.critical} horizontal style={{ width: `${now ? counts.count > 0 ? 100 : 0 : counts.count / Math.max(maximum, 1) * 100}%` }} />
    </span>
    <span className={styles.newCount}>{count.toLocaleString()}</span>
    <span className={styles.totalCount}>{cumulativeCount.toLocaleString()}</span>
  </li>;
}

function ForecastDay({ day, dueNow, breakdown, expanded, onToggle }: {
  day: ReviewForecastDay;
  dueNow: ForecastCounts;
  breakdown: Breakdown;
  expanded: boolean;
  onToggle: () => void;
}) {
  const hoursId = useId();
  const hours = day.hours.filter((hour) => hour.count > 0);
  return <div className={styles.day}>
    <button type="button" className={styles.dayHeader} onClick={onToggle} aria-expanded={expanded} aria-controls={hoursId} aria-label={`${day.label}: ${day.count} new reviews, ${day.cumulativeCount} total reviews`}>
      <span className={styles.chevron} aria-hidden="true"><ChevronDown size={17} /></span>
      <span className={styles.dayLabel}>{day.label}</span>
      <span className={styles.newCount}>{day.count.toLocaleString()}</span>
      <span className={styles.totalCount}>{day.cumulativeCount.toLocaleString()}</span>
    </button>
    <div id={hoursId} className={styles.dayBody} hidden={!expanded}>
      <ol className={styles.hours} aria-label={`${day.label} hourly reviews`}>
        {day.isToday ? <HourRow label="Now" counts={dueNow} cumulativeCount={dueNow.count} maximum={day.count} breakdown={breakdown} now /> : null}
        {hours.map((hour) => <HourRow key={hour.key} label={hour.start.toLocaleTimeString([], { hour: "numeric", hour12: true }).replace(/\s/g, "").toLowerCase()} counts={hour} cumulativeCount={hour.cumulativeCount} maximum={day.count} breakdown={breakdown} />)}
      </ol>
      {hours.length === 0 && (!day.isToday || dueNow.count === 0) ? <p className={styles.emptyDay}>No reviews scheduled for this day.</p> : null}
    </div>
  </div>;
}

export function ReviewForecast({ forecast, viewMode, chartMode, breakdown, onViewModeChange, onChartModeChange, onBreakdownChange, title = "Review forecast", embedded = false, loading = false, unavailable }: ReviewForecastProps) {
  const headingId = useId();
  const wide = useSyncExternalStore(subscribeToScreenSize, isWideScreen, narrowServerSnapshot);
  // Date-keyed overrides preserve the user's expanded days through minute refreshes.
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const daily = chartMode === "daily";
  const points = daily ? getDailyReviewForecast(forecast) : getHourlyReviewForecast(forecast, wide ? 48 : 24);
  const BreakdownIcon = breakdown === "srs" ? Layers : breakdown === "subject" ? ChartColumnStacked : ChartColumn;
  const nextBreakdown = NEXT_BREAKDOWN[breakdown];
  const Heading = embedded ? "h3" : "h2";
  const motionRef = useReviewForecastMotion(!loading && !unavailable, `${viewMode}:${viewMode === "chart" ? chartMode : ""}:${breakdown}`);

  return <section className={styles.forecast} data-embedded={embedded || undefined} aria-labelledby={headingId} aria-busy={loading || undefined}>
    <Heading id={headingId} className={styles.heading}>{title}</Heading>
    {loading ? <div className={styles.placeholder} role="status">Loading review forecast…</div> : unavailable ? <div className={styles.placeholder}>{unavailable}</div> : <>
      <div className={styles.toolbar}>
        <div className={styles.segmented} role="group" aria-label="Forecast view">
          <button type="button" onClick={() => onViewModeChange("chart")} aria-label="Chart view" aria-pressed={viewMode === "chart"} title="Chart view"><ChartColumn size={18} aria-hidden="true" /></button>
          <button type="button" onClick={() => onViewModeChange("list")} aria-label="List view" aria-pressed={viewMode === "list"} title="List view"><List size={18} aria-hidden="true" /></button>
        </div>
        <div className={styles.chartControls}>
          {viewMode === "chart" ? <div className={`${styles.segmented} ${styles.rangeControl}`} role="group" aria-label="Forecast range">
            <button type="button" onClick={() => onChartModeChange("hourly")} aria-pressed={!daily}>Hourly</button>
            <button type="button" onClick={() => onChartModeChange("daily")} aria-pressed={daily}>Daily</button>
          </div> : null}
          <button type="button" className={styles.breakdownButton} data-active={breakdown !== "off" || undefined} aria-label={`Breakdown: ${BREAKDOWN_LABELS[breakdown]}`} title={`Breakdown: ${BREAKDOWN_LABELS[breakdown]}. Switch to ${BREAKDOWN_LABELS[nextBreakdown]}.`} onClick={() => onBreakdownChange(nextBreakdown)}><BreakdownIcon size={19} aria-hidden="true" /></button>
        </div>
      </div>
      <div ref={motionRef} data-forecast-motion>
        <div className={styles.legendSlot}><BreakdownLegend breakdown={breakdown} /></div>
        <div hidden={viewMode !== "chart"}><ForecastChart points={points} daily={daily} breakdown={breakdown} /></div>
        <div className={styles.dayList} hidden={viewMode !== "list"}>
          <div className={styles.listColumns} aria-hidden="true"><span>New</span><span>Total</span></div>
          {forecast.days.map((day) => <ForecastDay key={day.key} day={day} dueNow={forecast.dueNow} breakdown={breakdown} expanded={expandedDays[day.key] ?? day.isToday} onToggle={() => setExpandedDays((current) => ({ ...current, [day.key]: !(current[day.key] ?? day.isToday) }))} />)}
        </div>
      </div>
      <span className={styles.visuallyHidden}>Totals are cumulative and include reviews already due. Type breakdown combines kana and kanji vocabulary.</span>
      {(daily || viewMode === "list") && forecast.laterCount > 0 ? <p className={styles.later}>{forecast.laterCount.toLocaleString()} more {forecast.laterCount === 1 ? "review is" : "reviews are"} scheduled after these 7 days.</p> : null}
    </>}
  </section>;
}
