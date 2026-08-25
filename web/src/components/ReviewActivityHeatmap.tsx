"use client";

import { createPortal } from "react-dom";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import styles from "./ReviewActivityHeatmap.module.css";

export type ReviewActivityDay = {
  date: Date;
  key: string;
  count: number;
};

type TooltipState = {
  index: number;
  label: string;
  left: number;
  top: number;
  placement: "above" | "below";
};

type ReviewActivityHeatmapProps = {
  days: ReviewActivityDay[];
  label?: string;
};

const DAY_IN_MS = 86_400_000;
const HOVER_DELAY_MS = 800;
const TOOLTIP_CLOSE_DELAY_MS = 120;
const TOOLTIP_EDGE_GUTTER = 112;

function localDayNumber(date: Date) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_IN_MS);
}

function localDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function activityLabel(day: ReviewActivityDay) {
  const date = day.date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  if (day.count === 0) return `No activity on ${date}`;
  return `${day.count.toLocaleString()} activity ${day.count === 1 ? "signal" : "signals"} on ${date}`;
}

export function ReviewActivityHeatmap({ days, label = "Review activity over the past year" }: ReviewActivityHeatmapProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(Math.max(0, days.length - 1));
  const [selectedYear, setSelectedYear] = useState(() => days.at(-1)?.date.getFullYear() ?? new Date().getFullYear());
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const availableYears = useMemo(() => {
    if (!days.length) return [];
    const firstYear = days[0].date.getFullYear();
    const latestYear = days[days.length - 1].date.getFullYear();
    return Array.from({ length: latestYear - firstYear + 1 }, (_, index) => latestYear - index);
  }, [days]);
  const latestYear = availableYears[0] ?? selectedYear;
  const activeYear = availableYears.includes(selectedYear) ? selectedYear : latestYear;
  const visibleDays = useMemo(() => activeYear === latestYear
    ? days.slice(-365)
    : days.filter((day) => day.date.getFullYear() === activeYear), [activeYear, days, latestYear]);

  const calendar = useMemo(() => {
    if (!visibleDays.length) return { firstDayNumber: 0, weekCount: 0, maximum: 1, months: [] as Array<{ key: string; label: string; column: number }> };

    const firstDate = visibleDays[0].date;
    const firstDayNumber = localDayNumber(firstDate) - firstDate.getDay();
    const lastDayNumber = localDayNumber(visibleDays[visibleDays.length - 1].date);
    const weekCount = Math.floor((lastDayNumber - firstDayNumber) / 7) + 1;
    const maximum = Math.max(1, ...visibleDays.map((day) => day.count));
    const months: Array<{ key: string; label: string; column: number }> = [];

    for (const day of visibleDays) {
      if (day.date.getDate() !== 1) continue;
      const column = Math.floor((localDayNumber(day.date) - firstDayNumber) / 7) + 1;
      const previous = months[months.length - 1];
      if (previous && column - previous.column < 3) continue;
      months.push({
        key: `${day.date.getFullYear()}-${day.date.getMonth()}`,
        label: day.date.toLocaleDateString(undefined, { month: "short" }),
        column,
      });
    }

    if (!months.length || months[0].column > 3) {
      months.unshift({
        key: `${firstDate.getFullYear()}-${firstDate.getMonth()}`,
        label: firstDate.toLocaleDateString(undefined, { month: "short" }),
        column: 1,
      });
    }

    return { firstDayNumber, weekCount, maximum, months };
  }, [visibleDays]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollLeft = viewport.scrollWidth;
  }, [activeYear, visibleDays]);

  useEffect(() => () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
  }, []);

  useEffect(() => {
    if (!tooltip) return;
    const dismiss = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setTooltip(null);
    };
    document.addEventListener("keydown", dismiss);
    return () => document.removeEventListener("keydown", dismiss);
  }, [tooltip]);

  const clearCloseTimer = () => {
    if (!closeTimerRef.current) return;
    clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };

  const hideTooltip = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    clearCloseTimer();
    setTooltip(null);
  };

  const scheduleTooltipClose = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setTooltip(null), TOOLTIP_CLOSE_DELAY_MS);
  };

  const showTooltip = (index: number, target: HTMLElement) => {
    clearCloseTimer();
    const rect = target.getBoundingClientRect();
    const placement = rect.top > 72 ? "above" : "below";
    setTooltip({
      index,
      label: activityLabel(visibleDays[index]),
      left: Math.min(window.innerWidth - TOOLTIP_EDGE_GUTTER, Math.max(TOOLTIP_EDGE_GUTTER, rect.left + rect.width / 2)),
      top: placement === "above" ? rect.top : rect.bottom,
      placement,
    });
  };

  const scheduleHoverTooltip = (index: number, event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "touch") return;
    hideTooltip();
    const target = event.currentTarget;
    hoverTimerRef.current = setTimeout(() => showTooltip(index, target), HOVER_DELAY_MS);
  };

  const handleFocus = (index: number, event: FocusEvent<HTMLButtonElement>) => {
    setFocusedIndex(index);
    showTooltip(index, event.currentTarget);
  };

  const moveFocus = (index: number, event: KeyboardEvent<HTMLButtonElement>) => {
    const offsets: Record<string, number> = {
      ArrowUp: -1,
      ArrowDown: 1,
      ArrowLeft: -7,
      ArrowRight: 7,
    };
    if (event.key === "Escape") {
      hideTooltip();
      return;
    }

    const offset = offsets[event.key];
    const nextIndex = event.key === "Home"
      ? 0
      : event.key === "End"
        ? visibleDays.length - 1
        : offset === undefined
          ? null
          : Math.min(visibleDays.length - 1, Math.max(0, index + offset));
    if (nextIndex === null || nextIndex === index) return;
    event.preventDefault();
    setFocusedIndex(nextIndex);
    cellRefs.current[nextIndex]?.focus();
  };

  if (!days.length) return <p className={styles.empty}>Review activity will appear after assignment data is available.</p>;

  const calendarStyle = { "--heatmap-weeks": calendar.weekCount } as CSSProperties;
  const todayKey = localDateKey(new Date());
  const tooltipId = "review-activity-heatmap-tooltip";
  const currentFocusedIndex = Math.min(focusedIndex, visibleDays.length - 1);
  const selectedLabel = activeYear === latestYear ? label : `Review activity in ${activeYear}`;

  const selectYear = (year: number) => {
    hideTooltip();
    setFocusedIndex(days.length);
    setSelectedYear(year);
  };

  return <div className={styles.root}>
    <div className={styles.viewport} ref={viewportRef} onScroll={hideTooltip}>
      <div className={styles.canvas} style={calendarStyle}>
        <div className={styles.monthRow} aria-hidden>
          <span className={styles.monthSpacer} />
          <div className={styles.monthGrid}>
            {calendar.months.map((month) => <span key={month.key} style={{ gridColumnStart: month.column }}>{month.label}</span>)}
          </div>
        </div>
        <div className={styles.calendarBody}>
          <div className={styles.weekdays} aria-hidden>
            {["", "Mon", "", "Wed", "", "Fri", ""].map((weekday, index) => <span key={`${weekday}-${index}`}>{weekday}</span>)}
          </div>
          <div className={styles.grid} role="group" aria-label={selectedLabel}>
            {visibleDays.map((day, index) => {
              const dayNumber = localDayNumber(day.date);
              const level = day.count === 0 ? 0 : Math.max(1, Math.ceil((day.count / calendar.maximum) * 4));
              const labelText = activityLabel(day);
              return <button
                className={styles.cell}
                type="button"
                key={day.key}
                ref={(element) => { cellRefs.current[index] = element; }}
                data-level={level}
                data-today={day.key === todayKey || undefined}
                aria-label={labelText}
                aria-describedby={tooltip?.index === index ? tooltipId : undefined}
                tabIndex={index === currentFocusedIndex ? 0 : -1}
                style={{
                  gridColumnStart: Math.floor((dayNumber - calendar.firstDayNumber) / 7) + 1,
                  gridRowStart: day.date.getDay() + 1,
                }}
                onFocus={(event) => handleFocus(index, event)}
                onBlur={scheduleTooltipClose}
                onPointerEnter={(event) => scheduleHoverTooltip(index, event)}
                onPointerLeave={scheduleTooltipClose}
                onClick={(event) => showTooltip(index, event.currentTarget)}
                onKeyDown={(event) => moveFocus(index, event)}
              />;
            })}
          </div>
        </div>
      </div>
    </div>
    <div className={styles.years} role="group" aria-label="Activity year">
      {availableYears.map((year) => <button
        className={styles.yearButton}
        type="button"
        key={year}
        aria-label={year === latestYear ? `${year}, past 12 months` : String(year)}
        aria-pressed={year === activeYear}
        onClick={() => selectYear(year)}
      >{year}</button>)}
    </div>
    <div className={styles.legend} aria-hidden>
      <span>Less</span>
      {[0, 1, 2, 3, 4].map((level) => <i key={level} data-level={level} />)}
      <span>More</span>
    </div>
    {tooltip ? createPortal(
      <div
        className={styles.tooltip}
        data-placement={tooltip.placement}
        id={tooltipId}
        role="tooltip"
        style={{ left: tooltip.left, top: tooltip.top }}
        onPointerEnter={clearCloseTimer}
        onPointerLeave={hideTooltip}
      >{tooltip.label}</div>,
      document.body,
    ) : null}
  </div>;
}
